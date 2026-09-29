/**
 * gcsim ローカルサーバー（公式リリースの `server_<OS>_<arch>`）のクライアント。
 * 現在は文法チェック（/validate）のみ。/sample はフェーズ6で追加する。
 */
export const GCSIM_SERVER_URL = 'http://localhost:54321';
const REQUEST_TIMEOUT_MS = 10000;

export type GcsimValidateResult =
  | { status: 'ok'; message: string }
  /** 設定文に文法エラーなどがある（message にサーバーの返した内容） */
  | { status: 'invalid'; message: string }
  /** サーバーに接続できない（未起動・タイムアウトなど） */
  | { status: 'unreachable'; message: string };

const extractErrorText = (body: string): string => {
  try {
    const json = JSON.parse(body);
    const err = json?.error ?? json?.errors ?? json?.message;
    if (err !== undefined) return typeof err === 'string' ? err : JSON.stringify(err, null, 2);
  } catch {
    // JSON でなければそのまま返す
  }
  return body.trim();
};

/** 設定文の文法チェック（実行はしない）。POST /validate/{id} */
export async function validateGcsimConfig(config: string): Promise<GcsimValidateResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(`${GCSIM_SERVER_URL}/validate/validate_${Date.now()}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ config }),
      signal: controller.signal,
    });
    const body = await res.text();
    if (!res.ok) {
      return { status: 'invalid', message: extractErrorText(body) || `HTTP ${res.status}` };
    }
    // 文法エラーは HTTP 200 のまま、本文が JSON ではないエラー文で返る（例: "invalid weapon xxx" / "reached end of file without closing }"）。
    // 成功時は解析結果の JSON オブジェクトが返る
    let parsed: unknown;
    try {
      parsed = JSON.parse(body);
    } catch {
      return { status: 'invalid', message: body.trim() || '設定文を解析できませんでした' };
    }
    if (parsed === null || typeof parsed !== 'object' || 'error' in parsed || 'errors' in parsed) {
      return { status: 'invalid', message: extractErrorText(body) };
    }
    return { status: 'ok', message: '文法エラーはありません（gcsim サーバーで設定文を解析できました）' };
  } catch (e) {
    const timedOut = e instanceof DOMException && e.name === 'AbortError';
    return {
      status: 'unreachable',
      message: timedOut
        ? `gcsim サーバー（${GCSIM_SERVER_URL}）からの応答がありません（${REQUEST_TIMEOUT_MS / 1000}秒でタイムアウト）`
        : `gcsim サーバー（${GCSIM_SERVER_URL}）に接続できません。公式リリースの server を起動してください`,
    };
  } finally {
    clearTimeout(timer);
  }
}
