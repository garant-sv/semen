import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { GUESTS, GUEST_IDS, LISTIK_TIPS, PLANTS, PLANT_IDS, QUESTS } from '../../src/game/data';
import { KINDS_BY_GRADE, LEVELS_BY_GRADE, makeProblem } from '../../src/game/math';
import { QUESTIONS } from '../../src/game/quiz';
import { WORDS, viewWord } from '../../src/game/russian';
import { forPhoneVoice, speechText } from '../../src/ui/voice';
import { recordedParts, type VoiceIndex } from '../../src/ui/voice-pack';
import { pieceKey, speechPieces } from '../../src/ui/voice-units';

const index = JSON.parse(readFileSync(join(__dirname, '../../public/voice/voice.json'), 'utf8')) as VoiceIndex;
const missing = (html: string) => speechPieces(speechText(html)).filter((p) => !index.clips[pieceKey(p.text)]).map((p) => p.text);

describe('0.8: Listik’s recorded voice', () => {
  it('cuts a fair problem at natural breaks, keeps plain sentences whole', () => {
    expect(speechPieces(speechText('Ёжик: «Мне, пожалуйста, 3 морковки по 5 лепестков за штуку. Сколько с меня?»')).map((p) => p.text)).toEqual([
      'Ёжик:',
      'Мне, пожалуйста, 3 морковки',
      'по 5 лепестков за штуку.',
      'Сколько с меня?',
    ]);
    expect(speechPieces(speechText('Верно! Решение: 5 × 3 = 15; 20 − 15 = 5')).map((p) => p.text)).toEqual([
      'Верно!',
      'Решение:',
      '5',
      'умножить на 3',
      'равно 15;',
      '20',
      'минус 15',
      'равно 5',
    ]);
    expect(speechPieces(speechText('Решение: 23 : 4 = 5 (ост. 3)')).map((p) => p.text)).toEqual(['Решение:', '23', 'разделить на 4', 'равно 5', 'остаток 3']);
    const plain = speechPieces('Тайга — хвойные леса, они тянутся через всю страну. Ура!');
    expect(plain.map((p) => p.text)).toEqual(['Тайга — хвойные леса, они тянутся через всю страну.', 'Ура!']);
    expect(plain[0].pause).toBe(0);
    expect(plain[1].pause).toBeGreaterThan(200);
    expect(pieceKey('Ёжик  Пришёл.')).toBe('ежик пришел.');
  });

  it('has every quest, tip, question, sign and fact recorded', () => {
    const texts = [
      'Привет! Теперь я буду читать тебе вслух. Нажми на кнопку с динамиком, чтобы послушать ещё раз.',
      ...QUESTS.map((q) => `${q.title}. ${q.text}`),
      ...LISTIK_TIPS.map((t) => `Сад проснулся! ${t}`),
      ...QUESTIONS.flatMap((q) => [`${q.text} ${q.options.join('? ')}?`, `Верно! ${q.explain}`, `Почти! Правильный ответ: ${q.options[0]}. ${q.explain}`]),
      ...WORDS.map((w) => `Верно! ${viewWord(w).full}. ${w.why}`),
      ...GUEST_IDS.map((id) => GUESTS[id].fact),
      ...PLANT_IDS.map((id) => PLANTS[id].fact),
    ];
    expect(texts.flatMap(missing)).toEqual([]);
  });

  it('has every fair problem of the 2nd and 3rd class recorded', () => {
    let seed = 7;
    const rand = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };
    const gaps = new Set<string>();
    for (const grade of [2, 3]) {
      const [lo, hi] = LEVELS_BY_GRADE[grade];
      for (let level = lo; level <= hi; level++)
        for (const kind of KINDS_BY_GRADE[grade])
          for (let i = 0; i < 300; i++) {
            const p = makeProblem(level, rand, GUESTS[GUEST_IDS[i % GUEST_IDS.length]].name, kind, grade);
            for (const t of [p.text, `Подсказка: ${p.hint}`, `Не совсем. Подсказка: ${p.hint}`, `Правильный ответ: ${p.answerText}. Решение: ${p.solution}`, `Верно! Решение: ${p.solution}`])
              for (const m of missing(t)) gaps.add(m);
          }
    }
    expect([...gaps]).toEqual([]);
  });

  it('has every fair problem of the 4th and 5th class, said from recorded chunks', () => {
    let seed = 11;
    const rand = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };
    const gaps = new Set<string>();
    for (const grade of [4, 5]) {
      const [lo, hi] = LEVELS_BY_GRADE[grade];
      for (let level = lo; level <= hi; level++)
        for (const kind of KINDS_BY_GRADE[grade])
          for (let i = 0; i < 300; i++) {
            const p = makeProblem(level, rand, GUESTS[GUEST_IDS[i % GUEST_IDS.length]].name, kind, grade);
            for (const t of [p.text, `Подсказка: ${p.hint}`, `Не совсем. Подсказка: ${p.hint}`, `Правильный ответ: ${p.answerText}. Решение: ${p.solution}`, `Верно! Решение: ${p.solution}`])
              if (!recordedParts(speechText(t), index)) gaps.add(t);
          }
    }
    expect([...gaps].slice(0, 10)).toEqual([]);
    // A big number is said in parts, one right after the other.
    const parts = recordedParts('равно 2345', index)!;
    expect(parts.length).toBeGreaterThan(2);
    expect(parts.slice(1).every((x) => x.pause < 50)).toBe(true);
  });

  it('the phone voice gets no signs to read out by name', () => {
    expect(forPhoneVoice('Тундра → тайга → степь? Проверочное слово: во́ды. 24 м² \\ / *')).toBe('Тундра, тайга, степь? Проверочное слово: воды. 24 кв. м');
    expect(forPhoneVoice('Писать — I спряжение')).toBe('Писать — первое спряжение');
  });

  it('points at packs that are in the build', () => {
    expect(index.packs).toHaveLength(2);
    const sizes = index.packs.map((name) => {
      expect(name).toMatch(/^pack-[0-9a-f]{12}\.txt$/);
      return readFileSync(join(__dirname, '../../public/voice', name)).length;
    });
    for (const [k, off, len] of [...Object.values(index.clips), ...(index.chunks ?? [])]) expect(off + len).toBeLessThanOrEqual(sizes[k]);
  });
});
