/**
 * gcsim の設定文 → 編成・ローテーションの変換（buildGcsimConfig の逆。D326）
 *
 * 純粋関数。設定文のテキストと、マスター（キャラ・武器・聖遺物）から、編成（PartyMember）と出場ブロック（Stint）を作る。
 * キャラ・武器・聖遺物は、名前ではなく gcsim のキー（source.gcsimKey / gcsimKey）で引いて、ID にする。
 * アプリで表せない行（options・target・天賦レベル・ステータス・条件分岐など）は、読み飛ばして ignored に一覧にする。
 * 天賦レベル・ステータスは、DPS 計算の保存先ができたら取り込む（今は characterSettings に読み取った値だけ残す）。
 */
import { HEXEREI_GCSIM_PARAM } from '../../masterdata/hexereiCharacters.ts';
import { REVELATION_GCSIM_PARAM } from '../../masterdata/revelationCharacters.ts';
import type { ArtifactSetMode, CharacterActionInstance, CharacterConfig, PartyMember, Stint } from '../../types/genshin.ts';
import type { ArtifactSetDatabaseItem, WeaponDatabaseItem } from '../../types/database.ts';
import { DEFAULT_ACTION_DELAY } from '../actionDelay.ts';
import { HOLD_FRAMES_ACTIONS, holdSecondsFromCommand, mapAction } from './actionMapping.ts';
import { canQueueFrames, cancelKeyOf } from '../rotation/frameTables.ts';
import aliasData from '../../data/gcsim_key_aliases.json';
import { t } from '../../i18n';

/** 読み飛ばした行の理由（画面の文言は `save:gcsimImport.reason.<reason>`） */
export type IgnoredReason =
  | 'options' | 'target' | 'energy' | 'hurt'
  | 'stats' | 'talent' | 'level'
  | 'unknownCharacter' | 'unknownWeapon' | 'unknownArtifact' | 'artifactCount'
  | 'tooManyCharacters' | 'unknownAction' | 'paramsIgnored'
  | 'conditional' | 'loopCondition' | 'extraLoop' | 'variable' | 'unknownStatement';

export interface IgnoredItem {
  /** 1 始まりの行番号 */
  line: number;
  /** 行の内容（長いときは切り詰める） */
  text: string;
  reason: IgnoredReason;
}

export interface ParsedGcsimConfig {
  /** 4 枠（足りない枠は未設定枠） */
  party: PartyMember[];
  stints: Stint[];
  /** ループ部分（while / for の本体）の最初の出場の位置。ループが無ければ 0 */
  loopStartIndex: number;
  /** 交代の直後の `wait` から求めた交代遅延（秒）。読み取れなければ undefined */
  switchDelay?: number;
  /** 設定文の先頭のコメント（編成名の候補） */
  name?: string;
  ignored: IgnoredItem[];
  /** キャラ ID → 読み取った天賦レベル・ステータス（今は取り込まない。DPS 計算の保存先ができたら使う） */
  characterSettings: Record<string, { level?: string; talent?: number[]; stats?: string[] }>;
}

export type ParseGcsimResult = { ok: true; value: ParsedGcsimConfig } | { ok: false; error: string };

export interface ParseGcsimInput {
  characters: CharacterConfig[];
  weapons: WeaponDatabaseItem[];
  artifacts: ArtifactSetDatabaseItem[];
}

/** gcsim の別名（`raiden` = `raidenshogun` など）の組。gcsim の pkg/shortcut から作る（scripts/build-key-aliases.ts） */
const ALIAS_GROUPS = aliasData as { characters: string[][]; weapons: string[][]; artifacts: string[][] };

/** 別名を、組の代表の名前にそろえる関数（組に無い名前は、そのまま） */
const canonicalizer = (groups: string[][]) => {
  const map = new Map<string, string>();
  for (const g of groups) for (const name of g) map.set(name, g[0]);
  return (key: string): string => map.get(key) ?? key;
};
const canonChar = canonicalizer(ALIAS_GROUPS.characters);
const canonWeapon = canonicalizer(ALIAS_GROUPS.weapons);
const canonArtifact = canonicalizer(ALIAS_GROUPS.artifacts);

