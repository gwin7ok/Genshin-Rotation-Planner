/**
 * 「論示」を達成できるキャラ（八重神子。2026-10-05）
 *
 * gcsim では、キャラの設定文のパラメータ `revelation`（`<キャラ> char ... +params=[revelation=0]`）で切り替える
 * （internal/characters/yaemiko/yaemiko.go: `p.Params["revelation"]`。**指定しないと有効（1）**）。
 * 達成済みのときの違い（gcsim の実装）:
 *   - 殺生桜が、爆発で壊れない（未達成は、爆発のたびに全部壊れる）
 *   - 殺生桜の寿命が 10 秒長い（25 秒。未達成は 15 秒）
 *   - 超電導・星電導の反応で、次の殺生桜の雷が強化される（ダメージのみ。アプリの時間計算には関係しない）
 */
import type { CharacterConfig } from '../types/genshin.ts';

/** 論示に対応するキャラの gcsim のキー */
export const REVELATION_GCSIM_KEYS = new Set(['yaemiko']);

/** 設定文のパラメータ名（gcsim: `+params=[revelation=0|1]`） */
export const REVELATION_GCSIM_PARAM = 'revelation';

/** 論示に対応するキャラか（編成で「論示達成」を設定できる） */
export const isRevelationCapable = (char: Pick<CharacterConfig, 'source'>): boolean =>
  char.source?.gcsimKey !== undefined && REVELATION_GCSIM_KEYS.has(char.source.gcsimKey);

/** 編成の設定で、論示を達成済みか（対応するキャラで、未設定または有効。既定は有効 = gcsim の既定と同じ） */
export const isRevelation = (char: Pick<CharacterConfig, 'source' | 'revelation'>): boolean =>
  isRevelationCapable(char) && char.revelation !== false;
