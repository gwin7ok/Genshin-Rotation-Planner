import { t } from '../../i18n';
import type { IgnoredItem } from './parseGcsimConfig.ts';

/** 一覧に出す最大件数（多いときは「ほか N 件」にまとめる） */
const MAX_LISTED = 15;

/** 読み飛ばした行の一覧を、画面に出す文にする（D326） */
export function describeIgnored(ignored: IgnoredItem[]): string {
  const shown = ignored.slice(0, MAX_LISTED).map(i => {
    const reason = t(`save:gcsimImport.reason.${i.reason}`);
    return i.line > 0
      ? t('save:gcsimImport.ignoredLine', { line: i.line, text: i.text, reason })
      : t('save:gcsimImport.ignoredLineNoNumber', { text: i.text, reason });
  });
  const lines = [t('save:gcsimImport.ignoredIntro', { count: ignored.length }), ...shown];
  if (ignored.length > MAX_LISTED) lines.push(t('save:gcsimImport.ignoredMore', { count: ignored.length - MAX_LISTED }));
  return lines.join('\n');
}
