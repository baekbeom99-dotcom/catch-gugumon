import { describe, expect, it } from 'vitest';
import {
  answerWild, chipCells, strikeDamage, createWild, damageOf, healAlly, hiddenChoice, MAX_TICK_MS, maxCells, pickSkill, releaseWild, resolveAnswer,
  resumeWild, throwCapsule, tick, tickWild, wildHpRatio,
  type WildState,
} from '../../src/domain/field/wildBattle';
import type { Rng } from '../../src/domain/random';
import { skillButtons, skillDef, type SkillButton } from '../../src/domain/field/skills';
import type { SpeciesId } from '../../src/domain/field/creatures';
import type { Element } from '../../src/domain/field/elements';
import { CALM_BONUS_MS, CHARGE_BONUS_CELLS, TIER_RULES } from '../../src/domain/field/tuning';

const r0 = () => 0;
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
    for (let i = 0; i < 3; i++) s = resumeWild(answerWild(s, true, r0));
    expect(s.phase).toBe('question');
    expect(answerWild(s, true, r0).phase).toBe('dizzy');
  });
  it.each([['weak', 3], ['normal', 4], ['strong', 4], ['mighty', 6], ['legend', 4]] as const)('%s 정답 %i개', (t, n) => {
    let s = createWild(t, 5, 100);
    for (let i = 0; i < n - 1; i++) {
      s = answerWild(s, true, r0);
      expect(s.phase).toBe('hit');
      s = resumeWild(s);
    }
    expect(s).toMatchObject({ phase: 'question', cells: 2 * (n - 1), correct: n - 1 });
    expect(answerWild(s, true, r0)).toMatchObject({ phase: 'dizzy', cells: 2 * n, correct: n });
  });
  it.each([['weak', 7000], ['strong', 5000], ['mighty', 5000], ['legend', 7000]] as const)('%s 시간 %i', (t, ms) =>
    expect(createWild(t, 1, 100).timeLeftMs).toBe(ms));
  it('처음 상태', () => {
    expect(createWild('strong', 8, 60)).toEqual({
      tier: 'strong', level: 8, cells: 0, timeLeftMs: 5000, limitMs: 5000, elapsedMs: 0, allyHp: 60, phase: 'question', correct: 0, timedOut: false,
      missed: false, charge: 0, guard: false, stun: false, calmMs: 0, hideChoice: false,
    });
  });
  it('시작부터 체력 0이면 쓰러진 채(전투가 열리지 않게)', () => {
    const s = createWild('normal', 5, 0);
    expect(s.phase).toBe('fainted');
    expect(tick(s, 250, r0)).toBe(s);
    expect(answerWild(s, false, r0)).toBe(s);
  });
  it('시간은 question에서만, 한 번에 250ms까지', () => {
    const s = createWild('normal', 5, 100);
    expect(tick(s, 60000, r0).timeLeftMs).toBe(6750);
    expect(tick(s, NaN, r0).timeLeftMs).toBe(7000);
    for (const bad of [Infinity, -Infinity, -100]) expect(tick(s, bad, r0).timeLeftMs).toBe(7000);
    expect(tick(s, 100, r0).timeLeftMs).toBe(6900);
    for (const phase of ['pick', 'hit', 'struck', 'hint', 'dizzy'] as const) expect(tick({ ...s, phase }, 100, r0)).toEqual({ ...s, phase });
  });
  it('시간이 다 되면 피격(timedOut), 체력 −25, 힌트로', () => {
    let s = createWild('normal', 5, 100);
    for (let i = 0; i < 27; i++) s = tick(s, 250, r0);
    expect(s).toMatchObject({ phase: 'question', timeLeftMs: 250 });
    s = tick(s, 250, r0);
    expect(s).toMatchObject({ phase: 'struck', timedOut: true, allyHp: 75, timeLeftMs: 0 });
    expect(resumeWild(s).phase).toBe('hint');
    expect(resumeWild(resumeWild(s))).toMatchObject({ phase: 'question', timeLeftMs: 7000 });
  });
  it('시간이 남아 있으면 난수를 쓰지 않는다', () => {
    expect(() => tick(createWild('normal', 5, 100), 250, seq())).not.toThrow();
  });
  it('정답 뒤 다음 문제는 시간이 처음부터', () => {
    const s = tick(tick(createWild('strong', 5, 100), 250, r0), 250, r0);
    expect(resumeWild(answerWild(s, true, r0)).timeLeftMs).toBe(5000);
  });
});

