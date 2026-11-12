# アップデート計画: gcsim v2.50.0 ＋ 原神 v7.2 の取り込み

- 作成日: 2026-11-12
- 状態: 計画（未着手）
- 従う手順書: [gcsim-サーバー更新手順.md](../gcsim-サーバー更新手順.md)・[ゲーム新キャラの取り込み手順.md](../ゲーム新キャラの取り込み手順.md)・[新キャラ実装時の作業.md](../新キャラ実装時の作業.md)・[リリース手順.md](../リリース手順.md)
- 進捗・決定の記録先: `docs/gcsim-integration/progress.md`（決定ログ。この計画書には、各作業の完了の印だけを付ける）

## 0. 現状と取り込み対象

| 項目 | 現在 | 取り込み後 |
|---|---|---|
| gcsim | **v2.49.5**（コミット `377c9ce4`。2026-11-03。D329 で取り込み済み） | **v2.50.0**（コミット `b107b5dc5cb88977bed5270e5d83e64934730d4d`。2026-11-10） |
| genshin-db | 5.2.14（原神 v7.1 まで） | 5.2.15（原神 v7.2。2026-11-05 公開） |
| `DATABASE_VERSION` | 86 | 87 以上（作業 A・B で 1 回ずつ上げてもよい） |
| アプリの版 | 1.7.0 | リリース時に `release:bump` が決める |

> 依頼では「取り込み済みは v2.49.4」とあったが、`gcsim.config.json` と `progress.md`（D329）では **v2.49.5 まで取り込み済み**。そのため、新しく取り込む差は v2.49.5 → v2.50.0 の 8 コミット。v2.49.4 → v2.49.5 の分は、参考として 1-2 に載せる。

## 1. gcsim 側の変更の整理

### 1-1. v2.49.5 → v2.50.0（今回の取り込み。8 コミット・53 ファイル）

| 版 | PR | 内容 | アプリへの影響 |
|---|---|---|---|
| v2.49.6 | #3261 | Verdant Dew（草露）の setter のログの修正（`pkg/core/player/verdantdew.go`） | ログの文言だけ。草露のログを読んでいる箇所があれば確認（`probe:effects` の差分で分かる） |
| v2.49.6 / v2.49.7 | #3263・#3266 | セノの A1 のティッカーが同時に 2 つ動く不具合の修正（`cyno/asc.go`・`skill.go`・`burst.go`） | セノの効果キーのイベントの出方が変わる可能性。`probe:effects` の差分・`check:snapshots` で確認 |
| v2.49.6 | #3264 | セノが爆発中に重撃できない不具合の修正（`cyno/cyno.go`。爆発中は専用の通常攻撃カウンターで判定） | 爆発中の重撃が gcsim で実行できるようになる。アプリの変換規則（`chargeRules.ts`）・行動の検証に、セノの爆発中の重撃を止める記述が無いか確認 |
| v2.49.7 | #3265 | サンプルのダメージの数値を省略表記しない（UI・`SampleLog`） | 影響なし（gcsim の画面だけ） |
| v2.49.7 | #3267 | 夢見月瑞希がスキル状態中に walk できない不具合の修正 | アプリが瑞希のスキル中に walk を出す場合、実行エラーが減る。確認だけ |
| v2.50.0 | #3268 | パイプラインを原神 7.2 に更新（敵 10 種の追加・名前の辞書・武器の説明文の更新 2 件） | 敵のデータを使う箇所（敵の選択・粒子）があれば、新しい敵が増える。キャラ・武器のキーの追加は無し |
| v2.50.0 | #3269 | **サンドローネの追加**（`internal/characters/sandrone/`。キー `sandrone`・別名 `marionette`。ID 10000133） | **主作業**。アプリ側だけの対応 → gcsim 対応へ切り替える（作業 B・C） |

