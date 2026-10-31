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
import { t } from '../../i18n';

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
      // 通信の失敗（オフラインなど）は、答えが出ていないので、覚えない（次の呼び出しで、もう一度調べる）
      .catch(() => {
        cachedWasmAvailable = null;
        return false;
      });
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
  worker: Worker;
}

/** 同時に動かす Worker の数の上限（コア数 − 1 を上限 4 まで。1 コアなら 1） */
export function wasmParallelism(): number {
  const cores = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || 2 : 2;
  return Math.max(1, Math.min(4, cores - 1));
}

const workers: Worker[] = [];
const inFlight = new Map<Worker, number>();
let nextId = 1;
const pending = new Map<number, Pending>();

function dropWorker(w: Worker): void {
  w.terminate();
  const i = workers.indexOf(w);
  if (i >= 0) workers.splice(i, 1);
  inFlight.delete(w);
}

function createWorker(): Worker {
  const w = new Worker(`${baseUrl()}gcsim/worker.js`);
  w.onmessage = (e: MessageEvent<{ id: number; ok: boolean; out?: string; error?: string }>) => {
    const p = pending.get(e.data.id);
    if (!p) return;
    pending.delete(e.data.id);
    inFlight.set(w, Math.max(0, (inFlight.get(w) ?? 1) - 1));
    if (e.data.ok) p.resolve(e.data.out ?? '');
    else p.reject(new Error(e.data.error ?? t('messages:client.wasmFailed')));
  };
  w.onerror = (ev: ErrorEvent) => {
    // この Worker に任せていた要求だけを失敗にする
    const err = new Error(ev.message || t('messages:client.workerFailed'));
    for (const [id, p] of pending) if (p.worker === w) { pending.delete(id); p.reject(err); }
    dropWorker(w);
  };
  workers.push(w);
  inFlight.set(w, 0);
  return w;
}

/** 空いている Worker を返す（全部使用中で、上限未満なら、新しく作る。上限なら、一番空いているものに並べる） */
function pickWorker(): Worker {
  const idle = workers.find(w => (inFlight.get(w) ?? 0) === 0);
  if (idle) return idle;
  if (workers.length < wasmParallelism()) return createWorker();
  return workers.reduce((a, b) => ((inFlight.get(a) ?? 0) <= (inFlight.get(b) ?? 0) ? a : b));
}

function failAll(e: Error): void {
  for (const p of pending.values()) p.reject(e);
  pending.clear();
}

/** Worker を全部捨てる（タイムアウト・中断のとき。次の要求で作り直す） */
function resetWorker(reason: Error): void {
  for (const w of [...workers]) dropWorker(w);
  failAll(reason);
}

/** WASM の gcsim を実行して、JSON 文字列を得る（signal が中断されたら、Worker を捨てて AbortError にする。同時に複数呼べば、Worker を並べて動かす） */
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
    const w = pickWorker();
    pending.set(id, {
      worker: w,
      resolve: out => {
        signal.removeEventListener('abort', onAbort);
        resolve(out);
      },
      reject: e => {
        signal.removeEventListener('abort', onAbort);
        reject(e);
      },
    });
    inFlight.set(w, (inFlight.get(w) ?? 0) + 1);
    w.postMessage({ id, t: kind, config: payload.config, seed: payload.seed });
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
    return t('messages:client.versionMismatch', { expected: expectedCommit.slice(0, 8), served: info.gcsimCommit.slice(0, 8), version: String(info.gcsimVersion ?? t('messages:client.unknown')) });
  } catch {
    return null;
  }
}
