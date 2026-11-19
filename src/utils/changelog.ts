/**
 * 更新履歴（CHANGELOG.md）の読み取りと、アプリの更新の通知の判定。
 *
 * アプリの版（package.json の version = ビルドに埋め込まれた APP_VERSION）が、利用者が最後に開いた版より新しければ、
 * 起動時に、その間の更新履歴を、ポップアップで出す。最後に開いた版は、この端末（localStorage）に記録する。
 *
 * 判定:
 *   - 記録がある: 今の版が、記録より新しい → 通知する（記録の版より新しく、今の版以下の節を出す）
 *   - 記録がない かつ 保存データがある（この機能の導入前から使っている利用者）: 通知する（前の版が不明なので、今の版以下の全ての節を出す）
 *   - 記録がない かつ 保存データもない（初めての利用者）→ 通知しない（記録だけする）
 *   - 今の版が記録と同じ・古い → 通知しない（古い版を開いたときに、記録は進めない）
 *   - 開発中の版（0.0.0-dev）→ 通知しない・記録しない
 */
import { DEVICE_KEYS, STORAGE_KEYS, readString, writeString } from './persistence';

export interface ChangelogSection {
  /** 種類（追加・変更・修正など） */
  title: string;
  items: string[];
}

export interface ChangelogEntry {
  version: string;
  /** YYYY-MM-DD（無ければ空） */
  date: string;
  sections: ChangelogSection[];
}

const VERSION_RE = /^(\d+)\.(\d+)\.(\d+)$/;

/** 版（主.副.修正）を数の組にする。読めなければ null */
export function parseVersion(v: string | null | undefined): [number, number, number] | null {
  if (!v) return null;
  const m = VERSION_RE.exec(v.trim());
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

/** 版の比較（a が新しければ正）。読めない版は、最も古い扱い */
export function compareVersions(a: string | null | undefined, b: string | null | undefined): number {
  const pa = parseVersion(a);
  const pb = parseVersion(b);
  if (!pa && !pb) return 0;
  if (!pa) return -1;
  if (!pb) return 1;
  for (let i = 0; i < 3; i++) if (pa[i] !== pb[i]) return pa[i] - pb[i];
  return 0;
}

/** CHANGELOG.md の文を、版ごとの節に分ける（[Unreleased] と、比較リンクは除く。新しい順のまま） */
export function parseChangelog(text: string): ChangelogEntry[] {
  const entries: ChangelogEntry[] = [];
  let entry: ChangelogEntry | null = null;
  let section: ChangelogSection | null = null;
  for (const raw of text.replace(/\r\n/g, '\n').split('\n')) {
    const line = raw.trimEnd();
    const head = /^## \[([^\]]+)\](?:\s*-\s*(\S+))?/.exec(line);
    if (head) {
      entry = parseVersion(head[1]) ? { version: head[1], date: head[2] ?? '', sections: [] } : null;
      if (entry) entries.push(entry);
      section = null;
      continue;
    }
    if (!entry) continue;
    const sec = /^### (.+)$/.exec(line);
    if (sec) {
      section = { title: sec[1].trim(), items: [] };
      entry.sections.push(section);
      continue;
    }
    const item = /^- (.+)$/.exec(line);
    if (item && section) section.items.push(item[1].trim());
    else if (item && !section) {
      // 種類の見出しが無い箇条書きは、「変更」にまとめる
      section = { title: '変更', items: [item[1].trim()] };
      entry.sections.push(section);
    } else if (/^\s+\S/.test(raw) && section && section.items.length > 0) {
      // 箇条書きの続きの行（字下げ）は、直前の項目に足す
      section.items[section.items.length - 1] += ` ${raw.trim()}`;
    }
  }
  return entries;
}

export interface AppUpdateNotice {
  show: boolean;
  /** 利用者が最後に開いた版（分からなければ null） */
  previous: string | null;
  /** 今の版 */
  current: string;
  /** 出す更新履歴（新しい順） */
  entries: ChangelogEntry[];
}

/** 通知の要否と、出す更新履歴を決める（記録は変えない）。hasStoredData = この端末に、保存データがあるか */
export function evaluateAppUpdate(current: string, changelog: ChangelogEntry[], hasStoredData: boolean): AppUpdateNotice {
  const none: AppUpdateNotice = { show: false, previous: null, current, entries: [] };
  if (!parseVersion(current)) return none;
  const recorded = readString(DEVICE_KEYS.lastSeenAppVersion);
  const previous = parseVersion(recorded) ? recorded : null;
  if (previous !== null) {
    if (compareVersions(current, previous) <= 0) return { ...none, previous };
    const entries = changelog.filter(e => compareVersions(e.version, previous) > 0 && compareVersions(e.version, current) <= 0);
    return { show: true, previous, current, entries };
  }
  if (!hasStoredData) return none;
  return { show: true, previous: null, current, entries: changelog.filter(e => compareVersions(e.version, current) <= 0) };
}

/** この端末に、保存データ（編成・DB など）があるか。初めての利用者かの判定に使う */
export function hasAnyStoredData(): boolean {
  return [STORAGE_KEYS.activeRotation, STORAGE_KEYS.savedSlots, STORAGE_KEYS.database].some(k => readString(k) !== null);
}

/** 今の版を、確認済みとして記録する（記録より古いときは進めない。開発中の版は記録しない） */
export function markAppVersionSeen(current: string): void {
  if (!parseVersion(current)) return;
  const recorded = readString(DEVICE_KEYS.lastSeenAppVersion);
  if (parseVersion(recorded) && compareVersions(current, recorded) <= 0) return;
  writeString(DEVICE_KEYS.lastSeenAppVersion, current);
}
