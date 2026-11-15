import { describe, expect, it } from 'vitest';
import { pickVoice, speechText } from '../../src/ui/voice';
import { newGame, voiceOn } from '../../src/game/state';

const v = (name: string, lang: string, localService: boolean, isDefault = false) => ({ name, lang, localService, default: isDefault });

describe('0.8: Listik reads aloud', () => {
  it('prefers a Russian voice that lives on the phone (works offline)', () => {
    expect(pickVoice([v('Samantha', 'en-US', true, true), v('Online RU', 'ru-RU', false), v('Milena', 'ru-RU', true)])?.name).toBe('Milena');
    expect(pickVoice([v('Online RU', 'ru_RU', false)])?.name).toBe('Online RU');
    expect(pickVoice([v('Samantha', 'en-US', true)])).toBeNull();
    expect(pickVoice([])).toBeNull();
  });

  it('among the voices on the phone, takes the more natural one', () => {
    expect(pickVoice([v('Milena', 'ru-RU', true, true), v('Milena (Enhanced)', 'ru-RU', true)])?.name).toBe('Milena (Enhanced)');
    expect(pickVoice([v('Google русский', 'ru-RU', false), v('Milena', 'ru-RU', true)])?.name).toBe('Milena');
  });

  it('speaks plain text: no tags, math signs as words, ranges untouched', () => {
    expect(speechText('<b>Верно!</b> 7 × 8 = 56')).toBe('Верно! 7 умножить на 8 равно 56');
    expect(speechText('Решение: 100 − 35 = 65')).toBe('Решение: 100 минус 35 равно 65');
    expect(speechText('24 : 6 = 4, а в 10:30 обед')).toBe('24 разделить на 6 равно 4, а в 10:30 обед');
    expect(speechText('Гости просят 1–3 цветка')).toBe('Гости просят 1 – 3 цветка');
    expect(speechText('мол_ко &amp; &quot;сад&quot;')).toBe('мол … ко & "сад"');
  });

  it('is on by class (2–3) unless switched in the Menu', () => {
    const s = newGame(0);
    expect(voiceOn(s)).toBe(false);
    s.profile.grade = 3;
    expect(voiceOn(s)).toBe(true);
    s.settings.voice = false;
    expect(voiceOn(s)).toBe(false);
    s.profile.grade = 5;
    s.settings.voice = true;
    expect(voiceOn(s)).toBe(true);
  });
});
