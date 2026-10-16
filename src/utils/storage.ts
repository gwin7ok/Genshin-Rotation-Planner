import { CharacterConfig, PartyMember, Stint, SavedRotationSlot, SavedReactions } from '../types/genshin';
import { isEmptySlotCharacter } from '../data/characters';
import { STORAGE_KEYS, readJson, removeKey, writeJson } from './persistence';
import { isValidParty, sanitizeSlot, sanitizeStints } from './rotationValidation';

export interface ActiveRotationState {
  /** 編成（キャラの ID と編成ごとの設定） */
  party: PartyMember[];
  stints: Stint[];
  /** 2周目ループの開始位置（何番目の出場キャラの前か。0始まり、0=基準なし） */
  loopStartIndex?: number;
  /** 旧形式のループ基準（秒）。読込時に loopStartIndex へ変換する */
  loopStartTime?: number;
  switchDelay?: number;
  /** gcsim の実行結果の反応の行（gcsim のバージョンつき） */
  reactions?: SavedReactions;
  /** 現在読み込んでいるユーザー保存編成（スロット）のID */
  activeSlotId?: string | null;
  lastSavedAt: string;
  customName?: string;
}

/**
 * 現在編集中の編成を保存する（自動保存。保存先は persistence.ts）
 */
export function saveActiveState(state: Omit<ActiveRotationState, 'lastSavedAt'>): boolean {
  const payload: ActiveRotationState = {
    ...state,
    lastSavedAt: new Date().toISOString(),
  };
  return writeJson(STORAGE_KEYS.activeRotation, payload);
}

/** 自動保存の待ち時間（ミリ秒）。最後の変更から、この時間が経ってから、1 回だけ書く */
export const ACTIVE_STATE_SAVE_DELAY_MS = 400;

let pendingActiveState: Omit<ActiveRotationState, 'lastSavedAt'> | null = null;
let pendingActiveTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * 編集中の編成を、少し待ってから保存する（自動保存）。
 * 連続した操作（秒数のスピン・ドラッグなど）の間に、全状態を何度も JSON にして書き込まないよう、最後の変更から一定時間後に 1 回だけ書く。
 * 待っている間に、ほかの場所が保存先を読む・消す・上書きするときは、flushActiveState / clearActiveState で、先に確定する・取り消す
 */
export function saveActiveStateDebounced(state: Omit<ActiveRotationState, 'lastSavedAt'>): void {
  pendingActiveState = state;
  if (pendingActiveTimer !== null) clearTimeout(pendingActiveTimer);
  pendingActiveTimer = setTimeout(flushActiveState, ACTIVE_STATE_SAVE_DELAY_MS);
}

/** 待っている自動保存があれば、今すぐ書く（画面を閉じる前・保存先を読む前に呼ぶ）。失敗は、保存先の書き込み失敗の通知（persistence.ts）で伝わる */
export function flushActiveState(): void {
  if (pendingActiveTimer !== null) clearTimeout(pendingActiveTimer);
  pendingActiveTimer = null;
  const state = pendingActiveState;
  pendingActiveState = null;
  if (state) saveActiveState(state);
}

/** 待っている自動保存を、書かずに捨てる */
function cancelPendingActiveState(): void {
  if (pendingActiveTimer !== null) clearTimeout(pendingActiveTimer);
  pendingActiveTimer = null;
  pendingActiveState = null;
}

/**
 * 保存してある、編集中の編成を読む
 */
export function loadActiveState(): ActiveRotationState | null {
  flushActiveState(); // 待っている保存があれば、先に書く（最新の内容を読む）
  const parsed = readJson<Partial<ActiveRotationState>>(STORAGE_KEYS.activeRotation);
  // 壊れた保存データ（編成の枠・出場・アクションの欠け）で、画面が落ちないように、読み込みのときに検査する
  if (parsed && isValidParty(parsed.party) && Array.isArray(parsed.stints)) {
    const { stints } = sanitizeStints(parsed.stints);
    return { ...parsed, stints } as ActiveRotationState;
  }
  return null;
}

/**
 * 編集中の編成の保存を消す（初期状態に戻す）
 */
export function clearActiveState(): void {
  cancelPendingActiveState(); // 待っている保存が、消した直後に、古い内容を書き戻さない
  removeKey(STORAGE_KEYS.activeRotation);
}

