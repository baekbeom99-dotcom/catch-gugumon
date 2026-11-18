import { describe, expect, it } from 'vitest';
import { BODY_H_TARGET, BODY_W_MAX, BATTLE_ROW, DIR_ROW, SHEET_COLS, SHEET_ROWS, cellBox, cellOrigin, onceFrameAt, totalMs, dirFromDelta, frameAt, rowForDir } from '../../src/field/art/spriteSheet';
import cutScript from '../../scripts/cut-chibi.py?raw';

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

describe('방향 → 시트 행 (치비 4×4)', () => {
  it('행: 아래(앞)·위(뒤)·오른쪽·왼쪽, 4열 × 4행', () => {
    expect(DIR_ROW).toEqual({ down: 0, up: 1, right: 2, left: 3 });
    expect(rowForDir('left')).not.toBe(rowForDir('right'));
    expect(SHEET_COLS).toBe(4);
    expect(SHEET_ROWS).toBe(4);
  });
  it('전투: 내 구구몬은 뒷모습(행 1), 야생은 앞모습(행 0)', () => {
    expect(BATTLE_ROW).toEqual({ ally: 1, foe: 0 });
  });
  it('cut-chibi.py 와 같은 규격 (4열×4행, 가만히·걷기·공격)', () => {
    const src: string = cutScript;
    expect(src).toContain('COLS = ROWS = 4');
    expect(src).toContain("ANIMS = {'idle': 300, 'walk': 150, 'attack': 110}");
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
  it('칸 번호 × 칸 크기 (가로·세로 따로)', () => {
    expect(cellOrigin(2, 3, 70, 80)).toEqual({ sx: 140, sy: 240 });
  });
});

describe('cellBox (몸 높이 맞춤)', () => {
  it('몸 높이가 자리의 BODY_H_TARGET이 되게 칸을 놓는다', () => {
    for (const c of [{ cw: 126, ch: 135, bodyH: 117, bodyW: 108 }, { cw: 144, ch: 143, bodyH: 60, bodyW: 50 }, { cw: 90, ch: 120, bodyH: 110, bodyW: 70 }]) {
      const b = cellBox(c);
      expect((b.h * c.bodyH) / c.ch).toBeCloseTo(BODY_H_TARGET, 2);
      expect(b.w / b.h).toBeCloseTo(c.cw / c.ch, 2);
    }
  });
  it('가로가 넓은 몸은 가로 상한으로 줄인다', () => {
    const c = { cw: 200, ch: 100, bodyH: 50, bodyW: 180 };
    const b = cellBox(c);
    expect((b.w * c.bodyW) / c.cw).toBeLessThanOrEqual(BODY_W_MAX + 0.001);
  });
  it('몸 크기를 모르면 칸 전체가 자리에, 칸도 모르면 1×1', () => {
    expect(cellBox({ cw: 100, ch: 50 })).toEqual({ w: 1, h: 0.5 });
    expect(cellBox(undefined)).toEqual({ w: 1, h: 1 });
    expect(cellBox({})).toEqual({ w: 1, h: 1 });
  });
});
