/**
 * 효과 틀기 — pixelfx(MIT, NOTICE.md)의 효과를 캔버스 위에 한 번 틀어 주는 얇은 함수.
 * 어떤 효과가 있는지·옵션은 effects.ts에 있다. '동작 줄이기'를 켠 기기에서는 틀지 않는다.
 */
import { EFFECTS, fxTravelMs, type FxName, type FxSpec, goldPalette, paletteLength, TRANSITION_H, TRANSITION_W } from './effects';
import type { FxModule } from 'pixelfx';

export { FX_NAMES, fxTravelMs, type FxName } from './effects';

/** 효과 그림 1픽셀이 화면 몇 CSS px인지 (명중·잡기) */
export const FX_PIXEL = 3;

/** 기기에서 '동작 줄이기'를 켰는지 */
export function prefersReducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** 효과 코드를 미리 받아 둔다 (처음 틀 때 늦지 않게) */
export function preloadFx(...names: FxName[]): void {
  if (prefersReducedMotion()) return;
  for (const n of names) EFFECTS[n].load().catch(() => undefined);
}

/**
 * `canvas` 위에 효과 하나를 튼다. `at`은 캔버스 안의 CSS px 자리 (전환 효과는 쓰지 않음).
 * 다 끝나면(또는 캔버스가 화면에서 빠지면) 풀린다. 동작 줄이기면 바로 풀린다.
 */
export interface PlayFxOptions {
  /** 방향을 뒤집는다 (효과 기본 방향은 내 구구몬 쪽에서 야생 쪽으로) */
  mirror?: boolean;
  /** 금색으로 (황금 구구몬이 쏠 때) */
  gold?: boolean;
  /**
   * 쏘는 구구몬의 자리 (캔버스 안 CSS px). 날아가는 효과(motion 'travel')면 여기서 `at`까지 구슬이 날아간 뒤
   * `at`에서 효과가 터진다. 없거나 날아가지 않는 효과면 `at`에서 바로 터진다
   */
  from?: { x: number; y: number };
}

/** 날아가는 구슬 한 장면: 가운데 밝은 구슬 + 가장자리 + 뒤로 흐르는 꼬리 (효과 화소 단위 좌표) */
function drawOrb(ctx: CanvasRenderingContext2D, orb: [string, string], a: { x: number; y: number }, b: { x: number; y: number }, p: number) {
  const pos = (q: number) => ({ x: a.x + (b.x - a.x) * q, y: a.y + (b.y - a.y) * q });
  for (let i = 3; i >= 1; i--) {
    const t = pos(Math.max(0, p - i * 0.07));
    ctx.fillStyle = orb[1];
    ctx.fillRect(Math.round(t.x) - 1, Math.round(t.y) - 1, 3 - (i > 2 ? 1 : 0), 3 - (i > 2 ? 1 : 0));
  }
  const c = pos(p);
  const x = Math.round(c.x);
  const y = Math.round(c.y);
  ctx.fillStyle = orb[1];
  ctx.fillRect(x - 3, y - 2, 7, 5);
  ctx.fillRect(x - 2, y - 3, 5, 7);
  ctx.fillStyle = orb[0];
  ctx.fillRect(x - 2, y - 1, 5, 3);
  ctx.fillRect(x - 1, y - 2, 3, 5);
}

/** 캔버스마다 지금 도는 실행 표식 하나 — 새 효과를 틀면 바뀌어 이전 루프가 다음 프레임에 스스로 멈춘다 */
const runs = new WeakMap<HTMLCanvasElement, number>();
let runCounter = 0;

/**
 * 효과를 틀었으면 true (동작 줄이기는 틀 것이 없으니 true, 다른 효과가 끼어들어 끊겼을 때도 true). 불러오기·틀기에 실패하면 false.
 * `at`은 효과의 무게중심을 놓을 캔버스 안 CSS px 자리다: 원점 = at − center × FX_PIXEL (mirror면 dx를 뒤집음).
 * 같은 캔버스에서 새 효과를 틀면 이전 효과는 바로 끊고 지운다.
 */
