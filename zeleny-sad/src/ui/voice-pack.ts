// The recorded voice: two MP3 files with every piece Listik says (public/voice/pack-*.txt: MP3 data,
// named .txt because the server's self-update only takes known web file types) and
// an index of where each piece lies in them (public/voice/voice.json). The first file holds the
// sentences without numbers (quests, questions, signs), the second the pieces with numbers (the fair). Pieces are cut out of the
// file, decoded and played back to back with Web Audio, with short pauses between them.
// The file is downloaded once in the background and then lives in the service worker's cache,
// so the voice works offline. Nothing is sent anywhere.

import { pieceKey, speechPieces } from './voice-units';

interface VoiceIndex {
  /** File names of the packs, next to voice.json. */
  packs: string[];
  /** Piece key → [pack number, byte offset, byte length]. */
  clips: Record<string, [number, number, number]>;
}

type AC = typeof AudioContext;

let index: VoiceIndex | null = null;
/** Downloaded packs (null until downloaded). */
let packs: (ArrayBuffer | null)[] = [];
let loading: Promise<boolean> | null = null;
let ctx: AudioContext | null = null;
/** Bumped on every new text and on stop: playback of an older text stops scheduling itself. */
let generation = 0;
let playing: AudioBufferSourceNode[] = [];
/** Generation whose pieces are still being decoded (not yet scheduled), or -1. */
let decoding = -1;
/** Called when the recorded voice falls silent (finished or stopped). */
let onIdle: (() => void) | null = null;
export function onRecordedIdle(cb: (() => void) | null) {
  onIdle = cb;
}

/** True while a recorded text is being prepared or played. */
export function recordedBusy(): boolean {
  return decoding === generation || playing.length > 0;
}

/**
 * Whether the recorded voice can read this text once it is downloaded:
 * 'ready' (can play now), 'wait' (still downloading, or the list of pieces is not here yet),
 * 'no' (some piece was not recorded, or this phone cannot play it).
 */
export function recordedState(text: string): 'ready' | 'wait' | 'no' {
  if (!audioClass()) return 'no';
  const pieces = speechPieces(text);
  if (!pieces.length) return 'no';
  if (!index) return 'wait';
  const spans = pieces.map((p) => index!.clips[pieceKey(p.text)]);
  if (spans.some((sp) => !sp)) return 'no';
  return spans.every((sp) => packs[sp[0]]) ? 'ready' : 'wait';
}

/** Wake the audio output inside a tap (phones only allow sound the player started). */
export function primeAudio() {
  context();
}

const audioClass = (): AC | null =>
  typeof window === 'undefined'
    ? null
    : (window.AudioContext ?? (window as unknown as { webkitAudioContext?: AC }).webkitAudioContext ?? null);

/** True once the recorded voice (at least its first part) is downloaded and can be played. */
export function recordedSupported(): boolean {
  return index !== null && packs[0] != null && audioClass() !== null;
}

const complete = () => index !== null && packs.length === index.packs.length && packs.every((p) => p !== null);

/**
 * Download the recorded voice (once). Resolves true when it is ready.
 * Safe to call many times; failures (offline on the first start) are retried on the next call.
 */
export function loadVoicePack(base = 'voice/'): Promise<boolean> {
  if (complete()) return Promise.resolve(true);
  if (loading) return loading;
  if (!audioClass() || typeof fetch === 'undefined') return Promise.resolve(false);
  loading = (async () => {
    try {
      if (!index) {
        const res = await fetch(`${base}voice.json`);
        if (!res.ok) return false;
        index = (await res.json()) as VoiceIndex;
        packs = index.packs.map(() => null);
      }
      // Through the service worker, so the packs land in its cache and work offline later.
      await serviceWorkerReady();
      // One after the other: the first one (what is heard most) is ready sooner.
      for (let i = 0; i < index.packs.length; i++) {
        if (packs[i]) continue;
        const data = await fetch(`${base}${index.packs[i]}`);
        if (!data.ok) return false;
        packs[i] = await data.arrayBuffer();
      }
      return true;
    } catch {
      return false;
    } finally {
      loading = null;
    }
  })();
  return loading;
}

/** On the very first start the service worker takes over a moment later: wait for it (at most 15 s). */
function serviceWorkerReady(): Promise<void> {
  const sw = typeof navigator !== 'undefined' ? navigator.serviceWorker : undefined;
  if (!sw || sw.controller) return Promise.resolve();
  return new Promise((resolve) => {
    const timer = window.setTimeout(resolve, 15_000);
    sw.addEventListener(
      'controllerchange',
      () => {
        window.clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
  });
}

function context(): AudioContext | null {
  const A = audioClass();
  if (!A) return null;
  try {
    // iPhone: play like a media app, so the voice is heard even with the ring/silent switch on silent.
    const session = (navigator as unknown as { audioSession?: { type: string } }).audioSession;
    if (session && session.type !== 'playback') session.type = 'playback';
  } catch {
    /* older Safari: no audioSession */
  }
  try {
    ctx ??= new A();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

/** Decode one piece; Safari only has the callback form on older versions. */
function decode(a: AudioContext, bytes: ArrayBuffer): Promise<AudioBuffer> {
  return new Promise((resolve, reject) => {
    const p = a.decodeAudioData(bytes, resolve, reject) as Promise<AudioBuffer> | undefined;
    p?.catch(reject);
  });
}

/**
 * Play the text with the recorded voice. Returns false (and plays nothing) unless every
 * piece of it was recorded: then the phone's own voice reads it, so one text never mixes voices.
 * Must be called from a tap (phones only allow sound that the player started).
 */
export function sayRecorded(text: string): boolean {
  if (!recordedSupported()) return false;
  const pieces = speechPieces(text);
  if (!pieces.length) return false;
  const spans = pieces.map((p) => index!.clips[pieceKey(p.text)]);
  if (spans.some((s) => !s || !packs[s[0]])) return false;
  const a = context();
  if (!a) return false;
  stopRecorded();
  const gen = ++generation;
  decoding = gen;
  // Decode all pieces (fast: a few kilobytes each), then schedule them back to back.
  void Promise.all(spans.map(([k, off, len]) => decode(a, packs[k]!.slice(off, off + len))))
    .then((buffers) => {
      if (gen !== generation) return;
      decoding = -1;
      let t = a.currentTime + 0.05;
      buffers.forEach((buf, i) => {
        t += pieces[i].pause / 1000;
        const src = a.createBufferSource();
        src.buffer = buf;
        src.connect(a.destination);
        src.start(t);
        t += buf.duration;
        playing.push(src);
        src.onended = () => {
          playing = playing.filter((x) => x !== src);
          if (!playing.length && gen === generation) onIdle?.();
        };
      });
    })
    .catch(() => {
      /* a broken piece: stay silent rather than crash */
      if (gen === generation) {
        decoding = -1;
        onIdle?.();
      }
    });
  return true;
}

export function stopRecorded() {
  generation++;
  decoding = -1;
  for (const src of playing) {
    try {
      src.stop();
    } catch {
      /* already stopped */
    }
  }
  playing = [];
}

/** Test hook: forget the loaded pack. */
export function resetVoicePack() {
  index = null;
  packs = [];
  loading = null;
  stopRecorded();
}
