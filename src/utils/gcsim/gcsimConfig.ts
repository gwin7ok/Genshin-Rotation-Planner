/**
 * このアプリが依存する gcsim のバージョン設定（リポジトリ直下の gcsim.config.json）
 *
 * アプリ・ビルドスクリプト・サーバーの起動が、同じ設定を見る。バージョンの更新手順は docs/gcsim-サーバー更新手順.md。
 */
import raw from '../../../gcsim.config.json' with { type: 'json' };

export interface GcsimAsset {
  name: string;
  url: string;
  sha256: string;
  size: number;
}

export interface GcsimConfig {
  repo: string;
  /** リリースのタグ（例: v2.48.0） */
  version: string;
  /** そのリリースのコミット。辞書・マスターの取得元はこのコミットに固定する */
  commit: string;
  releasedAt: string;
  license: string;
  server: { host: string; port: number };
  /** キー: `<process.platform>-<process.arch>`（例: win32-x64） */
  assets: Record<string, GcsimAsset>;
}

export const GCSIM_CONFIG = raw as unknown as GcsimConfig;
export const GCSIM_REPO = GCSIM_CONFIG.repo;
export const GCSIM_VERSION = GCSIM_CONFIG.version;
export const GCSIM_COMMIT = GCSIM_CONFIG.commit;
export const GCSIM_SERVER_URL = `http://${GCSIM_CONFIG.server.host}:${GCSIM_CONFIG.server.port}`;
