// Листик читает вслух. First choice: the recorded voice (public/voice, made in advance with a
// neural speech model, see voice/README.md), played from the game's own files, so it works
// offline once downloaded. If the recording is not downloaded yet or a sentence was not
// recorded, the phone's own speech engine (Web Speech API) reads the whole text instead.
// A voice that lives on the device (localService) is preferred there, so it also works offline.

import { recordedSupported, sayRecorded, stopRecorded } from './voice-pack';

const synth = (): SpeechSynthesis | null =>
  typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined'
    ? window.speechSynthesis
    : null;

export function voiceSupported(): boolean {
  return synth() !== null || recordedSupported();
}

/** Names of the more natural voices: Apple «Enhanced/Premium», Microsoft «Natural», Android/Chrome «Google». */
const BETTER_VOICE = /enhanced|premium|улучш|natural|neural|google/i;

/** Best Russian voice: on the device first, then any Russian one. null if the list is empty or has none. */
export function pickVoice(voices: Pick<SpeechSynthesisVoice, 'lang' | 'localService' | 'default' | 'name'>[]) {
  const ru = voices.filter((v) => v.lang.replace('_', '-').toLowerCase().startsWith('ru'));
  if (!ru.length) return null;
  // On the device first (works offline, the text never leaves the phone); among those,
  // voices whose name says they are the better quality ones.
  const score = (v: (typeof ru)[number]) =>
    (v.localService ? 4 : 0) + (BETTER_VOICE.test(v.name) ? 2 : 0) + (v.default ? 1 : 0);
  return [...ru].sort((a, b) => score(b) - score(a))[0];
}

/**
 * false only when the phone has listed its voices and none of them is Russian.
 * (Some browsers list voices late, so an empty list means «don't know yet».)
 */
export function russianVoiceMissing(): boolean {
  if (recordedSupported()) return false;
  const s = synth();
  if (!s) return true;
  const list = s.getVoices();
  return list.length > 0 && pickVoice(list) === null;
}

/** Plain text for speaking: no tags, and math signs said as words. */
export function speechText(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/\s*\(ост\.\s*(\d+)\)/g, ', остаток $1')
    // Quest progress «Починить мостик (5/15 лепестков)» → «Починить мостик: 5 из 15 лепестков».
    .replace(/\s*\((\d+)\/(\d+) лепестков\)/g, ': $1 из $2 лепестков')
    .replace(/\s*×\s*/g, ' умножить на ')
    .replace(/\s*÷\s*/g, ' разделить на ')
    .replace(/(\d) : (?=\d)/g, '$1 разделить на ')
    .replace(/(\d)\s*−\s*(?=\d)/g, '$1 минус ')
    .replace(/(\d) - (?=\d)/g, '$1 минус ')
    .replace(/(\d)–(?=\d)/g, '$1 – ')
    .replace(/(\d)\s*\+\s*(?=\d)/g, '$1 плюс ')
    .replace(/\s*=\s*/g, ' равно ')
    .replace(/_/g, ' … ')
    .replace(/\s+/g, ' ')
    .trim();
}

let current: SpeechSynthesisUtterance | null = null;

/** Read the text aloud (stops anything already being read). Returns false if there is no speech engine. */
export function say(html: string, slow = false): boolean {
  const text = speechText(html);
  if (!text) return false;
  stopSpeaking();
  if (sayRecorded(text)) return true;
  const s = synth();
  if (!s) return false;
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'ru-RU';
  const v = pickVoice(s.getVoices());
  if (v) u.voice = v as SpeechSynthesisVoice;
  // Normal speed and natural pitch: slowing down and raising the pitch is what made
  // the phone voice sound robotic and drawn-out to the children (test of 14.11.2026).
  u.rate = slow ? 1 : 1.1;
  u.pitch = 1;
  current = u; // keep a reference: Safari may drop an utterance that is garbage-collected
  u.onend = () => {
    if (current === u) current = null;
  };
  s.speak(u);
  return true;
}

export function stopSpeaking() {
  stopRecorded();
  const s = synth();
  if (s && (s.speaking || s.pending)) s.cancel();
  current = null;
}
