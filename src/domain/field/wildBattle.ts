/**
 * 야생 구구몬과의 전투 규칙 — 설계서 6-2~6-6, 필드 모험 3차 2-6·3절·0-2절 (순수 로직: 시간·무작위는 인자로만 받는다)
 * 단계: (pick 기술 고르기) → question(문제) → 정답 hit (2번째마다 → counter 적의 주기 공격) / 오답·시간 초과 struck → hint → 다른 문제 …
 *       → dizzy(어지러움) → 던지기. 야생 체력이 1/4 이하면 pick·question에서도 캡슐을 던질 수 있다.
 * 끝: caught(잡힘) · escaped(도망감) · released(돌려보냄) · fainted(우리 구구몬이 쓰러짐)
 * 야생 체력은 "칸": 최대 칸 = 어지러워지는 정답 수 × CELLS_PER_HIT. 정답 한 번에 기술 위력만큼 깎는다.
 * 공격은 양쪽 모두 회피(DODGE_CHANCE) → 크리티컬(CRIT_CHANCE) 순으로 굴린다. 난수는 늘 인자 rng로 받는다(테스트 고정).
 */
import type { Rng } from '../random';
import { matchup, type Element } from './elements';
import { buttonFace, pickFired, type SkillButton, type SkillDef, type SkillId, type SpecialKind } from './skills';
import { rollTierLevel, throwOdds, type Tier } from './strength';
import {
  CALM_BONUS_MS,
  CAPSULE_ACTIVE_RATIO,
  CAPTURE_FAIL_HEAL_RATIO,
  CELLS_PER_HIT,
  CHARGE_BONUS_CELLS,
  COMPANION_MAX_HP,
  CRIT_CHANCE,
  CRIT_MULT,
  DODGE_CHANCE,
  ENEMY_ATTACK_EVERY,
  MAX_CHIP_CELLS,
  MAX_CHIP_CRIT_CELLS,
  SPECIAL_SUCCESS,
  TIER_RULES,
} from './tuning';
import { applyDamage } from './wounds';

/** 한 번에 흐르는 시간의 상한 (탭이 오래 멈췄다 돌아와도 한꺼번에 시간이 다 가지 않게). 운영 수치가 아니라 안전장치 */
export const MAX_TICK_MS = 250;

/** counter: 내가 정답으로 2번 때린 뒤 적이 한 번 자동으로 공격하는 연출 중 (끝나면 힌트 없이 새 문제) */
export type WildPhase = 'pick' | 'question' | 'hit' | 'counter' | 'struck' | 'hint' | 'dizzy' | 'caught' | 'escaped' | 'released' | 'fainted';
/** healed: 캡슐에서 빠져나와 힘을 조금 되찾고 다시 싸운다 (예전 'retry') */
export type ThrowOutcome = 'caught' | 'healed' | 'escaped' | 'angry';

/** 적 공격 한 번의 굴림 결과. damage는 내 구구몬이 실제로 받는 피해 (저장도 이 값 하나만 쓴다) */
export interface StrikeRoll {
  damage: number;
  /** 내 구구몬이 피했다 (피해 0) */
  dodged: boolean;
  /** 크리티컬 (피해 ×2) */
  crit: boolean;
  /** 적이 기절(스턴)해서 공격하지 못했다 (피해 0, 굴리지 않음) */
  blocked: boolean;
}