/**
 * 保存編成（スロット）の一覧を読む
 */
export function getSavedSlots(): SavedRotationSlot[] {
  const list = readJson<unknown>(STORAGE_KEYS.savedSlots);
  if (!Array.isArray(list)) return [];
  // 旧形式（キャラを丸ごと持つ）の保存編成と、壊れた保存編成は読み込まない（D13）。使えるものも、壊れた出場・アクションは除く
  return list.flatMap(raw => {
    const r = sanitizeSlot(raw);
    return r ? [r.slot] : [];
  });
}

/** 保存編成を保存・削除できなかったときに、利用者に出す文（容量超過・ブラウザの保存が無効のとき） */
export const SLOT_WRITE_FAILED_MESSAGE =
  'ブラウザに保存できませんでした（保存容量の不足、またはブラウザの設定で保存が無効になっている可能性があります）。内容は変更していません。「JSONファイル書き出し」で、控えを保存してください。';

/** 保存編成の書き込みの結果。ok が false のとき、保存できていない（slots は、保存されている内容） */
export interface SlotWriteResult {
  ok: boolean;
  slots: SavedRotationSlot[];
}

/**
 * 保存編成を、追加または更新する（成否つき。容量超過・保存が無効のときは、ok: false）
 */
export function trySaveSlot(slot: SavedRotationSlot): SlotWriteResult {
  const current = getSavedSlots();
  const existingIdx = current.findIndex(s => s.id === slot.id);
  const stamped = { ...slot, updatedAt: new Date().toISOString() };
  let updated: SavedRotationSlot[];
  if (existingIdx >= 0) {
    updated = [...current];
    updated[existingIdx] = stamped;
  } else {
    updated = [stamped, ...current];
  }
  return writeJson(STORAGE_KEYS.savedSlots, updated) ? { ok: true, slots: updated } : { ok: false, slots: getSavedSlots() };
}

/**
 * 保存編成を、追加または更新する（成否が要らない呼び出し用。失敗は、書き込みの失敗の通知〔persistence.ts〕に出る）
 */
export function saveSlot(slot: SavedRotationSlot): SavedRotationSlot[] {
  return trySaveSlot(slot).slots;
}

/**
 * 保存編成の一覧を、そのまま置き換える（バックアップの復元用。更新日時は書き換えない）
 */
export function replaceSavedSlots(slots: SavedRotationSlot[]): boolean {
  return writeJson(STORAGE_KEYS.savedSlots, slots);
}

/**
 * 保存編成を削除する（成否つき）
 */
export function tryDeleteSlot(slotId: string): SlotWriteResult {
  const updated = getSavedSlots().filter(s => s.id !== slotId);
  return writeJson(STORAGE_KEYS.savedSlots, updated) ? { ok: true, slots: updated } : { ok: false, slots: getSavedSlots() };
}

/**
 * 保存編成を削除する
 */
export function deleteSlot(slotId: string): SavedRotationSlot[] {
  return tryDeleteSlot(slotId).slots;
}

/**
 * 「名前をつけて保存」の初期編成名
 * - 保存スロットを読み込み中ならその保存編成名
 * - 未保存なら「編成キャラ名（ローテーション時間）」（未設定スロットは除く）
 */
export function buildDefaultSlotName(
  characters: CharacterConfig[],
  totalDuration: number,
  activeSlot?: SavedRotationSlot | null,
): string {
  if (activeSlot) return activeSlot.name;
  return `${buildPartyMemberNames(characters)} (${totalDuration.toFixed(1)}s)`;
}

/** 編成メンバー名を「・」でつないだ文字列（未設定スロットは除く） */
export function buildPartyMemberNames(characters: CharacterConfig[]): string {
  return characters.filter(c => !isEmptySlotCharacter(c)).map(c => c.name).join('・');
}

/** 編成名の同一判定用に正規化（前後空白・全角半角・大文字小文字の違いを無視） */
export function normalizeSlotName(name: string): string {
  return name.normalize('NFKC').trim().toLowerCase();
}

/** 同じ編成名（正規化して一致）の保存スロットを探す */
export function findSlotByName(slots: SavedRotationSlot[], name: string): SavedRotationSlot | undefined {
  const key = normalizeSlotName(name);
  return slots.find(s => normalizeSlotName(s.name) === key);
}
