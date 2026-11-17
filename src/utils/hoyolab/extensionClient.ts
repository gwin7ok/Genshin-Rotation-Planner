/**
 * HoYoLAB 取り込みの拡張機能（extension/hoyolab-importer）との通信。
 * アプリのページ → 拡張機能の content script（window.postMessage）→ 拡張機能の background が HoYoLAB に問い合わせる。
 * Cookie の値は、拡張機能もアプリも読まない（ブラウザが HoYoLAB への通信に自動で付ける）。
 */
import type { HoyolabDetailResponse } from './importCharacters';
import type { EnkaResponse } from './enkaConvert';

let seq = 0;
const nextId = () => `grp-${Date.now()}-${++seq}`;

/** 拡張機能に 1 回問い合わせて、応答を待つ（応答が無ければ null） */
function request<T>(message: Record<string, unknown>, replyType: string, timeoutMs: number): Promise<T | null> {
  return new Promise(resolve => {
    const requestId = nextId();
    const done = (v: T | null) => { window.removeEventListener('message', onMessage); clearTimeout(timer); resolve(v); };
    const onMessage = (ev: MessageEvent) => {
      if (ev.source !== window || ev.data?.source !== 'grp-ext' || ev.data.requestId !== requestId || ev.data.type !== replyType) return;
      done(ev.data as T);
    };
    const timer = setTimeout(() => done(null), timeoutMs);
    window.addEventListener('message', onMessage);
    window.postMessage({ source: 'grp-app', requestId, ...message }, window.location.origin);
  });
}

/** 拡張機能が入っているか。入っていれば、その版を返す（無ければ null。content script の応答は、通常 100ms 以内） */
export async function pingExtension(timeoutMs = 800): Promise<string | null> {
  const res = await request<{ version?: string }>({ type: 'ping' }, 'pong', timeoutMs);
  return res ? (res.version ?? '') : null;
}

/** ok のときは data、失敗のときは error（retcode は HoYoLAB の応答コード。timedOut は、待ち時間のうちに拡張機能から応答が無かった） */
export interface ExtensionFetchResult {
  ok: boolean;
  data?: HoyolabDetailResponse;
  error?: string;
  retcode?: number;
  timedOut?: boolean;
}

/** HoYoLAB から、所持キャラの詳細を取得する（全キャラで約 2MB。数秒かかる） */
export async function fetchFromExtension(uid: string, timeoutMs = 90000): Promise<ExtensionFetchResult> {
  const res = await request<{ ok: boolean; data?: HoyolabDetailResponse; error?: string; retcode?: number }>(
    { type: 'hoyolab-fetch', uid }, 'hoyolab-result', timeoutMs);
  if (!res) return { ok: false, error: 'timeout', timedOut: true };
  if (res.ok && res.data && Array.isArray(res.data.list)) return { ok: true, data: res.data };
  return { ok: false, error: res.error ?? 'unknown', retcode: res.retcode };
}

/** Enka.Network（他のアカウントの UID）の取得結果。code は拡張機能が付ける種類（not_found・rate_limited など） */
export interface EnkaFetchResult {
  ok: boolean;
  data?: EnkaResponse;
  error?: string;
  code?: string;
  timedOut?: boolean;
}

/** Enka.Network から、他のアカウントの UID の「キャラクター詳細表示」のキャラを取得する（拡張機能 v0.2.0 以降） */
export async function fetchEnkaFromExtension(uid: string, timeoutMs = 20000): Promise<EnkaFetchResult> {
  const res = await request<{ ok: boolean; data?: EnkaResponse; error?: string; code?: string }>(
    { type: 'enka-fetch', uid }, 'enka-result', timeoutMs);
  if (!res) return { ok: false, error: 'timeout', timedOut: true };
  if (res.ok && res.data) return { ok: true, data: res.data };
  return { ok: false, error: res.error ?? 'unknown', code: res.code };
}
