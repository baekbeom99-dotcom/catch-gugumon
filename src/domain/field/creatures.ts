/** 구구몬 종 표 — 49종(번호 001~050, 017 빼고). 진화 없이 종마다 한 단계 */
import type { MonsterKind } from '../battle';
import { GUGUMON_NAMES } from '../monsterNames';
import type { FieldId } from './fields';
import { FIELDS } from './fields';
import { speciesSkills } from './skills';
import { LEGEND_SPECIES, SPECIES_IDS, type SpeciesId } from './speciesIds';
import { MAIN_ELEMENT, type Element } from './elements';

export { LEGEND_SPECIES, SPECIES_IDS, speciesNumber } from './speciesIds';
export type { SpeciesId } from './speciesIds';

export interface SpeciesDef {
  id: SpeciesId;
  /**
   * 그림이 없을 때 빌려 쓰는 퀴즈 모험 몬스터 SVG (주속성으로 고른 임시 그림).
   * 퀴즈 모험 몬스터 종과는 상관없다
   */
  svgKind: MonsterKind;
  name: string;
  field: FieldId | 'legend';
  /** 마을 서식지(잡은 구구몬이 노는 곳). 레전드는 정해 둔 필드 */
  home: FieldId;
  /** 속성 기술 이름 3개(기술 표 슬롯 1·2·5) — 기술 이름은 skills.ts */
  moves: [string, string, string];
  legend: boolean;
}

/** 시작 구구몬 3종: 꽃등짐몬(풀)·불꼬리도마뱀몬(불)·물거북몬(물) */
export const STARTERS: SpeciesId[] = ['c034', 'c035', 'c036'];

// 만남 수치는 tuning.ts에서 정한다 (예전 import 자리 유지용으로 다시 내보냄)
export {
  ENCOUNTER_CHANCE_GRASS,
  ENCOUNTER_CHANCE_PATH,
  ENCOUNTER_GRACE_STEPS,
  LEGEND_CHANCE,
  LEGEND_LEVEL,
  UNSEEN_WEIGHT,
} from './tuning';

/** 새 그림이 오기 전까지 주속성마다 빌려 쓰는 SVG 몬스터 */
export const FALLBACK_SVG: Record<Element, MonsterKind> = {
  fire: 'ghost',
  water: 'jelly',
  grass: 'cloud',
  poison: 'mushroom',
  thunder: 'antenna',
  earth: 'pebble',
  light: 'fluff',
};

/** 레전드가 마을에서 노는 서식지: 레전드 차례대로 사막·물가·초원을 돌아가며 */
const LEGEND_HOMES: readonly FieldId[] = ['desert', 'waterside', 'meadow'];

const isLegend = (id: SpeciesId) => (LEGEND_SPECIES as readonly SpeciesId[]).includes(id);

function fieldOf(id: SpeciesId): FieldId {
  for (const f of Object.keys(FIELDS) as FieldId[]) if (FIELDS[f].species.includes(id)) return f;
  throw new Error(`필드 없는 종: ${id}`);
}

function movesOf(id: SpeciesId): [string, string, string] {
  const n = speciesSkills(id).map((k) => k.name);
  return [n[0], n[1], n[4]];
}

export const SPECIES: readonly SpeciesDef[] = SPECIES_IDS.map((id): SpeciesDef => {
  const legend = isLegend(id);
  const field = legend ? 'legend' : fieldOf(id);
  const home = legend ? LEGEND_HOMES[(LEGEND_SPECIES as readonly SpeciesId[]).indexOf(id) % LEGEND_HOMES.length] : (field as FieldId);
  return { id, svgKind: FALLBACK_SVG[MAIN_ELEMENT[id]], name: GUGUMON_NAMES[id], field, home, moves: movesOf(id), legend };
});

const BY_ID = new Map<SpeciesId, SpeciesDef>(SPECIES.map((s) => [s.id, s]));

export function speciesDef(id: SpeciesId): SpeciesDef {
  const def = BY_ID.get(id);
  if (!def) throw new Error(`모르는 종: ${id}`);
  return def;
}
