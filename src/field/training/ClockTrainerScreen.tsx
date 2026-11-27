/**
 * 시계 읽기 트레이너 화면 (`#/field/training/clock/:level`) — 입구 → 마스터 도전(9문제·전체 제한 시간) → 결과.
 * 셈연습 트레이너와 같은 모양: 학습은 없고, 틀리면 끝, 끝까지 갔을 때만 finishClockTraining을 한 번 부른다(runner).
 * 모르는 단계이거나 아직 열리지 않은 단계(5분은 정각 마스터 뒤, 1분은 5분 마스터 뒤)면 필드로 돌려보낸다.
 * 나갈 때는 늘 navigate('/field', { replace: true }) (체육관 안 그 자리).
 */
import { useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { CLOCK_LEVELS, isClockOpen, planClockTrainer, type ClockLevel } from '../../domain/field/clock';
import { CLOCK_TRAINER_MASTER_MS, CLOCK_TRAINER_QUESTIONS } from '../../domain/field/tuning';
import { useGameStore } from '../../store/useGameStore';
import { pickCompanion } from '../companion';
import { ChallengeMode } from './ChallengeMode';
import { fromClock, type BoardQuestion } from './boardQuestion';
import { TrainingResult } from './TrainingResult';
import { clockRunnerFactory, type ClockDone } from './runner';
import { trainingText } from './trainingText';
import './training.css';

type View = { kind: 'entry' } | { kind: 'challenge'; run: number; questions: BoardQuestion[] } | { kind: 'result'; done: ClockDone };

export function ClockTrainerScreen() {
  const { level } = useParams();
  const training = useGameStore((s) => s.field.training);
  if (!(CLOCK_LEVELS as readonly string[]).includes(level ?? '')) return <Navigate to="/field" replace />;
  if (!isClockOpen(training, level as ClockLevel)) return <Navigate to="/field" replace />;
  return <ClockTrainer level={level as ClockLevel} />;
}

function ClockTrainer({ level }: { level: ClockLevel }) {
  const navigate = useNavigate();
  const best = useGameStore((s) => s.field.training.clock[level]?.bestMs);
  const [species] = useState(() => pickCompanion(useGameStore.getState()));
  const [view, setView] = useState<View>({ kind: 'entry' });
  const [run, setRun] = useState(0);
  const name = trainingText.clockName(level);

  const toGym = () => navigate('/field', { replace: true });
  const start = () => {
    const questions = planClockTrainer(Math.random, level).map(fromClock);
    setRun((n) => n + 1);
    setView({ kind: 'challenge', run: run + 1, questions });
  };

  if (view.kind === 'challenge')
    return (
      <ChallengeMode
        key={view.run}
        testId="clock-challenge"
        title={name}
        questions={view.questions}
        limitMs={CLOCK_TRAINER_MASTER_MS[level]}
        species={species}
        makeRunner={clockRunnerFactory(level)}
        onDone={(done) => setView({ kind: 'result', done })}
        onQuit={() => setView({ kind: 'entry' })}
      />
    );
  if (view.kind === 'result') {
    const { done } = view;
    return (
      <TrainingResult
        mode="challenge"
        result={done.result}
        outcome={done.outcome}
        text={trainingText.clockResult(level, done.result, done.outcome, done.timeMs)}
        timeMs={done.timeMs}
        backLabel={trainingText.backToGym}
        onAgain={start}
        onTown={toGym}
      />
    );
  }

  return (
    <div className="training training--entry" data-testid="clock-entry" data-level={level}>
      <div className="training__sign" role="heading" aria-level={1}>
        <span className="training__sign-board">{name}</span>
        <span className="training__sign-post" aria-hidden />
      </div>
      <div className="training__entry-status">
        {best !== undefined && <span className="training__tag training__tag--gold">⭐ 마스터 {trainingText.seconds(best)}</span>}
      </div>
      <div className="training__menu">
        <button type="button" className="btn btn--primary training__mode" data-testid="clock-challenge-btn" onClick={start}>
          <strong>{trainingText.challengeButton}</strong>
          <small>{trainingText.clockHint(level, CLOCK_TRAINER_QUESTIONS)}</small>
        </button>
      </div>
      <div className="training__entry-actions">
        <button type="button" className="btn btn--ghost training__btn" data-testid="clock-gym-btn" onClick={toGym}>
          {trainingText.backToGym}
        </button>
      </div>
    </div>
  );
}
