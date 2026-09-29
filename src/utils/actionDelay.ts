import type { CharacterActionInstance } from '../types/genshin';

/** アクション遅延（人の操作の間）の初期値（秒）。delayAfter が未設定のアクションはこの値として扱う */
export const DEFAULT_ACTION_DELAY = 0.10;

/** アクションの後に入れる遅延（秒）。gcsim 変換時は delay(<フレーム数>) になる */
export const actionDelayOf = (act: Pick<CharacterActionInstance, 'delayAfter'>): number =>
  Math.max(0, act.delayAfter ?? DEFAULT_ACTION_DELAY);
