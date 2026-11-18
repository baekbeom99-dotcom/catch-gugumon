/** 필드 모험 저장 데이터 — 구구몬 도감·동료·마지막 자리 */
import { FACTS } from '../domain/facts';
import { FIELD_TYPES } from '../domain/field/fieldQuestions';
import { CAPSULE_MAX, CAPSULE_START, COMPANION_MAX_HP } from '../domain/field/tuning';
import { CAPSULE_TYPES, type Capsules, isCapsuleCount } from '../domain/field/capsules';
import { addWound, type Wound } from '../domain/field/wounds';
import { MAP_IDS, type MapId } from '../domain/field/fields';
import { type Dir, parseMap } from '../domain/field/movement';
import { TOWN_EXITS, TOWN_ROWS, TOWN_SIGNS } from '../field/world/maps/town';
import { LEGEND_SPECIES, SPECIES_IDS as ALL_SPECIES, type SpeciesId } from '../domain/field/speciesIds';
import { defaultSkills, learnedAt, seatOf, SKILLS, type Seat, type SkillDef, type SkillId } from '../domain/field/skills';
import { MAX_SKILLS } from '../domain/field/tuning';

export { LEGEND_SPECIES };
export type { SpeciesId };
export const SPECIES_IDS: readonly SpeciesId[] = ALL_SPECIES;

/**
 * 예전 저장 이전표 (v1.60, 11종 → 49종): 옛 종 id → 새 종 id.
 * 저장을 읽을 때(mergeField) 도감 키·본 종·동행·가진 기술 id(`옛id-슬롯` → `새id-슬롯`)를 모두 이 표로 옮긴다.
 * 새 종이 서로 겹치지 않아 기록이 합쳐질 일은 없다. 이 표는 지우지 않는다(오래 안 연 저장도 옮겨야 한다)
 */
export const OLD_SPECIES_MAP: Readonly<Record<string, SpeciesId>> = {
  cloud: 'c034',
  ghost: 'c035',
  jelly: 'c036',
  antenna: 'c033',
  pebble: 'c037',
  mushroom: 'c042',
  fluff: 'c040',
  horn: 'c031',
  'legend-fluff': 'c015',
  'legend-horn': 'c047',
  'legend-ghost': 'c048',
};

/** 옛 종 id면 새 id로, 아니면 그대로 */
export function migrateSpeciesId(v: unknown): unknown {
  return typeof v === 'string' && Object.prototype.hasOwnProperty.call(OLD_SPECIES_MAP, v) ? OLD_SPECIES_MAP[v] : v;
}

/** 옛 기술 id(`cloud-2`, `legend-horn-4`)면 새 id(`c034-2`)로, 아니면 그대로 */
export function migrateSkillId(v: unknown): unknown {
  if (typeof v !== 'string') return v;
  const m = /^(.+)-(\d+)$/.exec(v);
  if (!m || !Object.prototype.hasOwnProperty.call(OLD_SPECIES_MAP, m[1])) return v;
  return `${OLD_SPECIES_MAP[m[1]]}-${m[2]}`;
}

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

/** 저장 안 되는 알림: 레벨이 올랐을 때 등 화면에 띄운다 (필드 구구몬은 진화하지 않는다) */
export type FieldNotice =
  | { kind: 'levelUp'; species: SpeciesId; level: number }
  /** 쓰러졌고 고를 다른 구구몬이 없어 마을로 왔다 (있으면 알림 대신 고르기 창) */
  | { kind: 'fainted'; species: SpeciesId }
  /** 기술을 가졌다: learned 레벨이 올라 배움, copied 야생 구구몬(fromSpecies)에게서 따라 배움 */
  | { kind: 'skill'; species: SpeciesId; skillId: SkillId; how: 'learned' | 'copied'; fromSpecies?: SpeciesId };

/**
 * 저장 안 되는 기술 제안: 들어갈 자리(부속성·특수)가 이미 차 있어 바로 못 가진 새 기술 (선택창에서 그 자리 기술을 잊고 배우거나 포기).
 * level 레벨로 익힘(안 배워도 아는 기술로 남는다), copy 야생 구구몬에게서 따라 배우기(놓치면 사라짐).
 * seat는 새 기술이 들어갈 자리, removeId는 제안을 만들 때 그 자리에 있던 기술 (선택창은 지금 그 자리 기술을 다시 본다)
 */
export interface SkillOffer {
  species: SpeciesId;
  skillId: SkillId;
  source: 'level' | 'copy';
  fromSpecies?: SpeciesId;
  seat: Seat;
  removeId?: SkillId;
}

/** 가진 기술 중 그 자리에 앉아 있는 기술 (없으면 null). 주속성 사슬은 여럿이라 앞의 것 */
export function seatHolder(species: SpeciesId, held: readonly SkillId[], seat: Seat): SkillId | null {
  return held.find((id) => seatOfId(species, id) === seat) ?? null;
}

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
 * 이 구구몬이 이 기술을 가질 수 있나 (하나만 볼 때) — ① 자기 종 기술이고 배우는 레벨이 됐거나,
 * ② 다른 종 기술(따라 배운 것)이거나, ③ 옛 저장 이월 슬롯이면 된다.
 * 다른 종 기술은 seatOf가 늘 부속성·특수 자리로 보므로 주속성 사슬에는 못 들어간다. 자리 겹침은 normalizeSkills가 본다
 */
export function isAllowedSkill(species: SpeciesId, level: number, id: unknown): id is SkillId {
  if (typeof id !== 'string') return false;
  const def = SKILL_BY_ID.get(id);
  if (!def) return false;
  if (def.species !== species) return true;
  return def.learnLevel <= level || legacySlots(level).includes(def.slot);
}

