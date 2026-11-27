/**
 * 시계 읽기 트레이너 — 마스터 도전만 있다. 시계 그림을 보고 "몇 시 몇 분?" 보기 3개 중에서 고른다.
 * 9문제를 하나도 안 틀리고 그 단계 제한 시간 안에 끝내면 합격. React·저장소 없이 순수 계산만.
 *
 * 시각은 "분 단위 숫자"로 나타낸다: 값 = 시 × 60 + 분 (시 1~12). 12시는 12로 두어
 * 12:00 = 720, 12:30 = 750 이다 (0으로 시작하는 값은 없다 → 60 이상 779 이하).
 */
import { shuffle, type Rng } from '../random';
import type { TrainingData } from './training';
import { CLOCK_TRAINER_MASTER_MS, CLOCK_TRAINER_QUESTIONS } from './tuning';

/** 시계 읽기 단계: 정각 · 5분 단위 · 1분 단위 */
export type ClockLevel = 'hour' | 'five' | 'one';
export const CLOCK_LEVELS = ['hour', 'five', 'one'] as const satisfies readonly ClockLevel[];
export const CLOCK_LEVEL_LABELS: Record<ClockLevel, string> = { hour: '정각', five: '5분', one: '1분' };

export type ClockQuestion = {
  /** 시 (1~12) */
  h: number;
  /** 분 (0~59) */
  m: number;
  /** 정답 = h × 60 + m */
  answer: number;
  /** 정답을 포함한 보기 3개 (섞여 있음, 겹치지 않음) */
  choices: number[];
};

const DAY = 12 * 60;

const isLevel = (v: unknown): v is ClockLevel => (CLOCK_LEVELS as readonly unknown[]).includes(v);

/** 시계 판 위의 자리(0~719)를 값(시×60+분, 시 1~12)으로 */
function valueOfIndex(idx: number): number {
  const i = ((Math.round(idx) % DAY) + DAY) % DAY;
  const h = Math.floor(i / 60) || 12;
  return h * 60 + (i % 60);
}

/** 시·분을 값으로 (시·분이 넘치면 시계를 돌듯 이어진다: 3시 −5분 → 2:55, 12시 +1시간 → 1시) */
function clockValue(h: number, m: number): number {
  return valueOfIndex((h % 12) * 60 + m);
}

/** 값을 "3:30"꼴 글로 (시 1~12, 분 두 자리) */
export function formatClockChoice(minutes: number): string {
  const v = valueOfIndex(Number.isFinite(minutes) ? minutes : 0);
  const h = Math.floor(v / 60);
  const m = v % 60;
  return `${h}:${String(m).padStart(2, '0')}`;
}

/** 그 단계에서 나오는 분 */
function minutesOfLevel(level: ClockLevel): number[] {
  if (level === 'hour') return [0];
  if (level === 'five') return Array.from({ length: 12 }, (_, i) => i * 5);
  return Array.from({ length: 60 }, (_, i) => i);
}

/** 그 단계에서 나올 수 있는 모든 시각(값) */
function timesOfLevel(level: ClockLevel, only?: (m: number) => boolean): number[] {
  const out: number[] = [];
  for (let h = 1; h <= 12; h++) for (const m of minutesOfLevel(level)) if (!only || only(m)) out.push(h * 60 + m);
  return out;
}

/**
 * 보기 3개 (정답 + 헷갈리기 쉬운 오답 2개, 섞음).
 * 오답 후보: 시침·분침을 바꿔 읽은 값, 시 ±1, 분 ±(1분 단계는 1, 아니면 5). 모자라면 그 단계의 다른 시각으로 채운다.
 */
