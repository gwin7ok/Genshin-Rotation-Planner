import React from 'react';
import { clearActiveState } from '../utils/storage';
import { buildRecoveryDump } from '../utils/recoveryDump';
import { fileTimestamp, APP_FILE_PREFIX } from '../utils/rotationFile';
import { t } from '../i18n';

interface ErrorBoundaryState {
  error: Error | null;
  componentStack: string;
  /** 書き出し・リセットの結果の案内 */
  notice: string | null;
}

/**
 * 画面の描画中の例外を受け止めて、真っ白な画面の代わりに、原因の案内と復旧の操作を出す。
 * 保存された編成が壊れていると、再読み込みしても同じ例外になるので、「編集中の編成だけをリセット」で、
 * 保存編成・データベース・設定は残したまま、復旧できるようにする。
 */
export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null, componentStack: '', notice: null };

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('画面の表示中に例外が起きました:', error, info.componentStack);
    this.setState({ componentStack: info.componentStack ?? '' });
  }

  private exportRawData = () => {
    try {
      const blob = new Blob([JSON.stringify(buildRecoveryDump(), null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${APP_FILE_PREFIX}_${t('app:error.exportFileLabel')}_${fileTimestamp()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      this.setState({ notice: t('app:error.exported') });
    } catch (e) {
      this.setState({ notice: t('app:error.exportFailed', { message: e instanceof Error ? e.message : String(e) }) });
    }
  };

  private resetCurrentRotation = () => {
    clearActiveState();
    window.location.reload();
  };

  render() {
    const { error, componentStack, notice } = this.state;
    if (!error) return this.props.children;
    return (
      <div role="alert" className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
        <div className="w-full max-w-xl space-y-4 rounded-2xl border border-red-800/70 bg-slate-900 p-6 shadow-2xl">
          <h1 className="text-lg font-extrabold text-red-300">{t('app:error.title')}</h1>
          <p className="text-sm text-slate-300 leading-relaxed">
            {t('app:error.description')}
          </p>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => window.location.reload()} className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-sm font-bold">
              {t('app:error.reload')}
            </button>
            <button type="button" onClick={this.resetCurrentRotation} className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-sm font-bold">
              {t('app:error.reset')}
            </button>
            <button type="button" onClick={this.exportRawData} className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 text-sm font-bold">
              {t('app:error.export')}
            </button>
          </div>
          {notice && <p className="text-xs text-emerald-300">{notice}</p>}
          <details className="text-xs text-slate-400">
            <summary className="cursor-pointer select-none">{t('app:error.details')}</summary>
            <pre className="mt-2 max-h-60 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-950 p-3 font-mono text-[11px] text-slate-300">
              {`${error.name}: ${error.message}\n${componentStack.trim()}`}
            </pre>
          </details>
        </div>
      </div>
    );
  }
}
