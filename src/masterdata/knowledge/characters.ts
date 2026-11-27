/**
 * 知識辞書の本体（手で保守する）。`npm run build:knowledge` が、public/knowledge/ に書き出す。
 * キャラは ID で指す（コメントは名前）。根拠（evidence）は、手組みの編成の gcsim の実測。
 */
import type { CharacterKnowledge } from './types.ts';

export const KNOWLEDGE: CharacterKnowledge[] = [
  {
    characterId: '10000125-hydro', // コロンビーナ
    archetypes: [
      { name: 'E→Q', role: 'subAttacker', slot: 20, use: ['e', 'q'], evidence: 'Phase 3-1精鋭辞書: 控え水付着・サブ火力基本形' },
      { name: 'E→Q のあと重撃連打（月開花）', role: 'attacker', slot: 30, use: ['e', 'q'], fill: ['ca'], fillRepeat: [4, 5, 6], evidence: 'Phase 3-1精鋭辞書: 月開花重撃メインアタッカー形' },
      { name: 'Q→E', role: 'subAttacker', slot: 20, use: ['q', 'e'], evidence: 'Phase 3-1精鋭辞書: 爆発先出し形' },
      { name: 'E だけ', role: 'subAttacker', slot: 20, use: ['e'], evidence: 'Phase 3-1精鋭辞書: 爆発省略短時間形' },
    ],
  },
  {
    characterId: '10000073-dendro', // ナヒーダ
    archetypes: [
      { name: 'E→Q', role: 'supporter', slot: 10, use: ['e', 'q'], evidence: 'Phase 3-1精鋭辞書: 控え草付着＋熟知バフ基本形' },
      { name: '長押しE→Q', role: 'supporter', slot: 10, use: ['e_hold', 'q'], evidence: 'Phase 3-1精鋭辞書: 複数体マーク用長押し形' },
      { name: 'E だけ', role: 'supporter', slot: 10, use: ['e'], evidence: 'Phase 3-1精鋭辞書: 爆発省略・短時間ローテ形' },
      { name: 'E→Q のあと N2C 連打（ドライバー）', role: 'attacker', slot: 40, use: ['e', 'q'], fill: ['n', 'n', 'ca'], fillRepeat: [2, 3], evidence: 'Phase 3-1精鋭辞書: 開花/超開花表ドライバー形' },
    ],
  },
  {
    characterId: '10000070-hydro', // ニィロウ
    archetypes: [
      { name: 'E→N×2→E（最速水環）', role: 'supporter', slot: 10, use: ['e', 'n', 'n', 'e'], evidence: 'Phase 3-1精鋭辞書＋KQM新集計: 最速水環展開形' },
      { name: 'E→N×2→E のあと、もう一度 Q', role: 'supporter', slot: 10, use: ['e', 'n', 'n', 'e'], then: [{ slot: 30, use: ['q'] }], evidence: 'Phase 3-1精鋭辞書: 水環展開→後半Q水付着形' },
      { name: 'E×4（スキル連打水環）', role: 'supporter', slot: 10, use: ['e', 'e', 'e', 'e'], evidence: 'Phase 3-1精鋭辞書: 手組み月開花実績(E×4水環)' },
    ],
  },
  {
    characterId: '10000119-dendro', // ラウマ
    archetypes: [
      { name: '長押しE→Q', role: 'subAttacker', slot: 30, use: ['e_hold', 'q'], evidence: 'Phase 3-1精鋭辞書: 詠月獲得→Q消費（手組み月開花+26k）' },
      { name: 'E→Q', role: 'subAttacker', slot: 20, use: ['e', 'q'], evidence: 'Phase 3-1精鋭辞書: 短押しスキル→Q形' },
      { name: 'N→長押しE→Q', role: 'subAttacker', slot: 30, use: ['n', 'e_hold', 'q'], evidence: 'Phase 3-1精鋭辞書＋KQM新集計: 通常1挟み長押しE→Q' },
      { name: 'E だけ', role: 'subAttacker', slot: 20, use: ['e'], evidence: 'Phase 3-1精鋭辞書＋KQM新集計: 爆発温存形' },
    ],
  },

  // ── 蒸発フリーナ（フリーナ・シトラリ・香菱・早柚）。手組み 63.2k、探索 72.3k（旧計算）──
  {
    characterId: '10000089-hydro', // フリーナ
    archetypes: [
      { name: 'E→ダッシュ→Q', role: 'supporter', slot: 10, use: ['e', 'dash', 'q'], evidence: 'Phase 3-1精鋭辞書＋KQM新集計(最多): スキル硬直キャンセル→爆発' },
      { name: 'E→ダッシュ のあと、もう一度 Q', role: 'supporter', slot: 10, use: ['e', 'dash'], then: [{ slot: 30, use: ['q'] }], evidence: 'Phase 3-1精鋭辞書: サロン先置き→バフ合わせ再爆発' },
      { name: 'E→Q', role: 'supporter', slot: 10, use: ['e', 'q'], evidence: 'Phase 3-1精鋭辞書: シンプルE→Q形' },
      { name: 'E→ダッシュ（爆発温存）', role: 'supporter', slot: 10, use: ['e', 'dash'], evidence: 'Phase 3-1精鋭辞書: 爆発温存・スキルのみ形' },
    ],
  },
  {
    characterId: '10000107-cryo', // シトラリ
    archetypes: [
      { name: 'E→Q', role: 'supporter', slot: 10, use: ['e', 'q'], evidence: 'Phase 3-1精鋭辞書＋KQM新集計: 氷付着＋絵巻バフ基本形' },
      { name: 'E→Q→N', role: 'supporter', slot: 20, use: ['e', 'q', 'n'], evidence: 'Phase 3-1精鋭辞書＋KQM新集計: 西風/通常1挟み形' },
      { name: 'E だけ', role: 'supporter', slot: 20, use: ['e'], evidence: 'Phase 3-1精鋭辞書: 爆発温存・短時間氷付着形' },
    ],
  },
  {
    characterId: '10000023-pyro', // 香菱
    archetypes: [
      { name: 'Q→E', role: 'subAttacker', slot: 20, use: ['q', 'e'], evidence: 'Phase 3-1精鋭辞書＋KQM新集計(37件/7.8%): スナップショット基本形' },
      { name: 'Q→E→ダッシュ', role: 'subAttacker', slot: 20, use: ['q', 'e', 'dash'], evidence: 'Phase 3-1精鋭辞書＋KQM新集計(81件/17.0%, 最多): 硬直短縮型' },
      { name: 'E→Q', role: 'subAttacker', slot: 20, use: ['e', 'q'], evidence: 'Phase 3-1精鋭辞書: 粒子受け先出し型' },
    ],
  },
  {
    characterId: '10000053-anemo', // 早柚
    archetypes: [
      { name: 'Q のあと長押しE', role: 'supporter', slot: 40, use: ['q', 'e_hold'], evidence: 'Phase 3-1精鋭辞書: 蒸発フリーナ等での風車ドライバー形' },
      { name: '長押しE と Q', role: 'supporter', slot: 40, use: ['e_hold', 'q'], evidence: 'Phase 3-1精鋭辞書: スキル先出し形' },
      { name: 'Q のあと、もう一度 長押しE', role: 'supporter', slot: 10, use: ['q'], then: [{ slot: 40, use: ['e_hold'] }], evidence: 'Phase 3-1精鋭辞書: 回復先置き→後から風車形' },
    ],
  },

  // ── 雷電ナショナル（ベネット・行秋・香菱・雷電将軍）。手組み 47.6k ──
  {
    characterId: '10000032-pyro', // ベネット
    archetypes: [
      { name: 'E→Q', role: 'supporter', slot: 10, use: ['e', 'q'], evidence: 'Phase 3-1精鋭辞書＋KQM新集計(482件/27.9%, 最多): 粒子受けQ基本形' },
      { name: 'Q→E', role: 'supporter', slot: 10, use: ['q', 'e'], evidence: 'Phase 3-1精鋭辞書＋KQM新集計(75件/4.3%): 即爆発→スキル' },
      { name: 'E→Q のあと、もう一度 E', role: 'supporter', slot: 10, use: ['e', 'q'], then: [{ slot: 30, use: ['e'] }], evidence: 'Phase 3-1精鋭辞書＋KQM新集計(121件/7.0%): 2回出場粒子供給' },
      { name: 'Q だけ', role: 'supporter', slot: 20, use: ['q'], evidence: 'Phase 3-1精鋭辞書: 最短バフ形' },
    ],
  },
  {
    characterId: '10000025-hydro', // 行秋
    archetypes: [
      { name: 'E→ダッシュ→Q→N', role: 'supporter', slot: 10, use: ['e', 'dash', 'q', 'n'], evidence: 'Phase 3-1精鋭辞書: 雨簾剣維持＋水付着基本形' },
      { name: 'Q→E', role: 'supporter', slot: 20, use: ['q', 'e'], evidence: 'Phase 3-1精鋭辞書: 短縮交代形' },
      { name: 'Q→N→E→ダッシュ→N×2', role: 'supporter', slot: 10, use: ['q', 'n', 'e', 'dash', 'n', 'n'], evidence: 'Phase 3-1精鋭辞書＋KQM新集計: 祭礼/西風連動追撃形' },
      { name: 'Q→N のあと、もう一度 E→ダッシュ→N×2', role: 'supporter', slot: 10, use: ['q', 'n'], then: [{ slot: 30, use: ['e', 'dash', 'n', 'n'] }], evidence: 'Phase 3-1精鋭辞書＋KQM新集計: 2回出場型' },
    ],
  },
  {
    characterId: '10000052-electro', // 雷電将軍
    archetypes: [
      { name: '初動E→爆発中N3C→末尾E締め', role: 'attacker', slot: 40, use: ['q'], fill: ['n', 'n', 'n', 'ca'], fillRepeat: [2, 3], lead: ['e'], tail: ['e'], evidence: 'Phase 3-1精鋭辞書: 初動E(295件)＋王道N3C＋末尾E締め(42.0k)' },
      { name: '初動E→爆発中N4D→末尾E締め', role: 'attacker', slot: 40, use: ['q'], fill: ['n', 'n', 'n', 'n', 'dash'], fillRepeat: [2, 3], lead: ['e'], tail: ['e'], evidence: 'Phase 3-1精鋭辞書＋KQM新集計(151件/32.8%): N4Dループ＋末尾E締め' },
      { name: 'E・Q のあと N3C 連打', role: 'attacker', slot: 40, use: ['e', 'q'], fill: ['n', 'n', 'n', 'ca'], fillRepeat: [2, 3], evidence: 'Phase 3-1精鋭辞書: 1周完結E→Q→N3C型' },
      { name: 'E だけ（控え雷付着）', role: 'supporter', slot: 10, use: ['e'], evidence: 'Phase 3-1精鋭辞書＋KQM新集計(16件): 超開花/激化サポーター形' },
    ],
  },

  // ── 胡桃（手組みなし。Wiki の運用の要約から起こし、探索で確かめた。結果は plan.md）──
  {
    characterId: '10000046-pyro', // 胡桃
    archetypes: [
      { name: 'E のあと N1CJ 連打（0凸定番）', role: 'attacker', slot: 40, use: ['e'], fill: ['n', 'ca', 'jump'], fillRepeat: [7, 8, 9], evidence: 'Phase 3-2精鋭辞書＋KQM新集計: 0凸定番N1CJ連打形' },
      { name: 'E のあと N2CD 連打（1凸定番）', role: 'attacker', slot: 40, use: ['e'], fill: ['n', 'n', 'ca', 'dash'], fillRepeat: [8, 9, 10], constellation: { min: 1 }, evidence: 'Phase 3-2精鋭辞書＋KQM新集計: 1凸定番N2CD連打形' },
      { name: 'E のあと N1CJ 連打→末尾Q締め', role: 'attacker', slot: 40, use: ['e'], fill: ['n', 'ca', 'jump'], fillRepeat: [7, 8], tail: ['q'], evidence: 'Phase 3-2精鋭辞書＋KQM新集計: N1CJ末尾Q締め形' },
      { name: 'E のあと N2CJ 連打', role: 'attacker', slot: 40, use: ['e'], fill: ['n', 'n', 'ca', 'jump'], fillRepeat: [7, 8], evidence: 'Phase 3-2精鋭辞書＋KQM新集計: N2CJ連打形' },
    ],
  },

  // ── 胡桃の編成例の探索から（Overvape 編成。胡桃・夜蘭・コロンビーナ・イネファ）。実測は plan.md ──
  {
    characterId: '10000060-hydro', // 夜蘭
    archetypes: [
      { name: 'E→Q→N', role: 'supporter', slot: 10, use: ['e', 'q', 'n'], evidence: 'Phase 3-2精鋭辞書＋KQM新集計: 9.5% E粒子受け取りQ→N定番形' },
      { name: 'Q→N→E→N（爆発先行）', role: 'supporter', slot: 10, use: ['q', 'n', 'e', 'n'], evidence: 'Phase 3-2精鋭辞書＋KQM新集計: Q先行擲骰トリガーE→N形' },
      { name: 'E→打破重撃→Q→N', role: 'supporter', slot: 10, use: ['e', 'ca', 'q', 'n'], evidence: 'Phase 3-2精鋭辞書＋KQM新集計: 9.9% 最多打破重撃込み形' },
      { name: 'E→Q のあと、もう一度 E', role: 'supporter', slot: 10, use: ['e', 'q'], then: [{ slot: 30, use: ['e'] }], evidence: 'Phase 3-2精鋭辞書＋KQM新集計: 祭礼/2回出場E粒子回収形' },
    ],
  },
  {
    characterId: '10000116-electro', // イネファ
    archetypes: [
      { name: 'E→Q（KQM）', role: 'supporter', slot: 10, use: ['e', 'q'], constellation: { min: 0 }, evidence: 'KQM Sim Database（db.kqm.gg）の単数回の形: イネファ 165 件中 7 件。平均 457.0k（最大 1463.8k）。凸数: 使われている設定の最小は 0 凸（分布 0〜6 凸 = 5/0/0/0/0/0/2）（探索の比較なし）' },
      { name: 'E', role: 'subAttacker', slot: 20, use: ['e'], evidence: '編成例の探索（Overvape）の上位に出る形。実測: Overvape で効果は確認できず' },
    ],
  },

  // ── 激化刻晴（フィッシュル・ナヒーダ・万葉・刻晴）。手組み 54.8k ──
  {
    characterId: '10000031-electro', // フィッシュル
    archetypes: [
      { name: 'E だけ（オズ設置）', role: 'subAttacker', slot: 20, use: ['e'], evidence: 'Phase 3-1精鋭辞書: オズ設置の基本形' },
      { name: 'Q だけ（オズ再設置）', role: 'subAttacker', slot: 20, use: ['q'], evidence: 'Phase 3-1精鋭辞書: 爆発オズ再設置の基本形' },
      { name: 'E のあと、もう一度 Q', role: 'subAttacker', slot: 10, use: ['e'], then: [{ slot: 30, use: ['q'] }], evidence: 'Phase 3-1精鋭辞書: EとQをずらしてオズ常時維持' },
      { name: 'Q のあと、もう一度 E', role: 'subAttacker', slot: 10, use: ['q'], then: [{ slot: 30, use: ['e'] }], evidence: 'Phase 3-1精鋭辞書: Q先置き→後半Eでオズ維持' },
    ],
  },
  {
    characterId: '10000047-anemo', // 楓原万葉
    archetypes: [
      { name: 'E→落下→Q', role: 'supporter', slot: 10, use: ['e', 'hp', 'q'], evidence: 'Phase 3-1精鋭辞書: 翠緑拡散＋元素バフの基本形' },
      { name: 'E→落下→Q のあと、もう一度 E→落下', role: 'supporter', slot: 10, use: ['e', 'hp', 'q'], then: [{ slot: 30, use: ['e', 'hp'] }], evidence: 'Phase 3-1精鋭辞書＋KQM新集計(154件/21.7%, 最多): 2回出場翠緑更新' },
      { name: 'E→落下 のあと、もう一度 E→落下→Q', role: 'supporter', slot: 10, use: ['e', 'hp'], then: [{ slot: 30, use: ['e', 'hp', 'q'] }], evidence: 'Phase 3-1精鋭辞書＋KQM新集計(39件/5.5%): 先置き拡散→再爆発' },
      { name: 'E→落下（翠緑更新）', role: 'supporter', slot: 20, use: ['e', 'hp'], evidence: 'Phase 3-1精鋭辞書＋KQM新集計(36件/5.1%): 爆発温存・短縮形' },
    ],
  },
  {
    characterId: '10000042-electro', // 刻晴
    archetypes: [
      { name: 'E→Q→E のあと N1C 連打', role: 'attacker', slot: 40, use: ['e', 'q', 'e'], fill: ['n', 'ca'], fillRepeat: [2, 3, 4], evidence: 'Phase 3-1精鋭辞書: 激化刻晴の基本コンボ' },
      { name: 'E→Q→E→N1C×2→E のあと N1C', role: 'attacker', slot: 40, use: ['e', 'q', 'e', 'n', 'ca', 'n', 'ca', 'e'], fill: ['n', 'ca'], fillRepeat: [1, 2], evidence: 'Phase 3-1精鋭辞書＋KQM新集計: 雷怒4セットCT短縮コンボ' },
      { name: 'E×2 のあと N1C 連打', role: 'attacker', slot: 40, use: ['e', 'e'], fill: ['n', 'ca'], fillRepeat: [3, 4], evidence: 'Phase 3-1精鋭辞書: 爆発温存・スキル雷付与コンボ' },
    ],
  },

  // ── 星電導サンドローネ（八重神子・ニコ・七七・サンドローネ）。手組み 151.0k ──
  {
    characterId: '10000058-electro', // 八重神子
    archetypes: [
      { name: 'E×3', role: 'subAttacker', slot: 10, use: ['e', 'e', 'e'], evidence: 'Phase 3-1精鋭辞書＋KQM新集計(50件/18.7%, 最多): 殺生桜3本設置' },
      { name: 'E×3 のあと、もう一度 E×3', role: 'subAttacker', slot: 10, use: ['e', 'e', 'e'], then: [{ slot: 30, use: ['e', 'e', 'e'] }], evidence: 'Phase 3-1精鋭辞書＋KQM新集計(36件/13.5%): 2回出場再設置' },
      { name: 'E×3 のあと、もう一度 Q→E×3', role: 'subAttacker', slot: 10, use: ['e', 'e', 'e'], then: [{ slot: 30, use: ['q', 'e', 'e', 'e'] }], evidence: 'Phase 3-1精鋭辞書＋KQM新集計(22件/8.2%): 2回出場Q→再設置' },
      { name: 'E×3→Q→E×3', role: 'subAttacker', slot: 20, use: ['e', 'e', 'e', 'q', 'e', 'e', 'e'], evidence: 'Phase 3-1精鋭辞書: 1出場完結E×3→Q→E×3' },
    ],
  },
  {
    characterId: '10000035-cryo', // 七七
    archetypes: [
      { name: 'E だけ', role: 'supporter', slot: 20, use: ['e'], evidence: 'Phase 3-1精鋭辞書: 氷付着・回復最短形' },
      { name: 'E→Q', role: 'supporter', slot: 20, use: ['e', 'q'], evidence: 'Phase 3-1精鋭辞書＋KQM新集計: 回復＋氷付着フル形' },
      { name: 'Q→E', role: 'supporter', slot: 20, use: ['q', 'e'], evidence: 'Phase 3-1精鋭辞書: 手組み星電導サンドローネ形' },
    ],
  },
  {
    characterId: '10000131-pyro', // ニコ
    archetypes: [
      { name: 'E→Q', role: 'supporter', slot: 10, use: ['e', 'q'], evidence: 'Phase 3-1精鋭辞書: サポーター基本形' },
      { name: 'Q→E', role: 'supporter', slot: 10, use: ['q', 'e'], evidence: 'Phase 3-1精鋭辞書＋KQM新集計: 爆発先出し形' },
      { name: 'E だけ', role: 'supporter', slot: 20, use: ['e'], evidence: 'Phase 3-1精鋭辞書: 爆発省略・星電導サンドローネ実績形' },
    ],
  },
  {
    characterId: '10000133-cryo', // サンドローネ
    archetypes: [
      { name: '重撃→E→Q のあと重撃→E 連打', role: 'attacker', slot: 40, use: ['ca', 'e', 'q'], fill: ['ca', 'e'], fillRepeat: [2, 3], lead: ['e'], evidence: 'Phase 3-1精鋭辞書: 基本Q込み重撃→Eループ＋初動E早期星電導' },
      { name: '重撃→E の繰り返し（爆発なし）', role: 'attacker', slot: 40, use: [], fill: ['ca', 'e'], fillRepeat: [3, 4, 5], lead: ['e'], evidence: 'Phase 3-1精鋭辞書: 爆発なし重撃→Eループ＋初動E' },
      { name: '重撃→E×2→重撃→Q のあと重撃→E', role: 'attacker', slot: 40, use: ['ca', 'e', 'ca', 'e', 'ca', 'q'], fill: ['ca', 'e'], fillRepeat: [1, 2], evidence: 'Phase 3-1精鋭辞書: Wiki基本コンボ' },
      { name: 'E→重撃 の繰り返し', role: 'attacker', slot: 40, use: [], fill: ['e', 'ca'], fillRepeat: [3, 4], evidence: 'Phase 3-1精鋭辞書: E先行交互ループ' },
    ],
  },
  {
    characterId: '10000026-anemo',
    archetypes: [
      { name: '落下→通常1→重撃（JET）', role: 'attacker', slot: 40, use: ['q'], fill: ['hp', 'n', 'ca'], fillRepeat: [3, 4], evidence: 'Wiki 本文のコンボの記述: 落下攻撃→通常 1→重撃→落下攻撃…のコンボ（通称 JET）（探索の比較なし）' },
      { name: 'ジャンプ→E→落下の繰り返し', role: 'attacker', slot: 40, use: ['q'], fill: ['jump', 'e', 'hp'], fillRepeat: [3, 4, 5], evidence: 'Wiki 本文のコンボの記述: 爆発中の、ジャンプ→スキル→落下攻撃の基本の動き（探索の比較なし）' },
      { name: 'E×2・Q・通常攻撃・重撃のあと 落下を繰り返す', role: 'attacker', slot: 40, use: ['e', 'e', 'q', 'n', 'n', 'ca'], fill: ['jump', 'hp'], fillRepeat: [4, 5, 6], evidence: '編成例の探索（魈・閑雲・ファルザン・フリーナ）の上位に出る形。実測: 閑雲編成で 43.2k → 48.4k（207 秒）。条件なしにして、鍾離・ファルザン・ベネットの編成で 19.5k → 33.1k、鍾離・ジン・アルベドの編成で 21.5k → 21.2k（同じ）' },
      { name: 'E×2→Q→（ジャンプ→落下）×n', role: 'attacker', slot: 40, use: ['e', 'e', 'q', 'jump', 'hp'], fill: ['jump', 'hp'], fillRepeat: [4, 6, 8], constellation: { min: 0 }, evidence: 'KQM Sim Database（db.kqm.gg）の行動の形: 34 件・平均 65.7k・最大 141.0k。e×2 q jump hp（探索の比較なし）。凸数: 使われている設定の最小は 0 凸（34 件。分布 0〜6 凸 = 34/0/0/0/0/0/0）' },
    ],
  },
  {
    characterId: '10000093-anemo',
    archetypes: [
      { name: 'Q だけ', role: 'supporter', slot: 30, use: ['q'], evidence: '編成例の探索（魈・閑雲編成）の上位に出る形。実測: 魈の編成で 43.2k → 48.4k' },
      { name: 'E→HP→Q（KQM）', role: 'supporter', slot: 10, use: ['e', 'hp', 'q'], constellation: { min: 0 }, evidence: 'KQM Sim Database（db.kqm.gg）の単数回の形: 閑雲 398 件中 20 件。平均 65.1k（最大 94.6k）。凸数: 使われている設定の最小は 0 凸（分布 0〜6 凸 = 20/0/0/0/0/0/0）（探索の比較なし）' },
      { name: 'E→LP→Q のあと、もう一度 N×2', role: 'supporter', slot: 10, use: ['e', 'lp', 'q'], then: [{ slot: 30, use: ['n', 'n'] }], constellation: { min: 0 }, evidence: 'KQM Sim Database（db.kqm.gg）の複数回出場の形: 閑雲 398 件中 22 件。平均 62.8k（最大 83.1k）。凸数: 使われている設定の最小は 0 凸（分布 0〜6 凸 = 22/0/0/0/0/0/0）（探索の比較なし）' },
      { name: 'e→lp→n→q', role: 'supporter', slot: 30, use: ['e', 'lp', 'n', 'q'], constellation: { min: 0 }, evidence: 'KQM Sim Database（db.kqm.gg）の行動の形: 38 件・平均 58.8k・最大 90.8k。e lp n q（探索の比較なし）。凸数: 使われている設定の最小は 0 凸（38 件。分布 0〜6 凸 = 38/0/0/0/0/0/0）' },
      { name: 'e→lp→q', role: 'supporter', slot: 30, use: ['e', 'lp', 'q'], constellation: { min: 0 }, evidence: 'KQM Sim Database（db.kqm.gg）の行動の形: 241 件・平均 76.5k・最大 663.6k。e lp q（探索の比較なし）。凸数: 使われている設定の最小は 0 凸（241 件。分布 0〜6 凸 = 232/0/9/0/0/0/0）' },
    ],
  },
  {
    characterId: '10000076-anemo',
    archetypes: [
      { name: 'E→CA→Q（KQM）', role: 'supporter', slot: 10, use: ['e', 'ca', 'q'], evidence: 'KQM Sim Database（db.kqm.gg）の単数回の形: ファルザン 195 件中 9 件。平均 46.3k（最大 53.0k）。凸数: 使われている設定の最小は 6 凸（分布 0〜6 凸 = 0/0/0/0/0/0/9）（探索の比較なし）' },
      { name: 'E と Q', role: 'supporter', slot: 20, use: ['e', 'q'], evidence: '編成例の探索（ウェンティ・ドゥリン・ファルザン・ニコ）の上位に出る形。実測: 55.8k → 54.6k ±4.6（誤差）。時間 243 → 175 秒' },
      { name: 'E→重撃2→Q', role: 'supporter', slot: 10, use: ['e', 'ca', 'ca', 'q'], constellation: { min: 1 }, evidence: 'Wiki 本文のコンボの記述: 1 凸すれば、スキル直当て→特殊重撃×2→爆発（探索の比較なし）' },
      { name: 'E→Q のあと、もう一度 E→CA', role: 'supporter', slot: 10, use: ['e', 'q'], then: [{ slot: 30, use: ['e', 'ca'] }], evidence: 'KQM Sim Database（db.kqm.gg）の複数回出場の形: ファルザン 195 件中 6 件。平均 52.4k（最大 56.3k）。凸数: 使われている設定の最小は 6 凸（分布 0〜6 凸 = 0/0/0/0/0/0/6）（探索の比較なし）' },
      { name: 'Q（KQM）', role: 'supporter', slot: 10, use: ['q'], constellation: { min: 6 }, evidence: 'KQM Sim Database（db.kqm.gg）の単数回の形: ファルザン 195 件中 25 件。平均 73.5k（最大 207.5k）。凸数: 使われている設定の最小は 6 凸（分布 0〜6 凸 = 0/0/0/0/0/0/25）（探索の比較なし）' },
    ],
  },
  {
    characterId: '10000096-pyro',
    archetypes: [
      { name: '先置きE のあと CA回収→N3D連打（命の契約王道）', role: 'attacker', slot: 10, use: ['e'], then: [{ slot: 40, use: ['ca'] }], fill: ['n', 'n', 'n', 'dash'], fillRepeat: [4, 5, 6], evidence: 'Phase 3-2精鋭辞書＋KQM新集計: 命の契約CA回収→N3D王道形' },
      { name: '初動E→CA回収→N3D連打→末尾E', role: 'attacker', slot: 40, use: ['ca'], fill: ['n', 'n', 'n', 'dash'], fillRepeat: [4, 5, 6], lead: ['e'], tail: ['e'], evidence: 'Phase 3-2精鋭辞書＋KQM新集計: 初動E＋末尾E次周繋ぎ形' },
      { name: '先置きE のあと CA回収→通常連打', role: 'attacker', slot: 10, use: ['e'], then: [{ slot: 40, use: ['ca'] }], fill: ['n', 'n', 'n'], fillRepeat: [4, 5, 6], evidence: 'Phase 3-2精鋭辞書＋KQM新集計: ダッシュ省略通常連打形' },
      { name: 'Q→E のあと CA回収→N3D連打（回復リセット型）', role: 'attacker', slot: 10, use: ['q', 'e'], then: [{ slot: 40, use: ['ca'] }], fill: ['n', 'n', 'n', 'dash'], fillRepeat: [4, 5], evidence: 'Phase 3-2精鋭辞書＋KQM新集計: Q回復リセット＋N3D連打形' },
    ],
  },
  {
    characterId: '10000003-anemo',
    archetypes: [
      { name: 'E→Q', role: 'supporter', slot: 10, use: ['e', 'q'], evidence: 'Wiki 本文のコンボの記述: 他キャラのスキル→ジンに交代して受け取り→スキル→爆発（探索の比較なし）' },
      { name: 'E だけ', role: 'supporter', slot: 10, use: ['e'], evidence: '編成例の探索（宵宮・雲菫・ミカ・ジン）の上位に出る形。実測: 24.2k → 23.5k（誤差）。時間 134 → 96 秒' },
      { name: 'E→Q のあと、もう一度 E→N', role: 'supporter', slot: 10, use: ['e', 'q'], then: [{ slot: 30, use: ['e', 'n'] }], constellation: { min: 0 }, requiresFavonius: true, evidence: 'KQM Sim Database（db.kqm.gg）の複数回出場の形: ジン 117 件中 9 件。平均 56.1k（最大 81.3k）。凸数: 使われている設定の最小は 0 凸（分布 0〜6 凸 = 9/0/0/0/0/0/0）（探索の比較なし）' },
      { name: 'E→Q のあと、もう一度 E', role: 'supporter', slot: 10, use: ['e', 'q'], then: [{ slot: 30, use: ['e'] }], constellation: { min: 0 }, evidence: 'KQM Sim Database（db.kqm.gg）の複数回出場の形: ジン 117 件中 7 件。平均 47.6k（最大 53.0k）。凸数: 使われている設定の最小は 0 凸（分布 0〜6 凸 = 7/0/0/0/0/0/0）（探索の比較なし）' },
      { name: 'E→Q のあと、もう一度 N→E', role: 'supporter', slot: 10, use: ['e', 'q'], then: [{ slot: 30, use: ['n', 'e'] }], constellation: { min: 0 }, requiresFavonius: true, evidence: 'KQM Sim Database（db.kqm.gg）の複数回出場の形: ジン 117 件中 6 件。平均 53.6k（最大 77.7k）。凸数: 使われている設定の最小は 0 凸（分布 0〜6 凸 = 6/0/0/0/0/0/0）（探索の比較なし）' },
      { name: 'E→Q のあと、もう一度 E→N×2', role: 'supporter', slot: 10, use: ['e', 'q'], then: [{ slot: 30, use: ['e', 'n', 'n'] }], constellation: { min: 0 }, evidence: 'KQM Sim Database（db.kqm.gg）の複数回出場の形: ジン 117 件中 6 件。平均 52.1k（最大 67.3k）。凸数: 使われている設定の最小は 0 凸（分布 0〜6 凸 = 6/0/0/0/0/0/0）（探索の比較なし）' },
    ],
  },
  {
    characterId: '10000080-cryo',
    archetypes: [
      { name: '長押し E', role: 'supporter', slot: 20, use: ['e_hold'], evidence: '編成例の探索（宵宮・雲菫・ミカ・ジン）の上位に出る形。実測: 24.2k → 23.5k（誤差）。時間 134 → 96 秒' },
      { name: 'N→Q→E（KQM）', role: 'supporter', slot: 10, use: ['n', 'q', 'e'], requiresFavonius: true, evidence: 'KQM Sim Database（db.kqm.gg）の単数回の形: ミカ 84 件中 4 件。平均 85.1k（最大 112.6k）。凸数: 使われている設定の最小は 6 凸（分布 0〜6 凸 = 0/0/0/0/0/0/4）（探索の比較なし）' },
      { name: 'Q→N→E→N（KQM）', role: 'supporter', slot: 10, use: ['q', 'n', 'e', 'n'], requiresFavonius: true, evidence: 'KQM Sim Database（db.kqm.gg）の単数回の形: ミカ 84 件中 3 件。平均 50.9k（最大 58.3k）。凸数: 使われている設定の最小は 6 凸（分布 0〜6 凸 = 0/0/0/0/0/0/3）（探索の比較なし）' },
      { name: 'E→N→Q（KQM）', role: 'supporter', slot: 10, use: ['e', 'n', 'q'], evidence: 'KQM Sim Database（db.kqm.gg）の単数回の形: ミカ 84 件中 3 件。平均 36.4k（最大 50.3k）。凸数: 使われている設定の最小は 6 凸（分布 0〜6 凸 = 0/0/0/0/0/0/3）（探索の比較なし）' },
      { name: 'Q のあと、もう一度 E→N', role: 'supporter', slot: 10, use: ['q'], then: [{ slot: 30, use: ['e', 'n'] }], requiresFavonius: true, evidence: 'KQM Sim Database（db.kqm.gg）の複数回出場の形: ミカ 84 件中 5 件。平均 52.7k（最大 61.3k）。凸数: 使われている設定の最小は 6 凸（分布 0〜6 凸 = 0/0/0/0/0/0/5）（探索の比較なし）' },
      { name: 'Q のあと、もう一度 N→E', role: 'supporter', slot: 10, use: ['q'], then: [{ slot: 30, use: ['n', 'e'] }], requiresFavonius: true, evidence: 'KQM Sim Database（db.kqm.gg）の複数回出場の形: ミカ 84 件中 4 件。平均 50.1k（最大 56.0k）。凸数: 使われている設定の最小は 6 凸（分布 0〜6 凸 = 0/0/0/0/0/0/4）（探索の比較なし）' },
      { name: 'Q→E（KQM）', role: 'supporter', slot: 10, use: ['q', 'e'], constellation: { min: 1 }, evidence: 'KQM Sim Database（db.kqm.gg）の単数回の形: ミカ 84 件中 12 件。平均 59.7k（最大 156.0k）。凸数: 使われている設定の最小は 1 凸（分布 0〜6 凸 = 0/1/0/0/0/0/11）（探索の比較なし）' },
      { name: 'q→n→e', role: 'supporter', slot: 20, use: ['q', 'n', 'e'], requiresFavonius: true, evidence: 'KQM Sim Database（db.kqm.gg）の行動の形: 16 件・平均 54.8k・最大 98.5k。q n e（探索の比較なし）。凸数: 使われている設定の最小は 6 凸（16 件。分布 0〜6 凸 = 0/0/0/0/0/0/16）' },
    ],
  },
  {
    characterId: '10000064-geo',
    archetypes: [
      { name: 'E と Q', role: 'supporter', slot: 30, use: ['e', 'q'], evidence: '編成例の探索（宵宮・雲菫・ミカ・ジン）の上位に出る形。実測: 24.2k → 23.5k（誤差）。時間 134 → 96 秒' },
      { name: 'E→N→Q（KQM）', role: 'supporter', slot: 10, use: ['e', 'n', 'q'], evidence: 'KQM Sim Database（db.kqm.gg）の単数回の形: 雲菫 73 件中 3 件。平均 49.7k（最大 57.7k）。凸数: 使われている設定の最小は 6 凸（分布 0〜6 凸 = 0/0/0/0/0/0/3）（探索の比較なし）' },
    ],
  },
  {
    characterId: '10000049-pyro',
    archetypes: [
      { name: 'E のあと N5D×3→末尾Q締め（KQM最多）', role: 'attacker', slot: 40, use: ['e'], fill: ['n', 'n', 'n', 'n', 'n', 'dash'], fillRepeat: [3], tail: ['q'], evidence: 'Phase 3-2精鋭辞書＋KQM新集計: 32.4% 最多E→N5D×3→末尾Q形' },
      { name: 'E のあと N5D 連打（しめ縄4・爆発なし）', role: 'attacker', slot: 40, use: ['e'], fill: ['n', 'n', 'n', 'n', 'n', 'dash'], fillRepeat: [2, 3], evidence: 'Phase 3-2精鋭辞書＋KQM新集計: 16.9% しめ縄4爆発省略N5D形' },
      { name: 'E のあと通常5段連打', role: 'attacker', slot: 40, use: ['e'], fill: ['n', 'n', 'n', 'n', 'n'], fillRepeat: [3], evidence: 'Phase 3-2精鋭辞書＋KQM新集計: キャンセル無し通常5段連打形' },
      { name: '先置きQ のあと E→N5D 連打', role: 'attacker', slot: 10, use: ['q'], then: [{ slot: 40, use: ['e'] }], fill: ['n', 'n', 'n', 'n', 'n', 'dash'], fillRepeat: [3], evidence: 'Phase 3-2精鋭辞書＋KQM新集計: 蒼翠/爆発先置きE→N5D形' },
    ],
  },
  {
    characterId: '10000103-geo',
    archetypes: [
      { name: 'E→N×2（サンプル起動・定番）', role: 'supporter', slot: 10, use: ['e', 'n', 'n'], evidence: 'Phase 3-2精鋭辞書＋KQM新集計: 26.6% 最多サンプル起動定番形' },
      { name: 'E→N×2→Q（デバフ＋回復）', role: 'supporter', slot: 10, use: ['e', 'n', 'n', 'q'], evidence: 'Phase 3-2精鋭辞書＋KQM新集計: デバフ＋回復Q込み形' },
      { name: 'E→N×2 のあと、もう一度 E→N×2', role: 'supporter', slot: 10, use: ['e', 'n', 'n'], then: [{ slot: 30, use: ['e', 'n', 'n'] }], evidence: 'Phase 3-2精鋭辞書＋KQM新集計: 19.5% 2回出場粒子・結晶更新形' },
      { name: 'E→N×2→Q のあと、もう一度 E→N×2', role: 'supporter', slot: 10, use: ['e', 'n', 'n', 'q'], then: [{ slot: 30, use: ['e', 'n', 'n'] }], evidence: 'Phase 3-2精鋭辞書＋KQM新集計: 7.4% Q込み2回出場形' },
    ],
  },
  {
    characterId: '10000105-electro',
    archetypes: [
      { name: 'Q だけ', role: 'supporter', slot: 30, use: ['q'], evidence: '編成例の探索（ヌヴィレット・オロルン・楓原万葉・鍾離）の上位に出る形。実測: 31.1k → 32.9k。時間 239 → 197 秒' },
    
      { name: 'E と Q', role: 'supporter', slot: 30, use: ['e', 'q'], evidence: '編成例の探索（ナヴィア・シロネン・フリーナ・オロルン）の上位に出る形。実測: 50.4k → 52.1k。時間 345 → 152 秒' },
      { name: 'N→E→Q（KQM）', role: 'subAttacker', slot: 20, use: ['n', 'e', 'q'], evidence: 'KQM Sim Database（db.kqm.gg）の単数回の形: オロルン 257 件中 9 件。平均 61.3k（最大 67.2k）。凸数: 使われている設定の最小は 6 凸（分布 0〜6 凸 = 0/0/0/0/0/0/9）（探索の比較なし）' },
      { name: 'Q→E（KQM）', role: 'subAttacker', slot: 20, use: ['q', 'e'], evidence: 'KQM Sim Database（db.kqm.gg）の単数回の形: オロルン 257 件中 50 件。平均 74.9k（最大 484.4k）。凸数: 使われている設定の最小は 6 凸（分布 0〜6 凸 = 0/0/0/0/0/0/50）（探索の比較なし）' },
      { name: 'E→N→Q（KQM）', role: 'subAttacker', slot: 20, use: ['e', 'n', 'q'], requiresFavonius: true, evidence: 'KQM Sim Database（db.kqm.gg）の単数回の形: オロルン 257 件中 14 件。平均 65.9k（最大 81.2k）。凸数: 使われている設定の最小は 6 凸（分布 0〜6 凸 = 0/0/0/0/0/0/14）（探索の比較なし）' },
      { name: 'E→Q→N（KQM）', role: 'subAttacker', slot: 20, use: ['e', 'q', 'n'], evidence: 'KQM Sim Database（db.kqm.gg）の単数回の形: オロルン 257 件中 11 件。平均 75.8k（最大 108.8k）。凸数: 使われている設定の最小は 6 凸（分布 0〜6 凸 = 0/0/0/0/0/0/11）（探索の比較なし）' },
      { name: 'E→Q のあと、もう一度 E→Q', role: 'supporter', slot: 10, use: ['e', 'q'], then: [{ slot: 30, use: ['e', 'q'] }], evidence: 'KQM Sim Database（db.kqm.gg）の複数回出場の形: オロルン 257 件中 10 件。平均 117.0k（最大 424.4k）。凸数: 使われている設定の最小は 6 凸（分布 0〜6 凸 = 0/0/0/0/0/0/10）（探索の比較なし）' },
    ],
  },
  {
    characterId: '10000091-geo',
    archetypes: [
      { name: 'E→通常→E', role: 'attacker', slot: 40, use: ['e', 'n', 'e'], fill: ['n'], fillRepeat: [8, 10, 12], evidence: 'Wiki 本文のコンボの記述: スキル→通常→スキルと繋ぐと、最大スタックで戦える（探索の比較なし）' },
      { name: 'Q・長押し E 2 回・通常攻撃', role: 'attacker', slot: 40, use: ['q', 'e_hold@4.41', 'e_hold', 'n', 'dash', 'n'], evidence: '編成例の探索（ナヴィア・シロネン・フリーナ・オロルン）の上位に出る形。実測: 50.4k → 52.1k。時間 345 → 152 秒' },
      { name: 'e_hold→n×3→dash→n×2', role: 'attacker', slot: 40, use: ['e_hold', 'n', 'n', 'n', 'dash', 'n', 'n'], constellation: { min: 0 }, evidence: 'KQM Sim Database（db.kqm.gg）の行動の形: 56 件・平均 61.9k・最大 84.0k。e_hold n×3 dash n×2（探索の比較なし）。凸数: 使われている設定の最小は 0 凸（56 件。分布 0〜6 凸 = 56/0/0/0/0/0/0）' },
    ],
  },
  {
    characterId: '10000022-anemo',
    archetypes: [
      { name: 'E→Q', role: 'supporter', slot: 10, use: ['e', 'q'], evidence: 'Phase 3-2精鋭辞書＋KQM新集計: 17.5% 基本E粒子受け取りQ形' },
      { name: 'E→Q のあと、もう一度 E', role: 'supporter', slot: 10, use: ['e', 'q'], then: [{ slot: 30, use: ['e'] }], evidence: 'Phase 3-2精鋭辞書＋KQM新集計: 54.0% 最多2回出場E粒子回収形' },
      { name: 'E だけ', role: 'supporter', slot: 20, use: ['e'], evidence: 'Phase 3-2精鋭辞書＋KQM新集計: 爆発省略時短翠緑拡散形' },
    ],
  },
  {
    characterId: '10000123-pyro',
    archetypes: [
      { name: 'E→Q', role: 'subAttacker', slot: 20, use: ['e', 'q'], evidence: 'Wiki 本文のコンボの記述: スキル始動→爆発→急降下か爪攻撃（探索の比較なし）' },
      { name: 'E×2・Q のあと 通常攻撃 2 回 + 重撃を繰り返す', role: 'attacker', slot: 40, use: ['e', 'e', 'q'], fill: ['n', 'n', 'ca'], fillRepeat: [3, 4, 5], evidence: '編成例の探索（ウェンティ・ドゥリン・ファルザン・ニコ）の上位に出る形。実測: 55.8k → 54.6k ±4.6（誤差）。時間 243 → 175 秒' },
      { name: 'E→Q→E（KQM）', role: 'subAttacker', slot: 20, use: ['e', 'q', 'e'], constellation: { min: 0 }, evidence: 'KQM Sim Database（db.kqm.gg）の単数回の形: ドゥリン 298 件中 40 件。平均 333.6k（最大 1815.0k）。凸数: 使われている設定の最小は 0 凸（分布 0〜6 凸 = 32/0/0/0/0/0/8）（探索の比較なし）' },
      { name: 'e→n→q', role: 'subAttacker', slot: 20, use: ['e', 'n', 'q'], constellation: { min: 0 }, evidence: 'KQM Sim Database（db.kqm.gg）の行動の形: 41 件・平均 123.7k・最大 1279.7k。e n q（探索の比較なし）。凸数: 使われている設定の最小は 0 凸（41 件。分布 0〜6 凸 = 39/0/1/0/0/0/1）' },
    ],
  },
  {
    characterId: '10000030-geo',
    archetypes: [
      { name: '長押しE→ダッシュ（シールド定番）', role: 'supporter', slot: 10, use: ['e_hold', 'dash'], evidence: 'Phase 3-2精鋭辞書＋KQM新集計: 9.7% 硬直ダッシュキャンセル定番形' },
      { name: '長押しE→ダッシュ→N（西風粒子）', role: 'supporter', slot: 10, use: ['e_hold', 'dash', 'n'], evidence: 'Phase 3-2精鋭辞書＋KQM新集計: 14.5% 最多西風粒子トリガー形' },
      { name: '長押しE だけ', role: 'supporter', slot: 10, use: ['e_hold'], evidence: 'Phase 3-2精鋭辞書＋KQM新集計: 最短シールド展開形' },
      { name: '長押しE→ダッシュ→Q', role: 'supporter', slot: 10, use: ['e_hold', 'dash', 'q'], evidence: 'Phase 3-2精鋭辞書＋KQM新集計: 岩共鳴/石化Q込み形' },
    ],
  },
  {
    characterId: '10000087-hydro',
    archetypes: [
      { name: 'E→Q のあと特殊重撃連打', role: 'attacker', slot: 40, use: ['e', 'q'], fill: ['ca'], fillRepeat: [3, 4], evidence: 'Phase 3-2精鋭辞書＋KQM新集計: 基本Q込み特殊重撃ループ' },
      { name: '先置きE のあと CA→Q→E→重撃連打', role: 'attacker', slot: 10, use: ['e'], then: [{ slot: 40, use: ['ca', 'q', 'e'] }], fill: ['ca'], fillRepeat: [2, 3], evidence: 'Phase 3-2精鋭辞書＋KQM新集計: 先置きEからの雫回収重撃ループ' },
      { name: 'E → CA→Q→E→CA → CA×2（雫4重撃）', role: 'attacker', slot: 10, use: ['e'], then: [{ slot: 30, use: ['ca', 'q', 'e', 'ca'] }, { slot: 40, use: ['ca', 'ca'] }], evidence: 'Phase 3-2精鋭辞書＋KQM新集計: 24.9% 雫4重撃分割形' },
      { name: 'E → CA→E→CA→Q → CA×2（KQM最多33%）', role: 'attacker', slot: 10, use: ['e'], then: [{ slot: 30, use: ['ca', 'e', 'ca', 'q'] }, { slot: 40, use: ['ca', 'ca'] }], evidence: 'Phase 3-2精鋭辞書＋KQM新集計: 33.4% 最多雫4重撃分割形' },
    ],
  },
  {
    characterId: '10000066-hydro',
    archetypes: [
      { name: '先置きQ のあと E→通常連打', role: 'attacker', slot: 10, use: ['q'], then: [{ slot: 40, use: ['e'] }], fill: ['n'], fillRepeat: [13, 15, 16], evidence: 'Phase 3-2精鋭辞書＋KQM新集計: 28.0% 最多先置きQ→E通常連打形' },
      { name: 'Q→E のあと通常連打', role: 'attacker', slot: 40, use: ['q', 'e'], fill: ['n'], fillRepeat: [13, 15, 16], evidence: 'Phase 3-2精鋭辞書＋KQM新集計: Q→E連続通常連打形' },
      { name: 'E のあと通常連打（爆発温存）', role: 'attacker', slot: 40, use: ['e'], fill: ['n'], fillRepeat: [13, 15, 16], evidence: 'Phase 3-2精鋭辞書＋KQM新集計: 爆発温存E通常連打形' },
      { name: '初動Q→E通常連打→末尾Q締め', role: 'attacker', slot: 40, use: ['e'], fill: ['n'], fillRepeat: [13, 15], lead: ['q'], tail: ['q'], evidence: 'Phase 3-2精鋭辞書＋KQM新集計: 19.5% 初動Q＋末尾Q締め形' },
    ],
  },
  {
    characterId: '10000112-cryo',
    archetypes: [
      { name: 'E だけ', role: 'supporter', slot: 30, use: ['e'], evidence: '編成例の探索（綾人・フリーナ・シトラリ・エスコフィエ）の上位に出る形。実測: 最短の設定で 44.5k → 44.5k（同じ）' },
      { name: 'E→Q（KQM）', role: 'supporter', slot: 10, use: ['e', 'q'], constellation: { min: 0 }, evidence: 'KQM Sim Database（db.kqm.gg）の単数回の形: エスコフィエ 426 件中 111 件。平均 120.0k（最大 980.5k）。凸数: 使われている設定の最小は 0 凸（分布 0〜6 凸 = 102/0/0/0/0/0/9）（探索の比較なし）' },
      { name: 'E→N→Q（KQM）', role: 'supporter', slot: 10, use: ['e', 'n', 'q'], constellation: { min: 0 }, requiresFavonius: true, evidence: 'KQM Sim Database（db.kqm.gg）の単数回の形: エスコフィエ 426 件中 35 件。平均 80.3k（最大 130.4k）。凸数: 使われている設定の最小は 0 凸（分布 0〜6 凸 = 35/0/0/0/0/0/0）（探索の比較なし）' },
      { name: 'E→N→Q→N（KQM）', role: 'supporter', slot: 10, use: ['e', 'n', 'q', 'n'], constellation: { min: 0 }, evidence: 'KQM Sim Database（db.kqm.gg）の単数回の形: エスコフィエ 426 件中 15 件。平均 87.5k（最大 108.4k）。凸数: 使われている設定の最小は 0 凸（分布 0〜6 凸 = 15/0/0/0/0/0/0）（探索の比較なし）' },
    ],
  },
  {
    characterId: '10000078-dendro',
    archetypes: [
      { name: 'Q のあと N3D 連打（鏡3枚スタート）', role: 'attacker', slot: 40, use: ['q'], fill: ['n', 'n', 'n', 'dash'], fillRepeat: [3, 4, 5], evidence: 'Phase 3-2精鋭辞書＋KQM新集計: Q鏡3枚N3D連打形' },
      { name: 'Q→N3D のあと、もう一度 長押しE→落下→N3D（分割運用）', role: 'attacker', slot: 20, use: ['q', 'n', 'n', 'n', 'dash', 'n', 'n', 'n'], then: [{ slot: 40, use: ['e_hold', 'lp'] }], fill: ['n', 'n', 'n', 'dash'], fillRepeat: [2, 3], evidence: 'Phase 3-2精鋭辞書＋KQM新集計: Q始動→途中再出場の分割鏡維持形' },
      { name: '長押しE→落下 のあと N3D 連打', role: 'attacker', slot: 40, use: ['e_hold', 'lp'], fill: ['n', 'n', 'n', 'dash'], fillRepeat: [3, 4], evidence: 'Phase 3-2精鋭辞書＋KQM新集計: 爆発省略長押しE落下N3D形' },
      { name: 'Q→E→重撃 のあと N3D 連打', role: 'attacker', slot: 40, use: ['q', 'e', 'ca'], fill: ['n', 'n', 'n', 'dash'], fillRepeat: [3, 4], evidence: 'Phase 3-2精鋭辞書＋KQM新集計: 鏡補充N3D連打形' },
    ],
  },
  {
    characterId: '10000065-electro',
    archetypes: [
      { name: 'E だけ', role: 'supporter', slot: 30, use: ['e'], evidence: '編成例の探索（アルハイゼン・久岐忍・鍾離・ナヒーダ）の上位に出る形。実測: 最短の設定で 41.2k → 40.2k ±2.9（誤差）' },
      { name: 'E→N→Q（KQM）', role: 'supporter', slot: 10, use: ['e', 'n', 'q'], evidence: 'KQM Sim Database（db.kqm.gg）の単数回の形: 久岐忍 257 件中 8 件。平均 63.8k（最大 104.9k）。凸数: 使われている設定の最小は 4 凸（分布 0〜6 凸 = 0/0/0/0/1/0/7）（探索の比較なし）' },
      { name: 'E→N（KQM）', role: 'supporter', slot: 10, use: ['e', 'n'], constellation: { min: 2 }, evidence: 'KQM Sim Database（db.kqm.gg）の単数回の形: 久岐忍 257 件中 22 件。平均 51.7k（最大 84.9k）。凸数: 使われている設定の最小は 2 凸（分布 0〜6 凸 = 0/0/1/0/0/0/21）（探索の比較なし）' },
      { name: 'N→E（KQM）', role: 'supporter', slot: 10, use: ['n', 'e'], evidence: 'KQM Sim Database（db.kqm.gg）の単数回の形: 久岐忍 257 件中 11 件。平均 58.6k（最大 71.6k）。凸数: 使われている設定の最小は 6 凸（分布 0〜6 凸 = 0/0/0/0/0/0/11）（探索の比較なし）' },
      { name: 'E→N のあと、もう一度 Q→N', role: 'supporter', slot: 10, use: ['e', 'n'], then: [{ slot: 30, use: ['q', 'n'] }], constellation: { min: 0 }, evidence: 'KQM Sim Database（db.kqm.gg）の複数回出場の形: 久岐忍 257 件中 32 件。平均 76.4k（最大 81.6k）（探索の比較なし）。凸数: 使われている設定の最小は 0 凸（83 件。分布 0〜6 凸 = 3/0/1/0/0/0/79）' },
    ],
  },
  {
    characterId: '10000111-electro',
    archetypes: [
      { name: '公式推奨コンボ（E→重撃→落下→E→重撃→落下→Q）×2', role: 'attacker', slot: 40, use: ['e', 'ca', 'hp', 'e', 'ca', 'hp', 'q'], fill: ['e', 'ca', 'hp', 'e', 'ca', 'hp', 'q'], fillRepeat: [1], evidence: 'Wiki 本文の「コンボについて」: (元素スキル→重撃→落下攻撃→元素スキル→重撃→落下攻撃→元素爆発)×2 セット（EAAEAAQ の表記）。公式チュートリアルの推奨' },
      { name: '先頭 N・E×2・Q のあと 重撃 + 落下を繰り返す', role: 'attacker', slot: 40, use: ['e', 'e', 'q'], fill: ['ca', 'hp'], fillRepeat: [3, 4], lead: ['n'], evidence: '編成例の探索（ヴァレサ・イアンサ・閑雲・フリーナ）の上位に出る形。実測: 最短の設定で 32.1k → 32.1k（同じ）' },
      { name: 'N（KQM）', role: 'attacker', slot: 40, use: ['n'], constellation: { min: 0 }, evidence: 'KQM Sim Database（db.kqm.gg）の単数回の形: ヴァレサ 79 件中 11 件。平均 202.1k（最大 1245.5k）。凸数: 使われている設定の最小は 0 凸（分布 0〜6 凸 = 10/0/0/0/0/0/1）（探索の比較なし）' },
    ],
  },
  {
    characterId: '10000110-electro',
    archetypes: [
      { name: 'E→重撃→Q', role: 'supporter', slot: 20, use: ['e', 'ca', 'q'], evidence: 'Wiki 本文のコンボの記述: 特殊重撃の命中で固有天賦（攻撃力アップ・夜魂回復）が発動するため、スキル→重撃→爆発が基本（探索の比較なし）' },
      { name: 'E と Q', role: 'supporter', slot: 20, use: ['e', 'q'], evidence: '編成例の探索（ヴァレサ・イアンサ・閑雲・フリーナ）の上位に出る形。実測: 最短の設定で 32.1k → 32.1k（同じ）' },
      { name: 'E→重撃', role: 'attacker', slot: 40, use: ['e', 'ca'], evidence: 'Wiki 本文のコンボの記述: 特殊重撃の命中で固有天賦が発動するので、スキル→重撃を心がける（探索の比較なし）' },
    ],
  },
  {
    characterId: '10000120-electro',
    archetypes: [
      { name: 'E→N→E→Q のあと通常＋E→Q ループ', role: 'attacker', slot: 40, use: ['e', 'n', 'e', 'q'], fill: ['n', 'n', 'n', 'n', 'dash', 'n', 'n', 'e', 'n', 'q'], fillRepeat: [1, 2], evidence: 'Phase 3-2精鋭辞書＋KQM新集計: 特殊スキル→特殊爆発月感電ループ' },
      { name: 'E→E→Q のあと N×4→E→Q ループ', role: 'attacker', slot: 40, use: ['e', 'e', 'q'], fill: ['n', 'n', 'n', 'n', 'e', 'q'], fillRepeat: [1, 2], evidence: 'Phase 3-2精鋭辞書＋KQM新集計: シンプル特殊E→Qループ' },
      { name: 'Q→E のあと N2C 連打', role: 'attacker', slot: 40, use: ['q', 'e'], fill: ['n', 'n', 'ca'], fillRepeat: [3, 4], evidence: 'Phase 3-2精鋭辞書＋KQM新集計: Q始動N2C連打形' },
    ],
  },
  {
    characterId: '10000043-anemo',
    archetypes: [
      { name: 'E→ダッシュ→Q（翠緑＋熟知バフ）', role: 'supporter', slot: 20, use: ['e', 'dash', 'q'], evidence: 'Phase 3-2精鋭辞書＋KQM新集計: 6.0% 最多翠緑＋熟知バフ形' },
      { name: 'E→ダッシュ（時短拡散）', role: 'supporter', slot: 20, use: ['e', 'dash'], evidence: 'Phase 3-2精鋭辞書＋KQM新集計: 爆発省略時短拡散形' },
      { name: 'N→E→ダッシュ（拡散トリガー）', role: 'supporter', slot: 20, use: ['n', 'e', 'dash'], evidence: 'Phase 3-2精鋭辞書＋KQM新集計: 通常付着からの翠緑拡散形' },
      { name: 'E→Q のあと N2C 連打（ドライバー）', role: 'attacker', slot: 40, use: ['e', 'q'], fill: ['n', 'n', 'ca'], fillRepeat: [3, 4], evidence: 'Phase 3-2精鋭辞書＋KQM新集計: 感電/開花ドライバー形' },
    ],
  },
  {
    characterId: '10000071-electro',
    archetypes: [
      { name: 'E→Q→通常3→E のあと 通常5→E を繰り返す', role: 'attacker', slot: 40, use: ['e', 'q', 'n', 'n', 'n', 'e'], fill: ['n', 'n', 'n', 'n', 'n', 'e'], fillRepeat: [2, 3], evidence: 'Wiki 本文のコンボの記述: スキル→爆発のあと、3 回攻撃→スキル、あとは 5 回攻撃→スキルを繰り返す（探索の比較なし）' },
      { name: 'E・Q のあと 通常攻撃を繰り返す', role: 'attacker', slot: 40, use: ['e', 'q'], fill: ['n'], fillRepeat: [9, 10, 12], evidence: '編成例の探索（セノ・ナヒーダ・行秋・久岐忍）の上位に出る形。実測: 最短の設定で 38.4k → 37.8k（誤差）' },
      { name: 'E→Q→N→E→N×4→E（KQM）', role: 'attacker', slot: 40, use: ['e', 'q', 'n', 'e', 'n', 'n', 'n', 'n', 'e'], constellation: { min: 0 }, evidence: 'KQM Sim Database（db.kqm.gg）の単数回の形: セノ 104 件中 5 件。平均 61.1k（最大 62.6k）。凸数: 使われている設定の最小は 0 凸（分布 0〜6 凸 = 5/0/0/0/0/0/0）（探索の比較なし）' },
      { name: '通常4→E の繰り返し（1 凸・雷怒 4）', role: 'attacker', slot: 40, use: [], fill: ['n', 'n', 'n', 'n', 'e'], fillRepeat: [4, 5, 6], constellation: { min: 1 }, evidence: 'Wiki 本文のコンボの記述: 1 凸と雷怒 4 セットで可能になる、通常 4 段→スキルのループ（探索の比較なし）' },
    ],
  },
  {
    characterId: '10000085-cryo',
    archetypes: [
      { name: 'E・通常攻撃のあと 通常攻撃を繰り返す', role: 'attacker', slot: 40, use: ['e', 'n'], fill: ['n'], fillRepeat: [12, 14, 16], evidence: '編成例の探索（フレミネ・イネファ・フリーナ・エスコフィエ）の上位に出る形。実測: 最短の設定で 59.3k → 59.3k（同じ）' },
      { name: 'E→N×4→E→DASH×3（KQM）', role: 'attacker', slot: 40, use: ['e', 'n', 'n', 'n', 'n', 'e', 'dash', 'dash', 'dash'], evidence: 'KQM Sim Database（db.kqm.gg）の単数回の形: フレミネ 110 件中 7 件。平均 56.2k（最大 60.6k）。凸数: 使われている設定の最小は 6 凸（分布 0〜6 凸 = 0/0/0/0/0/0/7）（探索の比較なし）' },
      { name: 'E→N→Q→N×2→E×2→N×2→E→N×2→E→N×2→E→N×2→E→N×3→E（KQM）', role: 'attacker', slot: 40, use: ['e', 'n', 'q', 'n', 'n', 'e', 'e', 'n', 'n', 'e', 'n', 'n', 'e', 'n', 'n', 'e', 'n', 'n', 'e', 'n', 'n', 'n', 'e'], evidence: 'KQM Sim Database（db.kqm.gg）の単数回の形: フレミネ 110 件中 5 件。平均 52.1k（最大 62.4k）。凸数: 使われている設定の最小は 6 凸（分布 0〜6 凸 = 0/0/0/0/0/0/5）（探索の比較なし）' },
      { name: 'E→N→Q→N×2→E×2→N×2→E→N→E→N×2→E→N→E→N×2→E（KQM）', role: 'attacker', slot: 40, use: ['e', 'n', 'q', 'n', 'n', 'e', 'e', 'n', 'n', 'e', 'n', 'e', 'n', 'n', 'e', 'n', 'e', 'n', 'n', 'e'], evidence: 'KQM Sim Database（db.kqm.gg）の単数回の形: フレミネ 110 件中 17 件。平均 56.0k（最大 88.8k）。凸数: 使われている設定の最小は 6 凸（分布 0〜6 凸 = 0/0/0/0/0/0/17）（探索の比較なし）' },
      { name: 'E→Q→E×3→N×2→E×2→N×2→E×2→N×2→E×2→N×2→E×2（KQM）', role: 'attacker', slot: 40, use: ['e', 'q', 'e', 'e', 'e', 'n', 'n', 'e', 'e', 'n', 'n', 'e', 'e', 'n', 'n', 'e', 'e', 'n', 'n', 'e', 'e'], evidence: 'KQM Sim Database（db.kqm.gg）の単数回の形: フレミネ 110 件中 10 件。平均 55.5k（最大 72.2k）。凸数: 使われている設定の最小は 6 凸（分布 0〜6 凸 = 0/0/0/0/0/0/10）（探索の比較なし）' },
      { name: 'e→q→n×2→e×2→n×2→e→n→e→n×2→e→n→e→n×2→e', role: 'attacker', slot: 40, use: ['e', 'q', 'n', 'n', 'e', 'e', 'n', 'n', 'e', 'n', 'e', 'n', 'n', 'e', 'n', 'e', 'n', 'n', 'e'], evidence: 'KQM Sim Database（db.kqm.gg）の行動の形: 17 件・平均 56.3k・最大 81.0k。e q n×2 e×2 n×2 e n e n×2 e n e n×2 e（探索の比較なし）。凸数: 使われている設定の最小は 6 凸（17 件。分布 0〜6 凸 = 0/0/0/0/0/0/17）' },
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
      { name: '長押しE→Q→E', role: 'attacker', slot: 40, use: ['e_hold', 'q', 'e'], fill: ['n'], fillRepeat: [8, 10, 12], evidence: 'Wiki 本文のコンボの記述: 雷の印を消費（長押しスキル）→爆発→スキルというコンボ（探索の比較なし）' },
      { name: 'E・Q のあと 通常攻撃を繰り返す', role: 'attacker', slot: 40, use: ['e', 'q'], fill: ['n'], fillRepeat: [14, 18], evidence: '自動編成（レザー + ベネット・鍾離・フリーナ）の探索の上位に出る形。実測（最短の設定）: 35.7k → 38.3k' },
      { name: 'E→DASH→N→Q→N→E→DASH→N×3→DASH→N×3→DASH→N×3→E→DASH→N×3→DASH→N×3（KQM）', role: 'attacker', slot: 40, use: ['e', 'dash', 'n', 'q', 'n', 'e', 'dash', 'n', 'n', 'n', 'dash', 'n', 'n', 'n', 'dash', 'n', 'n', 'n', 'e', 'dash', 'n', 'n', 'n', 'dash', 'n', 'n', 'n'], evidence: 'KQM Sim Database（db.kqm.gg）の単数回の形: レザー 149 件中 5 件。平均 90.1k（最大 112.2k）。凸数: 使われている設定の最小は 6 凸（分布 0〜6 凸 = 0/0/0/0/0/0/5）（探索の比較なし）' },
      { name: 'E→DASH→N→Q→N→E→DASH→N×3→DASH→N×3→DASH→N×3→E→DASH→N×3→DASH→N×3→DASH→N×3（KQM）', role: 'attacker', slot: 40, use: ['e', 'dash', 'n', 'q', 'n', 'e', 'dash', 'n', 'n', 'n', 'dash', 'n', 'n', 'n', 'dash', 'n', 'n', 'n', 'e', 'dash', 'n', 'n', 'n', 'dash', 'n', 'n', 'n', 'dash', 'n', 'n', 'n'], evidence: 'KQM Sim Database（db.kqm.gg）の単数回の形: レザー 149 件中 5 件。平均 68.7k（最大 82.7k）。凸数: 使われている設定の最小は 6 凸（分布 0〜6 凸 = 0/0/0/0/0/0/5）（探索の比較なし）' },
    ],
  },
  {
    characterId: '10000027-geo',
    archetypes: [
      { name: 'E・ダッシュ・Q のあと 重撃 + 通常攻撃を繰り返す', role: 'attacker', slot: 40, use: ['e', 'dash', 'q'], fill: ['ca', 'n'], fillRepeat: [4, 6], evidence: '自動編成（凝光 + ベネット・鍾離・フリーナ）の探索の上位に出る形。実測（最短の設定）: 37.1k → 38.3k' },
      { name: 'E→Q→重撃→E', role: 'attacker', slot: 40, use: ['e', 'q', 'ca', 'e'], constellation: { min: 2 }, evidence: 'Wiki 本文のコンボの記述: スキル→爆発→重撃→スキル（2 凸）のコンボ（探索の比較なし）' },
      { name: 'E→Q→E→重撃', role: 'attacker', slot: 40, use: ['e', 'q', 'e', 'ca'], constellation: { min: 6 }, evidence: 'Wiki 本文のコンボの記述: 完凸・高天賦のとき、スキル→爆発→スキル→重撃のコンボ（探索の比較なし）' },
    ],
  },
  {
    characterId: '10000029-pyro',
    archetypes: [
      { name: 'E→Q→通常→重撃を繰り返す', role: 'attacker', slot: 40, use: ['e', 'q'], fill: ['n', 'ca'], fillRepeat: [4, 6, 8], evidence: 'Wiki 本文のコンボの記述: 通常→重撃をキャンセルを使って繰り返す（探索の比較なし）' },
      { name: 'E・Q のあと 通常攻撃 2 回 + 重撃を繰り返す', role: 'attacker', slot: 40, use: ['e', 'q'], fill: ['n', 'n', 'ca'], fillRepeat: [4, 5, 6], evidence: '自動編成（クレー + ベネット・鍾離・フリーナ）の探索の上位に出る形。実測（最短の設定）: 36.7k → 37.7k' },
    ],
  },
  {
    characterId: '10000036-cryo',
    archetypes: [
      { name: 'Q のあと 通常攻撃を繰り返す', role: 'attacker', slot: 40, use: ['q'], fill: ['n'], fillRepeat: [14, 19, 22], evidence: '自動編成（重雲 + ベネット・鍾離・フリーナ）の探索の上位に出る形。実測（最短の設定）: 24.7k → 28.4k' },
      { name: 'Q→E（KQM）', role: 'supporter', slot: 10, use: ['q', 'e'], evidence: 'KQM Sim Database（db.kqm.gg）の単数回の形: 重雲 142 件中 57 件。平均 59.7k（最大 139.8k）。凸数: 使われている設定の最小は 6 凸（分布 0〜6 凸 = 0/0/0/0/0/0/57）（探索の比較なし）' },
      { name: 'E→N のあと、もう一度 Q', role: 'supporter', slot: 10, use: ['e', 'n'], then: [{ slot: 30, use: ['q'] }], evidence: 'KQM Sim Database（db.kqm.gg）の複数回出場の形: 重雲 142 件中 13 件。平均 72.4k（最大 113.1k）。凸数: 使われている設定の最小は 6 凸（分布 0〜6 凸 = 0/0/0/0/0/0/13）（探索の比較なし）' },
      { name: 'E のあと、もう一度 Q', role: 'supporter', slot: 10, use: ['e'], then: [{ slot: 30, use: ['q'] }], evidence: 'KQM Sim Database（db.kqm.gg）の複数回出場の形: 重雲 142 件中 10 件。平均 56.4k（最大 85.4k）。凸数: 使われている設定の最小は 6 凸（分布 0〜6 凸 = 0/0/0/0/0/0/10）（探索の比較なし）' },
    ],
  },
  {
    characterId: '10000041-hydro',
    archetypes: [
      { name: 'Q→通常', role: 'attacker', slot: 40, use: ['q', 'n'], evidence: 'Wiki 本文のコンボの記述: 爆発の 5 秒以内に通常攻撃が当たると、確定で重撃が追加発動する（探索の比較なし）' },
      { name: 'E→通常→重撃（層を 3 つ）', role: 'attacker', slot: 40, use: ['e', 'n', 'ca'], fill: ['n', 'n', 'ca'], fillRepeat: [2, 3], evidence: 'Wiki 本文のコンボの記述: スキル→通常→重撃で 3 層たまる（探索の比較なし）' },
      { name: 'Q のあと 重撃を繰り返す', role: 'attacker', slot: 40, use: ['q'], fill: ['ca'], fillRepeat: [4, 5, 6], evidence: '自動編成（モナ + ベネット・鍾離・フリーナ）の探索の上位に出る形。実測（最短の設定）: 25.4k → 26.7k' },
      { name: 'E→Q（KQM）', role: 'supporter', slot: 10, use: ['e', 'q'], constellation: { min: 0 }, evidence: 'KQM Sim Database（db.kqm.gg）の単数回の形: モナ 216 件中 30 件。平均 75.0k（最大 151.4k）。凸数: 使われている設定の最小は 0 凸（分布 0〜6 凸 = 29/0/0/0/0/0/1）（探索の比較なし）' },
      { name: 'Q→E（KQM）', role: 'supporter', slot: 10, use: ['q', 'e'], constellation: { min: 0 }, evidence: 'KQM Sim Database（db.kqm.gg）の単数回の形: モナ 216 件中 11 件。平均 52.7k（最大 107.3k）。凸数: 使われている設定の最小は 0 凸（分布 0〜6 凸 = 11/0/0/0/0/0/0）（探索の比較なし）' },
      { name: 'N→E→Q（KQM）', role: 'supporter', slot: 10, use: ['n', 'e', 'q'], constellation: { min: 0 }, evidence: 'KQM Sim Database（db.kqm.gg）の単数回の形: モナ 216 件中 10 件。平均 46.6k（最大 67.1k）。凸数: 使われている設定の最小は 0 凸（分布 0〜6 凸 = 10/0/0/0/0/0/0）（探索の比較なし）' },
      { name: 'Q→N のあと、もう一度 N→E→N', role: 'attacker', slot: 40, use: ['q', 'n'], then: [{ slot: 50, use: ['n', 'e', 'n'] }], constellation: { min: 4 }, evidence: 'KQM Sim Database（db.kqm.gg）の複数回出場の形: モナ 216 件中 13 件。平均 100.5k（最大 151.3k）。凸数: 使われている設定の最小は 4 凸（分布 0〜6 凸 = 0/0/0/0/13/0/0）（探索の比較なし）' },
      { name: 'e→q→n', role: 'attacker', slot: 40, use: ['e', 'q', 'n'], constellation: { min: 0 }, evidence: 'KQM Sim Database（db.kqm.gg）の行動の形: 19 件・平均 106.8k・最大 249.1k。e q n（探索の比較なし）。凸数: 使われている設定の最小は 0 凸（19 件。分布 0〜6 凸 = 1/0/5/0/13/0/0）' },
      { name: 'n→e→n', role: 'attacker', slot: 40, use: ['n', 'e', 'n'], constellation: { min: 0 }, evidence: 'KQM Sim Database（db.kqm.gg）の行動の形: 26 件・平均 99.2k・最大 151.3k。n e n（探索の比較なし）。凸数: 使われている設定の最小は 0 凸（26 件。分布 0〜6 凸 = 1/0/0/0/25/0/0）' },
    ],
  },
  {
    characterId: '10000044-pyro',
    archetypes: [
      { name: 'ダッシュ・E・Q のあと 通常攻撃を繰り返す', role: 'attacker', slot: 40, use: ['dash', 'e', 'q'], fill: ['n'], fillRepeat: [18, 20, 22], evidence: '自動編成（辛炎 + ベネット・鍾離・フリーナ）の探索の上位に出る形。実測（最短の設定）: 21.9k → 24.8k' },
      { name: 'E→N→Q（KQM）', role: 'supporter', slot: 10, use: ['e', 'n', 'q'], evidence: 'KQM Sim Database（db.kqm.gg）の単数回の形: 辛炎 48 件中 3 件。平均 45.1k（最大 59.4k）。凸数: 使われている設定の最小は 6 凸（分布 0〜6 凸 = 0/0/0/0/0/0/3）（探索の比較なし）' },
      { name: 'E→Q（KQM）', role: 'supporter', slot: 10, use: ['e', 'q'], evidence: 'KQM Sim Database（db.kqm.gg）の単数回の形: 辛炎 48 件中 13 件。平均 47.3k（最大 73.7k）。凸数: 使われている設定の最小は 6 凸（分布 0〜6 凸 = 0/0/0/0/0/0/13）（探索の比較なし）' },
    ],
  },
  {
    characterId: '10000054-hydro',
    archetypes: [
      { name: 'Q・E のあと 通常攻撃を繰り返す', role: 'attacker', slot: 40, use: ['q', 'e'], fill: ['n'], fillRepeat: [14, 15, 16], evidence: '自動編成（珊瑚宮心海 + ベネット・鍾離・フリーナ）の探索の上位に出る形。実測（最短の設定）: 35.3k → 36.2k' },
      { name: 'E→DASH（KQM）', role: 'supporter', slot: 10, use: ['e', 'dash'], constellation: { min: 0 }, evidence: 'KQM Sim Database（db.kqm.gg）の単数回の形: 珊瑚宮心海 210 件中 19 件。平均 64.4k（最大 152.3k）。凸数: 使われている設定の最小は 0 凸（分布 0〜6 凸 = 17/0/0/0/0/0/2）（探索の比較なし）' },
      { name: 'E（KQM）', role: 'supporter', slot: 10, use: ['e'], constellation: { min: 0 }, evidence: 'KQM Sim Database（db.kqm.gg）の単数回の形: 珊瑚宮心海 210 件中 12 件。平均 47.9k（最大 63.4k）。凸数: 使われている設定の最小は 0 凸（分布 0〜6 凸 = 12/0/0/0/0/0/0）（探索の比較なし）' },
    ],
  },
  {
    characterId: '10000057-geo',
    archetypes: [
      { name: 'N→Q→N→E→N×2 のあと重撃連打→E→重撃', role: 'attacker', slot: 40, use: ['n', 'q', 'n', 'e', 'n', 'n'], fill: ['ca'], fillRepeat: [4, 5], tail: ['e', 'ca'], evidence: 'Phase 3-2精鋭辞書＋KQM新集計: 30.3% 最多荒瀧逆袈裟ループ形' },
      { name: 'Q→N→E のあと N×3→重撃×4 連打', role: 'attacker', slot: 40, use: ['q', 'n', 'e'], fill: ['n', 'n', 'n', 'ca', 'ca', 'ca', 'ca'], fillRepeat: [2], evidence: 'Phase 3-2精鋭辞書＋KQM新集計: 27.6% N3→CA4交互ループ形' },
      { name: 'Q→E のあと通常2→重撃連打', role: 'attacker', slot: 40, use: ['q', 'e'], fill: ['n', 'n', 'ca'], fillRepeat: [3, 4], evidence: 'Phase 3-2精鋭辞書＋KQM新集計: N2Cシンプル循環形' },
      { name: 'Q→E→重撃→N→E→重撃（短時間型）', role: 'attacker', slot: 40, use: ['q', 'e', 'ca', 'n', 'e', 'ca'], evidence: 'Phase 3-2精鋭辞書＋KQM新集計: 短時間サブ/2ローテ兼用形' },
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
      { name: 'Q→E', role: 'supporter', slot: 10, use: ['q', 'e'], evidence: 'Wiki 本文のコンボの記述: 交代してから、爆発→スキルのサポーター運用が強力（探索の比較なし）' },
    ],
  },
  {
    characterId: '10000075-anemo',
    archetypes: [
      { name: 'E のあと 重撃を繰り返す（重撃型）', role: 'attacker', slot: 40, use: ['e'], fill: ['ca'], fillRepeat: [8, 10, 12], evidence: 'Wiki 本文のコンボの記述: 浮遊中は重撃にスタミナを使わず、高速で連打できる（探索の比較なし）' },
      { name: 'E のあと 通常2→重撃を繰り返す（混成型）', role: 'attacker', slot: 40, use: ['e'], fill: ['n', 'n', 'ca'], fillRepeat: [6, 7, 8], evidence: 'Wiki 本文のコンボの記述: 重撃と通常 2 発を繰り返し、通常 3 打目を重撃でキャンセルするコンボ（探索の比較なし）' },
      { name: 'E→重撃→通常を繰り返す（砂上型）', role: 'attacker', slot: 40, use: ['e', 'ca'], fill: ['n'], fillRepeat: [14, 18, 22], evidence: 'Wiki 本文のコンボの記述: 浮遊後の初回攻撃に重撃を挟む（探索の比較なし）' },
      { name: 'E→通常を繰り返す→Q', role: 'attacker', slot: 40, use: ['e'], fill: ['n'], fillRepeat: [14, 18, 22], evidence: 'Wiki 本文のコンボの記述: 浮遊→通常攻撃連打→元素爆発（空居力消費後）を繰り返す基本の運用（探索の比較なし）' },
      { name: '重撃 3 回・E のあと 通常攻撃を繰り返す', role: 'attacker', slot: 40, use: ['ca', 'ca', 'ca', 'e'], fill: ['n'], fillRepeat: [17, 19, 21], evidence: '自動編成（放浪者 + ベネット・鍾離・フリーナ）の探索の上位に出る形。実測（最短の設定）: 36.2k → 36.2k' },
    ],
  },
  {
    characterId: '10000086-cryo',
    archetypes: [
      { name: 'E→通常→重撃', role: 'attacker', slot: 40, use: ['e', 'n', 'ca'], fill: ['n', 'ca'], fillRepeat: [2, 3, 4], evidence: 'Wiki 本文のコンボの記述: 基本コンボ。スキル→通常→重撃（探索の比較なし）' },
      { name: 'E のあと 通常攻撃を繰り返す', role: 'attacker', slot: 40, use: ['e'], fill: ['n'], fillRepeat: [18, 20, 22], evidence: '自動編成（リオセスリ + ベネット・鍾離・フリーナ）の探索の上位に出る形。実測（最短の設定）: 38.0k → 38.0k' },
      { name: '通常5→強化重撃の繰り返し（1 凸）', role: 'attacker', slot: 40, use: ['e'], fill: ['n', 'n', 'n', 'n', 'n', 'ca'], fillRepeat: [2, 3], constellation: { min: 1 }, evidence: 'Wiki 本文のコンボの記述: 1 凸以降の「通常 5 段→強化重撃」（探索の比較なし）' },
    ],
  },
  {
    characterId: '10000104-anemo',
    archetypes: [
      { name: 'E→重撃→Q', role: 'attacker', slot: 40, use: ['e', 'ca', 'ca', 'ca', 'q'], evidence: 'Wiki 本文のコンボの記述: 先にスキル→重撃を撃ち切ってから、爆発を使う（探索の比較なし）' },
      { name: 'E のあと 重撃を繰り返す', role: 'attacker', slot: 40, use: ['e'], fill: ['ca'], fillRepeat: [4, 5], evidence: '自動編成（チャスカ + ベネット・鍾離・フリーナ）の探索の上位に出る形。実測（最短の設定）: 43.0k → 49.9k' },
    ],
  },
  {
    characterId: '10000113-anemo',
    archetypes: [
      { name: 'Q→E', role: 'attacker', slot: 40, use: ['q', 'e'], evidence: 'Wiki 本文のコンボの記述: 爆発後は元素熟知が上がるので、爆発→スキル攻撃の立ち回りが強力（探索の比較なし）' },
      { name: 'E・重撃のあと 通常攻撃を繰り返す', role: 'attacker', slot: 40, use: ['e', 'ca', 'ca', 'ca', 'ca', 'ca'], fill: ['n'], fillRepeat: [10, 12, 14], evidence: '自動編成（イファ + ベネット・鍾離・フリーナ）の探索の上位に出る形。実測（最短の設定）: 27.5k → 27.5k' },
      { name: 'E→重撃を連打（固定回数）', role: 'attacker', slot: 40, use: ['e', 'ca', 'ca', 'ca', 'ca'], fill: ['ca'], fillRepeat: [1, 2, 3], evidence: 'KQM Sim Database（db.kqm.gg。gcsim の公開設定）の行動の形: 同上。重撃の回数を固定にして、繰り返す形（探索の比較なし）' },
      { name: 'E→重撃を連打→Q', role: 'attacker', slot: 40, use: ['e', 'ca', 'ca', 'ca', 'ca', 'ca', 'ca', 'q'], fill: ['ca'], fillRepeat: [0], evidence: 'KQM Sim Database（db.kqm.gg。gcsim の公開設定）の行動の形: ナイトソウルが多い間は重撃を連打し、爆発が使えれば爆発。7 件中 5 件が同じ型（e → ca 連打 → q）。DPS 上位は 80k〜100k（探索の比較なし）' },
    ],
  },
  {
    characterId: '10000114-cryo',
    archetypes: [
      { name: '通常5→Q のあと 通常を繰り返す', role: 'attacker', slot: 40, use: ['n', 'n', 'n', 'n', 'n', 'q'], fill: ['n'], fillRepeat: [12, 15, 18], evidence: 'Wiki 本文のコンボの記述: 通常 5 段→爆発→次の通常攻撃で、後隙をキャンセルする（探索の比較なし）' },
      { name: 'E・Q・通常攻撃・重撃のあと 通常攻撃を繰り返す', role: 'attacker', slot: 40, use: ['e', 'q', 'n', 'n', 'ca'], fill: ['n'], fillRepeat: [15, 17, 19], evidence: '自動編成（スカーク + ベネット・鍾離・フリーナ）の探索の上位に出る形。実測（最短の設定）: 44.4k → 49.6k' },
      { name: 'E_HOLD→Q のあと、もう一度 E_HOLD→Q', role: 'attacker', slot: 40, use: ['e_hold', 'q'], then: [{ slot: 50, use: ['e_hold', 'q'] }], constellation: { min: 0 }, evidence: 'KQM Sim Database（db.kqm.gg）の複数回出場の形: スカーク 180 件中 7 件。平均 101.2k（最大 113.9k）。凸数: 使われている設定の最小は 0 凸（分布 0〜6 凸 = 7/0/0/0/0/0/0）（探索の比較なし）' },
      { name: 'e_hold→q', role: 'attacker', slot: 40, use: ['e_hold', 'q'], constellation: { min: 0 }, evidence: 'KQM Sim Database（db.kqm.gg）の行動の形: 18 件・平均 94.7k・最大 125.5k。e_hold q（探索の比較なし）。凸数: 使われている設定の最小は 0 凸（18 件。分布 0〜6 凸 = 18/0/0/0/0/0/0）' },
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
      { name: 'Q→E×3→重撃', role: 'attacker', slot: 40, use: ['q', 'e', 'e', 'e', 'ca'], evidence: 'Wiki 本文のコンボの記述: 爆発→スキル 3 連→重撃（探索の比較なし）' },
      { name: '最大ダメージのコンボ（通常1 E 通常1 E 通常2〜4 E 通常1〜3 E 通常4）', role: 'attacker', slot: 40, use: ['n', 'e', 'n', 'e', 'n', 'n', 'n', 'e', 'n', 'n', 'n', 'e', 'n'], evidence: 'Wiki 本文のコンボの記述: 手軽さは薄れるが、最もダメージを狙えるコンボ（スキルは 1〜3 段目を順に）（探索の比較なし）' },
      { name: '通常1→E→通常2〜4→E の繰り返し', role: 'attacker', slot: 40, use: [], fill: ['n', 'e', 'n', 'n', 'n', 'e'], fillRepeat: [2, 3], evidence: 'Wiki 本文のコンボの記述: 短時間でテンポよく火力を出す、実用的なループ（探索の比較なし）' },
      { name: 'E×3・Q のあと 通常攻撃を繰り返す', role: 'attacker', slot: 40, use: ['e', 'e', 'e', 'q'], fill: ['n'], fillRepeat: [6, 9], evidence: '自動編成（ディルック + ベネット・鍾離・フリーナ）の探索の上位に出る形。実測（最短の設定）: 35.1k → 37.2k' },
    ],
  },
  {
    characterId: '10000048-pyro',
    archetypes: [
      { name: 'Q のあと 通常2→重撃を繰り返す', role: 'attacker', slot: 40, use: ['q'], fill: ['n', 'n', 'ca'], fillRepeat: [4, 5, 6], evidence: 'Wiki 本文のコンボの記述: 爆発中は、通常 2 段→重撃で印 4 重の攻撃ができる（探索の比較なし）' },
      { name: '通常攻撃 2 回 + 重撃を繰り返す', role: 'attacker', slot: 40, use: [], fill: ['n', 'n', 'ca'], fillRepeat: [4, 5], evidence: '自動編成（煙緋 + ベネット・鍾離・フリーナ）の探索の上位に出る形。実測（最短の設定）: 27.8k → 28.2k' },
      { name: 'E→重撃（サブ）', role: 'subAttacker', slot: 20, use: ['e', 'ca'], evidence: 'Wiki 本文のコンボの記述: 表に出さず、スキルの CT ごとに出して、スキル→重撃をして退場させるサブアタッカー運用（探索の比較なし）' },
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
      { name: 'E→重撃→長押しE', role: 'supporter', slot: 10, use: ['e', 'ca', 'e_hold'], evidence: 'Wiki 本文のコンボの記述: スキル一回押し→重撃→スキル長押し。誘雷 0 から 3 にして長押しを当てる（探索の比較なし）' },
      { name: 'E→通常2→長押しE', role: 'supporter', slot: 10, use: ['e', 'n', 'n', 'e_hold'], evidence: 'Wiki 本文のコンボの記述: スキル一回押し→通常 12→スキル長押し。過負荷・超電導を用いたクイックチャージコンボ（探索の比較なし）' },
      { name: 'q の出場', role: 'supporter', slot: 30, use: ['q'], evidence: '自動編成（リサ + 雷電将軍・ベネット・フリーナ）の探索の上位に出る形。実測（最短の設定）: 42.3k → 42.8k' },
      { name: 'N→Q のあと、もう一度 E_HOLD', role: 'subAttacker', slot: 20, use: ['n', 'q'], then: [{ slot: 30, use: ['e_hold'] }], evidence: 'KQM Sim Database（db.kqm.gg）の複数回出場の形: リサ 164 件中 5 件。平均 57.2k（最大 63.6k）。凸数: 使われている設定の最小は 6 凸（分布 0〜6 凸 = 0/0/0/0/0/0/5）（探索の比較なし）' },
      { name: 'E_HOLD→Q（KQM）', role: 'subAttacker', slot: 20, use: ['e_hold', 'q'], constellation: { min: 0 }, evidence: 'KQM Sim Database（db.kqm.gg）の単数回の形: リサ 164 件中 19 件。平均 62.1k（最大 102.5k）。凸数: 使われている設定の最小は 0 凸（分布 0〜6 凸 = 5/0/1/0/0/0/13）（探索の比較なし）' },
      { name: 'Q のあと、もう一度 E_HOLD', role: 'supporter', slot: 10, use: ['q'], then: [{ slot: 30, use: ['e_hold'] }], constellation: { min: 2 }, evidence: 'KQM Sim Database（db.kqm.gg）の複数回出場の形: リサ 164 件中 15 件。平均 54.3k（最大 83.6k）。凸数: 使われている設定の最小は 2 凸（分布 0〜6 凸 = 0/0/1/0/0/0/14）（探索の比較なし）' },
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
      { name: 'E→Q', role: 'subAttacker', slot: 20, use: ['e', 'q'], evidence: 'Wiki 本文のコンボの記述: スキル→爆発（溶解編成の立ち回り）（探索の比較なし）' },
      { name: 'q の出場', role: 'supporter', slot: 30, use: ['q'], evidence: '自動編成（ガイア + 雷電将軍・ベネット・フリーナ）の探索の上位に出る形。実測（最短の設定）: 44.8k → 49.1k' },
      { name: 'E→N→Q（KQM）', role: 'subAttacker', slot: 20, use: ['e', 'n', 'q'], requiresFavonius: true, evidence: 'KQM Sim Database（db.kqm.gg）の単数回の形: ガイア 67 件中 4 件。平均 84.8k（最大 116.2k）。凸数: 使われている設定の最小は 6 凸（分布 0〜6 凸 = 0/0/0/0/0/0/4）（探索の比較なし）' },
      { name: 'E→N→Q のあと、もう一度 E→N', role: 'subAttacker', slot: 20, use: ['e', 'n', 'q'], then: [{ slot: 30, use: ['e', 'n'] }], constellation: { min: 2 }, evidence: 'KQM Sim Database（db.kqm.gg）の複数回出場の形: ガイア 67 件中 3 件。平均 53.1k（最大 78.5k）。凸数: 使われている設定の最小は 2 凸（分布 0〜6 凸 = 0/0/1/0/0/0/2）（探索の比較なし）' },
      { name: 'e→dash→q', role: 'subAttacker', slot: 20, use: ['e', 'dash', 'q'], constellation: { min: 0 }, evidence: 'KQM Sim Database（db.kqm.gg）の行動の形: 17 件・平均 87.1k・最大 159.7k。e dash q（探索の比較なし）。凸数: 使われている設定の最小は 0 凸（17 件。分布 0〜6 凸 = 1/0/1/0/0/0/15）' },
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
      { name: 'E→Q（KQM）', role: 'supporter', slot: 10, use: ['e', 'q'], evidence: 'KQM Sim Database（db.kqm.gg）の単数回の形: 北斗 128 件中 5 件。平均 42.6k（最大 61.2k）。凸数: 使われている設定の最小は 6 凸（分布 0〜6 凸 = 0/0/0/0/0/0/5）（探索の比較なし）' },
      { name: 'q の出場', role: 'supporter', slot: 30, use: ['q'], evidence: '自動編成（北斗 + 雷電将軍・ベネット・フリーナ）の探索の上位に出る形。実測（最短の設定）: 41.6k → 39.6k' },
      { name: '通常2→E→Q', role: 'subAttacker', slot: 20, use: ['n', 'n', 'e', 'q'], evidence: 'Wiki 本文のコンボの記述: 爆発前に、効果を 4 層にするための操作（通常 2 回）を入れる（探索の比較なし）' },
      { name: 'E→N→Q（KQM）', role: 'supporter', slot: 10, use: ['e', 'n', 'q'], evidence: 'KQM Sim Database（db.kqm.gg）の単数回の形: 北斗 128 件中 4 件。平均 50.9k（最大 62.4k）。凸数: 使われている設定の最小は 6 凸（分布 0〜6 凸 = 0/0/0/0/0/0/4）（探索の比較なし）' },
      { name: 'E→Q のあと、もう一度 E→N', role: 'supporter', slot: 10, use: ['e', 'q'], then: [{ slot: 30, use: ['e', 'n'] }], evidence: 'KQM Sim Database（db.kqm.gg）の複数回出場の形: 北斗 128 件中 9 件。平均 50.5k（最大 67.2k）。凸数: 使われている設定の最小は 6 凸（分布 0〜6 凸 = 0/0/0/0/0/0/9）（探索の比較なし）' },
      { name: 'E→Q のあと、もう一度 E→N×2', role: 'supporter', slot: 10, use: ['e', 'q'], then: [{ slot: 30, use: ['e', 'n', 'n'] }], evidence: 'KQM Sim Database（db.kqm.gg）の複数回出場の形: 北斗 128 件中 5 件。平均 49.6k（最大 53.4k）。凸数: 使われている設定の最小は 6 凸（分布 0〜6 凸 = 0/0/0/0/0/0/5）（探索の比較なし）' },
      { name: 'E→Q のあと、もう一度 N→E→N×2', role: 'supporter', slot: 10, use: ['e', 'q'], then: [{ slot: 30, use: ['n', 'e', 'n', 'n'] }], evidence: 'KQM Sim Database（db.kqm.gg）の複数回出場の形: 北斗 128 件中 5 件。平均 51.8k（最大 64.1k）。凸数: 使われている設定の最小は 6 凸（分布 0〜6 凸 = 0/0/0/0/0/0/5）（探索の比較なし）' },
      { name: 'E→Q→DASH のあと、もう一度 E→N', role: 'supporter', slot: 10, use: ['e', 'q', 'dash'], then: [{ slot: 30, use: ['e', 'n'] }], evidence: 'KQM Sim Database（db.kqm.gg）の複数回出場の形: 北斗 128 件中 4 件。平均 52.9k（最大 62.2k）。凸数: 使われている設定の最小は 6 凸（分布 0〜6 凸 = 0/0/0/0/0/0/4）（探索の比較なし）' },
      { name: 'E→Q→N（KQM）', role: 'supporter', slot: 10, use: ['e', 'q', 'n'], constellation: { min: 2 }, evidence: 'KQM Sim Database（db.kqm.gg）の単数回の形: 北斗 128 件中 12 件。平均 45.8k（最大 53.7k）。凸数: 使われている設定の最小は 2 凸（分布 0〜6 凸 = 0/0/2/0/0/0/10）（探索の比較なし）' },
      { name: 'E→Q のあと、もう一度 E', role: 'supporter', slot: 10, use: ['e', 'q'], then: [{ slot: 30, use: ['e'] }], evidence: 'KQM Sim Database（db.kqm.gg）の複数回出場の形: 北斗 128 件中 13 件。平均 48.8k（最大 68.3k）。凸数: 使われている設定の最小は 6 凸（分布 0〜6 凸 = 0/0/0/0/0/0/13）（探索の比較なし）' },
    ],
  },
  {
    characterId: '10000038-geo',
    archetypes: [
      { name: 'e の出場', role: 'supporter', slot: 30, use: ['e'], evidence: '自動編成（アルベド + 雷電将軍・ベネット・フリーナ）の探索の上位に出る形。実測（最短の設定）: 42.3k → 41.7k' },
      { name: 'E→Q（KQM）', role: 'subAttacker', slot: 20, use: ['e', 'q'], constellation: { min: 0 }, evidence: 'KQM Sim Database（db.kqm.gg）の単数回の形: アルベド 118 件中 6 件。平均 57.7k（最大 91.4k）。凸数: 使われている設定の最小は 0 凸（分布 0〜6 凸 = 6/0/0/0/0/0/0）（探索の比較なし）' },
      { name: 'N→E のあと、もう一度 N→E→N', role: 'subAttacker', slot: 20, use: ['n', 'e'], then: [{ slot: 30, use: ['n', 'e', 'n'] }], constellation: { min: 0 }, evidence: 'KQM Sim Database（db.kqm.gg）の複数回出場の形: アルベド 118 件中 6 件。平均 44.2k（最大 47.5k）。凸数: 使われている設定の最小は 0 凸（分布 0〜6 凸 = 6/0/0/0/0/0/0）（探索の比較なし）' },
      { name: 'E→N（KQM）', role: 'subAttacker', slot: 20, use: ['e', 'n'], constellation: { min: 0 }, evidence: 'KQM Sim Database（db.kqm.gg）の単数回の形: アルベド 118 件中 24 件。平均 45.8k（最大 67.7k）。凸数: 使われている設定の最小は 0 凸（分布 0〜6 凸 = 24/0/0/0/0/0/0）（探索の比較なし）' },
      { name: 'N→E（KQM）', role: 'subAttacker', slot: 20, use: ['n', 'e'], constellation: { min: 0 }, evidence: 'KQM Sim Database（db.kqm.gg）の単数回の形: アルベド 118 件中 12 件。平均 50.5k（最大 111.7k）。凸数: 使われている設定の最小は 0 凸（分布 0〜6 凸 = 12/0/0/0/0/0/0）（探索の比較なし）' },
      { name: 'N→E のあと、もう一度 N→E', role: 'subAttacker', slot: 20, use: ['n', 'e'], then: [{ slot: 30, use: ['n', 'e'] }], constellation: { min: 0 }, evidence: 'KQM Sim Database（db.kqm.gg）の複数回出場の形: アルベド 118 件中 14 件。平均 48.6k（最大 96.8k）。凸数: 使われている設定の最小は 0 凸（分布 0〜6 凸 = 13/0/0/0/0/0/1）（探索の比較なし）' },
    ],
  },
  {
    characterId: '10000039-cryo',
    archetypes: [
      { name: 'e_hold q の出場', role: 'supporter', slot: 10, use: ['e_hold', 'q'], evidence: '自動編成（ディオナ + 雷電将軍・ベネット・フリーナ）の探索の上位に出る形。実測（最短の設定）: 41.6k → 41.4k' },
      { name: 'E_HOLD→N→Q→N（KQM）', role: 'supporter', slot: 10, use: ['e_hold', 'n', 'q', 'n'], requiresFavonius: true, evidence: 'KQM Sim Database（db.kqm.gg）の単数回の形: ディオナ 69 件中 7 件。平均 51.8k（最大 59.9k）。凸数: 使われている設定の最小は 6 凸（分布 0〜6 凸 = 0/0/0/0/0/0/7）（探索の比較なし）' },
      { name: 'Q→E_HOLD×2（KQM）', role: 'supporter', slot: 10, use: ['q', 'e_hold', 'e_hold'], evidence: 'KQM Sim Database（db.kqm.gg）の単数回の形: ディオナ 69 件中 3 件。平均 79.2k（最大 107.2k）。凸数: 使われている設定の最小は 6 凸（分布 0〜6 凸 = 0/0/0/0/0/0/3）（探索の比較なし）' },
      { name: 'E→Q→N のあと、もう一度 E→DASH', role: 'supporter', slot: 10, use: ['e', 'q', 'n'], then: [{ slot: 30, use: ['e', 'dash'] }], requiresFavonius: true, evidence: 'KQM Sim Database（db.kqm.gg）の複数回出場の形: ディオナ 69 件中 3 件。平均 18.2k（最大 19.2k）。凸数: 使われている設定の最小は 6 凸（分布 0〜6 凸 = 0/0/0/0/0/0/3）（探索の比較なし）' },
    ],
  },
  {
    characterId: '10000045-cryo',
    archetypes: [
      { name: 'q の出場', role: 'supporter', slot: 30, use: ['q'], evidence: '自動編成（ロサリア + 雷電将軍・ベネット・フリーナ）の探索の上位に出る形。実測（最短の設定）: 41.3k → 41.3k' },
      { name: 'E→Q（KQM）', role: 'supporter', slot: 10, use: ['e', 'q'], constellation: { min: 0 }, evidence: 'KQM Sim Database（db.kqm.gg）の単数回の形: ロサリア 345 件中 87 件。平均 60.4k（最大 118.4k）。凸数: 使われている設定の最小は 0 凸（分布 0〜6 凸 = 3/0/0/0/0/0/84）（探索の比較なし）' },
      { name: 'E→N→Q（KQM）', role: 'subAttacker', slot: 20, use: ['e', 'n', 'q'], requiresFavonius: true, evidence: 'KQM Sim Database（db.kqm.gg）の単数回の形: ロサリア 345 件中 13 件。平均 65.5k（最大 119.2k）。凸数: 使われている設定の最小は 6 凸（分布 0〜6 凸 = 0/0/0/0/0/0/13）（探索の比較なし）' },
      { name: 'E→Q のあと、もう一度 E', role: 'supporter', slot: 10, use: ['e', 'q'], then: [{ slot: 30, use: ['e'] }], constellation: { min: 0 }, evidence: 'KQM Sim Database（db.kqm.gg）の複数回出場の形: ロサリア 345 件中 64 件。平均 51.9k（最大 93.3k）（探索の比較なし）。凸数: 使われている設定の最小は 0 凸（203 件。分布 0〜6 凸 = 4/0/0/0/0/0/199）' },
    ],
  },
  {
    characterId: '10000050-pyro',
    archetypes: [
      { name: 'E→Q', role: 'supporter', slot: 10, use: ['e', 'q'], evidence: 'Wiki 本文のコンボの記述: 始動時は、スキル→爆発（探索の比較なし）' },
      { name: 'Q→E', role: 'supporter', slot: 10, use: ['q', 'e'], evidence: 'Wiki 本文のコンボの記述: スキルと爆発を併用するときは、爆発→スキルの順（探索の比較なし）' },
      { name: 'E→Q→N（KQM）', role: 'supporter', slot: 10, use: ['e', 'q', 'n'], evidence: 'KQM Sim Database（db.kqm.gg）の単数回の形: トーマ 118 件中 5 件。平均 48.0k（最大 59.7k）。凸数: 使われている設定の最小は 6 凸（分布 0〜6 凸 = 0/0/0/0/0/0/5）（探索の比較なし）' },
      { name: 'E→N→Q（KQM）', role: 'supporter', slot: 10, use: ['e', 'n', 'q'], evidence: 'KQM Sim Database（db.kqm.gg）の単数回の形: トーマ 118 件中 15 件。平均 55.3k（最大 66.4k）。凸数: 使われている設定の最小は 6 凸（分布 0〜6 凸 = 0/0/0/0/0/0/15）（探索の比較なし）' },
      { name: 'Q→N→E→N×2（KQM）', role: 'supporter', slot: 10, use: ['q', 'n', 'e', 'n', 'n'], evidence: 'KQM Sim Database（db.kqm.gg）の単数回の形: トーマ 118 件中 10 件。平均 46.4k（最大 60.1k）。凸数: 使われている設定の最小は 6 凸（分布 0〜6 凸 = 0/0/0/0/0/0/10）（探索の比較なし）' },
      { name: 'e→n→q→n', role: 'supporter', slot: 10, use: ['e', 'n', 'q', 'n'], evidence: 'KQM Sim Database（db.kqm.gg）の行動の形: 18 件・平均 57.0k・最大 72.8k。e n q n（探索の比較なし）。凸数: 使われている設定の最小は 6 凸（18 件。分布 0〜6 凸 = 0/0/0/0/0/0/18）' },
    ],
  },
  {
    characterId: '10000055-geo',
    archetypes: [
      { name: 'Q→E', role: 'subAttacker', slot: 20, use: ['q', 'e'], evidence: 'Wiki 本文のコンボの記述: 爆発→スキルで、旗指物の効果を乗せたスキルが撃てる（探索の比較なし）' },
      { name: 'e q の出場', role: 'supporter', slot: 30, use: ['e', 'q'], evidence: '自動編成（ゴロー + 雷電将軍・ベネット・フリーナ）の探索の上位に出る形。実測（最短の設定）: 37.7k → 37.8k' },
      { name: 'E→Q のあと、もう一度 N×2→E→Q', role: 'supporter', slot: 10, use: ['e', 'q'], then: [{ slot: 30, use: ['n', 'n', 'e', 'q'] }], requiresFavonius: true, evidence: 'KQM Sim Database（db.kqm.gg）の複数回出場の形: ゴロー 92 件中 8 件。平均 42.6k（最大 47.5k）。凸数: 使われている設定の最小は 6 凸（分布 0〜6 凸 = 0/0/0/0/0/0/8）（探索の比較なし）' },
      { name: 'E→Q のあと、もう一度 E→N', role: 'supporter', slot: 10, use: ['e', 'q'], then: [{ slot: 30, use: ['e', 'n'] }], requiresFavonius: true, evidence: 'KQM Sim Database（db.kqm.gg）の複数回出場の形: ゴロー 92 件中 3 件。平均 41.1k（最大 48.8k）。凸数: 使われている設定の最小は 6 凸（分布 0〜6 凸 = 0/0/0/0/0/0/3）（探索の比較なし）' },
      { name: 'e→n', role: 'subAttacker', slot: 20, use: ['e', 'n'], requiresFavonius: true, evidence: 'KQM Sim Database（db.kqm.gg）の行動の形: 12 件・平均 104.4k・最大 406.2k。e n（探索の比較なし）。凸数: 使われている設定の最小は 6 凸（12 件。分布 0〜6 凸 = 0/0/0/0/0/0/12）' },
    ],
  },
  {
    characterId: '10000056-electro',
    archetypes: [
      { name: 'E→重撃→Q', role: 'supporter', slot: 30, use: ['e', 'ca', 'q'], evidence: 'Phase 3-1精鋭辞書＋王道プローブ42.0k（粒子供給＋バフ）' },
      { name: 'E→Q（短縮バフ）', role: 'supporter', slot: 30, use: ['e', 'q'], evidence: 'Phase 3-1精鋭辞書: 2凸以上や時間短縮用のE→Q形' },
      { name: 'E→CA のあと、もう一度 Q', role: 'supporter', slot: 10, use: ['e', 'ca'], then: [{ slot: 30, use: ['q'] }], evidence: 'Phase 3-1精鋭辞書＋KQM新集計(24件/17.0%, 最多): 分割バフ型' },
    ],
  },
  {
    characterId: '10000061-dendro',
    archetypes: [
      { name: '長押しE→E', role: 'supporter', slot: 10, use: ['e_hold', 'e'], evidence: 'Wiki 本文のコンボの記述: スキル長押し→再発動で、印を 2 つ得られる（探索の比較なし）' },
      { name: 'e q の出場', role: 'supporter', slot: 30, use: ['e', 'q'], evidence: '自動編成（綺良々 + 雷電将軍・ベネット・フリーナ）の探索の上位に出る形。実測（最短の設定）: 40.4k → 41.2k' },
      { name: 'E_HOLD→Q（KQM）', role: 'supporter', slot: 10, use: ['e_hold', 'q'], evidence: 'KQM Sim Database（db.kqm.gg）の単数回の形: 綺良々 118 件中 5 件。平均 57.8k（最大 67.9k）。凸数: 使われている設定の最小は 6 凸（分布 0〜6 凸 = 0/0/0/0/0/0/5）（探索の比較なし）' },
      { name: 'E_HOLD のあと、もう一度 E_HOLD', role: 'supporter', slot: 10, use: ['e_hold'], then: [{ slot: 30, use: ['e_hold'] }], evidence: 'KQM Sim Database（db.kqm.gg）の複数回出場の形: 綺良々 118 件中 8 件。平均 76.6k（最大 105.6k）。凸数: 使われている設定の最小は 6 凸（分布 0〜6 凸 = 0/0/0/0/0/0/8）（探索の比較なし）' },
      { name: 'E→Q のあと、もう一度 E→N', role: 'supporter', slot: 10, use: ['e', 'q'], then: [{ slot: 30, use: ['e', 'n'] }], evidence: 'KQM Sim Database（db.kqm.gg）の複数回出場の形: 綺良々 118 件中 7 件。平均 62.8k（最大 68.6k）。凸数: 使われている設定の最小は 6 凸（分布 0〜6 凸 = 0/0/0/0/0/0/7）（探索の比較なし）' },
      { name: 'Q→E_HOLD のあと、もう一度 E_HOLD', role: 'supporter', slot: 10, use: ['q', 'e_hold'], then: [{ slot: 30, use: ['e_hold'] }], evidence: 'KQM Sim Database（db.kqm.gg）の複数回出場の形: 綺良々 118 件中 12 件。平均 53.4k（最大 66.2k）。凸数: 使われている設定の最小は 6 凸（分布 0〜6 凸 = 0/0/0/0/0/0/12）（探索の比較なし）' },
    ],
  },
  {
    characterId: '10000063-cryo',
    archetypes: [
      { name: '長押しE→Q（通常/重撃氷翎）', role: 'supporter', slot: 10, use: ['e_hold', 'q'], evidence: 'Phase 3-2精鋭辞書＋KQM新集計: 11.8% 通常/重撃強化長押しE→Q形' },
      { name: '短押しE→Q（スキル/爆発氷翎）', role: 'supporter', slot: 10, use: ['e', 'q'], evidence: 'Phase 3-2精鋭辞書＋KQM新集計: スキル/爆発強化短押しE→Q形' },
      { name: 'E→Q のあと、もう一度 E（氷翎2回）', role: 'supporter', slot: 10, use: ['e', 'q'], then: [{ slot: 30, use: ['e'] }], evidence: 'Phase 3-2精鋭辞書＋KQM新集計: 14.1% 最多氷翎2回更新形' },
      { name: 'E→Q→E（1凸2チャージ）', role: 'supporter', slot: 10, use: ['e', 'q', 'e'], constellation: { min: 1 }, evidence: 'Phase 3-2精鋭辞書＋KQM新集計: 1凸2チャージ連続E形' },
    ],
  },
  {
    characterId: '10000067-dendro',
    archetypes: [
      { name: 'e q の出場', role: 'supporter', slot: 30, use: ['e', 'q'], evidence: '自動編成（コレイ + 雷電将軍・ベネット・フリーナ）の探索の上位に出る形。実測（最短の設定）: 48.7k → 48.2k' },
      { name: 'N→E→N→Q（KQM）', role: 'subAttacker', slot: 20, use: ['n', 'e', 'n', 'q'], requiresFavonius: true, evidence: 'KQM Sim Database（db.kqm.gg）の単数回の形: コレイ 106 件中 5 件。平均 52.7k（最大 57.8k）。凸数: 使われている設定の最小は 6 凸（分布 0〜6 凸 = 0/0/0/0/0/0/5）（探索の比較なし）' },
      { name: 'Q→E（KQM）', role: 'subAttacker', slot: 20, use: ['q', 'e'], evidence: 'KQM Sim Database（db.kqm.gg）の単数回の形: コレイ 106 件中 4 件。平均 47.8k（最大 116.6k）。凸数: 使われている設定の最小は 6 凸（分布 0〜6 凸 = 0/0/0/0/0/0/4）（探索の比較なし）' },
      { name: 'Q→E のあと、もう一度 E', role: 'subAttacker', slot: 20, use: ['q', 'e'], then: [{ slot: 30, use: ['e'] }], evidence: 'KQM Sim Database（db.kqm.gg）の複数回出場の形: コレイ 106 件中 8 件。平均 45.8k（最大 53.1k）。凸数: 使われている設定の最小は 6 凸（分布 0〜6 凸 = 0/0/0/0/0/0/8）（探索の比較なし）' },
      { name: 'E のあと、もう一度 Q→N→E', role: 'subAttacker', slot: 20, use: ['e'], then: [{ slot: 30, use: ['q', 'n', 'e'] }], requiresFavonius: true, evidence: 'KQM Sim Database（db.kqm.gg）の複数回出場の形: コレイ 106 件中 5 件。平均 46.0k（最大 53.8k）。凸数: 使われている設定の最小は 6 凸（分布 0〜6 凸 = 0/0/0/0/0/0/5）（探索の比較なし）' },
      { name: 'E のあと、もう一度 Q→E', role: 'subAttacker', slot: 20, use: ['e'], then: [{ slot: 30, use: ['q', 'e'] }], evidence: 'KQM Sim Database（db.kqm.gg）の複数回出場の形: コレイ 106 件中 4 件。平均 51.0k（最大 60.7k）。凸数: 使われている設定の最小は 6 凸（分布 0〜6 凸 = 0/0/0/0/0/0/4）（探索の比較なし）' },
      { name: 'Q のあと、もう一度 E', role: 'subAttacker', slot: 20, use: ['q'], then: [{ slot: 30, use: ['e'] }], evidence: 'KQM Sim Database（db.kqm.gg）の複数回出場の形: コレイ 106 件中 4 件。平均 51.1k（最大 60.0k）。凸数: 使われている設定の最小は 6 凸（分布 0〜6 凸 = 0/0/0/0/0/0/4）（探索の比較なし）' },
    ],
  },
  {
    characterId: '10000068-electro',
    archetypes: [
      { name: 'q e の出場', role: 'supporter', slot: 20, use: ['q', 'e'], evidence: '自動編成（ドリー + 雷電将軍・ベネット・フリーナ）の探索の上位に出る形。実測（最短の設定）: 45.2k → 41.3k' },
      { name: 'E→N→Q（KQM）', role: 'supporter', slot: 10, use: ['e', 'n', 'q'], evidence: 'KQM Sim Database（db.kqm.gg）の単数回の形: ドリー 103 件中 7 件。平均 70.2k（最大 82.6k）。凸数: 使われている設定の最小は 6 凸（分布 0〜6 凸 = 0/0/0/0/0/0/7）（探索の比較なし）' },
      { name: 'E→Q→N（KQM）', role: 'supporter', slot: 10, use: ['e', 'q', 'n'], requiresFavonius: true, evidence: 'KQM Sim Database（db.kqm.gg）の単数回の形: ドリー 103 件中 7 件。平均 48.2k（最大 61.9k）。凸数: 使われている設定の最小は 6 凸（分布 0〜6 凸 = 0/0/0/0/0/0/7）（探索の比較なし）' },
      { name: 'E→N×2→Q（KQM）', role: 'supporter', slot: 10, use: ['e', 'n', 'n', 'q'], requiresFavonius: true, evidence: 'KQM Sim Database（db.kqm.gg）の単数回の形: ドリー 103 件中 4 件。平均 51.8k（最大 55.9k）。凸数: 使われている設定の最小は 6 凸（分布 0〜6 凸 = 0/0/0/0/0/0/4）（探索の比較なし）' },
      { name: 'E→N×2→DASH→N×2→Q→E→N×2→DASH→N×2→E→N×2→DASH→N×2（KQM）', role: 'supporter', slot: 10, use: ['e', 'n', 'n', 'dash', 'n', 'n', 'q', 'e', 'n', 'n', 'dash', 'n', 'n', 'e', 'n', 'n', 'dash', 'n', 'n'], evidence: 'KQM Sim Database（db.kqm.gg）の単数回の形: ドリー 103 件中 4 件。平均 69.1k（最大 81.1k）。凸数: 使われている設定の最小は 6 凸（分布 0〜6 凸 = 0/0/0/0/0/0/4）（探索の比較なし）' },
      { name: 'E→Q（KQM）', role: 'supporter', slot: 10, use: ['e', 'q'], evidence: 'KQM Sim Database（db.kqm.gg）の単数回の形: ドリー 103 件中 12 件。平均 59.8k（最大 72.0k）。凸数: 使われている設定の最小は 6 凸（分布 0〜6 凸 = 0/0/0/0/0/0/12）（探索の比較なし）' },
      { name: 'e→n×2→dash→n×2', role: 'supporter', slot: 20, use: ['e', 'n', 'n', 'dash', 'n', 'n'], evidence: 'KQM Sim Database（db.kqm.gg）の行動の形: 24 件・平均 61.2k・最大 81.4k。e n×2 dash n×2（探索の比較なし）。凸数: 使われている設定の最小は 6 凸（24 件。分布 0〜6 凸 = 0/0/0/0/0/0/24）' },
    ],
  },
  {
    characterId: '10000072-hydro',
    archetypes: [
      { name: 'e q の出場', role: 'supporter', slot: 10, use: ['e', 'q'], evidence: '自動編成（キャンディス + 雷電将軍・ベネット・フリーナ）の探索の上位に出る形。実測（最短の設定）: 37.8k → 37.9k' },
      { name: 'E→N×2→Q（KQM）', role: 'supporter', slot: 10, use: ['e', 'n', 'n', 'q'], evidence: 'KQM Sim Database（db.kqm.gg）の単数回の形: キャンディス 93 件中 6 件。平均 65.1k（最大 67.1k）。凸数: 使われている設定の最小は 6 凸（分布 0〜6 凸 = 0/0/0/0/0/0/6）（探索の比較なし）' },
      { name: 'E→Q→N×2（KQM）', role: 'supporter', slot: 10, use: ['e', 'q', 'n', 'n'], evidence: 'KQM Sim Database（db.kqm.gg）の単数回の形: キャンディス 93 件中 3 件。平均 87.6k（最大 100.5k）。凸数: 使われている設定の最小は 5 凸（分布 0〜6 凸 = 0/0/0/0/0/2/1）（探索の比較なし）' },
      { name: 'E→N→Q（KQM）', role: 'supporter', slot: 10, use: ['e', 'n', 'q'], evidence: 'KQM Sim Database（db.kqm.gg）の単数回の形: キャンディス 93 件中 3 件。平均 59.7k（最大 63.5k）。凸数: 使われている設定の最小は 6 凸（分布 0〜6 凸 = 0/0/0/0/0/0/3）（探索の比較なし）' },
      { name: 'E→Q→N のあと、もう一度 E→N×2', role: 'supporter', slot: 10, use: ['e', 'q', 'n'], then: [{ slot: 30, use: ['e', 'n', 'n'] }], evidence: 'KQM Sim Database（db.kqm.gg）の複数回出場の形: キャンディス 93 件中 3 件。平均 40.2k（最大 48.4k）。凸数: 使われている設定の最小は 6 凸（分布 0〜6 凸 = 0/0/0/0/0/0/3）（探索の比較なし）' },
      { name: 'N→E のあと、もう一度 N→E→Q→N', role: 'supporter', slot: 10, use: ['n', 'e'], then: [{ slot: 30, use: ['n', 'e', 'q', 'n'] }], evidence: 'KQM Sim Database（db.kqm.gg）の複数回出場の形: キャンディス 93 件中 3 件。平均 37.9k（最大 44.4k）。凸数: 使われている設定の最小は 6 凸（分布 0〜6 凸 = 0/0/0/0/0/0/3）（探索の比較なし）' },
      { name: 'e→n→q→n', role: 'supporter', slot: 10, use: ['e', 'n', 'q', 'n'], evidence: 'KQM Sim Database（db.kqm.gg）の行動の形: 14 件・平均 64.2k・最大 100.3k。e n q n（探索の比較なし）。凸数: 使われている設定の最小は 6 凸（14 件。分布 0〜6 凸 = 0/0/0/0/0/0/14）' },
    ],
  },
  {
    characterId: '10000074-cryo',
    archetypes: [
      { name: 'e q の出場', role: 'supporter', slot: 30, use: ['e', 'q'], evidence: '自動編成（レイラ + 雷電将軍・ベネット・フリーナ）の探索の上位に出る形。実測（最短の設定）: 38.8k → 38.8k' },
      { name: 'Q→N→E→N（KQM）', role: 'supporter', slot: 10, use: ['q', 'n', 'e', 'n'], requiresFavonius: true, evidence: 'KQM Sim Database（db.kqm.gg）の単数回の形: レイラ 117 件中 9 件。平均 65.9k（最大 94.2k）。凸数: 使われている設定の最小は 6 凸（分布 0〜6 凸 = 0/0/0/0/0/0/9）（探索の比較なし）' },
      { name: 'E→N→Q（KQM）', role: 'supporter', slot: 10, use: ['e', 'n', 'q'], requiresFavonius: true, evidence: 'KQM Sim Database（db.kqm.gg）の単数回の形: レイラ 117 件中 5 件。平均 60.5k（最大 76.9k）。凸数: 使われている設定の最小は 6 凸（分布 0〜6 凸 = 0/0/0/0/0/0/5）（探索の比較なし）' },
      { name: 'Q→E のあと、もう一度 Q→E', role: 'supporter', slot: 10, use: ['q', 'e'], then: [{ slot: 30, use: ['q', 'e'] }], evidence: 'KQM Sim Database（db.kqm.gg）の複数回出場の形: レイラ 117 件中 4 件。平均 47.1k（最大 66.8k）。凸数: 使われている設定の最小は 6 凸（分布 0〜6 凸 = 0/0/0/0/0/0/4）（探索の比較なし）' },
      { name: 'Q→E（KQM）', role: 'supporter', slot: 10, use: ['q', 'e'], evidence: 'KQM Sim Database（db.kqm.gg）の単数回の形: レイラ 117 件中 26 件。平均 53.5k（最大 113.5k）。凸数: 使われている設定の最小は 6 凸（分布 0〜6 凸 = 0/0/0/0/0/0/26）（探索の比較なし）' },
      { name: 'q→n→e', role: 'supporter', slot: 30, use: ['q', 'n', 'e'], requiresFavonius: true, evidence: 'KQM Sim Database（db.kqm.gg）の行動の形: 36 件・平均 66.6k・最大 116.4k。q n e（探索の比較なし）。凸数: 使われている設定の最小は 6 凸（36 件。分布 0〜6 凸 = 0/0/0/0/0/0/36）' },
    ],
  },
  {
    characterId: '10000077-dendro',
    archetypes: [
      { name: 'e の出場', role: 'supporter', slot: 30, use: ['e'], evidence: '自動編成（ヨォーヨ + 雷電将軍・ベネット・フリーナ）の探索の上位に出る形。実測（最短の設定）: 44.0k → 41.0k' },
      { name: 'E→N×2（KQM）', role: 'supporter', slot: 10, use: ['e', 'n', 'n'], requiresFavonius: true, evidence: 'KQM Sim Database（db.kqm.gg）の単数回の形: ヨォーヨ 82 件中 5 件。平均 52.9k（最大 63.1k）。凸数: 使われている設定の最小は 6 凸（分布 0〜6 凸 = 0/0/0/0/0/0/5）（探索の比較なし）' },
      { name: 'N→E（KQM）', role: 'supporter', slot: 10, use: ['n', 'e'], requiresFavonius: true, evidence: 'KQM Sim Database（db.kqm.gg）の単数回の形: ヨォーヨ 82 件中 5 件。平均 57.3k（最大 72.6k）。凸数: 使われている設定の最小は 6 凸（分布 0〜6 凸 = 0/0/0/0/0/0/5）（探索の比較なし）' },
      { name: 'Q→DASH→N→DASH→N→JUMP→N→JUMP→N→DASH→N→DASH→N→JUMP→E（KQM）', role: 'supporter', slot: 10, use: ['q', 'dash', 'n', 'dash', 'n', 'jump', 'n', 'jump', 'n', 'dash', 'n', 'dash', 'n', 'jump', 'e'], evidence: 'KQM Sim Database（db.kqm.gg）の単数回の形: ヨォーヨ 82 件中 3 件。平均 60.4k（最大 69.8k）。凸数: 使われている設定の最小は 6 凸（分布 0〜6 凸 = 0/0/0/0/0/0/3）（探索の比較なし）' },
      { name: 'N→E→N のあと、もう一度 Q→N×2→DASH→N×2→DASH→N×2→DASH→N×2→DASH→N', role: 'supporter', slot: 10, use: ['n', 'e', 'n'], then: [{ slot: 30, use: ['q', 'n', 'n', 'dash', 'n', 'n', 'dash', 'n', 'n', 'dash', 'n', 'n', 'dash', 'n'] }], requiresFavonius: true, evidence: 'KQM Sim Database（db.kqm.gg）の複数回出場の形: ヨォーヨ 82 件中 3 件。平均 37.0k（最大 43.0k）。凸数: 使われている設定の最小は 6 凸（分布 0〜6 凸 = 0/0/0/0/0/0/3）（探索の比較なし）' },
    ],
  },
  {
    characterId: '10000082-dendro',
    archetypes: [
      { name: 'E→Q', role: 'supporter', slot: 10, use: ['e', 'q'], evidence: 'Phase 3-2精鋭辞書＋KQM新集計: 17.8% 最多基本E→Q形' },
      { name: 'E→Q のあと、もう一度 E', role: 'supporter', slot: 10, use: ['e', 'q'], then: [{ slot: 30, use: ['e'] }], evidence: 'Phase 3-2精鋭辞書＋KQM新集計: 5.9% 2回出場E草付着・粒子形' },
      { name: 'E だけ', role: 'supporter', slot: 10, use: ['e'], evidence: 'Phase 3-2精鋭辞書＋KQM新集計: 爆発省略短時間草付着・回復形' },
      { name: 'E→Q→E（1凸2チャージ）', role: 'supporter', slot: 10, use: ['e', 'q', 'e'], constellation: { min: 1 }, evidence: 'Phase 3-2精鋭辞書＋KQM新集計: 1凸2チャージ連続E形' },
    ],
  },
  {
    characterId: '10000083-anemo',
    archetypes: [
      { name: 'e q の出場', role: 'supporter', slot: 30, use: ['e', 'q'], evidence: '自動編成（リネット + 雷電将軍・ベネット・フリーナ）の探索の上位に出る形。実測（最短の設定）: 48.9k → 48.6k' },
      { name: 'E→N→Q（KQM）', role: 'subAttacker', slot: 20, use: ['e', 'n', 'q'], requiresFavonius: true, evidence: 'KQM Sim Database（db.kqm.gg）の単数回の形: リネット 128 件中 5 件。平均 65.6k（最大 99.5k）。凸数: 使われている設定の最小は 6 凸（分布 0〜6 凸 = 0/0/0/0/0/0/5）（探索の比較なし）' },
      { name: 'E→Q のあと、もう一度 E→N', role: 'supporter', slot: 10, use: ['e', 'q'], then: [{ slot: 30, use: ['e', 'n'] }], requiresFavonius: true, evidence: 'KQM Sim Database（db.kqm.gg）の複数回出場の形: リネット 128 件中 9 件。平均 76.0k（最大 86.5k）。凸数: 使われている設定の最小は 6 凸（分布 0〜6 凸 = 0/0/0/0/0/0/9）（探索の比較なし）' },
      { name: 'Q→E→N×2→CA→N×2→CA→N のあと、もう一度 E→N×2→CA→N→CA→N→CA', role: 'subAttacker', slot: 20, use: ['q', 'e', 'n', 'n', 'ca', 'n', 'n', 'ca', 'n'], then: [{ slot: 30, use: ['e', 'n', 'n', 'ca', 'n', 'ca', 'n', 'ca'] }], evidence: 'KQM Sim Database（db.kqm.gg）の複数回出場の形: リネット 128 件中 4 件。平均 55.1k（最大 59.2k）。凸数: 使われている設定の最小は 6 凸（分布 0〜6 凸 = 0/0/0/0/0/0/4）（探索の比較なし）' },
      { name: 'E→N→Q のあと、もう一度 E→N', role: 'subAttacker', slot: 20, use: ['e', 'n', 'q'], then: [{ slot: 30, use: ['e', 'n'] }], requiresFavonius: true, evidence: 'KQM Sim Database（db.kqm.gg）の複数回出場の形: リネット 128 件中 4 件。平均 77.2k（最大 89.7k）。凸数: 使われている設定の最小は 6 凸（分布 0〜6 凸 = 0/0/0/0/0/0/4）（探索の比較なし）' },
    ],
  },
  {
    characterId: '10000088-cryo',
    archetypes: [
      { name: 'e q の出場', role: 'supporter', slot: 20, use: ['e', 'q'], evidence: '自動編成（シャルロット + 雷電将軍・ベネット・フリーナ）の探索の上位に出る形。実測（最短の設定）: 43.8k → 44.3k' },
      { name: 'Q→E（KQM）', role: 'supporter', slot: 10, use: ['q', 'e'], evidence: 'KQM Sim Database（db.kqm.gg）の単数回の形: シャルロット 97 件中 4 件。平均 54.4k（最大 58.0k）。凸数: 使われている設定の最小は 6 凸（分布 0〜6 凸 = 0/0/0/0/0/0/4）（探索の比較なし）' },
      { name: 'E_HOLD→Q→N（KQM）', role: 'supporter', slot: 10, use: ['e_hold', 'q', 'n'], evidence: 'KQM Sim Database（db.kqm.gg）の単数回の形: シャルロット 97 件中 4 件。平均 64.2k（最大 76.1k）。凸数: 使われている設定の最小は 6 凸（分布 0〜6 凸 = 0/0/0/0/0/0/4）（探索の比較なし）' },
      { name: 'E→Q→N（KQM）', role: 'supporter', slot: 10, use: ['e', 'q', 'n'], evidence: 'KQM Sim Database（db.kqm.gg）の単数回の形: シャルロット 97 件中 16 件。平均 64.2k（最大 93.5k）。凸数: 使われている設定の最小は 6 凸（分布 0〜6 凸 = 0/0/0/0/0/0/16）（探索の比較なし）' },
      { name: 'e→n→q→n', role: 'supporter', slot: 20, use: ['e', 'n', 'q', 'n'], evidence: 'KQM Sim Database（db.kqm.gg）の行動の形: 20 件・平均 70.2k・最大 93.5k。e n q n（探索の比較なし）。凸数: 使われている設定の最小は 6 凸（20 件。分布 0〜6 凸 = 0/0/0/0/0/0/20）' },
    ],
  },
  {
    characterId: '10000090-pyro',
    archetypes: [
      { name: 'Q→長押しE（過負荷バフ定番）', role: 'supporter', slot: 10, use: ['q', 'e_hold'], evidence: 'Phase 3-2精鋭辞書＋KQM新集計: 19.0% 過負荷起爆→長押しE攻撃バフ定番形' },
      { name: '長押しE→Q', role: 'supporter', slot: 10, use: ['e_hold', 'q'], evidence: 'Phase 3-2精鋭辞書＋KQM新集計: 12.8% 長押しE先行形' },
      { name: '長押しE だけ', role: 'supporter', slot: 20, use: ['e_hold'], evidence: 'Phase 3-2精鋭辞書＋KQM新集計: 爆発省略時短バフ形' },
      { name: 'Q→長押しE×3（4凸CTリセット）', role: 'supporter', slot: 10, use: ['q', 'e_hold', 'e_hold', 'e_hold'], constellation: { min: 4 }, evidence: 'Phase 3-2精鋭辞書＋KQM新集計: 21.3% 最多4凸E3連発形' },
    ],
  },
  {
    characterId: '10000094-geo',
    archetypes: [
      { name: 'e e の出場', role: 'supporter', slot: 30, use: ['e', 'e'], evidence: '自動編成（千織 + 雷電将軍・ベネット・フリーナ）の探索の上位に出る形。実測（最短の設定）: 44.8k → 46.6k' },
      { name: 'E→通常2→E の繰り返し', role: 'attacker', slot: 40, use: ['e'], fill: ['n', 'n', 'e'], fillRepeat: [7, 8], evidence: 'Wiki 本文のコンボの記述: [スキル→通常 2 回→スキル]×8（探索の比較なし）' },
      { name: 'E→通常3→E の繰り返し', role: 'attacker', slot: 40, use: ['e'], fill: ['n', 'n', 'n', 'e'], fillRepeat: [5, 6], evidence: 'Wiki 本文のコンボの記述: [スキル→通常 3 回→スキル]×6（探索の比較なし）' },
      { name: 'q→e×2', role: 'attacker', slot: 40, use: ['q', 'e', 'e'], constellation: { min: 0 }, evidence: 'KQM Sim Database（db.kqm.gg）の行動の形: 16 件・平均 86.2k・最大 391.6k。q e×2（探索の比較なし）。凸数: 使われている設定の最小は 0 凸（16 件。分布 0〜6 凸 = 14/0/1/0/0/0/1）' },
    ],
  },
  {
    characterId: '10000095-hydro',
    archetypes: [
      { name: 'e q の出場', role: 'supporter', slot: 30, use: ['e', 'q'], evidence: '自動編成（シグウィン + 雷電将軍・ベネット・フリーナ）の探索の上位に出る形。実測（最短の設定）: 47.9k → 47.1k' },
      { name: 'E→N×2（KQM）', role: 'supporter', slot: 10, use: ['e', 'n', 'n'], constellation: { min: 0 }, evidence: 'KQM Sim Database（db.kqm.gg）の単数回の形: シグウィン 53 件中 6 件。平均 67.0k（最大 77.5k）。凸数: 使われている設定の最小は 0 凸（分布 0〜6 凸 = 6/0/0/0/0/0/0）（探索の比較なし）' },
      { name: 'N×2→E（KQM）', role: 'supporter', slot: 10, use: ['n', 'n', 'e'], constellation: { min: 0 }, requiresFavonius: true, evidence: 'KQM Sim Database（db.kqm.gg）の単数回の形: シグウィン 53 件中 5 件。平均 61.5k（最大 64.8k）。凸数: 使われている設定の最小は 0 凸（分布 0〜6 凸 = 5/0/0/0/0/0/0）（探索の比較なし）' },
      { name: 'N→E（KQM）', role: 'supporter', slot: 10, use: ['n', 'e'], constellation: { min: 0 }, evidence: 'KQM Sim Database（db.kqm.gg）の単数回の形: シグウィン 53 件中 3 件。平均 63.1k（最大 68.8k）。凸数: 使われている設定の最小は 0 凸（分布 0〜6 凸 = 3/0/0/0/0/0/0）（探索の比較なし）' },
      { name: 'E→DASH（KQM）', role: 'supporter', slot: 10, use: ['e', 'dash'], constellation: { min: 0 }, evidence: 'KQM Sim Database（db.kqm.gg）の単数回の形: シグウィン 53 件中 11 件。平均 64.8k（最大 95.1k）。凸数: 使われている設定の最小は 0 凸（分布 0〜6 凸 = 11/0/0/0/0/0/0）（探索の比較なし）' },
    ],
  },
  {
    characterId: '10000108-anemo',
    archetypes: [
      { name: 'e e の出場', role: 'supporter', slot: 30, use: ['e', 'e'], evidence: '自動編成（藍硯 + 雷電将軍・ベネット・フリーナ）の探索の上位に出る形。実測（最短の設定）: 44.8k → 44.5k' },
      { name: 'E×2 のあと、もう一度 E×2', role: 'supporter', slot: 10, use: ['e', 'e'], then: [{ slot: 30, use: ['e', 'e'] }], constellation: { min: 6 }, evidence: 'KQM Sim Database（db.kqm.gg）の複数回出場の形: 藍硯 89 件中 4 件。平均 67.4k（最大 78.3k）。凸数: 使われている設定の最小は 6 凸（分布 0〜6 凸 = 0/0/0/0/0/0/4）（探索の比較なし）' },
      { name: 'E×2→Q のあと、もう一度 E×2', role: 'supporter', slot: 10, use: ['e', 'e', 'q'], then: [{ slot: 30, use: ['e', 'e'] }], constellation: { min: 6 }, evidence: 'KQM Sim Database（db.kqm.gg）の複数回出場の形: 藍硯 89 件中 3 件。平均 60.7k（最大 74.1k）。凸数: 使われている設定の最小は 6 凸（分布 0〜6 凸 = 0/0/0/0/0/0/3）（探索の比較なし）' },
    ],
  },
  {
    characterId: '10000115-hydro',
    archetypes: [
      { name: 'e q の出場', role: 'supporter', slot: 30, use: ['e', 'q'], evidence: '自動編成（ダリア + 雷電将軍・ベネット・フリーナ）の探索の上位に出る形。実測（最短の設定）: 38.0k → 39.7k' },
      { name: 'N→E→N→Q（KQM）', role: 'supporter', slot: 10, use: ['n', 'e', 'n', 'q'], requiresFavonius: true, evidence: 'KQM Sim Database（db.kqm.gg）の単数回の形: ダリア 31 件中 5 件。平均 76.0k（最大 98.9k）。凸数: 使われている設定の最小は 6 凸（分布 0〜6 凸 = 0/0/0/0/0/0/5）（探索の比較なし）' },
      { name: 'N→E→Q（KQM）', role: 'supporter', slot: 10, use: ['n', 'e', 'q'], requiresFavonius: true, evidence: 'KQM Sim Database（db.kqm.gg）の単数回の形: ダリア 31 件中 4 件。平均 100.1k（最大 124.8k）。凸数: 使われている設定の最小は 6 凸（分布 0〜6 凸 = 0/0/0/0/0/0/4）（探索の比較なし）' },
      { name: 'E→N×2→Q（KQM）', role: 'supporter', slot: 10, use: ['e', 'n', 'n', 'q'], requiresFavonius: true, evidence: 'KQM Sim Database（db.kqm.gg）の単数回の形: ダリア 31 件中 3 件。平均 70.2k（最大 73.4k）。凸数: 使われている設定の最小は 6 凸（分布 0〜6 凸 = 0/0/0/0/0/0/3）（探索の比較なし）' },
      { name: 'e→n→q', role: 'supporter', slot: 30, use: ['e', 'n', 'q'], requiresFavonius: true, evidence: 'KQM Sim Database（db.kqm.gg）の行動の形: 8 件・平均 78.6k・最大 99.2k。e n q（探索の比較なし）。凸数: 使われている設定の最小は 6 凸（8 件。分布 0〜6 凸 = 0/0/0/0/0/0/8）' },
    ],
  },
  {
    characterId: '10000121-hydro',
    archetypes: [
      { name: 'q の出場', role: 'supporter', slot: 30, use: ['q'], evidence: '自動編成（アイノ + 雷電将軍・ベネット・フリーナ）の探索の上位に出る形。実測（最短の設定）: 40.5k → 41.0k' },
      { name: 'Q→E（KQM）', role: 'supporter', slot: 10, use: ['q', 'e'], evidence: 'KQM Sim Database（db.kqm.gg）の単数回の形: アイノ 29 件中 3 件。平均 89.7k（最大 101.9k）。凸数: 使われている設定の最小は 6 凸（分布 0〜6 凸 = 0/0/0/0/0/0/3）（探索の比較なし）' },
      { name: 'E→Q（KQM）', role: 'supporter', slot: 10, use: ['e', 'q'], evidence: 'KQM Sim Database（db.kqm.gg）の単数回の形: アイノ 29 件中 20 件。平均 86.8k（最大 154.5k）。凸数: 使われている設定の最小は 6 凸（分布 0〜6 凸 = 0/0/0/0/0/0/20）（探索の比較なし）' },
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
      { name: 'E→Q→E', role: 'supporter', slot: 10, use: ['e', 'q', 'e'], evidence: 'Wiki 本文のコンボの記述: スキル→爆発→追加スキルの順で、粒子を無駄にしない（探索の比較なし）' },
      { name: 'e q の出場', role: 'supporter', slot: 30, use: ['e', 'q'], evidence: '自動編成（プルーネ + 雷電将軍・ベネット・フリーナ）の探索の上位に出る形。実測（最短の設定）: 54.8k → 53.5k' },
      { name: 'q→e', role: 'supporter', slot: 10, use: ['q', 'e'], evidence: 'KQM Sim Database（db.kqm.gg）の行動の形: 5 件・平均 613.0k・最大 1382.5k。q e（探索の比較なし）。凸数: 使われている設定の最小は 6 凸（5 件。分布 0〜6 凸 = 0/0/0/0/0/0/5）' },
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
      { name: 'E→Q→特殊スキル', role: 'subAttacker', slot: 20, use: ['e', 'q', 'e_recast'], evidence: 'Wiki 本文のコンボの記述: 「雪鳥の夢」と「春の華」のバフを両方乗せるなら、スキル→爆発→特殊スキル（探索の比較なし）' },
      { name: 'Q→特殊スキル', role: 'subAttacker', slot: 20, use: ['q', 'e_recast'], evidence: 'Wiki 本文のコンボの記述: スキルの代わりに、爆発→特殊スキルでもよい（探索の比較なし）' },
      { name: 'E→特殊スキル', role: 'subAttacker', slot: 20, use: ['e', 'e_recast'], evidence: 'Wiki 本文のコンボの記述: 基本は、スキル→特殊スキル（星反応のダメージが出る）（探索の比較なし）' },
      { name: 'q e e_recast の出場', role: 'supporter', slot: 30, use: ['q', 'e', 'e_recast'], evidence: '自動編成（オデット + 雷電将軍・ベネット・フリーナ）の探索の上位に出る形。実測（最短の設定）: 52.7k → 55.4k' },
    ],
  },
  {
    characterId: '10000002-cryo',
    archetypes: [
      { name: 'ダッシュ→E→Q のあと N2C 連打', role: 'attacker', slot: 40, use: ['dash', 'e', 'q'], fill: ['n', 'n', 'ca'], fillRepeat: [2, 3], evidence: 'Phase 3-2精鋭辞書＋KQM新集計: 氷付与ダッシュE→Q→N2C王道形' },
      { name: 'E→ダッシュ→Q→N2C のあと、もう一度 ダッシュ→E→N2C', role: 'attacker', slot: 20, use: ['e', 'dash', 'q', 'n', 'n', 'ca'], then: [{ slot: 40, use: ['dash', 'e'] }], fill: ['n', 'n', 'ca'], fillRepeat: [2, 3], evidence: 'Phase 3-2精鋭辞書＋KQM新集計: 4.4% 最多2回出場N2C形' },
      { name: 'ダッシュ→N→E→Q のあと N2C 連打（霧切対応）', role: 'attacker', slot: 40, use: ['dash', 'n', 'e', 'q'], fill: ['n', 'n', 'ca'], fillRepeat: [2, 3], evidence: 'Phase 3-2精鋭辞書＋KQM新集計: 霧切スタック用ダッシュN始動形' },
      { name: 'ダッシュ→E→Q（爆発サブ）', role: 'subAttacker', slot: 20, use: ['dash', 'e', 'q'], evidence: 'Phase 3-2精鋭辞書＋KQM新集計: 爆発サブ火力形' },
    ],
  },
  {
    characterId: '10000005-cryo',
    archetypes: [
      { name: 'E・通常攻撃・Q のあと 通常攻撃 + 重撃を繰り返す', role: 'attacker', slot: 40, use: ['e', 'n', 'n', 'n', 'q'], fill: ['n', 'n', 'n', 'n', 'ca'], fillRepeat: [2, 3], evidence: 'Wiki 本文の運用の記述から解釈（探索の比較なし）: 星電導型: スキル → 通常攻撃・重撃でバフ → 爆発' },
      { name: 'E・Q（星拡散のサブ）', role: 'subAttacker', slot: 20, use: ['e', 'q'], evidence: 'Wiki 本文の運用の記述から解釈（探索の比較なし）: 星拡散型は控えから氷付着するサブアタッカー' },
    ],
  },
  {
    characterId: '10000005-dendro',
    archetypes: [
      { name: 'E・Q', role: 'supporter', slot: 10, use: ['e', 'q'], evidence: 'Wiki 本文の運用の記述から解釈（探索の比較なし）: 爆発の草付着で下地を作る' },
      { name: 'E→N→Q→N のあと、もう一度 E→N×3', role: 'supporter', slot: 10, use: ['e', 'n', 'q', 'n'], then: [{ slot: 30, use: ['e', 'n', 'n', 'n'] }], constellation: { min: 6 }, requiresFavonius: true, evidence: 'KQM Sim Database（db.kqm.gg）の複数回出場の形: 空(草) 17 件中 3 件。平均 48.5k（最大 49.9k）。凸数: 使われている設定の最小は 6 凸（分布 0〜6 凸 = 0/0/0/0/0/0/3）（探索の比較なし）' },
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
      { name: 'E_HOLD→N（KQM）', role: 'subAttacker', slot: 20, use: ['e_hold', 'n'], constellation: { min: 6 }, evidence: 'KQM Sim Database（db.kqm.gg）の単数回の形: 空(炎) 20 件中 3 件。平均 63.4k（最大 75.9k）。凸数: 使われている設定の最小は 6 凸（分布 0〜6 凸 = 0/0/0/0/0/0/3）（探索の比較なし）' },
      { name: 'N→E_HOLD→N（KQM）', role: 'subAttacker', slot: 20, use: ['n', 'e_hold', 'n'], constellation: { min: 6 }, evidence: 'KQM Sim Database（db.kqm.gg）の単数回の形: 空(炎) 20 件中 3 件。平均 63.7k（最大 71.7k）。凸数: 使われている設定の最小は 6 凸（分布 0〜6 凸 = 0/0/0/0/0/0/3）（探索の比較なし）' },
    ],
  },
  {
    characterId: '10000007-cryo',
    archetypes: [
      { name: 'E・通常攻撃・Q のあと 通常攻撃 + 重撃を繰り返す', role: 'attacker', slot: 40, use: ['e', 'n', 'n', 'n', 'q'], fill: ['n', 'n', 'n', 'n', 'ca'], fillRepeat: [2, 3], evidence: 'Wiki 本文の運用の記述から解釈（探索の比較なし）: 星電導型: スキル → 通常攻撃・重撃でバフ → 爆発' },
      { name: 'E・Q（星拡散のサブ）', role: 'subAttacker', slot: 20, use: ['e', 'q'], evidence: 'Wiki 本文の運用の記述から解釈（探索の比較なし）: 星拡散型は控えから氷付着するサブアタッカー' },
    ],
  },
  {
    characterId: '10000007-dendro',
    archetypes: [
      { name: 'E・Q', role: 'supporter', slot: 10, use: ['e', 'q'], evidence: 'Wiki 本文の運用の記述から解釈（探索の比較なし）: 爆発の草付着で下地を作る' },
      { name: 'Q→E→N×2→CA（KQM）', role: 'supporter', slot: 10, use: ['q', 'e', 'n', 'n', 'ca'], constellation: { min: 6 }, requiresFavonius: true, evidence: 'KQM Sim Database（db.kqm.gg）の単数回の形: 蛍(草) 59 件中 3 件。平均 51.1k（最大 56.1k）。凸数: 使われている設定の最小は 6 凸（分布 0〜6 凸 = 0/0/0/0/0/0/3）（探索の比較なし）' },
      { name: 'E→Q→N×2 のあと、もう一度 E→N×3', role: 'supporter', slot: 10, use: ['e', 'q', 'n', 'n'], then: [{ slot: 30, use: ['e', 'n', 'n', 'n'] }], constellation: { min: 6 }, requiresFavonius: true, evidence: 'KQM Sim Database（db.kqm.gg）の複数回出場の形: 蛍(草) 59 件中 5 件。平均 42.4k（最大 50.5k）。凸数: 使われている設定の最小は 6 凸（分布 0〜6 凸 = 0/0/0/0/0/0/5）（探索の比較なし）' },
      { name: 'E→Q のあと、もう一度 E→N', role: 'supporter', slot: 10, use: ['e', 'q'], then: [{ slot: 30, use: ['e', 'n'] }], constellation: { min: 6 }, requiresFavonius: true, evidence: 'KQM Sim Database（db.kqm.gg）の複数回出場の形: 蛍(草) 59 件中 4 件。平均 59.2k（最大 68.8k）。凸数: 使われている設定の最小は 6 凸（分布 0〜6 凸 = 0/0/0/0/0/0/4）（探索の比較なし）' },
      { name: 'E→Q→N のあと、もう一度 E→N', role: 'supporter', slot: 10, use: ['e', 'q', 'n'], then: [{ slot: 30, use: ['e', 'n'] }], constellation: { min: 6 }, requiresFavonius: true, evidence: 'KQM Sim Database（db.kqm.gg）の複数回出場の形: 蛍(草) 59 件中 3 件。平均 80.5k（最大 106.9k）。凸数: 使われている設定の最小は 6 凸（分布 0〜6 凸 = 0/0/0/0/0/0/3）（探索の比較なし）' },
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
      { name: 'E→Q のあと、もう一度 E→Q', role: 'subAttacker', slot: 20, use: ['e', 'q'], then: [{ slot: 30, use: ['e', 'q'] }], constellation: { min: 6 }, evidence: 'KQM Sim Database（db.kqm.gg）の複数回出場の形: 蛍(炎) 45 件中 3 件。平均 76.0k（最大 79.5k）。凸数: 使われている設定の最小は 6 凸（分布 0〜6 凸 = 0/0/0/0/0/0/3）（探索の比較なし）' },
    ],
  },
  {
    characterId: '10000033-hydro',
    archetypes: [
      { name: '初動E→弓Q→双剣 N2C ダッシュ', role: 'attacker', slot: 40, use: ['q', 'e'], fill: ['n', 'n', 'ca', 'dash'], fillRepeat: [3, 4], lead: ['e'], evidence: 'Phase 3-1精鋭辞書＋KQM新集計: 初動水付着→弓Q→双剣N2CD' },
      { name: '先置きE のあと、弓Q→双剣 N2C ダッシュ', role: 'attacker', slot: 10, use: ['e'], then: [{ slot: 40, use: ['q', 'e'] }], fill: ['n', 'n', 'ca', 'dash'], fillRepeat: [3, 4], evidence: 'Phase 3-1精鋭辞書: 先置きE→万葉拡散→弓Q→双剣N2CD' },
      { name: 'E→近接Q→双剣 N2C ダッシュ', role: 'attacker', slot: 40, use: ['e', 'q'], fill: ['n', 'n', 'ca', 'dash'], fillRepeat: [3, 4], evidence: 'Phase 3-1精鋭辞書: 1周完結・近接Q→双剣N2CD' },
      { name: 'E→双剣 N3C ダッシュ（爆発温存）', role: 'attacker', slot: 40, use: ['e'], fill: ['n', 'n', 'n', 'ca', 'dash'], fillRepeat: [2, 3], evidence: 'Phase 3-1精鋭辞書: 爆発温存時の双剣通常重撃型' },
    ],
  },
  {
    characterId: '10000037-cryo',
    archetypes: [
      { name: 'E→重撃→E→重撃', role: 'attacker', slot: 40, use: ['e', 'ca', 'e', 'ca'], fill: ['ca'], fillRepeat: [1, 2, 3], evidence: 'Wiki 本文のコンボの記述: 元素スキル→重撃の動きを 2 回行うと、高い瞬間火力が出る（2 重・4 重の効果）（探索の比較なし）' },
      { name: 'E・Q（爆発サブ）', role: 'subAttacker', slot: 20, use: ['e', 'q'], evidence: 'Wiki 本文の運用の記述から解釈（探索の比較なし）: 爆発主体のサブアタッカー運用' },
    
      { name: 'E・Q のあと 重撃を繰り返す', role: 'attacker', slot: 40, use: ['e', 'q'], fill: ['ca'], fillRepeat: [4, 5, 6], lead: ['n'], evidence: 'Wiki 本文の運用の記述から解釈（探索の比較なし）: 爆発を出しながら 2 段チャージの重撃を撃つのが基本（凍結型）' },
    ],
  },
  {
    characterId: '10000051-cryo',
    archetypes: [
      { name: 'E→Q→N×4→長押しE のあと通常連打（王道光臨の剣）', role: 'attacker', slot: 40, use: ['e', 'q', 'n', 'n', 'n', 'n', 'e_hold'], fill: ['n'], fillRepeat: [4, 5], evidence: 'Phase 3-2精鋭辞書＋KQM新集計: 王道光臨の剣N4→hE→N4形' },
      { name: '先置きE のあと Q→N×4→長押しE→通常連打', role: 'attacker', slot: 10, use: ['e'], then: [{ slot: 40, use: ['q', 'n', 'n', 'n', 'n', 'e_hold'] }], fill: ['n'], fillRepeat: [4, 5], evidence: 'Phase 3-2精鋭辞書＋KQM新集計: 先置きE冷却稼ぎ光臨の剣形' },
      { name: 'E→Q→長押しE のあと N4D 連打', role: 'attacker', slot: 40, use: ['e', 'q', 'e_hold'], fill: ['n', 'n', 'n', 'n', 'dash'], fillRepeat: [2], evidence: 'Phase 3-2精鋭辞書＋KQM新集計: N4Dダッシュキャンセル形' },
    ],
  },
  {
    characterId: '10000069-dendro',
    archetypes: [
      { name: 'E→重撃→Q→重撃×2（KQM最多）', role: 'attacker', slot: 40, use: ['e', 'ca', 'q', 'ca', 'ca'], evidence: 'Phase 3-2精鋭辞書＋KQM新集計: 20.0% 最多CA→Q→CA2形' },
      { name: 'E→重撃×3→Q', role: 'attacker', slot: 40, use: ['e', 'ca', 'ca', 'ca', 'q'], evidence: 'Phase 3-2精鋭辞書＋KQM新集計: CA3→Q締め形' },
      { name: 'E→重撃→Q→重撃×2（2回出場）', role: 'attacker', slot: 20, use: ['e', 'ca', 'q', 'ca', 'ca'], then: [{ slot: 40, use: ['e', 'ca', 'q', 'ca', 'ca'] }], evidence: 'Phase 3-2精鋭辞書＋KQM新集計: 13.8% クイックスワップ2回出場形' },
      { name: 'E→重撃→Q→重撃×2 のあと E→重撃×3', role: 'attacker', slot: 20, use: ['e', 'ca', 'q', 'ca', 'ca'], then: [{ slot: 40, use: ['e', 'ca', 'ca', 'ca'] }], evidence: 'Phase 3-2精鋭辞書＋KQM新集計: 12.5% 2回目爆発省略2回出場形' },
    ],
  },
  {
    characterId: '10000079-pyro',
    archetypes: [
      { name: 'E（炎付着サポート）', role: 'supporter', slot: 10, use: ['e'], evidence: 'Wiki 本文の運用の記述から解釈（探索の比較なし）: 控えから炎付着するサポート型' },
      { name: 'E・Q のあと 通常攻撃を繰り返す（爆発アタッカー）', role: 'attacker', slot: 40, use: ['e', 'q'], fill: ['n'], fillRepeat: [4, 6, 8], evidence: 'Wiki 本文の運用の記述から解釈（探索の比較なし）: 爆発の強化攻撃を連打する爆発アタッカー型' },
      { name: 'N→E（KQM）', role: 'supporter', slot: 10, use: ['n', 'e'], constellation: { min: 0 }, evidence: 'KQM Sim Database（db.kqm.gg）の単数回の形: ディシア 172 件中 6 件。平均 55.7k（最大 60.4k）。凸数: 使われている設定の最小は 0 凸（分布 0〜6 凸 = 6/0/0/0/0/0/0）（探索の比較なし）' },
      { name: 'E×2（KQM）', role: 'supporter', slot: 10, use: ['e', 'e'], constellation: { min: 0 }, evidence: 'KQM Sim Database（db.kqm.gg）の単数回の形: ディシア 172 件中 22 件。平均 58.1k（最大 77.8k）。凸数: 使われている設定の最小は 0 凸（分布 0〜6 凸 = 21/1/0/0/0/0/0）（探索の比較なし）' },
      { name: 'E のあと、もう一度 Q→N×10、さらに E', role: 'supporter', slot: 10, use: ['e'], then: [{ slot: 30, use: ['q', 'n', 'n', 'n', 'n', 'n', 'n', 'n', 'n', 'n', 'n'] }, { slot: 35, use: ['e'] }], constellation: { min: 1 }, evidence: 'KQM Sim Database（db.kqm.gg）の複数回出場の形: ディシア 172 件中 38 件。平均 46.3k（最大 56.2k）。凸数: 使われている設定の最小は 1 凸（分布 0〜6 凸 = 0/38/0/0/0/0/0）（探索の比較なし）' },
      { name: 'E のあと、もう一度 Q→N×10、さらに E→N', role: 'supporter', slot: 10, use: ['e'], then: [{ slot: 30, use: ['q', 'n', 'n', 'n', 'n', 'n', 'n', 'n', 'n', 'n', 'n'] }, { slot: 35, use: ['e', 'n'] }], constellation: { min: 0 }, evidence: 'KQM Sim Database（db.kqm.gg）の複数回出場の形: ディシア 172 件中 18 件。平均 49.8k（最大 93.3k）。凸数: 使われている設定の最小は 0 凸（分布 0〜6 凸 = 1/15/0/0/2/0/0）（探索の比較なし）' },
      { name: 'E×2 のあと、もう一度 Q→N×10', role: 'supporter', slot: 10, use: ['e', 'e'], then: [{ slot: 30, use: ['q', 'n', 'n', 'n', 'n', 'n', 'n', 'n', 'n', 'n', 'n'] }], constellation: { min: 1 }, evidence: 'KQM Sim Database（db.kqm.gg）の複数回出場の形: ディシア 172 件中 11 件。平均 53.2k（最大 77.8k）。凸数: 使われている設定の最小は 1 凸（分布 0〜6 凸 = 0/9/2/0/0/0/0）（探索の比較なし）' },
      { name: 'q→n×10', role: 'attacker', slot: 40, use: ['q', 'n', 'n', 'n', 'n', 'n', 'n', 'n', 'n', 'n', 'n'], constellation: { min: 0 }, evidence: 'KQM Sim Database（db.kqm.gg）の行動の形: 76 件・平均 48.2k・最大 93.3k。q n×10（探索の比較なし）。凸数: 使われている設定の最小は 0 凸（76 件。分布 0〜6 凸 = 2/70/2/0/2/0/0）' },
    ],
  },
  {
    characterId: '10000084-pyro',
    archetypes: [
      { name: 'Q→重撃→E→重撃→E→Q', role: 'attacker', slot: 40, use: ['q', 'ca', 'e', 'ca', 'e', 'q'], fill: ['ca', 'e', 'ca', 'e'], fillRepeat: [1, 2], evidence: 'Wiki 本文のコンボの記述: 爆発と重撃でプロップ残数を得て、スキルで消費する一連の流れ（探索の比較なし）' },
      { name: 'E・Q のあと 重撃を繰り返す', role: 'attacker', slot: 40, use: ['e', 'q'], fill: ['ca'], fillRepeat: [4, 5, 6], lead: ['n'], evidence: 'Wiki 本文の運用の記述から解釈（探索の比較なし）: 重撃・スキル・爆発を満遍なく使うメインアタッカー' },
      { name: '重撃×4→Q→E→重撃→E', role: 'attacker', slot: 40, use: ['ca', 'ca', 'ca', 'ca', 'q', 'e', 'ca', 'e'], evidence: 'KQM Sim Database（db.kqm.gg。gcsim の公開設定）の行動の形: 分岐つきの設定（85.3k 平均）の、爆発が使えるときの形（探索の比較なし）' },
      { name: '重撃×3→E→Q→E→重撃', role: 'attacker', slot: 40, use: ['ca', 'ca', 'ca', 'e', 'q', 'e', 'ca'], evidence: 'KQM Sim Database（db.kqm.gg。gcsim の公開設定）の行動の形: DPS 上位の設定（106.8k）の形: 重撃 3 回のあと E→Q→E、重撃（探索の比較なし）' },
    ],
  },
  {
    characterId: '10000092-pyro',
    archetypes: [
      { name: 'E・落下・Q のあと E + 落下を繰り返す', role: 'attacker', slot: 40, use: ['e', 'hp', 'q'], fill: ['e', 'hp'], fillRepeat: [2, 3], evidence: 'Wiki 本文の運用の記述から解釈（探索の比較なし）: 特殊落下攻撃を連発する形' },
    
      { name: 'E・落下・Q のあと 通常攻撃を繰り返す', role: 'attacker', slot: 40, use: ['e', 'hp', 'q'], fill: ['n'], fillRepeat: [6, 8, 10], evidence: 'Wiki 本文の運用の記述から解釈（探索の比較なし）: スキルで跳んでの特殊落下攻撃が主力。爆発は補助' },
      { name: 'Q→E→HP（KQM）', role: 'attacker', slot: 40, use: ['q', 'e', 'hp'], evidence: 'KQM Sim Database（db.kqm.gg）の単数回の形: 嘉明 113 件中 9 件。平均 94.5k（最大 110.2k）。凸数: 使われている設定の最小は 6 凸（分布 0〜6 凸 = 0/0/0/0/0/0/9）（探索の比較なし）' },
      { name: 'Q→E→HP→E→HP→DASH（KQM）', role: 'attacker', slot: 40, use: ['q', 'e', 'hp', 'e', 'hp', 'dash'], evidence: 'KQM Sim Database（db.kqm.gg）の単数回の形: 嘉明 113 件中 6 件。平均 87.4k（最大 101.2k）。凸数: 使われている設定の最小は 6 凸（分布 0〜6 凸 = 0/0/0/0/0/0/6）（探索の比較なし）' },
      { name: 'Q→N×2→E→LP→E→LP→E→LP→E→LP→E→LP→E→LP→E→LP（KQM）', role: 'attacker', slot: 40, use: ['q', 'n', 'n', 'e', 'lp', 'e', 'lp', 'e', 'lp', 'e', 'lp', 'e', 'lp', 'e', 'lp', 'e', 'lp'], evidence: 'KQM Sim Database（db.kqm.gg）の単数回の形: 嘉明 113 件中 10 件。平均 73.1k（最大 92.7k）。凸数: 使われている設定の最小は 6 凸（分布 0〜6 凸 = 0/0/0/0/0/0/10）（探索の比較なし）' },
      { name: 'q→n×2→e→hp→n→e→hp→dash', role: 'attacker', slot: 40, use: ['q', 'n', 'n', 'e', 'hp', 'n', 'e', 'hp', 'dash'], evidence: 'KQM Sim Database（db.kqm.gg）の行動の形: 17 件・平均 66.6k・最大 79.3k。q n×2 e hp n e hp dash（探索の比較なし）。凸数: 使われている設定の最小は 6 凸（17 件。分布 0〜6 凸 = 0/0/0/0/0/0/17）' },
      { name: 'q→e→hp→e→hp', role: 'attacker', slot: 40, use: ['q', 'e', 'hp', 'e', 'hp'], evidence: 'KQM Sim Database（db.kqm.gg）の行動の形: 15 件・平均 85.0k・最大 103.6k。q e hp e hp（探索の比較なし）。凸数: 使われている設定の最小は 6 凸（15 件。分布 0〜6 凸 = 0/0/0/0/0/0/15）' },
    ],
  },
  {
    characterId: '10000099-dendro',
    archetypes: [
      { name: 'E・Q（燃焼サブ）', role: 'subAttacker', slot: 20, use: ['e', 'q'], evidence: 'Wiki 本文の運用の記述から解釈（探索の比較なし）: 燃焼サブアタッカー型。スキル・爆発の大火力を押し付ける' },
      { name: 'E→Q のあと 通常1→重撃を繰り返す', role: 'attacker', slot: 40, use: ['e', 'q'], fill: ['n', 'ca'], fillRepeat: [6, 8, 10], evidence: 'Wiki 本文のコンボの記述: 通常 1 段→重撃のループが一番使いやすい（探索の比較なし）' },
      { name: 'E・Q のあと 通常攻撃を繰り返す', role: 'attacker', slot: 40, use: ['e', 'q'], fill: ['n'], fillRepeat: [8, 10, 12], evidence: 'Wiki 本文の運用の記述から解釈（探索の比較なし）: スキル・爆発で自己強化して通常攻撃を振るメインアタッカー型' },
      { name: 'Q（KQM）', role: 'subAttacker', slot: 20, use: ['q'], constellation: { min: 0 }, evidence: 'KQM Sim Database（db.kqm.gg）の単数回の形: エミリエ 238 件中 9 件。平均 108.3k（最大 504.6k）。凸数: 使われている設定の最小は 0 凸（分布 0〜6 凸 = 8/0/0/0/0/0/1）（探索の比較なし）' },
    ],
  },
  {
    characterId: '10000101-dendro',
    archetypes: [
      { name: '通常2→E を繰り返す', role: 'attacker', slot: 40, use: ['e'], fill: ['n', 'n', 'e'], fillRepeat: [6, 8, 10], evidence: 'Wiki 本文のコンボの記述: 通常攻撃 2 回→廻狩貫鱗砲のループ（探索の比較なし）' },
      { name: 'E・Q のあと E + 通常攻撃を繰り返す', role: 'attacker', slot: 40, use: ['e', 'q'], fill: ['e', 'n', 'n', 'n', 'n', 'n'], fillRepeat: [2, 3], evidence: 'Wiki 本文の運用の記述から解釈（探索の比較なし）: 夜魂値がたまり次第スキルを使い直す' },
    
      { name: 'E・Q のあと 通常攻撃を繰り返す', role: 'attacker', slot: 40, use: ['e', 'q'], fill: ['n'], fillRepeat: [10, 14, 18], evidence: 'Wiki 本文の運用の記述から解釈（探索の比較なし）: スキルのあと通常攻撃を連打するのが基本' },
      { name: 'Q（KQM）', role: 'attacker', slot: 40, use: ['q'], constellation: { min: 0 }, evidence: 'KQM Sim Database（db.kqm.gg）の単数回の形: キィニチ 93 件中 4 件。平均 68.3k（最大 73.7k）。凸数: 使われている設定の最小は 0 凸（分布 0〜6 凸 = 4/0/0/0/0/0/0）（探索の比較なし）' },
    ],
  },
  {
    characterId: '10000102-hydro',
    archetypes: [
      { name: 'E・Q のあと 通常攻撃を繰り返す', role: 'attacker', slot: 40, use: ['e', 'q'], fill: ['n'], fillRepeat: [8, 10, 12], evidence: 'Wiki 本文の運用の記述から解釈（探索の比較なし）: 倍率の高いシンプルなアタッカー運用（蒸発向き）' },
      { name: 'E・通常攻撃・E（絵巻 4 セット型）', role: 'supporter', slot: 10, use: ['e', 'n', 'e'], evidence: 'Wiki 本文の運用の記述から解釈（探索の比較なし）: スキル → 通常 1 回 → スキル解除の流れ' },
      { name: 'E→N→E のあと、もう一度 E→N→E', role: 'supporter', slot: 10, use: ['e', 'n', 'e'], then: [{ slot: 30, use: ['e', 'n', 'e'] }], constellation: { min: 0 }, evidence: 'KQM Sim Database（db.kqm.gg）の複数回出場の形: ムアラニ 123 件中 7 件。平均 92.9k（最大 136.0k）。凸数: 使われている設定の最小は 0 凸（分布 0〜6 凸 = 7/0/0/0/0/0/0）（探索の比較なし）' },
    ],
  },
  {
    characterId: '10000106-pyro',
    archetypes: [
      { name: '先置きE のあと Q→重撃連打（メイン）', role: 'attacker', slot: 10, use: ['e'], then: [{ slot: 40, use: ['q'] }], fill: ['ca'], fillRepeat: [3, 4, 5], evidence: 'Phase 3-2精鋭辞書＋KQM新集計: 先置きE→Q重撃メイン形' },
      { name: 'E→Q のあと重撃連打', role: 'attacker', slot: 40, use: ['e', 'q'], fill: ['ca'], fillRepeat: [3, 4, 5], evidence: 'Phase 3-2精鋭辞書＋KQM新集計: EQ連続重撃メイン形' },
      { name: 'Q→E（爆発＋控え炎サブ）', role: 'subAttacker', slot: 20, use: ['q', 'e'], evidence: 'Phase 3-2精鋭辞書＋KQM新集計: 7.6% 最多Q→E控え炎サブ形' },
      { name: 'Q→CA→E→ダッシュ（瞬間火力サブ）', role: 'subAttacker', slot: 20, use: ['q', 'ca', 'e', 'dash'], evidence: 'Phase 3-2精鋭辞書＋KQM新集計: 4.7% 瞬間火力サブ形' },
    ],
  },
  {
    characterId: '10000126-geo',
    archetypes: [
      { name: 'E→通常4→E の繰り返し', role: 'attacker', slot: 40, use: ['e'], fill: ['n', 'n', 'n', 'n', 'e'], fillRepeat: [4], evidence: 'Wiki 本文のコンボの記述: 基本の立ち回り。スキル→（通常 4 段→特殊スキル）×4（探索の比較なし）' },
      { name: 'E・Q のあと 通常攻撃 4 段 + E を繰り返す', role: 'attacker', slot: 40, use: ['e', 'q'], fill: ['n', 'n', 'n', 'n', 'e'], fillRepeat: [4], evidence: 'Wiki 本文の運用の記述から解釈（探索の比較なし）: 基本はスキル → (通常 4 段 → 特殊スキル) × 4。爆発は強化中に使う' },
    ],
  },
  {
    characterId: '10000081-dendro', // カーヴェ（辞書ありで探索結果が悪くなったため、形を外した）
    archetypes: [
      { name: 'E のあと 通常攻撃を繰り返す（アタッカー型）', role: 'attacker', slot: 40, use: ['e'], fill: ['n'], fillRepeat: [4, 6, 8], evidence: 'Wiki 本文の運用の記述から解釈（gcsim 未対応のため、探索の比較なし）: 乗って通常攻撃扱いで戦うアタッカー型' },
      { name: 'E（設置・控えから攻撃）', role: 'supporter', slot: 10, use: ['e'], evidence: 'Wiki 本文の運用の記述から解釈（gcsim 未対応のため、探索の比較なし）: スキルで出す乗り物は、控えでも設置物として戦える' },
      { name: 'Q→E→N×12→E→N×4（KQM）', role: 'attacker', slot: 40, use: ['q', 'e', 'n', 'n', 'n', 'n', 'n', 'n', 'n', 'n', 'n', 'n', 'n', 'n', 'e', 'n', 'n', 'n', 'n'], evidence: 'KQM Sim Database（db.kqm.gg）の単数回の形: カーヴェ 30 件中 3 件。平均 62.8k（最大 63.1k）。凸数: 使われている設定の最小は 6 凸（分布 0〜6 凸 = 0/0/0/0/0/0/3）（探索の比較なし）' },
    ],
  },
  {
    characterId: '10000097-electro', // セトス（辞書ありで探索結果が悪くなったため、形を外した）
    archetypes: [
      { name: 'CA のあと、もう一度 E→CA', role: 'attacker', slot: 40, use: ['ca'], then: [{ slot: 50, use: ['e', 'ca'] }], evidence: 'KQM Sim Database（db.kqm.gg）の複数回出場の形: セトス 58 件中 6 件。平均 57.2k（最大 62.4k）。凸数: 使われている設定の最小は 6 凸（分布 0〜6 凸 = 0/0/0/0/0/0/6）（探索の比較なし）' },
    ],
  },
  {
    characterId: '10000098-electro', // クロリンデ
    archetypes: [
      { name: 'Q→E→（通常3→E）×5', role: 'attacker', slot: 40, use: ['q', 'e'], fill: ['n', 'n', 'n', 'e'], fillRepeat: [5, 6], evidence: 'Wiki 本文のコンボの記述: 夜巡り中は通常 3 回で命の契約 100% 以上→スキル（穿夜・契約全消費）のループが基本（5〜6 セット）' },
      { name: 'E→（通常3→E）×5→Q', role: 'attacker', slot: 40, use: ['e'], fill: ['n', 'n', 'n', 'e'], fillRepeat: [5, 6], evidence: 'Wiki 本文のコンボの記述: スキルで夜巡りに入り（通常 3 回→スキル）×5〜6' },
      { name: 'Q（KQM）', role: 'attacker', slot: 40, use: ['q'], constellation: { min: 0 }, evidence: 'KQM Sim Database（db.kqm.gg）の単数回の形: クロリンデ 186 件中 48 件。平均 80.1k（最大 325.2k）。凸数: 使われている設定の最小は 0 凸（分布 0〜6 凸 = 47/0/0/0/0/0/1）（探索の比較なし）' },
      { name: 'Q のあと、もう一度 Q', role: 'attacker', slot: 40, use: ['q'], then: [{ slot: 50, use: ['q'] }], constellation: { min: 0 }, evidence: 'KQM Sim Database（db.kqm.gg）の複数回出場の形: クロリンデ 186 件中 11 件。平均 171.9k（最大 502.3k）。凸数: 使われている設定の最小は 0 凸（分布 0〜6 凸 = 8/0/0/0/0/0/3）（探索の比較なし）' },],
  },
  {
    characterId: '10000100-geo', // カチーナ
    archetypes: [
      { name: 'E→Q（搭乗せず）', role: 'supporter', slot: 10, use: ['e', 'q'], evidence: 'Wiki 本文のコンボの記述: 搭乗中の攻撃をせず、スキル→爆発とつなぎ続ける（探索の比較なし）' },
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
      { name: '通常1→重撃のループ', role: 'attacker', slot: 40, use: ['e'], fill: ['n', 'ca'], fillRepeat: [6, 8, 10], evidence: 'Wiki 本文のコンボの記述: 通常 1→重撃を素早くループさせるのが重要なテクニック（探索の比較なし）' },
      { name: 'E→重撃2→特殊E→重撃5→Q→重撃5', role: 'attacker', slot: 40, use: ['e', 'ca', 'ca', 'e', 'ca', 'ca', 'ca', 'ca', 'ca', 'q', 'ca', 'ca', 'ca', 'ca', 'ca'], evidence: 'Wiki 本文のコンボの記述: スキル→重撃 2 回→特殊スキルか爆発→重撃 5 回→特殊スキルか爆発→重撃 5〜6 回（探索の比較なし）' },
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
