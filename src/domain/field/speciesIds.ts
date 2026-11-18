/**
 * 구구몬 종 id 목록 — 49종, 번호 001~050에서 017만 빠진다(017은 주인공 그림이라 종이 아니다).
 * 아무것도 가져오지 않는 파일이라 creatures·elements·skills 어디서든 먼저 읽을 수 있다.
 * 퀴즈 모험 몬스터(battle.ts의 MonsterKind)와는 따로다.
 */
export const SPECIES_IDS = [
  'c001', 'c002', 'c003', 'c004', 'c005', 'c006', 'c007', 'c008', 'c009', 'c010',
  'c011', 'c012', 'c013', 'c014', 'c015', 'c016', 'c018', 'c019', 'c020',
  'c021', 'c022', 'c023', 'c024', 'c025', 'c026', 'c027', 'c028', 'c029', 'c030',
  'c031', 'c032', 'c033', 'c034', 'c035', 'c036', 'c037', 'c038', 'c039', 'c040',
  'c041', 'c042', 'c043', 'c044', 'c045', 'c046', 'c047', 'c048', 'c049', 'c050',
] as const;

export type SpeciesId = (typeof SPECIES_IDS)[number];

/** 레전드 12종 (13단 문제, 황금 캡슐) */
export const LEGEND_SPECIES = ['c013', 'c014', 'c015', 'c016', 'c018', 'c019', 'c045', 'c046', 'c047', 'c048', 'c049', 'c050'] as const satisfies readonly SpeciesId[];

/** 종 번호 (c034 → 34) */
export function speciesNumber(id: SpeciesId): number {
  return Number(id.slice(1));
}
