import type { MapId } from '../../domain/field/fields';
import type { Dir, FieldMap, Tile } from '../../domain/field/movement';
import { TRAINING_DANS, WATER_FRAME_MS, type TrainingDan } from '../../domain/field/tuning';
import { TILE_PX, VIEW_TILES_W } from './padDirection';
import type { SheetFrame } from '../art/companionImage';
import { HERO_SPRITES, heroFrame } from '../art/hero';
import { SHADOW_FALLBACK_BODY, drawShadow, liftFraction } from '../art/shadow';
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

/** 주인공 뒤를 따라 걷는 동행 구구몬 한 마리 (마을 구구몬도 같은 모양으로 그린다) */
export interface Companion {
  /** 칸 좌표 (소수 가능) */
  x: number;
  y: number;
  img: HTMLImageElement | null;
  /** 진화 단계 크기 (1·1.15·1.3) */
  scale: number;
  /** 자리 크기(한 칸 대비)·발끝 높이(0~1) — creatureArt 등록표 값 */
  fill: number;
  foot: number;
  /** 정사각형 자리 대비 그림 가로·세로 (치비 그림은 몸 높이로 맞춤, 없으면 1×1) */
  box?: { w: number; h: number };
  /** 시트 장면 (있고 다 읽었으면 정지 그림 img 대신 이걸 그린다) */
  sheet?: SheetFrame;
  /** 정지 그림만: 좌우 반전(오른쪽을 볼 때), 위로 뜬 높이(칸 단위, 통통), 세로 숨쉬기 배율 */
  flip?: boolean;
  lift?: number;
  breathe?: number;
}

