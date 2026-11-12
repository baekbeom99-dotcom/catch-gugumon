import { describe, expect, it } from 'vitest';
import { M2_EFFECT_OF_SPECIES, SKILLS, SKILL_NAMES, SLOT_PATTERN, SPECIAL_OF_SPECIES, fastSeconds, skillDef, speciesSkills } from '../../src/domain/field/skills';
import { SUB_FAST_RATIO, TIER_RULES } from '../../src/domain/field/tuning';
import { MAIN_ELEMENT, SUB_ELEMENT } from '../../src/domain/field/elements';
import { SPECIES } from '../../src/domain/field/creatures';

const OLD_MOVES: Record<string, [string, string, string]> = {
  cloud: ['잎사귀 톡', '새싹 휙', '꽃잎 바람'],
  mushroom: ['방울 딸랑', '데굴데굴', '무 박치기'],
  fluff: ['왕관 반짝', '꼬리 흔들기', '몸통 박치기'],
  jelly: ['젤리 톡', '출렁 박치기', '거품 뿜기'],
  antenna: ['안테나 찌릿', '신호 빔', '빙글 돌기'],
  horn: ['뿔 콕', '돌진', '물결 치기'],
  pebble: ['블록 쾅', '세눈 빔', '단단해지기'],
  ghost: ['외뿔 찌르기', '꼬리 휘두르기', '공룡 함성'],
  'legend-fluff': ['황금 왕관 빛', '반짝 별가루', '금빛 박치기'],
  'legend-horn': ['황금 뿔 콕', '금빛 돌진', '반짝 물결'],
  'legend-ghost': ['황금 외뿔 찌르기', '금빛 꼬리치기', '황금 함성'],
};

describe('기술 고정표', () => {
  it('11종 x 5 = 55개, id는 종-슬롯', () => {
    expect(SKILLS).toHaveLength(55);
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
      expect(fastSeconds(skillDef('cloud-5'), t)).toBeLessThan(fastSeconds(skillDef('cloud-2'), t));
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

  it('이름: 빈 이름·중복 없음, 슬롯 1·2·5는 예전 이름', () => {
    const all = SKILLS.map((k) => k.name);
    for (const n of all) expect(n.trim()).not.toBe('');
    expect(new Set(all).size).toBe(all.length);
    for (const [id, old] of Object.entries(OLD_MOVES)) {
      const names = SKILL_NAMES[id as keyof typeof SKILL_NAMES];
      expect(names).toHaveLength(5);
      expect([names[0], names[1], names[4]]).toEqual(old);
    }
  });

  it('주② 효과 배정표 (스턴·회복·방어, 그 종의 특수 슬롯 효과와 겹치지 않음)', () => {
    expect(M2_EFFECT_OF_SPECIES).toEqual({
      cloud: 'stun',
      mushroom: 'heal',
      fluff: 'guard',
      jelly: 'stun',
      antenna: 'heal',
      horn: 'stun',
      pebble: 'guard',
      ghost: 'heal',
      'legend-fluff': 'stun',
      'legend-horn': 'guard',
      'legend-ghost': 'heal',
    });
    for (const s of SPECIES) expect(M2_EFFECT_OF_SPECIES[s.id]).not.toBe(SPECIAL_OF_SPECIES[s.id]);
    // 스턴은 주②에만 (특수 슬롯에는 배정하지 않는다)
    expect(Object.values(SPECIAL_OF_SPECIES)).not.toContain('stun');
  });

  it('특수 배정표', () => {
    expect(SPECIAL_OF_SPECIES).toEqual({
      cloud: 'heal',
      'legend-horn': 'heal',
      mushroom: 'guard',
      horn: 'guard',
      fluff: 'clue',
      'legend-fluff': 'clue',
      jelly: 'calm',
      ghost: 'calm',
      antenna: 'charge',
      pebble: 'charge',
      'legend-ghost': 'charge',
    });
  });

  it('종 표의 moves는 옛 이름 [슬롯1·2·5]와 같다', () => {
    for (const s of SPECIES) {
      const n = speciesSkills(s.id).map((k) => k.name);
      expect(s.moves).toEqual([n[0], n[1], n[4]]);
      expect(s.moves).toEqual(OLD_MOVES[s.id]);
    }
  });

  it('skillDef: 없는 id는 던진다', () => {
    expect(skillDef('cloud-1').name).toBe('잎사귀 톡');
    expect(() => skillDef('nope-9')).toThrow();
  });
});
