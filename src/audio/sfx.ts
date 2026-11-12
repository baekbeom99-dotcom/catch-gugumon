/** Web Audio 합성 효과음 — 오디오 파일 없이 즉시 반응 */
import type { Element } from '../domain/field/elements';
import type { SpecialKind } from '../domain/field/skills';
import { useGameStore } from '../store/useGameStore';

export type Sfx =
  | 'tap'
  | 'correct'
  | 'gentle'
  | 'star'
  | 'capture'
  | 'combo'
  | 'coin'
  | 'fanfare'
  | 'lullaby'
  // 캡슐 던지기: 던짐·빨려듦·통통·흔들림·찰칵(잡힘)·뻥(열림)
  | 'throw'
  | 'capsuleOpen'
  | 'capsuleBounce'
  | 'capsuleShake'
  | 'capsuleClick'
  | 'capsulePop'
  // 기술 효과음: 속성 7, 강력 1, 상성 2, 특수 5
  | 'fxGrass'
  | 'fxPoison'
  | 'fxLight'
  | 'fxWater'
  | 'fxThunder'
  | 'fxEarth'
  | 'fxFire'
  | 'fxPower'
  | 'superEffective'
  | 'notVery'
  | 'skillHeal'
  | 'skillGuard'
  | 'skillClue'
  | 'skillCalm'
  | 'skillCharge';

interface Note {
  freq: number;
  start: number;
  dur: number;
  type?: OscillatorType;
  /** 1 = 기본 크기 */
  gain?: number;
}

/** 도레미 음높이 (Hz) */
const N = { C5: 523, D5: 587, E5: 659, G5: 784, A5: 880, C6: 1047, E6: 1319, G6: 1568, A6: 1760 } as const;

