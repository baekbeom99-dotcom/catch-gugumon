/**
 * 캐릭터 발밑 그림자 (필드 캔버스·전투 화면 공통 수치와 순수 계산).
 * 크기는 그림의 몸 너비 기준: 가로 = 몸 너비 × SHADOW_BODY_SCALE, 세로 = 가로 × SHADOW_ASPECT.
 */
import type { CellSize } from './spriteSheet';
import type { FieldMap, Pos } from '../../domain/field/movement';

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

/** 건물 그림자: 빛이 왼쪽 위에서 오니 건물의 오른쪽·아래 길 칸에 연한 띠가 진다 (dx·dy = 칸 너비·높이 대비 띠 두께, alpha = 띠 안쪽 진하기, 바깥 절반은 그 반) */
export const BUILDING_SHADOW = { dx: 0.5, dy: 0.5, alpha: 0.18 };

/** 건물 칸: 문 칸, 또는 이웃(상하좌우)에 `#`·문이 이어진 안쪽 `#`(담·집·체육관). 지도 둘레 벽과 홀로 선 나무는 아니다 */
export function isBuildingTile(map: FieldMap, x: number, y: number): boolean {
  if (x <= 0 || y <= 0 || x >= map.width - 1 || y >= map.height - 1) return false;
  if (map.tiles[y]?.[x] === 'door') return true;
  if (map.raw[y]?.[x] !== '#') return false;
  const joined = (nx: number, ny: number) => {
    if (nx <= 0 || ny <= 0 || nx >= map.width - 1 || ny >= map.height - 1) return false;
    return map.raw[ny]?.[nx] === '#' || map.tiles[ny]?.[nx] === 'door';
  };
  return joined(x - 1, y) || joined(x + 1, y) || joined(x, y - 1) || joined(x, y + 1);
}

/** 건물 칸의 오른쪽·아래에 접한 걷는 길 칸 (문·표지판·출구·막힌 칸·지도 밖·중복 없음). 걷기에는 영향 없이 그리기만 */
export function buildingShadowTiles(map: FieldMap): Pos[] {
  const out: Pos[] = [];
  const seen = new Set<number>();
  const add = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= map.width || y >= map.height) return;
    const t = map.tiles[y]?.[x];
    if (t !== 'path' && t !== 'grass') return;
    if (isBuildingTile(map, x, y)) return;
    const key = y * map.width + x;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ x, y });
  };
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      if (!isBuildingTile(map, x, y)) continue;
      add(x + 1, y);
      add(x, y + 1);
    }
  }
  return out;
}

/** 한 그림자 칸에 띠를 그린다 (sx·sy = 칸 왼쪽 위 화면 좌표). 오른쪽 칸은 왼쪽 띠, 아래 칸은 위쪽 띠 — 안쪽 진하게·바깥 연하게 */
export function drawBuildingShadow(ctx: CanvasRenderingContext2D, sx: number, sy: number, tile: number, right: boolean, below: boolean): void {
  const a = BUILDING_SHADOW.alpha;
  const band = (x: number, y: number, w: number, h: number, alpha: number) => {
    ctx.fillStyle = `rgba(0,0,0,${alpha})`;
    ctx.fillRect(x, y, w, h);
  };
  if (right) {
    const w = tile * BUILDING_SHADOW.dx;
    band(sx, sy, w / 2, tile, a);
    band(sx + w / 2, sy, w / 2, tile, a / 2);
  }
  if (below) {
    const h = tile * BUILDING_SHADOW.dy;
    band(sx, sy, tile, h / 2, a);
    band(sx, sy + h / 2, tile, h / 2, a / 2);
  }
}