サンドローネの gcsim 実装で、取り込み時に注意する点（ソースの確認結果）:
- 重撃にパラメータ `beams`（ビームの本数。既定 3、1 凸以上は 6）・`frames`（長押しのフレーム。`beams` と併用不可）、スキルに `travel`（既定 10f）がある。
- スキル状態中は、ジャンプ・walk ができない（`NextQueueItemIsValid`）。
- 状態が 4 つある（待機・解読中・オーバードライブのチャージ・オーバードライブの待機）。`stellar.go` に星反応（星電導・星拡散）の処理がある。
- `hexerei`・`revelation` のパラメータは無い（`hexereiCharacters.ts`・`revelationCharacters.ts` への追加は不要）。
- 新しい ICD タグ 3 つ・攻撃タグ `AttackTagSandroneBeam` が増えた。

### 1-2. v2.49.4 → v2.49.5（取り込み済み。D329。参考）
Skirk の Void Rifts の二重吸収の修正（#3258）／A1・A4 の抜けていたガードの追加（#3259）／新武器 Heretic's Molten Blade（#3252）／セノの諭示（#3250）。

### 1-3. 未マージのまま（今回も対象外。追跡だけ）
- リンネア（PR #2596。2026-11-10 に更新あり）・ネフェル（PR #3045。2026-11-05 に更新あり）・カチーナ（PR #2697）: `appSideCharacterSources.ts` で固定しているコミットより新しくなっている可能性がある。**今回は固定コミットを動かさない**（動かすかは、ユーザーに確認する項目 Q3）。
- ヴェンティのヘクセレイ（PR #2715）・マーヴィカのバイクのフレーム修正（PR #3253）: 未マージ。
- 諭示: 北斗は PR なしのまま（追跡の対象。`新キャラ実装時の作業.md` の「諭示の gcsim の実装の追跡」）。

## 2. 原神 v7.2 の新要素（gcsim 未実装）

genshin-db 5.2.15 で追加されたもの（リポジトリの 7.2 のコミットで確認）:

| 種類 | 名前 | ID | 内容 |
|---|---|---|---|
| キャラ | **ミティヤ**（Mitya） | 10000136 | ★5・雷・法器・スネージナヤ。星電導（超電導が星電導に変わる）。スキル = 検知コア（一回押し / 長押し・6 秒以内の再発動で状態切り替え）。重撃 = 変形ビーコンを消費する特殊重撃（長押し）。爆発 = 変形ビーコン 3 つ |
| キャラ | **バレリー**（Valeriy） | 10000137 | ★4・雷・片手剣・スネージナヤ。スキル = 突撃 + 蓄雷シールド + 衝撃エネルギー 40。衝撃エネルギー 40 以上で特殊重撃。爆発 = 雷霰重弾（降っている間の効果あり） |
| 武器 | **秘星の聖典**（Starsealed Edict） | 14525 | ★5・法器・会心ダメージ。スキル発動で「晶質調合」（熟知・20 秒）、チームの元素反応で「炉中の法則」（最大 3 層）。輝映・星電導で追加効果 |

聖遺物の新セットは、genshin-db の 7.2 の追加には無い（作業 A の `build:equipment` の出力で再確認する）。

## 3. 作業の順序

ブランチは、ユーザーが切る（例: `gcsim-v2.50.0_原神-v7.2`）。エージェントは、そのブランチの上で作業する。コミットはユーザーが行う。
作業 A と作業 B は、どちらも `build:master` を実行するので、**A → B の順に続けて行い、検査（C 以降）はまとめて 1 回**にする。

### 作業 A. 原神 v7.2 の新キャラ・新武器（手順書「ゲーム新キャラの取り込み手順」の A・D）

- [x] A-0.（2026-11-12 追加。D331）取得元を、API と手元の npm の両対応にする。公開 API が原神 7.2 に未対応（キャラ 124 件・武器 255 件のまま）で、`build:master` に新キャラが出なかったため。`GENSHIN_DB_SOURCE`（auto / api / local）。`src/masterdata/genshinDbSource.ts` ほか。api モードで従来と同じ結果（差 0）・auto で手元を選んだことを確認。手順書 2 本を更新。

