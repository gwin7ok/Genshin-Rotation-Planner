import React from 'react';
import { Trash2 } from 'lucide-react';
import { CharacterConfig, PassiveTriggerInstance, Stint } from '../types/genshin';
import { GenshinDatabase } from '../types/database';
import {
  GCSIM_OUT_OF_SCOPE_DEFAULT_REASON,
  TriggerableBuffDefinition,
  getAvailableBuffsForCharacter,
  getBuffBadgeConfig,
  isGcsimOutOfScope,
  isGlobalRowBuff,
} from '../utils/buffUtils';
import { t } from '../i18n';
import { loc, triggerName } from '../i18n/loc';

/** 発動バフのパレットのボタンの説明（出どころ・説明・効果時間・CT） */
const paletteTitle = (source: string, def: TriggerableBuffDefinition) =>
  t('chart:buff.paletteTitle', {
    source,
    description: def.description ? loc(def, 'description') : loc(def, 'name'),
    duration: def.duration ?? t('notSet'),
    cooldown: def.cooldown ? `${def.cooldown}s` : t('noneShort'),
  });

/** 名前に効果時間が含まれていなければ、名前の後ろに効果時間を足す */
const withDuration = (def: TriggerableBuffDefinition) =>
  def.duration && !def.name.includes(`${def.duration}秒`) && !def.name.includes(`${def.duration}s`) ? ` (${def.duration}s)` : '';

/** 「gcsim 対象外」のバッジ（gcsim の計算結果では置かれず、手動で置いたときだけ表示される。D41-3・D53） */
const GcsimOutOfScopeBadge: React.FC<{ def: TriggerableBuffDefinition }> = ({ def }) =>
  isGcsimOutOfScope(def) ? (
    <span
      className="text-[9px] px-1 rounded bg-slate-700/80 text-slate-300 border border-slate-500/60 font-normal shrink-0"
      title={loc(def, 'gcsimNote') || GCSIM_OUT_OF_SCOPE_DEFAULT_REASON}
    >
      {t('gcsim.outOfScope')}
    </span>
  ) : null;

interface StintBuffTriggersSectionProps {
  /** palette = 「+ 登録」の行だけ、list = 登録済みの連動・発動バフの一覧だけ（無ければ何も出さない）、all = 両方（追加作業 27 / issue #35） */
  part?: 'all' | 'palette' | 'list';
  stintIndex: number;
  stint: Stint;
  char: CharacterConfig;
  database?: GenshinDatabase;
  onUpdatePassiveTriggers: (stintIndex: number, update: (list: PassiveTriggerInstance[]) => PassiveTriggerInstance[]) => void;
  setCtHoverActionId?: React.Dispatch<React.SetStateAction<string | null>>;
  renderTimingInput: (
    label: string,
    value: number,
    defaultValue: number,
    valueClassName: string,
    title: string,
    onChange: (value: number) => void,
    onHoverChange: (hovering: boolean) => void,
  ) => React.ReactNode;
}

