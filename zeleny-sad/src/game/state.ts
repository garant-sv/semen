// Game state and pure game rules. Every function takes the current time explicitly,
// so growth is always recalculated from timestamps and never depends on timers.

import {
  DECO_IDS,
  DECORATIONS,
  GOLDEN_CHANCE,
  GOLDEN_FROM_QUEST,
  GOLDEN_PITY,
  GUESTS,
  GUEST_IDS,
  ORDERS_FROM_QUEST,
  LANDMARKS,
  PLANTS,
  FLOWER_IDS,
  PLOT_COUNT,
  TOTAL_PLOTS,
  AREA_PLANTS,
  ZONE_IDS,
  plantArea,
  plotArea,
  areaPlots,
  QUESTS,
  SLOT_COUNT,
  type DecoId,
  type AreaId,
  type Goal,
  type GuestId,
  type ZoneId,
  type Landmark,
  type PlantId,
  type Quest,
  type Stage,
} from './data';
import { FAIR_EASE_AFTER_MISSES, FAIR_EVERY_SEC, FAIR_FROM_QUEST, FAIR_HARDER_AFTER_STREAK, FAIR_QUEUE, fairLevel, plural } from './math';
import { RUS_FROM_QUEST, RUS_REWARD, RUS_TRY_REWARD, WORDS, viewWord, wordsForGrade } from './russian';
import { QUESTIONS, QUIZ_EVERY, QUIZ_FROM_QUEST, QUIZ_REWARD, QUIZ_TRY_REWARD, questionGrades, type Grade, type Question } from './quiz';

export const SAVE_VERSION = 9;

export interface Plot {
  plant: PlantId | null;
  stage: Stage;
  /** When the current stage was watered; null means the plant is waiting for water. */
  wateredAt: number | null;
  plantedAt: number | null;
  /** The seed will bloom into a golden flower (kept secret until it blooms). */
  golden: boolean;
  /** A sign with a word to fill in (Russian); null — no sign. */
  sign: { id: string; solved: boolean } | null;
}

export interface OrderItem {
  plant: PlantId;
  need: number;
  have: number;
}

/** A guest asks for some flowers; every matching harvest counts. */
export interface Order {
  from: GuestId;
  items: OrderItem[];
  reward: number;
}

export interface CollectionEntry {
  firstAt: number;
  count: number;
}

export interface GameState {
  version: number;
  createdAt: number;
  updatedAt: number;
  petals: number;
  unlockedPlants: PlantId[];
  openPlots: number;
  plots: Plot[];
  restored: Record<Landmark, boolean>;
  decor: {
    owned: Record<DecoId, number>;
    placed: (DecoId | null)[];
  };
  collection: Partial<Record<PlantId, CollectionEntry>>;
  /** Golden flowers collected, by kind. */
  golden: Partial<Record<PlantId, number>>;
  /** Garden guests the player has met. */
  guests: Partial<Record<GuestId, CollectionEntry>>;
  order: Order | null;
  ordersDone: number;
  questIndex: number;
  stats: {
    planted: Partial<Record<PlantId, number>>;
    watered: number;
    harvested: number;
    /** Ordinary plantings since the last golden seed (for the pity rule). */
    sinceGolden: number;
    /** Harvests since Listik's last question. */
    sinceQuiz: number;
  };
  /** Badges already announced to the player. */
  badges: string[];
  /** Listik's questions (school nature topics). */
  quiz: {
    /** A question is waiting to be asked. */
    pending: boolean;
    /** Ids of questions answered correctly (they are not asked again until all are done). */
    solved: string[];
    correct: number;
    asked: number;
  };
  /** Who is playing: a nickname (stays on the device) and the school class that sets the tasks. */
  profile: { nick: string; grade: Grade | null };
  /** The player's own gardener who walks around the garden (3–5 class); null until created. */
  gardener: Gardener | null;
  /** «Ветер раскидал семена»: which seeds still lie on the grass at the start, as bits (3–5 class). */
  startSeeds: number;
  /** «Таблички у грядок»: Russian spelling. */
  rus: {
    /** Words filled in correctly (shown in the word list; asked less often). */
    learned: string[];
    correct: number;
    total: number;
  };
  /** «Ярмарка урожая»: customers with math problems. */
  fair: {
    /** Customers waiting at the stall. */
    queue: number;
    /** When the customer timer last ticked (0 — the fair has not opened yet). */
    lastAt: number;
    /** Problems solved (first or second try). */
    solved: number;
    /** Solved on the first try. */
    firstTry: number;
    /** Levels the fair stepped down after the child got stuck (0 = as many as solved allow). */
    ease: number;
    /** Customers in a row the child could not help (resets on a solved one). */
    misses: number;
    /** First tries in a row (resets on any other result). */
    streak: number;
  };
  settings: {
    sound: boolean;
    /** «Живое 2,5D»: the garden moves a little when the phone is tilted. */
    tilt: boolean;
    /** Large text: null = by class (on for 2–3 class), or the player's own choice in the Menu. */
    bigText: boolean | null;
    /** Listik reads aloud: null = by class (on for 2–3 class), or the player's own choice. */
    voice: boolean | null;
    /** «Тихо»: one tap on the screen silences everything (sounds and Listik), e.g. at a lesson. */
    muted: boolean;
  };
}

