/**
 * 캐릭터 발밑 그림자 (필드 캔버스·전투 화면 공통 수치와 순수 계산).
 * 크기는 그림의 몸 너비 기준: 가로 = 몸 너비 × SHADOW_BODY_SCALE, 세로 = 가로 × SHADOW_ASPECT.
 */
import type { CellSize } from './spriteSheet';

/** 그림자 가로 = 몸 너비의 이 배수 */
export const SHADOW_BODY_SCALE = 0.7;
/** 그림자 세로 = 가로의 이 배수 */
export const SHADOW_ASPECT = 0.28;
/** 가운데 진하기 (검정 alpha) */
export const SHADOW_ALPHA = 0.25;
/** 몸 너비를 모를 때(SVG 폴백·픽셀 주인공) 그림 너비 대비 몸 너비 */
export const SHADOW_FALLBACK_BODY = 0.6;
/** 몸이 가장 높이 뜬 순간 그림자가 작아지는 비율 (가로·세로) 과 연해지는 비율 */
export const SHADOW_LIFT_SHRINK = 0.15;
export const SHADOW_LIFT_FADE = 0.2;
/** 뜬 높이(칸 단위)가 이 값이면 '가장 높이 뜸' (필드 통통 높이) */
export const SHADOW_LIFT_FULL = 0.12;
/** 타원 가운데가 발끝보다 위로 올라온 정도(세로 크기 대비) — 발이 타원 안에 걸치게 */
export const SHADOW_RISE = 0.2;

/** 칸 그림 너비 대비 몸 너비 (manifest의 bodyW÷cw, 모르면 SHADOW_FALLBACK_BODY) */
export function bodyRatio(c?: Partial<CellSize>): number {
  if (!c || !c.cw || c.cw <= 0 || !c.bodyW || c.bodyW <= 0) return SHADOW_FALLBACK_BODY;
  return Math.min(1, c.bodyW / c.cw);
}

export interface ShadowSize {
  w: number;
  h: number;
  alpha: number;
}

/** 몸 너비(화면 픽셀)와 뜬 정도(0~1)로 그림자 크기·진하기 */
export function shadowSize(bodyPx: number, lift01 = 0): ShadowSize {
  const t = Math.min(1, Math.max(0, lift01));
  const k = 1 - SHADOW_LIFT_SHRINK * t;
  const w = bodyPx * SHADOW_BODY_SCALE * k;
  return { w, h: w * SHADOW_ASPECT, alpha: SHADOW_ALPHA * (1 - SHADOW_LIFT_FADE * t) };
}

/** 뜬 높이(칸 단위) → 0~1 */
export function liftFraction(liftTiles: number): number {
  return Math.min(1, Math.max(0, liftTiles / SHADOW_LIFT_FULL));
}

/** 캔버스에 그림자를 그린다 (footX·footY = 발 바닥 가운데, bodyPx = 화면에 그려진 몸 너비). 가장자리는 부드럽게 */
export function drawShadow(ctx: CanvasRenderingContext2D, footX: number, footY: number, bodyPx: number, lift01 = 0): void {
  const s = shadowSize(bodyPx, lift01);
  if (!(s.w > 0)) return;
  ctx.save();
  ctx.translate(footX, footY - s.h * SHADOW_RISE);
  ctx.scale(1, SHADOW_ASPECT);
  const r = s.w / 2;
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
  g.addColorStop(0, `rgba(0,0,0,${s.alpha})`);
  g.addColorStop(0.7, `rgba(0,0,0,${s.alpha})`);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