- [x] A-1. genshin-db を 5.2.15 に上げる（`npm install genshin-db@5.2.15`。`package.json`・`package-lock.json` が変わる）。 ← **済（2026-11-12）: genshin-db 5.2.15（package.json・package-lock.json）**
- [x] A-2. `npm run build:master` → 出力に、ミティヤ・バレリーがいること（gcsim フレームなし = 天賦の文から作った仮のアクション）、名前が化けていないこと（`scripts/genshin-db-names.ts`）を確認する。 ← **済（2026-11-12）: build:master（136 キャラ。ミティヤ・バレリーが仮のアクションで入った。A-0 の local 取得）**
- [x] A-3. `npm run build:equipment` → 秘星の聖典が入ったこと、新しい聖遺物セットの有無を確認する。武器の発動バフは gcsim の辞書に無いため「gcsim 対象外」になる（正しい）。 ← **済（2026-11-12）: build:equipment（秘星の聖典 14525 が入った。新しい聖遺物セットは無し・gcsim 対象外）**
- [x] A-4. アプリ側の表を足す（gcsim の辞書から作れない分。人が説明文から分類する）。 ← **済（2026-11-12）: 通常攻撃の段数・appSideBuffDefinitions・effectKeyDecisions（constellationEffects の追加は不要＝「凸延長 未確認」は 0 件）**
  - `characterMasterGenerator.ts` の通常攻撃の段数の表: ミティヤ 3 段・バレリー 3 段（説明文より）。
  - スキルの形（一回押し / 長押し・再発動）・特殊重撃・効果継続時間: `build:master` の出力を見て、既存の同種のキャラ（ヴェスナ `10000143`・ローエン `10000129` の記述）にならって足す。
  - `appSideBuffDefinitions.ts`: 2 人の命ノ星座の効果の定義・定義から外す固有天賦（issue #38 の分類の例にならう）。
  - `constellationEffects.ts`: 「凸延長 未確認」に出たものを `VERIFIED_RULES` / `NOT_APPLICABLE` へ。
  - `effectKeyDecisions.ts` の `DEF_DECISIONS`: `10000136-electro_e`・`_q`、`10000137-electro_e`・`_q` を `reason: 'not-in-gcsim'` で登録（note のバージョンは v2.50.0）。
- [x] A-5. `npm run review:buff-scopes` → 新しい行（2 人の固有天賦・命ノ星座、秘星の聖典）の「全体 / 自分だけ」を確認し、違うものを `buffScopeOverrides.ts` に足す。 ← **済（2026-11-12）: review:buff-scopes（ミティヤ c6 を team に。ほかは自動判定どおり。秘星の聖典は時間つきなので対象外）**
  - 見込み: ミティヤの固有天賦 1（チーム全員の元素熟知 +30）・固有天賦 3（チームの星電導の基礎ダメージ）は全体。固有天賦 2（ミティヤの会心率）は自分だけ。秘星の聖典は自分だけ。
- [x] A-6. `DATABASE_VERSION` を上げる。 ← **済（2026-11-12）: DATABASE_VERSION 87**
- [x] A-7. 未実装の仕組みの洗い出し: 星電導（超電導 → 星電導への変化）・変形ビーコン・衝撃エネルギーが、アプリの既存の仕組み（サンドローネの星反応・ゲージの行）で表せるか。表せないものは、`issue-36-残りの未対応.md` に追記する（実装するかは Q2）。 ← **済（2026-11-12）: 両方作る（Q2）: バレリーの衝撃エネルギー・特殊重撃、ミティヤの検知コア切り替え・変形ビーコン・特殊重撃を、モードの仕組みで実装（未対応の点は issue-36-残りの未対応.md の 5）**

### 作業 B. gcsim v2.50.0 への更新（手順書「gcsim-サーバー更新手順」の 1〜6）

- [x] B-1. `gcsim.config.json` を更新する（`version`・`commit`・`releasedAt: 2026-11-10`・`assets` 6 個）。値は付録 1。`NOTICE` と gcsim の LICENSE（AGPL-3.0 のままか）を確認する。
- [x] B-2. サーバーを入れ替える。`npm run gcsim:status` とポート 54321 の待ち受けを確認 → `npm run gcsim:stop` → `npm run gcsim:start`。
  - **取得の確認が要る**（CLAUDE.md）: `server_windows_amd64.exe`・出典 `https://github.com/genshinsim/gcsim/releases/download/v2.50.0/`・37,444,096 バイト。実行前にユーザーへ示して確認を取る。
  - 他のセッションがサーバーを使っているときは、止める前にユーザーに聞く。
