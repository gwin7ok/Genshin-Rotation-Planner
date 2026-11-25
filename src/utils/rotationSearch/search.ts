/**
 * ローテーション自動探索の本体（設計.md の ①〜⑤。画面とスクリプトで共通）。
 *   ① 候補を作る → ② CT 違反を除く → ③ 簡易スコアで絞る → ④ gcsim（少ない回数）で絞る → ⑤ gcsim（多い回数）で順位をつける
 * gcsim の呼び出し口は gcsimClient（画面は Web Worker、スクリプトは Node の worker_threads に差し替わる）。
 */
import type { CharacterConfig, Stint } from '../../types/genshin';
import type { EnemySetting, HurtSetting } from '../gcsim/buildGcsimConfig';
import type { EnemyParticles } from '../gcsim/requiredEnergyRecharge';
import { buildGcsimConfig } from '../gcsim/buildGcsimConfig';
import { HOLD_FRAMES_ACTIONS } from '../gcsim/actionMapping';
import { appGcsimExtras } from '../gcsim/appGcsimExtras';
import { calculateRotation } from '../rotationCalculator';
import { computeDps } from '../gcsim/dpsCalc';
import { runGcsimSample } from '../gcsim/gcsimClient';
import { describe, generateCandidatesAsync, mergeAdjacentStints, neighborsOf, type Candidate, type SearchRole } from './candidates';
import { evaluateCandidates, evaluateCandidatesAsync, type ScoredCandidate } from './evaluate';
import { canSupporterUseFreeNormal, canSupporterUseTriggerNormal, knowledgeSeeds } from './knowledgeSeeds';
import type { KnowledgeBundle } from '../../masterdata/knowledge/types';

/**
 * 画面の「DPS 計算」と同じ条件で評価する（初動 + ループ N 周・開始エネルギーは満タン・足りない爆発は溜まるまで待つ・敵の粒子・敵の設定。時間 = 最後のアクション・ダメージの遅いほう）。
 * 指定すると、戦闘時間（battleSeconds）は使わない。手組みの DPS 計算の結果と、そのまま比べられる
 */
export interface DpsConditions {
  loops: number;
  energy: boolean;
  particles: EnemyParticles;
  enemies: EnemySetting[];
}

export interface SearchSettings {
  /** 戦闘時間（秒）。DPS = この時間までのダメージ ÷ この時間 */
  battleSeconds: number;
  /** ③ 簡易スコアで残す数 */
  keep1: number;
  /** ④ gcsim の実行回数（少ない回数） */
  runs1: number;
  /** ④ で残す数 */
  keep2: number;
  /** ⑤ gcsim の実行回数（多い回数） */
  runs2: number;
  /** 候補の上限 */
  maxCandidates: number;
  /** ④b 近傍の探索で試す候補の数の上限（0 で行わない。既定 DEFAULT_REFINE_BUDGET） */
  refineBudget?: number;
  /** ④b 1 ラウンドで試す近傍の上限（既定 REFINE_BATCH） */
  refineBatch?: number;
  /** ④b 同時に広げる上位候補の数（ビーム幅。既定 BEAM） */
  beamWidth?: number;
}

const DEFAULT_REFINE_BUDGET = 2000;
/** 探索中（④④b）の戦闘時間の上限（秒） */
const EXPLORE_SECONDS = 60;
/** 山登りの 1 回で試す近傍の数の上限 */
const CROSS_PER_GROUP = 6;
const BEAM = 8;
const BEAM_RATIO = 0.9;
const STALE_LIMIT = 3;
const REFINE_BATCH = 200;
/** ダメージの割合がこれ未満のキャラ（アタッカー以外）の動作を、先に削ってみる */
const LOW_SHARE = 0.06;
/** 知識辞書の出発点があるとき、山登りする割り当ての下限（全体の最良に対する割合） */
const DICT_GROUP_RATIO = 0.8;
/** 上のキャラを狙った近傍を、1 回の山登りの測定に先に入れる最大数 */
const FOCUS_MAX = 20;
/** 許す CT 違反（CT 待ち）の数。gcsim が待ってから動くので、DPS は実測で正しく出る。決めた数を超える候補は捨てる（evaluate.ts の maxCtIssues） */
const TOLERATED_CT_ISSUES = 4;
/** 山登りの先行 1 回の足切り（いまの最良に対する割合） */
const REFINE_PREFILTER = 0.85;

export const DEFAULT_SEARCH_SETTINGS: SearchSettings = {
  battleSeconds: 60, keep1: 600, runs1: 2, keep2: 20, runs2: 10, maxCandidates: 20000,
  refineBudget: DEFAULT_REFINE_BUDGET, refineBatch: REFINE_BATCH, beamWidth: BEAM,
};

export type SearchPhase = 'generate' | 'quick' | 'refine' | 'verify';

export interface SearchProgress {
  phase: SearchPhase;
  done: number;
  total: number;
  /** 1.5 段目の測り直し（精査）中の進捗 */
  subDone?: number;
  subTotal?: number;
}

/** 発生した粒子（1 回の実行の平均。元素チャージ効率を調整して、他のステータスに回せる余地の目安） */
export interface ParticleInfo {
  /** 全員分・敵の粒子を含む、評価した時間の中の個数 */
  total: number;
  /** うち、敵から出る粒子（設定した間隔で出るので、どの候補でも同じくらい） */
  enemy: number;
  /** 粒子から受け取ったエネルギーの、全員の合計（元素チャージ効率を掛ける前）の平均 */
  energy: number;
  /** 評価した時間（秒） */
  seconds: number;
  /** 1 人あたり・10 秒あたりの、粒子から受け取ったエネルギー（ER 反映前）。粒子の色の違い・表と裏の受け取りの違いを、すべて含んだ値 */
  energyPerMember10s: number;
  /** キャラごとの、10 秒あたりの値（キャラ ID・値）。同じ基準（ER 反映前） */
  energyByChar10s: Array<{ characterId: string; energy10s: number }>;
}

