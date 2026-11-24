---
name: ui-i18n-and-docs
description: UI実装・i18n翻訳（Transタグ・用語ルール）・HoYoLAB記事リンク・ブラウザ症状・バージョン管理とリリース手順を扱うときに参照する
---

# UI・i18n・運用トラブル・リリーススキル

## 1. i18n・用語・リンクの注意点
- **react-i18next `<Trans>` のタグ名禁止リスト**: 翻訳文（locales JSON）に `<link>`, `<br>`, `<img>`, `<input>` など **HTML の空要素（void element）と同じタグ名を使わない**。中のテキストが `<a>` 要素の外に出てクリック不能になるため、`articleLink`, `appLink`, `gcsimLink` のような名前を使い、確認時は見た目だけでなく `a.textContent` が空でないことまで検証する。
- **CT 用語の統一**: スキルの複数回分の説明では「チャージ」を使わない（元素チャージ効率と紛らわしいため）。必ず「**CT**」「**クールタイム**」「**使用可能回数（ストック）**」と書く（※コード内の識別子 `charges` は変更不要）。
- **HoYoLAB 記事リンク管理**:
  - URL は `src/utils/articleLinks.ts` の `ARTICLE_URLS`（kind × 言語）に集約。
  - 日本語記事（2026-11-18 投稿）: アプリ紹介 `47486641`、持ちキャラ取り込み `47486618`。
  - 英語記事が公開されたら、`ARTICLE_URLS` の `en` を差し替え、locales/en（`party:importArticleNote`, `notice:source.article`, `guide:articleLink`）から「in Japanese」の注記を外す。

## 2. 既知のブラウザ症状（コード調査前の切り分け）
- **「入力欄以外（文字やボタン）をクリックすると点滅カーソルが出る・ボタンが効かない」という報告**:
  - アプリのコードに `contenteditable` 等は存在しないため、まず **ユーザーの Chrome のキャレット移動モード（`F7` / 設定 → ユーザー補助 → テキストカーソルでページを移動）** が有効になっていないか確認してもらう。

## 3. バージョン管理・リリース手順
- **バージョンの正本**: `package.json` の `version`（SemVer）。詳細: `docs/リリース手順.md`。
- **変更履歴**: `CHANGELOG.md` の `[Unreleased]` に書く（空なら前回リリース以降のコミット 1 行目から自動生成）。
- **公開フロー**:
  - ユーザーが VS Code で `ctrl+shift+2`（`npm run release:bump`）→ `ctrl+shift+3`（`npm run release:tag`）を実行する。
  - タグ push → `release.yml` → `main` 上で `deploy.yml` 起動（`github-pages` 環境制約のためタグから直接 deploy しない）。
  - gcsim バージョン更新時は WASM 再ビルドとフォークのタグ（`app-wasm-<version>`）更新も必要。