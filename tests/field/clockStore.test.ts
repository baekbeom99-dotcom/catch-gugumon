import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useGameStore } from '../../src/store/useGameStore';
import { createInitialSave, mergeSave } from '../../src/store/saveData';
import { initialField, mergeField, mergeTraining, newSpeciesEntry } from '../../src/store/fieldData';
import { emptyTraining, type TrainingData } from '../../src/domain/field/training';
import { LEGEND_SPECIES } from '../../src/domain/field/speciesIds';
import {
  ARITH_CAPSULE_CHOICES,
  CLOCK_TRAINER_MASTER_MS,
  LEGEND_LEVEL,
  STAR_LEGEND_REWARD,
  STAR_TRAINING,
  TRAINING_CAPSULES,
  TRAINING_FIRST_MASTER_CAPSULES,
} from '../../src/domain/field/tuning';
import { currentSave } from '../../src/screens/admin/DataSecurityPanels';

const NOW = new Date('2026-11-27T09:00:00').getTime();
const g = globalThis as { __GUGU_E2E_STARS__?: unknown };
const st = () => useGameStore.getState();
const clock = () => st().finishClockTraining;
const caps = () => st().field.capsules;
const totalCaps = () => Object.values(caps()).reduce((a, b) => a + b, 0);

function setTraining(t: Partial<TrainingData>) {
  useGameStore.setState({ field: { ...st().field, training: { ...emptyTraining(), ...t } } });
}

beforeEach(() => {
  st().resetAll();
  g.__GUGU_E2E_STARS__ = false;
});
afterEach(() => {
  g.__GUGU_E2E_STARS__ = false;
});

