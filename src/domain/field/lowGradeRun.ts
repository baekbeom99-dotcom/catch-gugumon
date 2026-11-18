/**
 * 저학년 모드 연습 진행 (순수 로직) — 상점 캡슐 연습(1바퀴)과 회복 연습(HEAL_ROUNDS바퀴)이 같이 쓴다.
 * 구구단 연습(shopQuiz·wounds의 HealRun)과 같은 규칙: 맞히면 다음 문제, 틀리면 힌트를 보고 그 문제를 2~3장 뒤로 보낸다.
 * 처음 바퀴는 받은 차례 그대로(틀린 문제가 먼저), 다음 바퀴부터 섞는다.
 */
import { randomInt, shuffle, type Rng } from '../random';
import type { LowGradeProblem } from './lowGrade';

export interface LowGradeRun {
  /** 이번 바퀴에서 풀 순서 */
  order: LowGradeProblem[];
  rounds: number;
  /** 지금 몇 번째 바퀴인가 (0부터) */
  round: number;
  /** 이번 바퀴에서 풀 문제 번호 (0부터) */
  index: number;
  /** 틀려서 힌트를 보여 주는 중 */
  hint: boolean;
  done: boolean;
}

export function createLowGradeRun(plan: readonly LowGradeProblem[], rounds: number): LowGradeRun {
  return { order: [...plan], rounds, round: 0, index: 0, hint: false, done: plan.length === 0 };
}

/** 지금 풀 문제. 다 끝났으면 null */
export function lowGradeRunItem(run: LowGradeRun): LowGradeProblem | null {
  return run.done ? null : (run.order[run.index] ?? null);
}

/** 맞히면 다음 문제(바퀴가 끝나면 섞어서 다음 바퀴). 틀리면 힌트. 끝났거나 힌트 중이면 그대로 */
export function answerLowGradeRun(run: LowGradeRun, correct: boolean, rng: Rng): LowGradeRun {
  if (run.done || run.hint) return run;
  if (!correct) return { ...run, hint: true };
  const index = run.index + 1;
  if (index < run.order.length) return { ...run, index };
  const round = run.round + 1;
  if (round >= run.rounds) return { ...run, round, index: 0, done: true };
  const order = shuffle(rng, run.order);
  const last = run.order[run.order.length - 1];
  if (order.length > 1 && order[0] === last) [order[0], order[1]] = [order[1], order[0]];
  return { ...run, order, round, index: 0 };
}

/** 힌트를 닫으면 다음 문제로 넘어가고, 틀린 문제는 2~3장 뒤로 보낸다 (모자라면 맨 뒤). 맞혀야 바퀴가 끝난다 */
export function leaveLowGradeHint(run: LowGradeRun, rng: Rng): LowGradeRun {
  if (!run.hint) return run;
  const wrong = run.order[run.index];
  if (!wrong) return { ...run, hint: false };
  const rest = run.order.filter((_, i) => i !== run.index);
  const at = Math.min(run.index + randomInt(rng, 2, 3), rest.length);
  return { ...run, order: [...rest.slice(0, at), wrong, ...rest.slice(at)], hint: false };
}

/** 전투에서 틀린 문제를 몇 문제 뒤(2~3칸)에 다시 끼워 넣는다 (목록이 짧으면 맨 뒤). 원래 자리는 그대로 */
export function insertLowGradeRetry(plan: readonly LowGradeProblem[], index: number, rng: Rng): LowGradeProblem[] {
  const wrong = plan[index];
  if (!wrong) return [...plan];
  const at = Math.min(index + 1 + randomInt(rng, 2, 3), plan.length);
  return [...plan.slice(0, at), wrong, ...plan.slice(at)];
}
