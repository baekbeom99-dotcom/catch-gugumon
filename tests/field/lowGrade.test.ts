import { describe, expect, it } from 'vitest';
import { seededRng } from '../../src/domain/random';
import { hasBorrow, hasCarry } from '../../src/domain/arith';
import {
  checkLowGradePassword,
  generateLowGrade,
  isLowGradeProblem,
  lowGradeAnswer,
  lowGradeArithMaker,
  lowGradeChoices,
  type LowGradeProblem,
  planLowGradeField,
  planLowGradeHeal,
  planLowGradeShop,
  pushLowGradeWrong,
  sameLowGrade,
} from '../../src/domain/field/lowGrade';
import { planStatueQuestions } from '../../src/domain/field/starPoints';
import { HEAL_QUESTIONS, LOWGRADE_SHOP_QUESTIONS, LOWGRADE_WRONG_KEEP } from '../../src/domain/field/tuning';

const RUNS = 1000;
const p = (a: number, op: '+' | '−', b: number): LowGradeProblem => ({ a, op, b, result: op === '+' ? a + b : a - b });
const isInt = (n: number) => Number.isInteger(n);

describe('generateLowGrade — 필드별 범위 (1000번)', () => {
  it('초원: 한 자리끼리 덧셈(결과 ≤ 18)·뺄셈(큰 수 − 작은 수, 결과 ≥ 0)이 섞인다', () => {
    const rng = seededRng(11);
    let add = 0;
    let sub = 0;
    for (let i = 0; i < RUNS; i++) {
      const q = generateLowGrade(rng, 'meadow');
      expect(isLowGradeProblem(q)).toBe(true);
      expect(q.a).toBeGreaterThanOrEqual(1);
      expect(q.a).toBeLessThanOrEqual(9);
      expect(q.b).toBeGreaterThanOrEqual(1);
      expect(q.b).toBeLessThanOrEqual(9);
      if (q.op === '+') {
        add++;
        expect(q.result).toBe(q.a + q.b);
        expect(q.result).toBeLessThanOrEqual(18);
      } else {
        sub++;
        expect(q.a).toBeGreaterThanOrEqual(q.b);
        expect(q.result).toBe(q.a - q.b);
        expect(q.result).toBeGreaterThanOrEqual(0);
      }
    }
    expect(add).toBeGreaterThan(300);
    expect(sub).toBeGreaterThan(300);
  });

  it('물가: 두 자리 − 한 자리, 결과 ≥ 1, 받아내림 있음·없음이 둘 다 나온다', () => {
    const rng = seededRng(22);
    let borrow = 0;
    let plain = 0;
    for (let i = 0; i < RUNS; i++) {
      const q = generateLowGrade(rng, 'waterside');
      expect(isLowGradeProblem(q)).toBe(true);
      expect(q.op).toBe('−');
      expect(q.a).toBeGreaterThanOrEqual(10);
      expect(q.a).toBeLessThanOrEqual(99);
      expect(q.b).toBeGreaterThanOrEqual(1);
      expect(q.b).toBeLessThanOrEqual(9);
      expect(q.result).toBe(q.a - q.b);
      expect(q.result).toBeGreaterThanOrEqual(1);
      if (hasBorrow(q.a, q.b)) borrow++;
      else plain++;
    }
    expect(borrow).toBeGreaterThan(100);
    expect(plain).toBeGreaterThan(100);
  });

  it('사막: 두 자리 + 한 자리, 결과는 두 자리(≤ 99), 받아올림 있음·없음이 섞인다', () => {
    const rng = seededRng(33);
    let carry = 0;
    let plain = 0;
    for (let i = 0; i < RUNS; i++) {
      const q = generateLowGrade(rng, 'desert');
      expect(isLowGradeProblem(q)).toBe(true);
      expect(q.op).toBe('+');
      expect(q.a).toBeGreaterThanOrEqual(10);
      expect(q.a).toBeLessThanOrEqual(99);
      expect(q.b).toBeGreaterThanOrEqual(1);
      expect(q.b).toBeLessThanOrEqual(9);
      expect(q.result).toBe(q.a + q.b);
      expect(q.result).toBeLessThanOrEqual(99);
      if (hasCarry(q.a, q.b)) carry++;
      else plain++;
    }
    expect(carry).toBeGreaterThan(100);
    expect(plain).toBeGreaterThan(100);
  });
});

