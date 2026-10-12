/**
 * アプリの版（package.json の version）と、ビルドしたコミット。ビルド時に vite.config.ts が埋め込む（`define`）。
 * 開発サーバー・スクリプトから読むときは、埋め込まれていない場合があるので、既定値を返す。
 */
declare const __APP_VERSION__: string | undefined;
declare const __APP_COMMIT__: string | undefined;

export const APP_VERSION: string = typeof __APP_VERSION__ !== 'undefined' && __APP_VERSION__ ? __APP_VERSION__ : '0.0.0-dev';
export const APP_COMMIT: string = typeof __APP_COMMIT__ !== 'undefined' && __APP_COMMIT__ ? __APP_COMMIT__ : 'dev';
