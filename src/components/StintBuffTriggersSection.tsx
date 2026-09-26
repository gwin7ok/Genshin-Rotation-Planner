import React from 'react';
import { CharacterConfig, PassiveTriggerInstance, Stint } from '../types/genshin';
import { GenshinDatabase } from '../types/database';
import { TriggerableBuffDefinition, getAvailableBuffsForCharacter, getBuffBadgeConfig } from '../utils/buffUtils';

interface StintBuffTriggersSectionProps {
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
    return getAvailableBuffsForCharacter(char, database);
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

  // カテゴリ別の利用可能バフ
  const talentBuffs = availableBuffs.filter(b => b.category === 'talent');
  const weaponBuffs = availableBuffs.filter(b => b.category === 'weapon');
  const artifactBuffs = availableBuffs.filter(b => b.category === 'artifact');

  return (
    <div className="mt-2.5 pt-2 border-t border-dashed border-slate-700/80 flex flex-wrap items-center gap-2">
      <span className="text-[11px] font-bold text-amber-300 shrink-0 flex items-center gap-1">
        <span>✨ 連動・発動バフ:</span>
      </span>

      {/* 登録済みトリガー一覧 */}
      {(stint.passiveTriggers ?? []).map(trigger => {
        const matchedDef = availableBuffs.find(b => b.id === trigger.passiveEffectId);
        const category = matchedDef?.category || (trigger.passiveEffectId.startsWith('wbuff_') ? 'weapon' : trigger.passiveEffectId.startsWith('abuff_') ? 'artifact' : 'talent');
        const badgeCfg = getBuffBadgeConfig(category);

        const defaultDuration = matchedDef?.duration ?? 0;
        const defaultCooldown = matchedDef?.cooldown ?? 0;

        const hoverProps = {
          onHoverChange: (hovering: boolean) =>
            setCtHoverActionId?.(prev => (hovering ? trigger.id : prev === trigger.id ? null : prev)),
        };

        return (
          <div
            key={trigger.id}
            className={`flex items-center gap-1 px-2 py-1 rounded-lg border text-xs shadow-sm ${badgeCfg.badgeClass}`}
            title={matchedDef?.description ?? trigger.name}
          >
            <span className="text-[10px] select-none">{badgeCfg.icon}</span>
            <span className="font-semibold max-w-[180px] truncate" title={trigger.name}>
              {trigger.name}
            </span>
            <span className="text-[10px] font-mono text-slate-400" title="発動位置（出場の先頭から）。ガントチャートでドラッグして調整">
              @+{trigger.offset.toFixed(2)}s
            </span>
            {renderTimingInput(
              '効果',
              trigger.duration ?? defaultDuration,
              defaultDuration,
              'text-pink-300',
              `効果継続時間（初期値 ${defaultDuration}s）`,
              v => handleUpdateTiming(trigger.id, 'duration', v, defaultDuration),
              hoverProps.onHoverChange
            )}
            {renderTimingInput(
              'CT',
              trigger.cooldown ?? defaultCooldown,
              defaultCooldown,
              badgeCfg.timingValueClass,
              `クールタイム（初期値 ${defaultCooldown}s。0sでCTなし）`,
              v => handleUpdateTiming(trigger.id, 'cooldown', v, defaultCooldown),
              hoverProps.onHoverChange
            )}
            <button
              type="button"
              onClick={() => handleRemoveTrigger(trigger.id)}
              className="text-slate-400 hover:text-red-400 ml-0.5 p-0.5 transition-colors"
              title="この連動バフを削除"
            >
              ✕
            </button>
          </div>
        );
      })}

      {/* バフ登録パレット（天賦 / 武器 / 聖遺物） */}
      <div className="basis-full flex flex-wrap items-center gap-1.5 mt-1">
        <span className="text-[11px] text-slate-400 font-medium">+ 登録:</span>

        {availableBuffs.length === 0 ? (
          <span className="text-[11px] text-slate-500 italic">
            発動バフデータがありません（編成設定で武器・聖遺物を選ぶと追加できます）
          </span>
        ) : (
          <>
            {/* 1. 天賦バフ */}
            {talentBuffs.map(def => (
              <button
                key={def.id}
                type="button"
                onClick={() => handleAddTrigger(def)}
                className="px-2 py-1 rounded bg-emerald-950/60 hover:bg-emerald-900/80 text-emerald-200 hover:text-white text-[11px] font-semibold border border-emerald-800/80 hover:border-emerald-500 transition-all flex items-center gap-1"
                title={`【固有天賦】${def.description ?? def.name}\n効果: ${def.duration ?? '未設定'}s / CT: ${def.cooldown ?? 'なし'}${def.cooldown ? 's' : ''}`}
              >
                <span>🎯</span>
                <span>+{def.name}{def.duration && !def.name.includes(`${def.duration}秒`) ? ` (${def.duration}s)` : ''}</span>
              </button>
            ))}

            {/* 2. 武器バフ */}
            {weaponBuffs.map(def => (
              <button
                key={def.id}
                type="button"
                onClick={() => handleAddTrigger(def)}
                className="px-2 py-1 rounded bg-sky-950/60 hover:bg-sky-900/80 text-sky-200 hover:text-white text-[11px] font-semibold border border-sky-800/80 hover:border-sky-500 transition-all flex items-center gap-1"
                title={`【武器: ${def.sourceName}】${def.description ?? def.name}\n効果: ${def.duration ?? '未設定'}s / CT: ${def.cooldown ?? 'なし'}${def.cooldown ? 's' : ''}`}
              >
                <span>⚔️</span>
                <span>+{def.name}{def.duration && !def.name.includes(`${def.duration}秒`) ? ` (${def.duration}s)` : ''}</span>
              </button>
            ))}

            {/* 3. 聖遺物バフ */}
            {artifactBuffs.map(def => (
              <button
                key={def.id}
                type="button"
                onClick={() => handleAddTrigger(def)}
                className="px-2 py-1 rounded bg-purple-950/60 hover:bg-purple-900/80 text-purple-200 hover:text-white text-[11px] font-semibold border border-purple-800/80 hover:border-purple-500 transition-all flex items-center gap-1"
                title={`【聖遺物: ${def.sourceName}】${def.description ?? def.name}\n効果: ${def.duration ?? '未設定'}s / CT: ${def.cooldown ?? 'なし'}${def.cooldown ? 's' : ''}`}
              >
                <span>🛡️</span>
                <span>+{def.name}{def.duration && !def.name.includes(`${def.duration}秒`) ? ` (${def.duration}s)` : ''}</span>
              </button>
            ))}
          </>
        )}
      </div>
    </div>
  );
};
