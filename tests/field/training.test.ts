import { describe, expect, it } from 'vitest';
import {
  emptyTraining,
  isChallengeOpen,
  isFirstMaster,
  isStairsOpen,
  isTrainingOpen,
  judgeChallenge,
  pickLegendReward,
  planChallenge,
  planStudy,
} from '../../src/domain/field/training';
import { LEGEND_SPECIES } from '../../src/domain/field/speciesIds';
import { seededRng } from '../../src/domain/random';
import { TRAINING_DANS, TRAINING_MASTER_MS } from '../../src/domain/field/tuning';

const mastered = { bestMs: 20000, at: 1 };

describe('단 열림', () => {
  it('2단은 항상 열림', () => {
    expect(isTrainingOpen(emptyTraining(), 2)).toBe(true);
  });
  it('3단은 2단 마스터 뒤에 열림', () => {
    const t = emptyTraining();
    expect(isTrainingOpen(t, 3)).toBe(false);
    t.mastered[2] = mastered;
    expect(isTrainingOpen(t, 3)).toBe(true);
  });
  it('단은 10개이고 11단은 없다', () => {
    expect(TRAINING_DANS).toHaveLength(10);
    expect(TRAINING_DANS as readonly number[]).not.toContain(11);
  });
  it('12단은 9단 마스터 뒤에만 열림, 13단은 12단 뒤', () => {
    const t = emptyTraining();
    t.mastered[8] = mastered;
    expect(isTrainingOpen(t, 12)).toBe(false);
    t.mastered[9] = mastered;
    expect(isTrainingOpen(t, 12)).toBe(true);
    expect(isTrainingOpen(t, 13)).toBe(false);
    t.mastered[12] = mastered;
    expect(isTrainingOpen(t, 13)).toBe(true);
  });
  it('목록에 없는 단은 닫힘 (11단 포함)', () => {
    const t = emptyTraining();
    for (const d of TRAINING_DANS) t.mastered[d] = mastered;
    expect(isTrainingOpen(t, 10)).toBe(false);
    expect(isTrainingOpen(t, 11)).toBe(false);
    expect(isTrainingOpen(t, 14)).toBe(false);
  });
  it('isFirstMaster: 아직 마스터하지 않은 단만 true', () => {
    const t = emptyTraining();
    expect(isFirstMaster(t, 2)).toBe(true);
    t.mastered[2] = mastered;
    expect(isFirstMaster(t, 2)).toBe(false);
    expect(isFirstMaster(t, 3)).toBe(true);
  });
  it('빈 훈련 기록에는 셈연습 칸도 비어 있다', () => {
    expect(emptyTraining()).toEqual({ studied: {}, mastered: {}, legendGranted: {}, arith: {}, clock: {} });
  });
  it('도전은 학습한 단만', () => {
    const t = emptyTraining();
    expect(isChallengeOpen(t, 2)).toBe(false);
    t.studied[2] = true;
    expect(isChallengeOpen(t, 2)).toBe(true);
    t.studied[3] = true;
    expect(isChallengeOpen(t, 3)).toBe(false); // 단이 잠겨 있음
  });
  it('계단은 기본으로 열림', () => {
    expect(isStairsOpen(emptyTraining())).toBe(true);
  });
});

describe('문제 만들기', () => {
  it('planStudy는 ×1~×9 순서', () => {
    for (const dan of [7, 12] as const) {
      const qs = planStudy(dan);
      expect(qs.map((q) => q.multiplier)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
      for (const q of qs) {
        expect(q.dan).toBe(dan);
        expect(q.answer).toBe(dan * q.multiplier);
        expect(q.choices).toHaveLength(3);
        expect(q.choices).toContain(q.answer);
      }
    }
  });
  it('planChallenge는 9개 섞음·보기 3개', () => {
    for (const dan of TRAINING_DANS) {
      const qs = planChallenge(seededRng(dan), dan);
      expect(qs).toHaveLength(9);
      expect(new Set(qs.map((q) => q.multiplier)).size).toBe(9);
      for (const q of qs) {
        expect(q.answer).toBe(dan * q.multiplier);
        expect(q.choices).toHaveLength(3);
        expect(q.choices).toContain(q.answer);
        expect(new Set(q.choices).size).toBe(3);
        for (const c of q.choices) expect(c).toBeGreaterThanOrEqual(0);
      }
    }
  });
  it('시드가 다르면 순서가 다름', () => {
    const a = planChallenge(seededRng(1), 7).map((q) => q.multiplier);
    const b = planChallenge(seededRng(2), 7).map((q) => q.multiplier);
    expect(a).not.toEqual(b);
  });
});

describe('judgeChallenge', () => {
  it('판정', () => {
    expect(judgeChallenge({ mistakes: 0, timeMs: TRAINING_MASTER_MS })).toBe('pass');
    expect(judgeChallenge({ mistakes: 0, timeMs: TRAINING_MASTER_MS + 1 })).toBe('slow');
    expect(judgeChallenge({ mistakes: 1, timeMs: 1000 })).toBe('wrong');
  });
});

describe('pickLegendReward', () => {
  it('이미 받은 단이면 null', () => {
    expect(pickLegendReward(seededRng(1), [], 12, { 12: 'c014' })).toBeNull();
  });
  it('가진 종을 제외하고 뽑음', () => {
    const owned = LEGEND_SPECIES.slice(1);
    const r = pickLegendReward(seededRng(3), owned, 12, {});
    expect(r).toEqual({ species: LEGEND_SPECIES[0], duplicate: false });
  });
  it('전부 가졌으면 중복으로 아무 레전드', () => {
    const r = pickLegendReward(seededRng(3), LEGEND_SPECIES, 13, {});
    expect(r?.duplicate).toBe(true);
    expect(LEGEND_SPECIES).toContain(r!.species);
  });
  it('시드가 같으면 같은 결과', () => {
    expect(pickLegendReward(seededRng(9), [], 12, {})).toEqual(pickLegendReward(seededRng(9), [], 12, {}));
  });
  it('셈연습 고수(arithHard)도 따로 한 번만', () => {
    expect(pickLegendReward(seededRng(1), [], 'arithHard', { arithHard: 'c014' })).toBeNull();
    // 12단을 받았어도 셈연습 고수 몫은 따로
    const r = pickLegendReward(() => 0, [], 'arithHard', { 12: 'c014' });
    expect(r).toEqual({ species: LEGEND_SPECIES[0], duplicate: false });
  });
});
