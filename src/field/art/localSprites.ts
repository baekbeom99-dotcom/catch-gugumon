/**
 * 이 PC에서만 쓰는 치비 그림. 이미지는 저장소에 넣지 않는다(.gitignore) —
 * src/field/art/creatures/chibi/ 에 파일이 있을 때만 등록되고, 없으면 LOCAL_SPRITES는 빈 객체·HERO_ART는 undefined라 기존 SVG·픽셀 그림 그대로다.
 * 파일 만들기: python scripts/cut-chibi.py  (<번호>-front/back/idle/walk/attack.png, manifest.json)
 * 번호 = 종 id 숫자 (c034 → 034). 017은 종이 아니라 주인공 그림이다.
 */
import { SPECIES_IDS, type SpeciesId } from '../../domain/field/speciesIds';
import type { ImageArtEntry, SheetAnim, StageSheets } from './creatureArt';

/** 주인공 그림 번호 (종이 아니다) */
export const HERO_NUM = '017';

/** 필드에서 치비 그림 자리 크기(한 칸 대비): 몸 높이가 자리의 BODY_H_TARGET(0.8)이므로 몸이 한 칸쯤 된다 */
export const CHIBI_FIELD_FILL = 1.3;

/** 종 id → 그림 번호 (c034 → '034') */
export function chibiNum(id: SpeciesId): string {
  return id.slice(1);
}

type Files = Record<string, string>;

/** manifest.json 한 번호의 모양 (cut-chibi.py 출력) */
export interface ChibiManifestEntry {
  cw: number;
  ch: number;
  cols?: number;
  rows?: number;
  /** 앞모습 첫 프레임의 몸 높이·너비(이미지 픽셀) — 몸 크기 맞춤에 쓴다 */
  bodyH?: number;
  bodyW?: number;
  idle?: { ms: number[] };
  walk?: { ms: number[] };
  attack?: { ms: number[] };
}
export type ChibiManifest = Record<string, ChibiManifestEntry>;

/** 한 번호의 그림 등록. 앞모습이 없으면 undefined. manifest·idle·walk가 다 있어야 시트를 쓴다 */
export function buildChibiArt(files: Files, num: string, manifest: ChibiManifest = {}): ImageArtEntry | undefined {
  const find = (view: 'front' | 'back' | 'idle' | 'walk' | 'attack') => {
    const key = Object.keys(files).find((k) => k.endsWith(`/${num}-${view}.png`));
    return key ? files[key] : undefined;
  };
  const front = find('front');
  if (!front) return undefined;
  const m = manifest[num];
  const out: ImageArtEntry = { front, back: find('back'), fill: CHIBI_FIELD_FILL, foot: 1 };
  if (!m || !(m.cw > 0) || !(m.ch > 0)) return out;
  out.cell = { cw: m.cw, ch: m.ch, bodyH: m.bodyH, bodyW: m.bodyW };
  const anim = (k: 'idle' | 'walk' | 'attack'): SheetAnim | undefined => {
    const url = find(k);
    const a = m[k];
    return url && a && a.ms.length > 0 ? { url, ms: a.ms } : undefined;
  };
  const idle = anim('idle');
  const walk = anim('walk');
  if (idle && walk) {
    const sheets: StageSheets = { cw: m.cw, ch: m.ch, idle, walk };
    const attack = anim('attack');
    if (attack) sheets.attack = attack;
    out.sheets = sheets;
  }
  return out;
}

/** 파일 주소 표(경로 → url)로 종별 등록을 만든다. 앞모습이 없는 번호는 건너뛰어, 파일이 없으면 빈 객체 */
export function buildLocalSprites(files: Files, manifest: ChibiManifest = {}, ids: readonly SpeciesId[] = SPECIES_IDS): Partial<Record<SpeciesId, ImageArtEntry>> {
  const out: Partial<Record<SpeciesId, ImageArtEntry>> = {};
  for (const id of ids) {
    const art = buildChibiArt(files, chibiNum(id), manifest);
    if (art) out[id] = art;
  }
  return out;
}

const FILES = import.meta.glob('./creatures/chibi/*.png', { eager: true, query: '?url', import: 'default' }) as Files;

const MANIFEST_FILES = import.meta.glob('./creatures/chibi/manifest.json', { eager: true, import: 'default' }) as Record<string, ChibiManifest>;
const MANIFEST: ChibiManifest = Object.values(MANIFEST_FILES)[0] ?? {};

export const LOCAL_SPRITES = buildLocalSprites(FILES, MANIFEST);

/** 주인공(017) 치비 그림. 없으면 undefined → 픽셀 주인공(hero.ts) */
export const HERO_ART: ImageArtEntry | undefined = buildChibiArt(FILES, HERO_NUM, MANIFEST);

/** 체육관 NPC(트레이너) 그림 번호 — 013 치비 한 장에 색만 다르게 입힌다 (종이 아니다) */
export const NPC_NUM = '013';

/** 체육관 NPC 치비 그림. 없으면 undefined → 픽셀 NPC(npcSprite) */
export const NPC_ART: ImageArtEntry | undefined = buildChibiArt(FILES, NPC_NUM, MANIFEST);