export interface WildState {
  tier: Tier;
  level: number;
  /** 깎인 칸 (0 ~ maxCells) */
  cells: number;
  /** 이 문제 남은 시간 */
  timeLeftMs: number;
  /** 이 문제의 시간 한도 (여유로 늘어난 시간 포함) — 시간 막대의 기준 */
  limitMs: number;
  /** 이 문제를 시작한 뒤 흐른 시간 (주속성 단계·부속성·특수 발동 판정. 여유로 늘어난 시간과 상관없이 실제로 흐른 시간) */
  elapsedMs: number;
  /** 우리 구구몬 체력 */
  allyHp: number;
  phase: WildPhase;
  /** 이 전투에서 맞힌 수 (경험치 정산용, 화나도 줄지 않음) */
  correct: number;
  /** 마지막 피격이 시간 초과였나 */
  timedOut: boolean;
  /** 충전: 다음 속성 기술에 더할 칸 (쓰면 0) */
  charge: number;
  /** 방어: 다음 적 공격 피해를 절반(올림)으로 (맞으면 false) */
  guard: boolean;
  /** 스턴(기절): 다음 적 공격 한 번을 막는다 — 틀리거나 시간이 지나도 피해 0 (막으면 false, 방어는 남는다). 캡슐이 잘 잡히는 상태이상이기도 하다 */
  stun: boolean;
  /** 여유: 다음 문제 시간에 더할 ms (문제 시계를 새로 시작할 때 더하고 0) */
  calmMs: number;
  /** 힌트: 다음 문제(맞힐 때까지)에서 틀린 보기 하나를 숨긴다. 어느 보기인지는 hiddenChoice */
  hideChoice: boolean;
  /** 정답으로 때린 횟수 (빗나간 공격도 센다). ENEMY_ATTACK_EVERY가 되면 적이 한 번 공격하고 0으로 */
  attackCount: number;
  /** 이 야생에게 캡슐이 실패한 횟수 (빠져나옴·화남). 실패할수록 잘 잡힌다 */
  throwTries: number;
  /** 마지막 적 공격의 굴림 결과 — 화면이 공격 순간 읽어 피해 저장·글에 쓴다. 아직 맞지 않았으면 null */
  lastStrike: StrikeRoll | null;
}

/** 이 단계 야생 구구몬의 체력 칸 수 (약함 6·보통 8·강함 8·강력 12·황금 8) */
export function maxCells(tier: Tier): number {
  return TIER_RULES[tier].hitsToDizzy * CELLS_PER_HIT;
}

/** 새 문제로 넘어간다: 시간을 처음부터, 여유가 있으면 더하고 써 버린다 */
function newQuestion(s: WildState): WildState {
  const limitMs = TIER_RULES[s.tier].timeMs + s.calmMs;
  return { ...s, timeLeftMs: limitMs, limitMs, elapsedMs: 0, calmMs: 0 };
}

/** 기술 버튼이 2개 이상이면 문제 전에 기술을 고른다 (heldCount = 버튼 수 — 이름은 예전 그대로) */
function askPhase(heldCount: number): 'pick' | 'question' {
  return heldCount >= 2 ? 'pick' : 'question';
}

export function createWild(tier: Tier, level: number, allyHp: number, heldCount = 1): WildState {
  const hp = applyDamage(allyHp, 0);
  return {
    tier,
    level,
    cells: 0,
    timeLeftMs: TIER_RULES[tier].timeMs,
    limitMs: TIER_RULES[tier].timeMs,
    elapsedMs: 0,
    allyHp: hp,
    // 쓰러진 구구몬으로는 싸우지 않는다 (만남이 막지만 한 번 더 지킨다)
    phase: hp <= 0 ? 'fainted' : askPhase(heldCount),
    correct: 0,
    timedOut: false,
    charge: 0,
    guard: false,
    stun: false,
    calmMs: 0,
    hideChoice: false,
    attackCount: 0,
    throwTries: 0,
    lastStrike: null,
  };
}

/**
 * 적의 공격 한 번 (오답·시간 초과·주기 공격 모두 이 함수) — **공격 전 상태**로 부른다.
 * 스턴이면 막힘(굴리지 않음, 스턴만 사라지고 방어는 남는다) → 아니면 내 구구몬이 DODGE_CHANCE로 피함(피해 0, 방어는 남는다)
 * → 아니면 CRIT_CHANCE로 크리티컬(피해 ×CRIT_MULT, 방어가 있으면 절반(올림)한 뒤 ×2). 맞으면 방어는 사라진다.
 * 돌려주는 damage 하나를 화면이 저장(damageCompanion)에 쓰고, 상태의 lastStrike에도 같은 값을 남긴다.
 * 체력이 0이 되면 phase는 fainted, 아니면 그대로 (부르는 쪽이 struck·counter로 바꾼다). 적의 기술 이름은 화면이 고른다
 */
