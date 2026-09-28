# フェーズ2 計画: IDキーの原則の徹底・プリセット削除・4セット/2+2の選択

関連決定: D5（4セット / 2+2 の選択）、D9（武器・聖遺物の参照を ID に）、D13（IDキーの原則）、D14（プリセット削除）
前提フェーズ: フェーズ1

## 目的

- **マスターデータと編成に使うデータを、名前ではなく必ず ID をキーにする**（D13）。gcsim キー（フェーズ1）を確実に引けるようにする。
- 混乱を招くプリセットを削除する（D14）。
- 聖遺物を「4セット」か「2+2（聖遺物バフなし）」から選べるようにする（D5）。

## 現状の調査結果（2026-09-28）

### 編成設定で作られるデータ

| 操作 | 保存される値 | 原則に合うか |
|---|---|---|
| キャラを選ぶ | DB のキャラをコピー。`id` は公式ID（例: `10000073-dendro`）。マスターのキャラは装備を持たないので武器・聖遺物は空欄 | ○ |
| 武器を選ぶ | リストの値が名前のため `weaponName: '千夜に浮かぶ夢'`（**表示名**）。精錬ランクは `weaponRefinementRank` | × |
| 聖遺物を選ぶ | `artifactSetName: '深林の記憶'`（**表示名**） | × |
| 使うとき | 武器は `WeaponModel.findInDatabase`（名前・ID・英語名のどれかで一致）、聖遺物は `buffUtils.ts` で名前一致 | × |

- 名前の重複: 「一心伝」名刀は別の武器3つ（ID 11419 / 11420 / 11421）が同じ名前。名前参照では区別できない。
- 名前が変わる（DB管理での編集・同期での翻訳更新）と、保存済みの編成の装備が警告なく外れる。

### 名前をキーにしているその他の箇所

- **バフの補正辞書**（`src/masterdata/equipmentBuffOverrides.ts` の `WEAPON_BUFF_OVERRIDES` / `ARTIFACT_BUFF_OVERRIDES`）: 見出しが日本語名・英語名（一部ID）。生成時（`equipmentBuffParser.ts`）と実行時（`buffUtils.ts`）の両方で名前で引いている。
- **プリセット**（`src/data/presets.ts`）とプリセット専用の手作業のキャラ定義（`src/data/characters.ts` の `RAW_CURATED_ROSTER` → `ALL_CHARACTERS_ROSTER`）: 英語名由来の旧キー（`'raiden'` など）で書かれ、装備も「千夜に浮かぶ夢 / 祭礼の断片」「深林の記憶 4セット」のような DB と一致しないメモ。
- **旧キーの移行処理**: `resolveLegacyCharacterId`（英語名由来のキー → 公式ID）、`migrateCharacterIds`（`src/utils/legacyMigration.ts`）。保存データの読み込み（`storage.ts`）・スロット読込・JSON インポート（`App.tsx`）で使用。

## 作業内容

### 2-1. 編成の装備を ID 参照にする

1. `CharacterConfig` の `weaponName` / `artifactSetName` を削除し、`weaponId` / `artifactSetId`（DB の公式ID）と `artifactSetMode?: '4pc' | '2+2'`（未指定は `'4pc'`）を追加する。
2. 編成設定UI（`PartyConfigModal.tsx`）の武器・聖遺物の選択を ID で行う（表示は今と同じ日本語名）。「(カスタム入力)」の選択肢は削除。
3. 「4セット / 2+2」の選択UIを追加する。
4. 発動バフの生成（`buffUtils.ts`）を ID 参照にする。`2+2` のときは聖遺物の発動バフを作らない。
5. `WeaponModel.findInDatabase` を ID だけで引く形にする。
6. キャラ入れ替え時の装備の引き継ぎ（`stintReorder.ts`）を ID に合わせる。
7. キャラ一覧の検索で装備名を検索していた箇所（`PartyConfigModal.tsx` の絞り込み）を合わせる。

### 2-2. バフの補正辞書を ID キーにする

1. `WEAPON_BUFF_OVERRIDES` / `ARTIFACT_BUFF_OVERRIDES` の見出しを公式IDに置き換える（日本語名・英語名の重複エントリは1つにまとめる）。置き換えはマスターデータの名前→ID 対応で機械的に行い、対応しない見出しは一覧にして確認する。
2. 生成時（`equipmentBuffParser.ts`）・実行時（`buffUtils.ts`）の参照を ID だけにする。
3. マスターデータを再生成し、補正の結果が変わっていないことを比較で確認する。

### 2-3. プリセットの削除（D14）

1. `src/data/presets.ts`、`PartyPreset` 型、プリセット専用の手作業のキャラ定義（`RAW_CURATED_ROSTER` / `ALL_CHARACTERS_ROSTER`）を削除する。
2. 初期状態（保存データが無いとき）と「初期状態に戻す」は、4枠とも未設定の編成・出場なしにする。
3. 保存・読込画面（`SaveLoadModal.tsx`）のプリセット選択と、`selectedPresetId` / `presetId`（状態・保存項目・JSON 書き出し）を削除する。

### 2-4. 名前ベースの旧キー移行処理の削除（D13）

1. `resolveLegacyCharacterId`・`migrateCharacterIds`・旧キーの対応表（英語名由来）を削除し、呼び出し箇所から外す。
2. 旧形式のデータ構造の変換（`migrateLegacyCharacter`: キャラ単位のCTなど）は名前ベースではないため、今回は残す（削除するかは別途判断）。

## 完了条件

- 編成設定で選んだ武器・聖遺物が ID で保存され、発動バフ・精錬の表示が従来どおり動く。「一心伝」名刀の3種類を区別できる。
- 「2+2」を選ぶと聖遺物の発動バフが出ない。
- 補正辞書が ID キーになり、再生成したマスターデータの補正結果が変わらない。
- プリセットが画面・コードから無くなり、初期状態が未設定の編成になる。
- 名前で登録・照合している箇所がコードに残っていない（生成スクリプトが外部データ〈genshin-db 等〉の突き合わせで名前を使う箇所を除く）。
- 型チェック・ビルドが通り、ブラウザで確認済み。

## 影響範囲

- 編成設定画面、保存・読込画面、発動バフの生成、マスターデータ生成、初期状態。
- 既存の保存データの互換性は保たない（D13: 保存データは作り直す）。
