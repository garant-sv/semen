import { describe, expect, it } from 'vitest';
import { FLOWER_IDS, GOLDEN_FROM_QUEST, GOLDEN_PITY, PLANT_IDS, PLANTS, QUESTS } from '../../src/game/data';
import { QUESTIONS, QUIZ_EVERY } from '../../src/game/quiz';
import { earned, newBadges } from '../../src/game/badges';
import {
  advance,
  buyDecoration,
  checkQuests,
  claimOrder,
  emptyPlot,
  ensureOrder,
  harvest,
  meetGuest,
  newGame,
  orderComplete,
  visitingGuests,
  checkQuiz,
  pickQuestion,
  answerQuiz,
  placeDecoration,
  plantSeed,
  plotStatus,
  removeDecoration,
  restore,
  stageDurationMs,
  water,
  type GameState,
} from '../../src/game/state';

const T0 = 1_700_000_000_000;

function growToBloom(s: GameState, plot: number, t: number): number {
  const plant = s.plots[plot].plant!;
  for (let i = 0; i < 3; i++) {
    expect(water(s, plot, t).ok).toBe(true);
    t += stageDurationMs(plant);
    advance(s, t);
  }
  return t;
}

describe('growth', () => {
  it('does not grow without water', () => {
    const s = newGame(T0);
    plantSeed(s, 0, 'daisy', T0);
    advance(s, T0 + 24 * 3600_000);
    expect(s.plots[0].stage).toBe(0);
    expect(plotStatus(s, 0, T0 + 24 * 3600_000)).toBe('thirsty');
  });

  it('advances exactly one stage per watering, even after a long absence', () => {
    const s = newGame(T0);
    plantSeed(s, 0, 'daisy', T0);
    water(s, 0, T0);
    const t = T0 + 30 * 24 * 3600_000; // a month away
    const changes = advance(s, t);
    expect(changes).toEqual([{ plot: 0, plant: 'daisy', stage: 1 }]);
    expect(plotStatus(s, 0, t)).toBe('thirsty');
  });

  it('never kills plants', () => {
    const s = newGame(T0);
    s.unlockedPlants.push('sunflower');
    expect(plantSeed(s, 0, 'sunflower', T0).ok).toBe(true);
    let t = growToBloom(s, 0, T0);
    t += 365 * 24 * 3600_000;
    advance(s, t);
    expect(s.plots[0]).toMatchObject({ plant: 'sunflower', stage: 3 });
    expect(plotStatus(s, 0, t)).toBe('ready');
  });

  it('is recalculated from timestamps only (partial progress)', () => {
    const s = newGame(T0);
    plantSeed(s, 0, 'daisy', T0);
    water(s, 0, T0);
    const d = stageDurationMs('daisy');
    expect(advance(s, T0 + d - 1)).toEqual([]);
    expect(plotStatus(s, 0, T0 + d - 1)).toBe('growing');
    expect(advance(s, T0 + d)).toHaveLength(1);
  });

  it('survives the clock moving backwards', () => {
    const s = newGame(T0);
    plantSeed(s, 0, 'daisy', T0);
    water(s, 0, T0);
    advance(s, T0 - 3600_000);
    expect(s.plots[0].wateredAt).toBe(T0 - 3600_000);
    expect(advance(s, T0 - 3600_000 + stageDurationMs('daisy'))).toHaveLength(1);
  });

  it('rejects planting on locked or busy plots and locked seeds', () => {
    const s = newGame(T0);
    expect(plantSeed(s, 5, 'daisy', T0).ok).toBe(false);
    expect(plantSeed(s, 0, 'tulip', T0).ok).toBe(false);
    expect(plantSeed(s, 0, 'daisy', T0).ok).toBe(true);
    expect(plantSeed(s, 0, 'daisy', T0).ok).toBe(false);
  });
});

describe('harvest & collection', () => {
  it('gives petals, fills the collection and frees the plot', () => {
    const s = newGame(T0);
    plantSeed(s, 0, 'daisy', T0);
    expect(harvest(s, 0, T0).ok).toBe(false);
    const t = growToBloom(s, 0, T0);
    const r = harvest(s, 0, t);
    expect(r).toMatchObject({ ok: true, plant: 'daisy', petals: PLANTS.daisy.petals, first: true });
    expect(s.collection.daisy?.count).toBe(1);
    expect(s.plots[0].plant).toBeNull();
    plantSeed(s, 0, 'daisy', t);
    const r2 = harvest(s, 0, growToBloom(s, 0, t));
    expect(r2).toMatchObject({ ok: true, first: false });
    expect(s.collection.daisy?.count).toBe(2);
  });
});

