import { beforeEach, describe, expect, it } from 'vitest';
import { createInitialSave, mergeSave } from '../../src/store/saveData';
import { initialField, mergeField } from '../../src/store/fieldData';
import { useGameStore } from '../../src/store/useGameStore';
import { currentSave } from '../../src/screens/admin/DataSecurityPanels';
import type { LowGradeProblem } from '../../src/domain/field/lowGrade';
import { LOWGRADE_WRONG_KEEP } from '../../src/domain/field/tuning';

const NOW = new Date('2026-11-18T09:00:00').getTime();
const st = () => useGameStore.getState();
const p = (a: number, op: '+' | '−', b: number): LowGradeProblem => ({ a, op, b, result: op === '+' ? a + b : a - b });

describe('저학년 설정 (settings.lowGrade)', () => {
  it('새 저장은 꺼짐', () => {
    expect(createInitialSave(NOW).settings.lowGrade).toBe(false);
  });
  it('옛 저장(칸 없음)은 꺼짐, 저장된 불리언은 그대로', () => {
    const { lowGrade: _l, ...oldSettings } = createInitialSave(NOW).settings;
    const old = { ...createInitialSave(NOW), settings: oldSettings };
    expect(mergeSave(createInitialSave(NOW), old).settings.lowGrade).toBe(false);
    expect(mergeSave(createInitialSave(NOW), { ...old, settings: { ...oldSettings, lowGrade: true } }).settings.lowGrade).toBe(true);
  });
  it.each(['true', 1, null, {}, 'yes'])('불리언이 아닌 값 %s 는 꺼짐', (v) => {
    const save = createInitialSave(NOW);
    expect(mergeSave(createInitialSave(NOW), { ...save, settings: { ...save.settings, lowGrade: v } }).settings.lowGrade).toBe(false);
  });
  it('다른 설정 병합은 그대로 (fieldFleeScale 정리 포함)', () => {
    const save = createInitialSave(NOW);
    const m = mergeSave(createInitialSave(NOW), { ...save, settings: { sound: false, fieldFleeScale: 2, lowGrade: true } });
    expect(m.settings).toMatchObject({ sound: false, fieldFleeScale: 1, lowGrade: true });
  });
});

describe('저학년 틀린 문제 저장 (field.lowGrade.recentWrong)', () => {
  it('새 저장·옛 저장은 빈 목록', () => {
    expect(initialField().lowGrade).toEqual({ recentWrong: [] });
    expect(createInitialSave(NOW).field.lowGrade).toEqual({ recentWrong: [] });
    const { lowGrade: _l, ...old } = initialField() as unknown as Record<string, unknown>;
    expect(mergeField(initialField(), old).lowGrade).toEqual({ recentWrong: [] });
    expect(mergeField(initialField(), { ...old, lowGrade: 'x' }).lowGrade).toEqual({ recentWrong: [] });
    expect(mergeField(initialField(), { ...old, lowGrade: { recentWrong: 'x' } }).lowGrade).toEqual({ recentWrong: [] });
  });

  it('맞는 문제는 순서대로 남고, 깨진 항목은 거른다', () => {
    const good = [p(5, '+', 6), p(42, '−', 7), p(30, '+', 9)];
    const raw = [
      good[0],
      { a: 2.5, op: '+', b: 1, result: 3.5 }, // 정수 아님
      { a: 3, op: '×', b: 2, result: 6 }, // 모르는 셈
      { a: 3, op: '+', b: 2, result: 9 }, // 답이 안 맞음
      { a: 2, op: '−', b: 5, result: -3 }, // 음수
      { a: -1, op: '+', b: 2, result: 1 }, // 음수
      null,
      'x',
      good[1],
      good[0], // 중복
      good[2],
    ];
    const f = mergeField(initialField(), { ...initialField(), lowGrade: { recentWrong: raw } });
    expect(f.lowGrade.recentWrong).toEqual(good);
  });

  it(`너무 많으면 앞의 ${LOWGRADE_WRONG_KEEP}개만`, () => {
    const many = Array.from({ length: 30 }, (_, i) => p(10 + i, '+', 1));
    const f = mergeField(initialField(), { ...initialField(), lowGrade: { recentWrong: many } });
    expect(f.lowGrade.recentWrong).toEqual(many.slice(0, LOWGRADE_WRONG_KEEP));
  });

  it('mergeSave를 지나도(JSON 왕복) 그대로', () => {
    const save = createInitialSave(NOW);
    const field = { ...save.field, lowGrade: { recentWrong: [p(9, '−', 4), p(61, '−', 8)] } };
    const out = mergeSave(createInitialSave(NOW), JSON.parse(JSON.stringify({ ...save, field })));
    expect(out.field.lowGrade).toEqual(field.lowGrade);
  });
});

