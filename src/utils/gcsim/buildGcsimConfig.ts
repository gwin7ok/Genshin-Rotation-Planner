/**
 * 編成 → gcsim 設定文の変換（フェーズ4）
 *
 * 純粋関数。編成（解決済みのキャラ）・出場ブロック・ループ開始点・交代遅延・DB から、gcsim の設定文と警告を作る。
 * 設定文の構成と決定事項は docs/gcsim-integration/phase-4-config-converter/plan.md を参照。
 */
import { HEXEREI_GCSIM_KEYS, HEXEREI_GCSIM_PARAM } from '../../masterdata/hexereiCharacters.ts';
import { REVELATION_GCSIM_KEYS, REVELATION_GCSIM_PARAM } from '../../masterdata/revelationCharacters.ts';
import type { CharacterConfig, Stint } from '../../types/genshin.ts';
import type { ArtifactSetDatabaseItem, WeaponDatabaseItem } from '../../types/database.ts';
import { actionDelayOf } from '../actionDelay.ts';
import { applyHoldSeconds, mapAction } from './actionMapping.ts';
import { CHARGE_REQUIRES_ATTACK, PREVIOUS_ACTION_LABELS } from './chargeRules.ts';
import type { GcsimMemberInfo } from './readGcsimLog.ts';

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

/** gcsim の `swap_delay`（交代の要求から実行までのフレーム数）。交代遅延は `swap; delay(...)` で入れるため、最小にする */
const SWAP_DELAY_FRAMES = 1;

const toFrames = (seconds: number): number => Math.max(0, Math.round(seconds * 60));

export interface GcsimWarning {
  /** error: gcsim を実行できない / warn: 実行はできるが結果がずれる可能性 */
  level: 'error' | 'warn';
  message: string;
}

/**
 * 敵から受けるダメージの設定（追加作業 18）。ディシアの「紅き血」（自分が受けたダメージで HP が減ったとき）など、外からの HP の減少が条件の効果を再現する。
 * 間隔は秒、ダメージ量は HP。元素は物理（gcsim の `hurt every interval=… amount=… element=physical`）。ダメージは、間隔・量とも範囲の中の乱数
 */
export interface HurtSetting {
  enabled: boolean;
  intervalMin: number;
  intervalMax: number;
  amountMin: number;
  amountMax: number;
}

/** 既定（無効）。値は、D122 で確認した例（240〜300f ごとに 1000〜1500）と同じ */
export const DEFAULT_HURT: HurtSetting = { enabled: false, intervalMin: 4, intervalMax: 5, amountMin: 1000, amountMax: 1500 };

/** 設定文の `hurt` 行（無効・不正な値のときは undefined） */
export function hurtStatement(h: HurtSetting | undefined): string | undefined {
  if (!h?.enabled) return undefined;
  const lo = Math.round(h.intervalMin * 60);
  const hi = Math.round(h.intervalMax * 60);
  const a = Math.round(h.amountMin);
  const b = Math.round(h.amountMax);
  if (![lo, hi, a, b].every(Number.isFinite) || lo < 1 || hi < lo || a < 1 || b < a) return undefined;
  return `hurt every interval=${lo},${hi} amount=${a},${b} element=physical;`;
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
  /** 敵の防御ヒットストップ（gcsim の defhalt）。既定 true。false のとき `defhalt=false` を渡す（体幹が崩れる敵に当てる場合） */
  defHalt?: boolean;
  /** 敵から受けるダメージ（gcsim の `hurt every`。出場中のキャラが一定の間隔でダメージを受ける）。無い・無効なら、設定文に出さない */
  hurt?: HurtSetting;
  weapons: WeaponDatabaseItem[];
  artifacts: ArtifactSetDatabaseItem[];
  /** 長押しの秒数（アクション ID → 秒）。計算後のアクションの holdSeconds。無いアクションは最短の長押し（hold=1）になる */
  holdSecondsByActionId?: Record<string, number>;
  /**
   * ユーザーが標準の所要時間より長くした分（アクション ID → 秒）。gcsim にはアクションの長さを渡せないため、そのアクションの後の遅延に足して渡す。
   * 長押し（holdSeconds で渡すアクション）は含めない
   */
  extraWaitByActionId?: Record<string, number>;
  /** extraWaitByActionId のうち、モードの維持のための自動の待ち（アクション ID → 秒）。書き戻しで、保存する所要時間から引く（維持の秒数は保存しない） */
  modeHoldByActionId?: Record<string, number>;
}

