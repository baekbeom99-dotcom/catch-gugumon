import { describe, expect, it } from 'vitest';
import {
  CORRECT_EXP,
  DUPLICATE_EXP,
  displayName,
  addExp,
  expToNext,
  MAX_LEVEL,
  PARTICIPATION_EXP,
} from '../../src/domain/field/growth';
import type { SpeciesEntry } from '../../src/store/fieldData';

const entry = (level: number, exp = 0, stage: 1 | 2 | 3 = 1): SpeciesEntry => ({ level, exp, stage, caught: 1, firstCaughtAt: 1, hp: 100, wounds: [], skills: ['c034-1'] });

describe('성장 수치', () => {
  it('상수 값이 고정돼 있다', () => {
    expect(MAX_LEVEL).toBe(30);
    expect(DUPLICATE_EXP).toBe(40);
    expect(PARTICIPATION_EXP).toBe(10);
    expect(CORRECT_EXP).toBe(2);
  });
  it('expToNext = 20 + 레벨 × 10', () => {
    expect(expToNext(1)).toBe(30);
    expect(expToNext(10)).toBe(120);
  });
});

describe('addExp', () => {
  it('모자라면 경험치만 쌓인다', () => {
    const r = addExp(entry(5), 10);
    expect(r.entry).toMatchObject({ level: 5, exp: 10, stage: 1 });
    expect(r.levelsGained).toBe(0);
  });
  it('진화는 없다: Lv8·Lv18을 지나도 단계는 1', () => {
    let need = 0;
    for (let l = 7; l < 18; l++) need += expToNext(l);
    const r = addExp(entry(7), need);
    expect(r.entry).toMatchObject({ level: 18, stage: 1 });
    expect(r.levelsGained).toBe(11);
    expect(r).not.toHaveProperty('evolvedTo');
  });
  it('예전 저장의 2·3단계도 경험치를 받으면 1단계로', () => {
    expect(addExp(entry(10, 0, 3), 5).entry.stage).toBe(1);
  });
  it('Lv30에서 멈추고 경험치는 0', () => {
    const r = addExp(entry(30), 9999);
    expect(r.entry).toMatchObject({ level: 30, exp: 0 });
    expect(r.levelsGained).toBe(0);
    const r2 = addExp(entry(29), 9999);
    expect(r2.entry).toMatchObject({ level: 30, exp: 0 });
    expect(r2.levelsGained).toBe(1);
  });
  it('한 번에 두 레벨', () => {
    const r = addExp(entry(2), expToNext(2) + expToNext(3) + 5);
    expect(r.levelsGained).toBe(2);
    expect(r.entry).toMatchObject({ level: 4, exp: 5 });
  });
  it('원본을 바꾸지 않는다', () => {
    const e = entry(5);
    addExp(e, 100);
    expect(e).toEqual(entry(5));
  });
});

describe('displayName', () => {
  it('진화가 없어 단계와 상관없이 종 이름 그대로', () => {
    expect(displayName('c036', 1)).toBe('물거북몬');
    expect(displayName('c036', 2)).toBe('물거북몬');
    expect(displayName('c036')).toBe('물거북몬');
  });
});