/** 이 구구몬에게서 이 기술 id의 자리 (모르는 id면 null) */
export function seatOfId(species: SpeciesId, id: unknown): Seat | null {
  const def = typeof id === 'string' ? SKILL_BY_ID.get(id) : undefined;
  return def ? seatOf(def, species) : null;
}

/**
 * 가진 기술 목록 다듬기 (검증은 여기 한 곳, 설계서 0-1절 "저장"):
 * 허용 안 되는 id·중복은 버리고, 부속성 자리·특수 자리는 각각 앞에서부터 하나만 남긴다.
 * 남는 게 없거나 배열이 아니면 그 레벨의 기본 기술(defaultSkills).
 * 주①(자기 종 슬롯 1)이 없으면 맨 앞에 넣는다 — 주속성 버튼이 비지 않게 (기술을 늘리기만 하고 줄이지 않는다).
 * 자리가 주속성 3 + 부속성 1 + 특수 1이라 결과는 늘 MAX_SKILLS개 이하다
 */
export function normalizeSkills(species: SpeciesId, level: number, skills: unknown): SkillId[] {
  if (!Array.isArray(skills)) return defaultSkills(species, level);
  const out: SkillId[] = [];
  const taken = new Set<Seat>();
  for (const id of skills) {
    if (!isAllowedSkill(species, level, id) || out.includes(id)) continue;
    const seat = seatOfId(species, id)!;
    if (seat !== 'main') {
      if (taken.has(seat)) continue;
      taken.add(seat);
    }
    out.push(id);
  }
  if (out.length === 0) return defaultSkills(species, level);
  const m1 = `${species}-1`;
  if (!out.includes(m1)) out.unshift(m1);
  return out.slice(0, MAX_SKILLS);
}

/**
 * 고치지 않고 그대로 받아도 되는 목록인가 (액션의 검증) — normalizeSkills가 아무것도 바꾸지 않으면 된다.
 * 그래서 1~MAX_SKILLS개, 중복 없음, 모두 허용, 자리 겹침 없음, 주① 있음이라는 규칙이 저장 읽기와 똑같다
 */
export function isValidSkills(species: SpeciesId, level: number, skills: unknown): skills is SkillId[] {
  if (!Array.isArray(skills) || skills.length < 1 || skills.length > MAX_SKILLS) return false;
  const norm = normalizeSkills(species, level, skills);
  return norm.length === skills.length && norm.every((id, i) => id === skills[i]);
}

/**
 * 옛 저장(기술 칸 없음)이 새 체계에서 가지는 기술: 이월 슬롯 ∪ 그 레벨에서 익힌 기술 전부 (슬롯 순서).
 * 예: Lv1~2 [1], Lv3~7 [1,2], Lv8~13 [1,2,3,5], Lv14 이상 [1,2,3,4,5]. 예전에 쓰던 기술은 하나도 빠지지 않는다
 */
export function legacyCarrySkills(species: SpeciesId, level: number): SkillId[] {
  const slots = new Set([...legacySlots(level), ...learnedAt(species, level).map((k) => k.slot)]);
  return [...slots].sort((a, b) => a - b).map((n) => `${species}-${n}`);
}

function mergeEntry(species: SpeciesId, raw: unknown): SpeciesEntry | null {
  if (!raw || typeof raw !== 'object') return null;
  const e = raw as Record<string, unknown>;
  if (!isCount(e.level) || !isCount(e.exp) || !isCount(e.caught) || !isNum(e.firstCaughtAt)) return null;
  // 예전 저장은 진화 단계 2·3도 있었다: 읽을 수는 있게 받고, 진화가 없어졌으니 늘 1로 둔다
  if (e.stage !== 1 && e.stage !== 2 && e.stage !== 3) return null;
  // 옛 저장(체력·상처 없음)이나 깨진 값은 가득 찬 체력, 상처 없음
  const hp = isNum(e.hp) && Number.isInteger(e.hp) && e.hp >= 0 && e.hp <= COMPANION_MAX_HP ? e.hp : COMPANION_MAX_HP;
  let wounds: Wound[] = [];
  if (Array.isArray(e.wounds)) for (const w of e.wounds) if (isWound(w)) wounds = addWound(wounds, w);
  // 옛 저장(기술 칸 없음)이나 깨진 칸(배열이 아님)은 예전에 쓰던 기술 + 그 레벨에서 익힌 기술 전부 (기술이 줄지 않게).
  // 배열이면 규칙대로 다듬는다
  // 옛 종의 기술 id(`cloud-2`)는 새 종 id(`c034-2`)로 옮긴 뒤 다듬는다
  const skills = Array.isArray(e.skills)
    ? normalizeSkills(species, e.level, e.skills.map(migrateSkillId))
    : legacyCarrySkills(species, e.level);
  return { level: e.level, exp: e.exp, stage: 1, caught: e.caught, firstCaughtAt: e.firstCaughtAt, hp, wounds, skills };
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
    for (const [raw, v] of Object.entries(p.species as Record<string, unknown>)) {
      // 옛 종 키(cloud 등)는 새 종 키로 옮긴다 (OLD_SPECIES_MAP)
      const k = migrateSpeciesId(raw);
      if (!isSpecies(k) || species[k]) continue;
      const entry = mergeEntry(k, v);
      if (entry) species[k] = entry;
    }
  }

  const seen: SpeciesId[] = [];
  if (Array.isArray(p.seen)) {
    for (const raw of p.seen) {
      const s = migrateSpeciesId(raw);
      if (isSpecies(s) && !seen.includes(s)) seen.push(s);
    }
  }
  const companion = migrateSpeciesId(p.companion);

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
    companion: isSpecies(companion) ? companion : null,
    species,
    seen,
    position,
    stats,
    capsules,
  };
}
