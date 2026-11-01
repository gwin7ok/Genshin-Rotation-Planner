# プライバシーポリシー / Privacy Policy

最終更新: 2026-11-01 / Last updated: 2026-11-01

[日本語](#日本語) ｜ [English](#english)

---

## 日本語

「Genshin Rotation Planner」（以下「本アプリ」。公開サイト: https://gwin7ok.github.io/Genshin-Rotation-Planner/ ）は、原神のローテーション（行動の順序と時間）を計画するための、個人が運営する非公式のウェブアプリです。本アプリは、利用者の個人情報を運営者のサーバーに集めません（運営者は、利用者のデータを保存するサーバーを持っていません）。

### 1. 利用者の端末（ブラウザ）に保存されるデータ
編成・設定・キャラや武器のデータなどは、利用者のブラウザの `localStorage` に保存されます。これらは、利用者の端末の中にだけあり、運営者には送られません。ブラウザのデータを消すと、これらも消えます（「編成管理」の「全データを書き出す」で、バックアップできます）。

### 2. Google ドライブとの連携（任意）
「編成付き読込 URL を作ってコピー」を使うときだけ、Google アカウントでログインします。使わなければ、Google とは通信しません。

- **アクセスする範囲**: Google ドライブの権限は `drive.file`（本アプリが作成したファイル・フォルダにだけアクセスできる権限）だけです。利用者のドライブの、他のファイルは、見ることも変更することもできません。
- **作られるもの**: 利用者のドライブに、「Genshin Rotation Planner」フォルダを作り、利用者が指定した名前で、編成の JSON ファイルを保存します。
- **共有設定**: 保存したファイルは、「リンクを知っている全員が閲覧可」に設定されます（編成の内容が、リンクを知る人に公開されます）。公開をやめるときは、Google ドライブで、そのファイルの共有を解除するか、削除してください。
- **ログイン情報**: アクセストークンは、ブラウザのメモリにだけ置かれ、保存されません（ページを閉じると消えます）。ログインのメールアドレスや氏名は、本アプリは取得・保存しません。
- **運営者への送信**: ファイルの内容やログイン情報は、運営者のサーバーには送られません（通信は、利用者のブラウザと Google の間だけです）。
- **取り消し**: Google アカウントの「サードパーティによるアクセス」（https://myaccount.google.com/permissions ）から、本アプリへの許可を、いつでも取り消せます。

Google API サービスから受け取った情報の、本アプリでの使用と他のアプリへの転送は、[Google API サービスのユーザーデータに関するポリシー](https://developers.google.com/terms/api-services-user-data-policy)（制限付き使用の要件を含む）に準拠します。

### 3. 「?import=」でリンクから読み込む機能
URL の `import` 引数に指定されたリンクから、編成を読み込むことがあります。読み込む前に、必ず確認画面を出し、利用者が承認したときだけ、リンク先（外部のサイト）に通信します。リンク先に送られるのは、通常のウェブの取得リクエスト（利用者の IP アドレスなど）だけで、本アプリのデータは送りません。

### 4. アクセス解析
公開サイトでは、アクセス数の集計に、Cloudflare Web Analytics を使っています。Cookie は使いません。送られるのは、ページの URL・ブラウザの種類などの、アクセス情報だけで、編成や設定のデータは送りません。

### 5. 第三者への提供・広告
利用者の情報を、第三者に提供・販売することはありません。広告も表示しません。

### 6. 変更
この方針を変更するときは、このページを更新し、「最終更新」の日付を変えます。

### 7. 連絡先
質問・削除の依頼などは、GitHub の Issues（https://github.com/gwin7ok/Genshin-Rotation-Planner/issues ）、または、Google Cloud の同意画面に登録されている連絡先メールへ、連絡してください。

本アプリは、miHoYo / HoYoverse とは無関係の、非公式のツールです。

---

## English

"Genshin Rotation Planner" (the "App"; public site: https://gwin7ok.github.io/Genshin-Rotation-Planner/ ) is an unofficial web app, run by an individual, for planning Genshin Impact rotations (the order and timing of actions). The App does not collect your personal information on any server of the operator (the operator runs no server that stores your data).

### 1. Data stored in your browser
Rotations, settings, and character/weapon data are stored in your browser's `localStorage`. They stay on your device and are not sent to the operator. Clearing your browser data deletes them (use "Export all data" in Rotations to back them up).

### 2. Google Drive integration (optional)
You sign in with a Google account only when you use "Create import URL and copy". If you do not use it, the App does not communicate with Google.

- **Access scope**: The only Drive permission is `drive.file` (access only to files and folders created by this App). The App cannot see or change any other file in your Drive.
- **What is created**: A "Genshin Rotation Planner" folder in your Drive, containing the rotation JSON file under the name you choose.
- **Sharing**: The saved file is set to "anyone with the link can view" (the rotation becomes visible to anyone who has the link). To stop sharing, remove the sharing or delete the file in Google Drive.
- **Sign-in data**: The access token is kept only in browser memory and is never stored (it disappears when you close the page). The App does not obtain or store your email address or name.
- **Sent to the operator**: File contents and sign-in data are not sent to the operator's servers; communication is only between your browser and Google.
- **Revoking**: You can revoke the App's access at any time at https://myaccount.google.com/permissions .

The App's use and transfer to any other app of information received from Google APIs will adhere to the [Google API Services User Data Policy](https://developers.google.com/terms/api-services-user-data-policy), including the Limited Use requirements.

### 3. Loading from a link ("?import=")
The App may load a rotation from a link given in the URL's `import` parameter. It always shows a confirmation first, and contacts the linked (external) site only if you approve. Only an ordinary web request (e.g., your IP address) is sent to that site; no App data is sent.

### 4. Analytics
The public site uses Cloudflare Web Analytics to count visits. It uses no cookies. Only access information such as the page URL and browser type is sent; rotation and settings data are not.

### 5. Third parties and ads
Your information is not provided or sold to third parties. The App shows no ads.

### 6. Changes
If this policy changes, this page will be updated and the "Last updated" date changed.

### 7. Contact
For questions or deletion requests, use GitHub Issues (https://github.com/gwin7ok/Genshin-Rotation-Planner/issues ) or the contact email registered on the Google Cloud consent screen.

This App is an unofficial tool and is not affiliated with miHoYo / HoYoverse.
