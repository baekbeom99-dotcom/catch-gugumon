/** 시트 그림(걷기·가만히·맞음·잠) 고르기 순수 함수 — React 없음. 시트 만드는 법은 scripts/cut-sprites.mjs 설명 참고 */

export type SheetDir = 'down' | 'up' | 'left' | 'right';

/**
 * 걷기·가만히 시트의 줄(세로 4줄): 아래(앞)·오른쪽·위(뒤)·왼쪽.
 * 옆모습은 오른 줄과 왼 줄이 따로 있다.
 */
export const DIR_ROW: Record<SheetDir, number> = { down: 0, right: 1, up: 2, left: 3 };

/** 전투에서 보는 쪽: 내 구구몬(왼쪽 아래, 오른쪽 위를 봄)·야생(오른쪽 위, 왼쪽 아래를 봄) */
export type BattleSide = 'ally' | 'foe';

/**
 * 원본(SpriteCollab) 시트의 방향 줄: 0 아래, 1 아래오른, 2 오른, 3 위오른, 4 위, 5 위왼, 6 왼, 7 아래왼.
 * 내 구구몬은 위오른(3), 야생은 아래왼(7) 줄을 쓴다.
 * scripts/cut-sprites.mjs 의 ANIMS·attack 줄 목록과 같아야 한다 (테스트가 확인).
 */
export const SOURCE_ROWS = { idle: [0, 2, 4, 6, 3, 7], walk: [0, 2, 4, 6], hurt: [3, 7], attack: [3, 7] } as const;

/** 우리 시트 안의 줄 번호 (SOURCE_ROWS 의 자리). 걷기는 DIR_ROW, 잠은 1줄(0) */
export const BATTLE_ROW = {
  idle: { ally: 4, foe: 5 },
  hurt: { ally: 0, foe: 1 },
  attack: { ally: 0, foe: 1 },
} as const satisfies Record<string, Record<BattleSide, number>>;

/** 공격 시트 한 번 재생: 지난 시간(ms)으로 프레임 번호, 다 끝났으면 null (→ 가만히로 돌아감). 되풀이 안 함 */
export function onceFrameAt(frameMs: number[], elapsedMs: number): number | null {
  if (elapsedMs < 0) return 0;
  let t = elapsedMs;
  for (let i = 0; i < frameMs.length; i++) {
    if (t < frameMs[i]) return i;
    t -= frameMs[i];
  }
  return null;
}

/** 한 번 재생에 걸리는 시간(ms) */
export function totalMs(frameMs: number[]): number {
  return frameMs.reduce((a, b) => a + b, 0);
}

/**
 * Attack 칸(attackSide)을 Idle 칸 위에 겹칠 때의 놓을 자리.
 * 1원본픽셀 = k화면픽셀 (k = 자리 크기 px / 정지 그림 크기). 기준점(Idle 칸의 ix,iy = Attack 칸의 ax,ay)이 같은 곳에 놓인다.
 * idleCell: Idle 칸 화면 크기(px). 자리 크기 px 안에서 Idle 칸은 가운데·아래 맞춤.
 */
export function attackPlacement(p: { px: number; idleCell: number; side: number; k: number; ax: number; ay: number; ix: number; iy: number }) {
  const idleLeft = (p.px - p.idleCell) / 2;
  const idleTop = p.px - p.idleCell;
  return { size: p.side * p.k, left: Math.round(idleLeft + (p.ix - p.ax) * p.k), top: Math.round(idleTop + (p.iy - p.ay) * p.k) };
}

export function rowForDir(dir: SheetDir): number {
  return DIR_ROW[dir];
}

/** 프레임별 ms 목록과 지난 시간(ms)으로 지금 보일 프레임 번호 (끝나면 처음부터 되풀이) */
export function frameAt(frameMs: number[], elapsedMs: number): number {
  if (frameMs.length <= 1) return 0;
  const total = frameMs.reduce((a, b) => a + b, 0);
  if (total <= 0) return 0;
  let t = ((elapsedMs % total) + total) % total;
  for (let i = 0; i < frameMs.length; i++) {
    if (t < frameMs[i]) return i;
    t -= frameMs[i];
  }
  return frameMs.length - 1;
}

/** 이동 변화량(칸 좌표) → 방향. 가로·세로 중 큰 쪽(같으면 세로). 안 움직였으면 null */
export function dirFromDelta(dx: number, dy: number): SheetDir | null {
  if (dx === 0 && dy === 0) return null;
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? 'right' : 'left';
  return dy > 0 ? 'down' : 'up';
}

/** 시트 한 칸의 자리(칸 번호 → 시트 안 픽셀) */
export function cellOrigin(col: number, row: number, side: number): { sx: number; sy: number } {
  return { sx: col * side, sy: row * side };
}

/**
 * 몸 크기 맞춤 기준 (종마다 몸 크기가 달라도 한 칸에서 몸 높이가 비슷하게 보이게).
 * 자리(정사각형) 높이 대비 몸 높이 목표, 몸 가로 상한, 배율 상한.
 */
export const BODY_H_TARGET = 0.8;
export const BODY_W_MAX = 1.0;
export const FILL_MAX = 1.5;

/**
 * 몸 높이를 BODY_H_TARGET으로 맞추는 배율. 정지 그림(baseSide)은 몸의 긴 쪽이 자리를 거의 채우므로
 * 배율 = BODY_H_TARGET × baseSide / bodyH. 가로(bodyW)가 BODY_W_MAX를 넘으면 가로 기준으로 줄이고, FILL_MAX를 넘지 않는다.
 * 값이 없으면 1.
 */
export function bodyFill(m: { baseSide?: number; bodyH?: number; bodyW?: number }): number {
  const { baseSide, bodyH, bodyW } = m;
  if (!baseSide || !bodyH || baseSide <= 0 || bodyH <= 0) return 1;
  let f = (BODY_H_TARGET * baseSide) / bodyH;
  if (bodyW && bodyW > 0) f = Math.min(f, (BODY_W_MAX * baseSide) / bodyW);
  return Math.round(Math.min(f, FILL_MAX) * 1000) / 1000;
}
