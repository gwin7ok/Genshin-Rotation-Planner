/**
 * ローテーションの計算結果のスナップショット（2026-10-08。特殊スキル・特殊爆発の受付をモードの定義に統一する作業の P0。ユーザー決定: リポジトリに残す）
 *
 * 決めた並び（オデット・ファルカ・フリンズ・ヴァレサの受付と CT、モードを持つキャラ）を、アプリの計算（calculateRotation）と
 * gcsim の設定文（buildGcsimConfig）で処理し、結果を scripts/snapshots/rotation.json と比べる。作り直しで動きが変わっていないことを確かめる。
 *
 *   npm run check:snapshots            … 保存した結果と比べる（差があれば、並びごとに差を出して終了コード 1）
 *   npm run check:snapshots -- --update … 今の結果で保存し直す（動きを意図して変えたときだけ）
 *
 * gcsim のサーバーは使わない（アプリの計算と、設定文の文字列だけ）。マスターは src/data/characters_master_data.json を使う。
 */
import fs from 'node:fs';
import path from 'node:path';
import { createServer } from 'vite';

const SNAPSHOT_FILE = path.join('scripts', 'snapshots', 'rotation.json');
const update = process.argv.includes('--update');

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error', optimizeDeps: { noDiscovery: true, include: [] } });
const { calculateRotation } = await server.ssrLoadModule('/src/utils/rotationCalculator.ts');
const { buildGcsimConfig } = await server.ssrLoadModule('/src/utils/gcsim/buildGcsimConfig.ts');

const raw = JSON.parse(fs.readFileSync('src/data/characters_master_data.json', 'utf8'));
const all: any[] = Array.isArray(raw) ? raw : raw.characters ?? Object.values(raw);
const byName = (name: string, extra: Record<string, unknown> = {}) => {
  const c = all.find(x => x.name === name);
  if (!c) throw new Error(`キャラが見つかりません: ${name}`);
  return { ...structuredClone(c), ...extra };
};

/** 並びの書き方: アクション定義 ID の末尾（`e` / `q` / `n` / `ca` / `hp` / `e_recast` ...）、`w<秒>` = 待機。`<末尾>@<秒>` = 所要時間を編集（durationManual）、`<末尾>#<秒>` = gcsim から書き戻した所要時間（gcsimBaseDuration も付く） */
type Step = string;
interface Scenario { name: string; chars: [string, Record<string, unknown>?][]; stints: [number, Step[], Record<string, unknown>?][]; defHalt?: boolean; loopStartIndex?: number }

