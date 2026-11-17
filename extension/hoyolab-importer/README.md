# HoYoLAB 取り込み（Chrome 拡張機能・試作）

Genshin Rotation Planner に、HoYoLAB の持ちキャラのデータを渡す拡張機能。Cookie の値は読まない・保存しない・送らない。
通信先は `sg-public-api.hoyolab.com`（ご自身の UID）と `enka.network`（他のアカウントの UID、および自分の UID の更新の上書き〔アプリの取り込み画面のチェックで、切れる〕。ゲーム内の「キャラクター詳細表示」に並べたキャラだけ）のみ。Enka.Network は、HoYoLAB とは別の、非公式のサービス。計画: [docs/hoyolab-import/plan.md](../../docs/hoyolab-import/plan.md)

## 導入（手動）
1. Chrome で `chrome://extensions` を開き、右上の「デベロッパー モード」をオンにする。
2. 「パッケージ化されていない拡張機能を読み込む」で、この `hoyolab-importer` フォルダ（リリースの zip を展開したフォルダ）を選ぶ。
3. HoYoLAB（https://www.hoyolab.com/）にログインした状態にしておく。

## 動作確認
拡張機能のアイコン → UID を入力 → 「取得して保存」で、`hoyolab-raw-extension.json` がダウンロードされる。
