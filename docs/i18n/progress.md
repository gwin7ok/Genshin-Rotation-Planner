# 多言語対応（日本語 / 英語） 進捗

## 現在の状態

フェーズ 3（ゲームデータ）: 進行中（3-3 まで完了。次は 3-4 要約・引用の英語の確認）。進め方は plan.md 4.3.2

## フェーズ状態

| フェーズ | 状態 | 備考 |
|---|---|---|
| 1. 仕組み | 確認待ち | 下の「フェーズ 1 のチェックリスト」 |
| 2. 画面の文言 | 完了 | 下の「フェーズ 2 のチェックリスト」 |
| 3. ゲームデータ | 進行中 | plan.md 4.3.1（DB の形）・4.3.2（段階） |
| 4. 開発・検証用の表示 | 未着手 | |
| 5. 公開 | 未着手 | |

## フェーズ 1 のチェックリスト

- [x] i18next 26.4.3・react-i18next 17.0.16 を追加（公開から 2 週間以上たった版）
- [x] 言語の決定・保存・切り替え（`src/i18n/language.ts`。`SETTING_KEYS.language` = `appLanguage`）
- [x] 初期化と `t()`（`src/i18n/index.ts`。`main.tsx` の最初で読み込む）、`html lang`・タイトル
- [x] キーの型（`src/i18n/keys.ts`）。間違ったキーが tsc のエラーになることを確認
- [x] 切り替え（`LanguageSwitcher.tsx`。ヘッダー）。本番のビルドでは表示しない・常に日本語（D253）
- [x] `npm run check:i18n`（ja と en のキー・差し込み値の一致、未訳の件数、言語の判定の 7 例）。`--strict` で未訳も失敗にする
- [x] `check:backup` の保存キーの検査に `language` を追加（47 項目すべて合格）
- [x] 用語集（[glossary.md](glossary.md)）。`要確認` の用語が 5 件
- [x] 画面で確認: 自動（ブラウザ ja → 日本語）→ English（保存・再読み込み・lang=en・タイトル英語）→ 自動（保存が消え日本語）。コンソールのエラーなし

## フェーズ 2 のチェックリスト

名前空間（`src/locales/<言語>/`）: common・app・header・chart・database・editor・gcsim・guide・messages・notice・party・save

- [x] ヘッダー（`Header.tsx`）・言語の切り替え
- [x] 小さい部品（ErrorBoundary・GlobalBuffRow・SourceNotice・GcsimMissingBadge・StaleReactionsBadge・GcsimComputeBanner・DialogProvider・ItemLockButton・DatabaseWeaponCardItem・ElementIcon・CharacterFilterBar）
- [x] ダイアログ（UpdateNoticeModal・SaveAsDialog・SaveLoadModal・PartyConfigModal・GcsimConfigDialog・GcsimLogSummaryView・UsageGuideModal・EditCharacter/Weapon/ArtifactSubModal）
- [x] 構築エリアの部品（StintBuffTriggersSection・ReactionRows）、`App.tsx`
- [x] `GanttChart.tsx`
- [x] `StintSequenceEditor.tsx`（英語の「使い方」の表記 Add stint・Quick reorder・Group N・Repeat 1・Ungroup・+Wait に合わせた）
- [x] `DatabaseManagerModal.tsx`（`WEAPON_TYPE_NAMES_JA` → `weaponTypeLabel`）
- [x] React の外の文言（`src/utils/`・`src/data/plungeRules.ts`・`characters.ts` の空き枠の名前。名前空間 messages）
- [x] 日付の整形（`databaseService.ts` を `dateLocale` に。タイムゾーンは端末のまま）
- [x] 画面での確認: 英語でメイン画面・編成設定・編成管理・DB 管理・使い方を開き、画面の文言に日本語が残らないこと（残るのはゲームデータと保存済みのデータ）、日本語の画面で翻訳キーが出ないこと、コンソールのエラーなしを確認。ヘッダー・ガントチャートのはみ出しなし（全画面の細かい確認は未）

