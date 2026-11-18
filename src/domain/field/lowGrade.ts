/**
 * 저학년 모드 문제 규칙 (순수 로직) — 구구단 대신 덧셈·뺄셈.
 * 초원: 한 자리 + 한 자리, 또는 큰 수 − 작은 수(한 자리끼리, 답 0 이상)
 * 물가: 두 자리 − 한 자리 (답 1 이상, 받아내림 있음·없음이 반반)
 * 사막: 두 자리 + 한 자리 (답도 두 자리 ≤ 99, 받아올림 있음·없음이 반반)
 * 수치는 tuning.ts의 LOWGRADE_*. 체육관·트레이닝은 저학년 모드와 상관없이 구구단 그대로.
 */
import type { ArithDisplay } from '../arith';
import { randomInt, shuffle, type Rng } from '../random';
import type { FieldId } from './fields';
import type { ArithProblem } from './starPoints';
import { LOWGRADE_PASSWORD, LOWGRADE_SHOP_QUESTIONS, LOWGRADE_WRONG_KEEP } from './tuning';

/** 저학년 문제 하나: a op b = result */
export interface LowGradeProblem {
  a: number;
  op: '+' | '−';
  b: number;
  result: number;
}

const LOW_FIELDS: readonly FieldId[] = ['meadow', 'waterside', 'desert'];

/** 식의 답 */
export function lowGradeAnswer(p: Pick<LowGradeProblem, 'a' | 'op' | 'b'>): number {
  return p.op === '+' ? p.a + p.b : p.a - p.b;
}

/** 같은 문제인가 (a·셈·b가 같으면) */
export function sameLowGrade(x: Pick<LowGradeProblem, 'a' | 'op' | 'b'>, y: Pick<LowGradeProblem, 'a' | 'op' | 'b'>): boolean {
  return x.a === y.a && x.op === y.op && x.b === y.b;
}

const isWhole = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0;

/** 저장에서 읽은 값이 맞는 저학년 문제인가: 0 이상 정수, 셈은 + 또는 −, 답이 맞고 음수가 아니다 */
export function isLowGradeProblem(v: unknown): v is LowGradeProblem {
  if (!v || typeof v !== 'object') return false;
  const o = v as Record<string, unknown>;
  if (!isWhole(o.a) || !isWhole(o.b) || !isWhole(o.result)) return false;
  if (o.op !== '+' && o.op !== '−') return false;
  return lowGradeAnswer({ a: o.a, op: o.op, b: o.b }) === o.result;
}

const make = (a: number, op: '+' | '−', b: number): LowGradeProblem => ({ a, op, b, result: lowGradeAnswer({ a, op, b }) });

/** 그 필드의 저학년 문제 하나 */
export function generateLowGrade(rng: Rng, field: FieldId): LowGradeProblem {
  switch (field) {
    case 'meadow': {
      const x = randomInt(rng, 1, 9);
      const y = randomInt(rng, 1, 9);
      return rng() < 0.5 ? make(x, '+', y) : make(Math.max(x, y), '−', Math.min(x, y));
    }
    case 'waterside': {
      // 두 자리 − 한 자리: 반은 받아내림 있음(일의 자리 < b), 반은 없음(일의 자리 ≥ b)
      const b = randomInt(rng, 1, 9);
      const tens = randomInt(rng, 1, 9);
      const ones = rng() < 0.5 ? randomInt(rng, 0, b - 1) : randomInt(rng, b, 9);
      return make(tens * 10 + ones, '−', b);
    }
    case 'desert': {
      // 두 자리 + 한 자리 = 두 자리: 반은 받아올림 있음(십의 자리 1~8), 반은 없음
      const b = randomInt(rng, 1, 9);
      if (rng() < 0.5) {
        const tens = randomInt(rng, 1, 8);
        const ones = randomInt(rng, 10 - b, 9);
        return make(tens * 10 + ones, '+', b);
      }
      const tens = randomInt(rng, 1, 9);
      const ones = randomInt(rng, 0, 9 - b);
      return make(tens * 10 + ones, '+', b);
    }
  }
}

/** 두 자리 수의 십의 자리·일의 자리를 바꾼 수 (한 자리 수는 그대로) */
function swapDigits(n: number): number {
  if (n < 10 || n > 99) return n;
  return (n % 10) * 10 + Math.floor(n / 10);
}

/**
 * 3지선다 보기: 정답 하나 + 그럴듯한 오답 둘 (섞어서).
 * 오답 후보는 답 ±1, 답 ±10, 자리 바꾼 수, 반대 셈의 답(더하기면 빼기, 빼기면 더하기).
 * 음수·정답과 같은 수·겹치는 수는 뺀다. 답이 99 이하면 100 이상(세 자리)도 뺀다.
 * 후보가 모자라면 답+2, 답−2, 답+3…으로 채운다(세 자리·음수는 건너뜀).
 */
export function lowGradeChoices(rng: Rng, p: LowGradeProblem): number[] {
  const answer = p.result;
  const opposite = p.op === '+' ? p.a - p.b : p.a + p.b;
  const raw = [answer - 1, answer + 1, answer - 10, answer + 10, swapDigits(answer), opposite];
  const pool: number[] = [];
  const ok = (n: number) => Number.isInteger(n) && n >= 0 && (answer > 99 || n <= 99) && n !== answer;
  for (const n of raw) if (ok(n) && !pool.includes(n)) pool.push(n);
  const wrong = shuffle(rng, pool).slice(0, 2);
  for (let k = 2; wrong.length < 2; k++) {
    for (const n of [answer + k, answer - k]) if (wrong.length < 2 && ok(n) && !wrong.includes(n)) wrong.push(n);
  }
  return shuffle(rng, [answer, ...wrong]);
}

