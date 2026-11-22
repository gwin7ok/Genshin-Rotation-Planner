/**
 * 知識辞書の本体（手で保守する）。`npm run build:knowledge` が、public/knowledge/ に書き出す。
 * キャラは ID で指す（コメントは名前）。根拠（evidence）は、手組みの編成の gcsim の実測。
 */
import type { CharacterKnowledge } from './types.ts';

export const KNOWLEDGE: CharacterKnowledge[] = [
  {
    characterId: '10000125-hydro', // コロンビーナ
    archetypes: [
      { name: 'E と Q', role: 'subAttacker', slot: 20, use: ['e', 'q'], evidence: '編成例の探索（アルレッキーノ・Overvape 編成）の上位に出る形。実測: 軽い設定で 93.1k → 95.2k、326 秒 → 172 秒' },
    
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
      { name: 'E と Q（Overvape 編成）', role: 'subAttacker', slot: 10, use: ['e', 'q'], evidence: '編成例の探索（Overvape）の上位に出る形。実測: 効果は確認できず' },
    ],
  },
  {
    characterId: '10000073-dendro', // ナヒーダ
    archetypes: [
      { name: 'E と Q', role: 'supporter', slot: 10, use: ['e', 'n', 'q'], evidence: '手組み「月開花」の出場（E のあと通常攻撃 1 回、Q）' },
      { name: 'E と Q（通常攻撃なし）', role: 'supporter', slot: 10, use: ['e', 'q'], evidence: '探索の上位に出る形' },
      { name: '長押し E と Q（刻晴編成）', role: 'supporter', slot: 20, use: ['e_hold', 'q'], evidence: '探索の上位（ナヒーダ[hE Q]）' },
      { name: 'E と Q（刻晴編成）', role: 'supporter', slot: 20, use: ['e', 'q'], evidence: '手組み「激化刻晴」' },
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
    archetypes: [
      { name: 'E だけ', role: 'supporter', slot: 10, use: ['e'], evidence: '編成例の探索（ナヴィア・シロネン・フリーナ・オロルン）の上位に出る形。実測: 50.4k → 52.1k。時間 345 → 152 秒' },
    
      { name: 'E だけ', role: 'supporter', slot: 10, use: ['e'], evidence: '編成例の探索（魈・閑雲編成）の上位に出る形。実測: 魈の編成で 43.2k → 48.4k' },
    { name: 'E と Q', role: 'supporter', slot: 10, use: ['e', 'q'], evidence: '手組み「蒸発フリーナ」と探索の上位が、先頭に E・Q を置く' }],
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
      { name: '主役（E・Q のあと通常攻撃）', role: 'attacker', slot: 30, use: ['e', 'q'], fill: ['n'], fillRepeat: [1, 3, 12], lead: ['n'], evidence: '探索の上位に、香菱[E Q N×12 …] の形が出る（蒸発の火力役）' },
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
    
      { name: 'E と Q', role: 'supporter', slot: 10, use: ['e', 'q'], evidence: '編成例の探索（アルレッキーノ・Overvape 編成）の上位に出る形。実測: 軽い設定で 93.1k → 95.2k、326 秒 → 172 秒' },
    
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

  // ── 胡桃（手組みなし。Wiki の運用の要約から起こし、探索で確かめた。結果は plan.md）──
  {
    characterId: '10000046-pyro', // 胡桃
    archetypes: [
      { name: 'E のあと 通常攻撃 + 重撃を繰り返す', role: 'attacker', slot: 40, use: ['e'], fill: ['n', 'ca'], fillRepeat: [4, 5, 6], evidence: '実測（胡桃・行秋・香菱・ベネット、標準ビルド）: 辞書なしの探索の 1 位が 胡桃[E N C ×5] 32.5k。辞書ありは同じ結果を 228 秒 → 119 秒で出した（DPS は同じ）。Wiki の N2CD は、標準ビルドでは上位に出なかった' },
      { name: '通常攻撃・E のあと 通常攻撃 + 重撃を繰り返す', role: 'attacker', slot: 40, use: ['n', 'e'], fill: ['n', 'ca'], fillRepeat: [5, 6], evidence: '編成例の探索（Overvape 編成）の上位に出る形（93.6k）。実測: Overvape で 93.6k → 95.0k（誤差）。効果は確認できず' },
    ],
  },

  // ── 胡桃の編成例の探索から（Overvape 編成。胡桃・夜蘭・コロンビーナ・イネファ）。実測は plan.md ──
  {
    characterId: '10000060-hydro', // 夜蘭
    archetypes: [
      { name: 'E と Q', role: 'supporter', slot: 30, use: ['e', 'q'], evidence: '編成例の探索（アルレッキーノ・Overvape 編成）の上位に出る形。実測: 軽い設定で 93.1k → 95.2k、326 秒 → 172 秒' },
    { name: 'E と Q', role: 'supporter', slot: 30, use: ['e', 'q'], evidence: '編成例の探索（水2・凍結溶解・Overvape）の上位に出る形。実測: Overvape で 93.6k → 95.0k（誤差）。効果は確認できず' }],
  },
  {
    characterId: '10000116-electro', // イネファ
    archetypes: [
      { name: 'E', role: 'subAttacker', slot: 25, use: ['e'], evidence: '編成例の探索（アルレッキーノ・Overvape 編成）の上位に出る形。実測: 軽い設定で 93.1k → 95.2k、326 秒 → 172 秒' },
    { name: 'E', role: 'subAttacker', slot: 20, use: ['e'], evidence: '編成例の探索（Overvape）の上位に出る形。実測: Overvape で効果は確認できず' }],
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
      { name: 'E だけ', role: 'supporter', slot: 20, use: ['e'], evidence: '編成例の探索（ヌヴィレット・オロルン・楓原万葉・鍾離）の上位に出る形。実測: 31.1k → 32.9k。時間 239 → 197 秒' },
    
    
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
    archetypes: [
      { name: 'E と Q', role: 'supporter', slot: 10, use: ['e', 'q'], evidence: '編成例の探索（ウェンティ・ドゥリン・ファルザン・ニコ）の上位に出る形。実測: 55.8k → 54.6k ±4.6（誤差）。時間 243 → 175 秒' },
    { name: 'E', role: 'supporter', slot: 30, use: ['e'], evidence: '手組み「星電導サンドローネ」' }],
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
  {
    characterId: '10000026-anemo',
    archetypes: [
      { name: 'E×2・Q・通常攻撃・重撃のあと 落下を繰り返す', role: 'attacker', slot: 40, use: ['e', 'e', 'q', 'n', 'n', 'ca'], fill: ['jump', 'hp'], fillRepeat: [4, 5, 6], evidence: '編成例の探索（魈・閑雲・ファルザン・フリーナ）の上位に出る形。実測: 閑雲編成で 43.2k → 48.4k（207 秒）。条件なしにして、鍾離・ファルザン・ベネットの編成で 19.5k → 33.1k、鍾離・ジン・アルベドの編成で 21.5k → 21.2k（同じ）' },
    ],
  },
  {
    characterId: '10000093-anemo',
    archetypes: [
      { name: 'Q だけ', role: 'supporter', slot: 30, use: ['q'], evidence: '編成例の探索（魈・閑雲編成）の上位に出る形。実測: 魈の編成で 43.2k → 48.4k' },
    ],
  },
  {
    characterId: '10000076-anemo',
    archetypes: [
      { name: 'E と Q', role: 'supporter', slot: 20, use: ['e', 'q'], evidence: '編成例の探索（ウェンティ・ドゥリン・ファルザン・ニコ）の上位に出る形。実測: 55.8k → 54.6k ±4.6（誤差）。時間 243 → 175 秒' },
    
      { name: 'E と Q', role: 'supporter', slot: 20, use: ['e', 'q'], evidence: '編成例の探索（魈・閑雲編成）の上位に出る形。実測: 魈の編成で 43.2k → 48.4k' },
    ],
  },
  {
    characterId: '10000096-pyro',
    archetypes: [
      { name: 'E・通常攻撃のあと 通常攻撃 2 回 + 重撃を繰り返す', role: 'attacker', slot: 40, use: ['e', 'n'], fill: ['n', 'n', 'ca'], fillRepeat: [4, 5, 6], evidence: '編成例の探索（アルレッキーノ・Overvape 編成）の上位に出る形。実測: 軽い設定で 93.1k → 95.2k、326 秒 → 172 秒' },
    ],
  },
  {
    characterId: '10000003-anemo',
    archetypes: [
      { name: 'E だけ', role: 'supporter', slot: 10, use: ['e'], evidence: '編成例の探索（宵宮・雲菫・ミカ・ジン）の上位に出る形。実測: 24.2k → 23.5k（誤差）。時間 134 → 96 秒' },
    ],
  },
  {
    characterId: '10000080-cryo',
    archetypes: [
      { name: '長押し E', role: 'supporter', slot: 20, use: ['e_hold'], evidence: '編成例の探索（宵宮・雲菫・ミカ・ジン）の上位に出る形。実測: 24.2k → 23.5k（誤差）。時間 134 → 96 秒' },
    ],
  },
  {
    characterId: '10000064-geo',
    archetypes: [
      { name: 'E と Q', role: 'supporter', slot: 30, use: ['e', 'q'], evidence: '編成例の探索（宵宮・雲菫・ミカ・ジン）の上位に出る形。実測: 24.2k → 23.5k（誤差）。時間 134 → 96 秒' },
    ],
  },
  {
    characterId: '10000049-pyro',
    archetypes: [
      { name: 'E のあと 通常攻撃を繰り返す', role: 'attacker', slot: 40, use: ['e'], fill: ['n'], fillRepeat: [17, 19, 21], evidence: '編成例の探索（宵宮・雲菫・ミカ・ジン）の上位に出る形。実測: 24.2k → 23.5k（誤差）。時間 134 → 96 秒' },
    ],
  },
  {
    characterId: '10000103-geo',
    archetypes: [
    
      { name: 'E と Q', role: 'supporter', slot: 20, use: ['e', 'q'], evidence: '編成例の探索（ナヴィア・シロネン・フリーナ・オロルン）の上位に出る形。実測: 50.4k → 52.1k。時間 345 → 152 秒' },
    ],
  },
  {
    characterId: '10000105-electro',
    archetypes: [
      { name: 'Q だけ', role: 'supporter', slot: 30, use: ['q'], evidence: '編成例の探索（ヌヴィレット・オロルン・楓原万葉・鍾離）の上位に出る形。実測: 31.1k → 32.9k。時間 239 → 197 秒' },
    
      { name: 'E と Q', role: 'supporter', slot: 30, use: ['e', 'q'], evidence: '編成例の探索（ナヴィア・シロネン・フリーナ・オロルン）の上位に出る形。実測: 50.4k → 52.1k。時間 345 → 152 秒' },
    ],
  },
  {
    characterId: '10000091-geo',
    archetypes: [
      { name: 'Q・長押し E 2 回・通常攻撃', role: 'attacker', slot: 40, use: ['q', 'e_hold@4.41', 'e_hold', 'n', 'dash', 'n'], evidence: '編成例の探索（ナヴィア・シロネン・フリーナ・オロルン）の上位に出る形。実測: 50.4k → 52.1k。時間 345 → 152 秒' },
    ],
  },
  {
    characterId: '10000022-anemo',
    archetypes: [
      { name: 'E と Q', role: 'supporter', slot: 30, use: ['e', 'q'], evidence: '編成例の探索（ウェンティ・ドゥリン・ファルザン・ニコ）の上位に出る形。実測: 55.8k → 54.6k ±4.6（誤差）。時間 243 → 175 秒' },
    ],
  },
  {
    characterId: '10000123-pyro',
    archetypes: [
      { name: 'E×2・Q のあと 通常攻撃 2 回 + 重撃を繰り返す', role: 'attacker', slot: 40, use: ['e', 'e', 'q'], fill: ['n', 'n', 'ca'], fillRepeat: [3, 4, 5], evidence: '編成例の探索（ウェンティ・ドゥリン・ファルザン・ニコ）の上位に出る形。実測: 55.8k → 54.6k ±4.6（誤差）。時間 243 → 175 秒' },
    ],
  },
  {
    characterId: '10000030-geo',
    archetypes: [
      { name: '長押し E', role: 'supporter', slot: 10, use: ['e_hold'], evidence: '編成例の探索（ヌヴィレット・オロルン・楓原万葉・鍾離）の上位に出る形。実測: 31.1k → 32.9k。時間 239 → 197 秒' },
    ],
  },
  {
    characterId: '10000087-hydro',
    archetypes: [
      { name: '先頭 N・E と Q のあと 重撃 + 通常攻撃 2 回を繰り返す', role: 'attacker', slot: 40, use: ['e', 'q'], fill: ['ca', 'n', 'n'], fillRepeat: [4, 5, 6], lead: ['n'], evidence: '編成例の探索（ヌヴィレット・オロルン・楓原万葉・鍾離）の上位に出る形。実測: 31.1k → 32.9k。時間 239 → 197 秒' },
    ],
  },
  {
    characterId: '10000066-hydro',
    archetypes: [
      { name: 'Q・ダッシュ・E のあと 通常攻撃を繰り返す', role: 'attacker', slot: 40, use: ['q', 'dash', 'e'], fill: ['n'], fillRepeat: [18, 21, 24], evidence: '編成例の探索（綾人・フリーナ・シトラリ・エスコフィエ）の上位に出る形。実測: 最短の設定で 44.5k → 44.5k（同じ）' },
    ],
  },
  {
    characterId: '10000112-cryo',
    archetypes: [
      { name: 'E だけ', role: 'supporter', slot: 30, use: ['e'], evidence: '編成例の探索（綾人・フリーナ・シトラリ・エスコフィエ）の上位に出る形。実測: 最短の設定で 44.5k → 44.5k（同じ）' },
    ],
  },
  {
    characterId: '10000078-dendro',
    archetypes: [
      { name: 'Q のあと 通常攻撃を繰り返す', role: 'attacker', slot: 40, use: ['q'], fill: ['n'], fillRepeat: [12, 18], evidence: '編成例の探索（アルハイゼン・久岐忍・鍾離・ナヒーダ）の上位に出る形。実測: 最短の設定で 41.2k → 40.2k ±2.9（誤差）' },
    ],
  },
  {
    characterId: '10000065-electro',
    archetypes: [
      { name: 'E だけ', role: 'supporter', slot: 30, use: ['e'], evidence: '編成例の探索（アルハイゼン・久岐忍・鍾離・ナヒーダ）の上位に出る形。実測: 最短の設定で 41.2k → 40.2k ±2.9（誤差）' },
    ],
  },
  {
    characterId: '10000111-electro',
    archetypes: [
      { name: '先頭 N・E×2・Q のあと 重撃 + 落下を繰り返す', role: 'attacker', slot: 40, use: ['e', 'e', 'q'], fill: ['ca', 'hp'], fillRepeat: [3, 4], lead: ['n'], evidence: '編成例の探索（ヴァレサ・イアンサ・閑雲・フリーナ）の上位に出る形。実測: 最短の設定で 32.1k → 32.1k（同じ）' },
    ],
  },
  {
    characterId: '10000110-electro',
    archetypes: [
      { name: 'E と Q', role: 'supporter', slot: 20, use: ['e', 'q'], evidence: '編成例の探索（ヴァレサ・イアンサ・閑雲・フリーナ）の上位に出る形。実測: 最短の設定で 32.1k → 32.1k（同じ）' },
    ],
  },
  {
    characterId: '10000120-electro',
    archetypes: [
      { name: 'Q・E のあと 通常攻撃 2 回 + 重撃を繰り返す', role: 'attacker', slot: 40, use: ['q', 'e'], fill: ['n', 'n', 'ca'], fillRepeat: [3, 4, 5], evidence: '編成例の探索（フリンズ・イネファ・コロンビーナ・スクロース）の上位に出る形。実測: 最短の設定で 128.4k → 131.4k ±4.1。時間 106 → 87 秒' },
    ],
  },
  {
    characterId: '10000043-anemo',
    archetypes: [
      { name: 'E・通常攻撃・重撃', role: 'subAttacker', slot: 30, use: ['e', 'n', 'n', 'n', 'n', 'ca', 'n', 'n', 'n', 'ca'], evidence: '編成例の探索（フリンズ・イネファ・コロンビーナ・スクロース）の上位に出る形。実測: 最短の設定で 128.4k → 131.4k ±4.1。時間 106 → 87 秒' },
    ],
  },
  {
    characterId: '10000071-electro',
    archetypes: [
      { name: 'E・Q のあと 通常攻撃を繰り返す', role: 'attacker', slot: 40, use: ['e', 'q'], fill: ['n'], fillRepeat: [9, 10, 12], evidence: '編成例の探索（セノ・ナヒーダ・行秋・久岐忍）の上位に出る形。実測: 最短の設定で 38.4k → 37.8k（誤差）' },
    ],
  },
  {
    characterId: '10000085-cryo',
    archetypes: [
      { name: 'E・通常攻撃のあと 通常攻撃を繰り返す', role: 'attacker', slot: 40, use: ['e', 'n'], fill: ['n'], fillRepeat: [12, 14, 16], evidence: '編成例の探索（フレミネ・イネファ・フリーナ・エスコフィエ）の上位に出る形。実測: 最短の設定で 59.3k → 59.3k（同じ）' },
    ],
  },
  {
    characterId: '10000034-geo',
    archetypes: [
      { name: '先頭 N・E と Q のあと 通常攻撃を繰り返す', role: 'attacker', slot: 40, use: ['e', 'q'], fill: ['n'], fillRepeat: [18, 21, 24], lead: ['n'], evidence: '編成例の探索（ノエル・ゴロー・アルベド・ベネット）の上位に出る形。実測: 最短の設定で 17.0k ±5.4 → 18.9k ±5.0（誤差）' },
    ],
  },
  {
    characterId: '10000020-electro',
    archetypes: [
      { name: 'E・Q のあと 通常攻撃を繰り返す', role: 'attacker', slot: 40, use: ['e', 'q'], fill: ['n'], fillRepeat: [14, 18], evidence: '自動編成（レザー + ベネット・鍾離・フリーナ）の探索の上位に出る形。実測（最短の設定）: 35.7k → 38.3k' },
    ],
  },
  {
    characterId: '10000027-geo',
    archetypes: [
      { name: 'E・ダッシュ・Q のあと 重撃 + 通常攻撃を繰り返す', role: 'attacker', slot: 40, use: ['e', 'dash', 'q'], fill: ['ca', 'n'], fillRepeat: [4, 6], evidence: '自動編成（凝光 + ベネット・鍾離・フリーナ）の探索の上位に出る形。実測（最短の設定）: 37.1k → 38.3k' },
    ],
  },
  {
    characterId: '10000029-pyro',
    archetypes: [
      { name: 'E・Q のあと 通常攻撃 2 回 + 重撃を繰り返す', role: 'attacker', slot: 40, use: ['e', 'q'], fill: ['n', 'n', 'ca'], fillRepeat: [4, 5, 6], evidence: '自動編成（クレー + ベネット・鍾離・フリーナ）の探索の上位に出る形。実測（最短の設定）: 36.7k → 37.7k' },
    ],
  },
  {
    characterId: '10000036-cryo',
    archetypes: [
      { name: 'Q のあと 通常攻撃を繰り返す', role: 'attacker', slot: 40, use: ['q'], fill: ['n'], fillRepeat: [14, 19, 22], evidence: '自動編成（重雲 + ベネット・鍾離・フリーナ）の探索の上位に出る形。実測（最短の設定）: 24.7k → 28.4k' },
    ],
  },
  {
    characterId: '10000041-hydro',
    archetypes: [
      { name: 'Q のあと 重撃を繰り返す', role: 'attacker', slot: 40, use: ['q'], fill: ['ca'], fillRepeat: [4, 5, 6], evidence: '自動編成（モナ + ベネット・鍾離・フリーナ）の探索の上位に出る形。実測（最短の設定）: 25.4k → 26.7k' },
    ],
  },
  {
    characterId: '10000044-pyro',
    archetypes: [
      { name: 'ダッシュ・E・Q のあと 通常攻撃を繰り返す', role: 'attacker', slot: 40, use: ['dash', 'e', 'q'], fill: ['n'], fillRepeat: [18, 20, 22], evidence: '自動編成（辛炎 + ベネット・鍾離・フリーナ）の探索の上位に出る形。実測（最短の設定）: 21.9k → 24.8k' },
    ],
  },
  {
    characterId: '10000054-hydro',
    archetypes: [
      { name: 'Q・E のあと 通常攻撃を繰り返す', role: 'attacker', slot: 40, use: ['q', 'e'], fill: ['n'], fillRepeat: [14, 15, 16], evidence: '自動編成（珊瑚宮心海 + ベネット・鍾離・フリーナ）の探索の上位に出る形。実測（最短の設定）: 35.3k → 36.2k' },
    ],
  },
  {
    characterId: '10000057-geo',
    archetypes: [
      { name: 'E・Q のあと 通常攻撃 3 回 + 重撃を繰り返す', role: 'attacker', slot: 40, use: ['e', 'q'], fill: ['n', 'n', 'n', 'ca'], fillRepeat: [3, 4], evidence: '自動編成（荒瀧一斗 + ベネット・鍾離・フリーナ）の探索の上位に出る形。実測（最短の設定）: 36.6k → 36.7k' },
    ],
  },
  {
    characterId: '10000059-anemo',
    archetypes: [
      { name: 'Q・E のあと 通常攻撃を繰り返す', role: 'attacker', slot: 40, use: ['q', 'e'], fill: ['n'], fillRepeat: [15, 20], evidence: '自動編成（鹿野院平蔵 + ベネット・鍾離・フリーナ）の探索の上位に出る形。実測（最短の設定）: 28.8k → 29.6k' },
    ],
  },
  {
    characterId: '10000062-cryo',
    archetypes: [
      { name: 'E・ジャンプ・Q のあと 重撃を繰り返す', role: 'attacker', slot: 40, use: ['e', 'jump', 'q'], fill: ['ca'], fillRepeat: [4, 5, 6], evidence: '自動編成（アーロイ + ベネット・鍾離・フリーナ）の探索の上位に出る形。実測（最短の設定）: 24.7k → 26.2k' },
    ],
  },
  {
    characterId: '10000075-anemo',
    archetypes: [
      { name: '重撃 3 回・E のあと 通常攻撃を繰り返す', role: 'attacker', slot: 40, use: ['ca', 'ca', 'ca', 'e'], fill: ['n'], fillRepeat: [17, 19, 21], evidence: '自動編成（放浪者 + ベネット・鍾離・フリーナ）の探索の上位に出る形。実測（最短の設定）: 36.2k → 36.2k' },
    ],
  },
  {
    characterId: '10000086-cryo',
    archetypes: [
      { name: 'E のあと 通常攻撃を繰り返す', role: 'attacker', slot: 40, use: ['e'], fill: ['n'], fillRepeat: [18, 20, 22], evidence: '自動編成（リオセスリ + ベネット・鍾離・フリーナ）の探索の上位に出る形。実測（最短の設定）: 38.0k → 38.0k' },
    ],
  },
  {
    characterId: '10000104-anemo',
    archetypes: [
      { name: 'E のあと 重撃を繰り返す', role: 'attacker', slot: 40, use: ['e'], fill: ['ca'], fillRepeat: [4, 5], evidence: '自動編成（チャスカ + ベネット・鍾離・フリーナ）の探索の上位に出る形。実測（最短の設定）: 43.0k → 49.9k' },
    ],
  },
  {
    characterId: '10000113-anemo',
    archetypes: [
      { name: 'E・重撃のあと 通常攻撃を繰り返す', role: 'attacker', slot: 40, use: ['e', 'ca', 'ca', 'ca', 'ca', 'ca'], fill: ['n'], fillRepeat: [10, 12, 14], evidence: '自動編成（イファ + ベネット・鍾離・フリーナ）の探索の上位に出る形。実測（最短の設定）: 27.5k → 27.5k' },
    ],
  },
  {
    characterId: '10000114-cryo',
    archetypes: [
      { name: 'E・Q・通常攻撃・重撃のあと 通常攻撃を繰り返す', role: 'attacker', slot: 40, use: ['e', 'q', 'n', 'n', 'ca'], fill: ['n'], fillRepeat: [15, 17, 19], evidence: '自動編成（スカーク + ベネット・鍾離・フリーナ）の探索の上位に出る形。実測（最短の設定）: 44.4k → 49.6k' },
    ],
  },
  {
    characterId: '10000128-anemo',
    archetypes: [
      { name: 'E・通常攻撃・重撃のあと 通常攻撃を繰り返す', role: 'attacker', slot: 40, use: ['e', 'n', 'n', 'ca'], fill: ['n'], fillRepeat: [6, 7, 8], evidence: '自動編成（ファルカ + ベネット・鍾離・フリーナ）の探索の上位に出る形。実測（最短の設定）: 32.6k → 34.1k' },
    ],
  },
  {
    characterId: '10000016-pyro',
    archetypes: [
      { name: 'E×3・Q のあと 通常攻撃を繰り返す', role: 'attacker', slot: 40, use: ['e', 'e', 'e', 'q'], fill: ['n'], fillRepeat: [6, 9], evidence: '自動編成（ディルック + ベネット・鍾離・フリーナ）の探索の上位に出る形。実測（最短の設定）: 35.1k → 37.2k' },
    ],
  },
  {
    characterId: '10000048-pyro',
    archetypes: [
      { name: '通常攻撃 2 回 + 重撃を繰り返す', role: 'attacker', slot: 40, use: [], fill: ['n', 'n', 'ca'], fillRepeat: [4, 5], evidence: '自動編成（煙緋 + ベネット・鍾離・フリーナ）の探索の上位に出る形。実測（最短の設定）: 27.8k → 28.2k' },
    ],
  },
  {
    characterId: '10000109-anemo',
    archetypes: [
      { name: 'E・Q・ダッシュのあと 通常攻撃を繰り返す', role: 'attacker', slot: 40, use: ['e', 'q', 'dash'], fill: ['n'], fillRepeat: [10, 12], evidence: '自動編成（夢見月瑞希 + ベネット・鍾離・フリーナ）の探索の上位に出る形。実測（最短の設定）: 24.7k → 23.8k' },
    ],
  },
  {
    characterId: '10000006-electro',
    archetypes: [
      { name: 'q の出場', role: 'supporter', slot: 30, use: ['q'], evidence: '自動編成（リサ + 雷電将軍・ベネット・フリーナ）の探索の上位に出る形。実測（最短の設定）: 42.3k → 42.8k' },
    ],
  },
  {
    characterId: '10000014-hydro',
    archetypes: [
      { name: 'e の出場', role: 'supporter', slot: 30, use: ['e'], evidence: '自動編成（バーバラ + 雷電将軍・ベネット・フリーナ）の探索の上位に出る形。実測（最短の設定）: 37.1k → 37.9k' },
    ],
  },
  {
    characterId: '10000015-cryo',
    archetypes: [
      { name: 'q の出場', role: 'supporter', slot: 30, use: ['q'], evidence: '自動編成（ガイア + 雷電将軍・ベネット・フリーナ）の探索の上位に出る形。実測（最短の設定）: 44.8k → 49.1k' },
    ],
  },
  {
    characterId: '10000021-pyro',
    archetypes: [
      { name: 'q の出場', role: 'supporter', slot: 30, use: ['q'], evidence: '自動編成（アンバー + 雷電将軍・ベネット・フリーナ）の探索の上位に出る形。実測（最短の設定）: 40.3k → 43.1k' },
    ],
  },
  {
    characterId: '10000024-electro',
    archetypes: [
      { name: 'q の出場', role: 'supporter', slot: 30, use: ['q'], evidence: '自動編成（北斗 + 雷電将軍・ベネット・フリーナ）の探索の上位に出る形。実測（最短の設定）: 41.6k → 39.6k' },
    ],
  },
  {
    characterId: '10000038-geo',
    archetypes: [
      { name: 'e の出場', role: 'supporter', slot: 30, use: ['e'], evidence: '自動編成（アルベド + 雷電将軍・ベネット・フリーナ）の探索の上位に出る形。実測（最短の設定）: 42.3k → 41.7k' },
    ],
  },
  {
    characterId: '10000039-cryo',
    archetypes: [
      { name: 'e_hold q の出場', role: 'supporter', slot: 10, use: ['e_hold', 'q'], evidence: '自動編成（ディオナ + 雷電将軍・ベネット・フリーナ）の探索の上位に出る形。実測（最短の設定）: 41.6k → 41.4k' },
    ],
  },
  {
    characterId: '10000045-cryo',
    archetypes: [
      { name: 'q の出場', role: 'supporter', slot: 30, use: ['q'], evidence: '自動編成（ロサリア + 雷電将軍・ベネット・フリーナ）の探索の上位に出る形。実測（最短の設定）: 41.3k → 41.3k' },
    ],
  },
  {
    characterId: '10000050-pyro',
    archetypes: [
      { name: 'e q の出場', role: 'supporter', slot: 30, use: ['e', 'q'], evidence: '自動編成（トーマ + 雷電将軍・ベネット・フリーナ）の探索の上位に出る形。実測（最短の設定）: 37.5k → 38.6k' },
    ],
  },
  {
    characterId: '10000055-geo',
    archetypes: [
      { name: 'e q の出場', role: 'supporter', slot: 30, use: ['e', 'q'], evidence: '自動編成（ゴロー + 雷電将軍・ベネット・フリーナ）の探索の上位に出る形。実測（最短の設定）: 37.7k → 37.8k' },
    ],
  },
  {
    characterId: '10000056-electro',
    archetypes: [
      { name: 'e q の出場', role: 'supporter', slot: 30, use: ['e', 'q'], evidence: '自動編成（九条裟羅 + 雷電将軍・ベネット・フリーナ）の探索の上位に出る形。実測（最短の設定）: 42.0k → 42.6k' },
    ],
  },
  {
    characterId: '10000061-dendro',
    archetypes: [
      { name: 'e q の出場', role: 'supporter', slot: 30, use: ['e', 'q'], evidence: '自動編成（綺良々 + 雷電将軍・ベネット・フリーナ）の探索の上位に出る形。実測（最短の設定）: 40.4k → 41.2k' },
    ],
  },
  {
    characterId: '10000063-cryo',
    archetypes: [
      { name: 'e q の出場', role: 'supporter', slot: 20, use: ['e', 'q'], evidence: '自動編成（申鶴 + 雷電将軍・ベネット・フリーナ）の探索の上位に出る形。実測（最短の設定）: 33.7k → 34.1k' },
    ],
  },
  {
    characterId: '10000067-dendro',
    archetypes: [
      { name: 'e q の出場', role: 'supporter', slot: 30, use: ['e', 'q'], evidence: '自動編成（コレイ + 雷電将軍・ベネット・フリーナ）の探索の上位に出る形。実測（最短の設定）: 48.7k → 48.2k' },
    ],
  },
  {
    characterId: '10000068-electro',
    archetypes: [
      { name: 'q e の出場', role: 'supporter', slot: 20, use: ['q', 'e'], evidence: '自動編成（ドリー + 雷電将軍・ベネット・フリーナ）の探索の上位に出る形。実測（最短の設定）: 45.2k → 41.3k' },
    ],
  },
  {
    characterId: '10000072-hydro',
    archetypes: [
      { name: 'e q の出場', role: 'supporter', slot: 10, use: ['e', 'q'], evidence: '自動編成（キャンディス + 雷電将軍・ベネット・フリーナ）の探索の上位に出る形。実測（最短の設定）: 37.8k → 37.9k' },
    ],
  },
  {
    characterId: '10000074-cryo',
    archetypes: [
      { name: 'e q の出場', role: 'supporter', slot: 30, use: ['e', 'q'], evidence: '自動編成（レイラ + 雷電将軍・ベネット・フリーナ）の探索の上位に出る形。実測（最短の設定）: 38.8k → 38.8k' },
    ],
  },
  {
    characterId: '10000077-dendro',
    archetypes: [
      { name: 'e の出場', role: 'supporter', slot: 30, use: ['e'], evidence: '自動編成（ヨォーヨ + 雷電将軍・ベネット・フリーナ）の探索の上位に出る形。実測（最短の設定）: 44.0k → 41.0k' },
    ],
  },
  {
    characterId: '10000082-dendro',
    archetypes: [
      { name: 'q の出場', role: 'supporter', slot: 10, use: ['q'], evidence: '自動編成（白朮 + 雷電将軍・ベネット・フリーナ）の探索の上位に出る形。実測（最短の設定）: 41.8k → 43.5k' },
    ],
  },
  {
    characterId: '10000083-anemo',
    archetypes: [
      { name: 'e q の出場', role: 'supporter', slot: 30, use: ['e', 'q'], evidence: '自動編成（リネット + 雷電将軍・ベネット・フリーナ）の探索の上位に出る形。実測（最短の設定）: 48.9k → 48.6k' },
    ],
  },
  {
    characterId: '10000088-cryo',
    archetypes: [
      { name: 'e q の出場', role: 'supporter', slot: 20, use: ['e', 'q'], evidence: '自動編成（シャルロット + 雷電将軍・ベネット・フリーナ）の探索の上位に出る形。実測（最短の設定）: 43.8k → 44.3k' },
    ],
  },
  {
    characterId: '10000090-pyro',
    archetypes: [
      { name: 'e_hold の出場', role: 'supporter', slot: 20, use: ['e_hold'], evidence: '自動編成（シュヴルーズ + 雷電将軍・ベネット・フリーナ）の探索の上位に出る形。実測（最短の設定）: 45.8k → 43.6k' },
    ],
  },
  {
    characterId: '10000094-geo',
    archetypes: [
      { name: 'e e の出場', role: 'supporter', slot: 30, use: ['e', 'e'], evidence: '自動編成（千織 + 雷電将軍・ベネット・フリーナ）の探索の上位に出る形。実測（最短の設定）: 44.8k → 46.6k' },
    ],
  },
  {
    characterId: '10000095-hydro',
    archetypes: [
      { name: 'e q の出場', role: 'supporter', slot: 30, use: ['e', 'q'], evidence: '自動編成（シグウィン + 雷電将軍・ベネット・フリーナ）の探索の上位に出る形。実測（最短の設定）: 47.9k → 47.1k' },
    ],
  },
  {
    characterId: '10000108-anemo',
    archetypes: [
      { name: 'e e の出場', role: 'supporter', slot: 30, use: ['e', 'e'], evidence: '自動編成（藍硯 + 雷電将軍・ベネット・フリーナ）の探索の上位に出る形。実測（最短の設定）: 44.8k → 44.5k' },
    ],
  },
  {
    characterId: '10000115-hydro',
    archetypes: [
      { name: 'e q の出場', role: 'supporter', slot: 30, use: ['e', 'q'], evidence: '自動編成（ダリア + 雷電将軍・ベネット・フリーナ）の探索の上位に出る形。実測（最短の設定）: 38.0k → 39.7k' },
    ],
  },
  {
    characterId: '10000121-hydro',
    archetypes: [
      { name: 'q の出場', role: 'supporter', slot: 30, use: ['q'], evidence: '自動編成（アイノ + 雷電将軍・ベネット・フリーナ）の探索の上位に出る形。実測（最短の設定）: 40.5k → 41.0k' },
    ],
  },
  {
    characterId: '10000124-anemo',
    archetypes: [
      { name: 'e q の出場', role: 'supporter', slot: 20, use: ['e', 'q'], evidence: '自動編成（ヤフォダ + 雷電将軍・ベネット・フリーナ）の探索の上位に出る形。実測（最短の設定）: 45.6k → 44.1k' },
    ],
  },
  {
    characterId: '10000127-geo',
    archetypes: [
      { name: 'q の出場', role: 'supporter', slot: 30, use: ['q'], evidence: '自動編成（イルーガ + 雷電将軍・ベネット・フリーナ）の探索の上位に出る形。実測（最短の設定）: 36.4k → 36.7k' },
    ],
  },
  {
    characterId: '10000132-anemo',
    archetypes: [
      { name: 'e q の出場', role: 'supporter', slot: 30, use: ['e', 'q'], evidence: '自動編成（プルーネ + 雷電将軍・ベネット・フリーナ）の探索の上位に出る形。実測（最短の設定）: 54.8k → 53.5k' },
    ],
  },
  {
    characterId: '10000148-electro',
    archetypes: [
      { name: 'e q の出場', role: 'supporter', slot: 20, use: ['e', 'q'], evidence: '自動編成（アリョーシャ + 雷電将軍・ベネット・フリーナ）の探索の上位に出る形。実測（最短の設定）: 52.6k → 50.8k' },
    ],
  },
  {
    characterId: '10000150-cryo',
    archetypes: [
      { name: 'q e e_recast の出場', role: 'supporter', slot: 30, use: ['q', 'e', 'e_recast'], evidence: '自動編成（オデット + 雷電将軍・ベネット・フリーナ）の探索の上位に出る形。実測（最短の設定）: 52.7k → 55.4k' },
    ],
  },
  {
    characterId: '10000002-cryo',
    archetypes: [
      { name: 'E・Q（爆発サブ）', role: 'subAttacker', slot: 20, use: ['e', 'q'], evidence: 'Wiki 本文の運用の記述から解釈（探索の比較なし）: 爆発サブアタッカー型の運用' },
    
      { name: 'E・Q のあと ダッシュ + 通常攻撃を繰り返す', role: 'attacker', slot: 40, use: ['e', 'q'], fill: ['dash', 'n', 'n', 'n', 'n', 'n'], fillRepeat: [2, 3, 4], evidence: 'Wiki 本文の運用の記述から解釈（探索の比較なし）: ダッシュで氷付与してから通常攻撃を振るのが基本。爆発も主力' },
    ],
  },
  {
    characterId: '10000005-cryo',
    archetypes: [
      { name: 'E・Q（星拡散のサブ）', role: 'subAttacker', slot: 20, use: ['e', 'q'], evidence: 'Wiki 本文の運用の記述から解釈（探索の比較なし）: 星拡散型は控えから氷付着するサブアタッカー' },
    
      { name: 'E・通常攻撃・Q のあと 通常攻撃 + 重撃を繰り返す', role: 'attacker', slot: 40, use: ['e', 'n', 'n', 'n', 'q'], fill: ['n', 'n', 'n', 'n', 'ca'], fillRepeat: [2, 3], evidence: 'Wiki 本文の運用の記述から解釈（探索の比較なし）: 星電導型: スキル → 通常攻撃・重撃でバフ → 爆発' },
    ],
  },
  {
    characterId: '10000005-dendro',
    archetypes: [
      { name: 'E・Q', role: 'supporter', slot: 10, use: ['e', 'q'], evidence: 'Wiki 本文の運用の記述から解釈（探索の比較なし）: 爆発の草付着で下地を作る' },
    
      { name: 'E・Q（サブアタッカー）', role: 'subAttacker', slot: 20, use: ['e', 'q'], evidence: 'Wiki 本文の運用の記述から解釈（探索の比較なし）: 爆発の草付着で下地を作るサブアタッカー' },
    ],
  },
  {
    characterId: '10000005-anemo',
    archetypes: [
      { name: '長押し E・Q', role: 'supporter', slot: 10, use: ['e_hold', 'q'], evidence: 'Wiki 本文の運用の記述から解釈（探索の比較なし）: 同上（長押しの形）' },
    
      { name: 'E・Q', role: 'supporter', slot: 10, use: ['e', 'q'], evidence: 'Wiki 本文の運用の記述から解釈（探索の比較なし）: 控えから出してスキル・爆発を撃ってすぐ引っ込める' },
    ],
  },
  {
    characterId: '10000005-electro',
    archetypes: [
      { name: 'E・Q', role: 'supporter', slot: 10, use: ['e', 'q'], evidence: 'Wiki 本文の運用の記述から解釈（探索の比較なし）: スキルと爆発でエネルギーを配るサポート' },
    ],
  },
  {
    characterId: '10000005-geo',
    archetypes: [
      { name: 'E・Q', role: 'supporter', slot: 10, use: ['e', 'q'], evidence: 'Wiki 本文の運用の記述から解釈（探索の比較なし）: スキル・爆発で岩の設置物を出すサポート' },
    ],
  },
  {
    characterId: '10000005-hydro',
    archetypes: [
      { name: 'E・Q', role: 'supporter', slot: 10, use: ['e', 'q'], evidence: 'Wiki 本文の運用の記述から解釈（探索の比較なし）: 同上（短押しの形）' },
    
      { name: '長押し E・Q', role: 'supporter', slot: 10, use: ['e_hold', 'q'], evidence: 'Wiki 本文の運用の記述から解釈（探索の比較なし）: スキルは長押しが主。戦闘では水付着の下地役' },
    ],
  },
  {
    characterId: '10000005-pyro',
    archetypes: [
      { name: '長押し E・Q', role: 'subAttacker', slot: 20, use: ['e_hold', 'q'], evidence: 'Wiki 本文の運用の記述から解釈（探索の比較なし）: 同上（長押しの形）' },
    
      { name: 'E・Q', role: 'subAttacker', slot: 20, use: ['e', 'q'], evidence: 'Wiki 本文の運用の記述から解釈（探索の比較なし）: スキルで控えから継続的に炎付着するサブアタッカー' },
    ],
  },
  {
    characterId: '10000007-cryo',
    archetypes: [
      { name: 'E・Q（星拡散のサブ）', role: 'subAttacker', slot: 20, use: ['e', 'q'], evidence: 'Wiki 本文の運用の記述から解釈（探索の比較なし）: 星拡散型は控えから氷付着するサブアタッカー' },
    
      { name: 'E・通常攻撃・Q のあと 通常攻撃 + 重撃を繰り返す', role: 'attacker', slot: 40, use: ['e', 'n', 'n', 'n', 'q'], fill: ['n', 'n', 'n', 'n', 'ca'], fillRepeat: [2, 3], evidence: 'Wiki 本文の運用の記述から解釈（探索の比較なし）: 星電導型: スキル → 通常攻撃・重撃でバフ → 爆発' },
    ],
  },
  {
    characterId: '10000007-dendro',
    archetypes: [
      { name: 'E・Q', role: 'supporter', slot: 10, use: ['e', 'q'], evidence: 'Wiki 本文の運用の記述から解釈（探索の比較なし）: 爆発の草付着で下地を作る' },
    
      { name: 'E・Q（サブアタッカー）', role: 'subAttacker', slot: 20, use: ['e', 'q'], evidence: 'Wiki 本文の運用の記述から解釈（探索の比較なし）: 爆発の草付着で下地を作るサブアタッカー' },
    ],
  },
  {
    characterId: '10000007-anemo',
    archetypes: [
      { name: '長押し E・Q', role: 'supporter', slot: 10, use: ['e_hold', 'q'], evidence: 'Wiki 本文の運用の記述から解釈（探索の比較なし）: 同上（長押しの形）' },
    
      { name: 'E・Q', role: 'supporter', slot: 10, use: ['e', 'q'], evidence: 'Wiki 本文の運用の記述から解釈（探索の比較なし）: 控えから出してスキル・爆発を撃ってすぐ引っ込める' },
    ],
  },
  {
    characterId: '10000007-electro',
    archetypes: [
      { name: 'E・Q', role: 'supporter', slot: 10, use: ['e', 'q'], evidence: 'Wiki 本文の運用の記述から解釈（探索の比較なし）: スキルと爆発でエネルギーを配るサポート' },
    ],
  },
  {
    characterId: '10000007-geo',
    archetypes: [
      { name: 'E・Q', role: 'supporter', slot: 10, use: ['e', 'q'], evidence: 'Wiki 本文の運用の記述から解釈（探索の比較なし）: スキル・爆発で岩の設置物を出すサポート' },
    ],
  },
  {
    characterId: '10000007-hydro',
    archetypes: [
      { name: 'E・Q', role: 'supporter', slot: 10, use: ['e', 'q'], evidence: 'Wiki 本文の運用の記述から解釈（探索の比較なし）: 同上（短押しの形）' },
    
      { name: '長押し E・Q', role: 'supporter', slot: 10, use: ['e_hold', 'q'], evidence: 'Wiki 本文の運用の記述から解釈（探索の比較なし）: スキルは長押しが主。戦闘では水付着の下地役' },
    ],
  },
  {
    characterId: '10000007-pyro',
    archetypes: [
      { name: '長押し E・Q', role: 'subAttacker', slot: 20, use: ['e_hold', 'q'], evidence: 'Wiki 本文の運用の記述から解釈（探索の比較なし）: 同上（長押しの形）' },
    
      { name: 'E・Q', role: 'subAttacker', slot: 20, use: ['e', 'q'], evidence: 'Wiki 本文の運用の記述から解釈（探索の比較なし）: スキルで控えから継続的に炎付着するサブアタッカー' },
    ],
  },
  {
    characterId: '10000033-hydro',
    archetypes: [
      { name: 'E・Q（サブ）', role: 'subAttacker', slot: 20, use: ['e', 'q'], evidence: 'Wiki 本文の運用の記述から解釈（探索の比較なし）: 爆発の回転率が高いサブアタッカー運用' },
    
      { name: '狙い撃ち・E・Q のあと 通常攻撃を繰り返す（双剣）', role: 'attacker', slot: 40, use: ['e', 'q'], fill: ['n'], fillRepeat: [12, 16, 20], lead: ['ca'], evidence: 'Wiki 本文の運用の記述から解釈（探索の比較なし）: スキルで双剣に切り替え、断流を乗せて通常攻撃を連打する' },
    ],
  },
  {
    characterId: '10000037-cryo',
    archetypes: [
      { name: 'E・Q（爆発サブ）', role: 'subAttacker', slot: 20, use: ['e', 'q'], evidence: 'Wiki 本文の運用の記述から解釈（探索の比較なし）: 爆発主体のサブアタッカー運用' },
    
      { name: 'E・Q のあと 重撃を繰り返す', role: 'attacker', slot: 40, use: ['e', 'q'], fill: ['ca'], fillRepeat: [4, 5, 6], lead: ['n'], evidence: 'Wiki 本文の運用の記述から解釈（探索の比較なし）: 爆発を出しながら 2 段チャージの重撃を撃つのが基本（凍結型）' },
    ],
  },
  {
    characterId: '10000051-cryo',
    archetypes: [
      { name: 'E・Q・長押し E のあと 通常攻撃を繰り返す', role: 'attacker', slot: 40, use: ['e', 'q', 'e_hold'], fill: ['n'], fillRepeat: [8, 10, 12], evidence: 'Wiki 本文の運用の記述から解釈（探索の比較なし）: 爆発でスキルの CT が戻る連携（2 つ目の例）' },
    
      { name: 'E・通常攻撃・長押し E・Q・E・通常攻撃・長押し E', role: 'attacker', slot: 40, use: ['e', 'n', 'e_hold', 'q', 'e', 'n', 'e_hold'], fill: ['n'], fillRepeat: [6, 8, 10], evidence: 'Wiki 本文の運用の記述から解釈（探索の比較なし）: 短押し → 通常攻撃 → 長押し → 爆発 → 短押し → 通常攻撃 → 長押し の連携の例が載っている' },
    ],
  },
  {
    characterId: '10000069-dendro',
    archetypes: [
      { name: 'E・Q（サブ）', role: 'subAttacker', slot: 20, use: ['e', 'q'], evidence: 'Wiki 本文の運用の記述から解釈（探索の比較なし）: 瞬間火力型。スキルと爆発で草付着' },
    
      { name: 'E・Q のあと 狙い撃ちを繰り返す', role: 'attacker', slot: 40, use: ['e', 'q'], fill: ['ca'], fillRepeat: [3, 4], evidence: 'Wiki 本文の運用の記述から解釈（探索の比較なし）: スキルで 3 発分の 2 段チャージを短縮 → 狙い撃ち → 爆発の一連で戦う' },
    ],
  },
  {
    characterId: '10000079-pyro',
    archetypes: [
      { name: 'E・Q のあと 通常攻撃を繰り返す（爆発アタッカー）', role: 'attacker', slot: 40, use: ['e', 'q'], fill: ['n'], fillRepeat: [4, 6, 8], evidence: 'Wiki 本文の運用の記述から解釈（探索の比較なし）: 爆発の強化攻撃を連打する爆発アタッカー型' },
    
      { name: 'E（炎付着サポート）', role: 'supporter', slot: 10, use: ['e'], evidence: 'Wiki 本文の運用の記述から解釈（探索の比較なし）: 控えから炎付着するサポート型' },
    ],
  },
  {
    characterId: '10000084-pyro',
    archetypes: [
      { name: 'E・Q のあと 重撃を繰り返す', role: 'attacker', slot: 40, use: ['e', 'q'], fill: ['ca'], fillRepeat: [4, 5, 6], lead: ['n'], evidence: 'Wiki 本文の運用の記述から解釈（探索の比較なし）: 重撃・スキル・爆発を満遍なく使うメインアタッカー' },
    ],
  },
  {
    characterId: '10000092-pyro',
    archetypes: [
      { name: 'E・落下・Q のあと E + 落下を繰り返す', role: 'attacker', slot: 40, use: ['e', 'hp', 'q'], fill: ['e', 'hp'], fillRepeat: [2, 3], evidence: 'Wiki 本文の運用の記述から解釈（探索の比較なし）: 特殊落下攻撃を連発する形' },
    
      { name: 'E・落下・Q のあと 通常攻撃を繰り返す', role: 'attacker', slot: 40, use: ['e', 'hp', 'q'], fill: ['n'], fillRepeat: [6, 8, 10], evidence: 'Wiki 本文の運用の記述から解釈（探索の比較なし）: スキルで跳んでの特殊落下攻撃が主力。爆発は補助' },
    ],
  },
  {
    characterId: '10000099-dendro',
    archetypes: [
      { name: 'E・Q のあと 通常攻撃を繰り返す', role: 'attacker', slot: 40, use: ['e', 'q'], fill: ['n'], fillRepeat: [8, 10, 12], evidence: 'Wiki 本文の運用の記述から解釈（探索の比較なし）: スキル・爆発で自己強化して通常攻撃を振るメインアタッカー型' },
    
      { name: 'E・Q（燃焼サブ）', role: 'subAttacker', slot: 20, use: ['e', 'q'], evidence: 'Wiki 本文の運用の記述から解釈（探索の比較なし）: 燃焼サブアタッカー型。スキル・爆発の大火力を押し付ける' },
    ],
  },
  {
    characterId: '10000101-dendro',
    archetypes: [
      { name: 'E・Q のあと E + 通常攻撃を繰り返す', role: 'attacker', slot: 40, use: ['e', 'q'], fill: ['e', 'n', 'n', 'n', 'n', 'n'], fillRepeat: [2, 3], evidence: 'Wiki 本文の運用の記述から解釈（探索の比較なし）: 夜魂値がたまり次第スキルを使い直す' },
    
      { name: 'E・Q のあと 通常攻撃を繰り返す', role: 'attacker', slot: 40, use: ['e', 'q'], fill: ['n'], fillRepeat: [10, 14, 18], evidence: 'Wiki 本文の運用の記述から解釈（探索の比較なし）: スキルのあと通常攻撃を連打するのが基本' },
    ],
  },
  {
    characterId: '10000102-hydro',
    archetypes: [
      { name: 'E・通常攻撃・E（絵巻 4 セット型）', role: 'supporter', slot: 10, use: ['e', 'n', 'e'], evidence: 'Wiki 本文の運用の記述から解釈（探索の比較なし）: スキル → 通常 1 回 → スキル解除の流れ' },
    
      { name: 'E・Q のあと 通常攻撃を繰り返す', role: 'attacker', slot: 40, use: ['e', 'q'], fill: ['n'], fillRepeat: [8, 10, 12], evidence: 'Wiki 本文の運用の記述から解釈（探索の比較なし）: 倍率の高いシンプルなアタッカー運用（蒸発向き）' },
    ],
  },
  {
    characterId: '10000106-pyro',
    archetypes: [
      { name: 'E・Q（サブ）', role: 'subAttacker', slot: 20, use: ['e', 'q'], evidence: 'Wiki 本文の運用の記述から解釈（探索の比較なし）: 控えから自動攻撃する輪で炎下地を作るサブ運用' },
    
      { name: 'E・Q のあと 通常攻撃を繰り返す', role: 'attacker', slot: 40, use: ['e', 'q'], fill: ['n'], fillRepeat: [8, 10, 12], evidence: 'Wiki 本文の運用の記述から解釈（探索の比較なし）: 同上（通常攻撃の形）' },
    
      { name: 'E・Q のあと 重撃を繰り返す', role: 'attacker', slot: 40, use: ['e', 'q'], fill: ['ca'], fillRepeat: [3, 4, 5], evidence: 'Wiki 本文の運用の記述から解釈（探索の比較なし）: 爆発の高い瞬間火力のあと、重撃・双駆輪で攻める' },
    ],
  },
  {
    characterId: '10000126-geo',
    archetypes: [
      { name: 'E・Q のあと 通常攻撃 4 段 + E を繰り返す', role: 'attacker', slot: 40, use: ['e', 'q'], fill: ['n', 'n', 'n', 'n', 'e'], fillRepeat: [4], evidence: 'Wiki 本文の運用の記述から解釈（探索の比較なし）: 基本はスキル → (通常 4 段 → 特殊スキル) × 4。爆発は強化中に使う' },
    ],
  },
  {
    characterId: '10000081-dendro', // カーヴェ（辞書ありで探索結果が悪くなったため、形を外した）
    archetypes: [],
  },
  {
    characterId: '10000097-electro', // セトス（辞書ありで探索結果が悪くなったため、形を外した）
    archetypes: [],
  },
  {
    characterId: '10000098-electro', // クロリンデ（辞書ありで探索結果が悪くなったため、形を外した）
    archetypes: [],
  },
  {
    characterId: '10000100-geo', // カチーナ
    archetypes: [
      { name: 'E（設置・控えから攻撃）', role: 'supporter', slot: 10, use: ['e'], evidence: 'Wiki 本文の運用の記述から解釈（gcsim 未対応のため、探索の比較なし）: スキルで出す乗り物は、控えでも設置物として戦える' },
      { name: 'E のあと 通常攻撃を繰り返す（アタッカー型）', role: 'attacker', slot: 40, use: ['e'], fill: ['n'], fillRepeat: [4, 6, 8], evidence: 'Wiki 本文の運用の記述から解釈（gcsim 未対応のため、探索の比較なし）: 乗って通常攻撃扱いで戦うアタッカー型' },
    ],
  },
  {
    characterId: '10000122-dendro', // ネフェル
    archetypes: [
      { name: 'E・重撃 3 回を繰り返す', role: 'attacker', slot: 40, use: [], fill: ['e', 'ca', 'ca', 'ca'], fillRepeat: [2, 3, 4], evidence: 'Wiki 本文の運用の記述から解釈（gcsim 未対応のため、探索の比較なし）: 基本の立ち回りは、スキル → 重撃 3 回 → スキル → 重撃 3 回' },
      { name: 'E・重撃 3 回・Q のあと E・重撃 3 回を繰り返す', role: 'attacker', slot: 40, use: ['e', 'ca', 'ca', 'ca', 'q'], fill: ['e', 'ca', 'ca', 'ca'], fillRepeat: [1, 2, 3], evidence: 'Wiki 本文の運用の記述から解釈（gcsim 未対応のため、探索の比較なし）: 同上。爆発を 1 回入れる形' },
    ],
  },
  {
    characterId: '10000129-cryo', // ローエン
    archetypes: [
      { name: 'E・Q のあと 通常攻撃 + 重撃を繰り返す', role: 'attacker', slot: 40, use: ['e', 'q'], fill: ['n', 'ca'], fillRepeat: [4, 6, 8], evidence: 'Wiki 本文の運用の記述から解釈（gcsim 未対応のため、探索の比較なし）: 奇策状態では、通常 1 → 重撃の素早いループが強い' },
      { name: 'E（氷下地）', role: 'subAttacker', slot: 10, use: ['e'], evidence: 'Wiki 本文の運用の記述から解釈（gcsim 未対応のため、探索の比較なし）: 氷付着で下地を作る役（イネーブラー）としての運用' },
    ],
  },
  {
    characterId: '10000130-geo', // リンネア
    archetypes: [
      { name: 'E（月結晶サブ）', role: 'subAttacker', slot: 20, use: ['e'], evidence: 'Wiki 本文の運用の記述から解釈（gcsim 未対応のため、探索の比較なし）: 控えから継続的にダメージを出すサブアタッカー・サポーター型' },
      { name: 'E×3（連打の瞬間火力）', role: 'subAttacker', slot: 20, use: ['e', 'e', 'e'], evidence: 'Wiki 本文の運用の記述から解釈（gcsim 未対応のため、探索の比較なし）: 連打すると瞬間火力型になる' },
      { name: 'E・Q', role: 'supporter', slot: 10, use: ['e', 'q'], evidence: 'Wiki 本文の運用の記述から解釈（gcsim 未対応のため、探索の比較なし）: 爆発は回復。状況に応じて使う' },
    ],
  },
  {
    characterId: '10000136-electro', // ミティヤ
    archetypes: [
      { name: '長押し E・重撃・Q・重撃', role: 'attacker', slot: 40, use: ['e_hold', 'ca', 'q', 'ca'], evidence: 'Wiki 本文の運用の記述から解釈（gcsim 未対応のため、探索の比較なし）: メイン型: スキル長押し → 特殊重撃 → 爆発 → 特殊重撃' },
      { name: 'E（短押しのサブ）', role: 'subAttacker', slot: 20, use: ['e'], evidence: 'Wiki 本文の運用の記述から解釈（gcsim 未対応のため、探索の比較なし）: 短押しは、通常・爆発を使わず、すぐ退場するサブ型' },
    ],
  },
  {
    characterId: '10000137-electro', // バレリー
    archetypes: [
      { name: 'E・重撃・Q', role: 'supporter', slot: 10, use: ['e', 'ca', 'q'], evidence: 'Wiki 本文の運用の記述から解釈（gcsim 未対応のため、探索の比較なし）: 基本は、スキル → 重撃 の順で、前後に爆発' },
      { name: 'Q・E・重撃', role: 'supporter', slot: 10, use: ['q', 'e', 'ca'], evidence: 'Wiki 本文の運用の記述から解釈（gcsim 未対応のため、探索の比較なし）: 同上（爆発を先に使う形）' },
    ],
  },
  {
    characterId: '10000140-hydro', // ヴォジャニーツァ
    archetypes: [
      { name: 'E', role: 'supporter', slot: 10, use: ['e'], evidence: 'Wiki 本文の運用の記述から解釈（gcsim 未対応のため、探索の比較なし）: スキルだけで、回復・中断耐性・耐性デバフ・加算バフが出る' },
      { name: 'E・Q', role: 'supporter', slot: 10, use: ['e', 'q'], evidence: 'Wiki 本文の運用の記述から解釈（gcsim 未対応のため、探索の比較なし）: 同上（爆発も使う形）' },
    ],
  },
  {
    characterId: '10000143-anemo', // ヴェスナ
    archetypes: [
      { name: 'E・通常攻撃・重撃・Q のあと 特殊スキルと重撃を交互に繰り返す', role: 'attacker', slot: 40, use: ['e', 'n', 'ca', 'q'], fill: ['e', 'ca'], fillRepeat: [4, 5], evidence: 'Wiki 本文の運用の記述から解釈（gcsim 未対応のため、探索の比較なし）: ゲージをためてから、特殊スキル 5 回。特殊スキルと重撃を交互に撃つ' },
    ],
  },
];