describe('finishClockTraining', () => {
  it('정각 첫 합격 → 기록·무작위 필드 캡슐 20개, 다시 합격하면 5개', () => {
    const c0 = totalCaps();
    const r1 = clock()({ level: 'hour', mistakes: 0, timeMs: 20_000, now: NOW, rng: () => 0 });
    expect(r1).toEqual({
      ok: true,
      capsuleType: ARITH_CAPSULE_CHOICES[0],
      capsules: TRAINING_FIRST_MASTER_CAPSULES,
      mastered: true,
      firstMaster: true,
      newBest: true,
      bestMs: 20_000,
      legend: null,
      stars: 0,
    });
    expect(TRAINING_FIRST_MASTER_CAPSULES).toBe(20);
    expect(caps().meadow).toBe(initialField().capsules.meadow + 20);
    expect(st().field.training.clock.hour).toEqual({ bestMs: 20_000, at: NOW });
    // 두 번째: 5개, 더 느리면 기록 그대로
    const r2 = clock()({ level: 'hour', mistakes: 0, timeMs: 25_000, now: NOW + 1, rng: () => 0.99 });
    expect(r2).toMatchObject({ ok: true, capsuleType: 'desert', capsules: TRAINING_CAPSULES, firstMaster: false, newBest: false, bestMs: 20_000 });
    expect(TRAINING_CAPSULES).toBe(5);
    expect(totalCaps()).toBe(c0 + 25);
    expect(st().field.training.clock.hour).toEqual({ bestMs: 20_000, at: NOW });
    // 더 빠르면 기록이 좋아진다
    const r3 = clock()({ level: 'hour', mistakes: 0, timeMs: 10_000, now: NOW + 2, rng: () => 0.5 });
    expect(r3).toMatchObject({ newBest: true, bestMs: 10_000, capsules: 5 });
    expect(st().field.training.clock.hour).toEqual({ bestMs: 10_000, at: NOW + 2 });
    // 셈연습 기록과는 따로
    expect(st().field.training.arith).toEqual({});
  });

  it('틀림·느림·이상한 시간은 아무것도 주지 않는다 (저장 그대로)', () => {
    const before = st().field;
    const runs = [
      { mistakes: 1, timeMs: 1000 },
      { mistakes: 0, timeMs: CLOCK_TRAINER_MASTER_MS.hour + 1 },
      { mistakes: 0, timeMs: NaN },
      { mistakes: 0, timeMs: -5 },
      { mistakes: NaN, timeMs: 1000 },
    ];
    for (const run of runs) {
      g.__GUGU_E2E_STARS__ = true;
      const r = clock()({ level: 'hour', ...run, now: NOW, rng: () => 0 });
      expect(r).toEqual({
        ok: true,
        capsuleType: null,
        capsules: 0,
        mastered: false,
        firstMaster: false,
        newBest: false,
        bestMs: null,
        legend: null,
        stars: 0,
      });
    }
    expect(st().field).toBe(before);
  });

  it('실패해도 이미 있던 최고 기록은 알려 준다', () => {
    setTraining({ clock: { hour: { bestMs: 12_000, at: NOW } } });
    const r = clock()({ level: 'hour', mistakes: 2, timeMs: 1000, now: NOW, rng: () => 0 });
    expect(r).toMatchObject({ ok: true, capsules: 0, bestMs: 12_000 });
  });

  it('열리지 않은 단계(5분·1분)는 거부하고 아무것도 바꾸지 않는다', () => {
    const before = st().field;
    for (const level of ['five', 'one'] as const) {
      const r = clock()({ level, mistakes: 0, timeMs: 1000, now: NOW, rng: () => 0 });
      expect(r).toMatchObject({ ok: false, capsules: 0, capsuleType: null, mastered: false, legend: null, stars: 0 });
    }
    const unknown = clock()({ level: 'super' as never, mistakes: 0, timeMs: 1000, now: NOW, rng: () => 0 });
    expect(unknown.ok).toBe(false);
    expect(st().field).toBe(before);
    // 정각을 마스터하면 5분이 열린다, 1분은 아직
    clock()({ level: 'hour', mistakes: 0, timeMs: 1000, now: NOW, rng: () => 0 });
    expect(clock()({ level: 'one', mistakes: 0, timeMs: 1000, now: NOW, rng: () => 0 }).ok).toBe(false);
    expect(clock()({ level: 'five', mistakes: 0, timeMs: 1000, now: NOW, rng: () => 0 })).toMatchObject({ ok: true, firstMaster: true, capsules: 20 });
    expect(clock()({ level: 'one', mistakes: 0, timeMs: 1000, now: NOW, rng: () => 0 }).ok).toBe(true);
  });

  it('1분 첫 마스터 → 레전드 한 마리 (legendGranted.clockOne), 두 번째는 없음', () => {
    setTraining({ clock: { hour: { bestMs: 1, at: NOW }, five: { bestMs: 1, at: NOW } } });
    const r = clock()({ level: 'one', mistakes: 0, timeMs: CLOCK_TRAINER_MASTER_MS.one, now: NOW, rng: () => 0 });
    expect(r).toMatchObject({ ok: true, mastered: true, firstMaster: true, capsules: 20 });
    expect(r.legend).toEqual({ species: LEGEND_SPECIES[0], duplicate: false });
    const f = st().field;
    expect(f.training.legendGranted.clockOne).toBe(LEGEND_SPECIES[0]);
    expect(f.species[LEGEND_SPECIES[0]]).toEqual(newSpeciesEntry(LEGEND_SPECIES[0], LEGEND_LEVEL, NOW));
    expect(f.seen).toContain(LEGEND_SPECIES[0]);
    const again = clock()({ level: 'one', mistakes: 0, timeMs: 1000, now: NOW + 1, rng: () => 0 });
    expect(again).toMatchObject({ ok: true, firstMaster: false, capsules: 5, legend: null });
    // 다른 레전드 몫과는 따로
    expect(st().field.training.legendGranted.arithHard).toBeUndefined();
    expect(st().field.training.legendGranted[12]).toBeUndefined();
  });

  it('정각·5분 합격에는 레전드가 없다', () => {
    clock()({ level: 'hour', mistakes: 0, timeMs: 1000, now: NOW, rng: () => 0 });
    const r = clock()({ level: 'five', mistakes: 0, timeMs: 1000, now: NOW, rng: () => 0 });
    expect(r.legend).toBeNull();
    expect(st().field.training.legendGranted).toEqual({});
  });

  it('별점수: 꺼져 있으면 0, 켜져 있으면 STAR_TRAINING (1분 첫 마스터는 + 레전드 별)', () => {
    const off = clock()({ level: 'hour', mistakes: 0, timeMs: 1000, now: NOW, rng: () => 0 });
    expect(off.stars).toBe(0);
    expect(st().field.starPoints).toBe(initialField().starPoints);
    st().resetAll();
    g.__GUGU_E2E_STARS__ = true;
    const start = st().field.starPoints;
    const on = clock()({ level: 'hour', mistakes: 0, timeMs: 1000, now: NOW, rng: () => 0 });
    expect(on.stars).toBe(STAR_TRAINING);
    expect(st().field.starPoints).toBe(start + STAR_TRAINING);
    clock()({ level: 'five', mistakes: 0, timeMs: 1000, now: NOW, rng: () => 0 });
    const one = clock()({ level: 'one', mistakes: 0, timeMs: 1000, now: NOW, rng: () => 0 });
    expect(one.stars).toBe(STAR_TRAINING + STAR_LEGEND_REWARD);
  });
});

