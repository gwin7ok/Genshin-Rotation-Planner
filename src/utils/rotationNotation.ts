import { CharacterConfig, Stint } from '../types/genshin';
import { groupRuns, stripGroupCopies } from './actionGroups';

const isSwapAction = (a: Stint['actions'][number]) =>
  a.type === 'swap' || a.actionTypeId === 'action_switch_char';

/** 維持（モードの維持のために自動で足される待ち）。記法には出さない */
const isModeHold = (a: Stint['actions'][number]) => a.actionTypeId === 'mode_hold';

/** 秒数の表記（0.0s の形） */
const sec = (v: number) => `${v.toFixed(1)}s`;

/** アクション列の記法（グループの外・中で共通）。連続する通常攻撃は N + 回数にまとめる。詰めて書く */
function notationOf(actions: Stint['actions']): string {
  const out: string[] = [];
  let normals = 0;
  const flush = () => {
    if (normals > 0) out.push(`N${normals}`);
    normals = 0;
  };
  for (const a of actions) {
    if (isSwapAction(a) || isModeHold(a)) continue;
    if (a.type === 'normal') {
      normals += 1;
      continue;
    }
    flush();
    if (a.type === 'wait') out.push(`w@${sec(a.duration ?? 0)}`);
    else out.push(a.holdSeconds === undefined ? a.shortName : `${a.shortName}@${sec(a.holdSeconds)}`);
  }
  flush();
  return out.join('');
}

/**
 * 1 つの出場ブロックのアクションの記法（KQM の記法に従う。詰めて書く）
 *   - 連続する通常攻撃は、`N` + 連続した回数（N N N C → N3C）
 *   - 長押しの秒数が決まるアクション: `hE@2.0s`／待機: `w@1.0s`
 *   - グループ（回数 2 以上）: `n[ … ]`。前後にスペース（N の数字との混同を避ける）。回数 1 のグループは、括弧なし
 *   - 交代・維持は出さない。それ以外は、アクションの略号（E・tE・hE・Q・C・D・J・lP・hP …）
 */
export function buildStintNotation(stint: Stint): string {
  const actions = stripGroupCopies(stint.actions);
  const runs = groupRuns({ actions, groups: stint.groups });
  const parts: { text: string; spaced: boolean }[] = [];
  let i = 0;
  while (i < actions.length) {
    const run = runs.find(r => r.start === i);
    if (!run) {
      // 次のグループの手前まで
      const nextStart = runs.find(r => r.start > i)?.start ?? actions.length;
      const text = notationOf(actions.slice(i, nextStart));
      if (text) parts.push({ text, spaced: false });
      i = nextStart;
      continue;
    }
    const inner = notationOf(actions.slice(run.start, run.end + 1));
    if (inner) parts.push(run.repeat > 1 ? { text: `${run.repeat}[${inner}]`, spaced: true } : { text: inner, spaced: false });
    i = run.end + 1;
  }
  return parts.reduce((acc, p, k) => (k === 0 ? p.text : acc + (p.spaced || parts[k - 1].spaced ? ' ' : '') + p.text), '');
}

/**
 * ローテーションの記法文字列（KQM の記法に従う。issue #15・#33）
 *   例: 刻晴 EQ > {ナヒーダ E 2[N2C] Q > フィッシュル Q > 刻晴 N3CE}
 * - 出場ごとに「キャラ名 アクション」。キャラの切り替えは ` > `（交代アクションは出さない）
 * - 2 周目以降も繰り返す部分（ループ基準番号以降の出場）を `{ }` で囲む。基準なし（0）なら全体
 * - アクションは詰めて書く（スペースを入れない）
 */
export function buildRotationNotation(
  characters: CharacterConfig[],
  stints: Stint[],
  loopStartIndex: number,
): string {
  const charMap = new Map(characters.map(c => [c.id, c.name]));
  const parts = stints.map(s => {
    const charName = charMap.get(s.characterId) || '不明';
    const acts = buildStintNotation(s);
    return acts ? `${charName} ${acts}` : charName;
  });
  if (parts.length === 0) return '';

  const loopFrom = Math.min(Math.max(0, loopStartIndex), parts.length - 1);
  const setup = parts.slice(0, loopFrom);
  const loop = `{${parts.slice(loopFrom).join(' > ')}}`;
  return [...setup, loop].join(' > ');
}
