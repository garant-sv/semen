import { describe, expect, it } from 'vitest';
import { FAIR_EVERY_SEC, FAIR_QUEUE, KINDS_BY_LEVEL, LEVELS_BY_GRADE, fairLevel, makeProblem, plural, type MathKind } from '../../src/game/math';
import { advanceFair, newGame, nextCustomerIn, serveCustomer } from '../../src/game/state';
import { parseSave } from '../../src/game/save';

const T0 = 1_700_000_000_000;

function seeded(seed: number) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
}

/** Evaluate the last number in the worked solution — it must be the answer. */
const lastNumber = (s: string) => Number(s.match(/(\d+)(?!.*\d)/)?.[1]);

describe('math problems', () => {
  const ALL: MathKind[] = ['cost', 'change', 'canBuy', 'share', 'area', 'perimeter', 'bushes', 'minutes', 'fraction', 'distance'];

  it('every kind gives a positive whole answer that its solution arrives at', () => {
    const rand = seeded(42);
    for (const level of [1, 2, 3, 4]) {
      for (const kind of ALL) {
        for (let i = 0; i < 200; i++) {
          const p = makeProblem(level, rand, 'Ёжик', kind);
          expect(Number.isInteger(p.answer)).toBe(true);
          expect(p.answer).toBeGreaterThan(0);
          expect(p.text.startsWith('Ёжик: «')).toBe(true);
          expect(p.hint.length).toBeGreaterThan(10);
          expect(lastNumber(p.solution.replace(/\(ост\. \d+\)/, ''))).toBe(p.answer);
        }
      }
    }
  });

  it('change is never negative, purchases fit the money and division leaves a remainder smaller than the price', () => {
    const rand = seeded(7);
    for (let i = 0; i < 500; i++) {
      const level = 1 + (i % 4);
      const ch = makeProblem(level, rand, 'Пчела', 'change');
      const [cost, paid] = [Number(ch.solution.match(/= (\d+);/)![1]), Number(ch.solution.match(/; (\d+) −/)![1])];
      expect(paid - cost).toBe(ch.answer);
      expect(paid).toBeGreaterThan(cost);
      const cb = makeProblem(level, rand, 'Пчела', 'canBuy');
      const m = cb.solution.match(/^(\d+) : (\d+) = (\d+)(?: \(ост\. (\d+)\))?$/)!;
      const [money, price, n, rest] = [Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4] ?? 0)];
      expect(n * price + rest).toBe(money);
      expect(rest).toBeLessThan(price);
    }
  });

  it('numbers suit mental arithmetic by the programme (ФРП): long multiplication and division stay out', () => {
    const rand = seeded(5);
    const ALL_KINDS: MathKind[] = ['cost', 'change', 'canBuy', 'share', 'area', 'perimeter', 'bushes', 'minutes', 'fraction', 'distance'];
    for (const grade of [3, 4, 5]) {
      const [lo, hi] = LEVELS_BY_GRADE[grade];
      for (let level = lo; level <= hi; level++)
        for (const kind of ALL_KINDS)
          for (let i = 0; i < 300; i++) {
            const p = makeProblem(level, rand, 'X', kind, grade);
            for (const [, a, b, c] of p.solution.matchAll(/(\d+) × (\d+) = (\d+)/g)) {
              const [x, y] = [Number(a), Number(b)].sort((u, v) => u - v);
              // A digit times a number within 100, or a digit times round tens or hundreds.
              expect(x, p.solution).toBeLessThanOrEqual(9);
              expect(Number(c) <= 100 || y % 10 === 0, p.solution).toBe(true);
            }
            for (const [, a, b] of p.solution.matchAll(/(\d+) : (\d+)/g)) {
              const [x, y] = [Number(a), Number(b)];
              // By a digit within 100 or with round numbers; by a two-digit number only round ones (250 : 30).
              if (y >= 10) expect(x % 10 === 0 && y % 10 === 0, p.solution).toBe(true);
              else expect(x <= 100 || x % 10 === 0, p.solution).toBe(true);
            }
            if (grade === 3 && kind !== 'minutes') expect(p.answer, p.solution).toBeLessThanOrEqual(100);
          }
    }
  });

  it('numbers grow with the level', () => {
    const avg = (level: number) => {
      const rand = seeded(level * 11);
      let sum = 0;
      for (let i = 0; i < 300; i++) sum += makeProblem(level, rand, 'X', 'cost').answer;
      return sum / 300;
    };
    expect(avg(1)).toBeLessThan(avg(2));
    expect(avg(2)).toBeLessThan(avg(3));
    expect(avg(3)).toBeLessThan(avg(4));
    expect(KINDS_BY_LEVEL[1]).not.toContain('bushes');
    expect(fairLevel(0)).toBe(1);
    expect(fairLevel(6)).toBe(2);
    expect(fairLevel(100)).toBe(4);
  });

  it('Russian plural forms and «по N лепестку»', () => {
    const f: [string, string, string] = ['морковку', 'морковки', 'морковок'];
    expect([1, 2, 5, 11, 12, 21, 22, 25, 111].map((n) => plural(n, f))).toEqual([
      'морковку', 'морковки', 'морковок', 'морковок', 'морковок', 'морковку', 'морковки', 'морковок', 'морковок',
    ]);
    const rand = seeded(3);
    for (let i = 0; i < 400; i++) {
      const p = makeProblem(4, rand, 'X', 'cost');
      const price = Number(p.solution.split(' × ')[0]);
      if (price % 10 === 1 && price % 100 !== 11) expect(p.text).toContain(`по ${price} лепестку`);
    }
  });
});

describe('fair queue', () => {
  it('opens after the first quests, brings a customer every few minutes and keeps at most three', () => {
    const s = newGame(T0);
    expect(advanceFair(s, T0)).toBe(false);
    s.questIndex = 3;
    expect(advanceFair(s, T0)).toBe(true);
    expect(s.fair.queue).toBe(1);
    const step = FAIR_EVERY_SEC * 1000;
    advanceFair(s, T0 + step + 1);
    expect(s.fair.queue).toBe(2);
    expect(nextCustomerIn(s, T0 + step + 1)).toBe(step - 1);
    advanceFair(s, T0 + 50 * step);
    expect(s.fair.queue).toBe(FAIR_QUEUE);
    expect(serveCustomer(s, 'first', T0 + 50 * step)).toMatchObject({ ok: true, petals: 4, level: 1 });
    expect(serveCustomer(s, 'second', T0 + 50 * step)).toMatchObject({ petals: 2 });
    expect(serveCustomer(s, 'failed', T0 + 50 * step)).toMatchObject({ petals: 1 });
    expect(serveCustomer(s, 'first', T0 + 50 * step).ok).toBe(false);
    expect(s.fair).toMatchObject({ queue: 0, solved: 2, firstTry: 1 });
    expect(s.petals).toBe(7);
    // The device clock went back: nothing breaks, no customers appear from nowhere.
    advanceFair(s, T0);
    expect(s.fair.queue).toBe(0);
  });

  it('old saves get a closed fair', () => {
    const v5 = { ...newGame(T0), version: 5 } as Record<string, unknown>;
    delete v5.fair;
    const { state } = parseSave(JSON.stringify(v5), T0);
    expect(state.fair).toEqual({ queue: 0, lastAt: 0, solved: 0, firstTry: 0 });
  });
});