describe('시계 기록 저장', () => {
  it('옛 저장(clock 없음)은 {}로 채워진다', () => {
    const base = createInitialSave(NOW);
    const oldTraining = { studied: { 2: true }, mastered: {}, legendGranted: {}, arith: {} };
    const merged = mergeSave(createInitialSave(NOW), { ...base, field: { ...initialField(), training: oldTraining } });
    expect(merged.field.training.clock).toEqual({});
    expect(merged.field.training.studied).toEqual({ 2: true });
    expect(createInitialSave(NOW).field.training.clock).toEqual({});
  });

  it('깨진 clock 값은 버리고 맞는 값만 남긴다 (던지지 않음)', () => {
    const t = mergeTraining({
      clock: {
        hour: { bestMs: 20_000, at: NOW },
        five: { bestMs: 'fast', at: NOW },
        one: { bestMs: -1, at: NOW },
        ten: { bestMs: 1, at: 1 },
        __proto__: { bestMs: 1, at: 1 },
      },
      legendGranted: { clockOne: LEGEND_SPECIES[1], arithHard: 'nope' },
    });
    expect(t.clock).toEqual({ hour: { bestMs: 20_000, at: NOW } });
    expect(t.legendGranted).toEqual({ clockOne: LEGEND_SPECIES[1] });
    for (const bad of [null, 'x', 5, [], { clock: 'broken' }, { clock: [1, 2] }, { clock: { hour: null } }, { legendGranted: { clockOne: 'c001' } }]) {
      expect(() => mergeTraining(bad)).not.toThrow();
      const m = mergeTraining(bad);
      expect(m.clock).toEqual({});
      expect(m.legendGranted.clockOne).toBeUndefined();
    }
    expect(mergeField(initialField(), { ...initialField(), training: { clock: { one: { bestMs: 5, at: 6 } } } }).training.clock).toEqual({
      one: { bestMs: 5, at: 6 },
    });
  });

  it('백업(currentSave)·불러오기(replaceSave)에 시계 기록이 함께 간다', () => {
    clock()({ level: 'hour', mistakes: 0, timeMs: 1234, now: NOW, rng: () => 0 });
    setTraining({
      ...st().field.training,
      clock: { hour: { bestMs: 1234, at: NOW }, five: { bestMs: 2, at: NOW }, one: { bestMs: 3, at: NOW } },
      legendGranted: { clockOne: LEGEND_SPECIES[2] },
    });
    const backup = JSON.parse(JSON.stringify(currentSave()));
    st().resetAll();
    expect(st().field.training.clock).toEqual({});
    st().replaceSave(backup);
    expect(st().field.training.clock).toEqual({ hour: { bestMs: 1234, at: NOW }, five: { bestMs: 2, at: NOW }, one: { bestMs: 3, at: NOW } });
    expect(st().field.training.legendGranted.clockOne).toBe(LEGEND_SPECIES[2]);
  });
});
