/** 구구몬 그림 — 어떤 그림을 쓸지는 creatureArt.ts 등록표가 정한다 (지금은 몬스터 SVG, 레전드는 황금) */
import { useEffect, useState } from 'react';
import { DAN_COLORS } from '../../art/colors';
import { MonsterSprite, type MonsterMood } from '../../art/MonsterSprite';
import type { MonsterKind } from '../../domain/battle';
import { speciesDef, type SpeciesId } from '../../domain/field/creatures';
import { artBodyRatio, artBox, artSheets, creatureArt, imageView, type SheetAnim, type StageSheets } from './creatureArt';
import { BATTLE_ROW, DIR_ROW, SHEET_COLS, SHEET_ROWS, cellBox, onceFrameAt, totalMs, type BattleSide } from './spriteSheet';

/** 내 구구몬(뒷모습)은 조금 작게 */
export const BACK_VIEW_SCALE = 0.8;
/** 진화 단계별 크기 */
export const STAGE_SCALE: Record<1 | 2 | 3, number> = { 1: 1, 2: 1.15, 3: 1.3 };

interface Opts {
  /** ally·foe = 전투 화면 (내 구구몬은 왼쪽 아래에서 뒷모습, 야생은 오른쪽 위에서 앞모습). front·back = 도감 등 정지 앞·뒷모습 */
  view: 'front' | 'back' | 'mini' | BattleSide;
  /** 전투: 공격을 시작한 시각(Date.now()). 이 시각부터 Attack 시트를 한 번 틀고 끝나면 가만히로 돌아간다 (다시 그려져도 이어서 본다) */
  attackAt?: number;
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

/** 자리(px×px 정사각형) 안에 칸 그림(가로 w·세로 h, 자리 대비)을 놓을 위치: 칸 아래 = 자리 아래, 가로 가운데 */
function placeBox(px: number, box: { w: number; h: number }) {
  const w = Math.round(px * box.w);
  const h = Math.round(px * box.h);
  return { w, h, left: Math.round((px - w) / 2), top: px - h };
}

/** 시트 한 칸(col, row)을 자리 안에 그린다. 칸이 자리보다 크면 넘쳐 보인다 */
function SheetCell({ url, col, row, px, box, testId, frame }: { url: string; col: number; row: number; px: number; box: { w: number; h: number }; testId?: string; frame?: number }) {
  const p = placeBox(px, box);
  return (
    <span style={{ position: 'relative', display: 'block', width: px, height: px, overflow: 'visible' }} data-sheet={testId} data-frame={frame}>
      <span
        style={{
          position: 'absolute',
          left: p.left,
          top: p.top,
          width: p.w,
          height: p.h,
          backgroundImage: `url(${url})`,
          backgroundRepeat: 'no-repeat',
          backgroundSize: `${SHEET_COLS * p.w}px ${SHEET_ROWS * p.h}px`,
          backgroundPosition: `${-col * p.w}px ${-row * p.h}px`,
        }}
      />
    </span>
  );
}

/** 시트 한 행(방향)을 프레임 시간에 맞춰 되풀이해 보여 준다. 자리 크기(px)는 정지 그림과 같고, 몸 높이로 맞춘 칸을 발끝·가운데에 둔다 */
export function SheetSprite({ sheets, anim, row, px, testId, box }: { sheets: StageSheets; anim: SheetAnim; row: number; px: number; testId?: string; box?: { w: number; h: number } }) {
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
  return <SheetCell url={anim.url} col={Math.min(frame, ms.length - 1)} row={row} px={px} box={box ?? cellBox(sheets)} testId={testId} />;
}

/**
 * 지금 보여 줄 시트 행. 시트가 없거나 동작 줄이기면 undefined(정지 그림).
 * 전투: 내 구구몬은 뒷모습 행, 야생은 앞모습 행. 맞음 시트는 없어 가만히 그림을 CSS로 흔든다. 잠도 가만히 행
 */
export function pickSheet(sheets: StageSheets | undefined, view: 'front' | 'back' | BattleSide): { anim: SheetAnim; row: number; key: string } | undefined {
  if (!sheets || reducedMotion()) return undefined;
  if (view === 'ally' || view === 'foe') return { anim: sheets.idle, row: BATTLE_ROW[view], key: 'idle' };
  return { anim: sheets.idle, row: view === 'back' ? DIR_ROW.up : DIR_ROW.down, key: 'idle' };
}

/** 전투 그림: 가만히(되풀이)에 공격 신호가 오면 같은 행의 공격 시트를 한 번만 틀고 끝나면 가만히 */
function BattleSprite({ sheets, box, side, attackAt, px }: { sheets: StageSheets; box: { w: number; h: number }; side: BattleSide; attackAt?: number; px: number }) {
  const atk = sheets.attack;
  const total = atk ? totalMs(atk.ms) : 0;
  const [now, setNow] = useState(() => Date.now());
  const live = !!atk && attackAt !== undefined && now - attackAt < total;
  useEffect(() => {
    if (!atk || attackAt === undefined) return;
    if (Date.now() - attackAt >= total) return;
    setNow(Date.now());
    const id = window.setInterval(() => {
      setNow(Date.now());
      if (Date.now() - attackAt >= total) window.clearInterval(id);
    }, 16);
    return () => window.clearInterval(id);
  }, [atk, attackAt, total]);
  const col = live && atk ? onceFrameAt(atk.ms, now - attackAt!) : null;
  const row = BATTLE_ROW[side];
  if (!live || !atk || col === null) return <SheetSprite sheets={sheets} anim={sheets.idle} row={row} px={px} box={box} testId={`${side}-idle`} />;
  return <SheetCell url={atk.url} col={col} row={row} px={px} box={box} testId={`${side}-attack`} frame={col} />;
}

const flipped = (el: JSX.Element) => <span style={{ display: 'inline-block', transform: 'scaleX(-1)' }}>{el}</span>;

export function creatureSprite(id: SpeciesId, { view: viewIn, attackAt, stage = 1, mood = 'idle', color, size }: Opts): JSX.Element {
  const art = creatureArt(id);
  const battle = viewIn === 'ally' || viewIn === 'foe' ? viewIn : null;
  // 시트가 없을 때의 정지 그림은 내 구구몬=뒷모습, 야생=앞모습
  const view: 'front' | 'back' | 'mini' = battle ? (battle === 'ally' ? 'back' : 'front') : (viewIn as 'front' | 'back' | 'mini');
  const scale = STAGE_SCALE[stage] * (view === 'back' && !battle ? BACK_VIEW_SCALE : 1);
  const px = Math.round(size * scale);
  if (art.type === 'image') {
    const sheets = artSheets(art);
    const box = artBox(art);
    const pick = view === 'mini' ? undefined : pickSheet(sheets, battle ?? view);
    if (sheets && pick && battle) return <BattleSprite sheets={sheets} box={box} side={battle} attackAt={attackAt} px={px} />;
    if (sheets && pick) return <SheetSprite sheets={sheets} anim={pick.anim} row={pick.row} px={px} box={box} testId={`${view}-${pick.key}`} />;
    const { src, flip } = imageView(art, view);
    const p = placeBox(px, box);
    // 몸 크기 맞춤: 자리(px)는 그대로 두고 그림만 키워 발끝·가운데를 맞춘다
    const img = (
      <span style={{ position: 'relative', display: 'block', width: px, height: px }}>
        <img src={src} width={p.w} height={p.h} alt="" draggable={false} style={{ display: 'block', position: 'absolute', left: p.left, top: p.top }} />
      </span>
    );
    return flip ? flipped(img) : img;
  }
  const sprite = <MonsterSprite kind={art.kind} color={color} golden={art.golden} mood={battle === 'ally' ? 'idle' : mood} size={px} />;
  return view === 'back' ? flipped(sprite) : sprite;
}

/** 전투 그림의 몸 너비(CSS px) — 발밑 그림자 크기 기준. size는 creatureSprite에 넘기는 자리 크기 */
export function battleBodyPx(id: SpeciesId, size: number, stage: 1 | 2 | 3 = 1): number {
  const art = creatureArt(id);
  return Math.round(size * STAGE_SCALE[stage]) * artBox(art).w * artBodyRatio(art);
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
  return SPECIES_COLOR[speciesDef(id).svgKind];
}
