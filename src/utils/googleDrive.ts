/**
 * Google ドライブへの編成 JSON の保存と、共有リンクの取得（D325。「編成付き読込 URL」の生成用）。
 *
 * ・ログインは Google Identity Services のトークン方式（ブラウザだけで完結。サーバーなし）。アクセストークンは、メモリにだけ持つ（保存しない）。
 * ・スコープは drive.file（このアプリが作ったファイル・フォルダにだけ触れる。利用者のドライブの他のファイルは、見えない）。
 * ・読み込み側（rotationUrlImport.ts）は、共有リンクを Drive API の「alt=media + API キー」の URL に直して取得する
 *   （drive.google.com の画面のリンクは、ブラウザからは CORS で読めないため）。
 *
 * 利用者（一般のユーザー）に設定は要らない: Google にログインするだけで、その人自身のドライブに保存される。
 * 設定が要るのは、サイトの運営者だけ（1 回）。OAuth クライアント ID と API キー（どちらも公開される値）を、環境変数
 * VITE_GOOGLE_CLIENT_ID・VITE_GOOGLE_API_KEY で渡す。手順は docs/Googleドライブ連携の設定手順.md。
 * 空のままなら、機能は使えない（ボタンを押すと、設定が無い旨を出す）。
 */
export const GOOGLE_CLIENT_ID: string = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '';
export const GOOGLE_API_KEY: string = import.meta.env.VITE_GOOGLE_API_KEY ?? '';

export const DRIVE_FOLDER_NAME = 'Genshin Rotation Planner';
const SCOPE = 'https://www.googleapis.com/auth/drive.file';
const GIS_URL = 'https://accounts.google.com/gsi/client';
const API = 'https://www.googleapis.com/drive/v3';
const UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3';

export const isDriveConfigured = (): boolean => GOOGLE_CLIENT_ID !== '' && GOOGLE_API_KEY !== '';

/** Drive 側の失敗。reason は、画面の文言の選択に使う */
export class DriveError extends Error {
  constructor(public reason: 'notConfigured' | 'script' | 'auth' | 'denied' | 'api', public detail = '') {
    super(`${reason}${detail ? `: ${detail}` : ''}`);
  }
}

interface TokenResponse { access_token?: string; expires_in?: number; error?: string }
interface GisWindow {
  google?: { accounts: { oauth2: { initTokenClient: (c: {
    client_id: string; scope: string; callback: (r: TokenResponse) => void; error_callback?: (e: { type?: string }) => void;
  }) => { requestAccessToken: (o?: { prompt?: string }) => void } } } };
}

let gisPromise: Promise<void> | null = null;
function loadGis(): Promise<void> {
  if ((window as GisWindow).google?.accounts) return Promise.resolve();
  if (!gisPromise) {
    gisPromise = new Promise<void>((resolve, reject) => {
      const s = document.createElement('script');
      s.src = GIS_URL;
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => { gisPromise = null; reject(new DriveError('script')); };
      document.head.appendChild(s);
    });
  }
  return gisPromise;
}

let token: { value: string; expiresAt: number } | null = null;

/** ログイン済みか（トークンが有効か） */
export const isSignedIn = (): boolean => token !== null && token.expiresAt > Date.now() + 30_000;

/**
 * アクセストークンを得る。未ログイン（または期限切れ）なら、Google のログイン画面（ポップアップ）を出す。
 * ポップアップは、ボタンを押した直後の呼び出しでないとブロックされるので、時間のかかる処理（入力待ちなど）の前に呼ぶこと。
 */
export async function ensureSignedIn(): Promise<string> {
  if (!isDriveConfigured()) throw new DriveError('notConfigured');
  if (token && isSignedIn()) return token.value;
  await loadGis();
  return new Promise<string>((resolve, reject) => {
    const client = (window as GisWindow).google!.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: SCOPE,
      callback: (r) => {
        if (!r.access_token) {
          reject(new DriveError(r.error === 'access_denied' ? 'denied' : 'auth', r.error ?? ''));
          return;
        }
        token = { value: r.access_token, expiresAt: Date.now() + (r.expires_in ?? 3600) * 1000 };
        resolve(r.access_token);
      },
      error_callback: (e) => reject(new DriveError(e.type === 'popup_closed' ? 'denied' : 'auth', e.type ?? '')),
    });
    client.requestAccessToken();
  });
}

async function driveFetch(accessToken: string, url: string, init: RequestInit = {}): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(url, { ...init, headers: { ...(init.headers ?? {}), Authorization: `Bearer ${accessToken}` } });
  } catch {
    throw new DriveError('api', 'network');
  }
  if (res.status === 401) token = null;
  if (!res.ok) throw new DriveError(res.status === 401 ? 'auth' : 'api', `HTTP ${res.status}`);
  return res;
}

/** このアプリ専用のフォルダの ID（無ければ作る）。drive.file では、このアプリが作ったフォルダだけが見える */
async function ensureFolder(accessToken: string): Promise<string> {
  const q = `name='${DRIVE_FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  const found = await (await driveFetch(accessToken, `${API}/files?q=${encodeURIComponent(q)}&fields=files(id)&spaces=drive`)).json() as { files?: { id: string }[] };
  if (found.files?.[0]) return found.files[0].id;
  const created = await (await driveFetch(accessToken, `${API}/files?fields=id`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: DRIVE_FOLDER_NAME, mimeType: 'application/vnd.google-apps.folder' }),
  })).json() as { id: string };
  return created.id;
}

/**
 * JSON をアプリ専用フォルダに保存し、「リンクを知っている全員が閲覧可」にして、共有リンクを返す。
 * 同じ名前でも、毎回、新しいファイルを作る（古いリンクの中身は変わらない）。
 */
export async function uploadSharedJson(accessToken: string, fileName: string, json: string): Promise<string> {
  const folderId = await ensureFolder(accessToken);
  const boundary = `grp${Math.random().toString(36).slice(2)}`;
  const metadata = { name: fileName, parents: [folderId], mimeType: 'application/json' };
  const body = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`
    + `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${json}\r\n--${boundary}--`;
  const file = await (await driveFetch(accessToken, `${UPLOAD_API}/files?uploadType=multipart&fields=id`, {
    method: 'POST',
    headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
    body,
  })).json() as { id: string };
  await driveFetch(accessToken, `${API}/files/${file.id}/permissions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role: 'reader', type: 'anyone' }),
  });
  return `https://drive.google.com/file/d/${file.id}/view?usp=sharing`;
}

/** drive.google.com の共有リンクから、ファイル ID を取り出す（file/d/<ID>/…・open?id=<ID>・uc?id=<ID>） */
export function driveFileIdFromLink(u: URL): string | null {
  if (u.hostname !== 'drive.google.com') return null;
  const m = u.pathname.match(/^\/file\/d\/([\w-]+)/);
  const id = m ? m[1] : u.searchParams.get('id');
  return id && /^[\w-]+$/.test(id) ? id : null;
}

/** 共有リンクの中身を取得する URL（Drive API。API キーが要る。無ければ null） */
export function driveMediaUrl(fileId: string): string | null {
  return GOOGLE_API_KEY ? `${API}/files/${fileId}?alt=media&key=${encodeURIComponent(GOOGLE_API_KEY)}` : null;
}