export function emptyPlot(): Plot {
  return { plant: null, stage: 0, wateredAt: null, plantedAt: null, golden: false, sign: null };
}

export function newGame(now: number): GameState {
  const owned = Object.fromEntries(DECO_IDS.map((id) => [id, 0])) as Record<DecoId, number>;
  return {
    version: SAVE_VERSION,
    createdAt: now,
    updatedAt: now,
    petals: 0,
    unlockedPlants: ['daisy'],
    openPlots: 3,
    plots: Array.from({ length: TOTAL_PLOTS }, emptyPlot),
    restored: { bridge: false, pond: false, veg: false, tundra: false, taiga: false, steppe: false },
    decor: { owned, placed: Array.from({ length: SLOT_COUNT }, () => null) },
    collection: {},
    golden: {},
    guests: {},
    order: null,
    ordersDone: 0,
    questIndex: 0,
    stats: { planted: {}, watered: 0, harvested: 0, sinceGolden: 0, sinceQuiz: 0 },
    badges: [],
    quiz: { pending: false, solved: [], correct: 0, asked: 0 },
    fair: { queue: 0, lastAt: 0, solved: 0, firstTry: 0, ease: 0, misses: 0, streak: 0 },
    rus: { learned: [], correct: 0, total: 0 },
    profile: { nick: '', grade: null },
    gardener: null,
    startSeeds: 0,
    settings: { sound: true, tilt: true, bigText: null, voice: null, muted: false },
  };
}

// ---------------------------------------------------------------- growth

export function stageDurationMs(plant: PlantId): number {
  return Math.round((PLANTS[plant].growSeconds * 1000) / 3);
}

export type PlotStatus = 'locked' | 'empty' | 'thirsty' | 'growing' | 'ready';

export function plotStatus(s: GameState, index: number, now: number): PlotStatus {
  const area = plotArea(index);
  if (area === 'garden' ? index >= s.openPlots : !s.restored[area]) return 'locked';
  const p = s.plots[index];
  if (!p.plant) return 'empty';
  if (p.stage >= 3) return 'ready';
  if (p.wateredAt === null) return 'thirsty';
  return now - p.wateredAt >= stageDurationMs(p.plant) ? 'ready' : 'growing';
}

/** Milliseconds until the current stage finishes (0 when not growing). */
export function remainingMs(p: Plot, now: number): number {
  if (!p.plant || p.wateredAt === null || p.stage >= 3) return 0;
  return Math.max(0, stageDurationMs(p.plant) - Math.max(0, now - p.wateredAt));
}

/** Fraction 0..1 of the current stage. */
export function stageProgress(p: Plot, now: number): number {
  if (!p.plant || p.wateredAt === null || p.stage >= 3) return 0;
  return Math.min(1, Math.max(0, (now - p.wateredAt) / stageDurationMs(p.plant)));
}