describe('wildBattle: 적의 공격', () => {
  it.each([['weak', 5], ['normal', 4], ['strong', 3], ['mighty', 2], ['legend', 3]] as const)('%s: 오답 %i번에 쓰러지고 힌트 없이 끝', (t, n) => {
    let s = createWild(t, 5, 100);
    for (let i = 0; i < n - 1; i++) {
      s = answerWild(s, false, r0);
      expect(s.phase).toBe('struck');
      s = resumeWild(resumeWild(s));
    }
    const last = answerWild(s, false, r0);
    expect(last).toMatchObject({ phase: 'fainted', allyHp: 0, timedOut: false });
    expect(resumeWild(last)).toBe(last);
  });
  it('시간 초과로 쓰러져도 힌트 없이 끝', () => {
    let s = createWild('mighty', 5, 50);
    for (let i = 0; i < 20; i++) s = tick(s, 250, r0);
    expect(s).toMatchObject({ phase: 'fainted', allyHp: 0, timedOut: true });
  });
  it('오답은 timedOut false, 맞힌 수는 그대로', () => {
    expect(answerWild(createWild('normal', 5, 100), false, r0)).toMatchObject({ phase: 'struck', timedOut: false, allyHp: 75, correct: 0, cells: 0 });
  });
  it('question이 아니면 answerWild는 그대로(연타)', () => {
    const a = answerWild(createWild('normal', 5, 100), true, r0);
    expect(answerWild(a, true, r0)).toBe(a);
    expect(answerWild(a, false, r0)).toBe(a);
    for (const phase of ['struck', 'hint', 'dizzy', 'caught', 'escaped', 'released', 'fainted'] as const) {
      const s = { ...a, phase };
      expect(answerWild(s, true, r0)).toBe(s);
    }
  });
  it('적의 공격은 난수를 쓰지 않는다 (적 기술 이름은 화면이 고른다)', () => {
    const none: Rng = () => {
      throw new Error('난수를 쓰면 안 됨');
    };
    expect(answerWild(createWild('normal', 5, 100), false, none).phase).toBe('struck');
    expect(tick({ ...createWild('normal', 5, 100), timeLeftMs: 100 }, 250, none).phase).toBe('struck');
  });
  it('damageOf', () => {
    expect(damageOf(createWild('weak', 5, 100))).toBe(20);
    expect(damageOf(createWild('mighty', 5, 100))).toBe(50);
  });
});

describe('wildBattle: 던지기', () => {
  it.each([
    [0.079, 'caught'], [0.081, 'healed'], [0.759, 'healed'], [0.761, 'escaped'], [0.969, 'escaped'], [0.971, 'angry'],
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
      expect(r.state).toEqual({ ...d, cells: 0, elapsedMs: 0, phase: 'question', timeLeftMs: t === 'mighty' ? 5000 : 7000 });
    }
  });
  it('빠져나옴(healed): 어지러움이 풀리고 칸을 절반(올림) 되찾고, 문제 시간 처음부터. dizzy가 아니면 null', () => {
    const d = { ...dizzyOf(createWild('normal', 5, 100)), timeLeftMs: 1200, elapsedMs: 5800 };
    const r = throwCapsule(d, seq(0.5), 5)!; // 난수 한 번으로 결정 (R11)
    expect(r.outcome).toBe('healed');
    expect(r.state).toEqual({ ...d, cells: 4, phase: 'question', timeLeftMs: 7000, elapsedMs: 0 });
    for (const phase of ['question', 'pick', 'hit', 'struck', 'hint', 'caught', 'escaped', 'released', 'fainted'] as const) {
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
      expect(tick(s, 250, r0)).toBe(s);
      expect(answerWild(s, true, r0)).toBe(s);
      expect(resumeWild(s)).toBe(s);
      expect(releaseWild(s)).toBe(s);
      expect(throwCapsule(s, r0, 5)).toBeNull();
    }
  });
});