- [x] B-3. 辞書とマスターを作り直す: `build:catalog` → `build:master` → `build:equipment` → `build:aliases`。
  - `catalog-diff.md` で、増えたキー（サンドローネ）・消えたキー（セノの A1 まわりに注意）を確認する。消えたキーが、対応表・発動バフで使われていないこと。
  - 別名の表に `sandrone` / `marionette` が入ったこと。
- [x] B-4. サンドローネを、アプリ側だけの対応から gcsim 対応へ切り替える（手順書 B-7・B-8）。
  - `effectKeyDecisions.ts`: `10000133-cryo_e`・`_q` の `not-in-gcsim` を消す。
  - `appSideBuffDefinitions.ts`: `10000133-cryo` の命ノ星座の定義（1・2・6 凸）と、外した固有天賦の行を消す（辞書から作り直される）。
  - `characterMasterGenerator.ts:1926` の通常攻撃の段数（`10000133: 3`）: gcsim のフレームから決まるので、要らなくなれば消す。
  - `buffScopeOverrides.ts` の `10000133-cryo_c1: 'team'`: 定義 ID が変わらなければ残す。作り直した定義で判定が合うなら消す。
  - `appSideCharacterSources.ts` には、サンドローネの行は無い（確認済み。消すものなし）。
- [ ] B-5. サンドローネの新キャラ作業（`新キャラ実装時の作業.md` の 1〜3）。 ← **一部済（2026-11-12）: Q1（重撃の本数 `_ca_beams<N>`）・「未確認のキー」0 件。残り: 効果の日本語名（辞書の上書き）・スキル中のジャンプ/walk 禁止の検証は、画面確認（作業 E）で必要になれば行う**
  - 効果継続時間の補完の候補・凸延長の未確認・「未確認のキー」を 0 件にする。
  - 変換規則（`actionMapping.ts`・`chargeRules.ts`）: 重撃の `beams` / `frames` を、アプリの長押しの重撃にどう対応させるか（Q1）。スキル中のジャンプ・walk の禁止を、行動の検証に入れるか。
  - 両手剣だが、重撃がビーム（射撃）の特殊な形。既存の両手剣の規則が当てはまらない見込み。
  - 新キャラの効果の日本語名を `gcsimKeyCatalogOverrides.ts` で直す。
- [x] B-6. gcsim 連携のデータを再収集する（この順。`link:effects` は 1 回だけ）。
  `probe:effects` → `link:effects` → `link:actions` → `coverage:links` → `probe:skill-hits` → `probe:queue-frames` → `probe:dash-jump` → `probe:hitlag` → `check:hitlag`
  - `coverage:links` の「未検討」（サンドローネの E・Q・固有天賦・命ノ星座）を決める。判断は、単独実行の結果と gcsim のソースで行い、**gcsim とゲームの差がありそうなものは、実行結果を表で示してユーザーにゲームでの動きを聞く**（ゲーム優先）。
  - `git diff src/data/action_effect_*.json src/data/dash_jump_frames.json src/data/hitlag_frames.json` で、サンドローネ・セノ以外の想定外の変化が無いこと。
  - `check:hitlag` が ✗ のときは、一覧を調べる（サンドローネの重撃・モードは、表に出ない仕組みの可能性）。
- [x] B-7. `DATABASE_VERSION` を上げる（A-6 とまとめて 1 回でもよい）。

### 作業 C. 検査

- [x] C-1. `npm run gcsim:check`・`npm run lint`・`npm run check:backup`。
- [x] C-2. `npm run check:snapshots` → 差を説明する（見込み: セノの A1・サンドローネを含む並び）。説明できたら `--update`。
- [x] C-3. `npm run check:effectkeys`・`check:action-links`（`coverage:links` に含まれる）で、エラー 0・未検討 0。
- [x] C-4. 既存の検査一式（`check:gcsim-import`・`check:rotation-validation`・`check:i18n`・`check:required-er`・`check:sacrificial-seed`）。新キャラ・新武器の名前の英語（i18n）が入っていること。

### 作業 D. WebAssembly 版・プリセット（手順書 6-B・6-C）