export interface GrowthChange {
  plot: number;
  plant: PlantId;
  stage: Stage;
}

/**
 * Recalculate growth for the given moment. A watered stage advances exactly one step,
 * then the plant waits for water again. Plants never wither while the player is away.
 * If the device clock moved backwards, the watering moment is clamped to "now".
 */
export function advance(s: GameState, now: number): GrowthChange[] {
  const changes: GrowthChange[] = [];
  s.plots.forEach((p, i) => {
    if (!p.plant || p.stage >= 3 || p.wateredAt === null) return;
    if (p.wateredAt > now) p.wateredAt = now;
    if (now - p.wateredAt >= stageDurationMs(p.plant)) {
      p.stage = (p.stage + 1) as Stage;
      p.wateredAt = null;
      changes.push({ plot: i, plant: p.plant, stage: p.stage });
    }
  });
  return changes;
}

// ---------------------------------------------------------------- actions

export type Fail = { ok: false; reason: string };
export type Ok<T = object> = { ok: true } & T;

const fail = (reason: string): Fail => ({ ok: false, reason });

/**
 * Plant a seed. `rand` decides whether it becomes a golden flower; without it (tests,
 * tutorial-free calls) seeds are never golden.
 */
export function plantSeed(
  s: GameState,
  index: number,
  plant: PlantId,
  now: number,
  rand: (() => number) | null = null,
): Ok | Fail {
  advance(s, now);
  if (plotStatus(s, index, now) === 'locked') return fail('Эта грядка пока заросла.');
  if (s.plots[index].plant) return fail('На этой грядке уже что-то растёт.');
  if (!s.unlockedPlants.includes(plant)) return fail('Таких семян пока нет.');
  if (plantArea(plant) !== plotArea(index)) return fail('Это растение здесь не приживётся.');
  let golden = false;
  if (rand && s.questIndex >= GOLDEN_FROM_QUEST) {
    golden = s.stats.sinceGolden >= GOLDEN_PITY || rand() < GOLDEN_CHANCE;
    s.stats.sinceGolden = golden ? 0 : s.stats.sinceGolden + 1;
  }
  const sign = rand && s.questIndex >= RUS_FROM_QUEST ? { id: pickWord(s, rand), solved: false } : null;
  s.plots[index] = { plant, stage: 0, wateredAt: null, plantedAt: now, golden, sign };
  s.stats.planted[plant] = (s.stats.planted[plant] ?? 0) + 1;
  s.updatedAt = now;
  return { ok: true };
}

export function water(s: GameState, index: number, now: number): Ok | Fail {
  advance(s, now);
  const status = plotStatus(s, index, now);
  if (status !== 'thirsty') return fail('Сейчас поливать не нужно.');
  s.plots[index].wateredAt = now;
  s.stats.watered += 1;
  s.updatedAt = now;
  return { ok: true };
}

export function harvest(
  s: GameState,
  index: number,
  now: number,
): Ok<{ plant: PlantId; petals: number; first: boolean; golden: boolean; firstGolden: boolean }> | Fail {
  advance(s, now);
  const p = s.plots[index];
  if (plotStatus(s, index, now) !== 'ready' || !p.plant) return fail('Цветок ещё не раскрылся.');
  const plant = p.plant;
  const golden = p.golden;
  const petals = PLANTS[plant].petals * (golden ? 2 : 1);
  const entry = s.collection[plant];
  const first = !entry;
  const firstGolden = golden && !Object.values(s.golden).some((n) => (n ?? 0) > 0);
  s.collection[plant] = { firstAt: entry?.firstAt ?? now, count: (entry?.count ?? 0) + 1 };
  if (golden) s.golden[plant] = (s.golden[plant] ?? 0) + 1;
  s.petals += petals;
  s.stats.harvested += 1;
  s.stats.sinceQuiz += 1;
  if (s.order) {
    const item = s.order.items.find((it) => it.plant === plant && it.have < it.need);
    if (item) item.have += 1;
  }
  s.plots[index] = emptyPlot();
  s.updatedAt = now;
  return { ok: true, plant, petals, first, golden, firstGolden };
}

