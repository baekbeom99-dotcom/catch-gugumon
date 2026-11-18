/**
 * 구구몬 그림 등록표 — 그림을 바꿀 때는 여기만 고친다.
 * 전투(앞·뒷모습)·도감·첫 구구몬 고르기·필드 동행이 모두 이 표를 거쳐 그림을 고른다.
 * 지금은 모두 퀴즈 모험 몬스터 SVG(MonsterSprite)를 빌려 쓴다 (퀴즈 모험 그림은 그대로 둔다).
 *
 * 이미지 그림으로 바꾸기:
 *   1. 그림 파일을 src/field/art/creatures/ 에 넣는다 (예: cloud-front.png, cloud-back.png — 투명 바탕, 정사각형)
 *   2. 이 파일 위에서 import 하고 IMAGE_ART에 한 줄:  cloud: { front: cloudFront, back: cloudBack }
 *      뒷모습이 없으면 앞모습을 좌우로 뒤집어 쓴다. 그림 둘레 여백이 크면 fill(키우기)·foot(발끝 높이)로 맞춘다
 *   3. 개발 서버의 #/dev/field 화면에서 앞·뒤·동행 크기를 한눈에 확인
 * 이 PC에 치비 그림(src/field/art/creatures/chibi/, scripts/cut-chibi.py)이 있으면 종 cNNN은 번호 NNN 그림을 저절로 쓴다 (localSprites.ts).
 * 진화 단계 크기(STAGE_SCALE)와 뒷모습 크기(BACK_VIEW_SCALE)는 creatureSprite.tsx에 있다.
 */
import { SHADOW_FALLBACK_BODY, bodyRatio } from './shadow';
import type { MonsterKind } from '../../domain/battle';
import { speciesDef, type SpeciesId } from '../../domain/field/creatures';
import { LOCAL_SPRITES } from './localSprites';
import { type CellSize, cellBox } from './spriteSheet';

/** MonsterSprite는 둘레에 여백이 있다: 몸이 한 칸쯤 차게 이만큼 키워 그린다 (viewBox 224 중 몸통이 약 155) */
export const MONSTER_FILL = 1.45;
/** MonsterSprite에서 발끝이 그림 높이의 어디쯤인지 (viewBox -24~200 중 발끝 ≈ 195) */
export const MONSTER_FOOT = 0.98;

/** 시트 한 가지(가만히·걷기·공격): 4열(프레임) × 4행(아래·위·오른쪽·왼쪽). ms는 프레임별 보이는 시간 */
export interface SheetAnim {
  url: string;
  ms: number[];
}

/**
 * 한 캐릭터의 시트 묶음 (scripts/cut-chibi.py 가 만든다). 칸은 모두 cw×ch (발은 칸 아래, 몸은 가로 가운데).
 * 맞음·잠 시트는 없다: 맞으면 가만히 그림을 흔들고, 자는 구구몬은 가만히 그림에 Zz를 띄운다.
 */
export interface StageSheets {
  cw: number;
  ch: number;
  idle: SheetAnim;
  walk: SheetAnim;
  /** 전투 공격 (없으면 공격 때도 가만히) */
  attack?: SheetAnim;
}

export interface ImageArtEntry {
  /** 앞모습 그림 주소 (import 한 파일) */
  front: string;
  /** 뒷모습 (내 구구몬이 싸울 때). 없으면 앞모습을 뒤집는다 */
  back?: string;
  /** 그림 칸 크기·몸 크기 (치비 그림). 있으면 몸 높이로 자리에 맞춰 놓고(spriteSheet.cellBox), 없으면 정사각형 그림 */
  cell?: CellSize;
  /** 움직이는 시트 (선택, 없으면 정지 그림) */
  sheets?: StageSheets;
  /** 필드에서 그릴 때 한 칸 대비 자리 크기 (기본 1) */
  fill?: number;
  /** 발끝이 그림 높이의 어디쯤인지 0~1 (기본 1 = 맨 아래) */
  foot?: number;
}

export type CreatureArt =
  | { type: 'monster'; kind: MonsterKind; golden: boolean; fill: number; foot: number }
  | { type: 'image'; front: string; back?: string; cell?: CellSize; sheets?: StageSheets; fill: number; foot: number };

/** 이미지로 바꾼 종. 여기 없는 종은 몬스터 SVG */
const IMAGE_ART: Partial<Record<SpeciesId, ImageArtEntry>> = {
  // cloud: { front: cloudFront, back: cloudBack },
  // 이 PC에만 있는 테스트 그림 (파일이 없으면 비어 있음 — localSprites.ts)
  ...LOCAL_SPRITES,
};

export function creatureArt(id: SpeciesId, images: Partial<Record<SpeciesId, ImageArtEntry>> = IMAGE_ART): CreatureArt {
  const img = images[id];
  if (img) {
    const art: CreatureArt = { type: 'image', front: img.front, back: img.back, fill: img.fill ?? 1, foot: img.foot ?? 1 };
    if (img.cell) art.cell = img.cell;
    if (img.sheets) art.sheets = img.sheets;
    return art;
  }
  const def = speciesDef(id);
  // 그림이 아직 없는 종: 주속성으로 고른 임시 SVG (creatures.ts의 FALLBACK_SVG)
  return { type: 'monster', kind: def.svgKind, golden: def.legend, fill: MONSTER_FILL, foot: MONSTER_FOOT };
}

/** 시트 묶음 (없으면 undefined = 정지 그림). 진화가 없어 단계와 상관없이 한 묶음 */
export function artSheets(art: CreatureArt): StageSheets | undefined {
  return art.type === 'image' ? art.sheets : undefined;
}

/** 정사각형 자리(한 변 1) 안에 그림을 놓을 크기 — 치비 그림은 몸 높이로 맞추고, 다른 그림은 1×1 */
export function artBox(art: CreatureArt): { w: number; h: number } {
  return art.type === 'image' ? cellBox(art.cell) : { w: 1, h: 1 };
}

/** 칸(그림) 너비 대비 몸 너비 — 발밑 그림자 크기 기준 (SVG 폴백은 0.6) */
export function artBodyRatio(art: CreatureArt): number {
  return art.type === 'image' ? bodyRatio(art.cell) : SHADOW_FALLBACK_BODY;
}

/** 이미지 그림에서 보는 쪽에 맞는 파일과 뒤집기 여부 */
export function imageView(art: Extract<CreatureArt, { type: 'image' }>, view: 'front' | 'back' | 'mini'): { src: string; flip: boolean } {
  if (view !== 'back') return { src: art.front, flip: false };
  return art.back ? { src: art.back, flip: false } : { src: art.front, flip: true };
}
