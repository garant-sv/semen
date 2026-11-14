// Saving, loading, migrations, export and import.
// Storage failures are reported explicitly instead of being swallowed.

import { DECO_IDS, GUEST_IDS, LANDMARK_IDS, PLANT_IDS, PLOT_COUNT, QUESTS, SLOT_COUNT, TOTAL_PLOTS, type DecoId, type GuestId, type PlantId, type Stage } from './data';
import { BADGE_IDS } from './badges';
import { QUESTIONS } from './quiz';
import { WORDS } from './russian';

const WORD_IDS = WORDS.map((w) => w.id);
import { SAVE_VERSION, emptyPlot, newGame, type GameState, type Order, type Plot } from './state';

export const SAVE_KEY = 'green-garden/save';
export const PREV_KEY = 'green-garden/save-prev';
export const CORRUPT_KEY_PREFIX = 'green-garden/corrupt-';
export const EXPORT_APP = 'green-garden';

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export type StorageErrorKind = 'unavailable' | 'quota' | 'unknown';

export interface StorageError {
  kind: StorageErrorKind;
  message: string;
}

export function classifyStorageError(e: unknown): StorageError {
  const name = (e as { name?: string })?.name ?? '';
  const code = (e as { code?: number })?.code;
  if (name === 'QuotaExceededError' || name === 'NS_ERROR_DOM_QUOTA_REACHED' || code === 22 || code === 1014) {
    return { kind: 'quota', message: 'В памяти устройства не хватает места для сохранения.' };
  }
  if (name === 'SecurityError') {
    return { kind: 'unavailable', message: 'Браузер запретил сохранять данные (например, в приватном режиме).' };
  }
  return { kind: 'unknown', message: 'Не удалось сохранить игру.' };
}

/** Returns a usable storage or an explicit error (e.g. Safari with blocked site data). */
export function getStorage(): { storage: StorageLike } | { error: StorageError } {
  try {
    const ls = window.localStorage;
    const probe = 'green-garden/probe';
    ls.setItem(probe, '1');
    ls.removeItem(probe);
    return { storage: ls };
  } catch (e) {
    const err = classifyStorageError(e);
    return { error: err.kind === 'unknown' ? { kind: 'unavailable', message: 'Хранилище браузера недоступно.' } : err };
  }
}

// ---------------------------------------------------------------- migrations

type Raw = Record<string, unknown>;

/**
 * Each migration converts a save of version N into version N + 1.
 * v1 — first schema of this rewrite: no sound setting, only the harvest counter in stats,
 *      plots without plantedAt.
 * v2 — settings.sound, stats.planted / stats.watered, plot.plantedAt.
 * v3 — garden guests, golden flowers (plot.golden, golden, stats.sinceGolden), orders.
 * v4 — vegetable patch (4 more plots, restored.veg), badges, Listik's questions (quiz, stats.sinceQuiz).
 * v5 — natural zones (tundra, taiga, steppe): 9 more plots, restored.<zone>.
 * v6 — «Ярмарка урожая» (fair: queue, lastAt, solved, firstTry).
 * v7 — current: «Таблички у грядок» (plot.sign, rus).
 */
