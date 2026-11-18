/**
 * このアプリが依存する gcsim のバージョン設定（リポジトリ直下の gcsim.config.json）
 *
 * アプリ・ビルドスクリプトが、同じ設定を見る。バージョンの更新手順は docs/gcsim-サーバー更新手順.md。
 */
import raw from '../../../gcsim.config.json' with { type: 'json' };

export interface GcsimConfig {
  repo: string;
  /** リリースのタグ（例: v2.48.0） */
  version: string;
  /** そのリリースのコミット。辞書・マスターの取得元はこのコミットに固定する */
  commit: string;
  releasedAt: string;
  license: string;
  /** 配布している gcsim の WebAssembly 版のソースの入手先（自分の GitHub のフォーク。配布版のコミットに、`<tagPrefix><version>` のタグを付ける） */
  sourceMirror?: { url: string; tagPrefix: string };
}

export const GCSIM_CONFIG = raw as unknown as GcsimConfig;
export const GCSIM_REPO = GCSIM_CONFIG.repo;
export const GCSIM_VERSION = GCSIM_CONFIG.version;
export const GCSIM_COMMIT = GCSIM_CONFIG.commit;
