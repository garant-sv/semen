import { describe, expect, it } from 'vitest';
import {
  CORRUPT_KEY_PREFIX,
  PREV_KEY,
  SAVE_KEY,
  exportSave,
  importSave,
  loadGame,
  migrate,
  parseSave,
  saveGame,
  type StorageLike,
} from '../../src/game/save';
import { SAVE_VERSION, newGame, plantSeed, water } from '../../src/game/state';

const T0 = 1_700_000_000_000;

class MemStorage implements StorageLike {
  data = new Map<string, string>();
  failWith: Error | null = null;
  getItem(k: string) {
    return this.data.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    if (this.failWith) throw this.failWith;
    this.data.set(k, v);
  }
  removeItem(k: string) {
    this.data.delete(k);
  }
}

const domError = (name: string) => Object.assign(new Error(name), { name });

describe('save & load', () => {
  it('round-trips the state', () => {
    const st = new MemStorage();
    const s = newGame(T0);
    plantSeed(s, 0, 'daisy', T0);
    water(s, 0, T0);
    s.petals = 42;
    expect(saveGame(st, s)).toEqual({ ok: true });
    const r = loadGame(st, T0 + 1000);
    expect(r.status).toBe('ok');
    if (r.status === 'ok') expect(r.state).toEqual(s);
  });

  it('starts a new game when nothing is saved', () => {
    expect(loadGame(new MemStorage(), T0).status).toBe('new');
  });

  it('keeps the previous save and falls back to it when the main one is corrupt', () => {
    const st = new MemStorage();
    const s = newGame(T0);
    s.petals = 7;
    saveGame(st, s);
    s.petals = 8;
    saveGame(st, s);
    expect(JSON.parse(st.getItem(PREV_KEY)!).petals).toBe(7);
    st.data.set(SAVE_KEY, '{"broken": tru');
    const r = loadGame(st, T0);
    expect(r).toMatchObject({ status: 'ok', fromBackup: true });
    if (r.status === 'ok') expect(r.state.petals).toBe(7);
    expect([...st.data.keys()].some((k) => k.startsWith(CORRUPT_KEY_PREFIX))).toBe(true);
  });

  it('reports corruption explicitly when no backup works', () => {
    const st = new MemStorage();
    st.data.set(SAVE_KEY, 'garbage');
    const r = loadGame(st, T0);
    expect(r.status).toBe('corrupt');
    expect(st.data.get(CORRUPT_KEY_PREFIX + 'last')).toBe('garbage');
    // Opening the game again does not pile up one more copy per launch.
    loadGame(st, T0 + 1000);
    expect([...st.data.keys()].filter((k) => k.startsWith(CORRUPT_KEY_PREFIX))).toHaveLength(1);
  });

  it('keeps the good backup after opening it (the damaged save never becomes the backup)', () => {
    const st = new MemStorage();
    const s = newGame(T0);
    s.petals = 7;
    saveGame(st, s);
    s.petals = 8;
    saveGame(st, s);
    st.data.set(SAVE_KEY, '{"broken": tru');
    const r = loadGame(st, T0);
    expect(r).toMatchObject({ status: 'ok', fromBackup: true });
    if (r.status !== 'ok') return;
    r.state.petals = 9;
    saveGame(st, r.state);
    expect(JSON.parse(st.getItem(PREV_KEY)!).petals).toBe(7);
    expect(JSON.parse(st.getItem(SAVE_KEY)!).petals).toBe(9);
    // And damaged text in the main slot never pushes a good backup out.
    st.data.set(SAVE_KEY, 'garbage');
    saveGame(st, r.state);
    expect(JSON.parse(st.getItem(PREV_KEY)!).petals).toBe(7);
  });

  it('never overwrites a save made by a newer version of the game', () => {
    const st = new MemStorage();
    const newer = JSON.stringify({ ...newGame(T0), version: SAVE_VERSION + 1, petals: 999 });
    st.data.set(SAVE_KEY, newer);
    const r = loadGame(st, T0);
    expect(r.status).toBe('newer');
    expect([...st.data.keys()].some((k) => k.startsWith(CORRUPT_KEY_PREFIX))).toBe(false);
    expect(saveGame(st, newGame(T0))).toMatchObject({ ok: false, error: { kind: 'newer' } });
    expect(st.getItem(SAVE_KEY)).toBe(newer);
    expect(st.getItem(PREV_KEY)).toBeNull();
  });

  it('reports quota and unavailable storage errors', () => {
    const st = new MemStorage();
    st.failWith = domError('QuotaExceededError');
    expect(saveGame(st, newGame(T0))).toMatchObject({ ok: false, error: { kind: 'quota' } });
    st.failWith = domError('SecurityError');
    expect(saveGame(st, newGame(T0))).toMatchObject({ ok: false, error: { kind: 'unavailable' } });
    expect(saveGame(null, newGame(T0))).toMatchObject({ ok: false, error: { kind: 'unavailable' } });
    expect(loadGame(null, T0).status).toBe('unavailable');
  });

  it('repairs inconsistent data while loading', () => {
    const s = newGame(T0) as unknown as Record<string, unknown>;
    s.petals = -5;
    s.openPlots = 99;
    s.unlockedPlants = ['tulip', 'cactus'];
    s.decor = { owned: { lantern: 0 }, placed: ['lantern', 'unknown'] };
    const { state } = parseSave(JSON.stringify(s), T0);
    expect(state.petals).toBe(0);
    expect(state.openPlots).toBe(6);
    expect(state.unlockedPlants).toEqual(['daisy', 'tulip']);
    expect(state.decor.placed.every((d) => d === null)).toBe(true);
  });
});