メモ:
- 検査スクリプトなどブラウザの外（`window` が無い）では、常に日本語（`language.ts`。Node 22 には `navigator` があり en-US になるため）。
- 日付のロケールは `src/i18n` の `dateLocale`（表示の言語に合わせる）。元素・武器種の表示名は `src/i18n/labels.ts`。
- 置き換えで、日本語の画面の表記が変わった箇所: gcsim の読み取り結果の表の括弧（全角 → 半角）・範囲の記号（〜 → –）。
- 英語の数の表記（`_one` / `_other`）は、1 件になりうる短い表示から付けている（すべてではない）。

## フェーズ 3 のチェックリスト

- [x] 3-1 型: 文を持つオブジェクトに `en?: EnglishTexts<...>`（`src/types/genshin.ts`・`database.ts`）。表示の関数 `loc()`・`charName()`・`locDataSource()`（`src/i18n/loc.ts`）
- [x] 3-1 画面の名前・説明の表示を置き換え: キャラ名 `charName()`、編成の中のアクション名 `actionName(char, act)`（定義から引く。待機・維持・交代はアプリの文言）、発動バフ・効果バー・モード・副次効果・武器・聖遺物（`loc()`、`WeaponModel.displayName` など）。計算結果に写す名前（効果バー・CT 違反の文など）は utils で写すときに表示の言語にする
  - 処理に使う名前は日本語のまま: 命ノ星座の発動バフの `name`（編成の中の発動バフとの照合に使う。フェーズ 2 で `t()` にしていたのを戻し、英語は `en` へ）、モードの `label`（`modeKeyOf` のキー）
  - 残り: gcsim の結果の反映ダイアログ（`GcsimConfigDialog` の変更の一覧の名前。`applyGcsimResult` が保存されている名前を写す）
- [x] 3-2 キャラ: 生成で genshin-db の英語の天賦・命ノ星座を取得し、`en` を付ける（`src/masterdata/englishTexts.ts`。名前は天賦名・命ノ星座名の組と決まった語の表で置き換え、説明文は英語の説明文）。命ノ星座の効果は `buffGcsimLink.ts` で段階の `en` を写す
  - `npm run build:master` で作り直し、**`en` を除くと今の JSON と完全に一致**することを確認（計算は変わらない）。`en` は 2443 か所・79 万字。キャラのマスター 90 万字 → 170 万字
  - 英語の名前を作れなかったもの 51 件（モードの名前 48・アクション 3）→ 3-3
- [x] 3-2 武器・聖遺物: 名前・パッシブ名・精錬ごとの説明・発動バフ（名前・説明・英語の要約 `generateStatSummaryEn`・根拠の引用 `findEnglishQuote`。D258）。英語は公式 ID で突き合わせる（今までは並び順）。常時の効果の定義（`buffGcsimLink.ts`）にも `en`
  - `npm run build:equipment` で作り直し、**`en`（と生成日時）を除くと今の JSON と完全に一致**。武器 79 万字 → 177 万字・聖遺物 6 万字 → 10 万字。根拠の引用は 229 件中 213 件を英語の説明文で見つけた（16 件は日本語の原文を出す）
