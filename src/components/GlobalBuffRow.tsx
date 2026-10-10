import React from 'react';
import { Globe, User } from 'lucide-react';
import { CharacterConfig } from '../types/genshin';
import { GenshinDatabase } from '../types/database';
import {
  GCSIM_OUT_OF_SCOPE_DEFAULT_REASON,
  TriggerableBuffDefinition,
  buffTimingLabel,
  getAvailableBuffsForCharacter,
  getBuffBadgeConfig,
  isGcsimOutOfScope,
  isGlobalRowBuff,
} from '../utils/buffUtils';

interface GlobalBuffRowProps {
  characters: CharacterConfig[];
  database?: GenshinDatabase;
}

export interface TimelessBuffItem {
  key: string;
  owner: CharacterConfig;
  def: TriggerableBuffDefinition;
}

/** キャラごとの、時間指定のない効果のうち、自分だけに効くもの（出場トラックの上の行に出す。追加作業 23） */
export function selfTimelessBuffItems(char: CharacterConfig, database?: GenshinDatabase): TimelessBuffItem[] {
  return getAvailableBuffsForCharacter(char, database)
    .filter(d => !d.autoApplied && isGlobalRowBuff(d) && d.scope === 'self')
    .map(def => ({ key: `${char.id}:${def.id}`, owner: char, def }));
}

/** 時間指定のない効果の、名前だけのボタン（押せない。ホバーで説明）。全体の行・キャラごとの表示で共通 */
export const TimelessBuffChip: React.FC<{ item: TimelessBuffItem }> = ({ item: { owner, def } }) => {
  const badgeCfg = getBuffBadgeConfig(def.category);
  const timing = buffTimingLabel(def);
  const outOfScope = isGcsimOutOfScope(def);
  const sourceLabel = def.category === 'talent' ? '固有天賦' : def.category === 'constellation' ? '命ノ星座' : def.category === 'weapon' ? `武器: ${def.sourceName ?? ''}` : `聖遺物: ${def.sourceName ?? ''}`;
  const tooltip = [
    `【${timing}】${owner.name} / ${sourceLabel}`,
    def.description ?? def.name,
    ...(outOfScope ? [`※ gcsim 対象外: ${def.gcsimNote ?? GCSIM_OUT_OF_SCOPE_DEFAULT_REASON}`] : []),
  ].join('\n');
  return (
    <span
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[11px] select-none cursor-default shrink-0 ${badgeCfg.badgeClass}`}
      title={tooltip}
    >
      <span className="text-[10px]">{badgeCfg.icon}</span>
      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: owner.accentColor }} title={owner.name} />
      <span className={`text-[9px] font-bold ${def.timing === 'always' ? 'text-amber-300' : 'text-slate-400'}`}>{timing}</span>
      <span className="max-w-[220px] truncate">{def.name}</span>
      {outOfScope && (
        <span className="text-[9px] px-1 rounded bg-slate-700/80 text-slate-300 border border-slate-500/60 shrink-0">gcsim対象外</span>
      )}
    </span>
  );
};

/**
 * 時間指定のない効果を、名前だけのボタンで横に並べる行（左の見出しは、横スクロールしても見えるよう固定）。
 * 全体の行（GlobalBuffRow）と、キャラごとの行（出場トラックの上）で共通。押せない。ホバーで説明を出す
 */
export const TimelessBuffRow: React.FC<{
  items: TimelessBuffItem[];
  /** 左の見出し */
  label: string;
  /** キャラごとの行（見出しの色・アイコンを変える） */
  perCharacter?: boolean;
  emptyText?: string;
  testId?: string;
}> = ({ items, label, perCharacter = false, emptyText, testId }) => (
  <div data-testid={testId} className={`flex border-b border-slate-800 items-start group relative min-h-8 ${perCharacter ? 'bg-slate-950/70' : 'bg-slate-950'}`}>
    <div className={`w-[180px] shrink-0 px-3 border-r border-slate-800 flex items-center justify-between text-xs font-bold sticky left-0 z-30 bg-slate-950 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.5)] self-stretch ${perCharacter ? 'text-teal-200' : 'text-teal-300'}`}>
      <span className="flex items-center gap-1.5 min-w-0">
        {perCharacter ? <User className="w-3.5 h-3.5 text-teal-400 shrink-0" /> : <Globe className="w-3.5 h-3.5 text-teal-400 shrink-0" />}
        <span className="truncate" title={label}>{label}</span>
      </span>
      <span className="text-[10px] text-slate-500 font-mono font-normal shrink-0">{items.length}件</span>
    </div>

    <div className="relative flex-1 py-1">
      {/* 横スクロールしても見えるよう、左端に固定して折り返す */}
      <div className="sticky left-[188px] flex flex-wrap items-center gap-1 pr-2" style={{ maxWidth: 'calc(100vw - 220px)' }}>
        {items.length === 0 ? (
          <span className="text-[11px] text-slate-500 italic">{emptyText ?? 'ありません'}</span>
        ) : (
          items.map(item => <TimelessBuffChip key={item.key} item={item} />)
        )}
      </div>
    </div>
  </div>
);

/**
 * 時間指定のない効果の行（D39-4・D40。旧称: 全体の行）: 時間・CT が無い効果（常時の効果・継続時間の無い固有天賦）のうち、
 * 全体向けのもの（追加作業 23）を、名前だけのボタンで並べる。押せない。ホバーで説明を出す。編成とマスターから計算して常に表示する。
 * 自分だけに効くものは、キャラごとの行（出場トラックの上。TimelessBuffRow）
 */
export const GlobalBuffRow: React.FC<GlobalBuffRowProps> = ({ characters, database }) => {
  const items = React.useMemo<TimelessBuffItem[]>(() => {
    const result: TimelessBuffItem[] = [];
    for (const owner of characters) {
      if (owner.id.startsWith('empty_slot_')) continue;
      for (const def of getAvailableBuffsForCharacter(owner, database)) {
        if (isGlobalRowBuff(def) && def.scope !== 'self') result.push({ key: `${owner.id}:${def.id}`, owner, def });
      }
    }
    return result;
  }, [characters, database]);

  return <TimelessBuffRow items={items} label="時間指定のない効果" emptyText="常時の効果・時間の無い固有天賦はありません" />;
};
