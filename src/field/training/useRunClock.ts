/**
 * 문제를 푸는 동안 흐르는 시계 (밀리초 합). 가려진 탭에서는 흐르지 않고, frozen(E2E 시계 멈춤)이면 멈춘다.
 * 화면을 다시 그리지 않고 ref로 읽는다. 프레임마다 onFrame(지금까지 걸린 시간)을 부른다.
 */
import { useEffect, useRef } from 'react';
import { TRAINING_MAX_FRAME_MS } from '../../domain/field/tuning';

export function useRunClock(active: boolean, frozen: boolean, onFrame?: (elapsedMs: number) => void) {
  const elapsed = useRef(0);
  const cb = useRef(onFrame);
  cb.current = onFrame;
  useEffect(() => {
    if (!active) return;
    let raf = 0;
    let last = performance.now();
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = document.hidden || frozen ? 0 : Math.min(TRAINING_MAX_FRAME_MS, now - last);
      last = now;
      if (dt > 0) {
        elapsed.current += dt;
        cb.current?.(elapsed.current);
      }
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [active, frozen]);
  return elapsed;
}
