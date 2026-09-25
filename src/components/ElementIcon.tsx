import React from 'react';
import { ElementType } from '../types/genshin';
import { ELEMENT_ICON_DATA_URLS } from '../data/elementIcons';
import { ELEMENT_COLORS, ELEMENT_NAMES_JA } from '../data/characters';

/**
 * 元素アイコン（genshin-db の埋め込み画像）。画像の無い元素（物理など）は元素名の英字バッジで表示
 */
export const ElementIcon: React.FC<{ element: ElementType; className?: string }> = ({ element, className = 'w-5 h-5' }) => {
  const url = ELEMENT_ICON_DATA_URLS[element];
  if (url) {
    return (
      <img
        src={url}
        alt={ELEMENT_NAMES_JA[element]}
        title={ELEMENT_NAMES_JA[element]}
        className={`object-contain shrink-0 ${className}`}
        draggable={false}
      />
    );
  }
  const theme = ELEMENT_COLORS[element];
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium border ${theme.bg} ${theme.border} ${theme.text}`}>
      {element.toUpperCase()}
    </span>
  );
};
