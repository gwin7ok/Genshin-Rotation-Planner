# gcsim 連携 計画・進捗文書

アプリの時間計算を「自前計算」から「gcsim の実行結果」に移す取り組みの計画書と進捗管理文書をまとめたフォルダ。

## 文書構成

| ファイル | 内容 |
|---|---|
| [plan.md](plan.md) | 全体計画書（背景・調査結果・決定事項・全体構成・フェーズ一覧・リスク） |
| [progress.md](progress.md) | 全体進捗（フェーズごとの状態・決定ログ・更新履歴） |
| [phase-1-gcsim-keys/](phase-1-gcsim-keys/) | フェーズ1: 武器・聖遺物に gcsim キーを持たせる |
| [phase-2-party-config/](phase-2-party-config/) | フェーズ2: IDキーの原則の徹底・プリセット削除・4セット/2+2の選択 |
| [phase-3-action-delay/](phase-3-action-delay/) | フェーズ3: アクション遅延のアクションごとの個別化 |
| [phase-4-config-converter/](phase-4-config-converter/) | フェーズ4: 編成 → gcsim 設定文の変換 |
| [phase-5-key-catalog/](phase-5-key-catalog/) | フェーズ5: gcsim キーの辞書の生成 |
| [phase-6-run-and-apply/](phase-6-run-and-apply/) | フェーズ6: gcsim 実行と結果のガントチャート反映 |

各フェーズのフォルダには `plan.md`（計画）と `progress.md`（進捗）がある。

## 運用ルール

実装作業では、次の手順でこれらの文書を参照・確認・更新する。

1. **作業開始前**: [progress.md](progress.md) で現在のフェーズと状態を確認し、該当フェーズの `plan.md` と `progress.md` を読む。
2. **作業中**:
   - 計画と異なる判断をした場合・新しい事実が分かった場合は、該当フェーズの `plan.md` を更新する（全体に関わる場合は [plan.md](plan.md) の決定事項も更新する）。
   - タスクを終えたら、該当フェーズの `progress.md` のチェックリストと作業ログを更新する。
3. **ユーザーの決定があった場合**: [progress.md](progress.md) の「決定ログ」に日付・内容・理由を追記し、関係する計画書に反映する。
4. **フェーズ完了時**: 該当フェーズの `progress.md` に完了日と確認結果を書き、[progress.md](progress.md) のフェーズ状態を更新する。
5. 文書の記述とコードが食い違っていたら、コードを正として文書を直す（食い違いの理由も作業ログに残す）。

状態の表記は全文書で共通: `未着手` / `進行中` / `確認待ち` / `完了` / `保留`
