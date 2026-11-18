/**
 * 체육관 NPC 그림: 013 치비 가만히 시트에 NPC 색을 곱해 한 번만 구워 캐시한다 (npcTint).
 * 치비 그림 파일이 없는 PC·배포 빌드에서는 간단한 픽셀 트레이너를 같은 색 규칙으로 그린다.
 * 굽는 일은 rAF 안에서만 부른다 (이미지를 읽는 중이면 그 사이 한두 프레임은 안 그린다).
 */
import type { Tint } from './npcTint';
import { tintImageData, tintPixel } from './npcTint';
import { NPC_ART } from './localSprites';
import { ART_SIZE, bakeTiles, type PixelArt } from './pixelArt';
import { bodyRatio, drawShadow, SHADOW_FALLBACK_BODY } from './shadow';
import { DIR_ROW, cellBox, frameAt } from './spriteSheet';

/** 지금 그릴 NPC 한 장면 */
export interface NpcPicture {
  source: CanvasImageSource;
  /** 원본 안에서 오려 낼 곳(이미지 픽셀) */
  sx: number;
  sy: number;
  sw: number;
  sh: number;
  /** 정사각형 자리 대비 그림 가로·세로, 자리 크기(한 칸 대비), 칸 너비 대비 몸 너비(그림자) */
  box: { w: number; h: number };
  fill: number;
  body: number;
  /** 픽셀 폴백이면 부드럽게 줄이지 않는다 */
  pixel: boolean;
}

export interface NpcSprite {
  id: string;
  x: number;
  y: number;
  pic: NpcPicture | null;
}

type RectFn = (left: number, top: number, tile: number, c: { scale: number; fill: number; foot: number; box?: { w: number; h: number } }) => { x: number; y: number; w: number; h: number };

const sheetImgs = new Map<string, HTMLImageElement>();
/** (id, mastered) → 색 입힌 시트. null이면 굽기에 실패(폴백을 쓴다) */
const baked = new Map<string, HTMLCanvasElement | null>();
const pixelBaked = new Map<string, HTMLCanvasElement>();

function sheetImg(url: string): HTMLImageElement {
  let img = sheetImgs.get(url);
  if (!img) {
    img = new Image();
    img.src = url;
    sheetImgs.set(url, img);
  }
  return img;
}

function bakeSheet(img: HTMLImageElement, tint: Tint, mastered: boolean): HTMLCanvasElement | null {
  try {
    const c = document.createElement('canvas');
    c.width = img.naturalWidth;
    c.height = img.naturalHeight;
    const ctx = c.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0);
    const data = ctx.getImageData(0, 0, c.width, c.height);
    tintImageData(data.data, tint, mastered);
    ctx.putImageData(data, 0, 0);
    return c;
  } catch {
    return null;
  }
}

// ── 픽셀 폴백: 작은 트레이너 (머리·얼굴·옷·바지). 색은 치비와 같은 규칙(tintPixel)으로 입힌다 ──
const center = (s: string): string => {
  const left = Math.floor((ART_SIZE - s.length) / 2);
  return '.'.repeat(left) + s + '.'.repeat(ART_SIZE - s.length - left);
};
const hex = (rgba: [number, number, number, number], tint: Tint, mastered: boolean): string => {
  const [r, g, b] = tintPixel(rgba, tint, mastered);
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
};

/** 폴백 트레이너 그림 (머리는 주황, 마스터하면 노랑) */
export function npcPixelArt(tint: Tint, mastered: boolean): PixelArt {
  return {
    palette: {
      o: '#2a2030',
      k: '#f6d0a8',
      h: hex([245, 150, 50, 255], tint, mastered),
      c: hex([120, 190, 100, 255], tint, mastered),
      C: hex([90, 150, 80, 255], tint, mastered),
      L: hex([150, 100, 60, 255], tint, mastered),
    },
    rows: [
      center(''),
      center(''),
      center('oooooo'),
      center('ohhhhhho'),
      center('ohhhhhho'),
      center('okkkkkko'),
      center('okokkoko'),
      center('okkkkkko'),
      center('oooooo'),
      center('o' + 'c'.repeat(8) + 'o'),
      center('o' + 'ccCccCcc' + 'o'),
      center('o' + 'c'.repeat(8) + 'o'),
      center('o' + 'c'.repeat(6) + 'o'),
      center('oLLooLLo'),
      center('oLLooLLo'),
      center('oooooooo'),
    ],
  };
}

/** NPC 한 명의 지금 그림. 치비 시트가 있으면 서 있는 아래쪽 모습(가만히 시트), 없으면 픽셀. 아직 못 읽었으면 null */
export function npcPicture(id: string, tint: Tint, mastered: boolean, now: number): NpcPicture | null {
  const key = `${id}:${mastered ? 1 : 0}`;
  const sheets = NPC_ART?.sheets;
  if (NPC_ART && sheets) {
    let sheet = baked.get(key);
    if (sheet === undefined) {
      const img = sheetImg(sheets.idle.url);
      if (!(img.complete && img.naturalWidth > 0)) return null;
      sheet = bakeSheet(img, tint, mastered);
      baked.set(key, sheet);
    }
    if (sheet) {
      return {
        source: sheet,
        sx: frameAt(sheets.idle.ms, now) * sheets.cw,
        sy: DIR_ROW.down * sheets.ch,
        sw: sheets.cw,
        sh: sheets.ch,
        box: cellBox(NPC_ART.cell),
        fill: NPC_ART.fill ?? 1,
        body: bodyRatio(NPC_ART.cell),
        pixel: false,
      };
    }
  }
  let px = pixelBaked.get(key);
  if (!px) {
    px = bakeTiles(npcPixelArt(tint, mastered));
    pixelBaked.set(key, px);
  }
  return { source: px, sx: 0, sy: 0, sw: ART_SIZE, sh: ART_SIZE, box: { w: 1, h: 1 }, fill: 1, body: SHADOW_FALLBACK_BODY, pixel: true };
}

/** NPC들을 그린다 (서 있고 아래를 본다). cx·cy는 카메라 왼쪽 위(화면 픽셀), tile은 한 칸의 화면 픽셀 */
export function drawNpcs(ctx: CanvasRenderingContext2D, list: NpcSprite[], tile: number, cx: number, cy: number, rectOf: RectFn): void {
  for (const n of list) {
    const p = n.pic;
    if (!p) continue;
    const left = n.x * tile - cx;
    const top = n.y * tile - cy;
    const r = rectOf(left, top, tile, { scale: 1, fill: p.fill, foot: 1, box: p.box });
    drawShadow(ctx, left + tile / 2, top + tile, r.w * p.body);
    ctx.imageSmoothingEnabled = !p.pixel;
    ctx.drawImage(p.source, p.sx, p.sy, p.sw, p.sh, r.x, r.y, r.w, r.h);
    ctx.imageSmoothingEnabled = false;
  }
}
