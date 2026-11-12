/** 기술 선택창의 순수 도우미 (화면 없이 시험할 수 있게 떼어 둠) */
import { setUpdateBusy } from '../pwa/autoUpdate';
import { MAX_SKILLS } from '../domain/field/tuning';
import type { SkillOffer } from '../store/fieldData';

/**
 * 맨 앞 제안을 어떻게 할까:
 * - skip: 그 종이 없거나 이미 가진 기술 (같은 전투에서 같은 기술이 두 번 올 수 있다) → 건너뜀
 * - take: 빈 자리가 있어 그냥 가진다 (보통은 일어나지 않는다)
 * - ask: 가득이라 선택창을 띄운다
 */
export function offerStatus(offer: SkillOffer | null, held: readonly string[] | null): 'none' | 'skip' | 'take' | 'ask' {
  if (!offer) return 'none';
  if (!held || held.includes(offer.skillId)) return 'skip';
  return held.length < MAX_SKILLS ? 'take' : 'ask';
}

/** 떠 있는 동안 자동 새로고침을 막고, 돌려받은 함수로 푼다 (useEffect에 그대로 넘긴다) */
export function holdUpdateBusy(): () => void {
  setUpdateBusy(true);
  return () => setUpdateBusy(false);
}