export interface GcsimConfigResult {
  config: string;
  warnings: GcsimWarning[];
  /** error の警告が無く、gcsim に送れる */
  runnable: boolean;
  /** 設定文のキャラの並び（gcsim のログの char_index の順）。ログの読み取り（6-2）が使う */
  members: GcsimMemberInfo[];
  /**
   * 設定文のアクションと、アプリのアクションの対応（実行順に展開: 初動 → ループ × LOOP_ITERATIONS）。
   * gcsim のログの `executed <action>`（交代を除く）を先頭から数えた番号が、この配列の番号に一致する（6-3b・6-3）
   */
  actionRefs: GcsimActionRef[];
  /** 交代遅延（`swap_delay`）のフレーム数。出場の開始位置（アプリは交代遅延を出場に含める）を合わせるために使う */
  swapDelayFrames: number;
}

export interface GcsimActionRef {
  stintId: string;
  actionId: string;
  /** gcsim の命令の基本名（attack / skill / burst / charge / aim / dash / low_plunge ...。パラメータは含まない） */
  command: string;
  /** 遅延に足して渡した、標準より長くした分（秒）。書き戻しで、gcsim 自身の所要時間を求めるために引く。無ければ 0 */
  extraSeconds?: number;
  /** extraSeconds のうち、モードの維持のための自動の待ち（秒）。書き戻す所要時間には含めない。無ければ 0 */
  modeHoldSeconds?: number;
  /** このアクションの直後に置いた待機（待機のアクション・維持）の合計（秒）。gcsim のログのアクションの間隔に含まれるので、書き戻す所要時間から引く */
  waitAfterSeconds?: number;
  /** 設定文の中の位置: 初動 / ループ（何周目か） */
  phase: 'initial' | 'loop';
  /** phase = loop のとき、何周目か（1 始まり） */
  loopIteration?: number;
}

const isEmptySlot = (c: CharacterConfig) => c.id.startsWith('empty_slot_');