describe('lowGradeChoices — 3지선다', () => {
  it('필드마다 1000번: 3개·정답 포함·중복 없음·음수 없음·정수', () => {
    for (const field of ['meadow', 'waterside', 'desert'] as const) {
      const rng = seededRng(field.length * 7);
      for (let i = 0; i < RUNS; i++) {
        const q = generateLowGrade(rng, field);
        const c = lowGradeChoices(rng, q);
        expect(c.length).toBe(3);
        expect(c).toContain(q.result);
        expect(new Set(c).size).toBe(3);
        for (const n of c) {
          expect(n).toBeGreaterThanOrEqual(0);
          expect(isInt(n)).toBe(true);
        }
      }
    }
  });

  it('답이 99 이하면 세 자리 보기가 없다 (물가·사막 1000번, 답 90 이상 포함)', () => {
    for (const q of [p(91, '+', 8), p(95, '+', 4), p(99, '−', 1), p(98, '−', 9)]) {
      const rng = seededRng(q.a);
      for (let i = 0; i < 200; i++) {
        const c = lowGradeChoices(rng, q);
        expect(c.length).toBe(3);
        expect(new Set(c).size).toBe(3);
        expect(c).toContain(q.result);
        expect(c.every((n) => n >= 0 && n <= 99)).toBe(true);
      }
    }
    for (const field of ['waterside', 'desert'] as const) {
      const rng = seededRng(field.length);
      for (let i = 0; i < RUNS; i++) {
        const q = generateLowGrade(rng, field);
        expect(lowGradeChoices(rng, q).every((n) => n <= 99)).toBe(true);
      }
    }
  });

  it('답이 0이어도 음수 보기가 없다', () => {
    const rng = seededRng(5);
    for (let i = 0; i < 200; i++) {
      const c = lowGradeChoices(rng, p(4, '−', 4));
      expect(c).toContain(0);
      expect(c.every((n) => n >= 0)).toBe(true);
      expect(new Set(c).size).toBe(3);
    }
  });

  it('오답은 그럴듯한 수(±1·±10·자리 바꿈·반대 셈) 중에서 나온다', () => {
    const q = p(52, '−', 7); // 45
    const plausible = new Set([44, 46, 35, 55, 54, 59]);
    const rng = seededRng(9);
    for (let i = 0; i < 200; i++) {
      for (const n of lowGradeChoices(rng, q)) if (n !== 45) expect(plausible.has(n)).toBe(true);
    }
  });

  it('정답 자리가 한 곳에 몰리지 않는다', () => {
    const rng = seededRng(3);
    const at = [0, 0, 0];
    for (let i = 0; i < 900; i++) {
      const q = generateLowGrade(rng, 'meadow');
      at[lowGradeChoices(rng, q).indexOf(q.result)]++;
    }
    for (const n of at) expect(n).toBeGreaterThan(200);
  });
});

describe('문제 계획', () => {
  it('planLowGradeField: n개, 그 필드 모양, 가능하면 겹치지 않는다', () => {
    const list = planLowGradeField(seededRng(1), 'waterside', 8);
    expect(list.length).toBe(8);
    expect(list.every((q) => q.op === '−' && q.a >= 10)).toBe(true);
    expect(new Set(list.map((q) => `${q.a}${q.op}${q.b}`)).size).toBe(8);
    expect(planLowGradeField(seededRng(1), 'meadow', 0)).toEqual([]);
  });

  it('planLowGradeShop: 5개', () => {
    expect(LOWGRADE_SHOP_QUESTIONS).toBe(5);
    for (const f of ['meadow', 'waterside', 'desert'] as const) {
      const list = planLowGradeShop(seededRng(2), f);
      expect(list.length).toBe(5);
      expect(list.every(isLowGradeProblem)).toBe(true);
    }
    expect(planLowGradeShop(seededRng(2), 'desert').every((q) => q.op === '+' && q.result <= 99)).toBe(true);
  });

  it('planLowGradeHeal: 틀린 문제를 최근 순으로 먼저, 모자라면 그 필드 무작위로 n개', () => {
    const wrong = [p(5, '+', 6), p(9, '−', 3), p(42, '−', 5)];
    const list = planLowGradeHeal(wrong, seededRng(4), 5, 'desert');
    expect(list.length).toBe(5);
    expect(list.slice(0, 3)).toEqual(wrong);
    for (const q of list.slice(3)) {
      expect(q.op).toBe('+');
      expect(q.a).toBeGreaterThanOrEqual(10);
    }
    const keys = list.map((q) => `${q.a}${q.op}${q.b}`);
    expect(new Set(keys).size).toBe(5);
  });

  it('planLowGradeHeal: 틀린 문제가 많으면 앞의 n개만, 없으면 전부 무작위', () => {
    const many = Array.from({ length: 8 }, (_, i) => p(i + 1, '+', 1));
    expect(planLowGradeHeal(many, seededRng(1), 5, 'meadow')).toEqual(many.slice(0, 5));
    const none = planLowGradeHeal([], seededRng(1), HEAL_QUESTIONS, 'waterside');
    expect(none.length).toBe(HEAL_QUESTIONS);
    expect(none.every((q) => q.op === '−' && q.a >= 10)).toBe(true);
  });

  it('planLowGradeHeal: 깨진 틀린 문제는 건너뛰고, 황금 구구몬(legend)도 문제가 나온다', () => {
    const bad = [{ a: 3, op: '×', b: 2, result: 6 } as unknown as LowGradeProblem, p(7, '+', 2)];
    const list = planLowGradeHeal(bad, seededRng(6), 3, 'legend');
    expect(list.length).toBe(3);
    expect(list[0]).toEqual(p(7, '+', 2));
    expect(list.every(isLowGradeProblem)).toBe(true);
  });
});

