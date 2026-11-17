/**
 * 持ちキャラの取り込み: HoYoLAB の全キャラに、Enka.Network のキャラ（ゲーム内「キャラクター詳細表示」に並べた最大 12 キャラ）を重ねる（D345）。
 * HoYoLAB は、ゲームでの装備変更の反映が遅い（ログアウトして 30 分たっても古いことがある）が、Enka はログアウト後に最新になるため、
 * Enka で取得できたキャラだけを、Enka の値で上書きする。取得できなかったキャラは、HoYoLAB の値のまま。
 */
import type { OwnedCharacter } from './importCharacters';

/** Enka の値を上書きに使わない、不完全なデータ（HoYoLAB の値を残す） */
const INCOMPLETE_WARNING = /武器の情報がありません/;

export interface MergeResult {
  characters: OwnedCharacter[];
  /** Enka の値で上書きしたキャラの数 */
  updated: number;
  /** HoYoLAB に無く、Enka から加えたキャラの数 */
  added: number;
  /** 不完全で、上書きしなかった Enka のキャラの数 */
  skipped: number;
}

/** 取得元と取得日時を付ける */
export const stamp = (list: OwnedCharacter[], source: 'hoyolab' | 'enka', now: Date): OwnedCharacter[] =>
  list.map(c => ({ ...c, source, fetchedAt: now.toISOString() }));

export function mergeEnkaOverHoyolab(hoyolab: OwnedCharacter[], enka: OwnedCharacter[], now: Date = new Date()): MergeResult {
  const out = stamp(hoyolab, 'hoyolab', now);
  let updated = 0, added = 0, skipped = 0;
  for (const e of stamp(enka, 'enka', now)) {
    if (e.warnings.some(w => INCOMPLETE_WARNING.test(w))) { skipped++; continue; }
    // 同じキャラ（旅人は、ID が同じで元素が変わりうるので、ID だけで探す）
    const i = out.findIndex(c => c.genshinId === e.genshinId);
    if (i >= 0) { out[i] = e; updated++; } else { out.push(e); added++; }
  }
  return { characters: out, updated, added, skipped };
}
