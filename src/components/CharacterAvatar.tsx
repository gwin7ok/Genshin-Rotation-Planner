import React from 'react';
import { CharacterConfig } from '../types/genshin';
import { charName } from '../i18n/loc';
import { ItemIcon } from './ItemIcon';

interface CharacterAvatarProps {
  char: Pick<CharacterConfig, 'name' | 'avatarUrl' | 'color' | 'accentColor'>;
  /** 大きさ・角丸・文字サイズ（例: "w-7 h-7 rounded-lg text-xs"） */
  className?: string;
  borderWidth?: number;
}

/**
 * キャラアイコン。マスターデータの avatarUrl の画像を表示し、URL が無い・読み込めない場合は名前の先頭1文字を表示する
 * （表示の仕組みは、武器・聖遺物と共通の ItemIcon）
 */
export const CharacterAvatar: React.FC<CharacterAvatarProps> = ({ char, className, borderWidth }) => (
  <ItemIcon name={charName(char)} iconUrl={char.avatarUrl} color={char.color} accentColor={char.accentColor} className={className} borderWidth={borderWidth} />
);
