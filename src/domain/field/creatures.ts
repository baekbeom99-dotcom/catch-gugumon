/** 구구몬 종 표 — 지금 있는 몬스터 8종 + 황금 레전드 3종 */
import { MONSTER_KINDS, type MonsterKind } from '../battle';
import { MONSTER_NAMES } from '../monsterNames';
import type { FieldId } from './fields';
import { FIELDS } from './fields';
import { speciesSkills } from './skills';

export const LEGEND_SPECIES = ['legend-fluff', 'legend-horn', 'legend-ghost'] as const;
export type SpeciesId = MonsterKind | (typeof LEGEND_SPECIES)[number];

export interface SpeciesDef {
  id: SpeciesId;
  kind: MonsterKind;
  name: string;
  field: FieldId | 'legend';
  /** 속성 기술 이름 3개(기술 표 슬롯 1·2·5) — 기술 이름은 skills.ts */
  moves: [string, string, string];
  legend: boolean;
}

export const STARTERS: SpeciesId[] = ['cloud', 'jelly', 'pebble'];

// 만남 수치는 tuning.ts에서 정한다 (예전 import 자리 유지용으로 다시 내보냄)
export {
  ENCOUNTER_CHANCE_GRASS,
  ENCOUNTER_CHANCE_PATH,
  ENCOUNTER_GRACE_STEPS,
  LEGEND_CHANCE,
  LEGEND_LEVEL,
  UNSEEN_WEIGHT,
} from './tuning';

const LEGEND_BASE: Record<(typeof LEGEND_SPECIES)[number], MonsterKind> = {
  'legend-fluff': 'fluff',
  'legend-horn': 'horn',
  'legend-ghost': 'ghost',
};

function fieldOf(kind: MonsterKind): FieldId {
  for (const id of Object.keys(FIELDS) as FieldId[]) if (FIELDS[id].species.includes(kind)) return id;
  throw new Error(`필드 없는 종: ${kind}`);
}

function movesOf(id: SpeciesId): [string, string, string] {
  const n = speciesSkills(id).map((k) => k.name);
  return [n[0], n[1], n[4]];
}

export const SPECIES: readonly SpeciesDef[] = [
  ...MONSTER_KINDS.map(
    (kind): SpeciesDef => ({
      id: kind,
      kind,
      name: MONSTER_NAMES[kind],
      field: fieldOf(kind),
      moves: movesOf(kind),
      legend: false,
    }),
  ),
  ...LEGEND_SPECIES.map(
    (id): SpeciesDef => ({
      id,
      kind: LEGEND_BASE[id],
      name: `황금 ${MONSTER_NAMES[LEGEND_BASE[id]]}`,
      field: 'legend',
      moves: movesOf(id),
      legend: true,
    }),
  ),
];

export function speciesDef(id: SpeciesId): SpeciesDef {
  const def = SPECIES.find((s) => s.id === id);
  if (!def) throw new Error(`모르는 종: ${id}`);
  return def;
}