- [x] 3-3 アプリ独自の定義
  - 型に `en` を足した（モードの barNote・gauge・blocked・drain・burstVariant・ctReduction・layerBuff・fullBuff、アクションの specialBurstHint、gcsimNote、キャラの frameSource、武器・聖遺物の旧形式 buffEffect）
  - 英訳の辞書と付ける関数: `src/masterdata/handwrittenEnglish.ts`（名前 `TERMS`・文 `SENTENCES`・装備の発動バフ名の接尾 `BUFF_SUFFIXES`・決まった文の型 `PATTERNS`）。マスターの木をたどって、表示用の欄（name・label・description・hint・gcsimNote など）に日本語があり `en` に無いものへ足す。手で書いた発動バフ名「X: 接尾」は英語の装備名 + 訳した接尾。旧形式 buffEffect は最初の発動バフの `en` を写す
  - 呼ぶ場所: `scripts/link-buffs.ts` の `linkActions`・`linkEquipment` の最後（build:master・build:equipment・link:actions・regenerate-appside-characters がすべて通る）と、`databaseService.ts`（オンライン生成の結び付けの後）
  - マスターを作り直し、`en`（と生成日時）を除くと今の JSON と完全に一致。画面に出る欄で `en` の無い日本語は 0 件（精錬・命ノ星座の中も含む）。キャラ 174 万字・武器 185 万字・聖遺物 11 万字
  - 表示を `loc()` に: モードの説明・barNote・blocked.hint・gauge・followUps・burstVariant・ctReduction・layerBuff / fullBuff・specialBurstHint・gcsimNote（GlobalBuffRow・StintBuffTriggersSection）・frameSource（`frameSourceOf()`）・旧形式の発動バフ名・DB 管理のアクションの名前とボタン名・編成設定の命ノ星座の一覧
  - 実行時の定数: 魔女の諭示の説明（`REVELATION_INFO` の `en`・`revelationTooltip(key, language)`・アプリ側の発動バフ）、gcsim のキーごとの名前（`labelForKeyEn`。保存する名前・照合は日本語のまま。表示は `triggerName()` で引く）
  - 手で書いた名前の装備の発動バフ（WEAPON_BUFF_OVERRIDES など）は、`buffUtils` で `en` を丸ごと捨てていた → 名前がマスターと同じときは英語を使う
  - `check:action-links` は、副次効果の比較で `en` を除く（入力の一覧には英語が無いため）
  - genshin-db で公式の英語が見つからなかった語は、原神 Wiki（fandom）の日本語版・英語版の同じページを突き合わせて確かめた（ユーザー指示 2026-10-29。キャラのページの天賦の説明・魔女の諭示のページ。API の parse で本文と言語間リンクを取得）。約 30 語を公式名に直した（例: 燔天の時 = Crucible of Death and Life・粛清 = Disciplinary Action・風の加護 = Windfavored・輝映 = Radiance・星電導 = Stellar-Conduct）。結果は glossary.md の「アプリが手で書いた名前」。「速攻状態」（イアンサ）はゲームに名前が無いアプリの呼び名で、Quick Stormflight window に確定（D259）
  - 日本語の表記も、ゲーム内の公式の名前（genshin-db の日本語）に合わせた（D259。約 30 語。例: 近接の構え → 近接モード・パンチ連打モード → 熾炎獅子・粛清 → 粛正・月相転移 → 隙を過ぐる月）。定義・手で補う一覧・gcsim の辞書の名前・プリセット（lunar-bloom）・辞書のキーを直し、build:catalog・build:master で作り直した。マスターの差は文字列だけ（名前・説明・出典のメモ・boostedBy）。check:snapshots の差 28 並び・92 行は、名前の置き換えだけであることを機械的に確かめてから保存。検証データ（網羅状況）も作り直した（effect_key_coverage の「未検討 1 件」はイファの 10000113-anemo_e_cancelplunge で、今回の変更の前からのもの）
  - 注意: link:actions だけでは、すでに付いている英語は上書きされない（辞書を直したら build:master で作り直す）
  - 画面の確認（英語・同梱のマスター）: メイン画面・編成設定・DB 管理（キャラ・武器・聖遺物）で、画面の文字と title に日本語が残らないことを確認。残るもの: DB 管理のアクションの title のフレームの出典 `frames.source`（gcsim のソースの位置と補足。9 種。開発者向け → フェーズ 4）、略号 `hE(落下)`（1 件。記法の処理に使う → 3-5 で扱いを決める）。日本語の画面でコンソールのエラーなし
  - genshin-db の英語で確認した公式名: Oz・Lightning Stiletto・Musou Isshin・Ceremonial Garment・Shunsuiken・Sword Dance・Mortuary Rite・Night Vigil・Turbo Twirly・Nightsoul's Blessing・Nightsoul points・Dreamdrifter・Apex Drive・Seven-Phase Flash・Manifest Flame・Thunderous Symphony・Northland Spearstorm・Shadow Dance・Sturm und Drang・Masterstroke・Joy・Armed for Action・Sword Essence・Windborne Sword・Hunter's Precision・Adagio: Coda at Dawn's Tolling・Dandelion Breeze・Jade Screen・Scarlet Seal・Blood Blossom・Prayerful Wind's Benefit・Perfidious Wind's Bale・Redmane's Blood・Grin-Malkin Hat・Ranging Flame・Confirmation of Purity・Denial of Darkness・Principle of Purity: As the Light Shifts・Principle of Darkness: As the Stars Smolder・Dragon of White Flame・Dragon of Dark Decay
  - genshin-db で見つからなかったもの（→ 原神 Wiki で確認済み）: 近接の構え・庭火焔硝・怒目鬼王・風の加護・パンチ連打モード・潜水（加圧）・影狩り・瑞獣の舞・雲の変化・黄昏の祈り・燔天の時・羽月の輪・月相転移・月相の輝き・粛清・血の契約・標的の印・速攻状態・蒼白の賛歌・月の歌・雷鳴の交響・各「印」・猫玉・重力 など
