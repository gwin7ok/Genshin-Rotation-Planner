/**
 * gcsim のクライアント。文法チェック（validate）と、詳細ログの取得（sample）。
 * 実行は、ブラウザの中の WebAssembly 版（gcsimWasm.ts）。検査・調査のスクリプトは、Node で動かす同じ WebAssembly 版に差し替える。
 */
import { wasmCall } from './gcsimWasm.ts';
import { t } from '../../i18n';
const REQUEST_TIMEOUT_MS = 10000;

/** 設定文を実行・解析して、本文を得る（本文は、JSON か平文のエラー文） */
function gcsimRequest(
  kind: 'sample' | 'validate',
  payload: { config: string; seed?: number },
  signal: AbortSignal,
): Promise<string> {
  return wasmCall(kind, payload, signal);
}

export type GcsimValidateResult =
  | { status: 'ok'; message: string }
  /** 設定文に文法エラーなどがある（message に gcsim の返した内容） */
  | { status: 'invalid'; message: string }
  /** gcsim を実行できない（WebAssembly を起動できない・タイムアウトなど） */
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

const isDevelopment = (): boolean => (import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV === true;

const unreachableMessage = (e: unknown, timeoutMs: number): string => {
  if (e instanceof DOMException && e.name === 'AbortError') return t('messages:client.wasmTimeout', { seconds: timeoutMs / 1000 });
  const failed = t('messages:client.wasmStartFailed', { message: e instanceof Error ? e.message : String(e) });
  // 開発中は、main.wasm（Git 管理外）が無いことが多いので、作り方を添える
  return isDevelopment() ? `${failed}\n${t('messages:client.wasmDevHint')}` : failed;
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
  | { status: 'ok'; logs: GcsimLogEvent[]; seed: number; /** 最初に出場するキャラの gcsim キー（initial_character） */ initialCharacter?: string; /** キャラごとの開始時のステータス（character_details[].snapshot。並びは gcsim の Stat の列挙: 23=基礎HP 24=基礎攻撃 25=基礎防御 など） */ characterDetails?: { snapshot?: number[] }[] }
  /** 設定文の文法エラー・実行エラー（message に gcsim の返した内容） */
  | { status: 'error'; message: string }
  /** gcsim を実行できない（WebAssembly を起動できない・タイムアウトなど） */
  | { status: 'unreachable'; message: string };

/** 詳細ログの取得は1回で約0.4秒・数百KB〜1MB。長めの編成に備えて余裕を持たせる */
const SAMPLE_TIMEOUT_MS = 60000;

/** 設定文を1回実行して詳細ログを得る（sample。`{config, seed}`） */
export async function runGcsimSample(config: string, seed: number): Promise<GcsimSampleResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SAMPLE_TIMEOUT_MS);
  try {
    const body = await gcsimRequest('sample', { config, seed }, controller.signal);
    // 文法エラーは JSON ではないエラー文で返る（validate と同じ）
    let parsed: unknown;
    try {
      parsed = JSON.parse(body);
    } catch {
      return { status: 'error', message: body.trim() || t('messages:client.runFailed') };
    }
    if (parsed === null || typeof parsed !== 'object') {
      return { status: 'error', message: body.trim() };
    }
    const obj = parsed as { error?: unknown; logs?: unknown; initial_character?: unknown; character_details?: unknown };
    if (obj.error !== undefined) {
      return { status: 'error', message: extractErrorText(body) };
    }
    if (!Array.isArray(obj.logs)) {
      return { status: 'error', message: t('messages:client.noLogs') };
    }
    return {
      status: 'ok',
      logs: obj.logs as GcsimLogEvent[],
      seed,
      initialCharacter: typeof obj.initial_character === 'string' ? obj.initial_character : undefined,
      characterDetails: Array.isArray(obj.character_details) ? (obj.character_details as { snapshot?: number[] }[]) : undefined,
    };
  } catch (e) {
    return { status: 'unreachable', message: unreachableMessage(e, SAMPLE_TIMEOUT_MS) };
  } finally {
    clearTimeout(timer);
  }
}

/** 設定文の文法チェック（実行はしない。validate） */
export async function validateGcsimConfig(config: string): Promise<GcsimValidateResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const body = await gcsimRequest('validate', { config }, controller.signal);
    // 文法エラーは、本文が JSON ではないエラー文で返る（例: "invalid weapon xxx" / "reached end of file without closing }"）。
    // 成功時は解析結果の JSON オブジェクトが返る
    let parsed: unknown;
    try {
      parsed = JSON.parse(body);
    } catch {
      return { status: 'invalid', message: body.trim() || t('messages:client.parseFailed') };
    }
    if (parsed === null || typeof parsed !== 'object' || 'error' in parsed || 'errors' in parsed) {
      return { status: 'invalid', message: extractErrorText(body) };
    }
    return { status: 'ok', message: t('messages:client.validWasm') };
  } catch (e) {
    return { status: 'unreachable', message: unreachableMessage(e, REQUEST_TIMEOUT_MS) };
  } finally {
    clearTimeout(timer);
  }
}