export function enemyStrike(before: WildState, rng: Rng): StrikeRoll & { state: WildState } {
  if (before.stun) {
    const roll: StrikeRoll = { damage: 0, dodged: false, crit: false, blocked: true };
    return { ...roll, state: { ...before, stun: false, lastStrike: roll } };
  }
  if (rng() < DODGE_CHANCE) {
    const roll: StrikeRoll = { damage: 0, dodged: true, crit: false, blocked: false };
    return { ...roll, state: { ...before, lastStrike: roll } };
  }
  const crit = rng() < CRIT_CHANCE;
  const damage = damageOf(before) * (crit ? CRIT_MULT : 1);
  const roll: StrikeRoll = { damage, dodged: false, crit, blocked: false };
  const allyHp = applyDamage(before.allyHp, damage);
  return { ...roll, state: { ...before, allyHp, guard: false, lastStrike: roll, phase: allyHp <= 0 ? 'fainted' : before.phase } };
}

/** 오답·시간 초과로 맞음: 적의 공격 뒤 struck(연출 → 힌트). 체력이 0이 되면 힌트 없이 바로 끝 (R9). 때린 횟수(attackCount)는 그대로 */
function strike(s: WildState, timedOut: boolean, timeLeftMs: number, rng: Rng): WildState {
  const { state } = enemyStrike({ ...s, timeLeftMs, timedOut }, rng);
  return state.phase === 'fainted' ? state : { ...state, phase: 'struck' };
}

/**
 * 문제가 떠 있는 동안에만 시간이 준다(기술 고르는 동안은 멈춤). 이상한 dt(NaN·음수·무한)는 0으로 본다.
 * rng는 시간이 다 됐을 때 적 공격의 회피·크리티컬 굴림에만 쓴다
 */
export function tick(s: WildState, dtMs: number, rng: Rng): WildState {
  if (s.phase !== 'question') return s;
  const dt = Number.isFinite(dtMs) ? Math.min(Math.max(dtMs, 0), MAX_TICK_MS) : 0;
  if (dt === 0) return s;
  const timeLeftMs = Math.max(0, s.timeLeftMs - dt);
  const elapsedMs = s.elapsedMs + dt;
  if (timeLeftMs === 0) return strike({ ...s, elapsedMs }, true, 0, rng);
  return { ...s, timeLeftMs, elapsedMs };
}

/** tick의 다른 이름 (설계서 이름) */
export const tickWild = tick;

/** 기술을 골랐다: 고르기 → 문제, 시계 시작 (시간은 고르기에 들어갈 때 이미 새로 맞춰 두었다) */
export function pickSkill(s: WildState): WildState {
  if (s.phase !== 'pick') return s;
  return { ...s, phase: 'question', elapsedMs: 0 };
}

/** 정답 한 번에 깎는 칸 = 위력 + 충전 + 상성, 1~MAX_CHIP_CELLS (개정 3: "빨리 풀면 +1칸"은 없어짐) */
export function chipCells(power: number, m: -1 | 0 | 1, charge: number): number {
  return Math.min(MAX_CHIP_CELLS, Math.max(1, power + charge + m));
}

/** 크리티컬이면 깎는 칸 ×CRIT_MULT (최대 MAX_CHIP_CRIT_CELLS) */
export function critCells(chip: number): number {
  return Math.min(MAX_CHIP_CRIT_CELLS, chip * CRIT_MULT);
}

/**
 * 정답 피해를 넣는다: 칸은 최대에서 멈추고, 다 깎이면 어지러움. 이 문제의 숨긴 보기는 여기서 끝.
 * 맞힌 수·때린 횟수(attackCount)는 빗나가도(칸 0) 늘어난다 — 아이는 맞혔으니까
 */
function landHit(s: WildState, chip: number, extra: Partial<WildState> = {}): WildState {
  const max = maxCells(s.tier);
  const cells = Math.min(max, s.cells + chip);
  return {
    ...s,
    hideChoice: false,
    ...extra,
    cells,
    correct: s.correct + 1,
    // 어지러워지면 공격 횟수는 0으로 (캡슐에서 빠져나온 뒤 첫 정답 한 번에 주기 공격이 오지 않게)
    attackCount: cells >= max ? 0 : s.attackCount + 1,
    phase: cells >= max ? 'dizzy' : 'hit',
  };
}

/** 내 공격의 굴림: 야생이 DODGE_CHANCE로 피함(그러면 크리티컬은 굴리지 않음) → 아니면 CRIT_CHANCE로 크리티컬 */
function rollMyHit(rng: Rng): { dodged: boolean; crit: boolean } {
  if (rng() < DODGE_CHANCE) return { dodged: true, crit: false };
  return { dodged: false, crit: rng() < CRIT_CHANCE };
}

