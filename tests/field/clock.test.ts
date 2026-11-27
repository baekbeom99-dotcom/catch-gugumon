import { describe, expect, it } from 'vitest';
import {
  CLOCK_LEVEL_LABELS,
  CLOCK_LEVELS,
  clockChoices,
  formatClockChoice,
  isClockOpen,
  judgeClockTrainer,
  planClockTrainer,
  type ClockLevel,
} from '../../src/domain/field/clock';
import { emptyTraining } from '../../src/domain/field/training';
import { CLOCK_TRAINER_MASTER_MS, CLOCK_TRAINER_QUESTIONS } from '../../src/domain/field/tuning';
import { seededRng } from '../../src/domain/random';

const MAX = 12 * 60 + 59;

/** 그 단계에서 나올 수 있는 분 */
function minutesOf(level: ClockLevel): number[] {
  if (level === 'hour') return [0];
  if (level === 'five') return Array.from({ length: 12 }, (_, i) => i * 5);
  return Array.from({ length: 60 }, (_, i) => i);
}

/** 보기 하나가 시계 글로 읽을 수 있는 값인가 (시 1~12, 분 0~59) */
function validValue(v: number) {
  if (!Number.isInteger(v) || v <= 0 || v > MAX) return false;
  const h = Math.floor(v / 60);
  return h >= 1 && h <= 12;
}

describe('시계 읽기 단계', () => {
  it('세 단계와 이름', () => {
    expect(CLOCK_LEVELS).toEqual(['hour', 'five', 'one']);
    expect(CLOCK_LEVEL_LABELS).toEqual({ hour: '정각', five: '5분', one: '1분' });
  });
});

describe('formatClockChoice', () => {
  it('"시:분" 꼴 (분 두 자리, 12시는 12)', () => {
    expect(formatClockChoice(12 * 60)).toBe('12:00');
    expect(formatClockChoice(3 * 60 + 5)).toBe('3:05');
    expect(formatClockChoice(3 * 60 + 30)).toBe('3:30');
    expect(formatClockChoice(725)).toBe('12:05');
    expect(formatClockChoice(60)).toBe('1:00');
    expect(formatClockChoice(11 * 60 + 59)).toBe('11:59');
  });
});

describe('planClockTrainer', () => {
  it('단계마다 9문제, 정답 = 시×60+분, 보기 3개·정답 포함·겹침 없음', () => {
    for (const level of CLOCK_LEVELS) {
      for (let seed = 1; seed <= 30; seed++) {
        const qs = planClockTrainer(seededRng(seed), level);
        expect(qs).toHaveLength(CLOCK_TRAINER_QUESTIONS);
        for (const q of qs) {
          expect(q.h).toBeGreaterThanOrEqual(1);
          expect(q.h).toBeLessThanOrEqual(12);
          expect(q.m).toBeGreaterThanOrEqual(0);
          expect(q.m).toBeLessThanOrEqual(59);
          expect(q.answer).toBe(q.h * 60 + q.m);
          expect(q.choices).toHaveLength(3);
          expect(q.choices).toContain(q.answer);
          expect(new Set(q.choices).size).toBe(3);
          for (const c of q.choices) expect(validValue(c)).toBe(true);
        }
        // 같은 시각은 겹치지 않는다 (정각도 12가지라 9개는 모두 다르게)
        expect(new Set(qs.map((q) => q.answer)).size).toBe(CLOCK_TRAINER_QUESTIONS);
      }
    }
  });

  it('정각은 분 0, 5분은 5의 배수, 1분은 5의 배수가 아닌 시각이 절반 이상', () => {
    for (let seed = 1; seed <= 50; seed++) {
      for (const q of planClockTrainer(seededRng(seed), 'hour')) expect(q.m).toBe(0);
      for (const q of planClockTrainer(seededRng(seed), 'five')) expect(q.m % 5).toBe(0);
      const one = planClockTrainer(seededRng(seed), 'one');
      expect(one.filter((q) => q.m % 5 !== 0).length).toBeGreaterThanOrEqual(Math.ceil(CLOCK_TRAINER_QUESTIONS / 2));
    }
  });

  it('여러 번 돌려도 던지지 않는다 (Math.random·한쪽으로 쏠린 난수)', () => {
    for (const level of CLOCK_LEVELS) {
      for (let i = 0; i < 1000; i++) expect(() => planClockTrainer(Math.random, level)).not.toThrow();
      // 늘 0 또는 거의 1인 난수에서도 9문제를 채운다
      expect(planClockTrainer(() => 0, level)).toHaveLength(CLOCK_TRAINER_QUESTIONS);
      expect(planClockTrainer(() => 0.999999, level)).toHaveLength(CLOCK_TRAINER_QUESTIONS);
    }
  });
});

