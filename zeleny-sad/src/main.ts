import './styles.css';
import { getStorage } from './game/save';
import { App } from './ui/app';
import { installTelemetry } from './telemetry';

installTelemetry();
const root = document.getElementById('app')!;
const st = getStorage();
const app = new App(root, 'storage' in st ? { storage: st.storage } : { storage: null, storageError: st.error });

// Ask the browser to keep our data (helps against storage eviction; may be ignored).
document.addEventListener(
  'pointerdown',
  () => {
    void navigator.storage?.persist?.().catch(() => undefined);
  },
  { once: true },
);

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('./sw.js', { updateViaCache: 'none' })
      .then((reg) => {
        const offerUpdate = (worker: ServiceWorker) => {
          app.toast('Готова новая версия игры. Она включится при следующем запуске.');
          worker.postMessage('skipWaiting');
        };
        if (reg.waiting && navigator.serviceWorker.controller) offerUpdate(reg.waiting);
        reg.addEventListener('updatefound', () => {
          const w = reg.installing;
          w?.addEventListener('statechange', () => {
            if (w.state === 'installed' && navigator.serviceWorker.controller) offerUpdate(w);
          });
        });
      })
      .catch(() => app.toast('Офлайн-режим недоступен в этом браузере.', 'warn'));
  });
}

declare global {
  interface Window {
    __gardenApp?: App;
  }
}
window.__gardenApp = app;
