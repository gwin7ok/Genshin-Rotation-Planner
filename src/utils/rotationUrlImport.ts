/**
 * URL の引数（?import=<JSON ファイルのリンク>）で指定された編成 JSON を、取得するための部品（D324）。
 * 読み込みの処理そのもの（検証・保存編成への登録）は、手動の JSON 読込と共通（App.tsx の importRotationText）。
 * ここは「引数を取り出して URL から消す」「リンクを検査する」「取得する」だけを持つ。
 */

/** URL の引数の名前（手動の「JSON 読込」= import に合わせた） */
export const IMPORT_URL_PARAM = 'import';

/** 取得できる最大サイズ（編成 1 件の JSON は数百 KB 以下。外部のデータなので、上限を置く） */
export const IMPORT_MAX_BYTES = 5 * 1024 * 1024;
/** 取得の待ち時間（短縮 URL のリダイレクトを含む） */
export const IMPORT_TIMEOUT_MS = 15000;

/**
 * 今の URL から、読み込み用の引数を取り出して、履歴（アドレス欄）から外す。
 * 再読み込みのたびに同じファイルを読み直さないよう、取得の成否にかかわらず、取り出した時点で外す。
 * 他の引数・# 以降は、そのまま残す。
 */
export function takeImportUrlParam(): string | null {
  if (typeof window === 'undefined') return null;
  const url = new URL(window.location.href);
  const value = url.searchParams.get(IMPORT_URL_PARAM);
  if (value === null) return null;
  url.searchParams.delete(IMPORT_URL_PARAM);
  window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
  return value.trim() || null;
}

export type ImportUrlCheck =
  | { ok: true; url: string; host: string }
  | { ok: false; reason: 'invalid' | 'insecure' };

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

/**
 * リンクを検査する。https のみ許可（開発中の localhost は http も許可）。
 * GitHub の画面のリンク（github.com/…/blob/…）は、中身を返す raw.githubusercontent.com に直す。
 */
export function checkImportUrl(raw: string): ImportUrlCheck {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return { ok: false, reason: 'invalid' };
  }
  const local = LOCAL_HOSTS.has(u.hostname);
  if (u.protocol !== 'https:' && !(u.protocol === 'http:' && local)) {
    return { ok: false, reason: u.protocol === 'http:' ? 'insecure' : 'invalid' };
  }
  // 認証情報つきのリンクは、受け付けない
  if (u.username || u.password) return { ok: false, reason: 'invalid' };
  if (u.hostname === 'github.com') {
    const m = u.pathname.match(/^\/([^/]+)\/([^/]+)\/(?:blob|raw)\/(.+)$/);
    if (m) u = new URL(`https://raw.githubusercontent.com/${m[1]}/${m[2]}/${m[3]}`);
  }
  return { ok: true, url: u.toString(), host: u.host };
}

export type ImportFetchResult =
  | { ok: true; text: string; fileName: string }
  | { ok: false; reason: 'network' | 'http' | 'tooLarge' | 'timeout'; status?: number };

/** リンク先を取得する。短縮 URL のリダイレクトは、ブラウザが辿る（リダイレクト先が CORS を許可していないと、network になる） */
export async function fetchImportText(url: string): Promise<ImportFetchResult> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), IMPORT_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: ctrl.signal, credentials: 'omit', redirect: 'follow', cache: 'no-store' });
    if (!res.ok) return { ok: false, reason: 'http', status: res.status };
    const declared = Number(res.headers.get('content-length') ?? 0);
    if (declared > IMPORT_MAX_BYTES) return { ok: false, reason: 'tooLarge' };
    const text = await res.text();
    if (text.length > IMPORT_MAX_BYTES) return { ok: false, reason: 'tooLarge' };
    // 最終的なリンク（リダイレクト後）の末尾を、ファイル名の候補にする
    let fileName = '';
    try {
      fileName = decodeURIComponent(new URL(res.url || url).pathname.split('/').filter(Boolean).pop() ?? '');
    } catch { /* 候補なし */ }
    return { ok: true, text, fileName };
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') return { ok: false, reason: 'timeout' };
    return { ok: false, reason: 'network' };
  } finally {
    clearTimeout(timer);
  }
}
