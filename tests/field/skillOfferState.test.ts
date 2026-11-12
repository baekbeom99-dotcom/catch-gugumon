import { beforeEach, describe, expect, it, vi } from 'vitest';

const busy: boolean[] = [];
vi.mock('../../src/pwa/autoUpdate', () => ({ setUpdateBusy: (on: boolean) => busy.push(on) }));

import { holdUpdateBusy, offerStatus } from '../../src/field/skillOfferState';
import { useSessionStore } from '../../src/store/useSessionStore';
import type { SkillOffer } from '../../src/store/fieldData';

const offer = (skillId: string): SkillOffer => ({ species: 'cloud', skillId, source: 'copy', fromSpecies: 'horn' }) as SkillOffer;
const FIVE = ['cloud-1', 'horn-1', 'horn-2', 'jelly-1', 'jelly-2'];

describe('기술 선택창 도우미', () => {
  beforeEach(() => {
    busy.length = 0;
    useSessionStore.setState({ skillOffers: [] });
  });

  it('이미 가진 기술·없는 종은 건너뛰고, 가득이면 묻고, 빈 자리면 그냥 가진다', () => {
    expect(offerStatus(null, FIVE)).toBe('none');
    expect(offerStatus(offer('horn-1'), FIVE)).toBe('skip');
    expect(offerStatus(offer('horn-3'), null)).toBe('skip');
    expect(offerStatus(offer('horn-3'), FIVE)).toBe('ask');
    expect(offerStatus(offer('horn-3'), FIVE.slice(0, 4))).toBe('take');
  });

  it('큐 두 개: 가진 기술 제안은 건너뛰고 다음 제안이 맨 앞에 온다', () => {
    useSessionStore.setState({ skillOffers: [offer('horn-1'), offer('horn-3')] });
    const front = () => useSessionStore.getState().skillOffers[0] ?? null;
    expect(offerStatus(front(), FIVE)).toBe('skip');
    useSessionStore.getState().shiftSkillOffer();
    expect(front()?.skillId).toBe('horn-3');
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
