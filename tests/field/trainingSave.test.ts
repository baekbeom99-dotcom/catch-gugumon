import { beforeEach, describe, expect, it } from 'vitest';
import { createInitialSave, mergeSave } from '../../src/store/saveData';
import { initialField, mergeField, newSpeciesEntry } from '../../src/store/fieldData';
import { useGameStore } from '../../src/store/useGameStore';
import { emptyTraining, type TrainingData } from '../../src/domain/field/training';
import { LEGEND_SPECIES } from '../../src/domain/field/speciesIds';
import {
  ARITH_CAPSULE_CHOICES,
  ARITH_TRAINER_MASTER_MS,
  LEGEND_LEVEL,
  TOWN_ROWS_ADDED,
  TRAINING_CAPSULE_OF_DAN,
  TRAINING_CAPSULES,
  TRAINING_FIRST_MASTER_CAPSULES,
  TRAINING_MASTER_MS,
} from '../../src/domain/field/tuning';
import { DUPLICATE_EXP } from '../../src/domain/field/growth';
import { seededRng } from '../../src/domain/random';
import { currentSave } from '../../src/screens/admin/DataSecurityPanels';

const NOW = new Date('2026-11-18T09:00:00').getTime();

/** 트레이닝센터가 생기기 전의 필드 저장 (training 칸 없음) */
function oldField(position: { map: string; x: number; y: number; facing: string }) {
  const { training: _t, ...rest } = initialField() as unknown as Record<string, unknown>;
  return { ...rest, position };
}

function setTraining(t: Partial<TrainingData>) {
  const s = useGameStore.getState();
  useGameStore.setState({ field: { ...s.field, training: { ...emptyTraining(), ...t } } });
}

const fin = () => useGameStore.getState().finishTraining;

