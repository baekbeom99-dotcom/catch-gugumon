import { describe, expect, it } from 'vitest';
import {
  buyCostume,
  canBuyCostume,
  COSTUME_SETS,
  type CostumeData,
  emptyCostume,
  equipCostume,
  getCostume,
  mergeCostume,
} from '../../src/domain/field/costumes';
import { COSTUME_PRICE } from '../../src/domain/field/tuning';

/** 이름·id에 들어가면 안 되는 상표·작품 이름 (몇 개만 골라 막아 둔다) */
const BANNED = ['포켓몬', '피카츄', '스펀지', '마인크래프트', '마리오', '루이지', '닌자거북', '도라에몽', '뽀로로', '짱구', '디즈니', '미키', 'pokemon', 'pikachu', 'sponge', 'minecraft', 'mario', 'disney'];

const paid = COSTUME_SETS.find((s) => s.price > 0)!;

describe('꾸미기 세트 표', () => {
  it('첫 줄은 basic(가격 0, 기본 그룹)', () => {
    expect(COSTUME_SETS[0].id).toBe('basic');
    expect(COSTUME_SETS[0].price).toBe(0);
    expect(COSTUME_SETS[0].group).toBe('basic');
    expect(COSTUME_SETS.filter((s) => s.group === 'basic')).toHaveLength(1);
  });
  it('id는 소문자·숫자·하이픈이고 서로 다르다', () => {
    const ids = COSTUME_SETS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });
  it('국기 8~10개, 캐릭터 느낌 6~8개', () => {
    const flags = COSTUME_SETS.filter((s) => s.group === 'flag').length;
    const concepts = COSTUME_SETS.filter((s) => s.group === 'concept').length;
    expect(flags).toBeGreaterThanOrEqual(8);
    expect(flags).toBeLessThanOrEqual(10);
    expect(concepts).toBeGreaterThanOrEqual(6);
    expect(concepts).toBeLessThanOrEqual(8);
  });
  it('가격은 0 이상 정수, basic 말고는 COSTUME_PRICE(50)', () => {
    expect(COSTUME_PRICE).toBe(50);
    for (const s of COSTUME_SETS) {
      expect(Number.isInteger(s.price)).toBe(true);
      expect(s.price).toBeGreaterThanOrEqual(0);
      if (s.id !== 'basic') expect(s.price).toBe(COSTUME_PRICE);
    }
  });
  it('색상은 0~360, 채도·밝기 곱은 0보다 큰 수', () => {
    for (const s of COSTUME_SETS) {
      for (const c of [s.hair, s.shirt, s.pants]) {
        expect(c.hue).toBeGreaterThanOrEqual(0);
        expect(c.hue).toBeLessThanOrEqual(360);
        if (c.sat !== undefined) expect(c.sat).toBeGreaterThan(0);
        if (c.val !== undefined) expect(c.val).toBeGreaterThan(0);
      }
    }
  });
  it('이름은 비어 있지 않고 서로 다르며 상표 이름이 없다', () => {
    const names = COSTUME_SETS.map((s) => s.name);
    expect(new Set(names).size).toBe(names.length);
    for (const s of COSTUME_SETS) {
      expect(s.name.trim().length).toBeGreaterThan(0);
      const text = `${s.id} ${s.name}`.toLowerCase();
      for (const b of BANNED) expect(text).not.toContain(b.toLowerCase());
    }
  });
  it('getCostume: 모르는 id·이상한 값이면 basic', () => {
    expect(getCostume(paid.id)).toBe(paid);
    expect(getCostume('nope').id).toBe('basic');
    expect(getCostume(undefined as unknown as string).id).toBe('basic');
    expect(getCostume('__proto__').id).toBe('basic');
  });
});

describe('꾸미기 사기·입기 (순수)', () => {
  it('emptyCostume: basic만 가지고 basic을 입음 (부를 때마다 새 객체)', () => {
    expect(emptyCostume()).toEqual({ owned: ['basic'], equipped: 'basic' });
    expect(emptyCostume()).not.toBe(emptyCostume());
  });
  it('별 49개는 못 사고 50개는 산다 (가격만큼만 줄어듦)', () => {
    const c = emptyCostume();
    expect(canBuyCostume(c, 49, paid.id)).toBe(false);
    expect(buyCostume(c, 49, paid.id)).toBeNull();
    expect(canBuyCostume(c, 50, paid.id)).toBe(true);
    const r = buyCostume(c, 50, paid.id)!;
    expect(r.stars).toBe(0);
    expect(r.costume.owned).toEqual(['basic', paid.id]);
    expect(r.costume.equipped).toBe('basic');
    expect(c.owned).toEqual(['basic']); // 원래 값은 안 바뀜
    expect(buyCostume(c, 120, paid.id)!.stars).toBe(70);
  });
  it('이미 가진 것·basic·모르는 id는 못 산다', () => {
    const c: CostumeData = { owned: ['basic', paid.id], equipped: 'basic' };
    expect(buyCostume(c, 999, paid.id)).toBeNull();
    expect(buyCostume(emptyCostume(), 999, 'basic')).toBeNull();
    expect(buyCostume(emptyCostume(), 999, 'nope')).toBeNull();
  });
  it('이상한 별 값(NaN·음수·소수)으로는 못 산다', () => {
    for (const s of [NaN, -1, Infinity, 50.5]) expect(canBuyCostume(emptyCostume(), s, paid.id)).toBe(Number.isInteger(s) && s >= 50);
  });
  it('입기: 가진 것만, 안 가진 것·모르는 id는 null', () => {
    const c: CostumeData = { owned: ['basic', paid.id], equipped: 'basic' };
    expect(equipCostume(c, paid.id)).toEqual({ owned: ['basic', paid.id], equipped: paid.id });
    expect(equipCostume({ ...c, equipped: paid.id }, 'basic')!.equipped).toBe('basic');
    const other = COSTUME_SETS.find((s) => s.price > 0 && s.id !== paid.id)!;
    expect(equipCostume(c, other.id)).toBeNull();
    expect(equipCostume(c, 'nope')).toBeNull();
  });
});

describe('꾸미기 저장 읽기 (mergeCostume)', () => {
  it('없음·깨진 값은 기본값', () => {
    for (const raw of [undefined, null, 3, 'x', [], { owned: 'basic' }, { owned: null, equipped: 5 }]) {
      expect(mergeCostume(raw)).toEqual(emptyCostume());
    }
  });
  it('모르는 id·중복·글자 아닌 값은 버리고 basic은 늘 맨 앞', () => {
    const r = mergeCostume({ owned: [paid.id, 'nope', 7, null, paid.id, '__proto__'], equipped: paid.id });
    expect(r).toEqual({ owned: ['basic', paid.id], equipped: paid.id });
  });
  it('안 가진 것·모르는 것을 입고 있으면 basic', () => {
    expect(mergeCostume({ owned: ['basic'], equipped: paid.id }).equipped).toBe('basic');
    expect(mergeCostume({ owned: [paid.id], equipped: 'nope' })).toEqual({ owned: ['basic', paid.id], equipped: 'basic' });
  });
});
