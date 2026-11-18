/** 차례대로 학습 — ×1~×9를 순서대로, 시계 없음. 틀리면 같은 문제를 다시 (틀린 횟수는 센다) */
import { useMemo, useRef, useState } from 'react';
import type { SpeciesId } from '../../domain/field/creatures';
import { planStudy } from '../../domain/field/training';
import type { TrainingDan } from '../../domain/field/tuning';
import { QuizBoard } from './QuizBoard';
import { trainingText } from './trainingText';
import { useRunClock } from './useRunClock';
import { useTrainingFx } from './useTrainingFx';
import { useTrainingRun, type TrainingDone } from './useTrainingRun';

interface Props {
  dan: TrainingDan;
  species: SpeciesId;
  onDone: (d: TrainingDone) => void;
  onQuit: () => void;
}

export function StudyMode({ dan, species, onDone, onQuit }: Props) {
  const questions = useMemo(() => planStudy(dan), [dan]);
  const { flow, send, record } = useTrainingRun(dan, 'study', onDone);
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
    lastAt.current = clock.current;
    record(q.multiplier, correct, ms);
    send({ type: 'answer', correct, ms });
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
      testId="training-study"
      dan={dan}
      species={species}
      question={q}
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
        send({ type: 'quit' });
        onQuit();
      }}
    />
  );
}
