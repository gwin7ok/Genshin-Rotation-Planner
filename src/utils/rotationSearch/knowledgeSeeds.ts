/**
 * 知識辞書から、探索の出発点を組む（設計: 辞書設計.md の「探索での使い方」）。
 * 辞書にあるキャラの運用型（Archetype）の組み合わせを作り、出場の順番（slot）で並べ、アタッカーの攻撃の出場を最後に置く。
 * 総当たりでは、全部そろった形（ニィロウ E×4 + ラウマの長押し + コロンビーナの先置きと重撃…）に届かないので、そろえた形で出発点にする。
 */
import type { CharacterConfig, Stint } from '../../types/genshin';
import type { Archetype, KnowledgeBundle } from '../../masterdata/knowledge/types';
import { stintOf, type SearchRole } from './candidates';
import { defaultConstellation } from '../../models/CharacterModel';

export interface KnowledgeSeed {
  stints: Stint[];
  loopStartIndex: number;
  assignment: Record<string, SearchRole>;
}

/** 出発点の既定の上限（画面の設定「1 段目で残す候補の数」を渡す。組み合わせを交互に並べて、この数に切る） */
const DEFAULT_MAX_SEEDS = 300;

function product<T>(lists: T[][]): T[][] {
  return lists.reduce<T[][]>((acc, list) => acc.flatMap(a => list.map(x => [...a, x])), [[]]);
}

function permutations<T>(xs: T[]): T[][] {
  if (xs.length <= 1) return [xs.slice()];
  return xs.flatMap((x, i) => permutations([...xs.slice(0, i), ...xs.slice(i + 1)]).map(r => [x, ...r]));
}

/** 西風シリーズの武器 ID（西風剣・西風大剣・西風長槍・西風秘典・西風猟弓） */
export const FAVONIUS_WEAPON_IDS = new Set(['11401', '12401', '13407', '14401', '15401']);
export const isFavoniusWeapon = (weaponId?: string): boolean => !!weaponId && FAVONIUS_WEAPON_IDS.has(weaponId);

/** スキル・爆発で無凸から自身の通常攻撃に元素付与・元素変化・元素追撃が発生するサポーター／サブアタッカー */
export const SELF_ELEMENT_NORMAL_IDS = new Set([
  '10000024-electro', // 北斗
  '10000025-hydro',   // 行秋
  '10000036-cryo',    // 重雲
  '10000050-pyro',    // トーマ
  '10000052-electro', // 雷電将軍
  '10000060-hydro',   // 夜蘭
  '10000070-hydro',   // ニィロウ
  '10000072-hydro',   // キャンディス
  '10000094-geo',     // 千織
  '10000103-geo',     // シロネン
]);

/** 味方（表のキャラ）の通常攻撃に連動して裏から元素追撃を発動するキャラ（行秋・夜蘭・北斗・トーマ・6凸フィッシュル・1凸キャンディス） */
export const PARTY_NORMAL_TRIGGER_IDS = new Set([
  '10000024-electro', // 北斗（雷斫り）
  '10000025-hydro',   // 行秋（裁雨留虹）
  '10000050-pyro',    // トーマ（真紅熾炎の大鎧）
  '10000060-hydro',   // 夜蘭（玲瓏一擲）
]);

/** 編成内に、表のキャラの通常攻撃に連動して元素追撃を発動するキャラがいるか */
export function partyHasNormalAttackTrigger(party?: CharacterConfig[]): boolean {
  if (!party) return false;
  return party.some(p => {
    if (PARTY_NORMAL_TRIGGER_IDS.has(p.id)) return true;
    const cons = p.constellation ?? defaultConstellation(p.rarity);
    if (p.id === '10000031-electro' && cons >= 6) return true; // 6凸フィッシュル
    if (p.id === '10000072-hydro' && cons >= 1) return true;   // キャンディス爆発の通常連動追撃
    return false;
  });
}