/** 특수 기술이 성공했을 때 남는 상태 (회복은 내 구구몬 체력이라 여기서 안 바꾼다 — 호출하는 쪽 몫) */
function specialEffect(kind: SpecialKind): Partial<WildState> {
  switch (kind) {
    case 'charge':
      return { charge: CHARGE_BONUS_CELLS };
    case 'guard':
      return { guard: true };
    case 'stun':
      return { stun: true };
    case 'calm':
      return { calmMs: CALM_BONUS_MS };
    case 'clue':
      return { hideChoice: true };
    case 'heal':
      return {};
  }
}

export interface AnswerResult {
  state: WildState;
  /** 실제로 나간 기술 (속도에 따라 고른 단계, 특수가 늦으면 가장 약한 속성 기술) */
  fired: SkillDef;
  /** 단계: 주①·느림 1, 주②·부속성 2, 주③ 3 */
  tier: 1 | 2 | 3;
  /** 속성 기술의 윗단계(주②·주③·부속성)가 나갔나 — 예전 fast(강력)의 자리 */
  upper: boolean;
  /** 특수 기술이 늦어서 다른 기술이 대신 나갔나 */
  usedFallback: boolean;
  /** 발동한 특수 효과: 특수 버튼 성공이나 주②의 효과가 **성공했을 때만** (heal이면 호출하는 쪽이 내 구구몬 체력을 채운다) */
  special?: SpecialKind;
  /** 야생이 피해서 빗나갔다 (칸·효과 없음, 충전은 남음) */
  dodged: boolean;
  /** 크리티컬 (칸 ×2, 최대 8) */
  crit: boolean;
  /** 효과를 굴렸으면 그 결과 (특수 버튼 성공·주②가 나가고 빗나가지 않았을 때만). 실패면 효과가 상태에 남지 않는다 */
  effect: { kind: SpecialKind; ok: boolean } | null;
}

/**
 * 정답 하나를 판정한다 (정답 한 번당 한 번). question이 아니면 상태를 그대로(같은 객체) 돌려준다(연타).
 * 어떤 기술이 나가는지는 pickFired(버튼·경과 시간)가 정한다 — 설계서 0-1절.
 * timeMs는 이 단계 문제 제한 시간(여유로 늘어난 시간은 넣지 않는다) — 단계 조건의 기준.
 * 난수 순서(설계서 0-2절): ① 야생 회피(빗나가면 여기서 끝 — 칸·효과 없음, 충전 남음) ② 크리티컬 ③ 효과 성공(효과가 나갈 때만, SPECIAL_SUCCESS).
 * 효과가 실패하면 칸(위력)은 그대로 들어가고 효과만 남지 않는다 (special도 비운다 — 회복 없음).
 */
export function resolveAnswer(
  s: WildState,
  button: SkillButton,
  held: readonly SkillId[],
  wildMainElement: Element,
  timeMs: number,
  rng: Rng,
): AnswerResult {
  if (s.phase !== 'question') {
    return { state: s, fired: buttonFace(button), tier: 1, upper: false, usedFallback: false, dodged: false, crit: false, effect: null };
  }
  const p = pickFired(button, held, s.elapsedMs, timeMs);
  const base = { fired: p.fired, tier: p.tier, upper: p.upper, usedFallback: p.usedFallback };

  const roll = rollMyHit(rng);
  if (roll.dodged) {
    // 빗나감: 칸·효과 없음, 충전은 다음을 위해 남긴다. 아이는 맞혔으니 맞힌 수·때린 횟수는 센다
    return { ...base, dodged: true, crit: false, effect: null, state: landHit(s, 0) };
  }
  const chipOf = (chip: number) => (roll.crit ? critCells(chip) : chip);
  // 효과 성공 굴림 (특수 버튼 성공·주②일 때만 한 번)
  const effect = p.special ? { kind: p.special, ok: rng() < SPECIAL_SUCCESS[p.special] } : null;
  const effectState = effect?.ok ? specialEffect(effect.kind) : {};
  const done = (state: WildState): AnswerResult => {
    const r: AnswerResult = { ...base, dodged: false, crit: roll.crit, effect, state };
    if (effect?.ok) r.special = effect.kind;
    return r;
  };

  if (p.fired.kind === 'special') {
    if (p.special) {
      // 특수 버튼 성공: 위력 그대로, 상성·충전 없음. 충전은 다음 속성 기술을 위해 남겨 둔다
      return done(landHit(s, chipOf(chipCells(p.fired.basePower, 0, 0)), effectState));
    }
    // 가진 속성 기술이 없으면(깨진 목록) 위력 1 기본 타격
    return done(landHit(s, chipOf(1)));
  }
  // 속성 기술이 나가면 상성을 보고 충전을 쓴다 (윗단계든, 특수가 늦어 대신 나갔든). 주②면 효과도 붙는다
  const m = p.fired.element ? matchup(p.fired.element, wildMainElement) : 0;
  return done(landHit(s, chipOf(chipCells(p.fired.basePower, m, s.charge)), { charge: 0, ...effectState }));
}

