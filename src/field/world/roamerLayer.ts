/** 마을에서 돌아다니는 구구몬의 그림·말풍선 자리 계산 (규칙은 domain/field/roam.ts) */
import { ROAM_JUMP_MS, ROAM_MOVE_MS } from '../../domain/field/tuning';
import type { Pos } from '../../domain/field/movement';
import type { Roamer } from '../../domain/field/roam';
import { type SheetFrame, companionImage, companionSheet } from '../art/companionImage';
import { artBox, creatureArt } from '../art/creatureArt';
import { STAGE_SCALE } from '../art/creatureSprite';
import { SHADOW_FALLBACK_BODY, drawShadow, liftFraction } from '../art/shadow';
import { type SheetDir, dirFromDelta } from '../art/spriteSheet';

export interface RoamerSprite {
  roamer: Roamer;
  img: HTMLImageElement | null;
  scale: number;
  fill: number;
  foot: number;
  /** 정사각형 자리 대비 그림 가로·세로 (치비 그림) */
  box: { w: number; h: number };
  /** 시트 장면 (시트가 있는 종, 다 읽었을 때) */
  sheet?: SheetFrame;
}

/** 종마다 마지막으로 향한 방향 (서 있을 때 이 방향 그림을 쓴다) */
const lastDir = new Map<string, SheetDir>();

type RectFn = (left: number, top: number, tile: number, c: { scale: number; fill: number; foot: number; box?: { w: number; h: number } }) => { x: number; y: number; w: number; h: number };

/** 구구몬 목록 → 그릴 거리. rAF 안에서만 부른다 (그림 굽기 때문) */
export function buildSprites(roamers: Roamer[], stageOf: (r: Roamer) => 1 | 2 | 3, now = 0): RoamerSprite[] {
  return roamers.map((roamer) => {
    const art = creatureArt(roamer.species);
    const sleeping = roamer.motion === 'sleep';
    const stage = stageOf(roamer);
    let anim: 'idle' | 'walk' | 'sleep' = sleeping ? 'sleep' : 'idle';
    if (roamer.motion === 'move') {
      anim = 'walk';
      const d = dirFromDelta(roamer.x - roamer.fromX, roamer.y - roamer.fromY);
      if (d) lastDir.set(roamer.species, d);
    }
    return {
      roamer,
      img: companionImage(roamer.species, 96, sleeping ? 'sleep' : 'idle'),
      scale: STAGE_SCALE[stage],
      fill: art.fill,
      foot: art.foot,
      box: artBox(art),
      sheet: companionSheet(roamer.species, anim, lastDir.get(roamer.species) ?? 'down', now),
    };
  });
}

export interface Pose {
  /** 칸 좌표(소수) */
  x: number;
  y: number;
  /** 위로 뜬 높이(칸 단위) */
  lift: number;
  /** 세로 크기 배율(숨쉬기) */
  breathe: number;
}

/** 모션에 따른 지금 모습: idle은 숨쉬기, move는 보간+통통, jump는 포물선 */
export function roamerPose(r: Roamer, now: number): Pose {
  let x = r.x;
  let y = r.y;
  let lift = 0;
  let breathe = 1;
  if (r.motion === 'move') {
    const t = Math.min(1, Math.max(0, (now - r.since) / ROAM_MOVE_MS));
    x = r.fromX + (r.x - r.fromX) * t;
    y = r.fromY + (r.y - r.fromY) * t;
    lift = Math.abs(Math.sin(t * Math.PI * 2)) * 0.12;
  } else if (r.motion === 'jump') {
    const t = Math.min(1, Math.max(0, (now - r.since) / ROAM_JUMP_MS));
    lift = 4 * t * (1 - t) * 0.8;
  } else if (r.motion === 'idle') {
    breathe = 1 + Math.sin(now / 280) * 0.035;
  }
  return { x, y, lift, breathe };
}

/**
 * 동행 구구몬의 정지 그림(시트 없는 종) 움직임: 걷는 중(step 0~1)이면 한 칸에 한 번 통통, 서 있으면 숨쉬기.
 * 정지 그림은 앞모습이 왼쪽 아래를 보므로 오른쪽을 볼 때만 좌우를 뒤집는다.
 */
