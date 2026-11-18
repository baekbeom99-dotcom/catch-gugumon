/**
 * 야생 전투 문제 받기 — 추천 탐험 엔진으로 문제 목록을 만들고, 다 쓰면 이어 붙이고, 틀린 사실은 다시 넣는다.
 * 저학년 모드가 켜져 있으면(전투를 시작할 때 정해 전투 내내 같다) 만난 필드의 덧셈·뺄셈 문제를 낸다.
 */
import { useCallback, useMemo, useState } from 'react';
import type { Encounter } from '../../domain/field/encounter';
import { FIELD_CHOICES, planFieldQuestions, planLegendQuestions, restrictToFieldType } from '../../domain/field/fieldQuestions';
import { type FactId, getFact } from '../../domain/facts';
import { lowGradeQuestion, planLowGradeField, type LowGradeProblem } from '../../domain/field/lowGrade';
import { insertLowGradeRetry } from '../../domain/field/lowGradeRun';
import { generateQuestion, type QuestionType } from '../../domain/questionGen';
import type { Rng } from '../../domain/random';
import { insertRetry, type LearnerSnapshot, type PlannedItem } from '../../domain/scheduler';
import { useGameStore } from '../../store/useGameStore';
import { debugFlags } from '../debugFlags';

function snapshot(): LearnerSnapshot {
  const { learning } = useGameStore.getState();
  return {
    facts: learning.facts,
    danRecent: learning.danRecent,
    challengeUnlocked: learning.challengeUnlocked,
    boosted: learning.boosted,
  };
}

function planFor(encounter: Encounter, rng: Rng): PlannedItem[] {
  const forced = debugFlags().question;
  if (forced)
    return Array.from({ length: 5 }, () => ({ factId: forced.factId as FactId, type: forced.type as QuestionType, isRetry: false, isConfidence: false }));
  const learner = snapshot();
  if (encounter.legend) return planLegendQuestions(learner, Date.now(), rng);
  return planFieldQuestions(learner, encounter.field, Date.now(), rng);
}

/** 저학년 모드 전투가 한 번에 받는 문제 수 */
const LOW_BATCH = 5;
/** 저학년 문제일 때 구구단 자리(item·fact)를 채우는 자리표시 (쓰지 않는다 — arith가 있으면 화면이 건너뛴다) */
const PLACEHOLDER: PlannedItem = { factId: '2x2', type: 'product', isRetry: false, isConfidence: false };

interface Feed {
  /** 구구단 문제 목록 (저학년 모드에서는 비어 있다) */
  plan: PlannedItem[];
  /** 저학년 문제 목록 (저학년 모드일 때만) */
  low: LowGradeProblem[];
  index: number;
}

/** 이 전투가 저학년 모드인가 (전투를 시작하는 순간의 설정) */
const lowGradeOn = () => useGameStore.getState().settings.lowGrade;

/**
 * 문제 받기: 목록을 다 쓰면 새로 받아 이어 붙이고, 틀린 문제는 몇 문제 뒤에 다시 넣는다.
 * arith가 있으면 저학년(덧뺄셈) 문제 — 화면은 구구단 기록·힌트 대신 저학년 기록·힌트를 쓴다.
 * 디버그 고정 문제(__GUGU_E2E_QUESTION__)는 구구단에만 먹는다.
 */
export function useQuestionFeed(encounter: Encounter, rng: Rng) {
  const [low] = useState(lowGradeOn);
  const [feed, setFeed] = useState<Feed>(() =>
    low ? { plan: [], low: planLowGradeField(rng, encounter.field, LOW_BATCH), index: 0 } : { plan: planFor(encounter, rng), low: [], index: 0 },
  );
  const arith = low ? (feed.low[feed.index] ?? null) : null;
  const item = arith ? PLACEHOLDER : feed.plan[feed.index];
  const fact = getFact(item.factId);
  const key = arith
    ? `${feed.index}:L:${arith.a}${arith.op}${arith.b}`
    : `${feed.index}:${item.factId}:${item.type}:${item.isRetry}`;
  const question = useMemo(
    () => (arith ? lowGradeQuestion(rng, arith) : generateQuestion(rng, fact, item.type, FIELD_CHOICES)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key],
  );

  const next = useCallback(
    (retryWrong: boolean) =>
      setFeed((f) => {
        if (low) {
          let list = f.low;
          if (retryWrong) list = insertLowGradeRetry(list, f.index, rng);
          const index = f.index + 1;
          if (index >= list.length) list = [...list, ...planLowGradeField(rng, encounter.field, LOW_BATCH)];
          return { plan: [], low: list, index };
        }
        let plan = f.plan;
        if (retryWrong) {
          const before = plan;
          plan = insertRetry(before, f.index, rng);
          // 새로 끼워 넣은 문제를 찾아 모양을 필드 것으로 (틀린 직후 상자는 1)
          const at = plan.findIndex((it, i) => it !== before[i]);
          if (plan.length > before.length && at >= 0) {
            const r = plan[at];
            plan = plan.map((it, i) => (i === at ? { ...r, type: restrictToFieldType(rng, getFact(r.factId), 1, r.type) } : it));
          }
        }
        const index = f.index + 1;
        if (index >= plan.length) plan = [...plan, ...planFor(encounter, rng)];
        return { plan, low: [], index };
      }),
    [encounter, rng, low],
  );

  return { item, fact, question, key, arith, next };
}
