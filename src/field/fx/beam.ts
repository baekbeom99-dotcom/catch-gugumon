/**
 * 줄기 효과(motion: 'beam') 그림 계산 — 물줄기·번개줄기·불 뿜기를 쏘는 구구몬 입에서 맞는 구구몬 쪽으로 돌려 그린다.
 * 효과는 원점(쏘는 입)에서 오른쪽으로 뻗도록 만들어져 있어, 효과 그림 틀(offscreen)에 그린 뒤
 * 쏘는 쪽 → 맞는 쪽 방향으로 돌리고, 맞는 구구몬 한가운데에서 잘라 낸다. 모든 좌표는 효과 화소 단위.
 */

/** 입 위치: 구구몬 한가운데에서 맞는 쪽으로 이만큼(효과 화소) 나간 곳 */
export const BEAM_MUZZLE_OFFSET = 9;
/** 줄기가 맞는 구구몬 한가운데를 지나 이만큼 더 뻗고 자른다 */
export const BEAM_OVERSHOOT = 3;
/** 줄기를 가로로 늘이거나 줄이는 한계 (너무 줄이면 화소가 뭉개진다) */
export const BEAM_STRETCH_MIN = 0.75;
export const BEAM_STRETCH_MAX = 1.25;
/** 효과 그림 틀 크기와 그 안의 원점 */
export const BEAM_PAD = 24;
export const BEAM_FRAME_H = 170;

export interface BeamPlan {
  /** 입 위치 (효과 화소) */
  muzzle: { x: number; y: number };
  /** 오른쪽으로 보낼 방향이면 false, 왼쪽(적 공격)이면 true — 가로로 뒤집고 돌린다 */
  flip: boolean;
  /** 돌릴 각도 (라디안, 뒤집은 뒤 기준: 위로 올라가면 음수) */
  angle: number;
  /** 줄기 길이 방향으로 늘이는 배율 */
  stretch: number;
  /** 입에서 잘라 낼 곳까지 길이 (늘이기 전, 돌린 좌표계의 가로) */
  clipLen: number;
}

/** from·at: 쏘는 구구몬·맞는 구구몬의 한가운데 (효과 화소). reach: 줄기 길이 */
export function beamPlan(from: { x: number; y: number }, at: { x: number; y: number }, reach: number): BeamPlan {
  const dx = at.x - from.x;
  const dy = at.y - from.y;
  const dist = Math.hypot(dx, dy) || 1;
  const ux = dx / dist;
  const uy = dy / dist;
  const muzzle = { x: from.x + ux * BEAM_MUZZLE_OFFSET, y: from.y + uy * BEAM_MUZZLE_OFFSET };
  const len = Math.max(1, dist - BEAM_MUZZLE_OFFSET);
  const stretch = Math.min(BEAM_STRETCH_MAX, Math.max(BEAM_STRETCH_MIN, len / reach));
  return {
    muzzle,
    flip: dx < 0,
    angle: Math.atan2(dy, Math.abs(dx)),
    stretch,
    clipLen: len + BEAM_OVERSHOOT,
  };
}

/**
 * 효과 그림 틀(src)을 입에서 맞는 쪽으로 돌려 ctx에 그린다 (ctx는 효과 화소 단위 캔버스).
 * axisY: 줄기 가운데 줄이 효과 원점보다 얼마나 아래(+)·위(-)인지. 원점은 틀의 (BEAM_PAD, BEAM_FRAME_H / 2).
 */
export function drawBeam(ctx: CanvasRenderingContext2D, src: CanvasImageSource, plan: BeamPlan, axisY: number): void {
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.translate(Math.round(plan.muzzle.x), Math.round(plan.muzzle.y));
  ctx.scale(plan.flip ? -1 : 1, 1);
  ctx.rotate(plan.angle);
  // 맞는 구구몬 한가운데에서 자른다 (늘이기 전 좌표 기준이 아니라 돌린 좌표 기준)
  ctx.beginPath();
  ctx.rect(-BEAM_PAD, -BEAM_FRAME_H, plan.clipLen + BEAM_PAD, BEAM_FRAME_H * 2);
  ctx.clip();
  ctx.scale(plan.stretch, 1);
  ctx.drawImage(src, -BEAM_PAD, -BEAM_FRAME_H / 2 - axisY);
  ctx.restore();
}