export function clockChoices(rng: Rng, h: number, m: number, level: ClockLevel): number[] {
  const answer = clockValue(h, m);
  const step = level === 'one' ? 1 : 5;
  // 바꿔 읽기: 분침이 가리키는 숫자를 시로(0이면 12), 시침이 가리키는 숫자 × 5를 분으로
  const swapped = clockValue(Math.floor((((m % 60) + 60) % 60) / 5) || 12, (h * 5) % 60);
  const near = [swapped, clockValue(h + 1, m), clockValue(h - 1, m), clockValue(h, m + step), clockValue(h, m - step)];
  const wrong: number[] = [];
  const add = (v: number) => {
    if (v !== answer && !wrong.includes(v)) wrong.push(v);
  };
  for (const v of shuffle(rng, near)) if (wrong.length < 2) add(v);
  // 거의 쓰이지 않는 예비: 그 단계의 다른 시각, 그래도 모자라면 1분씩 옆 시각
  if (wrong.length < 2) for (const v of shuffle(rng, timesOfLevel(isLevel(level) ? level : 'one'))) if (wrong.length < 2) add(v);
  for (let k = 1; wrong.length < 2; k++) add(valueOfIndex(answer + k));
  return shuffle(rng, [answer, wrong[0], wrong[1]]);
}

/** 후보에서 겹치지 않게 n개를 고른다 (가짓수가 모자라면 겹쳐도 채운다) */
function pickTimes(rng: Rng, pool: readonly number[], n: number, seen: Set<number>): number[] {
  const out: number[] = [];
  for (const v of shuffle(rng, pool)) {
    if (out.length >= n) break;
    if (!seen.has(v)) {
      seen.add(v);
      out.push(v);
    }
  }
  // 모자라면 겹쳐도 채운다
  for (let i = 0; out.length < n && pool.length > 0; i++) out.push(pool[i % pool.length]);
  return out;
}

/**
 * 시계 읽기 도전 9문제. 같은 시각은 겹치지 않게.
 * 정각: 분 0. 5분: 분이 5의 배수. 1분: 5의 배수가 아닌 시각이 절반 넘게 (나머지는 아무 시각).
 */
export function planClockTrainer(rng: Rng, level: ClockLevel): ClockQuestion[] {
  const lv: ClockLevel = isLevel(level) ? level : 'hour';
  const n = CLOCK_TRAINER_QUESTIONS;
  const seen = new Set<number>();
  let times: number[];
  if (lv === 'one') {
    const oddCount = Math.ceil((n * 2) / 3); // 9문제면 6개는 꼭 1분 단위
    times = [
      ...pickTimes(rng, timesOfLevel('one', (m) => m % 5 !== 0), oddCount, seen),
      ...pickTimes(rng, timesOfLevel('one'), n - oddCount, seen),
    ];
    times = shuffle(rng, times);
  } else {
    times = pickTimes(rng, timesOfLevel(lv), n, seen);
  }
  return times.map((v) => {
    const h = Math.floor(v / 60);
    const m = v % 60;
    return { h, m, answer: v, choices: clockChoices(rng, h, m, lv) };
  });
}

/** 합격(모두 맞힘 + 그 단계 제한 시간 안) / 틀림 / 너무 느림 (이상한 시간·모르는 단계는 느림) */
export function judgeClockTrainer(a: { mistakes: number; timeMs: number }, level: ClockLevel): 'pass' | 'wrong' | 'slow' {
  // 틀린 수가 0이 아니면(이상한 값 포함) 틀림
  if (a.mistakes !== 0) return 'wrong';
  const limit = isLevel(level) ? CLOCK_TRAINER_MASTER_MS[level] : NaN;
  const ok = Number.isFinite(a.timeMs) && a.timeMs >= 0 && a.timeMs <= limit;
  return ok ? 'pass' : 'slow';
}

/** 그 단계 도전이 열렸는가: 정각은 항상, 5분은 정각 마스터 뒤, 1분은 5분 마스터 뒤 */
export function isClockOpen(t: Pick<TrainingData, 'clock'>, level: ClockLevel): boolean {
  if (level === 'hour') return true;
  if (level === 'five') return t.clock?.hour !== undefined;
  if (level === 'one') return t.clock?.five !== undefined;
  return false;
}
