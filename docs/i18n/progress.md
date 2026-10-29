# 多言語対応（日本語 / 英語） 進捗

## 現在の状態

フェーズ 5（公開）: 完了（本番のビルドでも言語の切り替えを出す）。公開サイトへの反映は、次のリリース（`release:bump` → `release:tag`）で行う

## フェーズ状態

| フェーズ | 状態 | 備考 |
|---|---|---|
| 1. 仕組み | 確認待ち | 下の「フェーズ 1 のチェックリスト」 |
| 2. 画面の文言 | 完了 | 下の「フェーズ 2 のチェックリスト」 |
| 3. ゲームデータ | 完了 | plan.md 4.3.1（DB の形）・4.3.2（段階）。下の「フェーズ 3 のチェックリスト」 |
| 4. 開発・検証用の表示 | 完了 | 下の「フェーズ 4 のチェックリスト」 |
| 5. 公開 | 完了 | 下の「フェーズ 5 のチェックリスト」。公開サイトへの反映は次のリリース |

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
  - 画面の確認（英語・同梱のマスター）: メイン画面・編成設定・DB 管理（キャラ・武器・聖遺物）で、画面の文字と title に日本語が残らないことを確認。残るもの: DB 管理のアクションの title のフレームの出典 `frames.source`（gcsim のソースの位置と補足。9 種。開発者向け → フェーズ 4）、略号 `hE(落下)`（1 件 → 3-5 で `rE↓` に変更。D260）。日本語の画面でコンソールのエラーなし
  - genshin-db の英語で確認した公式名: Oz・Lightning Stiletto・Musou Isshin・Ceremonial Garment・Shunsuiken・Sword Dance・Mortuary Rite・Night Vigil・Turbo Twirly・Nightsoul's Blessing・Nightsoul points・Dreamdrifter・Apex Drive・Seven-Phase Flash・Manifest Flame・Thunderous Symphony・Northland Spearstorm・Shadow Dance・Sturm und Drang・Masterstroke・Joy・Armed for Action・Sword Essence・Windborne Sword・Hunter's Precision・Adagio: Coda at Dawn's Tolling・Dandelion Breeze・Jade Screen・Scarlet Seal・Blood Blossom・Prayerful Wind's Benefit・Perfidious Wind's Bale・Redmane's Blood・Grin-Malkin Hat・Ranging Flame・Confirmation of Purity・Denial of Darkness・Principle of Purity: As the Light Shifts・Principle of Darkness: As the Stars Smolder・Dragon of White Flame・Dragon of Dark Decay
  - genshin-db で見つからなかったもの（→ 原神 Wiki で確認済み）: 近接の構え・庭火焔硝・怒目鬼王・風の加護・パンチ連打モード・潜水（加圧）・影狩り・瑞獣の舞・雲の変化・黄昏の祈り・燔天の時・羽月の輪・月相転移・月相の輝き・粛清・血の契約・標的の印・速攻状態・蒼白の賛歌・月の歌・雷鳴の交響・各「印」・猫玉・重力 など
- [x] 3-4 要約の英語の組み立てと、英語の説明文からの根拠の引用（D258）
  - 調べた結果: 要約（statEffectSummary）・根拠の引用（dataSource）は、今の画面のどこにも表示されていない（使うのは日本語の効果名の出典「（継続時間）」だけで、英語では出さない）。DB に入るデータとして整える
  - 要約の英語を、英語の説明文から別に抽出する方式から、**日本語の要約と同じ値を英語にする方式**に変えた（`generateStatSummaryEn(summaryJa, textEn)`）。前の方式は 292 件中 117 件が文の先頭を切っただけ、日本語と違う値のものもあった（例: 三日月の含光 ダメ+64% → Increases DEF by 20%）。いまは、決まった形（攻撃力 / 熟知 / 会心率 / 会心ダメ / ダメ / 耐性・西風・祭礼）は同じ値の英語、手で書いた要約（equipmentBuffOverrides.ts の 27 件）は handwrittenEnglish.ts の英語、日本語も文の先頭を切っているものだけ英語の説明文の先頭を切る（2128 件中 472 件）
  - 画面で発動バフを作るとき（buffUtils）、補正辞書の手で書いた要約を使う場合は、英語もその要約の英語にする
  - 根拠の引用: 武器・聖遺物は 3-2 で英語の説明文から探して `en.dataSource` に入れた（229 件中 213 件）。キャラの dataSource は画面に出ないため、英語にしない（D252 の「画面に出るもの」に当たらない。フェーズ 4 で開発用の表示に出すときに改めて決める）。`locDataSource()` は、表示する箇所ができたときに使う
  - build:equipment で作り直し、`en`（と生成日時）を除くと今の JSON と一致。検査はすべて合格
