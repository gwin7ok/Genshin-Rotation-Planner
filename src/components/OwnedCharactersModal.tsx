import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { X, UserCheck, RefreshCw, AlertTriangle, CheckCircle2, ExternalLink, Trash2, Download, Copy, Check } from 'lucide-react';
import { t, dateLocale } from '../i18n';
import { charName } from '../i18n/loc';
import type { AppDatabase } from '../types/database';
import { CharacterAvatar } from './CharacterAvatar';
import { GcsimMissingBadge } from './GcsimMissingBadge';
import { useDialogs } from './DialogProvider';
import { fetchEnkaFromExtension, fetchFromExtension, pingExtension } from '../utils/hoyolab/extensionClient';
import { convertEnkaResponse } from '../utils/hoyolab/enkaConvert';
import { convertResponse, matchMasterCharacterId, type OwnedCharacter } from '../utils/hoyolab/importCharacters';
import { resolveAscension } from '../utils/hoyolab/resolveAscension';
import { BUNDLED_EXTENSION_VERSION, isOlderVersion } from '../utils/hoyolab/extensionVersion';
import { clearOwned, loadHoyolabUid, loadOwned, saveHoyolabUid, saveOwned, type OwnedStore } from '../utils/hoyolab/ownedStore';

/** 拡張機能の zip を置く、GitHub のリリースページ */
const RELEASES_URL = 'https://github.com/gwin7ok/Genshin-Rotation-Planner/releases';
/** 拡張機能の zip（アプリに同梱。ビルドのとき npm run ext:pack で作る）。サイトの公開先のパスに合わせる */
const EXTENSION_ZIP_URL = `${import.meta.env.BASE_URL}downloads/grp-hoyolab-importer.zip`;
const EXTENSIONS_PAGE = 'chrome://extensions';

/** 拡張機能の導入手順（5 つの手順カード＋うまくいかないとき）。拡張機能を検知できないときだけ出す */
/** Enka.Network からの取り込みに要る、拡張機能の最低の版 */
const ENKA_MIN_EXTENSION_VERSION = '0.2.0';

