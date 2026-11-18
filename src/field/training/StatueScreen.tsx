/**
 * 체육관 동상 화면 (`#/field/statue`) — 7문제를 차례로 풀고(틀리면 그 문제를 다시), 푸는 시간으로 별점수를 받는다.
 * 별점수가 꺼져 있으면(isStarPointsEnabled) 이 화면은 없는 것처럼 필드로 돌려보낸다.
 * 구구단은 12·13단 한 문제를 꼭 넣고, 저학년 모드면 덧뺄셈(틀린 문제 중심). 끝까지 갔을 때만 finishStatue 한 번.
 */
import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { isStarPointsEnabled } from '../../config/featureFlags';
import { generateLowGrade, lowGradeAnswer, lowGradeChoices, lowGradeFieldOf, type LowGradeProblem } from '../../domain/field/lowGrade';
import { planStatueQuestions, type StatueItem } from '../../domain/field/starPoints';
import { planStudy } from '../../domain/field/training';
import type { TrainingDan } from '../../domain/field/tuning';
import { useGameStore } from '../../store/useGameStore';
import { pickCompanion } from '../companion';
import { fromLowGrade, fromTraining, type BoardQuestion } from './boardQuestion';
import { StudyMode } from './StudyMode';
import { statueRunnerFactory, type StatueDone } from './runner';
import { trainingText } from './trainingText';
import './training.css';

/** 동상 문제 계획 → 화면 문제. 같은 순서로 원래 문제(item)도 돌려준다(답 기록용) */
function buildQuestions(): { questions: BoardQuestion[]; items: Map<string, StatueItem> } {
  const s = useGameStore.getState();
  const low = s.settings.lowGrade;
  const items = planStatueQuestions({
    facts: s.learning.facts,
    lowGrade: low,
    rng: Math.random,
    recentWrongArith: s.field.lowGrade.recentWrong,
    // 저학년 덧뺄셈은 필드마다 난이도가 달라 문제마다 필드를 섞어 고른다
    makeArith: (rng) => generateLowGrade(rng, lowGradeFieldOf(rng, 'legend')),
  });
  const map = new Map<string, StatueItem>();
  const questions = items.map((it): BoardQuestion => {
    let q: BoardQuestion;
    if (it.kind === 'mult') {
      const base = planStudy(it.dan as TrainingDan)[it.multiplier - 1];
      q = fromTraining(base);
    } else {
      const p: LowGradeProblem = { a: it.a, op: it.op, b: it.b, result: lowGradeAnswer(it) };
      q = fromLowGrade(p, lowGradeChoices(Math.random, p));
    }
    map.set(q.key, it);
    return q;
  });
  return { questions, items: map };
}

export function StatueScreen() {
  if (!isStarPointsEnabled()) return <Navigate to="/field" replace />;
  return <Statue />;
}

function Statue() {
  const navigate = useNavigate();
  const [species] = useState(() => pickCompanion(useGameStore.getState()));
  const [plan] = useState(buildQuestions);
  const [done, setDone] = useState<StatueDone | null>(null);
  // 진행기는 화면이 사는 동안 하나 (StudyMode가 처음 한 번만 만든다)
  const [makeRunner] = useState(() =>
    statueRunnerFactory(plan.questions.length, (q, correct, ms, retry) => {
      const it = plan.items.get(q.key);
      if (!it) return;
      const store = useGameStore.getState();
      // 틀린 뒤 다시 푸는 답은 기록하지 않는다 (틀린 문제가 목록에 남도록, 구구단은 isRetry로 상자 보호)
      if (it.kind === 'mult') store.recordTrainingAnswer(it.dan, it.multiplier, correct, ms, Date.now(), retry);
      else if (!retry) store.recordLowGradeAnswer({ a: it.a, op: it.op, b: it.b, result: lowGradeAnswer(it) }, correct);
    }),
  );
  const toGym = () => navigate('/field', { replace: true });

  if (done) {
    const allRight = done.outcome.mistakes === 0;
    return (
      <div className="training training--result" data-testid="statue-result" data-stars={done.outcome.stars}>
        <div className={`training__result-card ${allRight ? 'training__result-card--pass' : ''}`}>
          <h1 className="training__result-title">{trainingText.statueDone}</h1>
          <div className="training__result-lines">
            <p>{trainingText.elapsed(done.timeMs)}</p>
            <p>{allRight ? trainingText.statueAllRight : trainingText.statueSomeWrong(done.outcome.mistakes)}</p>
            {done.outcome.stars > 0 && <p className="training__new-best">⭐ {trainingText.statueStars(done.outcome.stars)}</p>}
          </div>
        </div>
        <div className="training__result-actions">
          <button type="button" className="btn btn--primary training__btn" data-testid="statue-gym-btn" onClick={toGym}>
            {trainingText.backToGym}
          </button>
        </div>
      </div>
    );
  }

  return (
    <StudyMode
      testId="statue-board"
      title={trainingText.statueTitle}
      questions={plan.questions}
      species={species}
      makeRunner={makeRunner}
      onDone={setDone}
      onQuit={toGym}
    />
  );
}
