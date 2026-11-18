import type { Dan } from '../facts';
import type { SpeciesId } from './speciesIds';

export type FieldId = 'meadow' | 'waterside' | 'desert';
/** 지도 이름: 세 필드와 태초마을 */
export type MapId = FieldId | 'town';
export const MAP_IDS: readonly MapId[] = ['town', 'meadow', 'waterside', 'desert'];
export const TOWN_NAME = '태초마을';

export const CHALLENGE_DAN: Dan = 12;
/** 레전드 단 */
export const LEGEND_DAN: Dan = 13;

/** 필드마다 단과 나오는 종 (레전드 11종은 어느 필드에서나 드물게 — creatures.ts의 LEGEND_SPECIES) */
export const FIELDS: Record<FieldId, { name: string; dans: Dan[]; species: SpeciesId[] }> = {
  meadow: {
    name: '초원',
    dans: [2, 4, 8],
    species: ['c033', 'c034', 'c035', 'c036', 'c037', 'c038', 'c039', 'c040', 'c041', 'c042', 'c043', 'c044'],
  },
  waterside: {
    name: '물가',
    dans: [3, 6, 9],
    species: ['c020', 'c021', 'c022', 'c023', 'c024', 'c025', 'c026', 'c027', 'c028', 'c029', 'c030', 'c031', 'c032'],
  },
  desert: {
    name: '사막',
    dans: [5, 7, 12],
    species: ['c001', 'c002', 'c003', 'c004', 'c005', 'c006', 'c007', 'c008', 'c009', 'c010', 'c011', 'c012'],
  },
};

/** 도전 단(12단)이 닫혀 있으면 12를 뺀 단 목록 */
export function fieldDans(field: FieldId, challengeUnlocked: boolean): Dan[] {
  const dans = FIELDS[field].dans;
  return challengeUnlocked ? [...dans] : dans.filter((d) => d !== CHALLENGE_DAN);
}
