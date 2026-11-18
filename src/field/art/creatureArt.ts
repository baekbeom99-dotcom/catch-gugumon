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
 * 진화 단계 크기(STAGE_SCALE)와 뒷모습 크기(BACK_VIEW_SCALE)는 creatureSprite.tsx에 있다.
 */
import type { MonsterKind } from '../../domain/battle';
import { speciesDef, type SpeciesId } from '../../domain/field/creatures';
import { LOCAL_SPRITES } from './localSprites';

/** MonsterSprite는 둘레에 여백이 있다: 몸이 한 칸쯤 차게 이만큼 키워 그린다 (viewBox 224 중 몸통이 약 155) */
export const MONSTER_FILL = 1.45;
/** MonsterSprite에서 발끝이 그림 높이의 어디쯤인지 (viewBox -24~200 중 발끝 ≈ 195) */
export const MONSTER_FOOT = 0.98;

/** 시트 한 가지(걷기 등): 가로=프레임, 세로=줄. ms는 프레임별 보이는 시간 */
export interface SheetAnim {
  url: string;
  ms: number[];
  rows: number;
}

/** 공격 시트: 칸이 Idle보다 크다(attackSide). 기준점 (ax,ay)=공격 칸 안, (ix,iy)=Idle 칸 안 — 두 점이 겹치게 놓는다 */
export interface AttackAnim extends SheetAnim {
  side: number;
  ax: number;
  ay: number;
  ix: number;
  iy: number;
}

/**
 * 한 단계의 시트 묶음 (scripts/cut-sprites.mjs 가 만든다). 칸은 모두 side×side 정사각형.
 * scale = side / 정지 그림 크기: 시트 칸이 더 크므로 이만큼 키워 그려야 몸이 정지 그림과 같은 크기다.
 * foot = 칸 높이 중 발끝 위치(0~1)
 */
export interface StageSheets {
  side: number;
  scale: number;
  foot: number;
  /** 몸 크기 맞춤(StageArt.fill과 같은 값): 시트 칸을 이만큼 더 키워 그린다 (기본 1) */
  fill?: number;
  idle: SheetAnim;
  walk: SheetAnim;
  hurt?: SheetAnim;
  sleep?: SheetAnim;
  /** 전투 공격 (오른쪽위·왼쪽아래 2줄, 없으면 공격 때도 가만히) */
  attack?: AttackAnim;
}

/** 진화 단계 하나의 그림 */
export interface StageArt {
  front: string;
  back?: string;
  /** 이 단계의 몸 크기 맞춤: 자리(정사각형) 대비 곱하는 배율, 기본 1. localSprites가 manifest의 몸 높이로 계산한다 (spriteSheet.bodyFill) */
  fill?: number;
  /** 움직이는 시트 (선택, 없으면 정지 그림) */
  sheets?: StageSheets;
}

export interface ImageArtEntry {
  /** 앞모습 그림 주소 (import 한 파일) */
  front: string;
  /** 뒷모습 (내 구구몬이 싸울 때). 없으면 앞모습을 뒤집는다 */
  back?: string;
  /** 진화 1·2·3단계별 그림 (선택). 있으면 그 단계 그림을 쓰고, 없으면 front/back */
  stages?: [StageArt, StageArt, StageArt];
  /** 필드 동행으로 그릴 때 한 칸 대비 크기 (기본 1) */
  fill?: number;
  /** 발끝이 그림 높이의 어디쯤인지 0~1 (기본 1 = 맨 아래) */
  foot?: number;
}

export type CreatureArt =
  | { type: 'monster'; kind: MonsterKind; golden: boolean; fill: number; foot: number }
  | { type: 'image'; front: string; back?: string; stages?: [StageArt, StageArt, StageArt]; fill: number; foot: number };

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
    if (img.stages) art.stages = img.stages;
    return art;
  }
  const def = speciesDef(id);
  // 그림이 아직 없는 종: 주속성으로 고른 임시 SVG (creatures.ts의 FALLBACK_SVG)
  return { type: 'monster', kind: def.svgKind, golden: def.legend, fill: MONSTER_FILL, foot: MONSTER_FOOT };
}

/** 이 단계의 시트 묶음 (없으면 undefined = 정지 그림) */
export function stageSheets(art: CreatureArt, stage: 1 | 2 | 3 = 1): StageSheets | undefined {
  if (art.type !== 'image') return undefined;
  return art.stages?.[stage - 1]?.sheets;
}

/** 이 단계의 몸 크기 맞춤 배율 (이미지 그림에 없으면 1, 필드 동행은 art.fill에 곱한다) */
export function stageFill(art: CreatureArt, stage: 1 | 2 | 3 = 1): number {
  if (art.type !== 'image') return 1;
  return art.stages?.[stage - 1]?.fill ?? 1;
}

/** 이미지 그림에서 보는 쪽에 맞는 파일과 뒤집기 여부 */
export function imageView(art: Extract<CreatureArt, { type: 'image' }>, view: 'front' | 'back' | 'mini', stage: 1 | 2 | 3 = 1): { src: string; flip: boolean } {
  const pick = art.stages?.[stage - 1] ?? art;
  if (view !== 'back') return { src: pick.front, flip: false };
  return pick.back ? { src: pick.back, flip: false } : { src: pick.front, flip: true };
}
