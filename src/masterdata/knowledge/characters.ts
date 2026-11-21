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
];
