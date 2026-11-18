import { describe, expect, it } from 'vitest';
import { QUIZ_ADVENTURE_ENABLED, isRouteEnabled } from '../../src/config/featureFlags';

const QUIZ = ['/pet', '/explore', '/shop', '/records', '/dex', '/battle', '/practice', '/hatch', '/welcome'];
const ALWAYS = ['/', '/field', '/field/records', '/field/battle', '/field/training/3', '/field/dex', '/stairs', '/admin', '/dev/field', '/dev/gallery'];

describe('퀴즈 모험 끄기', () => {
  it('플래그는 꺼져 있다', () => {
    expect(QUIZ_ADVENTURE_ENABLED).toBe(false);
  });
  it.each(QUIZ)('꺼진 동안 %s 와 하위 경로는 막힌다', (p) => {
    expect(isRouteEnabled(p, false)).toBe(false);
    expect(isRouteEnabled(`${p}/x`, false)).toBe(false);
    expect(isRouteEnabled(`${p}?tab=1`, false)).toBe(false);
  });
  it.each(ALWAYS)('꺼져도 %s 는 열려 있다', (p) => {
    expect(isRouteEnabled(p, false)).toBe(true);
  });
  it('켜면 모두 열린다', () => {
    for (const p of [...QUIZ, ...ALWAYS]) expect(isRouteEnabled(p, true)).toBe(true);
  });
  it('기본값은 플래그를 따른다', () => {
    expect(isRouteEnabled('/pet')).toBe(QUIZ_ADVENTURE_ENABLED);
  });
});
