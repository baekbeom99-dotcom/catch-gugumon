/**
 * 구구몬 속성 — 종마다 주속성과 부속성이 있고(기술은 주속성 3·부속성 1·특수 1), 속성마다 기술 효과(평소 4칸·강력 4칸)가 정해져 있다.
 * 순수 데이터만 (React·화면 없음). 효과 그림은 src/field/fx/effects.ts에 있다.
 */
import type { SpeciesId } from './speciesIds';
import type { FxName } from '../../field/fx/effects';
import type { SpecialKind } from './skills';

export type Element = 'grass' | 'poison' | 'light' | 'water' | 'thunder' | 'earth' | 'fire';

/** 속성 차례 (부속성 배정 규칙이 이 차례를 쓴다) */
export const ELEMENTS: readonly Element[] = ['fire', 'water', 'grass', 'poison', 'thunder', 'earth', 'light'];

export const ELEMENT_NAMES: Record<Element, string> = {
  grass: '풀',
  poison: '독',
  light: '빛',
  water: '물',
  thunder: '번개',
  earth: '땅',
  fire: '불',
};

/**
 * 주속성이 같은 종 (설계서 2-1 표) — 속성마다 7종, 그림 색을 보고 정했다.
 * 종의 속성은 이 표 한 곳에서만 정한다 (MAIN_ELEMENT·SUB_ELEMENT는 여기서 만든다)
 */
export const ELEMENT_GROUPS: Record<Element, readonly SpeciesId[]> = {
  fire: ['c002', 'c009', 'c021', 'c028', 'c030', 'c035', 'c048'],
  water: ['c004', 'c024', 'c031', 'c036', 'c038', 'c043', 'c047'],
  grass: ['c003', 'c016', 'c018', 'c022', 'c023', 'c029', 'c034'],
  poison: ['c006', 'c008', 'c011', 'c014', 'c032', 'c042', 'c050'],
  thunder: ['c005', 'c019', 'c025', 'c027', 'c033', 'c039', 'c045'],
  earth: ['c001', 'c007', 'c010', 'c012', 'c026', 'c037', 'c049'],
  light: ['c013', 'c015', 'c020', 'c040', 'c041', 'c044', 'c046'],
};

/**
 * 부속성 규칙: 주속성 그룹 번호 m(ELEMENTS 차례), 그룹 안 차례 j(0~6)이면 ELEMENTS[(m + 1 + j % 6) % 7].
 * 늘 주속성과 다르고, 속성마다 부속성으로 꼭 7번씩 쓰인다
 */
function subFor(main: Element, j: number): Element {
  const m = ELEMENTS.indexOf(main);
  return ELEMENTS[(m + 1 + (j % 6)) % ELEMENTS.length];
}

const mainTable = {} as Record<SpeciesId, Element>;
const subTable = {} as Record<SpeciesId, Element>;
for (const el of ELEMENTS) {
  ELEMENT_GROUPS[el].forEach((id, j) => {
    mainTable[id] = el;
    subTable[id] = subFor(el, j);
  });
}

/** 종의 주속성 (ELEMENT_GROUPS에서 만든다) */
export const MAIN_ELEMENT: Readonly<Record<SpeciesId, Element>> = mainTable;

/** 종의 부속성 (주속성과 다르다, 위 규칙) */
export const SUB_ELEMENT: Readonly<Record<SpeciesId, Element>> = subTable;

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

/**
 * 강력 효과 — 같은 4칸, 평소보다 크고 화려하다.
 * 개정 3(설계서 0-1절)부터는 **쓰지 않고 보관만** 한다: 윗단계 기술이 나가도 그 기술의 ELEMENT_FX 칸을 쓴다
 * (주속성 1·2·3번이 곧 약함 → 강함 효과). 나중에 다시 쓸 수 있어 지우지 않는다
 */
export const STRONG_FX: Record<Element, FxRow> = {
  grass: ['butterfly', 'healing-bloom', 'root-snare', 'tornado'],
  poison: ['toxic-puddle', 'shadow-tendrils', 'grasping-hands', 'void-orb'],
  light: ['blessing', 'star-fall', 'holy-pillar', 'crit-hit'],
  water: ['bubbles', 'waterfall', 'whirlpool', 'geyser'],
  thunder: ['plasma-ball', 'tesla-coil', 'storm-cloud', 'thunderclap'],
  earth: ['smoke-bomb', 'dirt-explosion', 'ground-slam', 'cartoon-pow'],
  fire: ['flamethrower', 'fire-ring', 'fire-tornado', 'meteor'],
};

/** 특수 효과(회복·방어·힌트·여유·충전·스턴) 그림 */
export const SPECIAL_FX: Record<SpecialKind, FxName> = {
  heal: 'heal-aoe',
  guard: 'divine-shield',
  clue: 'rune-circle',
  calm: 'time-stop',
  charge: 'power-star',
  // 주② 스턴: 적 머리 위로 별이 빙글빙글 (내 공격이 맞은 적 위에서 튼다)
  stun: 'stunned',
};
