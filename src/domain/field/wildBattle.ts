/**
 * 야생 구구몬과의 전투 규칙 — 설계서 6-2~6-6, 필드 모험 3차 2-6·3절 (순수 로직: 시간·무작위는 인자로만 받는다)
 * 단계: (pick 기술 고르기) → question(문제) → 정답 hit / 오답·시간 초과 struck → hint → question … → dizzy(어지러움) → 던지기
 * 끝: caught(잡힘) · escaped(도망감) · released(돌려보냄) · fainted(우리 구구몬이 쓰러짐)
 * 야생 체력은 "칸": 최대 칸 = 어지러워지는 정답 수 × CELLS_PER_HIT. 정답 한 번에 기술 위력만큼 깎는다.
 */
import type { Rng } from '../random';
import { matchup, type Element } from './elements';
import { buttonFace, pickFired, type SkillButton, type SkillDef, type SkillId, type SpecialKind } from './skills';
import { rollTierLevel, throwOdds, type Tier } from './strength';
import {
  CALM_BONUS_MS,
  CAPTURE_FAIL_HEAL_RATIO,
  CELLS_PER_HIT,
  CHARGE_BONUS_CELLS,
  COMPANION_MAX_HP,
  MAX_CHIP_CELLS,
  TIER_RULES,
} from './tuning';
import { applyDamage } from './wounds';

/** 한 번에 흐르는 시간의 상한 (탭이 오래 멈췄다 돌아와도 한꺼번에 시간이 다 가지 않게). 운영 수치가 아니라 안전장치 */
export const MAX_TICK_MS = 250;

export type WildPhase = 'pick' | 'question' | 'hit' | 'struck' | 'hint' | 'dizzy' | 'caught' | 'escaped' | 'released' | 'fainted';
/** healed: 캡슐에서 빠져나와 힘을 조금 되찾고 다시 싸운다 (예전 'retry') */
export type ThrowOutcome = 'caught' | 'healed' | 'escaped' | 'angry';

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
  /** 이 문제에서 이미 틀렸나 (시간 초과 포함). 학습 기록의 "다시 푼 문제(isRetry)" 표시에 쓴다 (발동 판정에는 안 씀). 새 문제로 넘어갈 때만 꺼진다 */
  missed: boolean;
  /** 충전: 다음 속성 기술에 더할 칸 (쓰면 0) */
  charge: number;
  /** 방어: 다음 적 공격 피해를 절반(올림)으로 (맞으면 false) */
  guard: boolean;
  /** 스턴(기절): 다음 적 공격 한 번을 막는다 — 틀리거나 시간이 지나도 피해 0 (막으면 false, 방어는 남는다) */
  stun: boolean;
  /** 여유: 다음 문제 시간에 더할 ms (문제 시계를 새로 시작할 때 더하고 0) */
  calmMs: number;
  /** 힌트: 다음 문제(맞힐 때까지)에서 틀린 보기 하나를 숨긴다. 어느 보기인지는 hiddenChoice */
  hideChoice: boolean;
}

/** 이 단계 야생 구구몬의 체력 칸 수 (약함 6·보통 8·강함 8·강력 12·황금 8) */
export function maxCells(tier: Tier): number {
  return TIER_RULES[tier].hitsToDizzy * CELLS_PER_HIT;
}

/** 새 문제(또는 같은 문제 다시)의 시계: 시간을 처음부터, 여유가 있으면 더하고 써 버린다. 틀린 표시(missed, 학습 기록용)는 건드리지 않는다 */
function freshClock(s: WildState): WildState {
  const limitMs = TIER_RULES[s.tier].timeMs + s.calmMs;
  return { ...s, timeLeftMs: limitMs, limitMs, elapsedMs: 0, calmMs: 0 };
}

/** 새 문제로 넘어간다: 시계를 새로 하고 틀린 표시를 끈다 (힌트 뒤 같은 문제는 freshClock만) */
function newQuestion(s: WildState): WildState {
  return { ...freshClock(s), missed: false };
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
    missed: false,
    charge: 0,
    guard: false,
    stun: false,
    calmMs: 0,
    hideChoice: false,
  };
}

