/** 학습·도전·셈연습·동상이 함께 쓰는 진행 훅 — runner.ts의 진행기를 화면에 이어 준다 */
import { useEffect, useRef, useState } from 'react';
import type { FlowState } from './flow';
import type { Runner, RunnerFactory, RunDone } from './runner';

export type { TrainingDone } from './runner';

/** factory는 처음 한 번만 부른다 (진행기는 화면이 살아 있는 동안 하나) */
export function useRun<K, O>(factory: RunnerFactory<K, O>, onDone: (d: RunDone<O>) => void) {
  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  const setFlowRef = useRef<(f: FlowState) => void>(() => undefined);
  const runner = useRef<Runner<K>>();
  if (!runner.current) {
    runner.current = factory(
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
