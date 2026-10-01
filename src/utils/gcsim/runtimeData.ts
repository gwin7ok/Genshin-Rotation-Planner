/**
 * 実行時にサーバーから取得する固定データ（public/data/*.json）の読み込み。
 *   gcsim キーの辞書（gcsim_key_catalog.json）・スキル・爆発の効果のキー表（action_effect_keys.json）
 * ビルドに取り込まず、呼ぶたびにサーバーから取り直す（ブラウザの HTTP キャッシュ・モジュールのキャッシュを使わない）。
 * サーバー（開発サーバー・配布先）に届かなければ、失敗する（古いデータで続行しない）。
 */
export async function fetchRuntimeData<T>(fileName: string): Promise<T> {
  const base = (import.meta as unknown as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? '/';
  const res = await fetch(`${base}data/${fileName}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`${fileName} をサーバーから取得できませんでした（HTTP ${res.status}）`);
  return (await res.json()) as T;
}
