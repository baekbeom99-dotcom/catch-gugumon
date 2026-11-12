/**
 * 전투에서 기술 쓰기 — 전투 화면이 부르는 순수 도우미 (React 없음, 테스트는 tests/field/skillUse.test.ts).
 * 규칙 자체는 domain/field/wildBattle.ts(resolveAnswer)와 skills.ts. 여기서는 화면 쪽 값(스위치·효과 이름·글·시간 게이지 기점)을 맞춘다.
 */
import type { SpeciesId } from '../../domain/field/creatures';
import { ELEMENT_FX, MAIN_ELEMENT, SPECIAL_FX, matchup, type Element } from '../../domain/field/elements';
import {
  M2_EFFECT_OF_SPECIES,
  defaultSkills,
  fastSeconds,
  learnedAt,
  skillDef,
  type SkillButton,
  type SkillDef,
  type SkillId,
} from '../../domain/field/skills';
import { TIER_RULES } from '../../domain/field/tuning';
import { resolveAnswer, type AnswerResult, type WildPhase, type WildState } from '../../domain/field/wildBattle';
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
 * 정답 하나를 기술 버튼으로 판정한다. 단계 기준 시간은 **그 단계 문제 시간(TIER_RULES[tier].timeMs)만** 넘긴다 —
 * 여유(calm)로 늘어난 남은 시간을 넘기면 조건이 느슨해지므로 넣지 않는다.
 * fast(E2E 스위치 __GUGU_E2E_FAST__): true면 늘 가장 빠르게, false면 늘 늦게, null이면 실제로 흐른 시간.
 */
export function answerWithSkill(
  s: WildState,
  button: SkillButton,
  held: readonly SkillId[],
  wildMain: Element,
  fast: boolean | null,
): AnswerResult {
  const timeMs = TIER_RULES[s.tier].timeMs;
  if (fast === null) return resolveAnswer(s, button, held, wildMain, timeMs);
  // 판정할 때만 경과 시간을 바꿔 넣고, 돌려줄 상태에는 원래 값을 둔다
  const forced: WildState = { ...s, elapsedMs: fast ? 0 : timeMs + 1 };
  const r = resolveAnswer(forced, button, held, wildMain, timeMs);
  return { ...r, state: r.state === forced ? s : { ...r.state, elapsedMs: s.elapsedMs } };
}

/** 특수 버튼의 특수 효과가 발동했나 (주②에 붙은 효과는 FiredSkill.special에도 들어오므로 나간 기술 종류까지 본다) */
export function specialFired(r: Pick<AnswerResult, 'fired' | 'special'>): boolean {
  return r.fired.kind === 'special' && !!r.special;
}

/** 주②가 나가며 붙은 효과 (스턴·회복·방어). 특수 버튼 성공이면 null — 그것은 기술 자체의 효과다 */
export function stageEffect(r: Pick<AnswerResult, 'fired' | 'special'>) {
  return r.special && r.fired.kind !== 'special' ? r.special : null;
}

/**
 * 정답 글: 나간 기술 한 줄(윗단계면 "빠르다! N번 기술이 나갔어요") + 주②의 효과 한 줄 + 상성 한 줄(보통이면 없음).
 * healed는 회복(특수 버튼·주②)으로 실제로 늘어난 체력 (가득이었으면 0). from은 고른 버튼 종류(부속성이면 "부속성 기술").
 */
export function hitMessage(r: AnswerResult, wildMain: Element, healed: number, from: SkillButton['kind'] = 'main'): string {
  const name = r.fired.name;
  const lines: string[] = [];
  if (r.usedFallback) lines.push(battleText.fallback(name));
  else if (specialFired(r)) lines.push(r.special === 'heal' ? battleText.healSkill(name, healed) : battleText.special(name, r.special!));
  else if (r.upper) lines.push(battleText.upper(name, from === 'sub' ? null : r.tier));
  else lines.push(battleText.hit(name));
  const effect = stageEffect(r);
  if (effect) lines.push(battleText.stageEffect(effect, healed));
  // 특수 기술(속성 없음)은 상성이 없다
  const m = skillMatchup(r.fired, wildMain);
  if (m) lines.push(battleText.matchup(m));
  return lines.join('\n');
}

/** 내 기술 → 야생 주속성 상성 (+1 강함·−1 약함·0 보통). 특수 기술은 상성이 없어 null */
export function skillMatchup(def: SkillDef, wildMain: Element): -1 | 0 | 1 | null {
  return def.element ? matchup(def.element, wildMain) : null;
}

