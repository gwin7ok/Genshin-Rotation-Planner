# gcsim の効果キーの紐付け: 全体のカバレッジ

作成: 2026-10-10 / gcsim の辞書のコミット 1f9c1f2e / 生成: `npm run coverage:links`（`scripts/coverage-links.ts`）

新キャラ・gcsim の更新のときは、この文書の「未検討」だけを見る。詳しい内訳は、A（スキル・爆発）= `effect-key-coverage.md`、B（固有天賦・命ノ星座・武器・聖遺物・元素共鳴）= `master-effect-coverage.md`。
決定（紐づけない理由・個別の例外）の置き場は、`src/masterdata/keyLinkDecisions.ts`（一覧と、実際の場所の案内）。

## 未検討・保留

- 未検討: **0 件**（なし）
- 保留: 1 件
- アクション定義の紐付けと入力の食い違い（check:action-links）: **エラーあり。上の出力を確認**

## A: スキル・爆発（アクション定義の gcsimEffect・gcsimExtras・gcsimIncluded。中間データ ＋ 手で補う一覧から取り込む）

- gcsim の効果 299 件: linked 197 / decided-not-linked 49 / covered-by-master 20 / covered-by-main 19 / grace-window 10 / covered-by-passive 4
- アプリの対象（アクション定義）331 件: linked 202 / no-bar 76 / not-in-gcsim 18 / covered-by-passive 16 / app-bar 12 / decided-not-linked 6 / deferred 1

## B: 固有天賦・命ノ星座・武器・聖遺物・元素共鳴（定義の gcsimKeys など。辞書から自動で結び付ける）

- gcsim の効果 1120 件: linked 939 / excluded 181
- アプリの対象（定義）810 件: linked 667 / excluded 143
