import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { playSfx, SOUNDS, sfxLength, type Sfx } from '../../src/audio/sfx';
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
    for (const name of CAPSULE_SFX) playSfx(name);
    expect(created).toHaveLength(0);
  });

  it('소리 크기가 0이어도 만들지 않는다', () => {
    useGameStore.setState({ settings: { ...useGameStore.getState().settings, sound: true, volume: 0 } });
    playSfx('capsulePop');
    expect(created).toHaveLength(0);
  });
});