/** 주인공: 치비 시트(017)가 있으면 그 장면, 없으면 픽셀 주인공(hero.ts) */
export interface Hero {
  x: number;
  y: number;
  facing: Dir;
  /** 치비 주인공 장면 (없거나 아직 못 읽었으면 픽셀 주인공) */
  sheet?: SheetFrame;
  /** 치비 주인공의 자리 크기(한 칸 대비) */
  fill?: number;
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

/** 구구몬 그림의 그릴 자리 (칸 가운데 아래에 발을 맞추고, 자리를 fill·scale만큼 키운 뒤 box 비율로 그린다) */
export function companionRect(left: number, top: number, tile: number, c: { scale: number; fill: number; foot: number; box?: { w: number; h: number } }) {
  const slot = tile * c.fill * c.scale;
  const w = Math.round(slot * (c.box?.w ?? 1));
  const h = Math.round(slot * (c.box?.h ?? 1));
  return { x: Math.round(left + tile / 2 - w / 2), y: Math.round(top + tile - h * c.foot), w, h };
}

/** 마스터한 훈련 건물의 지붕 숫자 자리: 문 바로 위 타일. 목록 밖 단은 무시 */
export function roofNumberRects(map: FieldMap, mastered: Partial<Record<TrainingDan, unknown>>): { dan: TrainingDan; x: number; y: number }[] {
  const out: { dan: TrainingDan; x: number; y: number }[] = [];
  for (const d of map.doors) {
    if (d.kind !== 'training' || d.dan === undefined) continue;
    if (!(TRAINING_DANS as readonly number[]).includes(d.dan) || mastered[d.dan] === undefined) continue;
    out.push({ dan: d.dan, x: d.pos.x, y: d.pos.y - 1 });
  }
  return out;
}

/** 지붕 숫자: 따뜻한 노랑 글자에 천천히 숨 쉬듯 번지는 빛 */
function drawRoofNumbers(ctx: CanvasRenderingContext2D, rects: { dan: number; x: number; y: number }[], tile: number, cx: number, cy: number, now: number) {
  if (rects.length === 0) return;
  const glow = 0.5 + 0.5 * Math.sin(now / 700);
  ctx.save();
  ctx.font = `bold ${Math.round(tile * 0.78)}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  for (const r of rects) {
    const px = r.x * tile - cx + tile / 2;
    const py = r.y * tile - cy + tile / 2 + 1;
    ctx.shadowColor = '#ffd23a';
    ctx.shadowBlur = tile * (0.3 + 0.7 * glow);
    ctx.lineWidth = Math.max(2, tile * 0.16);
    ctx.strokeStyle = '#6b3b00';
    ctx.strokeText(String(r.dan), px, py);
    ctx.fillStyle = '#ffe14d';
    ctx.fillText(String(r.dan), px, py);
  }
  ctx.restore();
}

/** hx, hy: 주인공의 칸 좌표(소수 가능, 걷는 중 보간) */
export function drawField(
  ctx: CanvasRenderingContext2D,
  map: FieldMap,
  view: View,
  hero: Hero,
  companion?: Companion,
  anim: Anim = { now: 0, step: null },
  roamers: RoamerSprite[] = [],
  mastered: Partial<Record<TrainingDan, unknown>> = {},
): { cx: number; cy: number } {
  const { tile, w, h } = view;
  const hx = hero.x;
  const hy = hero.y;
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
  drawRoofNumbers(ctx, roofNumberRects(map, mastered), tile, cx, cy, anim.now);
  // 마을에서 돌아다니는 구구몬: 동행·주인공 아래에 그린다
  if (roamers.length > 0) drawRoamers(ctx, roamers, tile, cx, cy, anim.now, companionRect);
  // 동행: 주인공 뒤 칸. 화면에서 더 아래(앞)에 있는 쪽을 나중에 그려 겹칠 때 자연스럽게
  const companionFront = !!companion && companion.y > hero.y;
  if (companion && !companionFront) drawCompanion(ctx, companion, tile, cx, cy);
  drawHero(ctx, hero, tile, cx, cy, anim.step);
  if (companion && companionFront) drawCompanion(ctx, companion, tile, cx, cy);
  return { cx, cy };
}

/** 시트 한 칸을 자리에 그린다 (치비 그림은 부드럽게 줄여 그린다) */
export function drawSheetFrame(ctx: CanvasRenderingContext2D, sh: SheetFrame, x: number, y: number, w: number, h: number) {
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(sh.img, sh.col * sh.cw, sh.row * sh.ch, sh.cw, sh.ch, x, y, w, h);
  ctx.imageSmoothingEnabled = false;
}

/** 주인공: 치비 시트가 있으면 그 장면(몸 높이 맞춤, 칸 아래에 발), 없으면 픽셀 주인공(바라보는 쪽, 걷는 중이면 발을 번갈아) */
function drawHero(ctx: CanvasRenderingContext2D, hero: Hero, tile: number, cx: number, cy: number, step: number | null) {
  const px = Math.round(hero.x * tile) - cx;
  const py = Math.round(hero.y * tile) - cy;
  const sh = hero.sheet;
  if (sh) {
    const r = companionRect(px, py, tile, { scale: 1, fill: hero.fill ?? 1, foot: 1, box: { w: sh.w, h: sh.h } });
    drawShadow(ctx, px + tile / 2, py + tile, r.w * (sh.body ?? SHADOW_FALLBACK_BODY));
    drawSheetFrame(ctx, sh, r.x, r.y, r.w, r.h);
    return;
  }
  drawShadow(ctx, px + tile / 2, py + tile, tile * SHADOW_FALLBACK_BODY);
  ctx.drawImage(bakeTiles(HERO_SPRITES[hero.facing][heroFrame(step)]), px, py, tile, tile);
}

/** 동행: 시트가 있으면 그 장면, 없으면 정지 그림(반전·통통·숨쉬기), 아직 못 읽었으면 색 동그라미 */
function drawCompanion(ctx: CanvasRenderingContext2D, p: Companion, tile: number, cx: number, cy: number) {
  const left = Math.round(p.x * tile) - cx;
  const top = Math.round((p.y - (p.lift ?? 0)) * tile) - cy;
  const sh = p.sheet;
  const img = p.img;
  // 그림자는 땅(뜨기 전 자리)에 둔다. 뜰수록 조금 작고 연하게
  const groundY = Math.round(p.y * tile) - cy + tile;
  const lift01 = liftFraction(p.lift ?? 0);
  if (sh) {
    const r = companionRect(left, top, tile, { scale: p.scale, fill: p.fill, foot: p.foot, box: { w: sh.w, h: sh.h } });
    drawShadow(ctx, left + tile / 2, groundY, r.w * (sh.body ?? SHADOW_FALLBACK_BODY), lift01);
    drawSheetFrame(ctx, sh, r.x, r.y, r.w, r.h);
  } else if (img && img.complete && img.naturalWidth > 0) {
    const r = companionRect(left, top, tile, p);
    drawShadow(ctx, left + tile / 2, groundY, r.w * SHADOW_FALLBACK_BODY, lift01);
    const hgt = Math.round(r.h * (p.breathe ?? 1));
    const y = r.y + r.h - hgt; // 발끝은 그대로, 위로만 늘고 줄어든다
    ctx.imageSmoothingEnabled = true;
    if (p.flip) {
      ctx.save();
      ctx.translate(r.x * 2 + r.w, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(img, r.x, y, r.w, hgt);
      ctx.restore();
    } else ctx.drawImage(img, r.x, y, r.w, hgt);
    ctx.imageSmoothingEnabled = false;
  } else {
    drawShadow(ctx, left + tile / 2, groundY, tile * p.fill * p.scale * SHADOW_FALLBACK_BODY, lift01);
    ctx.fillStyle = '#42a5f5';
    ctx.beginPath();
    ctx.arc(left + tile / 2, top + tile / 2, tile * 0.38, 0, Math.PI * 2);
    ctx.fill();
  }
}
