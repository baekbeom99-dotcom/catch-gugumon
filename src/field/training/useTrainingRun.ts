/** 학습·도전이 함께 쓰는 진행 훅 — runner.ts의 진행기를 화면에 이어 준다 */
import { useEffect, useRef, useState } from 'react';
import type { TrainingDan } from '../../domain/field/tuning';
import type { FlowMode, FlowState } from './flow';
import { createTrainingRunner, type TrainingDone, type TrainingRunner } from './runner';

export type { TrainingDone } from './runner';

export function useTrainingRun(dan: TrainingDan, mode: FlowMode, onDone: (d: TrainingDone) => void) {
  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  const setFlowRef = useRef<(f: FlowState) => void>(() => undefined);
  const runner = useRef<TrainingRunner>();
  if (!runner.current) {
    runner.current = createTrainingRunner(
      dan,
      mode,
      (f) => setFlowRef.current(f),
      (d) => doneRef.current(d),
    );
  }
  const r = runner.current;
  const [flow, setFlow] = useState<FlowState>(r.getFlow());
  setFlowRef.current = setFlow;
  useEffect(() => () => r.dispose(), [r]);
  return { flow, send: r.send, answer: r.answer, requestQuit: r.requestQuit };
}
