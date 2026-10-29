import React, { useState, useEffect } from 'react';
import { 
  X, 
  Save, 
  FolderOpen, 
  Download, 
  Upload, 
  Trash2, 
  Copy, 
  Check, 
  Sparkles, 
  Clock, 
  RotateCcw, 
  CheckCircle2, 
  AlertCircle,
  FileCode,
  Layers,
  Users,
  ChevronRight
} from 'lucide-react';
import { CharacterConfig, PartyMember, Stint, SavedRotationSlot, SavedReactions } from '../types/genshin';
import { PRESET_COUNT, PRESET_NAME_PREFIX, restorePresets } from '../utils/presets';
import { useDialogs } from './DialogProvider';
import { Trans } from 'react-i18next';
import { t, dateLocale } from '../i18n';
import { staleReactionsBadge } from './StaleReactionsBadge';
import { AppDatabase } from '../types/database';
import { resolvePartyCharacters } from '../utils/party';
import { describeSkipped, parseRotationPayload, totalSkipped } from '../utils/rotationValidation';
import { isEmptySlotCharacter } from '../data/characters';
import { rotationFileName, nameFromFileName, buildRotationExport, APP_FILE_PREFIX, fileTimestamp } from '../utils/rotationFile';
import { buildBackup, parseBackup, summarizeBackup, restoreBackup } from '../utils/backup';
import { getSavedSlots, trySaveSlot, tryDeleteSlot, SLOT_WRITE_FAILED_MESSAGE, clearActiveState, buildDefaultSlotName, findSlotByName, buildPartyMemberNames } from '../utils/storage';
import { charName } from '../i18n/loc';

interface SaveLoadModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** 編成（保存・書き出しの対象） */
  party: PartyMember[];
  /** 編成を DB と合わせて解決したキャラ（表示・編成名の生成用） */
  characters: CharacterConfig[];
  database: AppDatabase;
  stints: Stint[];
  loopStartTime: number;
  loopStartIndex: number;
  totalDuration: number;
  switchDelay?: number;
  /** 今の反応の行（gcsim の結果。保存する形。無ければ undefined） */
  reactions?: SavedReactions;
  activeSlotId: string | null;
  /** 保存スロット一覧が変わったとき。currentSlotId を渡すと「現在読み込み中の編成」もそのIDに更新する */
  onSlotsChanged: (slots: SavedRotationSlot[], currentSlotId?: string | null) => void;
  onLoadSlot: (slot: {
    party: PartyMember[];
    stints: Stint[];
    loopStartIndex?: number;
    loopStartTime?: number;
    switchDelay?: number;
    name?: string;
    totalDuration?: number;
    slotId?: string;
    reactions?: unknown;
  }) => void;
  onResetToDefault: () => void;
}