/**
 * 답하기: 오답이면 적이 공격한다. 정답이면 위력 2·상성 보통으로 깎는다(기술을 모르는 옛 호출용 — 기술은 resolveAnswer).
 * 정답도 회피·크리티컬을 굴린다. question이 아니면 그대로(연타)
 */
export function answerWild(s: WildState, correct: boolean, rng: Rng): WildState {
  if (s.phase !== 'question') return s;
  if (!correct) return strike(s, false, s.timeLeftMs, rng);
  const roll = rollMyHit(rng);
  if (roll.dodged) return landHit(s, 0);
  const chip = Math.min(MAX_CHIP_CELLS, Math.max(1, CELLS_PER_HIT + s.charge));
  return landHit(s, roll.crit ? critCells(chip) : chip, { charge: 0 });
}

/** 명중 뒤 적의 주기 공격 차례인가: 정답으로 ENEMY_ATTACK_EVERY번 때렸고 야생이 아직 어지럽지 않다(hit) */
export function counterDue(s: WildState): boolean {
  return s.phase === 'hit' && s.attackCount >= ENEMY_ATTACK_EVERY;
}

/**
 * 적의 주기 공격 (명중 연출이 끝난 뒤, counterDue일 때만 — 아니면 null). 피해는 enemyStrike 그대로(스턴·회피·크리티컬·방어).
 * 때린 횟수는 0으로, 단계는 counter(연출 → 힌트 없이 새 문제). 쓰러지면 fainted
 */
export function counterAttack(s: WildState, rng: Rng): (StrikeRoll & { state: WildState }) | null {
  if (!counterDue(s)) return null;
  const r = enemyStrike({ ...s, attackCount: 0 }, rng);
  return { ...r, state: r.state.phase === 'fainted' ? r.state : { ...r.state, phase: 'counter' } };
}

/**
 * 연출이 끝나면 다음으로: 명중·주기 공격 → 새 문제(기술이 2개 이상이면 고르기부터), 피격 → 힌트,
 * 힌트 → 다른 새 문제(2차 방식: 틀린 문제는 화면이 몇 문제 뒤에 다시 낸다). 새로 시작하는 문제는 시간이 처음부터.
 * 명중 뒤 주기 공격(counterDue)이 있으면 화면이 먼저 counterAttack을 부른다
 */
export function resumeWild(s: WildState, heldCount = 1): WildState {
  if (s.phase === 'struck') return { ...s, phase: 'hint' };
  if (s.phase === 'hit' || s.phase === 'counter' || s.phase === 'hint') return { ...newQuestion(s), phase: askPhase(heldCount) };
  return s;
}

/** 캡슐 버튼이 켜지는가: 야생 남은 칸이 최대의 CAPSULE_ACTIVE_RATIO 이하 (약함 6칸 중 1칸·보통 8칸 중 2칸·강력 12칸 중 3칸 남았을 때부터) */
export function catchActive(s: WildState): boolean {
  const max = maxCells(s.tier);
  return max - s.cells <= max * CAPSULE_ACTIVE_RATIO;
}

/** 지금 캡슐을 던질 수 있나: 어지러움(언제나), 또는 기술 고르기·문제를 푸는 중이고 야생 체력이 1/4 이하 */
export function canThrow(s: WildState): boolean {
  if (s.phase === 'dizzy') return true;
  return (s.phase === 'pick' || s.phase === 'question') && catchActive(s);
}

