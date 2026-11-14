// Листик читает вслух: the phone's own speech engine (Web Speech API), no internet and no
// third-party services. A voice that lives on the device (localService) is preferred,
// so it keeps working offline; iPhone and most Android phones have a Russian one built in.

const synth = (): SpeechSynthesis | null =>
  typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined'
    ? window.speechSynthesis
    : null;

export function voiceSupported(): boolean {
  return synth() !== null;
}

/** Best Russian voice: on the device first, then any Russian one. null if the list is empty or has none. */
export function pickVoice(voices: Pick<SpeechSynthesisVoice, 'lang' | 'localService' | 'default' | 'name'>[]) {
  const ru = voices.filter((v) => v.lang.replace('_', '-').toLowerCase().startsWith('ru'));
  if (!ru.length) return null;
  const score = (v: (typeof ru)[number]) => (v.localService ? 2 : 0) + (v.default ? 1 : 0);
  return [...ru].sort((a, b) => score(b) - score(a))[0];
}

/**
 * false only when the phone has listed its voices and none of them is Russian.
 * (Some browsers list voices late, so an empty list means «don't know yet».)
 */
export function russianVoiceMissing(): boolean {
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
  const s = synth();
  if (!s) return false;
  const text = speechText(html);
  if (!text) return false;
  s.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'ru-RU';
  const v = pickVoice(s.getVoices());
  if (v) u.voice = v as SpeechSynthesisVoice;
  u.rate = slow ? 0.85 : 0.95;
  u.pitch = 1.1;
  current = u; // keep a reference: Safari may drop an utterance that is garbage-collected
  u.onend = () => {
    if (current === u) current = null;
  };
  s.speak(u);
  return true;
}

export function stopSpeaking() {
  const s = synth();
  if (s && (s.speaking || s.pending)) s.cancel();
  current = null;
}
