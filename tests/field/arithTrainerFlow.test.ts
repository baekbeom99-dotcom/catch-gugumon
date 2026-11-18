import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ARITH_TRAINER_MASTER_MS,
  ARITH_TRAINER_QUESTIONS,
  TRAINING_CAPSULES,
  TRAINING_FIRST_MASTER_CAPSULES,
  TRAINING_RESULT_DELAY_MS,
} from '../../src/domain/field/tuning';
import { judgeArithTrainer } from '../../src/domain/field/arithTrainer';
import {
  DAN_FLOW,
  TRAINING_QUESTION_COUNT,
  createFlowReducer,
  initialFlow,
  trainingFlowReducer,
  type FlowEvent,
  type FlowState,
} from '../../src/field/training/flow';
import { createArithRunner, createStatueRunner, type ArithDone, type StatueDone } from '../../src/field/training/runner';
import { useGameStore } from '../../src/store/useGameStore';

const total = () => Object.values(useGameStore.getState().field.capsules).reduce((a, b) => a + b, 0);
const right = (ms = 1000): FlowEvent => ({ type: 'answer', correct: true, ms });

describe('flow: 문제 수·판정을 인자로 받아도 기본은 단 도전 그대로', () => {
  it('trainingFlowReducer는 DAN_FLOW(9문제·judgeChallenge)와 같다', () => {
    expect(DAN_FLOW.count).toBe(TRAINING_QUESTION_COUNT);
    const a = createFlowReducer(DAN_FLOW);
    let s = trainingFlowReducer(initialFlow(), { type: 'start', mode: 'challenge', studied: true });
    let t = a(initialFlow(), { type: 'start', mode: 'challenge', studied: true });
    for (let i = 0; i < 9; i++) {
      s = trainingFlowReducer(s, right());
      t = a(t, right());
    }
    expect(s).toEqual(t);
    expect(s.result).toBe('pass');
  });

  it('문제 수 3·판정 함수를 바꾸면 그대로 따른다', () => {
    const r = createFlowReducer({ count: 3, judge: () => 'slow' });
    let s: FlowState = r(initialFlow(), { type: 'start', mode: 'challenge', studied: true });
    s = r(r(r(s, right()), right()), right());
    expect(s.finished).toBe(true);
    expect(s.result).toBe('slow');
  });
});

describe('셈연습 진행기', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useGameStore.getState().resetAll();
  });
  afterEach(() => vi.useRealTimers());

  function setup(level: 'basic' | 'hard' | 'comp' = 'basic') {
    const done: ArithDone[] = [];
    const flows: FlowState[] = [];
    const runner = createArithRunner(
      level,
      (f) => flows.push(f),
      (d) => done.push(d),
    );
    return { runner, done, flows };
  }
  const solve = (r: ReturnType<typeof setup>['runner'], n: number, ms = 1000) => {
    for (let i = 0; i < n; i++) r.answer(null, true, ms);
  };

  it('9문제를 제한 시간 안에 모두 맞히면 합격: 첫 마스터 캡슐 20개, 정산은 한 번', () => {
    const { runner, done } = setup();
    const c0 = total();
    solve(runner, ARITH_TRAINER_QUESTIONS - 1);
    expect(done).toHaveLength(0);
    const taps = Array.from({ length: 5 }, () => runner.answer(null, true, 1000));
    expect(taps).toEqual([true, false, false, false, false]);
    expect(total()).toBe(c0 + TRAINING_FIRST_MASTER_CAPSULES);
    vi.advanceTimersByTime(TRAINING_RESULT_DELAY_MS * 2);
    expect(done).toHaveLength(1);
    expect(done[0]).toMatchObject({ mode: 'challenge', result: 'pass', timeMs: 9000 });
    expect(done[0].outcome).toMatchObject({ ok: true, firstMaster: true, capsules: TRAINING_FIRST_MASTER_CAPSULES });
    expect(useGameStore.getState().field.training.arith.basic?.bestMs).toBe(9000);
    // 끝난 뒤 눌러도 변화 없음
    expect(runner.answer(null, true, 1000)).toBe(false);
    expect(total()).toBe(c0 + TRAINING_FIRST_MASTER_CAPSULES);
  });

  it('두 번째 합격은 5개', () => {
    for (let k = 0; k < 2; k++) {
      const { runner } = setup();
      const c0 = total();
      solve(runner, ARITH_TRAINER_QUESTIONS);
      if (k === 1) expect(total()).toBe(c0 + TRAINING_CAPSULES);
    }
  });

  it('틀리면 바로 끝: 캡슐·마스터 기록 없음', () => {
    const { runner, done } = setup();
    const c0 = total();
    expect(runner.answer(null, false, 500)).toBe(true);
    expect(runner.getFlow().result).toBe('wrong');
    expect(runner.answer(null, true, 500)).toBe(false);
    vi.advanceTimersByTime(TRAINING_RESULT_DELAY_MS);
    expect(done[0].outcome).toMatchObject({ ok: true, capsules: 0, mastered: false });
    expect(total()).toBe(c0);
    expect(useGameStore.getState().field.training.arith.basic).toBeUndefined();
  });

  it('너무 느리면(제한 시간 초과) 불합격 — 단계마다 제한이 다르다', () => {
    const { runner, done } = setup('basic');
    const per = ARITH_TRAINER_MASTER_MS.basic / ARITH_TRAINER_QUESTIONS + 1;
    solve(runner, ARITH_TRAINER_QUESTIONS, per);
    expect(runner.getFlow().result).toBe('slow');
    vi.advanceTimersByTime(TRAINING_RESULT_DELAY_MS);
    expect(done[0].outcome.capsules).toBe(0);
    expect(judgeArithTrainer({ mistakes: 0, timeMs: ARITH_TRAINER_MASTER_MS.hard }, 'hard')).toBe('pass');
  });

  it('시계가 끝났다는 timeout도 불합격으로 한 번 정산', () => {
    const { runner, done } = setup();
    solve(runner, 2);
    expect(runner.send({ type: 'timeout' })).toBe(true);
    expect(runner.getFlow().result).toBe('slow');
    expect(runner.send({ type: 'timeout' })).toBe(false);
    vi.advanceTimersByTime(TRAINING_RESULT_DELAY_MS);
    expect(done).toHaveLength(1);
  });

  it('고수 첫 마스터는 레전드 구구몬을 받는다', () => {
    const { runner, done } = setup('hard');
    solve(runner, ARITH_TRAINER_QUESTIONS);
    vi.advanceTimersByTime(TRAINING_RESULT_DELAY_MS);
    expect(done[0].outcome.legend).not.toBeNull();
  });

  it('중간에 그만두면 정산하지 않는다', () => {
    const { runner, done } = setup();
    const c0 = total();
    solve(runner, 4);
    expect(runner.requestQuit()).toBe(true);
    expect(runner.answer(null, true, 500)).toBe(false);
    vi.advanceTimersByTime(TRAINING_RESULT_DELAY_MS * 3);
    expect(done).toHaveLength(0);
    expect(total()).toBe(c0);
    expect(useGameStore.getState().field.training.arith).toEqual({});
  });
});

