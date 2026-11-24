# このリポジトリでの作業ルール（エージェント向け。毎回読むこと）

## 開発サーバーと gcsim

- **gcsim は、公開サイトと同じ WebAssembly 版（`public/gcsim/main.wasm`）だけを使う**（2026-11-18。localhost の gcsim サーバー（ポート 54321・`gcsim:start` など）は、全廃した。起動・停止・取得は要らない）。画面は、ブラウザの Web Worker で動かす。検査・調査のスクリプト（`probe:*`・`link:effects`・`check:dps` など）は、`scripts/gcsim-node.ts`（Node の worker_threads）で、同じ `main.wasm` を動かす。
- `main.wasm` は Git 管理外。無いとき・gcsim のバージョンを上げたときは、`npm run wasm:build`（Go が要る）で作る。画面・スクリプトとも、`main.wasm` が無いと、この手順を案内するエラーになる。
- gcsim の実行が要る作業（`probe:effects`・`link:effects`・画面の「gcsim で実行して読み取り結果を見る」など）の前に、`npm run gcsim:check` で、辞書・対応表・`wasm-info.json`（WebAssembly 版のビルドの記録）のバージョンが設定と一致していることを確認する。

アプリの開発サーバー（ポート 3000）:

| 起動 | 停止 | 確認 |
|---|---|---|
| `preview_start`（`.claude/launch.json` の `dev`）または `npm run dev` | 起動した方法のプロセスを停止（PID をポートから調べる） | ポート 3000 の待ち受け |

- 別のセッション・別のチャットが、すでに開発サーバーを起動していることがある。起動する前に、ポートの待ち受けを確認する。ポートが使用中なら、他のセッションのものを勝手に止めず、ユーザーに聞く。
- **作業が終わっても、開発サーバーは止めず、起動したままにする**（ユーザー指示 2026-10-01。止めると、ユーザーのブラウザのアプリが「Failed to fetch dynamically imported module」などで動かなくなる）。止めるのは、ユーザーが止めるよう頼んだときだけ。ただし、自分が確認のために一時的に起動した別ポートのサーバーなどは、使い終わったら止めてよい。

## gcsim のバージョンについて
- このアプリのデータは、`gcsim.config.json` のバージョン（コミット）に依存する。バージョンを上げる手順は `docs/gcsim-サーバー更新手順.md`（名前は旧称。いまは WebAssembly 版だけの手順）、ゲームの新キャラを取り込む手順は `docs/ゲーム新キャラの取り込み手順.md`。
- gcsim は v2.47.3 以降 AGPL-3.0。公式の実行ファイルは使わない。WebAssembly 版は、公式のソースを無改変でビルドしたもの（`NOTICE` 参照）。

## 進め方
- gcsim 連携の作業は、`docs/gcsim-integration/README.md` の運用ルールに従う（作業前に計画・進捗を読む、作業中・完了時に更新、ユーザーの決定は `progress.md` の決定ログに記録）。
- マスターデータ・編成のデータは、名前ではなく ID をキーにする。
- 返答は日本語。**コミットは、エージェントが行う**（ユーザー指示 2026-11-12。区切りのよいところで `git add -A` → コミット。1 行目は `feat:` / `fix:` ＋利用者に分かる文。末尾に Co-Authored-By を付ける）。
- **ブランチ・公開**（2026-10-12）: 作業は、ユーザーが切ったブランチの上で行う（`main` への直接の変更は、ユーザーが指示したときだけ。ブランチの作成・切り替え・push・マージ・タグはユーザーが行う（コミットはエージェント）。作業中に、別のブランチへ切り替えない）。公開サイト（GitHub Pages）の更新は、VSCode の **`ctrl+shift+2`（Update Changelog = `npm run release:bump`）→ `ctrl+shift+3`（release-tag-and-push-short = `npm run release:tag`）** で行う（タグの push → Actions の `release.yml` が Release を作成し、`deploy.yml` を main の上で起動する）。`github-pages` 環境は main 以外を拒否するため、タグから deploy を直接起動しない。詳細: `docs/リリース手順.md`。
- **バージョン管理**（2026-10-12。D177・D179）: 版は `package.json` の `version`（SemVer。唯一の出どころ。Update Changelog が更新する）。変更履歴は `CHANGELOG.md`（`[Unreleased]` に書く。空なら、前のリリース以降のコミットから生成される）。**コミットの 1 行目は、`feat:` / `fix:` などの種類 + 利用者に分かる文で書くと、そのまま変更履歴になる**。リリースの手順は `docs/リリース手順.md`。
- **gcsim の WebAssembly 版**（公開サイトの計算エンジン。D169）: 生成物（`public/gcsim/main.wasm` など）は Git に入れない（`npm run wasm:build`）。gcsim のバージョンを上げたら、WASM の再ビルドと、フォークのタグ（`app-wasm-<version>`）の更新が要る（`docs/gcsim-サーバー更新手順.md` の 6-B）。開発中の画面も WASM だけで計算する（`main.wasm` が無いと、画面にエラーと `npm run wasm:build` の案内が出る）。
- **保存**: `localStorage` を、`src/utils/persistence.ts` 以外から直接呼ばない（`npm run check:backup` が検査する）。設定を足すときは `SETTING_KEYS` に足す（バックアップに自動で入る）。キーの文字列は変えない。
