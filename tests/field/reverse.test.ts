import { describe, expect, it } from 'vitest';
import { FACTS, factId } from '../../src/domain/facts';
import { maybeReverse, recordedType, reverseQuestion } from '../../src/domain/field/reverse';
import { generateQuestion } from '../../src/domain/questionGen';
import { seededRng } from '../../src/domain/random';

describe('거꾸로 묻기', () => {
  it('모든 사실이 나눗셈 문제가 되고 보기에 정답이 한 번만 있다', () => {
    for (let seed = 1; seed <= 5; seed++) {
      const rng = seededRng(seed);
      for (const fact of FACTS.filter((f) => f.a >= 2 && f.b >= 1)) {
        const q = reverseQuestion(rng, fact, 3);
        expect(q.display.kind).toBe('equation');
        if (q.display.kind !== 'equation') continue;
        expect(q.display.op).toBe('÷');
        expect(q.display.a).toBe(fact.product);
        expect(q.display.result).toBeNull();
        expect([fact.a, fact.b]).toContain(q.answer);
        expect((q.display.b as number) * q.answer).toBe(fact.product);
        expect(q.factId).toBe(fact.id);
        expect(q.type).toBe('product');
        expect(q.choices).toHaveLength(3);
        expect(new Set(q.choices).size).toBe(3);
        expect(q.choices.filter((c) => c === q.answer)).toHaveLength(1);
      }
    }
  });

  const fact7 = FACTS.find((f) => f.id === factId(7, 8))!;
  const orig = () => generateQuestion(seededRng(1), fact7, 'product', 3);

  it('마스터한 단이 없으면 확률 1이어도 그대로', () => {
    const q = orig();
    expect(maybeReverse(() => 0, q, fact7, new Set(), 1)).toBe(q);
  });
  it('마스터한 단이면 나눗셈으로 바꾼다', () => {
    const r = maybeReverse(() => 0, orig(), fact7, new Set([7]), 1);
    expect(r.display.kind === 'equation' && r.display.op).toBe('÷');
  });
  it('확률 0이면 그대로', () => {
    const q = orig();
    expect(maybeReverse(() => 0, q, fact7, new Set([7]), 0)).toBe(q);
  });
  it('마스터한 단 중에 이 사실의 단이 없으면 그대로', () => {
    const q = orig();
    expect(maybeReverse(() => 0, q, fact7, new Set([5]), 1)).toBe(q);
  });
  it('곱하는 수가 0이면 그대로', () => {
    const f0 = FACTS.find((f) => f.b === 0)!;
    const q = generateQuestion(seededRng(1), f0, 'product', 3);
    expect(maybeReverse(() => 0, q, f0, new Set([f0.a]), 1)).toBe(q);
  });
  it('곱하는 수가 0인 사실을 reverseQuestion에 주면 오류', () => {
    const f0 = FACTS.find((f) => f.b === 0)!;
    expect(() => reverseQuestion(seededRng(1), f0)).toThrow();
  });
});

describe('recordedType: 학습 기록 유형', () => {
  it('거꾸로(÷) 화면은 원래 유형이 무엇이든 product, 아니면 원래 유형', () => {
    const fact = FACTS.find((f) => f.a === 7 && f.b === 8)!;
    const rev = reverseQuestion(seededRng(1), fact);
    expect(recordedType(rev.display, 'sequence')).toBe('product');
    expect(recordedType(rev.display, 'commutative')).toBe('product');
    const plain = generateQuestion(seededRng(1), fact, 'sequence');
    expect(recordedType(plain.display, 'sequence')).toBe('sequence');
  });
});
