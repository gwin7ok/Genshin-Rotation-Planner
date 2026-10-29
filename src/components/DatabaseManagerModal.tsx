import { GcsimMissingBadge } from './GcsimMissingBadge';
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  X, Database, Search, Plus, Edit2, Trash2, RefreshCw, Download, Upload, 
  Sparkles, Check, AlertTriangle, Shield, Zap, Sword, RotateCcw, Lock
} from 'lucide-react';
import { AppDatabase, WeaponDatabaseItem, ArtifactSetDatabaseItem } from '../types/database';
import { CharacterConfig, ElementType, WeaponType } from '../types/genshin';
import { t } from '../i18n';
import { weaponTypeLabel } from '../i18n/labels';
import { formatCharacterCooldowns } from '../utils/characterActions';
import { compareIdDesc } from '../utils/idSort';
import { parseDatabaseFile } from '../utils/databaseImport';
import { CharacterFilterBar, matchesCharacterFilter, ElementChip, WeaponChip } from './CharacterFilterBar';
import type { CharacterGenerationReport, GenerationProgress } from '../masterdata/characterMasterGenerator';
import type { 
  EquipmentGenerationProgress, 
  WeaponGenerationReport, 
  ArtifactGenerationReport 
} from '../masterdata/equipmentMasterGenerator';
import { 
  syncCharactersMasterOnline,
  syncWeaponsMasterOnline,
  syncArtifactsMasterOnline,
  setCharacterLockInDb,
  setWeaponLockInDb,
  setArtifactLockInDb,
  resetDatabaseToMaster, 
  upsertCharacterInDb, 
  deleteCharacterFromDb,
  deleteAllCharactersFromDb,
  deleteAllWeaponsFromDb,
  deleteAllArtifactsFromDb,
  clearAllDatabaseData,
  upsertWeaponInDb,
  deleteWeaponFromDb,
  upsertArtifactInDb,
  deleteArtifactFromDb,
  saveDatabase
} from '../utils/databaseService';

import { ItemLockButton } from './database/ItemLockButton';
import { DatabaseWeaponCardItem } from './database/DatabaseWeaponCardItem';
import { EditCharacterSubModal } from './database/EditCharacterSubModal';
import { EditWeaponSubModal } from './database/EditWeaponSubModal';
import { EditArtifactSubModal } from './database/EditArtifactSubModal';
import { charName, loc, frameSourceOf } from '../i18n/loc';

interface DatabaseManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  database: AppDatabase;
  onUpdateDatabase: (newDb: AppDatabase) => void;
}

type TabType = 'characters' | 'weapons' | 'artifacts' | 'sync';

