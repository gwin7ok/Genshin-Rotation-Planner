import React from 'react';
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

/** 「gcsim 対象外」のバッジ（gcsim の計算結果では置かれず、手動で置いたときだけ表示される。D41-3・D53） */
const GcsimOutOfScopeBadge: React.FC<{ def: TriggerableBuffDefinition }> = ({ def }) =>
  isGcsimOutOfScope(def) ? (
    <span
      className="text-[9px] px-1 rounded bg-slate-700/80 text-slate-300 border border-slate-500/60 font-normal shrink-0"
      title={def.gcsimNote ?? GCSIM_OUT_OF_SCOPE_DEFAULT_REASON}
    >
      gcsim対象外
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
        <span>✨ 連動・発動バフ:</span>
      </span>
      )}

      {/* 登録済みトリガー一覧 */}
      {showList && (stint.passiveTriggers ?? []).map(trigger => {
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
            {matchedDef && <GcsimOutOfScopeBadge def={matchedDef} />}
            <span className="text-[10px] font-mono text-slate-400" title="発動位置（出場の先頭から）。ガントチャートでドラッグして調整">
              @{trigger.offset >= 0 ? '+' : ''}{trigger.offset.toFixed(2)}s
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
      {showPalette && (
      <div className="basis-full flex flex-wrap items-center gap-1.5 mt-1">
        <span className="text-[11px] text-slate-400 font-medium">+ 登録:</span>

        {trackBuffs.length === 0 ? (
          <span className="text-[11px] text-slate-500 italic">
            {availableBuffs.length > 0
              ? '時間のある発動バフはありません（常時・時間の無い効果は、ガントチャートの「時間指定のない効果」の行に表示されます）'
              : '発動バフデータがありません（編成設定で武器・聖遺物を選ぶと追加できます）'}
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
                <GcsimOutOfScopeBadge def={def} />
              </button>
            ))}

            {/* 1b. 命ノ星座の効果（凸数が足りているもの） */}
            {constellationBuffs.map(def => (
              <button
                key={def.id}
                type="button"
                onClick={() => handleAddTrigger(def)}
                className="px-2 py-1 rounded bg-rose-950/60 hover:bg-rose-900/80 text-rose-200 hover:text-white text-[11px] font-semibold border border-rose-800/80 hover:border-rose-500 transition-all flex items-center gap-1"
                title={`【命ノ星座】${def.description ?? def.name}\n効果: ${def.duration ?? '未設定'}s / CT: ${def.cooldown ?? 'なし'}${def.cooldown ? 's' : ''}`}
              >
                <span>✦</span>
                <span>+{def.name}{def.duration && !def.name.includes(`${def.duration}秒`) ? ` (${def.duration}s)` : ''}</span>
                <GcsimOutOfScopeBadge def={def} />
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
                <GcsimOutOfScopeBadge def={def} />
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