export const SaveLoadModal: React.FC<SaveLoadModalProps> = ({
  isOpen,
  onClose,
  party,
  characters,
  database,
  stints,
  loopStartTime,
  loopStartIndex,
  totalDuration,
  switchDelay,
  reactions,
  activeSlotId,
  onSlotsChanged,
  onLoadSlot,
  onResetToDefault,
}) => {
  const { confirm, alert: showAlert } = useDialogs();
  const [savedSlots, setSavedSlots] = useState<SavedRotationSlot[]>([]);
  const [newSlotName, setNewSlotName] = useState('');
  const [newSlotDesc, setNewSlotDesc] = useState('');
  // 同じ編成名の既存スロット（上書き確認中）
  const [duplicateSlot, setDuplicateSlot] = useState<SavedRotationSlot | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [importJsonText, setImportJsonText] = useState('');
  const [showJsonArea, setShowJsonArea] = useState(false);
  const [activeTab, setActiveTab] = useState<'slots' | 'json'>('slots');
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  // 開いたときだけリセットするもの
  useEffect(() => {
    if (isOpen) {
      setSaveSuccessMsg(null);
      setDuplicateSlot(null);
    }
  }, [isOpen]);

  // 保存名の初期値（保存編成を読み込み中ならその名前、未保存なら「編成キャラ名 (時間)」）
  useEffect(() => {
    if (isOpen) {
      const slots = getSavedSlots();
      setSavedSlots(slots);
      const activeSlot = slots.find(s => s.id === activeSlotId) ?? null;
      setNewSlotName(buildDefaultSlotName(characters, totalDuration, activeSlot));
      // 保存編成を読み込み中なら、そのメモも初期値にする
      setNewSlotDesc(activeSlot?.description ?? '');
    }
  }, [isOpen, characters, totalDuration, activeSlotId]);

  if (!isOpen) return null;

  const totalActionsCount = stints.reduce((sum, s) => sum + s.actions.length, 0);
  const memberNames = buildPartyMemberNames(characters);

  // Save current as named slot (同名の編成がある場合は上書き確認)
  const handleSaveNew = (confirmedOverwrite?: SavedRotationSlot) => {
    const name = newSlotName.trim();
    if (!name) return;
    const dup = confirmedOverwrite ?? findSlotByName(savedSlots, name);
    if (dup && !confirmedOverwrite) {
      setDuplicateSlot(dup);
      return;
    }
    const newSlot: SavedRotationSlot = {
      id: dup ? dup.id : `slot_${Date.now()}`,
      name,
      description: newSlotDesc.trim() || undefined,
      updatedAt: new Date().toISOString(),
      party,
      stints,
      loopStartIndex,
      loopStartTime,
      totalDuration,
      switchDelay,
      reactions,
    };
    const saved = trySaveSlot(newSlot);
    if (!saved.ok) {
      showAlert(SLOT_WRITE_FAILED_MESSAGE);
      return;
    }
    const updated = saved.slots;
    setSavedSlots(updated);
    onSlotsChanged(updated, newSlot.id);
    setDuplicateSlot(null);
    setSaveSuccessMsg(dup ? t('save:message.overwritten', { name: newSlot.name }) : t('save:message.saved', { name: newSlot.name }));
    setTimeout(() => setSaveSuccessMsg(null), 3000);
  };

  // Overwrite existing slot
  const handleOverwrite = async (slot: SavedRotationSlot) => {
    const ok = await confirm(
      t('save:message.confirmOverwrite', { name: slot.name }),
      { okLabel: t('save:saveAs.overwrite'), danger: true },
    );
    if (!ok) return;
    const updatedSlot: SavedRotationSlot = {
      ...slot,
      party,
      stints,
      loopStartIndex,
      loopStartTime,
      totalDuration,
      switchDelay,
      reactions,
      updatedAt: new Date().toISOString(),
    };
    const saved = trySaveSlot(updatedSlot);
    if (!saved.ok) {
      showAlert(SLOT_WRITE_FAILED_MESSAGE);
      return;
    }
    const updated = saved.slots;
    setSavedSlots(updated);
    onSlotsChanged(updated, slot.id);
    setSaveSuccessMsg(t('save:message.overwritten', { name: slot.name }));
    setTimeout(() => setSaveSuccessMsg(null), 3000);
  };

  // プリセット編成（同梱の 5 編成）を、保存編成に復元する（同じ名前の保存編成は、上書き）
  const handleRestorePresets = async () => {
    const ok = await confirm(
      t('save:message.confirmRestorePresets', { count: PRESET_COUNT, prefix: PRESET_NAME_PREFIX }),
    );
    if (!ok) return;
    const result = restorePresets();
    setSavedSlots(result.slots);
    onSlotsChanged(result.slots);
    if (!result.ok) {
      showAlert(`${SLOT_WRITE_FAILED_MESSAGE}\n\n${t('save:message.presetsPartial', { added: result.added, overwritten: result.overwritten })}`);
      return;
    }
    setSaveSuccessMsg(t('save:message.presetsRestored', { count: PRESET_COUNT, added: result.added, overwritten: result.overwritten }));
    setTimeout(() => setSaveSuccessMsg(null), 4000);
  };

  // Delete slot
  const handleDelete = async (slotId: string, name: string) => {
    const ok = await confirm(
      t('save:message.confirmDelete', { name }),
      { okLabel: t('save:message.delete'), danger: true },
    );
    if (!ok) return;
    const deleted = tryDeleteSlot(slotId);
    if (!deleted.ok) {
      showAlert(SLOT_WRITE_FAILED_MESSAGE);
      return;
    }
    const updated = deleted.slots;
    setSavedSlots(updated);
    onSlotsChanged(updated);
    setSaveSuccessMsg(t('save:message.deleted', { name }));
    setTimeout(() => setSaveSuccessMsg(null), 3000);
  };

  // Load slot
  const handleLoad = (slot: SavedRotationSlot) => {
    onLoadSlot({
      party: slot.party,
      stints: slot.stints,
      loopStartIndex: slot.loopStartIndex,
      loopStartTime: slot.loopStartTime ?? 0,
      switchDelay: slot.switchDelay,
      reactions: slot.reactions,
      name: slot.name,
      slotId: slot.id,
    });
    onClose();
  };

  // Export slot or current rotation as JSON file
  /** 書き出し・コピーする内容（保存編成、または現在の編成）。ファイルとコピーで、同じ内容にする */
  const exportPayload = (slot?: SavedRotationSlot) => buildRotationExport(slot ?? {
    name: newSlotName || t('save:manager.defaultName'),
    party,
    stints,
    loopStartIndex,
    loopStartTime,
    totalDuration,
    switchDelay,
    reactions,
  });

  const handleExportJsonFile = (slot?: SavedRotationSlot) => {
    const payload = exportPayload(slot);

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = rotationFileName(slot?.name || newSlotName || buildDefaultSlotName(characters, totalDuration, savedSlots.find(s => s.id === activeSlotId)));
    a.click();
    URL.revokeObjectURL(url);
  };

  // Copy JSON to clipboard
  const handleCopyJson = async (slot?: SavedRotationSlot) => {
    const payload = exportPayload(slot);
    try {
      await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
    } catch (e) {
      // 許可がない・安全でない接続などで、コピーできないとき（コピーできたように見せない）
      showAlert(t('save:message.copyFailed', { message: e instanceof Error ? e.message : String(e) }));
      return;
    }
    const targetId = slot ? slot.id : 'current';
    setCopiedId(targetId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Import JSON from file
  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const result = parseRotationPayload(JSON.parse(ev.target?.result as string));
        if (result.ok === false) {
          showAlert(result.error);
          return;
        }
        const v = result.value;
        onLoadSlot({
          party: v.party,
          stints: v.stints,
          loopStartIndex: v.loopStartIndex,
          loopStartTime: v.loopStartTime ?? 0,
          name: v.name || nameFromFileName(file.name),
          totalDuration: v.totalDuration,
          switchDelay: v.switchDelay,
          reactions: v.reactions,
        });
        onClose();
        if (totalSkipped(result.skipped) > 0) showAlert(t('save:message.skipped', { items: describeSkipped(result.skipped) }));
      } catch (err) {
        showAlert(t('save:message.importFileFailed'));
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // 全データのバックアップ（全スロット・設定・利用者のデータ）の書き出し
  const handleExportBackup = () => {
    const backup = buildBackup();
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${APP_FILE_PREFIX}_${t('save:manager.backupFileLabel')}_${fileTimestamp()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    const s = summarizeBackup(backup);
    setSaveSuccessMsg(t('save:message.backupExported', { slots: s.slots, settings: s.settings, items: s.characters + s.weapons + s.artifacts }));
  };

  // 全データのバックアップの復元（確認 → 復元 → 画面の再読み込み）
  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const parsed = parseBackup(String(ev.target?.result ?? ''));
      if (!parsed.ok) {
        showAlert((parsed as { ok: false; error: string }).error);
        return;
      }
      const s = summarizeBackup(parsed.backup);
      const skippedCount = parsed.skipped.slots + parsed.skipped.items + parsed.skipped.rotationParts;
      const lines = [
        t('save:message.restoreIntro'),
        t('save:message.restoreSlots', { count: s.slots }),
        t('save:message.restoreSettings', { count: s.settings }),
        t('save:message.restoreItems', { characters: s.characters, weapons: s.weapons, artifacts: s.artifacts }),
        s.hasCurrentState ? t('save:message.restoreCurrent') : t('save:message.restoreNoCurrent'),
        ...(skippedCount > 0 ? [t('save:message.restoreSkipped', { count: skippedCount, slots: parsed.skipped.slots, items: parsed.skipped.items, parts: parsed.skipped.rotationParts })] : []),
        '',
        t('save:message.restoreConfirm'),
      ];
      if (!(await confirm(lines.join('\n')))) return;
      const result = restoreBackup(parsed.backup, { restoreCurrent: true });
      if (!result.ok) {
        showAlert(t('save:message.restoreFailed', { error: result.error ?? '' }));
        return;
      }
      window.location.reload();
    };
    reader.readAsText(file);
  };

  // Import JSON from text area
  const handleImportText = () => {
    try {
      const result = parseRotationPayload(JSON.parse(importJsonText.trim()));
      if (result.ok === false) {
        showAlert(result.error);
        return;
      }
      const v = result.value;
      onLoadSlot({
        party: v.party,
        stints: v.stints,
        loopStartIndex: v.loopStartIndex,
        loopStartTime: v.loopStartTime ?? 0,
        name: v.name,
        totalDuration: v.totalDuration,
        switchDelay: v.switchDelay,
        reactions: v.reactions,
      });
      onClose();
      if (totalSkipped(result.skipped) > 0) showAlert(t('save:message.skipped', { items: describeSkipped(result.skipped) }));
    } catch (err) {
      showAlert(t('save:message.invalidJson'));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
              <Save className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <span>{t('save:manager.title')}</span>
              </h2>
              <p className="text-xs text-slate-400">
                {t('save:manager.subtitle')}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Auto-save & Status Notice */}
        <div className="px-6 py-2.5 bg-emerald-950/40 border-b border-emerald-800/40 flex items-center justify-between text-xs text-emerald-300">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>
              <Trans i18nKey="save:manager.autoSave" components={{ strong: <strong /> }} />
            </span>
          </div>
          <div className="text-[11px] text-emerald-400/80 font-mono">
            {t('save:manager.current', { characters: characters.length, stints: stints.length, actions: totalActionsCount })}
          </div>
        </div>

        {saveSuccessMsg && (
          <div className="px-6 py-2 bg-amber-950/80 border-b border-amber-500/50 text-amber-300 text-xs font-bold flex items-center gap-2 animate-in fade-in">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span>{saveSuccessMsg}</span>
          </div>
        )}

        {/* Tabs */}
        <div className="flex border-b border-slate-800 px-6 pt-2 bg-slate-950/30 gap-2">
          <button
            onClick={() => setActiveTab('slots')}
            className={`px-4 py-2 text-xs font-bold rounded-t-lg transition-colors flex items-center gap-1.5 border-b-2 ${
              activeTab === 'slots'
                ? 'border-amber-400 text-amber-400 bg-slate-800/60'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <FolderOpen className="w-4 h-4" />
            <span>{t('save:manager.tabSlots', { count: savedSlots.length })}</span>
          </button>
          <button
            onClick={() => setActiveTab('json')}
            className={`px-4 py-2 text-xs font-bold rounded-t-lg transition-colors flex items-center gap-1.5 border-b-2 ${
              activeTab === 'json'
                ? 'border-amber-400 text-amber-400 bg-slate-800/60'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileCode className="w-4 h-4" />
            <span>{t('save:manager.tabJson')}</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {activeTab === 'slots' ? (
            <>
              {/* Section 1: Save Current as New Slot */}
              <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/80 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                    <Save className="w-4 h-4" />
                    <span>{t('save:manager.saveCurrent')}</span>
                  </h3>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {t('save:manager.totals', { total: totalDuration.toFixed(1), loopStart: loopStartTime.toFixed(1) })}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div className="sm:col-span-2">
                    <input
                      type="text"
                      value={newSlotName}
                      onChange={(e) => {
                        setNewSlotName(e.target.value);
                        setDuplicateSlot(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                          if (duplicateSlot) handleSaveNew(duplicateSlot);
                          else handleSaveNew();
                        }
                      }}
                      placeholder={t('save:saveAs.namePlaceholder')}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 font-medium"
                    />
                  </div>
                  <button
                    onClick={() => handleSaveNew()}
                    disabled={!newSlotName.trim() || !!duplicateSlot}
                    className="w-full bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold text-xs px-4 py-2 rounded-lg flex items-center justify-center gap-1.5 shadow transition-all"
                  >
                    <Save className="w-4 h-4" />
                    <span>{t('save:saveAs.save')}</span>
                  </button>
                </div>

                <div className="space-y-1.5">
                  <input
                    type="text"
                    value={newSlotDesc}
                    onChange={(e) => setNewSlotDesc(e.target.value)}
                    placeholder={t('save:manager.memoPlaceholder')}
                    className="w-full bg-slate-900/80 border border-slate-700/60 rounded-lg px-3 py-1.5 text-[11px] text-slate-300 placeholder-slate-500 focus:outline-none focus:border-amber-400"
                  />
                  <button
                    type="button"
                    onClick={() => setNewSlotDesc(memberNames)}
                    disabled={!memberNames}
                    className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors disabled:opacity-40 disabled:pointer-events-none"
                    title={memberNames ? t('save:saveAs.setMembersTitle', { names: memberNames }) : t('save:saveAs.noMembers')}
                  >
                    <Users className="w-3 h-3 text-amber-400" />
                    <span>{t('save:saveAs.setMembers')}</span>
                  </button>
                </div>

                {duplicateSlot && (
                  <div className="p-3 rounded-lg bg-amber-950/60 border border-amber-500/50 text-xs text-amber-200 flex flex-wrap items-center justify-between gap-2">
                    <span className="flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                      <span><Trans i18nKey="save:manager.duplicate" values={{ name: duplicateSlot.name }} components={{ strong: <strong /> }} /></span>
                    </span>
                    <span className="flex items-center gap-1.5">
                      <button
                        onClick={() => setDuplicateSlot(null)}
                        className="px-3 py-1 rounded-lg text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
                      >
                        {t('save:saveAs.back')}
                      </button>
                      <button
                        onClick={() => handleSaveNew(duplicateSlot)}
                        className="px-3 py-1 rounded-lg text-xs font-bold bg-red-600 hover:bg-red-500 text-white transition-colors shadow"
                      >
                        {t('save:saveAs.overwrite')}
                      </button>
                    </span>
                  </div>
                )}
              </div>

              {/* Section 2: Saved Custom Slots List */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                    <FolderOpen className="w-4 h-4 text-amber-400" />
                    <span>{t('save:manager.savedSlots')}</span>
                  </h3>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-slate-500">
                      {savedSlots.length === 0 ? t('save:manager.noSlots') : t('count', { count: savedSlots.length })}
                    </span>
                    <button
                      type="button"
                      onClick={handleRestorePresets}
                      className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-sky-500/15 hover:bg-sky-500/25 text-sky-300 border border-sky-500/40 transition-colors"
                      title={t('save:manager.restorePresetsTitle', { count: PRESET_COUNT, prefix: PRESET_NAME_PREFIX })}
                      data-testid="restore-presets"
                    >
                      {t('save:manager.restorePresets', { count: PRESET_COUNT })}
                    </button>
                  </div>
                </div>

                {savedSlots.length === 0 ? (
                  <div className="p-8 text-center border-2 border-dashed border-slate-800 rounded-xl bg-slate-900/30">
                    <FolderOpen className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                    <p className="text-xs text-slate-400">
                      {t('save:manager.emptyTitle')}
                    </p>
                    <p className="text-[11px] text-slate-500 mt-1">
                      {t('save:manager.emptyHint')}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {savedSlots.map((slot) => {
                      const dateStr = new Date(slot.updatedAt).toLocaleString(dateLocale, {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      });
                      const slotActionCount = slot.stints.reduce((sum, s) => sum + s.actions.length, 0);

                      return (
                        <div
                          key={slot.id}
                          className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700/80 hover:border-slate-600 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
                        >
                          <div className="space-y-1.5 min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-sm text-white">{slot.name}</span>
                              {staleReactionsBadge(slot.reactions)}
                              <span className="text-[10px] text-slate-400 font-mono bg-slate-900 px-1.5 py-0.5 rounded border border-slate-700">
                                {t('save:manager.slotSummary', { total: (slot.totalDuration ?? 0).toFixed(1), stints: slot.stints.length, actions: slotActionCount })}
                              </span>
                              <span className="text-[10px] text-slate-500">{dateStr}</span>
                            </div>

                            {slot.description && (
                              <p className="text-xs text-slate-300">{slot.description}</p>
                            )}

                            {/* Character Badges */}
                            <div className="flex items-center gap-1.5 pt-1">
                              {resolvePartyCharacters(slot.party, database.characters).filter(c => !isEmptySlotCharacter(c)).map((c) => (
                                <div
                                  key={c.id}
                                  className="flex items-center gap-1 bg-slate-900/80 border border-slate-700 px-1.5 py-0.5 rounded text-[10px] text-slate-300"
                                >
                                  <span
                                    className="w-2 h-2 rounded-full shrink-0"
                                    style={{ backgroundColor: c.color }}
                                  />
                                  <span>{charName(c)}</span>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Action Buttons */}
                          <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                            <button
                              onClick={() => handleLoad(slot)}
                              className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-lg flex items-center gap-1 shadow transition-colors"
                              title={t('save:manager.loadTitle')}
                            >
                              <FolderOpen className="w-3.5 h-3.5" />
                              <span>{t('save:manager.load')}</span>
                            </button>
                            <button
                              onClick={() => handleOverwrite(slot)}
                              className="px-2.5 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs rounded-lg flex items-center gap-1 transition-colors"
                              title={t('save:manager.overwriteTitle')}
                            >
                              <Save className="w-3.5 h-3.5 text-amber-400" />
                              <span>{t('save:manager.overwrite')}</span>
                            </button>
                            <button
                              onClick={() => handleCopyJson(slot)}
                              className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition-colors"
                              title={t('save:manager.copyJsonTitle')}
                            >
                              {copiedId === slot.id ? (
                                <Check className="w-4 h-4 text-emerald-400" />
                              ) : (
                                <Copy className="w-4 h-4" />
                              )}
                            </button>
                            <button
                              onClick={() => handleExportJsonFile(slot)}
                              className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition-colors"
                              title={t('save:manager.downloadJsonTitle')}
                            >
                              <Download className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(slot.id, slot.name)}
                              className="p-1.5 bg-slate-800 hover:bg-red-950 text-slate-400 hover:text-red-400 rounded-lg transition-colors"
                              title={t('save:manager.deleteTitle')}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          ) : (
            /* JSON Tab */
            <div className="space-y-4">
              {/* 全データのバックアップ（引っ越し・端末の変更・配信先の移行用） */}
              <div className="p-4 rounded-xl bg-amber-950/20 border border-amber-700/40 space-y-3">
                <div>
                  <h4 className="text-xs font-bold text-amber-200">{t('save:manager.backupTitle')}</h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {t('save:manager.backupDescription')}
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    onClick={handleExportBackup}
                    className="p-3 rounded-lg bg-slate-800/70 border border-slate-700 hover:border-amber-400 transition-all flex items-center gap-2 text-left"
                  >
                    <Download className="w-4 h-4 text-amber-400" />
                    <span className="text-xs font-bold text-white">{t('save:manager.exportAll')}</span>
                  </button>
                  <label className="p-3 rounded-lg bg-slate-800/70 border border-slate-700 hover:border-sky-400 transition-all flex items-center gap-2 cursor-pointer">
                    <Upload className="w-4 h-4 text-sky-400" />
                    <span className="text-xs font-bold text-white">{t('save:manager.restoreBackup')}</span>
                    <input type="file" accept=".json" onChange={handleImportBackup} className="hidden" />
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  onClick={() => handleExportJsonFile()}
                  className="p-4 rounded-xl bg-slate-800/60 border border-slate-700 hover:border-amber-400 transition-all flex items-center gap-3 text-left group"
                >
                  <div className="p-2.5 rounded-lg bg-amber-500/10 text-amber-400 group-hover:bg-amber-500 group-hover:text-slate-950 transition-colors">
                    <Download className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-xs text-white">{t('save:manager.exportJson')}</h4>
                    <p className="text-[11px] text-slate-400">
                      {t('save:manager.exportJsonHint')}
                    </p>
                  </div>
                </button>

                <label className="p-4 rounded-xl bg-slate-800/60 border border-slate-700 hover:border-amber-400 transition-all flex items-center gap-3 cursor-pointer group">
                  <div className="p-2.5 rounded-lg bg-sky-500/10 text-sky-400 group-hover:bg-sky-500 group-hover:text-slate-950 transition-colors">
                    <Upload className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-xs text-white">{t('save:manager.importJson')}</h4>
                    <p className="text-[11px] text-slate-400">
                      {t('save:manager.importJsonHint')}
                    </p>
                  </div>
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleImportFile}
                    className="hidden"
                  />
                </label>
              </div>

              {/* Direct JSON Text Area */}
              <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/80 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                    <FileCode className="w-4 h-4 text-amber-400" />
                    <span>{t('save:manager.jsonText')}</span>
                  </h4>
                  <button
                    onClick={() => handleCopyJson()}
                    className="text-xs text-amber-400 hover:text-amber-300 font-semibold flex items-center gap-1"
                  >
                    {copiedId === 'current' ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span>{t('header:menu.copied')}</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>{t('save:manager.copyCurrentJson')}</span>
                      </>
                    )}
                  </button>
                </div>

                <textarea
                  rows={6}
                  value={importJsonText}
                  onChange={(e) => setImportJsonText(e.target.value)}
                  placeholder={t('save:manager.jsonPlaceholder')}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-xs font-mono text-slate-200 placeholder-slate-600 focus:outline-none focus:border-amber-400"
                />

                <div className="flex justify-end">
                  <button
                    onClick={handleImportText}
                    disabled={!importJsonText.trim()}
                    className="bg-sky-600 hover:bg-sky-500 disabled:opacity-40 text-white font-bold text-xs px-4 py-2 rounded-lg flex items-center gap-1.5 transition-colors"
                  >
                    <Upload className="w-4 h-4" />
                    <span>{t('save:manager.restoreFromText')}</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-3 border-t border-slate-800 bg-slate-950/70">
          <button
            onClick={async () => {
              if (await confirm(t('save:message.confirmReset'), { danger: true })) {
                clearActiveState();
                onResetToDefault();
                onClose();
              }
            }}
            className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1.5 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>{t('save:manager.reset')}</span>
          </button>

          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg transition-colors"
          >
            {t('action.close')}
          </button>
        </div>
      </div>
    </div>
  );
};
