/**
 * 트레이닝센터 규칙 — 단 열림·학습/도전 문제·합격 판정·레전드 보상. React·저장소 없이 순수 계산만.
 */
import type { ArithLevel } from '../arith';
import { pickOne, seededRng, shuffle, type Rng } from '../random';
import { LEGEND_SPECIES, type SpeciesId } from './speciesIds';
import { STAIRS_OPEN_AFTER_DAN, TRAINING_DANS, TRAINING_MASTER_MS, type TrainingDan } from './tuning';

export type TrainingQuestion = {
  dan: TrainingDan;
  multiplier: number;
  answer: number;
  /** 정답을 포함한 보기 3개 (섞여 있음) */
  choices: number[];
};

export type TrainingData = {
  /** 학습을 마친 단 */
  studied: Partial<Record<TrainingDan, true>>;
  /** 마스터한 단과 최고 기록 */
  mastered: Partial<Record<TrainingDan, { bestMs: number; at: number }>>;
  /** 레전드 보상을 이미 받은 곳 (12·13단, 셈연습 고수) */
  legendGranted: Partial<Record<LegendRewardKey, SpeciesId>>;
  /** 셈연습 트레이너: 마스터한 단계와 최고 기록 */
  arith: Partial<Record<ArithLevel, { bestMs: number; at: number }>>;
};

/** 레전드 구구몬을 한 번씩 주는 곳: 12단·13단 첫 마스터, 셈연습 고수 첫 마스터 */
export type LegendRewardKey = 12 | 13 | 'arithHard';

export function emptyTraining(): TrainingData {
  return { studied: {}, mastered: {}, legendGranted: {}, arith: {} };
}

function asTrainingDan(dan: number): TrainingDan | null {
  return (TRAINING_DANS as readonly number[]).includes(dan) ? (dan as TrainingDan) : null;
}

/** 마스터한 단들 (거꾸로 묻기를 섞을 단) */
export function masteredDanSet(t: Pick<TrainingData, 'mastered'>): Set<number> {
  return new Set(Object.keys(t.mastered).map(Number).filter((d) => t.mastered[d as TrainingDan] !== undefined));
}

/** 단 자체가 열렸는가: 2단은 항상, 나머지는 바로 앞 단을 마스터한 뒤 */
export function isTrainingOpen(t: TrainingData, dan: number): boolean {
  const d = asTrainingDan(dan);
  if (d === null) return false;
  const i = TRAINING_DANS.indexOf(d);
  if (i === 0) return true;
  return t.mastered[TRAINING_DANS[i - 1]] !== undefined;
}

/** 마스터 도전이 열렸는가: 단이 열려 있고 학습을 마친 뒤 */
export function isChallengeOpen(t: TrainingData, dan: number): boolean {
  const d = asTrainingDan(dan);
  return d !== null && isTrainingOpen(t, d) && t.studied[d] === true;
}

/** 아직 이 단을 마스터한 적이 없는가 (이번 합격이 첫 마스터면 캡슐 20개) */
export function isFirstMaster(t: TrainingData, dan: number): boolean {
  const d = asTrainingDan(dan);
  return d !== null && t.mastered[d] === undefined;
}

/** 무한의 계단이 열렸는가 (STAIRS_OPEN_AFTER_DAN이 null이면 항상) */
export function isStairsOpen(t: TrainingData): boolean {
  if (STAIRS_OPEN_AFTER_DAN === null) return true;
  const d = asTrainingDan(STAIRS_OPEN_AFTER_DAN);
  return d !== null && t.mastered[d] !== undefined;
}

/** 헷갈리기 쉬운 오답 보기를 만들어 정답과 함께 3개로 섞는다 */
function makeQuestion(rng: Rng, dan: TrainingDan, multiplier: number): TrainingQuestion {
  const answer = dan * multiplier;
  const near = [
    dan * (multiplier - 1),
    dan * (multiplier + 1),
    (dan - 1) * multiplier,
    (dan + 1) * multiplier,
    answer - 10,
    answer + 10,
    answer - 1,
    answer + 1,
  ];
  const wrong: number[] = [];
  const add = (n: number) => {
    if (n > 0 && n !== answer && !wrong.includes(n)) wrong.push(n);
  };
  for (const n of shuffle(rng, near)) add(n);
  for (let k = 2; wrong.length < 2; k++) add(answer + k); // 거의 쓰이지 않는 예비
  return { dan, multiplier, answer, choices: shuffle(rng, [answer, wrong[0], wrong[1]]) };
}

/** 학습: ×1~×9 순서대로. 보기 순서는 단·곱에 따라 정해져 늘 같다 */
export function planStudy(dan: TrainingDan): TrainingQuestion[] {
  return Array.from({ length: 9 }, (_, i) => makeQuestion(seededRng(dan * 100 + i + 1), dan, i + 1));
}

/** 마스터 도전: ×1~×9를 섞어 9문제 */
export function planChallenge(rng: Rng, dan: TrainingDan): TrainingQuestion[] {
  return shuffle(rng, [1, 2, 3, 4, 5, 6, 7, 8, 9]).map((m) => makeQuestion(rng, dan, m));
}

/** 합격(모두 맞힘 + 제한 시간 안) / 틀림 / 너무 느림 */
export function judgeChallenge(a: { mistakes: number; timeMs: number }): 'pass' | 'wrong' | 'slow' {
  if (a.mistakes > 0) return 'wrong';
  return a.timeMs <= TRAINING_MASTER_MS ? 'pass' : 'slow';
}

/** 마스터 보상 레전드 (12·13단, 셈연습 고수). 이미 받은 곳이면 null, 다 가졌으면 중복(duplicate)으로 아무 레전드 */
export function pickLegendReward(
  rng: Rng,
  owned: readonly SpeciesId[],
  key: LegendRewardKey,
  granted: TrainingData['legendGranted'],
): { species: SpeciesId; duplicate: boolean } | null {
  if (granted[key] !== undefined) return null;
  const fresh = LEGEND_SPECIES.filter((s) => !owned.includes(s));
  if (fresh.length > 0) return { species: pickOne(rng, fresh), duplicate: false };
  return { species: pickOne(rng, LEGEND_SPECIES), duplicate: true };
}
