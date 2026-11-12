/**
 * 구구몬 속성 — 종마다 속성이 하나 있고, 속성마다 기술 효과(약함 → 강함) 3개가 정해져 있다.
 * 순수 데이터만 (React·화면 없음). 효과 그림은 src/field/fx/effects.ts에 있다.
 */
import type { SpeciesId } from './creatures';
import type { FxName } from '../../field/fx/effects';

export type Element = 'grass' | 'poison' | 'light' | 'water' | 'thunder' | 'earth' | 'fire';

export const ELEMENT_NAMES: Record<Element, string> = {
  grass: '풀',
  poison: '독',
  light: '빛',
  water: '물',
  thunder: '번개',
  earth: '땅',
  fire: '불',
};

/** 종의 주속성 (설계서 2-1 표). 황금 레전드는 종마다 따로 정한다 */
export const MAIN_ELEMENT: Record<SpeciesId, Element> = {
  cloud: 'grass',
  mushroom: 'poison',
  fluff: 'light',
  jelly: 'water',
  horn: 'water',
  antenna: 'thunder',
  pebble: 'earth',
  ghost: 'fire',
  'legend-fluff': 'light',
  'legend-horn': 'water',
  'legend-ghost': 'fire',
};

/** 종의 부속성 (주속성과 다르다) */
export const SUB_ELEMENT: Record<SpeciesId, Element> = {
  cloud: 'light',
  mushroom: 'grass',
  fluff: 'earth',
  jelly: 'poison',
  horn: 'earth',
  antenna: 'water',
  pebble: 'fire',
  ghost: 'thunder',
  'legend-fluff': 'fire',
  'legend-horn': 'thunder',
  'legend-ghost': 'light',
};

/** 종의 속성 = 주속성 */
export function elementOf(id: SpeciesId): Element {
  return MAIN_ELEMENT[id];
}

/** 종의 부속성 */
export function subElementOf(id: SpeciesId): Element {
  return SUB_ELEMENT[id];
}

/** 상성: 공격 속성이 이 목록의 속성에게 강하다 (설계서 2-6) */
export const STRONG_AGAINST: Record<Element, Element[]> = {
  fire: ['grass', 'poison'],
  water: ['fire', 'earth'],
  grass: ['water', 'earth'],
  thunder: ['water', 'poison'],
  earth: ['thunder', 'fire'],
  poison: ['grass', 'light'],
  light: ['poison', 'thunder'],
};

/** 공격이 방어에게 강하면 1, 약하면 -1, 같거나 서로 강하면 0 */
export function matchup(attack: Element, defend: Element): -1 | 0 | 1 {
  const up = STRONG_AGAINST[attack].includes(defend);
  const down = STRONG_AGAINST[defend].includes(attack);
  if (up && !down) return 1;
  if (down && !up) return -1;
  return 0;
}

/** 속성별 기술 효과 — 기술 1·2·3번 순서(약함 → 강함) */
export const ELEMENT_FX: Record<Element, readonly [FxName, FxName, FxName]> = {
  grass: ['vine-whip', 'thorns', 'leaf-storm'],
  poison: ['acid-splash', 'spore-burst', 'poison-cloud'],
  light: ['feather-burst', 'smite', 'sunburst'],
  water: ['splash', 'water-jet', 'wave-crash'],
  thunder: ['zap-hit', 'chain-lightning', 'lightning-strike'],
  earth: ['earth-spike', 'boulder', 'quake'],
  fire: ['fireball', 'fire-breath', 'flame-pillar'],
};
