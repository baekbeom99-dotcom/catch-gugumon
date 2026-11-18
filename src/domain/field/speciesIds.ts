/**
 * 구구몬 종 id 목록 — 48종, 번호 001~050에서 013·017이 빠진다
 * (017은 주인공 그림, 013은 마을 사람(NPC) 그림이라 종이 아니다).
 * 아무것도 가져오지 않는 파일이라 creatures·elements·skills 어디서든 먼저 읽을 수 있다.
 * 퀴즈 모험 몬스터(battle.ts의 MonsterKind)와는 따로다.
 */
export const SPECIES_IDS = [
  'c001', 'c002', 'c003', 'c004', 'c005', 'c006', 'c007', 'c008', 'c009', 'c010',
  'c011', 'c012', 'c014', 'c015', 'c016', 'c018', 'c019', 'c020',
  'c021', 'c022', 'c023', 'c024', 'c025', 'c026', 'c027', 'c028', 'c029', 'c030',
  'c031', 'c032', 'c033', 'c034', 'c035', 'c036', 'c037', 'c038', 'c039', 'c040',
  'c041', 'c042', 'c043', 'c044', 'c045', 'c046', 'c047', 'c048', 'c049', 'c050',
] as const;

export type SpeciesId = (typeof SPECIES_IDS)[number];

/** 레전드 11종 (13단 문제, 황금 캡슐) */
export const LEGEND_SPECIES = ['c014', 'c015', 'c016', 'c018', 'c019', 'c045', 'c046', 'c047', 'c048', 'c049', 'c050'] as const satisfies readonly SpeciesId[];

/** 종 번호 (c034 → 34) */
export function speciesNumber(id: SpeciesId): number {
  return Number(id.slice(1));
}

/**
 * 종 표를 만든 뒤에 뺀 종 번호 (013: 마을 사람 그림이 됐다).
 * 차례로 돌려 주는 표(특수·주② 효과·레전드 서식지)는 뺀 자리도 세어, 남은 종의 값이 빼기 전과 같다
 */
export const RETIRED_NUMBERS: readonly number[] = [13];

/** 종 표에서의 옛 차례: 목록 차례 + 앞에서 뺀 종 수 (c012 → 11, c014 → 13) */
export function speciesSlot(id: SpeciesId): number {
  const n = speciesNumber(id);
  return SPECIES_IDS.indexOf(id) + RETIRED_NUMBERS.filter((r) => r < n).length;
}

/** 레전드 안에서의 옛 차례 (013이 맨 앞 레전드였다: c014 → 1) */
export function legendSlot(id: SpeciesId): number {
  const n = speciesNumber(id);
  return (LEGEND_SPECIES as readonly SpeciesId[]).indexOf(id) + RETIRED_NUMBERS.filter((r) => r < n).length;
}
