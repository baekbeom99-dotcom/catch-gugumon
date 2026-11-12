import { describe, expect, it } from 'vitest';
import { ELEMENT_FX, SPECIAL_FX, STRONG_FX } from '../../src/domain/field/elements';
import { skillDef } from '../../src/domain/field/skills';
import { TIER_RULES } from '../../src/domain/field/tuning';
import { createWild, type WildState } from '../../src/domain/field/wildBattle';
import { answerWithSkill, foeSkill, heldSkills, hitMessage, skillFxName, skillMatchup } from '../../src/field/battle/skillUse';

const k = (id: string) => skillDef(id);
/** 보통 단계(7초) 문제 하나: 경과 시간만 정해 둔다 */
const at = (elapsedMs: number, over: Partial<WildState> = {}): WildState => ({ ...createWild('normal', 5, 100), elapsedMs, ...over });

describe('전투 기술: 가진 기술과 고르기 단계', () => {
  it('저장된 기술 목록을 기술 표로 바꾼다 (없으면 그 레벨의 기본 기술)', () => {
    expect(heldSkills('cloud', { level: 20, skills: ['cloud-1', 'cloud-3'] }).map((d) => d.id)).toEqual(['cloud-1', 'cloud-3']);
    expect(heldSkills('cloud', { level: 1, skills: [] }).map((d) => d.id)).toEqual(['cloud-1']);
    expect(heldSkills('cloud', undefined).map((d) => d.id)).toEqual(['cloud-1']);
  });
  it('기술 1개면 고르기 없이 바로 문제, 2개 이상이면 고르기부터', () => {
    const one = heldSkills('cloud', { level: 5, skills: ['cloud-1'] });
    const two = heldSkills('cloud', { level: 5, skills: ['cloud-1', 'cloud-2'] });
    expect(createWild('normal', 5, 100, one.length).phase).toBe('question');
    expect(createWild('normal', 5, 100, two.length).phase).toBe('pick');
  });
});

describe('전투 기술: answerWithSkill (빠르게 스위치·문제 시간)', () => {
  it('스위치가 없으면 실제 경과 시간으로 판정', () => {
    // 잎사귀 톡: 7초 × 0.6 → 4초
    expect(answerWithSkill(at(4000), k('cloud-1'), ['cloud-1'], 'light', null).fast).toBe(true);
    expect(answerWithSkill(at(4001), k('cloud-1'), ['cloud-1'], 'light', null).fast).toBe(false);
  });
  it('빠르게 스위치 true면 늘 강력, false면 늘 평소 (경과 시간은 그대로 둔다)', () => {
    const slow = answerWithSkill(at(6500), k('cloud-1'), ['cloud-1'], 'light', true);
    expect(slow.fast).toBe(true);
    expect(slow.state).toMatchObject({ cells: 3, elapsedMs: 6500 });
    const quick = answerWithSkill(at(0), k('cloud-1'), ['cloud-1'], 'light', false);
    expect(quick.fast).toBe(false);
    expect(quick.state).toMatchObject({ cells: 2, elapsedMs: 0 });
  });
  it('특수: 스위치 true면 발동, false면 약한 기술이 대신', () => {
    expect(answerWithSkill(at(6500), k('cloud-3'), ['cloud-1', 'cloud-3'], 'light', true).special).toBe('heal');
    const late = answerWithSkill(at(0), k('cloud-3'), ['cloud-1', 'cloud-3'], 'light', false);
    expect(late).toMatchObject({ usedFallback: true, fast: false });
    expect(late.fired.id).toBe('cloud-1');
  });
  it('강력 기준은 그 단계 문제 시간(TIER_RULES)만 — 여유로 늘어난 시간은 넣지 않는다', () => {
    // 여유로 10초가 된 문제에서 4.5초 걸림: 7초 기준 4초를 넘었으니 강력 아님 (10초 기준이면 6초라 강력이 된다)
    const s = at(4500, { timeLeftMs: 5500 });
    expect(answerWithSkill(s, k('cloud-1'), ['cloud-1'], 'light', null).fast).toBe(false);
    // 화나서 강력(5초)이 되면 그 단계 시간으로: 5초 × 0.6 = 3초
    const m = { ...createWild('mighty', 15, 100), elapsedMs: 3000 };
    expect(TIER_RULES.mighty.timeMs).toBe(5000);
    expect(answerWithSkill(m, k('cloud-1'), ['cloud-1'], 'light', null).fast).toBe(true);
    expect(answerWithSkill({ ...m, elapsedMs: 3001 }, k('cloud-1'), ['cloud-1'], 'light', null).fast).toBe(false);
  });
  it('빠르게 스위치 true는 틀린 뒤 같은 문제(missed)여도 이긴다, 상태의 missed는 그대로', () => {
    const r = answerWithSkill(at(0, { missed: true }), k('cloud-1'), ['cloud-1'], 'light', true);
    expect(r.fast).toBe(true);
    expect(r.state.missed).toBe(true);
    expect(answerWithSkill(at(0, { missed: true }), k('cloud-1'), ['cloud-1'], 'light', null).fast).toBe(false);
  });
  it('문제 단계가 아니면 상태 그대로 (스위치가 있어도)', () => {
    const p = at(0, { phase: 'pick' });
    expect(answerWithSkill(p, k('cloud-1'), ['cloud-1'], 'light', true).state).toBe(p);
  });
});

