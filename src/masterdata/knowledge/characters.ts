/**
 * 知識辞書の本体（手で保守する）。`npm run build:knowledge` が、public/knowledge/ に書き出す。
 * キャラは ID で指す（コメントは名前）。根拠（evidence）は、手組みの編成の gcsim の実測。
 */
import type { CharacterKnowledge } from './types.ts';

export const KNOWLEDGE: CharacterKnowledge[] = [
  {
    characterId: '10000125-hydro', // コロンビーナ
    archetypes: [
      {
        name: '重撃を最後にまとめる（月開花）',
        role: 'attacker',
        slot: 30,
        use: ['e', 'q'],
        fill: ['ca'],
        fillRepeat: [4, 5, 6],
        lead: ['n'],
        evidence: '手組み「月開花」184k（探索で登った後）。E・Q を先に置き、重撃を最後に撃つと、バフが重なる',
      },
    ],
  },
  {
    characterId: '10000073-dendro', // ナヒーダ
    archetypes: [
      { name: 'E と Q', role: 'supporter', slot: 10, use: ['e', 'n', 'q'], withCharacters: ['10000125-hydro'], evidence: '手組み「月開花」の出場（E のあと通常攻撃 1 回、Q）' },
      { name: 'E と Q（通常攻撃なし）', role: 'supporter', slot: 10, use: ['e', 'q'], withCharacters: ['10000125-hydro'], evidence: '探索の上位に出る形' },
      { name: '長押し E と Q（刻晴編成）', role: 'supporter', slot: 20, use: ['e_hold', 'q'], withCharacters: ['10000042-electro'], evidence: '探索の上位（ナヒーダ[hE Q]）' },
      { name: 'E と Q（刻晴編成）', role: 'supporter', slot: 20, use: ['e', 'q'], withCharacters: ['10000042-electro'], evidence: '手組み「激化刻晴」' },
    ],
  },
  {
    characterId: '10000070-hydro', // ニィロウ
    archetypes: [
      { name: 'E×4', role: 'supporter', slot: 20, use: ['e', 'e', 'e', 'e'], evidence: '手組み「月開花」。E×4 で別の効果（天を滌う水環）が出る。×2 にすると 124k に下がる' },
    ],
  },
  {
    characterId: '10000119-dendro', // ラウマ
    archetypes: [
      { name: '長押し E と Q', role: 'subAttacker', slot: 40, use: ['e_hold', 'q'], evidence: '手組み「月開花」。長押しで得た詠月を Q が消費する（+26k の実測）' },
    ],
  },

  // ── 蒸発フリーナ（フリーナ・シトラリ・香菱・早柚）。手組み 63.2k、探索 72.3k（旧計算）──
  {
    characterId: '10000089-hydro', // フリーナ
    archetypes: [{ name: 'E と Q', role: 'supporter', slot: 10, use: ['e', 'q'], evidence: '手組み「蒸発フリーナ」と探索の上位が、先頭に E・Q を置く' }],
  },
  {
    characterId: '10000107-cryo', // シトラリ
    archetypes: [
      { name: 'E・Q・E', role: 'supporter', slot: 20, use: ['e', 'q', 'e'], evidence: '手組み「蒸発フリーナ」' },
      { name: 'Q のあと E・通常攻撃 2 回・E', role: 'supporter', slot: 20, use: ['q', 'e', 'n', 'n', 'e'], evidence: '探索の上位（71.8k）' },
    ],
  },
  {
    characterId: '10000023-pyro', // 香菱
    archetypes: [
      { name: '主役（E・Q のあと通常攻撃）', role: 'attacker', slot: 30, use: ['e', 'q'], fill: ['n'], fillRepeat: [1, 3, 12], lead: ['n'], withCharacters: ['10000089-hydro'], evidence: '探索の上位に、香菱[E Q N×12 …] の形が出る（蒸発の火力役）' },
      { name: 'E と Q だけ', role: 'supporter', slot: 30, use: ['e', 'q'], evidence: '手組み「蒸発フリーナ」・「雷電ナショナル」' },
    ],
  },
  {
    characterId: '10000053-anemo', // 早柚
    archetypes: [
      { name: '長押し E と Q', role: 'supporter', slot: 40, use: ['e_hold', 'q'], evidence: '探索の上位（早柚[hE Q]）' },
      { name: 'Q のあと長押し E', role: 'supporter', slot: 40, use: ['q', 'e_hold'], evidence: '手組み「蒸発フリーナ」（長押し 8.4 秒）' },
    ],
  },

  // ── 雷電ナショナル（ベネット・行秋・香菱・雷電将軍）。手組み 47.6k ──
  {
    characterId: '10000032-pyro', // ベネット
    archetypes: [
      { name: 'Q・通常攻撃・E', role: 'supporter', slot: 10, use: ['q', 'n', 'e'], evidence: '手組み「雷電ナショナル」' },
      { name: 'Q だけ', role: 'supporter', slot: 10, use: ['q'], evidence: '探索の上位（48.5k）' },
    ],
  },
  {
    characterId: '10000025-hydro', // 行秋
    archetypes: [
      { name: 'E・ダッシュ・Q', role: 'supporter', slot: 20, use: ['e', 'dash', 'q'], evidence: '手組み「雷電ナショナル」・探索の上位' },
      { name: 'E・Q', role: 'supporter', slot: 20, use: ['e', 'q'], evidence: '探索の上位' },
    ],
  },
  {
    characterId: '10000052-electro', // 雷電将軍
    archetypes: [
      { name: '爆発のあと通常攻撃（ダッシュキャンセル）', role: 'attacker', slot: 40, use: ['q'], fill: ['n', 'n', 'n', 'n', 'n', 'dash'], fillRepeat: [2, 3], lead: ['e'], evidence: '手組み「雷電ナショナル」。最初に E を 1 回だけ使い、Q のあと通常攻撃 5 回 + ダッシュを繰り返す' },
      { name: 'E・Q のあと通常攻撃', role: 'attacker', slot: 40, use: ['e', 'q'], fill: ['n'], fillRepeat: [10, 18, 20], evidence: '探索の上位（雷電[E Q N×18 D …]）' },
    ],
  },

  // ── 激化刻晴（フィッシュル・ナヒーダ・万葉・刻晴）。手組み 54.8k ──
  {
    characterId: '10000031-electro', // フィッシュル
    archetypes: [
      { name: 'Q だけ', role: 'supporter', slot: 10, use: ['q'], evidence: '手組み「激化刻晴」' },
      { name: 'E・Q', role: 'supporter', slot: 10, use: ['e', 'q'], evidence: '探索の上位' },
    ],
  },
  {
    characterId: '10000047-anemo', // 楓原万葉
    archetypes: [
      { name: 'E・高い落下', role: 'supporter', slot: 30, use: ['e', 'hp'], evidence: '手組み「激化刻晴」・探索の上位（拡散）' },
      { name: 'E・Q', role: 'supporter', slot: 30, use: ['e', 'q'], evidence: '探索の上位' },
    ],
  },
  {
    characterId: '10000042-electro', // 刻晴
    archetypes: [
      { name: 'E×2・Q のあと通常攻撃', role: 'attacker', slot: 40, use: ['e', 'e', 'q'], fill: ['n'], fillRepeat: [10, 14, 17], evidence: '探索の上位（刻晴[E×2 N×10 Q]）' },
      { name: 'E×2・通常攻撃・重撃・Q', role: 'attacker', slot: 40, use: ['e', 'e', 'n', 'ca', 'q'], evidence: '手組み「激化刻晴」' },
    ],
  },

  // ── 星電導サンドローネ（八重神子・ニコ・七七・サンドローネ）。手組み 151.0k ──
  {
    characterId: '10000058-electro', // 八重神子
    archetypes: [{ name: 'E×3', role: 'supporter', slot: 10, use: ['e', 'e', 'e'], evidence: '手組み「星電導サンドローネ」・「八重神子」の探索の上位（E×3 で殺生桜 3 つ）' }],
  },
  {
    characterId: '10000131-pyro', // ニコ
    archetypes: [{ name: 'E', role: 'supporter', slot: 30, use: ['e'], evidence: '手組み「星電導サンドローネ」' }],
  },
  {
    characterId: '10000035-cryo', // 七七
    archetypes: [
      { name: 'Q のあと E', role: 'supporter', slot: 20, use: ['q', 'e'], evidence: '手組み「星電導サンドローネ」' },
      { name: 'E・Q', role: 'supporter', slot: 20, use: ['e', 'q'], evidence: '探索の上位（七七[E Q]）' },
    ],
  },
  {
    characterId: '10000133-cryo', // サンドローネ
    archetypes: [
      { name: 'E と重撃を交互に（Q を挟む）', role: 'attacker', slot: 40, use: [], fill: ['e', 'ca', 'e', 'q', 'ca', 'e', 'ca', 'e'], lead: ['e'], evidence: '手組み「星電導サンドローネ」（E と重撃を交互に撃ち、途中で Q）' },
      { name: 'E と重撃を交互に', role: 'attacker', slot: 40, use: [], fill: ['e', 'ca'], fillRepeat: [3, 4], evidence: '探索の上位（サンドローネ[C E C E C E Q]）' },
    ],
  },
];
