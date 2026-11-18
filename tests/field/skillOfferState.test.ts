import { beforeEach, describe, expect, it, vi } from 'vitest';

const busy: boolean[] = [];
vi.mock('../../src/pwa/autoUpdate', () => ({ setUpdateBusy: (on: boolean) => busy.push(on) }));

import { holdUpdateBusy, offerStatus, seatOccupant } from '../../src/field/skillOfferState';
import { useSessionStore } from '../../src/store/useSessionStore';
import type { SkillOffer } from '../../src/store/fieldData';

const offer = (skillId: string): SkillOffer => ({
  species: 'c034',
  skillId,
  source: 'copy',
  fromSpecies: 'c031',
  seat: skillId.endsWith('-3') ? 'special' : 'sub',
});
/** 주①·②·③ + 부속성 자리(복사한 c031-1) + 특수 자리(c034-3) — 다섯 자리가 모두 참 */
const FIVE = ['c034-1', 'c034-2', 'c034-5', 'c031-1', 'c034-3'];

describe('기술 선택창 도우미', () => {
  beforeEach(() => {
    busy.length = 0;
    useSessionStore.setState({ skillOffers: [] });
  });

  it('이미 가진 기술·없는 종은 건너뛰고, 그 자리가 차 있으면 묻고, 그 자리가 비면 그냥 가진다', () => {
    expect(offerStatus(null, FIVE)).toBe('none');
    expect(offerStatus(offer('c031-1'), FIVE)).toBe('skip');
    expect(offerStatus(offer('c031-3'), null)).toBe('skip');
    expect(offerStatus(offer('c031-2'), FIVE)).toBe('ask');
    expect(offerStatus(offer('c031-3'), FIVE)).toBe('ask');
    // 특수 자리가 비면 특수 제안은 그냥 가진다 (부속성 자리가 차 있어도)
    expect(offerStatus(offer('c031-3'), FIVE.slice(0, 4))).toBe('take');
    // 가진 수가 아니라 자리로 본다: 4개여도 부속성 자리가 차 있으면 묻는다
    expect(offerStatus(offer('c031-2'), FIVE.slice(0, 4))).toBe('ask');
    expect(offerStatus(offer('c031-2'), ['c034-1', 'c034-3'])).toBe('take');
  });

  it('잊을 기술: 그 자리의 지금 기술 하나 (removeId가 그 사이 바뀌었어도 지금 가진 것으로)', () => {
    expect(seatOccupant(offer('c031-2'), FIVE)).toBe('c031-1');
    expect(seatOccupant(offer('c031-3'), FIVE)).toBe('c034-3');
    expect(seatOccupant(offer('c031-2'), ['c034-1'])).toBeNull();
    expect(seatOccupant({ ...offer('c031-2'), removeId: 'c036-1' }, FIVE)).toBe('c031-1');
  });

  it('큐 두 개: 가진 기술 제안은 건너뛰고 다음 제안이 맨 앞에 온다', () => {
    useSessionStore.setState({ skillOffers: [offer('c031-1'), offer('c031-2')] });
    const front = () => useSessionStore.getState().skillOffers[0] ?? null;
    expect(offerStatus(front(), FIVE)).toBe('skip');
    useSessionStore.getState().shiftSkillOffer();
    expect(front()?.skillId).toBe('c031-2');
    expect(offerStatus(front(), FIVE)).toBe('ask');
    useSessionStore.getState().shiftSkillOffer();
    expect(front()).toBeNull();
  });

  it('setUpdateBusy는 켜고(true) 풀 때(false) 짝이 맞는다', () => {
    const release = holdUpdateBusy();
    expect(busy).toEqual([true]);
    release();
    expect(busy).toEqual([true, false]);
  });
});
