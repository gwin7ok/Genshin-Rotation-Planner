/**
 * gcsim のクライアント。文法チェック（/validate）と、詳細ログの取得（/sample）。
 * 実行エンジンは、ブラウザの中の WebAssembly 版（gcsimWasm.ts。既定）か、
 * 公式リリースの `server_<OS>_<arch>`（localhost のサーバー。開発・検証用）。選び方は gcsimWasm.ts を参照。
 */
import { GCSIM_SERVER_URL as CONFIGURED_SERVER_URL } from './gcsimConfig.ts';
import { resolveEngine, wasmCall, type GcsimEngine } from './gcsimWasm.ts';
export const GCSIM_SERVER_URL = CONFIGURED_SERVER_URL;
const REQUEST_TIMEOUT_MS = 10000;

/** 今回の呼び出しで使ったエンジン（エラー文に使う。直近の値） */
let lastEngine: GcsimEngine = 'server';

/** 設定文を実行・解析して、本文を得る。server は HTTP、wasm は Worker（本文の形は、どちらも同じ JSON か平文のエラー文） */
async function gcsimRequest(
  kind: 'sample' | 'validate',
  payload: { config: string; seed?: number },
  signal: AbortSignal,
): Promise<{ ok: boolean; status: number; body: string }> {
  const engine = await resolveEngine();
  lastEngine = engine;
  if (engine === 'wasm') {
    const body = await wasmCall(kind, payload, signal);
    return { ok: true, status: 200, body };
  }
  const id = kind === 'sample' ? `sample_${Date.now()}_${payload.seed}` : `validate_${Date.now()}`;
  const res = await fetch(`${GCSIM_SERVER_URL}/${kind}/${id}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(kind === 'sample' ? { config: payload.config, seed: payload.seed } : { config: payload.config }),
    signal,
  });
  return { ok: res.ok, status: res.status, body: await res.text() };
}

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

const unreachableMessage = (e: unknown, timeoutMs: number): string => {
  const timedOut = e instanceof DOMException && e.name === 'AbortError';
  if (lastEngine === 'wasm') {
    return timedOut
      ? `gcsim（ブラウザ内の WebAssembly 版）が ${timeoutMs / 1000}秒以内に終わりませんでした`
      : `gcsim（ブラウザ内の WebAssembly 版）を起動できません: ${e instanceof Error ? e.message : String(e)}`;
  }
  return timedOut
    ? `gcsim サーバー（${GCSIM_SERVER_URL}）からの応答がありません（${timeoutMs / 1000}秒でタイムアウト）`
    : `gcsim サーバー（${GCSIM_SERVER_URL}）に接続できません。公式リリースの server を起動してください`;
};

/** 詳細ログの1イベント（読み取りはフェーズ6の 6-2。ここでは形だけ定義し、未知の項目は無視する） */
export interface GcsimLogEvent {
  /** 種類: action / cooldown / status / sim など */
  event: string;
  /** 発生フレーム（60fps） */
  frame: number;
  /** 終了フレーム（status など。無いものもある） */
  ended?: number;
  char_index?: number;
  msg: string;
  logs?: Record<string, unknown>;
}

export type GcsimSampleResult =
  | { status: 'ok'; logs: GcsimLogEvent[]; seed: number; /** 最初に出場するキャラの gcsim キー（initial_character） */ initialCharacter?: string }
  /** 設定文の文法エラー・実行エラー（message にサーバーの返した内容） */
  | { status: 'error'; message: string }
  /** サーバーに接続できない（未起動・タイムアウトなど） */
  | { status: 'unreachable'; message: string };

/** 詳細ログの取得は1回で約0.4秒・数百KB〜1MB。長めの編成に備えて余裕を持たせる */
const SAMPLE_TIMEOUT_MS = 60000;

/** 設定文を1回実行して詳細ログを得る。POST /sample/{id} `{config, seed}` */
export async function runGcsimSample(config: string, seed: number): Promise<GcsimSampleResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SAMPLE_TIMEOUT_MS);
  try {
    const res = await gcsimRequest('sample', { config, seed }, controller.signal);
    const body = res.body;
    if (!res.ok) {
      return { status: 'error', message: extractErrorText(body) || `HTTP ${res.status}` };
    }
    // 文法エラーは HTTP 200 のまま JSON ではないエラー文で返る（/validate と同じ）
    let parsed: unknown;
    try {
      parsed = JSON.parse(body);
    } catch {
      return { status: 'error', message: body.trim() || '設定文を実行できませんでした' };
    }
    if (parsed === null || typeof parsed !== 'object') {
      return { status: 'error', message: body.trim() };
    }
    const obj = parsed as { error?: unknown; logs?: unknown; initial_character?: unknown };
    if (obj.error !== undefined) {
      return { status: 'error', message: extractErrorText(body) };
    }
    if (!Array.isArray(obj.logs)) {
      return { status: 'error', message: '詳細ログ（logs）が含まれていません' };
    }
    return {
      status: 'ok',
      logs: obj.logs as GcsimLogEvent[],
      seed,
      initialCharacter: typeof obj.initial_character === 'string' ? obj.initial_character : undefined,
    };
  } catch (e) {
    return { status: 'unreachable', message: unreachableMessage(e, SAMPLE_TIMEOUT_MS) };
  } finally {
    clearTimeout(timer);
  }
}

/** 設定文の文法チェック（実行はしない）。POST /validate/{id} */
export async function validateGcsimConfig(config: string): Promise<GcsimValidateResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await gcsimRequest('validate', { config }, controller.signal);
    const body = res.body;
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
    return { status: 'ok', message: lastEngine === 'wasm' ? '文法エラーはありません（gcsim で設定文を解析できました）' : '文法エラーはありません（gcsim サーバーで設定文を解析できました）' };
  } catch (e) {
    return { status: 'unreachable', message: unreachableMessage(e, REQUEST_TIMEOUT_MS) };
  } finally {
    clearTimeout(timer);
  }
}

/** 直近の呼び出しで使ったエンジン（画面のエラー案内の出し分け用） */
export const getLastGcsimEngine = (): GcsimEngine => lastEngine;
