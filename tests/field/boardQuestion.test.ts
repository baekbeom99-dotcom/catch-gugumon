import { describe, expect, it } from 'vitest';
import { generateArith } from '../../src/domain/arith';
import { planArithTrainer } from '../../src/domain/field/arithTrainer';
import { planChallenge } from '../../src/domain/field/training';
import { seededRng } from '../../src/domain/random';
import { planClockTrainer } from '../../src/domain/field/clock';
import { arithLabel, fromArith, fromArithTrainer, fromClock, fromLowGrade, fromTraining, spokenLabel } from '../../src/field/training/boardQuestion';

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

describe('spokenLabel (읽는 글)', () => {
  it('구구단·덧셈·뺄셈·보수를 우리말로 읽는다', async () => {
    const { spokenLabel } = await import('../../src/field/training/boardQuestion');
    expect(spokenLabel({ label: '7 × 8', dan: 7, multiplier: 8 })).toBe('7 곱하기 8은?');
    expect(spokenLabel({ label: '7 + 8' })).toBe('7 더하기 8은?');
    expect(spokenLabel({ label: '53 − 8' })).toBe('53 빼기 8은?');
    expect(spokenLabel({ label: '7 + ? = 10' })).toBe('7 더하기 몇은 10?');
  });
});

describe('시계 문제 (fromClock)', () => {
  it('정답·보기·시각을 그대로 싣고, 보기 글은 3:30꼴, 읽는 글은 시각을 알려 주지 않는다', () => {
    for (const lv of ['hour', 'five', 'one'] as const) {
      for (const q of planClockTrainer(seededRng(9), lv)) {
        const b = fromClock(q);
        expect(b.key).toBe(`c${q.h}:${q.m}`);
        expect(b.label).toBe('');
        expect(b).toMatchObject({ answer: q.answer, choices: q.choices, clock: { h: q.h, m: q.m } });
        expect(b.choiceText!(q.answer)).toBe(`${q.h}:${String(q.m).padStart(2, '0')}`);
        expect(spokenLabel(b)).toBe('몇 시 몇 분일까요?');
        expect(spokenLabel(b)).not.toMatch(/\d/);
      }
    }
  });

  it('다른 문제는 clock·choiceText가 없다', () => {
    const q = planChallenge(seededRng(1), 7)[0];
    const b = fromTraining(q);
    expect(b.clock).toBeUndefined();
    expect(b.choiceText).toBeUndefined();
  });
});
