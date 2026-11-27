import { describe, expect, it } from 'vitest';
import { getCostume, COSTUME_SETS } from '../../src/domain/field/costumes';
import { HERO_HAIR, HERO_PANTS, HERO_SHIRT, tintHeroPixel, tintHeroImageData } from '../../src/field/art/heroTint';
import { rgbToHsv, type Rgba } from '../../src/field/art/npcTint';

// 017 그림에서 읽은 대표 화소 (heroTint.ts 주석 표)
const HAIR: Rgba = [90, 60, 36, 255];
const SHIRT: Rgba = [30, 174, 192, 255];
const PANTS: Rgba = [90, 132, 168, 255];
const KEEP: Record<string, Rgba> = {
  팔·얼굴둘레_살색: [186, 133, 102, 255],
  얼굴_크림: [252, 235, 215, 255],
  윤곽선: [0, 0, 0, 255],
  윤곽_회색: [51, 51, 51, 255],
  곡괭이_밝은_청록: [114, 210, 198, 255],
  곡괭이_어두운_청록: [42, 114, 108, 255],
  곡괭이_자루: [84, 60, 36, 255],
  신발_회색: [110, 110, 110, 255],
  투명: [10, 20, 30, 0],
};

const hueOf = (p: Rgba) => rgbToHsv(p[0], p[1], p[2])[0];
const hueDiff = (a: number, b: number) => Math.min(Math.abs(a - b), 360 - Math.abs(a - b));

describe('tintHeroPixel', () => {
  it('범위 상수가 대표 화소를 품는다', () => {
    const inR = (p: Rgba, r: typeof HERO_HAIR) => {
      const [h, s, v] = rgbToHsv(p[0], p[1], p[2]);
      return h >= r.hueMin && h <= r.hueMax && s >= r.satMin && v >= r.valMin && (r.valMax === undefined || v <= r.valMax);
    };
    expect(inR(HAIR, HERO_HAIR)).toBe(true);
    expect(inR(SHIRT, HERO_SHIRT)).toBe(true);
    expect(inR(PANTS, HERO_PANTS)).toBe(true);
  });

  it('머리·윗옷·바지는 세트 색상에 가깝게 (±8도)', () => {
    const kr = getCostume('flag-kr'); // 머리 0° 검정, 윗옷 355° 빨강, 바지 225° 파랑
    expect(hueDiff(hueOf(tintHeroPixel(SHIRT, kr)), kr.shirt.hue)).toBeLessThanOrEqual(8);
    expect(hueDiff(hueOf(tintHeroPixel(PANTS, kr)), kr.pants.hue)).toBeLessThanOrEqual(8);
    const green = getCostume('concept-green-ninja');
    expect(hueDiff(hueOf(tintHeroPixel(HAIR, green)), green.hair.hue)).toBeLessThanOrEqual(8);
    expect(tintHeroPixel(SHIRT, kr)[3]).toBe(255);
  });

  it('피부·윤곽선·신발·곡괭이·투명은 어느 세트에서도 바이트 그대로', () => {
    for (const set of COSTUME_SETS) {
      for (const [name, px] of Object.entries(KEEP)) {
        expect(tintHeroPixel(px, set), `${set.id} ${name}`).toEqual(px);
      }
    }
  });

  it('basic은 모든 화소를 그대로 둔다', () => {
    const basic = getCostume('basic');
    for (const px of [HAIR, SHIRT, PANTS, ...Object.values(KEEP)]) expect(tintHeroPixel(px, basic)).toEqual(px);
    const data = new Uint8ClampedArray([...HAIR, ...SHIRT, ...PANTS]);
    const copy = new Uint8ClampedArray(data);
    tintHeroImageData(data, basic);
    expect(data).toEqual(copy);
  });

  it('곱하기라서 같은 부분의 밝고 어두움이 남는다', () => {
    const kr = getCostume('flag-kr');
    const dark = tintHeroPixel([20, 120, 134, 255], kr); // 윗옷 그림자
    const light = tintHeroPixel([30, 174, 192, 255], kr);
    expect(Math.max(...dark.slice(0, 3))).toBeLessThan(Math.max(...light.slice(0, 3)));
  });
});