describe('스토어 액션', () => {
  beforeEach(() => st().resetAll());

  it('setLowGrade: 켜고 끈다, 같은 값·불리언이 아니면 상태 그대로', () => {
    st().setLowGrade(true);
    expect(st().settings.lowGrade).toBe(true);
    const before = st();
    st().setLowGrade(true);
    st().setLowGrade('x' as unknown as boolean);
    expect(st()).toBe(before);
    st().setLowGrade(false);
    expect(st().settings.lowGrade).toBe(false);
  });

  it('recordLowGradeAnswer: 틀리면 맨 앞에 넣고(중복은 앞으로), 맞히면 목록에서 뺀다', () => {
    st().recordLowGradeAnswer(p(3, '+', 4), false);
    st().recordLowGradeAnswer(p(50, '−', 6), false);
    expect(st().field.lowGrade.recentWrong).toEqual([p(50, '−', 6), p(3, '+', 4)]);
    st().recordLowGradeAnswer(p(3, '+', 4), false);
    expect(st().field.lowGrade.recentWrong).toEqual([p(3, '+', 4), p(50, '−', 6)]);
    st().recordLowGradeAnswer(p(3, '+', 4), true);
    expect(st().field.lowGrade.recentWrong).toEqual([p(50, '−', 6)]);
  });

  it('recordLowGradeAnswer: 목록에 없는 문제를 맞히거나 깨진 문제면 상태 그대로', () => {
    st().recordLowGradeAnswer(p(3, '+', 4), false);
    const before = st();
    st().recordLowGradeAnswer(p(8, '+', 1), true);
    st().recordLowGradeAnswer({ a: 3, op: '+', b: 4, result: 8 }, false);
    expect(st()).toBe(before);
  });

  it('recordLowGradeAnswer: 이미 맨 앞인 문제를 또 틀리면 상태 그대로', () => {
    st().recordLowGradeAnswer(p(3, '+', 4), false);
    const before = st();
    st().recordLowGradeAnswer(p(3, '+', 4), false);
    expect(st()).toBe(before);
  });

  it(`recordLowGradeAnswer: 최대 ${LOWGRADE_WRONG_KEEP}개`, () => {
    for (let i = 0; i < 25; i++) st().recordLowGradeAnswer(p(10 + i, '+', 2), false);
    expect(st().field.lowGrade.recentWrong.length).toBe(LOWGRADE_WRONG_KEEP);
    expect(st().field.lowGrade.recentWrong[0]).toEqual(p(34, '+', 2));
  });

  it('백업 currentSave()에 설정과 틀린 문제가 들어간다', () => {
    st().setLowGrade(true);
    st().recordLowGradeAnswer(p(71, '−', 3), false);
    const b = JSON.parse(JSON.stringify(currentSave()));
    expect(b.settings.lowGrade).toBe(true);
    expect(b.field.lowGrade.recentWrong).toEqual([p(71, '−', 3)]);
  });

  it('백업 불러오기(replaceSave)도 저학년 칸을 채운다', () => {
    const { lowGrade: _l, ...oldSettings } = createInitialSave(NOW).settings;
    const { lowGrade: _f, ...oldField } = initialField() as unknown as Record<string, unknown>;
    st().replaceSave({ ...createInitialSave(NOW), settings: oldSettings, field: oldField });
    expect(st().settings.lowGrade).toBe(false);
    expect(st().field.lowGrade).toEqual({ recentWrong: [] });
  });
});
