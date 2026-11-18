/** 구구몬 경험치·레벨 규칙 — 설계서 6-2. 순수 계산(React 없음). 필드 구구몬은 진화하지 않는다(종마다 한 단계) */
import type { SpeciesEntry } from '../../store/fieldData';
import { speciesDef, type SpeciesId } from './creatures';
import { EXP_BASE, EXP_PER_LEVEL, MAX_LEVEL } from './tuning';

// 수치는 tuning.ts에서 정한다 (예전 import 자리 유지용으로 다시 내보냄)
export { CORRECT_EXP, DUPLICATE_EXP, MAX_LEVEL, PARTICIPATION_EXP } from './tuning';

/** 다음 레벨까지 필요한 경험치 */
export function expToNext(level: number): number {
  return EXP_BASE + level * EXP_PER_LEVEL;
}

export interface AddExpResult {
  entry: SpeciesEntry;
  levelsGained: number;
}

/** 경험치를 더한다. 여러 레벨이 한 번에 오를 수 있고, Lv30에서 멈춘다(경험치 0). 단계는 늘 1 */
export function addExp(e: SpeciesEntry, exp: number): AddExpResult {
  let level = e.level;
  let have = e.exp + Math.max(0, exp);
  while (level < MAX_LEVEL && have >= expToNext(level)) {
    have -= expToNext(level);
    level += 1;
  }
  if (level >= MAX_LEVEL) {
    level = MAX_LEVEL;
    have = 0;
  }
  return { entry: { ...e, level, exp: have, stage: 1 }, levelsGained: level - e.level };
}

/** 화면에 쓰는 이름. stage는 예전 호출 자리 때문에 받지만, 진화가 없어 이름은 늘 종 이름 그대로 */
export function displayName(id: SpeciesId, _stage: 1 | 2 | 3 = 1): string {
  return speciesDef(id).name;
}
