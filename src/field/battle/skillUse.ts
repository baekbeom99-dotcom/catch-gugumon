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
  seatOf,
  seatedDef,
  skillDef,
  type SkillButton,
  type SkillDef,
  type SkillId,
} from '../../domain/field/skills';
import { questionBaseMs, resolveAnswer, type AnswerResult, type StrikeRoll, type WildPhase, type WildState } from '../../domain/field/wildBattle';
import { battleText } from './battleText';
import type { Rng } from '../../domain/random';
import { SKILL_SFX, SPECIAL_SFX, type Sfx } from '../../audio/sfx';
import { fxTravelMs, type FxName } from '../fx/effects';
import type { CombatForce } from '../debugFlags';

/** 저장된 가진 기술(없거나 비었으면 그 레벨의 기본 기술)을 기술 표로. 전투를 시작할 때 한 번 정해 두고 바꾸지 않는다 */
export function heldSkills(species: SpeciesId, entry: { level: number; skills?: readonly SkillId[] } | undefined): SkillDef[] {
  const ids = entry?.skills?.length ? entry.skills : defaultSkills(species, entry?.level ?? 1);
  return ids.map(skillDef);
}

/**
 * 정답 하나를 기술 버튼으로 판정한다. 단계 기준 시간은 **그 단계 문제 시간(TIER_RULES[tier].timeMs, 저학년은 2배)만** 넘긴다 —
 * 여유(calm)로 늘어난 남은 시간을 넘기면 조건이 느슨해지므로 넣지 않는다.
 * fast(E2E 스위치 __GUGU_E2E_FAST__): true면 늘 가장 빠르게, false면 늘 늦게, null이면 실제로 흐른 시간.
 * rng는 회피·크리티컬·효과 성공 굴림 (화면은 combatRng로 E2E 스위치를 얹어 넘긴다).
 */
