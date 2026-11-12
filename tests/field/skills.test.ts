import { describe, expect, it } from 'vitest';
import {
  defaultSkills, fastSeconds, learnedAt, M2_EFFECT_OF_SPECIES, newlyLearned, pickFired, rollCopy, seatOf, seatedDef, skillButtons, skillDef, weakestSkill,
  type SkillButton,
} from '../../src/domain/field/skills';
import { SPECIES } from '../../src/domain/field/creatures';
import { COPY_CHANCE, MAX_SKILLS, SUB_FAST_RATIO, TIER_RULES } from '../../src/domain/field/tuning';

const slots = (list: { slot: number }[]) => list.map((k) => k.slot);
const k = (id: string) => skillDef(id);

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
    expect(weakestSkill(['cloud-5', 'cloud-4', 'cloud-2'])?.id).toBe('cloud-2'); // 3·3·2
    expect(weakestSkill(['cloud-2', 'cloud-1'])?.id).toBe('cloud-1'); // 2·2 → 슬롯 1
    expect(weakestSkill(['cloud-5', 'cloud-3'])?.id).toBe('cloud-5');
  });
  it('특수만 있으면 null', () => {
    expect(weakestSkill(['cloud-3'])).toBeNull();
    expect(weakestSkill([])).toBeNull();
  });
  it('주인을 알려 주면 자리 위력으로 본다: 복사한 다른 종 1번(부속성 자리 위력 3)보다 내 주①(2)이 약하다', () => {
    expect(weakestSkill(['horn-1', 'cloud-1'], 'cloud')?.id).toBe('cloud-1');
    expect(weakestSkill(['horn-1', 'cloud-1', 'cloud-3'], 'cloud')?.basePower).toBe(2);
  });
});

