// Листик читает вслух. First choice: the recorded voice (public/voice, made in advance with a
// neural speech model, see voice/README.md), played from the game's own files, so it works
// offline once downloaded. If the recording is not downloaded yet or a sentence was not
// recorded, the phone's own speech engine (Web Speech API) reads the whole text instead.
// A voice that lives on the device (localService) is preferred there, so it also works offline.

import {
  loadVoicePack,
  onRecordedIdle,
  primeAudio,
  recordedBusy,
  recordedState,
  recordedSupported,
  sayRecorded,
  stopRecorded,
} from './voice-pack';

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

/**
 * The phone's own voice reads signs aloud by their names («стрелка», «слэш»): before it reads,
 * signs are turned into words or pauses, and anything else that is not text is dropped.
 */
export function forPhoneVoice(text: string): string {
  return text
    .replace(/\u0301/g, '') // stress marks: во́ды
    .replace(/(\d)\s*м²/g, '$1 кв. м')
    .replace(/²/g, '')
    .replace(/\s*→\s*/g, ', ')
    .replace(/\bII спряжение/g, 'второе спряжение')
    .replace(/\bI спряжение/g, 'первое спряжение')
    .replace(/\s+\+\s+/g, ' плюс ')
    .replace(/[^\p{L}\p{N}\s.,!?:;«»"()—–…-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

let current: SpeechSynthesisUtterance | null = null;
/** A text waiting for the recorded voice to finish downloading. */
let waiting: { text: string; gen: number; slow: boolean } | null = null;
let waitGen = 0;
let idleListener: (() => void) | null = null;

/** Called whenever Listik falls silent (finished, stopped, or switched to another text). */
export function onVoiceIdle(cb: (() => void) | null) {
  idleListener = cb;
  onRecordedIdle(cb);
}

/** True while Listik is reading something (or waiting for his recorded voice to arrive). */
export function isSpeaking(): boolean {
  const s = synth();
  return waiting !== null || recordedBusy() || current !== null || Boolean(s && (s.speaking || s.pending));
}

/** How long a tap waits for the recorded voice to download before the phone's voice reads instead. */
const WAIT_FOR_RECORDING_MS = 25_000;

/**
 * Read the text aloud (stops anything already being read). Returns false if there is nothing to read with.
 * The recorded voice is used whenever it has the whole text. If it is still downloading, we wait for it
 * (up to 25 s) instead of switching to the phone's robotic voice; the phone's voice only reads texts
 * that were never recorded (big numbers of the 4–5 class fair) or when the recording cannot be loaded.
 */
export function say(html: string, slow = false): boolean {
  const text = speechText(html);
  if (!text) return false;
  stopSpeaking(false);
  const fallback = () => {
    if (!saySynth(text, slow)) idleListener?.();
  };
  if (sayRecorded(text, fallback)) return true;
  if (recordedState(text) === 'wait') {
    primeAudio(); // inside the tap, so the sound may start later
    const gen = ++waitGen;
    waiting = { text, gen, slow };
    const timer = window.setTimeout(() => finishWaiting(gen, false), WAIT_FOR_RECORDING_MS);
    void loadVoicePack().then((ok) => {
      window.clearTimeout(timer);
      finishWaiting(gen, ok);
    });
    return true;
  }
  return saySynth(text, slow);
}

function finishWaiting(gen: number, loaded: boolean) {
  if (!waiting || waiting.gen !== gen) return; // stopped or replaced meanwhile
  const { text, slow } = waiting;
  waiting = null;
  if (loaded && sayRecorded(text, () => { if (!saySynth(text, slow)) idleListener?.(); })) return;
  if (!saySynth(text, slow)) idleListener?.();
}

function saySynth(text: string, slow: boolean): boolean {
  const s = synth();
  if (!s) return false;
  const u = new SpeechSynthesisUtterance(forPhoneVoice(text));
  u.lang = 'ru-RU';
  const v = pickVoice(s.getVoices());
  if (v) u.voice = v as SpeechSynthesisVoice;
  // Normal speed and natural pitch: slowing down and raising the pitch is what made
  // the phone voice sound robotic and drawn-out to the children (test of 14.11.2026).
  u.rate = slow ? 1 : 1.1;
  u.pitch = 1;
  current = u; // keep a reference: Safari may drop an utterance that is garbage-collected
  const done = () => {
    if (current !== u) return;
    current = null;
    idleListener?.();
  };
  u.onend = done;
  u.onerror = done;
  s.speak(u);
  return true;
}

/** Stop reading. `notify` tells the buttons that Listik is quiet now. */
export function stopSpeaking(notify = true) {
  waiting = null;
  waitGen++;
  stopRecorded();
  const s = synth();
  if (s && (s.speaking || s.pending)) s.cancel();
  current = null;
  if (notify) idleListener?.();
}
