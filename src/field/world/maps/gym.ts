import type { ArithLevel } from '../../../domain/arith';
import type { Pos } from '../../../domain/field/movement';
import type { TrainingDan } from '../../../domain/field/tuning';
import type { HairLook } from '../../art/npcTint';

/**
 * 체육관 안 (가로 15 × 세로 20). 사진 속 체육관처럼: 맨 위 두 줄은 꾸민 벽(0줄 천장 띠·1줄 벽면),
 * 분홍 체크 무늬 바닥, 가운데 위쪽에 막힌 단상(P, 3×2), 트레이너 13명이 방 곳곳에 서 있고,
 * 아래쪽에 회색 동상 둘, 맨 아래 가운데 파란 매트가 입구이자 출구(v)다. 야생 구구몬은 나오지 않는다 (서식지 칸 없음).
 *
 * 글자: `#` 벽, `.` 바닥, `P` 단상(막힘), `S` 표지판, `@` 시작 칸(입구 바로 위), `v` 출구(→ 마을).
 * NPC·동상 칸은 글자가 아니라 아래 표(GYM_NPCS·GYM_STATUES)로 정한다 — 둘 다 바닥(`.`) 위에 서고 지나갈 수 없다.
 * 입구(7,18)에서 모든 NPC 곁 칸에 걸어서 닿는다 (tests/field/gymMap.test.ts가 지킨다).
 */
export const GYM_ROWS: string[] = [
  '###############',
  '###############',
  '#.............#',
  '#.....PPP.....#',
  '#.....PPP.....#',
  '#.............#',
  '#.............#',
  '#.............#',
  '#.............#',
  '#.............#',
  '#.............#',
  '#.............#',
  '#.............#',
  '#.............#',
  '#.............#',
  '#.............#',
  '#.............#',
  '#......@......#',
  '#....S........#',
  '#######v#######',
];

export const GYM_EXITS = { v: 'town' } as const;

/** 읽는 순서(위→아래, 왼→오른) */
export const GYM_SIGNS: string[] = ['체육관 · 트레이너에게 말을 걸어 보세요'];

/** 색 곱셈 계수(0~2): 1이면 원래 색. NPC마다 다른 색으로 구분한다 (자리 표시와 Task 7의 NPC 그림이 같이 쓴다) */
export type Tint = { r: number; g: number; b: number };

/** NPC가 바라보는 쪽 (치비 시트 행: 아래·위·오른쪽·왼쪽) */
export type GymFacing = 'down' | 'up' | 'left' | 'right';

type GymNpcBase = {
  id: string;
  pos: Pos;
  /** 옷 색 곱셈 */
  tint: Tint;
  /** 머리색: 노랑(색상 45~70도)은 마스터한 트레이너만 쓴다 — 여기에는 노랑이 없다 (tests/field/gymMap.test.ts) */
  hair: HairLook;
  facing: GymFacing;
};
export type GymNpc =
  | (GymNpcBase & { kind: 'dan'; dan: TrainingDan })
  | (GymNpcBase & { kind: 'arith'; level: ArithLevel });

/**
 * 트레이너 13명. 단 트레이너 열 명은 2·3·4·5·6·7·8·9·12·13단 순서로 왼쪽에서 입구에 가까운 쪽부터
 * 위로 올라가며(낮은 단일수록 입구 가깝다) 가로줄 x=4·x=2를 번갈아 선다. 셈연습 트레이너 셋(기본·고수·보수)은 오른쪽에 세로로 선다.
 * 머리색·바라보는 쪽도 사람마다 다르게 한다.
 */
export const GYM_NPCS: GymNpc[] = [
  { id: 'dan2', kind: 'dan', dan: 2, pos: { x: 4, y: 16 }, tint: { r: 1.6, g: 0.7, b: 0.7 }, hair: { hue: 0 }, facing: 'right' },
  { id: 'dan3', kind: 'dan', dan: 3, pos: { x: 2, y: 14 }, tint: { r: 1.7, g: 1.0, b: 0.5 }, hair: { hue: 26 }, facing: 'down' },
  { id: 'dan4', kind: 'dan', dan: 4, pos: { x: 4, y: 12 }, tint: { r: 0.6, g: 1.0, b: 1.7 }, hair: { hue: 28, sat: 0.8, val: 0.6 }, facing: 'right' },
  { id: 'dan5', kind: 'dan', dan: 5, pos: { x: 2, y: 11 }, tint: { r: 0.9, g: 1.4, b: 0.7 }, hair: { hue: 135 }, facing: 'up' },
  { id: 'dan6', kind: 'dan', dan: 6, pos: { x: 4, y: 9 }, tint: { r: 0.6, g: 1.2, b: 1.5 }, hair: { hue: 170 }, facing: 'down' },
  { id: 'dan7', kind: 'dan', dan: 7, pos: { x: 2, y: 8 }, tint: { r: 0.6, g: 0.8, b: 1.8 }, hair: { hue: 205 }, facing: 'right' },
  { id: 'dan8', kind: 'dan', dan: 8, pos: { x: 4, y: 6 }, tint: { r: 1.1, g: 0.6, b: 1.8 }, hair: { hue: 230 }, facing: 'left' },
  { id: 'dan9', kind: 'dan', dan: 9, pos: { x: 2, y: 5 }, tint: { r: 1.6, g: 0.7, b: 1.4 }, hair: { hue: 275 }, facing: 'right' },
  { id: 'dan12', kind: 'dan', dan: 12, pos: { x: 4, y: 3 }, tint: { r: 0.5, g: 0.5, b: 0.6 }, hair: { hue: 320 }, facing: 'down' },
  { id: 'dan13', kind: 'dan', dan: 13, pos: { x: 2, y: 2 }, tint: { r: 1.6, g: 1.5, b: 1.7 }, hair: { hue: 240, sat: 0.12, val: 0.35 }, facing: 'right' },
  { id: 'arith-basic', kind: 'arith', level: 'basic', pos: { x: 11, y: 14 }, tint: { r: 1.0, g: 1.0, b: 1.0 }, hair: { hue: 220, sat: 0.1, val: 1.3 }, facing: 'left' },
  { id: 'arith-hard', kind: 'arith', level: 'hard', pos: { x: 12, y: 10 }, tint: { r: 0.6, g: 0.7, b: 0.8 }, hair: { hue: 100, sat: 0.85 }, facing: 'down' },
  { id: 'arith-comp', kind: 'arith', level: 'comp', pos: { x: 11, y: 6 }, tint: { r: 1.8, g: 1.7, b: 0.6 }, hair: { hue: 350, val: 0.6 }, facing: 'left' },
];

/** 아래쪽 장식 동상 둘 (막힘, 말을 걸 수 없다 — 별점수가 꺼져 있는 동안) */
export const GYM_STATUES: Pos[] = [
  { x: 2, y: 17 },
  { x: 12, y: 17 },
];
