import { describe, expect, it } from 'vitest';
import { doorAction, doorFront } from '../../src/domain/field/doorEntry';
import { emptyTraining } from '../../src/domain/field/training';
import { STAIRS_OPEN_AFTER_DAN } from '../../src/domain/field/tuning';
import type { FieldDoor, FieldMap } from '../../src/domain/field/movement';

const door = (kind: FieldDoor['kind']): FieldDoor => ({ pos: { x: 4, y: 2 }, kind });

describe('doorAction', () => {
  it('상점 문은 팝업', () => {
    expect(doorAction(door('shop'), emptyTraining())).toEqual({ type: 'shop' });
  });
  it('체육관 문은 늘 열려서 체육관 지도로 간다', () => {
    expect(doorAction(door('gym'), emptyTraining())).toEqual({ type: 'gym' });
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