const InstallGuide: React.FC<{ mode?: 'install' | 'update' }> = ({ mode = 'install' }) => {
  const isUpdate = mode === 'update';
  const [copied, setCopied] = useState(false);
  // Chrome は、Web ページから chrome:// のページを開くことを禁止している。代わりに、アドレスをコピーしたうえで、空の新しいタブを開く
  // （このアプリのタブを、拡張機能の画面に置き換えてしまわないように）。利用者は、開いたタブのアドレス欄に貼り付ける
  const copyAddress = async () => {
    window.open('about:blank', '_blank', 'noopener');
    try {
      await navigator.clipboard.writeText(EXTENSIONS_PAGE);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* コピーできないときは、画面の文字を手で写す */ }
  };
  const btn = 'inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border font-semibold transition-colors';
  const steps: { n: number; title: string; body: string; note?: string; action?: React.ReactNode }[] = [
    {
      n: 1, title: t('hoyolab:install.s1Title'), body: t('hoyolab:install.s1Body'),
      action: (
        <a href={EXTENSION_ZIP_URL} download="grp-hoyolab-importer.zip" data-testid="ext-download" className={`${btn} border-sky-500/60 bg-sky-500/15 text-sky-200 hover:bg-sky-500/25`}>
          <Download className="w-3.5 h-3.5" />{t('hoyolab:install.s1Button')}
        </a>
      ),
    },
    isUpdate
      ? { n: 2, title: t('hoyolab:update.s2Title'), body: t('hoyolab:update.s2Body'), note: t('hoyolab:update.s2Note') }
      : { n: 2, title: t('hoyolab:install.s2Title'), body: t('hoyolab:install.s2Body'), note: t('hoyolab:install.s2Note') },
    {
      n: 3, title: t('hoyolab:install.s3Title'), body: isUpdate ? t('hoyolab:update.s3Body') : t('hoyolab:install.s3Body'),
      action: (
        <button type="button" onClick={() => void copyAddress()} data-testid="ext-copy-address" className={`${btn} border-slate-600 text-slate-200 hover:bg-slate-800`}>
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
          {copied ? t('hoyolab:install.s3Copied') : t('hoyolab:install.s3Button', { address: EXTENSIONS_PAGE })}
        </button>
      ),
    },
    isUpdate
      ? { n: 4, title: t('hoyolab:update.s4Title'), body: t('hoyolab:update.s4Body') }
      : { n: 4, title: t('hoyolab:install.s4Title'), body: t('hoyolab:install.s4Body') },
    {
      n: 5, title: t('hoyolab:install.s5Title'), body: isUpdate ? t('hoyolab:update.s5Body') : t('hoyolab:install.s5Body'),
      action: (
        <button type="button" onClick={() => window.location.reload()} data-testid="ext-reload" className={`${btn} border-slate-600 text-slate-200 hover:bg-slate-800`}>
          <RefreshCw className="w-3.5 h-3.5" />{t('hoyolab:install.s5Button')}
        </button>
      ),
    },
  ];
  return (
    <div className="space-y-2" data-testid="ext-install-guide">
      {!isUpdate && <p className="font-semibold text-slate-200">{t('hoyolab:ext.installTitle')}</p>}
      <p className="text-[11px] text-slate-400">{isUpdate ? t('hoyolab:update.intro') : t('hoyolab:install.intro')}</p>
      <ol className="space-y-1.5">
        {steps.map(st => (
          <li key={st.n} className="flex gap-2.5 rounded-lg border border-slate-700/70 bg-slate-900/60 p-2.5">
            <span className="shrink-0 w-5 h-5 rounded-full bg-sky-500/20 border border-sky-500/50 text-sky-300 text-[11px] font-bold flex items-center justify-center">{st.n}</span>
            <div className="min-w-0 flex-1 space-y-1">
              <p className="font-semibold text-slate-100">{st.title}</p>
              <p className="text-slate-300 leading-relaxed">{st.body}</p>
              {st.note && <p className="text-[11px] text-amber-300/90 leading-relaxed">{st.note}</p>}
              {st.action && <div className="pt-0.5">{st.action}</div>}
            </div>
          </li>
        ))}
      </ol>
      {!isUpdate && <details className="rounded-lg border border-slate-700/70 bg-slate-900/40 p-2.5 text-[11px] text-slate-300">
        <summary className="cursor-pointer font-semibold text-slate-200">{t('hoyolab:install.troubleTitle')}</summary>
        <ul className="list-disc pl-5 mt-1.5 space-y-1 text-slate-400 leading-relaxed">
          <li>{t('hoyolab:install.trouble1')}</li>
          <li>{t('hoyolab:install.trouble2')}</li>
          <li>{t('hoyolab:install.trouble3')}</li>
          <li>{t('hoyolab:install.trouble4')}</li>
        </ul>
      </details>}
      {!isUpdate && <p className="text-[11px] text-slate-500">{t('hoyolab:install.update')}</p>}
      {!isUpdate && <a href={RELEASES_URL} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[11px] text-sky-300 hover:text-sky-200 underline">
        <ExternalLink className="w-3 h-3" />{t('hoyolab:ext.releaseLink')}
      </a>}
    </div>
  );
};

interface OwnedCharactersModalProps {
  isOpen: boolean;
  onClose: () => void;
  database: AppDatabase;
}

