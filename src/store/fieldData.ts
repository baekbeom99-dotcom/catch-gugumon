/** 필드 모험 저장 데이터 — 구구몬 도감·동료·마지막 자리 */
import { MONSTER_KINDS } from '../domain/battle';
import { FACTS } from '../domain/facts';
import { FIELD_TYPES } from '../domain/field/fieldQuestions';
import { CAPSULE_MAX, CAPSULE_START, COMPANION_MAX_HP } from '../domain/field/tuning';
import { CAPSULE_TYPES, type Capsules, isCapsuleCount } from '../domain/field/capsules';
import { addWound, type Wound } from '../domain/field/wounds';
import { MAP_IDS, type MapId } from '../domain/field/fields';
import { type Dir, parseMap } from '../domain/field/movement';
import { TOWN_EXITS, TOWN_ROWS, TOWN_SIGNS } from '../field/world/maps/town';
import { LEGEND_SPECIES, type SpeciesId } from '../domain/field/creatures';
import { defaultSkills, SKILLS, type SkillDef, type SkillId } from '../domain/field/skills';
import { MAX_SKILLS } from '../domain/field/tuning';

export { LEGEND_SPECIES };
export type { SpeciesId };
export const SPECIES_IDS: readonly SpeciesId[] = [...MONSTER_KINDS, ...LEGEND_SPECIES];

export interface SpeciesEntry {
  level: number;
  exp: number;
  stage: 1 | 2 | 3;
  caught: number;
  firstCaughtAt: number;
  /** 체력 0~100 (0이면 쓰러짐). 전투에서 맞는 순간 저장된다 */
  hp: number;
  /** 맞게 한 문제, 최근 WOUNDS_MAX개 (회복 연습에 쓴다) */
  wounds: Wound[];
  /** 가진 기술 1~MAX_SKILLS개 (순서 = 화면 순서). 따라 배운 기술은 다른 종의 id로 들어간다 */
  skills: SkillId[];
}

export interface FieldPosition {
  map: MapId;
  x: number;
  y: number;
  facing: Dir;
}

export interface FieldData {
  starterChosen: boolean;
  companion: SpeciesId | null;
  species: Partial<Record<SpeciesId, SpeciesEntry>>;
  seen: SpeciesId[];
  position: FieldPosition;
  stats: { battles: number; catches: number; fled: number };
  /** 남은 캡슐 (종류마다 0 이상 정수). 던지는 순간 바로 줄어 저장된다 */
  capsules: Capsules;
}

/** 저장 안 되는 알림: 레벨이 오르거나 진화했을 때 화면에 띄운다 */
export type FieldNotice =
  | { kind: 'levelUp'; species: SpeciesId; level: number }
  | { kind: 'evolve'; species: SpeciesId; stage: 2 | 3 }
  /** replacedBy: 쓰러지면서 대신 함께 다니게 된 종 (없으면 동행 그대로) */
  | { kind: 'fainted'; species: SpeciesId; replacedBy?: SpeciesId };

const DIRS: readonly Dir[] = ['up', 'down', 'left', 'right'];

function isSpecies(v: unknown): v is SpeciesId {
  return typeof v === 'string' && (SPECIES_IDS as readonly string[]).includes(v);
}
function isMapId(v: unknown): v is MapId {
  return typeof v === 'string' && (MAP_IDS as readonly string[]).includes(v);
}
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isCount = (v: unknown): v is number => isNum(v) && v >= 0;
const FACT_IDS = new Set<string>(FACTS.map((f) => f.id));
function isWound(v: unknown): v is Wound {
  if (!v || typeof v !== 'object') return false;
  const w = v as Record<string, unknown>;
  return typeof w.factId === 'string' && FACT_IDS.has(w.factId) && (FIELD_TYPES as readonly unknown[]).includes(w.type);
}