/** 그 필드 문제 n개 (되도록 겹치지 않게) */
export function planLowGradeField(rng: Rng, field: FieldId, n: number): LowGradeProblem[] {
  const out: LowGradeProblem[] = [];
  return fillLowGrade(out, rng, field, n);
}

/** list 뒤에 그 필드 무작위 문제를 붙여 n개로 (겹치지 않게 애쓰고, 그래도 모자라면 겹쳐도 채운다) */
function fillLowGrade(list: LowGradeProblem[], rng: Rng, field: FieldId, n: number): LowGradeProblem[] {
  for (let tries = 0; list.length < n && tries < 500; tries++) {
    const q = generateLowGrade(rng, field);
    if (!list.some((x) => sameLowGrade(x, q))) list.push(q);
  }
  while (list.length < n) list.push(generateLowGrade(rng, field));
  return list;
}

/** 상점 캡슐 연습 문제: 그 필드 문제 LOWGRADE_SHOP_QUESTIONS개 */
export function planLowGradeShop(rng: Rng, field: FieldId): LowGradeProblem[] {
  return planLowGradeField(rng, field, LOWGRADE_SHOP_QUESTIONS);
}

/**
 * 회복약 연습 문제: 틀린 문제(앞에 있을수록 최근)를 먼저 n개까지, 모자라면 그 구구몬이 사는 필드 문제로 채운다.
 * 황금 구구몬(legend)은 사는 필드가 없어 세 필드 중 하나를 무작위로 고른다. 깨진 문제는 건너뛴다.
 */
export function planLowGradeHeal(wrong: readonly LowGradeProblem[], rng: Rng, n: number, field: FieldId | 'legend'): LowGradeProblem[] {
  const out: LowGradeProblem[] = [];
  for (const q of wrong) {
    if (out.length >= n) break;
    if (isLowGradeProblem(q) && !out.some((x) => sameLowGrade(x, q))) out.push({ a: q.a, op: q.op, b: q.b, result: q.result });
  }
  if (out.length >= n) return out;
  return fillLowGrade(out, rng, lowGradeFieldOf(rng, field), n);
}

/** 필드 또는 황금(legend)에서 저학년 문제를 낼 필드 하나: 황금은 세 필드 중 무작위 */
export function lowGradeFieldOf(rng: Rng, field: FieldId | 'legend'): FieldId {
  return field === 'legend' ? LOW_FIELDS[randomInt(rng, 0, LOW_FIELDS.length - 1)] : field;
}

/** 틀린 문제 목록에 넣기: 맨 앞에 넣고(같은 문제는 앞으로 올림), LOWGRADE_WRONG_KEEP개로 자른다. 깨진 문제는 넣지 않는다 */
export function pushLowGradeWrong(list: readonly LowGradeProblem[], p: LowGradeProblem): LowGradeProblem[] {
  if (!isLowGradeProblem(p)) return [...list];
  const q = { a: p.a, op: p.op, b: p.b, result: p.result };
  return [q, ...list.filter((x) => !sameLowGrade(x, q))].slice(0, LOWGRADE_WRONG_KEEP);
}

/** 틀린 문제 목록에서 그 문제 빼기 (없으면 같은 목록) */
export function removeLowGradeWrong(list: readonly LowGradeProblem[], p: Pick<LowGradeProblem, 'a' | 'op' | 'b'>): readonly LowGradeProblem[] {
  return list.some((x) => sameLowGrade(x, p)) ? list.filter((x) => !sameLowGrade(x, p)) : list;
}

/** 저장에서 읽은 틀린 문제 목록 다듬기: 맞는 문제만, 겹치지 않게, 앞에서 LOWGRADE_WRONG_KEEP개 */
export function sanitizeLowGradeWrong(raw: unknown): LowGradeProblem[] {
  if (!Array.isArray(raw)) return [];
  const out: LowGradeProblem[] = [];
  for (const v of raw) {
    if (out.length >= LOWGRADE_WRONG_KEEP) break;
    if (isLowGradeProblem(v) && !out.some((x) => sameLowGrade(x, v))) out.push({ a: v.a, op: v.op, b: v.b, result: v.result });
  }
  return out;
}

/** 저학년 모드 비밀번호가 맞나 */
export function checkLowGradePassword(input: string): boolean {
  return input === LOWGRADE_PASSWORD;
}

/** 체육관 동상 문제 고르기(planStatueQuestions의 makeArith)에 넣는 그 필드 문제 만들기 */
export function lowGradeArithMaker(field: FieldId): (rng: Rng) => ArithProblem {
  return (rng) => generateLowGrade(rng, field);
}

/** 문제 카드에 그릴 모양: a + b = ? (답 칸이 빈칸) */
export function lowGradeDisplay(p: Pick<LowGradeProblem, 'a' | 'op' | 'b'>): ArithDisplay {
  return { kind: 'arith', op: p.op, a: p.a, b: p.b, result: null };
}

/** 글로 쓴 문제: "3 + 4 = ?" (읽기용·테스트용) */
export function lowGradeText(p: Pick<LowGradeProblem, 'a' | 'op' | 'b'>): string {
  return `${p.a} ${p.op} ${p.b} = ?`;
}

/** 화면이 쓰는 문제 하나: 카드 모양·정답·3지선다 보기 */
export interface LowGradeQuestion {
  display: ArithDisplay;
  answer: number;
  choices: number[];
}

export function lowGradeQuestion(rng: Rng, p: LowGradeProblem): LowGradeQuestion {
  return { display: lowGradeDisplay(p), answer: p.result, choices: lowGradeChoices(rng, p) };
}
