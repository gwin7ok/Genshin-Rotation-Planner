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
