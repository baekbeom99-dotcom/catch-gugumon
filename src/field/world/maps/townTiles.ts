// 태초마을 타일 그림 — 초원·물가·사막 그림을 빌려 와 한 마을로 어울리게 놓는다 (마을 지도 묶음에서만 내려받는다)
import type { FieldDoor, FieldMap } from '../../../domain/field/movement';
import { SHARED_ARTS, exitArrow, onBorder, type PixelArt, type TileSet } from '../../art/pixelArt';
import { MEADOW_TILES } from './meadowTiles';
import { WATERSIDE_TILES } from './watersideTiles';
import { DESERT_TILES } from './desertTiles';
import { TOWN_DOORS } from './town';

const M = MEADOW_TILES.arts;
const { sand: bankSand, waterA, waterB, bank } = WATERSIDE_TILES.arts;
const { sand: desertSand } = DESERT_TILES.arts;

/** 바탕 그림 위에 글자 몇 개를 덮어쓴 그림 */
function overlay(base: PixelArt, palette: Record<string, string>, paint: (x: number, y: number) => string | null): PixelArt {
  return {
    palette: { ...base.palette, ...palette },
    rows: base.rows.map((row, y) => [...row].map((ch, x) => paint(x, y) ?? ch).join('')),
  };
}

const WALL = { w: '#fff4dc', W: '#e8d6b0', o: '#3a2a2a', k: '#5a3a2a', b: '#9fd8ff', n: '#a8703e', N: '#7d5028', y: '#ffd23a' };
const blank: PixelArt = { palette: {}, rows: Array.from({ length: 16 }, () => 'w'.repeat(16)) };
// 체육관: 큰 파란 지붕 · 흰 벽에 파란 띠와 창문 · 가운데 큰 문 위에 금빛 마크 · 문 옆 GYM 간판. 계단 건물: 보랏빛 지붕 · 돌벽 · 계단 문
const GYM_PAL = { ...WALL, c: '#4f7fd6', C: '#2f56a8', t: '#3f6fc4', T: '#274f94', g: '#f2b632', G: '#c98a14' };
const gymWall = overlay(blank, GYM_PAL, (_x, y) => {
  if (y === 15) return 'o';
  if (y === 14) return 'C';
  if (y === 13 || y === 12) return y === 13 ? 'c' : 'W';
  return null;
});
// 창문이 있는 벽 칸
const gymWallWin = overlay(blank, GYM_PAL, (x, y) => {
  if (y === 15) return 'o';
  if (y === 14) return 'C';
  if (y === 13 || y === 12) return y === 13 ? 'c' : 'W';
  if (y >= 3 && y <= 9 && x >= 3 && x <= 12) return x === 3 || x === 12 || y === 3 || y === 9 || x === 7 || x === 8 ? 'k' : 'b';
  return null;
});
// 큰 문: 위에 금빛 둥근 마크, 아래 파란 두 짝 문 (가운데 틈)
const gymDoor = overlay(blank, GYM_PAL, (x, y) => {
  if (y === 15) return 'o';
  const d2 = (x - 7.5) ** 2 + (y - 2.4) ** 2;
  if (y <= 4) return d2 <= 3.6 ? 'g' : d2 <= 7 ? 'G' : null; // 마크
  if (x >= 2 && x <= 13 && y >= 5) {
    if (x === 2 || x === 13 || y === 5) return 'k';
    if (x === 7 || x === 8) return 'o';
    if (x === 6 && y === 10) return 'y';
    if (x === 9 && y === 10) return 'y';
    return y % 5 === 0 ? 'T' : 't';
  }
  return null;
});
/** 체육관 지붕: 3줄(맨 위·가운데·아래 처마) × 가장자리(왼·가운데·오른) × 기와 줄 엇갈림 */
const gymRoofCache = new Map<string, PixelArt>();
function gymRoof(row: 'top' | 'mid' | 'bot', edge: 'L' | 'M' | 'R', alt: 0 | 1): PixelArt {
  const k = `${row}${edge}${alt}`;
  let a = gymRoofCache.get(k);
  if (!a) {
    a = overlay(blank, { o: '#2a2540', R: '#4f7fd6', Q: '#2f56a8', H: '#7fa6ee', y: '#f2b632', w: '#4f7fd6' }, (x, y) => {
      if (edge === 'L' && x === 0) return 'o';
      if (edge === 'R' && x === 15) return 'o';
      if (row === 'top') {
        if (y === 0) return 'o';
        if (y === 1) return 'y'; // 금빛 마루
      }
      if (row === 'bot') {
        if (y === 15) return 'o';
        if (y === 14) return 'y';
        if (y === 13) return 'Q';
      }
      if (y % 4 === 3) return 'Q';
      if ((x + 8 * ((y >> 2) % 2) + 8 * alt) % 16 === 0) return 'Q';
      return y % 4 === 0 ? 'H' : 'R';
    });
    gymRoofCache.set(k, a);
  }
  return a;
}
const gymRoofL = gymRoof('mid', 'L', 0);
const gymRoofR = gymRoof('mid', 'R', 0);
// GYM 간판: 갈색 판에 흰 글자 (표지판 칸 위에 덧그린다). 글자 한 칸 3×5, 사이 1칸
const GYM_LETTERS = {
  G: ['www', 'w..', 'w.w', 'w.w', 'www'],
  Y: ['w.w', 'w.w', '.w.', '.w.', '.w.'],
  M: ['w.w', 'www', 'www', 'w.w', 'w.w'],
};
function gymSignChar(x: number, y: number): string {
  if (y === 2 || y === 9) return x >= 1 && x <= 14 ? 'o' : '.';
  if (y >= 3 && y <= 8) {
    if (x === 1 || x === 14) return 'o';
    if (x < 1 || x > 14) return '.';
    if (y === 8) return 'N'; // 판 아랫단 그늘
    const slot = Math.floor((x - 2) / 4);
    const col = (x - 2) % 4;
    if (slot <= 2 && col < 3) return GYM_LETTERS[(['G', 'Y', 'M'] as const)[slot]][y - 3][col] === 'w' ? 'w' : 'n';
    return 'n';
  }
  if (y >= 10 && y <= 13) return x >= 6 && x <= 9 ? (x === 6 || x === 9 ? 'o' : 'N') : '.'; // 기둥
  return '.';
}
const gymSign: PixelArt = {
  palette: { o: '#3a2614', n: '#a8703e', N: '#7d5028', w: '#fff4dc' },
  rows: Array.from({ length: 16 }, (_, y) => Array.from({ length: 16 }, (_, x) => gymSignChar(x, y)).join('')),
};
/**
 * 집 한 채(상점·무한의 계단) 그림 묶음 — 지붕 색과 지붕 위 마크만 다르고 나머지는 같다.
 * 지붕: 기와 줄무늬 + 짙은 처마, 문 위 칸에 마크 · 벽: 크림색, 지붕 밑 색 띠(글자 없음), 작은 창문, 아랫단은 회색 ·
 * 문: 파란 문 + 밝은 디딤돌. 칸은 16×16, 건물은 2줄(지붕 줄 + 벽 줄)이다.
 */
