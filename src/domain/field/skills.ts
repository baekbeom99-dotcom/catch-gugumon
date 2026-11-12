/**
 * 구구몬 기술 표 — 종마다 기술 5개(주속성 3·부속성 1·특수 1). 순수 데이터와 계산만 (React 없음).
 * 위력·발동 조건·배우는 레벨은 SLOT_PATTERN, 이름은 SKILL_NAMES, 특수 배정은 SPECIAL_OF_SPECIES 한 곳.
 *
 * 개정 3(설계서 0-1절) — 기술 버튼은 3개:
 *  - 주속성 버튼: 자기 종 주속성 기술(슬롯 1·2·5) 사슬. 느리면 1번, 빠르면 2번, 아주 빠르면 3번이 나간다.
 *  - 부속성 버튼: 부속성 자리 기술(자기 종 4번이나 복사한 속성 기술). 빠르면 그 기술, 느리면 주속성 1번.
 *  - 특수 버튼: 특수 자리 기술(자기 종 3번이나 복사한 특수). 시간 안이면 특수 효과, 못 풀면 가장 약한 속성 기술.
 */
import type { Rng } from '../random';
import { MAIN_ELEMENT, SUB_ELEMENT, type Element } from './elements';
import type { SpeciesId } from './creatures';
import { COPY_CHANCE, MAX_SKILLS, SUB_FAST_RATIO } from './tuning';

export type SkillId = string;
export type SkillKind = 'main' | 'sub' | 'special';
/** 특수 효과. stun(스턴)은 주②에만 붙는다(특수 슬롯에는 배정 안 함) */
export type SpecialKind = 'heal' | 'guard' | 'clue' | 'calm' | 'charge' | 'stun';

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

/**
 * 모든 종 공통 슬롯 패턴 (설계서 2-2, 위력·조건은 개정 3 0-1절: 주① 2·주② 2+효과·주③ 3·부속성 3·특수 2).
 * 주①(슬롯 1)은 느려도 나가는 기본이라 fastRatio를 판정에 쓰지 않는다 (값은 화면 글 때문에 남겨 둔다).
 * 주③(슬롯 5)의 조건 시간은 주②보다 짧아야 한다 (테스트가 지킨다).
 */
export const SLOT_PATTERN = [
  { slot: 1, kind: 'main', learnLevel: 1, basePower: 2, fastRatio: 0.6, fxIndex: 0 },
  { slot: 2, kind: 'main', learnLevel: 3, basePower: 2, fastRatio: 0.5, fxIndex: 1 },
  { slot: 3, kind: 'special', learnLevel: 8, basePower: 2, fastRatio: 0.5 },
  { slot: 4, kind: 'sub', learnLevel: 14, basePower: 3, fastRatio: SUB_FAST_RATIO, fxIndex: 3 },
  { slot: 5, kind: 'main', learnLevel: 20, basePower: 3, fastRatio: 0.3, fxIndex: 2 },
] as const;

/** 부속성 자리 위력: 복사한 다른 종 기술도 이 위력으로 통일 (설계서 0-1절, 가정) */
const SUB_SEAT_POWER = SLOT_PATTERN[3].basePower;
/** 주속성 사슬의 단계: 슬롯 1 → 1번, 슬롯 2 → 2번, 슬롯 5 → 3번 */
const MAIN_TIER: Record<number, 1 | 2 | 3> = { 1: 1, 2: 2, 5: 3 };

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

/**
 * 주②가 나갈 때 붙는 효과 (설계서 0-1절, 종마다 하나 — 특수 슬롯 효과와 겹치지 않게).
 * stun 다음 적 공격 1회 무효 · heal 내 체력 회복 · guard 다음 적 공격 절반
 */
