// 言語の初期化は、ほかのモジュールより先に行う（React の外の文言も i18n.t() で引けるように。docs/i18n/plan.md 4.2）
import './i18n';
import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { initAnalytics } from './utils/analytics';
import { DialogProvider } from './components/DialogProvider.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';

initAnalytics();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <DialogProvider>
        <App />
      </DialogProvider>
    </ErrorBoundary>
  </StrictMode>,
);
