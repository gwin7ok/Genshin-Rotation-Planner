# Google ドライブ連携の設定手順（サイトの運営者が 1 回だけ）

「編成付き読込 URL を作ってコピー」ボタンを使えるようにするための設定。**利用者（一般のユーザー）には、何の設定も要らない**。利用者は、ボタンを押して Google にログインするだけで、その人自身の Google ドライブに「Genshin Rotation Planner」フォルダができ、編成の JSON が保存される（リンクを知っている全員が閲覧可）。

設定が要るのは、アプリが Google に「自分はこのアプリです」と名乗るための 2 つの値（どちらも公開される値で、秘密ではない）。

## 1. Google Cloud でプロジェクトを作る
1. https://console.cloud.google.com/ を開き、Google アカウントでログインする。
2. 上のプロジェクト選択 →「新しいプロジェクト」→ 名前（例: Genshin Rotation Planner）→ 作成。
3. 「API とサービス」→「ライブラリ」→ **Google Drive API** を検索して「有効にする」。

## 2. OAuth の同意画面
1.「API とサービス」→「OAuth 同意画面」（または Google Auth Platform）。
2. ユーザーの種類 = 外部。アプリ名・サポートメール・連絡先メールを入れる。
3. スコープに `.../auth/drive.file` を追加する（機密でないスコープ。審査は要らない）。
4. 公開ステータスを「本番環境」にする（「テスト」のままだと、登録したテストユーザーしかログインできない）。

## 3. OAuth クライアント ID（`VITE_GOOGLE_CLIENT_ID`）
1.「認証情報」→「認証情報を作成」→「OAuth クライアント ID」→ 種類 = **ウェブ アプリケーション**。
2.「承認済みの JavaScript 生成元」に、公開サイトの origin（例: `https://<ユーザー名>.github.io`。パスは付けない）と、開発用の `http://localhost:3000` を入れる。
3. 作成後に表示される「クライアント ID」（`…apps.googleusercontent.com`）を控える。

## 4. API キー（`VITE_GOOGLE_API_KEY`）
1.「認証情報を作成」→「API キー」。
2. 作成したキーを開き、「API の制限」= **Google Drive API のみ**、「アプリケーションの制限」= HTTP リファラー（公開サイトの `https://<ユーザー名>.github.io/*` と `http://localhost:3000/*`）。
3. キーの文字列を控える。

## 5. 値を渡す
- **公開サイト**: GitHub のリポジトリ → Settings → Secrets and variables → Actions → **Variables** に、`VITE_GOOGLE_CLIENT_ID` と `VITE_GOOGLE_API_KEY` を登録する（`deploy.yml` がビルドに渡す）。
- **開発中**: リポジトリ直下に `.env.local`（Git に入らない）を作り、次の 2 行を書いて、開発サーバーを再起動する。
```
VITE_GOOGLE_CLIENT_ID=<クライアント ID>
VITE_GOOGLE_API_KEY=<API キー>
```

## 動作確認
編成管理 →「JSON バックアップ・共有」→「編成付き読込 URL を作ってコピー」→ Google ログイン → 名前を入力 → URL がコピーされる。別のブラウザ（未ログイン）でその URL を開き、確認ダイアログのあとに編成が読み込まれれば成功。

## 補足
- 同意画面に出るのは「このアプリが作成したファイルの表示・管理」だけ（利用者のドライブの他のファイルには触れない）。
- Google にログインするためのスクリプト（accounts.google.com）は、ボタンを押したときだけ読み込む。
