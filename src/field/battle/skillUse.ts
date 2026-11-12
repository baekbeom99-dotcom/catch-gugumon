/**
 * 전투에서 기술 쓰기 — 전투 화면이 부르는 순수 도우미 (React 없음, 테스트는 tests/field/skillUse.test.ts).
 * 규칙 자체는 domain/field/wildBattle.ts(resolveAnswer)와 skills.ts. 여기서는 화면 쪽 값(스위치·효과 이름)을 맞춘다.
 */
import type { SpeciesId } from '../../domain/field/creatures';
import { ELEMENT_FX, MAIN_ELEMENT, SPECIAL_FX, STRONG_FX, matchup, type Element } from '../../domain/field/elements';
import { defaultSkills, learnedAt, skillDef, type SkillDef, type SkillId } from '../../domain/field/skills';
import { TIER_RULES } from '../../domain/field/tuning';
import { resolveAnswer, type AnswerResult, type WildState } from '../../domain/field/wildBattle';
import { battleText } from './battleText';
import type { Rng } from '../../domain/random';
import { SKILL_SFX, SPECIAL_SFX, type Sfx } from '../../audio/sfx';
import type { FxName } from '../fx/effects';

/** 저장된 가진 기술(없거나 비었으면 그 레벨의 기본 기술)을 기술 표로. 전투를 시작할 때 한 번 정해 두고 바꾸지 않는다 */
export function heldSkills(species: SpeciesId, entry: { level: number; skills?: readonly SkillId[] } | undefined): SkillDef[] {
  const ids = entry?.skills?.length ? entry.skills : defaultSkills(species, entry?.level ?? 1);
  return ids.map(skillDef);
}

/**
 * 정답 하나를 기술로 판정한다. 강력 기준 시간은 **그 단계 문제 시간(TIER_RULES[tier].timeMs)만** 넘긴다 —
 * 여유(calm)로 늘어난 남은 시간을 넘기면 강력 조건이 느슨해지므로 넣지 않는다.
 * fast(E2E 스위치 __GUGU_E2E_FAST__): true면 늘 빠르게(틀린 뒤 같은 문제여도), false면 늘 늦게, null이면 실제로 흐른 시간.
 */
export function answerWithSkill(
  s: WildState,
  picked: SkillDef,
  held: readonly SkillId[],
  wildMain: Element,
  fast: boolean | null,
): AnswerResult {
  const timeMs = TIER_RULES[s.tier].timeMs;
  if (fast === null) return resolveAnswer(s, picked, [...held], wildMain, timeMs);
  // 판정할 때만 경과 시간·틀린 표시를 바꿔 넣고, 돌려줄 상태에는 원래 값을 둔다
  const forced: WildState = { ...s, elapsedMs: fast ? 0 : timeMs + 1, missed: fast ? false : s.missed };
  const r = resolveAnswer(forced, picked, [...held], wildMain, timeMs);
  return { ...r, state: r.state === forced ? s : { ...r.state, elapsedMs: s.elapsedMs, missed: s.missed } };
}

/**
 * 정답 글: 나간 기술(강력·특수·대신 나감) 한 줄 + 상성 한 줄(보통이면 없음).
 * healed는 회복 특수로 실제로 늘어난 체력 (가득이었으면 0)
 */
export function hitMessage(r: AnswerResult, wildMain: Element, healed: number): string {
  const name = r.fired.name;
  const main = r.usedFallback
    ? battleText.fallback(name)
    : r.special === 'heal'
      ? battleText.healSkill(name, healed)
      : r.special
        ? battleText.special(name, r.special)
        : r.fast
          ? battleText.strong(name)
          : battleText.hit(name);
  // 특수 기술이 발동했으면 상성이 없다
  const m = r.special ? null : skillMatchup(r.fired, wildMain);
  return m ? `${main}\n${battleText.matchup(m)}` : main;
}

/** 내 기술 → 야생 주속성 상성 (+1 강함·−1 약함·0 보통). 특수 기술은 상성이 없어 null */
export function skillMatchup(def: SkillDef, wildMain: Element): -1 | 0 | 1 | null {
  return def.element ? matchup(def.element, wildMain) : null;
}

/**
 * 기술 효과 이름. 특수 기술은 종류별 효과(SPECIAL_FX), 속성 기술은 그 속성의 fxIndex 칸 —
 * 강력(빨리 풀어 강하게 나감)이면 강력 효과 표(STRONG_FX)에서 같은 칸을 쓴다.
 */
export function skillFxName(def: SkillDef, strong: boolean): FxName {
  if (def.special) return SPECIAL_FX[def.special];
  const element = def.element ?? MAIN_ELEMENT[def.species];
  const index = Math.min(3, Math.max(0, def.fxIndex ?? 0));
  return (strong ? STRONG_FX : ELEMENT_FX)[element][index];
}

/** 적의 기술: 그 종이 그 레벨에서 익힌 속성 기술 중 무작위 (특수 제외, 황금은 황금 기술). 적어도 1번 기술 */
export function foeSkill(species: SpeciesId, level: number, rng: Rng): SkillDef {
  const list = learnedAt(species, level).filter((k) => k.kind !== 'special');
  if (list.length === 0) return skillDef(`${species}-1`);
  return list[Math.min(list.length - 1, Math.max(0, Math.floor(rng() * list.length)))];
}

/**
 * 기술이 맞는 순간 틀 소리 목록 (효과 그림과 같은 타이밍).
 * 내 속성 기술: 그 속성 소리 + 강력이면 fxPower + 상성 강함·약함(보통·없음은 없음).
 * 내 특수 기술 성공: 특수 소리만. 적 공격: 속성 소리만.
 * 늦어서 약한 기술이 대신 나가면 def가 그 속성 기술이므로 속성 소리만 난다.
 */
export function skillSfxPlan(
  attacker: 'ally' | 'foe',
  def: SkillDef,
  strong: boolean,
  matchupValue: -1 | 0 | 1 | null,
): Sfx[] {
  if (def.special) return [SPECIAL_SFX[def.special]];
  const element = def.element ?? MAIN_ELEMENT[def.species];
  const plan: Sfx[] = [SKILL_SFX[element]];
  if (attacker === 'foe') return plan;
  if (strong) plan.push('fxPower');
  if (matchupValue === 1) plan.push('superEffective');
  else if (matchupValue === -1) plan.push('notVery');
  return plan;
}