/**
 * 캡슐 던지기 (canThrow일 때만, 아니면 null). 난수 하나로 결과를 정한다(R11):
 * 잡힘 → 빠져나옴 → 도망 → 화남 순으로 칸을 쌓아, 0은 언제나 잡힘이고 0.999는 화남.
 * 잡힘 확률은 실패한 수(throwTries)·기절(stun)·낮은 남은 체력만큼 오른다 (throwOdds). 빠져나옴·화남이면 실패 수 +1, 새 문제로.
 * 문제를 푸는 중에 던졌으면 그 문제는 틀린 것으로 치지 않는다 (맞힌 수·체력 그대로).
 */
export function throwCapsule(
  s: WildState,
  rng: Rng,
  companionLevel: number,
  heldCount = 1,
): { state: WildState; outcome: ThrowOutcome } | null {
  if (!canThrow(s)) return null;
  const odds = throwOdds(s.tier, s.throwTries, s.stun, (maxCells(s.tier) - s.cells) / maxCells(s.tier));
  const r = rng();
  if (r < odds.caught) return { state: { ...s, phase: 'caught' }, outcome: 'caught' };
  const throwTries = s.throwTries + 1;
  if (r < odds.caught + odds.retry) {
    // 빠져나옴: 어지러움이 풀리고 깎인 칸에서 절반(올림)을 되찾아 다시 싸운다
    const heal = Math.ceil(maxCells(s.tier) * CAPTURE_FAIL_HEAL_RATIO);
    const cells = Math.max(0, s.cells - heal);
    return { state: { ...newQuestion(s), cells, throwTries, phase: askPhase(heldCount) }, outcome: 'healed' };
  }
  if (r < 1 - odds.angry) return { state: { ...s, phase: 'escaped' }, outcome: 'escaped' };
  // 화남: 강력이 되어(이미 강력·황금이면 그대로) 체력을 다 채우고 다시 싸운다 (기술이 2개 이상이면 고르기부터)
  // 충전·방어·힌트(charge·guard·hideChoice)는 빠져나옴·화남 뒤에도 그대로 남긴다 — 내가 얻은 힘이라 일부러 지우지 않는다
  const stays = s.tier === 'mighty' || s.tier === 'legend';
  const tier: Tier = stays ? s.tier : 'mighty';
  const level = stays ? s.level : rollTierLevel(rng, 'mighty', companionLevel);
  return {
    state: { ...newQuestion({ ...s, tier }), level, cells: 0, throwTries, phase: askPhase(heldCount) },
    outcome: 'angry',
  };
}

/** 회복 특수: 내 구구몬 체력을 amount만큼 채운다(가득을 넘지 않음). 저장은 화면이 스토어로 따로 한다. 가득이면 그대로 */
export function healAlly(s: WildState, amount: number): WildState {
  const add = Number.isFinite(amount) && amount > 0 ? Math.round(amount) : 0;
  const allyHp = Math.min(COMPANION_MAX_HP, s.allyHp + add);
  return allyHp === s.allyHp ? s : { ...s, allyHp };
}

/** 어지러운 구구몬을 그냥 돌려보낸다 (캡슐이 없을 때 등) */
export function releaseWild(s: WildState): WildState {
  return s.phase === 'dizzy' ? { ...s, phase: 'released' } : s;
}

/** 야생 체력 막대 (1이 가득, 0이 어지러움) — 칸 기준 */
export function wildHpRatio(s: WildState): number {
  return Math.min(1, Math.max(0, 1 - s.cells / maxCells(s.tier)));
}

/** 이 단계 적이 한 번에 주는 피해 (방어 중이면 절반 올림. 스턴·회피·크리티컬은 보지 않음 — 실제 피해는 enemyStrike) */
export function damageOf(s: WildState): number {
  const base = TIER_RULES[s.tier].damage;
  return s.guard ? Math.ceil(base / 2) : base;
}

/** 힌트 특수: 숨길 틀린 보기의 자리 (틀린 보기가 없으면 null). 화면이 문제를 낼 때 한 번 뽑는다 */
export function hiddenChoice(choices: readonly number[], answer: number, rng: Rng): number | null {
  const wrong = choices.flatMap((c, i) => (c === answer ? [] : [i]));
  if (wrong.length === 0) return null;
  return wrong[Math.min(wrong.length - 1, Math.floor(rng() * wrong.length))];
}
