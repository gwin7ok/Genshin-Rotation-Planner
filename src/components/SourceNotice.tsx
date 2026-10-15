import { GCSIM_CONFIG } from '../utils/gcsim/gcsimConfig.ts';
import { APP_VERSION, APP_COMMIT } from '../utils/appVersion';
import { ANALYTICS_ENABLED } from '../utils/analytics';

const APP_REPO_URL = 'https://github.com/gwin7ok/Genshin-Rotation-Planner';

/**
 * ライセンスとソースの入手先の表示（AGPL-3.0。画面の下部）。
 * 配っている gcsim の WebAssembly 版のソースは、gcsim.config.json の sourceMirror（自分の GitHub のフォーク）の、配布版のコミットのタグ。
 */
export function SourceNotice() {
  const { version, commit, sourceMirror } = GCSIM_CONFIG;
  const gcsimUrl = sourceMirror ? `${sourceMirror.url}/tree/${sourceMirror.tagPrefix}${version}` : `https://github.com/${GCSIM_CONFIG.repo}/tree/${commit}`;
  const linkClass = 'underline hover:text-slate-300';
  return (
    <div className="mt-1 space-y-0.5 text-[11px] text-slate-600">
      <p>
        非公式のファンツールです。ゲームの名称・画像などの権利は、各権利者（HoYoverse）に帰属します。無保証です。
      </p>
      <p>
        バージョン v{APP_VERSION}（コミット {APP_COMMIT}）・対応 gcsim {version}
      </p>
      <p>
        編成・ローテーションは、お使いのブラウザの中（localStorage）にだけ保存されます。編成のデータをサーバーに送ることはありません（gcsim も、ブラウザの中で動きます）。
        ブラウザのデータを消す・別のブラウザや端末に移すときは、「JSON 書き出し」で保存してください。
      </p>
      {ANALYTICS_ENABLED && (
        <p>
          アクセス数の集計に、Cloudflare Web Analytics（Cookie なし）を使っています。送られるのは、ページの URL・ブラウザの種類などのアクセス情報だけで、編成・設定のデータは送りません。
        </p>
      )}
      <p>
        このアプリは AGPL-3.0-or-later で公開しています（ソース:{' '}
        <a className={linkClass} href={APP_REPO_URL} target="_blank" rel="noreferrer">{APP_REPO_URL.replace('https://', '')}</a>）。
        計算に、gcsim {version}（AGPL-3.0。無改変）を使っています（ソース:{' '}
        <a className={linkClass} href={gcsimUrl} target="_blank" rel="noreferrer">{gcsimUrl.replace('https://', '')}</a>
        ・コミット {commit.slice(0, 8)}）。詳しくは、リポジトリの NOTICE と LICENSE を参照してください。
      </p>
    </div>
  );
}