export function landmarkAvailable(s: GameState, target: Landmark): boolean {
  return s.questIndex >= LANDMARKS[target].availableFromQuest;
}

export function restore(s: GameState, target: Landmark, now: number): Ok | Fail {
  const def = LANDMARKS[target];
  if (s.restored[target]) return fail('Уже восстановлено.');
  if (!landmarkAvailable(s, target)) return fail('Листик ещё не рассказал, как это починить.');
  if (s.petals < def.price) return fail(`Нужно ${def.price} лепестков, а у тебя ${s.petals}.`);
  s.petals -= def.price;
  s.restored[target] = true;
  const seeds = target === 'veg' ? (['carrot', 'strawberry'] as const) : (ZONE_IDS as readonly string[]).includes(target) ? AREA_PLANTS[target as ZoneId] : [];
  for (const p of seeds) if (!s.unlockedPlants.includes(p)) s.unlockedPlants.push(p);
  s.updatedAt = now;
  return { ok: true };
}

export function decorAvailable(s: GameState): boolean {
  return s.restored.bridge;
}

export function buyDecoration(s: GameState, id: DecoId, now: number): Ok | Fail {
  const def = DECORATIONS[id];
  if (!decorAvailable(s)) return fail('Сначала почини мостик.');
  if (s.petals < def.price) return fail(`Нужно ${def.price} лепестков.`);
  s.petals -= def.price;
  s.decor.owned[id] += 1;
  s.updatedAt = now;
  return { ok: true };
}

/** Owned decorations that are not placed in the garden. */
export function freeDecorations(s: GameState, id: DecoId): number {
  const placed = s.decor.placed.filter((d) => d === id).length;
  return s.decor.owned[id] - placed;
}

export function placeDecoration(s: GameState, slot: number, id: DecoId, now: number): Ok | Fail {
  if (slot < 0 || slot >= SLOT_COUNT) return fail('Нет такого места.');
  if (s.decor.placed[slot]) return fail('Это место уже занято.');
  if (freeDecorations(s, id) <= 0) return fail('Сначала нужно получить это украшение.');
  s.decor.placed[slot] = id;
  s.updatedAt = now;
  return { ok: true };
}

export function removeDecoration(s: GameState, slot: number, now: number): Ok<{ id: DecoId }> | Fail {
  const id = s.decor.placed[slot];
  if (!id) return fail('Здесь ничего нет.');
  s.decor.placed[slot] = null;
  s.updatedAt = now;
  return { ok: true, id };
}

// ---------------------------------------------------------------- guests

/** Which guests may visit the garden right now. */
export function guestCanVisit(s: GameState, id: GuestId): boolean {
  if (s.questIndex < 1) return false; // let the first seed be planted in peace
  const area = GUESTS[id].area;
  if (area !== 'garden') return s.restored[area];
  const blooming = s.plots.some((p, i) => i < s.openPlots && p.plant && p.stage >= 3);
  switch (id) {
    case 'ladybug':
    case 'snail':
      return true;
    case 'bee':
      return blooming;
    case 'butterfly':
      return blooming && Object.keys(s.collection).length >= 2;
    case 'hedgehog':
      return s.restored.bridge;
    case 'frog':
      return s.restored.pond;
    default:
      return false;
  }
}

/** Guests that may show up in the given part of the world (none in the vegetable patch). */
export function visitingGuests(s: GameState, where: AreaId = 'garden'): GuestId[] {
  return GUEST_IDS.filter((id) => GUESTS[id].area === where && guestCanVisit(s, id));
}

/** Bonus for the very first meeting with a guest. */
export const FIRST_MEET_BONUS = 3;

export function meetGuest(s: GameState, id: GuestId, now: number): Ok<{ first: boolean; petals: number }> {
  const entry = s.guests[id];
  const first = !entry;
  const petals = GUESTS[id].petals + (first ? FIRST_MEET_BONUS : 0);
  s.guests[id] = { firstAt: entry?.firstAt ?? now, count: (entry?.count ?? 0) + 1 };
  s.petals += petals;
  s.updatedAt = now;
  return { ok: true, first, petals };
}

