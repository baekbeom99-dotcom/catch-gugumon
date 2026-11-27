/**
 * 주인공 꾸미기 그림: 017 치비 그림(HERO_ART)의 머리·윗옷·바지 색을 입은 세트대로 바꿔 한 번만 굽고 캐시한다 (heroTint). 굽기는 줄 하나로 한 번에 한 장씩.
 * 그림 파일이 없으면(HERO_ART 없음) 아무것도 하지 않는다. 굽기에 실패하면 원래 그림으로 돌아간다 (오류를 던지지 않는다).
 * 굽는 동안에는 이전(또는 처음) 그림을 그대로 쓰므로 화면이 멈추지 않는다.
 */
import { useEffect, useState } from 'react';
import { getCostume, type CostumeId } from '../../domain/field/costumes';
import { useGameStore } from '../../store/useGameStore';
import type { ImageArtEntry, StageSheets } from './creatureArt';
import { BakeSkipped, createBakeCache, type BakeCache } from './bakeCache';
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

// ── 굽기 줄: 한 번에 하나만, 그림 한 장마다 메인 스레드를 비켜 준다 (휴대폰에서 화면이 얼지 않게) ──
interface Job {
  pri: number;
  wanted: () => boolean;
  run: () => Promise<unknown>;
  resolve: (v: never) => void;
  reject: (e: unknown) => void;
}
const queue: Job[] = [];
let pumping = false;

/** 메인 스레드를 한 번 비켜 준다 */
export const yieldToEvents = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

async function pump(): Promise<void> {
  if (pumping) return;
  pumping = true;
  try {
    while (queue.length > 0) {
      // 입고 있는 옷(pri 0)이 미리보기(pri 1)보다 먼저, 같은 우선순위는 들어온 순서
      let at = 0;
      for (let i = 1; i < queue.length; i++) if (queue[i].pri < queue[at].pri) at = i;
      const job = queue.splice(at, 1)[0];
      if (!job.wanted()) {
        job.reject(new BakeSkipped());
        continue;
      }
      try {
        job.resolve((await job.run()) as never);
      } catch (e) {
        job.reject(e);
      }
      await yieldToEvents();
    }
  } finally {
    pumping = false;
  }
}

function enqueue<T>(pri: number, wanted: () => boolean, run: () => Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    queue.push({ pri, wanted, run, resolve: resolve as (v: never) => void, reject });
    void pump();
  });
}

/**
 * 그림 한 장에 세트 색을 입힌다. 색칠(메인 스레드 일)이 끝나면 바로 돌려주고, 이미지로 굽는 일(PNG 인코딩)은
 * 돌려준 약속(encoded)이 끝날 때까지 브라우저가 따로 한다 → 여러 장의 인코딩이 겹쳐 돈다.
 * 쓴 임시 캔버스는 인코딩을 맡기자마자 0×0으로 줄여 메모리를 돌려준다 (Safari).
 * asDataUrl이면 작은 그림(앞모습)을 동기 toDataURL로 바로 만든다 (toBlob은 화면이 바쁠 때 1초씩 늦는다).
 */
async function paintUrl(url: string, id: CostumeId, asDataUrl: boolean): Promise<{ encoded: Promise<string> }> {
  const img = await loadImage(url);
  await yieldToEvents();
  const c = document.createElement('canvas');
  try {
    c.width = img.naturalWidth;
    c.height = img.naturalHeight;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('캔버스를 못 써요');
    ctx.drawImage(img, 0, 0);
    const data = ctx.getImageData(0, 0, c.width, c.height);
    tintHeroImageData(data.data, getCostume(id));
    ctx.putImageData(data, 0, 0);
    if (asDataUrl) return { encoded: Promise.resolve(c.toDataURL('image/png')) };
    const encoded = new Promise<string>((resolve, reject) => {
      c.toBlob((blob) => (blob ? resolve(URL.createObjectURL(blob)) : reject(new Error('그림을 굽지 못했어요'))), 'image/png');
    });
    return { encoded };
  } finally {
    c.width = 0;
    c.height = 0;
  }
}

/** 구운 그림 전부(시트 3장·앞·뒤): 색칠은 한 장씩(사이사이 비켜 줌), 인코딩은 겹쳐서. 모두 sheetFrame이 읽는 이미지 캐시까지 읽은 뒤에야 돌려준다 → 그림 바꿈이 한 번에 일어난다 */
async function bakeAll(id: CostumeId): Promise<ImageArtEntry> {
  const base = HERO_ART!;
  // 약속을 바로 돌려주면 async 함수가 끝까지 기다려 버리므로 {encoded}로 감싸 돌려준다 (색칠만 기다리고 인코딩은 겹치게)
  const paint = async (url: string): Promise<{ encoded: Promise<string> }> => {
    const p = await paintUrl(url, id, false);
    await yieldToEvents();
    return p;
  };
  const pIdle = base.sheets ? await paint(base.sheets.idle.url) : undefined;
  const pWalk = base.sheets ? await paint(base.sheets.walk.url) : undefined;
  const pAttack = base.sheets?.attack ? await paint(base.sheets.attack.url) : undefined;
  const pFront = await paint(base.front);
  const pBack = base.back ? await paint(base.back) : undefined;
  const [idle, walk, attack, front, back] = await Promise.all([pIdle?.encoded, pWalk?.encoded, pAttack?.encoded, pFront.encoded, pBack?.encoded]);
  const out: ImageArtEntry = { ...base, front: front! };
  if (back) out.back = back;
  if (base.sheets) {
    const sheets: StageSheets = { ...base.sheets, idle: { ...base.sheets.idle, url: idle! }, walk: { ...base.sheets.walk, url: walk! } };
    if (base.sheets.attack && attack) sheets.attack = { ...base.sheets.attack, url: attack };
    out.sheets = sheets;
  }
  const urls = [out.front, out.back, out.sheets?.idle.url, out.sheets?.walk.url, out.sheets?.attack?.url].filter((u): u is string => !!u);
  await Promise.all(urls.map((u) => preloadSheetImage(u)));
  return out;
}

