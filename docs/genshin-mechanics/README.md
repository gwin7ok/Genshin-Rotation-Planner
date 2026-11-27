# 原神 戦闘仕様技術データベース（`docs/genshin-mechanics/`）

ローテーション自動探索（`src/utils/rotationSearch/`）および知識辞書（`src/masterdata/knowledge/`）の設計・改善・レビュー時に参照する技術仕様集。

1. [`combat-system.md`](./combat-system.md) — 元素量（GU）・ICD・2元素同時拡散・ナヒーダ草下地問題・月/星反応・スナップショット・元素粒子・凸分岐
2. [`weapons-artifacts-rules.md`](./weapons-artifacts-rules.md) — 武器・聖遺物の出場順制約（TTDS・翠緑・絵巻・教官等）および先手 `N`/`CA`/`E×2` を正当化する武器仕様（西風・祭礼・冬極・霧切等）
3. [`character-gimmicks-system.md`](./character-gimmicks-system.md) — 固有リソース（命の契約・夜魂/戦意・源水の雫・草露・負荷値）、Early Priming、通常攻撃追撃互換マトリクス、反応競合、キャンセル＆CT同期理論
4. [`team-archetypes.md`](./team-archetypes.md) — 主要 12 チームアーキタイプ別の王道ローテーション構造・ボトルネックCT・探索上の注意点
5. [`character-mechanics.json`](./character-mechanics.json) — キャラ別のスナップショット・粒子・追撃・Early Priming・コンボ・凸分岐の構造化DB（現在主要 40 キャラ、Phase 3-2 で順次拡張）