export const SOUNDS: Record<Sfx, Note[]> = {
  tap: [{ freq: 660, start: 0, dur: 0.05, gain: 0.6 }],
  correct: [
    { freq: N.G5, start: 0, dur: 0.09 },
    { freq: N.C6, start: 0.08, dur: 0.15 },
  ],
  // 오답: 부정적인 '삐-' 대신 부드럽게 내려가는 소리
  gentle: [
    { freq: N.C5, start: 0, dur: 0.12, type: 'sine' },
    { freq: 440, start: 0.1, dur: 0.18, type: 'sine' },
  ],
  star: [
    { freq: N.E6, start: 0, dur: 0.08 },
    { freq: N.A6, start: 0.07, dur: 0.12 },
  ],
  capture: [
    { freq: N.C5, start: 0, dur: 0.1 },
    { freq: N.E5, start: 0.1, dur: 0.1 },
    { freq: N.G5, start: 0.2, dur: 0.1 },
    { freq: N.C6, start: 0.3, dur: 0.25 },
  ],
  // 콤보: 빠르게 올라가는 아르페지오
  combo: [
    { freq: N.E5, start: 0, dur: 0.06 },
    { freq: N.G5, start: 0.05, dur: 0.06 },
    { freq: N.C6, start: 0.1, dur: 0.06 },
    { freq: N.E6, start: 0.15, dur: 0.14 },
  ],
  // 별을 쓰는 '짤랑'
  coin: [
    { freq: N.A5, start: 0, dur: 0.06, type: 'square', gain: 0.5 },
    { freq: N.E6, start: 0.06, dur: 0.18, type: 'square', gain: 0.5 },
  ],
  // 부화·진화·단 마스터
  fanfare: [
    { freq: N.C5, start: 0, dur: 0.12 },
    { freq: N.C5, start: 0.14, dur: 0.08 },
    { freq: N.G5, start: 0.24, dur: 0.12 },
    { freq: N.E5, start: 0.38, dur: 0.1 },
    { freq: N.G5, start: 0.5, dur: 0.1 },
    { freq: N.C6, start: 0.62, dur: 0.4 },
    { freq: N.G6, start: 0.62, dur: 0.4, type: 'sine', gain: 0.4 },
  ],
  // 잠재우기: 느리게 내려가는 자장가
  lullaby: [
    { freq: N.G5, start: 0, dur: 0.25, type: 'sine', gain: 0.7 },
    { freq: N.E5, start: 0.25, dur: 0.25, type: 'sine', gain: 0.6 },
    { freq: N.C5, start: 0.5, dur: 0.45, type: 'sine', gain: 0.5 },
  ],
  // 캡슐: 휙 날아간다
  throw: [
    { freq: 300, start: 0, dur: 0.09, type: 'sine', gain: 0.6 },
    { freq: 450, start: 0.07, dur: 0.09, type: 'sine', gain: 0.6 },
    { freq: 650, start: 0.14, dur: 0.12, type: 'sine', gain: 0.6 },
  ],
  // 캡슐: 구구몬이 빨려 들어가는 '쀼웅'
  capsuleOpen: [
    { freq: 700, start: 0, dur: 0.08, type: 'square', gain: 0.35 },
    { freq: 1000, start: 0.06, dur: 0.1, type: 'square', gain: 0.35 },
    { freq: 450, start: 0.14, dur: 0.16, type: 'sine', gain: 0.6 },
  ],
  // 캡슐: 통통
  capsuleBounce: [
    { freq: 260, start: 0, dur: 0.1, type: 'sine', gain: 0.8 },
    { freq: 200, start: 0.16, dur: 0.12, type: 'sine', gain: 0.7 },
  ],
  // 캡슐: 덜컹
  capsuleShake: [
    { freq: 180, start: 0, dur: 0.08, type: 'square', gain: 0.4 },
    { freq: 230, start: 0.09, dur: 0.1, type: 'square', gain: 0.4 },
  ],
  // 캡슐: 잡혔다 '찰칵'
  capsuleClick: [
    { freq: 1200, start: 0, dur: 0.04, type: 'square', gain: 0.4 },
    { freq: 800, start: 0.05, dur: 0.08, type: 'square', gain: 0.4 },
  ],
  // 캡슐: 열렸다 '뻥!'
  capsulePop: [
    { freq: 500, start: 0, dur: 0.06, type: 'square', gain: 0.4 },
    { freq: 900, start: 0.04, dur: 0.1, type: 'square', gain: 0.4 },
    { freq: 1400, start: 0.1, dur: 0.14, type: 'sine', gain: 0.6 },
  ],
  // ── 기술 효과음 (각 0.4초 안, 첫 음높이가 서로 달라야 한다) ──
  // 풀: 바스락 높은 사각파
  fxGrass: [
    { freq: 1250, start: 0, dur: 0.06, type: 'square', gain: 0.3 },
    { freq: 1500, start: 0.05, dur: 0.06, type: 'square', gain: 0.3 },
    { freq: 1350, start: 0.1, dur: 0.08, type: 'square', gain: 0.25 },
  ],
  // 독: 낮게 꿀렁
  fxPoison: [
    { freq: 150, start: 0, dur: 0.14, type: 'sine', gain: 0.9 },
    { freq: 120, start: 0.12, dur: 0.12, type: 'sine', gain: 0.9 },
    { freq: 170, start: 0.22, dur: 0.12, type: 'sine', gain: 0.8 },
  ],
  // 빛: 맑은 화음 상승
  fxLight: [
    { freq: 1175, start: 0, dur: 0.12, type: 'sine', gain: 0.6 },
    { freq: 1480, start: 0.08, dur: 0.12, type: 'sine', gain: 0.6 },
    { freq: 1865, start: 0.16, dur: 0.2, type: 'sine', gain: 0.5 },
  ],
  // 물: 내려가는 방울
  fxWater: [
    { freq: 960, start: 0, dur: 0.1, type: 'sine', gain: 0.7 },
    { freq: 640, start: 0.08, dur: 0.1, type: 'sine', gain: 0.7 },
    { freq: 430, start: 0.16, dur: 0.14, type: 'sine', gain: 0.7 },
  ],
  // 번개: 지직, 톱니파가 급히 오른다
  fxThunder: [
    { freq: 410, start: 0, dur: 0.05, type: 'sawtooth', gain: 0.35 },
    { freq: 820, start: 0.04, dur: 0.05, type: 'sawtooth', gain: 0.35 },
    { freq: 1640, start: 0.08, dur: 0.1, type: 'sawtooth', gain: 0.35 },
  ],
  // 땅: 낮은 쿵
  fxEarth: [
    { freq: 90, start: 0, dur: 0.2, type: 'sine', gain: 1 },
    { freq: 70, start: 0.14, dur: 0.16, type: 'sine', gain: 0.9 },
  ],
  // 불: 낮은 톱니가 화르륵 오른다
  fxFire: [
    { freq: 240, start: 0, dur: 0.1, type: 'sawtooth', gain: 0.35 },
    { freq: 360, start: 0.07, dur: 0.1, type: 'sawtooth', gain: 0.35 },
    { freq: 540, start: 0.14, dur: 0.14, type: 'sawtooth', gain: 0.3 },
  ],
  // 강력 발동: 짧은 상승 아르페지오
  fxPower: [
    { freq: 698, start: 0, dur: 0.07 },
    { freq: 932, start: 0.06, dur: 0.07 },
    { freq: 1245, start: 0.12, dur: 0.07 },
    { freq: 1397, start: 0.18, dur: 0.14 },
  ],
  // 상성 강함: 밝은 두 음 상승
  superEffective: [
    { freq: 1030, start: 0, dur: 0.1 },
    { freq: 1340, start: 0.1, dur: 0.16 },
  ],
  // 상성 약함: 낮은 한 음 하강
  notVery: [{ freq: 310, start: 0, dur: 0.25, type: 'sine', gain: 0.7 }],
  // 특수: 회복(따뜻한 상승)·방어(단단한 사각파)·힌트(반짝 두 음)·여유(느린 내림)·충전(오르는 톱니)
  skillHeal: [
    { freq: 740, start: 0, dur: 0.12, type: 'sine', gain: 0.7 },
    { freq: 990, start: 0.1, dur: 0.12, type: 'sine', gain: 0.7 },
    { freq: 1260, start: 0.2, dur: 0.16, type: 'sine', gain: 0.6 },
  ],
  skillGuard: [
    { freq: 320, start: 0, dur: 0.12, type: 'square', gain: 0.35 },
    { freq: 480, start: 0.1, dur: 0.14, type: 'square', gain: 0.35 },
  ],
  skillClue: [
    { freq: 1100, start: 0, dur: 0.08, type: 'sine', gain: 0.6 },
    { freq: 1450, start: 0.09, dur: 0.16, type: 'sine', gain: 0.6 },
  ],
  skillCalm: [
    { freq: 560, start: 0, dur: 0.15, type: 'sine', gain: 0.6 },
    { freq: 450, start: 0.14, dur: 0.22, type: 'sine', gain: 0.5 },
  ],
  skillCharge: [
    { freq: 270, start: 0, dur: 0.1, type: 'sawtooth', gain: 0.3 },
    { freq: 380, start: 0.09, dur: 0.1, type: 'sawtooth', gain: 0.3 },
    { freq: 600, start: 0.18, dur: 0.16, type: 'sawtooth', gain: 0.3 },
  ],
};

