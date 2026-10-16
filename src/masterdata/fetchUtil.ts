/**
 * マスターデータの生成（キャラ・武器・聖遺物）が使う、ネットワーク取得の共通部分。
 *
 *   - タイムアウト: 1 回の取得が、一定時間（既定 30 秒）で終わらなければ、打ち切って再試行する
 *     （応答のない通信で、画面の「生成中」が、いつまでも終わらなくなるのを防ぐ）
 *   - 再試行: 通信の失敗・タイムアウト・サーバーのエラーは、間隔を空けて再試行する。403（回数制限など）・404 は、再試行しない
 *   - GitHub API（api.github.com）だけ、環境変数 GITHUB_TOKEN（無ければ GH_TOKEN）があれば、認証に使う（Node から実行するときだけ。
 *     未認証は 1 時間に 60 回まで）。ほかのサーバーには、トークンを送らない。トークンの値は、エラー文・ログに出さない
 */

export const FETCH_TIMEOUT_MS = 30_000;

const GITHUB_API_HOST = 'api.github.com';

/** Node から実行するときの、GitHub のトークン（ブラウザでは undefined） */
function githubToken(): string | undefined {
  if (typeof process === 'undefined') return undefined;
  return process.env?.GITHUB_TOKEN || process.env?.GH_TOKEN || undefined;
}

function isGithubApi(url: string): boolean {
  try {
    return new URL(url).hostname === GITHUB_API_HOST;
  } catch {
    return false;
  }
}

/** 呼び出し元の signal と、タイムアウトを、合わせた signal */
function withTimeout(signal: AbortSignal | null | undefined, timeoutMs: number): AbortSignal {
  const timeout = AbortSignal.timeout(timeoutMs);
  if (!signal) return timeout;
  return typeof AbortSignal.any === 'function' ? AbortSignal.any([signal, timeout]) : signal;
}

const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

export async function fetchWithRetry(
  url: string,
  init?: RequestInit,
  retries = 2,
  timeoutMs = FETCH_TIMEOUT_MS,
): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const token = isGithubApi(url) ? githubToken() : undefined;
      const headers = token ? { ...(init?.headers as Record<string, string> | undefined), Authorization: `Bearer ${token}` } : init?.headers;
      const res = await fetch(url, { ...init, ...(headers ? { headers } : {}), signal: withTimeout(init?.signal, timeoutMs) });
      if (res.ok) return res;
      lastError = new Error(`HTTP ${res.status} ${res.statusText}: ${url}`);
      if (res.status === 403 || res.status === 404) break; // レート制限・存在しないものは再試行しない
    } catch (e) {
      lastError = e instanceof DOMException && (e.name === 'TimeoutError' || e.name === 'AbortError')
        ? new Error(`タイムアウト（${Math.round(timeoutMs / 1000)} 秒）: ${url}`)
        : e;
      if (init?.signal?.aborted) break; // 呼び出し元が中断したときは、再試行しない
    }
    if (attempt < retries) await sleep(500 * (attempt + 1));
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

export const fetchJson = async <T>(url: string, init?: RequestInit): Promise<T> => (await fetchWithRetry(url, init)).json() as Promise<T>;

/**
 * GitHub のツリー API（git/trees?recursive=1）の応答が、切り詰められていないことを確かめる。
 * 切り詰められる（ファイルが多すぎる）と、一覧の後ろが黙って欠けて、キャラが生成されなくなる。気づけるよう、止める
 */
export function assertGitTreeComplete(tree: { truncated?: boolean; tree?: unknown[] }, label: string): void {
  if (tree.truncated) {
    throw new Error(
      `${label}の一覧が、GitHub の API の上限で切り詰められました（取得できたのは ${tree.tree?.length ?? 0} 件）。` +
      'このまま生成すると、キャラ・武器が欠けるため、中止します（取得の方法を、ディレクトリごとに分ける必要があります）',
    );
  }
}

export const fetchText = async (url: string): Promise<string> => (await fetchWithRetry(url)).text();