// ── 필드 모험 3차: 칸 체력·위력·단계 발동·특수·상성 (설계서 0-1절이 2-6절보다 우선) ──
const k = (id: string) => skillDef(id);
/** 기술 id의 종 (예: 'legend-horn-3' → 'legend-horn') */
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
const answer = (s: WildState, held: string[], kind: SkillButton['kind'], wild: Element, timeMs = NORMAL_MS) =>
  resolveAnswer(s, btn(held, kind), held, wild, timeMs);

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
    const held = ['cloud-1', 'cloud-2', 'cloud-5'];
    const r = resolveAnswer(s, btn(held), held, 'water', TIER_RULES[t].timeMs);
    expect(r).toMatchObject({ upper: true, tier: 3, fired: { id: 'cloud-5' } });
    expect(r.state).toMatchObject({ cells: 4, phase: 'hit' });
  });
  it('어지러워지면 칸은 최대에서 멈춘다', () => {
    const held = ['cloud-1', 'cloud-2', 'cloud-5'];
    const r = answer(at(0, { cells: 7 }), held, 'main', 'water');
    expect(r.state).toMatchObject({ cells: 8, phase: 'dizzy', correct: 1 });
  });
  it('answerWild(옛 호출)은 위력 2·보통, 충전은 더한다', () => {
    expect(answerWild(at(0), true, r0).cells).toBe(2);
    expect(answerWild(at(0, { charge: 1 }), true, r0)).toMatchObject({ cells: 3, charge: 0 });
  });
});

