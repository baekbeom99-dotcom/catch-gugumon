import { describe, expect, it } from 'vitest';
import {
  answerWild, canThrow, catchActive, chipCells, counterAttack, counterDue, createWild, damageOf, enemyStrike, healAlly, hiddenChoice, MAX_TICK_MS, maxCells,
  pickSkill, releaseWild, resolveAnswer, resumeWild, throwCapsule, tick, tickWild, wildHpRatio,
  type WildState,
} from '../../src/domain/field/wildBattle';
import type { Rng } from '../../src/domain/random';
import { skillButtons, skillDef, type SkillButton } from '../../src/domain/field/skills';
import type { SpeciesId } from '../../src/domain/field/creatures';
import type { Element } from '../../src/domain/field/elements';
import { CALM_BONUS_MS, CHARGE_BONUS_CELLS, SPECIAL_SUCCESS, TIER_RULES } from '../../src/domain/field/tuning';
import { throwOdds } from '../../src/domain/field/strength';

const r0 = () => 0;
/** 빗나가지도 크리티컬도 아니고 효과는 다 성공하는 난수 (0.05 이상, 0.1 이상, 0.5 아래) */
const ok: Rng = () => 0.3;
/** 정해 둔 난수를 차례로 내놓는다 (다 쓰고 또 부르면 실패) */
const seq = (...values: number[]): Rng => () => {
  if (values.length === 0) throw new Error('난수를 너무 많이 씀');
  return values.shift()!;
};
const dizzyOf = (s: WildState): WildState => ({ ...s, phase: 'dizzy', cells: maxCells(s.tier) });

describe('wildBattle: 문제 시간·정답', () => {
  it('MAX_TICK_MS는 250', () => expect(MAX_TICK_MS).toBe(250));
  it('보통: 7초, 정답 4개로 어지러움', () => {
    let s = createWild('normal', 5, 100);
    expect(s.timeLeftMs).toBe(7000);
    for (let i = 0; i < 3; i++) s = resumeWild(answerWild(s, true, ok));
    expect(s.phase).toBe('question');
    expect(answerWild(s, true, ok).phase).toBe('dizzy');
  });
  it.each([['weak', 3], ['normal', 4], ['strong', 4], ['mighty', 6], ['legend', 4]] as const)('%s 정답 %i개', (t, n) => {
    let s = createWild(t, 5, 100);
    for (let i = 0; i < n - 1; i++) {
      s = answerWild(s, true, ok);
      expect(s.phase).toBe('hit');
      s = resumeWild(s);
    }
    expect(s).toMatchObject({ phase: 'question', cells: 2 * (n - 1), correct: n - 1 });
    expect(answerWild(s, true, ok)).toMatchObject({ phase: 'dizzy', cells: 2 * n, correct: n });
  });
  it.each([['weak', 7000], ['strong', 5000], ['mighty', 5000], ['legend', 7000]] as const)('%s 시간 %i', (t, ms) =>
    expect(createWild(t, 1, 100).timeLeftMs).toBe(ms));
  it('처음 상태', () => {
    expect(createWild('strong', 8, 60)).toEqual({
      tier: 'strong', level: 8, cells: 0, timeLeftMs: 5000, limitMs: 5000, elapsedMs: 0, allyHp: 60, phase: 'question', correct: 0, timedOut: false,
      charge: 0, guard: false, stun: false, calmMs: 0, hideChoice: false, attackCount: 0, throwTries: 0, lastStrike: null,
    });
  });
  it('시작부터 체력 0이면 쓰러진 채(전투가 열리지 않게)', () => {
    const s = createWild('normal', 5, 0);
    expect(s.phase).toBe('fainted');
    expect(tick(s, 250, ok)).toBe(s);
    expect(answerWild(s, false, ok)).toBe(s);
  });
  it('시간은 question에서만, 한 번에 250ms까지', () => {
    const s = createWild('normal', 5, 100);
    expect(tick(s, 60000, ok).timeLeftMs).toBe(6750);
    expect(tick(s, NaN, ok).timeLeftMs).toBe(7000);
    for (const bad of [Infinity, -Infinity, -100]) expect(tick(s, bad, ok).timeLeftMs).toBe(7000);
    expect(tick(s, 100, ok).timeLeftMs).toBe(6900);
    for (const phase of ['pick', 'hit', 'counter', 'struck', 'hint', 'dizzy'] as const) expect(tick({ ...s, phase }, 100, ok)).toEqual({ ...s, phase });
  });
  it('시간이 다 되면 피격(timedOut), 체력 −13, 힌트로', () => {
    let s = createWild('normal', 5, 100);
    for (let i = 0; i < 27; i++) s = tick(s, 250, ok);
    expect(s).toMatchObject({ phase: 'question', timeLeftMs: 250 });
    s = tick(s, 250, ok);
    expect(s).toMatchObject({ phase: 'struck', timedOut: true, allyHp: 87, timeLeftMs: 0 });
    expect(resumeWild(s).phase).toBe('hint');
    expect(resumeWild(resumeWild(s))).toMatchObject({ phase: 'question', timeLeftMs: 7000 });
  });
  it('시간이 남아 있으면 난수를 쓰지 않는다', () => {
    expect(() => tick(createWild('normal', 5, 100), 250, seq())).not.toThrow();
  });
  it('정답 뒤 다음 문제는 시간이 처음부터', () => {
    const s = tick(tick(createWild('strong', 5, 100), 250, ok), 250, ok);
    expect(resumeWild(answerWild(s, true, ok)).timeLeftMs).toBe(5000);
  });
});

describe('wildBattle: 적의 공격', () => {
  it.each([['weak', 10], ['normal', 8], ['strong', 6], ['mighty', 4], ['legend', 6]] as const)('%s: 오답 %i번에 쓰러지고 힌트 없이 끝', (t, n) => {
    let s = createWild(t, 5, 100);
    for (let i = 0; i < n - 1; i++) {
      s = answerWild(s, false, ok);
      expect(s.phase).toBe('struck');
      s = resumeWild(resumeWild(s));
    }
    const last = answerWild(s, false, ok);
    expect(last).toMatchObject({ phase: 'fainted', allyHp: 0, timedOut: false });
    expect(resumeWild(last)).toBe(last);
  });
  it('시간 초과로 쓰러져도 힌트 없이 끝', () => {
    let s = createWild('mighty', 5, TIER_RULES.mighty.damage);
    for (let i = 0; i < 20; i++) s = tick(s, 250, ok);
    expect(s).toMatchObject({ phase: 'fainted', allyHp: 0, timedOut: true });
  });
  it('오답은 timedOut false, 맞힌 수는 그대로', () => {
    expect(answerWild(createWild('normal', 5, 100), false, ok)).toMatchObject({ phase: 'struck', timedOut: false, allyHp: 87, correct: 0, cells: 0 });
  });
  it('question이 아니면 answerWild는 그대로(연타)', () => {
    const a = answerWild(createWild('normal', 5, 100), true, ok);
    expect(answerWild(a, true, ok)).toBe(a);
    expect(answerWild(a, false, ok)).toBe(a);
    for (const phase of ['counter', 'struck', 'hint', 'dizzy', 'caught', 'escaped', 'released', 'fainted'] as const) {
      const s = { ...a, phase };
      expect(answerWild(s, true, ok)).toBe(s);
    }
  });
  it('적의 공격은 회피·크리티컬 두 번 굴린다 (적 기술 이름은 화면이 고른다). 스턴이면 굴리지 않는다', () => {
    expect(answerWild(createWild('normal', 5, 100), false, seq(0.5, 0.5)).phase).toBe('struck');
    expect(tick({ ...createWild('normal', 5, 100), timeLeftMs: 100 }, 250, seq(0.5, 0.5)).phase).toBe('struck');
    const stunned = { ...createWild('normal', 5, 100), stun: true };
    expect(answerWild(stunned, false, seq()).phase).toBe('struck');
    expect(tick({ ...stunned, timeLeftMs: 100 }, 250, seq()).phase).toBe('struck');
  });
  it('damageOf', () => {
    expect(damageOf(createWild('weak', 5, 100))).toBe(10);
    expect(damageOf(createWild('mighty', 5, 100))).toBe(25);
  });
});