describe('restoration & decorations', () => {
  it('requires the quest stage and petals', () => {
    const s = newGame(T0);
    s.petals = 100;
    expect(restore(s, 'bridge', T0).ok).toBe(false);
    s.questIndex = 4;
    s.petals = 10;
    expect(restore(s, 'bridge', T0).ok).toBe(false);
    s.petals = 15;
    expect(restore(s, 'bridge', T0).ok).toBe(true);
    expect(s.petals).toBe(0);
    expect(s.restored.bridge).toBe(true);
  });

  it('buys, places, moves and returns decorations', () => {
    const s = newGame(T0);
    s.restored.bridge = true;
    s.petals = 6;
    expect(buyDecoration(s, 'lantern', T0).ok).toBe(true);
    expect(placeDecoration(s, 0, 'lantern', T0).ok).toBe(true);
    expect(placeDecoration(s, 1, 'lantern', T0).ok).toBe(false); // only one owned
    expect(removeDecoration(s, 0, T0)).toMatchObject({ ok: true, id: 'lantern' });
    expect(placeDecoration(s, 1, 'lantern', T0).ok).toBe(true);
    expect(s.decor.placed).toEqual([null, 'lantern', null, null, null, null]);
  });
});

describe('quest chain', () => {
  it('can be played from start to finish', () => {
    const s = newGame(T0);
    let t = T0;
    const step = () => checkQuests(s, t);
    const growOn = (plot: number, plant: (typeof PLANT_IDS)[number]) => {
      expect(plantSeed(s, plot, plant, t).ok).toBe(true);
      step();
      t = growToBloom(s, plot, t);
      step();
      expect(harvest(s, plot, t).ok).toBe(true);
      step();
    };
    growOn(0, 'daisy');
    expect(s.questIndex).toBe(3);
    expect(s.unlockedPlants).toContain('sunflower');
    growOn(1, 'sunflower');
    expect(s.openPlots).toBe(4);
    while (s.petals < 15) growOn(0, 'daisy');
    expect(restore(s, 'bridge', t).ok).toBe(true);
    step();
    expect(s.unlockedPlants).toContain('tulip');
    while (s.petals < 6) growOn(0, 'daisy');
    buyDecoration(s, 'lantern', t);
    placeDecoration(s, 0, 'lantern', t);
    step();
    growOn(2, 'bellflower');
    growOn(3, 'tulip');
    expect(s.unlockedPlants).toContain('lavender');
    while (s.petals < 40) growOn(0, 'tulip');
    expect(restore(s, 'pond', t).ok).toBe(true);
    step();
    expect(s.openPlots).toBe(6);
    growOn(4, 'lavender');
    growOn(5, 'moonflower');
    expect(FLOWER_IDS.every((id) => s.collection[id])).toBe(true);
    expect(s.questIndex).toBe(10);
    // Quests 11–13: guests, a golden flower, three orders.
    for (const g of ['ladybug', 'snail', 'frog'] as const) meetGuest(s, g, t);
    step();
    expect(s.questIndex).toBe(11);
    expect(plantSeed(s, 0, 'daisy', t, () => 0).ok).toBe(true);
    t = growToBloom(s, 0, t);
    expect(harvest(s, 0, t)).toMatchObject({ ok: true, golden: true, petals: 6 });
    step();
    expect(s.questIndex).toBe(12);
    for (let n = 0; n < 3; n++) {
      ensureOrder(s, () => 0.1);
      for (const it of s.order!.items) for (let k = it.have; k < it.need; k++) growOn(0, it.plant);
      expect(claimOrder(s, t, () => 0.1).ok).toBe(true);
      step();
    }
    expect(s.questIndex).toBe(13);
    // Quests 14–15: the vegetable patch.
    expect(plantSeed(s, 6, 'carrot', t).ok).toBe(false); // patch still overgrown
    while (s.petals < 50) growOn(0, 'tulip');
    expect(restore(s, 'veg', t).ok).toBe(true);
    expect(plantSeed(s, 0, 'carrot', t).ok).toBe(false); // vegetables only in the patch
    expect(plantSeed(s, 6, 'daisy', t).ok).toBe(false); // and flowers only in the garden
    growOn(6, 'carrot');
    expect(s.unlockedPlants).toContain('pumpkin');
    growOn(7, 'strawberry');
    growOn(8, 'pumpkin');
    expect(s.questIndex).toBe(QUESTS.length);
  });
});