/** 처음 시작 자리: 태초마을의 `@` (마을 지도 글자만 가져온다 — 타일 그림은 불러오기 때) */
export function townStart(): { x: number; y: number } {
  const map = parseMap('town', TOWN_ROWS, { exits: TOWN_EXITS, signTexts: TOWN_SIGNS });
  return map.entrances.start ?? { x: 1, y: 1 };
}

export function initialField(): FieldData {
  const { x, y } = townStart();
  return {
    starterChosen: false,
    companion: null,
    species: {},
    seen: [],
    position: { map: 'town', x, y, facing: 'down' },
    stats: { battles: 0, catches: 0, fled: 0 },
    capsules: { ...CAPSULE_START },
  };
}

const SKILL_BY_ID = new Map<string, SkillDef>(SKILLS.map((k) => [k.id, k]));

/**
 * 옛 저장 이월 슬롯: 3차 전에는 기술이 3개(옛 레벨 1·3·8에서 배움)였고, 같은 이름이 지금 슬롯 1·2·5다.
 * 레벨 1~2 → [1], 3~7 → [1, 2], 8 이상 → [1, 2, 5]. 새로 주는 규칙에는 쓰지 않고, 이미 가진 것을 지킬 때만 쓴다
 */
export function legacySlots(level: number): number[] {
  if (level >= 8) return [1, 2, 5];
  if (level >= 3) return [1, 2];
  return [1];
}

/**
 * 이 구구몬이 이 기술을 가질 수 있나 — ① 자기 종 기술이고 배우는 레벨이 됐거나,
 * ② 다른 종 기술(따라 배운 것)이거나, ③ 옛 저장 이월 슬롯이면 된다
 */
export function isAllowedSkill(species: SpeciesId, level: number, id: unknown): id is SkillId {
  if (typeof id !== 'string') return false;
  const def = SKILL_BY_ID.get(id);
  if (!def) return false;
  if (def.species !== species) return true;
  return def.learnLevel <= level || legacySlots(level).includes(def.slot);
}

/**
 * 가진 기술 목록 다듬기 (검증은 여기 한 곳): 허용 안 되는 id·중복은 버리고 앞에서부터 MAX_SKILLS개.
 * 남는 게 없거나 배열이 아니면 그 레벨의 기본 기술(defaultSkills)
 */
export function normalizeSkills(species: SpeciesId, level: number, skills: unknown): SkillId[] {
  if (!Array.isArray(skills)) return defaultSkills(species, level);
  const out: SkillId[] = [];
  for (const id of skills) {
    if (out.length >= MAX_SKILLS) break;
    if (isAllowedSkill(species, level, id) && !out.includes(id)) out.push(id);
  }
  return out.length > 0 ? out : defaultSkills(species, level);
}

/**
 * 고치지 않고 그대로 받아도 되는 목록인가 (액션의 검증) — normalizeSkills가 아무것도 바꾸지 않으면 된다.
 * 그래서 1~MAX_SKILLS개, 중복 없음, 모두 허용이라는 규칙이 저장 읽기와 똑같다
 */
export function isValidSkills(species: SpeciesId, level: number, skills: unknown): skills is SkillId[] {
  if (!Array.isArray(skills) || skills.length < 1 || skills.length > MAX_SKILLS) return false;
  const norm = normalizeSkills(species, level, skills);
  return norm.length === skills.length && norm.every((id, i) => id === skills[i]);
}