- [ ] 3-4 要約の英語の組み立てと、英語の説明文からの根拠の引用（D258）
- [ ] 3-5 名前で判定している処理の置き換え
- [ ] 3-6 保存編成・プリセットの名前を、表示のときに DB から ID で引く
- [ ] 3-7 `DATABASE_VERSION` を上げる（利用者の DB に `en` を入れる。更新の通知が出る）・保存容量の実測・`check:snapshots`

### フェーズ 3 へ持ち越すもの（フェーズ 2 で見つけたもの）

- 名前で判定している処理: `GanttChart.tsx` の `getBuffClassification`（`name.includes('スキル')` など）は、日本語のときだけ名前を見るようにした（英語の名前はほぼすべて 'e' を含むため）。ID・種類での判定に置き換える。`StintBuffTriggersSection` の `${duration}秒` も同様（英語は `s` も見る）。
- `src/masterdata/` の文（諭示の説明・`frameSource`・モードの名前・特殊爆発の受付の説明・ゲージの説明・状態バーの名前・発動バフの名前「〜 4セット」など）。
- `lastSyncedAt` は、生成したときの言語の文字列で保存する（言語を切り替えても前の言語のまま）。D250 の DB の形の変更と合わせて決める。
- そのままにしたもの: `PRESET_NAME_PREFIX`（「[プリセット]」。保存編成の名前の一部で、プリセットの判定に使う）・`APP_FILE_PREFIX`（書き出すファイル名）・名前の並びの区切り「・」（メモ欄・ファイル名）。

## 決定ログ