/** 6 凸（完凸）効果でスキル・爆発後に自身の通常攻撃に元素付与を得るサポーター／サブアタッカー */
export const C6_INFUSION_IDS = new Set([
  '10000005-pyro',    // 空(炎)
  '10000007-pyro',    // 蛍(炎)
  '10000032-pyro',    // ベネット
  '10000047-anemo',   // 楓原万葉
  '10000068-electro', // ドリー
  '10000083-anemo',   // リネット
  '10000089-hydro',   // フリーナ
  '10000099-dendro',  // エミリエ
]);

/** スキル後の通常攻撃が固有ギミックとして必須なサポーター */
export const SUPPORTER_GIMMICK_NORMAL_IDS = new Set([
  '10000103-geo',   // シロネン
  '10000070-hydro', // ニィロウ
]);

/** サポーターの通常攻撃挿入を許可する自由通常判定（西風武器・固有ギミック必須キャラのみ） */
export function canSupporterUseFreeNormal(c: CharacterConfig): boolean {
  if (isFavoniusWeapon(c.weaponId)) return true;
  if (SUPPORTER_GIMMICK_NORMAL_IDS.has(c.id)) return true;
  return false;
}

/** 編成内に通常連動追撃キャラがいるか（追撃トリガー用1手Nの許可判定） */
export function canSupporterUseTriggerNormal(party?: CharacterConfig[]): boolean {
  return partyHasNormalAttackTrigger(party);
}

/** サポーターの通常攻撃挿入を許可する判定（自由通常または追撃トリガー） */
export function canSupporterUseNormal(c: CharacterConfig, party?: CharacterConfig[]): boolean {
  return canSupporterUseFreeNormal(c) || canSupporterUseTriggerNormal(party);
}

/** 西風粒子、または通常攻撃による元素攻撃・元素付与・追撃が有効な状態か */
export function canUseFavoniusOrElementNormal(c: CharacterConfig, party?: CharacterConfig[]): boolean {
  if (isFavoniusWeapon(c.weaponId)) return true;
  if (c.weaponType === 'catalyst') return true;
  if (SELF_ELEMENT_NORMAL_IDS.has(c.id)) return true;
  const cons = c.constellation ?? defaultConstellation(c.rarity);
  if (cons >= 6 && C6_INFUSION_IDS.has(c.id)) return true;
  const isMelee = c.weaponType === 'sword' || c.weaponType === 'claymore' || c.weaponType === 'polearm';
  if (isMelee && party) {
    // 編成内に、味方の近接通常攻撃へ元素付与を配るキャラ（重雲・キャンディス・6凸ベネット）がいるとき
    if (party.some(p => p.id === '10000036-cryo' || p.id === '10000072-hydro' || (p.id === '10000032-pyro' && (p.constellation ?? defaultConstellation(p.rarity)) >= 6))) {
      return true;
    }
  }
  return false;
}

export function applicableArchetypes(c: CharacterConfig, bundle: KnowledgeBundle, partyIds: Set<string>, party?: CharacterConfig[]): Archetype[] {
  const cons = c.constellation ?? defaultConstellation(c.rarity);
  const allowFavOrElemN = canUseFavoniusOrElementNormal(c, party);
  const list = (bundle[c.id]?.archetypes ?? []).filter(
    a => (a.withCharacters ?? []).every(id => partyIds.has(id))
      && cons >= (a.constellation?.min ?? 0) && cons <= (a.constellation?.max ?? 6)
      && (!a.requiresFavonius || allowFavOrElemN),
  );
  // 他に専任アタッカー（roles が attacker のみ）が編成にいる場合、兼任キャラの attacker 型は後回しにする
  const hasDedicatedAttacker = party?.some(p => p.id !== c.id && p.roles?.length === 1 && p.roles[0] === 'attacker');
  const isHybrid = (c.roles?.length ?? 0) > 1 && c.roles?.some(r => r !== 'attacker');
  if (hasDedicatedAttacker && isHybrid) {
    return [...list.filter(a => a.role !== 'attacker'), ...list.filter(a => a.role === 'attacker')];
  }
  return list;
}

