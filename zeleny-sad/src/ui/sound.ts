// Tiny synthesized sound effects (Web Audio). No audio files are shipped.

type Sfx = 'tap' | 'plant' | 'water' | 'harvest' | 'quest' | 'build' | 'error' | 'pop' | 'guest' | 'golden' | 'tick';

let ctx: AudioContext | null = null;
let enabled = true;

export function setSoundEnabled(on: boolean) {
  enabled = on;
}

function audio(): AudioContext | null {
  if (!enabled) return null;
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx ??= new AC();
    if (ctx.state !== 'running') void ctx.resume().catch(() => {}); // iOS also has 'interrupted'
    return ctx;
  } catch {
    return null;
  }
}

function tone(a: AudioContext, freq: number, start: number, dur: number, type: OscillatorType = 'sine', vol = 0.12, slideTo?: number) {
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, a.currentTime + start);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, a.currentTime + start + dur);
  g.gain.setValueAtTime(0.0001, a.currentTime + start);
  g.gain.exponentialRampToValueAtTime(vol, a.currentTime + start + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + start + dur);
  o.connect(g).connect(a.destination);
  o.start(a.currentTime + start);
  o.stop(a.currentTime + start + dur + 0.02);
}

export function play(sfx: Sfx) {
  const a = audio();
  if (!a) return;
  switch (sfx) {
    case 'tap':
      tone(a, 660, 0, 0.06, 'triangle', 0.06);
      break;
    case 'plant':
      tone(a, 220, 0, 0.12, 'triangle', 0.12, 330);
      tone(a, 440, 0.08, 0.1, 'sine', 0.08);
      break;
    case 'water':
      for (let i = 0; i < 4; i++) tone(a, 900 + i * 140, i * 0.05, 0.07, 'sine', 0.06, 500);
      break;
    case 'harvest':
      [523, 659, 784].forEach((f, i) => tone(a, f, i * 0.07, 0.16, 'triangle', 0.1));
      break;
    case 'quest':
      [523, 659, 784, 1046].forEach((f, i) => tone(a, f, i * 0.09, 0.22, 'sine', 0.1));
      break;
    case 'build':
      [196, 262, 330, 392, 523].forEach((f, i) => tone(a, f, i * 0.08, 0.2, 'triangle', 0.1));
      break;
    case 'pop':
      tone(a, 392, 0, 0.09, 'sine', 0.08, 784);
      break;
    case 'guest':
      tone(a, 880, 0, 0.08, 'sine', 0.07, 1320);
      tone(a, 1175, 0.1, 0.1, 'sine', 0.07, 1568);
      break;
    case 'golden':
      [784, 988, 1175, 1568, 1976].forEach((f, i) => tone(a, f, i * 0.06, 0.25, 'sine', 0.07));
      break;
    case 'tick':
      tone(a, 1320 + Math.random() * 200, 0, 0.04, 'triangle', 0.035);
      break;
    case 'error':
      tone(a, 220, 0, 0.14, 'square', 0.04, 180);
      break;
  }
}
