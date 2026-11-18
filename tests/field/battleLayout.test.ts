import { describe, expect, it } from 'vitest';
import { BATTLE_LAYOUT, battleLayout } from '../../src/field/battle/battleLayout';

describe('전투 무대 배치 (포켓몬 3세대: 적 오른쪽 위, 내 구구몬 왼쪽 아래)', () => {
  it('비율 고정값', () => {
    expect(BATTLE_LAYOUT).toMatchObject({ foeX: 0.67, allyX: 0.3, foeW: 0.41, allyW: 0.47, bubbleReserve: 82, allyCard: 168 });
  });

  for (const [w, h] of [
    [351, 440],
    [351, 370],
    [600, 520],
    [320, 360],
  ] as const) {
    it(`${w}×${h}: 말풍선·내 정보 상자와 안 겹치고 무대 안`, () => {
      const L = battleLayout(w, h);
      // 적: 가운데 67%, 말풍선 아래에서 시작, 오른쪽 끝이 무대 안
      expect(L.foeCx).toBe(Math.round(0.67 * w));
      expect(L.foeTop).toBeGreaterThanOrEqual(BATTLE_LAYOUT.bubbleReserve);
      expect(L.foeCx + L.foe / 2).toBeLessThanOrEqual(w);
      // 내 구구몬: 가운데 30%, 자리 오른쪽 끝이 내 정보 상자 왼쪽보다 앞
      expect(L.allyCx).toBe(Math.round(0.3 * w));
      expect(L.allyCx + L.ally / 2).toBeLessThanOrEqual(w - BATTLE_LAYOUT.allyCard);
      expect(L.allyFeet).toBeLessThanOrEqual(h);
      // 가로로 겹치면 적 발이 내 구구몬 머리(+여유 20px)보다 위
      if (L.foeCx - L.foe / 2 < L.allyCx + L.ally / 2) expect(L.foeFeet).toBeLessThanOrEqual(L.allyFeet - L.ally + 20);
    });
  }

  it('넓은 화면에서는 비율대로 커진다 (적 41%·내 구구몬 47%까지)', () => {
    const L = battleLayout(600, 700);
    expect(L.foe).toBe(Math.round(0.41 * 600));
    expect(L.ally).toBe(Math.round(0.47 * 600));
  });
});
