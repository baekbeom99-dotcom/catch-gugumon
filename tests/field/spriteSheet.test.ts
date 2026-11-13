import { describe, expect, it } from 'vitest';
import { BODY_H_TARGET, BODY_W_MAX, FILL_MAX, bodyFill, BATTLE_ROW, DIR_ROW, SOURCE_ROWS, attackPlacement, cellOrigin, onceFrameAt, totalMs, dirFromDelta, frameAt, rowForDir } from '../../src/field/art/spriteSheet';
import cutScript from '../../scripts/cut-sprites.mjs?raw';

describe('frameAt (프레임 시간 → 번호, 되풀이)', () => {
  const ms = [100, 50, 50];
  it('경계값', () => {
    expect(frameAt(ms, 0)).toBe(0);
    expect(frameAt(ms, 99)).toBe(0);
    expect(frameAt(ms, 100)).toBe(1);
    expect(frameAt(ms, 149)).toBe(1);
    expect(frameAt(ms, 150)).toBe(2);
    expect(frameAt(ms, 199)).toBe(2);
  });
  it('한 바퀴 돌면 처음부터', () => {
    expect(frameAt(ms, 200)).toBe(0);
    expect(frameAt(ms, 305)).toBe(1);
    expect(frameAt(ms, 1000 * 200 + 160)).toBe(2);
  });
  it('프레임 하나·빈 목록·음수 시간', () => {
    expect(frameAt([500], 12345)).toBe(0);
    expect(frameAt([], 10)).toBe(0);
    expect(frameAt(ms, -10)).toBe(2);
  });
});

describe('방향 → 시트 줄', () => {
  it('아래(앞)·오른·위(뒤)·왼 순서, 옆모습은 오른 줄과 왼 줄이 따로', () => {
    expect(DIR_ROW).toEqual({ down: 0, right: 1, up: 2, left: 3 });
    expect(rowForDir('left')).not.toBe(rowForDir('right'));
    expect(rowForDir('up')).toBe(2);
  });
  it('전투 줄: 내 구구몬=원본 3(오른쪽 위)·야생=원본 7(왼쪽 아래)', () => {
    expect(SOURCE_ROWS.idle[BATTLE_ROW.idle.ally]).toBe(3);
    expect(SOURCE_ROWS.idle[BATTLE_ROW.idle.foe]).toBe(7);
    expect(SOURCE_ROWS.hurt[BATTLE_ROW.hurt.ally]).toBe(3);
    expect(SOURCE_ROWS.hurt[BATTLE_ROW.hurt.foe]).toBe(7);
    expect(SOURCE_ROWS.attack[BATTLE_ROW.attack.ally]).toBe(3);
    expect(SOURCE_ROWS.attack[BATTLE_ROW.attack.foe]).toBe(7);
    // 걷기·가만히의 기본 네 줄(아래·오른·위·왼)은 그대로
    expect(SOURCE_ROWS.idle.slice(0, 4)).toEqual([0, 2, 4, 6]);
  });
  it('cut-sprites.mjs 의 줄 목록과 같다', () => {
    const src: string = cutScript;
    expect(src).toContain(`idle: { name: 'Idle', rows: [${SOURCE_ROWS.idle.join(', ')}] }`);
    expect(src).toContain(`walk: { name: 'Walk', rows: [${SOURCE_ROWS.walk.join(', ')}] }`);
    expect(src).toContain(`hurt: { name: 'Hurt', rows: [${SOURCE_ROWS.hurt.join(', ')}] }`);
    expect(src).toContain(`name: 'Attack', rows: [${SOURCE_ROWS.attack.join(', ')}]`);
  });
});

