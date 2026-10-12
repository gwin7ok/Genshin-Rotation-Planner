# 提供方法の検討と、gcsim WASM（1-A）の検証結果（2026-10-12）

## 検討した 2 つの提供方法

1. **Ubuntu サーバー（静的配信だけ）+ gcsim はクライアントで実行**
   - 1-A: ブラウザの中で gcsim の WASM を動かす（利用者は URL を開くだけ）
   - 1-B: 利用者の PC で公式の `server_*.exe` を起動し、ブラウザから `http://localhost:54321` を呼ぶ
2. **Windows 11 のネイティブアプリ（ランチャー）**: `dist/` をローカルで配信 + gcsim サーバーを起動 + 「ブラウザで開く」ボタン

## ユーザーの決定（2026-10-12）

- 1-A の検証から進める。
- 2 は **2-C（Go の単一 exe。`dist/` を embed し、ローカル配信 + gcsim 起動 + トレイ表示）**。exe は **未署名**。
- gcsim の提供: 1-B・2-C は「初回起動時に公式リリースから取得して SHA-256 検証」。**1-A はこの方式が採れない**（公式リリースに WASM が無い。自前ビルドの再配布になる）。
- 保存は **ブラウザの localStorage**。将来 Google Drive への保存を検討する（保存層を 1 か所にまとめておく）。

## 1-A の検証結果

| 項目 | 結果 |
|---|---|
| ビルド | gcsim `1f9c1f2e`（v2.48.8）の `cmd/wasm` を、Go 1.27.2（`GOOS=js GOARCH=wasm go build -trimpath`）で無改変でビルドできた（約 40 秒。依存は `go.sum` のモジュールだけ） |
| サイズ | `main.wasm` 44.3 MB / gzip 7.9 MB / brotli 5.7 MB |
| 公開関数 | `sample(cfg, seed)`・`validateConfig(cfg)`（アプリが使う `POST /sample`・`POST /validate` に対応） |
| 結果の一致 | スナップショット 128 並びの設定文で、`server_windows_amd64.exe`（v2.48.8）と `sample` を比較 → **127 件の `logs` が完全一致、1 件はエラー文が同一（128/128 一致）**。seed = 1 |
| 速度（Node） | 初期化 0.8 秒。1 回の実行は約 88 ms（サーバーは約 23 ms） |
| 速度（ブラウザの Web Worker。内蔵ブラウザ） | 初期化 0.6 秒。1 回目 330 ms、2 回目以降 130〜190 ms。結果 JSON は約 208 KB |
| エラーの形 | WASM は `{"error":"…"}`、サーバーは平文のエラー文（文言は同一）。アプリの `extractErrorText` は JSON のエラーも扱う |

**結論: 技術的には 1-A は成立する。** 計算結果は公式サーバーと同一で、速度も十分。アプリ側の変更は、`gcsimClient.ts` の `fetch` 2 か所を Worker 呼び出しに差し替えるだけ（保存データ・計算には影響しない）。

## 残る論点（ユーザー判断）

- **AGPL**: 1-A は、自分のサーバーから gcsim のバイナリ（WASM）を配ることになる。次を満たす必要がある（法律の専門家への確認を推奨）。
  1. gcsim のソース（該当コミット）の入手先を、WASM の隣に明示する。確実なのは、自分の GitHub に gcsim のフォーク（またはミラー）を置き、該当コミットにタグを付けること。
  2. AGPL-3.0 の全文と gcsim の著作権表示を同梱する。
  3. ビルドを再現できるようにする（コミット・Go のバージョン・コマンドを記録し、公開の版とタグを合わせる）。
  4. アプリ本体も AGPL-3.0-or-later にするのが安全（現在 `LICENSE` 無し。公開前に決める）。
- 画面を読み込むときの転送量（brotli で約 5.7 MB。キャッシュされる）。
- 1-A は、1-B・2-C のように「公式の実行ファイルをそのまま使う」わけではない（自前ビルド）。バージョン更新のたびに、WASM の再ビルドと再配置が要る。

## 再現手順（作業用。リポジトリには含めていない）

1. Go 1.27.2（`go1.27.2.windows-amd64.zip`。SHA-256 `1314008898bd40df77af4b014f777f08873dbdfbcd3d92308728ee03304fe04f`）を展開。
2. gcsim のソースの tarball（`gh api repos/genshinsim/gcsim/tarball/<commit>`）を展開。
3. `cmd/wasm` で `GOOS=js GOARCH=wasm go build -trimpath -ldflags="-s -w" -o main.wasm .`、`$(go env GOROOT)/lib/wasm/wasm_exec.js` を同じ場所に置く。
4. `check-rotation-snapshots.ts` の `built.config` を全並びぶん書き出し（武器の行 `add weapon="dullblade" refine=1 lvl=90/90` を足す）、WASM とサーバーの `sample` を比較する。

## 実装（2026-10-12。D169）

- 方針: **1-A（ブラウザ内 WASM）を採用**。1-C（サーバー側の実行）は負荷が大きいので採らない。ネイティブアプリ（2-C）を作る場合は別に検討する。
- AGPL: gcsim は自分の GitHub にフォーク（ミラー）し、配布版のコミットにタグ `app-wasm-<version>` を付ける。アプリ本体は AGPL-3.0-or-later で公開。
- 実装: `public/gcsim/worker.js`（Worker）・`src/utils/gcsim/gcsimWasm.ts`（エンジンの選択と Worker の呼び出し）・`gcsimClient.ts`（エンジンの切り替え）・`scripts/build-gcsim-wasm.ts`（`npm run wasm:build`）・`src/components/SourceNotice.tsx`（画面下部の表示）・`LICENSE`・`NOTICE`。
- エンジンの選び方（localStorage の `gcsim_engine`）: `auto`（既定。`public/gcsim/main.wasm` があれば WASM、無ければ localhost のサーバー）／`wasm`／`server`。
- 注意: `main.wasm` は 44MB。開発サーバー（Vite）の監視の対象から外した（`vite.config.ts`）。外さないと、`wasm:build` の書き込み中に EBUSY で開発サーバーが落ちた。
- **ユーザーの作業が要るもの**: ① GitHub で `gwin7ok/gcsim` を、genshinsim/gcsim のフォークとして作る ② 配布版のコミット（`1f9c1f2e`）にタグ `app-wasm-v2.48.8` を付けて push する（手順は `docs/gcsim-サーバー更新手順.md` の 6-B）③ 公開サイトのビルドの前に `npm run wasm:build` を実行する。
