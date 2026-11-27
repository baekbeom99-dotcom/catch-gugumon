import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { isStarPointsEnabled, STAR_POINTS_ENABLED } from '../../src/config/featureFlags';
import { createInitialSave, mergeSave } from '../../src/store/saveData';
import { initialField, mergeField } from '../../src/store/fieldData';
import { useGameStore } from '../../src/store/useGameStore';
import { emptyTraining, type TrainingData } from '../../src/domain/field/training';
import { STAR_CATCH, STAR_DISCOVER, STAR_TRAINING, TRAINING_MASTER_MS } from '../../src/domain/field/tuning';
import { statueStars } from '../../src/domain/field/starPoints';
import { currentSave } from '../../src/screens/admin/DataSecurityPanels';

const NOW = new Date('2026-11-18T09:00:00').getTime();
const g = globalThis as { __GUGU_E2E_STARS__?: unknown };
const st = () => useGameStore.getState();

function setTraining(t: Partial<TrainingData>) {
  useGameStore.setState({ field: { ...st().field, training: { ...emptyTraining(), ...t } } });
}
function setStars(n: number) {
  useGameStore.setState({ field: { ...st().field, starPoints: n } });
}
function battle(over: Record<string, unknown> = {}) {
  return { species: 'c031' as const, companion: 'c034' as const, level: 4, tier: 'normal' as const, end: 'caught' as const, correct: 3, now: NOW, rng: () => 1, ...over };
}

describe('별점수 플래그', () => {
  afterEach(() => {
    g.__GUGU_E2E_STARS__ = false;
  });
  it('배포 설정은 켜져 있다', () => {
    expect(STAR_POINTS_ENABLED).toBe(true);
    expect(isStarPointsEnabled()).toBe(true);
  });
  it('__GUGU_E2E_STARS__가 불리언이면 그 값, 아니면 무시', () => {
    g.__GUGU_E2E_STARS__ = true;
    expect(isStarPointsEnabled()).toBe(true);
    g.__GUGU_E2E_STARS__ = false;
    expect(isStarPointsEnabled()).toBe(false);
    g.__GUGU_E2E_STARS__ = 'yes';
    expect(isStarPointsEnabled()).toBe(STAR_POINTS_ENABLED);
  });
});

describe('별점수 저장 형식', () => {
  it('새 저장은 0', () => {
    expect(initialField().starPoints).toBe(0);
    expect(createInitialSave(NOW).field.starPoints).toBe(0);
  });
  it('옛 저장(칸 없음)은 0, 맞는 값은 그대로', () => {
    const { starPoints: _s, ...old } = initialField() as unknown as Record<string, unknown>;
    expect(mergeField(initialField(), old).starPoints).toBe(0);
    expect(mergeField(initialField(), { ...old, starPoints: 42 }).starPoints).toBe(42);
    const save = { ...createInitialSave(NOW), field: { ...old, starPoints: 12 } };
    expect(mergeSave(createInitialSave(NOW), save).field.starPoints).toBe(12);
  });
  it.each(['12', -3, 2.5, NaN, Infinity, null, {}])('깨진 값 %s 는 0', (v) => {
    expect(mergeField(initialField(), { ...initialField(), starPoints: v }).starPoints).toBe(0);
  });
  it('백업 currentSave()에 들어간다', () => {
    st().resetAll();
    setStars(17);
    expect(currentSave().field.starPoints).toBe(17);
    expect(JSON.parse(JSON.stringify(currentSave())).field.starPoints).toBe(17);
  });
});

describe('별점수 — 꺼져 있을 때는 아무것도 안 바뀐다', () => {
  beforeEach(() => {
    g.__GUGU_E2E_STARS__ = false;
    st().resetAll();
  });

  it('addStarPoints는 set을 부르지 않는다 (상태 객체 그대로)', () => {
    const before = st();
    st().addStarPoints(5, 'discover');
    st().addStarPoints(10, 'statue');
    expect(st()).toBe(before);
    expect(st().field.starPoints).toBe(0);
  });
  it('finishStatue는 ok:false·0, 상태 객체 그대로', () => {
    const before = st();
    expect(st().finishStatue({ timeMs: 10_000, allCorrect: true, now: NOW })).toEqual({ ok: false, stars: 0 });
    expect(st()).toBe(before);
  });
  it('새 종 발견·포획·훈련 성공 뒤에도 0', () => {
    st().markSeen('c031');
    expect(st().field.seen).toContain('c031');
    const w = st().finishWildBattle(battle());
    expect(w.newSpecies).toBe(true);
    expect(w.stars).toBe(0);
    const study = st().finishTraining({ dan: 2, mode: 'study', mistakes: 0, timeMs: 5000, now: NOW });
    expect(study.ok).toBe(true);
    expect(study.stars).toBe(0);
    const ch = st().finishTraining({ dan: 2, mode: 'challenge', mistakes: 0, timeMs: 10_000, now: NOW });
    expect(ch.mastered).toBe(true);
    expect(ch.stars).toBe(0);
    const ar = st().finishArithTraining({ level: 'basic', mistakes: 0, timeMs: 5000, now: NOW, rng: () => 0 });
    expect(ar.mastered).toBe(true);
    expect(ar.stars).toBe(0);
    expect(st().field.starPoints).toBe(0);
  });
});