describe('트레이닝 저장 데이터', () => {
  it('(a) 옛 저장(training 없음)을 합치면 빈 훈련 기록', () => {
    const base = createInitialSave(NOW);
    const old = { ...base, field: oldField({ map: 'meadow', x: 3, y: 4, facing: 'up' }) };
    const merged = mergeSave(createInitialSave(NOW), old);
    expect(merged.field.training).toEqual(emptyTraining());
    expect(createInitialSave(NOW).field.training).toEqual(emptyTraining());
  });

  it('(a) 깨진 값은 버리고 맞는 값만 남긴다', () => {
    const f = {
      ...initialField(),
      training: {
        studied: { 2: true, 3: 'yes', 10: true, x: true },
        mastered: { 2: { bestMs: 20000, at: NOW }, 3: { bestMs: 'fast', at: NOW }, 10: { bestMs: 1, at: 1 } },
        legendGranted: { 12: LEGEND_SPECIES[0], 13: 'nope', 9: LEGEND_SPECIES[1] },
      },
    };
    expect(mergeField(initialField(), f).training).toEqual({
      studied: { 2: true },
      mastered: { 2: { bestMs: 20000, at: NOW } },
      legendGranted: { 12: LEGEND_SPECIES[0] },
      arith: {},
    });
    expect(mergeField(initialField(), { ...initialField(), training: 'broken' }).training).toEqual(emptyTraining());
  });

  it('(a) 11단 기록은 버린다 (11단이 없어졌다)', () => {
    const f = {
      ...initialField(),
      training: { studied: { 11: true, 9: true }, mastered: { 11: { bestMs: 1, at: NOW } }, legendGranted: {} },
    };
    expect(mergeField(initialField(), f).training).toEqual({ ...emptyTraining(), studied: { 9: true } });
  });

  it('(a) 셈연습 기록: 맞는 값만 남기고 깨진 값·모르는 단계는 버린다', () => {
    const f = {
      ...initialField(),
      training: {
        studied: {},
        mastered: {},
        legendGranted: { arithHard: LEGEND_SPECIES[2] },
        arith: {
          basic: { bestMs: 21000, at: NOW },
          hard: { bestMs: -1, at: NOW },
          comp: { bestMs: 'fast', at: NOW },
          super: { bestMs: 1000, at: NOW },
          constructor: { bestMs: 1, at: 1 },
        },
      },
    };
    expect(mergeField(initialField(), f).training).toEqual({
      ...emptyTraining(),
      legendGranted: { arithHard: LEGEND_SPECIES[2] },
      arith: { basic: { bestMs: 21000, at: NOW } },
    });
    // 숫자가 아닌 at, 무한대, 배열·문자열 칸
    const bad = (arith: unknown, legendGranted: unknown = {}) =>
      mergeField(initialField(), { ...initialField(), training: { studied: {}, mastered: {}, legendGranted, arith } }).training;
    expect(bad({ basic: { bestMs: 1000, at: 'now' } }).arith).toEqual({});
    expect(bad({ basic: { bestMs: Infinity, at: NOW } }).arith).toEqual({});
    expect(bad('broken').arith).toEqual({});
    expect(bad([1, 2]).arith).toEqual({});
    // 셈연습 레전드: 모르는 종·레전드가 아닌 종은 버린다
    expect(bad({}, { arithHard: 'nope' }).legendGranted).toEqual({});
    expect(bad({}, { arithHard: 'c034' }).legendGranted).toEqual({});
    expect(bad({}, { arithHard: 7 }).legendGranted).toEqual({});
  });

  it('(b) 옛 마을 위치는 TOWN_ROWS_ADDED만큼 아래로, 다른 지도는 그대로', () => {
    const town = oldField({ map: 'town', x: 5, y: 7, facing: 'down' });
    expect(mergeField(initialField(), town).position).toEqual({ map: 'town', x: 5, y: 7 + TOWN_ROWS_ADDED, facing: 'down' });
    // 실제 밀기 계산은 줄 수를 넘겨서 확인 (TOWN_ROWS_ADDED가 아직 0이어도)
    expect(mergeField(initialField(), town, 4).position.y).toBe(11);
    const meadow = oldField({ map: 'meadow', x: 5, y: 7, facing: 'down' });
    expect(mergeField(initialField(), meadow, 4).position).toEqual({ map: 'meadow', x: 5, y: 7, facing: 'down' });
  });

  it('(b) 이미 옮긴 저장(training 있음)은 다시 합쳐도 두 번 옮기지 않는다', () => {
    const once = mergeField(initialField(), oldField({ map: 'town', x: 5, y: 7, facing: 'down' }), 4);
    expect(once.position.y).toBe(11);
    const twice = mergeField(initialField(), JSON.parse(JSON.stringify(once)), 4);
    expect(twice.position.y).toBe(11);
  });

  it('옛 백업(마을 자리, training 없음)을 replaceSave로 불러오면 한 번만 옮겨진다', () => {
    useGameStore.getState().resetAll();
    const old = { ...createInitialSave(NOW), field: oldField({ map: 'town', x: 5, y: 7, facing: 'down' }) };
    useGameStore.getState().replaceSave(old);
    expect(useGameStore.getState().field.position.y).toBe(7 + TOWN_ROWS_ADDED);
    expect(useGameStore.getState().field.training).toEqual(emptyTraining());
    // 저장된 상태를 다시 읽어 합쳐도(training이 이미 있다) 더 밀리지 않는다
    useGameStore.getState().replaceSave(JSON.parse(JSON.stringify(currentSave())));
    expect(useGameStore.getState().field.position.y).toBe(7 + TOWN_ROWS_ADDED);
  });

  it('백업(currentSave)에 훈련 기록이 들어간다', () => {
    useGameStore.getState().resetAll();
    setTraining({ studied: { 2: true } });
    expect(currentSave().field.training.studied).toEqual({ 2: true });
  });
});