describe('fastSeconds', () => {
  it('정수 초, 하한 1', () => {
    expect(fastSeconds(k('cloud-1'), 7000)).toBe(4);
    expect(fastSeconds(k('cloud-2'), 7000)).toBe(4); // 3.5 → 4
    expect(fastSeconds(k('cloud-5'), 7000)).toBe(2); // 2.1 → 2
    expect(fastSeconds(k('cloud-1'), 5000)).toBe(3);
    expect(fastSeconds(k('cloud-2'), 5000)).toBe(3); // 2.5 → 3
    expect(fastSeconds(k('cloud-5'), 5000)).toBe(2); // 1.5 → 2
    expect(fastSeconds(k('cloud-5'), 1000)).toBe(1);
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

// ── 개정 3: 기술 버튼 3개 (설계서 0-1절) ──

describe('seatOf: 기술이 들어가는 자리', () => {
  it('자기 종: 슬롯 1·2·5는 주속성 사슬, 3은 특수, 4는 부속성', () => {
    for (const s of SPECIES) {
      expect([1, 2, 3, 4, 5].map((n) => seatOf(k(`${s.id}-${n}`), s.id))).toEqual(['main', 'main', 'special', 'sub', 'main']);
    }
  });
  it('다른 종: 속성 기술(주①~③·부속성)은 모두 부속성 자리, 특수는 특수 자리', () => {
    for (const a of SPECIES) {
      for (const b of SPECIES) {
        if (a.id === b.id) continue;
        expect([1, 2, 3, 4, 5].map((n) => seatOf(k(`${b.id}-${n}`), a.id))).toEqual(['sub', 'sub', 'special', 'sub', 'sub']);
      }
    }
  });
  it('seatedDef: 부속성 자리에 앉은 다른 종 기술은 위력 3·조건 SUB_FAST_RATIO, 이름·속성·효과 칸은 원래 것', () => {
    const horn5 = seatedDef(k('horn-5'), 'cloud');
    expect(horn5).toMatchObject({ id: 'horn-5', name: k('horn-5').name, element: k('horn-5').element, fxIndex: 2, basePower: 3, fastRatio: SUB_FAST_RATIO });
    expect(seatedDef(k('horn-1'), 'cloud')).toMatchObject({ basePower: 3, fastRatio: SUB_FAST_RATIO, fxIndex: 0 });
    // 자기 종 기술·특수는 그대로
    expect(seatedDef(k('cloud-4'), 'cloud')).toEqual(k('cloud-4'));
    expect(seatedDef(k('cloud-2'), 'cloud')).toEqual(k('cloud-2'));
    expect(seatedDef(k('jelly-3'), 'cloud')).toEqual(k('jelly-3'));
  });
});

/** 버튼을 모양만 보기 좋게: 주속성은 사슬 id, 나머지는 기술 id */
const shape = (bs: SkillButton[]) => bs.map((b) => (b.kind === 'main' ? { main: b.chain.map((d) => d.id) } : { [b.kind]: b.skill.id }));

describe('skillButtons: 버튼은 최대 3개 (주속성·부속성·특수)', () => {
  it('옛 저장 [1,2,5] → 버튼 1개 (사슬 3단계)', () => {
    expect(shape(skillButtons(['cloud-1', 'cloud-2', 'cloud-5'], 'cloud'))).toEqual([{ main: ['cloud-1', 'cloud-2', 'cloud-5'] }]);
    // 가진 순서와 상관없이 사슬은 슬롯 순서
    expect(shape(skillButtons(['cloud-5', 'cloud-1', 'cloud-2'], 'cloud'))).toEqual([{ main: ['cloud-1', 'cloud-2', 'cloud-5'] }]);
  });
  it('스타터 [1] → 버튼 1개', () => {
    expect(shape(skillButtons(['jelly-1'], 'jelly'))).toEqual([{ main: ['jelly-1'] }]);
  });
  it('Lv8 [1,2,3] → 주속성 + 특수', () => {
    expect(shape(skillButtons(['cloud-1', 'cloud-2', 'cloud-3'], 'cloud'))).toEqual([{ main: ['cloud-1', 'cloud-2'] }, { special: 'cloud-3' }]);
  });
  it('Lv14 [1,2,3,4] → 주속성·부속성·특수 (가진 순서와 상관없이 이 순서)', () => {
    const want = [{ main: ['cloud-1', 'cloud-2'] }, { sub: 'cloud-4' }, { special: 'cloud-3' }];
    expect(shape(skillButtons(['cloud-1', 'cloud-2', 'cloud-3', 'cloud-4'], 'cloud'))).toEqual(want);
    expect(shape(skillButtons(['cloud-3', 'cloud-4', 'cloud-2', 'cloud-1'], 'cloud'))).toEqual(want);
  });
  it('Lv20 다섯 개 → 버튼 3개 (사슬 3단계)', () => {
    expect(shape(skillButtons(['cloud-1', 'cloud-2', 'cloud-3', 'cloud-4', 'cloud-5'], 'cloud'))).toEqual([
      { main: ['cloud-1', 'cloud-2', 'cloud-5'] }, { sub: 'cloud-4' }, { special: 'cloud-3' },
    ]);
  });
  it('복사한 다른 종 속성 기술은 부속성 버튼 (자리 위력·조건으로)', () => {
    const bs = skillButtons(['cloud-1', 'horn-5'], 'cloud');
    expect(shape(bs)).toEqual([{ main: ['cloud-1'] }, { sub: 'horn-5' }]);
    const sub = bs[1] as Extract<SkillButton, { kind: 'sub' }>;
    expect(sub.skill).toMatchObject({ basePower: 3, fastRatio: SUB_FAST_RATIO, element: k('horn-5').element });
  });
  it('복사한 특수는 특수 버튼', () => {
    expect(shape(skillButtons(['cloud-1', 'jelly-3'], 'cloud'))).toEqual([{ main: ['cloud-1'] }, { special: 'jelly-3' }]);
  });
  it('버튼마다 주인 종을 안다', () => {
    for (const b of skillButtons(['cloud-1', 'horn-5', 'jelly-3'], 'cloud')) expect(b.owner).toBe('cloud');
  });
  it('(깨진 목록 대비) 주속성이 하나도 없어도 주속성 버튼은 맨 앞에 주①로', () => {
    expect(shape(skillButtons(['cloud-3'], 'cloud'))).toEqual([{ main: ['cloud-1'] }, { special: 'cloud-3' }]);
  });
});

describe('pickFired: 속도에 따라 나가는 기술', () => {
  const T7 = 7000;
  const main = (held: string[], owner = 'cloud' as const) => skillButtons(held, owner)[0];
  const button = (held: string[], kind: 'sub' | 'special') => skillButtons(held, 'cloud').find((b) => b.kind === kind)!;
  const fire = (b: SkillButton, held: string[], ms: number, timeMs = T7) => pickFired(b, held, ms, timeMs);

  it('사슬 1개: 아무리 빨라도 주①', () => {
    const held = ['cloud-1'];
    expect(fire(main(held), held, 0)).toMatchObject({ fired: { id: 'cloud-1' }, tier: 1, upper: false, usedFallback: false });
  });

  it('사슬 2개: 주② 조건 이내면 주②, 넘으면 주①', () => {
    const held = ['cloud-1', 'cloud-2'];
    const m2 = fastSeconds(k('cloud-2'), T7) * 1000; // 4000
    expect(fire(main(held), held, m2)).toMatchObject({ fired: { id: 'cloud-2' }, tier: 2, upper: true });
    expect(fire(main(held), held, m2 + 1)).toMatchObject({ fired: { id: 'cloud-1' }, tier: 1, upper: false });
  });

  it.each([...new Set(Object.values(TIER_RULES).map((r) => r.timeMs))])('사슬 3개 (문제 %ims): 경계에서 주③ → 주② → 주①', (t) => {
    const held = ['cloud-1', 'cloud-2', 'cloud-5'];
    const m2 = fastSeconds(k('cloud-2'), t) * 1000;
    const m3 = fastSeconds(k('cloud-5'), t) * 1000;
    expect(m3).toBeLessThan(m2);
    const b = main(held);
    expect(fire(b, held, 0, t)).toMatchObject({ fired: { id: 'cloud-5' }, tier: 3, upper: true });
    expect(fire(b, held, m3, t)).toMatchObject({ fired: { id: 'cloud-5' }, tier: 3 });
    expect(fire(b, held, m3 + 1, t)).toMatchObject({ fired: { id: 'cloud-2' }, tier: 2, upper: true });
    expect(fire(b, held, m2, t)).toMatchObject({ fired: { id: 'cloud-2' }, tier: 2 });
    expect(fire(b, held, m2 + 1, t)).toMatchObject({ fired: { id: 'cloud-1' }, tier: 1, upper: false });
  });

  it('7초 문제의 실제 경계: 주③ 2초·주② 4초 / 5초 문제: 주③ 2초·주② 3초', () => {
    const held = ['cloud-1', 'cloud-2', 'cloud-5'];
    const b = main(held);
    expect([2000, 2001, 4000, 4001].map((ms) => fire(b, held, ms, 7000).fired.id)).toEqual(['cloud-5', 'cloud-2', 'cloud-2', 'cloud-1']);
    expect([2000, 2001, 3000, 3001].map((ms) => fire(b, held, ms, 5000).fired.id)).toEqual(['cloud-5', 'cloud-2', 'cloud-2', 'cloud-1']);
  });

  it('없는 단계는 건너뛴다: [주①, 주③]이면 주② 조건 안이어도 주③ 조건 밖이면 주①', () => {
    const held = ['cloud-1', 'cloud-5'];
    expect(fire(main(held), held, 2000).fired.id).toBe('cloud-5');
    expect(fire(main(held), held, 2001)).toMatchObject({ fired: { id: 'cloud-1' }, tier: 1, upper: false });
  });

  it('주②가 나가면 그 종의 주② 효과가 붙는다 (주①·주③에는 없음)', () => {
    for (const sp of ['cloud', 'mushroom', 'fluff', 'legend-ghost'] as const) {
      const held = [`${sp}-1`, `${sp}-2`, `${sp}-5`];
      const b = skillButtons(held, sp)[0];
      expect(fire(b, held, 3000)).toMatchObject({ fired: { id: `${sp}-2` }, tier: 2, special: M2_EFFECT_OF_SPECIES[sp] });
      expect(fire(b, held, 0).special).toBeUndefined(); // 주③
      expect(fire(b, held, 6000).special).toBeUndefined(); // 주①
    }
  });

  it('부속성 버튼: 조건 이내면 부속성 기술, 넘으면 주① (주②가 있어도)', () => {
    const held = ['cloud-1', 'cloud-2', 'cloud-4'];
    const b = button(held, 'sub');
    const sub = fastSeconds(k('cloud-4'), T7) * 1000; // 4000
    const fast = fire(b, held, sub);
    expect(fast).toMatchObject({ fired: { id: 'cloud-4', basePower: 3 }, tier: 2, upper: true, usedFallback: false });
    expect(fast.special).toBeUndefined(); // 부속성에는 효과가 없다
    expect(fire(b, held, sub + 1)).toMatchObject({ fired: { id: 'cloud-1' }, tier: 1, upper: false, usedFallback: false });
    // 5초 문제: 3초
    expect(fire(b, held, 3000, 5000).fired.id).toBe('cloud-4');
    expect(fire(b, held, 3001, 5000).fired.id).toBe('cloud-1');
  });

  it('부속성 자리의 복사 기술은 자리 조건(SUB_FAST_RATIO)·위력 3으로 나간다', () => {
    // horn-5 원래 조건은 0.3(2초)이지만 부속성 자리에서는 0.5(4초)
    const held = ['cloud-1', 'horn-5'];
    const b = button(held, 'sub');
    expect(fire(b, held, 4000)).toMatchObject({ fired: { id: 'horn-5', basePower: 3, element: k('horn-5').element }, upper: true });
    expect(fire(b, held, 4001).fired.id).toBe('cloud-1');
  });

  it('특수 버튼: 조건 이내면 특수 효과, 못 풀면 가장 약한 속성 기술(주①)', () => {
    const held = ['cloud-1', 'cloud-2', 'cloud-3'];
    const b = button(held, 'special');
    const sp = fastSeconds(k('cloud-3'), T7) * 1000; // 4000
    expect(fire(b, held, sp)).toMatchObject({ fired: { id: 'cloud-3' }, special: 'heal', usedFallback: false, upper: false });
    const late = fire(b, held, sp + 1);
    expect(late).toMatchObject({ fired: { id: 'cloud-1' }, usedFallback: true, upper: false, tier: 1 });
    expect(late.special).toBeUndefined();
    // 5초 문제: 3초
    expect(fire(b, held, 3000, 5000).special).toBe('heal');
    expect(fire(b, held, 3001, 5000).usedFallback).toBe(true);
  });

  it('특수 실패: 복사한 다른 종 1번이 있어도 내 주①이 나간다 (자리 위력으로 가장 약함)', () => {
    const held = ['horn-1', 'cloud-1', 'cloud-3'];
    expect(fire(button(held, 'special'), held, 6000).fired.id).toBe('cloud-1');
  });

  it('복사한 특수도 같은 규칙 (그 특수 종류로)', () => {
    const held = ['cloud-1', 'jelly-3'];
    const b = button(held, 'special');
    expect(fire(b, held, 4000)).toMatchObject({ fired: { id: 'jelly-3' }, special: 'calm' });
    expect(fire(b, held, 4001)).toMatchObject({ fired: { id: 'cloud-1' }, usedFallback: true });
  });

  it('(깨진 목록 대비) 특수만 가졌으면 실패 때 특수 기술 자신이 대신 (효과 없음)', () => {
    const b: SkillButton = { kind: 'special', owner: 'cloud', skill: k('cloud-3') };
    const r = fire(b, ['cloud-3'], 6000);
    expect(r).toMatchObject({ fired: { id: 'cloud-3' }, usedFallback: true });
    expect(r.special).toBeUndefined();
  });
});
