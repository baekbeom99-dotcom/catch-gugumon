import { describe, expect, it } from 'vitest';
import {
  SHADOW_ALPHA,
  SHADOW_ASPECT,
  SHADOW_BODY_SCALE,
  SHADOW_FALLBACK_BODY,
  SHADOW_LIFT_FADE,
  SHADOW_LIFT_SHRINK,
  bodyRatio,
  liftFraction,
  shadowSize,
} from '../../src/field/art/shadow';

describe('발밑 그림자', () => {
  it('수치 고정', () => {
    expect(SHADOW_BODY_SCALE).toBe(0.7);
    expect(SHADOW_ASPECT).toBe(0.28);
    expect(SHADOW_ALPHA).toBe(0.25);
    expect(SHADOW_FALLBACK_BODY).toBe(0.6);
    expect(SHADOW_LIFT_SHRINK).toBe(0.15);
    expect(SHADOW_LIFT_FADE).toBe(0.2);
  });
  it('몸 너비의 0.7배, 높이는 너비의 0.28배', () => {
    const s = shadowSize(100);
    expect(s.w).toBeCloseTo(70);
    expect(s.h).toBeCloseTo(19.6);
    expect(s.alpha).toBe(0.25);
  });
  it('뜨면 작고 연해진다 (최대 15%·20%)', () => {
    const s = shadowSize(100, 1);
    expect(s.w).toBeCloseTo(70 * 0.85);
    expect(s.alpha).toBeCloseTo(0.25 * 0.8);
    expect(shadowSize(100, 5).w).toBeCloseTo(s.w); // 1로 막음
    expect(shadowSize(100, -1).w).toBeCloseTo(70);
  });
  it('몸 너비 비율: manifest bodyW÷cw, 없으면 0.6', () => {
    expect(bodyRatio({ cw: 200, ch: 200, bodyW: 100 })).toBe(0.5);
    expect(bodyRatio({ cw: 200, ch: 200 })).toBe(0.6);
    expect(bodyRatio(undefined)).toBe(0.6);
  });
  it('뜬 높이(칸) → 0~1', () => {
    expect(liftFraction(0)).toBe(0);
    expect(liftFraction(0.06)).toBeCloseTo(0.5);
    expect(liftFraction(1)).toBe(1);
  });
});