/** 속성 기술이 맞을 때 나는 소리 (나중에 소리만 바꾸려면 여기) */
export const SKILL_SFX: Record<Element, Sfx> = {
  grass: 'fxGrass',
  poison: 'fxPoison',
  light: 'fxLight',
  water: 'fxWater',
  thunder: 'fxThunder',
  earth: 'fxEarth',
  fire: 'fxFire',
};

/** 특수 기술이 성공할 때 나는 소리 */
export const SPECIAL_SFX: Record<SpecialKind, Sfx> = {
  heal: 'skillHeal',
  guard: 'skillGuard',
  clue: 'skillClue',
  calm: 'skillCalm',
  charge: 'skillCharge',
};

/** 효과음이 다 끝나는 시간(초) */
export function sfxLength(name: Sfx): number {
  return Math.max(...SOUNDS[name].map((n) => n.start + n.dur));
}

let ctx: AudioContext | null = null;

function audioContext(): AudioContext | null {
  if (typeof window === 'undefined' || !('AudioContext' in window)) return null;
  ctx ??= new AudioContext();
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

export function playSfx(name: Sfx): void {
  const { sound, volume } = useGameStore.getState().settings;
  if (!sound || volume <= 0) return;
  const ac = audioContext();
  if (!ac) return;
  const t0 = ac.currentTime;
  for (const n of SOUNDS[name]) {
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    // 기본은 귀에 덜 날카로운 삼각파
    osc.type = n.type ?? 'triangle';
    osc.frequency.value = n.freq;
    const peak = 0.22 * volume * (n.gain ?? 1);
    gain.gain.setValueAtTime(0.0001, t0 + n.start);
    gain.gain.exponentialRampToValueAtTime(peak, t0 + n.start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + n.start + n.dur);
    osc.connect(gain).connect(ac.destination);
    osc.start(t0 + n.start);
    osc.stop(t0 + n.start + n.dur + 0.02);
  }
}
