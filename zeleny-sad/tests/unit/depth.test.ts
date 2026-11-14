import { describe, expect, it } from 'vitest';
import { DEPTH_SHIFT, layerShift, pointerOffset, tiltOffset } from '../../src/ui/depth';
import { frontSVG } from '../../src/ui/scene';

describe('«Живое 2,5D»', () => {
  it('finger offset is -1..1 from the stage centre and clamped', () => {
    const rect = { left: 0, top: 0, width: 200, height: 400 };
    expect(pointerOffset(100, 200, rect)).toEqual({ x: 0, y: 0 });
    expect(pointerOffset(0, 0, rect)).toEqual({ x: -1, y: -1 });
    expect(pointerOffset(500, 900, rect)).toEqual({ x: 1, y: 1 });
    expect(pointerOffset(10, 10, { left: 0, top: 0, width: 0, height: 0 })).toEqual({ x: 0, y: 0 });
  });

  it('tilt is measured from the starting position; 20° is a full shift', () => {
    const base = { beta: 40, gamma: 0 };
    expect(tiltOffset(40, 0, base)).toEqual({ x: 0, y: 0 });
    expect(tiltOffset(50, 10, base)).toEqual({ x: 0.5, y: 0.5 });
    expect(tiltOffset(90, -60, base)).toEqual({ x: -1, y: 1 });
  });

  it('far layers move against the motion, near grass with it, and only a little', () => {
    const o = { x: 1, y: 1 };
    expect(layerShift('far', o).x).toBeLessThan(0);
    expect(layerShift('near', o).x).toBeGreaterThan(0);
    for (const k of Object.keys(DEPTH_SHIFT) as (keyof typeof DEPTH_SHIFT)[]) {
      expect(Math.abs(layerShift(k, o).x)).toBeLessThanOrEqual(10);
      expect(Math.abs(layerShift(k, o).y)).toBeLessThanOrEqual(5);
    }
  });

  it('front grass never takes taps', () => {
    for (const a of ['garden', 'veg', 'tundra', 'taiga', 'steppe'] as const) {
      expect(frontSVG(a).startsWith('<g pointer-events="none">')).toBe(true);
    }
  });
});
