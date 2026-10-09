/**
 * スキル・爆発の効果と gcsim のキーの紐付けを、アクション定義に取り込む（D95。2026-10-09）。
 *
 * 入力（作り方）:
 *   - 中間データ: gcsim を実行して集めた結果（public/data/action_effect_keys.json の entries。`npm run probe:effects` → `npm run link:effects`）
 *   - 手で補う一覧: actionEffectKeyOverrides.ts（本体）・actionEffectExtras.ts（副次効果）・actionEffectIncluded.ts（含まれる効果）
 * 出力: マスターのアクション定義の `gcsimEffect` / `gcsimExtras` / `gcsimIncluded`。
 *
 * gcsim の結果の書き戻し（applyGcsimResult.ts）は、この定義だけを読む（旧: 実行時に JSON を取得）。
 * 固有天賦・武器・聖遺物・命ノ星座の紐付け（buffGcsimLink.ts）と同じく、マスター生成の最後に取り込む純粋関数で、
 * スクリプト（npm run link:actions）とブラウザ内の生成（databaseService.ts）の両方から呼ぶ。
 */
import type { ActionDefinition, ActionGcsimEffect, ActionGcsimExtra, ActionGcsimIncluded, CharacterConfig, EffectDurationMode } from '../types/genshin.ts';

/** 中間データ（action_effect_keys.json の entries の値） */
export interface ActionEffectKeyEntry {
  status: 'ok' | 'nokey' | 'unprobed';
  keys: { key: string }[];
  /** 効果時間の本体のキー（候補が複数のとき、マスターの効果時間に最も近いキー）。あればこれだけを使う */
  primary?: string;
  mode?: EffectDurationMode;
  self?: boolean;
}
export type ActionEffectKeyTable = Record<string, ActionEffectKeyEntry>;

/** 手で補う一覧の値: キーだけ（expiry）か、求め方・自分限定つき。空文字 = 書き戻さない */
export type EffectKeyOverride = string | { key: string; mode?: EffectDurationMode; self?: boolean; /** 状況によって別のキーで出る場合の代替（例: デュリンの爆発は白の姿と黒の姿でキーが違う）。イベントがあったキーのうち、効果が長いものを使う */ alt?: string[] };

export interface ActionLinkInput {
  table: ActionEffectKeyTable;
  overrides: Record<string, EffectKeyOverride>;
  extras: Record<string, ActionGcsimExtra[]>;
  included: Record<string, ActionGcsimIncluded[]>;
}

/**
 * 1 つのアクション定義 ID の本体の紐付けを決める（旧 applyActionEffectDurations の中の選び方と同じ。優先: 手で補う一覧 → 表の primary → 表のキー全部）。
 * 表にも手で補う一覧にも無ければ undefined（＝対応表に載っていない）
 */
export function resolveActionEffect(defId: string, input: Pick<ActionLinkInput, 'table' | 'overrides'>): ActionGcsimEffect | undefined {
  const override = input.overrides[defId];
  if (override === '') return { skip: true, keys: [], status: 'manual' };
  const entry = input.table[defId];
  if (!entry && override === undefined) return undefined;
  const ov = typeof override === 'string' ? (override ? { key: override } : undefined) : override;
  if (ov) {
    return {
      keys: [ov.key, ...(ov.alt ?? [])],
      ...(ov.mode && ov.mode !== 'expiry' ? { mode: ov.mode } : {}),
      ...(ov.self ? { self: true } : {}),
      status: 'manual',
    };
  }
  return {
    keys: entry!.primary ? [entry!.primary] : (entry!.keys ?? []).map(c => c.key),
    ...(entry!.mode && entry!.mode !== 'expiry' ? { mode: entry!.mode } : {}),
    ...(entry!.self ? { self: true } : {}),
    status: entry!.status,
  };
}

export interface ActionLinkReport {
  /** 本体の紐付けを書き込んだアクション定義の数 */
  effects: number;
  extras: number;
  included: number;
  /** 紐付けの入力にあるが、マスターのアクション定義に無い ID（新キャラ・削除など。確認用） */
  unknownDefIds: string[];
}

/** アクション定義の紐付け項目を、いったん消してから書く（マスター生成のたびに作り直す） */
const LINK_FIELDS = ['gcsimEffect', 'gcsimExtras', 'gcsimIncluded'] as const;

/** キャラのアクション定義に、スキル・爆発の紐付けを取り込む（characters を書き換える） */
export function linkActionEffects(characters: CharacterConfig[], input: ActionLinkInput): ActionLinkReport {
  const report: ActionLinkReport = { effects: 0, extras: 0, included: 0, unknownDefIds: [] };
  const seen = new Set<string>();
  for (const char of characters) {
    for (const act of char.availableActions ?? []) {
      for (const f of LINK_FIELDS) delete (act as ActionDefinition)[f];
      seen.add(act.id);
      const effect = resolveActionEffect(act.id, input);
      if (effect) {
        act.gcsimEffect = effect;
        report.effects++;
      }
      const extras = input.extras[act.id];
      if (extras?.length) {
        act.gcsimExtras = extras.map(e => ({ ...e }));
        report.extras++;
      }
      const included = input.included[act.id];
      if (included?.length) {
        act.gcsimIncluded = included.map(e => ({ ...e }));
        report.included++;
      }
    }
  }
  const all = new Set([...Object.keys(input.table), ...Object.keys(input.overrides), ...Object.keys(input.extras), ...Object.keys(input.included)]);
  report.unknownDefIds = [...all].filter(id => !seen.has(id)).sort();
  return report;
}

/** 書き戻しが読む形: アクション定義 ID → 本体の紐付け / 副次効果（キャラの全アクション定義から集める） */
export interface ActionLinkTables {
  effects: Record<string, ActionGcsimEffect>;
  extras: Record<string, ActionGcsimExtra[]>;
}

export function buildActionLinkTables(characters: Pick<CharacterConfig, 'availableActions'>[]): ActionLinkTables {
  const effects: Record<string, ActionGcsimEffect> = {};
  const extras: Record<string, ActionGcsimExtra[]> = {};
  for (const c of characters) {
    for (const a of c.availableActions ?? []) {
      if (a.gcsimEffect) effects[a.id] = a.gcsimEffect;
      if (a.gcsimExtras?.length) extras[a.id] = a.gcsimExtras;
    }
  }
  return { effects, extras };
}
