/**
 * 「論示」を達成できるキャラ（八重神子。2026-10-05 / 七七を追加。2026-10-12）
 *
 * gcsim では、キャラの設定文のパラメータ `revelation`（`<キャラ> char ... +params=[revelation=0]`）で切り替える
 * （internal/characters/<キャラ>/<キャラ>.go: `p.Params["revelation"]`。**指定しないと有効（1）**）。
 * 対応するキャラ: gcsim のソースで `p.Params["revelation"]` を読んでいる 2 キャラ（v2.48.8 で確認。ほかのキャラの `Revelation` は技名）。
 *
 * 達成済みのときの違い（gcsim の実装）:
 *   - 八重神子: 殺生桜が爆発で壊れない／殺生桜の寿命が 10 秒長い（25 秒。未達成は 15 秒）／超電導・星電導の反応で、次の殺生桜の雷が強化される（ダメージのみ）
 *   - 七七: スキルの CT が 15 秒（未達成は 30 秒。`skill.go`: SetCD(30 秒) のあと ReduceActionCooldown(15 秒)）。
 *     ほかに、スキルの元素粒子・連携攻撃・反応ダメージの強化・固有天賦 2 の確率 100% / CT 15 秒（星電導の状態などの条件つき）があるが、
 *     時間の計算に入れるのはスキルの CT だけ（固有天賦 2 の短縮は、反応の状態に依存するため、アプリでは扱わない）
 */
import type { CharacterConfig } from '../types/genshin.ts';

/** 論示に対応するキャラの gcsim のキー */
export const REVELATION_GCSIM_KEYS = new Set(['yaemiko', 'qiqi']);

/** 設定文のパラメータ名（gcsim: `+params=[revelation=0|1]`） */
export const REVELATION_GCSIM_PARAM = 'revelation';

/** 論示に対応するキャラか（編成で「論示達成」を設定できる） */
export const isRevelationCapable = (char: Pick<CharacterConfig, 'source'>): boolean =>
  char.source?.gcsimKey !== undefined && REVELATION_GCSIM_KEYS.has(char.source.gcsimKey);

/** 編成の設定で、論示を達成済みか（対応するキャラで、未設定または有効。既定は有効 = gcsim の既定と同じ） */
export const isRevelation = (char: Pick<CharacterConfig, 'source' | 'revelation'>): boolean =>
  isRevelationCapable(char) && char.revelation !== false;

/**
 * 論示を達成済みのときの、アクションの CT（秒。キー: gcsim のキャラのキー → アクション定義 ID）。
 * 凸の変更（actionChanges）の前の値を置き換える（CharacterModel.actions）。
 */
export const REVELATION_ACTION_COOLDOWNS: Record<string, Record<string, number>> = {
  qiqi: { '10000035-cryo_e': 15 },
};

/** 編成の「論示達成」のチェックの説明（キャラごと） */
export const revelationTooltip = (gcsimKey: string | undefined): string => {
  const base = '「論示」を達成済み。';
  const tail = '（gcsim の `revelation` パラメータ。既定は達成済み）';
  if (gcsimKey === 'qiqi') return `${base}スキルの CT が 30 秒 → 15 秒になります。ほかに、元素粒子の発生・連携攻撃・反応ダメージの強化が有効になります${tail}`;
  return `${base}殺生桜が爆発で壊れなくなり、寿命が 10 秒長くなります${tail}`;
};
