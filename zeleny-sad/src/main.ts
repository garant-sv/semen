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
  // A new version is installed in the background. It switches on by itself as soon as nothing is
  // open on screen (a task or a card), so a child never answers in an old version for long.
  // The garden is saved on every action and on page hide, so the restart loses nothing.
  let hadController = Boolean(navigator.serviceWorker.controller);
  let reloadPending = false;
  const tryReload = () => {
    if (!reloadPending) return;
    if (document.visibilityState === 'hidden' || app.isIdle()) location.reload();
  };
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    // The very first worker taking over a fresh page is not an update.
    if (!hadController) {
      hadController = true;
      return;
    }
    if (reloadPending) return;
    reloadPending = true;
    window.setTimeout(tryReload, 1200);
  });
  document.addEventListener('visibilitychange', tryReload);
  window.setInterval(tryReload, 2000);

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('./sw.js', { updateViaCache: 'none' })
      .then((reg) => {
        const activate = (worker: ServiceWorker) => worker.postMessage('skipWaiting');
        if (reg.waiting && navigator.serviceWorker.controller) activate(reg.waiting);
        reg.addEventListener('updatefound', () => {
          const w = reg.installing;
          w?.addEventListener('statechange', () => {
            if (w.state === 'installed' && navigator.serviceWorker.controller) activate(w);
          });
        });
        // A game added to the home screen may stay open for days: look for a new version
        // whenever it comes back to the screen.
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') void reg.update().catch(() => undefined);
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