export function answerWithSkill(
  s: WildState,
  button: SkillButton,
  held: readonly SkillId[],
  wildMain: Element,
  fast: boolean | null,
  rng: Rng,
): AnswerResult {
  const timeMs = questionBaseMs(s);
  if (fast === null) return resolveAnswer(s, button, held, wildMain, timeMs, rng);
  // 판정할 때만 경과 시간을 바꿔 넣고, 돌려줄 상태에는 원래 값을 둔다
  const forced: WildState = { ...s, elapsedMs: fast ? 0 : timeMs + 1 };
  const r = resolveAnswer(forced, button, held, wildMain, timeMs, rng);
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
 * 전투 굴림을 E2E 스위치(__GUGU_E2E_COMBAT__)로 고정하는 난수. 공격 한 번마다 새로 만든다.
 * 도메인이 굴리는 순서(회피 → 크리티컬 → 효과 성공, 적 공격은 회피 → 크리티컬)대로 n번째 값을 정한다:
 * true는 늘 일어나는 값(0), false는 안 일어나는 값(0.9999), null이면 base 난수.
 */
export function combatRng(force: CombatForce, base: Rng): Rng {
  const order = [force.dodge, force.crit, force.effect];
  let n = 0;
  return () => {
    const f = order[n++] ?? null;
    return f === true ? 0 : f === false ? 0.9999 : base();
  };
}

/**
 * 정답 글: (크리티컬이면 "크리티컬!" 한 줄) + 나간 기술 한 줄(윗단계면 "⚡ 빠르다!") + 주②의 효과 한 줄(실패면 "효과가 실패했어요…") + 상성 한 줄(보통이면 없음).
 * 빗나가면 "○○! 빗나갔어요!" 한 줄만. healed는 회복(특수 버튼·주②)으로 실제로 늘어난 체력 (가득이었으면 0).
 */
export function hitMessage(r: AnswerResult, wildMain: Element, healed: number, _from: SkillButton['kind'] = 'main'): string {
  const name = r.fired.name;
  if (r.dodged) return battleText.dodgedHit(name);
  const lines: string[] = [];
  if (r.crit) lines.push(battleText.crit);
  if (r.usedFallback) lines.push(battleText.fallback(name));
  else if (specialFired(r)) lines.push(r.special === 'heal' ? battleText.healSkill(name, healed) : battleText.special(name, r.special!));
  else if (r.upper) lines.push(battleText.upper(name));
  else lines.push(battleText.hit(name));
  const effect = stageEffect(r);
  if (effect) lines.push(battleText.stageEffect(effect, healed));
  // 효과(특수 버튼·주②)가 확률에 져서 실패했으면 한 줄만 (그림·소리 없음)
  if (r.effect && !r.effect.ok) lines.push(battleText.effectFailed);
  // 특수 기술(속성 없음)은 상성이 없다
  const m = skillMatchup(r.fired, wildMain);
  if (m) lines.push(battleText.matchup(m));
  return lines.join('\n');
}

/**
 * 적 공격 글 (오답·시간 초과·주기 공격): 기절해서 못 움직임 / "○○의 △△! 빗나갔어요!" / 크리티컬이면 둘째 줄 "크리티컬!" / 보통 "○○의 △△!"
 */
export function strikeMessage(foeName: string, move: string, roll: StrikeRoll): string {
  if (roll.blocked) return battleText.stunBlocked(foeName);
  if (roll.dodged) return `${battleText.foeAttack(foeName, move)} ${battleText.dodge}`;
  if (roll.crit) return `${battleText.foeAttack(foeName, move)}\n${battleText.crit}`;
  return battleText.foeAttack(foeName, move);
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

/** 시간 막대 구간: 왼쪽 끝부터 from~to(0~1) 비율, 그 구간에서 풀면 나가는 단계 */
export interface GaugeZone {
  from: number;
  to: number;
  tier: 1 | 2 | 3;
}

/**
 * 시간 막대를 단계 구간으로 나눈다 (기점이 없으면 구간도 없다). 왼쪽 끝부터 ① … 가장 빠른 구간.
 * 구간의 단계는 "그 구간에서 tierAt이 주는 값" — 왼쪽에서부터 단계의 최댓값을 이어 가므로 기점이 같은 자리에 겹쳐도 틀리지 않는다
 */
export function gaugeZones(stops: readonly GaugeStop[], limitMs: number): GaugeZone[] {
  if (stops.length === 0) return [];
  const marks = stops.map((st) => ({ pos: stopPosition(st.atMs, limitMs), tier: st.tier })).sort((a, b) => a.pos - b.pos || a.tier - b.tier);
  const zones: GaugeZone[] = [];
  let tier: 1 | 2 | 3 = 1;
  let from = 0;
  for (const m of marks) {
    zones.push({ from, to: m.pos, tier });
    if (m.tier > tier) tier = m.tier;
    from = m.pos;
  }
  zones.push({ from, to: 1, tier });
  return zones;
}

/** 기점의 자리: 게이지(왼쪽부터 남은 시간만큼 차 있음)의 왼쪽 끝에서 비율 0~1 */
export function stopPosition(atMs: number, limitMs: number): number {
  if (!(limitMs > 0)) return 0;
  return Math.min(1, Math.max(0, (limitMs - atMs) / limitMs));
}

// ── 고르기 버튼·준비 글 (Task 13의 기술 관리 화면도 이 함수를 쓴다) ──

/**
 * 기술 하나의 단계별 시간 조건 글 (owner 구구몬의 자리로 본다 — 부속성 자리에 앉은 다른 종 기술은 부속성 값).
 * 고르기 버튼(buttonLines)과 기술 선택창·관리 화면 카드가 같은 함수를 쓴다. 시간은 fastSeconds — 판정·게이지와 같은 값
 */
export function skillLines(def: SkillDef, owner: SpeciesId, timeMs: number): string[] {
  const seat = seatOf(def, owner);
  const seated = seatedDef(def, owner);
  const sec = fastSeconds(seated, timeMs);
  if (seat === 'main') {
    if (def.slot === 1) return [battleText.stageFirst(def.name)];
    return [battleText.stageUpper(sec, def.slot === 5 ? 3 : 2, def.name, def.slot === 2 ? M2_EFFECT_OF_SPECIES[def.species] : undefined)];
  }
  if (seat === 'sub') return battleText.subLines(sec, def.name, skillDef(`${owner}-1`).name);
  return battleText.specialLines(sec, def.special!);
}

/** 버튼의 단계별 시간 조건 글 */
export function buttonLines(button: SkillButton, timeMs: number): string[] {
  if (button.kind === 'main') {
    const [m1, ...rest] = button.chain;
    return [battleText.stageFirst(m1.name), ...rest.flatMap((def) => skillLines(def, button.owner, timeMs))];
  }
  return skillLines(button.skill, button.owner, timeMs);
}

/** 버튼 위력 별: 주속성은 가진 단계의 범위("★★~★★★"), 나머지는 그 기술 (부속성 자리는 앉힌 위력) */
export function buttonPower(button: SkillButton): string {
  if (button.kind !== 'main') return battleText.power(button.skill.basePower);
  const powers = button.chain.map((d) => d.basePower);
  return battleText.powerRange(Math.min(...powers), Math.max(...powers));
}

/** 전투 화면 버튼에 보이는 짧은 이름: 주속성은 가진 단계와 무관하게 1번 기술, 부속성·특수는 그 기술 (이름 길이는 7글자 이하 — 테스트) */
export function buttonShortName(button: SkillButton): string {
  return button.kind === 'main' ? button.chain[0].name : button.skill.name;
}

/** 특수 버튼에만 보이는 짧은 설명 한 줄 ("체력 회복" 등). 속성 버튼은 null */
export function buttonBrief(button: SkillButton): string | null {
  return button.kind === 'special' && button.skill.special ? battleText.specialBrief[button.skill.special] : null;
}

/** 화면에서는 숨기고 읽기 도구(aria-label·sr-only)에만 두는 글: 단계별 시간 조건 + 위력. 선택창·관리 화면은 skillLines를 그대로 쓴다 */
export function buttonHiddenText(button: SkillButton, timeMs: number): string {
  return [buttonShortName(button), ...buttonLines(button, timeMs), buttonPowerLabel(button)].join('. ');
}

/** 위력 별을 읽어 주는 글 ("위력 2~3") — 별 모양은 화면 읽기 도구가 못 읽으므로 aria-label에 */
export function buttonPowerLabel(button: SkillButton): string {
  if (button.kind !== 'main') return `위력 ${button.skill.basePower}`;
  const powers = button.chain.map((d) => d.basePower);
  const lo = Math.min(...powers);
  const hi = Math.max(...powers);
  return lo === hi ? `위력 ${lo}` : `위력 ${lo}~${hi}`;
}

/**
 * 문제가 뜰 때 글: 간결하게 "○○ 준비!" (몇 초 안인지는 시간 막대의 눈금·색이 보여 준다).
 * 특수 버튼만 "빨리 풀면 회복!"처럼 효과 한 낱말을 붙인다 (개정 4 간결화)
 */
export function readyText(button: SkillButton): string {
  if (button.kind === 'special') return battleText.ready(button.skill.name, button.skill.special);
  return battleText.ready(buttonShortName(button));
}

/** 문제 아래 "지금 쓰는 기술" 한 줄: 기술 이름만 (특수는 "· 빨리 풀면 회복"). 자세한 시간 조건은 nowDetail(숨김 글) */
export function nowText(button: SkillButton): string {
  if (button.kind === 'special' && button.skill.special) return `${button.skill.name} · ${battleText.quickFor(button.skill.special)}`;
  return buttonShortName(button);
}

/** 화면 읽기 도구용 "지금 쓰는 기술" 자세한 글 (단계별 몇 초 안) — 화면에는 숨긴다 */
export function nowDetail(button: SkillButton, timeMs: number): string {
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

/** 기술 효과 한 번의 길: 어디서 어디로 날아가고, 맞는 순간(효과음·피해 글·흔들림)이 언제인가 */
export interface MoveFxRoute {
  name: FxName;
  /** 효과 중심을 놓을 자리 (맞는 구구몬, 특수 기술은 쓴 구구몬) */
  at: { x: number; y: number };
  /** 날아가는 효과면 쏘는 구구몬의 자리, 아니면 null */
  from: { x: number; y: number } | null;
  /** 효과를 튼 뒤 맞는 순간까지 (ms) — 날아가는 시간. 날아가지 않으면 0 */
  arriveMs: number;
  /** 특수 기술: 쓴 구구몬 자신 위에서 */
  onSelf: boolean;
}

/**
 * 기술 효과의 길. 내 공격은 내 구구몬 → 야생, 적 공격은 야생 → 내 구구몬. 특수 기술은 쓴 구구몬 위에서 날아가지 않는다.
 * 동작 줄이기(reduced)면 이동 없이 맞는 자리에서 바로. 맞는 쪽 자리를 못 구하면 null, 쏘는 쪽만 못 구하면 날아가지 않는다.
 */
export function moveFxRoute(
  attacker: 'ally' | 'foe',
  def: SkillDef,
  points: { ally: { x: number; y: number } | null; foe: { x: number; y: number } | null },
  reduced = false,
): MoveFxRoute | null {
  const name = skillFxName(def);
  const onSelf = !!def.special;
  const shooter = attacker === 'ally' ? points.ally : points.foe;
  const target = onSelf ? shooter : attacker === 'ally' ? points.foe : points.ally;
  if (!target) return null;
  const ms = onSelf || reduced || !shooter ? 0 : fxTravelMs(name);
  return { name, at: target, from: ms > 0 ? shooter : null, arriveMs: ms, onSelf };
}
