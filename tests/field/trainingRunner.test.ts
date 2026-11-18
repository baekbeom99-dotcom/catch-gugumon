import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TRAINING_CAPSULE_OF_DAN, TRAINING_CAPSULES, TRAINING_RESULT_DELAY_MS } from '../../src/domain/field/tuning';
import { TRAINING_QUESTION_COUNT, type FlowState } from '../../src/field/training/flow';
import { createTrainingRunner, type TrainingDone } from '../../src/field/training/runner';
import { useGameStore } from '../../src/store/useGameStore';

const capsules = () => useGameStore.getState().field.capsules[TRAINING_CAPSULE_OF_DAN[2]];

function setup(mode: 'study' | 'challenge' = 'study') {
  const done: TrainingDone[] = [];
  const flows: FlowState[] = [];
  const runner = createTrainingRunner(2, mode, (f) => flows.push(f), (d) => done.push(d));
  return { runner, done, flows };
}

describe('트레이닝 진행기', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useGameStore.getState().resetAll();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('받아들여진 답만 true를 돌려주고 학습 기록을 남긴다', () => {
    const { runner, done } = setup();
    expect(runner.answer(3, true, 1000)).toBe(true);
    expect(useGameStore.getState().learning.facts['2x3'].attempts).toBe(1);
    // 학습은 시간 초과 같은 이벤트를 받아들이지 않는다
    expect(runner.send({ type: 'timeout' })).toBe(false);
    expect(done).toHaveLength(0);
  });

  it('마지막 답을 여러 번 눌러도 finishTraining은 한 번 (캡슐 +5 한 번), 기록도 한 번', () => {
    const { runner, done } = setup();
    const c0 = capsules();
    for (let m = 1; m < TRAINING_QUESTION_COUNT; m++) runner.answer(m, true, 500);
    const attempts = () => useGameStore.getState().learning.facts['2x9'].attempts;
    const a0 = attempts();
    const taps = Array.from({ length: 5 }, () => runner.answer(9, true, 500));
    expect(taps).toEqual([true, false, false, false, false]);
    expect(attempts()).toBe(a0 + 1);
    expect(capsules()).toBe(c0 + TRAINING_CAPSULES);
    vi.advanceTimersByTime(TRAINING_RESULT_DELAY_MS);
    expect(done).toHaveLength(1);
    // 끝난 뒤의 탭은 아무것도 달라지지 않는다
    expect(runner.answer(9, true, 500)).toBe(false);
    expect(capsules()).toBe(c0 + TRAINING_CAPSULES);
  });

  it('이미 틀린 문제를 다시 맞히면 재도전이라 상자가 오르지 않고, 처음 맞히면 오른다', () => {
    const { runner } = setup();
    runner.answer(1, false, 1000); // 2x1 틀림
    runner.answer(1, true, 1000); // 틀린 뒤 정답 눌러 봄
    expect(useGameStore.getState().learning.facts['2x1'].box).toBe(1); // 틀려서 1 — 정답을 눌러도 2로 오르지 않는다
    expect(useGameStore.getState().learning.facts['2x1'].attempts).toBe(2);
    runner.answer(2, true, 1000); // 처음 맞힘 (0 → 1)
    expect(useGameStore.getState().learning.facts['2x2'].box).toBe(1);
  });

  it('마지막 답 뒤 그만하기: 기다리지 않고 결과를 바로 보여 준다 (false)', () => {
    const { runner, done } = setup();
    for (let m = 1; m <= TRAINING_QUESTION_COUNT; m++) runner.answer(m, true, 500);
    expect(done).toHaveLength(0);
    expect(runner.requestQuit()).toBe(false);
    expect(done).toHaveLength(1);
    expect(done[0].result).toBe('complete');
    // 시간이 지나도 두 번 알리지 않는다
    vi.advanceTimersByTime(TRAINING_RESULT_DELAY_MS * 2);
    expect(done).toHaveLength(1);
  });

  it('푸는 중 그만하기: 나가고(true) finishTraining은 부르지 않는다', () => {
    const { runner, done } = setup();
    const c0 = capsules();
    runner.answer(1, true, 500);
    expect(runner.requestQuit()).toBe(true);
    expect(runner.getFlow().phase).toBe('quit');
    expect(runner.answer(2, true, 500)).toBe(false);
    vi.advanceTimersByTime(TRAINING_RESULT_DELAY_MS * 2);
    expect(done).toHaveLength(0);
    expect(capsules()).toBe(c0);
  });

  it('도전에서 틀리면 바로 끝나고 이어지는 탭은 받아들이지 않는다', () => {
    const { runner } = setup('challenge');
    expect(runner.answer(1, false, 500)).toBe(true);
    expect(runner.getFlow().result).toBe('wrong');
    expect(runner.answer(1, true, 500)).toBe(false);
  });
});
