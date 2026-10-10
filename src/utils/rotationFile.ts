/**
 * ローテーションの JSON ファイルの名前と、読み込んだときの編成名（issue #23）。
 * ファイル名: アプリ名 + 日時 + 編成名（保存編成の名前。無ければ、パーティメンバーの名前を「・」でつないだもの）
 */
export const APP_FILE_PREFIX = '原神ローテーションプランナー';

const pad = (n: number) => String(n).padStart(2, '0');

/** 例: 20261010-153045 */
export function fileTimestamp(d: Date = new Date()): string {
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

/** ファイル名に使えない文字を除く */
const sanitize = (s: string) => s.replace(/[\/:*?"<>|]/g, '').replace(/\s+/g, '_').trim();

/** 編成名（保存編成の名前。無ければ、パーティメンバーの名前をつないだもの。空枠は除く） */
export function rotationDisplayName(slotName: string | undefined, memberNames: string[]): string {
  const trimmed = slotName?.trim();
  if (trimmed) return trimmed;
  const members = memberNames.filter(Boolean);
  return members.length > 0 ? members.join('・') : '原神ローテーション';
}

export function rotationFileName(name: string, date: Date = new Date()): string {
  return `${APP_FILE_PREFIX}_${fileTimestamp(date)}_${sanitize(name) || 'rotation'}.json`;
}

/** ファイル名から、編成名を推定する（`<アプリ名>_<日時>_<編成名>.json` の形のとき。それ以外は、拡張子を除いた名前） */
export function nameFromFileName(fileName: string): string {
  const base = fileName.replace(/\.json$/i, '');
  const m = base.match(new RegExp(`^${APP_FILE_PREFIX}_\d{8}-\d{6}_(.+)$`));
  return (m ? m[1] : base).replace(/_/g, ' ');
}
