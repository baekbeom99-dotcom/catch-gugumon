import { describe, expect, it } from 'vitest';
import { TRAINING_MASTER_MS } from '../../src/domain/field/tuning';
import { TRAINING_QUESTION_COUNT, initialFlow, trainingFlowReducer, type FlowEvent, type FlowState } from '../../src/field/training/flow';

const run = (s: FlowState, ...events: FlowEvent[]) => events.reduce(trainingFlowReducer, s);
const right = (ms = 1000): FlowEvent => ({ type: 'answer', correct: true, ms });
const wrong = (ms = 1000): FlowEvent => ({ type: 'answer', correct: false, ms });
const nine = (ms = 1000) => Array.from({ length: TRAINING_QUESTION_COUNT }, () => right(ms));

describe('trainingFlowReducer: 시작', () => {
  it('처음에는 idle', () => {
    expect(initialFlow().phase).toBe('idle');
    expect(initialFlow().finished).toBe(false);
  });
  it('학습은 언제나 시작', () => {
    const s = run(initialFlow(), { type: 'start', mode: 'study', studied: false });
    expect(s.phase).toBe('running');
    expect(s.mode).toBe('study');
    expect(s.index).toBe(0);
  });
  it('학습 안 한 단의 도전 요청은 거부 (idle 그대로)', () => {
    const s = run(initialFlow(), { type: 'start', mode: 'challenge', studied: false });
    expect(s.phase).toBe('idle');
  });
  it('학습을 마친 단의 도전은 시작', () => {
    const s = run(initialFlow(), { type: 'start', mode: 'challenge', studied: true });
    expect(s.phase).toBe('running');
    expect(s.mode).toBe('challenge');
  });
});

describe('trainingFlowReducer: 차례대로 학습', () => {
  const start = run(initialFlow(), { type: 'start', mode: 'study', studied: false });

  it('9문제를 모두 맞혀야 끝(complete)', () => {
    let s = start;
    for (let i = 0; i < TRAINING_QUESTION_COUNT - 1; i++) {
      s = run(s, right());
      expect(s.finished).toBe(false);
      expect(s.index).toBe(i + 1);
    }
    s = run(s, right());
    expect(s.finished).toBe(true);
    expect(s.phase).toBe('done');
    expect(s.result).toBe('complete');
    expect(s.mistakes).toBe(0);
  });

  it('틀리면 같은 문제를 다시, 틀린 횟수를 센다', () => {
    const s = run(start, right(), wrong(), wrong());
    expect(s.index).toBe(1);
    expect(s.mistakes).toBe(2);
    expect(s.finished).toBe(false);
    expect(s.lastWrong).toBe(true);
    expect(run(s, right()).lastWrong).toBe(false);
  });

  it('틀려도 끝까지 가면 끝이고 시간은 시간 제한이 없다', () => {
    const s = run(start, wrong(), ...nine(60_000));
    expect(s.finished).toBe(true);
    expect(s.result).toBe('complete');
    expect(s.mistakes).toBe(1);
  });

  it('학습은 시간이 지나도 timeout으로 끝나지 않는다', () => {
    const s = run(start, { type: 'timeout' });
    expect(s.finished).toBe(false);
    expect(s.phase).toBe('running');
  });
});

describe('trainingFlowReducer: 마스터 도전', () => {
  const start = run(initialFlow(), { type: 'start', mode: 'challenge', studied: true });

  it('9문제를 모두 맞히고 시간 안이면 합격', () => {
    const s = run(start, ...nine(2000));
    expect(s.finished).toBe(true);
    expect(s.result).toBe('pass');
    expect(s.elapsedMs).toBe(18_000);
  });

  it('제한 시간과 똑같이 끝나면 합격', () => {
    const s = run(start, ...nine(TRAINING_MASTER_MS / TRAINING_QUESTION_COUNT));
    expect(s.result).toBe('pass');
  });

  it('틀리면 바로 끝나고 wrong', () => {
    const s = run(start, right(), wrong());
    expect(s.finished).toBe(true);
    expect(s.result).toBe('wrong');
    expect(s.mistakes).toBe(1);
    expect(s.index).toBe(1);
  });

  it('끝난 뒤의 이벤트는 무시', () => {
    const done = run(start, wrong());
    expect(run(done, right(), { type: 'timeout' })).toEqual(done);
  });

  it('시간이 다 되면(timeout) slow로 끝', () => {
    const s = run(start, right(), right(), { type: 'timeout' });
    expect(s.finished).toBe(true);
    expect(s.result).toBe('slow');
    expect(s.mistakes).toBe(0);
  });

  it('다 맞혀도 합이 제한 시간을 넘으면 slow', () => {
    const s = run(start, ...nine(TRAINING_MASTER_MS / TRAINING_QUESTION_COUNT + 100));
    expect(s.finished).toBe(true);
    expect(s.result).toBe('slow');
  });
});

describe('trainingFlowReducer: 나가기', () => {
  it('중간에 quit하면 finished가 아니다 (finishTraining을 부르지 않는다)', () => {
    for (const mode of ['study', 'challenge'] as const) {
      const s = run(initialFlow(), { type: 'start', mode, studied: true }, right(), right(), { type: 'quit' });
      expect(s.finished).toBe(false);
      expect(s.phase).toBe('quit');
      expect(s.result).toBeNull();
    }
  });
  it('quit 뒤에는 답해도 달라지지 않는다', () => {
    const q = run(initialFlow(), { type: 'start', mode: 'study', studied: true }, { type: 'quit' });
    expect(run(q, right())).toEqual(q);
  });
  it('이미 끝난 뒤의 quit은 finished를 그대로 둔다', () => {
    const s = run(initialFlow(), { type: 'start', mode: 'challenge', studied: true }, wrong(), { type: 'quit' });
    expect(s.finished).toBe(true);
    expect(s.result).toBe('wrong');
  });
});
