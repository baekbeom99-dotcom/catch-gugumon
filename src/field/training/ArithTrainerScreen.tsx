/**
 * 셈연습 트레이너 화면 (`#/field/training/arith/:level`) — 입구 → 마스터 도전(9문제·전체 제한 시간) → 결과.
 * 학습은 없다. 모르는 단계면 필드로. 나갈 때는 늘 navigate('/field', { replace: true }) (체육관 안 그 자리).
 * 끝까지 갔을 때만 finishArithTraining을 한 번 부른다(runner) — 그만하기·뒤로 가기는 정산하지 않는다.
 */
import { useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import type { ArithLevel } from '../../domain/arith';
import { ARITH_TRAINER_LEVELS, ARITH_TRAINER_MASTER_MS, ARITH_TRAINER_QUESTIONS } from '../../domain/field/tuning';
import { planArithTrainer } from '../../domain/field/arithTrainer';
import { useGameStore } from '../../store/useGameStore';
import { pickCompanion } from '../companion';
import { ChallengeMode } from './ChallengeMode';
import { fromArithTrainer, type BoardQuestion } from './boardQuestion';
import { TrainingResult } from './TrainingResult';
import { arithRunnerFactory, type ArithDone } from './runner';
import { trainingText } from './trainingText';
import './training.css';

type View = { kind: 'entry' } | { kind: 'challenge'; run: number; questions: BoardQuestion[] } | { kind: 'result'; done: ArithDone };

export function ArithTrainerScreen() {
  const { level } = useParams();
  if (!(ARITH_TRAINER_LEVELS as readonly string[]).includes(level ?? '')) return <Navigate to="/field" replace />;
  return <ArithTrainer level={level as ArithLevel} />;
}

function ArithTrainer({ level }: { level: ArithLevel }) {
  const navigate = useNavigate();
  const best = useGameStore((s) => s.field.training.arith[level]?.bestMs);
  const [species] = useState(() => pickCompanion(useGameStore.getState()));
  const [view, setView] = useState<View>({ kind: 'entry' });
  const [run, setRun] = useState(0);
  const name = trainingText.arithName(level);

  const toGym = () => navigate('/field', { replace: true });
  const start = () => {
    const questions = planArithTrainer(Math.random, level).map(fromArithTrainer);
    setRun((n) => n + 1);
    setView({ kind: 'challenge', run: run + 1, questions });
  };

  if (view.kind === 'challenge')
    return (
      <ChallengeMode
        key={view.run}
        testId="arith-challenge"
        title={name}
        questions={view.questions}
        limitMs={ARITH_TRAINER_MASTER_MS[level]}
        species={species}
        makeRunner={arithRunnerFactory(level)}
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
        text={trainingText.arithResult(level, done.result, done.outcome, done.timeMs)}
        timeMs={done.timeMs}
        backLabel={trainingText.backToGym}
        onAgain={start}
        onTown={toGym}
      />
    );
  }

  return (
    <div className="training training--entry" data-testid="arith-entry" data-level={level}>
      <div className="training__sign" role="heading" aria-level={1}>
        <span className="training__sign-board">{name}</span>
        <span className="training__sign-post" aria-hidden />
      </div>
      <div className="training__entry-status">
        {best !== undefined && <span className="training__tag training__tag--gold">⭐ 마스터 {trainingText.seconds(best)}</span>}
      </div>
      <div className="training__menu">
        <button type="button" className="btn btn--primary training__mode" data-testid="arith-challenge-btn" onClick={start}>
          <strong>{trainingText.challengeButton}</strong>
          <small>{trainingText.arithHint(level, ARITH_TRAINER_QUESTIONS)}</small>
        </button>
      </div>
      <div className="training__entry-actions">
        <button type="button" className="btn btn--ghost training__btn" data-testid="arith-gym-btn" onClick={toGym}>
          {trainingText.backToGym}
        </button>
      </div>
    </div>
  );
}