- [x] D-1. `npm run wasm:build`（Go が要る）。`wasm-info.json` のコミットが `b107b5dc` であること。
- [ ] D-2. （ユーザーの作業待ち。wasm:build は済み。SHA-256 cb8c3d68…）ソースの控え（AGPL）: フォーク `gwin7ok/gcsim` を同期し、タグ `app-wasm-v2.50.0` を `b107b5dc` に付けて push する。**push はユーザーが行う**（または、ユーザーの確認を取ってから実行する）。古いタグは消さない。
- [x] D-3. 同梱プリセット。 ← **済（2026-11-12）: lunar-bloom を WASM で 2 回計算（所要時間 0 件・2 回目も同じ）し、反応の行の版だけ v2.50.0 に更新（行の内容は不変）。sandrone-stellar-conduct は gcsim 未対応のメンバー（10000150）がいるため読み込み・保存のみ（ファイルは変更せず、スナップショットだけ更新）**
  - `lunar-bloom`（反応の行を持つ）: 手順書 6-C のとおり作り直す（gcsim のバージョンが変わるため必須）。
  - `sandrone-stellar-conduct`: メンバーは 10000150・八重神子・七七・サンドローネ。サンドローネが gcsim 対応になっても、10000150 が gcsim 未対応なら「読み込んで保存だけ」のまま。4 人とも対応していれば、「gcsim で計算」で作り直す対象に変わる（B-3 の後に、4 人の `gcsimKey` の有無で判定する）。
  - 作り直すとき、2 回続けて計算して「所要時間 N 件」が 0 になることを確かめる（教訓。D330）。
- [x] D-4. WASM とサーバーの結果の一致（`提供方法の検討-WASM検証結果.md` の再現手順 4）。

### 作業 E. 画面の通し確認（手順書 7）

画面の確認は、実装ごとに頼まず、`docs/gcsim-integration/次のセッション用プロンプト.md` の一覧に追記して、最後にまとめる。
- [x] E-1. （確認項目を「次のセッション用プロンプト」に追記済み。実機の確認は次のセッションで）マスターを全件削除 → 再生成 → 登録。
- [x] E-2. （確認項目を「次のセッション用プロンプト」に追記済み。実機の確認は次のセッションで）ミティヤ・バレリーを編成に入れて、アクションを置ける。アイコン（enka.network）が出る。「gcsim で計算」は押せず、理由が警告に出る。秘星の聖典を装備できる。
- [x] E-3. （確認項目を「次のセッション用プロンプト」に追記済み。実機の確認は次のセッションで）サンドローネを含む編成で「gcsim で計算」: 実行エラーなし・「辞書に無いキー」が増えていない・「gcsim未実装」のバーが消えた・重撃とスキルの所要時間が gcsim と合う。
- [x] E-4. （確認項目を「次のセッション用プロンプト」に追記済み。実機の確認は次のセッションで）代表的な編成（同梱プリセット 4 つ）で、所要時間・CT・効果時間の変更一覧が、前のバージョンと極端に違わない。セノを含む編成（爆発中の重撃・A1）。
- [x] E-5. （確認項目を「次のセッション用プロンプト」に追記済み。実機の確認は次のセッションで）最下行の件数と、キャラ名の横の「✨ 個数」のバッジ（A-5 の確認）。

### 作業 F. 記録・リリース

- [x] F-1. `progress.md` の決定ログに、更新したバージョン・差分・確認結果・ユーザーの決定（Q1〜Q3）を書く。
- [x] F-2. `CHANGELOG.md` の `[Unreleased]`（例: gcsim v2.50.0 に対応・サンドローネを gcsim で計算できるようにした・原神 v7.2 のミティヤ・バレリー・秘星の聖典を追加）。
- [x] F-3. `NOTICE`・画面下部の gcsim のバージョン表示（`check:version-notice`）。
- [ ] F-4. 公開は、ユーザーが `ctrl+shift+2` → `ctrl+shift+3`（`リリース手順.md`）。

## 4. ユーザーに確認する項目