- [x] 3-5 名前で判定している処理の置き換え
  - チャートの [E] / [Q] の分類（`GanttChart.tsx` の `getBuffClassification`）: 名前（「スキル」「爆発」、英字の e / q を含むか）と、古い ID の語（guoba・pepper など）での判定をやめ、バーを作るときに付ける種類 `actionKind`（'skill' / 'burst'。`ActiveBuffSpan`）で判定する。付ける場所: スキル・爆発の効果バー（characterActions）、副次効果のバー（2 か所）、CT 短縮の領域、モードのバー（開く・続けて開く・開き直す）。名前の「e」で判定していた頃は、gcsim のキー（例: nilou-c2-hydro）を含む命ノ星座のバーなども [E] になっていた
  - 発動バフの名前に効果時間を足すか（`StintBuffTriggersSection` の `withDuration`）: 日本語の名前ではなく、表示する名前（`loc()`）に「N秒」「Ns」が含まれるかを見る
  - 受付の行（`windowBar`）: モードの説明文に「受付」を含むかで判定していた → モードの定義の `isWindow`（受付を作る 2 つの関数 `windowMode`・`specialWindowMode` が付ける）。マスターの差は `isWindow: true` の 15 か所だけ（説明文に「受付」を含む 15 か所と一致）。check:snapshots は差なし
  - 利用者の DB のマスターに `isWindow` が入るのは、3-7 で DATABASE_VERSION を上げたとき（未リリースのため、それまでの古い DB は考えない）
  - 調べて、そのままにしたもの: 処理が日本語の欄（モードの label = modeKeyOf・説明文の夜魂バーストの判定など）を見る箇所は、表示の言語に関係なく動く。略号 `hE(落下)`（1 件。イファの、夜魂の加護を落下で終えるアクション）は表示だけで、記法の処理では使っていない → `rE↓` に変更（D260）。ゲームでは E の再押しで終えるので、長押しの hE ではなく再発動の rE。名前も「元素スキル(再押し・落下)」（英語 Elemental Skill (press again, plunge)）。種類（skill_hold）と gcsim の命令（`skill[hold=1]`）は変えない。記法の名称表示は「再発動スキル↓」（`nameOfShort` が後ろの ↓ を残す）。マスターの差は文字列 3 か所だけ
- [x] 3-6 保存編成・プリセットの名前を、表示のときに DB から ID で引く
  - 方針: 保存データ（編成・保存編成・プリセット）の名前は、追加・保存したときの言語の文字列のまま変えない（照合・上書きの判定に使うため）。表示のときに、ID・キーで定義を引いて、表示の言語の名前にする
  - アクション名（`actionName`）・発動バフ名（`triggerName`）は 3-1・3-3 で対応済み
  - gcsim から書き戻した副次効果（アクションの `extraEffects`）・キャラクターに紐づく効果（出場ブロックの `extraEffects`）: 保存されている名前ではなく、キーで定義（アクションの gcsimExtras・`CHARACTER_LINKED_EFFECTS`）を引く（`extraEffectName()`）。日本語の画面でも、名前を公式に直した後（D259）は新しい名前が出る。バーの名前のキャラ名も `charName` にした
  - キャラクターに紐づく効果の名前: 「星拡散反応の状態（光輝）」→ 公式の「輝映・星拡散」（英語 Radiance: Stellar Swirl。D259）。八重神子の「超電導・星電導反応の状態（天啓）」は公式の名前が無いので、そのまま（英語 Superconduct / Stellar-Conduct state (Revelation)）
  - gcsim の結果の反映の一覧（GcsimConfigDialog・反映後の詳細）: `computeGcsimApply` に編成のキャラを渡し、変更の一覧の名前（アクション・副次効果・発動バフ・キャラクターに紐づく効果）を表示の言語にする。反映する出場ブロックは変えない（一覧の名前だけ、写しを作って変える）
  - 保存編成の一覧（編成管理・ヘッダーの選択）: プリセットの名前のまま（「[プリセット]〜」）なら、英語のときは「[Preset] 英語の名前」（`slotDisplayName`）。説明は、プリセットの説明のまま、または保存したときに自動で付けた説明（編成のキャラ名を「・」でつないだもの）のままなら、いまの言語のキャラ名で作り直す（`slotDisplayDescription`）。ユーザーが付けた名前・説明はそのまま
  - プリセットの英語の名前: 激化刻晴 = Aggravate Keqing・ゴロゴロ蒸発フリーナ改 = Rolling Vaporize Furina (Revised)・サンドローネ星電導 = Sandrone Stellar-Conduct・雷電ナショナル = Raiden National・豊穣月開花 = Bountiful Lunar-Bloom
  - 画面の確認（英語・同梱のマスター）: 編成管理の一覧で、プリセットの名前・説明と、自動で付けた説明が英語になることを確認。ユーザーが付けた保存編成の名前（例: 「早柚・フリーナ・香菱・シトラリ (21.4s)」）は、保存したときの文字列のまま。検査はすべて合格