/**
 * 기술 효과 이름. 특수 기술은 종류별 효과(SPECIAL_FX), 속성 기술은 그 속성의 fxIndex 칸(ELEMENT_FX — 복사한 기술은 원래 종의 칸).
 * 개정 3: 윗단계가 나가도 그 기술의 칸을 쓴다 (주속성 1·2·3번이 곧 약함 → 강함 효과). 강력 효과 표(STRONG_FX)는 보관만 한다.
 * 둘째 인자는 예전 "강력" 자리 — 지금은 효과 그림에 영향이 없다.
 */
export function skillFxName(def: SkillDef, _upper = false): FxName {
  if (def.special) return SPECIAL_FX[def.special];
  const element = def.element ?? MAIN_ELEMENT[def.species];
  const index = Math.min(3, Math.max(0, def.fxIndex ?? 0));
  return ELEMENT_FX[element][index];
}

/** 적의 기술: 그 종이 그 레벨에서 익힌 속성 기술 중 무작위 (특수 제외, 황금은 황금 기술). 적어도 1번 기술 */
export function foeSkill(species: SpeciesId, level: number, rng: Rng): SkillDef {
  const list = learnedAt(species, level).filter((k) => k.kind !== 'special');
  if (list.length === 0) return skillDef(`${species}-1`);
  return list[Math.min(list.length - 1, Math.max(0, Math.floor(rng() * list.length)))];
}

/**
 * 기술이 맞는 순간 틀 소리 목록 (효과 그림과 같은 타이밍).
 * 내 속성 기술: 그 속성 소리 + 윗단계(upper: 주②·주③·부속성)면 fxPower + 상성 강함·약함(보통·없음은 없음).
 * 내 특수 기술 성공: 특수 소리만. 적 공격: 속성 소리만.
 * 늦어서 약한 기술이 대신 나가면 def가 그 속성 기술이고 upper가 아니므로 속성 소리만 난다.
 * 주②의 효과 소리는 effectPlan이 따로 조금 늦게 낸다.
 */
export function skillSfxPlan(
  attacker: 'ally' | 'foe',
  def: SkillDef,
  upper: boolean,
  matchupValue: -1 | 0 | 1 | null,
): Sfx[] {
  if (def.special) return [SPECIAL_SFX[def.special]];
  const element = def.element ?? MAIN_ELEMENT[def.species];
  const plan: Sfx[] = [SKILL_SFX[element]];
  if (attacker === 'foe') return plan;
  if (upper) plan.push('fxPower');
  if (matchupValue === 1) plan.push('superEffective');
  else if (matchupValue === -1) plan.push('notVery');
  return plan;
}

/**
 * 주②의 효과 연출: 스턴은 맞은 적 위에 스턴 그림, 회복·방어는 내 구구몬 위에 그 특수 그림. 소리는 그 특수 소리.
 * 효과가 없으면(주①·주③·부속성·대신 나감·특수 버튼 성공) null — 특수 버튼은 기술 효과 자체가 특수 그림이다
 */
export function effectPlan(r: Pick<AnswerResult, 'fired' | 'special'>): { fx: FxName; sfx: Sfx; on: 'foe' | 'ally' } | null {
  const effect = stageEffect(r);
  if (!effect) return null;
  return { fx: SPECIAL_FX[effect], sfx: SPECIAL_SFX[effect], on: effect === 'stun' ? 'foe' : 'ally' };
}

// ── 시간 게이지 기점 (설계서 0-1절 "시간 게이지 표시") ──

/** 시간 게이지의 눈금: 문제를 시작한 뒤 atMs까지 풀면 tier 단계가 나간다 */
export interface GaugeStop {
  atMs: number;
  tier: 1 | 2 | 3;
  skillName: string;
}

/**
 * 고른 버튼의 기점들 (빠른 기점부터). 주속성은 가진 2번·3번, 부속성·특수는 하나(②).
 * timeMs는 그 단계 문제 시간 — 여유로 늘어난 시간은 넣지 않는다(판정과 같은 기준이라 기점이 움직이지 않는다)
 */
export function gaugeStops(button: SkillButton, timeMs: number): GaugeStop[] {
  const at = (def: SkillDef) => fastSeconds(def, timeMs) * 1000;
  if (button.kind === 'main') {
    return button.chain
      .slice(1)
      .map((def): GaugeStop => ({ atMs: at(def), tier: def.slot === 5 ? 3 : 2, skillName: def.name }))
      .sort((a, b) => a.atMs - b.atMs || b.tier - a.tier);
  }
  return [{ atMs: at(button.skill), tier: 2, skillName: button.skill.name }];
}