/** キャラごとの、爆発のエネルギー待ち（DPS 計算と同じ。回数は 1 回の実行あたりの平均、秒は待ち 1 回あたりの平均で、待ちが無ければ null） */
export interface EnergyWaitInfo { characterId: string; waits: number; seconds: number | null }

export interface SearchResultItem {
  candidate: Candidate;
  dps: number;
  sd: number;
  /** アプリの計算でのローテーションの長さ（秒） */
  totalSeconds: number;
  /** 簡易スコア */
  score: number;
  /** 出発点にした「いまのローテーション」と同じ並び（keepFirstSeed のとき） */
  isCurrent?: boolean;
  /** 発生した粒子 */
  particles?: ParticleInfo;
  /** キャラごとの爆発のエネルギー待ち（エネルギーの計算が有効なときだけ） */
  energyWaits?: EnergyWaitInfo[];
  /** 評価したローテーションの周数（1 周あたりの待ち回数 = 回数 ÷ （周数 − 1）） */
  loops?: number;
  /** 指定周数未満で打ち切られたサンプル情報 */
  truncated?: { count: number; worst: number };
  /** 許容された CT 違反数 */
  ctIssues?: number;
}

export interface SearchCounts {
  candidates: number;
  rejected: number;
  rejectedBy: Record<string, number>;
  scored: number;
  quick: number;
  quickOk: number;
  quickFailed: Record<string, number>;
}

export type SearchOutcome =
  | { status: 'ok'; results: SearchResultItem[]; counts: SearchCounts; elapsedMs: number; spearman?: number; bestQuickScoreRank?: number; groupBest?: Array<{ key: string; dps: number; label: string }> }
  | { status: 'cancelled' }
  | { status: 'error'; message: string };

export interface SearchArgs {
  /** 編成のキャラ（空の枠は除く。装備・凸・天賦つきで解決済みのもの） */
  characters: CharacterConfig[];
  /** キャラ ID → 役割（探索で使う役割。利用者の上書きを反映したもの） */
  roles: Record<string, SearchRole[]>;
  weapons: Parameters<typeof buildGcsimConfig>[0]['weapons'];
  artifacts: Parameters<typeof buildGcsimConfig>[0]['artifacts'];
  settings: SearchSettings;
  switchDelay: number;
  defHalt: boolean;
  hurt?: HurtSetting;
  /** 画面の DPS 計算と同じ条件で評価する（指定すると、energy・battleSeconds は使わない） */
  dps?: DpsConditions;
  /** エネルギーを考慮して探索する（幽境用: 初期エネルギー 0・爆発のエネルギー消費あり）。無ければ、エネルギーは無視する */
  energy?: boolean;
  /** 追加の出発点（手組みなど。測定・検証用。グループ展開済みの出場と周回の開始位置。アタッカーは、最後の出場のキャラ） */
  extraSeeds?: Array<{ stints: Stint[]; loopStartIndex: number; assignment?: Record<string, SearchRole> }>;
  /** 知識辞書（取得できたキャラの分）。運用型の組み合わせから出発点を組み、必ず出発点に入れる */
  knowledge?: KnowledgeBundle;
  /** true のとき、生成した候補を使わず、extraSeeds だけを出発点にする（辞書で作った少数の候補だけから登る場合の、効果と時間を測る。画面の「いまのローテーションから探索」も、これを使う） */
  seedsOnly?: boolean;
  /** true のとき、最初の extraSeeds（候補の ID は seed0）を、順位に載せる（上位に入らなくても。「いまのローテーション」との比較に使う） */
  keepFirstSeed?: boolean;
  /** 同時に動かす gcsim の数（Worker の数） */
  cores: number;
  onProgress?: (p: SearchProgress) => void;
  shouldCancel?: () => boolean;
}

interface QuickRun { sc: ScoredCandidate; dps?: number; sd?: number; particles?: ParticleInfo; energyWaits?: EnergyWaitInfo[]; truncated?: { count: number; worst: number }; /** キャラ ID → ダメージの割合（全体に対して） */ share?: Record<string, number>; error?: string }

const yieldToPaint = () => new Promise<void>(resolve => {
  setTimeout(resolve, 0);
});

/** 順位（小さい順に 0 から） */
const ranksOf = (xs: number[]): number[] => {
  const idx = xs.map((x, i) => [x, i] as const).sort((a, b) => a[0] - b[0]);
  const r = new Array<number>(xs.length);
  idx.forEach(([, i], k) => { r[i] = k; });
  return r;
};