- [x] 3-7 `DATABASE_VERSION` を上げる（利用者の DB に `en` を入れる。更新の通知が出る）・保存容量の実測・`check:snapshots`
  - `DATABASE_VERSION` 79 → 80。読み込み時に、利用者の DB のマスター由来のデータが同梱の最新（`en`・`isWindow`・公式の名前つき）に置き換わる（作成・ロックした項目は残る。ロックした項目には `en` が入らず、日本語のまま表示）。更新の通知（79 → 80）が出る
  - 保存容量の実測: マスター 367 万字（キャラ 174 万・武器 182 万・聖遺物 11 万。うち英語 193 万字。D256 の見積もりは 340 万字）。この画面の localStorage の合計は、置き換え後 379 万字（DB 367 万・保存編成 12 万）。Chrome・Firefox の上限（約 500 万字）の約 75%
  - 画面で確認: 再読み込みで DB が 79 → 80 に置き換わり（134 キャラすべてに en、isWindow 15 か所）、保存に成功し、更新の通知が出る。英語の画面で、置き換え後の DB のまま（同梱のマスターではなく）、ゲームデータに日本語が残らないことを確認
  - 英語の言語ファイルの箇条書きの「・」（13 か所。更新の通知・確認の文など）を「• 」にした
  - 検査: check:snapshots を含め、すべて合格（gcsim を使う hitlag・sacrificial-seed も）

### フェーズ 3 へ持ち越すもの（フェーズ 2 で見つけたもの）

- 名前で判定している処理: `GanttChart.tsx` の `getBuffClassification`（`name.includes('スキル')` など）は、日本語のときだけ名前を見るようにした（英語の名前はほぼすべて 'e' を含むため）。ID・種類での判定に置き換える。`StintBuffTriggersSection` の `${duration}秒` も同様（英語は `s` も見る）。
- `src/masterdata/` の文（諭示の説明・`frameSource`・モードの名前・特殊爆発の受付の説明・ゲージの説明・状態バーの名前・発動バフの名前「〜 4セット」など）。
- `lastSyncedAt` は、生成したときの言語の文字列で保存する（言語を切り替えても前の言語のまま）。D250 の DB の形の変更と合わせて決める。
- そのままにしたもの: `PRESET_NAME_PREFIX`（「[プリセット]」。保存編成の名前の一部で、プリセットの判定に使う）・`APP_FILE_PREFIX`（書き出すファイル名）・名前の並びの区切り「・」（メモ欄・ファイル名）。→ `lastSyncedAt`・`APP_FILE_PREFIX`・区切りは 4-3・4-6 で対応

## フェーズ 4 のチェックリスト

調べ方: `src/utils`・`src/components` のコメント以外の文字列の日本語と、英語の画面（メイン画面・DB 管理）の文字・title を機械的に洗い出した。画面に出る開発・検証用の表示は、DB 管理（フレームの出典・同期の記録・生成の進捗・生成のレポート）と、gcsim の読み取り結果（辞書の名前）

