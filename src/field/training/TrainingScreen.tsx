/**
 * 트레이닝센터 화면 (`#/field/training/:dan`) — 입구(간판·모드 고르기) → 학습 | 마스터 도전 → 결과.
 * 열리지 않았거나 모르는 단이면 필드로 돌려보낸다. 마을로 나가는 길은 늘 navigate('/field') (주인공은 문 앞에 저장돼 있다).
 */
import { useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { isChallengeOpen, isTrainingOpen } from '../../domain/field/training';
import { TRAINING_DANS, type TrainingDan } from '../../domain/field/tuning';
import { useGameStore } from '../../store/useGameStore';
import { pickCompanion } from '../companion';
import { ChallengeMode } from './ChallengeMode';
import { StudyMode } from './StudyMode';
import { TrainingResult } from './TrainingResult';
import { trainingText } from './trainingText';
import type { TrainingDone } from './useTrainingRun';
import './training.css';

type View = { kind: 'entry' } | { kind: 'study' | 'challenge'; run: number } | { kind: 'result'; done: TrainingDone };

export function TrainingScreen() {
  const { dan: param } = useParams();
  const dan = Number(param);
  const training = useGameStore((s) => s.field.training);
  const valid = (TRAINING_DANS as readonly number[]).includes(dan) && isTrainingOpen(training, dan);
  if (!valid) return <Navigate to="/field" replace />;
  return <TrainingCenter dan={dan as TrainingDan} />;
}

function TrainingCenter({ dan }: { dan: TrainingDan }) {
  const navigate = useNavigate();
  const training = useGameStore((s) => s.field.training);
  // 같은 종이 화면 내내 (동행이 없으면 첫 구구몬)
  const [species] = useState(() => pickCompanion(useGameStore.getState()));
  const [view, setView] = useState<View>({ kind: 'entry' });
  const [run, setRun] = useState(0);
  const [lockedHint, setLockedHint] = useState(0);
  const challengeOpen = isChallengeOpen(training, dan);
  const best = training.mastered[dan]?.bestMs;

  // 입장은 history에 쌓였으므로 나갈 때는 바꿔 끼운다 (안드로이드 뒤로 가기에 건물로 다시 들어가지 않게)
  const toTown = () => navigate('/field', { replace: true });
  const start = (kind: 'study' | 'challenge') => {
    setRun((n) => n + 1);
    setView({ kind, run: run + 1 });
  };
  const toEntry = () => setView({ kind: 'entry' });

  if (view.kind === 'study') return <StudyMode key={view.run} dan={dan} species={species} onDone={(done) => setView({ kind: 'result', done })} onQuit={toEntry} />;
  if (view.kind === 'challenge') return <ChallengeMode key={view.run} dan={dan} species={species} onDone={(done) => setView({ kind: 'result', done })} onQuit={toEntry} />;
  if (view.kind === 'result') {
    const { done } = view;
    return (
      <TrainingResult
        dan={dan}
        mode={done.mode}
        result={done.result}
        outcome={done.outcome}
        timeMs={done.timeMs}
        onChallenge={done.mode === 'study' && challengeOpen ? () => start('challenge') : undefined}
        onAgain={() => start(done.mode === 'challenge' && !challengeOpen ? 'study' : done.mode)}
        onTown={toTown}
      />
    );
  }

  return (
    <div className="training training--entry" data-testid="training-entry">
      <div className="training__sign" role="heading" aria-level={1}>
        <span className="training__sign-board">{trainingText.title(dan)}</span>
        <span className="training__sign-post" aria-hidden />
      </div>
      <div className="training__entry-status">
        {training.studied[dan] && <span className="training__tag">✔ 학습 완료</span>}
        {best !== undefined && <span className="training__tag training__tag--gold">⭐ 마스터 {trainingText.seconds(best)}</span>}
      </div>
      <div className="training__menu">
        <button type="button" className="btn btn--primary training__mode" data-testid="training-study-btn" onClick={() => start('study')}>
          <strong>{trainingText.studyButton}</strong>
          <small>{trainingText.studyHint}</small>
        </button>
        <button
          key={`c${lockedHint}`}
          type="button"
          className={`btn training__mode ${challengeOpen ? '' : 'training__mode--locked'}`}
          data-testid="training-challenge-btn"
          aria-disabled={!challengeOpen}
          onClick={() => (challengeOpen ? start('challenge') : setLockedHint((n) => n + 1))}
        >
          <strong>{challengeOpen ? trainingText.challengeButton : `🔒 ${trainingText.challengeButton}`}</strong>
          <small>{challengeOpen ? trainingText.challengeHint : trainingText.lockedHint}</small>
        </button>
      </div>
      <div className="training__entry-actions">
        <button type="button" className="btn btn--ghost training__btn" onClick={() => navigate('/field/records')}>
          {trainingText.recordsButton}
        </button>
        <button type="button" className="btn btn--ghost training__btn" data-testid="training-town-btn" onClick={toTown}>
          {trainingText.backToTown}
        </button>
      </div>
    </div>
  );
}
