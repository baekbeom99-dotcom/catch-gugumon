/**
 * 차례대로 풀기 — 문제를 순서대로, 시계 없음. 틀리면 같은 문제를 다시 (틀린 횟수는 센다).
 * 단 학습(×1~×9)과 체육관 동상이 같이 쓴다: 문제·진행기는 부모가 넘긴다.
 */
import { useRef, useState } from 'react';
import type { SpeciesId } from '../../domain/field/creatures';
import type { BoardQuestion } from './boardQuestion';
import { QuizBoard } from './QuizBoard';
import type { RunDone, RunnerFactory } from './runner';
import { trainingText } from './trainingText';
import { useRunClock } from './useRunClock';
import { useTrainingFx } from './useTrainingFx';
import { useRun } from './useTrainingRun';

interface Props<O> {
  title: string;
  questions: BoardQuestion[];
  species: SpeciesId;
  makeRunner: RunnerFactory<BoardQuestion, O>;
  onDone: (d: RunDone<O>) => void;
  onQuit: () => void;
  testId?: string;
}

export function StudyMode<O>({ title, questions, species, makeRunner, onDone, onQuit, testId = 'training-study' }: Props<O>) {
  const { flow, answer, requestQuit } = useRun(makeRunner, onDone);
  const fx = useTrainingFx(species);
  const clock = useRunClock(flow.phase === 'running', false);
  const lastAt = useRef(0);
  const [message, setMessage] = useState<string>(trainingText.studyRule);
  const [wrongKey, setWrongKey] = useState(0);
  const [wrongPicks, setWrongPicks] = useState<number[]>([]);
  const [rights, setRights] = useState(0);
  const q = questions[Math.min(flow.index, questions.length - 1)];

  const onPick = (value: number) => {
    if (flow.phase !== 'running') return;
    const correct = value === q.answer;
    const ms = Math.round(clock.current - lastAt.current);
    if (!answer(q, correct, ms)) return;
    lastAt.current = clock.current;
    if (correct) {
      fx.fire(rights);
      setRights((n) => n + 1);
      setWrongPicks([]);
      setMessage(trainingText.good);
    } else {
      setWrongKey((k) => k + 1);
      setWrongPicks((p) => [...p, value]);
      setMessage(`${trainingText.tryAgain}\n${trainingText.showAnswer(q.answer)}`);
    }
  };

  return (
    <QuizBoard
      testId={testId}
      title={title}
      species={species}
      question={q}
      total={questions.length}
      solved={flow.index}
      fx={fx}
      badge={<div className="training__badge">{trainingText.progress(flow.index, questions.length)}</div>}
      message={message}
      wrongKey={wrongKey}
      wrongPicks={wrongPicks}
      glowAnswer={wrongPicks.length > 0}
      disabled={flow.phase !== 'running'}
      onPick={onPick}
      onQuit={() => {
        if (requestQuit()) onQuit();
      }}
    />
  );
}