describe('전투 기술: 상성·효과 이름·적의 기술', () => {
  it('상성: 속성 기술만 (특수는 null)', () => {
    expect(skillMatchup(k('cloud-1'), 'water')).toBe(1);
    expect(skillMatchup(k('cloud-1'), 'fire')).toBe(-1);
    expect(skillMatchup(k('cloud-1'), 'light')).toBe(0);
    expect(skillMatchup(k('cloud-3'), 'water')).toBeNull();
  });
  it('효과 이름: 속성 기술은 fxIndex 칸(부속성은 4번째), 강력이면 강력 효과, 특수는 특수 효과', () => {
    expect(skillFxName(k('cloud-1'), false)).toBe(ELEMENT_FX.grass[0]);
    expect(skillFxName(k('cloud-2'), false)).toBe(ELEMENT_FX.grass[1]);
    expect(skillFxName(k('cloud-5'), false)).toBe(ELEMENT_FX.grass[2]);
    expect(skillFxName(k('cloud-4'), false)).toBe(ELEMENT_FX.light[3]);
    expect(skillFxName(k('cloud-1'), true)).toBe(STRONG_FX.grass[0]);
    expect(skillFxName(k('cloud-4'), true)).toBe(STRONG_FX.light[3]);
    expect(skillFxName(k('cloud-3'), false)).toBe(SPECIAL_FX.heal);
    expect(skillFxName(k('mushroom-3'), true)).toBe(SPECIAL_FX.guard);
  });
  it('적의 기술: 그 레벨에서 익힌 속성 기술 중 무작위 (특수 제외)', () => {
    expect(foeSkill('cloud', 2, () => 0.99).id).toBe('cloud-1');
    expect(foeSkill('cloud', 10, () => 0).id).toBe('cloud-1');
    expect(foeSkill('cloud', 10, () => 0.99).id).toBe('cloud-2'); // 3번(특수)은 안 나온다
    const seen = new Set<string>();
    for (let i = 0; i < 20; i++) seen.add(foeSkill('cloud', 20, () => i / 20).id);
    expect([...seen].sort()).toEqual(['cloud-1', 'cloud-2', 'cloud-4', 'cloud-5']);
    expect(foeSkill('legend-horn', 20, () => 0).name).toMatch(/^황금/);
  });
});

describe('전투 기술: 정답 글 hitMessage', () => {
  it('회복 특수는 실제로 늘어난 체력만 쓰고, 0이면 이미 가득', () => {
    const heal = answerWithSkill(at(0, { allyHp: 90 }), k('cloud-3'), ['cloud-1', 'cloud-3'], 'light', true);
    expect(hitMessage(heal, 'light', 10)).toBe('새싹 쑥쑥! 체력을 10 되찾았어요!');
    expect(hitMessage(heal, 'light', 25)).toBe('새싹 쑥쑥! 체력을 25 되찾았어요!');
    expect(hitMessage(heal, 'light', 0)).toBe('새싹 쑥쑥! 체력이 이미 가득해요!');
  });
  it('강력·대신 나감·상성 줄', () => {
    expect(hitMessage(answerWithSkill(at(0), k('cloud-1'), ['cloud-1'], 'water', true), 'water', 0)).toBe('잎사귀 톡! 강력!\n효과가 커요! ▲');
    expect(hitMessage(answerWithSkill(at(0), k('cloud-1'), ['cloud-1'], 'light', false), 'light', 0)).toBe('잎사귀 톡! 명중!');
    expect(hitMessage(answerWithSkill(at(0), k('cloud-3'), ['cloud-1', 'cloud-3'], 'fire', false), 'fire', 0)).toBe(
      '시간이 지나서 약한 기술이 나갔어요. 잎사귀 톡!\n별로예요… ▼',
    );
  });
});
