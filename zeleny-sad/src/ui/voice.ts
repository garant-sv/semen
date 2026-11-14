/**
 * «Листик читает вслух»: the phone's own speech engine (Web Speech API), works offline on
 * iPhone and Android. Nothing is sent anywhere. Younger players (2–3 class) get it on by default.
 */

const KEY = 'green-garden/voice';
let voice: SpeechSynthesisVoice | null = null;

export const voiceSupported = () => typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;

function pickVoice() {
  if (!voiceSupported()) return;
  const all = speechSynthesis.getVoices().filter((v) => v.lang.toLowerCase().startsWith('ru'));
  // Prefer the nicer local voices (Milena on iOS/macOS, Google на Android).
  voice = all.find((v) => /milena|милена/i.test(v.name)) ?? all.find((v) => v.localService) ?? all[0] ?? null;
}
if (voiceSupported()) {
  pickVoice();
  speechSynthesis.addEventListener?.('voiceschanged', pickVoice);
}

/** null = never chosen: on for classes 2–3, off for 4–5. */
export function voiceOn(grade: number): boolean {
  let v: string | null = null;
  try {
    v = localStorage.getItem(KEY);
  } catch {
    /* ignore */
  }
  if (v === '1') return true;
  if (v === '0') return false;
  return grade <= 3;
}

export function setVoiceOn(on: boolean) {
  try {
    localStorage.setItem(KEY, on ? '1' : '0');
  } catch {
    /* ignore */
  }
  if (!on) stopSpeaking();
}

/** Turn game text into something pleasant to hear. */
export function speakable(text: string): string {
  return text
    .replace(/<[^>]+>/g, ' ')
    .replace(/[«»"“”]/g, '')
    .replace(/_/g, ' пропуск ')
    .replace(/[•·]/g, ', ')
    .replace(/(\d+)\s*\/\s*(\d+)/g, '$1 из $2')
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function speak(parts: string | string[]) {
  if (!voiceSupported()) return;
  const list = (Array.isArray(parts) ? parts : [parts]).map(speakable).filter(Boolean);
  speechSynthesis.cancel();
  for (const t of list) {
    const u = new SpeechSynthesisUtterance(t);
    u.lang = 'ru-RU';
    if (voice) u.voice = voice;
    u.rate = 0.92;
    u.pitch = 1.08;
    speechSynthesis.speak(u);
  }
}

export function stopSpeaking() {
  if (voiceSupported()) speechSynthesis.cancel();
}
