import { describe, expect, it } from 'vitest';
import { SKILLS, skillDef, speciesSkills } from '../../src/domain/field/skills';
import { skillText } from '../../src/field/skillText';

describe('기술 글 (기술 표에서 계산)', () => {
  it('위력 별은 basePower 개수', () => {
    expect(skillText.power(skillDef('cloud-1'))).toBe('★★');
    expect(skillText.power(skillDef('cloud-5'))).toBe('★★★');
    for (const k of SKILLS) expect(skillText.power(k)).toMatch(/^★{2,3}$/);
  });

  it('종류 글: 주속성·부속성·특수', () => {
    expect(skillText.kind(skillDef('cloud-1'))).toBe('풀 · 주속성');
    expect(skillText.kind(skillDef('cloud-4'))).toBe('빛 · 부속성');
    expect(skillText.kind(skillDef('cloud-3'))).toBe('특수');
  });

  it('특수 설명 5종 (속성 기술은 없음)', () => {
    expect(skillText.special(skillDef('cloud-3'))).toContain('체력이 조금 회복돼요');
    expect(skillText.special(skillDef('mushroom-3'))).toBe('다음 적 공격이 약해져요');
    expect(skillText.special(skillDef('fluff-3'))).toBe('틀린 보기가 하나 사라져요');
    expect(skillText.special(skillDef('jelly-3'))).toBe('다음 문제 시간이 늘어요');
    expect(skillText.special(skillDef('antenna-3'))).toBe('다음 기술이 더 세져요');
    expect(skillText.special(skillDef('cloud-1'))).toBeNull();
  });

  it('발동 조건 글: 실제 문구', () => {
    expect(skillText.condition(skillDef('cloud-1'))).toBe('문제 시간의 60% 안에 풀면 강력!');
    expect(skillText.condition(skillDef('cloud-5'))).toBe('문제 시간의 40% 안에 풀면 강력!');
    expect(skillText.condition(skillDef('cloud-3'))).toBe('문제 시간의 50% 안에 풀면 회복! 못 풀면 약한 기술이 나가요');
    expect(skillText.condition(skillDef('mushroom-3'))).toBe('문제 시간의 50% 안에 풀면 방어! 못 풀면 약한 기술이 나가요');
  });

  it('출처 글', () => {
    expect(skillText.source({ species: 'cloud', skillId: 'cloud-2', source: 'level' })).toBe('Lv3에 배우는 기술이에요');
    expect(skillText.source({ species: 'cloud', skillId: 'horn-1', source: 'copy', fromSpecies: 'horn' })).toContain('뿔뿔몬');
    expect(skillText.learnLevel(skillDef('cloud-5'))).toBe('Lv20에 배워요');
  });

  it('모든 기술이 글을 만든다', () => {
    for (const k of SKILLS) {
      expect(skillText.kind(k)).toMatch(/^(특수|.+ · (주|부)속성)$/);
      expect(skillText.condition(k)).toMatch(/^문제 시간의 \d+% 안에 풀면 /);
    }
    expect(speciesSkills('cloud')).toHaveLength(5);
  });
});