describe('wildBattle: resolveAnswer — 주속성 단계·부속성·상성', () => {
  it('주속성 버튼: 주② 조건(4초) 이내면 주②(2칸 + 스턴), 1ms 넘으면 주①(2칸)', () => {
    const held = ['cloud-1', 'cloud-2'];
    const fast = answer(at(4000), held, 'main', 'light');
    expect(fast).toMatchObject({ upper: true, tier: 2, usedFallback: false, fired: { id: 'cloud-2' }, special: 'stun' });
    expect(fast.state).toMatchObject({ cells: 2, correct: 1, phase: 'hit', stun: true });
    const slow = answer(at(4001), held, 'main', 'light');
    expect(slow).toMatchObject({ upper: false, tier: 1, fired: { id: 'cloud-1' } });
    expect(slow.special).toBeUndefined();
    expect(slow.state).toMatchObject({ cells: 2, stun: false });
  });
  it('주① 하나뿐이면 빨라도 2칸 (빠르면 +1칸 없음)', () => {
    const r = answer(at(0), ['cloud-1'], 'main', 'light');
    expect(r).toMatchObject({ upper: false, tier: 1 });
    expect(r.state.cells).toBe(2);
  });
  it('주③: 2초 이내면 3칸 (효과 없음), 넘으면 주② 2칸', () => {
    const held = ['cloud-1', 'cloud-2', 'cloud-5'];
    const m3 = answer(at(2000), held, 'main', 'light');
    expect(m3.state).toMatchObject({ cells: 3, stun: false });
    expect(m3.special).toBeUndefined();
    expect(answer(at(2001), held, 'main', 'light').state.cells).toBe(2);
  });
  it('주②는 속성 기술이라 상성을 보고 충전을 쓴다, 효과도 함께', () => {
    // 새싹 휙(풀) → 물 +1, 충전 +1 → 2 + 1 + 1 = 4
    const r = answer(at(0, { charge: 1 }), ['cloud-1', 'cloud-2'], 'main', 'water');
    expect(r.state).toMatchObject({ cells: 4, charge: 0, stun: true });
  });
  it('주② 효과: 회복(방울무몬)은 special만 알려 주고 체력은 그대로, 방어(왕관몬)는 guard', () => {
    const heal = answer(at(0, { allyHp: 40 }), ['mushroom-1', 'mushroom-2'], 'main', 'light');
    expect(heal).toMatchObject({ special: 'heal', fired: { id: 'mushroom-2' }, state: { allyHp: 40, cells: 2 } });
    const guard = answer(at(0), ['fluff-1', 'fluff-2'], 'main', 'water');
    expect(guard).toMatchObject({ special: 'guard', state: { guard: true } });
  });
  it('부속성 버튼: 빠르면 부속성(3칸), 느리면 주①(2칸)', () => {
    const held = ['cloud-1', 'cloud-2', 'cloud-4'];
    expect(answer(at(4000), held, 'sub', 'water')).toMatchObject({ fired: { id: 'cloud-4' }, upper: true, state: { cells: 3 } }); // 빛 → 물 보통
    expect(answer(at(4001), held, 'sub', 'water')).toMatchObject({ fired: { id: 'cloud-1' }, upper: false, state: { cells: 3 } }); // 풀 → 물 +1
  });
  it('부속성 자리의 복사 기술은 원래 속성으로 상성, 위력은 3', () => {
    // horn-5(물) → 불: +1 → 3 + 1 = 4
    const r = answer(at(0), ['cloud-1', 'horn-5'], 'sub', 'fire');
    expect(r).toMatchObject({ fired: { id: 'horn-5', basePower: 3 }, upper: true });
    expect(r.state.cells).toBe(4);
  });
  it('상성: 강하면 +1칸, 약하면 −1칸', () => {
    expect(answer(at(6000), ['cloud-1'], 'main', 'water').state.cells).toBe(3); // 풀 → 물
    expect(answer(at(6000), ['cloud-1'], 'main', 'fire').state.cells).toBe(1); // 풀 → 불
    expect(answer(at(0), ['cloud-1', 'cloud-4'], 'sub', 'poison').state.cells).toBe(3); // 빛 ↔ 독 보통
  });
  it('충전은 나간 속성 기술에 더하고 0이 된다 (윗단계여도)', () => {
    const r = answer(at(0, { charge: 1 }), ['cloud-1', 'cloud-4'], 'sub', 'light');
    expect(r.state).toMatchObject({ cells: 4, charge: 0 });
  });
  it('tickWild는 경과 시간을 센다, 여유로 늘어난 시간은 단계 판정에 안 들어간다', () => {
    const held = ['cloud-1', 'cloud-2'];
    let s = resumeWild({ ...at(0), phase: 'hit', calmMs: CALM_BONUS_MS });
    expect(s).toMatchObject({ phase: 'question', timeLeftMs: 10000, elapsedMs: 0, calmMs: 0 });
    for (let i = 0; i < 16; i++) s = tickWild(s, 250, r0);
    expect(s).toMatchObject({ elapsedMs: 4000, timeLeftMs: 6000 });
    expect(answer(s, held, 'main', 'light').upper).toBe(true);
    s = tickWild(s, 1, r0);
    expect(answer(s, held, 'main', 'light').upper).toBe(false);
  });
  it('question이 아니면 상태 그대로(연타)', () => {
    for (const phase of ['pick', 'hit', 'struck', 'hint', 'dizzy', 'caught', 'escaped', 'released', 'fainted'] as const) {
      const s = at(0, { phase });
      const r = answer(s, ['cloud-1', 'cloud-2'], 'main', 'light');
      expect(r.state).toBe(s);
      expect(r).toMatchObject({ upper: false, usedFallback: false, fired: { id: 'cloud-1' } });
    }
  });
});