export const MIGRATIONS: Record<number, (raw: Raw) => Raw> = {
  1: (raw) => {
    const stats = (raw.stats as Raw | undefined) ?? {};
    const collection = (raw.collection as Raw | undefined) ?? {};
    const plots = Array.isArray(raw.plots) ? (raw.plots as Raw[]) : [];
    const planted: Record<string, number> = {};
    for (const id of Object.keys(collection)) planted[id] = 1;
    for (const p of plots) if (typeof p?.plant === 'string') planted[p.plant] = (planted[p.plant] ?? 0) + 1;
    const questIndex = typeof raw.questIndex === 'number' ? raw.questIndex : 0;
    return {
      ...raw,
      version: 2,
      plots: plots.map((p) => ({ ...p, plantedAt: p?.plantedAt ?? null })),
      stats: {
        planted,
        watered: questIndex >= 2 ? 1 : 0,
        harvested: typeof stats.harvested === 'number' ? stats.harvested : 0,
      },
      settings: { sound: true },
    };
  },
  2: (raw) => {
    const stats = (raw.stats as Raw | undefined) ?? {};
    const plots = Array.isArray(raw.plots) ? (raw.plots as Raw[]) : [];
    return {
      ...raw,
      version: 3,
      plots: plots.map((p) => (p && typeof p === 'object' ? { ...p, golden: false } : p)),
      golden: {},
      guests: {},
      order: null,
      ordersDone: 0,
      stats: { ...stats, sinceGolden: 0 },
    };
  },
  3: (raw) => {
    const stats = (raw.stats as Raw | undefined) ?? {};
    const restored = (raw.restored as Raw | undefined) ?? {};
    return {
      ...raw,
      version: 4,
      restored: { ...restored, veg: false },
      badges: [],
      quiz: { pending: false, solved: [], correct: 0, asked: 0 },
      stats: { ...stats, sinceQuiz: 0 },
    };
  },
  4: (raw) => {
    const restored = (raw.restored as Raw | undefined) ?? {};
    return { ...raw, version: 5, restored: { ...restored, tundra: false, taiga: false, steppe: false } };
  },
  5: (raw) => ({ ...raw, version: 6, fair: { queue: 0, lastAt: 0, solved: 0, firstTry: 0 } }),
  6: (raw) => ({ ...raw, version: 7, rus: { learned: [], correct: 0, total: 0 } }),
};

export function migrate(raw: Raw): { data: Raw; from: number } {
  const from = typeof raw.version === 'number' ? raw.version : NaN;
  if (!Number.isInteger(from) || from < 1) throw new Error('Неизвестная версия сохранения.');
  if (from > SAVE_VERSION) {
    throw new Error('Сохранение сделано в более новой версии игры. Обнови игру, чтобы открыть его.');
  }
  let data = raw;
  for (let v = from; v < SAVE_VERSION; v++) {
    const step = MIGRATIONS[v];
    if (!step) throw new Error(`Нет миграции с версии ${v}.`);
    data = step(data);
  }
  return { data, from };
}

// ---------------------------------------------------------------- validation

const isObj = (v: unknown): v is Raw => typeof v === 'object' && v !== null && !Array.isArray(v);
const num = (v: unknown, fallback: number, min = 0, max = Number.MAX_SAFE_INTEGER): number =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback;
const isPlant = (v: unknown): v is PlantId => typeof v === 'string' && (PLANT_IDS as readonly string[]).includes(v);
const isDeco = (v: unknown): v is DecoId => typeof v === 'string' && (DECO_IDS as readonly string[]).includes(v);
const isGuest = (v: unknown): v is GuestId => typeof v === 'string' && (GUEST_IDS as readonly string[]).includes(v);

function sanitizeOrder(v: unknown): Order | null {
  if (!isObj(v) || !isGuest(v.from) || !Array.isArray(v.items)) return null;
  const items = v.items
    .filter((it): it is Raw => isObj(it) && isPlant(it.plant))
    .slice(0, 3)
    .map((it) => {
      const need = Math.floor(num(it.need, 1, 1, 9));
      return { plant: it.plant as PlantId, need, have: Math.floor(num(it.have, 0, 0, need)) };
    });
  if (!items.length) return null;
  return { from: v.from, items, reward: Math.floor(num(v.reward, 5, 1, 500)) };
}

