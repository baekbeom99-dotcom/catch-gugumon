/** 야생 강함 단계 계산 — 단계 뽑기, 레벨 범위, 캡슐 던지기 확률, 경험치 배율 (표는 tuning.ts) */
import { randomInt, type Rng } from '../random';
import {
  CATCH_CAP,
  CATCH_PER_FAIL,
  CATCH_STATUS_BONUS,
  LEGEND_LEVEL,
  MAX_LEVEL,
  THROW_ANGRY,
  THROW_ESCAPE,
  TIER_CHANCE,
  TIER_RULES,
} from './tuning';

export type Tier = keyof typeof TIER_RULES;
export type WildTier = Exclude<Tier, 'legend'>;

const WILD_TIERS = ['weak', 'normal', 'strong', 'mighty'] as const;

/** 주사위 한 번으로 단계를 고른다(약함 → 보통 → 강함 → 강력 순으로 확률을 쌓아 감) */
export function rollTier(rng: Rng): WildTier {
  const r = rng();
  let acc = 0;
  for (const t of WILD_TIERS) {
    acc += TIER_CHANCE[t];
    if (r < acc) return t;
  }
  return 'mighty'; // 부동소수 오차로 끝까지 못 찾았을 때
}

const clampLevel = (n: number) => Math.min(MAX_LEVEL, Math.max(1, n));

/** 동행 레벨에 단계 값을 더한 레벨 범위 (1~30을 넘지 않게 자름, 황금은 고정 레벨) */
export function tierLevelRange(tier: Tier, companionLevel: number): [number, number] {
  const levels = TIER_RULES[tier].levels;
  if (levels === null) return [LEGEND_LEVEL, LEGEND_LEVEL];
  return [clampLevel(companionLevel + levels[0]), clampLevel(companionLevel + levels[1])];
}

export function rollTierLevel(rng: Rng, tier: Tier, companionLevel: number): number {
  const [lo, hi] = tierLevelRange(tier, companionLevel);
  return randomInt(rng, lo, hi);
}

/**
 * 캡슐 한 번 던졌을 때의 결과 확률.
 * 기준: 빠져나옴(E)과 화냄(A)은 모든 단계가 같고, '끝내 잡을 확률'(U)을 단계별로 맞추려고
 * 거꾸로 계산한다: 잡힘 = U×(E+A)÷(1−U), 나머지는 다시 던지기.
 * 개정 4(설계서 0-2절): 같은 야생에게 실패한 수(tries)마다 잡힘 +CATCH_PER_FAIL, 기절(status)이면 +CATCH_STATUS_BONUS,
 * 합은 CATCH_CAP에서 멈춘다. 잡힘이 오른 만큼 나머지(빠져나옴·도망·화남)는 기준 비율대로 줄어 합은 늘 1.
 */
export function throwOdds(tier: Tier, tries = 0, status = false): { caught: number; retry: number; escaped: number; angry: number } {
  const u = TIER_RULES[tier].ultimateCatch;
  const baseCaught = (u * (THROW_ESCAPE + THROW_ANGRY)) / (1 - u);
  const base = {
    caught: baseCaught,
    retry: 1 - baseCaught - THROW_ESCAPE - THROW_ANGRY,
    escaped: THROW_ESCAPE,
    angry: THROW_ANGRY,
  };
  const n = Number.isFinite(tries) && tries > 0 ? Math.floor(tries) : 0;
  const bonus = CATCH_PER_FAIL * n + (status ? CATCH_STATUS_BONUS : 0);
  if (bonus === 0) return base;
  const caught = Math.min(CATCH_CAP, baseCaught + bonus);
  const scale = (1 - caught) / (1 - baseCaught);
  return { caught, retry: base.retry * scale, escaped: base.escaped * scale, angry: base.angry * scale };
}

/**
 * 던지기 결과를 미리 정해 두는 난수 (E2E 스위치 전용, 규칙·확률은 그대로).
 * throwCapsule이 난수를 한 번 쓰니, 정한 결과의 칸 한가운데 값을 돌려준다 (실패 수·기절로 바뀐 칸 기준).
 */
export function forcedThrowRng(outcome: 'caught' | 'healed' | 'escaped' | 'angry', tier: Tier, tries = 0, status = false): () => number {
  const o = throwOdds(tier, tries, status);
  const value =
    outcome === 'caught'
      ? 0
      : outcome === 'healed'
        ? o.caught + o.retry / 2
        : outcome === 'escaped'
          ? 1 - o.angry - o.escaped / 2
          : 0.9999;
  return () => value;
}

/** 단계 배율을 곱한 경험치 (반올림) */
export function tierExp(base: number, tier: Tier): number {
  return Math.round(base * TIER_RULES[tier].expScale);
}
