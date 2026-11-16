import { describe, expect, it } from 'vitest';
import { parseSave } from '../../src/game/save';
import {
  START_SEEDS,
  START_SEED_PETALS,
  collectStartSeed,
  seedLeft,
  seedsLeft,
  gardenerByDefault,
  newGame,
  randomGardener,
  setGardener,
  setProfile,
  type Gardener,
} from '../../src/game/state';
import { PLOTS, START_SEED_SPOTS, gardenerSpotNear, walkable } from '../../src/ui/scene';

const T0 = 1_700_000_000_000;
const look: Gardener = { skin: 1, hat: 'cap', outfit: 2, pet: 'frog' };

describe('gardener (3–5 class)', () => {
  it('comes by default from the 3rd class; the 2nd class keeps Listik leading', () => {
    const s = newGame(T0);
    expect(gardenerByDefault(s)).toBe(false);
    setProfile(s, '', 2, T0);
    expect(gardenerByDefault(s)).toBe(false);
    for (const g of [3, 4, 5] as const) {
      setProfile(s, '', g, T0);
      expect(gardenerByDefault(s)).toBe(true);
    }
  });

  it('on a fresh garden the wind scatters seeds: something to do in the first minute', () => {
    const s = newGame(T0);
    expect(setGardener(s, look, T0)).toEqual({ scattered: true });
    expect(seedsLeft(s)).toBe(START_SEEDS);
    // Any order; the same seed only once.
    expect(collectStartSeed(s, 2, T0)).toMatchObject({ ok: true, petals: START_SEED_PETALS, left: 2 });
    expect(collectStartSeed(s, 2, T0).ok).toBe(false);
    expect(seedLeft(s, 0) && seedLeft(s, 1) && !seedLeft(s, 2)).toBe(true);
    expect(collectStartSeed(s, 0, T0)).toMatchObject({ ok: true, left: 1 });
    expect(collectStartSeed(s, 1, T0)).toMatchObject({ ok: true, left: 0 });
    expect(s.petals).toBe(START_SEEDS * START_SEED_PETALS);
    // Changing the look later does not scatter them again.
    expect(setGardener(s, { ...look, hat: 'straw' }, T0)).toEqual({ scattered: false });
    expect(s.startSeeds).toBe(0);
    expect(s.gardener?.hat).toBe('straw');
  });

  it('a garden already in progress gets the gardener without the seed event', () => {
    const s = newGame(T0);
    s.questIndex = 4;
    expect(setGardener(s, look, T0)).toEqual({ scattered: false });
    expect(s.startSeeds).toBe(0);
  });

  it('random look is always a valid one', () => {
    for (const r of [0, 0.3, 0.5, 0.99999]) {
      const g = randomGardener(() => r);
      expect(parseSave(JSON.stringify({ ...newGame(T0), gardener: g }), T0).state.gardener).toEqual(g);
    }
  });

  it('is saved, repaired if broken, and old saves (v8) get none', () => {
    const s = newGame(T0);
    setGardener(s, look, T0);
    const back = parseSave(JSON.stringify(s), T0).state;
    expect(back.gardener).toEqual(look);
    expect(seedsLeft(back)).toBe(START_SEEDS);

    const broken = parseSave(JSON.stringify({ ...s, gardener: { skin: 99, hat: 'crown', outfit: -3, pet: 'dragon' }, startSeeds: 50 }), T0).state;
    expect(broken.gardener).toEqual({ skin: 2, hat: 'straw', outfit: 0, pet: 'hedgehog' });
    expect(seedsLeft(broken)).toBe(START_SEEDS);

    const v8 = { ...newGame(T0), version: 8 } as Record<string, unknown>;
    delete v8.gardener;
    delete v8.startSeeds;
    const { state, migratedFrom } = parseSave(JSON.stringify(v8), T0);
    expect(migratedFrom).toBe(8);
    expect(state.gardener).toBeNull();
    expect(state.startSeeds).toBe(0);
  });

  it('stands on grass beside each bed, and the seeds lie on grass', () => {
    for (const p of PLOTS) expect(walkable(gardenerSpotNear(p).x, gardenerSpotNear(p).y)).toBe(true);
    for (const p of START_SEED_SPOTS) expect(walkable(p.x, p.y)).toBe(true);
  });
});
