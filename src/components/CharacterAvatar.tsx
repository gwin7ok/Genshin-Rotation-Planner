import React, { useEffect, useState } from 'react';
import { CharacterConfig } from '../types/genshin';

interface CharacterAvatarProps {
  char: Pick<CharacterConfig, 'name' | 'avatarUrl' | 'color' | 'accentColor'>;
  /** 大きさ・角丸・文字サイズ（例: "w-7 h-7 rounded-lg text-xs"） */
  className?: string;
  borderWidth?: number;
}

/**
 * キャラアイコン。マスターデータの avatarUrl の画像を表示し、URL が無い・読み込めない場合は名前の先頭1文字を表示する
 */
export const CharacterAvatar: React.FC<CharacterAvatarProps> = ({
  char,
  className = 'w-7 h-7 rounded-lg text-xs',
  borderWidth = 1.5,
}) => {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [char.avatarUrl]);
  const showImage = !!char.avatarUrl && !failed;

  return (
    <div
      className={`flex items-center justify-center font-bold shrink-0 overflow-hidden ${className}`}
      style={{ backgroundColor: `${char.color}33`, color: char.accentColor, border: `${borderWidth}px solid ${char.color}` }}
    >
      {showImage ? (
        <img
          src={char.avatarUrl}
          alt={char.name}
          className="w-full h-full object-cover"
          loading="lazy"
          draggable={false}
          onError={() => setFailed(true)}
        />
      ) : (
        char.name.slice(0, 1)
      )}
    </div>
  );
};
