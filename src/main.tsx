import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';
import { registerSW } from 'virtual:pwa-register';

// Register Service Worker immediately for Offline App Shell support
registerSW({
  immediate: true,
  onNeedRefresh() {
    console.log('[PWA] New application content available.');
  },
  onOfflineReady() {
    console.log('[PWA] RestroFlow App Shell ready for offline usage.');
  }
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
