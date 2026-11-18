import { describe, expect, it } from 'vitest';
import { SKILLS, skillDef, speciesSkills } from '../../src/domain/field/skills';
import { skillText } from '../../src/field/skillText';

describe('기술 글 (기술 표에서 계산)', () => {
  it('위력 별은 basePower 개수', () => {
    expect(skillText.power(skillDef('c016-1'))).toBe('★★');
    expect(skillText.power(skillDef('c016-5'))).toBe('★★★');
    for (const k of SKILLS) expect(skillText.power(k)).toMatch(/^★{2,3}$/);
  });

  it('종류 글: 주속성·부속성·특수', () => {
    expect(skillText.kind(skillDef('c016-1'))).toBe('풀 · 주속성');
    expect(skillText.kind(skillDef('c016-4'))).toBe('번개 · 부속성');
    expect(skillText.kind(skillDef('c016-3'))).toBe('특수');
  });

  it('특수 설명 5종 (속성 기술은 없음)', () => {
    expect(skillText.special(skillDef('c016-3'))).toContain('체력이 조금 회복돼요');
    expect(skillText.special(skillDef('c002-3'))).toBe('다음 적 공격이 약해져요');
    expect(skillText.special(skillDef('c003-3'))).toBe('틀린 보기가 하나 사라져요');
    expect(skillText.special(skillDef('c004-3'))).toBe('다음 문제 시간이 늘어요');
    expect(skillText.special(skillDef('c005-3'))).toBe('다음 기술이 더 세져요');
    expect(skillText.special(skillDef('c016-1'))).toBeNull();
  });

  it('단계별 시간 조건 글: 고르기 버튼과 같은 함수 (7초 문제 기준)', () => {
    expect(skillText.lines(skillDef('c016-1'), 'c016')).toEqual(['1번 잎사귀 톡']);
    expect(skillText.lines(skillDef('c016-2'), 'c016')).toEqual(['4초 안: 2번 덩굴 휘리릭 +기절']);
    expect(skillText.lines(skillDef('c016-5'), 'c016')).toEqual(['2초 안: 3번 꽃잎 바람']);
    expect(skillText.lines(skillDef('c016-4'), 'c016')).toEqual(['4초 안: 찌릿 번개공(부속성)', '그보다 느리면 1번 잎사귀 톡']);
    expect(skillText.lines(skillDef('c016-3'), 'c016')).toEqual(['4초 안: 회복 효과', '못 풀면 약한 기술']);
    // 다른 종 속성 기술은 부속성 자리 값(부속성 조건)으로
    expect(skillText.lines(skillDef('c031-1'), 'c016')[0]).toBe('4초 안: 물방울 톡(부속성)');
  });

  it('M2 특수효과(스턴·회복·방어): 자기 종 주속성 2번만, 복사해 부속성 자리에 앉으면 없음', () => {
    expect(skillText.effect(skillDef('c016-2'), 'c016')).toBe('빨리 풀면: 다음 적 공격을 한 번 막아요');
    expect(skillText.effect(skillDef('c002-2'), 'c002')).toBe('빨리 풀면: 체력이 조금 회복돼요');
    expect(skillText.effect(skillDef('c003-2'), 'c003')).toBe('빨리 풀면: 다음 적 공격이 약해져요');
    expect(skillText.effect(skillDef('c016-1'), 'c016')).toBeNull();
    expect(skillText.effect(skillDef('c016-5'), 'c016')).toBeNull();
    expect(skillText.effect(skillDef('c016-2'), 'c002')).toBeNull();
    expect(skillText.effect(skillDef('c016-3'), 'c016')).toBe(skillText.special(skillDef('c016-3')));
  });

  it('주인 종을 주면 자리로 본 종류·위력 (복사 기술은 부속성 자리 위력)', () => {
    expect(skillText.kind(skillDef('c031-1'), 'c016')).toMatch(/ · 부속성$/);
    expect(skillText.kind(skillDef('c016-1'), 'c016')).toBe('풀 · 주속성');
    expect(skillText.power(skillDef('c031-1'), 'c016')).toBe('★★★');
    expect(skillText.power(skillDef('c031-1'))).toBe('★★');
  });

  it('자리 이름', () => {
    expect(skillText.seatName('main')).toBe('주속성 사슬');
    expect(skillText.seatName('sub')).toBe('부속성 자리');
    expect(skillText.seatName('special')).toBe('특수 자리');
  });

  it('출처 글', () => {
    expect(skillText.source({ species: 'c016', skillId: 'c016-2', source: 'level', seat: 'main' })).toBe('Lv3에 배우는 기술이에요');
    expect(skillText.source({ species: 'c016', skillId: 'c031-1', source: 'copy', fromSpecies: 'c031', seat: 'sub' })).toContain('블루베리곰몬');
    expect(skillText.learnLevel(skillDef('c016-5'))).toBe('Lv20에 배워요');
  });

  it('모든 기술이 글을 만든다', () => {
    for (const k of SKILLS) {
      expect(skillText.kind(k)).toMatch(/^(특수|.+ · (주|부)속성)$/);
      expect(skillText.lines(k, k.species).length).toBeGreaterThan(0);
    }
    expect(speciesSkills('c016')).toHaveLength(5);
  });
});
