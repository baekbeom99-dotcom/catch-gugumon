/** 저장하지 않는 화면 상태: 이번에 앱을 열었을 때만 보여줄 연출들 */
import { create } from 'zustand';
import type { Stage } from '../domain/pet';
import type { FieldNotice, SkillOffer } from './fieldData';

export type { SkillOffer } from './fieldData';

interface SessionState {
  /** 24시간 넘게 쉬다 돌아왔을 때 반겨주는 연출 */
  welcomeBack: boolean;
  /** 펫 화면에서 보여줄 진화 축하 */
  pendingEvolution: Stage | null;
  /** 펫 화면에서 보여줄 친밀도 레벨업 */
  pendingLevelUp: number | null;
  /** 부화 직후 첫 밥 주기 안내 */
  feedTutorial: boolean;
  /** 야생 전투 뒤 필드에서 하나씩 보여줄 레벨업·진화 알림 */
  pendingFieldNotices: FieldNotice[];
  /** 가진 기술이 가득 차서 고르기를 기다리는 새 기술 (선택창이 하나씩 보여 준다, 앞이 먼저) */
  skillOffers: SkillOffer[];
  /** 기술 제안을 뒤에 쌓는다 */
  pushSkillOffer: (...offers: SkillOffer[]) => void;
  /** 맨 앞 제안을 뺀다 (배웠거나 포기했을 때) */
  shiftSkillOffer: () => void;
  set: (patch: Partial<Omit<SessionState, 'set'>>) => void;
}

export const useSessionStore = create<SessionState>()((set) => ({
  welcomeBack: false,
  pendingEvolution: null,
  pendingLevelUp: null,
  feedTutorial: false,
  pendingFieldNotices: [],
  skillOffers: [],
  pushSkillOffer: (...offers) => {
    if (offers.length > 0) set((s) => ({ skillOffers: [...s.skillOffers, ...offers] }));
  },
  shiftSkillOffer: () => set((s) => (s.skillOffers.length > 0 ? { skillOffers: s.skillOffers.slice(1) } : {})),
  set: (patch) => set(patch),
}));