// ---------------------------------------------------------------- orders

export function ordersAvailable(s: GameState): boolean {
  return s.questIndex >= ORDERS_FROM_QUEST;
}

export function newOrder(s: GameState, rand: () => number): Order {
  const pick = <T>(arr: readonly T[]) => arr[Math.min(arr.length - 1, Math.floor(rand() * arr.length))];
  const plants = s.unlockedPlants;
  const kinds = plants.length > 1 && rand() < 0.5 ? 2 : 1;
  const chosen: PlantId[] = [];
  for (let k = 0; k < kinds; k++) chosen.push(pick(plants.filter((p) => !chosen.includes(p))));
  const items = chosen.map((plant) => {
    const max = PLANTS[plant].growSeconds <= 24 ? 3 : PLANTS[plant].growSeconds <= 45 ? 2 : 1;
    return { plant, need: Math.max(1, Math.ceil(rand() * (kinds === 2 ? Math.min(2, max) : max))), have: 0 };
  });
  const value = items.reduce((sum, it) => sum + PLANTS[it.plant].petals * it.need, 0);
  return { from: pick(GUEST_IDS), items, reward: Math.ceil(value * 0.6) + 3 };
}

/** Make sure there is an order on the board once orders are unlocked. Returns true if a new one appeared. */
export function ensureOrder(s: GameState, rand: () => number): boolean {
  if (!ordersAvailable(s) || s.order) return false;
  s.order = newOrder(s, rand);
  return true;
}

export function orderComplete(s: GameState): boolean {
  return !!s.order && s.order.items.every((it) => it.have >= it.need);
}

export function claimOrder(s: GameState, now: number, rand: () => number): Ok<{ reward: number }> | Fail {
  if (!s.order) return fail('Просьб пока нет.');
  if (!orderComplete(s)) return fail('Собери все цветы, которые просят.');
  const reward = s.order.reward;
  s.petals += reward;
  s.ordersDone += 1;
  s.order = newOrder(s, rand);
  s.updatedAt = now;
  return { ok: true, reward };
}

// ---------------------------------------------------------------- Listik's questions

/** After every few harvests Listik has a question ready. Returns true if one just appeared. */
export function checkQuiz(s: GameState): boolean {
  if (s.quiz.pending || s.questIndex < QUIZ_FROM_QUEST || s.stats.sinceQuiz < QUIZ_EVERY) return false;
  s.quiz.pending = true;
  s.stats.sinceQuiz = 0;
  return true;
}

/** The class that sets the difficulty (4 until the player chooses). */
export const gradeOf = (s: GameState): Grade => s.profile.grade ?? 4;

/** 2–3 class: the gentler mode (large text, Listik reads aloud, tasks with pictures). */
export const youngMode = (s: GameState): boolean => s.profile.grade !== null && s.profile.grade <= 3;

/** Large text is on by class unless the player switched it in the Menu. */
export const bigTextOn = (s: GameState): boolean => s.settings.bigText ?? youngMode(s);

/**
 * «Подсказывающий пальчик»: the bed in this area the child would most likely tap next —
 * a ripe plant first, then one waiting for water, then an empty bed when nothing is growing.
 */
export function nextTap(s: GameState, now: number, area: AreaId): number | null {
  const beds = areaPlots(area).filter((i) => plotStatus(s, i, now) !== 'locked');
  const first = (st: PlotStatus) => beds.find((i) => plotStatus(s, i, now) === st) ?? null;
  return first('ready') ?? first('thirsty') ?? (beds.some((i) => plotStatus(s, i, now) === 'growing') ? null : first('empty'));
}

/** Listik reads aloud by class unless the player switched it in the Menu. */
export const voiceWanted = (s: GameState): boolean => s.settings.voice ?? youngMode(s);

/** Listik actually reads: wanted, and the quick «Тихо» button is not pressed. */
export const voiceOn = (s: GameState): boolean => !s.settings.muted && voiceWanted(s);

