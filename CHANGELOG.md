# 変更履歴

このアプリの、利用者に見える変更を記録します。形式は [Keep a Changelog](https://keepachangelog.com/ja/1.1.0/) に準じ、
版の付け方は [セマンティックバージョニング](https://semver.org/lang/ja/)（主.副.修正）です。
リリースの手順は `docs/リリース手順.md` を参照してください。

## [Unreleased]

## [1.0.0] - 2026-10-12

最初の公開版（GitHub Pages: https://gwin7ok.github.io/Genshin-Rotation-Planner/ ）。

### 追加
- 出場ターンを数珠つなぎに並べて、スキル・爆発の CT とバフの重複を、ガントチャートで確認できる戦闘ローテーションの設計ツール。
- 状態の維持（スキル・爆発の効果時間）、複数回分のスキル（CT・使用可能回数）、命ノ星座・武器・聖遺物の効果を考慮した計算。
- gcsim による計算結果の反映（所要時間・CT・効果時間・発動バフ）。**gcsim は、ブラウザの中（WebAssembly）で動く**。サーバーへの送信はない。
- 編成の保存（スロット）・JSON の書き出し／読み込み・**全データのバックアップ**（保存編成・設定・作成したデータを 1 つのファイルに）。
- アクションのグループ化（回数つきの繰り返し）、KQM 形式の記法（略号／名称）のコピー。
- 画面の下部に、バージョン・ライセンス（AGPL-3.0-or-later）・ソースの入手先を表示。

### 変更
- 保存・設定の読み書きを 1 か所（`persistence.ts`）に集約（保存データの形式は変更なし）。

[Unreleased]: https://github.com/gwin7ok/Genshin-Rotation-Planner/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/gwin7ok/Genshin-Rotation-Planner/releases/tag/v1.0.0