/**
 * 적의 공격: 스턴이면 막고(피해 0, 스턴만 사라짐), 아니면 strikeDamage만큼(방어가 있으면 절반 올림, 방어는 사라짐). 이 문제는 틀린 것으로 표시한다.
 * 체력이 0이 되면 힌트 없이 바로 끝 (R9). 적이 쓰는 기술 이름은 화면이 고른다(난수를 쓰지 않음)
 */
function strike(s: WildState, timedOut: boolean, timeLeftMs: number): WildState {
  if (s.stun) {
    // 적이 기절해서 못 움직인다: 피해 0, 스턴만 쓴다 (방어는 다음 공격을 위해 남긴다). 틀린 표시는 그대로 켠다
    return { ...s, timeLeftMs, timedOut, missed: true, stun: false, phase: 'struck' };
  }
  const allyHp = applyDamage(s.allyHp, strikeDamage(s));
  return { ...s, allyHp, timeLeftMs, timedOut, missed: true, guard: false, phase: allyHp <= 0 ? 'fainted' : 'struck' };
}

/**
 * 문제가 떠 있는 동안에만 시간이 준다(기술 고르는 동안은 멈춤). 이상한 dt(NaN·음수·무한)는 0으로 본다.
 * _rng는 예전에 적 기술 번호를 뽑던 자리 — 지금은 쓰지 않지만 부르는 쪽이 많아 자리만 남겨 둔다
 */