/** Game sounds actually play: on in the Menu, and the quick «Тихо» button is not pressed. */
export const soundOn = (s: GameState): boolean => s.settings.sound && !s.settings.muted;

export function setProfile(s: GameState, nick: string, grade: Grade, now: number) {
  s.profile = { nick: cleanNick(nick), grade };
  s.updatedAt = now;
}

// ---------------------------------------------------------------- gardener

export const SKINS = ['#F6D2B4', '#E2AE84', '#A8714B'] as const;
export const HATS = ['straw', 'cap', 'panama', 'bandana'] as const;
export type Hat = (typeof HATS)[number];
export const HAT_NAMES: Record<Hat, string> = { straw: 'Соломенная шляпа', cap: 'Кепка', panama: 'Панама с цветком', bandana: 'Бандана' };
export const OUTFITS = ['#3F8F5A', '#3E7CC4', '#E0703A', '#9A5BC2', '#D94F70'] as const;
/** Pets are garden animals the child already knows from the collection. */
export const PETS = ['hedgehog', 'ladybug', 'frog', 'bee'] as const;
export type Pet = (typeof PETS)[number];

export interface Gardener {
  skin: number;
  hat: Hat;
  outfit: number;
  pet: Pet;
}

/** Number of seeds the wind scatters at the start, and petals for each. */
export const START_SEEDS = 3;
/** All seeds lying on the grass (one bit per seed, so they can be picked in any order). */
export const ALL_START_SEEDS = (1 << START_SEEDS) - 1;
/** Is seed k still on the grass? */
export const seedLeft = (s: GameState, k: number): boolean => (s.startSeeds & (1 << k)) !== 0;
/** How many seeds are still on the grass. */
export const seedsLeft = (s: GameState): number => Array.from({ length: START_SEEDS }, (_, k) => seedLeft(s, k)).filter(Boolean).length;
export const START_SEED_PETALS = 2;

/** 3–5 class plays with their own gardener; 2 class is led by Listik (and may add one from the Menu). */
export const gardenerByDefault = (s: GameState): boolean => s.profile.grade !== null && s.profile.grade >= 3;

/** A random look, so the creator never opens on an empty figure. */
export function randomGardener(rand: () => number): Gardener {
  const pick = <T>(a: readonly T[]) => a[Math.floor(rand() * a.length) % a.length];
  return { skin: Math.floor(rand() * SKINS.length) % SKINS.length, hat: pick(HATS), outfit: Math.floor(rand() * OUTFITS.length) % OUTFITS.length, pet: pick(PETS) };
}

/**
 * Save the gardener. The first time, on a fresh garden, the wind scatters seeds to collect:
 * something to do in the very first minute, before anything grows.
 */
export function setGardener(s: GameState, g: Gardener, now: number): { scattered: boolean } {
  const first = s.gardener === null;
  s.gardener = { ...g };
  s.updatedAt = now;
  if (first && s.questIndex === 0 && s.stats.harvested === 0) {
    s.startSeeds = ALL_START_SEEDS;
    return { scattered: true };
  }
  return { scattered: false };
}

/** Pick up seed k (any order). */
export function collectStartSeed(s: GameState, k: number, now: number): Ok<{ petals: number; left: number }> | Fail {
  if (!seedLeft(s, k)) return fail('Этого семечка на траве уже нет.');
  s.startSeeds &= ~(1 << k);
  s.petals += START_SEED_PETALS;
  s.updatedAt = now;
  return { ok: true, petals: START_SEED_PETALS, left: seedsLeft(s) };
}

/** A nickname: up to 16 letters, digits, spaces and hyphens. */
export function cleanNick(nick: string): string {
  return nick.replace(/[^\p{L}\p{N} -]/gu, '').replace(/\s+/g, ' ').trim().slice(0, 16);
}

