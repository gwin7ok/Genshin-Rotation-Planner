/**
 * 言語ファイル（src/locales/<言語>/<名前空間>.json）の一覧。
 * 名前空間（画面・機能ごとのファイル。D244）を足したら、ja と en の両方をここに足す（`npm run check:i18n` が漏れを検査する）。
 * すべて同梱する（D251）。
 */
import jaCommon from '../locales/ja/common.json';
import enCommon from '../locales/en/common.json';
import jaApp from '../locales/ja/app.json';
import enApp from '../locales/en/app.json';
import jaChart from '../locales/ja/chart.json';
import enChart from '../locales/en/chart.json';
import jaDatabase from '../locales/ja/database.json';
import enDatabase from '../locales/en/database.json';
import jaGcsim from '../locales/ja/gcsim.json';
import enGcsim from '../locales/en/gcsim.json';
import jaGuide from '../locales/ja/guide.json';
import enGuide from '../locales/en/guide.json';
import jaHeader from '../locales/ja/header.json';
import enHeader from '../locales/en/header.json';
import jaNotice from '../locales/ja/notice.json';
import enNotice from '../locales/en/notice.json';
import jaParty from '../locales/ja/party.json';
import enParty from '../locales/en/party.json';
import jaSave from '../locales/ja/save.json';
import enSave from '../locales/en/save.json';

export const DEFAULT_NS = 'common';

export const resources = {
  ja: {
    common: jaCommon,
    app: jaApp,
    chart: jaChart,
    database: jaDatabase,
    gcsim: jaGcsim,
    guide: jaGuide,
    header: jaHeader,
    notice: jaNotice,
    party: jaParty,
    save: jaSave,
  },
  en: {
    common: enCommon,
    app: enApp,
    chart: enChart,
    database: enDatabase,
    gcsim: enGcsim,
    guide: enGuide,
    header: enHeader,
    notice: enNotice,
    party: enParty,
    save: enSave,
  },
} as const;