interface RoofPalette {
  R: string; // 기와 바탕
  H: string; // 기와 줄(밝은 선)
  Q: string; // 그늘·띠 아랫단
  E: string; // 짙은 처마·마크 테두리
}
const RED_ROOF: RoofPalette = { R: '#e5483a', H: '#f2776a', Q: '#b8302a', E: '#7e1f1c' };
const YELLOW_ROOF: RoofPalette = { R: '#f4c33a', H: '#ffdf7a', Q: '#d19a14', E: '#8a6410' };
const HOUSE_PAL = { w: '#fdf6e6', W: '#e6dcc4', a: '#b4bac5', A: '#8a909c', b: '#9fd8ff', B: '#e6f6ff', t: '#2fa6bf', T: '#1b7189', s: '#f4efe0', y: '#ffd23a', m: '#e4e4ee' };
type Edge = 'L' | 'M' | 'R';

const BALL = { r2: 22, ring: 14 }; // 몬스터볼: 반지름², 안쪽 흰색 경계
const STAR_ROWS = ['....#....', '...###...', '#########', '.#######.', '..#####..', '..#####..', '.###.###.', '.##...##.', '.#.....#.'];
/** 지붕 칸 안 마크: 'E' 테두리, 'w' 흰 바탕, 'm' 아래 반쪽 */
function emblemChar(kind: 'ball' | 'star', x: number, y: number): string | null {
  if (kind === 'ball') {
    const dx = x - 7.5;
    const dy = y - 7;
    const d2 = dx * dx + dy * dy;
    if (d2 > BALL.r2) return null;
    if (d2 > BALL.ring) return 'E';
    if (Math.abs(dy) < 0.6) return 'E'; // 가운데 띠
    if (d2 <= 2.2) return Math.abs(dy) < 1.5 && d2 > 0.6 ? 'E' : 'w'; // 가운데 단추
    return dy < 0 ? 'w' : 'm';
  }
  const sx = x - 3;
  const sy = y - 3;
  const on = (ix: number, iy: number) => STAR_ROWS[iy]?.[ix] === '#';
  if (on(sx, sy)) return 'w';
  for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (on(sx + ox, sy + oy)) return 'E';
  return null;
}