export function playerPose(step: number | null, now: number, facing: 'up' | 'down' | 'left' | 'right'): { lift: number; breathe: number; flip: boolean } {
  const flip = facing === 'right';
  if (step !== null) return { lift: Math.sin(Math.min(1, Math.max(0, step)) * Math.PI) * 0.12, breathe: 1, flip };
  return { lift: 0, breathe: 1 + Math.sin(now / 280) * 0.035, flip };
}

/** 지도 위 구구몬들을 그린다. cx·cy는 카메라 왼쪽 위(화면 픽셀), tile은 한 칸의 화면 픽셀 */
export function drawRoamers(ctx: CanvasRenderingContext2D, sprites: RoamerSprite[], tile: number, cx: number, cy: number, now: number, rectOf: RectFn) {
  for (const sp of sprites) {
    const pose = roamerPose(sp.roamer, now);
    const left = Math.round(pose.x * tile) - cx;
    const top = Math.round((pose.y - pose.lift) * tile) - cy;
    const sh = sp.sheet;
    const r = rectOf(left, top, tile, { scale: sp.scale, fill: sp.fill, foot: sp.foot, box: sh ? { w: sh.w, h: sh.h } : sp.box });
    drawShadow(ctx, left + tile / 2, Math.round(pose.y * tile) - cy + tile, r.w * (sh?.body ?? SHADOW_FALLBACK_BODY), liftFraction(pose.lift));
    const h = Math.round(r.h * (sh ? 1 : pose.breathe)); // 시트는 그림이 움직이니 숨쉬기 늘림 없음
    const y = r.y + r.h - h; // 발끝은 그대로, 위로만 늘고 줄어든다
    const img = sp.img;
    ctx.imageSmoothingEnabled = true;
    if (sh) {
      ctx.drawImage(sh.img, sh.col * sh.cw, sh.row * sh.ch, sh.cw, sh.ch, r.x, y, r.w, h);
    } else if (img && img.complete && img.naturalWidth > 0) {
      ctx.drawImage(img, r.x, y, r.w, h);
    } else {
      ctx.fillStyle = '#ffb74d';
      ctx.beginPath();
      ctx.arc(left + tile / 2, top + tile / 2, tile * 0.34, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.imageSmoothingEnabled = false;
    if (sp.roamer.motion === 'sleep') {
      const float = ((now / 900) % 1) * tile * 0.25;
      ctx.font = `900 ${Math.round(tile * 0.34)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.lineWidth = Math.max(2, tile * 0.07);
      ctx.strokeStyle = '#000';
      ctx.fillStyle = '#fff';
      const zx = left + tile * 0.8;
      const zy = top + tile * 0.15 - float;
      ctx.strokeText('Zz', zx, zy);
      ctx.fillText('Zz', zx, zy);
    }
  }
}

/** 말풍선을 세울 자리(CSS 픽셀): 구구몬 머리 위 가운데. cssPerPx = 화면 픽셀 하나의 CSS 크기 */
export function bubblePosition(r: Roamer, now: number, tile: number, cx: number, cy: number, cssPerPx: number): { left: number; top: number } {
  const pose = roamerPose(r, now);
  return {
    left: ((pose.x + 0.5) * tile - cx) * cssPerPx,
    top: ((pose.y - pose.lift - 0.15) * tile - cy) * cssPerPx,
  };
}

/** 이 칸을 차지한 구구몬(걷는 중이면 떠난 칸도) */
export function roamerAt(roamers: Roamer[], p: Pos): Roamer | undefined {
  return roamers.find((r) => (r.x === p.x && r.y === p.y) || (r.motion === 'move' && r.fromX === p.x && r.fromY === p.y));
}

/** 화면 좌표를 칸 좌표로 */
export function tileAtScreen(clientX: number, clientY: number, rect: { left: number; top: number; width: number; height: number }, canvasW: number, tile: number, cx: number, cy: number): Pos {
  const k = canvasW / rect.width;
  return { x: Math.floor(((clientX - rect.left) * k + cx) / tile), y: Math.floor(((clientY - rect.top) * k + cy) / tile) };
}