describe('wildBattle: resolveAnswer — 특수 기술', () => {
  it('조건 안에 풀면 위력 2칸 + 특수 (상성 없음)', () => {
    // 특수: 7초 × 0.5 = 3.5 → 4초
    const r = answer(at(4000), ['cloud-1', 'cloud-3'], 'special', 'water');
    expect(r).toMatchObject({ upper: false, usedFallback: false, special: 'heal' });
    expect(r.fired.id).toBe('cloud-3');
    expect(r.state.cells).toBe(2);
  });
  it('시간을 넘기면 가장 약한 속성 기술이 대신 (그 기술 위력·상성)', () => {
    const r = answer(at(4001), ['cloud-5', 'cloud-1', 'cloud-3'], 'special', 'water');
    expect(r).toMatchObject({ upper: false, usedFallback: true });
    expect(r.special).toBeUndefined();
    expect(r.fired.id).toBe('cloud-1');
    expect(r.state.cells).toBe(3); // 2 + 풀→물 1
  });
  it('대신 나가는 기술: 위력이 가장 낮은 것 (보통 주①), 같으면 슬롯 번호가 작은 것', () => {
    expect(answer(at(6000), ['cloud-2', 'cloud-4', 'cloud-1', 'cloud-3'], 'special', 'light').fired.id).toBe('cloud-1');
    // 복사한 다른 종 1번(부속성 자리 위력 3)보다 내 주①(2)
    expect(answer(at(6000), ['cloud-1', 'cloud-3', 'horn-1'], 'special', 'light').fired.id).toBe('cloud-1');
  });
  it('늦어서 약한 기술이 대신 나가면 충전을 쓰고 0이 된다', () => {
    const r = answer(at(6000, { charge: 1 }), ['cloud-1', 'cloud-3'], 'special', 'light');
    expect(r).toMatchObject({ usedFallback: true });
    expect(r.fired.id).toBe('cloud-1');
    expect(r.state).toMatchObject({ cells: 3, charge: 0 }); // 2 + 충전 1, 풀→빛 보통
  });
  it('특수가 성공해도 이미 있던 방어·여유는 그대로', () => {
    const r = answer(at(1000, { guard: true, calmMs: CALM_BONUS_MS }), ['antenna-1', 'antenna-3'], 'special', 'light');
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
    const b: SkillButton = { kind: 'special', owner: 'cloud', skill: k('cloud-3') };
    const r = resolveAnswer(at(6000), b, ['cloud-3'], 'water', NORMAL_MS);
    expect(r).toMatchObject({ upper: false, usedFallback: true });
    expect(r.fired.id).toBe('cloud-3');
    expect(r.special).toBeUndefined();
    expect(r.state.cells).toBe(1);
  });
  it('충전: 다음 속성 기술 +1칸 뒤 사라짐 (특수 성공에는 안 쓰고 남김)', () => {
    const held = ['antenna-1', 'antenna-3'];
    let s = answer(at(1000), held, 'special', 'light').state;
    expect(s).toMatchObject({ charge: CHARGE_BONUS_CELLS, cells: 2 });
    s = resumeWild(s);
    s = answer({ ...s, elapsedMs: 6000 }, held, 'main', 'fire').state;
    expect(s).toMatchObject({ charge: 0, cells: 5 }); // 2 + 2 + 충전 1
    const g = answer(at(1000, { charge: 1 }), ['mushroom-1', 'mushroom-3'], 'special', 'light').state;
    expect(g).toMatchObject({ charge: 1, cells: 2 });
  });
  it('방어: 다음 적 공격 절반(올림) 뒤 사라짐', () => {
    const s = answer(at(1000), ['mushroom-1', 'mushroom-3'], 'special', 'light').state;
    expect(s.guard).toBe(true);
    const q = resumeWild(s);
    expect(damageOf(q)).toBe(13); // 25 → 12.5 → 13
    const hit1 = answerWild(q, false, r0);
    expect(hit1).toMatchObject({ allyHp: 87, guard: false, phase: 'struck' });
    expect(answerWild(resumeWild(resumeWild(hit1)), false, r0).allyHp).toBe(62);
    expect(damageOf({ ...createWild('strong', 5, 100), guard: true })).toBe(17);
  });
  it('방어는 시간 초과 공격에도', () => {
    let s: WildState = { ...createWild('normal', 5, 100), guard: true, timeLeftMs: 250 };
    s = tick(s, 250, r0);
    expect(s).toMatchObject({ phase: 'struck', allyHp: 87, guard: false, timedOut: true });
  });
  it('여유: 다음 문제 시간 +3초, 고르기를 거쳐도', () => {
    const s = answer(at(1000), ['jelly-1', 'jelly-3'], 'special', 'light').state;
    expect(s.calmMs).toBe(CALM_BONUS_MS);
    const p = resumeWild(s, 2);
    expect(p).toMatchObject({ phase: 'pick', timeLeftMs: 10000, calmMs: 0 });
    expect(pickSkill(p)).toMatchObject({ phase: 'question', timeLeftMs: 10000, elapsedMs: 0 });
  });
  it('힌트: 다음 문제에서 틀린 보기 하나를 숨긴다', () => {
    const s = answer(at(1000), ['fluff-1', 'fluff-3'], 'special', 'light').state;
    expect(s.hideChoice).toBe(true);
    const q = resumeWild(s);
    expect(q.hideChoice).toBe(true);
    // 틀려서 같은 문제를 다시 풀 때도 숨긴 채
    expect(resumeWild(resumeWild(answerWild(q, false, r0))).hideChoice).toBe(true);
    // 그 문제를 맞히면 사라짐
    expect(answer(at(6000, { hideChoice: true }), ['fluff-1'], 'main', 'light').state.hideChoice).toBe(false);
    expect(hiddenChoice([3, 6, 9], 6, r0)).toBe(0);
    expect(hiddenChoice([3, 6, 9], 6, () => 0.99)).toBe(2);
    expect(hiddenChoice([6, 3, 9], 6, r0)).toBe(1);
    expect(hiddenChoice([6], 6, r0)).toBeNull();
  });
  it('회복: special만 알려 주고 내 체력은 그대로', () => {
    const r = answer(at(1000, { allyHp: 40 }), ['cloud-1', 'cloud-3'], 'special', 'light');
    expect(r.special).toBe('heal');
    expect(r.state.allyHp).toBe(40);
  });
  it('복사한 특수: 그 특수 종류로 발동', () => {
    const r = answer(at(1000), ['cloud-1', 'jelly-3'], 'special', 'light');
    expect(r).toMatchObject({ special: 'calm', fired: { id: 'jelly-3' }, state: { calmMs: CALM_BONUS_MS, cells: 2 } });
  });
});