const PARTY_SIZE = 4;
/** アプリの設定文の options に出る項目（buildGcsimConfig）。これだけなら、読み込まないことを知らせない */
const APP_OPTION_KEYS = new Set(['iteration', 'duration', 'swap_delay', 'ignore_burst_energy']);
/** アプリの設定文の target（敵は固定） */
const APP_TARGET = 'lvl=100 resist=0.1';
const DEFAULT_ENERGY_RECHARGE = 100;
const clip = (s: string) => (s.length > 80 ? `${s.slice(0, 77)}...` : s);

type Token = { kind: 'stmt' | 'open' | 'close'; text: string; line: number };

/** コメント（# と //）を除き、文（;）・ブロックの開き（{）・閉じ（}）に分ける */
function tokenize(source: string): { tokens: Token[]; firstComment?: string } {
  const tokens: Token[] = [];
  let firstComment: string | undefined;
  let sawCode = false;
  let line = 1;
  let buf = '';
  let bufLine = 1;
  let inStr = false;
  const flush = (kind: Token['kind']) => {
    const text = buf.trim();
    if (text || kind !== 'stmt') tokens.push({ kind, text, line: bufLine });
    buf = '';
  };
  const startsBlockHeader = () => /^(for|while|if|else|fn|switch)\b/.test(buf.trim());
  for (let i = 0; i < source.length; i++) {
    const ch = source[i];
    if (!inStr && (ch === '#' || (ch === '/' && source[i + 1] === '/'))) {
      let j = i;
      while (j < source.length && source[j] !== '\n') j++;
      if (!sawCode && !buf.trim() && firstComment === undefined) firstComment = source.slice(i, j).replace(/^(#|\/\/)+\s*/, '').trim();
      i = j - 1;
      continue;
    }
    if (ch === '\n') { line++; if (buf.trim()) buf += ' '; continue; }
    if (!buf.trim()) bufLine = line;
    if (ch === '"') inStr = !inStr;
    if (!inStr) {
      if (ch === '{') { sawCode = true; flush('open'); continue; }
      if (ch === '}') { if (buf.trim()) flush('stmt'); bufLine = line; flush('close'); continue; }
      if (ch === ';' && !startsBlockHeader()) { sawCode = true; flush('stmt'); continue; }
    }
    buf += ch;
  }
  if (buf.trim()) tokens.push({ kind: 'stmt', text: buf.trim(), line: bufLine });
  return { tokens, firstComment: sawCode || firstComment ? firstComment : undefined };
}

/** `[...]` の外のカンマで分ける */
function splitTopLevel(s: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = '';
  for (const ch of s) {
    if (ch === '[' || ch === '(') depth++;
    if (ch === ']' || ch === ')') depth--;
    if (ch === ',' && depth === 0) { out.push(cur.trim()); cur = ''; continue; }
    cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

const parseKv = (s: string): Record<string, string> => {
  const out: Record<string, string> = {};
  for (const m of s.matchAll(/([a-z_]+)=("[^"]*"|[^\s;]+)/g)) out[m[1]] = m[2].replace(/^"|"$/g, '');
  return out;
};

/** 命令の基本名 → 通常のアクション定義の末尾（同じ命令に当たるアクションが複数あるとき、これを優先する） */
const CANONICAL_SUFFIX: Record<string, string> = {
  attack: 'n', charge: 'ca', aim: 'ca', skill: 'e', burst: 'q', dash: 'dash', jump: 'jump', low_plunge: 'lp', high_plunge: 'hp',
};

const normalizeCommand = (c: string) => c.replace(/\s+/g, '');
const baseOf = (c: string) => c.replace(/\[.*$/, '');
const paramKeys = (c: string): string[] => (c.match(/\[(.*)\]/)?.[1] ?? '').split(',').map(p => p.split('=')[0].trim()).filter(Boolean);

/** gcsim の命令（`skill[hold=1]` など）に当たるアクション定義を探す（キャラごと。アクション定義 ID の逆引き） */
export function findActionForCommand(char: CharacterConfig, command: string): { id: string; paramsIgnored: boolean } | undefined {
  const want = normalizeCommand(command);
  const base = baseOf(want);
  const candidates = char.availableActions
    .filter(a => !a.gcsimUnsupported)
    .map(a => ({ def: a, mapped: normalizeCommand(mapAction(a.id, char.weaponType).command ?? '') }))
    .filter(c => c.mapped && baseOf(c.mapped) === base);
  if (candidates.length === 0) return undefined;
  const suffixOf = (id: string) => id.slice(id.indexOf('_') + 1);
  const canonical = (c: { def: { id: string } }) => (suffixOf(c.def.id) === CANONICAL_SUFFIX[base] ? 0 : 1);
  const exact = candidates.filter(c => c.mapped === want).sort((a, b) => canonical(a) - canonical(b));
  if (exact.length > 0) return { id: exact[0].def.id, paramsIgnored: false };
  if (want !== base) {
    // パラメータ付き（長押しの秒数など）: 同じ種類のパラメータを持つアクション（長さをフレームで渡すアクションを優先）
    const keys = paramKeys(want);
    const withParams = candidates
      .filter(c => c.mapped !== base && (HOLD_FRAMES_ACTIONS.has(c.def.id) || paramKeys(c.mapped).some(k => keys.includes(k))))
      .sort((a, b) => Number(HOLD_FRAMES_ACTIONS.has(b.def.id)) - Number(HOLD_FRAMES_ACTIONS.has(a.def.id)));
    if (withParams.length > 0) return { id: withParams[0].def.id, paramsIgnored: false };
  }
  const plain = candidates.filter(c => c.mapped === base).sort((a, b) => canonical(a) - canonical(b));
  const pick = plain[0] ?? [...candidates].sort((a, b) => canonical(a) - canonical(b))[0];
  return { id: pick.def.id, paramsIgnored: want !== base };
}

interface MemberDraft {
  char: CharacterConfig;
  constellation?: number;
  hexerei?: boolean;
  revelation?: boolean;
  weaponId?: string;
  weaponRefinementRank?: number;
  sets: { id: string; count: number }[];
  setUnsupported: boolean;
}

export function parseGcsimConfig(source: string, input: ParseGcsimInput): ParseGcsimResult {
  const { tokens, firstComment } = tokenize(source);
  const ignored: IgnoredItem[] = [];
  const ignore = (tok: Token, reason: IgnoredReason, text = tok.text) => ignored.push({ line: tok.line, text: clip(text), reason });

  const charByKey = new Map<string, CharacterConfig>();
  for (const c of input.characters) {
    const k = c.source?.gcsimKey;
    if (k && !c.id.startsWith('empty_slot_') && !charByKey.has(canonChar(k))) charByKey.set(canonChar(k), c);
  }
  const weaponByKey = new Map(input.weapons.filter(w => w.gcsimKey).map(w => [canonWeapon(w.gcsimKey!), w]));
  const artifactByKey = new Map(input.artifacts.filter(a => a.gcsimKey).map(a => [canonArtifact(a.gcsimKey!), a]));

  const members: MemberDraft[] = [];
  const memberByKey = new Map<string, MemberDraft>();
  const unknownKeys = new Set<string>();
  const settings: ParsedGcsimConfig['characterSettings'] = {};

  const stints: Stint[] = [];
  let current: Stint | undefined;
  let currentKey: string | undefined;
  let forceNew = false;
  let pendingSwap = false;
  let switchFrames: number | undefined;
  let loopStartIndex = 0;
  let loopSeen = false;
  let seq = 0;
  const stamp = Date.now();
  /** 長押し（hold=N）の秒数が読めたアクション。後で、所要時間にする */
  const holds: { action: CharacterActionInstance; stint: Stint; char: CharacterConfig; seconds: number }[] = [];

  // ブロックのスタック: loop = 繰り返しの本体 / swapIf = アプリの出力の条件つき交代 / skip = 読み飛ばす
  type Block = 'loop' | 'swapIf' | 'skip' | 'plain';
  const stack: Block[] = [];
  const inSkip = () => stack.includes('skip');
  const inSwapIf = () => stack[stack.length - 1] === 'swapIf';

  const newId = (prefix: string) => `${prefix}_${stamp}_${++seq}`;
  const startStint = (key: string) => {
    const member = memberByKey.get(key)!;
    current = { id: newId('stint'), characterId: member.char.id, note: '', actions: [] };
    currentKey = key;
    stints.push(current);
  };
  const enter = (key: string) => {
    if (!current || currentKey !== key || forceNew) { startStint(key); forceNew = false; }
  };
  const lastRealAction = (): CharacterActionInstance | undefined =>
    [...(current?.actions ?? [])].reverse().find(a => a.type !== 'wait');

  for (const tok of tokens) {
    if (tok.kind === 'close') {
      const b = stack.pop();
      if (b === 'loop') forceNew = true;
      continue;
    }
    if (tok.kind === 'open') {
      const h = tok.text;
      if (inSkip()) { stack.push('skip'); continue; }
      if (/^(for|while)\b/.test(h)) {
        if (loopSeen) { ignore(tok, 'extraLoop'); stack.push('skip'); continue; }
        loopSeen = true;
        if (!/^while\s+i\s*<=?\s*\d+$/.test(h)) ignore(tok, 'loopCondition');
        loopStartIndex = stints.length;
        forceNew = true;
        stack.push('loop');
        continue;
      }
      if (/^if\s+i\s*(<|>|<=|>=)\s*\d+$/.test(h) && stack.includes('loop')) { stack.push('swapIf'); continue; }
      ignore(tok, 'conditional');
      stack.push('skip');
      continue;
    }

    const text = tok.text;
    if (inSkip()) continue;
    if (inSwapIf()) {
      // アプリの出力の条件つき交代: 交代は出場の切れ目で表すので、`swap` の有無だけ見る。`wait(1)` は交代遅延の端数
      const m = text.match(/^([a-z0-9_]+)\s+swap$/);
      if (m && memberByKey.has(canonChar(m[1]))) { enter(canonChar(m[1])); pendingSwap = true; }
      else if (!/^wait\(\s*\d+\s*\)$/.test(text)) ignore(tok, 'conditional');
      continue;
    }

    // --- 設定文の骨組み（アプリの出力。何も言わずに読み飛ばす） ---
    if (/^let\s+i\s*=\s*1$/.test(text) || /^i\s*=\s*i\s*\+\s*1$/.test(text) || /^print\(/.test(text) || /^active\s+/.test(text)) continue;

    // --- 設定 ---
    // アプリの出力の options（所要時間はアプリが見積もる・交代遅延は wait から読む）と target（敵は固定）は、知らせない。違う項目があるときだけ、一覧に出す
    if (/^options\b/.test(text)) {
      const keys = Object.keys(parseKv(text.replace(/^options\s*/, '')));
      if (!keys.every(k => APP_OPTION_KEYS.has(k))) ignore(tok, 'options');
      continue;
    }
    if (/^target\b/.test(text)) {
      if (text.replace(/^target\s*/, '').replace(/\s+/g, ' ').trim() !== APP_TARGET) ignore(tok, 'target');
      continue;
    }
    if (/^energy\b/.test(text)) { ignore(tok, 'energy'); continue; }
    if (/^hurt\b/.test(text)) { ignore(tok, 'hurt'); continue; }
    if (/^(let|var)\b|^[a-z_]\w*\s*=[^=]/.test(text)) { ignore(tok, 'variable'); continue; }

    const head = text.match(/^([a-z0-9_]+)\s+(.*)$/);
    const swapTo = text.match(/^swap\s+([a-z0-9_]+)$/);
    if (swapTo && memberByKey.has(canonChar(swapTo[1]))) { enter(canonChar(swapTo[1])); pendingSwap = true; continue; }
    if (!head) {
      const w = text.match(/^(wait|delay)\(\s*(\d+)\s*\)$/);
      if (w) {
        const frames = Number(w[2]);
        if (w[1] === 'wait') {
          if (!current || current.actions.length === 0 || forceNew) {
            if (switchFrames === undefined) switchFrames = frames + (pendingSwap ? 1 : 0);
          } else {
            current.actions.push({ id: newId('act'), actionTypeId: 'wait', name: t('editor:waitName'), shortName: 'w', type: 'wait', duration: Number((frames / 60).toFixed(3)) });
          }
        } else {
          const last = lastRealAction();
          if (last && last.delayAfter === undefined) last.delayAfter = Number((frames / 60).toFixed(3));
        }
        pendingSwap = false;
        continue;
      }
      ignore(tok, 'unknownStatement');
      continue;
    }
    const keyText = head[1];
    const key = canonChar(keyText);
    const rest = head[2];

    // --- キャラ行 ---
    if (/^char\b/.test(rest)) {
      const char = charByKey.get(key);
      if (!char) { unknownKeys.add(key); ignore(tok, 'unknownCharacter'); continue; }
      if (memberByKey.has(key)) continue;
      if (members.length >= PARTY_SIZE) { ignore(tok, 'tooManyCharacters'); unknownKeys.add(key); continue; }
      const kv = parseKv(rest);
      const draft: MemberDraft = { char, sets: [], setUnsupported: false };
      if (kv.cons !== undefined && Number.isFinite(Number(kv.cons))) draft.constellation = Math.min(6, Math.max(0, Math.floor(Number(kv.cons))));
      const params = rest.match(/\+params=\[([^\]]*)\]/)?.[1] ?? '';
      for (const p of params.split(',')) {
        const [pk, pv] = p.split('=').map(s => s.trim());
        if (pk === HEXEREI_GCSIM_PARAM) draft.hexerei = pv !== '0';
        if (pk === REVELATION_GCSIM_PARAM) draft.revelation = pv !== '0';
      }
      const s: ParsedGcsimConfig['characterSettings'][string] = {};
      if (kv.lvl) s.level = kv.lvl;
      if (kv.talent) s.talent = kv.talent.split(',').map(Number).filter(Number.isFinite);
      settings[char.id] = s;
      // アプリの出力（talent=9,9,9・lvl=90/90）と同じなら、知らせない。違うときだけ、未対応として一覧に出す
      if (s.talent && s.talent.join(',') !== '9,9,9') ignore(tok, 'talent');
      else if (s.level && s.level !== '90/90') ignore(tok, 'level');
      members.push(draft);
      memberByKey.set(key, draft);
      continue;
    }
    if (/^add\s+weapon\b/.test(rest)) {
      const d = memberByKey.get(key);
      if (!d) { ignore(tok, 'unknownCharacter'); continue; }
      const kv = parseKv(rest);
      const w = weaponByKey.get(canonWeapon(kv.weapon ?? ''));
      if (!w) { ignore(tok, 'unknownWeapon'); continue; }
      d.weaponId = w.id;
      const refine = Number(kv.refine);
      if (Number.isFinite(refine)) d.weaponRefinementRank = Math.min(5, Math.max(1, Math.floor(refine)));
      continue;
    }
    if (/^add\s+set\b/.test(rest)) {
      const d = memberByKey.get(key);
      if (!d) { ignore(tok, 'unknownCharacter'); continue; }
      const kv = parseKv(rest);
      const a = artifactByKey.get(canonArtifact(kv.set ?? ''));
      if (!a) { ignore(tok, 'unknownArtifact'); continue; }
      d.sets.push({ id: a.id, count: Number(kv.count) });
      continue;
    }
    if (/^add\s+stats\b/.test(rest)) {
      const d = memberByKey.get(key);
      if (d) (settings[d.char.id] ??= {}).stats = [...((settings[d.char.id] ??= {}).stats ?? []), rest.replace(/^add\s+stats\s*/, '')];
      // アプリの出力の仮ステータス（cr=1）だけなら、知らせない
      if (rest.replace(/^add\s+stats\s*/, '').trim() !== 'cr=1') ignore(tok, 'stats');
      continue;
    }

    // --- 行動 ---
    const member = memberByKey.get(key);
    if (!member) {
      ignore(tok, unknownKeys.has(key) ? 'unknownCharacter' : 'unknownStatement');
      continue;
    }
    let sawSwap = false;
    for (const item of splitTopLevel(rest)) {
      const m = item.match(/^([a-z_]+)(\[[^\]]*\])?(?::(\d+))?$/);
      if (!m) { ignore(tok, 'unknownStatement'); continue; }
      const command = m[1] + (m[2] ?? '');
      const repeat = m[3] ? Math.max(1, Number(m[3])) : 1;
      if (m[1] === 'swap') { enter(key); sawSwap = true; continue; }
      const found = findActionForCommand(member.char, command);
      if (!found) { ignore(tok, 'unknownAction', `${keyText} ${item}`); continue; }
      if (found.paramsIgnored) ignore(tok, 'paramsIgnored', `${keyText} ${item}`);
      const def = member.char.availableActions.find(a => a.id === found.id)!;
      enter(key);
      for (let r = 0; r < repeat; r++) {
        const action: CharacterActionInstance = {
          id: newId('act'), actionTypeId: def.id, name: def.name, shortName: def.shortName, type: def.type, duration: def.defaultDuration,
        };
        current!.actions.push(action);
        const seconds = holdSecondsFromCommand(def.id, command);
        if (seconds !== undefined) holds.push({ action, stint: current!, char: member.char, seconds });
      }
    }
    pendingSwap = sawSwap;
  }

  // 長押しの秒数 → 所要時間（rotation/durationPhases.ts の holdSeconds の逆: 所要時間 = 長押し + モーション − 長押しを含むフレーム）。
  // モーションは、次のアクションに応じたキャンセルのフレーム（ヒットストップは見ない）
  for (const { action, stint, char, seconds } of holds) {
    const def = char.availableActions.find(a => a.id === action.actionTypeId);
    const frames = def?.frames;
    if (!def || !frames) continue;
    const next = stint.actions[stint.actions.indexOf(action) + 1];
    const nextKey = cancelKeyOf(next, char.weaponType);
    const motion = nextKey === 'wait' ? canQueueFrames(frames, def) : (nextKey ? frames.cancels[nextKey] : undefined) ?? frames.total;
    action.duration = Number(Math.max(0.05, seconds + motion / 60 - (def.holdInFrames ?? 0)).toFixed(3));
    action.durationManual = true;
  }

  // 後処理: 遅延の文が続かなかったアクションは、遅延なし（0）。空の出場は除く
  for (const s of stints) {
    for (const a of s.actions) if (a.type !== 'wait' && a.delayAfter === undefined) a.delayAfter = 0;
    for (const a of s.actions) if (a.delayAfter === DEFAULT_ACTION_DELAY) delete a.delayAfter;
  }
  const emptyBefore = stints.slice(0, loopStartIndex).filter(s => s.actions.length === 0).length;
  const nonEmpty = stints.filter(s => s.actions.length > 0);

  if (members.length === 0) return { ok: false, error: t('save:gcsimImport.noCharacters') };

  const party: PartyMember[] = members.map(d => {
    const twoTwo = d.sets.length >= 2 && d.sets.every(s => s.count === 2);
    const four = d.sets.find(s => s.count === 4);
    let artifactSetMode: ArtifactSetMode | undefined;
    let artifactSetId: string | undefined;
    if (four) { artifactSetId = four.id; artifactSetMode = '4pc'; }
    else if (twoTwo) artifactSetMode = '2+2';
    else if (d.sets.length > 0) d.setUnsupported = true;
    const member: PartyMember = {
      characterId: d.char.id,
      ...(d.constellation !== undefined ? { constellation: d.constellation } : {}),
      ...(d.hexerei !== undefined ? { hexerei: d.hexerei } : {}),
      ...(d.revelation !== undefined ? { revelation: d.revelation } : {}),
      ...(d.weaponId ? { weaponId: d.weaponId } : {}),
      ...(d.weaponRefinementRank !== undefined ? { weaponRefinementRank: d.weaponRefinementRank } : {}),
      ...(artifactSetId ? { artifactSetId } : {}),
      ...(artifactSetMode ? { artifactSetMode } : {}),
      energyRecharge: DEFAULT_ENERGY_RECHARGE,
    };
    return member;
  });
  const unsupportedSets = members.filter(d => d.setUnsupported);
  if (unsupportedSets.length > 0) ignored.push({ line: 0, text: unsupportedSets.map(d => d.char.id).join(', '), reason: 'artifactCount' });
  for (let i = party.length; i < PARTY_SIZE; i++) party.push({ characterId: `empty_slot_${i + 1}`, energyRecharge: DEFAULT_ENERGY_RECHARGE });

  const name = firstComment && firstComment.length > 0 && firstComment.length <= 60 ? firstComment : undefined;
  return {
    ok: true,
    value: {
      party,
      stints: nonEmpty,
      loopStartIndex: Math.max(0, loopStartIndex - emptyBefore),
      ...(switchFrames !== undefined ? { switchDelay: Number((switchFrames / 60).toFixed(3)) } : {}),
      ...(name ? { name } : {}),
      ignored: ignored.sort((a, b) => a.line - b.line),
      characterSettings: settings,
    },
  };
}
