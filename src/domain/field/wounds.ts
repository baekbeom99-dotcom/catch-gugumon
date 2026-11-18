/** 구구몬 체력·상처 목록 — 설계서 6-4·6-5. 순수 계산(React 없음) */
import { FACTS, getFact, type FactId } from '../facts';
import type { FactStat } from '../mastery';
import type { QuestionType } from '../questionGen';
import { randomInt, shuffle, type Rng } from '../random';
import { restrictToFieldType } from './fieldQuestions';
import { fieldDans, LEGEND_DAN, type FieldId } from './fields';
import { COMPANION_MAX_HP, HEAL_QUESTIONS, HEAL_ROUNDS, WOUNDS_MAX } from './tuning';

/** 상처: 우리 구구몬이 맞게 한 문제 (같은 사실·같은 모양이면 한 개) */
export interface Wound {
  factId: FactId;
  type: QuestionType;
}

/** 상처를 더한다. 이미 있으면 맨 뒤(가장 최근)로 옮기고, WOUNDS_MAX개가 넘으면 오래된 것부터 버린다 */
export function addWound(list: readonly Wound[], w: Wound): Wound[] {
  const rest = list.filter((x) => !(x.factId === w.factId && x.type === w.type));
  const next = [...rest, { factId: w.factId, type: w.type }];
  return next.length > WOUNDS_MAX ? next.slice(next.length - WOUNDS_MAX) : next;
}

const clampHp = (n: number) => Math.min(COMPANION_MAX_HP, Math.max(0, Math.round(n)));

/** 피해를 받은 뒤 체력 (0~COMPANION_MAX_HP 정수). 이상한 피해(음수·NaN·무한)는 0으로, 이상한 체력은 가득으로 본다 */
export function applyDamage(hp: number, dmg: number): number {
  const base = Number.isFinite(hp) ? clampHp(hp) : COMPANION_MAX_HP;
  const hit = Number.isFinite(dmg) && dmg > 0 ? Math.round(dmg) : 0;
  return clampHp(base - hit);
}

/** 체력 0이면 쓰러짐 */
export function isFainted(e: { hp: number }): boolean {
  return e.hp <= 0;
}

/** 회복 연습 진행 — 설계서 7절. 상처 문제를 섞어서 한 바퀴, 모두 HEAL_ROUNDS바퀴 (문제마다 그 횟수만큼 맞혀야 낫는다) */
export interface HealRun {
  /** 이번 바퀴에서 풀 순서 */
  order: Wound[];
  /** 지금 몇 번째 바퀴인가 (0부터) */
  round: number;
  /** 이번 바퀴에서 풀 문제 번호 (0부터) */
  index: number;
  /** 틀려서 힌트를 보여 주는 중 */
  hint: boolean;
  done: boolean;
}

/** 상처가 없으면 풀 것도 없으니 바로 회복 */
export function createHealRun(wounds: readonly Wound[], rng: Rng): HealRun {
  return { order: shuffle(rng, wounds), round: 0, index: 0, hint: false, done: wounds.length === 0 };
}

export function healRunWound(run: HealRun): Wound | null {
  return run.done ? null : (run.order[run.index] ?? null);
}

/** 맞히면 다음 문제. 바퀴가 끝나면 다시 섞어(같은 문제가 연달아 나오지 않게) 다음 바퀴. 틀리면 힌트(맞힌 수에 안 셈) */
export function answerHeal(run: HealRun, correct: boolean, rng: Rng): HealRun {
  if (run.done || run.hint) return run;
  if (!correct) return { ...run, hint: true };
  const index = run.index + 1;
  if (index < run.order.length) return { ...run, index };
  const round = run.round + 1;
  if (round >= HEAL_ROUNDS) return { ...run, round, index: 0, done: true };
  const order = shuffle(rng, run.order);
  const last = run.order[run.order.length - 1];
  if (order.length > 1 && order[0] === last) [order[0], order[1]] = [order[1], order[0]];
  return { ...run, order, round, index: 0 };
}

/**
 * 힌트를 닫으면 다음 상처로 넘어간다. 틀린 상처는 2~3장 뒤로 보내 다시 낸다
 * (남은 상처가 모자라면 이번 바퀴 맨 뒤). 맞힌 수에는 안 세니 다시 맞혀야 바퀴가 끝난다
 */
export function leaveHealHint(run: HealRun, rng: Rng): HealRun {
  if (!run.hint) return run;
  const wrong = run.order[run.index];
  if (!wrong) return { ...run, hint: false };
  const rest = run.order.filter((_, i) => i !== run.index);
  const at = Math.min(run.index + randomInt(rng, 2, 3), rest.length);
  return { ...run, order: [...rest.slice(0, at), wrong, ...rest.slice(at)], hint: false };
}

/**
 * 회복약 연습 문제 목록 — 지금까지 틀린 문제 중심.
 * 학습 기록에서 틀린 적 있는 구구단 문제를 가장 최근에 틀린 순으로 HEAL_QUESTIONS개까지 고르고,
 * 틀린 기록이 모자라면 그 구구몬이 사는 필드(황금 구구몬은 13단)의 단에서 무작위 문제로 채운다.
 * 틀린 기록이 하나도 없으면 전부 필드 문제다. 문제 모양은 필드 모양(답 구하기·앞 수·뒤 수).
 */
export function planHealQuestions(
  facts: Readonly<Record<string, FactStat>>,
  field: FieldId | 'legend',
  challengeUnlocked: boolean,
  rng: Rng,
  count: number = HEAL_QUESTIONS,
): Wound[] {
  const inRange = (id: FactId) => {
    const b = getFact(id).b;
    return b >= 1 && b <= 9;
  };
  const wrong = FACTS.filter((f) => inRange(f.id) && facts[f.id]?.lastWrongAt != null)
    .sort((x, y) => (facts[y.id].lastWrongAt as number) - (facts[x.id].lastWrongAt as number))
    .slice(0, count)
    .map((f) => f.id);
  const chosen = [...wrong];
  if (chosen.length < count) {
    const dans = field === 'legend' ? [LEGEND_DAN] : fieldDans(field, challengeUnlocked);
    const pool = shuffle(
      rng,
      FACTS.filter((f) => dans.includes(f.a) && inRange(f.id) && !chosen.includes(f.id)).map((f) => f.id),
    );
    chosen.push(...pool.slice(0, count - chosen.length));
  }
  return chosen.map((id) => ({ factId: id, type: restrictToFieldType(rng, getFact(id), facts[id]?.box ?? 1, 'product') }));
}
