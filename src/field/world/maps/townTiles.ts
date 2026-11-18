// 태초마을 타일 그림 — 초원·물가·사막 그림을 빌려 와 한 마을로 어울리게 놓는다 (마을 지도 묶음에서만 내려받는다)
import type { FieldMap } from '../../../domain/field/movement';
import { SHARED_ARTS, exitArrow, onBorder, type PixelArt, recolor, type TileSet } from '../../art/pixelArt';
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
// 상점 벽: 창문 하나 + 아랫단, 문: 나무 문
const shopWall = overlay(blank, WALL, (x, y) => {
  if (y === 15) return 'o';
  if (y === 14) return 'W';
  if (y >= 3 && y <= 8 && x >= 4 && x <= 11) return x === 4 || x === 11 || y === 3 || y === 8 || x === 7 || x === 8 ? 'k' : 'b';
  return null;
});
const shopDoor = overlay(blank, WALL, (x, y) => {
  if (y === 15) return 'o';
  if (x >= 4 && x <= 11 && y >= 1) {
    if (x === 4 || x === 11 || y === 1) return 'k';
    if (x === 9 && y === 9) return 'y';
    return y % 5 === 3 || x === 7 || x === 8 ? 'N' : 'n';
  }
  return null;
});
// 훈련 건물: 초록 지붕 · 벽 윗단에 초록 띠 · 청록 문 위에 노란 팻말. 계단 건물: 보랏빛 지붕 · 돌벽 · 계단 문
const TRAIN_PAL = { g: '#3fae5a', G: '#277a3e', t: '#3f8f9a', T: '#2b6670', y: '#ffd23a', s: '#b8b8c4', S: '#7f7f92' };
const trainWall = overlay(blank, { ...WALL, ...TRAIN_PAL }, (x, y) => {
  if (y === 15) return 'o';
  if (y === 14) return 'W';
  if (y <= 1) return y === 0 ? 'G' : 'g';
  if (y >= 4 && y <= 9 && x >= 5 && x <= 10) return x === 5 || x === 10 || y === 4 || y === 9 ? 'k' : 'b';
  return null;
});
const trainDoor = overlay(blank, { ...WALL, ...TRAIN_PAL }, (x, y) => {
  if (y === 15) return 'o';
  if (y <= 1) return y === 0 ? 'G' : 'g';
  if (y >= 2 && y <= 4 && x >= 3 && x <= 12) return y === 2 || y === 4 || x === 3 || x === 12 ? 'k' : 'y'; // 팻말
  if (x >= 4 && x <= 11 && y >= 6) {
    if (x === 4 || x === 11 || y === 6) return 'k';
    if (x === 9 && y === 11) return 'y';
    return y % 5 === 2 || x === 7 || x === 8 ? 'T' : 't';
  }
  return null;
});
const stairsWall = overlay(blank, { ...WALL, ...TRAIN_PAL }, (x, y) => {
  if (y === 15) return 'o';
  return (x + (y >> 2)) % 5 === 0 ? 'S' : 's';
});
// 계단 문: 어두운 입구 안에 올라가는 계단 디딤판
const stairsDoor = overlay(blank, { ...WALL, ...TRAIN_PAL, d: '#2a2336' }, (x, y) => {
  if (y === 15) return 'o';
  if (x < 3 || x > 12) return (x + (y >> 2)) % 5 === 0 ? 'S' : 's';
  if (y >= 3 && y <= 14) {
    const step = Math.floor((14 - y) / 3); // 위로 갈수록 오른쪽으로 물러나는 디딤판
    if (x >= 3 + step && (14 - y) % 3 === 0) return 'y';
    return 'd';
  }
  return 'S';
});
const TRAIN_ROOF = { R: '#3fae5a', Q: '#277a3e' };
const STAIRS_ROOF = { R: '#8a78c8', Q: '#5f4f9a' };
const GOLD = { R: '#f2b632', Q: '#c98a14' };
// 울타리: 풀 바탕에 말뚝과 가로대
const fence = overlay(M.ground, { n: '#c9985a', N: '#8d5a2b' }, (x, y) => {
  if ((x <= 1 || (x >= 7 && x <= 8) || x >= 14) && y >= 4 && y <= 13) return 'N';
  if ((y === 6 || y === 10) && y !== undefined) return 'n';
  return null;
});

const arts = { shopWall, shopDoor, trainWall, trainDoor, stairsWall, stairsDoor, fence, ...M, bankSand, waterA, waterB, bank, desertSand };

const DOOR_ART = { shop: shopDoor, training: trainDoor, stairs: stairsDoor };
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

function building(map: FieldMap, x: number, y: number): PixelArt[] {
  const { left, width } = run(map, x, y);
  const roofRow = isBld(map, x, y + 1);
  // 지붕 줄이면 바로 아랫줄, 벽 줄이면 이 줄에 문이 있는 건물의 종류(상점·훈련·계단)
  const doorRow = roofRow ? y + 1 : y;
  // 훈련 건물은 문 글자 하나가 5칸 폭 건물의 가운데: 이 칸에서 가장 가까운 문(3칸 안)이 이 건물 것
  let kind: 'shop' | 'training' | 'stairs' | null = null;
  let best = 4;
  for (let i = left; i < left + width; i++) {
    const door = TOWN_DOORS[map.raw[doorRow][i]];
    if (!door) continue;
    if (door.kind === 'shop') kind = 'shop';
    else if (kind !== 'shop' && Math.abs(i - x) < best) {
      best = Math.abs(i - x);
      kind = door.kind;
    }
  }
  const right = (x - left) % 2 === 1;
  if (roofRow) {
    if (kind === 'shop') return [recolor(right ? M.roofRedR : M.roofRedL, GOLD)];
    if (kind === 'training') return [recolor(right ? M.roofRedR : M.roofRedL, TRAIN_ROOF)];
    if (kind === 'stairs') return [recolor(right ? M.roofRedR : M.roofRedL, STAIRS_ROOF)];
    return [left > 8 ? (right ? M.roofBlueR : M.roofBlueL) : right ? M.roofRedR : M.roofRedL];
  }
  if (kind === 'shop') return [shopWall];
  if (kind === 'training') return [trainWall];
  if (kind === 'stairs') return [stairsWall];
  return [x === left ? M.wallL : M.wallR];
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
        return [M.dirt, SHARED_ARTS.sign];
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
        return isDoorChar(ch) ? [DOOR_ART[TOWN_DOORS[ch].kind]] : [M.dirt]; // 문 글자 / '.' '@'
    }
  },
};