/** HoYoLAB の戦績から、持ちキャラを取り込む画面（拡張機能の検知・取得・取り込み済みの一覧）。設計: docs/hoyolab-import/design.md */
export const OwnedCharactersModal: React.FC<OwnedCharactersModalProps> = ({ isOpen, onClose, database }) => {
  const { confirm } = useDialogs();
  const [extVersion, setExtVersion] = useState<string | null | 'checking'>('checking');
  const [uid, setUid] = useState('');
  const [busy, setBusy] = useState<null | 'fetch' | 'fetchEnka' | 'resolve'>(null);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [store, setStore] = useState<OwnedStore | null>(null);

  const checkExtension = useCallback(async () => {
    setExtVersion('checking');
    setExtVersion(await pingExtension());
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    setUid(loadHoyolabUid());
    setStore(loadOwned());
    setMessage(null);
    void checkExtension();
  }, [isOpen, checkExtension]);

  const masterIds = useMemo(() => database.characters.map(c => c.id), [database.characters]);
  const masterById = useMemo(() => new Map(database.characters.map(c => [c.id, c])), [database.characters]);

  if (!isOpen) return null;

  const errorText = (retcode: number | undefined, error: string): string => {
    // 10101・10102: 戦績が非公開。-100・10001: ログインしていない（HoYoLAB の応答コード）
    if (retcode === 10102 || retcode === 10101) return t('hoyolab:import.errorPrivate', { message: error });
    if (retcode === -100 || retcode === 10001) return t('hoyolab:import.errorLogin', { message: error });
    return t('hoyolab:import.errorGeneric', { message: error });
  };

  /** 他のアカウントの UID: Enka.Network から取り込む（ゲーム内の「キャラクター詳細表示」に並べたキャラだけ） */
  const importFromEnka = async () => {
    if (extVersion === 'checking' || extVersion === null || isOlderVersion(extVersion, ENKA_MIN_EXTENSION_VERSION)) {
      setBusy(null);
      setMessage({ kind: 'error', text: t('hoyolab:import.enkaNeedUpdate', { version: ENKA_MIN_EXTENSION_VERSION }) });
      return;
    }
    setBusy('fetchEnka');
    const res = await fetchEnkaFromExtension(uid);
    if (!res.ok) {
      setBusy(null);
      setMessage({ kind: 'error', text: res.noExtension ? t('hoyolab:import.noExtension') : t('hoyolab:import.errorEnka', { message: res.error ?? '' }) });
      return;
    }
    const converted = convertEnkaResponse(res.data ?? {}, {
      characters: database.characters.map(c => ({ id: c.id, name: c.name, element: c.element })),
      weapons: database.weapons, artifacts: database.artifacts,
    });
    if (converted.length === 0) {
      setBusy(null);
      setMessage({ kind: 'error', text: t('hoyolab:import.enkaEmpty') });
      return;
    }
    saveHoyolabUid(uid);
    if (saveOwned(converted, res.data?.playerInfo?.nickname)) {
      setStore(loadOwned());
      setMessage({ kind: 'ok', text: t('hoyolab:import.doneEnka', { count: converted.length }) });
    } else {
      setMessage({ kind: 'error', text: t('hoyolab:import.errorGeneric', { message: 'storage' }) });
    }
    setBusy(null);
  };

  const handleImport = async () => {
    if (!/^\d{9,10}$/.test(uid)) { setMessage({ kind: 'error', text: t('hoyolab:import.invalidUid') }); return; }
    setMessage(null);
    setBusy('fetch');
    const res = await fetchFromExtension(uid);
    // 他のアカウントの UID は、HoYoLAB の詳細が許可されない（retcode 10104）。Enka.Network（ゲーム内の詳細表示のキャラだけ）で取り込む
    if (!res.ok && res.retcode === 10104) { await importFromEnka(); return; }
    if (!res.ok) {
      setBusy(null);
      setMessage({ kind: 'error', text: res.noExtension ? t('hoyolab:import.noExtension') : errorText(res.retcode, res.error ?? '') });
      return;
    }
    // 突破段階が不明なキャラは、gcsim の基礎 HP で決める（gcsim が使えなければ、突破前のまま）
    setBusy('resolve');
    const masters = { weapons: database.weapons, artifacts: database.artifacts };
    const converted = convertResponse(res.data);
    const resolved: OwnedCharacter[] = [];
    for (const owned of converted) {
      const id = matchMasterCharacterId(owned, masterIds);
      resolved.push(owned.ambiguousAscension ? await resolveAscension(owned, masterById.get(id ?? '')?.source?.gcsimKey, masters) : owned);
    }
    saveHoyolabUid(uid);
    if (saveOwned(resolved, res.data.nickname)) {
      setStore(loadOwned());
      const skipped = res.data.skipped ?? 0;
      setMessage({ kind: 'ok', text: skipped > 0 ? t('hoyolab:import.donePartial', { count: resolved.length, skipped }) : t('hoyolab:import.done', { count: resolved.length }) });
    } else {
      setMessage({ kind: 'error', text: t('hoyolab:import.errorGeneric', { message: 'storage' }) });
    }
    setBusy(null);
  };

  const handleClear = async () => {
    if (!(await confirm(t('hoyolab:list.clearConfirm')))) return;
    clearOwned();
    setStore(null);
    setMessage(null);
  };

  const notes = (o: OwnedCharacter): string[] => {
    const id = matchMasterCharacterId(o, masterIds);
    const master = id ? masterById.get(id) : undefined;
    const out: string[] = [];
    if (!master) out.push(t('hoyolab:list.noMaster'));
    if (o.ambiguousAscension) out.push(t('hoyolab:list.ambiguous'));
    if (!database.weapons.some(w => w.id === String(o.weapon.genshinId) || w.name === o.weapon.name)) out.push(t('hoyolab:list.noWeaponMaster'));
    if (o.artifactSets.some(s => s.count >= 2 && !database.artifacts.some(a => a.name === s.name))) out.push(t('hoyolab:list.noSetMaster'));
    return out;
  };

  const characters = store?.characters ?? [];
  const extOk = extVersion !== 'checking' && extVersion !== null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm"
      onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}
      data-testid="owned-modal"
    >
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800 bg-slate-950/50 shrink-0">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-sky-400" />
            <span>{t('hoyolab:title')}</span>
          </h2>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto text-xs text-slate-300">
          <p className="text-[11px] text-slate-400">{t('hoyolab:intro')}</p>

          {/* 拡張機能の状態 */}
          <div className="rounded-lg border border-slate-700 bg-slate-950/50 p-3 space-y-2" data-testid="owned-ext-status">
            <div className="flex items-center gap-2">
              {extVersion === 'checking' ? (
                <span className="text-slate-400">{t('hoyolab:ext.checking')}</span>
              ) : extOk ? (
                <span className="flex items-center gap-1.5 text-emerald-300 font-semibold"><CheckCircle2 className="w-4 h-4" />{t('hoyolab:ext.ok', { version: extVersion })}</span>
              ) : (
                <span className="flex items-center gap-1.5 text-amber-300 font-semibold"><AlertTriangle className="w-4 h-4" />{t('hoyolab:ext.missing')}</span>
              )}
              <button onClick={() => void checkExtension()} className="ml-auto flex items-center gap-1 px-2 py-0.5 rounded border border-slate-600 text-slate-300 hover:bg-slate-800">
                <RefreshCw className="w-3 h-3" />{t('hoyolab:ext.recheck')}
              </button>
            </div>
            {extVersion === null && <InstallGuide />}
            {extOk && isOlderVersion(extVersion, BUNDLED_EXTENSION_VERSION) && (
              <div className="rounded-lg border border-amber-500/50 bg-amber-950/30 p-2.5 space-y-1.5" data-testid="ext-update-notice">
                <p className="font-semibold text-amber-200 flex items-center gap-1.5"><AlertTriangle className="w-4 h-4 shrink-0" />{t('hoyolab:ext.updateTitle', { installed: extVersion, latest: BUNDLED_EXTENSION_VERSION })}</p>
                <p className="text-[11px] text-amber-100/90 leading-relaxed">{t('hoyolab:ext.updateBody')}</p>
                <InstallGuide mode="update" />
              </div>
            )}
            <p className="text-[10px] text-slate-500">{t('hoyolab:ext.note')}</p>
          </div>

          {/* 取り込み */}
          <div className="space-y-1.5">
            <label className="font-semibold text-slate-200" htmlFor="owned-uid">{t('hoyolab:uid.label')}</label>
            <div className="flex items-center gap-2">
              <input
                id="owned-uid" type="text" inputMode="numeric" maxLength={9} value={uid}
                onChange={e => setUid(e.target.value.replace(/\D/g, ''))}
                onKeyDown={e => { if (e.key === 'Enter' && !e.nativeEvent.isComposing && extOk && !busy) void handleImport(); }}
                placeholder={t('hoyolab:uid.placeholder')}
                data-testid="owned-uid-input"
                className="w-40 bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-white placeholder-slate-500 focus:outline-none focus:border-sky-400 font-mono"
              />
              <button
                onClick={() => void handleImport()}
                disabled={!extOk || busy !== null}
                data-testid="owned-import-button"
                className="px-4 py-1.5 rounded-lg font-bold bg-sky-500 hover:bg-sky-400 disabled:opacity-50 disabled:pointer-events-none text-slate-950 transition-colors"
              >
                {busy === 'fetch' ? t('hoyolab:import.running') : busy === 'fetchEnka' ? t('hoyolab:import.runningEnka') : busy === 'resolve' ? t('hoyolab:import.resolving') : t('hoyolab:import.button')}
              </button>
            </div>
            <p className="text-[11px] text-amber-300 flex items-start gap-1" data-testid="owned-login-hint">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-px" />
              <span>{t('hoyolab:uid.loginHint')}{' '}
                <a href="https://www.hoyolab.com/" target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 text-sky-300 hover:text-sky-200 underline">
                  <ExternalLink className="w-3 h-3" />{t('hoyolab:uid.loginLink')}
                </a>
              </span>
            </p>
            <p className="text-[10px] text-slate-500">{t('hoyolab:uid.hint')}</p>
            {message && (
              <div
                className={`p-2.5 rounded-lg border flex items-start gap-2 ${message.kind === 'ok' ? 'bg-emerald-950/50 border-emerald-500/40 text-emerald-200' : 'bg-red-950/60 border-red-500/50 text-red-200'}`}
                data-testid="owned-message"
              >
                {message.kind === 'ok' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
                <span>{message.text}</span>
              </div>
            )}
          </div>

          {/* 取り込み済みの一覧 */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-slate-200">{t('hoyolab:list.title')}</h3>
              {store?.nickname && <span className="text-xs font-semibold text-sky-300" data-testid="owned-nickname">{store.nickname}</span>}
              {store && <span className="text-[10px] text-slate-500">{t('hoyolab:list.summary', { count: characters.length, date: new Date(store.importedAt).toLocaleString(dateLocale) })}</span>}
              {store && (
                <button onClick={() => void handleClear()} className="ml-auto flex items-center gap-1 px-2 py-0.5 rounded border border-slate-600 text-slate-400 hover:text-red-300 hover:border-red-500/50">
                  <Trash2 className="w-3 h-3" />{t('hoyolab:list.clear')}
                </button>
              )}
            </div>
            {characters.length === 0 ? (
              <p className="text-slate-500" data-testid="owned-empty">{t('hoyolab:list.empty')}</p>
            ) : (
              <ul className="grid grid-cols-1 md:grid-cols-2 gap-1.5" data-testid="owned-list">
                {characters.map(o => {
                  const id = matchMasterCharacterId(o, masterIds);
                  const master = id ? masterById.get(id) : undefined;
                  const ns = notes(o);
                  return (
                    <li key={`${o.genshinId}-${o.element}`} className="flex items-start gap-2 rounded-lg border border-slate-700/70 bg-slate-950/40 p-2">
                      {master ? <CharacterAvatar char={master} className="w-9 h-9 rounded-lg text-sm shrink-0" /> : <div className="w-9 h-9 rounded-lg bg-slate-800 shrink-0" />}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-semibold text-slate-100">{master ? charName(master) : o.name}</span>
                          {master && <GcsimMissingBadge char={master} />}
                          <span className="text-slate-400">{t('hoyolab:list.level', { level: o.level })}</span>
                          <span className="text-slate-400">{t('hoyolab:list.cons', { count: o.constellation })}</span>
                        </div>
                        <div className="text-[10px] text-slate-400 truncate">
                          {o.weapon.name}（{t('hoyolab:list.refine', { rank: o.weapon.refinement })}）
                          {o.artifactSets.filter(s => s.count >= 2).map(s => ` / ${s.name}×${s.count}`).join('')}
                        </div>
                        {ns.map(n => (
                          <div key={n} className="text-[10px] text-amber-300 flex items-start gap-1"><AlertTriangle className="w-3 h-3 shrink-0 mt-px" />{n}</div>
                        ))}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end px-5 py-3 border-t border-slate-800 bg-slate-950/70 shrink-0">
          <button onClick={onClose} className="px-4 py-1.5 rounded-lg text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800 transition-colors">
            {t('action.close')}
          </button>
        </div>
      </div>
    </div>
  );
};