export function tick(s: WildState, dtMs: number, _rng: Rng): WildState {
  if (s.phase !== 'question') return s;
  const dt = Number.isFinite(dtMs) ? Math.min(Math.max(dtMs, 0), MAX_TICK_MS) : 0;
  if (dt === 0) return s;
  const timeLeftMs = Math.max(0, s.timeLeftMs - dt);
  const elapsedMs = s.elapsedMs + dt;
  if (timeLeftMs === 0) return strike({ ...s, elapsedMs }, true, 0);
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

/** 정답 피해를 넣는다: 칸은 최대에서 멈추고, 다 깎이면 어지러움. 이 문제의 숨긴 보기는 여기서 끝 */
function landHit(s: WildState, chip: number, extra: Partial<WildState> = {}): WildState {
  const max = maxCells(s.tier);
  const cells = Math.min(max, s.cells + chip);
  return { ...s, hideChoice: false, ...extra, cells, correct: s.correct + 1, phase: cells >= max ? 'dizzy' : 'hit' };
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
  /** 발동한 특수 효과: 특수 버튼 성공이나 주②의 효과 (heal이면 호출하는 쪽이 내 구구몬 체력을 채운다) */
  special?: SpecialKind;
}

/**
 * 정답 하나를 판정한다 (정답 한 번당 한 번). question이 아니면 상태를 그대로(같은 객체) 돌려준다(연타).
 * 어떤 기술이 나가는지는 pickFired(버튼·경과 시간)가 정한다 — 설계서 0-1절.
 * timeMs는 이 단계 문제 제한 시간(여유로 늘어난 시간은 넣지 않는다) — 단계 조건의 기준.
 */
export function resolveAnswer(
  s: WildState,
  button: SkillButton,
  held: readonly SkillId[],
  wildMainElement: Element,
  timeMs: number,
): AnswerResult {
  if (s.phase !== 'question') return { state: s, fired: buttonFace(button), tier: 1, upper: false, usedFallback: false };
  // 틀린 뒤 힌트를 보고 같은 문제를 다시 풀 때도 시계가 처음부터라 같은 규칙 (윗단계·특수 발동 가능)
  const p = pickFired(button, held, s.elapsedMs, timeMs);
  const base: Omit<AnswerResult, 'state'> = { fired: p.fired, tier: p.tier, upper: p.upper, usedFallback: p.usedFallback };
  if (p.special) base.special = p.special;

  if (p.fired.kind === 'special') {
    if (p.special) {
      // 특수 버튼 성공: 위력 그대로, 상성·충전 없음. 충전은 다음 속성 기술을 위해 남겨 둔다
      return { ...base, state: landHit(s, chipCells(p.fired.basePower, 0, 0), specialEffect(p.special)) };
    }
    // 가진 속성 기술이 없으면(깨진 목록) 위력 1 기본 타격
    return { ...base, state: landHit(s, 1) };
  }
  // 속성 기술이 나가면 상성을 보고 충전을 쓴다 (윗단계든, 특수가 늦어 대신 나갔든). 주②면 효과도 붙는다
  const m = p.fired.element ? matchup(p.fired.element, wildMainElement) : 0;
  const extra = { charge: 0, ...(p.special ? specialEffect(p.special) : {}) };
  return { ...base, state: landHit(s, chipCells(p.fired.basePower, m, s.charge), extra) };
}

/**
 * 답하기: 오답이면 적이 공격한다. 정답이면 위력 2·상성 보통으로 깎는다(기술을 모르는 옛 호출용 — 기술은 resolveAnswer).
 * question이 아니면 그대로(연타)
 */
export function answerWild(s: WildState, correct: boolean, _rng: Rng): WildState {
  if (s.phase !== 'question') return s;
  if (!correct) return strike(s, false, s.timeLeftMs);
  return landHit(s, Math.min(MAX_CHIP_CELLS, Math.max(1, CELLS_PER_HIT + s.charge)), { charge: 0 });
}

/**
 * 연출이 끝나면 다음으로: 명중 → 새 문제(기술이 2개 이상이면 고르기부터), 피격 → 힌트,
 * 힌트 → 같은 문제(고르지 않고 같은 기술로). 새로 시작하는 문제는 시간이 처음부터
 */
export function resumeWild(s: WildState, heldCount = 1): WildState {
  if (s.phase === 'struck') return { ...s, phase: 'hint' };
  if (s.phase === 'hit') return { ...newQuestion(s), phase: askPhase(heldCount) };
  // 힌트 뒤 같은 문제: 시계만 새로(다시 빨리 풀면 윗단계·특수 발동 가능), 틀린 표시는 학습 기록용으로 그대로
  if (s.phase === 'hint') return { ...freshClock(s), phase: 'question' };
  return s;
}

/**
 * 캡슐 던지기 (어지러울 때만, 아니면 null). 난수 하나로 결과를 정한다(R11):
 * 잡힘 → 빠져나옴 → 도망 → 화남 순으로 칸을 쌓아, 0은 언제나 잡힘이고 0.999는 화남.
 */
export function throwCapsule(
  s: WildState,
  rng: Rng,
  companionLevel: number,
  heldCount = 1,
): { state: WildState; outcome: ThrowOutcome } | null {
  if (s.phase !== 'dizzy') return null;
  const odds = throwOdds(s.tier);
  const r = rng();
  if (r < odds.caught) return { state: { ...s, phase: 'caught' }, outcome: 'caught' };
  if (r < odds.caught + odds.retry) {
    // 빠져나옴: 어지러움이 풀리고 깎인 칸에서 절반(올림)을 되찾아 다시 싸운다
    const heal = Math.ceil(maxCells(s.tier) * CAPTURE_FAIL_HEAL_RATIO);
    const cells = Math.max(0, s.cells - heal);
    return { state: { ...newQuestion(s), cells, phase: askPhase(heldCount) }, outcome: 'healed' };
  }
  if (r < 1 - odds.angry) return { state: { ...s, phase: 'escaped' }, outcome: 'escaped' };
  // 화남: 강력이 되어(이미 강력·황금이면 그대로) 체력을 다 채우고 다시 싸운다 (기술이 2개 이상이면 고르기부터)
  // 충전·방어·힌트(charge·guard·hideChoice)는 빠져나옴·화남 뒤에도 그대로 남긴다 — 내가 얻은 힘이라 일부러 지우지 않는다
  const stays = s.tier === 'mighty' || s.tier === 'legend';
  const tier: Tier = stays ? s.tier : 'mighty';
  const level = stays ? s.level : rollTierLevel(rng, 'mighty', companionLevel);
  return {
    state: { ...newQuestion({ ...s, tier }), level, cells: 0, phase: askPhase(heldCount) },
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

/**
 * 지금 적이 공격하면 실제로 들어가는 피해 — **공격 전 상태**로 부른다 (스턴이면 0, 방어면 절반 올림, 아니면 단계 피해).
 * strike(도메인)와 저장(화면의 damageCompanion)이 이 한 값을 같이 쓴다: 공격 뒤 상태로 부르면 스턴·방어가 이미 사라져 있다
 */
export function strikeDamage(before: WildState): number {
  return before.stun ? 0 : damageOf(before);
}

/** 이 단계 적이 한 번에 주는 피해 (방어 중이면 절반 올림, 스턴은 보지 않음 — 실제 피해는 strikeDamage) */
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
