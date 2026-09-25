/**
 * キャラクターのキー（CharacterConfig.id）
 *
 *   公式キャラ     : 「公式キャラID-元素」 例: 胡桃 = "10000046-pyro"、旅人(風) = "10000005-anemo"
 *                    （旅人は元素ごとに1キャラだが公式IDは共通なので、元素を含めて一意にする）
 *   カスタムキャラ : "custom_<作成時刻>"（DB管理で作成。公式IDがなく元素も後から変わるため独自キー）
 *   未設定スロット : "empty_slot_<n>"
 *
 * 旧形式のキー（英語名から作った "hutao" / "traveleranemo" など）は legacyCharacterSlug で求め、
 * 保存データの読み込み時に新しいキーへ置き換える（data/characters.ts の resolveLegacyCharacterId）。
 */
import type { ElementType } from '../types/genshin.ts';

export const characterKey = (genshinId: number, element: ElementType): string => `${genshinId}-${element}`;

/** 新形式（公式ID-元素）のキーか */
export const isOfficialCharacterKey = (id: string): boolean => /^\d+-[a-z]+$/.test(id);

/** 旧形式のキー: 英語名を小文字にして英数字以外を除いたもの（例: "Hu Tao" → "hutao"、"Traveler (Anemo)" → "traveleranemo"） */
export const legacyCharacterSlug = (englishName: string): string => englishName.toLowerCase().replace(/[^a-z0-9]/g, '');
