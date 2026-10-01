/**
 * ヘクセレイ（魔女会）のキャラ（2026-10-01）
 *
 * 「魔女の宿題」をクリアすると、ヘクセレイのキャラになる。パーティーにヘクセレイのキャラが 2 人以上いると、
 * 「ヘクセレイ：秘儀」の効果を獲得する（キャラの固有天賦・命ノ星座・一部の武器・聖遺物の効果が強化される）。
 * 例: ファルカの特殊スキル「出づる四風」のクールタイム短縮が、通常攻撃のヒットごとに 0.5 秒 → 1 秒になる。
 *
 * gcsim では、キャラの設定文のパラメータ `hexerei`（`<キャラ> char ... +params=[hexerei=0]`）で切り替える
 * （`internal/characters/<キャラ>/<キャラ>.go` の `p.Params["hexerei"]` → `c.IsHexerei`。**指定しないと有効（1）**。2026-10-01 に、実行でも確認:
 * ファルカ + フィッシュルで、既定は短縮 1 秒/ヒット、片方を `hexerei=0` にすると 0.5 秒/ヒット）。ヘクセレイのキャラの人数は `Player.GetHexereiCount()` で数える。
 * 対応するキャラ: gcsim のソースで `IsHexerei =` を設定している 8 キャラ（2026-10-01 時点）。
 * 新しいヘクセレイのキャラが増えたら、ここに追加する（docs/新キャラ実装時の作業.md）。
 */
import type { CharacterConfig } from '../types/genshin.ts';

/** ヘクセレイに対応するキャラの gcsim のキー */
export const HEXEREI_GCSIM_KEYS = new Set(['durin', 'fischl', 'mona', 'nicole', 'prune', 'razor', 'sucrose', 'varka']);

/** 設定文のパラメータ名（gcsim: `+params=[hexerei=0|1]`） */
export const HEXEREI_GCSIM_PARAM = 'hexerei';

/** ヘクセレイに対応するキャラか（編成で「魔女の宿題クリア」を設定できる） */
export const isHexereiCapable = (char: Pick<CharacterConfig, 'source'>): boolean =>
  char.source?.gcsimKey !== undefined && HEXEREI_GCSIM_KEYS.has(char.source.gcsimKey);

/** 編成の設定で、ヘクセレイのキャラになっているか（対応するキャラで、「魔女の宿題クリア」が未設定または有効。既定は有効 = gcsim の既定と同じ） */
export const isHexerei = (char: Pick<CharacterConfig, 'source' | 'hexerei'>): boolean =>
  isHexereiCapable(char) && char.hexerei !== false;

/** 編成のヘクセレイのキャラの人数（2 人以上で「ヘクセレイ：秘儀」） */
export const hexereiCount = (characters: Array<Pick<CharacterConfig, 'source' | 'hexerei'>>): number =>
  characters.filter(isHexerei).length;
