/**
 * 주인공 꾸미기 그림: 017 치비 그림(HERO_ART)의 머리·윗옷·바지 색을 입은 세트대로 바꿔 한 번만 굽고 캐시한다 (heroTint).
 * 그림 파일이 없으면(HERO_ART 없음) 아무것도 하지 않는다. 굽기에 실패하면 원래 그림으로 돌아간다 (오류를 던지지 않는다).
 * 굽는 동안에는 이전(또는 처음) 그림을 그대로 쓰므로 화면이 멈추지 않는다.
 */
import { useEffect, useState } from 'react';
import { getCostume, type CostumeId } from '../../domain/field/costumes';
import { useGameStore } from '../../store/useGameStore';
import type { ImageArtEntry, SheetAnim, StageSheets } from './creatureArt';
import { createBakeCache, type BakeCache } from './bakeCache';
import { preloadSheetImage } from './companionImage';
import { tintHeroImageData } from './heroTint';
import { HERO_ART } from './localSprites';

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('주인공 그림을 읽지 못했어요'));
    img.src = url;
  });
}

/** 그림 한 장에 세트 색을 입혀 blob 주소로 */
async function bakeUrl(url: string, id: CostumeId): Promise<string> {
  const img = await loadImage(url);
  const c = document.createElement('canvas');
  c.width = img.naturalWidth;
  c.height = img.naturalHeight;
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('캔버스를 못 써요');
  ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(0, 0, c.width, c.height);
  tintHeroImageData(data.data, getCostume(id));
  ctx.putImageData(data, 0, 0);
  const blob = await new Promise<Blob | null>((res) => c.toBlob(res, 'image/png'));
  if (!blob) throw new Error('그림을 굽지 못했어요');
  return URL.createObjectURL(blob);
}

/** 구운 그림 전부(시트 3장·앞·뒤)를 sheetFrame이 읽는 이미지 캐시까지 다 읽은 뒤에야 돌려준다 → 그림 바꿈이 한 번에 일어난다 */
async function bakeAll(id: CostumeId): Promise<ImageArtEntry> {
  const base = HERO_ART!;
  const bakeAnim = async (a: SheetAnim): Promise<SheetAnim> => ({ ...a, url: await bakeUrl(a.url, id) });
  let sheets: StageSheets | undefined;
  if (base.sheets) {
    const s = base.sheets;
    const [idle, walk, attack] = await Promise.all([bakeAnim(s.idle), bakeAnim(s.walk), s.attack ? bakeAnim(s.attack) : Promise.resolve(undefined)]);
    sheets = { ...s, idle, walk };
    if (attack) sheets.attack = attack;
  }
  const [front, back] = await Promise.all([bakeUrl(base.front, id), base.back ? bakeUrl(base.back, id) : Promise.resolve(undefined)]);
  const out: ImageArtEntry = { ...base, front };
  if (back) out.back = back;
  if (sheets) out.sheets = sheets;
  const urls = [front, back, sheets?.idle.url, sheets?.walk.url, sheets?.attack?.url].filter((u): u is string => !!u);
  await Promise.all(urls.map((u) => preloadSheetImage(u)));
  return out;
}

/** 세트 id → 구운 그림 (실패하면 원래 그림, 5초 뒤 다시 시도) */
const bakes: BakeCache<ImageArtEntry> | undefined = HERO_ART ? createBakeCache<ImageArtEntry>(bakeAll, HERO_ART) : undefined;

/** 이미 구운 그림(동기). basic이거나 그림 파일이 없으면 HERO_ART 그대로, 아직 안 구웠으면 undefined */
export function heroArtCached(id: CostumeId): ImageArtEntry | undefined {
  if (!HERO_ART || !bakes) return undefined;
  const set = getCostume(id);
  if (set.group === 'basic') return HERO_ART;
  return bakes.peek(set.id);
}

/** 세트 그림 굽기 (세트마다 한 번) */
export function heroArtFor(id: CostumeId): Promise<ImageArtEntry | undefined> {
  if (!HERO_ART || !bakes) return Promise.resolve(undefined);
  const set = getCostume(id);
  if (set.group === 'basic') return Promise.resolve(HERO_ART);
  return bakes.get(set.id);
}

/** 이 세트의 그림을 쓰는 훅. 굽는 동안은 이전 그림(없으면 처음 그림) */
export function useHeroArtFor(id: CostumeId): ImageArtEntry | undefined {
  const [art, setArt] = useState<ImageArtEntry | undefined>(() => heroArtCached(id) ?? HERO_ART);
  useEffect(() => {
    if (!HERO_ART) return;
    let alive = true;
    const hit = heroArtCached(id);
    if (hit) {
      setArt(hit);
      return;
    }
    void heroArtFor(id).then((a) => {
      if (alive && a) setArt(a);
    });
    return () => {
      alive = false;
    };
  }, [id]);
  return art;
}

/** 입고 있는 세트의 그림 */
export function useHeroArt(): ImageArtEntry | undefined {
  const equipped = useGameStore((s) => s.field.costume.equipped);
  return useHeroArtFor(equipped);
}