export function buildGcsimConfig(input: GcsimConfigInput): GcsimConfigResult {
  const warnings: GcsimWarning[] = [];
  const error = (message: string) => warnings.push({ level: 'error', message });
  const warn = (message: string) => warnings.push({ level: 'warn', message });

  const members = input.characters.filter(c => !isEmptySlot(c));
  const keyOf = new Map<string, string>();
  const lines: string[] = [];
  const memberInfos: GcsimMemberInfo[] = [];

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
    const weaponForInfo = input.weapons.find(w => w.id === c.weaponId);
    const artifactForInfo = c.artifactSetMode !== '2+2' ? input.artifacts.find(a => a.id === c.artifactSetId) : undefined;
    memberInfos.push({
      characterId: c.id,
      name: c.name,
      gcsimKey: key,
      weaponKey: weaponForInfo?.gcsimKey,
      artifactKey: artifactForInfo?.gcsimKey,
    });
    const cons = c.constellation ?? (c.rarity === 4 ? 6 : 0);
    // ヘクセレイ（魔女の宿題クリア）に対応するキャラは、明示的に渡す（gcsim の既定は有効）
    // 論示（八重神子）も同じく、明示的に渡す（gcsim の既定は達成済み）
    const paramList = [
      ...(HEXEREI_GCSIM_KEYS.has(key) ? [`${HEXEREI_GCSIM_PARAM}=${c.hexerei === false ? 0 : 1}`] : []),
      ...(REVELATION_GCSIM_KEYS.has(key) ? [`${REVELATION_GCSIM_PARAM}=${c.revelation === false ? 0 : 1}`] : []),
    ];
    const hexText = paramList.length > 0 ? ` +params=[${paramList.join(',')}]` : '';
    lines.push(`${key} char ${CHARACTER_LINE_PARAMS} cons=${cons} talent=${TALENT_LEVELS}${hexText};`);

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
  // 落下攻撃を含むキャラ（gcsim は空中状態などの前提条件があり、実行できない場合がある。D48）
  const plungeChars = new Set<string>();
  // 出場の先頭: 前の出場と違うキャラなら `<キャラ> swap;` で交代を実行し（swap_delay は 1 フレームだけ）、続けて交代遅延ぶんの `wait` を入れる。
  //   アプリの交代遅延は「交代が終わってから最初の入力まで」で、gcsim の交代CT（交代の実行から 60 フレーム）にも含まれる。
  //   gcsim の `swap_delay` は交代の実行までの待ちで、CTはその後から始まってしまうため使わない（フィッシュルの爆発だけの出場が、交代CT待ちになる）
  const switchFrames = toFrames(input.switchDelay);
  const stintLines = (
    stintList: Stint[],
    indent: string,
    refs: { stintId: string; actionId: string; command: string; extraSeconds?: number; modeHoldSeconds?: number; waitAfterSeconds?: number }[],
    /** 最初の出場の直前のキャラのキー（1周目と2周目以降で違うときは `loopPrevKeys`）。無ければ交代しない（最初の出場など） */
    firstPrevKey: string | undefined,
    /** ループの最初の出場の直前のキャラのキー（周ごとに違うとき: 1周目 / 2周目以降） */
    loopPrevKeys?: { first: string | undefined; later: string | undefined },
  ): string[] => {
    const out: string[] = [];
    let prevKey = firstPrevKey;
    let isFirst = true;
    for (const stint of stintList) {
      const char = charById.get(stint.characterId);
      const key = keyOf.get(stint.characterId);
      if (!char || !key) continue; // キーが無いキャラは上で error 済み
      if (isFirst && loopPrevKeys) {
        const needFirst = loopPrevKeys.first !== undefined && loopPrevKeys.first !== key;
        const needLater = loopPrevKeys.later !== undefined && loopPrevKeys.later !== key;
        if (needFirst && needLater) out.push(`${indent}${key} swap;`);
        else if (needLater) out.push(`${indent}if i > 1 {`, `${indent}  ${key} swap;`, `${indent}}`);
        else if (needFirst) out.push(`${indent}if i < 2 {`, `${indent}  ${key} swap;`, `${indent}}`);
      } else if (prevKey !== undefined && prevKey !== key) {
        out.push(`${indent}${key} swap;`);
      }
      // 交代遅延は `wait`（交代の直後にその時間を使う）。`delay` は次のアクションが実行できる状態になった「後」に入るため、
      // 最初のアクションのCT待ちと重ならず、アプリの時間より長くなってしまう
      if (switchFrames > 0) out.push(`${indent}wait(${switchFrames});`);
      isFirst = false;
      prevKey = key;
      // 出場の最後のアクション（次は交代）: 標準より長くした分は `wait` で渡す。`delay` は次の交代が実行できる状態になった「後」に入り、
      // 交代CTの待ちと重ならないため（爆発・重撃の後なら `wait` がちょうど交代へのキャンセルの時点から始まる）
      const lastCommandAct = [...stint.actions].reverse().find(a => a.type !== 'swap' && a.actionTypeId !== 'action_switch_char' && a.type !== 'wait');
      for (const act of stint.actions) {
        if (act.type === 'swap' || act.actionTypeId === 'action_switch_char') continue;
        if (act.type === 'wait') {
          // 出場の最後の待機には、モードの維持のための自動の待ちを足す。
          // 待機は `wait`（その場で、その時間を使う）。`delay` は次のアクションが実行できる状態になった「後」に入るため、待機の途中で CT が明ける
          // 並び（E → 待機 → E）でも、gcsim が次のアクションを待機の前に試して CT 待ちになり、実行が待機の分だけ遅れてしまう（2026-10-09）
          const frames = toFrames(act.duration + Math.max(0, input.extraWaitByActionId?.[act.id] ?? 0));
          if (frames > 0) {
            out.push(`${indent}wait(${frames});`);
            // 直前のアクション（この出場の）の、書き戻す所要時間から引く待ち
            const prev = refs[refs.length - 1];
            if (prev && prev.stintId === stint.id) prev.waitAfterSeconds = Number(((prev.waitAfterSeconds ?? 0) + frames / 60).toFixed(3));
          }
          continue;
        }
        // gcsim が実装していないアクション（大剣の重撃など）は、実行すると「action ... not implemented」のエラーになるので、設定文に入れない
        if (char.availableActions.find(a => a.id === act.actionTypeId)?.gcsimUnsupported) {
          error(`${char.name}: アクション「${act.name}」は、gcsim が未実装のため、gcsim では実行できません（設定文には入れていません。アクションを外してください）`);
          continue;
        }
        const mapped = mapAction(act.actionTypeId, char.weaponType);
        if (!mapped.command) {
          error(`${char.name}: アクション「${act.name}」（${act.actionTypeId}）に gcsim への変換規則がありません`);
          continue;
        }
        if (act.type === 'plunge_low' || act.type === 'plunge_high') plungeChars.add(char.name);
        const command = applyHoldSeconds(act.actionTypeId, mapped.command, input.holdSecondsByActionId?.[act.id]);
        out.push(`${indent}${key} ${command};`);
        const extra = Math.max(0, input.extraWaitByActionId?.[act.id] ?? 0);
        const modeHold = Math.max(0, input.modeHoldByActionId?.[act.id] ?? 0);
        refs.push({ stintId: stint.id, actionId: act.id, command: command.replace(/\[.*$/, ''), ...(extra > 0 ? { extraSeconds: extra } : {}), ...(modeHold > 0 ? { modeHoldSeconds: modeHold } : {}) });
        // 出場の最後のアクション、または追加分が長い（0.5 秒以上）ときは `wait`。長い待ちは、`wait` が交代・次の行動へのキャンセルより早く始まって吸収される分（最大 0.2 秒程度）が小さく、
        // `delay`（次のアクションが実行できる状態になった後に入る）だと、CT待ちの後にさらに待つため、特殊スキルの受付（12 秒など）を過ぎてしまうことがある
        // モードの維持の分は、`delay` で渡す（交代できる状態になった後から数える）。`wait` は、最も早いキャンセル（交代へのキャンセルより前のことがある）から始まるため、
        // 交代が状態の期限より早くなる（胡桃のスキルで 24f。2026-10-08 に実行で確認）。維持は数秒あるので、交代 CT（1 秒）の待ちとは重ならない
        const manualExtra = Number(Math.max(0, extra - modeHold).toFixed(3));
        if (manualExtra > 0 && (act === lastCommandAct || manualExtra >= 0.5)) {
          out.push(`${indent}wait(${toFrames(manualExtra)});`);
          const delayOnly = toFrames(actionDelayOf(act) + modeHold);
          if (delayOnly > 0) out.push(`${indent}delay(${delayOnly});`);
        } else {
          const delayFrames = toFrames(actionDelayOf(act) + manualExtra + modeHold);
          if (delayFrames > 0) out.push(`${indent}delay(${delayFrames});`);
        }
      }
    }
    return out;
  };

  const initialRefs: { stintId: string; actionId: string; command: string; extraSeconds?: number; modeHoldSeconds?: number; waitAfterSeconds?: number }[] = [];
  const loopRefs: { stintId: string; actionId: string; command: string; extraSeconds?: number; modeHoldSeconds?: number; waitAfterSeconds?: number }[] = [];
  const stintKey = (s: Stint | undefined) => (s ? keyOf.get(s.characterId) : undefined);
  const firstKey0 = input.stints.map(s => keyOf.get(s.characterId)).find(Boolean);
  const initialLines = stintLines(initialStints, '', initialRefs, undefined);
  // ループの最初の出場の直前: 1周目は初動の最後（初動が無ければ最初のキャラ = active）、2周目以降はループの最後
  const lastOf = (list: Stint[]) => [...list].reverse().map(stintKey).find(Boolean);
  const loopLines = stintLines(loopStints, '  ', loopRefs, undefined, {
    first: lastOf(initialStints) ?? firstKey0,
    later: lastOf(loopStints),
  });
  const actionRefs: GcsimActionRef[] = [
    ...initialRefs.map(r => ({ ...r, phase: 'initial' as const })),
    ...Array.from({ length: LOOP_ITERATIONS }, (_, i) => loopRefs.map(r => ({ ...r, phase: 'loop' as const, loopIteration: i + 1 }))).flat(),
  ];

  if (plungeChars.size > 0) {
    warn(`${[...plungeChars].join('・')}: 落下攻撃は、gcsim では空中状態（直前のアクション）などの前提条件があり、条件を満たさないと実行エラーになる場合があります`);
  }

  // 重撃の直前が通常攻撃でないキャラ（gcsim は実行エラーにする）。初動 → ループ → ループ（2周）の順に、直前のアクションを追う
  {
    const stintNumber = new Map(input.stints.map((s, i) => [s.id, i + 1]));
    const reported = new Set<string>();
    const sequence = [...initialStints, ...loopStints, ...loopStints];
    let prev = 'none';
    let prevCharId: string | undefined;
    for (const stint of sequence) {
      const char = charById.get(stint.characterId);
      const key = keyOf.get(stint.characterId);
      if (!char || !key) continue;
      if (prevCharId !== undefined && prevCharId !== stint.characterId) prev = 'swap';
      prevCharId = stint.characterId;
      for (const act of stint.actions) {
        if (act.type === 'swap' || act.actionTypeId === 'action_switch_char' || act.type === 'wait') continue;
        const command = mapAction(act.actionTypeId, char.weaponType).command;
        if (!command) continue;
        const base = command.replace(/\[.*$/, '');
        if (base === 'charge' && CHARGE_REQUIRES_ATTACK.has(key) && prev !== 'attack' && !reported.has(act.id)) {
          reported.add(act.id);
          const prevLabel = prev === 'none' ? 'ローテーションの最初' : PREVIOUS_ACTION_LABELS[prev] ?? prev;
          error(`${char.name}: 出場 #${stintNumber.get(stint.id)} の「${act.name}」の直前が${prev === 'none' ? '' : '「'}${prevLabel}${prev === 'none' ? '' : '」'}です。gcsim では重撃の直前に通常攻撃（N）が必要です（ゲームでは長押しで通常攻撃1段目のあとに重撃が出ます）。この重撃の前に N を追加してください`);
        }
        prev = base;
      }
    }
  }

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
    `options iteration=1 duration=${duration} swap_delay=${SWAP_DELAY_FRAMES} ignore_burst_energy=true${input.defHalt === false ? ' defhalt=false' : ''};`,
    'target lvl=100 resist=0.1;',
    ...(hurtStatement(input.hurt) ? [hurtStatement(input.hurt)!] : []),
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
    members: memberInfos,
    actionRefs,
    swapDelayFrames: SWAP_DELAY_FRAMES,
  };
}
