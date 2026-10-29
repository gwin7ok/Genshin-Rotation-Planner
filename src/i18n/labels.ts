/** ゲームの区分（元素・武器種）の表示名。キーは common の element / weaponType */
import type { ElementType, WeaponType } from '../types/genshin';
import { t, TranslationKey } from './index';

export const elementLabel = (element: ElementType): string => t(`element.${element}` as TranslationKey);
export const weaponTypeLabel = (weaponType: WeaponType): string => t(`weaponType.${weaponType}` as TranslationKey);
