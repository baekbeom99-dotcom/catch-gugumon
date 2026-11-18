/**
 * 치비 시트 그림 고르기 순수 함수 — React 없음. 시트 만드는 법은 scripts/cut-chibi.py 설명 참고.
 * 시트 한 장 = 4열(프레임) × 4행(방향). 행 순서: 0 아래(앞모습), 1 위(뒷모습), 2 오른쪽, 3 왼쪽.
 * 칸 크기(cw×ch)는 한 캐릭터의 모든 시트(idle·walk·attack)가 같고, 발은 칸 아래·몸은 가로 가운데.
 */

export type SheetDir = 'down' | 'up' | 'left' | 'right';

/** 한 시트의 열(프레임)·행(방향) 수 */
export const SHEET_COLS = 4;
export const SHEET_ROWS = 4;

/** 방향 → 시트 행 (아래·위·오른쪽·왼쪽) */
export const DIR_ROW: Record<SheetDir, number> = { down: 0, up: 1, right: 2, left: 3 };

/** 전투에서 보는 쪽: 내 구구몬(왼쪽 아래, 뒷모습)·야생(오른쪽 위, 앞모습) */
export type BattleSide = 'ally' | 'foe';

/** 전투 행: 내 구구몬은 뒷모습(위 행 1), 야생은 앞모습(아래 행 0). 가만히·공격 모두 같은 행 */
export const BATTLE_ROW: Record<BattleSide, number> = { ally: DIR_ROW.up, foe: DIR_ROW.down };

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
export function cellOrigin(col: number, row: number, cw: number, ch: number): { sx: number; sy: number } {
  return { sx: col * cw, sy: row * ch };
}

/**
 * 몸 크기 맞춤 기준 (캐릭터마다 몸 크기가 달라도 한 자리에서 몸 높이가 같게 보이게).
 * 자리(정사각형) 한 변 대비 몸 높이 목표, 몸 가로 상한.
 */
export const BODY_H_TARGET = 0.8;
export const BODY_W_MAX = 1.0;

/** 칸 크기·몸 크기(이미지 픽셀, manifest 값) */
export interface CellSize {
  cw: number;
  ch: number;
  bodyH?: number;
  bodyW?: number;
}

/**
 * 정사각형 자리(한 변 1)에 칸 그림을 놓을 크기 (자리 대비 가로 w·세로 h). 칸 아래 = 자리 아래, 가로 가운데.
 * 몸 높이가 BODY_H_TARGET이 되게 키우고, 몸 가로가 BODY_W_MAX를 넘으면 가로 기준으로 줄인다.
 * 몸 크기를 모르면 칸 전체가 자리에 들어가게. 칸 크기도 없으면 정사각형 그림 그대로(1×1).
 */
export function cellBox(c?: Partial<CellSize>): { w: number; h: number } {
  if (!c || !c.cw || !c.ch || c.cw <= 0 || c.ch <= 0) return { w: 1, h: 1 };
  let k = 1 / Math.max(c.cw, c.ch);
  if (c.bodyH && c.bodyH > 0) {
    k = BODY_H_TARGET / c.bodyH;
    if (c.bodyW && c.bodyW > 0) k = Math.min(k, BODY_W_MAX / c.bodyW);
  }
  return { w: Math.round(c.cw * k * 1000) / 1000, h: Math.round(c.ch * k * 1000) / 1000 };
}