describe('pushLowGradeWrong', () => {
  it('새 문제는 맨 앞, 같은 문제는 앞으로 올린다 (중복 없음)', () => {
    let list: LowGradeProblem[] = [];
    list = pushLowGradeWrong(list, p(3, '+', 4));
    list = pushLowGradeWrong(list, p(8, '−', 2));
    expect(list).toEqual([p(8, '−', 2), p(3, '+', 4)]);
    list = pushLowGradeWrong(list, p(3, '+', 4));
    expect(list).toEqual([p(3, '+', 4), p(8, '−', 2)]);
  });

  it(`최대 ${LOWGRADE_WRONG_KEEP}개까지, 오래된 것부터 버린다`, () => {
    expect(LOWGRADE_WRONG_KEEP).toBe(20);
    let list: LowGradeProblem[] = [];
    for (let i = 0; i < 30; i++) list = pushLowGradeWrong(list, p(10 + i, '+', 1));
    expect(list.length).toBe(20);
    expect(list[0]).toEqual(p(39, '+', 1));
    expect(list[19]).toEqual(p(20, '+', 1));
  });

  it('원래 목록은 바꾸지 않고, 깨진 문제는 넣지 않는다', () => {
    const before = [p(1, '+', 1)];
    const after = pushLowGradeWrong(before, p(2, '+', 2));
    expect(before).toEqual([p(1, '+', 1)]);
    expect(after).not.toBe(before);
    expect(pushLowGradeWrong(before, { a: 2, op: '+', b: 2, result: 5 })).toEqual(before);
  });
});

describe('작은 도우미', () => {
  it('isLowGradeProblem: 정수·아는 셈·맞는 답·음수 없음만', () => {
    expect(isLowGradeProblem(p(9, '−', 9))).toBe(true);
    expect(isLowGradeProblem(p(45, '+', 6))).toBe(true);
    for (const bad of [
      null,
      'x',
      { a: 3, op: '-', b: 1, result: 2 }, // 보통 빼기표(-)는 아니다
      { a: 3, op: '×', b: 2, result: 6 },
      { a: 3, op: '+', b: 2, result: 6 },
      { a: 2, op: '−', b: 3, result: -1 },
      { a: 1.5, op: '+', b: 1, result: 2.5 },
      { a: '3', op: '+', b: 2, result: 5 },
      { a: 3, op: '+', b: 2 },
      { a: Number.NaN, op: '+', b: 2, result: Number.NaN },
    ]) {
      expect(isLowGradeProblem(bad)).toBe(false);
    }
  });

  it('lowGradeAnswer·sameLowGrade', () => {
    expect(lowGradeAnswer({ a: 40, op: '−', b: 3 })).toBe(37);
    expect(lowGradeAnswer({ a: 40, op: '+', b: 3 })).toBe(43);
    expect(sameLowGrade(p(4, '+', 5), p(4, '+', 5))).toBe(true);
    expect(sameLowGrade(p(4, '+', 5), p(5, '+', 4))).toBe(false);
  });

  it('checkLowGradePassword: 1234만 맞다', () => {
    expect(checkLowGradePassword('1234')).toBe(true);
    for (const s of ['', '0000', '12345', ' 1234', '123']) expect(checkLowGradePassword(s)).toBe(false);
  });

  it('lowGradeArithMaker는 동상 문제 고르기(planStatueQuestions)에 바로 넣을 수 있다', () => {
    const qs = planStatueQuestions({
      facts: {},
      lowGrade: true,
      rng: seededRng(8),
      makeArith: lowGradeArithMaker('waterside'),
      recentWrongArith: [p(7, '+', 1)],
    });
    expect(qs.length).toBe(7);
    expect(qs[0]).toMatchObject({ kind: 'arith', a: 7, op: '+', b: 1 });
    for (const q of qs.slice(1)) expect(q).toMatchObject({ kind: 'arith', op: '−' });
  });
});
