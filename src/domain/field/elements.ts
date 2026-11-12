/**
 * 구구몬 속성 — 종마다 속성이 하나 있고, 속성마다 기술 효과(평소 4칸·강력 4칸)가 정해져 있다.
 * 순수 데이터만 (React·화면 없음). 효과 그림은 src/field/fx/effects.ts에 있다.
 */
import type { SpeciesId } from './creatures';
import type { FxName } from '../../field/fx/effects';
import type { SpecialKind } from './skills';

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

/** 칸 4개: 주속성 기술 1·2·3번(약함 → 강함) + 부속성 기술 */
type FxRow = readonly [FxName, FxName, FxName, FxName];

/** 속성별 평소 기술 효과 — [주①, 주②, 주③, 부속성] (기술의 fxIndex 칸) */
export const ELEMENT_FX: Record<Element, FxRow> = {
  grass: ['vine-whip', 'thorns', 'leaf-storm', 'frog'],
  poison: ['acid-splash', 'spore-burst', 'poison-cloud', 'slime'],
  light: ['feather-burst', 'smite', 'sunburst', 'halo'],
  water: ['splash', 'water-jet', 'wave-crash', 'water-orb'],
  thunder: ['zap-hit', 'chain-lightning', 'lightning-strike', 'ball-lightning'],
  earth: ['earth-spike', 'boulder', 'quake', 'heavy-landing'],
  fire: ['fireball', 'fire-breath', 'flame-pillar', 'campfire'],
};

/** 강력(빨리 풀어 강하게 나간 기술)일 때 효과 — 같은 4칸, 평소보다 크고 화려하다 */
export const STRONG_FX: Record<Element, FxRow> = {
  grass: ['butterfly', 'healing-bloom', 'root-snare', 'tornado'],
  poison: ['toxic-puddle', 'shadow-tendrils', 'grasping-hands', 'void-orb'],
  light: ['blessing', 'star-fall', 'holy-pillar', 'crit-hit'],
  water: ['bubbles', 'waterfall', 'whirlpool', 'geyser'],
  thunder: ['plasma-ball', 'tesla-coil', 'storm-cloud', 'thunderclap'],
  earth: ['smoke-bomb', 'dirt-explosion', 'ground-slam', 'cartoon-pow'],
  fire: ['flamethrower', 'fire-ring', 'fire-tornado', 'meteor'],
};

/** 특수 기술(회복·방어·힌트·여유·충전) 효과 */
export const SPECIAL_FX: Record<SpecialKind, FxName> = {
  heal: 'heal-aoe',
  guard: 'divine-shield',
  clue: 'rune-circle',
  calm: 'time-stop',
  charge: 'power-star',
};