/** Turns migrated raw data into a valid GameState, repairing small inconsistencies. */
export function sanitize(raw: Raw, now: number): GameState {
  if (raw.version !== SAVE_VERSION) throw new Error('Неверная версия данных.');
  if (!Array.isArray(raw.plots) || !isObj(raw.decor)) throw new Error('Сохранение повреждено.');
  const base = newGame(now);
  const s: GameState = base;
  s.createdAt = num(raw.createdAt, now);
  s.updatedAt = num(raw.updatedAt, now);
  s.petals = Math.floor(num(raw.petals, 0, 0, 1_000_000));
  s.unlockedPlants = Array.isArray(raw.unlockedPlants) ? [...new Set(raw.unlockedPlants.filter(isPlant))] : [];
  if (!s.unlockedPlants.includes('daisy')) s.unlockedPlants.unshift('daisy');
  s.openPlots = Math.floor(num(raw.openPlots, 3, 3, PLOT_COUNT));
  s.questIndex = Math.floor(num(raw.questIndex, 0, 0, QUESTS.length));

  s.plots = Array.from({ length: TOTAL_PLOTS }, (_, i): Plot => {
    const p = (raw.plots as unknown[])[i];
    if (!isObj(p) || !isPlant(p.plant)) return emptyPlot();
    const wateredAt = p.wateredAt === null ? null : num(p.wateredAt, NaN);
    return {
      plant: p.plant,
      stage: Math.floor(num(p.stage, 0, 0, 3)) as Stage,
      wateredAt: wateredAt === null || Number.isNaN(wateredAt) ? null : wateredAt,
      plantedAt: p.plantedAt === null ? null : num(p.plantedAt, now),
      golden: p.golden === true,
      sign: isObj(p.sign) && typeof p.sign.id === 'string' && WORD_IDS.includes(p.sign.id) ? { id: p.sign.id, solved: p.sign.solved === true } : null,
    };
  });

  const restored = isObj(raw.restored) ? raw.restored : {};
  for (const id of LANDMARK_IDS) s.restored[id] = restored[id] === true;

  const decor = raw.decor as Raw;
  const owned = isObj(decor.owned) ? decor.owned : {};
  for (const id of DECO_IDS) s.decor.owned[id] = Math.floor(num(owned[id], 0, 0, 99));
  const placed = Array.isArray(decor.placed) ? decor.placed : [];
  s.decor.placed = Array.from({ length: SLOT_COUNT }, (_, i) => (isDeco(placed[i]) ? (placed[i] as DecoId) : null));
  // Never show more placed decorations than owned.
  for (const id of DECO_IDS) {
    let extra = s.decor.placed.filter((d) => d === id).length - s.decor.owned[id];
    for (let i = SLOT_COUNT - 1; i >= 0 && extra > 0; i--) {
      if (s.decor.placed[i] === id) {
        s.decor.placed[i] = null;
        extra--;
      }
    }
  }

  const collection = isObj(raw.collection) ? raw.collection : {};
  for (const id of PLANT_IDS) {
    const e = collection[id];
    if (isObj(e)) s.collection[id] = { firstAt: num(e.firstAt, now), count: Math.max(1, Math.floor(num(e.count, 1))) };
  }

  const golden = isObj(raw.golden) ? raw.golden : {};
  for (const id of PLANT_IDS) {
    const n = Math.floor(num(golden[id], 0, 0, 1_000_000));
    if (n > 0) s.golden[id] = n;
  }
  const guests = isObj(raw.guests) ? raw.guests : {};
  for (const id of GUEST_IDS) {
    const e = guests[id];
    if (isObj(e)) s.guests[id] = { firstAt: num(e.firstAt, now), count: Math.max(1, Math.floor(num(e.count, 1))) };
  }
  s.order = sanitizeOrder(raw.order);
  s.ordersDone = Math.floor(num(raw.ordersDone, 0));

  const stats = isObj(raw.stats) ? raw.stats : {};
  const planted = isObj(stats.planted) ? stats.planted : {};
  for (const id of PLANT_IDS) if (typeof planted[id] === 'number') s.stats.planted[id] = Math.floor(num(planted[id], 0));
  s.stats.watered = Math.floor(num(stats.watered, 0));
  s.stats.harvested = Math.floor(num(stats.harvested, 0));
  s.stats.sinceGolden = Math.floor(num(stats.sinceGolden, 0, 0, 1000));
  s.stats.sinceQuiz = Math.floor(num(stats.sinceQuiz, 0, 0, 1000));

  s.badges = Array.isArray(raw.badges) ? [...new Set(raw.badges.filter((b): b is string => BADGE_IDS.includes(b as string)))] : [];
  const rus = isObj(raw.rus) ? raw.rus : {};
  s.rus = {
    learned: Array.isArray(rus.learned) ? [...new Set(rus.learned.filter((w): w is string => WORD_IDS.includes(w as string)))] : [],
    correct: Math.floor(num(rus.correct, 0)),
    total: Math.floor(num(rus.total, 0)),
  };
  const fair = isObj(raw.fair) ? raw.fair : {};
  s.fair = {
    queue: Math.floor(num(fair.queue, 0, 0, 3)),
    lastAt: num(fair.lastAt, 0, 0),
    solved: Math.floor(num(fair.solved, 0)),
    firstTry: Math.floor(num(fair.firstTry, 0)),
  };
  const quiz = isObj(raw.quiz) ? raw.quiz : {};
  const qids = QUESTIONS.map((q) => q.id);
  s.quiz = {
    pending: quiz.pending === true,
    solved: Array.isArray(quiz.solved) ? [...new Set(quiz.solved.filter((q): q is string => qids.includes(q as string)))] : [],
    correct: Math.floor(num(quiz.correct, 0)),
    asked: Math.floor(num(quiz.asked, 0)),
  };

  const settings = isObj(raw.settings) ? raw.settings : {};
  s.settings.sound = settings.sound !== false;
  return s;
}

