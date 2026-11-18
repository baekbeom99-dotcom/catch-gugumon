/**
 * 체육관 NPC 색 입히기 — 순수 함수(캔버스 없음). 한 장의 NPC 그림(013 치비)에 NPC마다 다른 옷색을 곱하고,
 * 마스터한 트레이너는 머리를 노랑으로 바꾼다.
 *
 * 머리 마스크: 013 그림을 실제로 살펴 정했다. 머리카락은 주황(색상 약 20~30°, 채도 0.55~0.7, 밝기 0.55~1.0, 그림자 쪽은 밝기가 낮다).
 * 같은 계열인 피부는 채도가 0.3 아래, 윤곽선·신발은 밝기가 0.4 아래, 초록 옷은 색상 90° 이상이라 이 범위에 안 들어온다.
 */

export type Tint = { r: number; g: number; b: number };
export type Rgba = [number, number, number, number];

/** 머리 화소로 보는 범위: 색상(도)·최소 채도·최소 밝기 */
export const HAIR_HUE_MIN = 8;
export const HAIR_HUE_MAX = 45;
export const HAIR_SAT_MIN = 0.5;
export const HAIR_VAL_MIN = 0.55;
/** 피부(얼굴·손) 범위: 머리와 같은 주황 계열 색상이지만 채도가 낮다(013 그림에서 약 0.2~0.45). 몸 색 곱셈에서 빼서 얼굴이 회색·노랑으로 안 변한다 */
export const SKIN_HUE_MIN = 8;
export const SKIN_HUE_MAX = 45;
export const SKIN_SAT_MIN = 0.08;
export const SKIN_SAT_MAX = 0.5;
export const SKIN_VAL_MIN = 0.6;
/** 마스터했을 때 머리 색상(노랑) */
export const MASTER_HAIR_HUE = 55;

const clamp255 = (n: number) => Math.max(0, Math.min(255, Math.round(n)));

/** RGB(0~255) → [색상 0~360, 채도 0~1, 밝기 0~1] */
export function rgbToHsv(r: number, g: number, b: number): [number, number, number] {
  const R = r / 255;
  const G = g / 255;
  const B = b / 255;
  const max = Math.max(R, G, B);
  const min = Math.min(R, G, B);
  const d = max - min;
  let h = 0;
  if (d > 0) {
    if (max === R) h = ((G - B) / d) % 6;
    else if (max === G) h = (B - R) / d + 2;
    else h = (R - G) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return [h, max === 0 ? 0 : d / max, max];
}

/** [색상 0~360, 채도, 밝기] → RGB(0~255) */
export function hsvToRgb(h: number, s: number, v: number): [number, number, number] {
  const c = v * s;
  const hp = (((h % 360) + 360) % 360) / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let r = 0;
  let g = 0;
  let b = 0;
  if (hp < 1) [r, g, b] = [c, x, 0];
  else if (hp < 2) [r, g, b] = [x, c, 0];
  else if (hp < 3) [r, g, b] = [0, c, x];
  else if (hp < 4) [r, g, b] = [0, x, c];
  else if (hp < 5) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const m = v - c;
  return [clamp255((r + m) * 255), clamp255((g + m) * 255), clamp255((b + m) * 255)];
}

/** 이 색이 머리카락인가 */
export function isHair(r: number, g: number, b: number): boolean {
  const [h, s, v] = rgbToHsv(r, g, b);
  return h >= HAIR_HUE_MIN && h <= HAIR_HUE_MAX && s >= HAIR_SAT_MIN && v >= HAIR_VAL_MIN;
}

/** 이 색이 피부인가 (어두운 윤곽선은 밝기가 낮아 아니다) */
export function isSkin(r: number, g: number, b: number): boolean {
  const [h, s, v] = rgbToHsv(r, g, b);
  return h >= SKIN_HUE_MIN && h <= SKIN_HUE_MAX && s >= SKIN_SAT_MIN && s < SKIN_SAT_MAX && v >= SKIN_VAL_MIN;
}

/** 화소 하나: 투명이면 그대로, 머리면 (마스터일 때만 노랑), 피부는 그대로, 나머지(옷·바지·윤곽)는 색 곱셈 */
export function tintPixel(rgba: Rgba, tint: Tint, mastered: boolean): Rgba {
  const [r, g, b, a] = rgba;
  if (a === 0) return [r, g, b, a];
  if (isHair(r, g, b)) {
    if (!mastered) return [r, g, b, a];
    const [, s, v] = rgbToHsv(r, g, b);
    const [nr, ng, nb] = hsvToRgb(MASTER_HAIR_HUE, s, v);
    return [nr, ng, nb, a];
  }
  if (isSkin(r, g, b)) return [r, g, b, a];
  return [clamp255(r * tint.r), clamp255(g * tint.g), clamp255(b * tint.b), a];
}

/** 이미지 화소 배열(RGBA)을 제자리에서 바꾼다 */
export function tintImageData(data: Uint8ClampedArray, tint: Tint, mastered: boolean): void {
  for (let i = 0; i + 3 < data.length; i += 4) {
    if (data[i + 3] === 0) continue;
    const [r, g, b, a] = tintPixel([data[i], data[i + 1], data[i + 2], data[i + 3]], tint, mastered);
    data[i] = r;
    data[i + 1] = g;
    data[i + 2] = b;
    data[i + 3] = a;
  }
}