function buildHouseTiles(roof: RoofPalette, emblem: 'ball' | 'star') {
  const pal = { ...HOUSE_PAL, ...roof };
  const make = (paint: (x: number, y: number) => string): PixelArt => ({
    palette: pal,
    rows: Array.from({ length: 16 }, (_, y) => Array.from({ length: 16 }, (_, x) => paint(x, y)).join('')),
  });
  const side = (edge: Edge, x: number, c: string) => ((edge === 'L' && x === 0) || (edge === 'R' && x === 15) ? c : null);
  const roofTile = (edge: Edge, mark: boolean): PixelArt =>
    make((x, y) => {
      const e = side(edge, x, 'E');
      if (e) return e;
      if (y === 0 || y === 15) return 'E'; // 짙은 마루·처마
      if (y === 14) return 'Q';
      if (mark) {
        const m = emblemChar(emblem, x, y);
        if (m) return m;
      }
      if (y % 4 === 0) return 'H'; // 기와 가로 줄
      if (x === ((y >> 2) % 2 ? 11 : 3)) return 'H'; // 엇갈린 세로 줄
      return 'R';
    });
  const band = (y: number) => (y === 0 || y === 3 ? 'Q' : y <= 2 ? 'R' : null); // 지붕 밑 색 띠
  const base = (y: number) => (y === 15 ? 'A' : y >= 13 ? 'a' : null); // 얇은 회색 아랫단
  const wallTile = (edge: Edge, win: boolean): PixelArt =>
    make((x, y) => {
      const b = band(y) ?? base(y);
      if (b) return b;
      const e = side(edge, x, 'W');
      if (e) return e;
      if (win && x >= 4 && x <= 11 && y >= 6 && y <= 11) {
        if (x === 4 || x === 11 || y === 6 || y === 11) return 'A';
        return x === 5 && y <= 8 ? 'B' : 'b';
      }
      return y === 12 ? 'W' : 'w';
    });
  const doorTile = (): PixelArt =>
    make((x, y) => {
      const b = band(y);
      if (b) return b;
      if (y === 15) return 'A';
      if (y >= 13) return x >= 1 && x <= 14 ? (y === 14 ? 'W' : 's') : 'a'; // 밝은 디딤돌
      if (x >= 3 && x <= 12 && y >= 5) {
        if (x === 3 || x === 12 || y === 5) return 'T';
        if (x === 7 || x === 8) return 'T';
        if ((x === 6 || x === 9) && y === 9) return 'y';
        return 't';
      }
      return y === 12 ? 'W' : 'w';
    });
  return { roof: roofTile, wall: wallTile, door: doorTile() };
}
const HOUSES = { shop: buildHouseTiles(RED_ROOF, 'ball'), stairs: buildHouseTiles(YELLOW_ROOF, 'star') };
const houseArts = (name: 'shop' | 'stairs'): Record<string, PixelArt> => {
  const h = HOUSES[name];
  return {
    [`${name}Wall`]: h.wall('M', false),
    [`${name}WallWin`]: h.wall('M', true),
    [`${name}Door`]: h.door,
    [`${name}Roof`]: h.roof('M', false),
    [`${name}RoofMark`]: h.roof('M', true),
    [`${name}RoofL`]: h.roof('L', false),
    [`${name}RoofR`]: h.roof('R', false),
  };
};
// 울타리: 풀 바탕에 말뚝과 가로대
const fence = overlay(M.ground, { n: '#c9985a', N: '#8d5a2b' }, (x, y) => {
  if ((x <= 1 || (x >= 7 && x <= 8) || x >= 14) && y >= 4 && y <= 13) return 'N';
  if ((y === 6 || y === 10) && y !== undefined) return 'n';
  return null;
});

const arts = { ...houseArts('shop'), ...houseArts('stairs'), gymWall, gymWallWin, gymDoor, gymSign, gymRoofL, gymRoofR, fence, ...M, bankSand, waterA, waterB, bank, desertSand };

const DOOR_ART = { shop: HOUSES.shop.door, gym: gymDoor, stairs: HOUSES.stairs.door };
const isHash = (map: FieldMap, x: number, y: number) => map.raw[y]?.[x] === '#' && !onBorder(map, x, y);
const isWaterRaw = (map: FieldMap, x: number, y: number) => map.raw[y]?.[x] === '~';

const isDoorChar = (ch: string | undefined) => ch !== undefined && ch in TOWN_DOORS;
const isBld = (map: FieldMap, x: number, y: number) => isHash(map, x, y) || isDoorChar(map.raw[y]?.[x]);

/** 같은 줄에서 이어진 건물(`#`·문) 덩어리의 왼쪽 끝과 너비 */
function run(map: FieldMap, x: number, y: number): { left: number; width: number } {
  let left = x;
  while (isBld(map, left - 1, y)) left--;
  let right = x;
  while (isBld(map, right + 1, y)) right++;
  return { left, width: right - left + 1 };
}

