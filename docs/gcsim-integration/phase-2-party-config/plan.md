# フェーズ2 計画: 編成設定の参照をID化・4セット/2+2の選択

関連決定: D5（4セット / 2+2 の選択）、D9（武器・聖遺物の参照を表示名から ID に変更）
前提フェーズ: フェーズ1

## 目的

- 編成のキャラが装備している武器・聖遺物を **ID で参照**し、gcsim キー（フェーズ1）を確実に引けるようにする。
- 聖遺物を「4セット」か「2+2（聖遺物バフなし）」から選べるようにする。

## 現状

- `CharacterConfig`（`src/types/genshin.ts`）は `weaponName` / `artifactSetName`（日本語の表示名の文字列）で装備を持つ。
- 参照箇所:
  - `src/components/PartyConfigModal.tsx`: 選択UI。DB に無い名前は「(カスタム入力)」として表示。
  - `src/utils/buffUtils.ts`: 名前で DB の武器・聖遺物を探して発動バフを作る。
  - `src/utils/stintReorder.ts`: キャラ入れ替え時に装備を引き継ぐ。
  - `src/data/characters.ts`: 初期値（例: `artifactSetName: '絶縁の旗印 4セット'` のように DB の名前と一致しない文字列がある）。
- 聖遺物は4セット前提で、2+2 を表す手段がない。

## 作業内容

1. `CharacterConfig` に次を追加する。
   - `weaponId?: string`（武器の公式ID）
   - `artifactSetId?: string`（聖遺物セットの公式ID）
   - `artifactSetMode?: '4pc' | '2+2'`（未指定は `'4pc'`）
2. 保存データの移行（読み込み時）: `weaponName` / `artifactSetName` から DB を名前で引いて ID を埋める。
   - 既存の移行処理（`src/utils/legacyMigration.ts` の `migrateLegacyCharacter` / `migrateCharacterIds`、`src/utils/storage.ts` の読み込み）と同じ仕組みに組み込む。
   - 名前が DB と一致しない（カスタム入力・「〜 4セット」付きなど）場合の扱いを決める（下の検討事項）。
3. 編成設定UI（`PartyConfigModal.tsx`）を ID で選ぶ形にする。表示は今と同じ日本語名。
4. 「4セット / 2+2」の選択UIを追加する。
5. 発動バフの生成（`buffUtils.ts`）を ID 参照に変える。`2+2` のときは聖遺物の発動バフを作らない。
6. `weaponName` / `artifactSetName` を残すか削除するかを決める（表示名は DB から引けるため、ID 化後は不要になる見込み）。

## 検討事項（作業時に決める）

- DB の名前と一致しない既存データ: 近い名前（「4セット」などの接尾辞を除いたもの）で再照合するか、未設定扱いにするか。
- カスタム武器・聖遺物（DB管理で作成したもの）は ID を持つので ID 参照できる。gcsim キーは無いので gcsim 未対応扱い。

## 完了条件

- 保存済みの編成を読み込むと、装備が ID で参照され、表示・発動バフが従来と同じになる。
- 「2+2」を選ぶと聖遺物の発動バフのバーが出ない。
- 型チェック・ビルドが通り、ブラウザで編成設定・ガントチャートの動作を確認済み。

## 影響範囲

- 編成設定画面、保存データ（読み込み時に自動移行）、発動バフの生成。
