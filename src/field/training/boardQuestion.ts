/**
 * 문제 화면(QuizBoard)이 그리는 문제 한 개 — 구구단·셈연습·동상이 같이 쓴다.
 * 순수 변환만 한다. label은 카드에 그대로 쓰는 글: `7 × 8`, `53 − 8`, 보수는 `7 + ? = 10`
 */
import type { ArithQuestion } from '../../domain/arith';
import type { LowGradeProblem } from '../../domain/field/lowGrade';
import type { ArithTrainerQuestion } from '../../domain/field/arithTrainer';
import type { TrainingQuestion } from '../../domain/field/training';
import { getFact, type FactId } from '../../domain/facts';
import type { Rng } from '../../domain/random';
import { REVERSE_CHANCE } from '../../domain/field/tuning';
import { reverseQuestion } from '../../domain/field/reverse';
import { formatClockChoice, type ClockQuestion } from '../../domain/field/clock';

/** 시계 문제를 읽어 주는 글 (시각을 알려 주면 안 된다) */
export const CLOCK_SPOKEN = '몇 시 몇 분일까요?';

export type BoardQuestion = {
  key: string;
  label: string;
  answer: number;
  choices: number[];
  /** 구구단 문제일 때만 */
  dan?: number;
  multiplier?: number;
  /** 시계 문제일 때만: 시계 그림이 가리키는 시각 (label은 비어 있다) */
  clock?: { h: number; m: number };
  /** 보기 버튼에 쓸 글 (없으면 숫자 그대로). 시계는 3:30꼴 */
  choiceText?: (n: number) => string;
};

export function fromTraining(q: TrainingQuestion): BoardQuestion {
  return { key: `m${q.dan}x${q.multiplier}`, label: `${q.dan} × ${q.multiplier}`, answer: q.answer, choices: q.choices, dan: q.dan, multiplier: q.multiplier };
}

/**
 * 학습 문제를 거꾸로(나눗셈)로: `P ÷ 나누는 수 = ?`. 답은 몫. 기록은 원래 단·곱하는 수로 남긴다(dan·multiplier 그대로).
 * rng는 어느 쪽 인수를 나눌지 고르는 데 쓴다.
 */
export function fromTrainingReversed(q: TrainingQuestion, rng: Rng): BoardQuestion {
  const r = reverseQuestion(rng, getFact(`${q.dan}x${q.multiplier}` as FactId));
  const d = r.display;
  const label = d.kind === 'equation' ? `${d.a} ÷ ${d.b}` : `${q.answer} ÷ ${q.dan}`;
  return { key: `m${q.dan}x${q.multiplier}r`, label, answer: r.answer, choices: r.choices, dan: q.dan, multiplier: q.multiplier };
}

/** 마스터한 단이면 학습 문제 각각을 확률 chance로 거꾸로 바꾼다 */
export function studyBoard(qs: TrainingQuestion[], mastered: ReadonlySet<number>, rng: Rng, chance: number = REVERSE_CHANCE): BoardQuestion[] {
  return qs.map((q) => (mastered.has(q.dan) && rng() < chance ? fromTrainingReversed(q, rng) : fromTraining(q)));
}

/** 보수처럼 빈칸이 앞이나 뒤에 있는 문제는 식 전체를, 그 밖에는 `a op b` 만 (뒤에 "= ?"는 카드가 붙인다) */
export function arithLabel(q: Pick<ArithQuestion, 'display'>): string {
  const d = q.display;
  const n = (v: number | null) => (v === null ? '?' : String(v));
  if (d.result === null) return `${n(d.a)} ${d.op} ${n(d.b)}`;
  return `${n(d.a)} ${d.op} ${n(d.b)} = ${d.result}`;
}

/** 화면 읽기 프로그램용 읽는 글: 구구단 "7 곱하기 8은?", 덧셈 "7 더하기 8은?", 뺄셈 "53 빼기 8은?", 보수 "7 더하기 몇은 10?" */
export function spokenLabel(q: Pick<BoardQuestion, 'label' | 'dan' | 'multiplier' | 'clock'>): string {
  if (q.clock) return CLOCK_SPOKEN; // 시계 문제: 정답을 읽어 주지 않는다
  const div = /^(\d+) ÷ (\d+)$/.exec(q.label);
  if (div) return `${div[1]} 나누기 ${div[2]}은?`;
  if (q.dan !== undefined && q.multiplier !== undefined) return `${q.dan} 곱하기 ${q.multiplier}은?`;
  const m = /^(.+?) ([+−-]) (.+?)(?: = (\d+))?$/.exec(q.label);
  if (!m) return q.label;
  const [, a, op, b, result] = m;
  const word = op === '+' ? '더하기' : '빼기';
  if (a === '?') return `몇 ${word} ${b}은 ${result}?`;
  if (b === '?') return `${a} ${word} 몇은 ${result}?`;
  return `${a} ${word} ${b}은?`;
}

export function fromArith(q: ArithQuestion & { choices: number[] }): BoardQuestion {
  return { key: `a${q.a}${q.op}${q.b}`, label: arithLabel(q), answer: q.answer, choices: q.choices };
}

/** planArithTrainer가 준 문제(보기 3개)를 화면 문제로 */
export function fromArithTrainer(t: ArithTrainerQuestion): BoardQuestion {
  return fromArith({ ...t.q, choices: t.choices });
}

/** 시계 읽기 문제: 시계 그림이 문제, 보기는 3:30꼴 글 */
export function fromClock(q: ClockQuestion): BoardQuestion {
  return { key: `c${q.h}:${q.m}`, label: '', answer: q.answer, choices: q.choices, clock: { h: q.h, m: q.m }, choiceText: formatClockChoice };
}

/** 저학년 덧뺄셈 한 문제 + 보기 3개 */
export function fromLowGrade(p: LowGradeProblem, choices: number[]): BoardQuestion {
  return { key: `a${p.a}${p.op}${p.b}`, label: `${p.a} ${p.op} ${p.b}`, answer: p.result, choices };
}
