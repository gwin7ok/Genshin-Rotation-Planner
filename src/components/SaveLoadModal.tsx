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
  Pencil,
  ChevronRight
} from 'lucide-react';
import { RenameSlotDialog } from './RenameSlotDialog';
import { CharacterConfig, PartyMember, Stint, SavedRotationSlot, SavedReactions } from '../types/genshin';
import { PRESET_COUNT, presetNamePrefixLabel, restorePresets, slotDisplayDescription, slotDisplayName } from '../utils/presets';
import { useDialogs } from './DialogProvider';
import { Trans } from 'react-i18next';
import { t, dateLocale } from '../i18n';
import { staleReactionsBadge } from './StaleReactionsBadge';
import { AppDatabase } from '../types/database';
import { resolvePartyCharacters } from '../utils/party';
import { isEmptySlotCharacter } from '../data/characters';
import { rotationFileName, buildRotationExport, APP_FILE_PREFIX, fileTimestamp } from '../utils/rotationFile';
import { buildBackup, parseBackup, summarizeBackup, restoreBackup } from '../utils/backup';
import { getSavedSlots, replaceSavedSlots, trySaveSlot, tryDeleteSlot, SLOT_WRITE_FAILED_MESSAGE, clearActiveState, buildDefaultSlotName, findSlotByName, buildPartyMemberNames } from '../utils/storage';
import { charName } from '../i18n/loc';
import { DRIVE_FOLDER_NAME, DriveError, ensureSignedIn, isDriveConfigured, uploadSharedJson } from '../utils/googleDrive';
import { buildImportLink } from '../utils/rotationUrlImport';
import { parseGcsimConfig } from '../utils/gcsim/parseGcsimConfig';
import { describeIgnored } from '../utils/gcsim/describeIgnored';

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
  /** JSON の文字列を読み込む（検証・確認・読み込みは App と共通）。読み込みを始めたら true */
  onImportText: (text: string, fileName?: string) => boolean;
  /** 現在の編成を gcsim の設定文にしてコピーする（ヘッダーのボタンと同じ処理。書き出しの区画から呼ぶ） */
  onCopyGcsimConfig?: () => void;
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
  onImportText,
  onCopyGcsimConfig,
}) => {
  const { confirm, alert: showAlert, prompt } = useDialogs();
  const [savedSlots, setSavedSlots] = useState<SavedRotationSlot[]>([]);
  const [newSlotName, setNewSlotName] = useState('');
  const [newSlotDesc, setNewSlotDesc] = useState('');
  // 同じ編成名の既存スロット（上書き確認中）
  const [duplicateSlot, setDuplicateSlot] = useState<SavedRotationSlot | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  // 名前を変更中の保存編成
  const [renamingSlot, setRenamingSlot] = useState<SavedRotationSlot | null>(null);
  // gcsim の設定文から読み込む（D326）
  const [gcsimText, setGcsimText] = useState('');
  const [showJsonArea, setShowJsonArea] = useState(false);
  const [activeTab, setActiveTab] = useState<'slots' | 'json'>('slots');
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  // 編成付き読込 URL の生成中（D325）
  const [sharing, setSharing] = useState(false);

  // 開いたときだけリセットするもの
  useEffect(() => {
    if (isOpen) {
      setSaveSuccessMsg(null);
      setDuplicateSlot(null);
      setRenamingSlot(null);
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

  // 保存編成の名前を変える（内容・更新日時は、そのまま）
  const handleRename = (slot: SavedRotationSlot, newName: string) => {
    // 保存直前に、最新の一覧で同名を確認する（ほかのタブでの変更に備える）
    const dup = findSlotByName(getSavedSlots(), newName);
    if (dup && dup.id !== slot.id) {
      setSavedSlots(getSavedSlots());
      return;
    }
    // 更新日時・並び順は変えない（trySaveSlot は日時を現在にするので使わない）
    const updated = getSavedSlots().map(s => (s.id === slot.id ? { ...s, name: newName } : s));
    if (!replaceSavedSlots(updated)) {
      showAlert(SLOT_WRITE_FAILED_MESSAGE);
      return;
    }
    setSavedSlots(updated);
    onSlotsChanged(updated);
    setRenamingSlot(null);
    setSaveSuccessMsg(t('save:rename.renamed', { name: newName }));
    setTimeout(() => setSaveSuccessMsg(null), 3000);
  };

  // Overwrite existing slot
  const handleOverwrite = async (slot: SavedRotationSlot) => {
    const ok = await confirm(
      t('save:message.confirmOverwrite', { name: slotDisplayName(slot) }),
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
    setSaveSuccessMsg(t('save:message.overwritten', { name: slotDisplayName(slot) }));
    setTimeout(() => setSaveSuccessMsg(null), 3000);
  };

  // プリセット編成（同梱の 5 編成）を、保存編成に復元する（同じ名前の保存編成は、上書き）
  const handleRestorePresets = async () => {
    const ok = await confirm(
      t('save:message.confirmRestorePresets', { count: PRESET_COUNT, prefix: presetNamePrefixLabel() }),
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

  // 編成付き読込 URL の生成（D325）: ログイン → 名前の入力 → Google ドライブに共有（リンクを知っている全員が閲覧可）で保存 → URL をコピー
  const handleShareUrl = async () => {
    if (sharing) return;
    if (!isDriveConfigured()) {
      showAlert(t('save:share.notConfigured'));
      return;
    }
    setSharing(true);
    try {
      // ログインのポップアップは、ボタンを押した直後でないとブロックされるので、名前の入力より先に行う
      const accessToken = await ensureSignedIn();
      const activeSlot = savedSlots.find(s => s.id === activeSlotId) ?? null;
      const defaultName = activeSlot ? slotDisplayName(activeSlot) : buildDefaultSlotName(characters, totalDuration, null);
      const input = await prompt(t('save:share.namePrompt'), defaultName);
      if (input === null || !input.trim()) return;
      const name = input.trim();
      const payload = exportPayload();
      payload.name = name;
      const fileName = `${name.replace(/[\/:*?"<>|]/g, '_')}.json`;
      const shareLink = await uploadSharedJson(accessToken, fileName, JSON.stringify(payload, null, 2));
      const url = buildImportLink(shareLink);
      try {
        await navigator.clipboard.writeText(url);
        showAlert(t('save:share.done', { name: fileName, folder: DRIVE_FOLDER_NAME }));
      } catch {
        // ログインや保存の待ちの間に、コピーの許可が切れることがある。URL を見せて、手でコピーしてもらう
        showAlert(t('save:share.copyFailed', { url }));
      }
    } catch (e) {
      const reason = e instanceof DriveError ? e.reason : 'api';
      const detail = e instanceof DriveError ? e.detail : String(e);
      showAlert(t(`save:share.error.${reason}` as 'save:share.error.api', { detail }));
    } finally {
      setSharing(false);
    }
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

  // Import JSON from file（検証・読み込みは、App の importRotationText と共通）
  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      if (onImportText(String(ev.target?.result ?? ''), file.name)) onClose();
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

  // gcsim の設定文から、編成と行動の並びを読み込む（D326）。適用の前に、読み取った内容と、読めなかった行の一覧を見せて確認する
  const handleImportGcsim = async () => {
    const result = parseGcsimConfig(gcsimText, { characters: database.characters, weapons: database.weapons, artifacts: database.artifacts });
    if (result.ok === false) {
      showAlert(result.error);
      return;
    }
    const v = result.value;
    const name = v.name || t('save:gcsimImport.defaultName');
    const actions = v.stints.reduce((n, s) => n + s.actions.filter(a => a.type !== 'wait').length, 0);
    const chars = v.party.filter(m => !m.characterId.startsWith('empty_slot_')).length;
    const lines = [t('save:gcsimImport.confirm', { name, chars, actions })];
    if (v.ignored.length > 0) lines.push('', describeIgnored(v.ignored));
    if (!(await confirm(lines.join('\n')))) return;
    onLoadSlot({
      party: v.party,
      stints: v.stints,
      loopStartIndex: v.loopStartIndex,
      loopStartTime: 0,
      switchDelay: v.switchDelay,
      name,
    });
    onClose();
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
                      <span><Trans i18nKey="save:manager.duplicate" values={{ name: slotDisplayName(duplicateSlot) }} components={{ strong: <strong /> }} /></span>
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
                      title={t('save:manager.restorePresetsTitle', { count: PRESET_COUNT, prefix: presetNamePrefixLabel() })}
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
                              <span className="font-bold text-sm text-white">{slotDisplayName(slot)}</span>
                              {staleReactionsBadge(slot.reactions)}
                              <span className="text-[10px] text-slate-400 font-mono bg-slate-900 px-1.5 py-0.5 rounded border border-slate-700">
                                {t('save:manager.slotSummary', { total: (slot.totalDuration ?? 0).toFixed(1), stints: slot.stints.length, actions: slotActionCount })}
                              </span>
                              <span className="text-[10px] text-slate-500">{dateStr}</span>
                            </div>

                            {slot.description && (
                              <p className="text-xs text-slate-300">{slotDisplayDescription(slot, database.characters)}</p>
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
                              onClick={() => setRenamingSlot(slot)}
                              className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition-colors"
                              title={t('save:manager.renameTitle')}
                              data-testid="rename-slot"
                            >
                              <Pencil className="w-4 h-4" />
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
                              onClick={() => handleDelete(slot.id, slotDisplayName(slot))}
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
              {/* 読み込み（外から、この編成に取り込む） */}
              <section className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/80 space-y-4">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Upload className="w-4 h-4 text-sky-400" />
                    <span>{t('save:manager.importSection')}</span>
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-1">{t('save:manager.importNotice')}</p>
                </div>

                <div className="space-y-2">
                  <div className="text-xs font-bold text-slate-300">{t('save:manager.formatJson')}</div>
                  <label className="p-3 rounded-lg bg-slate-800/70 border border-slate-700 hover:border-sky-400 transition-all flex items-center gap-2 cursor-pointer">
                    <Upload className="w-4 h-4 text-sky-400" />
                    <span className="text-xs font-bold text-white">{t('save:manager.importJson')}</span>
                    <span className="text-[11px] text-slate-400">{t('save:manager.importJsonHint')}</span>
                    <input
                      type="file"
                      accept=".json"
                      onChange={handleImportFile}
                      className="hidden"
                    />
                  </label>
                </div>

                <div className="space-y-2 border-t border-slate-800 pt-3">
                  <div className="text-xs font-bold text-slate-300">{t('save:manager.formatGcsim')}</div>
                  <p className="text-[11px] text-slate-500">{t('save:gcsimImport.hint')}</p>
                  <textarea
                    rows={5}
                    value={gcsimText}
                    onChange={(e) => setGcsimText(e.target.value)}
                    placeholder={t('save:gcsimImport.placeholder')}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-xs font-mono text-slate-200 placeholder-slate-600 focus:outline-none focus:border-amber-400"
                  />
                  <div className="flex justify-end">
                    <button
                      onClick={handleImportGcsim}
                      disabled={!gcsimText.trim()}
                      className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-bold text-xs px-4 py-2 rounded-lg flex items-center gap-1.5 transition-colors"
                    >
                      <FileCode className="w-4 h-4" />
                      <span>{t('save:gcsimImport.run')}</span>
                    </button>
                  </div>
                </div>
              </section>

              {/* 書き出し（この編成を、外に出す） */}
              <section className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/80 space-y-4">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Download className="w-4 h-4 text-amber-400" />
                  <span>{t('save:manager.exportSection')}</span>
                </h3>

                <div className="space-y-2">
                  <div className="text-xs font-bold text-slate-300">{t('save:manager.formatJson')}</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                      onClick={() => handleExportJsonFile()}
                      title={t('save:manager.exportJsonHint')}
                      className="p-3 rounded-lg bg-slate-800/70 border border-slate-700 hover:border-amber-400 transition-all flex items-center gap-2 text-left"
                    >
                      <Download className="w-4 h-4 text-amber-400" />
                      <span className="text-xs font-bold text-white">{t('save:manager.exportJson')}</span>
                    </button>
                    <button
                      onClick={() => handleCopyJson()}
                      className="p-3 rounded-lg bg-slate-800/70 border border-slate-700 hover:border-amber-400 transition-all flex items-center gap-2 text-left"
                    >
                      {copiedId === 'current' ? (
                        <>
                          <Check className="w-4 h-4 text-emerald-400" />
                          <span className="text-xs font-bold text-white">{t('header:menu.copied')}</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4 text-amber-400" />
                          <span className="text-xs font-bold text-white">{t('save:manager.copyCurrentJson')}</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="text-xs font-bold text-slate-300">{t('save:manager.formatShare')}</div>
                  <button
                    onClick={handleShareUrl}
                    disabled={sharing}
                    title={t('save:share.hint')}
                    className="w-full text-xs text-sky-300 hover:text-sky-200 font-semibold flex items-center justify-center gap-1.5 py-2 rounded-lg border border-sky-500/30 bg-sky-500/10 disabled:opacity-50"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>{sharing ? t('save:share.working') : t('save:share.button')}</span>
                  </button>
                </div>

                {onCopyGcsimConfig && (
                  <div className="space-y-2">
                    <div className="text-xs font-bold text-slate-300">{t('save:manager.formatGcsim')}</div>
                    <button
                      onClick={() => { onCopyGcsimConfig(); onClose(); }}
                      className="w-full p-3 rounded-lg bg-slate-800/70 border border-slate-700 hover:border-emerald-400 transition-all flex items-center gap-2 text-left"
                    >
                      <Copy className="w-4 h-4 text-emerald-400" />
                      <span className="text-xs font-bold text-white">{t('save:manager.copyGcsim')}</span>
                    </button>
                  </div>
                )}
              </section>

              {/* 全データのバックアップ（引っ越し・端末の変更・配信先の移行用） */}
              <section className="p-4 rounded-xl bg-amber-950/20 border border-amber-700/40 space-y-3">
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
              </section>
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

      <RenameSlotDialog
        slot={renamingSlot}
        initialName={renamingSlot ? slotDisplayName(renamingSlot) : ''}
        savedSlots={savedSlots}
        onClose={() => setRenamingSlot(null)}
        onRename={handleRename}
      />
    </div>
  );
};
