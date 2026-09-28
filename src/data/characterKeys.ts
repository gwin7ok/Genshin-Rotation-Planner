/**
 * キャラクターのキー（CharacterConfig.id）
 *
 *   公式キャラ     : 「公式キャラID-元素」 例: 胡桃 = "10000046-pyro"、旅人(風) = "10000005-anemo"
 *                    （旅人は元素ごとに1キャラだが公式IDは共通なので、元素を含めて一意にする）
 *   カスタムキャラ : "custom_<作成時刻>"（DB管理で作成。公式IDがなく元素も後から変わるため独自キー）
 *   未設定スロット : "empty_slot_<n>"
 */
import type { ElementType } from '../types/genshin.ts';

export const characterKey = (genshinId: number, element: ElementType): string => `${genshinId}-${element}`;