describe('finishTraining', () => {
  beforeEach(() => {
    useGameStore.getState().resetAll();
  });

  it('(c) 학습을 마치면 studied 켜짐, 그 단 캡슐 5개, 마스터 없음, 별 0', () => {
    const before = useGameStore.getState().field.capsules[TRAINING_CAPSULE_OF_DAN[2]];
    const r = fin()({ dan: 2, mode: 'study', mistakes: 2, timeMs: 60_000, now: NOW });
    const f = useGameStore.getState().field;
    expect(r).toEqual({
      ok: true,
      capsuleType: TRAINING_CAPSULE_OF_DAN[2],
      capsules: TRAINING_CAPSULES,
      mastered: false,
      firstMaster: false,
      newBest: false,
      bestMs: null,
      legend: null,
      stars: 0,
    });
    expect(f.training.studied[2]).toBe(true);
    expect(f.training.mastered[2]).toBeUndefined();
    expect(f.capsules[TRAINING_CAPSULE_OF_DAN[2]]).toBe(before + TRAINING_CAPSULES);
    // 학습을 또 끝내도 5개 (마스터가 아니라서 20개가 아니다)
    const again = fin()({ dan: 2, mode: 'study', mistakes: 0, timeMs: 30_000, now: NOW + 1 });
    expect(again).toMatchObject({ capsules: TRAINING_CAPSULES, firstMaster: false });
    expect(useGameStore.getState().field.capsules[TRAINING_CAPSULE_OF_DAN[2]]).toBe(before + 2 * TRAINING_CAPSULES);
  });

  it('(d) 첫 합격은 캡슐 20개(5개를 더하지 않음), 두 번째부터 5개, 최고 기록은 더 빠를 때만', () => {
    expect(TRAINING_FIRST_MASTER_CAPSULES).toBe(20);
    setTraining({ studied: { 2: true } });
    const type = TRAINING_CAPSULE_OF_DAN[2];
    const c0 = useGameStore.getState().field.capsules[type];
    const r1 = fin()({ dan: 2, mode: 'challenge', mistakes: 0, timeMs: 20_000, now: NOW });
    expect(r1).toMatchObject({ ok: true, mastered: true, firstMaster: true, newBest: true, bestMs: 20_000, capsules: 20, stars: 0 });
    expect(useGameStore.getState().field.capsules[type]).toBe(c0 + 20);
    expect(useGameStore.getState().field.training.mastered[2]).toEqual({ bestMs: 20_000, at: NOW });
    // 두 번째 합격: 5개. 더 느리면 기록은 그대로
    const r2 = fin()({ dan: 2, mode: 'challenge', mistakes: 0, timeMs: 25_000, now: NOW + 1 });
    expect(r2).toMatchObject({ mastered: true, firstMaster: false, newBest: false, bestMs: 20_000, capsules: 5 });
    expect(useGameStore.getState().field.training.mastered[2]).toEqual({ bestMs: 20_000, at: NOW });
    // 더 빠르면 바뀐다 (그래도 첫 마스터는 아니라 5개)
    const r3 = fin()({ dan: 2, mode: 'challenge', mistakes: 0, timeMs: 15_000, now: NOW + 2 });
    expect(r3).toMatchObject({ mastered: true, firstMaster: false, newBest: true, bestMs: 15_000, capsules: 5 });
    expect(useGameStore.getState().field.training.mastered[2]).toEqual({ bestMs: 15_000, at: NOW + 2 });
    expect(useGameStore.getState().field.capsules[type]).toBe(c0 + 20 + 5 + 5);
  });

  it('(e) 도전 실패(틀림·느림)는 캡슐 없음, 마스터 없음, 저장도 그대로', () => {
    setTraining({ studied: { 3: true }, mastered: { 2: { bestMs: 20_000, at: NOW } } });
    const before = useGameStore.getState().field;
    const wrong = fin()({ dan: 3, mode: 'challenge', mistakes: 1, timeMs: 10_000, now: NOW });
    const slow = fin()({ dan: 3, mode: 'challenge', mistakes: 0, timeMs: TRAINING_MASTER_MS + 1, now: NOW });
    for (const r of [wrong, slow])
      expect(r).toEqual({
        ok: true,
        capsuleType: TRAINING_CAPSULE_OF_DAN[3],
        capsules: 0,
        mastered: false,
        firstMaster: false,
        newBest: false,
        bestMs: null,
        legend: null,
        stars: 0,
      });
    expect(useGameStore.getState().field.training.mastered[3]).toBeUndefined();
    expect(useGameStore.getState().field.capsules).toEqual(before.capsules);
    // 실패 뒤 처음 합격하면 그때 20개
    const pass = fin()({ dan: 3, mode: 'challenge', mistakes: 0, timeMs: 20_000, now: NOW });
    expect(pass).toMatchObject({ firstMaster: true, capsules: 20 });
  });

  it('(f) 12단 첫 합격 → 황금 캡슐 20개 + 레전드(새 종 LEGEND_LEVEL), 두 번째는 5개·레전드 없음', () => {
    setTraining({ studied: { 12: true }, mastered: { 9: { bestMs: 1, at: NOW } } });
    const c0 = useGameStore.getState().field.capsules.legend;
    const r = fin()({ dan: 12, mode: 'challenge', mistakes: 0, timeMs: 20_000, now: NOW, rng: () => 0 });
    expect(r).toMatchObject({ capsuleType: 'legend', capsules: 20, firstMaster: true });
    expect(r.legend).toEqual({ species: LEGEND_SPECIES[0], duplicate: false });
    const f = useGameStore.getState().field;
    expect(f.training.legendGranted[12]).toBe(LEGEND_SPECIES[0]);
    expect(f.species[LEGEND_SPECIES[0]]).toEqual(newSpeciesEntry(LEGEND_SPECIES[0], LEGEND_LEVEL, NOW));
    expect(f.seen).toContain(LEGEND_SPECIES[0]);
    expect(f.capsules.legend).toBe(c0 + 20);
    const again = fin()({ dan: 12, mode: 'challenge', mistakes: 0, timeMs: 19_000, now: NOW + 1, rng: () => 0 });
    expect(again.legend).toBeNull();
    expect(again).toMatchObject({ mastered: true, firstMaster: false, capsules: 5 });
    expect(useGameStore.getState().field.capsules.legend).toBe(c0 + 25);
  });

  it('(f) 레전드를 다 가졌으면 중복 보상(DUPLICATE_EXP)', () => {
    const s = useGameStore.getState();
    const species = { ...s.field.species };
    for (const id of LEGEND_SPECIES) species[id] = newSpeciesEntry(id, LEGEND_LEVEL, NOW);
    useGameStore.setState({ field: { ...s.field, species } });
    setTraining({ studied: { 13: true }, mastered: { 12: { bestMs: 1, at: NOW } } });
    const r = fin()({ dan: 13, mode: 'challenge', mistakes: 0, timeMs: 20_000, now: NOW, rng: () => 0 });
    expect(r.legend).toEqual({ species: LEGEND_SPECIES[0], duplicate: true });
    const e = useGameStore.getState().field.species[LEGEND_SPECIES[0]]!;
    expect(e.caught).toBe(2);
    // 경험치가 들어갔다 (레벨이 오르면 exp가 줄 수 있어 레벨·exp를 함께 본다)
    expect(e.level > LEGEND_LEVEL || e.exp === DUPLICATE_EXP).toBe(true);
    expect(useGameStore.getState().field.training.legendGranted[13]).toBe(LEGEND_SPECIES[0]);
  });

  it('(f) 2~9단 마스터에는 레전드가 없다', () => {
    setTraining({ studied: { 9: true }, mastered: { 8: { bestMs: 1, at: NOW } } });
    const r = fin()({ dan: 9, mode: 'challenge', mistakes: 0, timeMs: 20_000, now: NOW, rng: () => 0 });
    expect(r.mastered).toBe(true);
    expect(r.legend).toBeNull();
    expect(r.capsuleType).toBe(TRAINING_CAPSULE_OF_DAN[9]);
  });

  it('(g) 학습 전 도전·열리지 않은 단·11단은 거부하고 아무것도 바꾸지 않는다', () => {
    const before = useGameStore.getState().field;
    const r = fin()({ dan: 2, mode: 'challenge', mistakes: 0, timeMs: 10_000, now: NOW });
    expect(r).toEqual({
      ok: false,
      capsuleType: TRAINING_CAPSULE_OF_DAN[2],
      capsules: 0,
      mastered: false,
      firstMaster: false,
      newBest: false,
      bestMs: null,
      legend: null,
      stars: 0,
    });
    expect(useGameStore.getState().field).toBe(before);
    // 3단은 2단을 마스터하기 전에는 학습도 안 된다
    const r2 = fin()({ dan: 3, mode: 'study', mistakes: 0, timeMs: 10_000, now: NOW });
    expect(r2.ok).toBe(false);
    expect(useGameStore.getState().field).toBe(before);
    // 없어진 11단은 9단을 마스터해도 거부
    setTraining({ studied: { 9: true }, mastered: { 9: { bestMs: 1, at: NOW } } });
    const mid = useGameStore.getState().field;
    const r3 = fin()({ dan: 11 as never, mode: 'study', mistakes: 0, timeMs: 10_000, now: NOW });
    expect(r3).toMatchObject({ ok: false, capsules: 0 });
    expect(useGameStore.getState().field).toBe(mid);
  });
});