export const M2_EFFECT_OF_SPECIES: Record<SpeciesId, SpecialKind> = {
  cloud: 'stun',
  mushroom: 'heal',
  fluff: 'guard',
  jelly: 'stun',
  antenna: 'heal',
  horn: 'stun',
  pebble: 'guard',
  ghost: 'heal',
  'legend-fluff': 'stun',
  'legend-horn': 'guard',
  'legend-ghost': 'heal',
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

/**
 * 가진 속성 기술 중 위력이 가장 낮은 것 (같으면 슬롯 번호 작은 것). 속성 기술이 없으면 null.
 * owner를 주면 자리 위력으로 본다(부속성 자리의 복사 기술은 위력 3) — 그러면 보통 주①이 된다
 */
export function weakestSkill(held: readonly SkillId[], owner?: SpeciesId): SkillDef | null {
  let best: SkillDef | null = null;
  for (const id of held) {
    const raw = skillDef(id);
    if (raw.kind === 'special') continue;
    const k = owner ? seatedDef(raw, owner) : raw;
    if (!best || k.basePower < best.basePower || (k.basePower === best.basePower && k.slot < best.slot)) best = k;
  }
  return best;
}

/** "이 초 안에 풀면 강력!"의 정수 초 (화면 표시와 판정이 같은 값) */
export function fastSeconds(def: SkillDef, timeMs: number): number {
  return Math.max(1, Math.round((timeMs * def.fastRatio) / 1000));
}

// ── 개정 3: 자리와 버튼 (설계서 0-1절) ──

/** 가진 기술이 들어가는 자리: 주속성 사슬 · 부속성 자리(1개) · 특수 자리(1개) */
export type Seat = 'main' | 'sub' | 'special';

/**
 * 이 기술이 owner 구구몬에게서 어느 자리인가.
 * 자기 종 주속성(슬롯 1·2·5) → 주속성 사슬, 특수(자기·다른 종) → 특수 자리,
 * 그 밖(자기 종 부속성, 다른 종의 속성 기술 — 주①~③·부속성 모두) → 부속성 자리
 */
export function seatOf(def: SkillDef, owner: SpeciesId): Seat {
  if (def.kind === 'special') return 'special';
  if (def.species === owner && def.kind === 'main') return 'main';
  return 'sub';
}

/**
 * 자리에 앉힌 기술: 부속성 자리에 앉은 다른 종 기술은 위력·조건을 부속성 자리 값(위력 3·SUB_FAST_RATIO)으로 바꾼다.
 * 이름·속성·효과 칸(fxIndex)은 원래 그대로. 그 밖은 원래 기술 그대로(같은 객체)
 */
export function seatedDef(def: SkillDef, owner: SpeciesId): SkillDef {
  if (seatOf(def, owner) !== 'sub' || def.species === owner) return def;
  return { ...def, basePower: SUB_SEAT_POWER, fastRatio: SUB_FAST_RATIO };
}

/** 기술 버튼. owner는 버튼 주인 종 (자리 위력·주① 찾기에 쓴다) */
export type SkillButton =
  /** 주속성 버튼: 가진 자기 종 주속성 기술을 슬롯 순서로 (첫째가 주①) */
  | { kind: 'main'; owner: SpeciesId; chain: SkillDef[] }
  /** 부속성 버튼: 자리에 앉힌 모습(seatedDef) */
  | { kind: 'sub'; owner: SpeciesId; skill: SkillDef }
  | { kind: 'special'; owner: SpeciesId; skill: SkillDef };

/** 가진 것 중 자기 종 주속성 사슬 (슬롯 순서). 하나도 없으면(깨진 목록) 주①을 넣어 비지 않게 한다 */
function mainChain(held: readonly SkillId[], owner: SpeciesId): SkillDef[] {
  const chain = speciesSkills(owner).filter((k) => k.kind === 'main' && held.includes(k.id));
  return chain.length > 0 ? chain : [skillDef(`${owner}-1`)];
}

/**
 * 가진 기술로 만든 버튼 (최대 3개): 주속성 버튼은 늘 맨 앞, 부속성·특수는 그 자리 기술을 가졌을 때만.
 * 한 자리에 둘 이상이 있으면(깨진 목록) 가진 순서에서 앞의 것 — 저장 다듬기(normalizeSkills)와 같은 규칙
 */
export function skillButtons(held: readonly SkillId[], owner: SpeciesId): SkillButton[] {
  const buttons: SkillButton[] = [{ kind: 'main', owner, chain: mainChain(held, owner) }];
  const defs = held.flatMap((id) => (BY_ID.has(id) ? [skillDef(id)] : []));
  const sub = defs.find((k) => seatOf(k, owner) === 'sub');
  const special = defs.find((k) => seatOf(k, owner) === 'special');
  if (sub) buttons.push({ kind: 'sub', owner, skill: seatedDef(sub, owner) });
  if (special) buttons.push({ kind: 'special', owner, skill: special });
  return buttons;
}

/** 버튼을 대표하는 기술 (이름 보이기 등): 주속성은 주①, 나머지는 그 자리 기술 */
export function buttonFace(button: SkillButton): SkillDef {
  return button.kind === 'main' ? button.chain[0] : button.skill;
}

/** 발동 판정 결과 */
export interface FiredSkill {
  /** 실제로 나간 기술 (자리에 앉힌 모습 — 부속성 자리의 복사 기술은 위력 3) */
  fired: SkillDef;
  /** 단계: 주①·느림·대신 나감 1, 주②·부속성 2, 주③ 3 (특수 성공은 1) */
  tier: 1 | 2 | 3;
  /** 속성 기술의 윗단계(주②·주③·부속성)가 나갔나 — 예전 "강력"의 자리 */
  upper: boolean;
  /** 발동한 특수 효과: 특수 버튼 성공이면 그 특수, 주②가 나가면 M2_EFFECT_OF_SPECIES (주①·주③·부속성·대신 나감은 없음) */
  special?: SpecialKind;
  /** 특수가 늦어 다른 기술이 대신 나갔나 */
  usedFallback: boolean;
}

/**
 * 정답일 때 이 버튼에서 어떤 기술이 나가나 (설계서 0-1절). elapsedMs는 문제를 시작한 뒤 흐른 시간,
 * timeMs는 그 단계 문제 제한 시간(여유로 늘어난 시간 빼고). 틀린 뒤 힌트를 보고 같은 문제를 다시 풀 때도
 * 시계가 처음부터 다시 가므로 같은 규칙으로 판정한다 (윗단계·특수 발동 가능 — 사용자 결정).
 * 조건은 fastSeconds(정수 초, 화면 표시와 같은 값) 이내.
 */
export function pickFired(
  button: SkillButton,
  held: readonly SkillId[],
  elapsedMs: number,
  timeMs: number,
): FiredSkill {
  const within = (def: SkillDef) => elapsedMs <= fastSeconds(def, timeMs) * 1000;
  const owner = button.owner;

  if (button.kind === 'main') {
    const base = button.chain[0];
    // 높은 단계부터: 주③ → 주② (없는 단계는 건너뜀). 주①은 조건 없는 기본
    for (const def of [...button.chain].reverse()) {
      if (def === base) break;
      if (!within(def)) continue;
      const tier = MAIN_TIER[def.slot] ?? 1;
      const hit: FiredSkill = { fired: def, tier, upper: true, usedFallback: false };
      if (tier === 2) hit.special = M2_EFFECT_OF_SPECIES[def.species];
      return hit;
    }
    return { fired: base, tier: MAIN_TIER[base.slot] ?? 1, upper: false, usedFallback: false };
  }

  if (button.kind === 'sub') {
    if (within(button.skill)) return { fired: button.skill, tier: 2, upper: true, usedFallback: false };
    return { fired: mainChain(held, owner)[0], tier: 1, upper: false, usedFallback: false };
  }

  const sp = button.skill;
  if (sp.special && within(sp)) return { fired: sp, tier: 1, upper: false, special: sp.special, usedFallback: false };
  // 늦으면 가진 속성 기술 중 가장 약한 것 (자리 위력으로 — 보통 주①). 속성 기술이 없으면(깨진 목록) 특수 기술 자신
  return { fired: weakestSkill(held, owner) ?? sp, tier: 1, upper: false, usedFallback: true };
}

/** 끝난 전투에서 야생 구구몬의 기술을 따라 배울지 뽑는다. 당첨 못 하거나 후보가 없으면 null */
export function rollCopy(rng: Rng, wildSpecies: SpeciesId, wildLevel: number, held: SkillId[]): SkillId | null {
  if (!(rng() < COPY_CHANCE)) return null;
  const candidates = learnedAt(wildSpecies, wildLevel).filter((k) => !held.includes(k.id));
  if (candidates.length === 0) return null;
  return candidates[Math.min(candidates.length - 1, Math.floor(rng() * candidates.length))].id;
}
