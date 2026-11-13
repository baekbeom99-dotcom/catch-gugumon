import type { MapId } from '../../domain/field/fields';
import type { FieldMap, Tile } from '../../domain/field/movement';
import { WATER_FRAME_MS } from '../../domain/field/tuning';
import { TILE_PX, VIEW_TILES_W } from './padDirection';
import type { SheetFrame } from '../art/companionImage';
import { type TileSet, bakeTiles } from '../art/pixelArt';
import { type RoamerSprite, drawRoamers } from './roamerLayer';


// 타일 그림을 아직 못 불러왔을 때 쓰는 색 칸
const TILE_COLOR: Record<Tile, string> = {
  path: '#d9b382',
  grass: '#4caf50',
  block: '#1f5e2e',
  deco: '#2e7d32',
  sign: '#8d5a2b',
  exit: '#f5e663',
  door: '#6d4c41',
};

const tileSets = new Map<MapId, TileSet>();

/** 지도 묶음을 불러올 때 그 지도의 타일 그림을 알려 준다 */
export function registerTileSet(id: MapId, set: TileSet): void {
  tileSets.set(id, set);
}

export interface View {
  /** 그림 한 칸의 화면 픽셀 (정수 배율 × TILE_PX × 화면 배율) */
  tile: number;
  w: number;
  h: number;
}

/** 조작하는 구구몬 한 마리 (주인공 대신 이 구구몬이 걷는다) */
export interface Companion {
  /** 칸 좌표 (소수 가능) */
  x: number;
  y: number;
  img: HTMLImageElement | null;
  /** 진화 단계 크기 (1·1.15·1.3) */
  scale: number;
  /** 그림 둘레 여백만큼 키우는 배율, 발끝 높이(0~1) — creatureArt 등록표 값 */
  fill: number;
  foot: number;
  /** 시트 장면 (있고 다 읽었으면 정지 그림 img 대신 이걸 그린다) */
  sheet?: SheetFrame;
  /** 정지 그림만: 좌우 반전(오른쪽을 볼 때), 위로 뜬 높이(칸 단위, 통통), 세로 숨쉬기 배율 */
  flip?: boolean;
  lift?: number;
  breathe?: number;
}

export interface Anim {
  now: number;
  /** 걷는 중이면 한 걸음 진행(0~1), 서 있으면 null */
  step: number | null;
}

/**
 * 정수 배율: 가로로 VIEW_TILES_W칸쯤 보이게 하되,
 * 지도가 화면보다 작아 검은 띠가 생기지 않게 지도가 화면을 다 덮는 배율 이상으로 키운다.
 * 세로로 긴 지도(마을 20×40)도 필드와 같은 크기로 보이도록, 덮는 배율은 짧은 변의 정사각형 기준으로 계산한다.
 */
export function viewScale(cssWidth: number, cssHeight = 0, mapTilesW = 0, mapTilesH = 0): number {
  const byWidth = Math.floor(cssWidth / (VIEW_TILES_W * TILE_PX));
  const square = Math.min(mapTilesW, mapTilesH);
  const coverW = square > 0 ? Math.ceil(cssWidth / (square * TILE_PX)) : 1;
  const coverH = square > 0 ? Math.ceil(cssHeight / (square * TILE_PX)) : 1;
  return Math.max(1, byWidth, coverW, coverH);
}

function cam(center: number, viewPx: number, mapPx: number): number {
  if (mapPx <= viewPx) return -(viewPx - mapPx) / 2;
  return Math.min(Math.max(center - viewPx / 2, 0), mapPx - viewPx);
}

/** 동행 그림의 그릴 자리 (칸 가운데 아래에 발을 맞추고, 여백만큼 키운다) */
export function companionRect(left: number, top: number, tile: number, c: Pick<Companion, 'scale' | 'fill' | 'foot'>) {
  const size = Math.round(tile * c.fill * c.scale);
  return { x: Math.round(left + tile / 2 - size / 2), y: Math.round(top + tile - size * c.foot), size };
}

/** 조작하는 구구몬(player)의 칸 좌표(소수 가능, 걷는 중 보간)에 카메라를 맞춘다 */
export function drawField(
  ctx: CanvasRenderingContext2D,
  map: FieldMap,
  view: View,
  player: Companion,
  anim: Anim = { now: 0, step: null },
  roamers: RoamerSprite[] = [],
): { cx: number; cy: number } {
  const { tile, w, h } = view;
  const hx = player.x;
  const hy = player.y;
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, w, h);
  const cx = Math.round(cam((hx + 0.5) * tile, w, map.width * tile));
  const cy = Math.round(cam((hy + 0.5) * tile, h, map.height * tile));
  const x0 = Math.max(0, Math.floor(cx / tile));
  const y0 = Math.max(0, Math.floor(cy / tile));
  const x1 = Math.min(map.width - 1, Math.floor((cx + w) / tile));
  const y1 = Math.min(map.height - 1, Math.floor((cy + h) / tile));
  const set = tileSets.get(map.id);
  const frame = (Math.floor(anim.now / WATER_FRAME_MS) % 2) as 0 | 1;
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const sx = x * tile - cx;
      const sy = y * tile - cy;
      if (set) {
        for (const art of set.pick(map, x, y, frame)) ctx.drawImage(bakeTiles(art), sx, sy, tile, tile);
      } else {
        ctx.fillStyle = TILE_COLOR[map.tiles[y][x]];
        ctx.fillRect(sx, sy, tile, tile);
      }
    }
  }
  // 마을에서 돌아다니는 구구몬: 조작하는 구구몬 아래에 그린다
  if (roamers.length > 0) drawRoamers(ctx, roamers, tile, cx, cy, anim.now, companionRect);
  drawPlayer(ctx, player, tile, cx, cy);
  return { cx, cy };
}

/** 조작하는 구구몬: 시트가 있으면 그 장면, 없으면 정지 그림(반전·통통·숨쉬기), 아직 못 읽었으면 색 동그라미 */
function drawPlayer(ctx: CanvasRenderingContext2D, p: Companion, tile: number, cx: number, cy: number) {
  const left = Math.round(p.x * tile) - cx;
  const top = Math.round((p.y - (p.lift ?? 0)) * tile) - cy;
  const sh = p.sheet;
  const img = p.img;
  if (sh) {
    const r = companionRect(left, top, tile, { scale: p.scale, fill: p.fill * sh.scale, foot: sh.foot });
    ctx.drawImage(sh.img, sh.col * sh.side, sh.row * sh.side, sh.side, sh.side, r.x, r.y, r.size, r.size);
  } else if (img && img.complete && img.naturalWidth > 0) {
    const r = companionRect(left, top, tile, p);
    const hgt = Math.round(r.size * (p.breathe ?? 1));
    const y = r.y + r.size - hgt; // 발끝은 그대로, 위로만 늘고 줄어든다
    if (p.flip) {
      ctx.save();
      ctx.translate(r.x * 2 + r.size, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(img, r.x, y, r.size, hgt);
      ctx.restore();
    } else ctx.drawImage(img, r.x, y, r.size, hgt);
  } else {
    ctx.fillStyle = '#42a5f5';
    ctx.beginPath();
    ctx.arc(left + tile / 2, top + tile / 2, tile * 0.38, 0, Math.PI * 2);
    ctx.fill();
  }
}