/** 체육관 벽 줄에서 창문이 있는 칸(건물 왼쪽 끝에서 센 번호): 문(5번) 양옆 두 칸씩 */
const GYM_WINDOWS = [1, 3, 7, 9];

function building(map: FieldMap, x: number, y: number): PixelArt[] {
  const { left, width } = run(map, x, y);
  const roofRow = isBld(map, x, y + 1);
  // 이 칸에서 아래로 이어진 건물 줄의 맨 아래가 문이 있는 벽 줄 (지붕은 그 위로 한 줄 이상)
  let doorRow = y;
  while (isBld(map, x, doorRow + 1)) doorRow++;
  // 한 건물 덩어리에는 문이 하나: 그 문 종류가 건물 종류 (문 없는 집은 null)
  let kind: FieldDoor['kind'] | null = null;
  let doorX = -1;
  for (let i = left; i < left + width; i++) {
    const door = TOWN_DOORS[map.raw[doorRow][i]];
    if (door) {
      kind = door.kind;
      doorX = i;
    }
  }
  const right = (x - left) % 2 === 1;
  if (kind === 'gym') {
    const edge = x === left ? 'L' : x === left + width - 1 ? 'R' : 'M';
    if (roofRow) return [gymRoof(!isBld(map, x, y - 1) ? 'top' : y === doorRow - 1 ? 'bot' : 'mid', edge, (x - left) % 2 === 1 ? 1 : 0)];
    return [GYM_WINDOWS.includes(x - left) ? gymWallWin : gymWall]; // 문 양옆에 창문 둘씩
  }
  if (kind === 'shop' || kind === 'stairs') {
    const house = HOUSES[kind];
    const edge = x === left ? 'L' : x === left + width - 1 ? 'R' : 'M';
    if (roofRow) return [house.roof(edge, x === doorX && y === doorRow - 1)]; // 문 바로 위 지붕에 마크
    return [house.wall(edge, (x - left) % 2 === 0)]; // 문이 아닌 짝수 번째 칸에 창문
  }
  if (roofRow) return [left > 8 ? (right ? M.roofBlueR : M.roofBlueL) : right ? M.roofRedR : M.roofRedL];
  return [x === left ? M.wallL : M.wallR];
}

/** 체육관 문 앞의 넓은 모래길: 문 양옆 3칸, 문 앞 두 줄 */
const FRONT_HALF_W = 3;
const FRONT_ROWS = 2;
function frontGround(map: FieldMap, x: number, y: number): PixelArt {
  const gym = map.doors.find((d) => d.kind === 'gym');
  const sandy = !!gym && Math.abs(x - gym.pos.x) <= FRONT_HALF_W && y > gym.pos.y && y <= gym.pos.y + FRONT_ROWS;
  return sandy ? desertSand : M.dirt;
}

/** 체육관 문 바로 앞 줄에서 문 옆(5칸 안, 길 가장자리 밖)에 세운 간판 칸인가 */
const SIGN_NEAR = 5;
function nearGymDoor(map: FieldMap, x: number, y: number): boolean {
  return map.doors.some((d) => d.kind === 'gym' && d.pos.y + 1 === y && Math.abs(d.pos.x - x) <= SIGN_NEAR);
}

export const TOWN_TILES: TileSet = {
  arts,
  pick(map, x, y, frame) {
    const ch = map.raw[y][x];
    switch (ch) {
      case '~':
        return [frame === 0 ? waterA : waterB];
      case 'p':
        return isWaterRaw(map, x, y - 1) ? [bankSand, bank] : [bankSand];
      case 'a':
        return [desertSand];
      case 'g':
        return [M.ground];
      case '*':
        return [M.flowers];
      case 'S':
        return nearGymDoor(map, x, y) ? [frontGround(map, x, y), gymSign] : [M.dirt, SHARED_ARTS.sign];
      case '<':
      case '>':
      case '^':
      case 'v':
        return [M.dirt, exitArrow(map, x, y)];
      case '#': {
        if (onBorder(map, x, y)) return [M.tree];
        if (isBld(map, x, y - 1) || isBld(map, x, y + 1)) return building(map, x, y);
        // 위아래가 비었는데 옆으로 이어진 한 줄은 울타리, 홀로 선 것은 나무
        return isHash(map, x - 1, y) || isHash(map, x + 1, y) ? [fence] : [M.tree];
      }
      default:
        if (isDoorChar(ch)) return [DOOR_ART[TOWN_DOORS[ch].kind]];
        return [frontGround(map, x, y)]; // '.' '@'
    }
  },
};
