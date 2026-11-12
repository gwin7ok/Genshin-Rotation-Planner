import React, { useEffect, useState } from 'react';
import { loc } from '../i18n/loc';

interface ItemIconProps {
  /** 表示名（画像が無い・読み込めないときは、この先頭1文字を表示する） */
  name: string;
  iconUrl?: string;
  /** 枠・背景の色と、文字の色 */
  color: string;
  accentColor: string;
  /** 大きさ・角丸・文字サイズ（例: "w-7 h-7 rounded-lg text-xs"） */
  className?: string;
  borderWidth?: number;
}

/**
 * キャラ・武器・聖遺物のアイコンの共通部品。
 * 画像（iconUrl）を表示し、URL が無い・読み込めない場合は名前の先頭1文字を表示する
 */
export const ItemIcon: React.FC<ItemIconProps> = ({
  name,
  iconUrl,
  color,
  accentColor,
  className = 'w-7 h-7 rounded-lg text-xs',
  borderWidth = 1.5,
}) => {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [iconUrl]);
  const showImage = !!iconUrl && !failed;

  return (
    <div
      className={`flex items-center justify-center font-bold shrink-0 overflow-hidden ${className}`}
      style={{ backgroundColor: `${color}33`, color: accentColor, border: `${borderWidth}px solid ${color}` }}
    >
      {showImage ? (
        <img
          src={iconUrl}
          alt={name}
          className="w-full h-full object-cover"
          loading="lazy"
          draggable={false}
          onError={() => setFailed(true)}
        />
      ) : (
        Array.from(name)[0] ?? ''
      )}
    </div>
  );
};

/** 武器・聖遺物のアイコン（色は、DB 管理のカードの枠の色に合わせる） */
type EquipmentIconProps = {
  item: { name: string; en?: { name?: string }; avatarUrl?: string };
  kind: 'weapon' | 'artifact';
  className?: string;
};

const EQUIPMENT_COLORS = {
  weapon: { color: '#f59e0b', accentColor: '#fbbf24' },
  artifact: { color: '#a855f7', accentColor: '#c084fc' },
};

export const EquipmentIcon: React.FC<EquipmentIconProps> = ({ item, kind, className }) => (
  <ItemIcon name={loc(item, 'name')} iconUrl={item.avatarUrl} {...EQUIPMENT_COLORS[kind]} className={className} />
);
