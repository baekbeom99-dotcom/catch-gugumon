import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { playSfx, SKILL_SFX, SOUNDS, SPECIAL_SFX, sfxLength, type Sfx } from '../../src/audio/sfx';
import { useGameStore } from '../../src/store/useGameStore';

const CAPSULE_SFX: Sfx[] = ['throw', 'capsuleOpen', 'capsuleBounce', 'capsuleShake', 'capsuleClick', 'capsulePop'];

describe('캡슐 효과음 6개', () => {
  it('SOUNDS에 모두 있고 각각 0.6초 안에 끝난다', () => {
    for (const name of CAPSULE_SFX) {
      expect(SOUNDS[name], name).toBeDefined();
      expect(SOUNDS[name].length).toBeGreaterThan(0);
      expect(sfxLength(name), name).toBeLessThanOrEqual(0.6);
    }
  });

  it('첫 소리 높이가 서로 달라 구별된다 (E2E가 소리를 알아보는 표시)', () => {
    const firsts = CAPSULE_SFX.map((n) => SOUNDS[n][0].freq);
    expect(new Set(firsts).size).toBe(CAPSULE_SFX.length);
  });
});

const NEW_SFX: Sfx[] = [
  'fxGrass', 'fxPoison', 'fxLight', 'fxWater', 'fxThunder', 'fxEarth', 'fxFire',
  'fxPower', 'superEffective', 'notVery',
  'skillHeal', 'skillGuard', 'skillClue', 'skillCalm', 'skillCharge',
];

describe('기술 효과음 15개', () => {
  it('SKILL_SFX가 속성 7개, SPECIAL_SFX가 특수 6종을 모두 덮는다', () => {
    expect(Object.keys(SKILL_SFX).sort()).toEqual(['earth', 'fire', 'grass', 'light', 'poison', 'thunder', 'water']);
    expect(Object.keys(SPECIAL_SFX).sort()).toEqual(['calm', 'charge', 'clue', 'guard', 'heal', 'stun']);
    for (const n of [...Object.values(SKILL_SFX), ...Object.values(SPECIAL_SFX)]) expect(NEW_SFX).toContain(n);
  });

  it('각각 있고 0.4초 안에 끝난다', () => {
    for (const name of NEW_SFX) {
      expect(SOUNDS[name], name).toBeDefined();
      expect(sfxLength(name), name).toBeLessThanOrEqual(0.4);
    }
  });

  it('첫 음높이가 서로 다르고 다른 소리의 어떤 음과도 겹치지 않아 구별된다', () => {
    const firsts = NEW_SFX.map((n) => SOUNDS[n][0].freq);
    expect(new Set(firsts).size).toBe(NEW_SFX.length);
    for (const n of NEW_SFX) {
      const f = SOUNDS[n][0].freq;
      for (const [other, notes] of Object.entries(SOUNDS)) {
        if (other === n) continue;
        expect(notes.map((x) => x.freq), `${n} vs ${other}`).not.toContain(f);
      }
    }
  });
});

describe('소리 끔 규칙', () => {
  const created: unknown[] = [];
  beforeEach(() => {
    created.length = 0;
    class FakeContext {
      constructor() {
        created.push(this);
      }
    }
    vi.stubGlobal('window', { AudioContext: FakeContext });
    vi.stubGlobal('AudioContext', FakeContext);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    useGameStore.getState().resetAll();
  });

  it('소리를 끄면 AudioContext를 만들지 않는다', () => {
    useGameStore.setState({ settings: { ...useGameStore.getState().settings, sound: false } });
    for (const name of [...CAPSULE_SFX, ...NEW_SFX]) playSfx(name);
    expect(created).toHaveLength(0);
  });

  it('소리 크기가 0이어도 만들지 않는다', () => {
    useGameStore.setState({ settings: { ...useGameStore.getState().settings, sound: true, volume: 0 } });
    playSfx('capsulePop');
    expect(created).toHaveLength(0);
  });
});
