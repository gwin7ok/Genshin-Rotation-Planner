/**
 * 検査・調査のスクリプトから、gcsim を実行する部品（Node で動かす WebAssembly 版）。
 *
 * 画面（ブラウザ）と同じ public/gcsim/main.wasm を、Node の worker_threads で動かす（localhost のサーバーは使わない）。
 * main.wasm は Git 管理外なので、無ければ `npm run wasm:build`（Go が要る）で作る。
 *
 * 使い方:
 *   - 直接呼ぶスクリプト:        const text = await gcsimSample(config, seed);   // gcsim が返す文字列（JSON か、平文のエラー文）
 *   - 画面の部品（gcsimClient）を通すスクリプト（vite の ssrLoadModule）:
 *       await useNodeGcsim(server);   // 画面の部品の「gcsim を呼ぶ窓口」を、この部品に差し替える
 *
 * Worker は、必要になったぶんだけ（同時に呼ばれた数まで）作る。数の上限は環境変数 GCSIM_NODE_WORKERS（既定: 端末のコア数 − 1。最大 6）。
 * Worker は process を止めないので、スクリプトの最後で後始末をしなくてよい。
 */
import fs from 'node:fs';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { Worker } from 'node:worker_threads';

const WASM_PATH = new URL('../public/gcsim/main.wasm', import.meta.url);
const WASM_EXEC_PATH = new URL('../public/gcsim/wasm_exec.js', import.meta.url);
const WORKER_PATH = new URL('./gcsim-node-worker.mjs', import.meta.url);

type Kind = 'sample' | 'validate';
interface Pending {
  resolve: (out: string) => void;
  reject: (e: Error) => void;
  worker: Worker;
}

const DEFAULT_MAX_WORKERS = 6;

/** 使う Worker の上限 */
function maxWorkers(): number {
  const fromEnv = Math.floor(Number(process.env.GCSIM_NODE_WORKERS));
  if (Number.isFinite(fromEnv) && fromEnv >= 1) return fromEnv;
  return Math.max(1, Math.min(DEFAULT_MAX_WORKERS, os.availableParallelism() - 1));
}

let modulePromise: Promise<WebAssembly.Module> | null = null;

/** main.wasm を、1 度だけコンパイルする（Worker には、コンパイル済みのものを渡す） */
function loadModule(): Promise<WebAssembly.Module> {
  if (!modulePromise) {
    modulePromise = (async () => {
      if (!fs.existsSync(WASM_PATH) || !fs.existsSync(WASM_EXEC_PATH)) {
        throw new Error('public/gcsim/main.wasm・wasm_exec.js がありません。`npm run wasm:build`（Go が要ります）で作ってください');
      }
      return WebAssembly.compile(fs.readFileSync(WASM_PATH));
    })();
    modulePromise.catch(() => { modulePromise = null; });
  }
  return modulePromise;
}

const workers: Worker[] = [];
const inFlight = new Map<Worker, number>();
const pending = new Map<number, Pending>();
let nextId = 1;

function dropWorker(w: Worker): void {
  const i = workers.indexOf(w);
  if (i >= 0) workers.splice(i, 1);
  inFlight.delete(w);
  void w.terminate();
}

async function createWorker(): Promise<Worker> {
  const module = await loadModule();
  const w = new Worker(WORKER_PATH, { workerData: { module, wasmExecPath: fileURLToPath(WASM_EXEC_PATH) } });
  w.on('message', (m: { id: number; ok: boolean; out?: string; error?: string }) => {
    const p = pending.get(m.id);
    if (!p) return;
    pending.delete(m.id);
    const left = Math.max(0, (inFlight.get(w) ?? 1) - 1);
    inFlight.set(w, left);
    if (left === 0) w.unref(); // 仕事が無いあいだは、プロセスを止めない（スクリプトが終わったら、Worker ごと終わる）
    if (m.ok) p.resolve(m.out ?? '');
    else p.reject(new Error(m.error ?? 'gcsim の WASM を実行できませんでした'));
  });
  w.on('error', (err) => {
    // この Worker に任せていた要求だけを失敗にする
    for (const [id, p] of pending) if (p.worker === w) { pending.delete(id); p.reject(err); }
    dropWorker(w);
  });
  // 'message' の受け取りを付けると、プロセスを止める（ref）状態になるので、付けたあとに外す（仕事を頼むあいだだけ、gcsimCall が ref する）
  w.unref();
  workers.push(w);
  inFlight.set(w, 0);
  return w;
}

/** 空いている Worker を返す（全部使用中で、上限未満なら、新しく作る。上限なら、一番空いているものに並べる） */
async function pickWorker(): Promise<Worker> {
  const idle = workers.find(w => (inFlight.get(w) ?? 0) === 0);
  if (idle) return idle;
  if (workers.length < maxWorkers()) return createWorker();
  return workers.reduce((a, b) => ((inFlight.get(a) ?? 0) <= (inFlight.get(b) ?? 0) ? a : b));
}

/** gcsim を 1 回呼んで、gcsim が返す文字列（JSON か、平文のエラー文）を得る */
export async function gcsimCall(kind: Kind, payload: { config: string; seed?: number }, signal?: AbortSignal): Promise<string> {
  if (signal?.aborted) throw new DOMException('aborted', 'AbortError');
  const w = await pickWorker();
  return new Promise<string>((resolve, reject) => {
    const id = nextId++;
    const onAbort = () => {
      pending.delete(id);
      reject(new DOMException('aborted', 'AbortError'));
    };
    signal?.addEventListener('abort', onAbort, { once: true });
    pending.set(id, {
      worker: w,
      resolve: out => { signal?.removeEventListener('abort', onAbort); resolve(out); },
      reject: e => { signal?.removeEventListener('abort', onAbort); reject(e); },
    });
    if ((inFlight.get(w) ?? 0) === 0) w.ref(); // 返事が来るまで、プロセスを終わらせない
    inFlight.set(w, (inFlight.get(w) ?? 0) + 1);
    w.postMessage({ id, t: kind, config: payload.config, seed: payload.seed });
  });
}

/** 設定文を 1 回実行して、詳細ログの文字列を得る（旧: サーバーへの POST /sample/<id> `{config, seed}` の本文） */
export const gcsimSample = (config: string, seed = 1): Promise<string> => gcsimCall('sample', { config, seed });

/** 設定文の文法チェックの文字列を得る（旧: POST /validate/<id> の本文） */
export const gcsimValidate = (config: string): Promise<string> => gcsimCall('validate', { config });

/**
 * 画面の部品（src/utils/gcsim/gcsimClient.ts など）を、vite の ssrLoadModule で読み込むスクリプト向け:
 * 「gcsim を呼ぶ窓口」を、この部品（Node の WebAssembly）に差し替える。
 */
export async function useNodeGcsim(viteServer: { ssrLoadModule: (id: string) => Promise<Record<string, unknown>> }): Promise<void> {
  const wasm = await viteServer.ssrLoadModule('/src/utils/gcsim/gcsimWasm.ts');
  (wasm.setWasmTransport as (t: typeof gcsimCall) => void)(gcsimCall);
}