export async function playFx(
  canvas: HTMLCanvasElement,
  name: FxName,
  at: { x: number; y: number } = { x: 0, y: 0 },
  opts: PlayFxOptions = {},
): Promise<boolean> {
  if (prefersReducedMotion()) return true;
  const run = ++runCounter;
  runs.set(canvas, run);
  canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height); // 이전 효과를 바로 지운다
  const spec: FxSpec = EFFECTS[name];
  let mod: FxModule;
  let core: typeof import('pixelfx');
  try {
    [mod, core] = await Promise.all([spec.load(), import('pixelfx')]);
  } catch {
    return false; // 못 받았으면 효과 없이
  }
  if (!canvas.isConnected || runs.get(canvas) !== run) return true;
  const ctx = canvas.getContext('2d');
  try {
    const rect = canvas.getBoundingClientRect();
    const w = spec.screen ? TRANSITION_W : Math.max(1, Math.round(rect.width / FX_PIXEL));
    const h = spec.screen ? TRANSITION_H : Math.max(1, Math.round(rect.height / FX_PIXEL));
    canvas.width = w;
    canvas.height = h;
    if (!ctx) return true;
    const frame = core.createFrame(w, h);
    const img = new ImageData(w, h);
    const baseFlip = !!spec.options?.flip;
    const palette = opts.gold ? goldPalette(paletteLength(mod)) : undefined;
    const mirror = !!opts.mirror && !spec.noMirror;
    const cx = (spec.center?.dx ?? 0) * (mirror ? -1 : 1);
    const cy = spec.center?.dy ?? 0;
    const fx = core.createFx(mod, {
      ...spec.options,
      ...(palette ? { palette } : {}),
      flip: mirror ? !baseFlip : baseFlip,
      x: spec.screen ? 0 : Math.round(at.x / FX_PIXEL - cx),
      y: spec.screen ? 0 : Math.round(at.y / FX_PIXEL - cy),
    });
    const until = spec.until ?? Infinity;
    // 날아가는 효과: 먼저 구슬이 from → at으로 travelMs 동안 날아가고, 도착한 뒤에 효과(터짐)가 시작한다
    const travelMs = fxTravelMs(name, !!opts.from);
    const orb = spec.orb ?? ['#ffffff', '#ffd23a'];
    const a = opts.from ? { x: opts.from.x / FX_PIXEL, y: opts.from.y / FX_PIXEL } : { x: 0, y: 0 };
    const b = { x: at.x / FX_PIXEL, y: at.y / FX_PIXEL };
    let travelStart = -1;
    let flying = travelMs > 0;

    return await new Promise<boolean>((resolve) => {
      let last = performance.now();
      const step = (now: number) => {
        if (!canvas.isConnected || runs.get(canvas) !== run) return resolve(true); // 끊겼다: 그림은 새 효과가 맡는다
        try {
          if (flying) {
            if (travelStart < 0) travelStart = now;
            if (now - travelStart < travelMs) {
              ctx.clearRect(0, 0, w, h);
              drawOrb(ctx, orb, a, b, (now - travelStart) / travelMs);
              requestAnimationFrame(step);
              return;
            }
            flying = false; // 도착: 구슬을 지우고 도착 지점에서 터짐을 시작한다
            ctx.clearRect(0, 0, w, h);
            last = now;
          }
          const dt = Math.min(0.05, (now - last) / 1000) * spec.speed;
          last = now;
          fx.update(dt);
          core.clearFrame(frame);
          fx.draw(frame);
          core.composite(frame, img.data, null);
          ctx.putImageData(img, 0, 0);
          if (fx.t >= until || fx.done()) {
            if (!spec.hold) ctx.clearRect(0, 0, w, h);
            return resolve(true);
          }
        } catch {
          ctx.clearRect(0, 0, w, h);
          return resolve(false);
        }
        requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  } catch {
    ctx?.clearRect(0, 0, canvas.width, canvas.height);
    return false;
  }
}
