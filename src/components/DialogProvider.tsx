import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { t } from '../i18n';

/**
 * アプリ内の確認・通知・入力ダイアログ（window.confirm / alert / prompt の代わり）。
 * Claude アプリの内部ブラウザなどの埋め込み表示では、ブラウザ標準のダイアログが出ない（confirm が false になる）ため、
 * アプリ自身のモーダルで表示する。使い方: const { confirm, alert, prompt } = useDialogs(); if (await confirm('…')) { … }
 */
export interface ConfirmOptions {
  okLabel?: string;
  cancelLabel?: string;
  /** 破壊的な操作は、OK を赤くする */
  danger?: boolean;
}

interface DialogApi {
  confirm: (message: string, options?: ConfirmOptions) => Promise<boolean>;
  alert: (message: string) => Promise<void>;
  prompt: (message: string, defaultValue?: string) => Promise<string | null>;
}

type DialogState =
  | { kind: 'confirm'; message: string; options: ConfirmOptions; resolve: (v: boolean) => void }
  | { kind: 'alert'; message: string; resolve: () => void }
  | { kind: 'prompt'; message: string; defaultValue: string; resolve: (v: string | null) => void };

const DialogContext = createContext<DialogApi | null>(null);

export function useDialogs(): DialogApi {
  const ctx = useContext(DialogContext);
  if (!ctx) throw new Error('useDialogs は DialogProvider の中で使ってください');
  return ctx;
}

export const DialogProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // 複数が続けて呼ばれたときは、順番に表示する
  const [queue, setQueue] = useState<DialogState[]>([]);
  const push = useCallback((d: DialogState) => setQueue(q => [...q, d]), []);
  const shift = useCallback(() => setQueue(q => q.slice(1)), []);

  const api = useMemo<DialogApi>(() => ({
    confirm: (message, options = {}) => new Promise<boolean>(resolve => push({ kind: 'confirm', message, options, resolve })),
    alert: (message) => new Promise<void>(resolve => push({ kind: 'alert', message, resolve })),
    prompt: (message, defaultValue = '') => new Promise<string | null>(resolve => push({ kind: 'prompt', message, defaultValue, resolve })),
  }), [push]);

  const current = queue[0];
  const [text, setText] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const okRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!current) return;
    if (current.kind === 'prompt') {
      setText(current.defaultValue);
      requestAnimationFrame(() => inputRef.current?.select());
    } else {
      requestAnimationFrame(() => okRef.current?.focus());
    }
  }, [current]);

  const finish = (result: boolean | string | null | undefined) => {
    if (!current) return;
    if (current.kind === 'confirm') current.resolve(result === true);
    else if (current.kind === 'alert') current.resolve();
    else current.resolve(typeof result === 'string' ? result : null);
    shift();
  };
  const cancel = () => finish(current?.kind === 'confirm' ? false : null);

  return (
    <DialogContext.Provider value={api}>
      {children}
      {current && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          onKeyDown={(e) => {
            if (e.key === 'Escape') cancel();
          }}
        >
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="p-5 space-y-3">
              <p className="text-sm text-slate-100 whitespace-pre-wrap leading-relaxed">{current.message}</p>
              {current.kind === 'prompt' && (
                <input
                  ref={inputRef}
                  type="text"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.nativeEvent.isComposing) finish(text);
                  }}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
                />
              )}
            </div>
            <div className="flex justify-end gap-2 px-5 py-3 border-t border-slate-800 bg-slate-950/50">
              {current.kind !== 'alert' && (
                <button
                  type="button"
                  onClick={cancel}
                  className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
                >
                  {current.kind === 'confirm' ? current.options.cancelLabel ?? t('action.cancel') : t('action.cancel')}
                </button>
              )}
              <button
                type="button"
                ref={okRef}
                onClick={() => finish(current.kind === 'prompt' ? text : true)}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                  current.kind === 'confirm' && current.options.danger
                    ? 'bg-red-600 hover:bg-red-500 text-white'
                    : 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                }`}
              >
                {current.kind === 'confirm' ? current.options.okLabel ?? 'OK' : 'OK'}
              </button>
            </div>
          </div>
        </div>
      )}
    </DialogContext.Provider>
  );
};
