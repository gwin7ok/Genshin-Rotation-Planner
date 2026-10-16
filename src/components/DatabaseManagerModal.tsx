import { GcsimMissingBadge } from './GcsimMissingBadge';
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  X, Database, Search, Plus, Edit2, Trash2, RefreshCw, Download, Upload, 
  Sparkles, Check, AlertTriangle, Shield, Zap, Sword, RotateCcw, Lock
} from 'lucide-react';
import { AppDatabase, WeaponDatabaseItem, ArtifactSetDatabaseItem } from '../types/database';
import { CharacterConfig, ElementType, WeaponType } from '../types/genshin';
import { WEAPON_TYPE_NAMES_JA } from '../data/characters';
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
    const matchesSearch = c.name.toLowerCase().includes(q) || c.id.toLowerCase().includes(q) || (c.englishName ?? '').toLowerCase().includes(q);
    const matchesFilter = matchesCharacterFilter(c, elementFilter, weaponTypeFilter);
    return matchesSearch && matchesFilter && (!lockedOnly || !!c.isLocked) && (!gcsimMissingOnly || (!c.source?.gcsimKey && !c.isCustom && !c.id.startsWith('custom_')));
  }), [database.characters, searchQuery, elementFilter, weaponTypeFilter, lockedOnly, gcsimMissingOnly]);

  const filteredWeapons = useMemo(() => database.weapons
    .filter(w => {
      const matchesSearch = w.name.toLowerCase().includes(searchQuery.toLowerCase()) || w.passiveName.toLowerCase().includes(searchQuery.toLowerCase()) || (w.id ?? '').includes(searchQuery);
      const matchesWeapon = weaponTypeFilter === 'all' || w.weaponType === weaponTypeFilter;
      return matchesSearch && matchesWeapon && (!lockedOnly || !!w.isLocked) && (!gcsimMissingOnly || (!w.gcsimKey && !w.isCustom));
    })
    .sort((a, b) => compareIdDesc(a.id, b.id)), [database.weapons, searchQuery, weaponTypeFilter, lockedOnly, gcsimMissingOnly]);

  const filteredArtifacts = useMemo(() => database.artifacts
    .filter(a => {
      if (lockedOnly && !a.isLocked) return false;
      if (gcsimMissingOnly && (a.gcsimKey || a.isCustom)) return false;
      return a.name.toLowerCase().includes(searchQuery.toLowerCase()) || a.effect2p.toLowerCase().includes(searchQuery.toLowerCase()) || a.effect4p.toLowerCase().includes(searchQuery.toLowerCase()) || (a.id ?? '').includes(searchQuery);
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
      showStatus(`⚡ genshin-db ＋ gcsim から ${report.totalCharacters} キャラクターのマスターデータを生成しました (モーションフレームあり: ${report.charactersWithFrames})`, 5000);
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
      showStatus(`⚔️ genshin-db から最新の武器 ${report.totalWeapons} 種類をオンライン生成しました (発動バフ解析: ${report.weaponsWithBuffs} 件)`, 5000);
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
      showStatus(`🏺 genshin-db から最新の聖遺物 ${report.totalArtifacts} セットをオンライン生成しました (発動バフ解析: ${report.artifactsWithBuffs} 件)`, 5000);
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

      step = 'キャラクター';
      setBulkStep({ index: 1, label: step });
      setSyncingKind('character');
      const c = await syncCharactersMasterOnline(db, setCharSyncProgress);
      db = c.db;
      onUpdateDatabase(db);
      setCharSyncReport(c.report);
      setCharSyncProgress(null);

      step = '武器';
      setBulkStep({ index: 2, label: step });
      setSyncingKind('weapon');
      const w = await syncWeaponsMasterOnline(db, setWeaponSyncProgress);
      db = w.db;
      onUpdateDatabase(db);
      setWeaponSyncReport(w.report);
      setWeaponSyncProgress(null);

      step = '聖遺物';
      setBulkStep({ index: 3, label: step });
      setSyncingKind('artifact');
      const a = await syncArtifactsMasterOnline(db, setArtifactSyncProgress);
      db = a.db;
      onUpdateDatabase(db);
      setArtifactSyncReport(a.report);

      showStatus(`🔄 最新データをオンライン生成しました（キャラクター ${c.report.totalCharacters} 件・武器 ${w.report.totalWeapons} 種類・聖遺物 ${a.report.totalArtifacts} セット）`, 6000);
    } catch (e) {
      setBulkError(`${step}の生成に失敗しました（${step}より前の生成結果は反映・保存済みです）: ${e instanceof Error ? e.message : String(e)}`);
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
      title: '初期状態へリセット',
      message: 'すべてのカスタム変更をクリアし、データベースを初期の公式マスター状態に戻しますか？',
      confirmText: '初期状態へリセット',
      confirmColor: 'amber',
      onConfirm: () => {
        const reset = resetDatabaseToMaster();
        onUpdateDatabase(reset);
        setConfirmDialog(null);
        showStatus('データベースを初期マスターデータにリセットしました。', 4000);
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
        showError(`取り込めませんでした: ${(parsed as { ok: false; error: string }).error}`);
        return;
      }
      const { db, counts, skipped } = parsed;
      setConfirmDialog({
        title: 'データベースファイルの復元',
        message: [
          '今のデータベースを、このファイルの内容で置き換えます（元に戻せません）。',
          `・今: キャラ ${database.characters.length}・武器 ${database.weapons.length}・聖遺物 ${database.artifacts.length}`,
          `・ファイル: キャラ ${counts.characters}・武器 ${counts.weapons}・聖遺物 ${counts.artifacts}`,
          ...(skipped > 0 ? [`※ 形が壊れている・ID が重複している ${skipped} 件は、読み飛ばします`] : []),
          '',
          '必要なら、先に「保存/読み込み」からバックアップを書き出してください。',
        ].join('\n'),
        confirmText: '置き換える',
        confirmColor: 'amber',
        onConfirm: () => {
          setConfirmDialog(null);
          if (!saveDatabase(db)) {
            showError('ブラウザに保存できませんでした（保存容量の不足の可能性）。データベースは変更していません。');
            return;
          }
          onUpdateDatabase(db);
          showMsg(skipped > 0 ? `データベースファイルを復元しました（${skipped} 件を読み飛ばし）。` : 'データベースファイルの復元に成功しました！');
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
      title: `キャラクター「${name}」の削除`,
      message: `キャラクター「${name}」をデータベースから削除しますか？\n（メイン画面および選択画面からも即座に除外されます）`,
      confirmText: '削除する',
      confirmColor: 'red',
      onConfirm: () => {
        const updated = deleteCharacterFromDb(database, id);
        onUpdateDatabase(updated);
        setConfirmDialog(null);
        showStatus(`キャラクター「${name}」を削除しました。`, 3000);
      }
    });
  };

  const handleDeleteAllCharacters = () => {
    setConfirmDialog({
      title: '全キャラクター一括削除',
      message: `警告: データベース内の全 ${database.characters.length} キャラクターを一括削除しますか？\n（アプリ全画面から削除したキャラが除去されます）${lockedCharCount > 0 ? `\n※ロック中の ${lockedCharCount} キャラは削除されません` : ''}`,
      confirmText: '全キャラ一括削除を実行',
      confirmColor: 'red',
      onConfirm: () => {
        const updated = deleteAllCharactersFromDb(database);
        onUpdateDatabase(updated);
        setConfirmDialog(null);
        showStatus('全キャラクターを一括削除しました。', 3000);
      }
    });
  };

  const handleDeleteAllWeapons = () => {
    setConfirmDialog({
      title: '全武器一括削除',
      message: `警告: データベース内の全 ${database.weapons.length} 武器を一括削除しますか？${lockedWeaponCount > 0 ? `\n※ロック中の ${lockedWeaponCount} 武器は削除されません` : ''}`,
      confirmText: '全武器一括削除を実行',
      confirmColor: 'red',
      onConfirm: () => {
        const updated = deleteAllWeaponsFromDb(database);
        onUpdateDatabase(updated);
        setConfirmDialog(null);
        showStatus('全武器を一括削除しました。', 3000);
      }
    });
  };

  const handleDeleteAllArtifacts = () => {
    setConfirmDialog({
      title: '全聖遺物一括削除',
      message: `警告: データベース内の全 ${database.artifacts.length} 聖遺物セットを一括削除しますか？${lockedArtifactCount > 0 ? `\n※ロック中の ${lockedArtifactCount} 聖遺物は削除されません` : ''}`,
      confirmText: '全聖遺物一括削除を実行',
      confirmColor: 'red',
      onConfirm: () => {
        const updated = deleteAllArtifactsFromDb(database);
        onUpdateDatabase(updated);
        setConfirmDialog(null);
        showStatus('全聖遺物を一括削除しました。', 3000);
      }
    });
  };

  const handleClearAllData = () => {
    const totalLocked = lockedCharCount + lockedWeaponCount + lockedArtifactCount;
    setConfirmDialog({
      title: 'データベース全データ完全消去',
      message: `危険: データベースの全データ（全キャラクター ${database.characters.length}人、全武器 ${database.weapons.length}個、全聖遺物 ${database.artifacts.length}セット）を完全に消去しますか？${totalLocked > 0 ? `\n※ロック中のアイテム（キャラ:${lockedCharCount} 武器:${lockedWeaponCount} 聖遺物:${lockedArtifactCount}）は保護されます` : ''}`,
      confirmText: '全データ完全消去',
      confirmColor: 'rose',
      onConfirm: () => {
        const empty = clearAllDatabaseData(database);
        onUpdateDatabase(empty);
        setConfirmDialog(null);
        showStatus('データベースの全データを完全クリアしました。', 3000);
      }
    });
  };

  const handleDeleteWeapon = (id: string, name: string) => {
    setConfirmDialog({
      title: `武器「${name}」の削除`,
      message: `武器「${name}」をデータベースから削除しますか？`,
      confirmText: '削除する',
      confirmColor: 'red',
      onConfirm: () => {
        const updated = deleteWeaponFromDb(database, id);
        onUpdateDatabase(updated);
        setConfirmDialog(null);
        showStatus(`武器「${name}」を削除しました。`, 3000);
      }
    });
  };

  const handleDeleteArtifact = (id: string, name: string) => {
    setConfirmDialog({
      title: `聖遺物「${name}」の削除`,
      message: `聖遺物「${name}」をデータベースから削除しますか？`,
      confirmText: '削除する',
      confirmColor: 'red',
      onConfirm: () => {
        const updated = deleteArtifactFromDb(database, id);
        onUpdateDatabase(updated);
        setConfirmDialog(null);
        showStatus(`聖遺物「${name}」を削除しました。`, 3000);
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
                  データベース管理・カスタマイズ (Genshin Database Manager)
                </h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-700/60 flex items-center gap-1">
                  <Check className="w-3 h-3 text-emerald-400" />
                  ローカル保存有効
                </span>
              </div>
              <p className="text-xs text-slate-400">
                キャラクター性能・武器パッシブ・聖遺物効果の最新同期と、ユーザー自身による自由な数値編集・保存
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleSyncAll}
              disabled={isSyncing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap shrink-0 bg-emerald-700 hover:bg-emerald-600 disabled:opacity-60 disabled:cursor-wait text-white border border-emerald-500/70 shadow-sm transition-colors"
              title="キャラクター → 武器 → 聖遺物の順に、最新のマスターデータをオンライン生成して上書きします（ロック中・カスタムは上書きしません）"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${bulkStep ? 'animate-spin' : ''}`} />
              <span>
                {bulkStep
                  ? `生成中… (${bulkStep.index}/3 ${bulkStep.label})`
                  : '最新データ（キャラ・武器・聖遺物）をオンライン生成'}
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
            <button type="button" onClick={() => setBulkError(null)} className="text-red-300 hover:text-white shrink-0" title="閉じる">
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
            <button type="button" onClick={() => showStatus(null)} className="text-red-300 hover:text-white shrink-0" title="閉じる">
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
              最終更新: {database.lastSyncedAt}
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
              <span>キャラクター ({database.characters.length})</span>
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
              <span>武器 ({database.weapons.length})</span>
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
              <span>聖遺物 ({database.artifacts.length})</span>
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
              <span>最新データ同期・バックアップ</span>
            </button>
          </div>

          <div className="text-[11px] font-mono text-slate-500 pb-2">
            同期状態: <span className="text-slate-300">{database.lastSyncedAt || '未同期'}</span>
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
                    placeholder="キャラ名・英語名・IDで検索..."
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
                  title="ロック中のものだけを表示"
                >
                  <Lock className="w-3 h-3" />
                  <span>ロック中のみ</span>
                </button>

                {/* gcsim 未実装のみ表示 */}
                <button
                  type="button"
                  onClick={() => setGcsimMissingOnly(v => !v)}
                  className={`flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold rounded-md border transition-colors shrink-0 ${
                    gcsimMissingOnly ? 'bg-rose-500/20 text-rose-300 border-rose-500/50' : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                  }`}
                  title="genshin-db にあって gcsim に未実装（gcsim キーが無い）ものだけを表示"
                >
                  <AlertTriangle className="w-3 h-3" />
                  <span>gcsim 未実装のみ</span>
                </button>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={handleDeleteAllCharacters}
                    disabled={database.characters.length === 0}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-red-950/80 hover:bg-red-900 disabled:opacity-40 border border-red-800/80 text-red-300 font-bold text-xs rounded-lg shadow transition-all shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-red-400" />
                    <span>全キャラ一括削除 ({database.characters.length})</span>
                  </button>

                  {/* 最新マスターデータの動的生成（キャラ）。武器・聖遺物のタブと同じ位置・形（issue #27） */}
                  <button
                    onClick={handleSyncCharacters}
                    disabled={isSyncing}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-700/90 hover:bg-emerald-600 disabled:opacity-50 text-white font-bold text-xs rounded-lg shadow-md transition-all shrink-0 cursor-pointer"
                    title="genshin-db API と gcsim から最新の全キャラクターデータをオンライン取得して生成"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${syncingKind === 'character' ? 'animate-spin' : ''}`} />
                    <span>
                      {syncingKind === 'character' && charSyncProgress
                        ? `生成中… ${charSyncProgress.phase}${charSyncProgress.total > 1 ? ` ${charSyncProgress.done}/${charSyncProgress.total}` : ''}`
                        : '最新キャラをオンライン生成'}
                    </span>
                  </button>

                  <button
                    onClick={() => {
                      setEditingCharacter({
                        id: `custom_${Date.now()}`,
                        name: '新規キャラクター',
                        element: 'pyro',
                        weaponType: 'sword',
                        avatarUrl: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=150&auto=format&fit=crop&q=80',
                        color: '#ef4444',
                        accentColor: '#f87171',
                        availableActions: [
                          { id: 'act_e', name: '元素スキル', shortName: 'E', type: 'skill', defaultDuration: 0.8, startsSkillCooldown: true, cooldown: 6.0, effectDuration: 0 },
                          { id: 'act_q', name: '元素爆発', shortName: 'Q', type: 'burst', defaultDuration: 1.2, startsBurstCooldown: true, cooldown: 15.0, effectDuration: 0 },
                          { id: 'act_n', name: '通常攻撃', shortName: 'N', type: 'normal', defaultDuration: 0.3 }
                        ]
                      });
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-lg shadow-md transition-all shrink-0"
                  >
                    <Plus className="w-4 h-4" />
                    <span>カスタムキャラ追加</span>
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
                            alt={char.name}
                            className="w-10 h-10 rounded-lg object-cover border border-slate-700 shrink-0"
                          />
                          <div>
                            <div className="flex items-center gap-1.5">
                              <h3 className="font-bold text-sm text-white flex items-center gap-1.5 flex-wrap"><span>{char.name}</span><GcsimMissingBadge char={char} /></h3>
                              {isCustom && (
                                <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
                                  カスタム
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
                            itemTypeLabel="キャラ"
                          />
                          <button
                            onClick={() => setEditingCharacter(char)}
                            className="p-1.5 text-slate-400 hover:text-amber-300 hover:bg-slate-800 rounded-lg transition-colors"
                            title="パラメータ編集"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteChar(char.id, char.name)}
                            className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-slate-800 rounded-lg transition-colors"
                            title="削除"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Params Summary (CT はアクションごとの値をまとめて表示) */}
                      <div className="grid grid-cols-2 gap-1.5 text-[11px] font-mono bg-slate-950/70 p-2 rounded-lg border border-slate-800/80">
                        <div>
                          <span className="text-slate-400">スキルCT:</span>{' '}
                          <strong className="text-amber-300">{formatCharacterCooldowns(char, 'skill')}</strong>
                        </div>
                        <div>
                          <span className="text-slate-400">爆発CT:</span>{' '}
                          <strong className="text-purple-300">{formatCharacterCooldowns(char, 'burst')}</strong>
                        </div>
                        <div className="col-span-2">
                          <span className="text-slate-400">モーション:</span>{' '}
                          {char.availableActions.some(a => a.frames) ? (
                            <strong className={char.source?.frameSource ? 'text-amber-300' : 'text-emerald-300'} title={char.source?.frameSource ? `gcsim のリリースには入っていない実装のフレームです（出典: ${char.source.frameSource}）` : undefined}>
                              {char.source?.frameSource ? `出典: ${char.source.frameSource}` : 'gcsim フレーム'} ({char.availableActions.filter(a => a.frames).length}/{char.availableActions.length})
                            </strong>
                          ) : char.source?.frameSource ? (
                            <strong className="text-amber-300" title="実測のフレームがありません。同じ武器種のキャラの中央値からの推定です">出典: {char.source.frameSource}</strong>
                          ) : (
                            <strong className="text-slate-500">フレーム未取得 (仮の秒数)</strong>
                          )}
                        </div>
                      </div>

                      {/* Action Templates with per-action CT & Duration */}
                      <div className="border-t border-slate-800/60 pt-2 space-y-1.5">
                        <div className="text-[11px] text-slate-400 flex items-center justify-between">
                          <span className="font-semibold text-slate-300">登録アクション ({char.availableActions.length}種):</span>
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
                                title={`${act.name}: モーション ${act.defaultDuration}s${act.frames ? ` (${act.frames.total}f / ${act.frames.source})` : ' (仮の秒数)'} | 記法略称: ${act.shortName}${hasDistinctLabel ? ` | ボタン名: ${act.buttonLabel}` : ''}${ct > 0 ? ` | CT: ${ct}s` : ''}${dur > 0 ? ` | 効果: ${dur}s` : ''}`}
                              >
                                <span className="font-bold text-amber-300">{act.shortName}</span>
                                {hasDistinctLabel && (
                                  <span className="text-sky-300 text-[9px]">[{act.buttonLabel}]</span>
                                )}
                                {ct > 0 && (
                                  <span className="text-amber-400/90 font-mono text-[9px] bg-amber-950/60 px-1 rounded border border-amber-800/40">CT:{ct}s</span>
                                )}
                                {dur > 0 && (
                                  <span className="text-purple-300/90 font-mono text-[9px] bg-purple-950/60 px-1 rounded border border-purple-800/40">効果:{dur}s</span>
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
                    placeholder="武器名・効果で検索..."
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
                    全武器種
                  </button>
                  {(['sword', 'claymore', 'polearm', 'bow', 'catalyst'] as WeaponType[]).map(wt => (
                    <button
                      key={wt}
                      onClick={() => setWeaponTypeFilter(wt)}
                      className={`px-2.5 py-1 text-[11px] font-semibold rounded-md border capitalize transition-colors ${
                        weaponTypeFilter === wt ? 'bg-sky-500/20 text-sky-300 border-sky-500/50' : 'bg-slate-900 text-slate-400 border-slate-800'
                      }`}
                    >
                      {WEAPON_TYPE_NAMES_JA[wt]}
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
                  title="ロック中のものだけを表示"
                >
                  <Lock className="w-3 h-3" />
                  <span>ロック中のみ</span>
                </button>

                {/* gcsim 未実装のみ表示 */}
                <button
                  type="button"
                  onClick={() => setGcsimMissingOnly(v => !v)}
                  className={`flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold rounded-md border transition-colors shrink-0 ${
                    gcsimMissingOnly ? 'bg-rose-500/20 text-rose-300 border-rose-500/50' : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                  }`}
                  title="genshin-db にあって gcsim に未実装（gcsim キーが無い）ものだけを表示"
                >
                  <AlertTriangle className="w-3 h-3" />
                  <span>gcsim 未実装のみ</span>
                </button>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={handleDeleteAllWeapons}
                    disabled={database.weapons.length === 0}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-red-950/80 hover:bg-red-900 disabled:opacity-40 border border-red-800/80 text-red-300 font-bold text-xs rounded-lg shadow transition-all shrink-0 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-red-400" />
                    <span>全武器一括削除 ({database.weapons.length})</span>
                  </button>

                  <button
                    onClick={handleSyncWeapons}
                    disabled={isSyncing}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-sky-700/90 hover:bg-sky-600 disabled:opacity-50 text-white font-bold text-xs rounded-lg shadow-md transition-all shrink-0 cursor-pointer"
                    title="genshin-db API から最新の全武器データをオンライン取得して生成"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${syncingKind === 'weapon' ? 'animate-spin' : ''}`} />
                    <span>最新武器をオンライン生成</span>
                  </button>

                  <button
                    onClick={() => {
                      setEditingWeapon({
                        id: `weapon_custom_${Date.now()}`,
                        name: 'カスタム新規武器',
                        weaponType: 'sword',
                        rarity: 5,
                        baseAttack: 608,
                        passiveName: '独自パッシブスキル',
                        description: '元素スキル発動後、12秒間攻撃力+20%',
                        buffEffect: {
                          id: `buff_w_${Date.now()}`,
                          name: 'カスタム武器バフ (攻撃力+20%)',
                          duration: 12.0,
                          cooldown: 20.0,
                          statEffect: '攻撃力 +20%',
                          description: '12秒間攻撃力+20%',
                          color: '#f59e0b'
                        }
                      });
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs rounded-lg shadow-md transition-all shrink-0"
                  >
                    <Plus className="w-4 h-4" />
                    <span>カスタム武器追加</span>
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
                    onDelete={() => handleDeleteWeapon(weapon.id, weapon.name)}
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
                    placeholder="聖遺物名・2セット/4セット効果で検索..."
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
                  title="ロック中のものだけを表示"
                >
                  <Lock className="w-3 h-3" />
                  <span>ロック中のみ</span>
                </button>

                {/* gcsim 未実装のみ表示 */}
                <button
                  type="button"
                  onClick={() => setGcsimMissingOnly(v => !v)}
                  className={`flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold rounded-md border transition-colors shrink-0 ${
                    gcsimMissingOnly ? 'bg-rose-500/20 text-rose-300 border-rose-500/50' : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                  }`}
                  title="genshin-db にあって gcsim に未実装（gcsim キーが無い）ものだけを表示"
                >
                  <AlertTriangle className="w-3 h-3" />
                  <span>gcsim 未実装のみ</span>
                </button>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={handleDeleteAllArtifacts}
                    disabled={database.artifacts.length === 0}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-red-950/80 hover:bg-red-900 disabled:opacity-40 border border-red-800/80 text-red-300 font-bold text-xs rounded-lg shadow transition-all shrink-0 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-red-400" />
                    <span>全聖遺物一括削除 ({database.artifacts.length})</span>
                  </button>

                  <button
                    onClick={handleSyncArtifacts}
                    disabled={isSyncing}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-700/90 hover:bg-purple-600 disabled:opacity-50 text-white font-bold text-xs rounded-lg shadow-md transition-all shrink-0 cursor-pointer"
                    title="genshin-db API から最新の全聖遺物データをオンライン取得して生成"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${syncingKind === 'artifact' ? 'animate-spin' : ''}`} />
                    <span>最新聖遺物をオンライン生成</span>
                  </button>

                  <button
                    onClick={() => {
                      setEditingArtifact({
                        id: `art_custom_${Date.now()}`,
                        name: 'カスタム聖遺物 4セット',
                        rarity: 5,
                        effect2p: '攻撃力 +18%',
                        effect4p: '元素爆発命中後、10秒間全ダメバフ+24%',
                        buffEffect: {
                          id: `buff_art_${Date.now()}`,
                          name: 'カスタム聖遺物: 全ダメバフ+24%',
                          duration: 10.0,
                          statEffect: '全ダメージ +24%',
                          description: '元素爆発命中後10秒間、全ダメバフ+24%',
                          color: '#c084fc'
                        }
                      });
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs rounded-lg shadow-md transition-all shrink-0"
                  >
                    <Plus className="w-4 h-4" />
                    <span>カスタム聖遺物追加</span>
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
                        <h3 className="font-bold text-sm text-white">{art.name}</h3>
                        {art.isCustom && (
                          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300 border border-purple-500/40">
                            カスタム
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1">
                        <ItemLockButton
                          locked={!!art.isLocked}
                          onToggle={() => handleToggleArtifactLock(art.id, !art.isLocked)}
                          itemTypeLabel="聖遺物"
                        />
                        <button
                          onClick={() => setEditingArtifact(art)}
                          className="p-1.5 text-slate-400 hover:text-purple-300 hover:bg-slate-800 rounded-lg transition-colors"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteArtifact(art.id, art.name)}
                          className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-slate-800 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1 text-xs bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/80">
                      <div>
                        <span className="text-purple-300 font-bold">2セット:</span>{' '}
                        <span className="text-slate-300">{art.effect2p}</span>
                      </div>
                      <div>
                        <span className="text-amber-300 font-bold">4セット:</span>{' '}
                        <span className="text-slate-300">{art.effect4p}</span>
                      </div>
                    </div>

                    {art.buffEffect && (
                      <div className="flex items-center justify-between text-[11px] font-mono bg-purple-950/40 border border-purple-800/50 px-2.5 py-1 rounded text-purple-200">
                        <span>連動バフ: {art.buffEffect.name}</span>
                        <div className="flex items-center gap-1.5">
                          <strong className="text-amber-300">{Number(art.buffEffect.duration).toFixed(1)}s 持続</strong>
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
                        <span>⚡ 最新マスターデータの動的生成 (キャラ)</span>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono">オンライン取得</span>
                      </h3>
                      <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                        genshin-db API (基本データ・アクションごとのCT/効果継続時間・公式アイコン) と gcsim の GitHub ソース (60 FPS モーションフレーム) を毎回ネットから取得し、全キャラのマスターデータを生成してアプリ内DBを更新します。
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-slate-800">
                    <div className="text-xs text-slate-400 flex items-center gap-1.5">
                      <span>登録数: <strong className="font-mono text-amber-300 font-bold">{database.characters.length} キャラ</strong></span>
                      {lockedCharCount > 0 && (
                        <span className="text-[10px] text-sky-400 font-mono font-bold">({lockedCharCount} ロック保護中)</span>
                      )}
                    </div>
                    <div className="flex flex-col sm:items-end gap-2">
                      <button
                        onClick={handleSyncCharacters}
                        disabled={isSyncing}
                        className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 disabled:opacity-50 text-slate-950 font-extrabold text-xs rounded-xl shadow-lg transition-all cursor-pointer"
                      >
                        <RefreshCw className={`w-4 h-4 ${syncingKind === 'character' ? 'animate-spin' : ''}`} />
                        <span>最新マスターデータの動的生成 (キャラ)</span>
                      </button>
                      <button
                        onClick={handleDeleteAllCharacters}
                        disabled={database.characters.length === 0}
                        className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-3 py-1.5 bg-red-950/70 hover:bg-red-900 disabled:opacity-40 text-red-300 text-xs font-bold rounded-lg border border-red-800/80 transition-all cursor-pointer"
                        title="ロック中以外の全キャラクターを一括削除"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-red-400" />
                        <span>全キャラ一括削除</span>
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
                      生成に失敗しました: {charSyncError}
                      <div className="text-red-300/70 mt-0.5">ネット接続、または GitHub API の回数制限 (1時間60回) を確認してください。DBは変更されていません。</div>
                    </div>
                  )}

                  {charSyncReport && (
                    <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 text-[11px] text-slate-300 space-y-1.5 max-h-64 overflow-y-auto">
                      <div className="font-bold text-slate-200">
                        生成レポート: {charSyncReport.totalCharacters} キャラ / gcsim フレームあり {charSyncReport.charactersWithFrames}
                        <span className="text-slate-500 font-mono font-normal"> (gcsim {charSyncReport.gcsimCommit.slice(0, 7)}{charSyncReport.catalogCommit ? ` / 辞書 ${charSyncReport.catalogCommit}` : ''})</span>
                      </div>
                      {charSyncReport.skipped.length > 0 && (
                        <div><span className="text-slate-400">対象外:</span> {charSyncReport.skipped.map(s => `${s.name} (${s.reason})`).join(' / ')}</div>
                      )}
                      {charSyncReport.placeholderDurations.length > 0 && (
                        <div>
                          <div className="text-amber-300">仮の秒数を使用 (フレーム未取得):</div>
                          <ul className="pl-3 list-disc text-slate-400">
                            {charSyncReport.placeholderDurations.map(p => (
                              <li key={p.characterId}>{p.name}: {p.actions.map(a => a.replace(`${p.characterId}_`, '')).join(', ')} ({p.reason})</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {charSyncReport.missingCooldowns.length > 0 && (
                        <div><span className="text-red-300">CT 未取得:</span> {charSyncReport.missingCooldowns.map(m => `${m.name} ${m.actionId}`).join(' / ')}</div>
                      )}
                      {charSyncReport.errors.length > 0 && (
                        <div><span className="text-red-300">エラー:</span> {charSyncReport.errors.join(' / ')}</div>
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
                        <span>⚔️ 最新マスターデータの動的生成 (武器)</span>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 font-mono">オンライン取得</span>
                      </h3>
                      <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                        genshin-db API から毎回ネット経由で全武器データをオンライン取得し、基礎攻撃力 (Lv.90)、サブステータス、パッシブ効果および発動バフ（継続時間・CT・ステータス要約）を自動解析・構造化してアプリ内DBを最新化します。
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-slate-800">
                    <div className="text-xs text-slate-400 flex items-center gap-1.5">
                      <span>登録数: <strong className="font-mono text-sky-300 font-bold">{database.weapons.length} 武器</strong></span>
                      {lockedWeaponCount > 0 && (
                        <span className="text-[10px] text-sky-400 font-mono font-bold">({lockedWeaponCount} ロック保護中)</span>
                      )}
                    </div>
                    <div className="flex flex-col sm:items-end gap-2">
                      <button
                        onClick={handleSyncWeapons}
                        disabled={isSyncing}
                        className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-sky-600 to-sky-500 hover:from-sky-500 hover:to-sky-400 disabled:opacity-50 text-slate-950 font-extrabold text-xs rounded-xl shadow-lg transition-all cursor-pointer"
                      >
                        <RefreshCw className={`w-4 h-4 ${syncingKind === 'weapon' ? 'animate-spin' : ''}`} />
                        <span>最新マスターデータの動的生成 (武器)</span>
                      </button>
                      <button
                        onClick={handleDeleteAllWeapons}
                        disabled={database.weapons.length === 0}
                        className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-3 py-1.5 bg-red-950/70 hover:bg-red-900 disabled:opacity-40 text-red-300 text-xs font-bold rounded-lg border border-red-800/80 transition-all cursor-pointer"
                        title="ロック中以外の全武器を一括削除"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-red-400" />
                        <span>全武器一括削除</span>
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
                      生成に失敗しました: {weaponSyncError}
                      <div className="text-red-300/70 mt-0.5">ネットワーク環境または API サーバーの状態を確認してください。DBは変更されていません。</div>
                    </div>
                  )}

                  {weaponSyncReport && (
                    <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 text-[11px] text-slate-300 space-y-2 max-h-64 overflow-y-auto">
                      <div className="font-bold text-sky-200 flex items-center justify-between">
                        <span>武器マスター生成レポート: 全 {weaponSyncReport.totalWeapons} 件 / 発動バフ抽出 {weaponSyncReport.weaponsWithBuffs} 件
                          {weaponSyncReport.gcsimCommit && <span className="text-slate-500 font-mono font-normal"> (gcsim {weaponSyncReport.gcsimCommit.slice(0, 7)} / 辞書 {weaponSyncReport.catalogCommit ?? '-'})</span>}
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono">常時効果 {weaponSyncReport.constantPassiveItems.length} 件</span>
                      </div>
                      {weaponSyncReport.sourceApiUrl && (
                        <div className="flex flex-wrap items-center gap-2 p-1.5 rounded bg-sky-950/60 border border-sky-800/40 text-[10px] font-mono text-sky-300">
                          <span>🌐 オンラインAPI取得: {weaponSyncReport.sourceApiUrl}</span>
                          <span>• 通信時間: {((weaponSyncReport.networkDurationMs ?? 0) / 1000).toFixed(2)}s</span>
                          <span>• 取得生データ: 日本語 {weaponSyncReport.fetchedRawCountJa}件 / 英語 {weaponSyncReport.fetchedRawCountEn}件</span>
                        </div>
                      )}
                      <div className="text-slate-400">発動バフ抽出サンプル (全 {weaponSyncReport.extractedBuffsList.length} 件中):</div>
                      <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto p-1.5 bg-slate-950/70 rounded-lg border border-slate-800/60">
                        {weaponSyncReport.extractedBuffsList.slice(0, 30).map((b, idx) => (
                          <span key={idx} className="px-1.5 py-0.5 rounded bg-sky-950/80 border border-sky-800/50 text-[10px] text-sky-200" title={`${b.sourceName}: ${b.buffName} - ${b.statSummary || ''}`}>
                            <strong className="text-amber-300">{b.sourceName}</strong>: {b.buffName} ({b.duration}s{b.cooldown ? ` / CT ${b.cooldown}s` : ''})
                          </span>
                        ))}
                        {weaponSyncReport.extractedBuffsList.length > 30 && (
                          <span className="text-[10px] text-slate-500 self-center">...他 {weaponSyncReport.extractedBuffsList.length - 30} 件</span>
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
                        <span>🏺 最新マスターデータの動的生成 (聖遺物)</span>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-pink-500/20 text-pink-300 font-mono">オンライン取得</span>
                      </h3>
                      <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                        genshin-db API から毎回ネット経由で全聖遺物セットをオンライン取得し、2セット・4セット効果および4セット効果発動バフ（継続時間・CT・ステータス要約）を自動解析・構造化してアプリ内DBを最新化します。
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-slate-800">
                    <div className="text-xs text-slate-400 flex items-center gap-1.5">
                      <span>登録数: <strong className="font-mono text-pink-300 font-bold">{database.artifacts.length} セット</strong></span>
                      {lockedArtifactCount > 0 && (
                        <span className="text-[10px] text-purple-400 font-mono font-bold">({lockedArtifactCount} ロック保護中)</span>
                      )}
                    </div>
                    <div className="flex flex-col sm:items-end gap-2">
                      <button
                        onClick={handleSyncArtifacts}
                        disabled={isSyncing}
                        className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-pink-600 to-pink-500 hover:from-pink-500 hover:to-pink-400 disabled:opacity-50 text-slate-950 font-extrabold text-xs rounded-xl shadow-lg transition-all cursor-pointer"
                      >
                        <RefreshCw className={`w-4 h-4 ${syncingKind === 'artifact' ? 'animate-spin' : ''}`} />
                        <span>最新マスターデータの動的生成 (聖遺物)</span>
                      </button>
                      <button
                        onClick={handleDeleteAllArtifacts}
                        disabled={database.artifacts.length === 0}
                        className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-3 py-1.5 bg-red-950/70 hover:bg-red-900 disabled:opacity-40 text-red-300 text-xs font-bold rounded-lg border border-red-800/80 transition-all cursor-pointer"
                        title="ロック中以外の全聖遺物を一括削除"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-red-400" />
                        <span>全聖遺物一括削除</span>
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
                      生成に失敗しました: {artifactSyncError}
                      <div className="text-red-300/70 mt-0.5">ネットワーク環境または API サーバーの状態を確認してください。DBは変更されていません。</div>
                    </div>
                  )}

                  {artifactSyncReport && (
                    <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 text-[11px] text-slate-300 space-y-2 max-h-64 overflow-y-auto">
                      <div className="font-bold text-pink-200 flex items-center justify-between">
                        <span>聖遺物マスター生成レポート: 全 {artifactSyncReport.totalArtifacts} セット / 発動バフ抽出 {artifactSyncReport.artifactsWithBuffs} 件
                          {artifactSyncReport.gcsimCommit && <span className="text-slate-500 font-mono font-normal"> (gcsim {artifactSyncReport.gcsimCommit.slice(0, 7)} / 辞書 {artifactSyncReport.catalogCommit ?? '-'})</span>}
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono">常時効果 {artifactSyncReport.constantPassiveItems.length} 件</span>
                      </div>
                      {artifactSyncReport.sourceApiUrl && (
                        <div className="flex flex-wrap items-center gap-2 p-1.5 rounded bg-pink-950/60 border border-pink-800/40 text-[10px] font-mono text-pink-300">
                          <span>🌐 オンラインAPI取得: {artifactSyncReport.sourceApiUrl}</span>
                          <span>• 通信時間: {((artifactSyncReport.networkDurationMs ?? 0) / 1000).toFixed(2)}s</span>
                          <span>• 取得生データ: 日本語 {artifactSyncReport.fetchedRawCountJa}件 / 英語 {artifactSyncReport.fetchedRawCountEn}件</span>
                        </div>
                      )}
                      <div className="text-slate-400">発動バフ抽出サンプル (全 {artifactSyncReport.extractedBuffsList.length} 件中):</div>
                      <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto p-1.5 bg-slate-950/70 rounded-lg border border-slate-800/60">
                        {artifactSyncReport.extractedBuffsList.slice(0, 30).map((b, idx) => (
                          <span key={idx} className="px-1.5 py-0.5 rounded bg-pink-950/80 border border-pink-800/50 text-[10px] text-pink-200" title={`${b.sourceName}: ${b.buffName} - ${b.statSummary || ''}`}>
                            <strong className="text-amber-300">{b.sourceName}</strong>: {b.buffName} ({b.duration}s{b.cooldown ? ` / CT ${b.cooldown}s` : ''})
                          </span>
                        ))}
                        {artifactSyncReport.extractedBuffsList.length > 30 && (
                          <span className="text-[10px] text-slate-500 self-center">...他 {artifactSyncReport.extractedBuffsList.length - 30} 件</span>
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
                  <span>同期仕様とデータソースについての解説</span>
                </div>
                <p>
                  genshin-db (公式数値・テキスト) ＋ gcsim (60 FPSモーションフレーム) を組み合わせた全124キャラ完全マスターDBに対応しています。
                </p>
                <p className="text-slate-500">
                  ※ スキル・爆発の各種CT、効果継続時間、および60 FPS基準のアニメーションフレーム秒数は「キャラクター」タブの各キャラ編集画面からコンマ0.01秒単位で自由にカスタマイズ・保存できます。
                </p>
              </div>

              {/* JSON Export / Import */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
                  <div className="flex items-center gap-2 text-amber-300 font-bold text-sm">
                    <Download className="w-4 h-4 text-amber-400" />
                    <span>JSON形式で出力 (バックアップ)</span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    現在保存されているデータベース (ユーザーによるカスタマイズデータを含む) をJSONファイル形式で出力・ダウンロードします。
                  </p>
                  <button
                    onClick={handleExportJson}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-amber-200 font-bold text-xs rounded-lg border border-slate-700 transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    <span>DBファイル(.json)をダウンロード</span>
                  </button>
                </div>

                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
                  <div className="flex items-center gap-2 text-sky-300 font-bold text-sm">
                    <Upload className="w-4 h-4 text-sky-400" />
                    <span>JSON形式から復元 (インポート)</span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    保存したJSONファイルを読み込み、キャラクター・武器・聖遺物の最新カスタマイズ環境を復元・更新します。
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
                    <span>DBファイルを選択して読み込み</span>
                  </button>
                </div>
              </div>

              {/* Danger Zone: Delete & Clear Options */}
              <div className="bg-red-950/30 p-5 rounded-xl border border-red-900/60 space-y-4">
                <div className="flex items-center gap-2 text-red-400 font-bold text-sm">
                  <AlertTriangle className="w-4.5 h-4.5 text-red-400" />
                  <span>データ消去・リセット操作 (Danger Zone)</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                  <div className="bg-slate-900/80 p-3 rounded-lg border border-red-900/40 flex flex-col justify-between space-y-2">
                    <div>
                      <div className="font-bold text-xs text-red-300">全キャラ一括削除</div>
                      <p className="text-[11px] text-slate-400 mt-0.5">登録中の全 {database.characters.length} キャラクターのみ消去します。</p>
                    </div>
                    <button
                      onClick={handleDeleteAllCharacters}
                      disabled={database.characters.length === 0}
                      className="w-full py-1.5 bg-red-950 hover:bg-red-900 disabled:opacity-40 text-red-300 text-xs font-bold rounded border border-red-800 transition-colors flex items-center justify-center gap-1"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-red-400" />
                      <span>全キャラ一括削除</span>
                    </button>
                  </div>

                  <div className="bg-slate-900/80 p-3 rounded-lg border border-red-900/40 flex flex-col justify-between space-y-2">
                    <div>
                      <div className="font-bold text-xs text-amber-300">初期マスターへ戻す</div>
                      <p className="text-[11px] text-slate-400 mt-0.5">公式の初期実装キャラ構成にデータベースを復元します。</p>
                    </div>
                    <button
                      onClick={handleFullReset}
                      className="w-full py-1.5 bg-amber-950/80 hover:bg-amber-900 text-amber-200 text-xs font-bold rounded border border-amber-800 transition-colors flex items-center justify-center gap-1"
                    >
                      <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
                      <span>初期状態に復元</span>
                    </button>
                  </div>

                  <div className="bg-slate-900/80 p-3 rounded-lg border border-red-900/40 flex flex-col justify-between space-y-2">
                    <div>
                      <div className="font-bold text-xs text-rose-400">DB完全消去 (クリア)</div>
                      <p className="text-[11px] text-slate-400 mt-0.5">全キャラ・全武器・全聖遺物データを完全クリアします。</p>
                    </div>
                    <button
                      onClick={handleClearAllData}
                      className="w-full py-1.5 bg-rose-950 hover:bg-rose-900 text-rose-200 text-xs font-bold rounded border border-rose-800 transition-colors flex items-center justify-center gap-1"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                      <span>全データクリア</span>
                    </button>
                  </div>
                </div>
              </div>

            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between text-xs text-slate-400">
          <span>※ 変更されたデータベースはブラウザのLocalStorageに全自動保存されます。</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg transition-colors shadow-md"
          >
            完了して閉じる
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
                <p className="text-xs text-slate-400">実行確認</p>
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
                キャンセル
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
