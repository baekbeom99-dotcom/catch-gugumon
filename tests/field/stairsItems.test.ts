import { describe, expect, it } from 'vitest';
import { nextItemGap, pickStairsItem, stairsItemSlots, type StairsItem } from '../../src/domain/field/stairsItems';
import { seededRng } from '../../src/domain/random';
import { STAIRS_ITEM_GAP_MAX, STAIRS_ITEM_GAP_MIN, STAIRS_ITEM_LEGEND_CHANCE, STAIRS_ITEM_STARS, STAIRS_ITEM_STAR_SHARE } from '../../src/domain/field/tuning';

describe('계단 아이템 수치', () => {
  it('고정값', () => {
    expect([STAIRS_ITEM_GAP_MIN, STAIRS_ITEM_GAP_MAX, STAIRS_ITEM_LEGEND_CHANCE, STAIRS_ITEM_STARS, STAIRS_ITEM_STAR_SHARE]).toEqual([4, 10, 0.1, 3, 0.5]);
  });
});

describe('nextItemGap', () => {
  it('4~10 안이고 평균은 7쯤', () => {
    const rng = seededRng(1);
    let sum = 0;
    const N = 20000;
    for (let i = 0; i < N; i++) {
      const g = nextItemGap(rng);
      expect(Number.isInteger(g)).toBe(true);
      expect(g).toBeGreaterThanOrEqual(4);
      expect(g).toBeLessThanOrEqual(10);
      sum += g;
    }
    expect(sum / N).toBeGreaterThan(6.9);
    expect(sum / N).toBeLessThan(7.1);
  });
});

describe('pickStairsItem', () => {
  it('별점수가 꺼져 있으면 캡슐만, 황금은 10% 쯤, 나머지 셋은 고르게', () => {
    const rng = seededRng(2);
    const N = 30000;
    const count: Record<string, number> = { meadow: 0, waterside: 0, desert: 0, legend: 0 };
    for (let i = 0; i < N; i++) {
      const it = pickStairsItem(rng, false);
      expect(it.kind).toBe('capsule');
      if (it.kind === 'capsule') count[it.capsule]++;
    }
    expect(count.legend / N).toBeGreaterThan(0.09);
    expect(count.legend / N).toBeLessThan(0.11);
    for (const k of ['meadow', 'waterside', 'desert']) expect(count[k] / N).toBeGreaterThan(0.28);
  });
  it('별점수가 켜져 있으면 절반쯤 별점수 3개', () => {
    const rng = seededRng(3);
    const N = 20000;
    let stars = 0;
    for (let i = 0; i < N; i++) {
      const it: StairsItem = pickStairsItem(rng, true);
      if (it.kind === 'stars') {
        expect(it.amount).toBe(3);
        stars++;
      }
    }
    expect(stars / N).toBeGreaterThan(0.48);
    expect(stars / N).toBeLessThan(0.52);
  });
  it('같은 씨앗이면 같다', () => {
    const make = () => {
      const r = seededRng(9);
      return Array.from({ length: 20 }, () => pickStairsItem(r, true));
    };
    expect(make()).toEqual(make());
  });
});

describe('stairsItemSlots', () => {
  it('첫 아이템은 3칸 이후, 간격은 4~10, 평균 7쯤 아이템', () => {
    const rng = seededRng(4);
    const { items, nextAt } = stairsItemSlots(0, 2000, nextItemGap(rng), rng, false);
    const at = Object.keys(items).map(Number).sort((a, b) => a - b);
    expect(at[0]).toBeGreaterThanOrEqual(3);
    for (let i = 1; i < at.length; i++) {
      expect(at[i] - at[i - 1]).toBeGreaterThanOrEqual(4);
      expect(at[i] - at[i - 1]).toBeLessThanOrEqual(10);
    }
    expect(nextAt).toBeGreaterThanOrEqual(2000);
    expect(2000 / at.length).toBeGreaterThan(6.5);
    expect(2000 / at.length).toBeLessThan(7.5);
    expect(Object.values(items).every((v) => v.kind === 'capsule')).toBe(true);
  });
  it('이어 붙여도 간격이 끊기지 않는다', () => {
    const rng = seededRng(5);
    const a = stairsItemSlots(0, 40, nextItemGap(rng), rng, true);
    const b = stairsItemSlots(40, 40, a.nextAt - 40, rng, true);
    expect(b.nextAt).toBeGreaterThanOrEqual(80);
    const aAt = Object.keys(a.items).map(Number);
    const bAt = Object.keys(b.items).map(Number);
    expect(Math.max(...aAt)).toBeLessThan(40);
    expect(Math.min(...bAt)).toBeGreaterThanOrEqual(40);
    const all = [...aAt, ...bAt].sort((x, y) => x - y);
    for (let i = 1; i < all.length; i++) {
      expect(all[i] - all[i - 1]).toBeGreaterThanOrEqual(4);
      expect(all[i] - all[i - 1]).toBeLessThanOrEqual(10);
    }
  });
  it('같은 씨앗이면 같다', () => {
    const run = () => {
      const r = seededRng(7);
      return stairsItemSlots(0, 100, nextItemGap(r), r, true);
    };
    expect(run()).toEqual(run());
  });
});