describe('clockChoices', () => {
  it('모든 시각(12시~11시 59분)에서 보기 3개·정답 포함·겹침 없음·범위 안', () => {
    for (const level of CLOCK_LEVELS) {
      for (let h = 1; h <= 12; h++) {
        for (const m of minutesOf(level)) {
          for (const seed of [1, 7, 42, 99]) {
            const answer = h * 60 + m;
            const cs = clockChoices(seededRng(seed * 1000 + h * 60 + m), h, m, level);
            expect(cs).toHaveLength(3);
            expect(cs).toContain(answer);
            expect(new Set(cs).size).toBe(3);
            for (const c of cs) expect(validValue(c)).toBe(true);
          }
          // 쏠린 난수에서도
          for (const r of [() => 0, () => 0.999999]) {
            const cs = clockChoices(r, h, m, level);
            expect(new Set(cs).size).toBe(3);
            expect(cs).toContain(h * 60 + m);
          }
        }
      }
    }
  });

  it('오답은 헷갈리기 쉬운 값: 바꿔 읽기·시 ±1·분 ±(5 또는 1)', () => {
    const near = (h: number, m: number, step: number) => {
      const at = (hh: number, mm: number) => {
        const idx = (((hh % 12) * 60 + mm) % 720 + 720) % 720;
        return (Math.floor(idx / 60) || 12) * 60 + (idx % 60);
      };
      const swapped = (Math.floor(m / 5) || 12) * 60 + ((h * 5) % 60);
      return new Set([swapped, at(h + 1, m), at(h - 1, m), at(h, m + step), at(h, m - step)]);
    };
    for (let seed = 1; seed <= 20; seed++) {
      const cs = clockChoices(seededRng(seed), 3, 30, 'five');
      const ok = near(3, 30, 5);
      for (const c of cs) if (c !== 210) expect(ok.has(c)).toBe(true);
      const cs1 = clockChoices(seededRng(seed), 7, 23, 'one');
      const ok1 = near(7, 23, 1);
      for (const c of cs1) if (c !== 7 * 60 + 23) expect(ok1.has(c)).toBe(true);
    }
    // 3:30을 바꿔 읽으면 6:15
    const seen = new Set<number>();
    for (let seed = 1; seed <= 50; seed++) for (const c of clockChoices(seededRng(seed), 3, 30, 'five')) seen.add(c);
    expect(seen.has(6 * 60 + 15)).toBe(true);
  });
});

describe('judgeClockTrainer', () => {
  it('틀림 / 느림 / 합격 (이상한 시간은 느림)', () => {
    for (const level of CLOCK_LEVELS) {
      const limit = CLOCK_TRAINER_MASTER_MS[level];
      expect(judgeClockTrainer({ mistakes: 0, timeMs: limit }, level)).toBe('pass');
      expect(judgeClockTrainer({ mistakes: 0, timeMs: 0 }, level)).toBe('pass');
      expect(judgeClockTrainer({ mistakes: 0, timeMs: limit + 1 }, level)).toBe('slow');
      expect(judgeClockTrainer({ mistakes: 1, timeMs: 1000 }, level)).toBe('wrong');
      expect(judgeClockTrainer({ mistakes: NaN, timeMs: 1000 }, level)).toBe('wrong');
      expect(judgeClockTrainer({ mistakes: 0, timeMs: NaN }, level)).toBe('slow');
      expect(judgeClockTrainer({ mistakes: 0, timeMs: -1 }, level)).toBe('slow');
      expect(judgeClockTrainer({ mistakes: 0, timeMs: Infinity }, level)).toBe('slow');
    }
    expect(judgeClockTrainer({ mistakes: 0, timeMs: 1 }, 'nope' as never)).toBe('slow');
  });
});

describe('isClockOpen', () => {
  it('정각은 항상, 5분은 정각 마스터 뒤, 1분은 5분 마스터 뒤', () => {
    const t = emptyTraining();
    expect(isClockOpen(t, 'hour')).toBe(true);
    expect(isClockOpen(t, 'five')).toBe(false);
    expect(isClockOpen(t, 'one')).toBe(false);
    const t1 = { ...t, clock: { hour: { bestMs: 1, at: 1 } } };
    expect(isClockOpen(t1, 'five')).toBe(true);
    expect(isClockOpen(t1, 'one')).toBe(false);
    const t2 = { ...t, clock: { hour: { bestMs: 1, at: 1 }, five: { bestMs: 1, at: 1 } } };
    expect(isClockOpen(t2, 'one')).toBe(true);
    // 5분만 있어도(이상한 저장) 1분은 5분 기준
    expect(isClockOpen({ ...t, clock: { five: { bestMs: 1, at: 1 } } }, 'one')).toBe(true);
    expect(isClockOpen(t2, 'nope' as never)).toBe(false);
  });
});
