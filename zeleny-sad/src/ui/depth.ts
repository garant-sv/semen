// «Живое 2,5D»: layers of the scene shift a little against each other when the phone
// is tilted or a finger moves over the garden, so the diorama gets depth.
//
// Only decorative layers move (sky, far hills, near grass). Beds, decorations and guests
// stay where they are, so a tap always lands where the child sees it.

/** How far (in scene units) each depth layer may shift at full tilt. Negative = against the motion. */
export const DEPTH_SHIFT = { far: -9, mid: -4, near: 7 } as const;
export type DepthKey = keyof typeof DEPTH_SHIFT;

/** Clamp to [-1, 1]. */
const clamp1 = (v: number) => (v < -1 ? -1 : v > 1 ? 1 : v);

/**
 * Tilt of the device relative to how it was held at the start, as -1..1 on each axis.
 * `gamma` is left/right (degrees), `beta` is front/back. 20° of tilt is a full shift.
 */
export function tiltOffset(beta: number, gamma: number, base: { beta: number; gamma: number }): { x: number; y: number } {
  return { x: clamp1((gamma - base.gamma) / 20), y: clamp1((beta - base.beta) / 20) };
}

/** Finger position over the stage as -1..1 from its centre. */
export function pointerOffset(clientX: number, clientY: number, rect: { left: number; top: number; width: number; height: number }) {
  if (!rect.width || !rect.height) return { x: 0, y: 0 };
  return {
    x: clamp1(((clientX - rect.left) / rect.width) * 2 - 1),
    y: clamp1(((clientY - rect.top) / rect.height) * 2 - 1),
  };
}

/** The translate for one layer at a given offset (vertical motion is half as strong). */
export function layerShift(key: DepthKey, o: { x: number; y: number }): { x: number; y: number } {
  const k = DEPTH_SHIFT[key];
  return { x: +(o.x * k).toFixed(2), y: +(o.y * k * 0.5).toFixed(2) };
}

type OrientationCtor = { requestPermission?: () => Promise<'granted' | 'denied'> };

/** iPhone Safari asks for motion access; other browsers give it without asking. */
export function tiltNeedsPermission(): boolean {
  const D = (window as unknown as { DeviceOrientationEvent?: OrientationCtor }).DeviceOrientationEvent;
  return typeof D?.requestPermission === 'function';
}

/** Ask for motion access. Must be called from a tap. Resolves true when tilt can be used. */
export async function requestTilt(): Promise<boolean> {
  const D = (window as unknown as { DeviceOrientationEvent?: OrientationCtor }).DeviceOrientationEvent;
  if (!D) return false;
  if (typeof D.requestPermission !== 'function') return true;
  try {
    return (await D.requestPermission()) === 'granted';
  } catch {
    return false;
  }
}

export class Depth {
  private target = { x: 0, y: 0 };
  private cur = { x: 0, y: 0 };
  private base: { beta: number; gamma: number } | null = null;
  private raf = 0;
  private tiltOn = false;
  private lastTiltAt = 0;
  private layers: { el: SVGGElement; key: DepthKey }[] = [];

  constructor(
    private svg: SVGSVGElement,
    private stage: HTMLElement,
    private reduced: () => boolean,
  ) {
    this.collect();
    stage.addEventListener('pointermove', (e) => this.onPointer(e), { passive: true });
    stage.addEventListener('pointerdown', (e) => this.onPointer(e), { passive: true });
    stage.addEventListener('pointerleave', () => this.relax(), { passive: true });
    window.addEventListener('deviceorientation', (e) => this.onTilt(e));
  }

  /** Find the depth layers again (after a view's markup changes). */
  collect() {
    this.layers = [...this.svg.querySelectorAll<SVGGElement>('[data-z]')]
      .filter((el) => (el.dataset.z as string) in DEPTH_SHIFT)
      .map((el) => ({ el, key: el.dataset.z as DepthKey }));
    this.apply();
  }

  /** Use (or stop using) the phone's tilt. The finger always works. */
  setTilt(on: boolean) {
    this.tiltOn = on;
    this.base = null;
    if (!on) this.relax();
  }

  private onPointer(e: PointerEvent) {
    // While the phone's tilt is working, it leads; the finger only nudges on a computer.
    if (this.tiltOn && performance.now() - this.lastTiltAt < 1500) return;
    this.target = pointerOffset(e.clientX, e.clientY, this.stage.getBoundingClientRect());
    this.kick();
  }

  private onTilt(e: DeviceOrientationEvent) {
    if (!this.tiltOn || e.beta == null || e.gamma == null) return;
    this.lastTiltAt = performance.now();
    if (!this.base) this.base = { beta: e.beta, gamma: e.gamma };
    // Let the resting position follow slowly, so holding the phone differently re-centres the garden.
    this.base.beta += (e.beta - this.base.beta) * 0.004;
    this.base.gamma += (e.gamma - this.base.gamma) * 0.004;
    this.target = tiltOffset(e.beta, e.gamma, this.base);
    this.kick();
  }

  private relax() {
    this.target = { x: 0, y: 0 };
    this.kick();
  }

  private kick() {
    if (this.reduced()) {
      this.cur = { x: 0, y: 0 };
      this.apply();
      return;
    }
    if (!this.raf) this.raf = requestAnimationFrame(() => this.step());
  }

  private step() {
    this.raf = 0;
    this.cur.x += (this.target.x - this.cur.x) * 0.12;
    this.cur.y += (this.target.y - this.cur.y) * 0.12;
    const settled = Math.abs(this.target.x - this.cur.x) < 0.002 && Math.abs(this.target.y - this.cur.y) < 0.002;
    if (settled) this.cur = { ...this.target };
    this.apply();
    if (!settled) this.raf = requestAnimationFrame(() => this.step());
  }

  private apply() {
    for (const { el, key } of this.layers) {
      const t = layerShift(key, this.cur);
      el.setAttribute('transform', t.x || t.y ? `translate(${t.x} ${t.y})` : '');
    }
  }
}