describe('wildBattle: 던지기', () => {
  it.each([
    // 어지러움(남은 체력 0)에서는 잡힘 +0.1(낮은 체력 보너스): 잡힘 0.18, 빠져나옴 ~0.786, 도망 ~0.973
    [0.179, 'caught'], [0.181, 'healed'], [0.785, 'healed'], [0.787, 'escaped'], [0.972, 'escaped'], [0.974, 'angry'],
  ] as const)('보통 경계 %f → %s', (r, outcome) => {
    const d = dizzyOf(createWild('normal', 5, 100));
    expect(throwCapsule(d, seq(r, 0), 5)!.outcome).toBe(outcome);
  });
  it('() => 0은 잡힘, () => 0.999는 화남', () => {
    for (const t of ['weak', 'normal', 'strong', 'mighty', 'legend'] as const) {
      const d = dizzyOf(createWild(t, 5, 100));
      expect(throwCapsule(d, r0, 5)).toEqual({ state: { ...d, phase: 'caught' }, outcome: 'caught' });
      expect(throwCapsule(d, () => 0.999, 5)!.outcome).toBe('angry');
    }
  });
  it('도망은 escaped', () => {
    const d = dizzyOf(createWild('normal', 5, 100));
    expect(throwCapsule(d, seq(0.9), 5)!.state.phase).toBe('escaped');
  });
  it('화남: 보통→강력, 레벨은 강력 범위에서 다시, 체력 가득, 문제로', () => {
    const d = { ...createWild('normal', 5, 100), phase: 'dizzy' as const, cells: 8 };
    const rng = seq(0.999, 0);
    const r = throwCapsule(d, rng, 10)!;
    expect(r.outcome).toBe('angry');
    expect(r.state).toMatchObject({ tier: 'mighty', level: 16, cells: 0, phase: 'question', timeLeftMs: 5000 });
    expect(wildHpRatio(r.state)).toBe(1);
  });
  it('화남 레벨은 강력 범위의 위끝까지', () => {
    const d = dizzyOf(createWild('weak', 2, 100));
    expect(throwCapsule(d, seq(0.999, 0.999), 10)!.state).toMatchObject({ tier: 'mighty', level: 19 });
  });
  it('강력·황금의 화남은 단계 그대로, 체력만 회복', () => {
    for (const t of ['mighty', 'legend'] as const) {
      const d = { ...dizzyOf(createWild(t, 13, 100)), allyHp: 40, elapsedMs: 1234 };
      const r = throwCapsule(d, seq(0.999), 10)!; // 레벨을 다시 뽑지 않으니 난수는 한 번
      expect(r.outcome).toBe('angry');
      expect(r.state).toEqual({ ...d, cells: 0, elapsedMs: 0, phase: 'question', timeLeftMs: t === 'mighty' ? 5000 : 7000, throwTries: 1 });
    }
  });
  it('빠져나옴(healed): 어지러움이 풀리고 칸을 절반(올림) 되찾고, 문제 시간 처음부터. dizzy가 아니면 null', () => {
    const d = { ...dizzyOf(createWild('normal', 5, 100)), timeLeftMs: 1200, elapsedMs: 5800 };
    const r = throwCapsule(d, seq(0.5), 5)!; // 난수 한 번으로 결정 (R11)
    expect(r.outcome).toBe('healed');
    expect(r.state).toEqual({ ...d, cells: 4, phase: 'question', timeLeftMs: 7000, elapsedMs: 0, throwTries: 1 });
    // 체력이 1/4 이하여도 문제를 풀거나 고르는 때(pick·question)·어지러울 때만 던진다
    for (const phase of ['hit', 'counter', 'struck', 'hint', 'caught', 'escaped', 'released', 'fainted'] as const) {
      expect(throwCapsule({ ...d, phase }, r0, 5)).toBeNull();
    }
  });
  it.each([['weak', 6, 3], ['normal', 8, 4], ['strong', 8, 4], ['mighty', 12, 6], ['legend', 8, 4]] as const)(
    'healed %s: 최대 %i칸에서 %i칸 되찾음', (t, max, heal) => {
      const d = dizzyOf(createWild(t, 5, 100));
      expect(d.cells).toBe(max);
      const r = throwCapsule(d, seq(0.5), 5)!;
      expect(r.outcome).toBe('healed');
      expect(r.state.cells).toBe(max - heal);
      expect(r.state.phase).toBe('question');
      expect(wildHpRatio(r.state)).toBeCloseTo(heal / max);
    });
  it('healed: 기술이 2개 이상이면 고르기(pick)로', () => {
    const d = dizzyOf(createWild('normal', 5, 100));
    expect(throwCapsule(d, seq(0.5), 5, 2)!.state.phase).toBe('pick');
    expect(throwCapsule(d, seq(0.5), 5, 1)!.state.phase).toBe('question');
  });
  it('화남: 기술이 2개 이상이면 고르기(pick)로', () => {
    const d = dizzyOf(createWild('normal', 5, 100));
    expect(throwCapsule(d, seq(0.999, 0), 10, 2)!.state.phase).toBe('pick');
    expect(throwCapsule(d, seq(0.999, 0), 10, 1)!.state.phase).toBe('question');
  });
  it('healed: 여유(calmMs)가 있으면 다시 싸우는 문제 시간에 더하고 0', () => {
    const d = { ...dizzyOf(createWild('normal', 5, 100)), calmMs: CALM_BONUS_MS };
    const r = throwCapsule(d, seq(0.5), 5)!;
    expect(r.outcome).toBe('healed');
    expect(r.state).toMatchObject({ timeLeftMs: 7000 + CALM_BONUS_MS, calmMs: 0 });
  });
  it('healed: 깎인 칸이 절반보다 적으면 0까지만', () => {
    const d = { ...dizzyOf(createWild('normal', 5, 100)), cells: 2 };
    expect(throwCapsule(d, seq(0.5), 5)!.state.cells).toBe(0);
  });
  it('releaseWild: dizzy→released', () => {
    const d = dizzyOf(createWild('normal', 5, 100));
    expect(releaseWild(d)).toEqual({ ...d, phase: 'released' });
    const q = createWild('normal', 5, 100);
    expect(releaseWild(q)).toBe(q);
  });
  it('wildHpRatio', () => {
    expect(wildHpRatio({ ...createWild('mighty', 5, 100), cells: 6 })).toBe(0.5);
    expect(wildHpRatio(createWild('normal', 5, 100))).toBe(1);
    expect(wildHpRatio({ ...createWild('weak', 5, 100), cells: 9 })).toBe(0);
  });
  it('끝난 상태에서는 모든 함수가 그대로', () => {
    for (const phase of ['caught', 'escaped', 'released', 'fainted'] as const) {
      const s = { ...createWild('normal', 5, 100), phase };
      expect(tick(s, 250, ok)).toBe(s);
      expect(answerWild(s, true, ok)).toBe(s);
      expect(resumeWild(s)).toBe(s);
      expect(releaseWild(s)).toBe(s);
      expect(throwCapsule(s, r0, 5)).toBeNull();
    }
  });
});

