/**
 * 마스터 도전 — 9문제(섞음)를 모두 맞히고 TRAINING_MASTER_MS 안에 끝내야 한다. 시계는 단 전체 카운트다운.
 * 틀리면 바로 끝, 시간이 다 되어도 끝. 나가면 finishTraining을 부르지 않는다.
 */
import { useMemo, useRef, useState } from 'react';
import type { SpeciesId } from '../../domain/field/creatures';
import { planChallenge } from '../../domain/field/training';
import { TRAINING_MASTER_MS, type TrainingDan } from '../../domain/field/tuning';
import { debugFlags } from '../debugFlags';
import { QuizBoard } from './QuizBoard';
import { TRAINING_QUESTION_COUNT } from './flow';
import { trainingText } from './trainingText';
import { useRunClock } from './useRunClock';
import { useTrainingFx } from './useTrainingFx';
import { useTrainingRun, type TrainingDone } from './useTrainingRun';

/** 남은 시간이 이만큼 이하면 시계가 빨개진다 */
const WARN_MS = 5000;

interface Props {
  dan: TrainingDan;
  species: SpeciesId;
  onDone: (d: TrainingDone) => void;
  onQuit: () => void;
}

export function ChallengeMode({ dan, species, onDone, onQuit }: Props) {
  const questions = useMemo(() => planChallenge(Math.random, dan), [dan]);
  const { flow, send, record } = useTrainingRun(dan, 'challenge', onDone);
  const fx = useTrainingFx(species);
  const [leftMs, setLeftMs] = useState(TRAINING_MASTER_MS);
  const shownTenth = useRef(Math.ceil(TRAINING_MASTER_MS / 100));
  const sendRef = useRef(send);
  sendRef.current = send;
  const clock = useRunClock(flow.phase === 'running', debugFlags().noTimer, (elapsed) => {
    const left = Math.max(0, TRAINING_MASTER_MS - elapsed);
    // 화면은 0.1초가 바뀔 때만 다시 그린다
    const tenth = Math.ceil(left / 100);
    if (tenth !== shownTenth.current) {
      shownTenth.current = tenth;
      setLeftMs(left);
    }
    if (elapsed > TRAINING_MASTER_MS) sendRef.current({ type: 'timeout' });
  });
  const lastAt = useRef(0);
  const [message, setMessage] = useState<string>(trainingText.challengeRule(TRAINING_MASTER_MS / 1000));
  const [wrongKey, setWrongKey] = useState(0);
  const [rights, setRights] = useState(0);
  const q = questions[Math.min(flow.index, questions.length - 1)];
  const running = flow.phase === 'running';

  const onPick = (value: number) => {
    if (!running) return;
    const correct = value === q.answer;
    const ms = Math.round(clock.current - lastAt.current);
    lastAt.current = clock.current;
    record(q.multiplier, correct, ms);
    send({ type: 'answer', correct, ms });
    if (correct) {
      fx.fire(rights);
      setRights((n) => n + 1);
      setMessage(trainingText.good);
    } else {
      setWrongKey((k) => k + 1);
      setMessage(trainingText.missEnd);
    }
  };

  return (
    <QuizBoard
      testId="training-challenge"
      dan={dan}
      species={species}
      question={q}
      solved={flow.index}
      fx={fx}
      badge={
        <div
          className={`training__badge training__clock ${leftMs <= WARN_MS ? 'training__clock--warn' : ''}`}
          data-testid="training-clock"
          aria-label={`남은 시간 ${(leftMs / 1000).toFixed(1)}초, ${flow.index}문제 맞힘`}
        >
          <span>⏱ {(leftMs / 1000).toFixed(1)}</span>
          <small>
            {flow.index}/{TRAINING_QUESTION_COUNT}
          </small>
        </div>
      }
      message={message}
      wrongKey={wrongKey}
      wrongPicks={[]}
      glowAnswer={false}
      disabled={!running}
      onPick={onPick}
      onQuit={() => {
        send({ type: 'quit' });
        onQuit();
      }}
    />
  );
}
