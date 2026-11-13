/** 함께 다니는(조작하는) 구구몬 고르기 — 순수 계산(React 없음) */
import { MONSTER_KINDS } from '../battle';
import { LEGEND_SPECIES, type SpeciesId } from './creatures';
import { isFainted } from './wounds';

/** 종 목록 순서 (저장의 SPECIES_IDS와 같은 순서) — 마지막 동률을 가를 때 쓴다 */
const ORDER: readonly SpeciesId[] = [...MONSTER_KINDS, ...LEGEND_SPECIES];

type Pickable = { level: number; hp: number; firstCaughtAt: number };

/**
 * 쓰러진 구구몬 대신 고를 수 있는 구구몬 목록 (고르기 창에 이 순서로 보인다).
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

/**
 * 지금 조작하는 구구몬(current)의 형편.
 * ok: 건강함 / pick: 쓰러졌고 도감에 건강한 다른 구구몬이 있음 → 고르기 창 / stuck: 쓰러졌고 다른 구구몬도 없음 → 마을에서 살려야 함.
 * 저장에 따로 적지 않고 저장 상태에서 바로 정하므로, 앱을 닫았다 열어도 같은 창이 다시 뜬다.
 */
export function companionState(current: SpeciesId, species: Partial<Record<SpeciesId, Pickable>>): 'ok' | 'pick' | 'stuck' {
  const e = species[current];
  if (!e || !isFainted(e)) return 'ok';
  return healthyCompanions(species, current).length > 0 ? 'pick' : 'stuck';
}
