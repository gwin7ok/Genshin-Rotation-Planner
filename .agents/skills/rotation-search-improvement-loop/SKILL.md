---
name: rotation-search-improvement-loop
description: 「自律改善ループを実行して」と指示されたとき、分離ワークツリー上でローテーション探索の自動検証・原因調査・改善・KQM DB 照合を反復する手順を参照する
---

# ローテーション探索 自律改善ループ手順

ユーザーから「自律改善ループを実行して」と指示された場合、以下の手順で分離ワークツリー上の反復改善を実行する。

## 1. 開始前の確認とワークスペース分離
- **前提確認**: 開始前に `npm run gcsim:check` を実行し、WASM（`public/gcsim/main.wasm`）とバージョン一致を確認する（無い場合は `npm run wasm:build`）。ポート 3000 の開発サーバーは止めない。
- **分離ワークツリーでの実行**: メインリポジトリは直接編集せず、`invoke_subagent`（`TypeName: "self"`, `Workspace: "branch"`）で実行用サブエージェントを起動し、すべての検証・修正をその分離ワークツリー内で行う。

## 2. 1 サイクルの実行手順
サブエージェントに以下を 1 サイクルとして実行させる。

1. **対象編成の選定（4 編成同時）**:
   - ユーザー指定の編成、または `data/knowledge-teams/*.json` や主要反応軸（蒸発・溶解・過負荷・凍結・超開花・豊穣開花・燃焼・モノジオ・ナタ/スネージナヤ編成等）から未検証の **4 編成** を選ぶ。
2. **探索の実行（仮値・ER 300%・24 ワーカー）**:
   - 各編成について、仮値装備（★4=6凸 / ★5=0凸）・初期ローテーションなし・総 ER 300% 以上で 4 編成同時に実行する：
     ```powershell
     $env:GCSIM_NODE_WORKERS = "24"
     node --experimental-strip-types scripts/search-rotation.ts <キャラ1> <キャラ2> <キャラ3> <キャラ4> --er=300 --screen --loops=3 --knowledge --keep1=300 --runs1=2 --keep2=12 --runs2=10 --out=<scratch_dir>/<name>.json
     ```
3. **結果精査・原因調査・改善と検証**:
   - 上位 1〜5 位に不自然なアクション（無意味な `D`/`J`、物理通常 1 回だけの単独出場、モード違反、スキル/爆発欠落、gcsim エラー多発等）がないか確認する。
   - 問題があれば `src/utils/rotationSearch/`・`src/utils/gcsim/`・`src/masterdata/knowledge/characters.ts`（必要に応じて `G:\Cursor_Folder\gcsim` の仕様も参照）を調査して分離ワークツリー内で修正する。
   - 辞書変更時は `npm run build:knowledge`、コード変更時は毎回 `npx tsc --noEmit` と `npm run check:rotation-search`（辞書シード変更時は `npm run check:knowledge-seeds`）を実行し、対象編成を再検証する。
4. **サイクル末尾の KQM DB 実例照合**:
   - 探索終了時の各編成の上位ローテーションが、`.cache/kqm-db/`（KQM Sim Database）に登録されている同編成・同凸数（仮値基準: ★4=6凸 / ★5=0凸）の事例と出場順・コンボ骨格で一致・整合しているか検証する。
   - 乖離がある場合は「仮値 ER 300% による差異（粒子回収省略等）」か「探索ロジック・辞書の不足」かを切り分けて報告する。

## 3. ループ継続と終了処理（「終了」指示時）
- **継続時**: 各サイクルの完了報告を受けたら、ユーザーへ結果（DPS・上位ローテ・改善内容・KQM DB 照合結果）を日本語で簡潔に報告し、ユーザーから「終了」が指示されていなければ直ちに次の 4 編成で次サイクルをサブエージェントへ指示する。
- **終了時（「終了」または「ここで一旦終了」の指示）**:
  1. サブエージェントに進行中のコマンドを直ちに中止させ、分離ワークツリーの `git diff` を scratch パッチとして退避する（パッチ保存前にサブエージェントを `kill` しない）。
  2. 分離ワークツリーで行った改善を論理項目ごとに整理し、`AGENTS.md` の確認作法に従って **1 項目ずつ**（番号つき選択肢・具体例・メリット/デメリット・推奨と理由）メインリポジトリへの採用可否をユーザーへ確認する。
  3. 採用された項目のみメインリポジトリへ適用し、`npm run build:knowledge` / `npx tsc --noEmit` / `npm run check:rotation-search` / `npm run check:knowledge-seeds` / `npm run check:backup` がすべてパスすることを確認する。
  4. 確認完了後、サブエージェントを `kill` してワークツリーを整理する（`git commit` はユーザーの明示指示があるまで行わない）。