- [x] 4-1 フレームの出典（`frames.source`。DB 管理のアクションの title）: gcsim のソースの位置はそのまま、日本語の補足（長押しの長さ・爆発の長さ・推定の注記 D160・ネフェルの入力のパンチなど 6 種）を、表示のときに英語に置き換える（`frameSourceEnglish`・`frameSourceText`）。マスターには持たない（決まった形の補足だけで、実行時に作る出典もあるため）。64 種すべてで日本語が残らないことを確認
- [x] 4-2 gcsim の辞書の英語の名前: 手で補う一覧に `nameEn` を足せるようにした（持ち主が無く、自動で組み立てられないもの）。元素共鳴（水・草 2 件）・月兆・満輝・星拡散の渦の 5 件。build:catalog で作り直し、差はこの 5 件だけ。名前も英語も無いもの（24 件。例: `blackcliff`・`favonius-cd`）は、これまでどおりキー名を表示
- [x] 4-3 同期の記録（DB 管理の「最終更新」）: これまでは同期したときの言語の文（`lastSyncedAt`）を保存して表示していた。文のキー・差し込む値・日時（ISO）を `lastSync` に保存し、表示のときに表示の言語で組み立てる（`lastSyncedText`）。`lastSyncedAt` は残す（`lastSync` が無い DB の表示）。JSON 取り込みでも `lastSync` を検査して読む。いまの DB は次に同期するまで前の文のまま（未リリースのため、移行はしない）
- [x] 4-4 マスターの生成の進捗（DB 管理の「生成中…」）: 生成の処理（Node のスクリプトでも動く）は、日本語の文ではなく段階の記号（`charFrames`・`weaponFetch` など 12 種）を返し、画面で `database:progress.<段階>` の文にする。スクリプトのログは記号のまま
- [x] 4-5 マスターの生成のレポート（オンライン生成の後の一覧）: キャラ名は DB から ID で引き（`reportCharName`）、理由・エラーの決まった文（gcsim 未実装・フレーム定義が無い・天賦データが無いなど 6 種）は表示のときに英語にする（`reportText`）。発動バフの例（武器・聖遺物）は、DB の項目と発動バフを名前で引いて、表示の言語の名前・要約にする（レポートに ID が無いため）
- [x] 4-6 フェーズ 2 で「そのままにした」もの: 名前を並べる区切りを、英語では「, 」にした（`joinList`。gcsim の結果の祭礼の使用者・効果の受け手・落下の警告・モードの維持の名前・読み込みの省略の一覧・保存編成の自動の名前と説明・プリセットの英語の説明）。書き出すファイル名の接頭辞を、英語では `GenshinRotationPlanner` にした（読み込みは両方の接頭辞を認める）
- [x] 画面の確認（英語）: メイン画面・DB 管理で、画面の文字と title・placeholder・aria-label に日本語が残らないことを確認（残るのは言語の切り替えの「日本語」だけ。同期の記録は、前の文のまま保存された DB なので日本語）。フレームの出典は 666 個の title で日本語なし。同期の記録・進捗・レポートの文・区切り・ファイル名は、関数を直接呼んで英語になることを確認。オンライン生成そのもの（API・gcsim のソースの取得）と、gcsim の実行の読み取り結果の画面は、今回は動かしていない
- [x] 検査: tsc・check:i18n・check:backup・check:rotation-validation・check:groups・check:effects・check:catalog・check:action-links・check:snapshots（143 並び）すべて合格
- [x] 4-7 画面に出ない検証データも両言語にする（ユーザー指示 2026-10-29「英語にもする」。D261）
  - 対象: 文書を書くスクリプト 6 本（`check:effectkeys`・`coverage:master-effects`・`coverage:links`・`build:catalog` の辞書の差分・`review:buff-scopes`・`review:effects`）と、網羅状況の JSON 2 本（`src/data/effect_key_coverage.json`・`master_effect_coverage.json`）
  - 文書: 日本語（`〜.md`）の横に英語（`〜.en.md`）を書く（6 本: effect-key-coverage・master-effect-coverage・key-link-coverage・catalog-diff・buff-scope-review・effect-key-review）。`verify:master-effects` は両方の文書を照合する
  - JSON: 日本語の欄（名前・キャラ名・ラベル・メモ）がある行に、英語の欄 `en` を足す（D255 と同じ形。日本語と同じなら付けない）。`en` を除くと、前の JSON と同じ（スキル・爆発側は、3-6 の「輝映・星拡散」の名前の変更が反映された 5 行だけ違う）
  - 英語の出どころ: 名前はマスター・辞書の英語の欄。手で書いた理由・メモは `src/masterdata/verificationEnglish.ts`（日本語の文 → 英語の辞書と、決まった形の文。例: 「〜のスキル: 瞬間の効果。…」）。アプリの文の辞書（handwrittenEnglish.ts）も引く。キャラクターに紐づく効果の名前は定義の `en` を使う
  - 辞書に無い文は、英語の文書でも日本語のまま出し、スクリプトの最後に「英語が無い文 N 件」と一覧を出す（新しい決定・メモを書いたら、ここに英語を足す）。いまは 0 件。英語の文書 6 本・JSON の `en` に日本語が残らないこと、日本語の欄にすべて `en` が付くことを確認
  - 作り直しで変わったもの: `effect-key-review.md` は 2026-09-30 の gcsim v2.47.6 の調査の記録だったが、いまの gcsim（v2.49.0）で作り直した（判定の内訳: 状態なし 100・シールド 6・要確認 5・未収集 3）。文書の gcsim の版は固定の文字から設定（`GCSIM_VERSION`）にした。`buff-scope-review.md` はマスターの更新で 2 行増えた
  - 対象外: スクリプトのコンソールの出力（日本語のまま）。gcsim の実行で集める中間データ（`action_effect_links_by_duration.json`・`skill_hit_frames.json` などのキャラ名）。キャラの根拠の引用 `dataSource`（画面にも文書にも出ない）
  - 検査: tsc・verify:effectkeys・verify:master-effects・check:action-links・check:i18n・check:snapshots・check:catalog すべて合格。`coverage:links` の「未検討 1 件」（イファの 10000113-anemo_e_cancelplunge）は前からのもの

