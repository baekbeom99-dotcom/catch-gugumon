/** 기술 선택창의 순수 도우미 (화면 없이 시험할 수 있게 떼어 둠) */
import { setUpdateBusy } from '../pwa/autoUpdate';
import { seatHolder, type SkillOffer } from '../store/fieldData';

/**
 * 맨 앞 제안을 어떻게 할까 (가진 수가 아니라 그 제안의 자리로 본다):
 * - skip: 그 종이 없거나 이미 가진 기술 (같은 전투에서 같은 기술이 두 번 올 수 있다) → 건너뜀
 * - take: 그 자리가 비어 있어 그냥 가진다 (앞 제안을 받아 자리가 비었을 때 등)
 * - ask: 그 자리가 차 있어 선택창을 띄운다
 */
export function offerStatus(offer: SkillOffer | null, held: readonly string[] | null): 'none' | 'skip' | 'take' | 'ask' {
  if (!offer) return 'none';
  if (!held || held.includes(offer.skillId)) return 'skip';
  return seatOccupant(offer, held) ? 'ask' : 'take';
}

/**
 * 선택창에서 잊을 기술: 지금 그 자리에 있는 기술 하나 (removeId는 제안을 만들 때의 값이라 그 사이 바뀌었을 수 있다).
 * 같은 자리끼리만 바꿀 수 있으므로(acceptSkillOffer) 고를 것은 이것 하나다
 */
export function seatOccupant(offer: SkillOffer, held: readonly string[]): string | null {
  return seatHolder(offer.species, held, offer.seat);
}

/** 떠 있는 동안 자동 새로고침을 막고, 돌려받은 함수로 푼다 (useEffect에 그대로 넘긴다) */
export function holdUpdateBusy(): () => void {
  setUpdateBusy(true);
  return () => setUpdateBusy(false);
}
