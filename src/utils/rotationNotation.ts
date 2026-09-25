import { CharacterConfig, Stint } from '../types/genshin';

const isSwapAction = (a: Stint['actions'][number]) =>
  a.type === 'swap' || a.shortName === '交代' || a.name === 'キャラ交代' || a.actionTypeId === 'action_switch_char';

/**
 * ローテーションの記法文字列
 *   例: 刻晴(E E) ➔ [ナヒーダ(E CA) ➔ フィッシュル(Q) ➔ 刻晴(CA CA E)]
 * - 各出場キャラのアクション（キャラ交代を除く）を ( ) で囲む
 * - 2周目以降も繰り返す部分（ループ基準番号以降の出場キャラ）を [ ] で囲む。基準なし（0）なら全体
 */
export function buildRotationNotation(
  characters: CharacterConfig[],
  stints: Stint[],
  loopStartIndex: number,
): string {
  const charMap = new Map(characters.map(c => [c.id, c.name]));
  const parts = stints.map(s => {
    const charName = charMap.get(s.characterId) || '不明';
    const acts = s.actions.filter(a => !isSwapAction(a)).map(a => a.shortName).join(' ');
    return `${charName}(${acts})`;
  });
  if (parts.length === 0) return '';

  const loopFrom = Math.min(Math.max(0, loopStartIndex), parts.length - 1);
  const setup = parts.slice(0, loopFrom);
  const loop = `[${parts.slice(loopFrom).join(' ➔ ')}]`;
  return [...setup, loop].join(' ➔ ');
}
