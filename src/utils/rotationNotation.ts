import { CharacterConfig, Stint } from '../types/genshin';
import { groupRuns, stripGroupCopies } from './actionGroups';
import { t } from '../i18n';
import { charName } from '../i18n/loc';

const isSwapAction = (a: Stint['actions'][number]) =>
  a.type === 'swap' || a.actionTypeId === 'action_switch_char';

/** 維持（モードの維持のために自動で足される待ち）。記法には出さない */
const isModeHold = (a: Stint['actions'][number]) => a.actionTypeId === 'mode_hold';

/**
 * 記法のモード（追加作業 20-B / issue #15）
 *   short = 略号（KQM の記法。詰めて書く）／name = 名称（日本語。スペースで区切る）
 */
export type NotationMode = 'short' | 'name';

/** 名称モードの、アクションの名前（略号 → 名称。元素は省略。ユーザー決定 2026-10-11） */
const NAME_OF_SHORT: Record<string, string> = {
  E: t('messages:notation.E'),
  tE: t('messages:notation.tE'),
  hE: t('messages:notation.hE'),
  rE: t('messages:notation.rE'),
  spE: t('messages:notation.spE'),
  Q: t('messages:notation.Q'),
  spQ: t('messages:notation.spQ'),
  N: t('messages:notation.N'),
  C: t('messages:notation.C'),
  D: t('messages:notation.D'),
  J: t('messages:notation.J'),
  lP: t('messages:notation.lP'),
  hP: t('messages:notation.hP'),
};

/** 略号 → 名称。`hE(short)` のような後ろの印は、括弧つきで残す。対応が無い略号は、そのまま */
function nameOfShort(short: string): string {
  if (NAME_OF_SHORT[short]) return NAME_OF_SHORT[short];
  const m = /^([A-Za-z]+)(\(.+\))$/.exec(short);
  if (m && NAME_OF_SHORT[m[1]]) return `${NAME_OF_SHORT[m[1]]}${m[2]}`;
  return short;
}

/** 秒数の表記（0.0s の形） */
const sec = (v: number) => `${v.toFixed(1)}s`;

/** アクション列の記法（グループの外・中で共通）。連続する通常攻撃は N + 回数にまとめる。詰めて書く */
function notationOf(actions: Stint['actions'], mode: NotationMode): string {
  const out: string[] = [];
  let normals = 0;
  const flush = () => {
    if (normals > 0) out.push(mode === 'name' ? (normals > 1 ? t('messages:notation.normals', { count: normals }) : t('messages:notation.N')) : `N${normals}`);
    normals = 0;
  };
  for (const a of actions) {
    if (isSwapAction(a) || isModeHold(a)) continue;
    if (a.type === 'normal') {
      normals += 1;
      continue;
    }
    flush();
    if (a.type === 'wait') out.push(`${mode === 'name' ? t('messages:notation.wait') : 'w'}@${sec(a.duration ?? 0)}`);
    else {
      const label = mode === 'name' ? nameOfShort(a.shortName) : a.shortName;
      out.push(a.holdSeconds === undefined ? label : `${label}@${sec(a.holdSeconds)}`);
    }
  }
  flush();
  // 略号は詰めて、名称はスペースで区切る
  return out.join(mode === 'name' ? ' ' : '');
}

/**
 * 1 つの出場ブロックのアクションの記法（KQM の記法に従う。詰めて書く）
 *   - 連続する通常攻撃は、`N` + 連続した回数（N N N C → N3C）
 *   - 長押しの秒数が決まるアクション: `hE@2.0s`／待機: `w@1.0s`
 *   - グループ（回数 2 以上）: `n[ … ]`。前後にスペース（N の数字との混同を避ける）。回数 1 のグループは、括弧なし（前後のスペースは同じ）
 *   - 1 つのアクションだけのグループ: 括弧なしで、回数 + 略号（C を 3 回 → `3C`。名称は `3×重撃`）
 *   - 交代・維持は出さない。それ以外は、アクションの略号（E・tE・hE・Q・C・D・J・lP・hP …）
 */
export function buildStintNotation(stint: Stint, mode: NotationMode = 'short'): string {
  const actions = stripGroupCopies(stint.actions);
  const runs = groupRuns({ actions, groups: stint.groups });
  const parts: { text: string; spaced: boolean }[] = [];
  let i = 0;
  while (i < actions.length) {
    const run = runs.find(r => r.start === i);
    if (!run) {
      // 次のグループの手前まで
      const nextStart = runs.find(r => r.start > i)?.start ?? actions.length;
      const text = notationOf(actions.slice(i, nextStart), mode);
      if (text) parts.push({ text, spaced: false });
      i = nextStart;
      continue;
    }
    const inner = notationOf(actions.slice(run.start, run.end + 1), mode);
    // 略号: 2[N1C]（KQM）／名称: 2×[通常 重撃]
    // 1 つのアクションだけのグループは、括弧なし: 3C／3×重撃
    const single = run.start === run.end;
    const grouped = single
      ? (mode === 'name' ? `${run.repeat}×${inner}` : `${run.repeat}${inner}`)
      : (mode === 'name' ? `${run.repeat}×[${inner}]` : `${run.repeat}[${inner}]`);
    // 回数 1 のグループは、括弧なし。ただし、前後はスペースで区切る（グループの境目を見分けるため）
    if (inner) parts.push({ text: run.repeat > 1 ? grouped : inner, spaced: true });
    i = run.end + 1;
  }
  // 略号: グループの前後だけスペース。名称: すべてスペースで区切る
  return parts.reduce((acc, p, k) => (k === 0 ? p.text : acc + (mode === 'name' || p.spaced || parts[k - 1].spaced ? ' ' : '') + p.text), '');
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
  mode: NotationMode = 'short',
): string {
  const charMap = new Map(characters.map(c => [c.id, charName(c)]));
  const parts = stints.map(s => {
    const charName = charMap.get(s.characterId) || t('messages:notation.unknown');
    const acts = buildStintNotation(s, mode);
    return acts ? `${charName} ${acts}` : charName;
  });
  if (parts.length === 0) return '';

  const loopFrom = Math.min(Math.max(0, loopStartIndex), parts.length - 1);
  const setup = parts.slice(0, loopFrom);
  const loop = `{${parts.slice(loopFrom).join(' > ')}}`;
  return [...setup, loop].join(' > ');
}
