/** 구구몬 그림 — 어떤 그림을 쓸지는 creatureArt.ts 등록표가 정한다 (지금은 몬스터 SVG, 레전드는 황금) */
import { useEffect, useState } from 'react';
import { DAN_COLORS } from '../../art/colors';
import { MonsterSprite, type MonsterMood } from '../../art/MonsterSprite';
import type { MonsterKind } from '../../domain/battle';
import { speciesDef, type SpeciesId } from '../../domain/field/creatures';
import { creatureArt, imageView, stageSheets, type SheetAnim, type StageSheets } from './creatureArt';
import { DIR_ROW, HURT_ROW } from './spriteSheet';

/** 내 구구몬(뒷모습)은 조금 작게 */
export const BACK_VIEW_SCALE = 0.8;
/** 진화 단계별 크기 */
export const STAGE_SCALE: Record<1 | 2 | 3, number> = { 1: 1, 2: 1.15, 3: 1.3 };

interface Opts {
  view: 'front' | 'back' | 'mini';
  stage?: 1 | 2 | 3;
  /** 몬스터 SVG의 표정 (이미지 그림은 표정이 없고, 맞기·잡기 움직임은 CSS가 준다) */
  mood?: MonsterMood;
  /** 몬스터 SVG의 색 (이미지 그림은 쓰지 않음) */
  color: string;
  size: number;
}

function reducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

/** 시트 한 줄을 프레임 시간에 맞춰 되풀이해 보여 준다. 자리 크기(px)는 정지 그림과 같고, 칸은 scale배라 발끝·가운데를 맞춰 넘치게 둔다 */
export function SheetSprite({ sheets, anim, row, px, testId }: { sheets: StageSheets; anim: SheetAnim; row: number; px: number; testId?: string }) {
  const [frame, setFrame] = useState(0);
  const ms = anim.ms;
  useEffect(() => {
    setFrame(0);
    if (ms.length <= 1) return;
    let t = 0;
    let i = 0;
    const next = () => {
      t = window.setTimeout(() => {
        i = (i + 1) % ms.length;
        setFrame(i);
        next();
      }, Math.max(16, ms[i]));
    };
    next();
    return () => window.clearTimeout(t);
  }, [ms]);
  const cell = Math.round(px * sheets.scale);
  const col = Math.min(frame, ms.length - 1);
  return (
    <span style={{ position: 'relative', display: 'block', width: px, height: px }} data-sheet={testId}>
      <span
        style={{
          position: 'absolute',
          left: Math.round((px - cell) / 2),
          bottom: 0,
          width: cell,
          height: cell,
          backgroundImage: `url(${anim.url})`,
          backgroundRepeat: 'no-repeat',
          backgroundSize: `${ms.length * cell}px ${anim.rows * cell}px`,
          backgroundPosition: `${-col * cell}px ${-row * cell}px`,
          imageRendering: 'pixelated',
        }}
      />
    </span>
  );
}

/** 지금 보여 줄 시트와 줄. 시트가 없거나 동작 줄이기면 undefined(정지 그림) */
export function pickSheet(sheets: StageSheets | undefined, view: 'front' | 'back', mood: MonsterMood): { anim: SheetAnim; row: number; key: string } | undefined {
  if (!sheets || reducedMotion()) return undefined;
  if (mood === 'hit' && sheets.hurt) return { anim: sheets.hurt, row: view === 'back' ? HURT_ROW.back : HURT_ROW.front, key: 'hurt' };
  if (mood === 'sleep' && sheets.sleep) return { anim: sheets.sleep, row: 0, key: 'sleep' };
  return { anim: sheets.idle, row: view === 'back' ? DIR_ROW.up : DIR_ROW.down, key: 'idle' };
}

const flipped = (el: JSX.Element) => <span style={{ display: 'inline-block', transform: 'scaleX(-1)' }}>{el}</span>;

export function creatureSprite(id: SpeciesId, { view, stage = 1, mood = 'idle', color, size }: Opts): JSX.Element {
  const art = creatureArt(id);
  const scale = STAGE_SCALE[stage] * (view === 'back' ? BACK_VIEW_SCALE : 1);
  const px = Math.round(size * scale);
  if (art.type === 'image') {
    const sheets = stageSheets(art, stage);
    const pick = view === 'mini' ? undefined : pickSheet(sheets, view, mood);
    if (sheets && pick) return <SheetSprite sheets={sheets} anim={pick.anim} row={pick.row} px={px} testId={`${view}-${pick.key}`} />;
    const { src, flip } = imageView(art, view, stage);
    const img = <img src={src} width={px} height={px} alt="" draggable={false} style={{ imageRendering: 'pixelated', display: 'block' }} />;
    return flip ? flipped(img) : img;
  }
  const sprite = <MonsterSprite kind={art.kind} color={color} golden={art.golden} mood={mood} size={px} />;
  return view === 'back' ? flipped(sprite) : sprite;
}

/** 도감·동료 그림에 쓰는 종별 색 */
export const SPECIES_COLOR: Record<MonsterKind, string> = {
  cloud: DAN_COLORS[5],
  mushroom: DAN_COLORS[9],
  fluff: DAN_COLORS[4],
  jelly: DAN_COLORS[8],
  antenna: DAN_COLORS[6],
  horn: DAN_COLORS[3],
  pebble: DAN_COLORS[7],
  ghost: DAN_COLORS[2],
};

export function speciesColor(id: SpeciesId): string {
  return SPECIES_COLOR[speciesDef(id).kind];
}
