/**
 * 주인공(017 치비) 꾸미기 색 입히기 — 순수 함수(캔버스 없음).
 * 머리·윗옷·바지 화소만 세트 색으로 바꾸고, 피부·윤곽선·신발·곡괭이·투명 화소는 바이트 그대로 둔다.
 * 색은 "색상은 세트 것, 채도·밝기는 원래 화소 × 곱"으로 바꿔서 그림자·결이 남는다 (npcTint의 머리 바꾸기와 같은 방식).
 *
 * 범위는 017-{front,back,idle,walk,attack}.png 다섯 장의 화소를 실제로 읽어 정했다 (HSV: 색상 도, 채도·밝기 0~1):
 *
 *   부분          대표 색(RGB)        색상    채도       밝기        범위로 가르는 법
 *   머리(짙은 갈색) (90,60,36)         20~27   0.55~0.60  0.35~0.37  색상 15~28, 채도 ≥0.5, 밝기 0.28~0.40
 *   머리 옆 살색(얼굴 둘레·팔) (186,133,102) 22~23 0.45   0.72~0.73  밝기가 0.40을 넘어 머리가 아니다 (건드리지 않음)
 *   얼굴 크림      (252,235,215)       32      0.15       0.99        채도 낮음 → 아무 범위도 아님
 *   볼 분홍        (230,170,170)쯤     0 근처  ~0.25      0.9         색상 밖
 *   윗옷(청록-하늘) (30,174,192)        183~190 0.81~0.85  0.75~0.78   색상 183~200, 채도 ≥0.7, 밝기 ≥0.45
 *   바지(파랑)     (90,132,168)        208~212 0.43~0.46  0.64~0.66   색상 198~222, 채도 0.25~0.65, 밝기 0.4~0.85
 *   곡괭이 날(청록) (114,210,198) 밝은 쪽  170~176 0.43~0.63  0.31~0.82   색상이 170~176 → 윗옷(183~)보다 낮아 색상으로 가른다
 *   곡괭이 자루    (84,60,36)         30      0.5~0.57   0.33~0.47   머리 색상 15~28보다 높아(30) 색상으로 가른다
 *   윤곽선·신발    (0,0,0) (51,51,51)(110,110,110)쯤 — 채도 0 또는 밝기 낮음 → 어느 범위도 아님
 *
 * 윗옷·곡괭이는 색상이 3~5도 떨어져 있어(곡괭이 ≤176, 윗옷 ≥183) 공간 마스크 없이 색상 하나로 갈린다.
 * 곡괭이 자루와 머리는 색이 비슷해 가장자리에 자루 화소가 머리로 오인될 수 있으나, 시트 전체에서 몇 점뿐이다.
 */
import type { CostumeSet, HsvTarget } from '../../domain/field/costumes';
import { hsvToRgb, rgbToHsv, type Rgba } from './npcTint';

/** 한 부분의 화소 범위: 색상(도) 안, 채도 ≥ satMin(≤ satMax), 밝기 valMin~valMax */
export interface HeroRange {
  hueMin: number;
  hueMax: number;
  satMin: number;
  satMax?: number;
  valMin: number;
  valMax?: number;
}

export const HERO_HAIR: HeroRange = { hueMin: 15, hueMax: 28, satMin: 0.5, valMin: 0.28, valMax: 0.4 };
export const HERO_SHIRT: HeroRange = { hueMin: 183, hueMax: 200, satMin: 0.7, valMin: 0.45 };
export const HERO_PANTS: HeroRange = { hueMin: 198, hueMax: 222, satMin: 0.25, satMax: 0.65, valMin: 0.4, valMax: 0.85 };

function inRange(h: number, s: number, v: number, r: HeroRange): boolean {
  return h >= r.hueMin && h <= r.hueMax && s >= r.satMin && (r.satMax === undefined || s <= r.satMax) && v >= r.valMin && (r.valMax === undefined || v <= r.valMax);
}