// ── 필드 모험 3차: 칸 체력·위력·단계 발동·특수·상성 (설계서 0-1절이 2-6절보다 우선) ──
const k = (id: string) => skillDef(id);
/** 기술 id의 종 (예: 'c047-3' → 'c047') */
const ownerOf = (id: string) => id.replace(/-\d$/, '') as SpeciesId;
/** 가진 기술로 만든 버튼 중 kind 버튼 (주인은 첫 기술의 종) */
const btn = (held: string[], kind: SkillButton['kind'] = 'main'): SkillButton => {
  const b = skillButtons(held, ownerOf(held[0])).find((x) => x.kind === kind);
  if (!b) throw new Error(`버튼 없음: ${kind}`);
  return b;
};
/** 보통 단계 문제 하나: 경과 시간만 정해 둔다 */
const at = (elapsedMs: number, over: Partial<WildState> = {}): WildState => ({ ...createWild('normal', 5, 100), elapsedMs, ...over });
const NORMAL_MS = 7000;
/** 가진 기술 held로 kind 버튼을 눌러 정답 */
const answer = (s: WildState, held: string[], kind: SkillButton['kind'], wild: Element, timeMs = NORMAL_MS, rng: Rng = ok) =>
  resolveAnswer(s, btn(held, kind), held, wild, timeMs, rng);

describe('wildBattle: 칸 체력과 깎는 칸', () => {
  it('maxCells = 어지러워지는 정답 수 × 2', () => {
    expect((['weak', 'normal', 'strong', 'mighty', 'legend'] as const).map(maxCells)).toEqual([6, 8, 8, 12, 8]);
  });
  it('chipCells = 위력 + 충전 + 상성, 1 아래로도 4 위로도 안 간다 (빠르면 +1칸은 없어짐)', () => {
    expect(chipCells(1, -1, 0)).toBe(1);
    expect(chipCells(2, -1, 0)).toBe(1);
    expect(chipCells(2, 0, 0)).toBe(2);
    expect(chipCells(2, 0, 1)).toBe(3); // 충전 +1
    expect(chipCells(3, 0, 0)).toBe(3);
    expect(chipCells(3, 1, 1)).toBe(4); // 5 → 4
    expect(chipCells(4, 1, 0)).toBe(4); // 5 → 4
    expect(chipCells(4, 1, 1)).toBe(4);
    expect(chipCells(4, -1, 0)).toBe(3);
  });
  it.each(['weak', 'normal', 'strong', 'mighty', 'legend'] as const)('%s: 가장 센 한 방(주③ 3 + 충전 + 상성 → 4칸)으로도 한 번에 안 끝난다', (t) => {
    const s = { ...createWild(t, 5, 100), charge: 1 };
    const held = ['c023-1', 'c023-2', 'c023-5'];
    const r = resolveAnswer(s, btn(held), held, 'water', TIER_RULES[t].timeMs, ok);
    expect(r).toMatchObject({ upper: true, tier: 3, fired: { id: 'c023-5' } });
    expect(r.state).toMatchObject({ cells: 4, phase: 'hit' });
  });
  it('어지러워지면 칸은 최대에서 멈춘다', () => {
    const held = ['c023-1', 'c023-2', 'c023-5'];
    const r = answer(at(0, { cells: 7 }), held, 'main', 'water');
    expect(r.state).toMatchObject({ cells: 8, phase: 'dizzy', correct: 1 });
  });
  it('answerWild(옛 호출)은 위력 2·보통, 충전은 더한다', () => {
    expect(answerWild(at(0), true, ok).cells).toBe(2);
    expect(answerWild(at(0, { charge: 1 }), true, ok)).toMatchObject({ cells: 3, charge: 0 });
  });
});

describe('wildBattle: resolveAnswer — 주속성 단계·부속성·상성', () => {
  it('주속성 버튼: 주② 조건(4초) 이내면 주②(2칸 + 스턴), 1ms 넘으면 주①(2칸)', () => {
    const held = ['c023-1', 'c023-2'];
    const fast = answer(at(4000), held, 'main', 'light');
    expect(fast).toMatchObject({ upper: true, tier: 2, usedFallback: false, fired: { id: 'c023-2' }, special: 'stun' });
    expect(fast.state).toMatchObject({ cells: 2, correct: 1, phase: 'hit', stun: true });
    const slow = answer(at(4001), held, 'main', 'light');
    expect(slow).toMatchObject({ upper: false, tier: 1, fired: { id: 'c023-1' } });
    expect(slow.special).toBeUndefined();
    expect(slow.state).toMatchObject({ cells: 2, stun: false });
  });
  it('주① 하나뿐이면 빨라도 2칸 (빠르면 +1칸 없음)', () => {
    const r = answer(at(0), ['c023-1'], 'main', 'light');
    expect(r).toMatchObject({ upper: false, tier: 1 });
    expect(r.state.cells).toBe(2);
  });
  it('주③: 2초 이내면 3칸 (효과 없음), 넘으면 주② 2칸', () => {
    const held = ['c023-1', 'c023-2', 'c023-5'];
    const m3 = answer(at(2000), held, 'main', 'light');
    expect(m3.state).toMatchObject({ cells: 3, stun: false });
    expect(m3.special).toBeUndefined();
    expect(answer(at(2001), held, 'main', 'light').state.cells).toBe(2);
  });
  it('주②는 속성 기술이라 상성을 보고 충전을 쓴다, 효과도 함께', () => {
    // 새싹 휙(풀) → 물 +1, 충전 +1 → 2 + 1 + 1 = 4
    const r = answer(at(0, { charge: 1 }), ['c023-1', 'c023-2'], 'main', 'water');
    expect(r.state).toMatchObject({ cells: 4, charge: 0, stun: true });
  });
  it('주② 효과: 회복은 special만 알려 주고 체력은 그대로, 방어는 guard', () => {
    const heal = answer(at(0, { allyHp: 40 }), ['c002-1', 'c002-2'], 'main', 'light');
    expect(heal).toMatchObject({ special: 'heal', fired: { id: 'c002-2' }, state: { allyHp: 40, cells: 2 } });
    const guard = answer(at(0), ['c003-1', 'c003-2'], 'main', 'water');
    expect(guard).toMatchObject({ special: 'guard', state: { guard: true } });
  });
  it('부속성 버튼: 빠르면 부속성(3칸), 느리면 주①(2칸)', () => {
    const held = ['c022-1', 'c022-2', 'c022-4'];
    expect(answer(at(4000), held, 'sub', 'water')).toMatchObject({ fired: { id: 'c022-4' }, upper: true, state: { cells: 3 } }); // 빛 → 물 보통
    expect(answer(at(4001), held, 'sub', 'water')).toMatchObject({ fired: { id: 'c022-1' }, upper: false, state: { cells: 3 } }); // 풀 → 물 +1
  });
  it('부속성 자리의 복사 기술은 원래 속성으로 상성, 위력은 3', () => {
    // c031-5(물) → 불: +1 → 3 + 1 = 4
    const r = answer(at(0), ['c023-1', 'c031-5'], 'sub', 'fire');
    expect(r).toMatchObject({ fired: { id: 'c031-5', basePower: 3 }, upper: true });
    expect(r.state.cells).toBe(4);
  });
  it('상성: 강하면 +1칸, 약하면 −1칸', () => {
    expect(answer(at(6000), ['c023-1'], 'main', 'water').state.cells).toBe(3); // 풀 → 물
    expect(answer(at(6000), ['c023-1'], 'main', 'fire').state.cells).toBe(1); // 풀 → 불
    expect(answer(at(0), ['c022-1', 'c022-4'], 'sub', 'poison').state.cells).toBe(3); // 빛 ↔ 독 보통
  });
  it('충전은 나간 속성 기술에 더하고 0이 된다 (윗단계여도)', () => {
    const r = answer(at(0, { charge: 1 }), ['c022-1', 'c022-4'], 'sub', 'light');
    expect(r.state).toMatchObject({ cells: 4, charge: 0 });
  });
  it('tickWild는 경과 시간을 센다, 여유로 늘어난 시간은 단계 판정에 안 들어간다', () => {
    const held = ['c023-1', 'c023-2'];
    let s = resumeWild({ ...at(0), phase: 'hit', calmMs: CALM_BONUS_MS });
    expect(s).toMatchObject({ phase: 'question', timeLeftMs: 10000, elapsedMs: 0, calmMs: 0 });
    for (let i = 0; i < 16; i++) s = tickWild(s, 250, ok);
    expect(s).toMatchObject({ elapsedMs: 4000, timeLeftMs: 6000 });
    expect(answer(s, held, 'main', 'light').upper).toBe(true);
    s = tickWild(s, 1, ok);
    expect(answer(s, held, 'main', 'light').upper).toBe(false);
  });
  it('question이 아니면 상태 그대로(연타)', () => {
    for (const phase of ['pick', 'hit', 'struck', 'hint', 'dizzy', 'caught', 'escaped', 'released', 'fainted'] as const) {
      const s = at(0, { phase });
      const r = answer(s, ['c023-1', 'c023-2'], 'main', 'light');
      expect(r.state).toBe(s);
      expect(r).toMatchObject({ upper: false, usedFallback: false, fired: { id: 'c023-1' } });
    }
  });
});

