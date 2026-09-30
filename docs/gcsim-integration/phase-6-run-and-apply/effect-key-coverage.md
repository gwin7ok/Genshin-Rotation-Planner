# スキル・爆発の効果の対応表（カバレッジ）

作成: 2026-09-30 / gcsim の辞書のコミット 1e6c1a86 / 生成: `npm run check:effectkeys`（`scripts/build-effect-coverage.ts`）

4 つのテーブル: `effects`（gcsim の効果）/ `targets`（アプリ側の対象）/ `links`（効果 ↔ 対象の組。中間表）/ `unlinked`（紐づけない理由）。
「未検討」= 紐づけも「紐づけない」の決定（理由）も無いもの。gcsim の更新・新キャラのとき、検討する範囲。
決定は `src/masterdata/effectKeyDecisions.ts`、紐づけは `actionEffectKeyOverrides.ts` / `actionEffectExtras.ts` に書く。

## effects（gcsim の効果。分類が skill / burst / character / attack と、実行時に見つかった設置物・シールド・継続ダメージ。299 件）

| 状態 | 件数 |
|---|---|
| 紐づけ済み | 196 |
| gcsim は効果を出すが、紐づけず・バーも出さない | 46 |
| 保留 | 28 |
| 本体のバーで表示済み | 19 |
| 猶予時間・短い窓（効果ではない） | 10 |

設置物名（gcsim のソース）: 7 件

## targets（アプリのスキル・爆発のアクション定義。307 件）

| 状態 | 件数 |
|---|---|
| 紐づけ済み | 190 |
| gcsim の効果なし・バーを出さない | 69 |
| gcsim にキャラが未登録 | 18 |
| 保留 | 16 |
| gcsim の効果なし・アプリ側の値でバーを表示 | 10 |
| gcsim は効果を出すが、紐づけず・バーも出さない | 4 |

## links（効果 ↔ 対象。225 件）

内訳: main/auto=159 / main/approved=28 / extra/approved=29 / included/approved=9
整合性: 存在しない効果・対象を指す紐づけ 0 件 / 重複 0 件

## 未検討のアクション定義（0 件）

なし

## 未検討の効果（0 件。持ち主ごと）

