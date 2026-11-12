import { describe, expect, it } from 'vitest';
import { defaultSkills, fastSeconds, learnedAt, newlyLearned, rollCopy, skillDef, weakestSkill } from '../../src/domain/field/skills';
import { COPY_CHANCE, MAX_SKILLS } from '../../src/domain/field/tuning';

const slots = (list: { slot: number }[]) => list.map((k) => k.slot);

describe('배우는 기술', () => {
  it('learnedAt', () => {
    const at = (lv: number) => slots(learnedAt('cloud', lv));
    expect(at(1)).toEqual([1]);
    expect(at(2)).toEqual([1]);
    expect(at(3)).toEqual([1, 2]);
    expect(at(7)).toEqual([1, 2]);
    expect(at(8)).toEqual([1, 2, 3]);
    expect(at(13)).toEqual([1, 2, 3]);
    expect(at(14)).toEqual([1, 2, 3, 4]);
    expect(at(19)).toEqual([1, 2, 3, 4]);
    expect(at(20)).toEqual([1, 2, 3, 4, 5]);
  });

  it('newlyLearned', () => {
    expect(slots(newlyLearned('cloud', 1, 3))).toEqual([2]);
    expect(slots(newlyLearned('cloud', 2, 9))).toEqual([2, 3]);
    expect(newlyLearned('cloud', 8, 8)).toEqual([]);
  });

  it('defaultSkills', () => {
    expect(defaultSkills('cloud', 1)).toEqual(['cloud-1']);
    expect(defaultSkills('cloud', 20)).toHaveLength(MAX_SKILLS);
    expect(defaultSkills('cloud', 0)).toHaveLength(1);
  });
});

describe('weakestSkill', () => {
  it('속성 기술 중 위력 낮은 것, 동률은 슬롯 작은 것', () => {
    expect(weakestSkill(['cloud-5', 'cloud-2', 'cloud-1'])?.id).toBe('cloud-1');
    expect(weakestSkill(['cloud-5', 'cloud-4', 'cloud-2'])?.id).toBe('cloud-2');
    expect(weakestSkill(['cloud-5', 'cloud-3'])?.id).toBe('cloud-5');
  });
  it('특수만 있으면 null', () => {
    expect(weakestSkill(['cloud-3'])).toBeNull();
    expect(weakestSkill([])).toBeNull();
  });
});

describe('fastSeconds', () => {
  it('정수 초, 하한 1', () => {
    expect(fastSeconds(skillDef('cloud-1'), 7000)).toBe(4);
    expect(fastSeconds(skillDef('cloud-5'), 7000)).toBe(3);
    expect(fastSeconds(skillDef('cloud-1'), 5000)).toBe(3);
    expect(fastSeconds(skillDef('cloud-5'), 1000)).toBe(1);
  });
});

describe('rollCopy', () => {
  const seq = (...v: number[]) => {
    let i = 0;
    return () => v[i++] ?? 0;
  };
  it('경계: COPY_CHANCE 미만이면 당첨, 이상이면 null', () => {
    expect(COPY_CHANCE).toBe(0.02);
    expect(rollCopy(seq(0.0199, 0), 'cloud', 1, [])).toBe('cloud-1');
    expect(rollCopy(seq(0.02, 0), 'cloud', 1, [])).toBeNull();
  });
  it('가진 기술은 후보에서 빠지고, 후보 없으면 null', () => {
    expect(rollCopy(seq(0, 0), 'cloud', 3, ['cloud-1'])).toBe('cloud-2');
    expect(rollCopy(seq(0, 0), 'cloud', 1, ['cloud-1'])).toBeNull();
  });
  it('특수 기술도 후보, 두 번째 난수로 고른다', () => {
    expect(rollCopy(seq(0, 0.99), 'cloud', 8, [])).toBe('cloud-3');
  });
});
