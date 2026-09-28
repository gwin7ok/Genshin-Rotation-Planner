# フェーズ1 進捗: 武器・聖遺物に gcsim キーを持たせる

状態: 未着手
開始日:
完了日:

## チェックリスト

- [ ] 型に `gcsimKey?: string` を追加（`WeaponDatabaseItem`, `ArtifactSetDatabaseItem`）
- [ ] `equipmentMasterGenerator.ts` で gcsim の `weapon.dm.json` / `artifact.dm.json` を取得し、公式IDで突き合わせ
- [ ] 生成レポートに gcsim 未対応の武器・聖遺物の一覧を出す
- [ ] マスターデータ JSON を再生成し、差分を確認して反映
- [ ] DB管理の同期で保存DBに `gcsimKey` が入ることを確認
- [ ] 型チェック・ビルド
- [ ] 既存機能の動作確認（編成設定・バフ表示）

## 確認結果

（完了時に記入: 対応付け件数、未対応一覧、動作確認の内容）

## 作業ログ

| 日付 | 内容 |
|---|---|
