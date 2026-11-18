/**
 * 셈연습 트레이너 — 마스터 도전만 있다. 그 단계(기본·고수·보수)의 셈 문제 9개를 보기 3개로 내고,
 * 하나도 안 틀리고 제한 시간 안에 끝내면 합격. React·저장소 없이 순수 계산만.
 */
import {
  BASIC_ARITH_KINDS,
  COMP_ARITH_KINDS,
  HARD_ARITH_KINDS,
  generateArith,
  type ArithKind,
  type ArithLevel,
  type ArithQuestion,
} from '../arith';
import { shuffle, type Rng } from '../random';
import { ARITH_TRAINER_MASTER_MS, ARITH_TRAINER_QUESTIONS } from './tuning';

export type ArithTrainerQuestion = {
  q: ArithQuestion;
  /** 정답을 포함한 보기 3개 (섞여 있음, 겹치지 않음) */
  choices: number[];
};

const KINDS_OF_LEVEL: Record<ArithLevel, readonly ArithKind[]> = {
  basic: BASIC_ARITH_KINDS,
  hard: HARD_ARITH_KINDS,
  comp: COMP_ARITH_KINDS,
};

/** 그 단계에서 나오는 셈 종류 */
export function arithKindsOf(level: ArithLevel): readonly ArithKind[] {
  return KINDS_OF_LEVEL[level];
}

/** 4지선다 문제에서 정답 + 오답 2개를 골라 보기 3개로 섞는다 */
function threeChoices(rng: Rng, q: ArithQuestion): number[] {
  const wrong = q.choices.filter((c, i) => c !== q.answer && q.choices.indexOf(c) === i).slice(0, 2);
  return shuffle(rng, [q.answer, ...wrong]);
}

const keyOf = (q: ArithQuestion) => `${q.a}${q.op}${q.b}=${q.result}`;

/** 셈연습 도전 9문제: 단계의 종류를 고루 섞고, 같은 식은 되도록 겹치지 않게 */
export function planArithTrainer(rng: Rng, level: ArithLevel): ArithTrainerQuestion[] {
  const kinds = KINDS_OF_LEVEL[level];
  // 종류를 돌아가며 9개 (4종이면 3·2·2·2개), 그다음 순서를 섞는다
  const order = shuffle(rng, kinds);
  const plan = shuffle(
    rng,
    Array.from({ length: ARITH_TRAINER_QUESTIONS }, (_, i) => order[i % order.length]),
  );
  const seen = new Set<string>();
  return plan.map((kind) => {
    let q = generateArith(rng, kind);
    // 보수처럼 가짓수가 적으면 겹칠 수 있다: 몇 번만 다시 뽑아 본다
    for (let tries = 0; seen.has(keyOf(q)) && tries < 20; tries++) q = generateArith(rng, kind);
    seen.add(keyOf(q));
    return { q, choices: threeChoices(rng, q) };
  });
}

/** 합격(모두 맞힘 + 그 단계 제한 시간 안) / 틀림 / 너무 느림 (이상한 시간은 느림) */
export function judgeArithTrainer(a: { mistakes: number; timeMs: number }, level: ArithLevel): 'pass' | 'wrong' | 'slow' {
  // 틀린 수가 0이 아니면(이상한 값 포함) 틀림
  if (a.mistakes !== 0) return 'wrong';
  const ok = Number.isFinite(a.timeMs) && a.timeMs >= 0 && a.timeMs <= ARITH_TRAINER_MASTER_MS[level];
  return ok ? 'pass' : 'slow';
}