export const StintBuffTriggersSection: React.FC<StintBuffTriggersSectionProps> = ({
  part = 'all',
  stintIndex,
  stint,
  char,
  database,
  onUpdatePassiveTriggers,
  setCtHoverActionId,
  renderTimingInput,
}) => {
  // 当該キャラクターの全発動可能バフ（固有天賦・武器・聖遺物）
  const availableBuffs = React.useMemo(() => {
    // 自動で出す効果（祭礼の武器）は、手で置く候補に出さない
    return getAvailableBuffsForCharacter(char, database).filter(b => !b.autoApplied);
  }, [char, database]);

  // 発動位置: 出場の先頭（キャラ交代アクションがあればその直後）
  const handleAddTrigger = (def: TriggerableBuffDefinition) => {
    const swap = stint.actions.find(a => a.type === 'swap' || a.actionTypeId === 'action_switch_char');
    const offset = swap ? Number(((swap.endTime ?? 0) - (stint.startTime ?? 0)).toFixed(3)) : 0;
    onUpdatePassiveTriggers(stintIndex, list => [
      ...list,
      {
        id: `ptrg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        passiveEffectId: def.id,
        name: def.name,
        offset,
        ...(def.duration !== undefined ? { duration: def.duration } : {}),
        ...(def.cooldown !== undefined ? { cooldown: def.cooldown } : {}),
      },
    ]);
  };

  const handleUpdateTiming = (
    triggerId: string,
    field: 'duration' | 'cooldown',
    value: number,
    defaultValue: number,
  ) => {
    if (!Number.isFinite(value)) return;
    const nextValue = Math.min(999, Math.max(0, Number(value.toFixed(2))));
    onUpdatePassiveTriggers(stintIndex, list =>
      list.map(t => {
        if (t.id !== triggerId) return t;
        const { [field]: _omit, ...rest } = t;
        return nextValue === defaultValue ? rest : { ...rest, [field]: nextValue };
      })
    );
  };

  const handleRemoveTrigger = (triggerId: string) => {
    onUpdatePassiveTriggers(stintIndex, list => list.filter(t => t.id !== triggerId));
  };

  // カテゴリ別の利用可能バフ。常時の効果・継続時間の無い固有天賦は、全体の行にだけ出す（D40-4）
  const trackBuffs = availableBuffs.filter(b => !isGlobalRowBuff(b));
  const talentBuffs = trackBuffs.filter(b => b.category === 'talent');
  const weaponBuffs = trackBuffs.filter(b => b.category === 'weapon');
  const artifactBuffs = trackBuffs.filter(b => b.category === 'artifact');
  const constellationBuffs = trackBuffs.filter(b => b.category === 'constellation');

  const showList = part !== 'palette';
  const showPalette = part !== 'list';
  // 一覧だけのとき、登録が無ければ何も出さない
  if (part === 'list' && (stint.passiveTriggers ?? []).length === 0) return null;

  return (
    <div className={`${part === 'palette' ? 'mt-1.5' : 'mt-2.5 pt-2 border-t border-dashed border-slate-700/80'} flex flex-wrap items-center gap-2`}>
      {showList && (
      <span className="text-[11px] font-bold text-amber-300 shrink-0 flex items-center gap-1">
        <span>{t('chart:buff.linked')}</span>
      </span>
      )}

      {/* 登録済みトリガー一覧 */}
      {showList && (stint.passiveTriggers ?? []).map(trigger => {
        const matchedDef = availableBuffs.find(b => b.id === trigger.passiveEffectId);
        const category = matchedDef?.category || (trigger.passiveEffectId.startsWith('wbuff_') ? 'weapon' : trigger.passiveEffectId.startsWith('abuff_') ? 'artifact' : 'talent');
        const badgeCfg = getBuffBadgeConfig(category);

        const defaultDuration = matchedDef?.duration ?? 0;
        const defaultCooldown = matchedDef?.cooldown ?? 0;
        // 表示名（D255）: 保存されている名前が定義の名前と同じなら、表示の言語の名前
        const shownName = triggerName(matchedDef, trigger);

        const hoverProps = {
          onHoverChange: (hovering: boolean) =>
            setCtHoverActionId?.(prev => (hovering ? trigger.id : prev === trigger.id ? null : prev)),
        };

        return (
          <div
            key={trigger.id}
            className={`flex items-center gap-1 h-7 px-2 rounded-lg border text-xs shadow-sm ${badgeCfg.badgeClass}`}
            title={matchedDef?.description ? loc(matchedDef, 'description') : shownName}
          >
            <span className="text-[10px] select-none">{badgeCfg.icon}</span>
            <span className="font-semibold max-w-[180px] truncate" title={shownName}>
              {shownName}
            </span>
            {matchedDef && <GcsimOutOfScopeBadge def={matchedDef} />}
            <span className="text-[10px] font-mono text-slate-400" title={t('chart:buff.offsetTitle')}>
              @{trigger.offset >= 0 ? '+' : ''}{trigger.offset.toFixed(2)}s
            </span>
            {renderTimingInput(
              t('chart:buff.effect'),
              trigger.duration ?? defaultDuration,
              defaultDuration,
              'text-pink-300',
              t('chart:buff.durationTitle', { seconds: defaultDuration }),
              v => handleUpdateTiming(trigger.id, 'duration', v, defaultDuration),
              hoverProps.onHoverChange
            )}
            {renderTimingInput(
              'CT',
              trigger.cooldown ?? defaultCooldown,
              defaultCooldown,
              badgeCfg.timingValueClass,
              t('chart:buff.cooldownTitle', { seconds: defaultCooldown }),
              v => handleUpdateTiming(trigger.id, 'cooldown', v, defaultCooldown),
              hoverProps.onHoverChange
            )}
            <button
              type="button"
              onClick={() => handleRemoveTrigger(trigger.id)}
              className="p-0.5 rounded text-slate-400 hover:text-red-400 hover:bg-slate-800 ml-0.5 transition-colors flex items-center justify-center shrink-0"
              title={t('chart:buff.remove')}
              aria-label={t('chart:buff.removeLabel')}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}

      {/* バフ登録パレット（天賦 / 武器 / 聖遺物） */}
      {showPalette && (
      <div className="basis-full flex flex-wrap items-center gap-1.5 mt-1">
        <span className="h-7 w-14 shrink-0 mr-2 inline-flex items-center justify-center text-[11px] font-semibold text-red-300/70 bg-red-950/40 border border-red-900/60 rounded" title={t('chart:buff.registerTitle')}>{t('chart:buff.register')}</span>

        {trackBuffs.length === 0 ? (
          <span className="text-[11px] text-slate-500 italic">
            {availableBuffs.length > 0
              ? t('chart:buff.noTimed')
              : t('chart:buff.noData')}
          </span>
        ) : (
          <>
            {/* 1. 天賦バフ */}
            {talentBuffs.map(def => (
              <button
                key={def.id}
                type="button"
                onClick={() => handleAddTrigger(def)}
                className="h-7 px-2 rounded bg-emerald-950/60 hover:bg-emerald-900/80 text-emerald-200 hover:text-white text-[11px] font-semibold border border-emerald-800/80 hover:border-emerald-500 transition-all flex items-center gap-1"
                title={paletteTitle(t('category.talent'), def)}
              >
                <span>🎯</span>
                <span>+{loc(def, 'name')}{withDuration(def)}</span>
                <GcsimOutOfScopeBadge def={def} />
              </button>
            ))}

            {/* 1b. 命ノ星座の効果（凸数が足りているもの） */}
            {constellationBuffs.map(def => (
              <button
                key={def.id}
                type="button"
                onClick={() => handleAddTrigger(def)}
                className="h-7 px-2 rounded bg-rose-950/60 hover:bg-rose-900/80 text-rose-200 hover:text-white text-[11px] font-semibold border border-rose-800/80 hover:border-rose-500 transition-all flex items-center gap-1"
                title={paletteTitle(t('category.constellation'), def)}
              >
                <span>✦</span>
                <span>+{loc(def, 'name')}{withDuration(def)}</span>
                <GcsimOutOfScopeBadge def={def} />
              </button>
            ))}

            {/* 2. 武器バフ */}
            {weaponBuffs.map(def => (
              <button
                key={def.id}
                type="button"
                onClick={() => handleAddTrigger(def)}
                className="h-7 px-2 rounded bg-sky-950/60 hover:bg-sky-900/80 text-sky-200 hover:text-white text-[11px] font-semibold border border-sky-800/80 hover:border-sky-500 transition-all flex items-center gap-1"
                title={paletteTitle(t('category.weapon', { name: loc(def, 'sourceName') }), def)}
              >
                <span>⚔️</span>
                <span>+{loc(def, 'name')}{withDuration(def)}</span>
                <GcsimOutOfScopeBadge def={def} />
              </button>
            ))}

            {/* 3. 聖遺物バフ */}
            {artifactBuffs.map(def => (
              <button
                key={def.id}
                type="button"
                onClick={() => handleAddTrigger(def)}
                className="h-7 px-2 rounded bg-purple-950/60 hover:bg-purple-900/80 text-purple-200 hover:text-white text-[11px] font-semibold border border-purple-800/80 hover:border-purple-500 transition-all flex items-center gap-1"
                title={paletteTitle(t('category.artifact', { name: loc(def, 'sourceName') }), def)}
              >
                <span>🛡️</span>
                <span>+{loc(def, 'name')}{withDuration(def)}</span>
                <GcsimOutOfScopeBadge def={def} />
              </button>
            ))}
          </>
        )}
      </div>
      )}
    </div>
  );
};
