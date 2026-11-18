/**
 * 상점 [캡슐] 탭의 연습 — 설계서 0-2절. 단을 고르지 않는다: 그 캡슐 지역의 단 중 하나가 무작위로 정해지고,
 * 그 단의 구구단이 ×1부터 ×9까지 순서대로 나온다.
 * 틀리면 힌트를 보여 주고 다음 카드로 넘어가며, 틀린 문제는 2~3장 뒤에 다시 나온다.
 */
import { factsOfDan, getFact } from '../facts';
import type { CapsuleType } from './capsules';
import { restrictToFieldType } from './fieldQuestions';
import { fieldDans, LEGEND_DAN } from './fields';
import { pickOne, type Rng } from '../random';
import { insertRetry, type LearnerSnapshot, type PlannedItem } from '../scheduler';

/** 이 캡슐을 얻는 연습이 열려 있나: 황금 캡슐(13단)은 도전 단이 열려야 한다 */
export function capsulePracticeOpen(t: CapsuleType, challengeUnlocked: boolean): boolean {
  return t !== 'legend' || challengeUnlocked;
}

/**
 * 캡슐 연습 문제 목록. 그 캡슐 지역의 단(도전 단이 닫혀 있으면 12단 제외, 황금 캡슐은 13단 고정) 중
 * 하나를 무작위로 골라, 그 단을 ×1~×9 순서대로 낸다. 문제 모양만 필드 모양(답 구하기·앞 수·뒤 수)으로 섞는다.
 * 틀린 문제는 leaveShopHint가 2~3장 뒤에 다시 끼워 넣는다.
 */
export function planShopQuestions(learner: LearnerSnapshot, t: CapsuleType, _now: number, rng: Rng): PlannedItem[] {
  if (!capsulePracticeOpen(t, learner.challengeUnlocked)) throw new Error('13단은 아직 열리지 않았다');
  const dans = t === 'legend' ? [LEGEND_DAN] : fieldDans(t, learner.challengeUnlocked);
  const dan = pickOne(rng, dans);
  return factsOfDan(dan)
    .filter((f) => f.b >= 1 && f.b <= 9)
    .sort((x, y) => x.b - y.b)
    .map((f) => ({
      factId: f.id,
      type: restrictToFieldType(rng, f, learner.facts[f.id].box, 'product'),
      isRetry: false,
      isConfidence: false,
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
