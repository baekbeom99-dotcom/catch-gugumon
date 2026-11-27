/**
 * 주인공 꾸미기 (순수 로직) — 색 세트 표와 사기·입기.
 * 세트 하나를 사면 머리색·윗옷·바지 색이 한꺼번에 바뀐다. 별점수(field.starPoints)로 산다.
 * 값 하나: 가격은 tuning.ts의 COSTUME_PRICE. 그림에 칠하는 일은 화면 쪽(그림 모듈)이 한다.
 * 캐릭터 느낌 세트는 색만 따라 하고, 이름은 누구나 쓸 수 있는 말로 짓는다 (작품·상표 이름을 쓰지 않는다).
 */
import { COSTUME_PRICE } from './tuning';

/** 색 하나: 색상(도, 0~360), 원래 그림의 채도·밝기에 곱하는 값(없으면 1). 그림자 결이 그대로 남는다 */
export type HsvTarget = { hue: number; sat?: number; val?: number };

export type CostumeId = string;

export interface CostumeSet {
  id: CostumeId;
  name: string;
  /** basic(처음 그림 그대로)·flag(나라 국기 색)·concept(캐릭터 느낌 색) */
  group: 'basic' | 'flag' | 'concept';
  price: number;
  hair: HsvTarget;
  shirt: HsvTarget;
  pants: HsvTarget;
}

// 자주 쓰는 색 (곱하는 값이라 원래 그림의 밝고 어두움을 따라간다)
const BLACK: HsvTarget = { hue: 0, sat: 0.15, val: 0.35 };
const WHITE: HsvTarget = { hue: 0, sat: 0.08, val: 1.4 };
const RED: HsvTarget = { hue: 355, sat: 1.3 };
const BLUE: HsvTarget = { hue: 225, sat: 1.2 };
const YELLOW: HsvTarget = { hue: 52, sat: 1.2, val: 1.2 };
const GREEN: HsvTarget = { hue: 130, sat: 1.1 };
const BROWN: HsvTarget = { hue: 25, sat: 0.9, val: 0.6 };

const flag = (id: string, name: string, hair: HsvTarget, shirt: HsvTarget, pants: HsvTarget): CostumeSet => ({
  id: `flag-${id}`,
  name,
  group: 'flag',
  price: COSTUME_PRICE,
  hair,
  shirt,
  pants,
});
const concept = (id: string, name: string, hair: HsvTarget, shirt: HsvTarget, pants: HsvTarget): CostumeSet => ({
  id: `concept-${id}`,
  name,
  group: 'concept',
  price: COSTUME_PRICE,
  hair,
  shirt,
  pants,
});

/** 꾸미기 세트 표. 첫 줄은 basic(그림 그대로, 공짜 — 색 값은 쓰지 않는다). 순서 = 상점에 보이는 순서 */
export const COSTUME_SETS: readonly CostumeSet[] = [
  { id: 'basic', name: '처음 옷', group: 'basic', price: 0, hair: { hue: 0 }, shirt: { hue: 0 }, pants: { hue: 0 } },
  // 나라 국기 색
  flag('kr', '한국', BLACK, RED, BLUE),
  flag('jp', '일본', BLACK, WHITE, RED),
  flag('us', '미국', RED, WHITE, BLUE),
  flag('br', '브라질', BLUE, YELLOW, GREEN),
  flag('fr', '프랑스', BLUE, WHITE, RED),
  flag('it', '이탈리아', GREEN, WHITE, RED),
  flag('de', '독일', BLACK, RED, { hue: 48, sat: 1.2, val: 1.2 }),
  flag('es', '스페인', RED, YELLOW, RED),
  flag('ca', '캐나다', RED, WHITE, RED),
  // 캐릭터 느낌 색 (이름은 색과 모습만 말한다)
  concept('yellow-bolt', '노랑 번개 친구', YELLOW, { hue: 50, sat: 1.2, val: 1.2 }, { hue: 5, sat: 1.2 }),
  concept('sea-square', '바다 노랑 네모', { hue: 56, sat: 1.2, val: 1.25 }, WHITE, BROWN),
  concept('red-cap', '빨강 모자 형제', BROWN, RED, BLUE),
  concept('green-cap', '초록 모자 형제', BROWN, { hue: 125, sat: 1.1 }, BLUE),
  concept('green-ninja', '초록 닌자', { hue: 120, sat: 1, val: 0.7 }, { hue: 110, sat: 1.1 }, { hue: 40, sat: 0.9, val: 0.7 }),
  concept('purple-wizard', '보라 마법사', { hue: 0, sat: 0.1, val: 1.3 }, { hue: 275, sat: 1.2 }, { hue: 265, sat: 1, val: 0.7 }),
  concept('sky-friend', '하늘 파랑 친구', { hue: 205, sat: 1.2 }, WHITE, { hue: 0, sat: 1.2 }),
  concept('block-explorer', '네모 블록 탐험가', BROWN, { hue: 185, sat: 1.1 }, { hue: 240, sat: 1, val: 0.8 }),
];

const BASIC = COSTUME_SETS[0];
const BY_ID = new Map<string, CostumeSet>(COSTUME_SETS.map((s) => [s.id, s]));

/** 표에 있는 id인가 */
export function isCostumeId(v: unknown): v is CostumeId {
  return typeof v === 'string' && BY_ID.has(v);
}

/** id로 세트 찾기. 모르는 id면 basic */
export function getCostume(id: string): CostumeSet {
  return (typeof id === 'string' && BY_ID.get(id)) || BASIC;
}

/** 저장되는 꾸미기 기록: 가진 세트(basic은 늘 있음)와 지금 입은 세트 */
export interface CostumeData {
  owned: CostumeId[];
  equipped: CostumeId;
}

export function emptyCostume(): CostumeData {
  return { owned: ['basic'], equipped: 'basic' };
}

/** 살 수 있나: 표에 있고, 아직 안 가졌고, 공짜가 아니고, 별이 가격만큼 있다 */
export function canBuyCostume(c: CostumeData, stars: number, id: string): boolean {
  if (!isCostumeId(id)) return false;
  const set = BY_ID.get(id)!;
  if (set.price <= 0 || c.owned.includes(id)) return false;
  return Number.isInteger(stars) && stars >= set.price;
}

/** 사기: 별을 가격만큼 빼고 가진 목록에 더한다 (입지는 않는다). 못 사면 null */
export function buyCostume(c: CostumeData, stars: number, id: string): { costume: CostumeData; stars: number } | null {
  if (!canBuyCostume(c, stars, id)) return null;
  return { costume: { owned: [...c.owned, id], equipped: c.equipped }, stars: stars - getCostume(id).price };
}

/** 입기: 가진 세트만. 아니면 null */
export function equipCostume(c: CostumeData, id: string): CostumeData | null {
  if (!isCostumeId(id) || !c.owned.includes(id)) return null;
  return { owned: [...c.owned], equipped: id };
}

/**
 * 저장 읽기: 표에 없는 id·중복·글자가 아닌 값은 버리고 basic은 늘 맨 앞에 둔다.
 * 입은 것이 가진 목록에 없으면 basic. 어떤 값이 와도 오류를 내지 않는다
 */
export function mergeCostume(raw: unknown): CostumeData {
  const r = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const owned: CostumeId[] = ['basic'];
  if (Array.isArray(r.owned)) {
    for (const v of r.owned) if (isCostumeId(v) && !owned.includes(v)) owned.push(v);
  }
  const equipped = isCostumeId(r.equipped) && owned.includes(r.equipped) ? r.equipped : 'basic';
  return { owned, equipped };
}
