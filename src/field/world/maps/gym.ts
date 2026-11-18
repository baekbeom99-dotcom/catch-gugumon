import type { ArithLevel } from '../../../domain/arith';
import type { Pos } from '../../../domain/field/movement';
import type { TrainingDan } from '../../../domain/field/tuning';

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

export type GymNpc =
  | { id: string; kind: 'dan'; dan: TrainingDan; pos: Pos; tint: Tint }
  | { id: string; kind: 'arith'; level: ArithLevel; pos: Pos; tint: Tint };

/**
 * 트레이너 13명. 단 트레이너 열 명은 2·3·4·5·6·7·8·9·12·13단 순서(번호 1~10)로
 * 왼쪽·오른쪽 번갈아 위로 올라가며 서고(낮은 단일수록 입구에 가깝다), 13단은 단상 바로 위.
 * 셈연습 트레이너 셋(기본·고수·보수)은 가운데 길 옆에 어긋나게 선다.
 */
export const GYM_NPCS: GymNpc[] = [
  { id: 'dan2', kind: 'dan', dan: 2, pos: { x: 11, y: 15 }, tint: { r: 1.5, g: 0.9, b: 0.9 } },
  { id: 'dan3', kind: 'dan', dan: 3, pos: { x: 3, y: 14 }, tint: { r: 1.5, g: 1.2, b: 0.7 } },
  { id: 'dan4', kind: 'dan', dan: 4, pos: { x: 11, y: 12 }, tint: { r: 1.3, g: 1.4, b: 0.7 } },
  { id: 'dan5', kind: 'dan', dan: 5, pos: { x: 3, y: 11 }, tint: { r: 0.9, g: 1.5, b: 0.8 } },
  { id: 'dan6', kind: 'dan', dan: 6, pos: { x: 11, y: 9 }, tint: { r: 0.7, g: 1.5, b: 1.1 } },
  { id: 'dan7', kind: 'dan', dan: 7, pos: { x: 3, y: 8 }, tint: { r: 0.7, g: 1.3, b: 1.5 } },
  { id: 'dan8', kind: 'dan', dan: 8, pos: { x: 11, y: 6 }, tint: { r: 0.8, g: 0.9, b: 1.6 } },
  { id: 'dan9', kind: 'dan', dan: 9, pos: { x: 3, y: 5 }, tint: { r: 1.1, g: 0.8, b: 1.6 } },
  { id: 'dan12', kind: 'dan', dan: 12, pos: { x: 11, y: 3 }, tint: { r: 1.5, g: 0.8, b: 1.4 } },
  { id: 'dan13', kind: 'dan', dan: 13, pos: { x: 7, y: 2 }, tint: { r: 1.7, g: 1.0, b: 0.5 } },
  { id: 'arith-basic', kind: 'arith', level: 'basic', pos: { x: 6, y: 13 }, tint: { r: 1.0, g: 1.0, b: 1.0 } },
  { id: 'arith-hard', kind: 'arith', level: 'hard', pos: { x: 8, y: 10 }, tint: { r: 0.6, g: 0.7, b: 0.8 } },
  { id: 'arith-comp', kind: 'arith', level: 'comp', pos: { x: 6, y: 7 }, tint: { r: 1.8, g: 1.7, b: 0.6 } },
];

/** 아래쪽 장식 동상 둘 (막힘, 말을 걸 수 없다 — 별점수가 꺼져 있는 동안) */
export const GYM_STATUES: Pos[] = [
  { x: 2, y: 17 },
  { x: 12, y: 17 },
];
