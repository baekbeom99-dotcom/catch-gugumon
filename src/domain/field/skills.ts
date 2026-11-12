/**
 * 구구몬 기술 표 — 종마다 기술 5개(주속성 3·부속성 1·특수 1). 순수 데이터와 계산만 (React 없음).
 * 위력·강력 조건·배우는 레벨은 SLOT_PATTERN, 이름은 SKILL_NAMES, 특수 배정은 SPECIAL_OF_SPECIES 한 곳.
 */
import type { Rng } from '../random';
import { MAIN_ELEMENT, SUB_ELEMENT, type Element } from './elements';
import type { SpeciesId } from './creatures';
import { COPY_CHANCE, MAX_SKILLS } from './tuning';

export type SkillId = string;
export type SkillKind = 'main' | 'sub' | 'special';
export type SpecialKind = 'heal' | 'guard' | 'clue' | 'calm' | 'charge';

export interface SkillDef {
  id: SkillId;
  species: SpeciesId;
  /** 1..5 */
  slot: number;
  kind: SkillKind;
  name: string;
  /** 속성 기술만 */
  element?: Element;
  /** 평소 위력(깎는 칸) 1..4 */
  basePower: number;
  /** 문제 제한 시간 대비 "빨리 풀기" 비율 0..1 */
  fastRatio: number;
  learnLevel: number;
  special?: SpecialKind;
  /** ELEMENT_FX 칸: 주 0·1·2, 부 3 */
  fxIndex?: number;
}

/** 모든 종 공통 슬롯 패턴 (설계서 2-2) */
export const SLOT_PATTERN = [
  { slot: 1, kind: 'main', learnLevel: 1, basePower: 2, fastRatio: 0.6, fxIndex: 0 },
  { slot: 2, kind: 'main', learnLevel: 3, basePower: 2, fastRatio: 0.5, fxIndex: 1 },
  { slot: 3, kind: 'special', learnLevel: 8, basePower: 2, fastRatio: 0.5 },
  { slot: 4, kind: 'sub', learnLevel: 14, basePower: 2, fastRatio: 0.5, fxIndex: 3 },
  { slot: 5, kind: 'main', learnLevel: 20, basePower: 3, fastRatio: 0.4, fxIndex: 2 },
] as const;

/** 기술 이름 5개 (슬롯 1~5). 1·2·5번은 예전 이름 그대로, 3번 특수·4번 부속성은 새 이름 */
export const SKILL_NAMES: Record<SpeciesId, string[]> = {
  cloud: ['잎사귀 톡', '새싹 휙', '새싹 쑥쑥', '햇살 반짝', '꽃잎 바람'],
  mushroom: ['방울 딸랑', '데굴데굴', '버섯 방패', '덩굴 휘리릭', '무 박치기'],
  fluff: ['왕관 반짝', '꼬리 흔들기', '반짝 속삭임', '폭신 땅굴', '몸통 박치기'],
  jelly: ['젤리 톡', '출렁 박치기', '말랑 심호흡', '보글 독방울', '거품 뿜기'],
  antenna: ['안테나 찌릿', '신호 빔', '찌릿 충전', '물방울 신호', '빙글 돌기'],
  horn: ['뿔 콕', '돌진', '뿔 방어', '쿵쿵 발구르기', '물결 치기'],
  pebble: ['블록 쾅', '세눈 빔', '단단 충전', '뜨끈 불꽃', '단단해지기'],
  ghost: ['외뿔 찌르기', '꼬리 휘두르기', '공룡 심호흡', '번쩍 꼬리', '공룡 함성'],
  'legend-fluff': ['황금 왕관 빛', '반짝 별가루', '황금 속삭임', '금빛 불꽃', '금빛 박치기'],
  'legend-horn': ['황금 뿔 콕', '금빛 돌진', '황금 물약 한 모금', '금빛 번개', '반짝 물결'],
  'legend-ghost': ['황금 외뿔 찌르기', '금빛 꼬리치기', '황금 기운 모으기', '황금 햇살', '황금 함성'],
};

