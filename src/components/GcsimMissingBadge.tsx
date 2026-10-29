import React from 'react';
import type { CharacterConfig } from '../types/genshin';
import { t } from '../i18n';

/** gcsim に未実装のキャラか（マスターに gcsim のキーが無い。カスタムキャラ・空きスロットは対象外） */
export function isGcsimMissingCharacter(c: Pick<CharacterConfig, 'id' | 'isCustom' | 'source'>): boolean {
  if (c.isCustom || c.id.startsWith('custom_') || c.id.startsWith('empty_slot_')) return false;
  return !c.source?.gcsimKey;
}

/** 「gcsim未実装」のバー。キャラ名の横に出す（パーティ編成・DB管理・ガント・構築エリア共通） */
export const GcsimMissingBadge: React.FC<{ char: Pick<CharacterConfig, 'id' | 'isCustom' | 'source'>; className?: string }> = ({ char, className = '' }) => {
  if (!isGcsimMissingCharacter(char)) return null;
  const framesNote = char.source?.frameSource
    ? t('gcsim:missing.framesFrom', { source: char.source.frameSource })
    : t('gcsim:missing.framesTentative');
  return <GcsimMissingTag className={className} title={t('gcsim:missing.character', { framesNote })} />;
};

/** gcsim に未実装の武器・聖遺物か（gcsim のキーが無い。カスタムは対象外） */
export const isGcsimMissingEquipment = (e: { gcsimKey?: string; isCustom?: boolean }): boolean => !e.isCustom && !e.gcsimKey;

/** 「gcsim未実装」のバー本体（キャラ・武器・聖遺物で共通） */
export const GcsimMissingTag: React.FC<{ title: string; className?: string }> = ({ title, className = '' }) => (
  <span
    data-testid="gcsim-missing-badge"
    className={`inline-flex items-center shrink-0 px-1.5 py-px rounded border border-rose-500/50 bg-rose-500/15 text-rose-300 text-[9px] font-bold leading-tight whitespace-nowrap select-none ${className}`}
    title={title}
  >
    {t('gcsim:missing.label')}
  </span>
);