describe('동상 진행기 (별점수 켜짐)', () => {
  const g = globalThis as { __GUGU_E2E_STARS__?: boolean };
  beforeEach(() => {
    vi.useFakeTimers();
    useGameStore.getState().resetAll();
    g.__GUGU_E2E_STARS__ = true;
  });
  afterEach(() => {
    vi.useRealTimers();
    delete g.__GUGU_E2E_STARS__;
  });

  function setup() {
    const done: StatueDone[] = [];
    const rec: Array<[string, boolean, boolean]> = [];
    const runner = createStatueRunner<string>(
      7,
      (k, c, _ms, retry) => rec.push([k, c, retry]),
      () => undefined,
      (d) => done.push(d),
    );
    return { runner, done, rec };
  }
  const stars = () => useGameStore.getState().field.starPoints;

  it('7문제를 모두 맞히면(빠르게) 별점수 15, 정산은 한 번', () => {
    const { runner, done } = setup();
    for (let i = 0; i < 7; i++) runner.answer(`q${i}`, true, 1000);
    expect(runner.answer('x', true, 1000)).toBe(false);
    vi.advanceTimersByTime(TRAINING_RESULT_DELAY_MS * 2);
    expect(done).toHaveLength(1);
    expect(done[0].outcome).toEqual({ ok: true, stars: 15, mistakes: 0 });
    expect(stars()).toBe(15);
  });

  it('틀려도 끝나지 않고 같은 문제를 다시: 끝까지 가도 별 없음, 재도전 표시', () => {
    const { runner, done, rec } = setup();
    runner.answer('q0', false, 500);
    expect(runner.getFlow().phase).toBe('running');
    expect(runner.getFlow().index).toBe(0);
    runner.answer('q0', true, 500);
    for (let i = 1; i < 7; i++) runner.answer(`q${i}`, true, 500);
    vi.advanceTimersByTime(TRAINING_RESULT_DELAY_MS);
    expect(done[0].outcome).toEqual({ ok: true, stars: 0, mistakes: 1 });
    expect(stars()).toBe(0);
    expect(rec[0]).toEqual(['q0', false, false]);
    expect(rec[1]).toEqual(['q0', true, true]);
  });

  it('중간에 그만두면 정산하지 않는다', () => {
    const { runner, done } = setup();
    for (let i = 0; i < 3; i++) runner.answer(`q${i}`, true, 500);
    runner.requestQuit();
    vi.advanceTimersByTime(TRAINING_RESULT_DELAY_MS * 3);
    expect(done).toHaveLength(0);
    expect(stars()).toBe(0);
  });

  it('별점수가 꺼져 있으면 끝까지 맞혀도 별이 쌓이지 않는다', () => {
    g.__GUGU_E2E_STARS__ = false;
    const { runner, done } = setup();
    for (let i = 0; i < 7; i++) runner.answer(`q${i}`, true, 500);
    vi.advanceTimersByTime(TRAINING_RESULT_DELAY_MS);
    expect(done[0].outcome.stars).toBe(0);
    expect(stars()).toBe(0);
  });
});