let seq = 0;
const makeAction = (char: any, step: Step) => {
  const id = `a${++seq}`;
  if (/^w[\d.]+$/.test(step)) return { id, actionTypeId: 'wait', name: '待機', shortName: 'w', type: 'wait', duration: Number(step.slice(1)) };
  const m = step.match(/^([\w]+)(?:([@#])([\d.]+))?$/);
  if (!m) throw new Error(`並びの書き方が違います: ${step}`);
  const def = char.availableActions.find((a: any) => a.id === `${char.id}_${m[1]}`);
  if (!def) throw new Error(`${char.name} にアクションがありません: ${m[1]}`);
  const base = { id, actionTypeId: def.id, name: def.name, shortName: def.shortName, type: def.type, duration: def.defaultDuration };
  if (m[2] === '@') return { ...base, duration: Number(m[3]), durationManual: true };
  if (m[2] === '#') return { ...base, duration: Number(m[3]), durationManual: true, gcsimBaseDuration: Number(m[3]) };
  return base;
};

// 祭礼の武器（確率 100%・武器の内部 CT だけ考慮。2026-10-09）を持たせるための、武器の一覧（実際のマスター。武器効果の定義を使って、自動のバーを出す）。weaponId が無いキャラには影響しない
const MASTER_WEAPONS: any[] = JSON.parse(fs.readFileSync('src/data/weapons_master_data.json', 'utf8'));
const SAC_IDS: Record<string, string> = { sword: '11403', claymore: '12403', bow: '15403', catalyst: '14403' };
const WEAPON_DB = Object.values(SAC_IDS).map(id => MASTER_WEAPONS.find(w => w.id === id)).filter(Boolean);
const SAC = (type: string) => ({ weaponId: SAC_IDS[type], weaponRefinementRank: 5 });

const S = (name: string, chars: Scenario['chars'], stints: Scenario['stints'], opts: Partial<Scenario> = {}): Scenario => ({ name, chars, stints, ...opts });
const B: [string] = ['ベネット'];
const SCENARIOS: Scenario[] = [
  // --- オデット（受付: E 394f・Q 361f。spE 1 回で閉じる。通常攻撃のヒットストップで延びる） ---
  S('オデット E → spE', [['オデット'], B], [[0, ['e', 'e_recast']], [1, ['e']]]),
  S('オデット E → N N N → spE', [['オデット'], B], [[0, ['e', 'n', 'n', 'n', 'e_recast']], [1, ['e']]]),
  S('オデット E → 7 秒 → spE（受付の外）', [['オデット'], B], [[0, ['e', 'w7', 'e_recast']], [1, ['e']]]),
  S('オデット Q → spE（爆発の受付）', [['オデット'], B], [[0, ['q', 'e_recast']], [1, ['e']]]),
  S('オデット E → spE → spE（閉じた後）', [['オデット'], B], [[0, ['e', 'e_recast', 'e_recast']], [1, ['e']]]),
  S('オデット E → N×5（gcsim の所要時間）→ 5.5 秒 → spE（ヒットストップの延長）', [['オデット'], B], [[0, ['e', 'n#0.4', 'n#0.4', 'n#0.4', 'n#0.4', 'n#0.4', 'w4.4', 'e_recast']], [1, ['e']]]),
  S('オデット spE だけ（受付なし）', [['オデット'], B], [[0, ['e_recast']], [1, ['e']]]),
  S('オデット E → 交代 → オデット spE', [['オデット'], B], [[0, ['e']], [1, ['e']], [0, ['e_recast']]]),
  // --- ファルカ（受付: E の 39f 後から 12 秒。2 回分の CT。N で短縮。爆発で +2.3 秒。特殊重撃） ---
  S('ファルカ E → spE → spE', [['ファルカ'], B], [[0, ['e', 'e_specialskill', 'e_specialskill']], [1, ['e']]]),
  S('ファルカ E → N×5 → spE → N×5 → spE → spE', [['ファルカ'], B], [[0, ['e', 'n', 'n', 'n', 'n', 'n', 'e_specialskill', 'n', 'n', 'n', 'n', 'n', 'e_specialskill', 'e_specialskill']], [1, ['e']]]),
  S('ファルカ E → Q → N×5 → spE ×3', [['ファルカ'], B], [[0, ['e', 'q', 'n', 'n', 'n', 'n', 'n', 'e_specialskill', 'e_specialskill', 'e_specialskill']], [1, ['e']]]),
  S('ファルカ E → 13 秒 → spE（受付の外）', [['ファルカ'], B], [[0, ['e', 'w13', 'e_specialskill']], [1, ['e']]]),
  S('ファルカ E → N → CA → CA → spE（特殊重撃）', [['ファルカ'], B], [[0, ['e', 'n', 'ca', 'n', 'ca', 'e_specialskill']], [1, ['e']]]),
  S('ファルカ E → N×5（gcsim の所要時間）→ 11 秒 → spE（ヒットストップの延長）', [['ファルカ'], B], [[0, ['e#0.9', 'n#0.5', 'n#0.5', 'n#0.5', 'n#0.5', 'n#0.5', 'w9.5', 'e_specialskill']], [1, ['e']]]),
  S('ファルカ 同上（防御ヒットストップ無効）', [['ファルカ'], B], [[0, ['e#0.9', 'n#0.5', 'n#0.5', 'n#0.5', 'n#0.5', 'n#0.5', 'w9.5', 'e_specialskill']], [1, ['e']]], { defHalt: false }),
  S('ファルカ ヘクセレイ 2 人（フィッシュル）E → N×5 → spE → spE', [['ファルカ'], ['フィッシュル']], [[0, ['e', 'n', 'n', 'n', 'n', 'n', 'e_specialskill', 'e_specialskill']], [1, ['e']]]),
  S('ファルカ spE だけ（受付なし）', [['ファルカ'], B], [[0, ['e_specialskill']], [1, ['e']]]),
  S('ファルカ E → 交代 → ファルカ spE（交代で受付が消える）', [['ファルカ'], B], [[0, ['e']], [1, ['e']], [0, ['e_specialskill']]]),
  S('ファルカ E → E（状態の間の E）', [['ファルカ'], B], [[0, ['e', 'e', 'e']], [1, ['e']]]),
  // --- フリンズ（受付 ①: E の 10.3 秒・嵐槍は何度でも。受付 ②: 嵐槍の後 6 秒・spQ 1 回） ---
  S('フリンズ E → 嵐槍 → spQ', [['フリンズ'], B], [[0, ['e', 'e_spearstorm', 'q_special']], [1, ['e']]]),
  S('フリンズ E → spQ（嵐槍なし）', [['フリンズ'], B], [[0, ['e', 'q_special']], [1, ['e']]]),
  S('フリンズ E → 嵐槍 → 4.5 秒 → 嵐槍（凸 0）', [['フリンズ'], B], [[0, ['e', 'e_spearstorm', 'w4.5', 'e_spearstorm']], [1, ['e']]]),
  S('フリンズ E → 嵐槍 → 4.5 秒 → 嵐槍（凸 1）', [['フリンズ', { constellation: 1 }], B], [[0, ['e', 'e_spearstorm', 'w4.5', 'e_spearstorm']], [1, ['e']]]),
  S('フリンズ E → 10.5 秒 → 嵐槍（受付の外）', [['フリンズ'], B], [[0, ['e', 'w10.5', 'e_spearstorm']], [1, ['e']]]),
  S('フリンズ E → 嵐槍 → spQ → spQ', [['フリンズ'], B], [[0, ['e', 'e_spearstorm', 'q_special', 'q_special']], [1, ['e']]]),
  S('フリンズ E → 嵐槍 → 7 秒 → spQ（受付 ② の外）', [['フリンズ'], B], [[0, ['e', 'e_spearstorm', 'w7', 'q_special']], [1, ['e']]]),
  S('フリンズ 嵐槍だけ（受付なし）', [['フリンズ'], B], [[0, ['e_spearstorm']], [1, ['e']]]),
  // --- ヴァレサ（受付: 落下攻撃〔凸 2 以上 / 猛烈パッション中〕で 140f。スキル・spQ で閉じる。受付の中の CT 1 秒） ---
  S('ヴァレサ 凸 0 E → CA → HP → CA → HP → spQ', [['ヴァレサ', { constellation: 0 }], B], [[0, ['e', 'ca', 'hp', 'ca', 'hp', 'q_special']], [1, ['e']]]),
  S('ヴァレサ 凸 0 基本コンボ ×2', [['ヴァレサ', { constellation: 0 }], B], [[0, ['e', 'ca', 'hp', 'e', 'ca', 'hp', 'q_special', 'e', 'ca', 'hp', 'e', 'ca', 'hp', 'q_special']], [1, ['e']]]),
  S('ヴァレサ 凸 0 Q → E → CA → HP → spQ（爆発の CT 中）', [['ヴァレサ', { constellation: 0 }], B], [[0, ['q', 'e', 'ca', 'hp', 'q_special']], [1, ['e']]]),
  S('ヴァレサ 凸 2 E → CA → HP → spQ', [['ヴァレサ', { constellation: 2 }], B], [[0, ['e', 'ca', 'hp', 'q_special']], [1, ['e']]]),
  S('ヴァレサ 凸 2 E → CA → HP → E → spQ（スキルで閉じる）', [['ヴァレサ', { constellation: 2 }], B], [[0, ['e', 'ca', 'hp', 'e', 'q_special']], [1, ['e']]]),
  S('ヴァレサ 凸 2 E → CA → HP → 3 秒 → spQ（受付の外）', [['ヴァレサ', { constellation: 2 }], B], [[0, ['e', 'ca', 'hp', 'w3', 'q_special']], [1, ['e']]]),
  S('ヴァレサ spQ だけ', [['ヴァレサ', { constellation: 0 }], B], [[0, ['q_special']], [1, ['e']]]),
  // --- モードを持つキャラ（今日の実装。統一の作業で変わらないことの確認） ---
  S('夢見月瑞希 E → 交代 / E → E', [['夢見月瑞希'], B], [[0, ['e']], [1, ['e']], [0, ['e', 'w2', 'e']]]),
  S('ディシア E → Q → N N → E → ジャンプ → E', [['ディシア'], B], [[0, ['e', 'q', 'n', 'n', 'e', 'jump', 'e']], [1, ['e']]]),
  S('タルタリヤ E → N N → E / 維持オン', [['タルタリヤ', { constellation: 0 }], B], [[0, ['e', 'n', 'n', 'e']], [1, ['e']], [0, ['e'], { holdMode: true }]]),
  S('胡桃 E → 交代 / 維持オフ', [['胡桃'], B], [[0, ['e']], [1, ['e']], [0, ['e'], { holdMode: false }]]),
  S('藍硯 hE（2 秒）→ E', [['藍硯'], B], [[0, ['e_hold@2', 'e']], [1, ['e']]]),
  S('ディルック E E E → E', [['ディルック'], B], [[0, ['e', 'e', 'e', 'e']], [1, ['e']]]),
  // --- モードの間に置けない操作（段階 ④） ---
  S('夢見月瑞希 E → N（待つ）/ E → E → N（解除の後は置ける）', [['夢見月瑞希'], B], [[0, ['e', 'n']], [1, ['e']], [0, ['e', 'e', 'n']]]),
  S('閑雲 E → N（待つ）/ E → 低空落下 → N', [['閑雲'], B], [[0, ['e', 'n']], [1, ['e']], [0, ['e', 'lp', 'n']]]),
  S('スカーク E → E（エラー）', [['スカーク'], B], [[0, ['e', 'e']], [1, ['e']]]),
  // --- 凸で使用可能回数が増えるスキル（2026-10-09。gcsim で、CT の並びが一致することを確認） ---
  S('アンバー 凸 4 E E E（回数 2・CT 12 秒）', [['アンバー', { constellation: 4 }], B], [[0, ['e', 'e', 'e']], [1, ['e']]]),
  S('アンバー 凸 3 E E（回数 1・CT 15 秒）', [['アンバー', { constellation: 3 }], B], [[0, ['e', 'e']], [1, ['e']]]),
  S('申鶴 凸 1 tE hE tE（一回押し 10 秒・長押し 15 秒が同じ枠）', [['申鶴', { constellation: 1 }], B], [[0, ['e', 'e_hold', 'e']], [1, ['e']]]),
  S('藍硯 凸 6 tE hE tE（一回押し・長押しが同じ枠）', [['藍硯', { constellation: 6 }], B], [[0, ['e', 'e_hold', 'e']], [1, ['e']]]),
  S('藍硯 凸 5 hE → E（回数 1）', [['藍硯', { constellation: 5 }], B], [[0, ['e_hold@2', 'e']], [1, ['e']]]),
  S('リネット 凸 4 tE tE tE', [['リネット', { constellation: 4 }], B], [[0, ['e', 'e', 'e']], [1, ['e']]]),
  S('白朮 凸 1 E E E', [['白朮', { constellation: 1 }], B], [[0, ['e', 'e', 'e']], [1, ['e']]]),
  S('甘雨 凸 2 E E E', [['甘雨', { constellation: 2 }], B], [[0, ['e', 'e', 'e']], [1, ['e']]]),
  S('スクロース 凸 1 E E E', [['スクロース', { constellation: 1 }], B], [[0, ['e', 'e', 'e']], [1, ['e']]]),
  S('夜蘭 凸 1 E E E', [['夜蘭', { constellation: 1 }], B], [[0, ['e', 'e', 'e']], [1, ['e']]]),
  // --- 閑雲（雲の変化が時間切れで終わると、スキルの CT が 3 秒短くなる。落下攻撃で終えると短縮なし） ---
  S('閑雲 E → 5 秒 → E（時間切れで 3 秒短縮）', [['閑雲'], B], [[0, ['e', 'w5', 'e']], [1, ['e']]]),
  S('閑雲 E → 落下攻撃 → 13 秒 → E（短縮なし）', [['閑雲'], B], [[0, ['e', 'lp', 'w13', 'e']], [1, ['e']]]),
  S('閑雲 E E E → 5 秒 → E（3 回目の跳躍の後の時間切れ）', [['閑雲'], B], [[0, ['e', 'e', 'e', 'w5', 'e']], [1, ['e']]]),
  S('閑雲 E → 交代 → 閑雲 E（交代しても、本来の終わりで短縮）', [['閑雲'], B], [[0, ['e']], [1, ['e', 'w3']], [0, ['e']]]),
  S('閑雲 凸 1 E → 5 秒 → E → E', [['閑雲', { constellation: 1 }], B], [[0, ['e', 'w5', 'e', 'w5', 'e']], [1, ['e']]]),
  // --- 祭礼の武器（2026-10-09。確率 100%・武器の内部 CT 16 秒。スキルのダメージが当たった時点で、使用者が場にいて、スキルが CT 中で、内部 CT が明けていれば、スキルの CT を捨てる。命中時刻の表: src/data/skill_hit_frames.json） ---
  S('祭礼 甘雨（弓）E → 1 秒 → E（1 回目で CT がリセットされ、2 回目が使える）', [['甘雨', SAC('bow')], B], [[0, ['e', 'w1', 'e']], [1, ['e', 'w80']]]),
  S('祭礼 甘雨 E → 1 秒 → E → 1 秒 → E（3 回目は内部 CT 中で、CT 違反）', [['甘雨', SAC('bow')], B], [[0, ['e', 'w1', 'e', 'w1', 'e']], [1, ['e', 'w80']]]),
  S('祭礼 甘雨 E → 20 秒 → E → 1 秒 → E（内部 CT が明けた後は、また使える）', [['甘雨', SAC('bow')], B], [[0, ['e', 'w20', 'e', 'w1', 'e']], [1, ['e', 'w80']]]),
  S('祭礼 夢見月瑞希 E → 1 秒 → E（雲の継続ダメージの命中でも発動する）', [['夢見月瑞希', SAC('catalyst')], B], [[0, ['e', 'w1', 'e']], [1, ['e', 'w80']]]),
  S('祭礼 クレー（回数 2）E → E → E', [['クレー', SAC('catalyst')], B], [[0, ['e', 'e', 'e']], [1, ['e', 'w80']]]),
  S('祭礼 八重神子（回数 3）E E E → E', [['八重神子', SAC('catalyst')], B], [[0, ['e', 'e', 'e', 'e']], [1, ['e', 'w80']]]),
  S('祭礼 宵宮（スキルのダメージが無い）E → 1 秒 → E（発動しない）', [['宵宮', SAC('bow')], B], [[0, ['e', 'w1', 'e']], [1, ['e', 'w80']]]),
  S('祭礼 久岐忍 E → 1 秒 → E → 14 秒 → E（継続ダメージが内部 CT の明けた後にも当たる）', [['久岐忍', SAC('sword')], B], [[0, ['e', 'w1', 'e', 'w14', 'e']], [1, ['e', 'w80']]]),
  S('祭礼 フィッシュル E → 13 秒 → E → 27 秒 → E（オズが消えた後の E。命中の表のオズの攻撃で、内部 CT が明けた後に発動する）', [['フィッシュル', SAC('bow')], B], [[0, ['e', 'w13', 'e', 'w27', 'e']], [1, ['e', 'w80']]]),
  S('祭礼なし 甘雨 E → 1 秒 → E（対照。2 回目は CT 違反）', [['甘雨'], B], [[0, ['e', 'w1', 'e']], [1, ['e', 'w80']]]),
  // --- 八重神子の殺生桜（D81。寿命は効果継続時間 14 秒、諭示で +10 秒。桜は E の 34f 後に現れる。4 つ目で最古を押し出す。爆発で、場の桜 1 つにつき E の CT を 1 回分戻す。諭示なしは、爆発で全部壊れる） ---
  S('八重神子 E E E → 5 秒 → E（押し出し。諭示あり）', [['八重神子'], B], [[0, ['e', 'e', 'e', 'w5', 'e']], [1, ['e', 'w30']]]),
  S('八重神子 E E Q（諭示あり。桜は残り、CT が戻る）', [['八重神子'], B], [[0, ['e', 'e', 'q']], [1, ['e', 'w30']]]),
  S('八重神子 E E Q（諭示なし。桜が全部壊れる）', [['八重神子', { revelation: false }], B], [[0, ['e', 'e', 'q']], [1, ['e', 'w30']]]),
  // 殺生桜の行（桜ごとに別の行。3 つ未満は一番上の空き行・3 つなら最古の行を置き換える）と、2 周目の折り返し（持ち越しの桜が、置き換えた桜の行を引き継ぐ）
  S('八重神子 E E E → 短い待機（桜が 2 周目へ持ち越し。諭示あり）', [['八重神子'], B], [[0, ['e', 'e', 'e', 'w3']], [1, ['e']]]),
  S('八重神子 E E → E E E（ループで持ち越しの桜を置き換える）', [['八重神子'], B], [[0, ['e', 'e', 'w1', 'e', 'e', 'e']], [1, ['e']]], { loopStartIndex: 0 }),
  S('八重神子 E（諭示なし。14 秒）', [['八重神子', { revelation: false }], B], [[0, ['e']], [1, ['e', 'w30']]]),
  S('八重神子 E（諭示あり。24 秒）', [['八重神子'], B], [[0, ['e']], [1, ['e', 'w30']]]),
  // --- 七七の諭示（スキルの CT が 15 秒。未達成は 30 秒。gcsim: skill.go の revelationSkillCDReduction） ---
  S('七七 E → 20 秒 → E（諭示あり。CT 15 秒で、2 回目が使える）', [['七七'], B], [[0, ['e', 'w20', 'e']], [1, ['e', 'w40']]]),
  S('七七 E → 20 秒 → E（諭示なし。CT 30 秒で、2 回目は CT 違反）', [['七七', { revelation: false }], B], [[0, ['e', 'w20', 'e']], [1, ['e', 'w40']]]),
  // --- 兹白（issue #36。アプリ側だけの対応。月相転移・月相の輝き 70 消費・4 回で終わる・爆発で +1.7 秒・C1 は 5 回と +100） ---
  S('兹白 E → N×4 → E（月相の輝きが足りない）', [['兹白'], B], [[0, ['e', 'n', 'n', 'n', 'n', 'e']], [1, ['e']]]),
  S('兹白 E → 待機 7 秒 → E（70 に届く）', [['兹白'], B], [[0, ['e', 'w7', 'e']], [1, ['e']]]),
  S('兹白 E → 待機 7 秒 → E → E（2 回目は足りない）', [['兹白'], B], [[0, ['e', 'w7', 'e', 'e']], [1, ['e']]]),
  S('兹白 E → (N×8 → E)×2 → Q → (N×8 → E)×2 → E（4 回で終わり、次の E は新しい月相転移）', [['兹白'], B], [[0, ['e', ...Array(8).fill('n'), 'e', ...Array(8).fill('n'), 'e', 'q', ...Array(8).fill('n'), 'e', ...Array(8).fill('n'), 'e', 'e']], [1, ['e']]]),
  S('兹白 E → Q → 待機 14 秒（爆発で 1.7 秒延びる）', [['兹白'], B], [[0, ['e', 'q', 'w14', 'n']], [1, ['e']]]),
  S('兹白 凸 1 E → E → (N×6 → E)×4 → E（初めから 100。5 回で終わる）', [['兹白', { constellation: 1 }], B], [[0, ['e', 'e', ...Array(6).fill('n'), 'e', ...Array(6).fill('n'), 'e', ...Array(6).fill('n'), 'e', ...Array(6).fill('n'), 'e', 'e']], [1, ['e']]]),
  // --- ネフェル（issue #36。アプリ側だけの対応。影の舞・幻の戯 3 回・E 2 回分） ---
  S('ネフェル E → C → C → C → C（幻の戯は 3 回まで）', [['ネフェル'], B], [[0, ['e', 'ca', 'ca', 'ca', 'ca']], [1, ['e']]]),
  S('ネフェル E → E → E（2 回分。3 回目は CT）', [['ネフェル'], B], [[0, ['e', 'e', 'e']], [1, ['e']]]),
  S('ネフェル E → C → E → C（開き直すと 3 回に戻る）', [['ネフェル'], B], [[0, ['e', 'ca', 'e', 'ca', 'ca', 'ca', 'ca']], [1, ['e']]]),
  // --- リンネア（issue #36。アプリ側だけの対応。E の後 0.6 秒の間の E が再発動。3 回目で閉じる） ---
  S('リンネア E → E → E → E（3 回の再発動）', [['リンネア'], B], [[0, ['e', 'e', 'e', 'e', 'e']], [1, ['e']]]),
  S('リンネア E → 待機 1 秒 → E（受付の外。CT 中）', [['リンネア'], B], [[0, ['e', 'w1', 'e']], [1, ['e']]]),
  // --- カチーナ（issue #36。アプリ側だけの対応。E = 独立して存在・長押し = 乗る。続いている間の E は乗り降り） ---
  S('カチーナ E → N N N N（独立。N は普通の通常攻撃）', [['カチーナ'], B], [[0, ['e', 'n', 'n', 'n', 'n']], [1, ['e']]]),
  S('カチーナ hE → N N N N N N（搭乗。N は地面を叩く攻撃）', [['カチーナ'], B], [[0, ['e_hold', 'n', 'n', 'n', 'n', 'n', 'n']], [1, ['e']]]),
  S('カチーナ E → E → E（乗り降り。CT なし）', [['カチーナ'], B], [[0, ['e', 'e', 'e']], [1, ['e']]]),
  // --- 夜魂バーストの間隔（ナタのキャラの人数で 18・12・9 秒。チーム共通。追加作業: カチーナ） ---
  S('ナタ 1 人（カチーナ）: 山のこだま 0 秒 → 10 秒（18 秒に足りない）', [['カチーナ'], B], [[0, ['e'], { passiveTriggers: [{ id: 'p1', passiveEffectId: '10000100-geo_p1', name: '山のこだま', offset: 0 }, { id: 'p2', passiveEffectId: '10000100-geo_p1', name: '山のこだま', offset: 10 }] }], [1, ['e']]]),
  S('ナタ 2 人（カチーナ・キィニチ）: 12 秒空ければ足りる', [['カチーナ'], ['キィニチ']], [[0, ['e'], { passiveTriggers: [{ id: 'p1', passiveEffectId: '10000100-geo_p1', name: '山のこだま', offset: 0 }, { id: 'p3', passiveEffectId: '10000100-geo_p1', name: '山のこだま', offset: 13 }] }], [1, ['e'], { passiveTriggers: [{ id: 'p2', passiveEffectId: '10000101-dendro_p2', name: '焔霊の契約', offset: 0 }] }]]),
  S('ナタ 0 人: 山のこだま（夜魂バーストが起きない）', [['カチーナ', { source: { genshinId: 1 } }], B], [[0, ['e'], { passiveTriggers: [{ id: 'p1', passiveEffectId: '10000100-geo_p1', name: '山のこだま', offset: 0 }] }], [1, ['e']]]),
  // --- カチーナの夜魂値（降りている間 2 秒ごと・乗っている間 1 秒ごと + 通常攻撃 1 回ごとに 10。0 でモードが終わる） ---
  S('カチーナ hE → N×8（乗って攻撃。夜魂値が尽きると普通の通常攻撃）', [['カチーナ'], B], [[0, ['e_hold', ...Array(8).fill('n')]], [1, ['e']]]),
  S('カチーナ hE → N×3 → 待機 4 秒 → N（尽きた後）', [['カチーナ'], B], [[0, ['e_hold', 'n', 'n', 'n', 'w4', 'n']], [1, ['e']]]),
  S('カチーナ hE → E（降りる）→ 待機 → E（乗る）→ N', [['カチーナ'], B], [[0, ['e_hold', 'e', 'w5', 'e', 'n']], [1, ['e']]]),
  S('カチーナ 凸 2: hE → N×3 → Q（夜魂値 +20）→ N×4', [['カチーナ', { constellation: 2 }], B], [[0, ['e_hold', 'n', 'n', 'n', 'q', 'n', 'n', 'n', 'n']], [1, ['e']]]),
  S('カチーナ hE → N → 交代 → ベネット（乗ったまま交代 → 降りて独立）', [['カチーナ'], B], [[0, ['e_hold', 'n']], [1, ['e']]]),
  // --- ローエン（gcsim 未実装。wiki の仕組み: 奇策 13 秒・愉悦 100 で特殊元素スキル・3 回まで・爆発で +1.65 秒） ---
  S('ローエン E → N N N N → E（愉悦 102 で足りる）', [['ローエン'], B], [[0, ['e', 'n', 'n', 'n', 'n', 'e']], [1, ['e']]]),
  S('ローエン E → N N → E（愉悦が足りない）', [['ローエン'], B], [[0, ['e', 'n', 'n', 'e']], [1, ['e']]]),
  S('ローエン E → CA CA → E → CA CA → E（重撃 2 回ごとに特殊元素スキル）', [['ローエン'], B], [[0, ['e', 'ca', 'ca', 'e', 'ca', 'ca', 'e']], [1, ['e']]]),
  // --- ヴェスナ（gcsim 未実装。wiki の仕組み: 風巡りの臨戦 15 秒・剣気 2 枚から・1 枚消費・5 回で終わる） ---
  S('ヴェスナ E → E → E → E（剣気 2 枚から。3 回目は足りない）', [['ヴェスナ'], B], [[0, ['e', 'e', 'e', 'e']], [1, ['e']]]),
  S('ヴェスナ E → E → E → Q → E（爆発で 1 枚）', [['ヴェスナ'], B], [[0, ['e', 'e', 'e', 'q', 'e']], [1, ['e']]]),
  S('ヴェスナ 凸 1 E → E E → N×5 → E → N×5 → E → N×5 → E → E（6 回）', [['ヴェスナ', { constellation: 1 }], B], [[0, ['e', 'e', 'e', 'n', 'n', 'n', 'n', 'n', 'e', 'n', 'n', 'n', 'n', 'n', 'e', 'n', 'n', 'n', 'n', 'n', 'e', 'e']], [1, ['e']]]),
  // --- 時間に効く項目の追加（D160。ユーザー決定: 兹白の輝きの持ち越し・カチーナの E → 重撃・C2 の再開・ローエン C6 の延長と愉悦の回復） ---
  S('兹白 E → 待機 9 秒 → E → 待機 8 秒 → E → E（輝きを次の月相転移へ持ち越す。2 つ目の E は続けて使える）', [['兹白'], B], [[0, ['e', 'w9', 'e', 'w8', 'e', 'e']], [1, ['e']]]),
  S('兹白 凸 4 E → N N → E → N N（モードの間は通常攻撃の段が戻らない）', [['兹白', { constellation: 4 }], B], [[0, ['e', 'n', 'n', 'e', 'n', 'n']], [1, ['e']]]),
  S('兹白 凸 6 E → 待機 6 秒 → E → N×4 → E（獲得 1.5 倍・全消費。直後の 3 秒 + N×4 で 70 に届く）', [['兹白', { constellation: 6 }], B], [[0, ['e', 'w6', 'e', 'n', 'n', 'n', 'n', 'e']], [1, ['e']]]),
  S('ネフェル E → Q → C（幻の戯が使えるとき、爆発から重撃へ 124f）', [['ネフェル'], B], [[0, ['e', 'q', 'ca']], [1, ['e']]]),
  S('ネフェル Q → C（影の舞でないとき、爆発から重撃へ 131f）', [['ネフェル'], B], [[0, ['q', 'ca']], [1, ['e']]]),
  S('カチーナ E → C（重撃へのつなぎは通常攻撃と同じ 56f と推定）', [['カチーナ'], B], [[0, ['e', 'ca']], [1, ['e']]]),
  S('カチーナ 凸 2: E → 待機 13 秒 → Q → N（尽きた後の爆発で、降りている状態で夜魂値 20 から再開）', [['カチーナ', { constellation: 2 }], B], [[0, ['e', 'w13', 'q', 'n']], [1, ['e']]]),
  S('ローエン 凸 6: E → N×4 → E → E → E → E → E（愉悦が回復して続けて使える・奇策 +1.25 秒）', [['ローエン', { constellation: 6 }], B], [[0, ['e', 'n', 'n', 'n', 'n', 'e', 'e', 'e', 'e', 'e']], [1, ['e']]]),
  S('ヴェスナ 凸 1 E → E → E → E（最高ランクの 1 回目は剣気を消費しない）', [['ヴェスナ', { constellation: 1 }], B], [[0, ['e', 'e', 'e', 'e', 'e']], [1, ['e']]]),
  S('ヴォジャニーツァ 凸 2 E → 待機 30 秒（悠久の歌 25 秒）', [['ヴォジャニーツァ', { constellation: 2 }], B], [[0, ['e', 'w30']], [1, ['e']]]),
  // --- 凝光の命ノ星座 2（D162。光幕 30 秒が残っている間の使い直しで CT がすぐリセットされる。6 秒に 1 回。gcsim ningguang/screen.go） ---
  S('凝光 凸 0 E → 12 秒 → E → E → 13 秒 → E（リセットなし）', [['凝光', { constellation: 0 }], B], [[0, ['e', 'w12', 'e', 'e', 'w13', 'e', 'w60']], [1, ['e']]]),
  S('凝光 凸 2 E → 12 秒 → E → E → 13 秒 → E（2 回目と 4 回目の E で CT リセット。3 回目は 6 秒以内で CT 12 秒）', [['凝光', { constellation: 2 }], B], [[0, ['e', 'w12', 'e', 'e', 'w13', 'e', 'w60']], [1, ['e']]]),
  S('凝光 凸 2 E → 35 秒 → E（光幕が消えた後はリセットなし）', [['凝光', { constellation: 2 }], B], [[0, ['e', 'w35', 'e', 'w60']], [1, ['e']]]),
  // --- フィッシュル（A3。D163・D164）: オズがいる間の E は再発動になる（ゲームで確認済み）。CT を使わず、gcsim へは skill[recast=1] で渡す ---
  S('フィッシュル E → E（オズの間。再発動になる。CT 違反なし）', [['フィッシュル'], B], [[0, ['e', 'e', 'w60']], [1, ['e']]]),
  S('フィッシュル Q → E（爆発のオズの間。再発動になる）', [['フィッシュル'], B], [[0, ['q', 'e', 'w60']], [1, ['e']]]),
  S('フィッシュル E → 再発動（明示した再発動）', [['フィッシュル'], B], [[0, ['e', 'e_recast', 'w60']], [1, ['e']]]),
  S('フィッシュル 凸 6 Q → 待機 11 秒 → E（オズ 12 秒。再発動になる）', [['フィッシュル', { constellation: 6 }], B], [[0, ['q', 'w11', 'e', 'w60']], [1, ['e']]]),
  S('フィッシュル Q → 待機 11 秒 → E（オズが消えた後。通常の E）', [['フィッシュル', { constellation: 0 }], B], [[0, ['q', 'w11', 'e', 'w60']], [1, ['e']]]),
  // --- 時間に効く状態の追加（D165。アリョーシャの狩猟の印・狩人の照準 = gcsim PR #3207、ヴェスナの粛清 = 説明文・wiki。いつ有効かのバーだけ） ---
  S('アリョーシャ 凸 0 E → 3 秒 → E（1 回目で印・2 回目で発動して狩人の照準）', [['アリョーシャ', { constellation: 0 }], B], [[0, ['e', 'w3', 'e', 'w1']], [1, ['e', 'w60']]]),
  S('アリョーシャ 凸 0 N×4 → 待機 → N×4（通常攻撃 4 段目で印・2 回目の 4 段目で発動。D166）', [['アリョーシャ', { constellation: 0 }], B], [[0, ['n', 'n', 'n', 'n', 'w1', 'n', 'n', 'n', 'n']], [1, ['e', 'w60']]]),
  S('アリョーシャ 凸 0 E → Q（トゥガリンの攻撃で印が発動。付けはしない）', [['アリョーシャ', { constellation: 0 }], B], [[0, ['e', 'q', 'w16']], [1, ['e', 'w60']]]),
  S('アリョーシャ 凸 2 Q（領域の tick で印 → トゥガリンが発動。爆発 20 秒）', [['アリョーシャ', { constellation: 2 }], B], [[0, ['q', 'w3']], [1, ['e', 'w60']]]),
  S('アリョーシャ 凸 6 E ×4（狩人の照準が 2 層になる）', [['アリョーシャ', { constellation: 6 }], B], [[0, ['e', 'w1', 'e', 'w1', 'e', 'w1', 'e', 'w1']], [1, ['e', 'w60']]]),
  S('ヴェスナ 凸 0 E → E → E → Q（粛清 1・2・3 層。退場でクリア）', [['ヴェスナ', { constellation: 0 }], B], [[0, ['e', 'e', 'e', 'q', 'w2']], [1, ['e', 'w60']]]),
  S('ヴェスナ 凸 2 E → E → Q（入ると最大層から。最大層で攻撃力 +40%）', [['ヴェスナ', { constellation: 2 }], B], [[0, ['e', 'e', 'q', 'w1']], [1, ['e', 'w60']]]),
  // --- 2 周目の折り返し（loopStartIndex が 0 以外）・グループ・4 人の通し（calculateRotation の分割の前に足した検査。2026-10-17） ---
  S('ループ基準 1: フィッシュル・ベネット・甘雨・八重神子の通し', [['フィッシュル'], B, ['甘雨'], ['八重神子']], [[0, ['q', 'e', 'n', 'n']], [1, ['e', 'q']], [2, ['e', 'n', 'n', 'ca']], [3, ['e', 'e', 'q', 'w1']]], { loopStartIndex: 1 }),
  S('ループ基準 2: 同じ通し', [['フィッシュル'], B, ['甘雨'], ['八重神子']], [[0, ['q', 'e', 'n', 'n']], [1, ['e', 'q']], [2, ['e', 'n', 'n', 'ca']], [3, ['e', 'e', 'q', 'w1']]], { loopStartIndex: 2 }),
  S('ループ基準 3: 同じ通し', [['フィッシュル'], B, ['甘雨'], ['八重神子']], [[0, ['q', 'e', 'n', 'n']], [1, ['e', 'q']], [2, ['e', 'n', 'n', 'ca']], [3, ['e', 'e', 'q', 'w1']]], { loopStartIndex: 3 }),
  S('ループ基準 0: 同じ通し（基準なし）', [['フィッシュル'], B, ['甘雨'], ['八重神子']], [[0, ['q', 'e', 'n', 'n']], [1, ['e', 'q']], [2, ['e', 'n', 'n', 'ca']], [3, ['e', 'e', 'q', 'w1']]]),
  S('ループ基準 2: 祭礼の甘雨・CT が 2 周目へ持ち越し', [['甘雨', SAC('bow')], B, ['フィッシュル']], [[0, ['e', 'w1', 'e']], [1, ['e', 'q']], [2, ['e', 'q', 'w2']], [0, ['e', 'n']]], { loopStartIndex: 2 }),
  S('グループ: 甘雨 N N ×3 回（グループの途中を含む出場）', [['甘雨'], B], [[0, ['e', 'n', 'n', 'ca'], { groupSpec: { from: 1, to: 2, repeat: 3 } }], [1, ['e']]]),
  S('グループ: ベネット E Q ×2 回 → 八重神子 E ×3（2 つの出場にグループ）', [B, ['八重神子']], [[0, ['e', 'q'], { groupSpec: { from: 0, to: 1, repeat: 2 } }], [1, ['e', 'e', 'n'], { groupSpec: { from: 0, to: 0, repeat: 3 } }]]),
  S('グループ + ループ基準 1: フィッシュル E ×2 → ベネット N ×2 ×2 回', [['フィッシュル'], B], [[0, ['e', 'n'], { groupSpec: { from: 0, to: 0, repeat: 2 } }], [1, ['n', 'n', 'e'], { groupSpec: { from: 0, to: 1, repeat: 2 } }]], { loopStartIndex: 1 }),
];

const r3 = (v: number | undefined) => (v === undefined ? undefined : Number(v.toFixed(3)));

function runScenario(sc: Scenario) {
  seq = 0;
  const chars = sc.chars.map(([name, extra]) => byName(name, extra));
  const stints = sc.stints.map(([ci, steps, extra], i) => {
    const { groupSpec, ...rest } = (extra ?? {}) as { groupSpec?: { from: number; to: number; repeat: number } };
    const actions: any[] = steps.map(s => makeAction(chars[ci], s));
    if (groupSpec) for (let k = groupSpec.from; k <= groupSpec.to; k++) actions[k] = { ...actions[k], groupId: `g${i}` };
    return { id: `s${i}`, characterId: chars[ci].id, actions, ...(groupSpec ? { groups: [{ id: `g${i}`, repeat: groupSpec.repeat }] } : {}), ...rest };
  });
  const res = calculateRotation(chars, stints, { switchDelay: 0.5, loopStartIndex: sc.loopStartIndex ?? 0, defHalt: sc.defHalt ?? true, database: { weapons: WEAPON_DB } as any });
  const actions = res.calculatedStints.flatMap((s: any) => s.actions);
  const built = buildGcsimConfig({
    characters: chars, stints, loopStartIndex: sc.loopStartIndex ?? 0, switchDelay: 0.5, defHalt: sc.defHalt ?? true, weapons: WEAPON_DB as any, artifacts: [],
    extraWaitByActionId: Object.fromEntries(actions.filter((a: any) => a.type !== 'swap').map((a: any) => {
      const manual = a.durationManual && a.holdSeconds === undefined && a.naturalDuration !== undefined && a.type !== 'wait' ? Math.max(0, a.duration - a.naturalDuration) : 0;
      return [a.id, Number(((manual >= 0.005 ? manual : 0) + (a.modeHoldSeconds ?? 0)).toFixed(3))];
    }).filter(([, v]: [string, number]) => v > 0)),
    modeHoldByActionId: Object.fromEntries(actions.filter((a: any) => a.modeHoldSeconds).map((a: any) => [a.id, a.modeHoldSeconds])),
    commandByActionId: Object.fromEntries(actions.filter((x: any) => x.gcsimCommand).map((x: any) => [x.id, x.gcsimCommand])),
    holdSecondsByActionId: Object.fromEntries(actions.filter((a: any) => a.holdSeconds !== undefined).map((a: any) => [a.id, a.holdSeconds])),
  });
  return {
    stints: res.calculatedStints.map((s: any) => ({
      char: chars.find(c => c.id === s.characterId)?.name, start: r3(s.startTime), end: r3(s.endTime), modeHold: s.modeHold,
      actions: s.actions.filter((a: any) => a.type !== 'swap').map((a: any) => [a.shortName, r3(a.startTime), r3(a.duration), a.inStateWindow ? 'window' : '', a.hasCTCollision ? `CT違反${a.collisionRemainingCT}` : '', a.specialWindowWarning ?? '', a.modeHoldSeconds ? `hold${a.modeHoldSeconds}` : ''].filter(v => v !== '')),
    })),
    bars: res.activeBuffs.filter((b: any) => !b.isCarryOver).map((b: any) => [b.name, r3(b.startTime), r3(b.endTime), (b.noSynergy ? 'noSynergy' : '') + (b.lane !== undefined ? `L${b.lane}` : '')]).sort((a: any, b: any) => a[1] - b[1] || String(a[0]).localeCompare(String(b[0]))),
    cooldowns: [...res.skillCooldowns, ...res.burstCooldowns].filter((c: any) => !c.isCarryOver).map((c: any) => [chars.find(x => x.id === c.characterId)?.name, c.type, r3(c.startTime), r3(c.endTime)]).sort((a: any, b: any) => a[2] - b[2] || String(a[1]).localeCompare(String(b[1]))),
    ...(res.carryOverBuffs.some((x: any) => x.lane !== undefined) ? { carryTotems: res.carryOverBuffs.filter((x: any) => x.lane !== undefined).map((x: any) => [x.lane, r3(x.startTime), r3(x.endTime)]) } : {}),
    ...(res.activeBuffs.some((x: any) => x.lane !== undefined) ? { totemOverlap: res.loopedBuffOverlapSegments.map((x: any) => [r3(x.start), r3(x.end), x.count]) } : {}),
    ...(res.stockSpans.length > 0 ? { stock: res.stockSpans.map((x: any) => [x.characterId.slice(0, 14), x.lap, r3(x.startTime), r3(x.endTime), x.count]) } : {}),
    ...(res.passiveSpans.some((p: any) => p.auto) ? { autoPassives: res.passiveSpans.filter((p: any) => p.auto).map((p: any) => [p.name, r3(p.startTime), r3(p.cooldown), r3(p.cooldownEnd)]) } : {}),
    issues: res.validationIssues.map((v: any) => [v.severity, v.title, v.message]).sort((a: any, b: any) => (a[1] + a[2]).localeCompare(b[1] + b[2])),
    gcsim: built.config.split('\n').filter((l: string) => !/^\S+ (char|add) |^options|^target|^energy|^#/.test(l)).join('\n'),
    gcsimMessages: [...(built.errors ?? []), ...(built.warnings ?? [])].map((w: any) => (typeof w === 'string' ? w : w.message)),
  };
}

const current: Record<string, unknown> = {};
for (const sc of SCENARIOS) current[sc.name] = runScenario(sc);

// 同梱のプリセット 5 編成（実際の編成・武器・聖遺物つき。持ち越し・パッシブ・重なりまで、計算の全体を見る）
const { resolvePartyCharacters } = await server.ssrLoadModule('/src/utils/party.ts');
const ARTIFACTS: any[] = JSON.parse(fs.readFileSync('src/data/artifacts_master_data.json', 'utf8'));
const span = (x: any) => [x.name ?? x.type ?? x.id, r3(x.startTime), r3(x.endTime), r3(x.duration), r3(x.cooldown), r3(x.cooldownEnd), x.hasCTViolation ? 'CT違反' : '', x.isCarryOver ? 'carry' : '', x.gcsimKey ?? '', x.lane ?? ''].filter(v => v !== '');
const presetFiles = fs.readdirSync(path.join('src', 'data', 'presets')).filter(f => f.endsWith('.json')).sort();
for (const f of presetFiles) {
  const p = JSON.parse(fs.readFileSync(path.join('src', 'data', 'presets', f), 'utf8'));
  const characters = resolvePartyCharacters(p.party, all);
  const res = calculateRotation(characters, p.stints, { switchDelay: p.switchDelay ?? 0.5, loopStartIndex: p.loopStartIndex ?? 0, database: { characters: all, weapons: MASTER_WEAPONS, artifacts: ARTIFACTS } as any });
  current[`プリセット ${f}`] = {
    totalDuration: res.totalDuration, loopStartTime: r3(res.loopStartTime), loopPeriod: r3(res.loopPeriod), cdResonanceScale: res.cdResonanceScale,
    stints: res.calculatedStints.map((s: any) => ({
      char: characters.find((c: any) => c.id === s.characterId)?.name, start: r3(s.startTime), end: r3(s.endTime), modeHold: s.modeHold,
      actions: s.actions.map((a: any) => [a.shortName, r3(a.startTime), r3(a.duration), a.hasCTCollision ? `CT違反${a.collisionRemainingCT}` : '', a.inStateWindow ? 'window' : '', a.groupCopy ? `copy${a.groupCopy}` : '', a.specialWindowWarning ?? ''].filter(v => v !== '')),
    })),
    bars: res.activeBuffs.map(span).sort((a: any, b: any) => a[1] - b[1] || String(a[0]).localeCompare(String(b[0]))),
    cooldowns: [...res.skillCooldowns, ...res.burstCooldowns].map(span).sort((a: any, b: any) => a[1] - b[1] || String(a[0]).localeCompare(String(b[0]))),
    passives: res.passiveSpans.map(span),
    carry: { cooldowns: res.carryOverCooldowns.map(span), buffs: res.carryOverBuffs.map(span), passives: res.carryOverPassives.map(span) },
    overlap: res.buffOverlapSegments.map((x: any) => [r3(x.start), r3(x.end), x.count]),
    loopedOverlap: res.loopedBuffOverlapSegments.map((x: any) => [r3(x.start), r3(x.end), x.count]),
    stock: res.stockSpans.map((x: any) => [x.characterId.slice(0, 14), x.lap, r3(x.startTime), r3(x.endTime), x.count]),
    sacrificial: res.sacrificialProcs.map((x: any) => JSON.parse(JSON.stringify(x, (_k, v) => (typeof v === 'number' ? r3(v) : v)))),
    issues: res.validationIssues.map((v: any) => [v.severity, v.title, v.message]),
  };
}
await server.close();

if (update || !fs.existsSync(SNAPSHOT_FILE)) {
  fs.mkdirSync(path.dirname(SNAPSHOT_FILE), { recursive: true });
  fs.writeFileSync(SNAPSHOT_FILE, JSON.stringify(current, null, 1) + '\n');
  console.log(`保存しました: ${SNAPSHOT_FILE}（${SCENARIOS.length} 並び）`);
  process.exit(0);
}

const saved = JSON.parse(fs.readFileSync(SNAPSHOT_FILE, 'utf8'));
let diffCount = 0;
const show = (v: unknown) => JSON.stringify(v);
for (const name of new Set([...Object.keys(saved), ...Object.keys(current)])) {
  const a = saved[name], b = current[name] as any;
  if (show(a) === show(b)) continue;
  diffCount++;
  console.log(`\n✗ ${name}`);
  if (!a || !b) { console.log(a ? '  （並びが無くなった）' : '  （新しい並び。--update で保存）'); continue; }
  for (const key of Object.keys(b)) {
    if (show(a[key]) === show(b[key])) continue;
    const before = Array.isArray(a[key]) ? a[key] : [a[key]];
    const after = Array.isArray(b[key]) ? b[key] : [b[key]];
    const beforeSet = new Set(before.map(show)), afterSet = new Set(after.map(show));
    for (const x of before) if (!afterSet.has(show(x))) console.log(`  - ${key}: ${show(x)}`);
    for (const x of after) if (!beforeSet.has(show(x))) console.log(`  + ${key}: ${show(x)}`);
  }
}
console.log(diffCount === 0 ? `\n✓ 全 ${Object.keys(current).length} 並び（プリセット ${presetFiles.length} 編成を含む）が、保存した結果と同じ` : `\n${diffCount} 並びに差があります（意図した変更なら --update で保存し直す）`);
process.exit(diffCount === 0 ? 0 : 1);