## フェーズ 5 のチェックリスト

- [x] `check:i18n --strict`: 名前空間 12・キー 1144・未訳 0 件で合格
- [x] 本番でも切り替えを有効にした（D253 の条件を満たした）: `language.ts` の `ENABLED_IN_PRODUCTION` と `isLanguageSwitchEnabled` を消し、本番・開発とも、保存した設定 → ブラウザの言語の順で決める。ヘッダーの切り替え（自動 / 日本語 / English）は常に出す
- [x] CI（`ci.yml`）と公開の手順（`deploy.yml`。ビルドの前）に `npm run check:i18n -- --strict` を足した（未訳が残っていれば失敗し、公開しない）
- [x] `CHANGELOG.md` の `[Unreleased]` に「英語の表示に対応した」を書いた
- [x] 本番のビルドで確認（`vite preview`。ポート 4173 で一時的に起動し、確認後に止めた）: 切り替えが出る → English を押すと保存して再読み込みし、`html lang=en`・タイトルが英語。プリセット（Aggravate Keqing）を読み込み、チャート・ヘッダーの文字と title に日本語が残らない（残るのは切り替えの「日本語」だけ）。コンソールのエラーなし
- [x] 見つけて直したもの: ヘッダーの上書き保存ボタンの説明と、編成管理の「同じ名前の保存編成がある」の表示が、保存編成の名前を保存したときの文字列のまま出していた（例: `[プリセット]激化刻晴`）→ 表示用の名前（`slotDisplayName`）にした
- [x] 検査: tsc・lint・check:i18n --strict・check:backup・check:snapshots・check:release すべて合格
- 公開サイトへの反映: 次のリリース（VSCode の `ctrl+shift+2` → `ctrl+shift+3`。docs/リリース手順.md）。英語の表示は新しい機能なので、版は副番号を上げるのが目安（1.3.2 → 1.4.0）


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
| 2026-10-29 | D261 | **画面に出ない検証データも両言語にする。文書は `〜.md`（日本語）と `〜.en.md`（英語）を両方書き、網羅状況の JSON の行には英語の欄 `en` を足す**。手で書いた理由・メモの英語は `verificationEnglish.ts` にまとめ、無い文はスクリプトが一覧で知らせる | ユーザー決定（「英語にもする」）。ファイルの形（別ファイル・`en` の欄）は Claude が決めた（言語ファイルと同じく言語ごとに分ける。JSON は D255 と同じ形） |
| 2026-10-29 | D260 | **略号は言語に関係ない記号にする。イファの、夜魂の加護を落下で終えるアクションは `rE↓`**（前は `hE(落下)`） | ユーザー決定。ゲームでは E の再押しで終えるので、長押しの hE は操作と合わない（gcsim の `hold=1` は命令の指定）。再発動の rE + 落下の記号 |

