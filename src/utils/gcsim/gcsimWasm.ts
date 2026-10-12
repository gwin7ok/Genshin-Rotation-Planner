/**
 * gcsim の WebAssembly 版（public/gcsim/main.wasm。`npm run wasm:build` で生成）を、Web Worker で動かすクライアント。
 *
 * 実行エンジンは 2 つ:
 *   - 'wasm'   … ブラウザの中で実行する（利用者の手間なし。公開サイトの既定）
 *   - 'server' … 公式リリースの server_*（localhost:54321）を使う（開発・検証用）
 * 選び方（localStorage の `gcsim_engine`）: 'auto'（既定。main.wasm があれば wasm、無ければ server）／'wasm'／'server'。
 */
export type GcsimEngine = 'wasm' | 'server';
export type GcsimEnginePreference = 'auto' | GcsimEngine;

import { DEVICE_KEYS, readString, removeKey, writeString } from '../persistence';

const baseUrl = (): string => (import.meta as unknown as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? '/';

export function getEnginePreference(): GcsimEnginePreference {
  const v = readString(DEVICE_KEYS.gcsimEngine);
  if (v === 'wasm' || v === 'server') return v;
  return 'auto';
}

export function setEnginePreference(pref: GcsimEnginePreference): void {
  if (pref === 'auto') removeKey(DEVICE_KEYS.gcsimEngine);
  else writeString(DEVICE_KEYS.gcsimEngine, pref);
  cachedWasmAvailable = null;
}

let cachedWasmAvailable: Promise<boolean> | null = null;

/** main.wasm が配信されているか（開発サーバーは、無いファイルにも HTML を返すので、種類で見分ける） */
function isWasmAvailable(): Promise<boolean> {
  if (!cachedWasmAvailable) {
    cachedWasmAvailable = fetch(`${baseUrl()}gcsim/main.wasm`, { method: 'HEAD' })
      .then(r => r.ok && (r.headers.get('content-type') ?? '').includes('wasm'))
      .catch(() => false);
  }
  return cachedWasmAvailable;
}

/** 今回使うエンジンを決める */
export async function resolveEngine(): Promise<GcsimEngine> {
  const pref = getEnginePreference();
  if (pref !== 'auto') return pref;
  return (await isWasmAvailable()) ? 'wasm' : 'server';
}

interface Pending {
  resolve: (out: string) => void;
  reject: (e: Error) => void;
}

let worker: Worker | null = null;
let nextId = 1;
const pending = new Map<number, Pending>();

function ensureWorker(): Worker {
  if (worker) return worker;
  const w = new Worker(`${baseUrl()}gcsim/worker.js`);
  w.onmessage = (e: MessageEvent<{ id: number; ok: boolean; out?: string; error?: string }>) => {
    const p = pending.get(e.data.id);
    if (!p) return;
    pending.delete(e.data.id);
    if (e.data.ok) p.resolve(e.data.out ?? '');
    else p.reject(new Error(e.data.error ?? 'gcsim の WASM を実行できませんでした'));
  };
  w.onerror = (ev: ErrorEvent) => {
    failAll(new Error(ev.message || 'gcsim の WASM の Worker を起動できませんでした'));
    w.terminate();
    if (worker === w) worker = null;
  };
  worker = w;
  return w;
}

function failAll(e: Error): void {
  for (const p of pending.values()) p.reject(e);
  pending.clear();
}

/** Worker を捨てる（タイムアウト・中断のとき。次の要求で作り直す） */
function resetWorker(reason: Error): void {
  if (worker) worker.terminate();
  worker = null;
  failAll(reason);
}

/** WASM の gcsim を実行して、JSON 文字列を得る（signal が中断されたら、Worker を捨てて AbortError にする） */
export function wasmCall(
  kind: 'sample' | 'validate',
  payload: { config: string; seed?: number },
  signal: AbortSignal,
): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException('aborted', 'AbortError'));
      return;
    }
    const id = nextId++;
    const onAbort = () => {
      pending.delete(id);
      resetWorker(new DOMException('aborted', 'AbortError') as unknown as Error);
      reject(new DOMException('aborted', 'AbortError'));
    };
    signal.addEventListener('abort', onAbort, { once: true });
    pending.set(id, {
      resolve: out => {
        signal.removeEventListener('abort', onAbort);
        resolve(out);
      },
      reject: e => {
        signal.removeEventListener('abort', onAbort);
        reject(e);
      },
    });
    ensureWorker().postMessage({ id, t: kind, config: payload.config, seed: payload.seed });
  });
}

/**
 * 画面（gcsim.config.json のコミット）と、配信している WASM（wasm-info.json）の版が合っているかを調べる。
 * 合っていなければ、利用者に出す警告文を返す。調べられないとき（WASM を使わない・取得できない）は null。
 */
export async function checkWasmVersionMismatch(expectedCommit: string): Promise<string | null> {
  try {
    if ((await resolveEngine()) !== 'wasm') return null;
    const res = await fetch(`${baseUrl()}gcsim/wasm-info.json`, { cache: 'no-store' });
    if (!res.ok) return null;
    const info = (await res.json()) as { gcsimCommit?: unknown; gcsimVersion?: unknown };
    if (typeof info.gcsimCommit !== 'string' || info.gcsimCommit === expectedCommit) return null;
    return `この画面は gcsim ${expectedCommit.slice(0, 8)} 用ですが、配信されている gcsim は ${info.gcsimCommit.slice(0, 8)}（${String(info.gcsimVersion ?? '不明')}）です。ページを再読み込みしてください（直らないときは、管理者に連絡してください）。`;
  } catch {
    return null;
  }
}
