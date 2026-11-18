import { describe, expect, it } from 'vitest';
import { getFact, FACTS, type Dan } from '../../src/domain/facts';
import { FIELDS, LEGEND_DAN } from '../../src/domain/field/fields';
import {
  answerShopQuiz,
  createShopQuiz,
  leaveShopHint,
  planShopQuestions,
  shopQuizItem,
} from '../../src/domain/field/shopQuiz';
import { FIELD_TYPES } from '../../src/domain/field/fieldQuestions';
import { initialFactStats, type Box } from '../../src/domain/mastery';
import { seededRng } from '../../src/domain/random';
import { EXPLORATION_SIZE, type LearnerSnapshot } from '../../src/domain/scheduler';

const NOW = new Date(2026, 9, 15, 10).getTime();

function learner(challengeUnlocked: boolean): LearnerSnapshot {
  const facts = initialFactStats();
  for (const f of FACTS) {
    const s = facts[f.id];
    s.box = ((f.a * 5 + f.b * 3) % 6) as Box;
    s.dueAt = s.box === 0 ? null : NOW - 86400000;
  }
  return { facts, danRecent: {}, challengeUnlocked, boosted: {} };
}

describe('상점 캡슐 출제: 지역 단 중 하나를 무작위로, 그 단을 순서대로', () => {
  const danOf = (plan: ReturnType<typeof planShopQuestions>) => new Set(plan.map((it) => getFact(it.factId).a));
  it('한 단만, ×1부터 ×9까지 순서대로 나온다', () => {
    for (const type of ['meadow', 'waterside', 'desert'] as const) {
      for (let seed = 1; seed <= 20; seed++) {
        const plan = planShopQuestions(learner(true), type, NOW, seededRng(seed));
        expect(plan).toHaveLength(EXPLORATION_SIZE);
        const dans = danOf(plan);
        expect(dans.size).toBe(1);
        expect(FIELDS[type].dans).toContain([...dans][0]);
        expect(plan.map((it) => getFact(it.factId).b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
      }
    }
  });
  it('사막은 12단이 잠겨 있으면 5·7단만, 열리면 12단도 나올 수 있다', () => {
    const locked = new Set<number>();
    const open = new Set<number>();
    for (let seed = 1; seed <= 60; seed++) {
      danOf(planShopQuestions(learner(false), 'desert', NOW, seededRng(seed))).forEach((d) => locked.add(d));
      danOf(planShopQuestions(learner(true), 'desert', NOW, seededRng(seed))).forEach((d) => open.add(d));
    }
    expect([...locked].sort()).toEqual([5, 7]);
    expect(open.has(12)).toBe(true);
  });
  it('지역의 단이 골고루 뽑힌다 (무작위)', () => {
    const seen = new Set<number>();
    for (let seed = 1; seed <= 60; seed++) danOf(planShopQuestions(learner(true), 'meadow', NOW, seededRng(seed))).forEach((d) => seen.add(d));
    expect([...seen].sort((x, y) => x - y)).toEqual([...FIELDS.meadow.dans].sort((x, y) => x - y));
  });
  it('황금 캡슐은 13단만, 순서대로', () => {
    const plan = planShopQuestions(learner(true), 'legend', NOW, seededRng(3));
    expect(plan.every((it) => getFact(it.factId).a === (LEGEND_DAN as Dan))).toBe(true);
    expect(plan.map((it) => getFact(it.factId).b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });
  it('같은 rng면 같은 목록', () => {
    const a = planShopQuestions(learner(true), 'meadow', NOW, seededRng(5)).map((i) => `${i.factId}:${i.type}`);
    const b = planShopQuestions(learner(true), 'meadow', NOW, seededRng(5)).map((i) => `${i.factId}:${i.type}`);
    expect(a).toEqual(b);
  });
  it('문제 모양은 필드 모양(답 구하기·앞 수·뒤 수)만', () => {
    const plan = planShopQuestions(learner(true), 'waterside', NOW, seededRng(9));
    for (const it of plan) expect(FIELD_TYPES).toContain(it.type);
  });
});

describe('상점 연습 진행', () => {
  const plan = () => planShopQuestions(learner(true), 'meadow', NOW, seededRng(2));
  it('모두 맞히면 목록 길이만큼 풀고 끝난다 (9문제)', () => {
    let q = createShopQuiz(plan());
    let n = 0;
    while (!q.done) {
      expect(shopQuizItem(q)).not.toBeNull();
      q = answerShopQuiz(q, true);
      n++;
    }
    expect(n).toBe(EXPLORATION_SIZE);
    expect(shopQuizItem(q)).toBeNull();
    expect(answerShopQuiz(q, true)).toBe(q);
  });
  it('틀리면 힌트, 같은 자리 (연타해도 그대로)', () => {
    const q = answerShopQuiz(createShopQuiz(plan()), false);
    expect(q).toMatchObject({ index: 0, hint: true });
    expect(answerShopQuiz(q, true)).toBe(q);
  });
  it('힌트를 닫으면 다음 카드로 넘어가고, 틀린 문제는 2~3장 뒤에 다시 나온다', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const first = createShopQuiz(plan());
      const wrongId = shopQuizItem(first)!.factId;
      const q = leaveShopHint(answerShopQuiz(first, false), seededRng(seed));
      expect(q.hint).toBe(false);
      expect(q.index).toBe(1);
      expect(q.plan).toHaveLength(EXPLORATION_SIZE + 1);
      expect(shopQuizItem(q)!.factId).not.toBe(wrongId === shopQuizItem(q)!.factId ? '' : wrongId);
      const at = q.plan.findIndex((it, i) => i > 0 && it.isRetry && it.factId === wrongId);
      expect([3, 4]).toContain(at); // 지금(0) + 1 + 틈 2~3
      expect(FIELD_TYPES).toContain(q.plan[at].type);
    }
  });
  it('틀린 문제를 다시 맞혀야 끝난다 (10장)', () => {
    let q = leaveShopHint(answerShopQuiz(createShopQuiz(plan()), false), seededRng(1));
    let n = 1;
    while (!q.done) {
      q = answerShopQuiz(q, true);
      n++;
    }
    expect(n).toBe(EXPLORATION_SIZE + 1);
  });
  it('힌트 중이 아니면 leaveShopHint는 그대로', () => {
    const q = createShopQuiz(plan());
    expect(leaveShopHint(q, seededRng(1))).toBe(q);
  });
  it('마지막 문제를 틀리면 맨 뒤에 다시 붙고 끝나지 않는다', () => {
    let q = createShopQuiz(plan());
    while (q.index < EXPLORATION_SIZE - 1) q = answerShopQuiz(q, true);
    q = leaveShopHint(answerShopQuiz(q, false), seededRng(4));
    expect(q.done).toBe(false);
    expect(shopQuizItem(q)!.isRetry).toBe(true);
  });
});
