/**
 * 編成 → gcsim 設定文の変換（フェーズ4）
 *
 * 純粋関数。編成（解決済みのキャラ）・出場ブロック・ループ開始点・交代遅延・DB から、gcsim の設定文と警告を作る。
 * 設定文の構成と決定事項は docs/gcsim-integration/phase-4-config-converter/plan.md を参照。
 */
import type { CharacterConfig, Stint } from '../../types/genshin.ts';
import type { ArtifactSetDatabaseItem, WeaponDatabaseItem } from '../../types/database.ts';
import { actionDelayOf } from '../actionDelay.ts';
import { mapAction } from './actionMapping.ts';

/** 仮値（D2）: キャラ・武器 Lv90/90、天賦レベル固定、会心率100% */
const CHARACTER_LINE_PARAMS = 'lvl=90/90';
const TALENT_LEVELS = '9,9,9';
const WEAPON_LEVEL = '90/90';
const TEMP_STATS = 'cr=1';

/** ループ部分を回す周数（2周目の先頭で、1周目から続くCTが間に合うかを確かめるため 2周） */
export const LOOP_ITERATIONS = 2;
/** duration の余裕（CT待ちで周が延びても足りるように、見積りの倍＋固定秒） */
const DURATION_MARGIN_FACTOR = 2;
const DURATION_MARGIN_SECONDS = 30;

const toFrames = (seconds: number): number => Math.max(0, Math.round(seconds * 60));

export interface GcsimWarning {
  /** error: gcsim を実行できない / warn: 実行はできるが結果がずれる可能性 */
  level: 'error' | 'warn';
  message: string;
}

export interface GcsimConfigInput {
  /** 編成を DB と合わせて解決したキャラ（未設定枠を含む 4 枠） */
  characters: CharacterConfig[];
  /** 表示中（DB に有るキャラの）出場ブロック */
  stints: Stint[];
  /** 2周目ループの開始位置（0=先頭から全周） */
  loopStartIndex: number;
  /** キャラ交代の所要時間（秒） */
  switchDelay: number;
  weapons: WeaponDatabaseItem[];
  artifacts: ArtifactSetDatabaseItem[];
}

export interface GcsimConfigResult {
  config: string;
  warnings: GcsimWarning[];
  /** error の警告が無く、gcsim に送れる */
  runnable: boolean;
}

const isEmptySlot = (c: CharacterConfig) => c.id.startsWith('empty_slot_');

