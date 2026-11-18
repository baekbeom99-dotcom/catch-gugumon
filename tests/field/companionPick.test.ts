import { describe, expect, it } from 'vitest';
import { healthyCompanions, pickReplacement } from '../../src/domain/field/companion';
import { SPECIES_IDS } from '../../src/store/fieldData';
import { playerPose } from '../../src/field/world/roamerLayer';

const e = (level: number, hp: number, firstCaughtAt: number) => ({ level, hp, firstCaughtAt });

describe('healthyCompanions: 쓰러지면 대신 다닐 수 있는 구구몬 목록', () => {
  it('쓰러진 종을 빼고 건강한 종만, 레벨 높은 순', () => {
    expect(healthyCompanions({ c034: e(9, 0, 1), c036: e(4, 100, 2), c031: e(7, 30, 3) }, 'c034')).toEqual(['c031', 'c036']);
  });

  it('레벨이 같으면 먼저 잡은 종 (firstCaughtAt이 빠른 것)', () => {
    // 종 목록 순서로는 c031이 앞이지만, 먼저 잡은 c036가 앞
    expect(healthyCompanions({ c034: e(5, 0, 1), c031: e(6, 100, 50), c036: e(6, 100, 20) }, 'c034')).toEqual(['c036', 'c031']);
  });

  it('레벨·잡은 때도 같으면 종 목록(SPECIES_IDS) 순서', () => {
    const a = healthyCompanions({ c034: e(5, 0, 1), c031: e(6, 100, 7), c036: e(6, 100, 7) }, 'c034');
    const b = healthyCompanions({ c034: e(5, 0, 1), c036: e(6, 100, 7), c031: e(6, 100, 7) }, 'c034');
    expect(a).toEqual(['c031', 'c036']);
    expect(b).toEqual(['c031', 'c036']);
    expect(SPECIES_IDS.indexOf('c031')).toBeLessThan(SPECIES_IDS.indexOf('c036'));
  });

  it('다른 쓰러진 종은 후보가 아니다', () => {
    expect(healthyCompanions({ c034: e(5, 0, 1), c036: e(30, 0, 2), c031: e(2, 1, 3) }, 'c034')).toEqual(['c031']);
  });

  it('건강한 다른 종이 없으면 빈 목록', () => {
    expect(healthyCompanions({ c034: e(5, 0, 1), c036: e(9, 0, 2) }, 'c034')).toEqual([]);
    expect(healthyCompanions({ c034: e(5, 0, 1) }, 'c034')).toEqual([]);
    expect(healthyCompanions({}, 'c034')).toEqual([]);
  });

  it('쓰러진 종 자신은 체력이 남아 있어도 넣지 않는다', () => {
    expect(healthyCompanions({ c034: e(50, 100, 1) }, 'c034')).toEqual([]);
  });

  it('종 목록에 없는 이름(constructor 등)은 무시', () => {
    const odd = { c034: e(5, 0, 1), constructor: e(99, 100, 0) } as unknown as Parameters<typeof healthyCompanions>[0];
    expect(healthyCompanions(odd, 'c034')).toEqual([]);
  });
});

describe('pickReplacement: 쓰러지면 대신 함께 다닐 구구몬 (목록의 첫째)', () => {
  it('쓰러진 종을 빼고 레벨이 가장 높은 건강한 종', () => {
    expect(pickReplacement({ c034: e(9, 0, 1), c036: e(4, 100, 2), c031: e(7, 30, 3) }, 'c034')).toBe('c031');
  });
  it('건강한 다른 종이 없으면 null', () => {
    expect(pickReplacement({ c034: e(5, 0, 1), c036: e(9, 0, 2) }, 'c034')).toBeNull();
    expect(pickReplacement({}, 'c034')).toBeNull();
  });
});

describe('playerPose: 시트 없는 동행 구구몬이 걸을 때', () => {
  it('걷는 중에는 한 칸에 한 번 통통 (처음·끝은 땅, 가운데가 가장 높다)', () => {
    expect(playerPose(0, 0, 'down').lift).toBe(0);
    expect(playerPose(0.5, 0, 'down').lift).toBeCloseTo(0.12);
    expect(playerPose(1, 0, 'down').lift).toBeCloseTo(0);
    expect(playerPose(0.5, 0, 'down').breathe).toBe(1);
  });
  it('서 있으면 뜨지 않고 숨쉬기만', () => {
    const p = playerPose(null, 500, 'down');
    expect(p.lift).toBe(0);
    expect(Math.abs(p.breathe - 1)).toBeLessThanOrEqual(0.035);
  });
  it('오른쪽을 볼 때만 좌우를 뒤집는다', () => {
    expect(playerPose(null, 0, 'right').flip).toBe(true);
    expect(playerPose(null, 0, 'left').flip).toBe(false);
    expect(playerPose(0.3, 0, 'up').flip).toBe(false);
    expect(playerPose(0.3, 0, 'down').flip).toBe(false);
  });
});