/** 경과 시간 elapsedMs에 나갈 단계: 아직 안 지난 기점 중 가장 높은 단계, 다 지났으면 1 (경계 포함 — pickFired와 같다) */
export function tierAt(stops: readonly GaugeStop[], elapsedMs: number): 1 | 2 | 3 {
  let tier: 1 | 2 | 3 = 1;
  for (const s of stops) if (elapsedMs <= s.atMs && s.tier > tier) tier = s.tier;
  return tier;
}

/** 기점의 자리: 게이지(왼쪽부터 남은 시간만큼 차 있음)의 왼쪽 끝에서 비율 0~1 */
export function stopPosition(atMs: number, limitMs: number): number {
  if (!(limitMs > 0)) return 0;
  return Math.min(1, Math.max(0, (limitMs - atMs) / limitMs));
}

// ── 고르기 버튼·준비 글 (Task 13의 기술 관리 화면도 이 함수를 쓴다) ──

/** 버튼의 단계별 시간 조건 글 (시간은 fastSeconds — 판정·게이지와 같은 값) */
export function buttonLines(button: SkillButton, timeMs: number): string[] {
  const sec = (def: SkillDef) => fastSeconds(def, timeMs);
  if (button.kind === 'main') {
    const [m1, ...rest] = button.chain;
    return [
      battleText.stageFirst(m1.name),
      ...rest.map((def) =>
        battleText.stageUpper(sec(def), def.slot === 5 ? 3 : 2, def.name, def.slot === 2 ? M2_EFFECT_OF_SPECIES[def.species] : undefined),
      ),
    ];
  }
  if (button.kind === 'sub') return battleText.subLines(sec(button.skill), button.skill.name, mainFirst(button).name);
  return battleText.specialLines(sec(button.skill), button.skill.special!);
}

/** 버튼 주인 종의 주속성 1번 (부속성 버튼이 느릴 때 나가는 기술) */
function mainFirst(button: SkillButton): SkillDef {
  return button.kind === 'main' ? button.chain[0] : skillDef(`${button.owner}-1`);
}

/** 버튼 위력 별: 주속성은 가진 단계의 범위("★★~★★★"), 나머지는 그 기술 (부속성 자리는 앉힌 위력) */
export function buttonPower(button: SkillButton): string {
  if (button.kind !== 'main') return battleText.power(button.skill.basePower);
  const powers = button.chain.map((d) => d.basePower);
  return battleText.powerRange(Math.min(...powers), Math.max(...powers));
}

/** 문제가 뜰 때 글 ("○○ 준비! …") */
export function readyText(button: SkillButton, timeMs: number): string {
  if (button.kind === 'main') return battleText.readyMain(button.chain[0].name, button.chain.length > 1);
  if (button.kind === 'sub') return battleText.readySub(button.skill.name, fastSeconds(button.skill, timeMs));
  return battleText.ready(button.skill.name, fastSeconds(button.skill, timeMs), button.skill.special);
}

/** 문제 아래 "지금 쓰는 기술" 한 줄 */
export function nowText(button: SkillButton, timeMs: number): string {
  if (button.kind === 'main') {
    const [m1, ...rest] = button.chain;
    return [m1.name, ...rest.map((d) => battleText.nowStage(fastSeconds(d, timeMs), d.slot === 5 ? 3 : 2))].join(' · ');
  }
  if (button.kind === 'sub') return `${button.skill.name} · ${battleText.nowSub(fastSeconds(button.skill, timeMs))}`;
  return `${button.skill.name} · ${battleText.condition(fastSeconds(button.skill, timeMs), button.skill.special)}`;
}

/**
 * 문제 시계가 흐르는가: 문제가 떠 있고, 시작 글·도망 확인창·끝·디버그 멈춤·캡슐 연출(빠져나옴·화남 결과를 보여 주는 동안)이 아닐 때만
 */
export function clockRuns(s: {
  intro: boolean;
  confirmQuit: boolean;
  ending: boolean;
  phase: WildPhase;
  noTimer: boolean;
  throwing: boolean;
}): boolean {
  return !s.intro && !s.confirmQuit && !s.ending && s.phase === 'question' && !s.noTimer && !s.throwing;
}
