import { describe, expect, it } from 'vitest';
import {
  addStarPoints,
  planStatueQuestions,
  statueStars,
  type StatueItem,
} from '../../src/domain/field/starPoints';
import {
  STATUE_FAST_MS,
  STATUE_QUESTIONS,
  STATUE_SLOW_MS,
  STATUE_STARS_MAX,
  STATUE_STARS_MIN,
} from '../../src/domain/field/tuning';
import { initialFactStats, type FactStat } from '../../src/domain/mastery';
import { ALL_DANS } from '../../src/domain/facts';
import { seededRng } from '../../src/domain/random';

const keyOf = (q: StatueItem) => (q.kind === 'mult' ? `${q.dan}x${q.multiplier}` : `${q.a}${q.op}${q.b}`);

function factsWithWrong(ids: Record<string, number>): Record<string, FactStat> {
  const f: Record<string, FactStat> = { ...initialFactStats() };
  for (const [id, at] of Object.entries(ids)) f[id] = { ...f[id], lastWrongAt: at };
  return f;
}

describe('동상 별점수 (시간에 반비례)', () => {
  it('빠른 기준 이하면 15, 느린 기준 이상이면 5', () => {
    expect(statueStars(0)).toBe(STATUE_STARS_MAX);
    expect(statueStars(STATUE_FAST_MS)).toBe(15);
    expect(statueStars(STATUE_SLOW_MS)).toBe(5);
    expect(statueStars(STATUE_SLOW_MS * 3)).toBe(STATUE_STARS_MIN);
    expect(statueStars(Infinity)).toBe(5);
  });
  it('사이 값은 5~15이고 시간이 길수록 줄어든다(늘지 않는다)', () => {
    let prev = Infinity;
    for (let t = STATUE_FAST_MS; t <= STATUE_SLOW_MS; t += 500) {
      const s = statueStars(t);
      expect(Number.isInteger(s)).toBe(true);
      expect(s).toBeGreaterThanOrEqual(5);
      expect(s).toBeLessThanOrEqual(15);
      expect(s).toBeLessThanOrEqual(prev);
      prev = s;
    }
  });
  it('반비례 식: 35초는 round(5 + 10 × (1/35 − 1/70) / (1/20 − 1/70))', () => {
    const want = Math.round(5 + (10 * (1 / 35000 - 1 / 70000)) / (1 / 20000 - 1 / 70000));
    expect(statueStars(35000)).toBe(want);
    expect(want).toBe(9);
  });
  it('이상한 시간(NaN·음수)은 가장 적게', () => {
    expect(statueStars(NaN)).toBe(5);
    expect(statueStars(-1)).toBe(5);
  });
});

describe('addStarPoints (순수)', () => {
  it('0 이상 정수만 더한다', () => {
    expect(addStarPoints(0, 5)).toBe(5);
    expect(addStarPoints(7, 3)).toBe(10);
    expect(addStarPoints(7, -3)).toBe(7);
    expect(addStarPoints(7, 1.5)).toBe(7);
    expect(addStarPoints(7, NaN)).toBe(7);
    expect(addStarPoints(-2, 3)).toBe(3);
  });
});

describe('동상 문제 계획 — 구구단', () => {
  it('7문제, 12·13단이 하나 이상, 중복 없음, ALL_DANS의 ×1~×9만', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const qs = planStatueQuestions({ facts: initialFactStats(), lowGrade: false, rng: seededRng(seed) });
      expect(qs).toHaveLength(STATUE_QUESTIONS);
      expect(qs.every((q) => q.kind === 'mult')).toBe(true);
      const mult = qs.filter((q): q is Extract<StatueItem, { kind: 'mult' }> => q.kind === 'mult');
      expect(mult.some((q) => q.dan === 12 || q.dan === 13)).toBe(true);
      expect(new Set(qs.map(keyOf)).size).toBe(qs.length);
      for (const q of mult) {
        expect((ALL_DANS as readonly number[]).includes(q.dan)).toBe(true);
        expect(q.dan).not.toBe(11);
        expect(q.multiplier).toBeGreaterThanOrEqual(1);
        expect(q.multiplier).toBeLessThanOrEqual(9);
      }
    }
  });
  it('최근에 틀린 문제를 먼저 넣는다', () => {
    const facts = factsWithWrong({ '7x8': 300, '6x7': 200, '3x4': 100 });
    const qs = planStatueQuestions({ facts, lowGrade: false, rng: seededRng(3) });
    const keys = qs.map(keyOf);
    for (const k of ['7x8', '6x7', '3x4']) expect(keys).toContain(k);
  });
  it('틀린 문제가 많아도 12·13단은 꼭 하나', () => {
    const many: Record<string, number> = {};
    [2, 3, 4, 5].forEach((d, i) => [1, 2, 3].forEach((m, j) => (many[`${d}x${m}`] = 1000 - i * 10 - j)));
    const qs = planStatueQuestions({ facts: factsWithWrong(many), lowGrade: false, rng: seededRng(9) });
    expect(qs).toHaveLength(7);
    expect(qs.some((q) => q.kind === 'mult' && (q.dan === 12 || q.dan === 13))).toBe(true);
    // 나머지 6개는 가장 최근에 틀린 6개
    const keys = qs.map(keyOf);
    for (const k of ['2x1', '2x2', '2x3', '3x1', '3x2', '3x3']) expect(keys).toContain(k);
  });
  it('12·13단에서 틀린 문제가 있으면 그 문제를 고른다', () => {
    const qs = planStatueQuestions({ facts: factsWithWrong({ '13x7': 50 }), lowGrade: false, rng: seededRng(5) });
    expect(qs.map(keyOf)).toContain('13x7');
  });
  it('필드를 주면 그 필드 단으로 채운다 (12·13단 하나 빼고)', () => {
    const qs = planStatueQuestions({ facts: initialFactStats(), lowGrade: false, field: 'desert', rng: seededRng(2) });
    const others = qs.filter((q) => q.kind === 'mult' && q.dan !== 12 && q.dan !== 13);
    for (const q of others) if (q.kind === 'mult') expect([5, 7]).toContain(q.dan);
  });
});

describe('동상 문제 계획 — 저학년(덧뺄셈)', () => {
  const makeArith = (rng: () => number) => {
    const a = 1 + Math.floor(rng() * 9);
    const b = 1 + Math.floor(rng() * 9);
    return rng() < 0.5 ? { a, op: '+' as const, b } : { a: Math.max(a, b), op: '−' as const, b: Math.min(a, b) };
  };
  it('덧뺄셈 7개, 중복 없음, 12·13단 규칙 없음', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const qs = planStatueQuestions({ facts: initialFactStats(), lowGrade: true, rng: seededRng(seed), makeArith });
      expect(qs).toHaveLength(7);
      expect(qs.every((q) => q.kind === 'arith')).toBe(true);
      expect(new Set(qs.map(keyOf)).size).toBe(7);
    }
  });
  it('최근에 틀린 덧뺄셈을 먼저 넣는다 (중복은 하나만)', () => {
    const recentWrongArith = [
      { a: 8, op: '+' as const, b: 7 },
      { a: 15, op: '−' as const, b: 8 },
      { a: 8, op: '+' as const, b: 7 },
    ];
    const qs = planStatueQuestions({ facts: initialFactStats(), lowGrade: true, rng: seededRng(4), makeArith, recentWrongArith });
    const keys = qs.map(keyOf);
    expect(keys.slice(0, 2)).toEqual(['8+7', '15−8']);
    expect(keys.filter((k) => k === '8+7')).toHaveLength(1);
    expect(qs).toHaveLength(7);
  });
});