export function knowledgeSeeds(characters: CharacterConfig[], bundle: KnowledgeBundle, maxSeeds: number = DEFAULT_MAX_SEEDS): KnowledgeSeed[] {
  const ids = new Set(characters.map(c => c.id));
  // 編成の条件を満たす運用型が 1 つもないキャラは、出発点に入れない（辞書にないキャラも同じ）
  // 凸数の条件（constellation）も見る。凸数は、編成の設定（未指定は、星 4 = 6 凸・星 5 = 0 凸）
  const applicable = (c: CharacterConfig) => applicableArchetypes(c, bundle, ids, characters);
  const members = characters.filter(c => applicable(c).length > 0);
  if (members.length === 0) return [];
  const options = members.map(applicable);
  const perCombo = combosOf(options, maxSeeds).map(combo => variantsOf(characters, members, combo as Archetype[]));
  // 組み合わせごとの形（並べ方・繰り返し・先頭の違い）を、組み合わせを交互にして並べる（探索の 1 次の枠は、先頭の一部だけ。全部の組み合わせの代表が、先に入るようにする）
  const out = new Map<string, KnowledgeSeed>();
  for (let round = 0; out.size < maxSeeds; round++) {
    let any = false;
    for (const variants of perCombo) {
      if (round >= variants.length) continue;
      any = true;
      const v = variants[round];
      if (!out.has(v.key) && out.size < maxSeeds) out.set(v.key, v.seed);
    }
    if (!any) break;
  }
  return [...out.values()];
}

/** KQM Sim Database 由来の形か（evidence の書き出しで見分ける） */
const isKqm = (a: Archetype): boolean => a.evidence.startsWith('KQM');

/**
 * キャラごとの運用型の選び方（組み合わせ）を並べる。
 * 基準は 2 つ: 全員が先頭の形（手作り・測定済みの形が先頭）と、全員が KQM 由来の形（なければ先頭）。先頭の形が外れても、もう一方が出発点に入る。
 * 続けて、それぞれの基準から 1 人だけ別の運用型にした組み合わせを全部（どの運用型も、必ず 1 回は入る）。残りは、全組み合わせから等間隔に取る（上限 maxCombos = 出発点の上限）。
 */
function combosOf(options: Archetype[][], maxCombos: number): Archetype[][] {
  const bases: Archetype[][] = [options.map(o => o[0])];
  const kqmBase = options.map(o => o.find(isKqm) ?? o[0]);
  if (kqmBase.some((a, i) => a !== bases[0][i])) bases.push(kqmBase);
  const list: Archetype[][] = [...bases];
  const seenKey = (c: Archetype[]) => c.map(a => a.name).join('|');
  const seenOfat = new Set(list.map(seenKey));
  for (const base of bases) {
    options.forEach((o, i) => {
      for (let j = 0; j < o.length; j++) {
        if (o[j] === base[i]) continue;
        const c = base.map((a, k) => (k === i ? o[j] : a));
        if (seenOfat.has(seenKey(c))) continue;
        seenOfat.add(seenKey(c));
        list.push(c);
      }
    });
  }
  const total = options.reduce((n, o) => n * o.length, 1);
  const rest = Math.max(0, maxCombos - list.length);
  const seen = new Set(list.map(c => c.map((a, i) => i + ':' + options[i].indexOf(a)).join('|')));
  const all = product(options) as Archetype[][];
  const step = total / Math.max(1, rest);
  for (let x = 0; x < total && list.length < maxCombos; x += Math.max(1, step)) {
    const c = all[Math.floor(x)];
    const k = c.map((a, i) => i + ':' + options[i].indexOf(a)).join('|');
    if (seen.has(k)) continue;
    seen.add(k);
    list.push(c);
  }
  return list;
}

