import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useGameStore } from '../../src/store/useGameStore';
import { LEGEND_SPECIES } from '../../src/domain/field/creatures';
import { newSpeciesEntry } from '../../src/store/fieldData';
import { emptyTraining } from '../../src/domain/field/training';
import { ARITH_TRAINER_MASTER_MS, LEGEND_LEVEL, STAR_LEGEND_REWARD, STAR_TRAINING, TRAINING_MASTER_MS } from '../../src/domain/field/tuning';

const NOW = new Date('2026-11-19T09:00:00').getTime();
const g = globalThis as { __GUGU_E2E_STARS__?: unknown };
const st = () => useGameStore.getState();

function open12() {
  useGameStore.setState({ field: { ...st().field, training: { ...emptyTraining(), studied: { 12: true }, mastered: { 9: { bestMs: 1, at: NOW } } } } });
}
const master12 = () => st().finishTraining({ dan: 12, mode: 'challenge', mistakes: 0, timeMs: TRAINING_MASTER_MS, now: NOW, rng: () => 0 });

beforeEach(() => st().resetAll());
afterEach(() => {
  g.__GUGU_E2E_STARS__ = false;
});

describe('레전드 보상 별 20개', () => {
  it('고정값', () => expect(STAR_LEGEND_REWARD).toBe(20));

  it('꺼져 있으면 12단 첫 마스터에도 별 0, 별점수 칸 그대로', () => {
    open12();
    const before = st().field.starPoints;
    const r = master12();
    expect(r.legend).not.toBeNull();
    expect(r.stars).toBe(0);
    expect(st().field.starPoints).toBe(before);
  });

  it('켜져 있으면 12단 첫 마스터: 훈련 별 + 20', () => {
    g.__GUGU_E2E_STARS__ = true;
    open12();
    const r = master12();
    expect(r.legend).not.toBeNull();
    expect(r.stars).toBe(STAR_TRAINING + STAR_LEGEND_REWARD);
    expect(st().field.starPoints).toBe(STAR_TRAINING + STAR_LEGEND_REWARD);
  });

  it('두 번째 마스터에는 레전드도 별 20도 없다', () => {
    g.__GUGU_E2E_STARS__ = true;
    open12();
    expect(master12().stars).toBe(STAR_TRAINING + STAR_LEGEND_REWARD);
    const b = master12();
    expect(b.legend).toBeNull();
    expect(b.stars).toBe(STAR_TRAINING);
  });

  it('이미 가진 레전드(중복)여도 별 20개', () => {
    g.__GUGU_E2E_STARS__ = true;
    const species = { ...st().field.species };
    for (const id of LEGEND_SPECIES) species[id] = newSpeciesEntry(id, LEGEND_LEVEL, NOW);
    useGameStore.setState({ field: { ...st().field, species } });
    open12();
    const r = master12();
    expect(r.legend?.duplicate).toBe(true);
    expect(r.stars).toBe(STAR_TRAINING + STAR_LEGEND_REWARD);
  });

  it('셈연습 고수 첫 마스터도 켜져 있으면 +20, 꺼져 있으면 0', () => {
    const off = st().finishArithTraining({ level: 'hard', mistakes: 0, timeMs: ARITH_TRAINER_MASTER_MS.hard, now: NOW, rng: () => 0 });
    expect(off.legend).not.toBeNull();
    expect(off.stars).toBe(0);
    st().resetAll();
    g.__GUGU_E2E_STARS__ = true;
    const on = st().finishArithTraining({ level: 'hard', mistakes: 0, timeMs: ARITH_TRAINER_MASTER_MS.hard, now: NOW, rng: () => 0 });
    expect(on.stars).toBe(STAR_TRAINING + STAR_LEGEND_REWARD);
    expect(st().field.starPoints).toBe(STAR_TRAINING + STAR_LEGEND_REWARD);
  });
});
