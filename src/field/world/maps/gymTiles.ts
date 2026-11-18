// 체육관 타일 그림 — 분홍 체크 바닥·꾸민 벽·단상·파란 매트·동상.
// 체육관 지도와 같은 묶음이라 체육관에 들어갈 때만 내려받는다. 16×16, 우리 팔레트로 새로 그렸다.
import type { FieldMap } from '../../../domain/field/movement';
import { ART_SIZE, SHARED_ARTS, exitArrow, type PixelArt, type TileSet } from '../../art/pixelArt';

type Painter = (x: number, y: number) => string;

/** 16×16 칸마다 글자를 정해 그림을 만든다 */
function paint(palette: Record<string, string>, fn: Painter): PixelArt {
  return {
    palette,
    rows: Array.from({ length: ART_SIZE }, (_, y) => Array.from({ length: ART_SIZE }, (_, x) => fn(x, y)).join('')),
  };
}

/** 글자 줄을 16칸 가운데에 놓는다 (양옆은 투명) */
function center(s: string): string {
  const left = Math.floor((ART_SIZE - s.length) / 2);
  return '.'.repeat(left) + s + '.'.repeat(ART_SIZE - s.length - left);
}

// ── 바닥: 분홍 체크 (밝은 칸·진한 칸), 윗·왼쪽 모서리는 밝게 아래·오른쪽은 어둡게 ──
const floor = (base: string, light: string, dark: string): PixelArt =>
  paint({ a: base, b: light, c: dark }, (x, y) => (y === 0 || x === 0 ? 'b' : y === 15 || x === 15 ? 'c' : 'a'));
const floorA = floor('#f9d3e0', '#fde8ef', '#ecb4c8');
const floorB = floor('#f1b9cd', '#f7cddb', '#e09ab4');

// ── 벽: 맨 윗줄(천장 띠), 벽면(보라 기둥 띠와 금빛 문양), 옆·아래 벽돌 ──
const wallTop = paint({ a: '#3b2450', b: '#4f3268', c: '#6a4585' }, (_x, y) => (y === 15 ? 'c' : y % 4 === 3 ? 'b' : 'a'));
const wallFace = paint(
  { w: '#f7e8d4', W: '#e6cfae', p: '#7a4f96', P: '#5a3874', g: '#f2b632' },
  (x, y) => {
    if (y === 0) return 'P';
    if (y === 15) return 'P';
    if (y >= 13) return y === 13 ? 'p' : 'P';
    if (x >= 6 && x <= 9 && y >= 1 && y <= 12) {
      if (Math.abs(x - 7.5) + Math.abs(y - 6.5) <= 2) return 'g'; // 걸개 가운데 금빛 마름모
      return x === 6 || x === 9 ? 'P' : 'p';
    }
    return x === 0 || x === 15 ? 'W' : 'w';
  },
);
const wallSide = paint({ a: '#4a3060', b: '#5d3f78', c: '#7a5498' }, (x, y) =>
  y === 0 ? 'c' : y % 4 === 3 || (x + (y >> 2) * 4) % 8 === 0 ? 'b' : 'a',
);

// ── 매트: 입구 (파란 바탕에 흰 줄), 그 위에 출구 화살표를 얹는다 ──
const mat = paint({ b: '#3b66d0', B: '#2a4aa3', l: '#7fa4f0' }, (x, y) =>
  x === 0 || x === 15 || y === 0 || y === 15 ? 'B' : (y === 2 || y === 13) && x >= 2 && x <= 13 ? 'l' : 'b',
);

// ── 단상: 금빛 올림 무대. 이웃한 단상 칸 쪽에는 테두리가 없고, 아래가 트이면 앞면이 보인다 ──
const PLATFORM_PAL = { g: '#efcd5e', h: '#f8e59a', d: '#a06f16', s: '#7c500e', y: '#fff3b0' };
const platformCache = new Map<string, PixelArt>();
export function platformArt(top: boolean, bottom: boolean, left: boolean, right: boolean): PixelArt {
  const k = `${+top}${+bottom}${+left}${+right}`;
  let a = platformCache.get(k);
  if (!a) {
    a = paint(PLATFORM_PAL, (x, y) => {
      if (top && y === 0) return 'd';
      if (left && x === 0) return 'd';
      if (right && x === 15) return 'd';
      if (bottom) {
        if (y === 15) return 'd';
        if (y >= 12) return 's'; // 앞면
      }
      if (x >= 6 && x <= 9 && y >= 5 && y <= 8) return 'y'; // 가운데 반짝임(이웃과 이어지며 별무늬처럼 보인다)
      return ((x >> 2) + (y >> 2)) % 2 === 0 ? 'g' : 'h';
    });
    platformCache.set(k, a);
  }
  return a;
}
const platform = platformArt(true, true, true, true);

// ── 동상: 회색 돌로 깎은 사람 (바닥 위에 얹는 투명 바탕) ──
const statue: PixelArt = {
  palette: { o: '#3a3a48', s: '#b8bcc8', S: '#8a8f9f', h: '#dde0e8' },
  rows: [
    center(''),
    center('oooooo'),
    center('oshhhhso'),
    center('oshhhhso'),
    center('osssssso'),
    center('oooooo'),
    center('o' + 's'.repeat(8) + 'o'),
    center('oshssssSSo'),
    center('oshssssSSo'),
    center('o' + 's'.repeat(8) + 'o'),
    center('o'.repeat(12)),
    center('oh' + 's'.repeat(8) + 'So'),
    center('o' + 's'.repeat(10) + 'o'),
    center('o' + 'S'.repeat(10) + 'o'),
    center('o'.repeat(12)),
    center(''),
  ],
};

const arts = { floorA, floorB, wallTop, wallFace, wallSide, mat, platform, statue };

const isPlatform = (map: FieldMap, x: number, y: number) => map.raw[y]?.[x] === 'P';

export const GYM_TILES: TileSet = {
  arts,
  pick(map, x, y) {
    const ch = map.raw[y][x];
    const ground = (x + y) % 2 === 0 ? floorA : floorB;
    switch (ch) {
      case '#':
        return [y === 0 ? wallTop : y === 1 ? wallFace : wallSide];
      case 'P':
        return [ground, platformArt(!isPlatform(map, x, y - 1), !isPlatform(map, x, y + 1), !isPlatform(map, x - 1, y), !isPlatform(map, x + 1, y))];
      case 'v':
        return [mat, exitArrow(map, x, y)];
      case 'S':
        return [ground, SHARED_ARTS.sign];
      default: {
        // '.' '@': 바닥, 그 위에 동상 (NPC는 칸 그림이 아니라 NPC 레이어가 그린다)
        return map.statues.some((s) => s.x === x && s.y === y) ? [ground, statue] : [ground];
      }
    }
  },
};
