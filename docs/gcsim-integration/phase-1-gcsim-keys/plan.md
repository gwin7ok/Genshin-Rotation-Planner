# フェーズ1 計画: 武器・聖遺物に gcsim キーを持たせる

関連決定: D8（キーは公式IDのまま、`gcsimKey` 属性を追加）

## 目的

gcsim の設定文を作るとき、武器・聖遺物の gcsim キー（例: `athousandfloatingdreams`, `deepwoodmemories`）を確実に引けるようにする。キャラは既に `source.gcsimKey` を持っているので、武器・聖遺物を同じ形にそろえる。

## 現状

- キャラ: `src/masterdata/characterMasterGenerator.ts` が gcsim の `ui/packages/ui/src/Data/character.dm.json` を取得し、公式IDで突き合わせて `source.gcsimKey` を設定している。旅人は公式IDが元素共通のため、突き合わせから除外し `aether<元素>` を設定している。
- 武器・聖遺物: `src/masterdata/equipmentMasterGenerator.ts`（`generateWeaponsMasterOnline` / `generateArtifactsMasterOnline` / `generateEquipmentMaster`）で genshin-db などから生成。gcsim キーは持っていない。
  - ID は公式ID（武器: 例 `15502`、聖遺物セット: 例 `15031`）。
  - 型: `src/types/database.ts` の `WeaponDatabaseItem` / `ArtifactSetDatabaseItem`。
- 生成・更新の経路は2つ:
  - ビルド時: `npm run build:equipment`（`scripts/build-equipment-master.ts`）→ `src/data/weapons_master_data.json` / `artifacts_master_data.json`
  - アプリ内: DB管理の同期（`src/utils/databaseService.ts` の `syncEquipmentMasterOnline`）→ 利用者の保存DB

## 対応付けの見込み（2026-09-28 時点）

- 武器 245件中 234件、聖遺物 63件中 55件が公式IDで対応付けできる。
- 対応付けできないもの（gcsim 未実装）は [全体計画 3.3](../plan.md#33-対象キャラの対応状況) を参照。これらは `gcsimKey` を持たない（= gcsim 未対応として扱う）。

## 作業内容

1. 型に `gcsimKey?: string` を追加する（`WeaponDatabaseItem`, `ArtifactSetDatabaseItem`）。
2. `equipmentMasterGenerator.ts` で gcsim の `weapon.dm.json` / `artifact.dm.json` を取得し、公式IDで突き合わせて `gcsimKey` を設定する。取得方法はキャラ生成（`GCSIM_CHAR_DM_PATH` の扱い）にそろえる。
3. 生成レポートに「gcsim 未対応の武器・聖遺物」の一覧を出す。
4. `src/data/*_master_data.json` に `gcsimKey` を反映する。
   - 方針: 生成スクリプトを実行して再生成する。genshin-db 側の更新で他の項目も変わりうるので、差分を確認してから採用する。
5. DB管理の同期（`syncEquipmentMasterOnline`）で、利用者の保存DBにも `gcsimKey` が入ることを確認する（ロック中・カスタム品目の扱いは既存の同期ルールに従う）。
   - **（作業時に追加）** 既存の保存DBは DB バージョンが上がらない限りマスターに置き換わらない。バージョンを上げるとロックしていない品目への利用者の編集が上書きされるため、代わりに `databaseService.ts` の `fillGcsimKeys` で、gcsimKey の無い品目に公式IDでマスターの値を補う（読み込み時と全同期処理）。gcsimKey は識別情報なので、ロック中の品目にも補う。
6. DB管理画面で `gcsimKey` の有無が分かる表示を入れるかは、作業時に判断する（必須ではない）。
   - **（作業時に判断）** 今回は入れない。gcsim 未対応の検出・表示はフェーズ4（変換時の警告）で扱う。

## 完了条件

- マスターデータの武器・聖遺物に `gcsimKey` が入り、件数が見込み（234 / 55）と一致する。
- 型チェック・ビルドが通る。
- アプリの既存機能（編成設定・バフ表示）が変わらず動く。

## 影響範囲

- 既存機能への影響なし（属性の追加のみ）。
