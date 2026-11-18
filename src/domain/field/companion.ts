/** 함께 다니는 구구몬 고르기 — 순수 계산(React 없음) */
import { SPECIES_IDS, type SpeciesId } from './speciesIds';
import { isFainted } from './wounds';

/** 종 목록 순서 (저장의 SPECIES_IDS와 같은 순서) — 마지막 동률을 가를 때 쓴다 */
const ORDER: readonly SpeciesId[] = SPECIES_IDS;

type Pickable = { level: number; hp: number; firstCaughtAt: number };

/**
 * 쓰러진 구구몬 대신 함께 다닐 수 있는 구구몬 목록.
 * 도감에서 except(쓰러진 종)를 뺀 체력 > 0인 종: 레벨 높은 순 → 같으면 먼저 잡은 순 → 그래도 같으면 종 목록 순서.
 */
export function healthyCompanions(species: Partial<Record<SpeciesId, Pickable>>, except: SpeciesId): SpeciesId[] {
  const list: { id: SpeciesId; e: Pickable; i: number }[] = [];
  ORDER.forEach((id, i) => {
    if (id === except) return;
    // 종 목록에 있는 이름만 본다 (이상한 키는 무시)
    const e = Object.prototype.hasOwnProperty.call(species, id) ? species[id] : undefined;
    if (!e || isFainted(e)) return;
    list.push({ id, e, i });
  });
  list.sort((a, b) => b.e.level - a.e.level || a.e.firstCaughtAt - b.e.firstCaughtAt || a.i - b.i);
  return list.map((x) => x.id);
}

/** 구구몬이 쓰러졌을 때 대신 함께 다닐 종 = healthyCompanions의 첫째. 후보가 없으면 null */
export function pickReplacement(species: Partial<Record<SpeciesId, Pickable>>, fainted: SpeciesId): SpeciesId | null {
  return healthyCompanions(species, fainted)[0] ?? null;
}
