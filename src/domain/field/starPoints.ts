/**
 * 별점수 규칙 (순수 로직) — 동상 별점수 계산, 동상 문제 고르기, 별점수 더하기.
 * 수치는 tuning.ts의 STAR_*·STATUE_*. 켜고 끄기는 src/config/featureFlags.ts(스토어가 본다)
 */
import { BASE_DANS, CHALLENGE_DANS, type Fact, FACTS } from '../facts';
import type { FactStat } from '../mastery';
import { randomInt, type Rng, shuffle } from '../random';
import { fieldDans, type FieldId } from './fields';
import { STATUE_FAST_MS, STATUE_QUESTIONS, STATUE_SLOW_MS, STATUE_STARS_MAX, STATUE_STARS_MIN } from './tuning';

/** 덧뺄셈 문제 하나 */
export interface ArithProblem {
  a: number;
  op: '+' | '−';
  b: number;
}

/** 동상 문제 하나: 구구단(단 × 곱하는 수) 또는 덧뺄셈. 화면 문제 모양(BoardQuestion)으로는 화면 쪽에서 바꾼다 */
export type StatueItem = { kind: 'mult'; dan: number; multiplier: number } | ({ kind: 'arith' } & ArithProblem);
export type StatueQuestion = StatueItem;

/**
 * 동상 별점수: 빠를수록 많이. STATUE_FAST_MS 이하면 15, STATUE_SLOW_MS 이상이면 5,
 * 사이는 시간에 반비례 — round(5 + 10 × (1/t − 1/느린) / (1/빠른 − 1/느린)) 를 5~15로 자른다.
 * 이상한 시간(NaN·음수)은 가장 적게
 */
export function statueStars(timeMs: number): number {
  if (Number.isNaN(timeMs) || timeMs < 0) return STATUE_STARS_MIN;
  if (timeMs <= STATUE_FAST_MS) return STATUE_STARS_MAX;
  if (timeMs >= STATUE_SLOW_MS) return STATUE_STARS_MIN;
  const span = STATUE_STARS_MAX - STATUE_STARS_MIN;
  const ratio = (1 / timeMs - 1 / STATUE_SLOW_MS) / (1 / STATUE_FAST_MS - 1 / STATUE_SLOW_MS);
  const v = Math.round(STATUE_STARS_MIN + span * ratio);
  return Math.min(STATUE_STARS_MAX, Math.max(STATUE_STARS_MIN, v));
}

/** 별점수 더하기: 지금 값은 0 이상 정수로 고쳐 읽고, 0보다 큰 정수만 더한다 */
/** 필드 화면에 보일 별 개수 글: 큰 수도 줄바꿈 없이 천 단위로 끊는다 (예: 1234 → 1,234) */
export function formatStars(n: number): string {
  const v = Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  return v.toLocaleString('en-US');
}

export function addStarPoints(current: number, n: number): number {
  const base = Number.isInteger(current) && current >= 0 ? current : 0;
  return Number.isInteger(n) && n > 0 ? base + n : base;
}

/** 덧뺄셈 기본 만들기 (저학년 문제 만들기를 주지 않았을 때): 한 자리 + 한 자리, 또는 한 자리 − 한 자리(답 0 이상) */
function defaultArith(rng: Rng): ArithProblem {
  const a = randomInt(rng, 1, 9);
  const b = randomInt(rng, 1, 9);
  return rng() < 0.5 ? { a, op: '+', b } : { a: Math.max(a, b), op: '−', b: Math.min(a, b) };
}

const arithKey = (p: ArithProblem) => `${p.a}${p.op}${p.b}`;