/** Pick the next question for the player's class: unsolved ones first. */
export function pickQuestion(s: GameState, rand: () => number): Question {
  const g = gradeOf(s);
  const forGrade = QUESTIONS.filter((q) => questionGrades(q).includes(g));
  const all = forGrade.length ? forGrade : QUESTIONS;
  const open = all.filter((q) => !s.quiz.solved.includes(q.id));
  const pool = open.length ? open : all;
  return pool[Math.min(pool.length - 1, Math.floor(rand() * pool.length))];
}

export function answerQuiz(s: GameState, id: string, answer: string, now: number): Ok<{ correct: boolean; petals: number }> | Fail {
  const q = QUESTIONS.find((x) => x.id === id);
  if (!q) return fail('Нет такого вопроса.');
  const correct = answer === q.options[0];
  const petals = correct ? QUIZ_REWARD : QUIZ_TRY_REWARD;
  s.quiz.pending = false;
  s.quiz.asked += 1;
  if (correct) {
    s.quiz.correct += 1;
    if (!s.quiz.solved.includes(id)) s.quiz.solved.push(id);
  }
  s.petals += petals;
  s.updatedAt = now;
  return { ok: true, correct, petals };
}

// ---------------------------------------------------------------- signs (Russian)

/** A word for a new sign: not yet learned and not on another sign, if possible. */
export function pickWord(s: GameState, rand: () => number): string {
  const busy = new Set(s.plots.map((p) => p.sign?.id).filter(Boolean));
  const words = wordsForGrade(gradeOf(s));
  const fresh = words.filter((w) => !s.rus.learned.includes(w.id) && !busy.has(w.id));
  const pool = fresh.length ? fresh : words.filter((w) => !busy.has(w.id));
  const list = pool.length ? pool : words;
  return list[Math.min(list.length - 1, Math.floor(rand() * list.length))].id;
}

export function answerSign(
  s: GameState,
  index: number,
  option: string,
  now: number,
): Ok<{ correct: boolean; petals: number; answer: string }> | Fail {
  const sign = s.plots[index]?.sign;
  if (!sign || sign.solved) return fail('Здесь нет таблички.');
  const w = WORDS.find((x) => x.id === sign.id);
  if (!w) return fail('Табличка стёрлась.');
  const { answer } = viewWord(w);
  const correct = option === answer;
  const petals = correct ? RUS_REWARD : RUS_TRY_REWARD;
  sign.solved = true;
  s.rus.total += 1;
  if (correct) {
    s.rus.correct += 1;
    if (!s.rus.learned.includes(w.id)) s.rus.learned.push(w.id);
  }
  s.petals += petals;
  s.updatedAt = now;
  return { ok: true, correct, petals, answer };
}

// ---------------------------------------------------------------- fair

export function fairAvailable(s: GameState): boolean {
  return s.questIndex >= FAIR_FROM_QUEST;
}

/**
 * Bring the customer queue up to date: a new customer every FAIR_EVERY_SEC seconds, at most a few waiting.
 * Returns true when the fair has just opened.
 */
export function advanceFair(s: GameState, now: number): boolean {
  const f = s.fair;
  if (!fairAvailable(s)) return false;
  if (f.lastAt === 0) {
    f.lastAt = now;
    f.queue = Math.max(f.queue, 1);
    return true;
  }
  if (now < f.lastAt) f.lastAt = now; // the device clock went back
  const step = FAIR_EVERY_SEC * 1000;
  const added = Math.floor((now - f.lastAt) / step);
  if (f.queue >= FAIR_QUEUE) {
    f.lastAt = now;
  } else if (added > 0) {
    f.queue = Math.min(FAIR_QUEUE, f.queue + added);
    f.lastAt = f.queue >= FAIR_QUEUE ? now : f.lastAt + added * step;
  }
  return false;
}

/** Milliseconds until the next customer comes (0 if the stall is full). */
export function nextCustomerIn(s: GameState, now: number): number {
  if (s.fair.queue >= FAIR_QUEUE || !s.fair.lastAt) return 0;
  return Math.max(1000, s.fair.lastAt + FAIR_EVERY_SEC * 1000 - now);
}

export type FairResult = 'first' | 'second' | 'failed';

