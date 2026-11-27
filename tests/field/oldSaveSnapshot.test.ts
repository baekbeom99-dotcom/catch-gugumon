import { describe, expect, it } from 'vitest';
import { emptyCostume } from '../../src/domain/field/costumes';
import { createInitialSave, mergeSave } from '../../src/store/saveData';
import { initialField, mergeField, newSpeciesEntry } from '../../src/store/fieldData';

const NOW = new Date('2026-11-18T09:00:00').getTime();

/**
 * 꾸미기·시계가 생기기 전(훈련 기록은 있음)의 실제 모양 저장 한 장을 글자 그대로 고정한다.
 * 합치면 옛 값은 그대로(마을 자리도 다시 밀리지 않음)이고, 늘어나는 것은 costume 기본값과 clock {} 뿐이다.
 */
function oldFieldSnapshot() {
  const { costume: _c, ...base } = initialField() as unknown as Record<string, unknown>;
  return {
    ...base,
    starterChosen: true,
    companion: 'c034',
    species: { c034: newSpeciesEntry('c034', 7, NOW), c031: newSpeciesEntry('c031', 3, NOW) },
    seen: ['c034', 'c031'],
    position: { map: 'town', x: 12, y: 9, facing: 'left' },
    stats: { battles: 21, catches: 4, fled: 2 },
    starPoints: 0,
    training: {
      studied: { 2: true, 3: true, 4: true, 5: true, 12: true },
      mastered: { 2: { bestMs: 41000, at: 1700000000000 }, 3: { bestMs: 52000, at: 1700000100000 }, 12: { bestMs: 98000, at: 1700000200000 } },
      legendGranted: { 12: 'c014', 13: 'c015', arithHard: 'c016' },
      arith: { basic: { bestMs: 30000, at: 1700000300000 }, hard: { bestMs: 61000, at: 1700000400000 } },
    },
  };
}

describe('옛 저장(꾸미기·시계 전) 읽기', () => {
  it('옛 값은 그대로, 마을 자리는 다시 밀리지 않고, 늘어나는 것은 costume 기본값과 clock {} 뿐', () => {
    const old = oldFieldSnapshot();
    const before = JSON.stringify(old);
    const merged = mergeField(initialField(), old);
    expect(JSON.stringify(old)).toBe(before); // 읽어도 원본은 안 바뀐다
    expect(merged.position).toEqual({ map: 'town', x: 12, y: 9, facing: 'left' });
    expect(merged.starPoints).toBe(0);
    expect(merged.costume).toEqual(emptyCostume());
    expect(merged.training.clock).toEqual({});
    expect(merged.training.legendGranted).toEqual({ 12: 'c014', 13: 'c015', arithHard: 'c016' });
    expect(merged.training.legendGranted.clockOne).toBeUndefined();
    // 전체: 옛 저장에 costume·clock만 더한 것과 완전히 같다
    expect(merged).toEqual({ ...old, costume: emptyCostume(), training: { ...old.training, clock: {} } });
  });

  it('mergeSave를 거쳐도 같고, 한 번 더 합쳐도 변하지 않는다(마을 자리 두 번 안 밀림)', () => {
    const save = { ...createInitialSave(NOW), field: oldFieldSnapshot() };
    const once = mergeSave(createInitialSave(NOW), save);
    const twice = mergeSave(createInitialSave(NOW), once);
    expect(twice.field).toEqual(once.field);
    expect(once.field.position).toEqual({ map: 'town', x: 12, y: 9, facing: 'left' });
  });
});