describe('finishArithTraining', () => {
  beforeEach(() => {
    useGameStore.getState().resetAll();
  });
  const arith = () => useGameStore.getState().finishArithTraining;
  const caps = () => useGameStore.getState().field.capsules;

  it('기본 첫 합격 → 무작위 필드 캡슐 20개(시드 고정), 두 번째 합격 5개, 레전드 없음', () => {
    const c0 = caps();
    // rng 0 → ARITH_CAPSULE_CHOICES[0] (초원)
    const r1 = arith()({ level: 'basic', mistakes: 0, timeMs: 20_000, now: NOW, rng: () => 0 });
    expect(r1).toEqual({
      ok: true,
      capsuleType: ARITH_CAPSULE_CHOICES[0],
      capsules: 20,
      mastered: true,
      firstMaster: true,
      newBest: true,
      bestMs: 20_000,
      legend: null,
      stars: 0,
    });
    expect(caps().meadow).toBe(c0.meadow + 20);
    expect(useGameStore.getState().field.training.arith.basic).toEqual({ bestMs: 20_000, at: NOW });
    // rng 0.99 → 마지막 (사막), 두 번째라 5개, 더 느려서 기록 그대로
    const r2 = arith()({ level: 'basic', mistakes: 0, timeMs: 25_000, now: NOW + 1, rng: () => 0.99 });
    expect(r2).toMatchObject({ ok: true, capsuleType: 'desert', capsules: 5, mastered: true, firstMaster: false, newBest: false, bestMs: 20_000, legend: null });
    expect(caps().desert).toBe(c0.desert + 5);
    expect(caps().meadow).toBe(c0.meadow + 20);
    expect(caps().legend).toBe(c0.legend);
    // 더 빠르면 기록이 바뀐다
    const r3 = arith()({ level: 'basic', mistakes: 0, timeMs: 10_000, now: NOW + 2, rng: () => 0.5 });
    expect(r3).toMatchObject({ newBest: true, bestMs: 10_000, capsules: 5, capsuleType: 'waterside' });
    expect(useGameStore.getState().field.training.arith.basic).toEqual({ bestMs: 10_000, at: NOW + 2 });
  });

  it('무작위 캡슐은 필드 3종 중 하나 (황금 없음), 같은 시드면 같은 종류', () => {
    for (let seed = 1; seed <= 20; seed++) {
      useGameStore.getState().resetAll();
      const a = arith()({ level: 'comp', mistakes: 0, timeMs: 1000, now: NOW, rng: seededRng(seed) });
      useGameStore.getState().resetAll();
      const b = arith()({ level: 'comp', mistakes: 0, timeMs: 1000, now: NOW, rng: seededRng(seed) });
      expect(ARITH_CAPSULE_CHOICES as readonly string[]).toContain(a.capsuleType);
      expect(a.capsuleType).not.toBe('legend');
      expect(a.capsuleType).toBe(b.capsuleType);
    }
  });

  it('실패(틀림·느림)는 캡슐 0, 저장 그대로', () => {
    const before = useGameStore.getState().field;
    const wrong = arith()({ level: 'basic', mistakes: 1, timeMs: 1000, now: NOW, rng: () => 0 });
    const slow = arith()({ level: 'hard', mistakes: 0, timeMs: ARITH_TRAINER_MASTER_MS.hard + 1, now: NOW, rng: () => 0 });
    for (const r of [wrong, slow])
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
    expect(useGameStore.getState().field).toBe(before);
  });

  it('고수 첫 합격 → 레전드 1마리(legendGranted.arithHard), 두 번째는 없음', () => {
    const r = arith()({ level: 'hard', mistakes: 0, timeMs: ARITH_TRAINER_MASTER_MS.hard, now: NOW, rng: () => 0 });
    expect(r).toMatchObject({ ok: true, mastered: true, firstMaster: true, capsules: 20 });
    expect(r.legend).toEqual({ species: LEGEND_SPECIES[0], duplicate: false });
    const f = useGameStore.getState().field;
    expect(f.training.legendGranted.arithHard).toBe(LEGEND_SPECIES[0]);
    expect(f.species[LEGEND_SPECIES[0]]).toEqual(newSpeciesEntry(LEGEND_SPECIES[0], LEGEND_LEVEL, NOW));
    expect(f.seen).toContain(LEGEND_SPECIES[0]);
    const again = arith()({ level: 'hard', mistakes: 0, timeMs: 30_000, now: NOW + 1, rng: () => 0 });
    expect(again).toMatchObject({ ok: true, mastered: true, firstMaster: false, capsules: 5, legend: null });
    // 12단 레전드 몫과는 따로
    expect(useGameStore.getState().field.training.legendGranted[12]).toBeUndefined();
  });

  it('고수 레전드를 다 가졌으면 중복 보상(DUPLICATE_EXP)', () => {
    const s = useGameStore.getState();
    const species = { ...s.field.species };
    for (const id of LEGEND_SPECIES) species[id] = newSpeciesEntry(id, LEGEND_LEVEL, NOW);
    useGameStore.setState({ field: { ...s.field, species } });
    const r = arith()({ level: 'hard', mistakes: 0, timeMs: 30_000, now: NOW, rng: () => 0 });
    expect(r.legend).toEqual({ species: LEGEND_SPECIES[0], duplicate: true });
    expect(useGameStore.getState().field.species[LEGEND_SPECIES[0]]!.caught).toBe(2);
  });

  it('기본·보수 합격에는 레전드가 없다', () => {
    for (const level of ['basic', 'comp'] as const) {
      const r = arith()({ level, mistakes: 0, timeMs: 1000, now: NOW, rng: () => 0 });
      expect(r.legend).toBeNull();
    }
    expect(useGameStore.getState().field.training.legendGranted).toEqual({});
  });

  it('모르는 단계는 거부(ok false)하고 아무것도 바꾸지 않는다', () => {
    const before = useGameStore.getState().field;
    const r = arith()({ level: 'super' as never, mistakes: 0, timeMs: 1000, now: NOW, rng: () => 0 });
    expect(r).toEqual({
      ok: false,
      capsuleType: null,
      capsules: 0,
      mastered: false,
      firstMaster: false,
      newBest: false,
      bestMs: null,
      legend: null,
      stars: 0,
    });
    expect(useGameStore.getState().field).toBe(before);
  });

  it('백업(currentSave)에 셈연습 기록이 들어간다', () => {
    arith()({ level: 'comp', mistakes: 0, timeMs: 5000, now: NOW, rng: () => 0 });
    expect(currentSave().field.training.arith.comp).toEqual({ bestMs: 5000, at: NOW });
    // 저장을 다시 읽어도 그대로
    useGameStore.getState().replaceSave(JSON.parse(JSON.stringify(currentSave())));
    expect(useGameStore.getState().field.training.arith.comp).toEqual({ bestMs: 5000, at: NOW });
  });
});

