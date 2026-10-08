# gcsim サーバーのバージョンを上げるときの作業の流れ

このアプリのデータ（辞書・マスター・対応表）は、特定の gcsim のバージョンに依存している。gcsim のバージョンを上げる（新キャラ・新武器・新聖遺物への対応や不具合修正）ときの手順をまとめる。
ゲームに新キャラが実装されたときの取り込みは、別の文書 [ゲーム新キャラの取り込み手順.md](ゲーム新キャラの取り込み手順.md) を参照。新キャラの gcsim 対応は、たいていこの手順（gcsim の更新）が先に要る。

## 仕組み（2026-09-30 に導入）

| 項目 | 内容 |
|---|---|
| 設定ファイル | リポジトリ直下の `gcsim.config.json`。バージョン・コミット・サーバーのポート・OS ごとの実行ファイルの URL と SHA-256 を持つ |
| 実行ファイルの置き場 | `.gcsim/<バージョン>/`（Git 管理外）。**リポジトリには入れない**（AGPL の配布義務・容量・OS ごとの違いのため）。公式リリースから取得し、SHA-256 が一致したものだけ使う |
| コマンド | `npm run gcsim:install`（取得と検証）/ `gcsim:start` / `gcsim:stop` / `gcsim:status` / `gcsim:check`（設定・実行ファイル・辞書と対応表のコミットの整合性の検査） |
| 取得元の固定 | 辞書・マスターの生成（`build:catalog`・`build:master`・`build:equipment`・`check:effectkeys`）は、`gcsim.config.json` の `commit` のソースを見る（最新の開発版ではなく、リリースのコミット） |
| 使ってはいけないもの | サーバーの自動更新（`-update`）。固定したバージョンが変わってしまう |

ライセンス: gcsim は v2.47.3 以降 AGPL-3.0（v2.47.2 までは MIT）。実行ファイルを改変しない・このリポジトリで配布しないことで、義務を最小にしている。詳しくは `NOTICE`。

## 更新の手順

### 1. 新しいバージョンを決める
1. https://github.com/genshinsim/gcsim/releases で、上げたいバージョン（例: v2.49.0）を決める。
2. そのタグのコミットを確認する。`https://api.github.com/repos/genshinsim/gcsim/commits/<タグ>` の `sha`。
3. リリースのページで、`server_*` の 6 個（Windows / Linux / macOS × x64 / arm64）の名前・サイズ・SHA-256（GitHub の表示。API の `digest`）を控える。
4. 前のバージョンとのソースの差（追加されたキャラ・変更されたファイル）を確認する。
   `https://github.com/genshinsim/gcsim/compare/<旧タグ>...<新タグ>`

### 2. 設定ファイルを更新する
`gcsim.config.json` の `version` / `commit` / `releasedAt` / `assets`（6 個）を書き換える。ポートは変えない（変えるときは、他のセッションと衝突しないように）。
`NOTICE` の gcsim の項目（ライセンスの変更の有無）も確認する。**ライセンスが変わっていないか、リリースのたびに LICENSE を見る。**

### 3. サーバーを入れ替える
```bash
npm run gcsim:stop
npm run gcsim:start
```
取得後、SHA-256 の一致とバージョンの一致が表示される。不一致なら、保存されず起動しない。

### 4. 辞書とマスターを作り直す（新しい固定コミットで）
```bash
npm run build:catalog      # 効果キーの辞書（gcsim_key_catalog.json）。差分は catalog-diff.md に出る
npm run build:master       # キャラ（フレーム・効果時間・CT開始位置）
npm run build:equipment    # 武器・聖遺物
```
- 出力のレポート（補完・食い違い・凸延長の未確認・孤立した一覧）を読む。新キャラ・新武器の手当ては、[新キャラ実装時の作業.md](新キャラ実装時の作業.md) を参照。
- `build:catalog` の差分（増えたキー・消えたキー）を確認する。消えたキーが、対応表・発動バフで使われていないか。
- マスターを変えたら `src/data/databaseMaster.ts` の `DATABASE_VERSION` を上げる。

