/**
 * gcsim の WebAssembly 版（public/gcsim/main.wasm。`npm run wasm:build` で生成）を、Web Worker で動かすクライアント。
 *
 * 画面の計算は、すべて、ブラウザの中のこの WebAssembly 版で動く（公開サイトも、開発中の画面も同じ。localhost のサーバーは使わない）。
 * 検査・調査のスクリプト（Node）は、同じ main.wasm を Node で動かす部品（scripts/gcsim-node.ts）に、setWasmTransport で差し替える。
 */
import { DEVICE_KEYS, readString, removeKey, writeString } from '../persistence';
import { t } from '../../i18n';

const baseUrl = (): string => (import.meta as unknown as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? '/';

interface Pending {
  resolve: (out: string) => void;
  reject: (e: Error) => void;
  worker: Worker;
}

/** 使うコア（Worker）の数の既定（端末のコアが少ないときは、上限に収める） */
export const WASM_DEFAULT_CORES = 12;

/** 選べるコアの数の上限（端末のコア数 − 1。1 コアなら 1。画面の操作のため、1 つは空けておく） */
export function wasmMaxCores(): number {
  const cores = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || 2 : 2;
  return Math.max(1, cores - 1);
}

/** 保存したコアの数（無い・壊れているときは既定。上限・下限に収める） */
export function getWasmCores(): number {
  const v = Math.floor(Number(readString(DEVICE_KEYS.gcsimCores)));
  const n = Number.isFinite(v) && v >= 1 ? v : WASM_DEFAULT_CORES;
  return Math.max(1, Math.min(wasmMaxCores(), n));
}

/** コアの数を保存する（既定と同じなら、保存を消す） */
export function setWasmCores(n: number): void {
  const v = Math.max(1, Math.min(wasmMaxCores(), Math.floor(n)));
  if (v === Math.max(1, Math.min(wasmMaxCores(), WASM_DEFAULT_CORES))) removeKey(DEVICE_KEYS.gcsimCores);
  else writeString(DEVICE_KEYS.gcsimCores, String(v));
}

/** 同時に動かす Worker の数（利用者が選んだコアの数。既定 12。端末のコア数 − 1 まで） */
export function wasmParallelism(): number {
  return getWasmCores();
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

/** WASM の gcsim を、Web Worker で実行して、JSON 文字列を得る（signal が中断されたら、Worker を捨てて AbortError にする。同時に複数呼べば、Worker を並べて動かす） */
function workerCall(
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

/** gcsim を 1 回呼ぶ窓口（kind = sample / validate）。返すのは、gcsim の WASM が返す JSON 文字列か、平文のエラー文 */
export type WasmTransport = (
  kind: 'sample' | 'validate',
  payload: { config: string; seed?: number },
  signal: AbortSignal,
) => Promise<string>;

/** 既定は、ブラウザの Web Worker。Node のスクリプトだけが、setWasmTransport で差し替える */
let transport: WasmTransport = workerCall;

export function setWasmTransport(next: WasmTransport): void {
  transport = next;
}

/** WASM の gcsim を実行して、JSON 文字列を得る（signal が中断されたら、AbortError にする） */
export function wasmCall(
  kind: 'sample' | 'validate',
  payload: { config: string; seed?: number },
  signal: AbortSignal,
): Promise<string> {
  return transport(kind, payload, signal);
}

/**
 * 画面（gcsim.config.json のコミット）と、配信している WASM（wasm-info.json）の版が合っているかを調べる。
 * 合っていなければ、利用者に出す警告文を返す。調べられないとき（取得できない）は null。
 */
export async function checkWasmVersionMismatch(expectedCommit: string): Promise<string | null> {
  try {
    const res = await fetch(`${baseUrl()}gcsim/wasm-info.json`, { cache: 'no-store' });
    if (!res.ok) return null;
    const info = (await res.json()) as { gcsimCommit?: unknown; gcsimVersion?: unknown };
    if (typeof info.gcsimCommit !== 'string' || info.gcsimCommit === expectedCommit) return null;
    return t('messages:client.versionMismatch', { expected: expectedCommit.slice(0, 8), served: info.gcsimCommit.slice(0, 8), version: String(info.gcsimVersion ?? t('messages:client.unknown')) });
  } catch {
    return null;
  }
}