/** 1 つの組み合わせから、出発点（出場の順番・アタッカーの繰り返し・先頭の出場の違い）を作る */
function variantsOf(characters: CharacterConfig[], members: CharacterConfig[], combo: Archetype[]): Array<{ key: string; seed: KnowledgeSeed }> {
  const out = new Map<string, KnowledgeSeed>();
  const picked = members.map((c, i) => ({ c, a: combo[i] }));
  let attackers = picked.filter(p => p.a.role === 'attacker');
  // 全員がサポーター/サブアタッカー（例: フリーナ蒸発）のときは、slot 最大のメンバーを暫定アタッカー扱いしてシードを組む
  if (attackers.length === 0 && picked.length > 0) {
    const lastBySlot = [...picked].sort((x, y) => y.a.slot - x.a.slot)[0];
    attackers = [lastBySlot];
  }
  if (attackers.length === 0) return [];
  // 先置き・サポートの出場: slot の小さい順。同じ slot は、並べ替えを全部試す。
  // 1 人の運用型は、出場を複数持てる（use と、続きの出場 then）。同じキャラで同じ slot の出場は、1 つに結合する
  const setups = picked.flatMap(p => {
    const parts: Array<{ slot: number; use: string[] }> = [];
    for (const part of [{ slot: p.a.slot, use: p.a.use }, ...(p.a.then ?? [])]) {
      if (part.use.length === 0) continue;
      const same = parts.find(x => x.slot === part.slot);
      if (same) same.use = [...same.use, ...part.use]; else parts.push({ slot: part.slot, use: [...part.use] });
    }
    return parts.map(x => ({ c: p.c, a: p.a, slot: x.slot, use: x.use }));
  });
  const slots = [...new Set(setups.map(p => p.slot))].sort((x, y) => x - y);
  const orders = product(slots.map(s => permutations(setups.filter(p => p.slot === s)))).map(groups => groups.flat());
  for (const order of orders) {
    for (const repeats of product(attackers.map(p => ((p.a.fill?.length ?? 0) > 0 ? p.a.fillRepeat ?? [1] : [0])))) {
      for (const leads of product(attackers.map(p => (p.a.lead && p.a.lead.length > 0 ? [true, false] : [false])))) {
        const stints: Stint[] = [];
        let ok = true;
        const push = (c: CharacterConfig, steps: string[]) => {
          const s = stintOf(c, steps, `k${stints.length}`);
          if (!s) ok = false; else stints.push(s);
        };
        attackers.forEach((p, i) => {
          if (!leads[i]) return;
          const onlyNormal = p.a.lead!.every(s => s.split('@')[0] === 'n');
          if (!onlyNormal || canUseFavoniusOrElementNormal(p.c, characters)) push(p.c, p.a.lead!);
        });
        const loopStartIndex = stints.length;
        for (const p of order) push(p.c, p.use);
        attackers.forEach((p, i) => {
          const tailSteps = p.a.tail ?? [];
          if (repeats[i] <= 0) {
            if (tailSteps.length > 0) push(p.c, tailSteps);
            return;
          }
          const fillSteps = Array.from({ length: repeats[i] }, () => p.a.fill!).flat();
          // スキル・爆発を使わない攻撃だけの別出場が、元素攻撃・西風・連動追撃も無い物理の通常攻撃 1 回だけ（例: 香菱[N]）になる形は作らない
          if (fillSteps.length === 1 && fillSteps[0] === 'n' && tailSteps.length === 0 && !canUseFavoniusOrElementNormal(p.c, characters) && !partyHasNormalAttackTrigger(characters)) return;
          push(p.c, [...fillSteps, ...tailSteps]);
        });
        if (!ok || stints.length === 0) continue;
        const assignment = Object.fromEntries(characters.map(c => [c.id, (picked.find(p => p.c.id === c.id)?.a.role ?? 'supporter') as SearchRole]));
        const key = stints.map(s => `${s.characterId}:${s.actions.map(a => a.actionTypeId).join(',')}`).join('|') + `@${loopStartIndex}`;
        if (!out.has(key)) out.set(key, { stints, loopStartIndex, assignment });
      }
    }
  }
  return [...out].map(([key, seed]) => ({ key, seed }));
}
