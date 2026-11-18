/**
 * 마스터 도전 — 문제(섞음)를 모두 맞히고 limitMs 안에 끝내야 한다. 시계는 전체 카운트다운.
 * 틀리면 바로 끝, 시간이 다 되어도 끝. 나가면 정산(finishTraining 등)을 부르지 않는다.
 * 단 도전(9문제·TRAINING_MASTER_MS)과 셈연습 트레이너가 같이 쓴다: 문제·제한 시간·진행기는 부모가 넘긴다.
 */
import { useRef, useState } from 'react';
import type { SpeciesId } from '../../domain/field/creatures';
import { TRAINING_WARN_MS } from '../../domain/field/tuning';
import { debugFlags } from '../debugFlags';
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
  /** 전체 제한 시간 (밀리초) */
  limitMs: number;
  species: SpeciesId;
  makeRunner: RunnerFactory<BoardQuestion, O>;
  onDone: (d: RunDone<O>) => void;
  onQuit: () => void;
  testId?: string;
}

export function ChallengeMode<O>({ title, questions, limitMs, species, makeRunner, onDone, onQuit, testId = 'training-challenge' }: Props<O>) {
  const { flow, send, answer, requestQuit } = useRun(makeRunner, onDone);
  const fx = useTrainingFx(species);
  const [leftMs, setLeftMs] = useState(limitMs);
  const shownTenth = useRef(Math.ceil(limitMs / 100));
  const sendRef = useRef(send);
  sendRef.current = send;
  const clock = useRunClock(flow.phase === 'running', debugFlags().noTimer, (elapsed) => {
    const left = Math.max(0, limitMs - elapsed);
    // 화면은 0.1초가 바뀔 때만 다시 그린다
    const tenth = Math.ceil(left / 100);
    if (tenth !== shownTenth.current) {
      shownTenth.current = tenth;
      setLeftMs(left);
    }
    if (elapsed > limitMs) sendRef.current({ type: 'timeout' });
  });
  const lastAt = useRef(0);
  const [message, setMessage] = useState<string>(trainingText.challengeRule(limitMs / 1000, questions.length));
  const [wrongKey, setWrongKey] = useState(0);
  const [rights, setRights] = useState(0);
  const q = questions[Math.min(flow.index, questions.length - 1)];
  const running = flow.phase === 'running';

  const onPick = (value: number) => {
    if (!running) return;
    const correct = value === q.answer;
    const ms = Math.round(clock.current - lastAt.current);
    // 받아들여지지 않은 탭(이미 끝난 판)은 기록·효과·글이 없다
    if (!answer(q, correct, ms)) return;
    lastAt.current = clock.current;
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
      testId={testId}
      title={title}
      species={species}
      question={q}
      total={questions.length}
      solved={flow.index}
      fx={fx}
      badge={
        <div
          className={`training__badge training__clock ${leftMs <= TRAINING_WARN_MS ? 'training__clock--warn' : ''}`}
          data-testid="training-clock"
          aria-label={`남은 시간 ${(leftMs / 1000).toFixed(1)}초, ${flow.index}문제 맞힘`}
        >
          <span>⏱ {(leftMs / 1000).toFixed(1)}</span>
          <small>
            {flow.index}/{questions.length}
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
        if (requestQuit()) onQuit();
      }}
    />
  );
}
