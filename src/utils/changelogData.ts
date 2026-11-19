// 更新履歴（CHANGELOG.md）を、ビルドに同梱して読み込む（Vite の ?raw）。判定・読み取りは changelog.ts（Node のスクリプトでも使える）
import changelogText from '../../CHANGELOG.md?raw';
import { parseChangelog, type ChangelogEntry } from './changelog';

export const CHANGELOG: ChangelogEntry[] = parseChangelog(changelogText);
