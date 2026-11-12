/**
 * 상점 [캡슐] 탭의 연습 — 설계서 0-2절. 단을 고르지 않고, 그 캡슐 지역의 단에서 문제가 무작위로 나온다.
 * 틀리면 힌트를 보여 주고 다음 카드로 넘어가며, 틀린 문제는 2~3장 뒤에 다시 나온다.
 */
import { getFact } from '../facts';
import type { CapsuleType } from './capsules';
import { restrictToFieldType } from './fieldQuestions';
import { fieldDans, LEGEND_DAN } from './fields';
import type { Rng } from '../random';
import { insertRetry, type LearnerSnapshot, type PlannedItem, planExploration } from '../scheduler';

/** 이 캡슐을 얻는 연습이 열려 있나: 황금 캡슐(13단)은 도전 단이 열려야 한다 */
export function capsulePracticeOpen(t: CapsuleType, challengeUnlocked: boolean): boolean {
  return t !== 'legend' || challengeUnlocked;
}

/**
 * 캡슐 연습 문제 목록(EXPLORATION_SIZE개). 그 캡슐 지역의 단에서만 고르고(오답 복습도 그 단 안에서),
 * 자주 틀린 문제를 앞에 두는 기존 추천 탐험 가중을 그대로 쓴다. 황금 캡슐은 13단 고정.
 */
export function planShopQuestions(learner: LearnerSnapshot, t: CapsuleType, now: number, rng: Rng): PlannedItem[] {
  if (!capsulePracticeOpen(t, learner.challengeUnlocked)) throw new Error('13단은 아직 열리지 않았다');
  const dans = t === 'legend' ? [LEGEND_DAN] : fieldDans(t, learner.challengeUnlocked);
  const plan = planExploration(learner, { kind: 'recommended' }, now, rng, { dans });
  return plan.map((item) => ({
    ...item,
    type: restrictToFieldType(rng, getFact(item.factId), learner.facts[item.factId].box, item.type),
  }));
}

export interface ShopQuiz {
  plan: PlannedItem[];
  /** 지금 풀 문제 번호 (0부터) */
  index: number;
  /** 틀려서 힌트를 보여 주는 중 */
  hint: boolean;
  done: boolean;
}

export function createShopQuiz(plan: PlannedItem[]): ShopQuiz {
  return { plan, index: 0, hint: false, done: plan.length === 0 };
}

/** 지금 풀 문제. 다 끝났으면 null */
export function shopQuizItem(q: ShopQuiz): PlannedItem | null {
  return q.done ? null : (q.plan[q.index] ?? null);
}

/** 맞히면 다음 문제, 틀리면 힌트(자리 그대로). 끝났거나 힌트 중이면 연타해도 그대로 */
export function answerShopQuiz(q: ShopQuiz, correct: boolean): ShopQuiz {
  if (q.done || q.hint) return q;
  if (!correct) return { ...q, hint: true };
  const index = q.index + 1;
  return { ...q, index, done: index >= q.plan.length };
}

/** 힌트를 닫으면 다음 카드로 넘어가고, 틀린 문제를 2~3장 뒤에 끼워 넣는다 (모자라면 맨 뒤) */
export function leaveShopHint(q: ShopQuiz, rng: Rng): ShopQuiz {
  if (!q.hint) return q;
  const before = q.plan;
  let plan = insertRetry(before, q.index, rng);
  // 끼워 넣은 문제는 필드 모양으로
  const at = plan.findIndex((it, i) => it !== before[i]);
  if (plan.length > before.length && at >= 0) {
    const r = plan[at];
    plan = plan.map((it, i) => (i === at ? { ...r, type: restrictToFieldType(rng, getFact(r.factId), 1, r.type) } : it));
  }
  const index = q.index + 1;
  return { plan, index, hint: false, done: index >= plan.length };
}