describe('공격 시트는 한 번만 재생하고 끝나면 가만히로', () => {
  const ms = [67, 33, 67];
  it('프레임 경계', () => {
    expect(onceFrameAt(ms, 0)).toBe(0);
    expect(onceFrameAt(ms, 66)).toBe(0);
    expect(onceFrameAt(ms, 67)).toBe(1);
    expect(onceFrameAt(ms, 100)).toBe(2);
    expect(onceFrameAt(ms, 166)).toBe(2);
  });
  it('다 끝나면 null(되풀이 없음), 시작 전이면 첫 프레임', () => {
    expect(totalMs(ms)).toBe(167);
    expect(onceFrameAt(ms, 167)).toBeNull();
    expect(onceFrameAt(ms, 5000)).toBeNull();
    expect(onceFrameAt(ms, -5)).toBe(0);
  });
  it('Attack 칸을 Idle 칸 기준점에 맞춰 겹친다', () => {
    // k=1, Idle 칸 70(자리 44 안 가운데·아래), 기준점이 Idle (38,57)·Attack (72,72)
    const p = attackPlacement({ px: 44, idleCell: 70, side: 144, k: 1, ax: 72, ay: 72, ix: 38, iy: 57 });
    expect(p.size).toBe(144);
    expect(p.left).toBe(-13 + 38 - 72);
    expect(p.top).toBe(-26 + 57 - 72);
    // 기준점이 같은 위치: Idle 칸 안 기준점 = Attack 칸 안 기준점 + 놓는 자리
    expect(p.left + 72).toBe(-13 + 38);
    expect(p.top + 72).toBe(-26 + 57);
  });
});

describe('이동 변화량 → 방향', () => {
  it('네 방향', () => {
    expect(dirFromDelta(1, 0)).toBe('right');
    expect(dirFromDelta(-1, 0)).toBe('left');
    expect(dirFromDelta(0, 1)).toBe('down');
    expect(dirFromDelta(0, -1)).toBe('up');
  });
  it('안 움직이면 null, 비스듬하면 큰 쪽(같으면 세로)', () => {
    expect(dirFromDelta(0, 0)).toBeNull();
    expect(dirFromDelta(2, 1)).toBe('right');
    expect(dirFromDelta(-1, -2)).toBe('up');
    expect(dirFromDelta(1, 1)).toBe('down');
  });
});

describe('cellOrigin', () => {
  it('칸 번호 × 한 변', () => {
    expect(cellOrigin(2, 3, 70)).toEqual({ sx: 140, sy: 210 });
  });
});

describe('bodyFill (몸 높이 맞춤)', () => {
  it('몸 높이가 목표 비율이 되게 한다', () => {
    // 몸 높이 = 칸의 긴 쪽 → 배율 = 목표
    expect(bodyFill({ baseSide: 44, bodyH: 42, bodyW: 34 })).toBeCloseTo(BODY_H_TARGET * 44 / 42, 2);
    // 큰 종도 작은 종도 (몸 높이 × 배율) / 정지 그림 칸 ≈ 목표
    for (const m of [{ baseSide: 44, bodyH: 42, bodyW: 34 }, { baseSide: 130, bodyH: 128, bodyW: 78 }, { baseSide: 38, bodyH: 36, bodyW: 26 }]) {
      expect((m.bodyH * bodyFill(m)) / m.baseSide).toBeCloseTo(BODY_H_TARGET, 1);
    }
  });
  it('가로가 넓은 종은 가로 상한으로 줄이고, 상한을 넘지 않는다', () => {
    const wide = { baseSide: 64, bodyH: 40, bodyW: 62 };
    expect((wide.bodyW * bodyFill(wide)) / wide.baseSide).toBeLessThanOrEqual(BODY_W_MAX + 0.001);
    expect(bodyFill({ baseSide: 100, bodyH: 10, bodyW: 10 })).toBe(FILL_MAX);
  });
  it('값이 없으면 1', () => {
    expect(bodyFill({})).toBe(1);
    expect(bodyFill({ baseSide: 44 })).toBe(1);
  });
  it('cut-sprites.mjs 기본 번호는 46개 범위', () => {
    expect(cutScript).toContain("'1-18,23-28,35-40,50-62,129,130,132'");
  });
});