describe('recordTrainingAnswer', () => {
  beforeEach(() => {
    useGameStore.getState().resetAll();
  });

  it('(h) 별·펫은 그대로, 그 문제 기록만 바뀐다 (틀린 문제 기록)', () => {
    const s = useGameStore.getState();
    const stars = s.economy.stars;
    const pet = s.pet;
    s.recordTrainingAnswer(7, 3, false, 2500, NOW);
    const after = useGameStore.getState();
    expect(after.economy.stars).toBe(stars);
    expect(after.economy).toBe(s.economy);
    expect(after.pet).toBe(pet);
    expect(after.learning.facts['7x3'].attempts).toBe(1);
    expect(after.learning.facts['7x3'].lastWrongAt).toBe(NOW);
    // 다른 문제는 그대로
    expect(after.learning.facts['7x4']).toEqual(s.learning.facts['7x4']);
    s.recordTrainingAnswer(12, 5, true, 2000, NOW);
    expect(useGameStore.getState().learning.facts['12x5'].correct).toBe(1);
  });

  it('isRetry=true면 맞혀도 상자가 오르지 않고(시도·정답 수는 센다), 아니면 오른다', () => {
    const s = useGameStore.getState();
    expect(s.learning.facts['5x2'].box).toBe(0);
    s.recordTrainingAnswer(5, 2, true, 2000, NOW, true);
    let f = useGameStore.getState().learning.facts['5x2'];
    expect(f.box).toBe(0);
    expect([f.attempts, f.correct]).toEqual([1, 1]);
    s.recordTrainingAnswer(5, 3, true, 2000, NOW);
    f = useGameStore.getState().learning.facts['5x3'];
    expect(f.box).toBe(1);
  });

  it('(h) 기록 칸이 없는 11단은 아무것도 바꾸지 않는다', () => {
    const s = useGameStore.getState();
    s.recordTrainingAnswer(11, 3, false, 2500, NOW);
    const after = useGameStore.getState();
    expect(after.learning).toBe(s.learning);
    expect(after.economy).toBe(s.economy);
    expect(after.pet).toBe(s.pet);
  });
});
