/**
 * スキル・爆発の効果の対応表（カバレッジ）の型と、「紐づけない理由」の種類（フェーズ6 / 6-3b'）
 *
 * 目的: gcsim が出す効果（キー）と、アプリのスキル・爆発のアクション定義を、両方向から見て、
 *   「紐づけた」「紐づけないと決めた（理由つき）」「未検討」を区別する。
 *   gcsim が更新されて新しいキー・新しいキャラが増えたとき、「未検討」だけを見れば、検討する範囲が分かる。
 * 生成: scripts/build-effect-coverage.ts（npm run check:effectkeys）→ src/data/effect_key_coverage.json
 */

/** 紐づけない理由 */
export type UnlinkedReason =
  /** 本体の持続バー（または副次効果）で表示済みで、別のバーにしない */
  | 'covered-by-main'
  /** 再発動・成長などの猶予時間や短い窓で、効果そのものではない */
  | 'grace-window'
  /** 命中・条件で更新され続ける内部の状態で、アクションの効果時間ではない */
  | 'hit-driven'
  /** 保留（ストックできるスキルなど、扱いが決まっていない） */
  | 'deferred'
  /** 上のどれにも当てはまらないが、紐づけないと決めた（メモに理由） */
  | 'decided-not-linked'
  /** gcsim にキャラ自体が未登録（アプリ側の定義が対象。gcsim の更新を待つ） */
  | 'not-in-gcsim'
  /** gcsim にはあるが、アプリのマスターにキャラが無い（マスターの再生成が先） */
  | 'not-in-app'
  /** gcsim が状態・設置物・シールド・継続ダメージのイベントを出さない（実測済み） */
  | 'no-event'
  /** gcsim で単独実行できず、収集できなかった（手で補う） */
  | 'unprobable'
  /** 切れない常時の効果（時間のバーにならない） */
  | 'permanent'
  /** 未検討（検討する範囲） */
  | 'unreviewed';

export const UNLINKED_REASON_LABELS: Record<UnlinkedReason, string> = {
  'covered-by-main': '本体のバーで表示済み',
  'grace-window': '猶予時間・短い窓（効果ではない）',
  'hit-driven': '命中などで更新され続ける内部状態',
  'deferred': '保留',
  'decided-not-linked': '紐づけないと決定済み',
  'not-in-gcsim': 'gcsim にキャラが未登録',
  'not-in-app': 'アプリのマスターにキャラが無い',
  'no-event': 'gcsim が効果のイベントを出さない',
  'unprobable': '単独実行できず未収集',
  'permanent': '常時の効果',
  'unreviewed': '未検討',
};

export type LinkRole = 'main' | 'extra';
/** 紐づけの確度: approved = ユーザーが確認して承認 / auto = 自動（マスターの効果時間との一致・実測）で作った */
export type LinkApproval = 'approved' | 'auto';

/**
 * 対応表は、リレーショナルデータベースの形の 4 つのテーブル（多対多の中間表つき）で持つ。
 *   effects  … gcsim が出す効果（キー）1 つが 1 行
 *   targets  … アプリ側の対象（アクション定義など）1 つが 1 行
 *   links    … 「効果 ↔ 対象」の組 1 つが 1 行（中間表。紐づけ自体の属性を持つ）
 *   unlinked … 紐づけない理由（効果または対象 1 つが 1 行）
 * 紐づけ・理由は 1 か所にだけ持つ（両方向の検索は、読み込み時に索引を作って行う）。
 */

/** gcsim の効果の種類（情報源） */
export type EffectSource = 'status' | 'construct' | 'shield' | 'damage';

export interface EffectRow {
  /** gcsim の効果の ID: 状態のキー / `construct:<名前>` / `shield:<名前>` / `damage:<ダメージ名>` */
  id: string;
  source: EffectSource;
  /** 辞書の分類（skill / burst / character / attack / template ...）。実行時に見つかった設置物・シールド・継続ダメージは 'runtime' */
  category: string;
  /** 持ち主（gcsim のキャラ・武器・聖遺物のキー）。分からなければ無し */
  owner?: string;
  name?: string;
  permanent?: boolean;
}

/** アプリ側の対象の種類（今はアクション定義。発動バフ・命ノ星座は、今後この表に加える） */
export type TargetType = 'action';

export interface TargetRow {
  /** 種類を前置きした ID: `action:<アクション定義 ID>` */
  id: string;
  type: TargetType;
  char: string;
  /** アクションの種類（skill / skill_hold / burst） */
  actionType: string;
}

export interface LinkRow {
  /** effects.id */
  effectId: string;
  /** targets.id */
  targetId: string;
  /** main = 本体の効果時間（effectDuration）/ extra = 副次効果のバー */
  role: LinkRole;
  /** 継続時間の求め方（既定 expiry） */
  mode?: 'expiry' | 'ended' | 'span';
  /** 実行したキャラ自身のイベントだけ使う */
  self?: boolean;
  label?: string;
  approval: LinkApproval;
}

export interface UnlinkedRow {
  /** どちら側の行か */
  side: 'effect' | 'target';
  /** effects.id または targets.id */
  id: string;
  reason: UnlinkedReason;
  note?: string;
}

export interface EffectKeyCoverage {
  gcsimCommit?: string;
  generatedAt: string;
  effects: EffectRow[];
  targets: TargetRow[];
  links: LinkRow[];
  unlinked: UnlinkedRow[];
}
