/**
 * アクセス数の集計（Cloudflare Web Analytics。D209）。
 *
 * 公開サイト（本番ビルド・localhost 以外）でだけ、Cloudflare のビーコン（スクリプト）を読み込む。
 * Cookie は使わない。送られるのは、ページの URL・ブラウザの種類などのアクセス情報だけで、編成・設定などのデータは送らない。
 *
 * 使うには、Cloudflare の Web Analytics でサイトを登録し、表示される「トークン」を、下の CLOUDFLARE_ANALYTICS_TOKEN に入れる
 * （トークンは、公開される値。秘密ではない）。空のままなら、何もしない（画面の説明も出さない）。
 */
export const CLOUDFLARE_ANALYTICS_TOKEN = '0e823541683e4704b582fac737968bd8';

const BEACON_URL = 'https://static.cloudflareinsights.com/beacon.min.js';

/** 集計を有効にしているか（画面の説明の表示に使う） */
export const ANALYTICS_ENABLED = CLOUDFLARE_ANALYTICS_TOKEN !== '';

function isLocalHost(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]' || hostname.endsWith('.localhost');
}

/** ビーコンを読み込む（本番ビルド・localhost 以外・トークンありのときだけ） */
export function initAnalytics(): void {
  if (!ANALYTICS_ENABLED || !import.meta.env.PROD) return;
  if (typeof document === 'undefined' || isLocalHost(window.location.hostname)) return;
  if (document.querySelector(`script[src="${BEACON_URL}"]`)) return;
  const s = document.createElement('script');
  s.defer = true;
  s.src = BEACON_URL;
  s.setAttribute('data-cf-beacon', JSON.stringify({ token: CLOUDFLARE_ANALYTICS_TOKEN }));
  document.head.appendChild(s);
}
