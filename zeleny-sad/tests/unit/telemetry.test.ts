import { afterEach, describe, expect, it, vi } from 'vitest';
import { trackQuest } from '../../src/telemetry';

describe('trackQuest', () => {
  it('records each finished quest only once per session', () => {
    expect(trackQuest('first-bloom', 3)).toBe(true);
    expect(trackQuest('first-bloom', 3)).toBe(false);
    expect(trackQuest('first-seed', 1)).toBe(true);
  });
});

describe('flush', () => {
  const KEY = 'green-garden/events';
  function setup(fetchImpl: () => Promise<{ ok: boolean }>) {
    const store = new Map<string, string>();
    const localStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    };
    vi.stubEnv('PROD', true);
    vi.stubGlobal('window', { localStorage });
    vi.stubGlobal('location', { protocol: 'https:' });
    vi.stubGlobal('navigator', { onLine: true });
    vi.stubGlobal('fetch', vi.fn(fetchImpl));
    store.set(KEY, JSON.stringify([{ e: 'start', t: 1 }, { e: 'quest', t: 2, id: 'first-seed' }]));
    return () => JSON.parse(store.get(KEY) ?? '[]') as unknown[];
  }
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('takes events out of the queue before the request finishes (iPhone freezes the page)', async () => {
    const queue = setup(() => new Promise(() => {}));
    const { flush } = await import('../../src/telemetry');
    void flush();
    await Promise.resolve();
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(queue()).toEqual([]);
  });

  it('puts the batch back when sending fails', async () => {
    const queue = setup(() => Promise.reject(new Error('offline')));
    const { flush } = await import('../../src/telemetry');
    await flush();
    expect(queue()).toHaveLength(2);
  });

  it('empties the queue after a successful send', async () => {
    const queue = setup(() => Promise.resolve({ ok: true }));
    const { flush } = await import('../../src/telemetry');
    await flush();
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(queue()).toEqual([]);
  });
});