describe('wildBattle: resolveAnswer — 특수 기술', () => {
  it('조건 안에 풀면 위력 2칸 + 특수 (상성 없음)', () => {
    // 특수: 7초 × 0.5 = 3.5 → 4초
    const r = answer(at(4000), ['c022-1', 'c022-3'], 'special', 'water');
    expect(r).toMatchObject({ upper: false, usedFallback: false, special: 'heal' });
    expect(r.fired.id).toBe('c022-3');
    expect(r.state.cells).toBe(2);
  });
  it('시간을 넘기면 가장 약한 속성 기술이 대신 (그 기술 위력·상성)', () => {
    const r = answer(at(4001), ['c022-5', 'c022-1', 'c022-3'], 'special', 'water');
    expect(r).toMatchObject({ upper: false, usedFallback: true });
    expect(r.special).toBeUndefined();
    expect(r.fired.id).toBe('c022-1');
    expect(r.state.cells).toBe(3); // 2 + 풀→물 1
  });
  it('대신 나가는 기술: 위력이 가장 낮은 것 (보통 주①), 같으면 슬롯 번호가 작은 것', () => {
    expect(answer(at(6000), ['c022-2', 'c022-4', 'c022-1', 'c022-3'], 'special', 'light').fired.id).toBe('c022-1');
    // 복사한 다른 종 1번(부속성 자리 위력 3)보다 내 주①(2)
    expect(answer(at(6000), ['c022-1', 'c022-3', 'c031-1'], 'special', 'light').fired.id).toBe('c022-1');
  });
  it('늦어서 약한 기술이 대신 나가면 충전을 쓰고 0이 된다', () => {
    const r = answer(at(6000, { charge: 1 }), ['c022-1', 'c022-3'], 'special', 'light');
    expect(r).toMatchObject({ usedFallback: true });
    expect(r.fired.id).toBe('c022-1');
    expect(r.state).toMatchObject({ cells: 3, charge: 0 }); // 2 + 충전 1, 풀→빛 보통
  });
  it('특수가 성공해도 이미 있던 방어·여유는 그대로', () => {
    const r = answer(at(1000, { guard: true, calmMs: CALM_BONUS_MS }), ['c005-1', 'c005-3'], 'special', 'light');
    expect(r.special).toBe('charge');
    expect(r.state).toMatchObject({ guard: true, calmMs: CALM_BONUS_MS, charge: CHARGE_BONUS_CELLS });
  });
  it('healAlly: 내 구구몬 체력을 더하되 가득(100)을 넘지 않는다', () => {
    expect(healAlly(at(0, { allyHp: 50 }), 25).allyHp).toBe(75);
    expect(healAlly(at(0, { allyHp: 90 }), 25).allyHp).toBe(100);
    const full = at(0);
    expect(healAlly(full, 25)).toBe(full); // 이미 가득이면 그대로
  });
  it('(깨진 목록 대비) 특수만 가졌으면 늦을 때 위력 1 기본 타격', () => {
    const b: SkillButton = { kind: 'special', owner: 'c022', skill: k('c022-3') };
    const r = resolveAnswer(at(6000), b, ['c022-3'], 'water', NORMAL_MS, ok);
    expect(r).toMatchObject({ upper: false, usedFallback: true });
    expect(r.fired.id).toBe('c022-3');
    expect(r.special).toBeUndefined();
    expect(r.state.cells).toBe(1);
  });
  it('충전: 다음 속성 기술 +1칸 뒤 사라짐 (특수 성공에는 안 쓰고 남김)', () => {
    const held = ['c005-1', 'c005-3'];
    let s = answer(at(1000), held, 'special', 'light').state;
    expect(s).toMatchObject({ charge: CHARGE_BONUS_CELLS, cells: 2 });
    s = resumeWild(s);
    s = answer({ ...s, elapsedMs: 6000 }, held, 'main', 'fire').state;
    expect(s).toMatchObject({ charge: 0, cells: 5 }); // 2 + 2 + 충전 1
    const g = answer(at(1000, { charge: 1 }), ['c002-1', 'c002-3'], 'special', 'light').state;
    expect(g).toMatchObject({ charge: 1, cells: 2 });
  });
  it('방어: 다음 적 공격 절반(올림) 뒤 사라짐', () => {
    const s = answer(at(1000), ['c002-1', 'c002-3'], 'special', 'light').state;
    expect(s.guard).toBe(true);
    const q = resumeWild(s);
    expect(damageOf(q)).toBe(7); // 13 → 6.5 → 7
    const hit1 = answerWild(q, false, ok);
    expect(hit1).toMatchObject({ allyHp: 93, guard: false, phase: 'struck' });
    expect(answerWild(resumeWild(resumeWild(hit1)), false, ok).allyHp).toBe(80);
    expect(damageOf({ ...createWild('strong', 5, 100), guard: true })).toBe(9);
  });
  it('방어는 시간 초과 공격에도', () => {
    let s: WildState = { ...createWild('normal', 5, 100), guard: true, timeLeftMs: 250 };
    s = tick(s, 250, ok);
    expect(s).toMatchObject({ phase: 'struck', allyHp: 93, guard: false, timedOut: true });
  });
  it('여유: 다음 문제 시간 +3초, 고르기를 거쳐도', () => {
    const s = answer(at(1000), ['c004-1', 'c004-3'], 'special', 'light').state;
    expect(s.calmMs).toBe(CALM_BONUS_MS);
    const p = resumeWild(s, 2);
    expect(p).toMatchObject({ phase: 'pick', timeLeftMs: 10000, calmMs: 0 });
    expect(pickSkill(p)).toMatchObject({ phase: 'question', timeLeftMs: 10000, elapsedMs: 0 });
  });
  it('힌트: 다음 문제에서 틀린 보기 하나를 숨긴다', () => {
    const s = answer(at(1000), ['c003-1', 'c003-3'], 'special', 'light').state;
    expect(s.hideChoice).toBe(true);
    const q = resumeWild(s);
    expect(q.hideChoice).toBe(true);
    // 틀려서 힌트를 보고 다음 문제로 넘어가도 숨긴 채 (맞힐 때까지)
    expect(resumeWild(resumeWild(answerWild(q, false, ok))).hideChoice).toBe(true);
    // 그 문제를 맞히면 사라짐
    expect(answer(at(6000, { hideChoice: true }), ['c003-1'], 'main', 'light').state.hideChoice).toBe(false);
    expect(hiddenChoice([3, 6, 9], 6, r0)).toBe(0);
    expect(hiddenChoice([3, 6, 9], 6, () => 0.99)).toBe(2);
    expect(hiddenChoice([6, 3, 9], 6, r0)).toBe(1);
    expect(hiddenChoice([6], 6, r0)).toBeNull();
  });
  it('회복: special만 알려 주고 내 체력은 그대로', () => {
    const r = answer(at(1000, { allyHp: 40 }), ['c022-1', 'c022-3'], 'special', 'light');
    expect(r.special).toBe('heal');
    expect(r.state.allyHp).toBe(40);
  });
  it('복사한 특수: 그 특수 종류로 발동', () => {
    const r = answer(at(1000), ['c023-1', 'c004-3'], 'special', 'light');
    expect(r).toMatchObject({ special: 'calm', fired: { id: 'c004-3' }, state: { calmMs: CALM_BONUS_MS, cells: 2 } });
  });
});

