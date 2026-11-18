/**
 * 트레이닝 효과 — 맞힐 때마다 동행 구구몬이 자기 속성 기술 효과를 표적에게 쏜다.
 * 보기만 하는 연출이라 문제 진행을 막지 않는다 (불러오기·틀기를 기다리지 않고, 동작 줄이기면 그림은 건너뛴다).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { SKILL_SFX, playSfx } from '../../audio/sfx';
import { speciesDef, type SpeciesId } from '../../domain/field/creatures';
import { ELEMENT_FX, elementOf } from '../../domain/field/elements';
import { fxTravelMs, playFx, prefersReducedMotion, preloadFx } from '../fx/playFx';

/** 번갈아 쓰는 효과 칸 수 (주속성 ①②③) */
const FX_ROTATE = 3;

export interface TrainingFx {
  stageRef: React.RefObject<HTMLDivElement>;
  canvasRef: React.RefObject<HTMLCanvasElement>;
  allyRef: React.RefObject<HTMLDivElement>;
  targetRef: React.RefObject<HTMLDivElement>;
  /** 구구몬 공격 그림을 시작한 시각 */
  attackAt: number | undefined;
  /** 표적이 맞을 때마다 바뀌는 번호 (흔들림을 다시 틀기 위한 key) */
  hitKey: number;
  /** 맞힌 n번째 답: 효과를 쏜다 */
  fire: (n: number) => void;
}

export function useTrainingFx(species: SpeciesId): TrainingFx {
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const allyRef = useRef<HTMLDivElement>(null);
  const targetRef = useRef<HTMLDivElement>(null);
  const [attackAt, setAttackAt] = useState<number | undefined>(undefined);
  const [hitKey, setHitKey] = useState(0);
  const timers = useRef<number[]>([]);
  const element = elementOf(species);
  const legend = speciesDef(species).legend;

  useEffect(() => {
    preloadFx('hit', ...ELEMENT_FX[element].slice(0, FX_ROTATE));
  }, [element]);
  useEffect(() => {
    const list = timers.current;
    return () => list.forEach((t) => clearTimeout(t));
  }, []);

  /** 칸 그림의 가운데 (효과 캔버스 안 CSS px) */
  const center = useCallback((el: HTMLElement | null) => {
    const stage = stageRef.current;
    if (!stage || !el) return null;
    const s = stage.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    return { x: r.left - s.left + r.width / 2, y: r.top - s.top + r.height * 0.5 };
  }, []);

  const fire = useCallback(
    (n: number) => {
      const name = ELEMENT_FX[element][n % FX_ROTATE];
      const reduced = prefersReducedMotion();
      const travel = reduced ? 0 : fxTravelMs(name);
      setAttackAt(Date.now());
      const later = (fn: () => void, ms: number) => {
        if (ms > 0) timers.current.push(window.setTimeout(fn, ms));
        else fn();
      };
      // 맞는 순간(날아가는 시간 뒤): 효과음 · 표적 흔들림
      later(() => {
        playSfx(SKILL_SFX[element]);
        setHitKey((k) => k + 1);
      }, travel);
      if (reduced) return;
      const canvas = canvasRef.current;
      const from = center(allyRef.current);
      const at = center(targetRef.current);
      if (!canvas || !from || !at) return;
      void playFx(canvas, name, at, { from, gold: legend }).then((ok) => {
        if (!ok) void playFx(canvas, 'hit', at); // 효과를 못 틀면 맞는 그림만
      });
    },
    [element, legend, center],
  );

  return { stageRef, canvasRef, allyRef, targetRef, attackAt, hitKey, fire };
}
