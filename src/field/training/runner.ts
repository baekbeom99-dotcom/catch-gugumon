/**
 * 트레이닝 진행기 (React 없음) — 상태기계(flow.ts)를 돌리고, 받아들여진 답마다 기록을 남기고,
 * 끝까지 갔을 때만(finished) 정산(settle)을 정확히 한 번 부른다. 중간에 나가면 부르지 않는다.
 * createRunner가 공통 뼈대, 단 트레이닝(createTrainingRunner)·셈연습·동상이 자기 기록·정산을 끼운다.
 * useTrainingRun이 이것을 화면에 이어 준다.
 */
import type { BoardQuestion } from './boardQuestion';
import { judgeArithTrainer } from '../../domain/field/arithTrainer';
import { judgeClockTrainer, type ClockLevel } from '../../domain/field/clock';
import { TRAINING_RESULT_DELAY_MS, ARITH_TRAINER_QUESTIONS, CLOCK_TRAINER_QUESTIONS, type TrainingDan } from '../../domain/field/tuning';
import type { ArithLevel } from '../../domain/arith';
import { useGameStore, type ArithOutcome, type ClockOutcome, type TrainingOutcome } from '../../store/useGameStore';
import {
  DAN_FLOW,
  createFlowReducer,
  initialFlow,
  type FlowConfig,
  type FlowEvent,
  type FlowMode,
  type FlowResult,
  type FlowState,
} from './flow';

export interface RunDone<O> {
  mode: FlowMode;
  result: FlowResult;
  outcome: O;
  /** 걸린 시간 합 (밀리초) */
  timeMs: number;
}
export type TrainingDone = RunDone<TrainingOutcome>;
export type ArithDone = RunDone<ArithOutcome>;

export interface Runner<K> {
  getFlow: () => FlowState;
  /** 이벤트를 상태기계에 넣는다. 받아들여졌으면 true (끝난 판·나간 판의 이벤트는 false) */
  send: (e: FlowEvent) => boolean;
  /** 답 하나. 받아들여졌을 때만 기록을 남기고 true (이 문제에서 이미 틀렸으면 재도전이라 상자는 안 올라간다) */
  answer: (key: K, correct: boolean, ms: number) => boolean;
  /** 그만하기. 푸는 중이면 나가고 true. 이미 끝난 판이면 기다리지 않고 결과를 바로 보여 주고 false */
  requestQuit: () => boolean;
  dispose: () => void;
}
export type TrainingRunner = Runner<number>;

export interface RunnerOptions<K, O> {
  mode: FlowMode;
  flow: FlowConfig;
  /** 받아들여진 답마다 (retry: 이 문제에서 이미 틀린 뒤의 답인가) */
  record?: (key: K, correct: boolean, ms: number, retry: boolean) => void;
  /** 끝까지 갔을 때 한 번만 */
  settle: (flow: FlowState) => O;
  delayMs?: number;
}

export type RunnerFactory<K, O> = (onFlow: (f: FlowState) => void, onDone: (d: RunDone<O>) => void) => Runner<K>;

export function createRunner<K, O>(opts: RunnerOptions<K, O>, onFlow: (f: FlowState) => void, onDone: (d: RunDone<O>) => void): Runner<K> {
  const reduce = createFlowReducer(opts.flow);
  const delayMs = opts.delayMs ?? TRAINING_RESULT_DELAY_MS;
  let flow = reduce(initialFlow(), { type: 'start', mode: opts.mode, studied: true });
  let settled = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let pending: RunDone<O> | null = null;

  const deliver = () => {
    clearTimeout(timer);
    timer = undefined;
    const d = pending;
    pending = null;
    if (d) onDone(d);
  };

  const send = (e: FlowEvent): boolean => {
    const next = reduce(flow, e);
    if (next === flow) return false;
    flow = next;
    onFlow(next);
    if (next.finished && next.result && !settled) {
      settled = true;
      pending = { mode: opts.mode, result: next.result, outcome: opts.settle(next), timeMs: next.elapsedMs };
      timer = setTimeout(deliver, delayMs);
    }
    return true;
  };

  return {
    getFlow: () => flow,
    send,
    answer: (key, correct, ms) => {
      const e: FlowEvent = { type: 'answer', correct, ms };
      if (reduce(flow, e) === flow) return false;
      // 이 문제에서 이미 틀린 뒤의 답은 재도전 (다른 연습 화면과 같은 규칙)
      opts.record?.(key, correct, ms, flow.lastWrong);
      return send(e);
    },
    requestQuit: () => {
      if (flow.finished) {
        deliver();
        return false;
      }
      send({ type: 'quit' });
      return true;
    },
    dispose: () => clearTimeout(timer),
  };
}