describe('wildBattle: 스턴 (다음 적 공격 1회 무효)', () => {
  const stunned = () => answer(at(0), ['c023-1', 'c023-2'], 'main', 'light').state;
  it('오답이면 피해 0, 스턴은 쓰고 방어는 남는다', () => {
    const q = { ...resumeWild(stunned()), guard: true };
    expect(q.stun).toBe(true);
    const hit = answerWild(q, false, ok);
    expect(hit).toMatchObject({ phase: 'struck', allyHp: 100, stun: false, guard: true, lastStrike: { blocked: true, damage: 0 } });
    // 그 다음 공격은 방어로 절반
    expect(answerWild(resumeWild(resumeWild(hit)), false, ok)).toMatchObject({ allyHp: 93, guard: false });
  });
  it('시간 초과 공격도 막는다', () => {
    const q = { ...resumeWild(stunned()), timeLeftMs: 250 };
    expect(tick(q, 250, ok)).toMatchObject({ phase: 'struck', allyHp: 100, stun: false, timedOut: true });
  });
  it('체력이 거의 없어도 스턴이면 쓰러지지 않는다', () => {
    const q = { ...resumeWild(stunned()), allyHp: 5 };
    expect(answerWild(q, false, ok)).toMatchObject({ phase: 'struck', allyHp: 5 });
  });
  it('맞히는 동안·빠져나옴·화남 뒤에도 남는다 (방어·충전과 같이)', () => {
    let s = resumeWild(stunned());
    s = answer({ ...s, elapsedMs: 6000 }, ['c023-1', 'c023-2'], 'main', 'light').state; // 주①
    expect(s.stun).toBe(true);
    const d = { ...dizzyOf(s), stun: true };
    expect(throwCapsule(d, seq(0.5), 5)!.state.stun).toBe(true);
    expect(throwCapsule(d, seq(0.999, 0), 10)!.state.stun).toBe(true);
    expect(createWild('normal', 5, 100).stun).toBe(false);
  });
});

describe('wildBattle: enemyStrike — 스턴 → 회피 → 크리티컬, 저장할 피해 = 화면에서 줄어든 체력', () => {
  const q = (over: Partial<WildState> = {}): WildState => ({ ...at(500), ...over });
  /** 저장(damageCompanion)에 쓰는 반환 피해를 공격 전 체력에 적용하면 공격 뒤 화면 체력과 같다 */
  const same = (before: WildState, after: WildState) => {
    expect(after.lastStrike).not.toBeNull();
    expect(Math.max(0, before.allyHp - after.lastStrike!.damage)).toBe(after.allyHp);
  };
  it.each([
    // [이름, 상태, 난수(회피, 크리티컬), 피해, 회피, 크리티컬]
    ['보통', {}, [0.5, 0.5], 13, false, false],
    ['회피 경계 0.0499', {}, [0.0499], 0, true, false],
    ['회피 경계 0.05는 안 피함', {}, [0.05, 0.5], 13, false, false],
    ['크리티컬 경계 0.0999', {}, [0.5, 0.0999], 26, false, true],
    ['크리티컬 경계 0.10은 보통', {}, [0.5, 0.1], 13, false, false],
    ['방어 + 크리티컬 = 절반(올림) 뒤 ×2', { guard: true }, [0.5, 0], 14, false, true],
    ['방어', { guard: true }, [0.5, 0.5], 7, false, false],
  ] as const)('%s', (_n, over, rolls, damage, dodged, crit) => {
    const before = q(over);
    const r = enemyStrike(before, seq(...rolls));
    expect(r).toMatchObject({ damage, dodged, crit, blocked: false });
    expect(r.state.allyHp).toBe(100 - damage);
    expect(r.state.lastStrike).toEqual({ damage, dodged, crit, blocked: false });
    // 방어는 맞으면 사라지고, 피하면 남는다
    if ('guard' in over) expect(r.state.guard).toBe(dodged);
  });
  it('스턴이면 막힘: 굴리지 않고 피해 0, 스턴만 사라지고 방어는 남는다', () => {
    const r = enemyStrike(q({ stun: true, guard: true }), seq());
    expect(r).toMatchObject({ damage: 0, blocked: true, dodged: false, crit: false });
    expect(r.state).toMatchObject({ stun: false, guard: true, allyHp: 100 });
  });
  it('체력보다 큰 피해면 0에서 멈추고 쓰러짐 (반환 피해는 굴린 값 그대로)', () => {
    const r = enemyStrike(q({ allyHp: 20 }), seq(0.5, 0));
    expect(r.damage).toBe(26);
    expect(r.state).toMatchObject({ allyHp: 0, phase: 'fainted' });
  });
  it.each([
    ['보통', {}, [0.5, 0.5]],
    ['방어', { guard: true }, [0.5, 0.5]],
    ['크리티컬', {}, [0.5, 0]],
    ['회피', {}, [0]],
    ['스턴', { stun: true }, []],
    ['쓰러짐', { allyHp: 10 }, [0.5, 0.5]],
  ] as const)('%s: 오답·시간 초과 모두 저장 피해 = 화면 피해', (_n, over, rolls) => {
    const before = q(over);
    same(before, answerWild(before, false, seq(...rolls)));
    const timed = q({ timeLeftMs: 100, ...over });
    same(timed, tick(timed, 250, seq(...rolls)));
  });
  it('오답·시간 초과의 적 공격은 공격 횟수(attackCount)를 바꾸지 않는다', () => {
    const before = q({ attackCount: 1 });
    expect(answerWild(before, false, ok).attackCount).toBe(1);
    expect(tick({ ...before, timeLeftMs: 100 }, 250, ok).attackCount).toBe(1);
  });
  it('크리티컬로 쓰러질 수 있다 (보통 13 × 2)', () => {
    expect(answerWild(q({ allyHp: 20 }), false, seq(0.5, 0))).toMatchObject({ phase: 'fainted', allyHp: 0 });
  });
});

