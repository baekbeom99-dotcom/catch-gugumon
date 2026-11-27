/** 동행 그림을 작은 이미지로 한 번 구워 캔버스에 그린다 (이미지 그림은 그대로, 몬스터 SVG는 SVG → data URL → Image) */
import { createElement } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { MonsterSprite } from '../../art/MonsterSprite';
import type { SpeciesId } from '../../domain/field/creatures';
import { artBodyRatio, artBox, artSheets, creatureArt, imageView, type StageSheets } from './creatureArt';
import { DIR_ROW, frameAt, type SheetDir } from './spriteSheet';
import { speciesColor } from './creatureSprite';

const cache = new Map<string, HTMLImageElement>();

/**
 * 구운 이미지를 돌려준다. 아직 읽는 중이어도 이미지를 돌려주고, 다 읽기 전에는 그리지 않는 쪽이 알아서 건너뛴다.
 * 주의: React가 그리는 중(컴포넌트 본문·useEffect 안)에 부르면 몬스터 SVG를 굽지 못해 null — rAF·setTimeout 안에서 부른다.
 */
/** mood: 'sleep'이면 눈 감은 얼굴로 구운 그림(이미지 그림 종은 mood 없이 같은 그림) */
export function companionImage(id: SpeciesId, size = 96, mood: 'idle' | 'sleep' = 'idle'): HTMLImageElement | null {
  const key = `${id}:${size}:${mood}`;
  const hit = cache.get(key);
  if (hit) return hit;
  try {
    const art = creatureArt(id);
    let src: string;
    if (art.type === 'image') src = imageView(art, 'front').src;
    else {
      const host = document.createElement('div');
      const root = createRoot(host);
      flushSync(() => {
        root.render(createElement(MonsterSprite, { kind: art.kind, color: speciesColor(id), golden: art.golden, mood, size }));
      });
      const svg = host.innerHTML;
      root.unmount();
      if (!svg.startsWith('<svg')) return null;
      src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    }
    const img = new Image();
    img.src = src;
    cache.set(key, img);
    return img;
  } catch {
    return null;
  }
}

/** 캔버스에 한 칸만 오려 그릴 시트 한 장면 */
export interface SheetFrame {
  img: HTMLImageElement;
  /** 시트 안 칸 번호(가로 프레임)·행(방향)과 칸 크기(이미지 픽셀) */
  col: number;
  row: number;
  cw: number;
  ch: number;
  /** 정사각형 자리(한 변 1) 대비 칸을 그릴 가로·세로 (몸 높이 맞춤, spriteSheet.cellBox) */
  w: number;
  h: number;
  /** 칸 너비 대비 몸 너비 (발밑 그림자용) */
  body?: number;
}

const sheetCache = new Map<string, HTMLImageElement>();

function sheetImg(url: string): HTMLImageElement {
  let img = sheetCache.get(url);
  if (!img) {
    img = new Image();
    img.src = url;
    sheetCache.set(url, img);
  }
  return img;
}

/** 이 주소의 이미지를 sheetFrame이 읽는 캐시에 올리고 다 읽을 때까지 기다린다 (꾸미기 굽기가 그림을 바꾸기 전에 쓴다). 읽기 실패면 reject */
export function preloadSheetImage(url: string): Promise<void> {
  const img = sheetImg(url);
  if (img.complete && img.naturalWidth > 0) return Promise.resolve();
  return new Promise((resolve, reject) => {
    img.addEventListener('load', () => resolve(), { once: true });
    img.addEventListener('error', () => reject(new Error('그림을 읽지 못했어요')), { once: true });
  });
}

/** 시트 묶음에서 지금 장면. 아직 못 읽은 이미지면 undefined */
export function sheetFrame(sheets: StageSheets, box: { w: number; h: number }, anim: 'idle' | 'walk', dir: SheetDir, elapsedMs: number, body?: number): SheetFrame | undefined {
  const a = sheets[anim];
  const img = sheetImg(a.url);
  if (!(img.complete && img.naturalWidth > 0)) return undefined;
  return { img, col: frameAt(a.ms, elapsedMs), row: DIR_ROW[dir], cw: sheets.cw, ch: sheets.ch, w: box.w, h: box.h, body };
}

/**
 * 지금 그릴 시트 장면. 시트가 없는 종·아직 못 읽은 이미지면 undefined → 정지 그림.
 * anim: 걷기·가만히·잠(잠 시트가 없어 가만히 앞모습), dir: 걷기·가만히의 방향, elapsedMs: 프레임을 고를 시간
 */
export function companionSheet(id: SpeciesId, anim: 'idle' | 'walk' | 'sleep', dir: SheetDir, elapsedMs: number): SheetFrame | undefined {
  const art = creatureArt(id);
  const sheets = artSheets(art);
  if (!sheets) return undefined;
  const body = artBodyRatio(art);
  return anim === 'sleep' ? sheetFrame(sheets, artBox(art), 'idle', 'down', 0, body) : sheetFrame(sheets, artBox(art), anim, dir, elapsedMs, body);
}
