import { describe, expect, it } from 'vitest';
import { QUESTIONS } from '../../src/game/quiz';
import { makeProblem } from '../../src/game/math';
import { newGame, nextTap, plantSeed, water } from '../../src/game/state';

describe('0.8: tasks with pictures and the hint finger', () => {
  it('picture options are only on questions for 2–3 class, one picture per option', () => {
    const withPics = QUESTIONS.filter((q) => q.pics);
    expect(withPics.length).toBeGreaterThanOrEqual(5);
    for (const q of withPics) {
      expect(q.grades?.some((g) => g <= 3)).toBe(true);
      expect(q.pics).toHaveLength(3);
      expect(new Set(q.pics).size).toBe(3);
    }
  });

  it('2nd-grade fair problems about buying or a bed come with a matching picture', () => {
    let seen = 0;
    for (let k = 0; k < 200; k++) {
      let x = k + 1;
      const rand = () => ((x = (x * 16807) % 2147483647) - 1) / 2147483646;
      const p = makeProblem(1, rand, 'Ёжик', undefined, 2);
      if (!p.pic) continue;
      seen += 1;
      if (p.pic.kind === 'goods' && p.kind === 'cost') expect(p.pic.count * p.pic.price).toBe(p.answer);
      if (p.pic.kind === 'bed' && p.kind === 'perimeter') expect(2 * (p.pic.a + p.pic.b)).toBe(p.answer);
    }
    expect(seen).toBeGreaterThan(0);
  });

  it('the finger points to a ripe plant, then a thirsty one, then an empty bed', () => {
    const s = newGame(0);
    expect(nextTap(s, 0, 'garden')).toBe(0); // empty bed, nothing growing
    plantSeed(s, 1, 'daisy', 0);
    expect(nextTap(s, 0, 'garden')).toBe(1); // needs water
    water(s, 1, 0);
    expect(nextTap(s, 1000, 'garden')).toBeNull(); // growing: wait
    expect(nextTap(s, 10 * 60_000, 'garden')).toBe(1); // stage done: tap again
  });
});