describe('wildBattle: 기술 고르기(pick)', () => {
  it('버튼이 2개 이상이면 첫 문제도 고르기부터', () => {
    expect(createWild('normal', 5, 100, 2).phase).toBe('pick');
    expect(createWild('normal', 5, 100, 1).phase).toBe('question');
    expect(createWild('normal', 5, 0, 2).phase).toBe('fainted');
  });
  it('pick에서는 시간이 안 간다, pickSkill 뒤 시작', () => {
    const p = { ...createWild('normal', 5, 100, 2), elapsedMs: 300 };
    expect(tickWild(p, 250, ok)).toBe(p);
    expect(answerWild(p, true, ok)).toBe(p);
    const q = pickSkill(p);
    expect(q).toMatchObject({ phase: 'question', elapsedMs: 0, timeLeftMs: 7000 });
    expect(tickWild(q, 250, ok)).toMatchObject({ elapsedMs: 250, timeLeftMs: 6750 });
    expect(pickSkill(q)).toBe(q);
  });
  it('명중 뒤: 버튼 1개면 고르기를 건너뛴다', () => {
    const h = answerWild(at(0), true, ok);
    expect(resumeWild(h, 1).phase).toBe('question');
    expect(resumeWild(h, 2).phase).toBe('pick');
  });
  it('힌트 뒤에는 다른 문제라 버튼이 2개 이상이면 고르기부터, 경과 시간은 0부터', () => {
    const struck = answerWild(at(3000), false, ok);
    const hint = resumeWild(struck, 3);
    expect(hint.phase).toBe('hint');
    expect(resumeWild(hint, 3)).toMatchObject({ phase: 'pick', elapsedMs: 0, timeLeftMs: 7000 });
    expect(resumeWild(hint, 1)).toMatchObject({ phase: 'question', elapsedMs: 0, timeLeftMs: 7000 });
  });
});

describe('wildBattle: 틀린 문제는 힌트 뒤 다른 문제로 (2차 방식, 설계서 0-2절)', () => {
  it('오답 → 피격 → 힌트 → 새 문제: 시계는 처음부터, 칸·맞힌 수는 그대로', () => {
    const struck = answerWild({ ...at(3000), timeLeftMs: 4000, cells: 2, correct: 1 }, false, ok);
    expect(struck.phase).toBe('struck');
    const hint = resumeWild(struck);
    expect(hint.phase).toBe('hint');
    const next = resumeWild(hint);
    expect(next).toMatchObject({ phase: 'question', elapsedMs: 0, timeLeftMs: 7000, limitMs: 7000, cells: 2, correct: 1 });
  });
  it('힌트 뒤 새 문제에 여유(calmMs)가 있으면 더하고 0', () => {
    const hint = resumeWild(answerWild(at(500, { calmMs: CALM_BONUS_MS }), false, ok));
    expect(resumeWild(hint)).toMatchObject({ timeLeftMs: 7000 + CALM_BONUS_MS, calmMs: 0 });
  });
  it('힌트 뒤 새 문제에서도 빨리 풀면 윗단계 (새 문제라 시계가 처음부터)', () => {
    const q = resumeWild(resumeWild(answerWild(at(500), false, ok)));
    const r = answer(q, ['c023-1', 'c023-2', 'c023-5'], 'main', 'light');
    expect(r).toMatchObject({ upper: true, tier: 3, fired: { id: 'c023-5' } });
  });
  it('시간 초과도 같은 흐름 (힌트 → 새 문제)', () => {
    const struck = tick({ ...at(0), timeLeftMs: 100 }, 250, ok);
    expect(struck).toMatchObject({ phase: 'struck', timedOut: true });
    expect(resumeWild(resumeWild(struck))).toMatchObject({ phase: 'question', timeLeftMs: 7000, elapsedMs: 0 });
  });
  it('WildState에 "이 문제에서 틀렸나(missed)"는 더 이상 없다 (학습 기록은 문제 목록의 isRetry만)', () => {
    expect('missed' in createWild('normal', 5, 100)).toBe(false);
    expect('missed' in answerWild(at(0), false, ok)).toBe(false);
  });
});

describe('wildBattle: 시간 한도 limitMs (시간 막대 기준)', () => {
  it('처음은 그 단계 시간, 여유가 있으면 새 문제의 한도에 더한다', () => {
    expect(createWild('mighty', 5, 100).limitMs).toBe(5000);
    const s = resumeWild({ ...at(0), phase: 'hit', calmMs: CALM_BONUS_MS });
    expect(s).toMatchObject({ limitMs: 10000, timeLeftMs: 10000, calmMs: 0 });
    // 그 다음 새 문제는 다시 7초
    const h = answer(s, ['c023-1'], 'main', 'light').state;
    expect(resumeWild(h).limitMs).toBe(7000);
  });
  it('화나서 강력이 되면 강력 시간(5초)', () => {
    const d = dizzyOf(createWild('normal', 5, 100));
    expect(throwCapsule(d, seq(0.999, 0), 10)!.state.limitMs).toBe(5000);
  });
});

// ── 개정 4 (설계서 0-2절): 크리티컬·회피·특수효과 성공률·주기 공격·캡슐 활성화·포획 상승 ──

