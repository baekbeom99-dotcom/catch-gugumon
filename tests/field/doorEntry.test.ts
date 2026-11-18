import { describe, expect, it } from 'vitest';
import { doorAction, doorFront, lockedText } from '../../src/domain/field/doorEntry';
import { emptyTraining } from '../../src/domain/field/training';
import { STAIRS_OPEN_AFTER_DAN } from '../../src/domain/field/tuning';
import type { FieldDoor, FieldMap } from '../../src/domain/field/movement';

const door = (kind: FieldDoor['kind'], dan?: FieldDoor['dan']): FieldDoor => ({ pos: { x: 4, y: 2 }, kind, ...(dan ? { dan } : {}) });

describe('doorAction', () => {
  it('상점 문은 팝업', () => {
    expect(doorAction(door('shop'), emptyTraining())).toEqual({ type: 'shop' });
  });
  it('열린 단은 들어간다', () => {
    expect(doorAction(door('training', 2), emptyTraining())).toEqual({ type: 'enter', to: '/field/training/2' });
  });
  it('잠긴 단은 앞 단 마스터 안내', () => {
    expect(doorAction(door('training', 3), emptyTraining())).toEqual({ type: 'locked', text: '2단을 먼저 마스터해요' });
    expect(lockedText(11)).toBe('9단을 먼저 마스터해요');
  });
  it('앞 단을 마스터하면 열린다', () => {
    const t = { ...emptyTraining(), mastered: { 2: { bestMs: 1, at: 1 } } as never };
    expect(doorAction(door('training', 3), t)).toEqual({ type: 'enter', to: '/field/training/3' });
  });
  it('계단 문', () => {
    const a = doorAction(door('stairs'), emptyTraining());
    if (STAIRS_OPEN_AFTER_DAN === null) expect(a).toEqual({ type: 'enter', to: '/stairs' });
    else expect(a.type).toBe('locked');
  });
});

describe('doorFront', () => {
  it('문 바로 아래 칸', () => {
    expect(doorFront({} as FieldMap, door('shop'))).toEqual({ x: 4, y: 3 });
  });
});
