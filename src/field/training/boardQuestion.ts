/**
 * 문제 화면(QuizBoard)이 그리는 문제 한 개 — 구구단·셈연습·동상이 같이 쓴다.
 * 순수 변환만 한다. label은 카드에 그대로 쓰는 글: `7 × 8`, `53 − 8`, 보수는 `7 + ? = 10`
 */
import type { ArithQuestion } from '../../domain/arith';
import type { LowGradeProblem } from '../../domain/field/lowGrade';
import type { ArithTrainerQuestion } from '../../domain/field/arithTrainer';
import type { TrainingQuestion } from '../../domain/field/training';

export type BoardQuestion = {
  key: string;
  label: string;
  answer: number;
  choices: number[];
  /** 구구단 문제일 때만 */
  dan?: number;
  multiplier?: number;
};

export function fromTraining(q: TrainingQuestion): BoardQuestion {
  return { key: `m${q.dan}x${q.multiplier}`, label: `${q.dan} × ${q.multiplier}`, answer: q.answer, choices: q.choices, dan: q.dan, multiplier: q.multiplier };
}

/** 보수처럼 빈칸이 앞이나 뒤에 있는 문제는 식 전체를, 그 밖에는 `a op b` 만 (뒤에 "= ?"는 카드가 붙인다) */
export function arithLabel(q: Pick<ArithQuestion, 'display'>): string {
  const d = q.display;
  const n = (v: number | null) => (v === null ? '?' : String(v));
  if (d.result === null) return `${n(d.a)} ${d.op} ${n(d.b)}`;
  return `${n(d.a)} ${d.op} ${n(d.b)} = ${d.result}`;
}

export function fromArith(q: ArithQuestion & { choices: number[] }): BoardQuestion {
  return { key: `a${q.a}${q.op}${q.b}`, label: arithLabel(q), answer: q.answer, choices: q.choices };
}

/** planArithTrainer가 준 문제(보기 3개)를 화면 문제로 */
export function fromArithTrainer(t: ArithTrainerQuestion): BoardQuestion {
  return fromArith({ ...t.q, choices: t.choices });
}

/** 저학년 덧뺄셈 한 문제 + 보기 3개 */
export function fromLowGrade(p: LowGradeProblem, choices: number[]): BoardQuestion {
  return { key: `a${p.a}${p.op}${p.b}`, label: `${p.a} ${p.op} ${p.b}`, answer: p.result, choices };
}