export async function searchRotation(args: SearchArgs): Promise<SearchOutcome> {
  const { characters, settings } = args;
  const t0 = Date.now();
  const cancelled = () => !!args.shouldCancel?.();
  try {
    args.onProgress?.({ phase: 'generate', done: 0, total: 1 });
    // 「候補を作っています…」と「□ 中止」ボタンを先に画面へ描画させる
    await yieldToPaint();
    if (cancelled()) return { status: 'cancelled' };
    const seedCands: Candidate[] = [...(args.extraSeeds ?? []), ...(args.knowledge ? knowledgeSeeds(characters, args.knowledge, Math.max(1, settings.keep1)) : [])].map((x, i) => {
      const atk = x.stints[x.stints.length - 1]?.characterId;
      const assignment = x.assignment ?? Object.fromEntries(characters.map(c => [c.id, (c.id === atk ? 'attacker' : (args.roles[c.id] ?? []).find(r => r !== 'attacker') ?? 'supporter') as SearchRole]));
      return { id: `seed${i}`, label: describe(characters, x.stints, x.loopStartIndex), assignment, targetSeconds: 0, stints: x.stints, loopStartIndex: x.loopStartIndex, op: 'seed' };
    });
    await yieldToPaint();
    if (cancelled()) return { status: 'cancelled' };
    const generated = args.seedsOnly ? [] : await generateCandidatesAsync(characters, args.roles, { maxCandidates: settings.maxCandidates, switchDelay: args.switchDelay });
    await yieldToPaint();
    if (cancelled()) return { status: 'cancelled' };
    const candidates = [...seedCands, ...generated];
    if (candidates.length === 0) return { status: 'error', message: 'NO_CANDIDATES' };
    const ev = await evaluateCandidatesAsync(characters, candidates, { switchDelay: args.switchDelay, defHalt: args.defHalt, maxCtIssues: TOLERATED_CT_ISSUES, shouldCancel: cancelled });
    await yieldToPaint();
    if (ev.scored.length === 0) return { status: 'error', message: 'NO_VALID_CANDIDATES' };
    if (cancelled()) return { status: 'cancelled' };

    // 1 候補ぶんの gcsim 実行。同時に動かす候補の数 = コア数 ÷ 1 候補の並列数
    // 候補から gcsim の設定を作る（実行用と、重複判定用で共通）
    const buildCfgFor = (sc: ScoredCandidate, seconds: number, _final: boolean) => {
      const dps = args.dps;
      const loopsUsed = dps ? dps.loops : 0;
      // アプリの計算（長押しの秒数・所要時間など）を通した値を、gcsim に渡す。置いたあとの DPS 計算と同じ結果にするため
      const calc = calculateRotation(characters, sc.candidate.stints, { switchDelay: args.switchDelay, loopStartIndex: sc.candidate.loopStartIndex ?? 0, defHalt: args.defHalt });
      const cfg = buildGcsimConfig({
        ...appGcsimExtras(calc.calculatedStints),
        characters, stints: sc.candidate.stints, loopStartIndex: sc.candidate.loopStartIndex ?? 0, switchDelay: args.switchDelay, defHalt: args.defHalt,
        ...(args.hurt ? { hurt: args.hurt } : {}), weapons: args.weapons, artifacts: args.artifacts,
        ...(dps
          ? { loopIterations: loopsUsed, enemies: dps.enemies, ignoreBurstEnergy: !dps.energy, ...(dps.energy && dps.particles.amount > 0 && dps.particles.maxSeconds > 0 ? { enemyParticles: dps.particles } : {}) }
          : { battleSeconds: seconds, ...(args.energy ? { ignoreBurstEnergy: false, startEnergyZero: true } : {}) }),
      });
      return cfg;
    };
    const charById = new Map(characters.map(c => [c.id, c]));
    const rankScoreOf = (r: QuickRun, isFinal: boolean): number => {
      const dpsVal = r.dps ?? 0;
      let s = isFinal ? Math.max(0, dpsVal - 0.35 * (r.sd ?? 0)) : dpsVal;
      if (r.truncated) {
        const ratio = Math.max(0.1, r.truncated.worst / Math.max(1, args.dps?.loops ?? 3));
        s *= 0.35 * ratio;
      }
      if (args.dps?.energy && r.energyWaits) {
        const totalWaitSec = r.energyWaits.reduce((sum, w) => sum + w.waits * (w.seconds ?? 0), 0);
        const waitPerLoop = totalWaitSec / Math.max(1, (args.dps.loops ?? 3) - 1);
        s *= 1 / (1 + Math.max(0, waitPerLoop - 0.3) * 0.12);
      }
      s *= 0.97 ** r.sc.ctIssues;
      if (isFinal) {
        const loopIdx = r.sc.candidate.loopStartIndex ?? 0;
        const stints = r.sc.candidate.stints;
        const loopCounts = new Map<string, number>();
        const isTriggerParty = canSupporterUseTriggerNormal(characters);
        for (let si = 0; si < stints.length; si++) {
          const st = stints[si];
          const ch = charById.get(st.characterId);
          const acts = st.actions.filter(a => a.type !== 'swap' && a.actionTypeId !== 'action_switch_char' && a.type !== 'wait');
          if (r.sc.candidate.assignment[st.characterId] !== 'attacker' && ch && !canSupporterUseFreeNormal(ch)) {
            const nCount = acts.filter(a => a.actionTypeId.slice(st.characterId.length + 1).split('@')[0] === 'n').length;
            if (nCount > 0) {
              const hasSkillOrBurst = acts.some(a => { const b = a.actionTypeId.slice(st.characterId.length + 1).split('@')[0]; return b === 'e' || b === 'e_hold' || b === 'q'; });
              if (isTriggerParty && hasSkillOrBurst) {
                if (nCount >= 2) s *= 0.994 ** (nCount - 1);
              } else {
                s *= 0.994 ** nCount;
              }
            }
          }
          if (acts.length > 0) {
            const lastBase = acts[acts.length - 1].actionTypeId.slice(st.characterId.length + 1).split('@')[0];
            if (lastBase === 'dash' || lastBase === 'jump') s *= 0.995;
          }
          if (loopIdx > 0 && si < loopIdx && acts.length === 1 && acts[0].actionTypeId.slice(st.characterId.length + 1).split('@')[0] === 'n') {
            s *= 0.990;
          }
          if (si >= loopIdx) {
            const cnt = (loopCounts.get(st.characterId) ?? 0) + 1;
            loopCounts.set(st.characterId, cnt);
            if (cnt >= 3) s *= 0.985;
          }
        }
      }
      return s;
    };
    const runOne = async (sc: ScoredCandidate, runs: number, parallel: number, seconds: number, final: boolean): Promise<QuickRun> => {
      const dps = args.dps;
      const cfg = buildCfgFor(sc, seconds, final);
      if (!cfg.runnable) return { sc, error: cfg.warnings.find(w => w.level === 'error')?.message ?? 'NOT_RUNNABLE' };
      try {
        const out = await computeDps({ config: cfg, runs, parallel, run: runGcsimSample, context: dps ? {} : { battleSeconds: seconds }, ...(dps ? { loops: dps.loops } : {}), shouldCancel: cancelled });
        if (out.status === 'cancelled') return { sc, error: 'CANCELLED' };
        if (out.status !== 'ok') return { sc, error: out.message || out.status };
        return { sc, dps: out.result.dps.mean, sd: out.result.dps.sd, ...(out.result.truncated ? { truncated: out.result.truncated } : {}), share: Object.fromEntries(characters.map((c, i) => [c.id, out.result.byChar[i]?.share ?? 0])), particles: { total: out.result.particles.total, enemy: out.result.particles.enemy, energy: out.result.particles.energy, seconds: out.result.seconds, energyPerMember10s: out.result.seconds > 0 ? (out.result.particles.energy / Math.max(1, characters.length) / out.result.seconds) * 10 : 0, energyByChar10s: characters.map((c, i) => ({ characterId: c.id, energy10s: out.result.seconds > 0 ? ((out.result.particles.energyByChar[i] ?? 0) / out.result.seconds) * 10 : 0 })) }, energyWaits: characters.map((c, i) => ({ characterId: c.id, waits: out.result.byChar[i]?.energyWaits ?? 0, seconds: out.result.byChar[i]?.energyWaitSeconds ?? null })) };
      } catch (e) {
        return { sc, error: e instanceof Error ? e.message : String(e) };
      }
    };
    // wanted: 成功がこの数に届くまで、後ろの候補で補う（gcsim が実行できない候補が混じるので、その分を減らさない）。items の最後まで試したら終わる
    const mapLimit = async (items: ScoredCandidate[], runs: number, phase: SearchPhase, wanted = items.length, seconds = settings.battleSeconds, prog?: { base: number; total: number; fixed?: number; sub?: boolean }): Promise<QuickRun[]> => {
      const parallel = Math.max(1, Math.min(runs, args.cores));
      const concurrent = Math.max(1, Math.floor(args.cores / parallel));
      const out: QuickRun[] = [];
      let next = 0;
      let done = 0;
      let okCount = 0;
      // 進捗は、prog があれば、全体（base + この回の分 / total）で出す（山登りは、70 個ずつの回を繰り返すので、回ごとの「n / 70」ではなく、全体の予算で出す）
      const report = (d: number) => args.onProgress?.(prog ? { phase, done: Math.min(prog.total, prog.base + (prog.fixed ?? d)), total: prog.total, ...(prog.sub ? { subDone: d, subTotal: wanted } : {}) } : { phase, done: d, total: wanted });
      report(0);
      await Promise.all(Array.from({ length: concurrent }, async () => {
        while (next < items.length && okCount < wanted && !cancelled()) {
          const i = next++;
          const r = await runOne(items[i], runs, parallel, seconds, phase === 'verify');
          out.push(r);
          if (r.dps !== undefined) { okCount++; done = okCount; }
          report(done);
        }
      }));
      return out;
    };

    // ④ 少ない回数（簡易スコアの順に、成功が keep1 個になるまで。補う上限は keep1 の 3 倍）
    // 探索中の戦闘時間は短め（最大 60 秒）にして速くする。最後の確認（⑤）だけ、指定の戦闘時間で行う
    const exploreSeconds = Math.min(settings.battleSeconds, EXPLORE_SECONDS);
    // 出発点は、アタッカーの割り当てごとに均等に取る（簡易スコアの上位だけだと、1 つの割り当てに偏り、別の割り当てに良い形があっても届かない）
    const groupOf = (sc: ScoredCandidate): string => Object.entries(sc.candidate.assignment).filter(([, r]) => r === 'attacker').map(([id]) => id).sort().join('+');
    const byGroup = new Map<string, ScoredCandidate[]>();
    for (const sc of ev.scored) { const k = groupOf(sc); const l = byGroup.get(k); if (l) l.push(sc); else byGroup.set(k, [sc]); }
    // キャラごとの「使い方」（E の種類と回数・最初の通常攻撃だけの出場があるか）。出発点を、どの使い方も一度は含むように選ぶ
    const optionsOf = (sc: ScoredCandidate): Map<string, string> => {
      const per = new Map<string, Map<string, number>>();
      for (const s of sc.candidate.stints) for (const x of s.actions) {
        const step = x.actionTypeId.slice(s.characterId.length + 1);
        if (step === 'n') continue;
        const key = step === 'ca' ? 'ca' : step;
        const m = per.get(s.characterId) ?? new Map<string, number>(); per.set(s.characterId, m); m.set(key, step === 'ca' ? 1 : (m.get(key) ?? 0) + 1);
      }
      const out = new Map<string, string>();
      for (const c of characters) out.set(c.id, [...(per.get(c.id) ?? new Map()).entries()].sort().map(([k, n]) => k + n).join(',') || '-');
      // 同じキャラが、間に別のキャラを挟んで 2 回出る形（先置き型。スキル・爆発の出場と、攻撃の出場に分ける）は、簡易スコアが低く（アタッカーの表の時間が短い）、上位に入らない。別の使い方として数え、出発点に入れる
      const ids = sc.candidate.stints.map(x => x.characterId);
      ids.forEach((id, i) => { if (ids.indexOf(id) < i && ids[i - 1] !== id && ids.slice(ids.indexOf(id), i).some(x => x !== id)) out.set(id, out.get(id) + '|S'); });
      const first = sc.candidate.stints[0];
      if (first && first.actions.every(x => x.actionTypeId.endsWith('_n'))) out.set(first.characterId, out.get(first.characterId) + '|N>');
      if ((sc.candidate.loopStartIndex ?? 0) > 0) for (const [k, v] of out) out.set(k, v + '|L');
      return out;
    };
    const optsCache = new Map<ScoredCandidate, Map<string, string>>();
    const opts = (sc: ScoredCandidate) => { let o = optsCache.get(sc); if (!o) { o = optionsOf(sc); optsCache.set(sc, o); } return o; };
    for (const [k, l] of byGroup) {
      // 貪欲な被覆: まだ出ていない（キャラ, 使い方）をいちばん多く含む候補（同数なら簡易スコアの高い方）を、順に選ぶ
      const covered = new Set<string>();
      const left = [...l];
      const first: ScoredCandidate[] = [];
      while (left.length > 0 && first.length < 40) {
        let bi = -1, bn = 0;
        for (let i = 0; i < left.length; i++) {
          let n = 0; for (const [cid, o] of opts(left[i])) if (!covered.has(cid + '#' + o)) n++;
          if (n > bn) { bn = n; bi = i; }
        }
        if (bi < 0) break;
        const [pick] = left.splice(bi, 1);
        for (const [cid, o] of opts(pick)) covered.add(cid + '#' + o);
        first.push(pick);
      }
      byGroup.set(k, [...first, ...left]);
    }
    const seedPool: ScoredCandidate[] = [];
    for (let i = 0; seedPool.length < ev.scored.length; i++) {
      let any = false;
      for (const l of byGroup.values()) if (i < l.length) { seedPool.push(l[i]); any = true; }
      if (!any) break;
    }
    // 追加の出発点・知識シードは seedCands の生成順を保ったまま先頭枠に配置し、残りは総当たり候補と交互に混ぜる
    const scoredByLabel = new Map(ev.scored.map(sc => [sc.candidate.label, sc]));
    const seedOrdered: ScoredCandidate[] = [];
    for (const sc0 of seedCands) {
      const sc = scoredByLabel.get(sc0.label);
      if (sc) seedOrdered.push(sc);
    }
    const keep1Eff = Math.max(1, settings.keep1);
    const seedCap = Math.floor(keep1Eff * 0.65);
    const seedHead = seedOrdered.slice(0, seedCap);
    const seedHeadSet = new Set(seedHead);
    const restPool = seedPool.filter(sc => !seedHeadSet.has(sc));
    const seedTail = seedOrdered.slice(seedCap);
    const mixedTail: ScoredCandidate[] = [];
    const maxTailLen = Math.max(restPool.length, seedTail.length);
    for (let i = 0; i < maxTailLen; i++) {
      if (i < restPool.length) mixedTail.push(restPool[i]);
      if (i < seedTail.length) mixedTail.push(seedTail[i]);
    }
    const poolDedup = [...new Set([...seedHead, ...mixedTail])];
    // 知識辞書の出発点があるときは、総当たりの出発点を減らす（辞書の出発点が、全部そろった形を持つので、広く浅く測る量を減らせる）
    // 辞書の出発点のうち、編成の全員が出場する形だけを数える（一部の人しか辞書にないと、出発点が偏って、予算を絞ると探索が悪化する。胡桃・夜蘭・行秋・鍾離で 36.5k → 13.7k）
    const dictSeeds = args.knowledge ? seedOrdered.filter(sc => !(args.extraSeeds ?? []).some(x => describe(characters, x.stints, x.loopStartIndex) === sc.candidate.label) && characters.every(c => sc.candidate.stints.some(st => st.characterId === c.id))).length : 0;
    const r1 = await mapLimit(poolDedup.slice(0, keep1Eff * 3), settings.runs1, 'quick', keep1Eff, exploreSeconds);
    if (cancelled()) return { status: 'cancelled' };
    const ok1 = r1.filter(r => r.dps !== undefined);
    const quickFailed: Record<string, number> = {};
    for (const r of r1) if (r.dps === undefined) quickFailed[r.error ?? '?'] = (quickFailed[r.error ?? '?'] ?? 0) + 1;
    if (ok1.length === 0) return { status: 'error', message: Object.keys(quickFailed)[0] ?? 'ALL_FAILED' };

    // ④a 組み合わせ: 組ごとに、キャラごとの使い方の平均 DPS が一番高いものを選び、それを全部そろえた候補（まだ試していないもの）を、追加の出発点として測る。
    //   全部そろって初めて効く形（ニィロウの E×4 + ラウマの長押し + コロンビーナの最初の通常攻撃…）を、1 手ずつの山登りに頼らず拾う
    {
      const triedX = new Set<string>(r1.map(r => r.sc.candidate.label));
      const extra: ScoredCandidate[] = [];
      for (const [g, list] of byGroup) {
        const runs = r1.filter(r => r.dps !== undefined && groupOf(r.sc) === g);
        if (runs.length < 3) continue;
        const best = new Map<string, string[]>();
        for (const c of characters) {
          const agg = new Map<string, { sum: number; n: number }>();
          for (const r of runs) { const o = opts(r.sc).get(c.id)!; const a2 = agg.get(o) ?? { sum: 0, n: 0 }; a2.sum += r.dps!; a2.n++; agg.set(o, a2); }
          best.set(c.id, [...agg.entries()].sort((x, y) => y[1].sum / y[1].n - x[1].sum / x[1].n).slice(0, 2).map(([o]) => o));
        }
        const want = (sc: ScoredCandidate): number => { let s = 0; for (const c of characters) { const i = best.get(c.id)!.indexOf(opts(sc).get(c.id)!); s += i < 0 ? 100 : i; } return s; };
        const found = list.filter(sc => !triedX.has(sc.candidate.label) && want(sc) < 100).sort((x, y) => want(x) - want(y) || y.score - x.score).slice(0, CROSS_PER_GROUP);
        extra.push(...found);
      }
      if (extra.length > 0 && !cancelled()) {
        const rx = await mapLimit(extra, settings.runs1, 'quick', extra.length, exploreSeconds);
        r1.push(...rx);
      }
    }

    // ④b 山登り: アタッカーの割り当てごとに別々に、その中で gcsim の結果が一番良い候補から、1 か所だけ変えた候補（出場の入れ替え・分割・結合・移動、動作の消去・移動・差し込み）を
    //   全部試し、良くなったらそこへ移る。割り当て同士を比べて早く切ることはしない（出発点が低くても、登った先が一番高いことがある。例: 手で組んだ形は、出発点では 6 割だった）。
    //   その割り当ての中で、良くならない回が 2 回続いたら、その割り当てはそこで終わり
    // 割り当てが多いと、1 つあたりの山登りが薄くなる（月開花: 5〜7 通り）。3 通りを超えた分、予算を増やす（上限 2 倍）
    // 辞書の出発点があるときは、1 次の最良が全体の最良の DICT_GROUP_RATIO 未満の割り当ては、山登りしない（明らかに低い割り当てに、予算を使わない）
    const bestOfGroup = (g: string): number => Math.max(0, ...r1.filter(r => r.dps !== undefined && groupOf(r.sc) === g).map(r => rankScoreOf(r, false)));
    const bestAll = Math.max(0, ...[...byGroup.keys()].map(bestOfGroup));
    const climbGroups = [...byGroup.keys()].filter(g => dictSeeds === 0 || args.seedsOnly || bestOfGroup(g) >= bestAll * DICT_GROUP_RATIO);
    const budget = Math.round((settings.refineBudget ?? DEFAULT_REFINE_BUDGET) * Math.min(2, Math.max(1, climbGroups.length / 3)));
    if (budget > 0 && !cancelled()) {
      const tried = new Set<string>(r1.map(r => r.sc.candidate.label));
      let used = 0;
      args.onProgress?.({ phase: 'refine', done: 0, total: budget });
      const stale = new Map<string, number>();
      const bestIn = (g: string): QuickRun | undefined => r1.filter(r => r.dps !== undefined && groupOf(r.sc) === g).sort((x, y) => rankScoreOf(y, false) - rankScoreOf(x, false))[0];
      const groups = climbGroups.filter(g => bestIn(g));
      // ビーム: 最良だけでなく、最良の 92% 以上の上位 BEAM 個のうち、まだ広げていないものを順に広げる（少し下がってから大きく上がる形に届くように。例: 周回の開始位置を変えてから、別のキャラの爆発を足すと、はじめて 1.2 倍になる）
      const beamWidth = Math.max(1, settings.beamWidth ?? BEAM);
      const refineBatch = Math.max(1, settings.refineBatch ?? REFINE_BATCH);
      const expanded = new Set<string>();
      const nextStart = (g: string): QuickRun | undefined => {
        const all = r1.filter(r => r.dps !== undefined && groupOf(r.sc) === g).sort((x, y) => rankScoreOf(y, false) - rankScoreOf(x, false));
        if (all.length === 0) return undefined;
        const topScore = rankScoreOf(all[0], false);
        return all.slice(0, beamWidth).find(r => rankScoreOf(r, false) >= topScore * BEAM_RATIO && !expanded.has(r.sc.candidate.label));
      };
      for (let round = 0; round < 24 && used < budget && !cancelled(); round++) {
        let progressed = false;
        for (const g of groups) {
          if ((stale.get(g) ?? 0) >= STALE_LIMIT || used >= budget || cancelled()) continue;
          const start = nextStart(g);
          if (!start) { stale.set(g, 99); continue; }
          expanded.add(start.sc.candidate.label);
          const pool = new Map<string, Candidate>();
          // ダメージの割合が小さいキャラ（アタッカー以外。全体の 6% 未満）は、動作を削る近傍を先に測る
          const lowShare = start.share ? characters.filter(c => groupOf(start.sc).split('+').indexOf(c.id) < 0 && (start.share![c.id] ?? 1) < LOW_SHARE).map(c => c.id) : [];
          for (const n of neighborsOf(characters, start.sc.candidate, { lowShare, knowledge: args.knowledge })) if (!tried.has(n.label)) pool.set(n.label, n);
          if (pool.size === 0) { stale.set(g, 99); continue; }
          const ev2 = evaluateCandidates(characters, [...pool.values()], { switchDelay: args.switchDelay, defHalt: args.defHalt, maxCtIssues: TOLERATED_CT_ISSUES });
          for (const c of pool.keys()) tried.add(c);
          // 近傍は操作の種類（入れ替え・移動・分割・消去・差し込みなど）ごとに簡易スコア順に並べ、種類を順に回って均等に取る（簡易スコアは当てにならないので、上位だけだと、ある種類の近傍が全く測られない）
          const limit = Math.min(refineBatch, budget - used);
          const byOp = new Map<string, ScoredCandidate[]>();
          for (const sc of ev2.scored) { const k = sc.candidate.op ?? '?'; const l = byOp.get(k); if (l) l.push(sc); else byOp.set(k, [sc]); }
          const batch: ScoredCandidate[] = [];
          // ダメージの割合が小さいキャラを狙った近傍を、先に最大 FOCUS_MAX 個入れる
          for (const sc of ev2.scored) if (sc.candidate.focus && batch.length < Math.min(FOCUS_MAX, limit)) { batch.push(sc); byOp.get(sc.candidate.op ?? '?')?.splice(byOp.get(sc.candidate.op ?? '?')!.indexOf(sc), 1); }
          for (let i = 0; batch.length < limit; i++) {
            let any = false;
            for (const l of byOp.values()) if (i < l.length && batch.length < limit) { batch.push(l[i]); any = true; }
            if (!any) break;
          }
          if (batch.length === 0) { stale.set(g, 99); continue; }
          progressed = true;
          const before = rankScoreOf(bestIn(g)!, false);
          const startRank = rankScoreOf(start, false);
          // 先に 1 回だけ回して、明らかに悪い候補（その割り当ての最良の 85% 未満）を落とし、残りだけ決めた回数で測り直す（1 回の値は、ばらつきが大きいので、落とす基準は緩め）
          const first = await mapLimit(batch, 1, 'refine', batch.length, exploreSeconds, { base: used, total: budget });
          const keepSc = first.filter(r => r.dps !== undefined && rankScoreOf(r, false) >= startRank * REFINE_PREFILTER).map(r => r.sc);
          const rr = settings.runs1 <= 1 ? first : await mapLimit(keepSc, settings.runs1, 'refine', keepSc.length, exploreSeconds, { base: used, total: budget, fixed: batch.length, sub: true });
          used += batch.length;
          args.onProgress?.({ phase: 'refine', done: Math.min(used, budget), total: budget });
          r1.push(...rr);
          const afterBest = bestIn(g);
          stale.set(g, (afterBest ? rankScoreOf(afterBest, false) : 0) > before * 1.003 ? 0 : (stale.get(g) ?? 0) + 1);
        }
        if (!progressed) break;
      }
    }
    if (cancelled()) return { status: 'cancelled' };
    const okAll = r1.filter(r => r.dps !== undefined);
    // 診断用: アタッカーの割り当てごとの、探索中（短い戦闘時間）の最良
    const groupBestMap = new Map<string, { key: string; dps: number; label: string }>();
    for (const r of okAll) { const k = groupOf(r.sc); const cur = groupBestMap.get(k); if (!cur || r.dps! > cur.dps) groupBestMap.set(k, { key: k, dps: r.dps!, label: r.sc.candidate.label }); }

    let spearman: number | undefined;
    let bestQuickScoreRank: number | undefined;
    if (ok1.length >= 3) {
      const a = ranksOf(ok1.map(r => r.sc.score));
      const b = ranksOf(ok1.map(r => r.dps!));
      const n = ok1.length;
      const d2 = a.reduce((s, x, i) => s + (x - b[i]) ** 2, 0);
      spearman = 1 - (6 * d2) / (n * (n * n - 1));
      const best = ok1.reduce((x, y) => (y.dps! > x.dps! ? y : x));
      bestQuickScoreRank = ev.scored.indexOf(best.sc) + 1;
    }

    // ⑤ 多い回数（山登りで見つけたものも含める。上位は偶然に良かったものも混じるので、多めの回数で確かめ直す）
    // 出場の分け方だけが違う（同じキャラの隣り合う出場を 1 つにすると同じ並びになる）候補や、
    // 同じ位置の硬直キャンセルがダッシュ（_dash）か落下攻撃に繋がらないジャンプ（_jump）かだけ違う候補、
    // あるいはモード中の再押し（フィッシュルのオズ配置直し等）で実際に gcsim に渡る命令（gcsimCommand）が同じ候補は、1 つにまとめる（上位が実質同じ回転の微差で埋まるのを避ける）
    const mergedKey = (sc: ScoredCandidate): string => {
      const calc = calculateRotation(characters, sc.candidate.stints, { switchDelay: args.switchDelay, loopStartIndex: sc.candidate.loopStartIndex ?? 0, defHalt: args.defHalt });
      const parts: string[] = [];
      let prev: string | undefined;
      for (const s of calc.calculatedStints) {
        const realActs = s.actions.filter(a => a.type !== 'swap' && a.actionTypeId !== 'action_switch_char');
        const acts = realActs.map((x, idx) => {
          const nextType = realActs[idx + 1]?.type;
          const normId = x.type === 'jump' && nextType !== 'plunge_low' && nextType !== 'plunge_high'
            ? `${s.characterId}_dash`
            : x.gcsimCommand || x.actionTypeId === '10000031-electro_e_recast'
              ? `${s.characterId}_cmd:${x.gcsimCommand ?? 'skill[recast=1]'}`
              : x.actionTypeId;
          return normId + (x.durationManual && HOLD_FRAMES_ACTIONS.has(x.actionTypeId) ? `@${x.duration}` : '');
        }).join(',');
        if (prev === s.characterId) parts[parts.length - 1] += ',' + acts; else parts.push(s.characterId + ':' + acts);
        prev = s.characterId;
      }
      return parts.join('|') + '@' + (sc.candidate.loopStartIndex ?? 0);
    };
    const seenKeys = new Set<string>();
    // 安全網: gcsim に渡るスクリプトが同じ候補（アプリの計算上の長さだけが違うもの。options duration= の推定余裕時間の差は除く）は、DPS の高い方（先に来る方）の 1 件にまとめる
    const seenScripts = new Set<string>();
    const scriptKey = (sc: ScoredCandidate): string | undefined => {
      try {
        const cfg = buildCfgFor(sc, settings.battleSeconds, true);
        return cfg.runnable ? cfg.config.replace(/^(options\b[^\n;]*?\bduration=)\d+/m, '$1*') : undefined;
      } catch { return undefined; }
    };
    let stage2 = [...okAll].sort((x, y) => rankScoreOf(y, false) - rankScoreOf(x, false)).filter(r => {
      const k = mergedKey(r.sc);
      if (seenKeys.has(k)) return false;
      seenKeys.add(k);
      const sk = scriptKey(r.sc);
      if (sk !== undefined) { if (seenScripts.has(sk)) return false; seenScripts.add(sk); }
      return true;
    }).slice(0, Math.max(1, settings.keep2)).map(r => ({ ...r.sc, candidate: mergeAdjacentStints(characters, r.sc.candidate) }));
    // 「いまのローテーション」（最初の出発点）は、上位に入らなくても、順位に載せて比べられるようにする
    const ownRun = args.keepFirstSeed ? okAll.find(r => r.sc.candidate.id === 'seed0') : undefined;
    const ownKey = ownRun ? mergedKey(ownRun.sc) : undefined;
    if (ownRun && !stage2.some(x => mergedKey(x) === ownKey)) stage2 = [...stage2, { ...ownRun.sc, candidate: mergeAdjacentStints(characters, ownRun.sc.candidate) }];
    // 最終検証前のクリーンアップパス（オッカムの剃刀）: 上位 8 件からゴミ手（末尾 dash/jump、サポーター不要 N、先頭単独 N）を削った版を検証に追加
    {
      const cleanCands: Candidate[] = [];
      const actBase = (cid: string, actId: string) => actId.slice(cid.length + 1).split('@')[0];
      const pushClean = (base: Candidate, stints: Stint[], loopIdx: number) => {
        if (stints.length === 0 || stints.some(s => s.actions.length === 0)) return;
        const fixed = mergeAdjacentStints(characters, { ...base, id: 'clean', stints, loopStartIndex: Math.min(loopIdx, stints.length - 1) });
        fixed.label = describe(characters, fixed.stints, fixed.loopStartIndex);
        cleanCands.push(fixed);
      };
      for (const sc of stage2.slice(0, 8)) {
        const base = sc.candidate;
        const loop0 = base.loopStartIndex ?? 0;
        const stripTailDash = (s: Stint): Stint => {
          const acts = [...s.actions];
          while (acts.length > 1) {
            const b = actBase(s.characterId, acts[acts.length - 1].actionTypeId);
            if (b === 'dash' || b === 'jump') acts.pop(); else break;
          }
          return { ...s, actions: acts };
        };
        // 1. Stint 末尾の dash/jump を 1 箇所ずつ / 全部削る
        base.stints.forEach((s, si) => {
          const ns = stripTailDash(s);
          if (ns.actions.length !== s.actions.length) {
            pushClean(base, base.stints.map((x, idx) => (idx === si ? ns : x)), loop0);
          }
        });
        const allDashStripped = base.stints.map(stripTailDash);
        if (allDashStripped.some((s, i) => s.actions.length !== base.stints[i].actions.length)) {
          pushClean(base, allDashStripped, loop0);
        }
        // 2. 非アタッカーかつ !canSupporterUseNormal の Stint から n を削る（1 キャラずつ / 全員分）
        const stripN = (s: Stint): Stint => {
          const ch = charById.get(s.characterId);
          if (base.assignment[s.characterId] === 'attacker' || !ch || canSupporterUseFreeNormal(ch)) return s;
          const acts = s.actions.filter(a => actBase(s.characterId, a.actionTypeId) !== 'n');
          return acts.length > 0 ? { ...s, actions: acts } : s;
        };
        const supIds = new Set(base.stints.map(s => s.characterId).filter(id => base.assignment[id] !== 'attacker'));
        for (const cid of supIds) {
          const ns = base.stints.map(s => (s.characterId === cid ? stripN(s) : s));
          if (ns.some((s, i) => s.actions.length !== base.stints[i].actions.length)) pushClean(base, ns, loop0);
        }
        const allNStripped = base.stints.map(stripN);
        if (allNStripped.some((s, i) => s.actions.length !== base.stints[i].actions.length)) {
          pushClean(base, allNStripped, loop0);
        }
        // 3. loopStartIndex === 1 で先頭 Stint が n 1 手のみの場合に先頭を削除
        if (loop0 === 1 && base.stints.length > 1) {
          const first = base.stints[0];
          const real0 = first.actions.filter(a => a.type !== 'swap' && a.actionTypeId !== 'action_switch_char' && a.type !== 'wait');
          if (real0.length === 1 && actBase(first.characterId, real0[0].actionTypeId) === 'n') {
            pushClean(base, base.stints.slice(1), 0);
          }
        }
      }
      if (cleanCands.length > 0) {
        const evClean = evaluateCandidates(characters, cleanCands, { switchDelay: args.switchDelay, defHalt: args.defHalt, maxCtIssues: TOLERATED_CT_ISSUES });
        const stageKeys = new Set(stage2.map(mergedKey));
        const stageScripts = new Set(stage2.map(scriptKey).filter((x): x is string => x !== undefined));
        for (const sc of evClean.scored) {
          const k = mergedKey(sc);
          if (stageKeys.has(k)) continue;
          const sk = scriptKey(sc);
          if (sk !== undefined && stageScripts.has(sk)) continue;
          stageKeys.add(k);
          if (sk !== undefined) stageScripts.add(sk);
          stage2.push(sc);
        }
      }
    }
    const r2 = (await mapLimit(stage2, settings.runs2, 'verify')).filter(r => r.dps !== undefined);
    if (cancelled()) return { status: 'cancelled' };
    if (r2.length === 0) return { status: 'error', message: 'ALL_FAILED' };
    const results: SearchResultItem[] = r2
      .sort((x, y) => rankScoreOf(y, true) - rankScoreOf(x, true))
      .map(r => ({ candidate: r.sc.candidate, dps: r.dps!, sd: r.sd!, totalSeconds: r.sc.totalSeconds, score: r.sc.score, ...(r.particles ? { particles: r.particles } : {}), ...(r.energyWaits && args.dps?.energy ? { energyWaits: r.energyWaits, loops: args.dps.loops } : {}), ...(r.truncated ? { truncated: r.truncated } : {}), ...(r.sc.ctIssues > 0 ? { ctIssues: r.sc.ctIssues } : {}), ...(ownKey !== undefined && mergedKey(r.sc) === ownKey ? { isCurrent: true } : {}) }));
    return {
      status: 'ok', results, elapsedMs: Date.now() - t0, spearman, bestQuickScoreRank, groupBest: [...groupBestMap.values()],
      counts: { candidates: candidates.length, rejected: ev.rejected, rejectedBy: ev.rejectedBy, scored: ev.scored.length, quick: r1.length, quickOk: okAll.length, quickFailed },
    };
  } catch (e) {
    return { status: 'error', message: e instanceof Error ? e.message : String(e) };
  }
}

/** 候補の出場を、アプリの出場（Stint）として置けるよう、ID をつけ直す（保存データの ID と重ならないように） */
export function stintsForApp(stints: Stint[]): Stint[] {
  const stamp = Date.now().toString(36);
  let n = 0;
  return stints.map(s => ({ ...s, id: `stint_auto_${stamp}_${n++}`, actions: s.actions.map(a => ({ ...a, id: `act_auto_${stamp}_${n++}` })) }));
}
