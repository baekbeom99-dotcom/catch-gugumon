import { describe, expect, it } from 'vitest';
import { getFact } from '../../src/domain/facts';
import { FIELDS, LEGEND_DAN } from '../../src/domain/field/fields';
import { FIELD_TYPES } from '../../src/domain/field/fieldQuestions';
import { HEAL_QUESTIONS } from '../../src/domain/field/tuning';
import { planHealQuestions } from '../../src/domain/field/wounds';
import { initialFactStats } from '../../src/domain/mastery';
import { seededRng } from '../../src/domain/random';

describe('회복약 연습 문제: 틀린 문제 중심', () => {
  it('틀린 기록이 하나도 없으면 그 구구몬 필드의 단에서만, 서로 다른 문제로 나온다', () => {
    for (const field of ['meadow', 'waterside', 'desert'] as const) {
      for (let seed = 1; seed <= 10; seed++) {
        const plan = planHealQuestions(initialFactStats(), field, false, seededRng(seed));
        expect(plan).toHaveLength(HEAL_QUESTIONS);
        expect(new Set(plan.map((w) => w.factId)).size).toBe(HEAL_QUESTIONS);
        for (const w of plan) {
          expect(FIELDS[field].dans.filter((d) => d !== 12)).toContain(getFact(w.factId).a);
          expect(FIELD_TYPES).toContain(w.type);
        }
      }
    }
  });
  it('황금 구구몬이면 13단', () => {
    const plan = planHealQuestions(initialFactStats(), 'legend', true, seededRng(2));
    expect(plan.every((w) => getFact(w.factId).a === LEGEND_DAN)).toBe(true);
  });
  it('틀린 문제를 가장 최근에 틀린 순으로 먼저, 다른 단이어도 나온다', () => {
    const facts = initialFactStats();
    facts['4x7'].lastWrongAt = 300;
    facts['9x6'].lastWrongAt = 200;
    facts['2x3'].lastWrongAt = 100;
    const plan = planHealQuestions(facts, 'desert', false, seededRng(1));
    expect(plan.slice(0, 3).map((w) => w.factId)).toEqual(['4x7', '9x6', '2x3']);
    expect(plan).toHaveLength(HEAL_QUESTIONS);
    // 모자란 칸은 그 필드(사막 5·7단)로 채운다
    for (const w of plan.slice(3)) expect([5, 7]).toContain(getFact(w.factId).a);
  });
  it('틀린 기록이 많으면 최근 것 HEAL_QUESTIONS개만', () => {
    const facts = initialFactStats();
    ['2x2', '2x3', '2x4', '2x5', '2x6', '2x7', '2x8'].forEach((id, i) => (facts[id].lastWrongAt = 100 + i));
    const plan = planHealQuestions(facts, 'meadow', false, seededRng(1));
    expect(plan.map((w) => w.factId)).toEqual(['2x8', '2x7', '2x6', '2x5', '2x4']);
  });
});
