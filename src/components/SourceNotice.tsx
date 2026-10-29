import { GCSIM_CONFIG } from '../utils/gcsim/gcsimConfig.ts';
import { APP_VERSION, APP_COMMIT } from '../utils/appVersion';
import { ANALYTICS_ENABLED } from '../utils/analytics';
import { Trans } from 'react-i18next';
import { t } from '../i18n';

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
        {t('notice:source.disclaimer')}
      </p>
      <p>
        {t('notice:source.version', { appVersion: APP_VERSION, appCommit: APP_COMMIT, gcsimVersion: version })}
      </p>
      <p>
        {t('notice:source.storage')}
      </p>
      {ANALYTICS_ENABLED && (
        <p>
          {t('notice:source.analytics')}
        </p>
      )}
      <p>
        <Trans
          i18nKey="notice:source.license"
          values={{ appRepo: APP_REPO_URL.replace('https://', ''), gcsimRepo: gcsimUrl.replace('https://', ''), gcsimVersion: version, commit: commit.slice(0, 8) }}
          components={{
            appLink: <a className={linkClass} href={APP_REPO_URL} target="_blank" rel="noreferrer" />,
            gcsimLink: <a className={linkClass} href={gcsimUrl} target="_blank" rel="noreferrer" />,
          }}
        />
      </p>
    </div>
  );
}
