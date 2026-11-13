import { describe, expect, it } from 'vitest';
import { DIR_ROW, HURT_ROW, cellOrigin, dirFromDelta, frameAt, rowForDir } from '../../src/field/art/spriteSheet';

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
  it('맞음 시트는 앞 0·뒤 1', () => {
    expect(HURT_ROW).toEqual({ front: 0, back: 1 });
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
