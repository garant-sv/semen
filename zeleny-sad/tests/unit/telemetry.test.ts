import { describe, expect, it } from 'vitest';
import { trackQuest } from '../../src/telemetry';

describe('trackQuest', () => {
  it('records each finished quest only once per session', () => {
    expect(trackQuest('first-bloom', 3)).toBe(true);
    expect(trackQuest('first-bloom', 3)).toBe(false);
    expect(trackQuest('first-seed', 1)).toBe(true);
  });
});
