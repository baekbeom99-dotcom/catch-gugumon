/**
 * 트레이닝 진행기 (React 없음) — 상태기계(flow.ts)를 돌리고, 받아들여진 답마다 학습 기록을 남기고,
 * 끝까지 갔을 때만(finished) finishTraining을 정확히 한 번 부른다. 중간에 나가면 부르지 않는다.
 * useTrainingRun이 이것을 화면에 이어 준다.
 */
import { TRAINING_RESULT_DELAY_MS, type TrainingDan } from '../../domain/field/tuning';
import { useGameStore, type TrainingOutcome } from '../../store/useGameStore';
import { initialFlow, trainingFlowReducer, type FlowEvent, type FlowMode, type FlowResult, type FlowState } from './flow';

export interface TrainingDone {
  mode: FlowMode;
  result: FlowResult;
  outcome: TrainingOutcome;
  /** 걸린 시간 합 (밀리초) */
  timeMs: number;
}

export interface TrainingRunner {
  getFlow: () => FlowState;
  /** 이벤트를 상태기계에 넣는다. 받아들여졌으면 true (끝난 판·나간 판의 이벤트는 false) */
  send: (e: FlowEvent) => boolean;
  /** 답 하나. 받아들여졌을 때만 학습 기록을 남기고 true (이 문제에서 이미 틀렸으면 재도전이라 상자는 안 올라간다) */
  answer: (multiplier: number, correct: boolean, ms: number) => boolean;
  /** 그만하기. 푸는 중이면 나가고 true. 이미 끝난 판이면 기다리지 않고 결과를 바로 보여 주고 false */
  requestQuit: () => boolean;
  dispose: () => void;
}

export function createTrainingRunner(
  dan: TrainingDan,
  mode: FlowMode,
  onFlow: (f: FlowState) => void,
  onDone: (d: TrainingDone) => void,
  delayMs: number = TRAINING_RESULT_DELAY_MS,
): TrainingRunner {
  let flow = trainingFlowReducer(initialFlow(), { type: 'start', mode, studied: true });
  let settled = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let pending: TrainingDone | null = null;

  const deliver = () => {
    clearTimeout(timer);
    timer = undefined;
    const d = pending;
    pending = null;
    if (d) onDone(d);
  };

  const send = (e: FlowEvent): boolean => {
    const next = trainingFlowReducer(flow, e);
    if (next === flow) return false;
    flow = next;
    onFlow(next);
    if (next.finished && next.result && !settled) {
      settled = true;
      const outcome = useGameStore.getState().finishTraining({ dan, mode, mistakes: next.mistakes, timeMs: next.elapsedMs, now: Date.now() });
      pending = { mode, result: next.result, outcome, timeMs: next.elapsedMs };
      timer = setTimeout(deliver, delayMs);
    }
    return true;
  };

  return {
    getFlow: () => flow,
    send,
    answer: (multiplier, correct, ms) => {
      const e: FlowEvent = { type: 'answer', correct, ms };
      if (trainingFlowReducer(flow, e) === flow) return false;
      // 이 문제에서 이미 틀린 뒤의 답은 재도전 (다른 연습 화면과 같은 규칙)
      useGameStore.getState().recordTrainingAnswer(dan, multiplier, correct, ms, Date.now(), flow.lastWrong);
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