/** 원래 화소의 채도·밝기에 곱해서 세트 색상으로 */
function recolor(r: number, g: number, b: number, a: number, target: HsvTarget): Rgba {
  const [, s, v] = rgbToHsv(r, g, b);
  const [nr, ng, nb] = hsvToRgb(target.hue, Math.min(1, s * (target.sat ?? 1)), Math.min(1, v * (target.val ?? 1)));
  return [nr, ng, nb, a];
}

/** 화소 하나: basic·투명·범위 밖은 그대로(같은 값), 머리·윗옷·바지는 세트 색으로 */
export function tintHeroPixel(px: Rgba, set: CostumeSet): Rgba {
  const [r, g, b, a] = px;
  if (a === 0 || set.group === 'basic') return [r, g, b, a];
  const [h, s, v] = rgbToHsv(r, g, b);
  if (inRange(h, s, v, HERO_HAIR)) return recolor(r, g, b, a, set.hair);
  if (inRange(h, s, v, HERO_SHIRT)) return recolor(r, g, b, a, set.shirt);
  if (inRange(h, s, v, HERO_PANTS)) return recolor(r, g, b, a, set.pants);
  return [r, g, b, a];
}

const LITTLE_ENDIAN = new Uint8Array(new Uint32Array([1]).buffer)[0] === 1;

/** 느린 길(화소마다 tintHeroPixel): 정렬이 안 맞거나 big-endian일 때만 */
function tintSlow(data: Uint8ClampedArray, set: CostumeSet): void {
  for (let i = 0; i + 3 < data.length; i += 4) {
    if (data[i + 3] === 0) continue;
    const [r, g, b, a] = tintHeroPixel([data[i], data[i + 1], data[i + 2], data[i + 3]], set);
    data[i] = r;
    data[i + 1] = g;
    data[i + 2] = b;
    data[i + 3] = a;
  }
}

/**
 * 이미지 화소 배열(RGBA)을 제자리에서 바꾼다.
 * 빠른 길: 화소를 32비트 하나로 읽고, 서로 다른 색마다 한 번만 tintHeroPixel로 계산해 (색 → 결과) 표에 기억한다.
 * 그림에는 같은 색이 아주 많아서(017 시트 한 장에 몇만 가지) 화소마다 배열을 만들지 않고도 결과가 tintHeroPixel과 똑같다.
 */
export function tintHeroImageData(data: Uint8ClampedArray, set: CostumeSet): void {
  if (set.group === 'basic') return;
  if (!LITTLE_ENDIAN || data.byteOffset % 4 !== 0 || data.length % 4 !== 0) {
    tintSlow(data, set);
    return;
  }
  const px = new Uint32Array(data.buffer, data.byteOffset, data.length / 4);
  const memo = new Map<number, number>();
  for (let i = 0; i < px.length; i++) {
    const v = px[i];
    const a = v >>> 24;
    if (a === 0) continue;
    // 채도가 0.25보다 낮은 화소(윤곽선·회색 신발·크림 얼굴)는 어느 범위에도 안 든다 (세 범위의 채도 하한 중 가장 낮은 값 HERO_PANTS.satMin = 0.25)
    const r0 = v & 0xff;
    const g0 = (v >>> 8) & 0xff;
    const b0 = (v >>> 16) & 0xff;
    const mx = r0 > g0 ? (r0 > b0 ? r0 : b0) : g0 > b0 ? g0 : b0;
    const mn = r0 < g0 ? (r0 < b0 ? r0 : b0) : g0 < b0 ? g0 : b0;
    if ((mx - mn) * 4 < mx) continue;
    const key = v & 0xffffff; // 결과 색은 알파와 무관하다
    let out = memo.get(key);
    if (out === undefined) {
      const [r, g, b] = tintHeroPixel([v & 0xff, (v >>> 8) & 0xff, (v >>> 16) & 0xff, a], set);
      out = (r | (g << 8) | (b << 16)) >>> 0;
      memo.set(key, out);
    }
    px[i] = ((a << 24) | out) >>> 0;
  }
}

/** 화소 하나를 tintHeroPixel로만 바꾸는 느린 기준 구현 (테스트가 빠른 길과 견준다) */
export const tintHeroImageDataSlow = tintSlow;
