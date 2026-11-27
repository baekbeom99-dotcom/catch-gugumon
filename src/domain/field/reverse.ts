/** 거꾸로 묻기 — 마스터한 단의 곱셈 사실을 나눗셈(56 ÷ 7 = □)으로 바꿔 낸다 */
import type { Fact } from '../facts';
import { type Question, nearbyDistractors } from '../questionGen';
import { type Rng, shuffle } from '../random';
import { REVERSE_CHANCE } from './tuning';

/**
 * 같은 사실을 나눗셈으로 묻는다. `P ÷ a = □`(답 b) 또는 `P ÷ b = □`(답 a) 중 무작위.
 * 기록·숙련도 규칙을 안 바꾸려고 factId는 원래 사실, type은 'product'로 둔다.
 */
export function reverseQuestion(rng: Rng, fact: Fact, choiceCount = 3): Question {
  if (fact.b === 0) throw new Error(`${fact.id}: 0으로 나누는 문제는 만들 수 없다`);
  if (!Number.isInteger(choiceCount) || choiceCount < 2 || choiceCount > 4) {
    throw new Error(`보기 개수는 2~4개만 가능 (${choiceCount})`);
  }
  const askB = rng() < 0.5;
  const divisor = askB ? fact.a : fact.b;
  const answer = askB ? fact.b : fact.a;
  const distractors = nearbyDistractors(rng, answer, 1, 13, (d) => d * divisor !== fact.product);
  return {
    factId: fact.id,
    type: 'product',
    display: { kind: 'equation', op: '÷', a: fact.product, b: divisor, result: null },
    answer,
    choices: shuffle(rng, [answer, ...distractors.slice(0, choiceCount - 1)]),
  };
}

/** 마스터한 단이고 확률에 맞으면 나눗셈으로 바꾼다. 아니면 같은 객체를 돌려준다. */
export function maybeReverse(
  rng: Rng,
  q: Question,
  fact: Fact,
  mastered: ReadonlySet<number>,
  chance: number = REVERSE_CHANCE,
): Question {
  if (fact.b < 1 || !mastered.has(fact.a)) return q;
  if (!(rng() < chance)) return q;
  return reverseQuestion(rng, fact);
}
