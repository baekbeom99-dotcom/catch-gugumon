/** 상점 연습 문제 한 장 (저학년 모드: 덧셈·뺄셈) — PracticeCard와 같은 모양. 맞고 틀림은 틀린 문제 목록에만 남기고 구구단 학습 기록은 건드리지 않는다 */
import { useEffect, useMemo, useState } from 'react';
import { QuestionView } from '../../components/QuestionView';
import { lowGradeQuestion, type LowGradeProblem } from '../../domain/field/lowGrade';
import { SHOP_ANSWER_GUARD_MS } from '../../domain/field/tuning';
import { useGameStore } from '../../store/useGameStore';
import { LowGradeHint } from '../lowgrade/LowGradeHint';
import { shopText } from './shopText';
import '../../screens/battle.css';
import './shop.css';

interface Props {
  problem: LowGradeProblem;
  /** 문제가 바뀌는 때마다 달라지는 값 (힌트를 보는 동안은 그대로 — 보기도 그대로) */
  qkey: string;
  /** 틀려서 힌트를 보여 주는 중 */
  hint: boolean;
  onAnswer: (correct: boolean) => void;
  onHintPick: () => void;
}

export function LowGradeCard({ problem, qkey, hint, onAnswer, onHintPick }: Props) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const question = useMemo(() => lowGradeQuestion(Math.random, problem), [qkey]);
  const [ready, setReady] = useState(false);
  const [used, setUsed] = useState(false);

  useEffect(() => {
    setUsed(false);
    setReady(false);
    const t = window.setTimeout(() => setReady(true), SHOP_ANSWER_GUARD_MS);
    return () => clearTimeout(t);
  }, [qkey, hint]);

  const pick = (n: number) => {
    if (!ready || used) return;
    setUsed(true);
    if (hint) {
      onHintPick(); // 힌트에서 빛나는 보기를 누르는 것은 기록하지 않는다
      return;
    }
    const correct = n === question.answer;
    useGameStore.getState().recordLowGradeAnswer(problem, correct);
    onAnswer(correct);
  };

  return (
    <div className="practice" data-lowgrade="true">
      <div className="practice__q">
        <QuestionView display={question.display} />
      </div>
      {hint && (
        <div className="practice__hint">
          <LowGradeHint problem={problem} />
        </div>
      )}
      <p className="hint-instruction">{hint ? shopText.hintGuide : shopText.choose}</p>
      <div className="practice__choices">
        {question.choices.map((n) => {
          const glow = hint && n === question.answer;
          return (
            <button key={n} type="button" className={`fshop-choice ${glow ? 'fshop-choice--glow' : ''}`} disabled={!ready || (hint && !glow)} onClick={() => pick(n)}>
              {n}
            </button>
          );
        })}
      </div>
    </div>
  );
}