export const DatabaseManagerModal: React.FC<DatabaseManagerModalProps> = ({
  isOpen,
  onClose,
  database,
  onUpdateDatabase,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('characters');
  const [searchQuery, setSearchQuery] = useState('');
  const [elementFilter, setElementFilter] = useState<ElementType | 'all'>('all');
  const [weaponTypeFilter, setWeaponTypeFilter] = useState<WeaponType | 'all'>('all');
  // ロック中のものだけを表示（キャラ・武器・聖遺物タブ共通）
  const [lockedOnly, setLockedOnly] = useState(false);
  // gcsim に未実装（genshin-db にあって gcsim にキーが無い）ものだけを表示（キャラ・武器・聖遺物タブ共通）。カスタムは対象外
  const [gcsimMissingOnly, setGcsimMissingOnly] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  // どの生成を実行中か（回転するアイコンを、押したボタンの種類だけにする。issue #2）
  const [syncingKind, setSyncingKind] = useState<'character' | 'weapon' | 'artifact' | null>(null);
  const [syncSuccessMsg, setSyncSuccessMsg] = useState<string | null>(null);
  // 通知は、新しい通知が出たら前のタイマーを止める（前のタイマーが、新しい通知を早く消さないように）
  const statusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 通知の種類（成功は緑・エラーは赤の枠で出す）
  const [statusKind, setStatusKind] = useState<'success' | 'error'>('success');
  const showStatus = (msg: string | null, clearAfterMs?: number, kind: 'success' | 'error' = 'success') => {
    if (statusTimerRef.current) clearTimeout(statusTimerRef.current);
    statusTimerRef.current = null;
    setStatusKind(kind);
    setSyncSuccessMsg(msg);
    if (msg !== null && clearAfterMs) statusTimerRef.current = setTimeout(() => setSyncSuccessMsg(null), clearAfterMs);
  };
  useEffect(() => () => { if (statusTimerRef.current) clearTimeout(statusTimerRef.current); }, []);
  // 「最新データ（キャラ・武器・聖遺物）をオンライン生成」（3 種を順に再生成）の、実行中の段階と、失敗の表示
  const [bulkStep, setBulkStep] = useState<{ index: number; label: string } | null>(null);
  const [bulkError, setBulkError] = useState<string | null>(null);

  // Character Sync State
  const [charSyncProgress, setCharSyncProgress] = useState<GenerationProgress | null>(null);
  const [charSyncReport, setCharSyncReport] = useState<CharacterGenerationReport | null>(null);
  const [charSyncError, setCharSyncError] = useState<string | null>(null);

  // Weapon Sync State
  const [weaponSyncProgress, setWeaponSyncProgress] = useState<EquipmentGenerationProgress | null>(null);
  const [weaponSyncReport, setWeaponSyncReport] = useState<WeaponGenerationReport | null>(null);
  const [weaponSyncError, setWeaponSyncError] = useState<string | null>(null);

  // Artifact Sync State
  const [artifactSyncProgress, setArtifactSyncProgress] = useState<EquipmentGenerationProgress | null>(null);
  const [artifactSyncReport, setArtifactSyncReport] = useState<ArtifactGenerationReport | null>(null);
  const [artifactSyncError, setArtifactSyncError] = useState<string | null>(null);

  // Edit sub-modals state
  const [editingCharacter, setEditingCharacter] = useState<CharacterConfig | null>(null);
  const [editingWeapon, setEditingWeapon] = useState<WeaponDatabaseItem | null>(null);
  const [editingArtifact, setEditingArtifact] = useState<ArtifactSetDatabaseItem | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const [confirmDialog, setConfirmDialog] = useState<{
    title: string;
    message: string;
    confirmText: string;
    confirmColor?: 'red' | 'amber' | 'rose';
    onConfirm: () => void;
  } | null>(null);

  // 絞り込み・並べ替え・ロック数: 検索文字・絞り込み・データが変わったときだけ計算する
  // （入力欄に 1 文字打つたび・ほかの状態が変わるたびに、全件を並べ替え直さない）。早期 return（開いていないとき）より前に置く
  const lockedCharCount = useMemo(() => database.characters.filter(c => c.isLocked).length, [database.characters]);
  const lockedWeaponCount = useMemo(() => database.weapons.filter(w => w.isLocked).length, [database.weapons]);
  const lockedArtifactCount = useMemo(() => database.artifacts.filter(a => a.isLocked).length, [database.artifacts]);

  const filteredCharacters = useMemo(() => database.characters.filter(c => {
    const q = searchQuery.toLowerCase();
    const matchesSearch = c.name.toLowerCase().includes(q) || c.id.toLowerCase().includes(q) || (c.englishName ?? '').toLowerCase().includes(q) || (c.en?.name ?? '').toLowerCase().includes(q);
    const matchesFilter = matchesCharacterFilter(c, elementFilter, weaponTypeFilter);
    return matchesSearch && matchesFilter && (!lockedOnly || !!c.isLocked) && (!gcsimMissingOnly || (!c.source?.gcsimKey && !c.isCustom && !c.id.startsWith('custom_')));
  }), [database.characters, searchQuery, elementFilter, weaponTypeFilter, lockedOnly, gcsimMissingOnly]);

  const filteredWeapons = useMemo(() => database.weapons
    .filter(w => {
      const matchesSearch = w.name.toLowerCase().includes(searchQuery.toLowerCase()) || (w.en?.name ?? w.englishName ?? '').toLowerCase().includes(searchQuery.toLowerCase()) || w.passiveName.toLowerCase().includes(searchQuery.toLowerCase()) || (w.id ?? '').includes(searchQuery);
      const matchesWeapon = weaponTypeFilter === 'all' || w.weaponType === weaponTypeFilter;
      return matchesSearch && matchesWeapon && (!lockedOnly || !!w.isLocked) && (!gcsimMissingOnly || (!w.gcsimKey && !w.isCustom));
    })
    .sort((a, b) => compareIdDesc(a.id, b.id)), [database.weapons, searchQuery, weaponTypeFilter, lockedOnly, gcsimMissingOnly]);

  const filteredArtifacts = useMemo(() => database.artifacts
    .filter(a => {
      if (lockedOnly && !a.isLocked) return false;
      if (gcsimMissingOnly && (a.gcsimKey || a.isCustom)) return false;
      return a.name.toLowerCase().includes(searchQuery.toLowerCase()) || (a.en?.name ?? a.englishName ?? '').toLowerCase().includes(searchQuery.toLowerCase()) || a.effect2p.toLowerCase().includes(searchQuery.toLowerCase()) || a.effect4p.toLowerCase().includes(searchQuery.toLowerCase()) || (a.id ?? '').includes(searchQuery);
    })
    .sort((a, b) => compareIdDesc(a.id, b.id)), [database.artifacts, searchQuery, lockedOnly, gcsimMissingOnly]);

  if (!isOpen) return null;

  // Dynamic Generation & Sync: Characters (genshin-db API + gcsim をネットから取得して生成)
  const handleSyncCharacters = async () => {
    setIsSyncing(true);
    setSyncingKind('character');
    showStatus(null);
    setCharSyncError(null);
    setCharSyncReport(null);
    try {
      const { db, report } = await syncCharactersMasterOnline(database, setCharSyncProgress);
      onUpdateDatabase(db);
      setCharSyncReport(report);
      showStatus(t('database:manager.charGenerated', { total: report.totalCharacters, withFrames: report.charactersWithFrames }), 5000);
    } catch (e) {
      setCharSyncError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsSyncing(false);
      setSyncingKind(null);
      setCharSyncProgress(null);
    }
  };

  // Dynamic Generation & Sync: Weapons (genshin-db API からオンライン取得・解析して生成)
  const handleSyncWeapons = async () => {
    setIsSyncing(true);
    setSyncingKind('weapon');
    showStatus(null);
    setWeaponSyncError(null);
    setWeaponSyncReport(null);
    try {
      const { db, report } = await syncWeaponsMasterOnline(database, setWeaponSyncProgress);
      onUpdateDatabase(db);
      setWeaponSyncReport(report);
      showStatus(t('database:manager.weaponGenerated', { total: report.totalWeapons, withBuffs: report.weaponsWithBuffs }), 5000);
    } catch (e) {
      setWeaponSyncError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsSyncing(false);
      setSyncingKind(null);
      setWeaponSyncProgress(null);
    }
  };

  // Dynamic Generation & Sync: Artifacts (genshin-db API からオンライン取得・解析して生成)
  const handleSyncArtifacts = async () => {
    setIsSyncing(true);
    setSyncingKind('artifact');
    showStatus(null);
    setArtifactSyncError(null);
    setArtifactSyncReport(null);
    try {
      const { db, report } = await syncArtifactsMasterOnline(database, setArtifactSyncProgress);
      onUpdateDatabase(db);
      setArtifactSyncReport(report);
      showStatus(t('database:manager.artifactGenerated', { total: report.totalArtifacts, withBuffs: report.artifactsWithBuffs }), 5000);
    } catch (e) {
      setArtifactSyncError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsSyncing(false);
      setSyncingKind(null);
      setArtifactSyncProgress(null);
    }
  };

  // 3 種（キャラクター → 武器 → 聖遺物）を順に、オンライン生成して上書きする。
  // 生成のたびに、結果を DB に反映・保存する（途中で失敗しても、成功した分は残る）。ロック中・カスタムは上書きしない。
  const handleSyncAll = async () => {
    setIsSyncing(true);
    showStatus(null);
    setBulkError(null);
    setCharSyncError(null);
    setCharSyncReport(null);
    setWeaponSyncError(null);
    setWeaponSyncReport(null);
    setArtifactSyncError(null);
    setArtifactSyncReport(null);
    let step = '';
    try {
      let db = database;

      step = t('database:manager.stepCharacters');
      setBulkStep({ index: 1, label: step });
      setSyncingKind('character');
      const c = await syncCharactersMasterOnline(db, setCharSyncProgress);
      db = c.db;
      onUpdateDatabase(db);
      setCharSyncReport(c.report);
      setCharSyncProgress(null);

      step = t('database:manager.stepWeapons');
      setBulkStep({ index: 2, label: step });
      setSyncingKind('weapon');
      const w = await syncWeaponsMasterOnline(db, setWeaponSyncProgress);
      db = w.db;
      onUpdateDatabase(db);
      setWeaponSyncReport(w.report);
      setWeaponSyncProgress(null);

      step = t('database:manager.stepArtifacts');
      setBulkStep({ index: 3, label: step });
      setSyncingKind('artifact');
      const a = await syncArtifactsMasterOnline(db, setArtifactSyncProgress);
      db = a.db;
      onUpdateDatabase(db);
      setArtifactSyncReport(a.report);

      showStatus(t('database:manager.bulkGenerated', { characters: c.report.totalCharacters, weapons: w.report.totalWeapons, artifacts: a.report.totalArtifacts }), 6000);
    } catch (e) {
      setBulkError(t('database:manager.bulkFailed', { step, message: e instanceof Error ? e.message : String(e) }));
    } finally {
      setIsSyncing(false);
      setSyncingKind(null);
      setBulkStep(null);
      setCharSyncProgress(null);
      setWeaponSyncProgress(null);
      setArtifactSyncProgress(null);
    }
  };

  // Full reset
  const handleFullReset = () => {
    setConfirmDialog({
      title: t('database:manager.resetTitle'),
      message: t('database:manager.resetMessage'),
      confirmText: t('database:manager.resetTitle'),
      confirmColor: 'amber',
      onConfirm: () => {
        const reset = resetDatabaseToMaster();
        onUpdateDatabase(reset);
        setConfirmDialog(null);
        showStatus(t('database:manager.resetDone'), 4000);
      }
    });
  };

  // Export JSON
  const handleExportJson = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(database, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `genshin_db_export_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Import JSON
  const handleImportJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const showMsg = (msg: string) => showStatus(msg, 4000);
      const showError = (msg: string) => showStatus(msg, 10000, 'error');
      const parsed = parseDatabaseFile(String(event.target?.result ?? ''));
      if (!parsed.ok) {
        showError(t('database:manager.importFailed', { error: (parsed as { ok: false; error: string }).error }));
        return;
      }
      const { db, counts, skipped } = parsed;
      setConfirmDialog({
        title: t('database:manager.restoreTitle'),
        message: [
          t('database:manager.restoreIntro'),
          t('database:manager.restoreNow', { characters: database.characters.length, weapons: database.weapons.length, artifacts: database.artifacts.length }),
          t('database:manager.restoreFile', { characters: counts.characters, weapons: counts.weapons, artifacts: counts.artifacts }),
          ...(skipped > 0 ? [t('database:manager.restoreSkipped', { count: skipped })] : []),
          '',
          t('database:manager.restoreBackupHint'),
        ].join('\n'),
        confirmText: t('database:manager.replace'),
        confirmColor: 'amber',
        onConfirm: () => {
          setConfirmDialog(null);
          if (!saveDatabase(db)) {
            showError(t('database:manager.saveFailed'));
            return;
          }
          onUpdateDatabase(db);
          showMsg(skipped > 0 ? t('database:manager.restoredSkipped', { count: skipped }) : t('database:manager.restored'));
        },
      });
    };
    reader.readAsText(file);
    if (e.target) e.target.value = '';
  };

  // ロック状態（最新マスター同期で上書きしない・一括削除/全クリアで消さない）

  const handleToggleCharLock = (id: string, locked: boolean) => {
    onUpdateDatabase(setCharacterLockInDb(database, id, locked));
  };
  const handleToggleWeaponLock = (id: string, locked: boolean) => {
    onUpdateDatabase(setWeaponLockInDb(database, id, locked));
  };
  const handleToggleArtifactLock = (id: string, locked: boolean) => {
    onUpdateDatabase(setArtifactLockInDb(database, id, locked));
  };

  // Delete Handlers using Custom In-App Modal
  const handleDeleteChar = (id: string, name: string) => {
    setConfirmDialog({
      title: t('database:manager.deleteCharTitle', { name }),
      message: t('database:manager.deleteCharMessage', { name }),
      confirmText: t('database:manager.delete'),
      confirmColor: 'red',
      onConfirm: () => {
        const updated = deleteCharacterFromDb(database, id);
        onUpdateDatabase(updated);
        setConfirmDialog(null);
        showStatus(t('database:manager.charDeleted', { name }), 3000);
      }
    });
  };

  const handleDeleteAllCharacters = () => {
    setConfirmDialog({
      title: t('database:manager.deleteAllCharsTitle'),
      message: `${t('database:manager.deleteAllCharsMessage', { count: database.characters.length })}${lockedCharCount > 0 ? t('database:manager.lockedCharsKept', { count: lockedCharCount }) : ''}`,
      confirmText: t('database:manager.deleteAllCharsConfirm'),
      confirmColor: 'red',
      onConfirm: () => {
        const updated = deleteAllCharactersFromDb(database);
        onUpdateDatabase(updated);
        setConfirmDialog(null);
        showStatus(t('database:manager.allCharsDeleted'), 3000);
      }
    });
  };

  const handleDeleteAllWeapons = () => {
    setConfirmDialog({
      title: t('database:manager.deleteAllWeaponsTitle'),
      message: `${t('database:manager.deleteAllWeaponsMessage', { count: database.weapons.length })}${lockedWeaponCount > 0 ? t('database:manager.lockedWeaponsKept', { count: lockedWeaponCount }) : ''}`,
      confirmText: t('database:manager.deleteAllWeaponsConfirm'),
      confirmColor: 'red',
      onConfirm: () => {
        const updated = deleteAllWeaponsFromDb(database);
        onUpdateDatabase(updated);
        setConfirmDialog(null);
        showStatus(t('database:manager.allWeaponsDeleted'), 3000);
      }
    });
  };

  const handleDeleteAllArtifacts = () => {
    setConfirmDialog({
      title: t('database:manager.deleteAllArtifactsTitle'),
      message: `${t('database:manager.deleteAllArtifactsMessage', { count: database.artifacts.length })}${lockedArtifactCount > 0 ? t('database:manager.lockedArtifactsKept', { count: lockedArtifactCount }) : ''}`,
      confirmText: t('database:manager.deleteAllArtifactsConfirm'),
      confirmColor: 'red',
      onConfirm: () => {
        const updated = deleteAllArtifactsFromDb(database);
        onUpdateDatabase(updated);
        setConfirmDialog(null);
        showStatus(t('database:manager.allArtifactsDeleted'), 3000);
      }
    });
  };

  const handleClearAllData = () => {
    const totalLocked = lockedCharCount + lockedWeaponCount + lockedArtifactCount;
    setConfirmDialog({
      title: t('database:manager.clearAllTitle'),
      message: `${t('database:manager.clearAllMessage', { characters: database.characters.length, weapons: database.weapons.length, artifacts: database.artifacts.length })}${totalLocked > 0 ? t('database:manager.lockedItemsKept', { characters: lockedCharCount, weapons: lockedWeaponCount, artifacts: lockedArtifactCount }) : ''}`,
      confirmText: t('database:manager.clearAllConfirm'),
      confirmColor: 'rose',
      onConfirm: () => {
        const empty = clearAllDatabaseData(database);
        onUpdateDatabase(empty);
        setConfirmDialog(null);
        showStatus(t('database:manager.allCleared'), 3000);
      }
    });
  };

  const handleDeleteWeapon = (id: string, name: string) => {
    setConfirmDialog({
      title: t('database:manager.deleteWeaponTitle', { name }),
      message: t('database:manager.deleteWeaponMessage', { name }),
      confirmText: t('database:manager.delete'),
      confirmColor: 'red',
      onConfirm: () => {
        const updated = deleteWeaponFromDb(database, id);
        onUpdateDatabase(updated);
        setConfirmDialog(null);
        showStatus(t('database:manager.weaponDeleted', { name }), 3000);
      }
    });
  };

  const handleDeleteArtifact = (id: string, name: string) => {
    setConfirmDialog({
      title: t('database:manager.deleteArtifactTitle', { name }),
      message: t('database:manager.deleteArtifactMessage', { name }),
      confirmText: t('database:manager.delete'),
      confirmColor: 'red',
      onConfirm: () => {
        const updated = deleteArtifactFromDb(database, id);
        onUpdateDatabase(updated);
        setConfirmDialog(null);
        showStatus(t('database:manager.artifactDeleted', { name }), 3000);
      }
    });
  };

  // Filtered lists
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-3 sm:p-5">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-5xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Modal Top Banner */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800 bg-slate-950/70">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
              <Database className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="font-bold text-base text-white">
                  {t('database:manager.title')}
                </h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-700/60 flex items-center gap-1">
                  <Check className="w-3 h-3 text-emerald-400" />
                  {t('database:manager.localSave')}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                {t('database:manager.subtitle')}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleSyncAll}
              disabled={isSyncing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap shrink-0 bg-emerald-700 hover:bg-emerald-600 disabled:opacity-60 disabled:cursor-wait text-white border border-emerald-500/70 shadow-sm transition-colors"
              title={t('database:manager.bulkTitle')}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${bulkStep ? 'animate-spin' : ''}`} />
              <span>
                {bulkStep
                  ? t('database:manager.generatingStep', { index: bulkStep.index, label: bulkStep.label })
                  : t('database:manager.bulkButton')}
              </span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 一括生成の失敗 */}
        {bulkError && (
          <div className="bg-red-950/90 border-b border-red-700/60 px-4 py-2 flex items-start justify-between gap-3 text-xs text-red-200">
            <span>{bulkError}</span>
            <button type="button" onClick={() => setBulkError(null)} className="text-red-300 hover:text-white shrink-0" title={t('action.close')}>
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Sync Success / Error Toast（成功は緑・エラーは赤） */}
        {syncSuccessMsg && statusKind === 'error' && (
          <div role="alert" className="bg-red-950/90 border-b border-red-700/60 px-4 py-2 flex items-start justify-between gap-3 text-xs text-red-200 animate-fadeIn">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{syncSuccessMsg}</span>
            </div>
            <button type="button" onClick={() => showStatus(null)} className="text-red-300 hover:text-white shrink-0" title={t('action.close')}>
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
        {syncSuccessMsg && statusKind !== 'error' && (
          <div className="bg-emerald-950/90 border-b border-emerald-600/60 px-4 py-2 flex items-center justify-between text-xs text-emerald-200 animate-fadeIn">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-400" />
              <span>{syncSuccessMsg}</span>
            </div>
            <span className="text-[10px] text-emerald-400 font-mono">
              {t('database:manager.lastUpdated', { time: database.lastSyncedAt })}
            </span>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex items-center justify-between px-4 bg-slate-950/40 border-b border-slate-800 flex-wrap gap-2 pt-2">
          <div className="flex items-center gap-1">
            <button
              onClick={() => setActiveTab('characters')}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-t-xl border-t border-x transition-all ${
                activeTab === 'characters'
                  ? 'bg-slate-900 border-slate-700 text-amber-300 shadow-md'
                  : 'bg-transparent border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>{t('database:manager.tabCharacters', { count: database.characters.length })}</span>
            </button>

            <button
              onClick={() => setActiveTab('weapons')}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-t-xl border-t border-x transition-all ${
                activeTab === 'weapons'
                  ? 'bg-slate-900 border-slate-700 text-amber-300 shadow-md'
                  : 'bg-transparent border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Sword className="w-3.5 h-3.5 text-sky-400" />
              <span>{t('database:manager.tabWeapons', { count: database.weapons.length })}</span>
            </button>

            <button
              onClick={() => setActiveTab('artifacts')}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-t-xl border-t border-x transition-all ${
                activeTab === 'artifacts'
                  ? 'bg-slate-900 border-slate-700 text-amber-300 shadow-md'
                  : 'bg-transparent border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Shield className="w-3.5 h-3.5 text-purple-400" />
              <span>{t('database:manager.tabArtifacts', { count: database.artifacts.length })}</span>
            </button>

            <button
              onClick={() => setActiveTab('sync')}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-t-xl border-t border-x transition-all ${
                activeTab === 'sync'
                  ? 'bg-slate-900 border-slate-700 text-emerald-300 shadow-md'
                  : 'bg-transparent border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <RefreshCw className={`w-3.5 h-3.5 text-emerald-400 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{t('database:manager.tabSync')}</span>
            </button>
          </div>

          <div className="text-[11px] font-mono text-slate-500 pb-2">
            {t('database:manager.syncState')} <span className="text-slate-300">{database.lastSyncedAt || t('database:manager.notSynced')}</span>
          </div>
        </div>

        {/* Tab Content Container */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">

          {/* TAB 1: CHARACTERS */}
          {activeTab === 'characters' && (
            <div className="space-y-4">
              {/* Search & Action Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                <div className="flex items-center gap-2 basis-full">
                  <Search className="w-4 h-4 text-slate-400 shrink-0" />
                  <input
                    type="text"
                    placeholder={t('database:manager.charSearch')}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="bg-slate-900 text-xs text-white placeholder-slate-500 rounded-lg px-3 py-1.5 border border-slate-700 focus:outline-none focus:border-amber-400 w-full"
                  />
                </div>

                {/* 元素・武器種フィルター（パーティ編成画面と共通） */}
                <CharacterFilterBar
                  className="basis-full"
                  elementFilter={elementFilter}
                  onElementFilterChange={setElementFilter}
                  weaponFilter={weaponTypeFilter}
                  onWeaponFilterChange={setWeaponTypeFilter}
                />

                {/* ロック中のみ表示 */}
                <button
                  type="button"
                  onClick={() => setLockedOnly(v => !v)}
                  className={`flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold rounded-md border transition-colors shrink-0 ${
                    lockedOnly ? 'bg-amber-500/20 text-amber-300 border-amber-500/50' : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                  }`}
                  title={t('database:manager.lockedOnlyTitle')}
                >
                  <Lock className="w-3 h-3" />
                  <span>{t('database:manager.lockedOnly')}</span>
                </button>

                {/* gcsim 未実装のみ表示 */}
                <button
                  type="button"
                  onClick={() => setGcsimMissingOnly(v => !v)}
                  className={`flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold rounded-md border transition-colors shrink-0 ${
                    gcsimMissingOnly ? 'bg-rose-500/20 text-rose-300 border-rose-500/50' : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                  }`}
                  title={t('database:manager.missingOnlyTitle')}
                >
                  <AlertTriangle className="w-3 h-3" />
                  <span>{t('database:manager.missingOnly')}</span>
                </button>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={handleDeleteAllCharacters}
                    disabled={database.characters.length === 0}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-red-950/80 hover:bg-red-900 disabled:opacity-40 border border-red-800/80 text-red-300 font-bold text-xs rounded-lg shadow transition-all shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-red-400" />
                    <span>{t('database:manager.deleteAllChars', { count: database.characters.length })}</span>
                  </button>

                  {/* 最新マスターデータの動的生成（キャラ）。武器・聖遺物のタブと同じ位置・形（issue #27） */}
                  <button
                    onClick={handleSyncCharacters}
                    disabled={isSyncing}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-700/90 hover:bg-emerald-600 disabled:opacity-50 text-white font-bold text-xs rounded-lg shadow-md transition-all shrink-0 cursor-pointer"
                    title={t('database:manager.charSyncTitle')}
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${syncingKind === 'character' ? 'animate-spin' : ''}`} />
                    <span>
                      {syncingKind === 'character' && charSyncProgress
                        ? `${t('database:manager.generating', { phase: charSyncProgress.phase })}${charSyncProgress.total > 1 ? ` ${charSyncProgress.done}/${charSyncProgress.total}` : ''}`
                        : t('database:manager.charSync')}
                    </span>
                  </button>

                  <button
                    onClick={() => {
                      setEditingCharacter({
                        id: `custom_${Date.now()}`,
                        name: t('database:manager.newCharacter'),
                        element: 'pyro',
                        weaponType: 'sword',
                        avatarUrl: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=150&auto=format&fit=crop&q=80',
                        color: '#ef4444',
                        accentColor: '#f87171',
                        availableActions: [
                          { id: 'act_e', name: t('database:manager.actionSkill'), shortName: 'E', type: 'skill', defaultDuration: 0.8, startsSkillCooldown: true, cooldown: 6.0, effectDuration: 0 },
                          { id: 'act_q', name: t('database:manager.actionBurst'), shortName: 'Q', type: 'burst', defaultDuration: 1.2, startsBurstCooldown: true, cooldown: 15.0, effectDuration: 0 },
                          { id: 'act_n', name: t('database:manager.actionNormal'), shortName: 'N', type: 'normal', defaultDuration: 0.3 }
                        ]
                      });
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-lg shadow-md transition-all shrink-0"
                  >
                    <Plus className="w-4 h-4" />
                    <span>{t('database:manager.addCustomChar')}</span>
                  </button>
                </div>
              </div>

              {/* Characters Cards Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {filteredCharacters.map(char => {
                  const isCustom = !!char.isCustom || char.id.startsWith('custom_');

                  return (
                    <div
                      key={char.id}
                      className={`p-3.5 rounded-xl border bg-slate-900/90 transition-all hover:border-slate-600 flex flex-col justify-between space-y-3 ${
                        char.isLocked
                          ? 'border-sky-500/60 shadow-md shadow-sky-500/5'
                          : isCustom ? 'border-amber-500/50 shadow-md shadow-amber-500/5' : 'border-slate-800'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <img
                            src={char.avatarUrl}
                            alt={charName(char)}
                            className="w-10 h-10 rounded-lg object-cover border border-slate-700 shrink-0"
                          />
                          <div>
                            <div className="flex items-center gap-1.5">
                              <h3 className="font-bold text-sm text-white flex items-center gap-1.5 flex-wrap"><span>{charName(char)}</span><GcsimMissingBadge char={char} /></h3>
                              {isCustom && (
                                <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
                                  {t('custom')}
                                </span>
                              )}
                            </div>
                            {/* 元素・武器種（フィルターと同じ見た目） */}
                            <div className="flex items-center gap-1 mt-1">
                              <ElementChip element={char.element} />
                              <WeaponChip weaponType={char.weaponType} />
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1">
                          <ItemLockButton
                            locked={!!char.isLocked}
                            onToggle={() => handleToggleCharLock(char.id, !char.isLocked)}
                            itemTypeLabel={t('item.character')}
                          />
                          <button
                            onClick={() => setEditingCharacter(char)}
                            className="p-1.5 text-slate-400 hover:text-amber-300 hover:bg-slate-800 rounded-lg transition-colors"
                            title={t('database:manager.editTitle')}
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteChar(char.id, charName(char))}
                            className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-slate-800 rounded-lg transition-colors"
                            title={t('database:manager.deleteTitle')}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Params Summary (CT はアクションごとの値をまとめて表示) */}
                      <div className="grid grid-cols-2 gap-1.5 text-[11px] font-mono bg-slate-950/70 p-2 rounded-lg border border-slate-800/80">
                        <div>
                          <span className="text-slate-400">{t('database:manager.skillCt')}</span>{' '}
                          <strong className="text-amber-300">{formatCharacterCooldowns(char, 'skill')}</strong>
                        </div>
                        <div>
                          <span className="text-slate-400">{t('database:manager.burstCt')}</span>{' '}
                          <strong className="text-purple-300">{formatCharacterCooldowns(char, 'burst')}</strong>
                        </div>
                        <div className="col-span-2">
                          <span className="text-slate-400">{t('database:manager.motion')}</span>{' '}
                          {char.availableActions.some(a => a.frames) ? (
                            <strong className={char.source?.frameSource ? 'text-amber-300' : 'text-emerald-300'} title={char.source?.frameSource ? t('database:manager.framesUnreleasedTitle', { source: frameSourceOf(char) }) : undefined}>
                              {char.source?.frameSource ? t('database:manager.source', { source: frameSourceOf(char) }) : t('database:manager.gcsimFrames')} ({char.availableActions.filter(a => a.frames).length}/{char.availableActions.length})
                            </strong>
                          ) : char.source?.frameSource ? (
                            <strong className="text-amber-300" title={t('database:manager.framesEstimatedTitle')}>{t('database:manager.source', { source: frameSourceOf(char) })}</strong>
                          ) : (
                            <strong className="text-slate-500">{t('database:manager.framesMissing')}</strong>
                          )}
                        </div>
                      </div>

                      {/* Action Templates with per-action CT & Duration */}
                      <div className="border-t border-slate-800/60 pt-2 space-y-1.5">
                        <div className="text-[11px] text-slate-400 flex items-center justify-between">
                          <span className="font-semibold text-slate-300">{t('database:manager.actions', { count: char.availableActions.length })}</span>
                        </div>
                        <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto pr-1">
                          {char.availableActions.map((act) => {
                            const ct = act.cooldown ?? 0;
                            const dur = act.effectDuration ?? 0;
                            const hasDistinctLabel = act.buttonLabel && act.buttonLabel !== act.shortName;
                            return (
                              <span
                                key={act.id}
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-[10px] text-slate-300"
                                title={`${t('database:manager.actionChipTitle', { name: loc(act, 'name'), duration: act.defaultDuration, frames: act.frames ? ` (${act.frames.total}f / ${act.frames.source})` : t('database:manager.tentative'), short: act.shortName })}${hasDistinctLabel ? t('database:manager.buttonName', { label: loc(act, 'buttonLabel') }) : ''}${ct > 0 ? t('database:manager.chipCt', { seconds: ct }) : ''}${dur > 0 ? t('database:manager.chipEffect', { seconds: dur }) : ''}`}
                              >
                                <span className="font-bold text-amber-300">{act.shortName}</span>
                                {hasDistinctLabel && (
                                  <span className="text-sky-300 text-[9px]">[{loc(act, 'buttonLabel')}]</span>
                                )}
                                {ct > 0 && (
                                  <span className="text-amber-400/90 font-mono text-[9px] bg-amber-950/60 px-1 rounded border border-amber-800/40">CT:{ct}s</span>
                                )}
                                {dur > 0 && (
                                  <span className="text-purple-300/90 font-mono text-[9px] bg-purple-950/60 px-1 rounded border border-purple-800/40">{t('database:manager.effectShort', { seconds: dur })}</span>
                                )}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 2: WEAPONS */}
          {activeTab === 'weapons' && (
            <div className="space-y-4">
              {/* Search & Action Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                  <Search className="w-4 h-4 text-slate-400 shrink-0" />
                  <input
                    type="text"
                    placeholder={t('database:manager.weaponSearch')}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="bg-slate-900 text-xs text-white placeholder-slate-500 rounded-lg px-3 py-1.5 border border-slate-700 focus:outline-none focus:border-amber-400 w-full"
                  />
                </div>

                {/* Weapon Type Filter */}
                <div className="flex items-center gap-1 overflow-x-auto py-1">
                  <button
                    onClick={() => setWeaponTypeFilter('all')}
                    className={`px-2.5 py-1 text-[11px] font-semibold rounded-md border transition-colors ${
                      weaponTypeFilter === 'all' ? 'bg-amber-500/20 text-amber-300 border-amber-500/50' : 'bg-slate-900 text-slate-400 border-slate-800'
                    }`}
                  >
                    {t('database:manager.allWeaponTypes')}
                  </button>
                  {(['sword', 'claymore', 'polearm', 'bow', 'catalyst'] as WeaponType[]).map(wt => (
                    <button
                      key={wt}
                      onClick={() => setWeaponTypeFilter(wt)}
                      className={`px-2.5 py-1 text-[11px] font-semibold rounded-md border capitalize transition-colors ${
                        weaponTypeFilter === wt ? 'bg-sky-500/20 text-sky-300 border-sky-500/50' : 'bg-slate-900 text-slate-400 border-slate-800'
                      }`}
                    >
                      {weaponTypeLabel(wt)}
                    </button>
                  ))}
                </div>

                {/* ロック中のみ表示 */}
                <button
                  type="button"
                  onClick={() => setLockedOnly(v => !v)}
                  className={`flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold rounded-md border transition-colors shrink-0 ${
                    lockedOnly ? 'bg-amber-500/20 text-amber-300 border-amber-500/50' : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                  }`}
                  title={t('database:manager.lockedOnlyTitle')}
                >
                  <Lock className="w-3 h-3" />
                  <span>{t('database:manager.lockedOnly')}</span>
                </button>

                {/* gcsim 未実装のみ表示 */}
                <button
                  type="button"
                  onClick={() => setGcsimMissingOnly(v => !v)}
                  className={`flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold rounded-md border transition-colors shrink-0 ${
                    gcsimMissingOnly ? 'bg-rose-500/20 text-rose-300 border-rose-500/50' : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                  }`}
                  title={t('database:manager.missingOnlyTitle')}
                >
                  <AlertTriangle className="w-3 h-3" />
                  <span>{t('database:manager.missingOnly')}</span>
                </button>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={handleDeleteAllWeapons}
                    disabled={database.weapons.length === 0}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-red-950/80 hover:bg-red-900 disabled:opacity-40 border border-red-800/80 text-red-300 font-bold text-xs rounded-lg shadow transition-all shrink-0 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-red-400" />
                    <span>{t('database:manager.deleteAllWeapons', { count: database.weapons.length })}</span>
                  </button>

                  <button
                    onClick={handleSyncWeapons}
                    disabled={isSyncing}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-sky-700/90 hover:bg-sky-600 disabled:opacity-50 text-white font-bold text-xs rounded-lg shadow-md transition-all shrink-0 cursor-pointer"
                    title={t('database:manager.weaponSyncTitle')}
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${syncingKind === 'weapon' ? 'animate-spin' : ''}`} />
                    <span>{t('database:manager.weaponSync')}</span>
                  </button>

                  <button
                    onClick={() => {
                      setEditingWeapon({
                        id: `weapon_custom_${Date.now()}`,
                        name: t('database:manager.customWeaponName'),
                        weaponType: 'sword',
                        rarity: 5,
                        baseAttack: 608,
                        passiveName: t('database:manager.customWeaponPassive'),
                        description: t('database:manager.customWeaponDescription'),
                        buffEffect: {
                          id: `buff_w_${Date.now()}`,
                          name: t('database:manager.customWeaponBuff'),
                          duration: 12.0,
                          cooldown: 20.0,
                          statEffect: t('database:manager.customWeaponStat'),
                          description: t('database:manager.customWeaponBuffDescription'),
                          color: '#f59e0b'
                        }
                      });
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs rounded-lg shadow-md transition-all shrink-0"
                  >
                    <Plus className="w-4 h-4" />
                    <span>{t('database:manager.addCustomWeapon')}</span>
                  </button>
                </div>
              </div>

              {/* Weapon List */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {filteredWeapons.map(weapon => (
                  <DatabaseWeaponCardItem
                    key={weapon.id}
                    weapon={weapon}
                    onToggleLock={() => handleToggleWeaponLock(weapon.id, !weapon.isLocked)}
                    onEdit={() => setEditingWeapon(weapon)}
                    onDelete={() => handleDeleteWeapon(weapon.id, loc(weapon, 'name'))}
                  />
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: ARTIFACTS */}
          {activeTab === 'artifacts' && (
            <div className="space-y-4">
              {/* Search & Action Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                  <Search className="w-4 h-4 text-slate-400 shrink-0" />
                  <input
                    type="text"
                    placeholder={t('database:manager.artifactSearch')}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="bg-slate-900 text-xs text-white placeholder-slate-500 rounded-lg px-3 py-1.5 border border-slate-700 focus:outline-none focus:border-amber-400 w-full"
                  />
                </div>

                {/* ロック中のみ表示 */}
                <button
                  type="button"
                  onClick={() => setLockedOnly(v => !v)}
                  className={`flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold rounded-md border transition-colors shrink-0 ${
                    lockedOnly ? 'bg-amber-500/20 text-amber-300 border-amber-500/50' : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                  }`}
                  title={t('database:manager.lockedOnlyTitle')}
                >
                  <Lock className="w-3 h-3" />
                  <span>{t('database:manager.lockedOnly')}</span>
                </button>

                {/* gcsim 未実装のみ表示 */}
                <button
                  type="button"
                  onClick={() => setGcsimMissingOnly(v => !v)}
                  className={`flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold rounded-md border transition-colors shrink-0 ${
                    gcsimMissingOnly ? 'bg-rose-500/20 text-rose-300 border-rose-500/50' : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                  }`}
                  title={t('database:manager.missingOnlyTitle')}
                >
                  <AlertTriangle className="w-3 h-3" />
                  <span>{t('database:manager.missingOnly')}</span>
                </button>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={handleDeleteAllArtifacts}
                    disabled={database.artifacts.length === 0}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-red-950/80 hover:bg-red-900 disabled:opacity-40 border border-red-800/80 text-red-300 font-bold text-xs rounded-lg shadow transition-all shrink-0 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-red-400" />
                    <span>{t('database:manager.deleteAllArtifacts', { count: database.artifacts.length })}</span>
                  </button>

                  <button
                    onClick={handleSyncArtifacts}
                    disabled={isSyncing}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-700/90 hover:bg-purple-600 disabled:opacity-50 text-white font-bold text-xs rounded-lg shadow-md transition-all shrink-0 cursor-pointer"
                    title={t('database:manager.artifactSyncTitle')}
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${syncingKind === 'artifact' ? 'animate-spin' : ''}`} />
                    <span>{t('database:manager.artifactSync')}</span>
                  </button>

                  <button
                    onClick={() => {
                      setEditingArtifact({
                        id: `art_custom_${Date.now()}`,
                        name: t('database:manager.customArtifactName'),
                        rarity: 5,
                        effect2p: t('database:manager.customArtifact2p'),
                        effect4p: t('database:manager.customArtifact4p'),
                        buffEffect: {
                          id: `buff_art_${Date.now()}`,
                          name: t('database:manager.customArtifactBuff'),
                          duration: 10.0,
                          statEffect: t('database:manager.customArtifactStat'),
                          description: t('database:manager.customArtifactBuffDescription'),
                          color: '#c084fc'
                        }
                      });
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs rounded-lg shadow-md transition-all shrink-0"
                  >
                    <Plus className="w-4 h-4" />
                    <span>{t('database:manager.addCustomArtifact')}</span>
                  </button>
                </div>
              </div>

              {/* Artifact List */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {filteredArtifacts.map(art => (
                  <div
                    key={art.id}
                    className={`p-3.5 rounded-xl border space-y-2.5 transition-all ${
                      art.isLocked
                        ? 'border-purple-500/50 bg-purple-950/20 shadow-md shadow-purple-500/5'
                        : art.isCustom
                        ? 'border-amber-500/50 bg-slate-900/90 shadow-md shadow-amber-500/5'
                        : 'border-slate-800 bg-slate-900/90 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-amber-400 font-bold text-xs">
                          {'★'.repeat(art.rarity)}
                        </span>
                        <h3 className="font-bold text-sm text-white">{loc(art, 'name')}</h3>
                        {art.isCustom && (
                          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300 border border-purple-500/40">
                            {t('custom')}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1">
                        <ItemLockButton
                          locked={!!art.isLocked}
                          onToggle={() => handleToggleArtifactLock(art.id, !art.isLocked)}
                          itemTypeLabel={t('item.artifact')}
                        />
                        <button
                          onClick={() => setEditingArtifact(art)}
                          className="p-1.5 text-slate-400 hover:text-purple-300 hover:bg-slate-800 rounded-lg transition-colors"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteArtifact(art.id, loc(art, 'name'))}
                          className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-slate-800 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1 text-xs bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/80">
                      <div>
                        <span className="text-purple-300 font-bold">{t('database:manager.twoPiece')}</span>{' '}
                        <span className="text-slate-300">{loc(art, 'effect2p')}</span>
                      </div>
                      <div>
                        <span className="text-amber-300 font-bold">{t('database:manager.fourPiece')}</span>{' '}
                        <span className="text-slate-300">{loc(art, 'effect4p')}</span>
                      </div>
                    </div>

                    {art.buffEffect && (
                      <div className="flex items-center justify-between text-[11px] font-mono bg-purple-950/40 border border-purple-800/50 px-2.5 py-1 rounded text-purple-200">
                        <span>{t('database:weapon.linkedBuff', { name: loc(art.buffEffect, 'name') })}</span>
                        <div className="flex items-center gap-1.5">
                          <strong className="text-amber-300">{t('database:weapon.duration', { seconds: Number(art.buffEffect.duration).toFixed(1) })}</strong>
                          {art.buffEffect.cooldown !== undefined && art.buffEffect.cooldown > 0 && (
                            <span className="text-cyan-300 text-[10px]">/ CT {Number(art.buffEffect.cooldown).toFixed(1)}s</span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 4: SYNC & BACKUP */}
          {activeTab === 'sync' && (
            <div className="max-w-2xl mx-auto space-y-6 py-4">
              
              {/* Dynamic Generators for Characters, Weapons, and Artifacts */}
              <div className="space-y-4">
                
                {/* 1. Characters Generator */}
                <div className="bg-slate-950 p-5 rounded-2xl border border-amber-500/40 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
                      <Sparkles className={`w-5 h-5 ${syncingKind === 'character' ? 'animate-spin' : ''}`} />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-white flex items-center gap-2">
                        <span>{t('database:manager.charGenTitle')}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono">{t('database:manager.online')}</span>
                      </h3>
                      <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                        {t('database:manager.charGenDescription')}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-slate-800">
                    <div className="text-xs text-slate-400 flex items-center gap-1.5">
                      <span>{t('database:manager.registered')} <strong className="font-mono text-amber-300 font-bold">{t('database:manager.charCount', { count: database.characters.length })}</strong></span>
                      {lockedCharCount > 0 && (
                        <span className="text-[10px] text-sky-400 font-mono font-bold">{t('database:manager.lockedCount', { count: lockedCharCount })}</span>
                      )}
                    </div>
                    <div className="flex flex-col sm:items-end gap-2">
                      <button
                        onClick={handleSyncCharacters}
                        disabled={isSyncing}
                        className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 disabled:opacity-50 text-slate-950 font-extrabold text-xs rounded-xl shadow-lg transition-all cursor-pointer"
                      >
                        <RefreshCw className={`w-4 h-4 ${syncingKind === 'character' ? 'animate-spin' : ''}`} />
                        <span>{t('database:manager.charGen')}</span>
                      </button>
                      <button
                        onClick={handleDeleteAllCharacters}
                        disabled={database.characters.length === 0}
                        className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-3 py-1.5 bg-red-950/70 hover:bg-red-900 disabled:opacity-40 text-red-300 text-xs font-bold rounded-lg border border-red-800/80 transition-all cursor-pointer"
                        title={t('database:manager.deleteAllCharsTitleShort')}
                      >
                        <Trash2 className="w-3.5 h-3.5 text-red-400" />
                        <span>{t('database:manager.deleteAllCharsShort')}</span>
                      </button>
                    </div>
                  </div>

                  {charSyncProgress && (
                    <div className="text-xs text-amber-200 font-mono">
                      {charSyncProgress.phase}… {charSyncProgress.total > 1 ? `${charSyncProgress.done}/${charSyncProgress.total}` : ''}
                    </div>
                  )}

                  {charSyncError && (
                    <div className="p-2 rounded bg-red-950/60 border border-red-800/60 text-[11px] text-red-200">
                      {t('database:manager.genFailed', { error: charSyncError })}
                      <div className="text-red-300/70 mt-0.5">{t('database:manager.charGenFailedHint')}</div>
                    </div>
                  )}

                  {charSyncReport && (
                    <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 text-[11px] text-slate-300 space-y-1.5 max-h-64 overflow-y-auto">
                      <div className="font-bold text-slate-200">
                        {t('database:manager.charReport', { total: charSyncReport.totalCharacters, withFrames: charSyncReport.charactersWithFrames })}
                        <span className="text-slate-500 font-mono font-normal"> (gcsim {charSyncReport.gcsimCommit.slice(0, 7)}{charSyncReport.catalogCommit ? t('database:manager.dictionary', { commit: charSyncReport.catalogCommit }) : ''})</span>
                      </div>
                      {charSyncReport.skipped.length > 0 && (
                        <div><span className="text-slate-400">{t('database:manager.skipped')}</span> {charSyncReport.skipped.map(s => `${s.name} (${s.reason})`).join(' / ')}</div>
                      )}
                      {charSyncReport.placeholderDurations.length > 0 && (
                        <div>
                          <div className="text-amber-300">{t('database:manager.placeholders')}</div>
                          <ul className="pl-3 list-disc text-slate-400">
                            {charSyncReport.placeholderDurations.map(p => (
                              <li key={p.characterId}>{p.name}: {p.actions.map(a => a.replace(`${p.characterId}_`, '')).join(', ')} ({p.reason})</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {charSyncReport.missingCooldowns.length > 0 && (
                        <div><span className="text-red-300">{t('database:manager.missingCooldowns')}</span> {charSyncReport.missingCooldowns.map(m => `${m.name} ${m.actionId}`).join(' / ')}</div>
                      )}
                      {charSyncReport.errors.length > 0 && (
                        <div><span className="text-red-300">{t('database:manager.errors')}</span> {charSyncReport.errors.join(' / ')}</div>
                      )}
                    </div>
                  )}
                </div>

                {/* 2. Weapons Generator */}
                <div className="bg-slate-950 p-5 rounded-2xl border border-sky-500/40 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-sky-500/20 border border-sky-500/40 flex items-center justify-center text-sky-400 shrink-0">
                      <Sword className={`w-5 h-5 ${syncingKind === 'weapon' ? 'animate-spin' : ''}`} />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-white flex items-center gap-2">
                        <span>{t('database:manager.weaponGenTitle')}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 font-mono">{t('database:manager.online')}</span>
                      </h3>
                      <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                        {t('database:manager.weaponGenDescription')}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-slate-800">
                    <div className="text-xs text-slate-400 flex items-center gap-1.5">
                      <span>{t('database:manager.registered')} <strong className="font-mono text-sky-300 font-bold">{t('database:manager.weaponCount', { count: database.weapons.length })}</strong></span>
                      {lockedWeaponCount > 0 && (
                        <span className="text-[10px] text-sky-400 font-mono font-bold">{t('database:manager.lockedCount', { count: lockedWeaponCount })}</span>
                      )}
                    </div>
                    <div className="flex flex-col sm:items-end gap-2">
                      <button
                        onClick={handleSyncWeapons}
                        disabled={isSyncing}
                        className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-sky-600 to-sky-500 hover:from-sky-500 hover:to-sky-400 disabled:opacity-50 text-slate-950 font-extrabold text-xs rounded-xl shadow-lg transition-all cursor-pointer"
                      >
                        <RefreshCw className={`w-4 h-4 ${syncingKind === 'weapon' ? 'animate-spin' : ''}`} />
                        <span>{t('database:manager.weaponGen')}</span>
                      </button>
                      <button
                        onClick={handleDeleteAllWeapons}
                        disabled={database.weapons.length === 0}
                        className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-3 py-1.5 bg-red-950/70 hover:bg-red-900 disabled:opacity-40 text-red-300 text-xs font-bold rounded-lg border border-red-800/80 transition-all cursor-pointer"
                        title={t('database:manager.deleteAllWeaponsTitleShort')}
                      >
                        <Trash2 className="w-3.5 h-3.5 text-red-400" />
                        <span>{t('database:manager.deleteAllWeaponsShort')}</span>
                      </button>
                    </div>
                  </div>

                  {weaponSyncProgress && (
                    <div className="text-xs text-sky-200 font-mono animate-pulse">
                      {weaponSyncProgress.phase} {weaponSyncProgress.total > 1 ? `(${weaponSyncProgress.done}/${weaponSyncProgress.total})` : ''}
                    </div>
                  )}

                  {weaponSyncError && (
                    <div className="p-2.5 rounded bg-red-950/60 border border-red-800/60 text-[11px] text-red-200">
                      {t('database:manager.genFailed', { error: weaponSyncError })}
                      <div className="text-red-300/70 mt-0.5">{t('database:manager.genFailedHint')}</div>
                    </div>
                  )}

                  {weaponSyncReport && (
                    <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 text-[11px] text-slate-300 space-y-2 max-h-64 overflow-y-auto">
                      <div className="font-bold text-sky-200 flex items-center justify-between">
                        <span>{t('database:manager.weaponReport', { total: weaponSyncReport.totalWeapons, withBuffs: weaponSyncReport.weaponsWithBuffs })}
                          {weaponSyncReport.gcsimCommit && <span className="text-slate-500 font-mono font-normal"> (gcsim {weaponSyncReport.gcsimCommit.slice(0, 7)}{t('database:manager.dictionary', { commit: weaponSyncReport.catalogCommit ?? '-' })})</span>}
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono">{t('database:manager.constantEffects', { count: weaponSyncReport.constantPassiveItems.length })}</span>
                      </div>
                      {weaponSyncReport.sourceApiUrl && (
                        <div className="flex flex-wrap items-center gap-2 p-1.5 rounded bg-sky-950/60 border border-sky-800/40 text-[10px] font-mono text-sky-300">
                          <span>{t('database:manager.apiSource', { url: weaponSyncReport.sourceApiUrl })}</span>
                          <span>{t('database:manager.networkTime', { seconds: ((weaponSyncReport.networkDurationMs ?? 0) / 1000).toFixed(2) })}</span>
                          <span>{t('database:manager.rawCounts', { ja: weaponSyncReport.fetchedRawCountJa, en: weaponSyncReport.fetchedRawCountEn })}</span>
                        </div>
                      )}
                      <div className="text-slate-400">{t('database:manager.buffSamples', { count: weaponSyncReport.extractedBuffsList.length })}</div>
                      <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto p-1.5 bg-slate-950/70 rounded-lg border border-slate-800/60">
                        {weaponSyncReport.extractedBuffsList.slice(0, 30).map((b, idx) => (
                          <span key={idx} className="px-1.5 py-0.5 rounded bg-sky-950/80 border border-sky-800/50 text-[10px] text-sky-200" title={`${b.sourceName}: ${b.buffName} - ${b.statSummary || ''}`}>
                            <strong className="text-amber-300">{b.sourceName}</strong>: {b.buffName} ({b.duration}s{b.cooldown ? ` / CT ${b.cooldown}s` : ''})
                          </span>
                        ))}
                        {weaponSyncReport.extractedBuffsList.length > 30 && (
                          <span className="text-[10px] text-slate-500 self-center">{t('database:manager.more', { count: weaponSyncReport.extractedBuffsList.length - 30 })}</span>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* 3. Artifacts Generator */}
                <div className="bg-slate-950 p-5 rounded-2xl border border-pink-500/40 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-pink-500/20 border border-pink-500/40 flex items-center justify-center text-pink-400 shrink-0">
                      <Shield className={`w-5 h-5 ${syncingKind === 'artifact' ? 'animate-spin' : ''}`} />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-white flex items-center gap-2">
                        <span>{t('database:manager.artifactGenTitle')}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-pink-500/20 text-pink-300 font-mono">{t('database:manager.online')}</span>
                      </h3>
                      <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                        {t('database:manager.artifactGenDescription')}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-slate-800">
                    <div className="text-xs text-slate-400 flex items-center gap-1.5">
                      <span>{t('database:manager.registered')} <strong className="font-mono text-pink-300 font-bold">{t('database:manager.artifactCount', { count: database.artifacts.length })}</strong></span>
                      {lockedArtifactCount > 0 && (
                        <span className="text-[10px] text-purple-400 font-mono font-bold">{t('database:manager.lockedCount', { count: lockedArtifactCount })}</span>
                      )}
                    </div>
                    <div className="flex flex-col sm:items-end gap-2">
                      <button
                        onClick={handleSyncArtifacts}
                        disabled={isSyncing}
                        className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-pink-600 to-pink-500 hover:from-pink-500 hover:to-pink-400 disabled:opacity-50 text-slate-950 font-extrabold text-xs rounded-xl shadow-lg transition-all cursor-pointer"
                      >
                        <RefreshCw className={`w-4 h-4 ${syncingKind === 'artifact' ? 'animate-spin' : ''}`} />
                        <span>{t('database:manager.artifactGen')}</span>
                      </button>
                      <button
                        onClick={handleDeleteAllArtifacts}
                        disabled={database.artifacts.length === 0}
                        className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-3 py-1.5 bg-red-950/70 hover:bg-red-900 disabled:opacity-40 text-red-300 text-xs font-bold rounded-lg border border-red-800/80 transition-all cursor-pointer"
                        title={t('database:manager.deleteAllArtifactsTitleShort')}
                      >
                        <Trash2 className="w-3.5 h-3.5 text-red-400" />
                        <span>{t('database:manager.deleteAllArtifactsShort')}</span>
                      </button>
                    </div>
                  </div>

                  {artifactSyncProgress && (
                    <div className="text-xs text-pink-200 font-mono animate-pulse">
                      {artifactSyncProgress.phase} {artifactSyncProgress.total > 1 ? `(${artifactSyncProgress.done}/${artifactSyncProgress.total})` : ''}
                    </div>
                  )}

                  {artifactSyncError && (
                    <div className="p-2.5 rounded bg-red-950/60 border border-red-800/60 text-[11px] text-red-200">
                      {t('database:manager.genFailed', { error: artifactSyncError })}
                      <div className="text-red-300/70 mt-0.5">{t('database:manager.genFailedHint')}</div>
                    </div>
                  )}

                  {artifactSyncReport && (
                    <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 text-[11px] text-slate-300 space-y-2 max-h-64 overflow-y-auto">
                      <div className="font-bold text-pink-200 flex items-center justify-between">
                        <span>{t('database:manager.artifactReport', { total: artifactSyncReport.totalArtifacts, withBuffs: artifactSyncReport.artifactsWithBuffs })}
                          {artifactSyncReport.gcsimCommit && <span className="text-slate-500 font-mono font-normal"> (gcsim {artifactSyncReport.gcsimCommit.slice(0, 7)}{t('database:manager.dictionary', { commit: artifactSyncReport.catalogCommit ?? '-' })})</span>}
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono">{t('database:manager.constantEffects', { count: artifactSyncReport.constantPassiveItems.length })}</span>
                      </div>
                      {artifactSyncReport.sourceApiUrl && (
                        <div className="flex flex-wrap items-center gap-2 p-1.5 rounded bg-pink-950/60 border border-pink-800/40 text-[10px] font-mono text-pink-300">
                          <span>{t('database:manager.apiSource', { url: artifactSyncReport.sourceApiUrl })}</span>
                          <span>{t('database:manager.networkTime', { seconds: ((artifactSyncReport.networkDurationMs ?? 0) / 1000).toFixed(2) })}</span>
                          <span>{t('database:manager.rawCounts', { ja: artifactSyncReport.fetchedRawCountJa, en: artifactSyncReport.fetchedRawCountEn })}</span>
                        </div>
                      )}
                      <div className="text-slate-400">{t('database:manager.buffSamples', { count: artifactSyncReport.extractedBuffsList.length })}</div>
                      <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto p-1.5 bg-slate-950/70 rounded-lg border border-slate-800/60">
                        {artifactSyncReport.extractedBuffsList.slice(0, 30).map((b, idx) => (
                          <span key={idx} className="px-1.5 py-0.5 rounded bg-pink-950/80 border border-pink-800/50 text-[10px] text-pink-200" title={`${b.sourceName}: ${b.buffName} - ${b.statSummary || ''}`}>
                            <strong className="text-amber-300">{b.sourceName}</strong>: {b.buffName} ({b.duration}s{b.cooldown ? ` / CT ${b.cooldown}s` : ''})
                          </span>
                        ))}
                        {artifactSyncReport.extractedBuffsList.length > 30 && (
                          <span className="text-[10px] text-slate-500 self-center">{t('database:manager.more', { count: artifactSyncReport.extractedBuffsList.length - 30 })}</span>
                        )}
                      </div>
                    </div>
                  )}
                </div>

              </div>

              {/* Explanation Note */}
              <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800 text-xs text-slate-400 leading-relaxed space-y-1.5">
                <div className="font-bold text-amber-300 flex items-center gap-1.5">
                  <Check className="w-4 h-4 text-amber-400" />
                  <span>{t('database:manager.aboutTitle')}</span>
                </div>
                <p>
                  {t('database:manager.about1')}
                </p>
                <p className="text-slate-500">
                  {t('database:manager.about2')}
                </p>
              </div>

              {/* JSON Export / Import */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
                  <div className="flex items-center gap-2 text-amber-300 font-bold text-sm">
                    <Download className="w-4 h-4 text-amber-400" />
                    <span>{t('database:manager.exportTitle')}</span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    {t('database:manager.exportDescription')}
                  </p>
                  <button
                    onClick={handleExportJson}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-amber-200 font-bold text-xs rounded-lg border border-slate-700 transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    <span>{t('database:manager.exportButton')}</span>
                  </button>
                </div>

                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
                  <div className="flex items-center gap-2 text-sky-300 font-bold text-sm">
                    <Upload className="w-4 h-4 text-sky-400" />
                    <span>{t('database:manager.importTitle')}</span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    {t('database:manager.importDescription')}
                  </p>
                  <input
                    type="file"
                    accept=".json"
                    ref={fileInputRef}
                    onChange={handleImportJson}
                    className="hidden"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-sky-200 font-bold text-xs rounded-lg border border-slate-700 transition-colors"
                  >
                    <Upload className="w-4 h-4" />
                    <span>{t('database:manager.importButton')}</span>
                  </button>
                </div>
              </div>

              {/* Danger Zone: Delete & Clear Options */}
              <div className="bg-red-950/30 p-5 rounded-xl border border-red-900/60 space-y-4">
                <div className="flex items-center gap-2 text-red-400 font-bold text-sm">
                  <AlertTriangle className="w-4.5 h-4.5 text-red-400" />
                  <span>{t('database:manager.danger')}</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                  <div className="bg-slate-900/80 p-3 rounded-lg border border-red-900/40 flex flex-col justify-between space-y-2">
                    <div>
                      <div className="font-bold text-xs text-red-300">{t('database:manager.deleteAllCharsShort')}</div>
                      <p className="text-[11px] text-slate-400 mt-0.5">{t('database:manager.dangerCharsDescription', { count: database.characters.length })}</p>
                    </div>
                    <button
                      onClick={handleDeleteAllCharacters}
                      disabled={database.characters.length === 0}
                      className="w-full py-1.5 bg-red-950 hover:bg-red-900 disabled:opacity-40 text-red-300 text-xs font-bold rounded border border-red-800 transition-colors flex items-center justify-center gap-1"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-red-400" />
                      <span>{t('database:manager.deleteAllCharsShort')}</span>
                    </button>
                  </div>

                  <div className="bg-slate-900/80 p-3 rounded-lg border border-red-900/40 flex flex-col justify-between space-y-2">
                    <div>
                      <div className="font-bold text-xs text-amber-300">{t('database:manager.restoreMaster')}</div>
                      <p className="text-[11px] text-slate-400 mt-0.5">{t('database:manager.restoreMasterDescription')}</p>
                    </div>
                    <button
                      onClick={handleFullReset}
                      className="w-full py-1.5 bg-amber-950/80 hover:bg-amber-900 text-amber-200 text-xs font-bold rounded border border-amber-800 transition-colors flex items-center justify-center gap-1"
                    >
                      <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
                      <span>{t('database:manager.restoreMasterButton')}</span>
                    </button>
                  </div>

                  <div className="bg-slate-900/80 p-3 rounded-lg border border-red-900/40 flex flex-col justify-between space-y-2">
                    <div>
                      <div className="font-bold text-xs text-rose-400">{t('database:manager.clearDb')}</div>
                      <p className="text-[11px] text-slate-400 mt-0.5">{t('database:manager.clearDbDescription')}</p>
                    </div>
                    <button
                      onClick={handleClearAllData}
                      className="w-full py-1.5 bg-rose-950 hover:bg-rose-900 text-rose-200 text-xs font-bold rounded border border-rose-800 transition-colors flex items-center justify-center gap-1"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                      <span>{t('database:manager.clearDbButton')}</span>
                    </button>
                  </div>
                </div>
              </div>

            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between text-xs text-slate-400">
          <span>{t('database:manager.autoSaved')}</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg transition-colors shadow-md"
          >
            {t('database:manager.done')}
          </button>
        </div>

      </div>

      {/* Custom React In-App Confirm Modal */}
      {confirmDialog && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fade-in">
          <div className="bg-slate-900 border border-slate-700/80 w-full max-w-md rounded-2xl shadow-2xl p-5 space-y-4 text-white">
            <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
              <div className="p-2.5 rounded-xl bg-red-500/20 text-red-400 border border-red-500/30">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-extrabold text-base text-white">{confirmDialog.title}</h3>
                <p className="text-xs text-slate-400">{t('database:manager.confirmLabel')}</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-line bg-slate-950 p-3 rounded-xl border border-slate-800 font-medium">
              {confirmDialog.message}
            </p>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setConfirmDialog(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl border border-slate-700 transition-colors"
              >
                {t('action.cancel')}
              </button>
              <button
                type="button"
                onClick={confirmDialog.onConfirm}
                className={`px-5 py-2 font-bold text-xs rounded-xl shadow-lg text-white transition-all ${
                  confirmDialog.confirmColor === 'rose'
                    ? 'bg-rose-600 hover:bg-rose-500'
                    : confirmDialog.confirmColor === 'amber'
                    ? 'bg-amber-600 hover:bg-amber-500'
                    : 'bg-red-600 hover:bg-red-500'
                }`}
              >
                {confirmDialog.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= EDIT CHARACTER MODAL ================= */}
      {editingCharacter && (
        <EditCharacterSubModal
          character={editingCharacter}
          onToggleLock={(locked) => {
            // DB にあるキャラはその場でロック状態を保存（新規カスタムキャラは保存時に反映）
            if (database.characters.some(c => c.id === editingCharacter.id)) handleToggleCharLock(editingCharacter.id, locked);
          }}
          onClose={() => setEditingCharacter(null)}
          onSave={(updated) => {
            const newDb = upsertCharacterInDb(database, updated);
            onUpdateDatabase(newDb);
            setEditingCharacter(null);
          }}
        />
      )}

      {/* ================= EDIT WEAPON MODAL ================= */}
      {editingWeapon && (
        <EditWeaponSubModal
          weapon={editingWeapon}
          onToggleLock={(locked) => {
            if (database.weapons.some(w => w.id === editingWeapon.id)) handleToggleWeaponLock(editingWeapon.id, locked);
          }}
          onClose={() => setEditingWeapon(null)}
          onSave={(updated) => {
            const newDb = upsertWeaponInDb(database, updated);
            onUpdateDatabase(newDb);
            setEditingWeapon(null);
          }}
        />
      )}

      {/* ================= EDIT ARTIFACT MODAL ================= */}
      {editingArtifact && (
        <EditArtifactSubModal
          artifact={editingArtifact}
          onToggleLock={(locked) => {
            if (database.artifacts.some(a => a.id === editingArtifact.id)) handleToggleArtifactLock(editingArtifact.id, locked);
          }}
          onClose={() => setEditingArtifact(null)}
          onSave={(updated) => {
            const newDb = upsertArtifactInDb(database, updated);
            onUpdateDatabase(newDb);
            setEditingArtifact(null);
          }}
        />
      )}

    </div>
  );
};