- **Q1. サンドローネの重撃の表し方**: gcsim は `beams`（本数）か `frames`（長押しのフレーム）で指定する。アプリでは、①長押しの秒数（`frames` に変換。既存の長押しの仕組み）、②本数を選ぶ、のどちらにするか。B-5 で、gcsim の実行結果（本数ごとの所要時間）を表で示してから決める。
- **Q2. ミティヤ・バレリーの固有の仕組み**（変形ビーコン・検知コアの状態切り替え・衝撃エネルギー・特殊重撃）を、今回どこまでアプリ側で作るか。①仮のアクション（E・Q・通常・重撃）と効果バーだけ（最小）、②ゲージの行・特殊重撃も作る。おすすめは ①（gcsim の実装が出たら、フレームと仕組みが決まるため）。
- **Q3. 未マージの PR（リンネア・ネフェル・カチーナ）の固定コミットを、今回新しくするか**。おすすめは「今回は動かさない」（差分の確認が別の作業になるため）。
- **Q4. ゲームでの動きの確認**: サンドローネの効果時間・CT の開始位置で、gcsim とゲームに差がありそうな点は、B-6 で表にして聞く。

## 5. 起こりそうな問題

| 問題 | 対処 |
|---|---|
| genshin-db 5.2.15 で、既存キャラの説明文・ラベルが変わり、効果継続時間の読み取りが変わる | A-2 の `build:master` の後に `git diff src/data/characters_master_data.json` を、新キャラ以外の行で確認する。A と B を分けてコミットできるよう、A の後に一度差分を見る |
| サンドローネが gcsim 対応になり、アプリ側の定義 ID が変わって、保存済みの編成・プリセットの発動バフが外れる | 未リリースの旧データは考慮不要だが、サンドローネは公開済み（v1.7.0）。定義 ID が変わるかを B-4 で確認し、変わるなら注意書き・移行を検討する |
| `link:effects` を 2 回実行してエントリが消える | やり直すときは `probe:effects` から |
| セノの修正で、既存の決定（`effectKeyDecisions.ts`）と自動の紐づけが食い違う | `check:effectkeys` のエラーを見て、gcsim の変更か、アプリ側の追加かを切り分ける |
| プリセットの「gcsim で計算」が冪等でない | 2 回続けて実行して確認（D330 の教訓） |

## 付録 1. `gcsim.config.json` に入れる値（v2.50.0。GitHub API で取得。2026-11-12）

- `version`: `v2.50.0` / `commit`: `b107b5dc5cb88977bed5270e5d83e64934730d4d` / `releasedAt`: `2026-11-10`
- URL: `https://github.com/genshinsim/gcsim/releases/download/v2.50.0/<name>`

| キー | name | size | sha256 |
|---|---|---|---|
| win32-x64 | server_windows_amd64.exe | 37444096 | `53b5dd54e9f23ea26caad246cce384a5f47894685062f471c58d4822b39ea4f4` |
| win32-arm64 | server_windows_arm64.exe | 34640384 | `bb3d6ad35c70bc006f53fdf64f700407c56344aab084b5d733597677b1428f4c` |
| linux-x64 | server_linux_amd64 | 37183356 | `bd95853ab3cb563d354261baa20a0c315afd0df4de26aa325e8cbbe812dadf91` |
| linux-arm64 | server_linux_arm64 | 34751032 | `4d00e8fabe4773c9d56396f03df2d1768d140ebc49786749aceb69321fc3c42a` |
| darwin-x64 | server_darwin_amd64 | 38007632 | `c86282d3ef17d54460c3f0939e36fb587cd28981b4b5855da6e2885e6368b241` |
| darwin-arm64 | server_darwin_arm64 | 35844962 | `2d6fc9d97031abb97ee41f80062aa839f4d43dcb6a38fe6b44f6da1e6e6a2c77` |

## 付録 2. 調べた出どころ

- gcsim のリリース: https://github.com/genshinsim/gcsim/releases/tag/v2.50.0 （v2.49.6・v2.49.7 のリリースノートも）
- ソースの差: https://github.com/genshinsim/gcsim/compare/v2.49.5...v2.50.0
- genshin-db: https://github.com/theBowja/genshin-db （2026-11-04〜05 の「7.2 data」「7.2 publish」のコミット。npm 5.2.15）
