/** 시트 그림(걷기·가만히·맞음·잠) 고르기 순수 함수 — React 없음. 시트 만드는 법은 scripts/cut-sprites.mjs 설명 참고 */

export type SheetDir = 'down' | 'up' | 'left' | 'right';

/**
 * 걷기·가만히 시트의 줄(세로 4줄): 아래(앞)·오른쪽·위(뒤)·왼쪽.
 * 옆모습은 오른 줄과 왼 줄이 따로 있다.
 */
export const DIR_ROW: Record<SheetDir, number> = { down: 0, right: 1, up: 2, left: 3 };

/** 맞음 시트의 줄(세로 2줄): 아래(앞)·위(뒤). 잠 시트는 1줄 */
export const HURT_ROW = { front: 0, back: 1 } as const;

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
