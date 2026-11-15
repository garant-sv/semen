/**
 * Anonymous play journal for the test phase.
 *
 * What is sent: a random device id (not linked to a name), the class, app version, and short
 * game events (which question / word / problem, right or wrong, JS errors). The nickname, the
 * garden itself and anything typed except numeric fair answers are never sent.
 * Events wait in localStorage while offline and go out in small batches as a GET beacon to
 * /api/e on the same site (nginx writes them to a log and answers 204).
 */

const DEVICE_KEY = 'green-garden/device';
const QUEUE_KEY = 'green-garden/events';
const OFF_KEY = 'green-garden/telemetry-off';
const MAX_QUEUE = 300;
const MAX_URL = 1800;

export type EventData = Record<string, string | number | boolean | null | undefined>;
type Ev = { e: string; t: number } & EventData;

let grade: number | null = null;
let timer = 0;
let sending = false;
let installed = false;

const ls = (): Storage | null => {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
};

/** Telemetry runs only on the real site (https, production build). */
const live = () => import.meta.env.PROD && location.protocol === 'https:';

export function telemetryEnabled(): boolean {
  return ls()?.getItem(OFF_KEY) !== '1';
}

export function setTelemetryEnabled(on: boolean) {
  const s = ls();
  if (!s) return;
  try {
    if (on) s.removeItem(OFF_KEY);
    else {
      s.setItem(OFF_KEY, '1');
      s.removeItem(QUEUE_KEY);
    }
  } catch {
    /* storage full or blocked: nothing to do */
  }
}

function deviceId(): string {
  const s = ls();
  let id = s?.getItem(DEVICE_KEY) ?? '';
  if (!/^[0-9a-f]{12}$/.test(id)) {
    const b = new Uint8Array(6);
    crypto.getRandomValues(b);
    id = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
    try {
      s?.setItem(DEVICE_KEY, id);
    } catch {
      /* ignore */
    }
  }
  return id;
}

function readQueue(): Ev[] {
  try {
    const q = JSON.parse(ls()?.getItem(QUEUE_KEY) ?? '[]');
    return Array.isArray(q) ? q : [];
  } catch {
    return [];
  }
}

function writeQueue(q: Ev[]) {
  try {
    ls()?.setItem(QUEUE_KEY, JSON.stringify(q.slice(-MAX_QUEUE)));
  } catch {
    /* the game save matters more than the journal */
  }
}

const clip = (v: unknown, n = 160) => String(v ?? '').replace(/\s+/g, ' ').slice(0, n);

export function setTelemetryGrade(g: number | null) {
  grade = g;
}

/** Record one event. Cheap and never throws. */
export function track(e: string, data: EventData = {}) {
  try {
    if (!telemetryEnabled()) return;
    const ev: Ev = { e, t: Date.now(), ...data };
    if (grade) ev.g = grade;
    for (const k of Object.keys(ev)) if (typeof ev[k] === 'string') ev[k] = clip(ev[k]);
    const q = readQueue();
    q.push(ev);
    writeQueue(q);
    schedule(4000);
  } catch {
    /* never break the game */
  }
}

const questsLogged = new Set<string>();

/**
 * Record a finished quest once per page session. The quest sheet may be re-shown after another
 * sheet closes; without this guard the same quest landed in the journal twice.
 */
export function trackQuest(id: string, n: number): boolean {
  if (questsLogged.has(id)) return false;
  questsLogged.add(id);
  track('quest', { id, n });
  return true;
}

function schedule(ms: number) {
  if (!live() || timer) return;
  timer = window.setTimeout(() => {
    timer = 0;
    void flush();
  }, ms);
}

/** Send what is waiting, a few events per request. */
export async function flush() {
  if (!live() || sending || !telemetryEnabled() || !navigator.onLine) return;
  sending = true;
  try {
    const base = `/api/e?v=${encodeURIComponent(__APP_VERSION__)}&d=${deviceId()}&b=`;
    for (let round = 0; round < 10; round++) {
      const q = readQueue();
      if (!q.length) break;
      let n = 0;
      let url = '';
      while (n < q.length) {
        const next = base + encodeURIComponent(JSON.stringify(q.slice(0, n + 1)));
        if (next.length > MAX_URL && n > 0) break;
        url = next;
        n++;
        if (next.length > MAX_URL) break; // a single huge event goes alone (it was clipped)
      }
      const res = await fetch(url, { method: 'GET', cache: 'no-store', credentials: 'omit', keepalive: true });
      if (!res.ok) break;
      writeQueue(readQueue().slice(n));
    }
  } catch {
    /* offline or blocked: try later */
  } finally {
    sending = false;
  }
}

/** Catch errors in the page and send the journal when the game is hidden or comes online. */
export function installTelemetry() {
  if (installed) return;
  installed = true;
  window.addEventListener('error', (ev) => {
    track('error', { msg: ev.message, at: `${clip(ev.filename, 60).split('/').pop()}:${ev.lineno}:${ev.colno}` });
  });
  window.addEventListener('unhandledrejection', (ev) => {
    const r = ev.reason as { message?: string } | undefined;
    track('error', { msg: `promise: ${r?.message ?? String(r)}` });
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') void flush();
  });
  window.addEventListener('online', () => void flush());
  schedule(1500);
}