describe('wildBattle: 스턴 (다음 적 공격 1회 무효)', () => {
  const stunned = () => answer(at(0), ['cloud-1', 'cloud-2'], 'main', 'light').state;
  it('오답이면 피해 0, 스턴은 쓰고 방어는 남는다', () => {
    const q = { ...resumeWild(stunned()), guard: true };
    expect(q.stun).toBe(true);
    const hit = answerWild(q, false, r0);
    expect(hit).toMatchObject({ phase: 'struck', allyHp: 100, stun: false, guard: true, missed: true });
    // 그 다음 공격은 방어로 절반
    expect(answerWild(resumeWild(resumeWild(hit)), false, r0)).toMatchObject({ allyHp: 87, guard: false });
  });
  it('시간 초과 공격도 막는다', () => {
    const q = { ...resumeWild(stunned()), timeLeftMs: 250 };
    expect(tick(q, 250, r0)).toMatchObject({ phase: 'struck', allyHp: 100, stun: false, timedOut: true });
  });
  it('체력이 거의 없어도 스턴이면 쓰러지지 않는다', () => {
    const q = { ...resumeWild(stunned()), allyHp: 5 };
    expect(answerWild(q, false, r0)).toMatchObject({ phase: 'struck', allyHp: 5 });
  });
  it('맞히는 동안·빠져나옴·화남 뒤에도 남는다 (방어·충전과 같이)', () => {
    let s = resumeWild(stunned());
    s = answer({ ...s, elapsedMs: 6000 }, ['cloud-1', 'cloud-2'], 'main', 'light').state; // 주①
    expect(s.stun).toBe(true);
    const d = { ...dizzyOf(s), stun: true };
    expect(throwCapsule(d, seq(0.5), 5)!.state.stun).toBe(true);
    expect(throwCapsule(d, seq(0.999, 0), 10)!.state.stun).toBe(true);
    expect(createWild('normal', 5, 100).stun).toBe(false);
  });
});