export function buildGcsimConfig(input: GcsimConfigInput): GcsimConfigResult {
  const warnings: GcsimWarning[] = [];
  const error = (message: string) => warnings.push({ level: 'error', message });
  const warn = (message: string) => warnings.push({ level: 'warn', message });

  const members = input.characters.filter(c => !isEmptySlot(c));
  const keyOf = new Map<string, string>();
  const lines: string[] = [];

  if (members.length === 0) error('編成にキャラがいません');
  if (input.stints.length === 0) error('出場ブロックがありません（ローテーションが空です）');

  // 1. キャラごと（キャラ・武器・聖遺物・仮ステータス）
  for (const c of members) {
    const key = c.source?.gcsimKey;
    if (!key) {
      error(`${c.name}: gcsim のキーがありません（gcsim 未対応のキャラ、またはカスタムキャラ）`);
      continue;
    }
    keyOf.set(c.id, key);
    const cons = c.constellation ?? (c.rarity === 4 ? 6 : 0);
    lines.push(`${key} char ${CHARACTER_LINE_PARAMS} cons=${cons} talent=${TALENT_LEVELS};`);

    const weapon = input.weapons.find(w => w.id === c.weaponId);
    if (!c.weaponId) {
      warn(`${c.name}: 武器が未設定です（武器なしで計算されます）`);
    } else if (!weapon) {
      error(`${c.name}: 武器がデータベースに見つかりません`);
    } else if (!weapon.gcsimKey) {
      error(`${c.name}: 武器「${weapon.name}」に gcsim のキーがありません（gcsim 未対応の武器、またはカスタム武器）`);
    } else {
      const refine = c.weaponRefinementRank ?? weapon.refinementRank ?? (weapon.rarity >= 5 ? 1 : 5);
      lines.push(`${key} add weapon="${weapon.gcsimKey}" refine=${refine} lvl=${WEAPON_LEVEL};`);
    }

    // 2+2 は聖遺物の発動バフなし（D5）なので出力しない
    if (c.artifactSetMode !== '2+2') {
      const artifact = input.artifacts.find(a => a.id === c.artifactSetId);
      if (!c.artifactSetId) {
        warn(`${c.name}: 聖遺物セットが未設定です（聖遺物なしで計算されます）`);
      } else if (!artifact) {
        error(`${c.name}: 聖遺物セットがデータベースに見つかりません`);
      } else if (!artifact.gcsimKey) {
        error(`${c.name}: 聖遺物「${artifact.name}」に gcsim のキーがありません（gcsim 未対応の聖遺物、またはカスタム聖遺物）`);
      } else {
        lines.push(`${key} add set="${artifact.gcsimKey}" count=4;`);
      }
    }
    lines.push(`${key} add stats ${TEMP_STATS};`);
  }

  // 2. ローテーション本体
  const loopStart = input.loopStartIndex > 0 && input.loopStartIndex < input.stints.length ? input.loopStartIndex : 0;
  const initialStints = input.stints.slice(0, loopStart);
  const loopStints = input.stints.slice(loopStart);

  const charById = new Map(input.characters.map(c => [c.id, c]));
  const stintLines = (stintList: Stint[], indent: string): string[] => {
    const out: string[] = [];
    for (const stint of stintList) {
      const char = charById.get(stint.characterId);
      const key = keyOf.get(stint.characterId);
      if (!char || !key) continue; // キーが無いキャラは上で error 済み
      // gcsim は通常攻撃の連続を数える。交代・他のアクションを挟むと 1 段目に戻る
      let lastNormal = 0;
      for (const act of stint.actions) {
        if (act.type === 'swap' || act.actionTypeId === 'action_switch_char') continue;
        if (act.type === 'wait') {
          const frames = toFrames(act.duration);
          if (frames > 0) out.push(`${indent}delay(${frames});`);
          lastNormal = 0;
          continue;
        }
        const mapped = mapAction(act.actionTypeId, char.weaponType);
        if (!mapped.command) {
          error(`${char.name}: アクション「${act.name}」（${act.actionTypeId}）に gcsim への変換規則がありません`);
          lastNormal = 0;
          continue;
        }
        if (mapped.normalIndex !== undefined) {
          const n = mapped.normalIndex;
          if (n !== 1 && n !== lastNormal + 1) {
            warn(`${char.name}: 通常攻撃 N${n} の直前が N${n - 1} ではありません（gcsim は連続した通常攻撃を順に数えるため、実際は別の段になります）`);
          }
          lastNormal = n;
        } else {
          lastNormal = 0;
        }
        out.push(`${indent}${key} ${mapped.command};`);
        const delayFrames = toFrames(actionDelayOf(act));
        if (delayFrames > 0) out.push(`${indent}delay(${delayFrames});`);
      }
    }
    return out;
  };

  const initialLines = stintLines(initialStints, '');
  const loopLines = stintLines(loopStints, '  ');

  // 3. シミュレーション時間の見積り（初動 + ループ×周数）を余裕付きで
  const stintSeconds = (s: Stint) =>
    input.switchDelay + s.actions
      .filter(a => a.type !== 'swap' && a.actionTypeId !== 'action_switch_char')
      .reduce((sum, a) => sum + Math.max(0, a.duration || 0) + actionDelayOf(a), 0);
  const estimated = initialStints.reduce((t, s) => t + stintSeconds(s), 0)
    + loopStints.reduce((t, s) => t + stintSeconds(s), 0) * LOOP_ITERATIONS;
  const duration = Math.ceil(estimated * DURATION_MARGIN_FACTOR + DURATION_MARGIN_SECONDS);

  const firstKey = input.stints.map(s => keyOf.get(s.characterId)).find(Boolean);

  const config: string[] = [
    ...lines,
    '',
    `options iteration=1 duration=${duration} swap_delay=${toFrames(input.switchDelay)} ignore_burst_energy=true;`,
    'target lvl=100 resist=0.1;',
    ...(firstKey ? [`active ${firstKey};`] : []),
    '',
    ...initialLines,
    'let i = 1;',
    `while i <= ${LOOP_ITERATIONS} {`,
    '  print("loop ", i);',
    ...loopLines,
    '  i = i + 1;',
    '}',
  ];

  return {
    config: config.join('\n') + '\n',
    warnings,
    runnable: !warnings.some(w => w.level === 'error'),
  };
}
