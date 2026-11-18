import { describe, expect, it } from 'vitest';
import { ARITH_INFO } from '../../src/domain/arith';
import { arithKindsOf, judgeArithTrainer, planArithTrainer } from '../../src/domain/field/arithTrainer';
import { ARITH_TRAINER_LEVELS, ARITH_TRAINER_QUESTIONS } from '../../src/domain/field/tuning';
import { seededRng } from '../../src/domain/random';

describe('셈연습 트레이너 문제', () => {
  it('단계마다 9문제·보기 3개·정답 포함·중복 없음·음수 없음, 그 단계의 종류만', () => {
    for (const level of ARITH_TRAINER_LEVELS) {
      for (let seed = 1; seed <= 30; seed++) {
        const qs = planArithTrainer(seededRng(seed), level);
        expect(qs).toHaveLength(ARITH_TRAINER_QUESTIONS);
        for (const { q, choices } of qs) {
          expect(ARITH_INFO[q.kind].level).toBe(level);
          expect(arithKindsOf(level)).toContain(q.kind);
          expect(choices).toHaveLength(3);
          expect(choices).toContain(q.answer);
          expect(new Set(choices).size).toBe(3);
          for (const c of choices) {
            expect(Number.isInteger(c)).toBe(true);
            expect(c).toBeGreaterThanOrEqual(0);
          }
        }
      }
    }
  });

  it('단계의 종류가 고루 나온다 (기본 4종 모두)', () => {
    const kinds = new Set(planArithTrainer(seededRng(5), 'basic').map((x) => x.q.kind));
    expect(kinds.size).toBe(4);
  });

  it('시드가 같으면 같은 문제', () => {
    expect(planArithTrainer(seededRng(7), 'hard')).toEqual(planArithTrainer(seededRng(7), 'hard'));
  });
});

describe('judgeArithTrainer', () => {
  it('기본·보수는 27초, 고수는 45초까지 합격', () => {
    expect(judgeArithTrainer({ mistakes: 0, timeMs: 27_000 }, 'basic')).toBe('pass');
    expect(judgeArithTrainer({ mistakes: 0, timeMs: 27_001 }, 'basic')).toBe('slow');
    expect(judgeArithTrainer({ mistakes: 0, timeMs: 45_000 }, 'hard')).toBe('pass');
    expect(judgeArithTrainer({ mistakes: 0, timeMs: 45_001 }, 'hard')).toBe('slow');
    expect(judgeArithTrainer({ mistakes: 0, timeMs: 27_000 }, 'comp')).toBe('pass');
    expect(judgeArithTrainer({ mistakes: 0, timeMs: 27_001 }, 'comp')).toBe('slow');
  });
  it('하나라도 틀리면 wrong, 이상한 시간은 slow', () => {
    expect(judgeArithTrainer({ mistakes: 1, timeMs: 1000 }, 'basic')).toBe('wrong');
    expect(judgeArithTrainer({ mistakes: 0, timeMs: Number.NaN }, 'basic')).toBe('slow');
    expect(judgeArithTrainer({ mistakes: 0, timeMs: -5 }, 'basic')).toBe('slow');
  });
});
