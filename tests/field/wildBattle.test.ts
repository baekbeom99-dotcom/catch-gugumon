import { describe, expect, it } from 'vitest';
import {
  answerWild, chipCells, createWild, damageOf, hiddenChoice, MAX_TICK_MS, maxCells, pickSkill, releaseWild, resolveAnswer,
  resumeWild, throwCapsule, tick, tickWild, wildHpRatio,
  type WildState,
} from '../../src/domain/field/wildBattle';
import type { Rng } from '../../src/domain/random';
import { skillDef } from '../../src/domain/field/skills';
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
      tier: 'strong', level: 8, cells: 0, timeLeftMs: 5000, elapsedMs: 0, allyHp: 60, phase: 'question', correct: 0, timedOut: false,
      lastMove: null, charge: 0, guard: false, calmMs: 0, hideChoice: false,
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
  it('적 기술은 rng로 0~2', () => {
    expect(answerWild(createWild('normal', 5, 100), false, () => 0.99).lastMove).toBe(2);
    expect(answerWild(createWild('normal', 5, 100), false, () => 0.5).lastMove).toBe(1);
    expect(answerWild(createWild('normal', 5, 100), false, r0).lastMove).toBe(0);
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

// ── 필드 모험 3차: 칸 체력·위력·강력·특수·상성 (설계서 2-6) ──
const k = (id: string) => skillDef(id);
/** 보통 단계 문제 하나: 경과 시간만 정해 둔다 */
const at = (elapsedMs: number, over: Partial<WildState> = {}): WildState => ({ ...createWild('normal', 5, 100), elapsedMs, ...over });
const NORMAL_MS = 7000;

describe('wildBattle: 칸 체력과 깎는 칸', () => {
  it('maxCells = 어지러워지는 정답 수 × 2', () => {
    expect((['weak', 'normal', 'strong', 'mighty', 'legend'] as const).map(maxCells)).toEqual([6, 8, 8, 12, 8]);
  });
  it('chipCells 경계: 1 아래로도, 4 위로도 안 간다', () => {
    expect(chipCells({ ...k('cloud-1'), basePower: 1 }, false, -1, 0)).toBe(1);
    expect(chipCells(k('cloud-5'), true, 1, 0)).toBe(4); // 3 + 1 + 1 = 5 → 4
    expect(chipCells(k('cloud-1'), false, 0, 0)).toBe(2);
    expect(chipCells(k('cloud-1'), true, 0, 0)).toBe(3);
    expect(chipCells(k('cloud-1'), false, -1, 0)).toBe(1);
    expect(chipCells(k('cloud-1'), false, 0, 1)).toBe(3); // 충전 +1
    expect(chipCells(k('cloud-1'), true, 1, 1)).toBe(4);
  });
  it.each(['weak', 'normal', 'strong', 'mighty', 'legend'] as const)('%s: 가장 센 한 방(4칸)으로도 한 번에 안 끝난다', (t) => {
    const s = { ...createWild(t, 5, 100), charge: 1 };
    const r = resolveAnswer(s, k('cloud-5'), ['cloud-5'], 'water', TIER_RULES[t].timeMs);
    expect(r.fast).toBe(true);
    expect(r.state).toMatchObject({ cells: 4, phase: 'hit' });
  });
  it('어지러워지면 칸은 최대에서 멈춘다', () => {
    const r = resolveAnswer(at(0, { cells: 7 }), k('cloud-5'), ['cloud-5'], 'water', NORMAL_MS);
    expect(r.state).toMatchObject({ cells: 8, phase: 'dizzy', correct: 1 });
  });
  it('answerWild(옛 호출)은 위력 2·보통·강력 아님, 충전은 더한다', () => {
    expect(answerWild(at(0), true, r0).cells).toBe(2);
    expect(answerWild(at(0, { charge: 1 }), true, r0)).toMatchObject({ cells: 3, charge: 0 });
  });
});

describe('wildBattle: resolveAnswer — 강력·상성', () => {
  it('정확히 제한 초면 강력, 1ms 넘으면 아님', () => {
    // 잎사귀 톡: 7초 × 0.6 = 4.2 → 4초
    const fast = resolveAnswer(at(4000), k('cloud-1'), ['cloud-1'], 'light', NORMAL_MS);
    expect(fast).toMatchObject({ fast: true, usedFallback: false });
    expect(fast.fired.id).toBe('cloud-1');
    expect(fast.state).toMatchObject({ cells: 3, correct: 1, phase: 'hit' });
    const slow = resolveAnswer(at(4001), k('cloud-1'), ['cloud-1'], 'light', NORMAL_MS);
    expect(slow.fast).toBe(false);
    expect(slow.state.cells).toBe(2);
  });
  it('상성: 강하면 +1칸, 약하면 −1칸', () => {
    expect(resolveAnswer(at(6000), k('cloud-1'), ['cloud-1'], 'water', NORMAL_MS).state.cells).toBe(3); // 풀 → 물
    expect(resolveAnswer(at(6000), k('cloud-1'), ['cloud-1'], 'fire', NORMAL_MS).state.cells).toBe(1); // 풀 → 불
    expect(resolveAnswer(at(6000), k('cloud-4'), ['cloud-4'], 'poison', NORMAL_MS).state.cells).toBe(2); // 빛 ↔ 독 보통
  });
  it('tickWild는 경과 시간을 센다, 여유로 늘어난 시간은 강력 판정에 안 들어간다', () => {
    let s = resumeWild({ ...at(0), phase: 'hit', calmMs: CALM_BONUS_MS });
    expect(s).toMatchObject({ phase: 'question', timeLeftMs: 10000, elapsedMs: 0, calmMs: 0 });
    for (let i = 0; i < 16; i++) s = tickWild(s, 250, r0);
    expect(s).toMatchObject({ elapsedMs: 4000, timeLeftMs: 6000 });
    expect(resolveAnswer(s, k('cloud-1'), ['cloud-1'], 'light', NORMAL_MS).fast).toBe(true);
    s = tickWild(s, 1, r0);
    expect(resolveAnswer(s, k('cloud-1'), ['cloud-1'], 'light', NORMAL_MS).fast).toBe(false);
  });
  it('question이 아니면 상태 그대로(연타)', () => {
    for (const phase of ['pick', 'hit', 'struck', 'hint', 'dizzy', 'caught', 'escaped', 'released', 'fainted'] as const) {
      const s = at(0, { phase });
      expect(resolveAnswer(s, k('cloud-1'), ['cloud-1'], 'light', NORMAL_MS).state).toBe(s);
    }
  });
});

describe('wildBattle: resolveAnswer — 특수 기술', () => {
  it('조건 안에 풀면 위력 2칸 + 특수 (상성 없음)', () => {
    // 특수: 7초 × 0.5 = 3.5 → 4초
    const r = resolveAnswer(at(4000), k('cloud-3'), ['cloud-1', 'cloud-3'], 'water', NORMAL_MS);
    expect(r).toMatchObject({ fast: true, usedFallback: false, special: 'heal' });
    expect(r.fired.id).toBe('cloud-3');
    expect(r.state.cells).toBe(2);
  });
  it('시간을 넘기면 가장 약한 속성 기술이 대신 (평소 위력·상성, 강력 아님)', () => {
    const r = resolveAnswer(at(4001), k('cloud-3'), ['cloud-5', 'cloud-1', 'cloud-3'], 'water', NORMAL_MS);
    expect(r).toMatchObject({ fast: false, usedFallback: true });
    expect(r.special).toBeUndefined();
    expect(r.fired.id).toBe('cloud-1');
    expect(r.state.cells).toBe(3); // 2 + 풀→물 1
  });
  it('대신 나가는 기술: 위력이 같으면 슬롯 번호가 작은 것', () => {
    expect(resolveAnswer(at(6000), k('cloud-3'), ['cloud-2', 'cloud-4', 'cloud-1', 'cloud-3'], 'light', NORMAL_MS).fired.id).toBe('cloud-1');
    expect(resolveAnswer(at(6000), k('cloud-3'), ['cloud-5', 'cloud-4', 'cloud-3'], 'light', NORMAL_MS).fired.id).toBe('cloud-4');
  });
  it('특수만 가졌으면 늦을 때 위력 1 기본 타격', () => {
    const r = resolveAnswer(at(6000), k('cloud-3'), ['cloud-3'], 'water', NORMAL_MS);
    expect(r).toMatchObject({ fast: false, usedFallback: true });
    expect(r.fired.id).toBe('cloud-3');
    expect(r.special).toBeUndefined();
    expect(r.state.cells).toBe(1);
  });
  it('충전: 다음 속성 기술 +1칸 뒤 사라짐 (특수 성공에는 안 씀)', () => {
    let s = resolveAnswer(at(1000), k('antenna-3'), ['antenna-1', 'antenna-3'], 'light', NORMAL_MS).state;
    expect(s).toMatchObject({ charge: CHARGE_BONUS_CELLS, cells: 2 });
    s = resumeWild(s);
    s = resolveAnswer({ ...s, elapsedMs: 6000 }, k('antenna-1'), ['antenna-1', 'antenna-3'], 'fire', NORMAL_MS).state;
    expect(s).toMatchObject({ charge: 0, cells: 5 }); // 2 + 2 + 충전 1
    const g = resolveAnswer(at(1000, { charge: 1 }), k('mushroom-3'), ['mushroom-3'], 'light', NORMAL_MS).state;
    expect(g).toMatchObject({ charge: 1, cells: 2 });
  });
  it('방어: 다음 적 공격 절반(올림) 뒤 사라짐', () => {
    const s = resolveAnswer(at(1000), k('mushroom-3'), ['mushroom-3'], 'light', NORMAL_MS).state;
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
    const s = resolveAnswer(at(1000), k('jelly-3'), ['jelly-1', 'jelly-3'], 'light', NORMAL_MS).state;
    expect(s.calmMs).toBe(CALM_BONUS_MS);
    const p = resumeWild(s, 2);
    expect(p).toMatchObject({ phase: 'pick', timeLeftMs: 10000, calmMs: 0 });
    expect(pickSkill(p)).toMatchObject({ phase: 'question', timeLeftMs: 10000, elapsedMs: 0 });
  });
  it('힌트: 다음 문제에서 틀린 보기 하나를 숨긴다', () => {
    const s = resolveAnswer(at(1000), k('fluff-3'), ['fluff-1', 'fluff-3'], 'light', NORMAL_MS).state;
    expect(s.hideChoice).toBe(true);
    const q = resumeWild(s);
    expect(q.hideChoice).toBe(true);
    // 틀려서 같은 문제를 다시 풀 때도 숨긴 채
    expect(resumeWild(resumeWild(answerWild(q, false, r0))).hideChoice).toBe(true);
    // 그 문제를 맞히면 사라짐
    expect(resolveAnswer(at(6000, { hideChoice: true }), k('fluff-1'), ['fluff-1'], 'light', NORMAL_MS).state.hideChoice).toBe(false);
    expect(hiddenChoice([3, 6, 9], 6, r0)).toBe(0);
    expect(hiddenChoice([3, 6, 9], 6, () => 0.99)).toBe(2);
    expect(hiddenChoice([6, 3, 9], 6, r0)).toBe(1);
    expect(hiddenChoice([6], 6, r0)).toBeNull();
  });
  it('회복: special만 알려 주고 내 체력은 그대로', () => {
    const r = resolveAnswer(at(1000, { allyHp: 40 }), k('cloud-3'), ['cloud-3'], 'light', NORMAL_MS);
    expect(r.special).toBe('heal');
    expect(r.state.allyHp).toBe(40);
  });
});

describe('wildBattle: 기술 고르기(pick)', () => {
  it('기술이 2개 이상이면 첫 문제도 고르기부터', () => {
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
  it('명중 뒤: 기술 1개면 고르기를 건너뛴다', () => {
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
