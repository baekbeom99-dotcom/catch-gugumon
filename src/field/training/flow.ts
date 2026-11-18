/**
 * 트레이닝센터 진행 상태기계 (순수) — 화면(StudyMode·ChallengeMode)은 이 값을 그리기만 한다.
 * idle → running → done, 도중에 나가면 quit(= finished 아님 → finishTraining을 부르지 않는다).
 */
import { judgeChallenge } from '../../domain/field/training';

/** 한 번에 푸는 문제 수 (×1~×9) */
export const TRAINING_QUESTION_COUNT = 9;

export type FlowMode = 'study' | 'challenge';
/** 학습은 complete, 도전은 합격(pass)·틀림(wrong)·느림(slow) */
export type FlowResult = 'complete' | 'pass' | 'wrong' | 'slow';

export interface FlowState {
  phase: 'idle' | 'running' | 'done' | 'quit';
  mode: FlowMode | null;
  /** 지금 풀 문제 번호 (0부터). 맞혀야 올라간다 */
  index: number;
  mistakes: number;
  /** 답하는 데 걸린 시간의 합 (밀리초) */
  elapsedMs: number;
  /** 끝까지 갔나 — 이때만 finishTraining을 부른다 */
  finished: boolean;
  result: FlowResult | null;
  /** 방금 답이 틀렸나 (같은 문제를 다시 풀 때 흔들림·안내용) */
  lastWrong: boolean;
}

export type FlowEvent =
  | { type: 'start'; mode: FlowMode; studied: boolean }
  | { type: 'answer'; correct: boolean; ms: number }
  | { type: 'timeout' }
  | { type: 'quit' };

export function initialFlow(): FlowState {
  return { phase: 'idle', mode: null, index: 0, mistakes: 0, elapsedMs: 0, finished: false, result: null, lastWrong: false };
}

const finish = (s: FlowState, result: FlowResult): FlowState => ({ ...s, phase: 'done', finished: true, result });

/** 문제 수와 도전 판정 — 단 도전은 기본값, 셈연습·동상은 자기 값을 넘긴다 */
export interface FlowConfig {
  count: number;
  judge: (a: { mistakes: number; timeMs: number }) => 'pass' | 'wrong' | 'slow';
}

export const DAN_FLOW: FlowConfig = { count: TRAINING_QUESTION_COUNT, judge: judgeChallenge };

export function createFlowReducer(config: FlowConfig): (s: FlowState, e: FlowEvent) => FlowState {
  return (s, e) => flowStep(config, s, e);
}

/** 단 트레이닝(9문제, judgeChallenge)용 상태기계 */
export function trainingFlowReducer(s: FlowState, e: FlowEvent): FlowState {
  return flowStep(DAN_FLOW, s, e);
}

function flowStep(config: FlowConfig, s: FlowState, e: FlowEvent): FlowState {
  if (e.type === 'start') {
    if (s.phase !== 'idle') return s;
    // 학습 전의 도전은 거부
    if (e.mode === 'challenge' && !e.studied) return s;
    return { ...initialFlow(), phase: 'running', mode: e.mode };
  }
  if (s.phase !== 'running') return s; // 끝났거나 나간 뒤에는 아무것도 달라지지 않는다
  if (e.type === 'quit') return { ...s, phase: 'quit' };
  if (e.type === 'timeout') {
    // 시간 제한은 도전에만
    return s.mode === 'challenge' ? finish(s, 'slow') : s;
  }
  const elapsedMs = s.elapsedMs + Math.max(0, e.ms);
  if (!e.correct) {
    const next = { ...s, mistakes: s.mistakes + 1, elapsedMs, lastWrong: true };
    // 도전은 하나라도 틀리면 바로 끝
    return s.mode === 'challenge' ? finish(next, 'wrong') : next;
  }
  const index = s.index + 1;
  const next = { ...s, index, elapsedMs, lastWrong: false };
  if (index < config.count) return next;
  if (s.mode === 'study') return finish(next, 'complete');
  return finish(next, config.judge({ mistakes: next.mistakes, timeMs: elapsedMs }));
}
