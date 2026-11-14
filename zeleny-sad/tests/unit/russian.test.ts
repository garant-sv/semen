import { describe, expect, it } from 'vitest';
import { NO_LETTER, RULES, WORDS, viewWord } from '../../src/game/russian';
import { answerSign, newGame, pickWord, plantSeed } from '../../src/game/state';
import { parseSave } from '../../src/game/save';

const T0 = 1_700_000_000_000;

describe('word bank', () => {
  it('every word has one gap, a correct option among distinct options and a known rule', () => {
    const ids = new Set<string>();
    for (const w of WORDS) {
      expect(ids.has(w.id)).toBe(false);
      ids.add(w.id);
      const v = viewWord(w);
      expect(v.masked.split('_').length - 1).toBe(1);
      expect(v.full).not.toMatch(/[_[\]]/);
      expect(w.options).toContain(v.answer);
      expect(new Set(w.options).size).toBe(w.options.length);
      expect(w.options.length).toBeGreaterThanOrEqual(2);
      expect(RULES[w.rule]).toBeTruthy();
      expect(w.why.length).toBeGreaterThan(10);
    }
    expect(WORDS.length).toBeGreaterThanOrEqual(80);
  });

  it('shows words as expected', () => {
    const v = (id: string) => viewWord(WORDS.find((w) => w.id === id)!);
    expect(v('morkov')).toEqual({ masked: 'м_рковь', full: 'морковь', answer: 'о' });
    expect(v('myach')).toEqual({ masked: 'мяч_', full: 'мяч', answer: NO_LETTER });
    expect(v('prazdnik')).toEqual({ masked: 'праз_ник', full: 'праздник', answer: 'д' });
    expect(v('berech')).toEqual({ masked: 'береч_', full: 'беречь', answer: 'ь' });
    expect(v('stroit').full).toBe('Листик строит домик');
  });
});

describe('signs at the beds', () => {
  it('appear on planting from quest 5, are filled in once and remembered when right', () => {
    const s = newGame(T0);
    s.unlockedPlants = ['daisy', 'sunflower'];
    plantSeed(s, 0, 'daisy', T0, () => 0.5);
    expect(s.plots[0].sign).toBeNull(); // too early in the story
    s.questIndex = 4;
    plantSeed(s, 1, 'daisy', T0, () => 0);
    plantSeed(s, 2, 'sunflower', T0, () => 0);
    const [a, b] = [s.plots[1].sign!, s.plots[2].sign!];
    expect(a.id).not.toBe(b.id); // two signs never show the same word
    const wa = WORDS.find((w) => w.id === a.id)!;
    expect(answerSign(s, 1, viewWord(wa).answer, T0)).toMatchObject({ ok: true, correct: true, petals: 3 });
    expect(answerSign(s, 1, viewWord(wa).answer, T0).ok).toBe(false); // already filled in
    const wb = WORDS.find((w) => w.id === b.id)!;
    const wrong = wb.options.find((o) => o !== viewWord(wb).answer)!;
    expect(answerSign(s, 2, wrong, T0)).toMatchObject({ correct: false, petals: 1 });
    expect(s.rus).toEqual({ learned: [a.id], correct: 1, total: 2 });
    // Learned words are not offered again while others remain.
    expect(pickWord(s, () => 0)).not.toBe(a.id);
  });

  it('old saves get an empty word list and beds without signs; broken signs are dropped', () => {
    const v6 = { ...newGame(T0), version: 6 } as Record<string, unknown>;
    delete v6.rus;
    (v6.plots as Record<string, unknown>[])[0] = { plant: 'daisy', stage: 1, wateredAt: null, plantedAt: T0, golden: false };
    (v6.plots as Record<string, unknown>[])[1] = { plant: 'daisy', stage: 1, wateredAt: null, plantedAt: T0, golden: false, sign: { id: 'no-such-word', solved: false } };
    const { state } = parseSave(JSON.stringify(v6), T0);
    expect(state.rus).toEqual({ learned: [], correct: 0, total: 0 });
    expect(state.plots[0].sign).toBeNull();
    expect(state.plots[1].sign).toBeNull();
  });
});
