/** 저학년 문제를 틀렸을 때의 힌트: 식과 답을 보여 준다 (전투·상점 연습이 같이 쓴다) */
import type { LowGradeProblem } from '../../domain/field/lowGrade';

export function LowGradeHint({ problem }: { problem: LowGradeProblem }) {
  return (
    <div className="hint" data-lowgrade-hint>
      <div className="hint__equation">
        {problem.a} {problem.op} {problem.b} = <strong>{problem.result}</strong>
      </div>
    </div>
  );
}
