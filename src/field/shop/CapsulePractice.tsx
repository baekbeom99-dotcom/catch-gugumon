/** 캡슐 얻기: 그 캡슐 지역의 문제를 무작위로 풀면 캡슐 CAPSULE_REWARD개. 시간 제한 없음, 틀리면 힌트를 보고 다음 카드로(그 문제는 잠시 뒤 다시). 중간에 나가면 보상 없음 */
import { useRef, useState } from 'react';
import { CAPSULE_NAMES, type CapsuleType } from '../../domain/field/capsules';
import { lowGradeFieldOf, planLowGradeShop } from '../../domain/field/lowGrade';
import { answerLowGradeRun, createLowGradeRun, leaveLowGradeHint, lowGradeRunItem } from '../../domain/field/lowGradeRun';
import { answerShopQuiz, createShopQuiz, leaveShopHint, planShopQuestions, shopQuizItem } from '../../domain/field/shopQuiz';
import { CAPSULE_REWARD } from '../../domain/field/tuning';
import { useGameStore } from '../../store/useGameStore';
import { CapsuleBall } from '../art/CapsuleBall';
import { LowGradeCard } from './LowGradeCard';
import { PracticeCard } from './PracticeCard';
import { shopText } from './shopText';

interface Props {
  type: CapsuleType;
  /** 끝까지 풀고 결과를 확인했다 */
  onDone: () => void;
  /** 중간에 나간다 (보상 없음) */
  onQuit: () => void;
}

/** 캡슐 얻기: 저학년 모드가 켜져 있으면 덧뺄셈 연습, 아니면 구구단 연습 (연습을 여는 순간 정해 끝까지 같다) */
export function CapsulePractice(props: Props) {
  const [low] = useState(() => useGameStore.getState().settings.lowGrade);
  return low ? <LowGradeCapsulePractice {...props} /> : <TimesCapsulePractice {...props} />;
}

/** 저학년 캡슐 연습: 그 캡슐 지역(황금 캡슐은 세 지역 중 무작위)의 덧뺄셈 LOWGRADE_SHOP_QUESTIONS문제 */
function LowGradeCapsulePractice({ type, onDone, onQuit }: Props) {
  const [run, setRun] = useState(() => createLowGradeRun(planLowGradeShop(Math.random, lowGradeFieldOf(Math.random, type)), 1));
  const granted = useRef(false);
  const problem = lowGradeRunItem(run);

  const onAnswer = (correct: boolean) => {
    const next = answerLowGradeRun(run, correct, Math.random);
    setRun(next);
    if (next.done && !granted.current) {
      granted.current = true;
      useGameStore.getState().grantCapsules(type, CAPSULE_REWARD);
    }
  };

  if (problem === null) {
    return (
      <div className="practice-result" role="status">
        <CapsuleBall type={type} size={72} />
        <p className="practice-result__text">{shopText.gotCapsules(CAPSULE_NAMES[type], CAPSULE_REWARD)}</p>
        <button type="button" className="btn btn--primary fshop-btn" onClick={onDone}>
          {shopText.ok}
        </button>
      </div>
    );
  }
  return (
    <div className="practice-wrap">
      <div className="practice-head">
        <span className="practice-head__title">{shopText.practiceHeader(CAPSULE_NAMES[type], run.index + 1, run.order.length)}</span>
        <button type="button" className="btn btn--ghost fshop-btn fshop-btn--small" onClick={onQuit}>
          {shopText.quit}
        </button>
      </div>
      <LowGradeCard
        problem={problem}
        qkey={`c${run.index}:${problem.a}${problem.op}${problem.b}`}
        hint={run.hint}
        onAnswer={onAnswer}
        onHintPick={() => setRun(leaveLowGradeHint(run, Math.random))}
      />
    </div>
  );
}

function TimesCapsulePractice({ type, onDone, onQuit }: Props) {
  const [quiz, setQuiz] = useState(() => {
    const { learning } = useGameStore.getState();
    const learner = { facts: learning.facts, danRecent: learning.danRecent, challengeUnlocked: learning.challengeUnlocked, boosted: learning.boosted };
    return createShopQuiz(planShopQuestions(learner, type, Date.now(), Math.random));
  });
  /** 캡슐은 끝나는 순간 한 번만 준다 */
  const granted = useRef(false);
  const item = shopQuizItem(quiz);

  const onAnswer = (correct: boolean) => {
    const next = answerShopQuiz(quiz, correct);
    setQuiz(next);
    if (next.done && !granted.current) {
      granted.current = true;
      useGameStore.getState().grantCapsules(type, CAPSULE_REWARD);
    }
  };

  if (item === null) {
    return (
      <div className="practice-result" role="status">
        <CapsuleBall type={type} size={72} />
        <p className="practice-result__text">{shopText.gotCapsules(CAPSULE_NAMES[type], CAPSULE_REWARD)}</p>
        <button type="button" className="btn btn--primary fshop-btn" onClick={onDone}>
          {shopText.ok}
        </button>
      </div>
    );
  }
  return (
    <div className="practice-wrap">
      <div className="practice-head">
        <span className="practice-head__title">{shopText.practiceHeader(CAPSULE_NAMES[type], quiz.index + 1, quiz.plan.length)}</span>
        <button type="button" className="btn btn--ghost fshop-btn fshop-btn--small" onClick={onQuit}>
          {shopText.quit}
        </button>
      </div>
      <PracticeCard
        factId={item.factId}
        type={item.type}
        qkey={`c${quiz.index}:${item.factId}:${item.type}`}
        hint={quiz.hint}
        onAnswer={onAnswer}
        onHintPick={() => setQuiz(leaveShopHint(quiz, Math.random))}
      />
    </div>
  );
}
