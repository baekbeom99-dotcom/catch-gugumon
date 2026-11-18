import { describe, expect, it } from 'vitest';
import { generateArith } from '../../src/domain/arith';
import { planArithTrainer } from '../../src/domain/field/arithTrainer';
import { planChallenge } from '../../src/domain/field/training';
import { seededRng } from '../../src/domain/random';
import { arithLabel, fromArith, fromArithTrainer, fromLowGrade, fromTraining } from '../../src/field/training/boardQuestion';

describe('BoardQuestion 글자 모양', () => {
  it('구구단은 "7 × 8"이고 단·곱하는 수·보기를 그대로 가진다', () => {
    const q = planChallenge(seededRng(1), 7).find((x) => x.multiplier === 8)!;
    const b = fromTraining(q);
    expect(b.label).toBe('7 × 8');
    expect(b).toMatchObject({ dan: 7, multiplier: 8, answer: 56, choices: q.choices });
    expect(b.key).toBe('m7x8');
  });

  it('덧셈은 "a + b", 뺄셈은 "53 − 8" (빼기표 U+2212)', () => {
    const add = generateArith(seededRng(3), 'addNoCarryBasic');
    expect(fromArith({ ...add, choices: [1, 2, 3] }).label).toBe(`${add.a} + ${add.b}`);
    const sub = generateArith(seededRng(3), 'subBorrow');
    const b = fromArith({ ...sub, choices: [1, 2, 3] });
    expect(b.label).toBe(`${sub.a} − ${sub.b}`);
    expect(b.label).toContain('−');
    expect(b.answer).toBe(sub.result);
    expect(b.choices).toEqual([1, 2, 3]);
  });

  it('보수는 빈칸이 앞이나 뒤에 있는 "7 + ? = 10" 식 전체', () => {
    const labels = new Set<string>();
    for (let s = 1; s <= 40; s++) labels.add(arithLabel(generateArith(seededRng(s), 'comp10')));
    for (const l of labels) expect(l).toMatch(/^(\? \+ \d+|\d+ \+ \?) = 10$/);
    expect([...labels].some((l) => l.startsWith('?'))).toBe(true);
    expect([...labels].some((l) => l.endsWith('? = 10'))).toBe(true);
    const q = generateArith(seededRng(2), 'comp5');
    expect(fromArith({ ...q, choices: q.choices.slice(0, 3) }).answer).toBe(q.answer);
  });

  it('셈연습 문제 묶음은 보기 3개를 그대로 쓴다', () => {
    for (const t of planArithTrainer(seededRng(5), 'hard')) {
      const b = fromArithTrainer(t);
      expect(b.choices).toEqual(t.choices);
      expect(b.choices).toContain(b.answer);
    }
  });

  it('저학년 덧뺄셈', () => {
    const b = fromLowGrade({ a: 53, op: '−', b: 8, result: 45 }, [45, 44, 46]);
    expect(b).toMatchObject({ label: '53 − 8', answer: 45, choices: [45, 44, 46] });
    expect(b.dan).toBeUndefined();
  });
});
