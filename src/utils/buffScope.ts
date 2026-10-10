import { BUFF_SCOPE_OVERRIDES } from '../masterdata/buffScopeOverrides.ts';

/**
 * 時間指定のない効果が効く範囲（追加作業 23 / issue #29）。
 *   team = 全体（効果が適用される対象が、チーム全員・周囲のキャラ・エリア内のキャラ・状態を持つキャラなど、持ち主以外）。最下行に出す
 *   self = 自分だけ（効果が適用されるのが、持ち主・装備者）。キャラ名の横に出す
 *
 * 判定の考え方: 説明文は「条件（〜した時、）」と「効果が適用される対象」に分かれる。**対象の部分だけ**で、全体向けの語を探す
 * （条件にチーム全員・フィールド上のキャラなどがあっても、効果が持ち主自身に付くものは、自分だけ）。
 *   1. 文を、「。」「・」で分ける
 *   2. 各文を、最後の条件の終わり（〜時、／〜と、／〜間、…）で、条件と効果に分ける。条件の終わりが無ければ、文全体が効果
 *   3. 効果の部分に、全体向けの語（TEAM_EFFECT）があれば、全体
 *   4. 「状態・効果を持つ／受けているキャラクター」「リンクしているキャラクター」は、条件にあっても、効果がダメージ・攻撃速度などのアップなら全体（その状態のキャラが効果を受けるため）。クールタイムの短縮・持ち主への効果の付与は、自分だけ
 *   5. 武器・聖遺物の「キャラクター」は装備者なので、チーム全員・味方全員・エリア内などの明示の語だけ
 * ロジックで決められないものは、上書きの表（masterdata/buffScopeOverrides.ts）。
 */
export type BuffScope = 'team' | 'self';

/** 条件の終わりの印（これより後ろが「効果」） */
const COND_END = /(?:時|とき|場合|間|後|ごとに|毎に|と|なら|たら)[、，]/g;

/** 効果が適用される対象に、全体向けの語があるか（条件の部分は見ない） */
const TEAM_EFFECT = new RegExp([
  'チーム(全員|メンバー|内全)',
  '味方全員',
  '(エリア|領域)(内|に(いる|存在))',
  // 近くにいる・フィールド上にいるキャラクターが対象
  '(付近|周囲|近く)(に|の)?(いる)?(チーム内の?)?(フィールド上の?)?(自身の?)?キャラクター',
  'フィールド上にいる(チーム内の)?(自身の?)?キャラクター',
  '(中|内)にいる(フィールド上の?)?キャラクター',
  '^(フィールド上の?)?キャラクター(が|は|の)',
  '、(フィールド上の?)?キャラクター(が|は|の)',
].join('|'));

/** 状態・効果を持つ（受けている）キャラクターが対象（条件の部分にあっても全体） */
const STATE_HOLDER = new RegExp([
  '(状態|影響|効果|祝福|保護)(に|を|の)?(ある|持つ|受けている|守られた|になっている)(フィールド上の?)?キャラクター',
  '状態の(フィールド上の?)?キャラクター',
  'リンクしているキャラクター',
  'シールドに守られたキャラクター',
].join('|'));

/** 「…を基に・…に応じて」の参照（効果の対象ではないもの）を、効果の部分から取り除く */
const REFERENCE = /(チーム全員|チーム内[^、。]{0,12}|周囲のチーム全員)の[^、。]*?(を基に|を基準に|の合計を基に|の合計)|(フィールド上にいる|チーム内)[^、。]*?(に応じて|を基に|を基準に)/g;

/** 条件の主語が「チーム内の（自身の）キャラクター・フィールド上キャラクター」で、効果の文に主語が無いとき、同じものが対象 */
const COND_SUBJECT_TEAM = /^(?:付近(?:にいる)?の?)?(?:チーム内の?(?:自身の?)?|フィールド上の?)キャラクターが/;
const OWNER_HINT = /自身|旅人|装備|の(攻撃力|HP|防御力|元素)|^[ぁ-んァ-ン一-龥]{2,6}の/;
const BUFF_WORDS = /(会心|ダメージ|%|アップ|増加|耐性|熟知|攻撃)/;

export type BuffScopeCategory = 'talent' | 'constellation' | 'weapon' | 'artifact';

/** 説明文だけからの判定（上書きの表は見ない。確認用の一覧・テストでも使う） */
export function classifyBuffScopeByText(description: string | undefined, category: BuffScopeCategory = 'talent'): BuffScope {
  const equip = category === 'weapon' || category === 'artifact';
  const sentences = (description ?? '').split(/[。\n·・]/).map(s => s.trim()).filter(Boolean);
  for (const s of sentences) {
    let cond = '';
    let effect = s;
    let last = -1;
    let len = 0;
    for (const m of s.matchAll(COND_END)) {
      last = m.index ?? -1;
      len = m[0].length;
    }
    if (last >= 0) {
      cond = s.slice(0, last + len);
      effect = s.slice(last + len);
    }
    effect = effect.replace(REFERENCE, '');
    if (equip) {
      // 武器・聖遺物の「キャラクター」は装備者
      if (/チーム(全員|メンバー|内全)|味方全員|(エリア|領域)(内|に(いる|存在))/.test(effect)) return 'team';
      continue;
    }
    if (TEAM_EFFECT.test(effect)) return 'team';
    // 状態を持つキャラクターが条件にあるときは、効果がダメージ・攻撃速度などのアップ（その状態のキャラが受ける）の場合だけ全体。
    // クールタイムの短縮・持ち主への効果の付与などは、持ち主自身の効果
    if (STATE_HOLDER.test(s) && (!cond || BUFF_WORDS.test(effect))) return 'team';
    if (cond && COND_SUBJECT_TEAM.test(cond) && !OWNER_HINT.test(effect) && BUFF_WORDS.test(effect)) return 'team';
  }
  return 'self';
}

export function classifyBuffScope(def: { id: string; description?: string; category?: BuffScopeCategory }): BuffScope {
  return BUFF_SCOPE_OVERRIDES[def.id] ?? classifyBuffScopeByText(def.description, def.category);
}
