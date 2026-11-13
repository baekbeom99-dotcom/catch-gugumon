/** 동행 그림을 작은 이미지로 한 번 구워 캔버스에 그린다 (이미지 그림은 그대로, 몬스터 SVG는 SVG → data URL → Image) */
import { createElement } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { MonsterSprite } from '../../art/MonsterSprite';
import type { SpeciesId } from '../../domain/field/creatures';
import { creatureArt, imageView, stageSheets } from './creatureArt';
import { DIR_ROW, frameAt, type SheetDir } from './spriteSheet';
import { speciesColor } from './creatureSprite';

const cache = new Map<string, HTMLImageElement>();

/**
 * 구운 이미지를 돌려준다. 아직 읽는 중이어도 이미지를 돌려주고, 다 읽기 전에는 그리지 않는 쪽이 알아서 건너뛴다.
 * 주의: React가 그리는 중(컴포넌트 본문·useEffect 안)에 부르면 몬스터 SVG를 굽지 못해 null — rAF·setTimeout 안에서 부른다.
 */
/** stage: 이미지 그림이 진화 단계별로 있으면 그 단계 그림. mood: 'sleep'이면 눈 감은 얼굴로 구운 그림(이미지 그림 종은 mood 없이 같은 그림) */
export function companionImage(id: SpeciesId, size = 96, mood: 'idle' | 'sleep' = 'idle', stage: 1 | 2 | 3 = 1): HTMLImageElement | null {
  const key = `${id}:${size}:${mood}:${stage}`;
  const hit = cache.get(key);
  if (hit) return hit;
  try {
    const art = creatureArt(id);
    let src: string;
    if (art.type === 'image') src = imageView(art, 'front', stage).src;
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
  /** 시트 안 칸 번호(가로)·줄(세로)과 칸 한 변 */
  col: number;
  row: number;
  side: number;
  /** 정지 그림 대비 칸 크기 배율, 칸 안 발끝 높이 — fill에 곱하고 foot을 바꿔 그린다 */
  scale: number;
  foot: number;
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

/**
 * 지금 그릴 시트 장면. 시트가 없는 종·아직 못 읽은 이미지면 undefined → 정지 그림.
 * anim: 걷기·가만히·잠, dir: 걷기·가만히의 방향, elapsedMs: 프레임을 고를 시간
 */
export function companionSheet(id: SpeciesId, stage: 1 | 2 | 3, anim: 'idle' | 'walk' | 'sleep', dir: SheetDir, elapsedMs: number): SheetFrame | undefined {
  const art = creatureArt(id);
  const sheets = stageSheets(art, stage);
  if (!sheets) return undefined;
  const a = anim === 'sleep' ? (sheets.sleep ?? sheets.idle) : sheets[anim];
  const row = a === sheets.sleep ? 0 : DIR_ROW[dir];
  const img = sheetImg(a.url);
  if (!(img.complete && img.naturalWidth > 0)) return undefined;
  return { img, col: frameAt(a.ms, elapsedMs), row, side: sheets.side, scale: sheets.scale, foot: sheets.foot };
}
