import { describe, expect, it } from 'vitest';
import { hsvToRgb, isHair, isSkin, rgbToHsv, tintImageData, tintPixel, type Rgba } from '../../src/field/art/npcTint';

const ONE = { r: 1, g: 1, b: 1 };
const ORANGE: Rgba = [245, 150, 50, 255]; // 013 머리카락 (색상 약 30°)
const OUTLINE: Rgba = [64, 32, 16, 255]; // 윤곽선: 어두운 갈색
const SKIN: Rgba = [255, 224, 196, 255]; // 피부: 채도 낮음
const BLUE: Rgba = [40, 100, 200, 255];

describe('NPC 색 입히기', () => {
  it('주황 머리는 마스터 전에는 그대로', () => {
    expect(tintPixel(ORANGE, { r: 0.5, g: 0.5, b: 2 }, false)).toEqual(ORANGE);
  });

  it('주황 머리는 마스터하면 노랑(색상 약 55°)이 되고 채도·밝기는 같다', () => {
    const [r, g, b, a] = tintPixel(ORANGE, { r: 0.5, g: 0.5, b: 2 }, true);
    const [h, s, v] = rgbToHsv(r, g, b);
    const [, s0, v0] = rgbToHsv(245, 150, 50);
    expect(h).toBeGreaterThan(50);
    expect(h).toBeLessThan(60);
    expect(s).toBeCloseTo(s0, 1);
    expect(v).toBeCloseTo(v0, 1);
    expect(a).toBe(255);
  });

  it('몸(파랑) 화소는 곱셈 결과가 정확하고 0~255로 잘린다', () => {
    expect(tintPixel(BLUE, { r: 0.5, g: 1.5, b: 2 }, false)).toEqual([20, 150, 255, 255]);
    expect(tintPixel(BLUE, { r: 0.5, g: 1.5, b: 2 }, true)).toEqual([20, 150, 255, 255]);
  });

  it('tint {1,1,1}이면 몸 화소는 그대로', () => {
    for (const p of [BLUE, SKIN, OUTLINE, [10, 200, 40, 255] as Rgba]) expect(tintPixel(p, ONE, true)).toEqual(p);
  });

  it('투명 화소는 그대로 (알파 0은 색도 안 바뀐다)', () => {
    expect(tintPixel([200, 100, 50, 0], { r: 2, g: 2, b: 2 }, true)).toEqual([200, 100, 50, 0]);
  });

  it('알파는 어떤 경우에도 그대로', () => {
    expect(tintPixel([40, 100, 200, 128], { r: 2, g: 2, b: 2 }, false)[3]).toBe(128);
    expect(tintPixel([245, 150, 50, 77], ONE, true)[3]).toBe(77);
  });

  it('어두운 윤곽선·피부는 머리로 보지 않아 노랑으로 안 바뀐다', () => {
    expect(isHair(...(OUTLINE.slice(0, 3) as [number, number, number]))).toBe(false);
    expect(isHair(...(SKIN.slice(0, 3) as [number, number, number]))).toBe(false);
    expect(tintPixel(OUTLINE, ONE, true)).toEqual(OUTLINE);
    expect(tintPixel(SKIN, ONE, true)).toEqual(SKIN);
  });

  it('머리 그림자(어두운 주황)도 머리, 초록 옷은 머리 아님', () => {
    expect(isHair(170, 100, 40)).toBe(true);
    expect(isHair(120, 170, 90)).toBe(false);
  });

  it('색상 변환은 되돌릴 수 있다', () => {
    const [h, s, v] = rgbToHsv(245, 150, 50);
    expect(hsvToRgb(h, s, v)).toEqual([245, 150, 50]);
  });

  it('피부는 센 색 곱셈에도 그대로, 옷은 곱해진다 (얼굴이 회색·노랑이 되지 않는다)', () => {
    const t = { r: 0.6, g: 0.7, b: 0.8 };
    for (const mastered of [false, true]) {
      expect(tintPixel(SKIN, t, mastered)).toEqual(SKIN);
      expect(tintPixel([240, 190, 150, 255], t, mastered)).toEqual([240, 190, 150, 255]); // 볼 쪽 진한 피부
      expect(tintPixel(BLUE, t, mastered)).toEqual([24, 70, 160, 255]);
      expect(tintPixel(OUTLINE, t, mastered)).toEqual([38, 22, 13, 255]); // 윤곽선은 몸 규칙(곱셈)
    }
    expect(isSkin(255, 224, 196)).toBe(true);
    expect(isSkin(120, 170, 90)).toBe(false);
  });

  it('tintImageData는 화소 배열 전체를 제자리에서 바꾼다', () => {
    const data = new Uint8ClampedArray([...ORANGE, ...BLUE, 9, 9, 9, 0]);
    tintImageData(data, { r: 0.5, g: 1, b: 1 }, false);
    expect(Array.from(data)).toEqual([...ORANGE, 20, 100, 200, 255, 9, 9, 9, 0]);
    tintImageData(data, ONE, true);
    expect(rgbToHsv(data[0], data[1], data[2])[0]).toBeGreaterThan(50);
    expect(Array.from(data.slice(4, 8))).toEqual([20, 100, 200, 255]);
  });
});