/** 단 트레이닝(×1~×9 학습·마스터 도전): 답마다 학습 기록, 끝에서 finishTraining 한 번 */
export function createTrainingRunner(
  dan: TrainingDan,
  mode: FlowMode,
  onFlow: (f: FlowState) => void,
  onDone: (d: TrainingDone) => void,
  delayMs: number = TRAINING_RESULT_DELAY_MS,
): TrainingRunner {
  return createRunner<number, TrainingOutcome>(
    {
      mode,
      flow: DAN_FLOW,
      delayMs,
      record: (multiplier, correct, ms, retry) => useGameStore.getState().recordTrainingAnswer(dan, multiplier, correct, ms, Date.now(), retry),
      settle: (f) => useGameStore.getState().finishTraining({ dan, mode, mistakes: f.mistakes, timeMs: f.elapsedMs, now: Date.now() }),
    },
    onFlow,
    onDone,
  );
}

/** 셈연습 트레이너(마스터 도전만): 9문제, 그 단계 제한 시간, 끝에서 finishArithTraining 한 번. 답 기록은 없다 */
export function createArithRunner<K = unknown>(
  level: ArithLevel,
  onFlow: (f: FlowState) => void,
  onDone: (d: ArithDone) => void,
  delayMs: number = TRAINING_RESULT_DELAY_MS,
): Runner<K> {
  return createRunner<K, ArithOutcome>(
    {
      mode: 'challenge',
      flow: { count: ARITH_TRAINER_QUESTIONS, judge: (a) => judgeArithTrainer(a, level) },
      delayMs,
      settle: (f) => useGameStore.getState().finishArithTraining({ level, mistakes: f.mistakes, timeMs: f.elapsedMs, now: Date.now() }),
    },
    onFlow,
    onDone,
  );
}

export type ClockDone = RunDone<ClockOutcome>;

/** 시계 읽기 트레이너(마스터 도전만): 9문제, 그 단계 제한 시간, 끝에서 finishClockTraining 한 번. 답 기록은 없다 */
export function createClockRunner<K = unknown>(
  level: ClockLevel,
  onFlow: (f: FlowState) => void,
  onDone: (d: ClockDone) => void,
  delayMs: number = TRAINING_RESULT_DELAY_MS,
): Runner<K> {
  return createRunner<K, ClockOutcome>(
    {
      mode: 'challenge',
      flow: { count: CLOCK_TRAINER_QUESTIONS, judge: (a) => judgeClockTrainer(a, level) },
      delayMs,
      settle: (f) => useGameStore.getState().finishClockTraining({ level, mistakes: f.mistakes, timeMs: f.elapsedMs, now: Date.now() }),
    },
    onFlow,
    onDone,
  );
}

export function clockRunnerFactory(level: ClockLevel): RunnerFactory<BoardQuestion, ClockOutcome> {
  return (onFlow, onDone) => createClockRunner<BoardQuestion>(level, onFlow, onDone);
}

export type StatueOutcome = { ok: boolean; stars: number; /** 틀린 횟수 */ mistakes: number };
export type StatueDone = RunDone<StatueOutcome>;

/** 동상: count문제를 차례로(틀리면 그 문제를 다시, 틀린 횟수는 센다), 끝에서 finishStatue 한 번. 별은 하나도 안 틀렸을 때만 */
export function createStatueRunner<K>(
  count: number,
  record: (key: K, correct: boolean, ms: number, retry: boolean) => void,
  onFlow: (f: FlowState) => void,
  onDone: (d: StatueDone) => void,
  delayMs: number = TRAINING_RESULT_DELAY_MS,
): Runner<K> {
  return createRunner<K, StatueOutcome>(
    {
      mode: 'study',
      flow: { count, judge: () => 'pass' },
      delayMs,
      record,
      settle: (f) => ({ ...useGameStore.getState().finishStatue({ timeMs: f.elapsedMs, allCorrect: f.mistakes === 0, now: Date.now() }), mistakes: f.mistakes }),
    },
    onFlow,
    onDone,
  );
}

/** 단 트레이닝 진행기를 BoardQuestion을 받는 모양으로 (구구단 문제는 multiplier가 있다) */
export function danRunnerFactory(dan: TrainingDan, mode: FlowMode): RunnerFactory<BoardQuestion, TrainingOutcome> {
  return (onFlow, onDone) => {
    const r = createTrainingRunner(dan, mode, onFlow, onDone);
    return { ...r, answer: (q, correct, ms) => r.answer(q.multiplier ?? 0, correct, ms) };
  };
}

export function arithRunnerFactory(level: ArithLevel): RunnerFactory<BoardQuestion, ArithOutcome> {
  return (onFlow, onDone) => createArithRunner<BoardQuestion>(level, onFlow, onDone);
}

export function statueRunnerFactory(
  count: number,
  record: (q: BoardQuestion, correct: boolean, ms: number, retry: boolean) => void,
): RunnerFactory<BoardQuestion, StatueOutcome> {
  return (onFlow, onDone) => createStatueRunner<BoardQuestion>(count, record, onFlow, onDone);
}