export function fairReward(level: number, result: FairResult): number {
  return result === 'first' ? 3 + level : result === 'second' ? 2 : 1;
}

/** A customer has been served; returns the petals earned. */
export function serveCustomer(s: GameState, result: FairResult, now: number): Ok<{ petals: number; level: number }> | Fail {
  advanceFair(s, now);
  if (s.fair.queue <= 0) return fail('Покупателей пока нет.');
  const f = s.fair;
  const level = fairLevel(f.solved, gradeOf(s), f.ease);
  const petals = fairReward(level, result);
  if (f.queue >= FAIR_QUEUE) f.lastAt = now; // the timer restarts when a place frees up
  f.queue -= 1;
  if (result !== 'failed') f.solved += 1;
  if (result === 'first') f.firstTry += 1;
  // The level follows the child: stuck twice in a row — one step easier; three first tries — back up.
  f.misses = result === 'failed' ? f.misses + 1 : 0;
  f.streak = result === 'first' ? f.streak + 1 : 0;
  if (f.misses >= FAIR_EASE_AFTER_MISSES) {
    f.ease = Math.min(3, f.ease + 1);
    f.misses = 0;
  } else if (f.streak >= FAIR_HARDER_AFTER_STREAK && f.ease > 0) {
    f.ease -= 1;
    f.streak = 0;
  }
  s.petals += petals;
  s.updatedAt = now;
  return { ok: true, petals, level };
}

// ---------------------------------------------------------------- quests

export function goalDone(s: GameState, g: Goal): boolean {
  switch (g.type) {
    case 'plant':
      return (s.stats.planted[g.plant] ?? 0) > 0;
    case 'water':
      return s.stats.watered > 0;
    case 'harvest':
      return !!s.collection[g.plant];
    case 'restore':
      return s.restored[g.target];
    case 'place':
      return s.decor.placed.some(Boolean);
    case 'collection':
      return FLOWER_IDS.every((id) => s.collection[id]);
    case 'guests':
      return Object.keys(s.guests).length >= g.count;
    case 'golden':
      return Object.values(s.golden).some((n) => (n ?? 0) > 0);
    case 'orders':
      return s.ordersDone >= g.count;
    case 'meet':
      return !!s.guests[g.guest];
  }
}

export function currentQuest(s: GameState): Quest | null {
  return QUESTS[s.questIndex] ?? null;
}

/** Complete every quest whose goals are already met; returns completed quests in order. */
export function checkQuests(s: GameState, now: number): Quest[] {
  const done: Quest[] = [];
  for (let q = currentQuest(s); q && q.goals.every((g) => goalDone(s, g)); q = currentQuest(s)) {
    const r = q.reward;
    if (r.petals) s.petals += r.petals;
    for (const p of r.plants ?? []) if (!s.unlockedPlants.includes(p)) s.unlockedPlants.push(p);
    if (r.openPlots) s.openPlots = Math.max(s.openPlots, Math.min(PLOT_COUNT, r.openPlots));
    s.questIndex += 1;
    s.updatedAt = now;
    done.push(q);
  }
  return done;
}

/** 0..1 — how much of the garden has woken up; drives the visual "haze". */
export function gardenProgress(s: GameState): number {
  const landmarks = (Number(s.restored.bridge) + Number(s.restored.pond)) / 2;
  const collection = FLOWER_IDS.filter((id) => s.collection[id]).length / FLOWER_IDS.length;
  return Math.min(1, landmarks * 0.6 + collection * 0.4);
}

/** «4 секунды», «1 минута 5 секунд» (after «через»: «1 минуту»): a child reads words more easily than «0:04». */
export function formatDuration(ms: number, after = false): string {
  const total = Math.max(1, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const sec = total % 60;
  const mins = m ? `${m} ${plural(m, [after ? 'минуту' : 'минута', 'минуты', 'минут'])}` : '';
  const secs = sec ? `${sec} ${plural(sec, [after ? 'секунду' : 'секунда', 'секунды', 'секунд'])}` : '';
  return [mins, secs].filter(Boolean).join(' ');
}