export interface StatuePlanInput {
  /** 구구단 기록 (learning.facts) — 최근에 틀린 문제(lastWrongAt)를 먼저 낸다 */
  facts: Readonly<Record<string, FactStat>>;
  /** 저학년 모드면 덧뺄셈만 */
  lowGrade: boolean;
  /** 채울 문제를 고를 필드 (없으면 2~9단 전부) */
  field?: FieldId;
  rng: Rng;
  /** 문제 수 (기본 STATUE_QUESTIONS) */
  count?: number;
  /** 저학년: 덧뺄셈 하나 만들기 (없으면 한 자리 덧뺄셈) */
  makeArith?: (rng: Rng) => ArithProblem;
  /** 저학년: 최근에 틀린 덧뺄셈 (앞에 있을수록 먼저) */
  recentWrongArith?: readonly ArithProblem[];
}

/** 동상에 쓰는 곱셈: ×1~×9만 */
const inRange = (f: Fact) => f.b >= 1 && f.b <= 9;
const toItem = (f: Fact): StatueItem => ({ kind: 'mult', dan: f.a, multiplier: f.b });

/**
 * 동상 문제 계획 (설계 E).
 * 구구단: 12·13단 문제 하나를 꼭 넣고(그 단에서 틀린 적 있으면 가장 최근 것, 없으면 무작위),
 * 나머지는 최근에 틀린 문제 순으로, 모자라면 필드(없으면 2~9단) 무작위로 채운다. 같은 문제는 두 번 없다.
 * 12·13단 문제는 무작위 자리에 끼운다.
 * 저학년: 최근에 틀린 덧뺄셈 먼저, 모자라면 makeArith로 채운다 (12·13단 규칙 없음)
 */
export function planStatueQuestions(input: StatuePlanInput): StatueQuestion[] {
  const { facts, rng } = input;
  const count = input.count ?? STATUE_QUESTIONS;
  if (count <= 0) return [];

  if (input.lowGrade) {
    const out: ArithProblem[] = [];
    const keys = new Set<string>();
    const push = (p: ArithProblem) => {
      const k = arithKey(p);
      if (keys.has(k) || out.length >= count) return;
      keys.add(k);
      out.push({ a: p.a, op: p.op, b: p.b });
    };
    for (const p of input.recentWrongArith ?? []) push(p);
    const make = input.makeArith ?? defaultArith;
    // 같은 문제가 계속 나와도 멈추지 않게 횟수를 정해 둔다 (그래도 모자라면 겹쳐도 채운다)
    for (let tries = 0; out.length < count && tries < 500; tries++) push(make(rng));
    while (out.length < count) out.push(make(rng));
    return out.map((p) => ({ kind: 'arith', ...p }));
  }

  const wrongAt = (f: Fact) => facts[f.id]?.lastWrongAt;
  const byRecentWrong = (list: readonly Fact[]) =>
    list
      .filter((f) => inRange(f) && wrongAt(f) != null)
      .sort((x, y) => (wrongAt(y) as number) - (wrongAt(x) as number));

  // 12·13단 하나
  const challenge = FACTS.filter((f) => (CHALLENGE_DANS as readonly number[]).includes(f.a) && inRange(f));
  const challengeWrong = byRecentWrong(challenge);
  const special = challengeWrong[0] ?? shuffle(rng, challenge)[0];
  const chosen: Fact[] = [special];

  // 나머지: 최근에 틀린 문제 → 필드 무작위
  for (const f of byRecentWrong(FACTS)) {
    if (chosen.length >= count) break;
    if (!chosen.includes(f)) chosen.push(f);
  }
  if (chosen.length < count) {
    const dans: number[] = input.field ? fieldDans(input.field, false) : [...BASE_DANS];
    const pool = shuffle(rng, FACTS.filter((f) => dans.includes(f.a) && inRange(f) && !chosen.includes(f)));
    chosen.push(...pool.slice(0, count - chosen.length));
  }
  // 12·13단 문제를 무작위 자리로 (늘 첫 문제가 되지 않게)
  const rest = chosen.slice(1);
  const at = randomInt(rng, 0, rest.length);
  return [...rest.slice(0, at), special, ...rest.slice(at)].map(toItem);
}
