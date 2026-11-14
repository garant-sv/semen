import { describe, expect, it } from 'vitest';
import { QUESTIONS, questionGrades } from '../../src/game/quiz';
import { WORDS, wordsForGrade } from '../../src/game/russian';
import { fairLevel, makeProblem } from '../../src/game/math';
import { cleanNick, gradeOf, newGame, pickQuestion, pickWord, setProfile } from '../../src/game/state';
import { parseSave } from '../../src/game/save';

const seq = (_n: number) => {
  let i = 0;
  return () => ((i++ * 0.6180339) % 1);
};

describe('profile and grades', () => {
  it('a new game has no profile and defaults to grade 4', () => {
    const s = newGame(0);
    expect(s.profile).toEqual({ nick: '', grade: null });
    expect(gradeOf(s)).toBe(4);
  });

  it('nicknames are cleaned', () => {
    expect(cleanNick('  Сёма <script> ')).toBe('Сёма script');
    expect(cleanNick('a'.repeat(40))).toHaveLength(16);
    expect(cleanNick('Аня-2')).toBe('Аня-2');
  });

  it('every grade 2–5 has questions and words', () => {
    for (const g of [2, 3, 4, 5] as const) {
      expect(QUESTIONS.filter((q) => questionGrades(q).includes(g)).length).toBeGreaterThanOrEqual(8);
      expect(wordsForGrade(g).length).toBeGreaterThanOrEqual(20);
    }
    expect(wordsForGrade(5)).toHaveLength(WORDS.length);
  });

  it('questions and words follow the chosen class', () => {
    const s = newGame(0);
    setProfile(s, 'Тест', 2, 1);
    const r = seq(0);
    for (let i = 0; i < 40; i++) {
      expect(questionGrades(pickQuestion(s, r))).toContain(2);
      const id = pickWord(s, r);
      expect(wordsForGrade(2).some((w) => w.id === id)).toBe(true);
    }
  });

  it('fair problems for grade 2 stay small; grade 5 starts harder', () => {
    expect(fairLevel(0, 2)).toBe(1);
    expect(fairLevel(999, 2)).toBe(1);
    expect(fairLevel(0, 5)).toBe(3);
    const r = seq(0);
    for (let i = 0; i < 200; i++) {
      const p = makeProblem(fairLevel(i, 2), r, 'Ёжик', undefined, 2);
      expect(p.answer).toBeGreaterThanOrEqual(0);
      expect(p.answer).toBeLessThanOrEqual(100);
      expect(Number.isInteger(p.answer)).toBe(true);
    }
  });

  it('v7 saves migrate to v8 with an empty profile; bad profiles are cleaned', () => {
    const v7 = { ...newGame(0), version: 7 } as Record<string, unknown>;
    delete v7.profile;
    expect(parseSave(JSON.stringify(v7), 1).state.profile).toEqual({ nick: '', grade: null });
    const bad = { ...newGame(0), profile: { nick: '<img>Петя', grade: 9 } };
    expect(parseSave(JSON.stringify(bad), 1).state.profile).toEqual({ nick: 'imgПетя', grade: null });
  });
});