export function parseSave(text: string, now: number): { state: GameState; migratedFrom: number | null } {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error('Файл сохранения повреждён (не JSON).');
  }
  if (!isObj(raw)) throw new Error('Файл сохранения повреждён.');
  const { data, from } = migrate(raw);
  return { state: sanitize(data, now), migratedFrom: from === SAVE_VERSION ? null : from };
}

// ---------------------------------------------------------------- load & save

export type LoadResult =
  | { status: 'new'; state: GameState }
  | { status: 'ok'; state: GameState; migratedFrom: number | null; fromBackup: boolean }
  | { status: 'corrupt'; state: GameState; error: string }
  | { status: 'unavailable'; state: GameState; error: StorageError };

export function loadGame(storage: StorageLike | null, now: number, storageError?: StorageError): LoadResult {
  if (!storage) {
    return {
      status: 'unavailable',
      state: newGame(now),
      error: storageError ?? { kind: 'unavailable', message: 'Хранилище недоступно.' },
    };
  }
  let main: string | null;
  let prev: string | null;
  try {
    main = storage.getItem(SAVE_KEY);
    prev = storage.getItem(PREV_KEY);
  } catch (e) {
    return { status: 'unavailable', state: newGame(now), error: classifyStorageError(e) };
  }
  if (main === null && prev === null) return { status: 'new', state: newGame(now) };

  let mainError = '';
  if (main !== null) {
    try {
      const { state, migratedFrom } = parseSave(main, now);
      return { status: 'ok', state, migratedFrom, fromBackup: false };
    } catch (e) {
      mainError = (e as Error).message;
      // Keep the damaged data aside instead of silently overwriting it.
      try {
        storage.setItem(CORRUPT_KEY_PREFIX + now, main);
      } catch {
        /* nothing more we can do; the error is reported below */
      }
    }
  }
  if (prev !== null) {
    try {
      const { state, migratedFrom } = parseSave(prev, now);
      return { status: 'ok', state, migratedFrom, fromBackup: true };
    } catch {
      /* fall through */
    }
  }
  return { status: 'corrupt', state: newGame(now), error: mainError || 'Сохранение повреждено.' };
}

export type SaveResult = { ok: true } | { ok: false; error: StorageError };

export function saveGame(storage: StorageLike | null, s: GameState): SaveResult {
  if (!storage) return { ok: false, error: { kind: 'unavailable', message: 'Хранилище недоступно.' } };
  try {
    const text = JSON.stringify(s);
    const current = storage.getItem(SAVE_KEY);
    if (current !== null && current !== text) storage.setItem(PREV_KEY, current);
    storage.setItem(SAVE_KEY, text);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: classifyStorageError(e) };
  }
}

// ---------------------------------------------------------------- export & import

export function exportSave(s: GameState, now: number): string {
  return JSON.stringify({ app: EXPORT_APP, exportedAt: new Date(now).toISOString(), save: s }, null, 2);
}

export function importSave(text: string, now: number): { state: GameState; migratedFrom: number | null } {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error('Это не файл резервной копии «Зелёного сада».');
  }
  if (!isObj(raw) || raw.app !== EXPORT_APP || !isObj(raw.save)) {
    throw new Error('Это не файл резервной копии «Зелёного сада».');
  }
  return parseSave(JSON.stringify(raw.save), now);
}