describe('wildBattle: strikeDamage — 저장할 피해 = 화면에서 실제로 줄어든 체력', () => {
  /** 공격 전 상태로 계산한 피해를 저장에 적용한 체력이 공격 뒤 화면 체력과 같다 */
  const same = (before: WildState, after: WildState) => {
    expect(after.phase === 'struck' || after.phase === 'fainted').toBe(true);
    expect(Math.max(0, before.allyHp - strikeDamage(before))).toBe(after.allyHp);
  };
  const q = (over: Partial<WildState> = {}): WildState => ({ ...at(500), ...over });
  it.each([
    ['보통', {}, 25],
    ['방어', { guard: true }, 13],
    ['스턴', { stun: true }, 0],
    ['스턴 + 방어', { stun: true, guard: true }, 0],
  ] as const)('%s: 오답 공격', (_n, over, dmg) => {
    const before = q(over);
    expect(strikeDamage(before)).toBe(dmg);
    same(before, answerWild(before, false, r0));
  });
  it.each([
    ['보통', {}, 25],
    ['방어', { guard: true }, 13],
    ['스턴', { stun: true }, 0],
  ] as const)('%s: 시간 초과 공격', (_n, over, dmg) => {
    const before = q({ timeLeftMs: 100, ...over });
    expect(strikeDamage(before)).toBe(dmg);
    same(before, tick(before, 250, r0));
  });
  it('공격 뒤 상태로 부르면 다르다 (그래서 화면은 공격 전 상태로 부른다)', () => {
    const before = q({ stun: true });
    const after = answerWild(before, false, r0);
    expect(strikeDamage(before)).toBe(0);
    expect(strikeDamage(after)).toBe(25);
  });
  it('체력보다 큰 피해면 0에서 멈추고 쓰러짐', () => {
    const before = q({ allyHp: 10 });
    const after = answerWild(before, false, r0);
    expect(after).toMatchObject({ phase: 'fainted', allyHp: 0 });
    same(before, after);
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
    expect(tickWild(p, 250, r0)).toBe(p);
    expect(answerWild(p, true, r0)).toBe(p);
    const q = pickSkill(p);
    expect(q).toMatchObject({ phase: 'question', elapsedMs: 0, timeLeftMs: 7000 });
    expect(tickWild(q, 250, r0)).toMatchObject({ elapsedMs: 250, timeLeftMs: 6750 });
    expect(pickSkill(q)).toBe(q);
  });
  it('명중 뒤: 버튼 1개면 고르기를 건너뛴다', () => {
    const h = answerWild(at(0), true, r0);
    expect(resumeWild(h, 1).phase).toBe('question');
    expect(resumeWild(h, 2).phase).toBe('pick');
  });
  it('힌트 뒤 같은 문제는 고르지 않고 바로, 경과 시간은 0부터', () => {
    const struck = answerWild(at(3000), false, r0);
    const hint = resumeWild(struck, 3);
    expect(hint.phase).toBe('hint');
    expect(resumeWild(hint, 3)).toMatchObject({ phase: 'question', elapsedMs: 0, timeLeftMs: 7000 });
  });
});