describe('별점수 — 켜져 있을 때', () => {
  beforeEach(() => {
    g.__GUGU_E2E_STARS__ = true;
    st().resetAll();
  });
  afterEach(() => {
    g.__GUGU_E2E_STARS__ = false;
  });

  it('addStarPoints는 0 이상 정수만 더한다', () => {
    st().addStarPoints(4, 'statue');
    expect(st().field.starPoints).toBe(4);
    const before = st();
    st().addStarPoints(0, 'statue');
    st().addStarPoints(-2, 'statue');
    st().addStarPoints(1.5, 'statue');
    expect(st()).toBe(before);
  });
  it('새 종 발견 +5, 같은 종 두 번째는 0', () => {
    st().markSeen('c031');
    expect(st().field.starPoints).toBe(STAR_DISCOVER);
    st().markSeen('c031');
    expect(st().field.starPoints).toBe(5);
    st().markSeen('c033');
    expect(st().field.starPoints).toBe(10);
  });
  it('새 종 포획 +5, 이미 있는 종·놓친 전투는 0', () => {
    const first = st().finishWildBattle(battle());
    expect(first.stars).toBe(STAR_CATCH);
    expect(st().field.starPoints).toBe(5);
    expect(st().finishWildBattle(battle()).stars).toBe(0);
    expect(st().finishWildBattle(battle({ species: 'c033', end: 'escaped' })).stars).toBe(0);
    expect(st().field.starPoints).toBe(5);
  });
  it('훈련 학습 완료·도전 합격 +3, 도전 실패 0', () => {
    const study = st().finishTraining({ dan: 2, mode: 'study', mistakes: 0, timeMs: 5000, now: NOW });
    expect(study.stars).toBe(STAR_TRAINING);
    expect(st().field.starPoints).toBe(3);
    const fail = st().finishTraining({ dan: 2, mode: 'challenge', mistakes: 1, timeMs: 10_000, now: NOW });
    expect(fail.stars).toBe(0);
    expect(st().field.starPoints).toBe(3);
    const slow = st().finishTraining({ dan: 2, mode: 'challenge', mistakes: 0, timeMs: TRAINING_MASTER_MS + 1, now: NOW });
    expect(slow.stars).toBe(0);
    const pass = st().finishTraining({ dan: 2, mode: 'challenge', mistakes: 0, timeMs: 10_000, now: NOW });
    expect(pass.stars).toBe(3);
    expect(st().field.starPoints).toBe(6);
  });
  it('거부된 훈련(잠긴 단)은 0', () => {
    setTraining({});
    const r = st().finishTraining({ dan: 13, mode: 'study', mistakes: 0, timeMs: 5000, now: NOW });
    expect(r.ok).toBe(false);
    expect(r.stars).toBe(0);
    expect(st().field.starPoints).toBe(0);
  });
  it('셈연습 합격 +3, 실패 0', () => {
    const fail = st().finishArithTraining({ level: 'basic', mistakes: 2, timeMs: 5000, now: NOW, rng: () => 0 });
    expect(fail.stars).toBe(0);
    const pass = st().finishArithTraining({ level: 'basic', mistakes: 0, timeMs: 5000, now: NOW, rng: () => 0 });
    expect(pass.stars).toBe(STAR_TRAINING);
    expect(st().field.starPoints).toBe(3);
  });
  it('동상: 전부 맞히면 시간에 맞는 별, 하나라도 틀리면 0 (상태 그대로)', () => {
    const r = st().finishStatue({ timeMs: 35_000, allCorrect: true, now: NOW });
    expect(r).toEqual({ ok: true, stars: statueStars(35_000) });
    expect(st().field.starPoints).toBe(statueStars(35_000));
    expect(st().finishStatue({ timeMs: 1000, allCorrect: true, now: NOW }).stars).toBe(15);
    const before = st();
    expect(st().finishStatue({ timeMs: 1000, allCorrect: false, now: NOW })).toEqual({ ok: true, stars: 0 });
    expect(st()).toBe(before);
    expect(st().finishStatue({ timeMs: NaN, allCorrect: true, now: NOW }).stars).toBe(5);
  });
});

describe('formatStars', () => {
  it('천 단위로 끊고 이상한 값은 0', async () => {
    const { formatStars } = await import('../../src/domain/field/starPoints');
    expect(formatStars(0)).toBe('0');
    expect(formatStars(1234)).toBe('1,234');
    expect(formatStars(-5)).toBe('0');
    expect(formatStars(NaN)).toBe('0');
  });
});