function mergeEntry(species: SpeciesId, raw: unknown): SpeciesEntry | null {
  if (!raw || typeof raw !== 'object') return null;
  const e = raw as Record<string, unknown>;
  if (!isCount(e.level) || !isCount(e.exp) || !isCount(e.caught) || !isNum(e.firstCaughtAt)) return null;
  if (e.stage !== 1 && e.stage !== 2 && e.stage !== 3) return null;
  // 옛 저장(체력·상처 없음)이나 깨진 값은 가득 찬 체력, 상처 없음
  const hp = isNum(e.hp) && Number.isInteger(e.hp) && e.hp >= 0 && e.hp <= COMPANION_MAX_HP ? e.hp : COMPANION_MAX_HP;
  let wounds: Wound[] = [];
  if (Array.isArray(e.wounds)) for (const w of e.wounds) if (isWound(w)) wounds = addWound(wounds, w);
  // 옛 저장(기술 칸 없음)은 예전에 쓰던 기술 그대로 (기술이 줄지 않게). 칸이 있으면 규칙대로 다듬는다
  const skills =
    e.skills === undefined ? legacySlots(e.level).map((n) => `${species}-${n}`) : normalizeSkills(species, e.level, e.skills);
  return { level: e.level, exp: e.exp, stage: e.stage, caught: e.caught, firstCaughtAt: e.firstCaughtAt, hp, wounds, skills };
}

/** 새로 얻은 종의 기록 (체력 가득, 상처 없음, 그 레벨까지 익힌 기술) */
export function newSpeciesEntry(species: SpeciesId, level: number, now: number): SpeciesEntry {
  return { level, exp: 0, stage: 1, caught: 1, firstCaughtAt: now, hp: COMPANION_MAX_HP, wounds: [], skills: defaultSkills(species, level) };
}

/** 저장본의 필드 칸을 기본값 위에 얹는다. 모르는 종·잘못된 지도 이름·깨진 값은 버리고 기본값.
 * 옛 저장(초원·물가·사막 자리)은 그대로 둔다. 벽 같은 칸은 그리는 쪽의 `safeStartPosition`이 한 번 더 지킨다 */
export function mergeField(initial: FieldData, persisted: unknown): FieldData {
  if (!persisted || typeof persisted !== 'object') return initial;
  const p = persisted as Record<string, unknown>;

  const species: FieldData['species'] = {};
  if (p.species && typeof p.species === 'object') {
    for (const [k, v] of Object.entries(p.species as Record<string, unknown>)) {
      if (!isSpecies(k)) continue;
      const entry = mergeEntry(k, v);
      if (entry) species[k] = entry;
    }
  }

  const seen: SpeciesId[] = [];
  if (Array.isArray(p.seen)) for (const s of p.seen) if (isSpecies(s) && !seen.includes(s)) seen.push(s);

  let position = initial.position;
  const pos = p.position as Record<string, unknown> | undefined;
  if (
    pos &&
    typeof pos === 'object' &&
    isMapId(pos.map) &&
    isCount(pos.x) &&
    isCount(pos.y) &&
    Number.isInteger(pos.x) &&
    Number.isInteger(pos.y) &&
    DIRS.includes(pos.facing as Dir)
  ) {
    position = { map: pos.map, x: pos.x, y: pos.y, facing: pos.facing as Dir };
  }

  const st = p.stats && typeof p.stats === 'object' ? (p.stats as Record<string, unknown>) : {};
  const stats = {
    battles: isCount(st.battles) ? st.battles : initial.stats.battles,
    catches: isCount(st.catches) ? st.catches : initial.stats.catches,
    fled: isCount(st.fled) ? st.fled : initial.stats.fled,
  };

  // 캡슐: 옛 저장(없음)은 시작 개수. 종류마다 0 이상 정수가 아니면 그 종류만 기본값, 모르는 종류는 버린다
  const cp = p.capsules && typeof p.capsules === 'object' && !Array.isArray(p.capsules) ? (p.capsules as Record<string, unknown>) : {};
  const capsules = { ...initial.capsules };
  for (const t of CAPSULE_TYPES) {
    const v = Object.prototype.hasOwnProperty.call(cp, t) ? cp[t] : undefined;
    if (isCapsuleCount(v)) capsules[t] = Math.min(CAPSULE_MAX, v); // 정수이지만 상한을 넘으면 상한으로
  }

  return {
    starterChosen: typeof p.starterChosen === 'boolean' ? p.starterChosen : initial.starterChosen,
    companion: isSpecies(p.companion) ? p.companion : null,
    species,
    seen,
    position,
    stats,
    capsules,
  };
}