describe('wildBattle: 틀린 뒤 같은 문제도 다시 빨리 풀면 윗단계 (missed는 기록용)', () => {
  /** 보통 단계 문제에서 틀리고 힌트를 본 뒤 같은 문제로 돌아온 상태 */
  const retried = (over: Partial<WildState> = {}) => resumeWild(resumeWild(answerWild({ ...at(500), ...over }, false, r0)));
  it('오답·시간 초과면 missed가 켜진다', () => {
    expect(answerWild(at(500), false, r0).missed).toBe(true);
    expect(tick({ ...at(0), timeLeftMs: 100 }, 250, r0)).toMatchObject({ phase: 'struck', missed: true });
  });
  it('틀림 → 힌트 → 같은 문제: 시계가 처음부터라 빨리 풀면 주③', () => {
    const q = retried();
    expect(q).toMatchObject({ phase: 'question', missed: true, elapsedMs: 0 });
    const r = answer(q, ['cloud-1', 'cloud-2', 'cloud-5'], 'main', 'light');
    expect(r).toMatchObject({ upper: true, tier: 3, fired: { id: 'cloud-5' } });
    expect(r.state.cells).toBe(3);
    // 다시 푼 문제에서도 느리면 주①
    expect(answer({ ...q, elapsedMs: 4001 }, ['cloud-1', 'cloud-2', 'cloud-5'], 'main', 'light').fired.id).toBe('cloud-1');
  });
  it('틀림 → 힌트 → 같은 문제: 부속성·특수도 빨리 풀면 발동', () => {
    expect(answer(retried(), ['cloud-1', 'cloud-4'], 'sub', 'light').fired.id).toBe('cloud-4');
    const r = answer(retried(), ['cloud-1', 'cloud-3'], 'special', 'light');
    expect(r).toMatchObject({ usedFallback: false, special: 'heal', fired: { id: 'cloud-3' } });
  });
  it('맞힌 뒤 새 문제에서는 missed가 꺼지고 윗단계 가능 (고르기를 거쳐도)', () => {
    const held = ['cloud-1', 'cloud-2'];
    const hit = answer(retried(), held, 'main', 'light').state;
    const next = resumeWild(hit, 1);
    expect(next.missed).toBe(false);
    expect(answer(next, held, 'main', 'light').upper).toBe(true);
    const picked = pickSkill(resumeWild(hit, 2));
    expect(picked.missed).toBe(false);
  });
  it('빠져나옴·화남 뒤 새 문제는 missed가 꺼진다', () => {
    const d = { ...dizzyOf(createWild('normal', 5, 100)), missed: true };
    expect(throwCapsule(d, seq(0.5), 5)!.state.missed).toBe(false);
    expect(throwCapsule(d, seq(0.999, 0), 10)!.state.missed).toBe(false);
  });
});

describe('wildBattle: 시간 한도 limitMs (시간 막대 기준)', () => {
  it('처음은 그 단계 시간, 여유가 있으면 새 문제의 한도에 더한다', () => {
    expect(createWild('mighty', 5, 100).limitMs).toBe(5000);
    const s = resumeWild({ ...at(0), phase: 'hit', calmMs: CALM_BONUS_MS });
    expect(s).toMatchObject({ limitMs: 10000, timeLeftMs: 10000, calmMs: 0 });
    // 그 다음 새 문제는 다시 7초
    const h = answer(s, ['cloud-1'], 'main', 'light').state;
    expect(resumeWild(h).limitMs).toBe(7000);
  });
  it('화나서 강력이 되면 강력 시간(5초)', () => {
    const d = dizzyOf(createWild('normal', 5, 100));
    expect(throwCapsule(d, seq(0.999, 0), 10)!.state.limitMs).toBe(5000);
  });
});
