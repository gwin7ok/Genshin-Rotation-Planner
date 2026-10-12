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

const PREFERENCE_KEY = 'gcsim_engine';

const baseUrl = (): string => (import.meta as unknown as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? '/';

export function getEnginePreference(): GcsimEnginePreference {
  try {
    const v = localStorage.getItem(PREFERENCE_KEY);
    if (v === 'wasm' || v === 'server') return v;
  } catch {
    // localStorage が使えないときは既定
  }
  return 'auto';
}

export function setEnginePreference(pref: GcsimEnginePreference): void {
  try {
    if (pref === 'auto') localStorage.removeItem(PREFERENCE_KEY);
    else localStorage.setItem(PREFERENCE_KEY, pref);
  } catch {
    // 保存できなくても、そのセッションでは動く
  }
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