/** 종마다 특수 기술 종류 (설계서 2-2) */
export const SPECIAL_OF_SPECIES: Record<SpeciesId, SpecialKind> = {
  cloud: 'heal',
  'legend-horn': 'heal',
  mushroom: 'guard',
  horn: 'guard',
  fluff: 'clue',
  'legend-fluff': 'clue',
  jelly: 'calm',
  ghost: 'calm',
  antenna: 'charge',
  pebble: 'charge',
  'legend-ghost': 'charge',
};

function build(species: SpeciesId): SkillDef[] {
  return SLOT_PATTERN.map((p): SkillDef => {
    const def: SkillDef = {
      id: `${species}-${p.slot}`,
      species,
      slot: p.slot,
      kind: p.kind,
      name: SKILL_NAMES[species][p.slot - 1],
      basePower: p.basePower,
      fastRatio: p.fastRatio,
      learnLevel: p.learnLevel,
    };
    if (p.kind === 'main') def.element = MAIN_ELEMENT[species];
    if (p.kind === 'sub') def.element = SUB_ELEMENT[species];
    if (p.kind === 'special') def.special = SPECIAL_OF_SPECIES[species];
    if ('fxIndex' in p) def.fxIndex = p.fxIndex;
    return def;
  });
}

/** 기술 전부: 11종 × 5 = 55개 */
export const SKILLS: readonly SkillDef[] = (Object.keys(SKILL_NAMES) as SpeciesId[]).flatMap(build);

const BY_ID = new Map<SkillId, SkillDef>(SKILLS.map((k) => [k.id, k]));

export function skillDef(id: SkillId): SkillDef {
  const def = BY_ID.get(id);
  if (!def) throw new Error(`모르는 기술: ${id}`);
  return def;
}

/** 한 종의 기술 5개 (슬롯 순서) */
export function speciesSkills(species: SpeciesId): SkillDef[] {
  return SKILLS.filter((k) => k.species === species);
}

/** 그 레벨까지 익히는 기술 (슬롯 순서) */
export function learnedAt(species: SpeciesId, level: number): SkillDef[] {
  return speciesSkills(species).filter((k) => k.learnLevel <= level);
}

/** 레벨이 from에서 to로 오르며 새로 익히는 기술 (레벨 순서) */
export function newlyLearned(species: SpeciesId, from: number, to: number): SkillDef[] {
  return speciesSkills(species)
    .filter((k) => k.learnLevel > from && k.learnLevel <= to)
    .sort((a, b) => a.learnLevel - b.learnLevel || a.slot - b.slot);
}

/** 처음 가지는 기술: 익힌 것 전부(최대 MAX_SKILLS), 적어도 1개 */
export function defaultSkills(species: SpeciesId, level: number): SkillId[] {
  const learned = learnedAt(species, level).map((k) => k.id);
  return (learned.length > 0 ? learned : [`${species}-1`]).slice(0, MAX_SKILLS);
}

/** 가진 속성 기술 중 위력이 가장 낮은 것 (같으면 슬롯 번호 작은 것). 속성 기술이 없으면 null */
export function weakestSkill(held: SkillId[]): SkillDef | null {
  let best: SkillDef | null = null;
  for (const id of held) {
    const k = skillDef(id);
    if (k.kind === 'special') continue;
    if (!best || k.basePower < best.basePower || (k.basePower === best.basePower && k.slot < best.slot)) best = k;
  }
  return best;
}

/** "이 초 안에 풀면 강력!"의 정수 초 (화면 표시와 판정이 같은 값) */
export function fastSeconds(def: SkillDef, timeMs: number): number {
  return Math.max(1, Math.round((timeMs * def.fastRatio) / 1000));
}

/** 끝난 전투에서 야생 구구몬의 기술을 따라 배울지 뽑는다. 당첨 못 하거나 후보가 없으면 null */
export function rollCopy(rng: Rng, wildSpecies: SpeciesId, wildLevel: number, held: SkillId[]): SkillId | null {
  if (!(rng() < COPY_CHANCE)) return null;
  const candidates = learnedAt(wildSpecies, wildLevel).filter((k) => !held.includes(k.id));
  if (candidates.length === 0) return null;
  return candidates[Math.min(candidates.length - 1, Math.floor(rng() * candidates.length))].id;
}