describe('wildBattle: 내 공격의 회피·크리티컬', () => {
  const M = ['c023-1', 'c023-2', 'c023-5'];
  it('회피 경계: 0.0499면 빗나감, 0.05면 맞음', () => {
    const miss = answer(at(6000), ['c023-1'], 'main', 'light', NORMAL_MS, seq(0.0499));
    expect(miss).toMatchObject({ dodged: true, crit: false, effect: null });
    expect(miss.state).toMatchObject({ cells: 0, phase: 'hit', correct: 1 });
    const hit = answer(at(6000), ['c023-1'], 'main', 'light', NORMAL_MS, seq(0.05, 0.5));
    expect(hit).toMatchObject({ dodged: false, crit: false });
    expect(hit.state.cells).toBe(2);
  });
  it('크리티컬 경계: 0.0999면 칸 ×2, 0.10이면 보통', () => {
    expect(answer(at(6000), ['c023-1'], 'main', 'light', NORMAL_MS, seq(0.5, 0.0999))).toMatchObject({ crit: true, state: { cells: 4 } });
    expect(answer(at(6000), ['c023-1'], 'main', 'light', NORMAL_MS, seq(0.5, 0.1))).toMatchObject({ crit: false, state: { cells: 2 } });
  });
  it('크리티컬은 위력·충전·상성을 다 계산한 칸 ×2, 최대 8칸', () => {
    // 주③ 3 + 충전 1 + 풀→물 1 = 5 → 4로 자름 → ×2 = 8
    const s = { ...createWild('mighty', 5, 100), charge: 1 };
    const r = resolveAnswer(s, btn(M), M, 'water', TIER_RULES.mighty.timeMs, seq(0.5, 0));
    expect(r).toMatchObject({ crit: true, fired: { id: 'c023-5' } });
    expect(r.state).toMatchObject({ cells: 8, charge: 0, phase: 'hit' });
    // 풀 → 불(약함) 주① 2 − 1 = 1 → ×2 = 2
    expect(answer(at(6000), ['c023-1'], 'main', 'fire', NORMAL_MS, seq(0.5, 0)).state.cells).toBe(2);
  });
  it('크리티컬로 한 번에 어지러워질 수 있다 (칸은 최대에서 멈춤)', () => {
    const r = answer(at(6000, { cells: 6 }), ['c023-1'], 'main', 'light', NORMAL_MS, seq(0.5, 0));
    expect(r.state).toMatchObject({ cells: 8, phase: 'dizzy' });
  });
  it('빗나가면 칸·특수효과 없음, 충전은 남고, 효과는 굴리지 않는다 (난수 한 번)', () => {
    // 주②(스턴)가 나갈 빠르기, 충전 1
    const r = answer(at(0, { charge: 1, hideChoice: true }), ['c023-1', 'c023-2'], 'main', 'water', NORMAL_MS, seq(0.01));
    expect(r).toMatchObject({ dodged: true, crit: false, effect: null, fired: { id: 'c023-2' } });
    expect(r.special).toBeUndefined();
    expect(r.state).toMatchObject({ cells: 0, charge: 1, stun: false, phase: 'hit', correct: 1, attackCount: 1, hideChoice: false });
    // 특수 버튼도 빗나가면 효과 없음
    const sp = answer(at(0, { allyHp: 40 }), ['c022-1', 'c022-3'], 'special', 'light', NORMAL_MS, seq(0));
    expect(sp).toMatchObject({ dodged: true, effect: null, state: { cells: 0, allyHp: 40 } });
    expect(sp.special).toBeUndefined();
  });
  it('옛 호출 answerWild(정답)도 회피·크리티컬을 굴린다', () => {
    expect(answerWild(at(0), true, seq(0.01))).toMatchObject({ cells: 0, phase: 'hit', attackCount: 1, correct: 1 });
    expect(answerWild(at(0), true, seq(0.5, 0))).toMatchObject({ cells: 4, attackCount: 1 });
  });
});

describe('wildBattle: 특수효과 성공률 (SPECIAL_SUCCESS)', () => {
  it('표 값 (회복·방어 90%, 스턴 50%, 힌트·여유 80%, 충전 70%)', () => {
    expect(SPECIAL_SUCCESS).toEqual({ heal: 0.9, guard: 0.9, stun: 0.5, clue: 0.8, calm: 0.8, charge: 0.7 });
  });
  // [가진 기술, 버튼, 효과, 성공하면 남는 상태]
  const CASES = [
    [['c023-1', 'c023-2'], 'main', 'stun', { stun: true }],
    [['c002-1', 'c002-2'], 'main', 'heal', {}],
    [['c003-1', 'c003-2'], 'main', 'guard', { guard: true }],
    [['c022-1', 'c022-3'], 'special', 'heal', {}],
    [['c002-1', 'c002-3'], 'special', 'guard', { guard: true }],
    [['c005-1', 'c005-3'], 'special', 'charge', { charge: CHARGE_BONUS_CELLS }],
    [['c004-1', 'c004-3'], 'special', 'calm', { calmMs: CALM_BONUS_MS }],
    [['c003-1', 'c003-3'], 'special', 'clue', { hideChoice: true }],
  ] as const;
  it.each(CASES)('%s %s(%s): 경계 바로 아래면 성공, 경계 값이면 실패 — 실패해도 칸은 그대로 깎인다', (held, kind, effect, success) => {
    const p = SPECIAL_SUCCESS[effect];
    const s = at(1000, { allyHp: 40 });
    const good = answer(s, [...held], kind, 'light', NORMAL_MS, seq(0.5, 0.5, p - 0.0001));
    expect(good.effect).toEqual({ kind: effect, ok: true });
    expect(good.special).toBe(effect);
    expect(good.state).toMatchObject(success);
    const bad = answer(s, [...held], kind, 'light', NORMAL_MS, seq(0.5, 0.5, p));
    expect(bad.effect).toEqual({ kind: effect, ok: false });
    expect(bad.special).toBeUndefined(); // 회복도 알려 주지 않아 체력이 안 찬다
    // 효과는 하나도 남지 않는다 (충전은 특수 버튼에서 쓰지 않으니 0 그대로)
    expect(bad.state).toMatchObject({ stun: false, guard: false, charge: 0, calmMs: 0, hideChoice: false, allyHp: 40 });
    // 칸은 성공·실패와 상관없이 같다
    expect(bad.state.cells).toBe(good.state.cells);
  });
  it('효과가 없는 기술(주①·주③·부속성·늦어서 대신 나감)은 효과를 굴리지 않는다 (난수 두 번)', () => {
    expect(answer(at(6000), ['c023-1', 'c023-2'], 'main', 'light', NORMAL_MS, seq(0.5, 0.5)).effect).toBeNull();
    expect(answer(at(0), ['c023-1', 'c023-2', 'c023-5'], 'main', 'light', NORMAL_MS, seq(0.5, 0.5)).effect).toBeNull();
    expect(answer(at(0), ['c022-1', 'c022-4'], 'sub', 'light', NORMAL_MS, seq(0.5, 0.5)).effect).toBeNull();
    const late = answer(at(6000), ['c022-1', 'c022-3'], 'special', 'light', NORMAL_MS, seq(0.5, 0.5));
    expect(late).toMatchObject({ usedFallback: true, effect: null });
  });
  it('크리티컬과 효과는 함께 날 수 있다 (주② 스턴 + 크리티컬)', () => {
    const r = answer(at(0), ['c023-1', 'c023-2'], 'main', 'light', NORMAL_MS, seq(0.5, 0, 0));
    expect(r).toMatchObject({ crit: true, effect: { kind: 'stun', ok: true }, state: { cells: 4, stun: true } });
  });
});