describe('guests, golden flowers and orders', () => {
  it('guests visit depending on the garden and give petals', () => {
    const s = newGame(T0);
    expect(visitingGuests(s)).toEqual([]);
    s.questIndex = 1;
    expect(visitingGuests(s)).toEqual(['ladybug', 'snail']);
    s.restored.bridge = true;
    s.restored.pond = true;
    expect(visitingGuests(s)).toContain('hedgehog');
    expect(visitingGuests(s)).toContain('frog');
    expect(meetGuest(s, 'frog', T0)).toMatchObject({ first: true, petals: 6 });
    expect(meetGuest(s, 'frog', T0)).toMatchObject({ first: false, petals: 3 });
    expect(s.guests.frog?.count).toBe(2);
    expect(s.petals).toBe(9);
  });

  it('golden seeds: never in the tutorial, random later, guaranteed by the pity rule', () => {
    const s = newGame(T0);
    s.unlockedPlants = [...PLANT_IDS];
    s.openPlots = 6;
    plantSeed(s, 0, 'daisy', T0, () => 0);
    expect(s.plots[0].golden).toBe(false); // quest 1 — no golden yet
    s.questIndex = GOLDEN_FROM_QUEST;
    s.plots[0] = emptyPlot();
    plantSeed(s, 0, 'daisy', T0, () => 0);
    expect(s.plots[0].golden).toBe(true);
    for (let i = 0; i < GOLDEN_PITY; i++) {
      s.plots[1] = emptyPlot();
      plantSeed(s, 1, 'daisy', T0, () => 0.99);
      expect(s.plots[1].golden).toBe(false);
    }
    s.plots[1] = emptyPlot();
    plantSeed(s, 1, 'daisy', T0, () => 0.99);
    expect(s.plots[1].golden).toBe(true);
    const t = growToBloom(s, 1, T0);
    const r = harvest(s, 1, t);
    expect(r).toMatchObject({ ok: true, golden: true, petals: 6, firstGolden: true });
    expect(s.golden.daisy).toBe(1);
  });

  it('orders appear later, count harvests and pay a reward', () => {
    const s = newGame(T0);
    expect(ensureOrder(s, Math.random)).toBe(false);
    s.questIndex = 4;
    s.unlockedPlants = ['daisy'];
    expect(ensureOrder(s, () => 0.99)).toBe(true);
    expect(ensureOrder(s, () => 0.99)).toBe(false);
    const o = s.order!;
    expect(o.items).toEqual([{ plant: 'daisy', need: 3, have: 0 }]);
    expect(claimOrder(s, T0, () => 0.5).ok).toBe(false);
    let t = T0;
    for (let i = 0; i < 3; i++) {
      plantSeed(s, 0, 'daisy', t);
      t = growToBloom(s, 0, t);
      harvest(s, 0, t);
    }
    expect(orderComplete(s)).toBe(true);
    const before = s.petals;
    const r = claimOrder(s, t, () => 0.5);
    expect(r).toMatchObject({ ok: true, reward: o.reward });
    expect(s.petals).toBe(before + o.reward);
    expect(s.ordersDone).toBe(1);
    expect(s.order).not.toBeNull();
  });
});

describe('Listik questions and badges', () => {
  it('a question appears after a few harvests; right answers pay more, wrong ones come back', () => {
    const s = newGame(T0);
    s.questIndex = 3;
    expect(checkQuiz(s)).toBe(false);
    s.stats.sinceQuiz = QUIZ_EVERY;
    expect(checkQuiz(s)).toBe(true);
    expect(s.quiz.pending).toBe(true);
    const q = pickQuestion(s, () => 0);
    const wrong = answerQuiz(s, q.id, q.options[1], T0);
    expect(wrong).toMatchObject({ ok: true, correct: false, petals: 1 });
    expect(s.quiz.pending).toBe(false);
    expect(s.quiz.solved).toEqual([]);
    expect(answerQuiz(s, q.id, q.options[0], T0)).toMatchObject({ correct: true, petals: 5 });
    expect(s.quiz.solved).toEqual([q.id]);
    expect(pickQuestion(s, () => 0).id).not.toBe(q.id);
  });

  it('every question has three different options', () => {
    const ids = new Set(QUESTIONS.map((q) => q.id));
    expect(ids.size).toBe(QUESTIONS.length);
    for (const q of QUESTIONS) expect(new Set(q.options).size).toBe(3);
  });

  it('badges are announced once', () => {
    const s = newGame(T0);
    expect(earned(s)).toEqual([]);
    s.stats.harvested = 1;
    expect(newBadges(s).map((b) => b.id)).toEqual(['first-harvest']);
    expect(newBadges(s)).toEqual([]);
  });
});
