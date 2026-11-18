/**
 * 학습·도전이 함께 쓰는 진행 훅 — 상태기계(flow.ts)를 돌리고, 답마다 학습 기록을 남기고,
 * 끝까지 갔을 때만(finished) finishTraining을 정확히 한 번 부른다. 중간에 나가면 부르지 않는다.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { TrainingDan } from '../../domain/field/tuning';
import { useGameStore, type TrainingOutcome } from '../../store/useGameStore';
import { initialFlow, trainingFlowReducer, type FlowEvent, type FlowMode, type FlowResult, type FlowState } from './flow';

export interface TrainingDone {
  mode: FlowMode;
  result: FlowResult;
  outcome: TrainingOutcome;
  /** 걸린 시간 합 (밀리초) */
  timeMs: number;
}

/** 마지막 답의 효과·흔들림을 잠깐 보여 준 뒤 결과 화면으로 넘어가는 시간 */
export const RESULT_DELAY_MS = 700;

export function useTrainingRun(dan: TrainingDan, mode: FlowMode, onDone: (d: TrainingDone) => void) {
  const [flow, setFlow] = useState<FlowState>(() => trainingFlowReducer(initialFlow(), { type: 'start', mode, studied: true }));
  const flowRef = useRef(flow);
  const settled = useRef(false);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  const timer = useRef<number>();
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const send = useCallback(
    (e: FlowEvent) => {
      const next = trainingFlowReducer(flowRef.current, e);
      if (next === flowRef.current) return;
      flowRef.current = next;
      setFlow(next);
      if (next.finished && next.result && !settled.current) {
        settled.current = true;
        const outcome = useGameStore.getState().finishTraining({ dan, mode, mistakes: next.mistakes, timeMs: next.elapsedMs, now: Date.now() });
        const result = next.result;
        timer.current = window.setTimeout(() => doneRef.current({ mode, result, outcome, timeMs: next.elapsedMs }), RESULT_DELAY_MS);
      }
    },
    [dan, mode],
  );

  /** 답 하나를 기록한다 (11단은 저장소가 알아서 무시) */
  const record = useCallback(
    (multiplier: number, correct: boolean, ms: number) => {
      useGameStore.getState().recordTrainingAnswer(dan, multiplier, correct, ms, Date.now());
    },
    [dan],
  );

  return { flow, send, record };
}
