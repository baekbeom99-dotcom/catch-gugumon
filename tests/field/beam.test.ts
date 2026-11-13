import { describe, expect, it } from 'vitest';
import { BEAM_MUZZLE_OFFSET, BEAM_OVERSHOOT, BEAM_STRETCH_MAX, BEAM_STRETCH_MIN, beamPlan } from '../../src/field/fx/beam';

describe('줄기 효과 계산(beamPlan)', () => {
  it('내 공격: 왼쪽 아래 → 오른쪽 위, 뒤집지 않고 위로 돌린다', () => {
    const p = beamPlan({ x: 40, y: 120 }, { x: 140, y: 60 }, 130);
    expect(p.flip).toBe(false);
    expect(p.angle).toBeLessThan(0);
    // 입은 쏘는 구구몬에서 맞는 쪽으로 BEAM_MUZZLE_OFFSET 나간 곳
    expect(Math.hypot(p.muzzle.x - 40, p.muzzle.y - 120)).toBeCloseTo(BEAM_MUZZLE_OFFSET, 5);
  });

  it('적 공격: 오른쪽 위 → 왼쪽 아래, 가로로 뒤집고 아래로 돌린다', () => {
    const p = beamPlan({ x: 140, y: 60 }, { x: 40, y: 120 }, 130);
    expect(p.flip).toBe(true);
    expect(p.angle).toBeGreaterThan(0);
  });

  it('맞는 구구몬 한가운데를 조금 지나서 자른다', () => {
    const p = beamPlan({ x: 0, y: 0 }, { x: 100, y: 0 }, 100);
    expect(p.clipLen).toBeCloseTo(100 - BEAM_MUZZLE_OFFSET + BEAM_OVERSHOOT, 5);
  });

  it('가로 늘이기는 한계 안에 든다', () => {
    expect(beamPlan({ x: 0, y: 0 }, { x: 400, y: 0 }, 100).stretch).toBe(BEAM_STRETCH_MAX);
    expect(beamPlan({ x: 0, y: 0 }, { x: 30, y: 0 }, 160).stretch).toBe(BEAM_STRETCH_MIN);
  });

  it('두 자리가 같아도 던지지 않는다', () => {
    const p = beamPlan({ x: 5, y: 5 }, { x: 5, y: 5 }, 100);
    expect(Number.isFinite(p.angle) && Number.isFinite(p.stretch)).toBe(true);
  });
});