### 5. gcsim 連携のデータを再収集・再検証する
```bash
npm run probe:effects      # 全スキル・爆発を単独実行し、効果キーの表（action_effect_keys.json）を作り直す
npm run link:effects       # 継続時間による紐づけ（action_effect_links_by_duration.json）
npm run check:effectkeys   # 対応表（effect_key_coverage.json）と整合性の検査
npm run probe:skill-hits   # スキルの命中時刻の表（skill_hit_frames.json。祭礼の武器効果の計算に使う）
npm run probe:queue-frames # スキル・爆発の「次の行動を受け付け始めるフレーム」（can_queue_after.json。待機の位置を gcsim に合わせる）
```
- 以前の結果との差分（`git diff src/data/action_effect_*.json`）を見る。想定外の変化があれば、gcsim 側の挙動の変更を疑う。
- `check:effectkeys` の「未検討」が出たら、新しいキー・新しいキャラ。`effectKeyDecisions.ts`・`actionEffectKeyOverrides.ts`・`actionEffectExtras.ts` に理由つきで登録する。
- 登録済みの紐づけが今も動くかの確認（2026-09-30 に実施した検証）: 対応表の全 links について、対象のアクションを単独実行し、効果のイベントが出ることを確認する。命中・反応・被ダメージが要るものは出ないことがあるので、条件つきの順序（例: ニィロウの E×4、ドゥリンの E→E）で追加確認する。

### 6. 整合性の検査
```bash
npm run gcsim:check        # 実行ファイル・辞書・対応表の gcsim のコミットが、設定と全部一致していること
npm run lint               # 型チェック
```
`gcsim_key_map.json` などのコミットが設定と食い違うと ✗ が出る。

### 7. 画面で通し確認する
- マスターを全件削除 → 再生成 → 登録した状態で、代表的な編成（4キャラ）で「gcsim設定文をコピー」→「gcsim で実行して読み取り結果を見る」を行う。
- 確認する点: 実行エラーが無い / 「辞書に無いキー」が増えていない / 所要時間・CT・効果時間の変更一覧が、前のバージョンと極端に違わない / CT待ちが出ない編成で出ていない。
- 新キャラが入った場合は、そのキャラを含む編成でも確認する。

### 8. 記録
- `docs/gcsim-integration/progress.md`（または該当フェーズの progress.md）の作業ログに、更新したバージョン・差分・確認結果を書く。
- 対応表のレポート（`docs/gcsim-integration/phase-6-run-and-apply/effect-key-coverage.md`）は `check:effectkeys` が更新する。

## 過去に起きた不具合（教訓）
- 辞書（v2.48.0）と、実行していたサーバー（v2.47.6）のバージョンがずれて、イルーガを認識しなかった（2026-09-30）。→ `gcsim:check` で、実行ファイルのバージョンと辞書のコミットを常に照合する。
- `build:master` が、リリースではなく gcsim の最新の開発版を取りに行っていた。→ 取得元を `gcsim.config.json` のコミットに固定した。
- `link:effects` は結果を `action_effect_keys.json` に書き戻す（一致した定義を `ok` にする）ため、**続けて 2 回実行してはいけない**（2 回目は書き戻し済みの定義を飛ばし、`action_effect_links_by_duration.json` からエントリが消える。2026-10-09、v2.48.8 への更新で発生）。やり直すときは `probe:effects`（表を新しく作り直す）→ `link:effects`（1 回）の順に実行する。
- 前回の収集より後にアプリ側でアクション（長押し・特殊スキルなど）を足していると、更新時の収集で初めて拾われ、自動で紐づいて既存の決定と食い違うことがある（`check:effectkeys` のエラー）。gcsim の変更とは限らない。