## 作業ログ

| 日付 | 内容 |
|---|---|
| 2026-10-29 | 調査・選択肢の提示・ユーザーの決定（D243〜D254）。計画書を作成 |
| 2026-10-29 | フェーズ 5: 本番でも言語の切り替えを有効にし、CI・公開の手順に check:i18n --strict を足した。本番のビルドで確認。フェーズ 5 を完了 |
| 2026-10-29 | 4-7: 検証データの文書 6 本を両言語（.en.md）に、網羅状況の JSON に en を足した（D261）。フェーズ 4 を完了 |
| 2026-10-29 | フェーズ 4: フレームの出典・辞書の英語の名前 5 件・同期の記録・生成の進捗・生成のレポート・名前の区切り・ファイル名の接頭辞を英語に。画面に出ない検証データの扱いを確認待ち |
| 2026-10-29 | 3-7: DATABASE_VERSION を 80 に上げた。保存容量を実測（DB 367 万字・合計 379 万字）。フェーズ 3 を完了 |
| 2026-10-29 | 3-6: 保存データの名前を、表示のときに ID・キーで定義から引く（副次効果・キャラクターに紐づく効果・gcsim の反映の一覧・保存編成の一覧のプリセットと自動の説明）。略号 hE(落下) → rE↓（D260） |
| 2026-10-29 | 3-5: チャートの [E] / [Q] の分類をバーの種類（actionKind）で、受付の行をモードの isWindow で判定するように変更（名前・説明文での判定をやめた）。発動バフ名の効果時間の判定は表示する名前で見る |
| 2026-10-29 | 3-4: 装備の要約の英語を、日本語の要約と同じ値から作る方式に変更（手で書いた要約 27 件は辞書）。要約・根拠の引用は画面に出ていないことを確認。状態・効果の日本語の名前をゲームの公式に統一（D259） |
| 2026-10-29 | 3-3 を実装（手で書いた名前・説明の英語。handwrittenEnglish.ts）。マスターを作り直し、en を除いて一致。英語の画面で、ゲームデータの日本語は開発者向けのフレームの出典と略号 1 件だけ。検査はすべて合格（hitlag・sacrificial-seed も実行） |
| 2026-10-29 | 3-1 の表示の置き換えと 3-2 の武器・聖遺物を実装。英語の画面で、残る日本語はアプリ独自の名前（モード・手で書いた発動バフ名）だけ（同梱のマスターで確認）。検査はすべて合格 |
| 2026-10-29 | 3-1（型・表示の関数）と 3-2（キャラの英語）を実装。キャラのマスターを作り直し、en を除いて一致を確認 |
| 2026-10-29 | フェーズ 3 を開始。容量を実測（日本語の文 69 万字・うち重複 37 万字。DB 174 万字）。D255〜D258 を決定 |
| 2026-10-29 | フェーズ 2 の実装を完了（GanttChart・StintSequenceEditor・DatabaseManagerModal・src/utils の文言・日付）。名前空間は 12。既存の検査（backup・groups・rotation-validation・fetch-util・version-notice・effects・cooldown-log・go-expr・action-links・wasm-source）は合格。hitlag・sacrificial-seed は gcsim サーバーが止まっていて未実行 |
| 2026-10-29 | フェーズ 2 を開始。ヘッダー・小さい部品・ダイアログ・App.tsx を言語ファイルへ移し英訳（名前空間 10）。既存の検査（backup・groups・rotation-validation・fetch-util・version-notice・effects）はすべて合格 |
| 2026-10-29 | フェーズ 1 を実装。i18next の型の宣言は strictNullChecks が前提で使えないため、キーの型を自前で作る形に変更（plan.md 4.1.1） |
