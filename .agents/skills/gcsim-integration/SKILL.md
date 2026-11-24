---
name: gcsim-integration
description: gcsim 連携（WebAssembly 版・計画書運用・ゲーム挙動との差異・辞書探索・ローカルソース調査・KQM DB・祭礼/ファルカ/energy の仕様）を扱うときに参照する
---

# gcsim 連携・計算・調査スキル

## 1. 計画・進捗管理（作業前に必ず読む）
- 運用ルール: `docs/gcsim-integration/README.md`
- 作業着手前・作業中・完了時に `docs/gcsim-integration/`（全体 `plan.md` / `progress.md`、該当 `phase-*/` の文書）を確認・更新する。
- ユーザーの決定事項は `progress.md` の決定ログに追記し、関連計画書に反映する。文書とコードが食い違えばコードを正として文書を直す。
- 決定事項の代表（正本は計画書側）:
  - 計算前提: ダメージ数値は使わず、`ignore_burst_energy=true`、会心率 100% 仮値、レベル 90/90、ヒットストップ既定。`target` に `hp` を指定しない（duration 無視でログ肥大化するため）。
  - 聖遺物: キャラごとに「4セット / 2+2（バフなし）」を選択。
  - アクション遅延: 一律挿入は撤廃しアクションごとの `delay(frames)` を使用。
  - モード維持（D72–D79）: 状態・受付は `ActionDefinition.mode`（`characterMasterGenerator.ts` の `ACTION_MODES`）に統一。
  - 効果表示（D213）: gcsim が返す効果は基本的に実行前からアプリ表示に一本化し、同等の独自計算は廃止する（除外は理由つき一覧のみ）。

## 2. WASM・スクリプト・ローカルソース
- **実行方式**: ブラウザは Web Worker、検査スクリプト（`probe:*`, `link:effects`, `check:dps` 等）は `scripts/gcsim-node.ts` で `public/gcsim/main.wasm` を動かす。
- **WASM ビルドとライセンス**: gcsim v2.47.3 以降は AGPL-3.0。公式ソースを無改変でビルドする（`NOTICE` 参照）。`gcsim.config.json` 更新時の手順は `docs/gcsim-サーバー更新手順.md`（旧称）、新キャラ取込は `docs/ゲーム新キャラの取り込み手順.md` / `docs/新キャラ実装時の作業.md`。
- **ローカルソースの場所**: `G:\Cursor_Folder\gcsim`（フォーク `gwin7ok/gcsim`）。調査のために再ダウンロード不要。
  - 調査前に `git log --oneline -1` で `gcsim.config.json` のコミットと一致しているか確認する。
  - Windows 環境でファイル単位のループ grep は 120 秒でタイムアウトしやすいため、`grep -rlE` で一括検索・集計する。

## 3. gcsim とゲームの仕様差・既知の制約
- **ゲーム優先の原則**: キャラ挙動（交代で状態が切れるか等）をソースコードの読み取りだけで決めない。必ず **(1) gcsim を実行して結果を表で示し、(2) ゲーム実機の挙動をユーザーに確認してから** データを入れる（差異は計画書に「gcsim との差」として記録）。
- **`energy` 行の制約（D369）**: gcsim v2.50.0 (WASM) は設定文の `energy once/every` 行を種類問わず**最後の 1 行しか使わない**。複数行の `energy` を出力する設計は不可。
- **祭礼系武器の乱数シード（D86・D87）**:
  - アプリ側は発動確率 100%・内部 CT のみ計算し、`src/data/skill_hit_frames.json` に従う。
  - gcsim には `refine=N` を渡し、アプリの発動と一致し余分な発動がない乱数シードを `runWithSacrificialSeed`（`sacrificialSeed.ts`）で探索する。スキル CT は書き戻さない。
  - 検証コマンド: `npm run check:sacrificial-seed`（17 並び）。R5 で一致シードが見つからない既知例外: 凝光（2 凸）・フィッシュル・フリーナ・コロンビーナ。
- **ファルカ（Varka）特殊スキル CT**:
  - `src/utils/cooldownQueue.ts` のキュー方式（gcsim 準拠）が正。風元素共鳴で全 CT ×0.95。
  - 動画観測との約 1.2 秒の受付時間差は未解決（爆発なし動画の検証待ちのため、issue 報告は先送りしアプリ警告は gcsim 基準）。

## 4. 辞書生成・探索・KQM Sim Database
- キー辞書: `src/data/gcsim_key_catalog.json`（`npm run build:catalog` / `npm run coverage:catalog`）。
- **探索比較の測定条件**: 辞書あり・なしの比較は必ず軽い設定（`--runs1=2 --keep1=150 --keep2=6 --runs2=10`）以上で行う。最短設定（`keep2=2`）は勝者の呪いでノイズ（±5〜10%）が出るため禁止。測定編成もそのキャラの主流編成を使う。
- **KQM Sim Database**: `https://db.kqm.gg/api/db?q={"limit":100,"skip":N}`（1 秒間隔で取得、`simpact.app` は 404）。調査スクリプトは `scripts/knowledge-kqm-db.ts`（`.cache/kqm-db/` に保存）。装備前提が異なるため DPS 数値の直接比較はせず、行動の形の集計のみ辞書の evidence に出典つきで使う。