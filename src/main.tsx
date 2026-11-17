// 言語の初期化は、ほかのモジュールより先に行う（React の外の文言も i18n.t() で引けるように。docs/i18n/plan.md 4.2）
import { t } from './i18n';
import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { initAnalytics } from './utils/analytics';
import { DialogProvider } from './components/DialogProvider.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import { loadMasterData } from './data/masterBundle';

initAnalytics();

const root = createRoot(document.getElementById('root')!);

/**
 * 同梱のマスターデータ（約 6 MB）は、画面の最初のコードに含めず、ここで読み込んでから、画面を出す（D354）。
 * 通信が切れているときなど、読み込めなかったら、再読み込みをうながす。
 */
async function boot() {
  root.render(<div className="min-h-screen flex items-center justify-center text-sm text-slate-400">{t('app:master.loading')}</div>);
  try {
    await loadMasterData();
  } catch (e) {
    console.error('同梱のマスターデータを読み込めませんでした:', e);
    root.render(
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 p-6 text-center text-sm text-slate-200">
        <p>{t('app:master.failed')}</p>
        <button type="button" onClick={() => window.location.reload()} className="px-4 py-1.5 rounded-lg font-semibold bg-sky-500 hover:bg-sky-400 text-slate-950">{t('app:master.reload')}</button>
      </div>,
    );
    return;
  }
  root.render(
    <StrictMode>
      <ErrorBoundary>
        <DialogProvider>
          <App />
        </DialogProvider>
      </ErrorBoundary>
    </StrictMode>,
  );
}

void boot();
