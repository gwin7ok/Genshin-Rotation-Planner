# 原神 戦闘仕様技術データベース（`docs/genshin-mechanics/`）

ローテーション自動探索（`src/utils/rotationSearch/`）および知識辞書（`src/masterdata/knowledge/`）の設計・改善・レビュー時に参照する技術仕様集。

1. [`combat-system.md`](./combat-system.md) — 元素量（GU）・ICD・2元素同時拡散・ナヒーダ草下地問題・月/星反応・スナップショット・元素粒子・凸分岐
2. [`weapons-artifacts-rules.md`](./weapons-artifacts-rules.md) — 武器・聖遺物の出場順制約（TTDS・翠緑・絵巻・教官等）および先手 `N`/`CA`/`E×2` を正当化する武器仕様（西風・祭礼・冬極・霧切等）
3. [`character-gimmicks-system.md`](./character-gimmicks-system.md) — 固有リソース（命の契約・夜魂/戦意・源水の雫・草露・負荷値）、Early Priming、通常攻撃追撃互換マトリクス、反応競合、キャンセル＆CT同期理論
4. [`team-archetypes.md`](./team-archetypes.md) — 主要 12 チームアーキタイプ別の王道ローテーション構造・ボトルネックCT・探索上の注意点
5. [`team-synergy-and-stats.md`](./team-synergy-and-stats.md) — 元素共鳴（雷粒子・風CT-5%等）、攻撃速度・CT短縮、チーム人数ギミック（夜魂バースト・月兆・魔導/輝映）、通常/重撃ICD共有独立
6. [`enemy-and-environment-rules.md`](./enemy-and-environment-rules.md) — 幽境の激戦（開始エネルギー0）vs 螺旋、元素消費倍率・ボス凍結の罠、敵耐性・シールド、gcsim 差異
7. [`gcsim-quirks.md`](./gcsim-quirks.md) — gcsim 変換・実行特有の仕様とエラーの罠一覧（タルタリヤ `aim`/`charge`、落下前提、長押し、`truncated` 等）
8. [`auto-search-heuristics-spec.md`](./auto-search-heuristics-spec.md) — ローテーション自動探索エンジンの設計原則＆再発防止ガイド
9. [`character-mechanics.json`](./character-mechanics.json) — 全キャラ別のスナップショット・粒子・追撃・Early Priming・コンボ・凸分岐の構造化DB

> 運用ルール: 新たな編成の自動探索で「ゲーム仕様の誤解や gcsim 仕様差による不自然なローテーション」を発見した場合は、該当ファイルへ仕様と探索ルールを 1 項目追記すること。