describe('wildBattle: 2번 때릴 때마다 적이 한 번 공격 (주기 공격)', () => {
  const held = ['c023-1'];
  const hitOnce = (s: WildState, rng: Rng = ok) => answer({ ...s, elapsedMs: 6000 }, held, 'main', 'light', NORMAL_MS, rng).state;
  it('정답 2번째 뒤에 주기 공격: 피해·카운터 0·힌트 없이 새 문제', () => {
    let s = hitOnce(at(0));
    expect(s).toMatchObject({ attackCount: 1, phase: 'hit' });
    expect(counterDue(s)).toBe(false);
    expect(counterAttack(s, ok)).toBeNull();
    s = resumeWild(s);
    s = hitOnce(s);
    expect(s).toMatchObject({ attackCount: 2, phase: 'hit' });
    expect(counterDue(s)).toBe(true);
    const c = counterAttack(s, seq(0.5, 0.5))!;
    expect(c).toMatchObject({ damage: 13, dodged: false, crit: false, blocked: false });
    expect(c.state).toMatchObject({ phase: 'counter', attackCount: 0, allyHp: 87, lastStrike: { damage: 13 } });
    // 연출 뒤 힌트 없이 바로 새 문제 (버튼 2개 이상이면 고르기)
    expect(resumeWild(c.state, 1)).toMatchObject({ phase: 'question', elapsedMs: 0, timeLeftMs: 7000 });
    expect(resumeWild(c.state, 3).phase).toBe('pick');
  });
  it('주기 공격도 크리티컬·회피·스턴(막힘)·방어를 따른다', () => {
    const due = { ...at(0), phase: 'hit' as const, attackCount: 2 };
    expect(counterAttack(due, seq(0.5, 0))!.state.allyHp).toBe(74);
    expect(counterAttack(due, seq(0))!).toMatchObject({ dodged: true, damage: 0, state: { allyHp: 100, attackCount: 0, phase: 'counter' } });
    expect(counterAttack({ ...due, stun: true }, seq())!).toMatchObject({ blocked: true, damage: 0, state: { stun: false, attackCount: 0 } });
    expect(counterAttack({ ...due, guard: true }, ok)!.state).toMatchObject({ allyHp: 93, guard: false });
  });
  it('주기 공격으로 쓰러지면 끝', () => {
    const due = { ...at(0), phase: 'hit' as const, attackCount: 2, allyHp: 10 };
    expect(counterAttack(due, ok)!.state).toMatchObject({ phase: 'fainted', allyHp: 0 });
  });
  it('어지러워지면(체력 0) 반격 없음', () => {
    const s = hitOnce(at(0, { attackCount: 1, cells: 6 }));
    // 어지러워지면 공격 횟수는 0으로 (캡슐에서 빠져나온 뒤 첫 정답에 바로 주기 공격이 오지 않게)
    expect(s).toMatchObject({ phase: 'dizzy', attackCount: 0 });
    expect(counterDue(s)).toBe(false);
    expect(counterAttack(s, ok)).toBeNull();
  });
  it('빗나간 공격도 센다, 틀린 답의 적 공격은 세지 않는다', () => {
    let s = hitOnce(at(0), seq(0.01));
    expect(s).toMatchObject({ attackCount: 1, cells: 0 });
    s = resumeWild(s);
    s = answerWild(s, false, ok);
    expect(s).toMatchObject({ phase: 'struck', attackCount: 1, allyHp: 87 });
    s = resumeWild(resumeWild(s));
    s = hitOnce(s);
    expect(counterDue(s)).toBe(true);
  });
});

describe('wildBattle: 캡슐은 야생 체력 1/4 이하에서', () => {
  it.each([
    ['weak', 6, 4, 5],
    ['normal', 8, 5, 6],
    ['strong', 8, 5, 6],
    ['mighty', 12, 8, 9],
    ['legend', 8, 5, 6],
  ] as const)('%s(최대 %i칸): 깎인 칸 %i면 아직, %i면 던질 수 있음', (tier, max, notYet, ready) => {
    const s = createWild(tier, 5, 100);
    expect(maxCells(tier)).toBe(max);
    expect(catchActive({ ...s, cells: notYet })).toBe(false);
    expect(catchActive({ ...s, cells: ready })).toBe(true);
    expect(catchActive({ ...s, cells: max })).toBe(true);
  });
  it('던질 수 있는 때: 고르기·문제·어지러움 (체력 1/4 이하일 때만)', () => {
    const low = { ...createWild('normal', 5, 100), cells: 6 };
    for (const phase of ['pick', 'question', 'dizzy'] as const) expect(canThrow({ ...low, phase })).toBe(true);
    for (const phase of ['hit', 'counter', 'struck', 'hint', 'caught', 'escaped', 'released', 'fainted'] as const) expect(canThrow({ ...low, phase })).toBe(false);
    expect(canThrow({ ...low, cells: 5 })).toBe(false);
    expect(throwCapsule({ ...low, cells: 5 }, r0, 5)).toBeNull();
  });
  it('문제를 푸는 중에 던져 빠져나오면: 칸을 되찾고 새 문제(시계 처음부터), 틀린 것으로 치지 않는다', () => {
    const q = { ...createWild('normal', 5, 100), cells: 6, elapsedMs: 3000, timeLeftMs: 4000, correct: 3 };
    const r = throwCapsule(q, seq(0.5), 5, 2)!;
    expect(r.outcome).toBe('healed');
    expect(r.state).toMatchObject({ cells: 2, phase: 'pick', elapsedMs: 0, timeLeftMs: 7000, correct: 3, allyHp: 100, throwTries: 1 });
  });
  it('고르는 중에 던져도 된다: 잡힘·도망은 끝, 화남은 강력이 되어 새 문제', () => {
    const p = { ...createWild('normal', 5, 100, 2), cells: 7 };
    expect(throwCapsule(p, r0, 5, 2)).toEqual({ state: { ...p, phase: 'caught' }, outcome: 'caught' });
    expect(throwCapsule(p, seq(0.9), 5, 2)!.state.phase).toBe('escaped');
    expect(throwCapsule(p, seq(0.999, 0), 10, 2)!.state).toMatchObject({ tier: 'mighty', cells: 0, phase: 'pick', throwTries: 1 });
  });
});

describe('wildBattle: 실패할수록 잘 잡힌다 (throwTries)', () => {
  const d = (over: Partial<WildState> = {}) => ({ ...dizzyOf(createWild('normal', 5, 100)), ...over });
  it('빠져나옴·화남이면 실패 수 +1, 같은 야생에게 쌓인다', () => {
    let s = d();
    s = throwCapsule(s, seq(0.5), 5)!.state;
    expect(s.throwTries).toBe(1);
    s = dizzyOf(s);
    s = throwCapsule(s, seq(0.999, 0), 5)!.state;
    expect(s.throwTries).toBe(2);
  });
  it('실패 3번이면 잡힘 0.38(어지러우면 낮은 체력 +0.1로 0.48): 0.47은 잡힘, 0.49는 빠져나옴', () => {
    expect(throwOdds('normal', 3).caught).toBeCloseTo(0.38);
    expect(throwCapsule(d({ throwTries: 3 }), seq(0.47), 5)!.outcome).toBe('caught');
    expect(throwCapsule(d({ throwTries: 3 }), seq(0.49), 5)!.outcome).toBe('healed');
    expect(throwCapsule(d({ throwTries: 0 }), seq(0.37), 5)!.outcome).toBe('healed');
  });
  it('야생이 기절(스턴)해 있으면 +10%p', () => {
    expect(throwCapsule(d({ stun: true }), seq(0.23), 5)!.outcome).toBe('caught');
    expect(throwCapsule(d({ stun: false }), seq(0.23), 5)!.outcome).toBe('healed');
  });
  it('상한 70%: 실패를 많이 해도 0.70부터는 안 잡힌다', () => {
    expect(throwCapsule(d({ throwTries: 20, stun: true }), seq(0.6999), 5)!.outcome).toBe('caught');
    expect(throwCapsule(d({ throwTries: 20, stun: true }), seq(0.7001), 5)!.outcome).not.toBe('caught');
  });
  it('처음 만난 야생은 실패 수 0', () => expect(createWild('weak', 2, 100).throwTries).toBe(0));
});
