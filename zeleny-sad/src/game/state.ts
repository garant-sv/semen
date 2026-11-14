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
import { FAIR_EVERY_MIN, FAIR_FROM_QUEST, FAIR_QUEUE, fairLevel } from './math';
import { RUS_FROM_QUEST, RUS_REWARD, RUS_TRY_REWARD, WORDS, viewWord } from './russian';
import { QUESTIONS, QUIZ_EVERY, QUIZ_FROM_QUEST, QUIZ_REWARD, QUIZ_TRY_REWARD, type Question } from './quiz';

export const SAVE_VERSION = 7;

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
  };
  settings: {
    sound: boolean;
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
    fair: { queue: 0, lastAt: 0, solved: 0, firstTry: 0 },
    rus: { learned: [], correct: 0, total: 0 },
    settings: { sound: true },
  };
}

// ---------------------------------------------------------------- growth

export function stageDurationMs(plant: PlantId): number {
  return (PLANTS[plant].growMinutes * 60_000) / 3;
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
    const max = PLANTS[plant].growMinutes <= 6 ? 3 : PLANTS[plant].growMinutes <= 12 ? 2 : 1;
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

/** Pick the next question: unsolved ones first. */
export function pickQuestion(s: GameState, rand: () => number): Question {
  const open = QUESTIONS.filter((q) => !s.quiz.solved.includes(q.id));
  const pool = open.length ? open : QUESTIONS;
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
  const fresh = WORDS.filter((w) => !s.rus.learned.includes(w.id) && !busy.has(w.id));
  const pool = fresh.length ? fresh : WORDS.filter((w) => !busy.has(w.id));
  const list = pool.length ? pool : WORDS;
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
 * Bring the customer queue up to date: a new customer every few minutes, at most a few waiting.
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
  const step = FAIR_EVERY_MIN * 60_000;
  const added = Math.floor((now - f.lastAt) / step);
  if (f.queue >= FAIR_QUEUE) {
    f.lastAt = now;
  } else if (added > 0) {
    f.queue = Math.min(FAIR_QUEUE, f.queue + added);
    f.lastAt = f.queue >= FAIR_QUEUE ? now : f.lastAt + added * step;
  }
  return false;
}

/** Minutes until the next customer comes (0 if the stall is full). */
export function nextCustomerIn(s: GameState, now: number): number {
  if (s.fair.queue >= FAIR_QUEUE || !s.fair.lastAt) return 0;
  return Math.max(1, Math.ceil((s.fair.lastAt + FAIR_EVERY_MIN * 60_000 - now) / 60_000));
}

export type FairResult = 'first' | 'second' | 'failed';

export function fairReward(level: number, result: FairResult): number {
  return result === 'first' ? 3 + level : result === 'second' ? 2 : 1;
}

/** A customer has been served; returns the petals earned. */
export function serveCustomer(s: GameState, result: FairResult, now: number): Ok<{ petals: number; level: number }> | Fail {
  advanceFair(s, now);
  if (s.fair.queue <= 0) return fail('Покупателей пока нет.');
  const level = fairLevel(s.fair.solved);
  const petals = fairReward(level, result);
  if (s.fair.queue >= FAIR_QUEUE) s.fair.lastAt = now; // the timer restarts when a place frees up
  s.fair.queue -= 1;
  if (result !== 'failed') s.fair.solved += 1;
  if (result === 'first') s.fair.firstTry += 1;
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

export function formatDuration(ms: number): string {
  const total = Math.ceil(ms / 1000);
  const m = Math.floor(total / 60);
  const sec = total % 60;
  return `${m}:${String(sec).padStart(2, '0')}`;
}