describe('migrations', () => {
  const v1 = {
    version: 1,
    createdAt: T0,
    updatedAt: T0,
    petals: 12,
    unlockedPlants: ['daisy', 'sunflower'],
    openPlots: 3,
    plots: [{ plant: 'sunflower', stage: 1, wateredAt: null }],
    restored: { bridge: false, pond: false },
    decor: { owned: {}, placed: [] },
    collection: { daisy: { firstAt: T0, count: 2 } },
    questIndex: 3,
    stats: { harvested: 2 },
  };

  it('migrates v1 to the current version', () => {
    const { state, migratedFrom } = parseSave(JSON.stringify(v1), T0);
    expect(migratedFrom).toBe(1);
    expect(state.version).toBe(SAVE_VERSION);
    expect(state.settings.sound).toBe(true);
    expect(state.stats).toEqual({ planted: { daisy: 1, sunflower: 1 }, watered: 1, harvested: 2, sinceGolden: 0, sinceQuiz: 0 });
    expect(state.plots[0]).toEqual({ plant: 'sunflower', stage: 1, wateredAt: null, plantedAt: null, golden: false, sign: null });
    expect(state.petals).toBe(12);
    expect(state.guests).toEqual({});
    expect(state.order).toBeNull();
  });

  it('migrates v2 (the first released version) to the current one without losing progress', () => {
    const v2 = {
      ...v1,
      version: 2,
      plots: [{ plant: 'tulip', stage: 2, wateredAt: T0, plantedAt: T0 }],
      stats: { planted: { daisy: 2 }, watered: 5, harvested: 2 },
      settings: { sound: false },
    };
    const { state, migratedFrom } = parseSave(JSON.stringify(v2), T0);
    expect(migratedFrom).toBe(2);
    expect(state.plots[0]).toEqual({ plant: 'tulip', stage: 2, wateredAt: T0, plantedAt: T0, golden: false, sign: null });
    expect(state.stats).toEqual({ planted: { daisy: 2 }, watered: 5, harvested: 2, sinceGolden: 0, sinceQuiz: 0 });
    expect(state.settings.sound).toBe(false);
    // 0.8: old saves get the tilt parallax switched on.
    expect(state.settings.tilt).toBe(true);
    expect(state).toMatchObject({ golden: {}, guests: {}, order: null, ordersDone: 0, petals: 12, questIndex: 3 });
    // v4: four vegetable beds, the patch is still overgrown.
    expect(state.plots).toHaveLength(19);
    expect(state.restored).toEqual({ bridge: false, pond: false, veg: false, tundra: false, taiga: false, steppe: false });
    expect(state.quiz).toEqual({ pending: false, solved: [], correct: 0, asked: 0 });
  });

  it('repairs broken guests, golden and order data', () => {
    const s = newGame(T0) as unknown as Record<string, unknown>;
    s.guests = { frog: { firstAt: T0, count: 2 }, dragon: { count: 1 } };
    s.golden = { daisy: 2, tulip: -1, cactus: 3 };
    s.order = { from: 'snail', items: [{ plant: 'daisy', need: 2, have: 7 }, { plant: 'cactus', need: 1 }], reward: 9 };
    const { state } = parseSave(JSON.stringify(s), T0);
    expect(state.guests).toEqual({ frog: { firstAt: T0, count: 2 } });
    expect(state.golden).toEqual({ daisy: 2 });
    expect(state.order).toEqual({ from: 'snail', items: [{ plant: 'daisy', need: 2, have: 2 }], reward: 9 });
    s.order = { from: 'nobody', items: [] };
    expect(parseSave(JSON.stringify(s), T0).state.order).toBeNull();
  });

  it('refuses saves from a newer game version and unknown versions', () => {
    expect(() => migrate({ version: SAVE_VERSION + 1 })).toThrow(/новой версии/);
    expect(() => migrate({ version: 'x' })).toThrow();
  });
});

describe('export & import', () => {
  it('exports a tagged file and imports it back', () => {
    const s = newGame(T0);
    s.petals = 33;
    const text = exportSave(s, T0);
    expect(JSON.parse(text).app).toBe('green-garden');
    expect(importSave(text, T0).state).toEqual(s);
  });

  it('rejects files that are not garden backups', () => {
    expect(() => importSave('not json', T0)).toThrow();
    expect(() => importSave('{"app":"other","save":{}}', T0)).toThrow();
    expect(() => importSave(JSON.stringify({ app: 'green-garden', save: { version: 2 } }), T0)).toThrow();
  });
});