| 日付 | # | 決定内容 | 理由・経緯 |
|---|---|---|---|
| 2026-10-29 | D243 | **仕組みは i18next + react-i18next、言語ファイルは JSON** | ユーザー決定（推奨は自前 + TS）。キーの打ち間違いは、JSON から作るキーの型（`src/i18n/keys.ts`）で tsc が検出する（i18next の型の宣言は strictNullChecks が前提のため使わない） |
| 2026-10-29 | D244 | **言語ごとのフォルダに、画面・機能ごとのファイル**（`src/locales/ja/header.json` など） | ユーザー決定。差分が見やすく、画面ごとに訳せる |
| 2026-10-29 | D245 | **切り替えはページの再読み込みで反映する** | ユーザー決定。React の外の文言をそのまま扱え、日英の混ざった表示が残らない。編成は自動保存済み。Undo の履歴・開いていたダイアログは消える |
| 2026-10-29 | D246 | **選択肢は 自動 / 日本語 / English**。「自動」は保存を消し、ブラウザの言語に従う | ユーザー決定 |
| 2026-10-29 | D247 | **設定が無いときは `navigator.languages` を順に見て最初の ja / en。どちらも無ければ英語** | ユーザー決定。例: [zh-CN, ja] → 日本語、[ko, fr] → 英語 |
| 2026-10-29 | D248 | **言語の設定は `SETTING_KEYS`（バックアップに含める）** | ユーザー決定。別の端末へ移しても同じ言語 |
| 2026-10-29 | D249 | **ゲームデータは、公式の文（名前・天賦名・説明文）を genshin-db の英語にし、アプリ独自の名前・要約も英訳する** | ユーザー決定。数値の抽出は日本語の文のまま行う |
| 2026-10-29 | D250 | **DB の項目に両言語の名前を持たせる**（`name: {ja, en}` の形） | ユーザー決定（推奨は表示時に ID から引く案）。DB の形の変更・移行・バックアップの互換が要る。容量は plan.md 2.1 |
| 2026-10-29 | D251 | **言語ファイル・英語のゲームデータは、すべて同梱する** | ユーザー決定。読み込みの失敗が無い。初回の読み込みが 1〜2MB 程度増える |
| 2026-10-29 | D252 | **開発・検証用の表示も含め、画面に出るものはすべて英語にする** | ユーザー決定。網羅状況などの検証データを作るスクリプトも対象 |
| 2026-10-29 | D253 | **全部訳し終わるまで、公開サイトでは切り替えを出さない**（本番のビルドは常に日本語） | ユーザー決定 |
| 2026-10-29 | D254 | **公式英語の用語集を先に作り、Claude がそれに沿って訳す** | ユーザー決定 |
| 2026-10-29 | D255 | **D250 の形: 文を持つ各オブジェクトに `en?: { name, description, ... }` をまとめて足す**（日本語の欄は今のまま。表示の関数で選ぶ） | ユーザー決定（推奨案）。既存の処理・保存データ・バックアップがそのまま動き、移行が要らない |
| 2026-10-29 | D256 | **保存容量は、そのまま足す**（DB 約 340 万字の見積もり。重複の削減・IndexedDB への移行はしない） | ユーザー決定（推奨案）。Chrome・Firefox の上限 約 500 万字の 7 割。この埋め込みブラウザの上限は 2000 万字以上（実測） |
| 2026-10-29 | D257 | **DB 管理の編集は、表示中の言語の欄を編集する** | ユーザー決定（推奨案） |
| 2026-10-29 | D258 | **要約は英語で組み立て、根拠の引用（継続時間・CT の dataSource）も英語の説明文から探す**（見つからないときは日本語の原文） | ユーザー決定（推奨は「引用は原文のまま」） |
| 2026-10-29 | D259 | **状態・効果の名前は、日本語・英語ともゲーム内の公式の名前に合わせる**（日本語は genshin-db の日本語、英語は原神 Wiki の英語版で確認）。公式の名前が無いもの（イアンサの「速攻状態」= Quick Stormflight window など）はアプリの呼び名 | ユーザー決定。アプリ独自の表記（近接の構え・粛清など）が、ゲームの表記と違っていた |

## 作業ログ

| 日付 | 内容 |
|---|---|
| 2026-10-29 | 調査・選択肢の提示・ユーザーの決定（D243〜D254）。計画書を作成 |
| 2026-10-29 | 3-3 を実装（手で書いた名前・説明の英語。handwrittenEnglish.ts）。マスターを作り直し、en を除いて一致。英語の画面で、ゲームデータの日本語は開発者向けのフレームの出典と略号 1 件だけ。検査はすべて合格（hitlag・sacrificial-seed も実行） |
| 2026-10-29 | 3-1 の表示の置き換えと 3-2 の武器・聖遺物を実装。英語の画面で、残る日本語はアプリ独自の名前（モード・手で書いた発動バフ名）だけ（同梱のマスターで確認）。検査はすべて合格 |
| 2026-10-29 | 3-1（型・表示の関数）と 3-2（キャラの英語）を実装。キャラのマスターを作り直し、en を除いて一致を確認 |
| 2026-10-29 | フェーズ 3 を開始。容量を実測（日本語の文 69 万字・うち重複 37 万字。DB 174 万字）。D255〜D258 を決定 |
| 2026-10-29 | フェーズ 2 の実装を完了（GanttChart・StintSequenceEditor・DatabaseManagerModal・src/utils の文言・日付）。名前空間は 12。既存の検査（backup・groups・rotation-validation・fetch-util・version-notice・effects・cooldown-log・go-expr・action-links・wasm-source）は合格。hitlag・sacrificial-seed は gcsim サーバーが止まっていて未実行 |
| 2026-10-29 | フェーズ 2 を開始。ヘッダー・小さい部品・ダイアログ・App.tsx を言語ファイルへ移し英訳（名前空間 10）。既存の検査（backup・groups・rotation-validation・fetch-util・version-notice・effects）はすべて合格 |
| 2026-10-29 | フェーズ 1 を実装。i18next の型の宣言は strictNullChecks が前提で使えないため、キーの型を自前で作る形に変更（plan.md 4.1.1） |
