import { describe, expect, it } from 'vitest';
import {
  M2_CYCLE, M2_EFFECT_OF_SPECIES, MAIN_SKILL_NAMES, SKILLS, SLOT_PATTERN, SPECIAL_CYCLE, SPECIAL_OF_SPECIES, SPECIAL_SKILL_NAMES, SUB_SKILL_NAMES,
  fastSeconds, skillDef, skillNamesOf, speciesSkills,
} from '../../src/domain/field/skills';
import { SUB_FAST_RATIO, TIER_RULES } from '../../src/domain/field/tuning';
import { ELEMENTS, MAIN_ELEMENT, SUB_ELEMENT } from '../../src/domain/field/elements';
import { SPECIES, SPECIES_IDS } from '../../src/domain/field/creatures';


describe('기술 고정표', () => {
  it('49종 x 5 = 245개, id는 종-슬롯', () => {
    expect(SKILLS).toHaveLength(245);
    for (const s of SPECIES) {
      const list = speciesSkills(s.id);
      expect(list.map((k) => k.slot)).toEqual([1, 2, 3, 4, 5]);
      for (const k of list) expect(k.id).toBe(`${s.id}-${k.slot}`);
    }
  });

  it('슬롯 패턴 고정 (개정 3: 주① 2·주② 2+효과·주③ 3·부속성 3·특수 2)', () => {
    expect(SLOT_PATTERN).toEqual([
      // 주①의 fastRatio는 판정에 쓰지 않는다 (주① = 느려도 나가는 기본)
      { slot: 1, kind: 'main', learnLevel: 1, basePower: 2, fastRatio: 0.6, fxIndex: 0 },
      { slot: 2, kind: 'main', learnLevel: 3, basePower: 2, fastRatio: 0.5, fxIndex: 1 },
      { slot: 3, kind: 'special', learnLevel: 8, basePower: 2, fastRatio: 0.5 },
      { slot: 4, kind: 'sub', learnLevel: 14, basePower: 3, fastRatio: SUB_FAST_RATIO, fxIndex: 3 },
      { slot: 5, kind: 'main', learnLevel: 20, basePower: 3, fastRatio: 0.3, fxIndex: 2 },
    ]);
    expect(SUB_FAST_RATIO).toBe(0.5);
  });

  it('주③의 조건 시간은 주②보다 짧다 (모든 단계의 문제 시간에서)', () => {
    const times = new Set(Object.values(TIER_RULES).map((r) => r.timeMs));
    for (const t of times) {
      expect(fastSeconds(skillDef('c034-5'), t)).toBeLessThan(fastSeconds(skillDef('c034-2'), t));
    }
  });

  it('각 기술의 값이 패턴과 같고 종류별 속성이 맞다', () => {
    for (const s of SPECIES) {
      const list = speciesSkills(s.id);
      for (const k of list) {
        const p = SLOT_PATTERN[k.slot - 1];
        expect([k.kind, k.learnLevel, k.basePower, k.fastRatio]).toEqual([p.kind, p.learnLevel, p.basePower, p.fastRatio]);
        if (k.kind === 'main') expect(k.element).toBe(MAIN_ELEMENT[s.id]);
        if (k.kind === 'sub') expect(k.element).toBe(SUB_ELEMENT[s.id]);
        if (k.kind === 'special') {
          expect(k.element).toBeUndefined();
          expect(k.special).toBe(SPECIAL_OF_SPECIES[s.id]);
        } else expect(k.special).toBeUndefined();
      }
      // 주속성 3번째(슬롯 5)는 마지막에 배운다
      expect(list[4].learnLevel).toBe(Math.max(...list.map((k) => k.learnLevel)));
    }
  });

  it('이름 틀: 속성마다 주속성 3개·부속성 1개, 특수 종류마다 1개 (빈 이름 없음, 한 틀 안에서는 겹치지 않음)', () => {
    for (const el of ELEMENTS) {
      const main = MAIN_SKILL_NAMES[el];
      expect(main).toHaveLength(3);
      expect(new Set(main).size).toBe(3);
      for (const n of [...main, SUB_SKILL_NAMES[el]]) expect(n.trim()).not.toBe('');
    }
    expect(Object.keys(SPECIAL_SKILL_NAMES).sort()).toEqual(['calm', 'charge', 'clue', 'guard', 'heal']);
    for (const s of SPECIES) {
      const names = skillNamesOf(s.id);
      expect(names).toHaveLength(5);
      const [m1, m2, m3] = MAIN_SKILL_NAMES[MAIN_ELEMENT[s.id]];
      expect([names[0], names[1], names[4]]).toEqual([m1, m2, m3]);
      expect(names[3]).toBe(SUB_SKILL_NAMES[SUB_ELEMENT[s.id]]);
      expect(names[2]).toBe(SPECIAL_SKILL_NAMES[SPECIAL_OF_SPECIES[s.id] as keyof typeof SPECIAL_SKILL_NAMES]);
    }
  });

  it('특수 배정 규칙: 종 차례대로 5가지를 돌아가며 (고르게 — 종류마다 9~10종)', () => {
    expect(SPECIAL_CYCLE).toEqual(['heal', 'guard', 'clue', 'calm', 'charge']);
    SPECIES_IDS.forEach((id, i) => expect(SPECIAL_OF_SPECIES[id]).toBe(SPECIAL_CYCLE[i % 5]));
    const count = new Map<string, number>();
    for (const id of SPECIES_IDS) count.set(SPECIAL_OF_SPECIES[id], (count.get(SPECIAL_OF_SPECIES[id]) ?? 0) + 1);
    for (const n of count.values()) expect(n === 9 || n === 10).toBe(true);
    // 스턴은 주②에만 (특수 슬롯에는 배정하지 않는다)
    expect(Object.values(SPECIAL_OF_SPECIES)).not.toContain('stun');
    // 시작 구구몬 고정값
    expect([SPECIAL_OF_SPECIES.c034, SPECIAL_OF_SPECIES.c035, SPECIAL_OF_SPECIES.c036]).toEqual(['clue', 'calm', 'charge']);
  });

  it('주② 효과 규칙: 스턴·회복·방어를 돌아가며, 그 종의 특수와 겹치면 다음 것', () => {
    expect(M2_CYCLE).toEqual(['stun', 'heal', 'guard']);
    for (const s of SPECIES) {
      expect(M2_CYCLE).toContain(M2_EFFECT_OF_SPECIES[s.id]);
      expect(M2_EFFECT_OF_SPECIES[s.id]).not.toBe(SPECIAL_OF_SPECIES[s.id]);
    }
    expect([M2_EFFECT_OF_SPECIES.c034, M2_EFFECT_OF_SPECIES.c035, M2_EFFECT_OF_SPECIES.c036]).toEqual(['guard', 'stun', 'heal']);
    // c001(특수 heal)은 차례상 stun
    expect(M2_EFFECT_OF_SPECIES.c001).toBe('stun');
  });

  it('종 표의 moves는 [슬롯1·2·5] 이름', () => {
    for (const s of SPECIES) {
      const n = speciesSkills(s.id).map((k) => k.name);
      expect(s.moves).toEqual([n[0], n[1], n[4]]);
    }
  });

  it('skillDef: 없는 id는 던진다', () => {
    expect(skillDef('c034-1').name).toBe('잎사귀 톡');
    expect(() => skillDef('nope-9')).toThrow();
  });
});
