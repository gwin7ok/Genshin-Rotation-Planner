/**
 * UID → HoYoLAB のサーバー（拡張機能 extension/hoyolab-importer/hoyolab.js の serverOf と同じ。genshin.py の GENSHIN_SERVER_RANGE と同じ）。
 * 10 桁の UID は、先頭 2 桁（18 = アジア）。中国サーバー（1・2・3）・Bilibili 版（5）は、HoYoLAB の海外版では扱えない（undefined）。
 */
const HOYOLAB_SERVERS: Record<string, string> = { 6: 'os_usa', 7: 'os_euro', 8: 'os_asia', 18: 'os_asia', 9: 'os_cht' };

export const hoyolabServerOf = (uid: string): string | undefined => HOYOLAB_SERVERS[uid.slice(0, -8)];

/** HoYoLAB（海外版）で取れる UID か。取れない UID（中国サーバーなど）は、Enka.Network で取り込む */
export const isHoyolabUid = (uid: string): boolean => hoyolabServerOf(uid) !== undefined;
