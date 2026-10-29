# 多言語対応（日本語 / 英語） 計画・進捗文書

アプリ全体を、日本語と英語の 2 つのモードで使えるようにする取り組みの計画書と進捗管理文書。

| ファイル | 内容 |
|---|---|
| [plan.md](plan.md) | 計画書（要件・調査結果・決定事項・構成・フェーズ・リスク） |
| [progress.md](progress.md) | 進捗（フェーズの状態・決定ログ・作業ログ） |
| [glossary.md](glossary.md) | 用語集（ゲーム用語の公式英語。英訳はこれに合わせる。D254） |

## 運用ルール

[gcsim 連携の運用ルール](../gcsim-integration/README.md#運用ルール) と同じ。

1. 作業の前に [progress.md](progress.md) で現在のフェーズを確認し、[plan.md](plan.md) の該当フェーズを読む。
2. 計画と異なる判断・新しい事実は [plan.md](plan.md) に反映し、タスクを終えたら [progress.md](progress.md) を更新する。
3. ユーザーの決定は [progress.md](progress.md) の決定ログに書く。決定の番号（D）は、gcsim 連携と通し番号（[gcsim 連携の決定ログ](../gcsim-integration/progress.md#決定ログ) にも 1 行で参照を置く）。
4. 文書とコードが食い違ったら、コードを正として文書を直す。

状態の表記: `未着手` / `進行中` / `確認待ち` / `完了` / `保留`