/** 앞모습 한 장만 굽기 (상점 미리보기용: 전체의 약 2%) */
async function bakeFront(id: CostumeId): Promise<string> {
  const url = await (await paintUrl(HERO_ART!.front, id, true)).encoded;
  await preloadSheetImage(url);
  return url;
}

/** 이 세트의 앞모습을 지금 보고 싶어 하는 카드 수 (0이면 줄에서 건너뛴다) */
const frontWanted = new Map<CostumeId, number>();

/** 세트 id → 구운 그림 전체 (입고 있는 옷용: 우선). 실패하면 원래 그림, 5초 뒤 다시 시도 */
const bakes: BakeCache<ImageArtEntry> | undefined = HERO_ART ? createBakeCache<ImageArtEntry>((id) => enqueue(0, () => true, () => bakeAll(id)), HERO_ART) : undefined;
/** 세트 id → 앞모습 blob 주소 (미리보기용). 실패·건너뜀이면 ''(그림 없음) */
const fronts: BakeCache<string> | undefined = HERO_ART ? createBakeCache<string>((id) => enqueue(1, () => (frontWanted.get(id) ?? 0) > 0, () => bakeFront(id)), '') : undefined;

/** 이미 구운 그림(동기). basic이거나 그림 파일이 없으면 HERO_ART 그대로, 아직 안 구웠으면 undefined */
export function heroArtCached(id: CostumeId): ImageArtEntry | undefined {
  if (!HERO_ART || !bakes) return undefined;
  const set = getCostume(id);
  if (set.group === 'basic') return HERO_ART;
  return bakes.peek(set.id);
}

/** 세트 그림 굽기 (세트마다 한 번, 줄에서 미리보기보다 먼저) */
export function heroArtFor(id: CostumeId): Promise<ImageArtEntry | undefined> {
  if (!HERO_ART || !bakes) return Promise.resolve(undefined);
  const set = getCostume(id);
  if (set.group === 'basic') return Promise.resolve(HERO_ART);
  return bakes.get(set.id);
}

/** 이미 구운 앞모습 주소(동기). 전체를 구운 세트면 그 앞모습, basic이면 원래 그림, 아직이면 undefined */
export function heroFrontCached(id: CostumeId): string | undefined {
  if (!HERO_ART || !fronts) return undefined;
  const set = getCostume(id);
  if (set.group === 'basic') return HERO_ART.front;
  return bakes?.peek(set.id)?.front ?? (fronts.peek(set.id) || undefined);
}

/** 앞모습 한 장 굽기. 아무 카드도 원하지 않으면(frontWanted 0) 줄에서 건너뛴다 */
export function heroFrontFor(id: CostumeId): Promise<string | undefined> {
  if (!HERO_ART || !fronts) return Promise.resolve(undefined);
  const set = getCostume(id);
  if (set.group === 'basic') return Promise.resolve(HERO_ART.front);
  const cached = heroFrontCached(set.id);
  if (cached) return Promise.resolve(cached);
  return fronts.get(set.id).then((u) => u || undefined);
}

/**
 * 상점 카드 미리보기: 이 세트 자신의 앞모습이 준비되면 그 주소, 그전엔 undefined(자리표시).
 * 카드가 사라지면(언마운트) 아직 줄에 있는 굽기는 건너뛴다. 입은 옷의 전체 굽기가 먼저 줄을 선다.
 */
export function useHeroFront(id: CostumeId): string | undefined {
  const [url, setUrl] = useState<string | undefined>(() => heroFrontCached(id));
  useEffect(() => {
    const hit = heroFrontCached(id);
    if (hit) {
      setUrl(hit);
      return;
    }
    setUrl(undefined);
    let alive = true;
    frontWanted.set(id, (frontWanted.get(id) ?? 0) + 1);
    void heroFrontFor(id).then((u) => {
      if (alive && u) setUrl(u);
    });
    return () => {
      alive = false;
      const n = (frontWanted.get(id) ?? 1) - 1;
      if (n <= 0) frontWanted.delete(id);
      else frontWanted.set(id, n);
    };
  }, [id]);
  return url;
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
