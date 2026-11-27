import { describe, expect, it } from 'vitest';
import { getCostume, COSTUME_SETS } from '../../src/domain/field/costumes';
import { HERO_HAIR, HERO_PANTS, HERO_SHIRT, tintHeroPixel, tintHeroImageData, tintHeroImageDataSlow } from '../../src/field/art/heroTint';
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

// 017 그림 파일 읽기 (파일이 없는 PC·빌드면 undefined). 타입 패키지(@types/node) 없이 쓰려고 이름을 변수로 불러 온다
const NODE_FS = 'node:fs';
const NODE_ZLIB = 'node:zlib';
const CHIBI = 'src/field/art/creatures/chibi/017-';
const nodeFs = (await import(/* @vite-ignore */ NODE_FS)) as { existsSync(p: string): boolean; readFileSync(p: string): Uint8Array };
const nodeZlib = (await import(/* @vite-ignore */ NODE_ZLIB)) as { inflateSync(b: Uint8Array): Uint8Array };
const same = (a: Uint8ClampedArray, b: Uint8ClampedArray) => a.length === b.length && a.every((v, i) => v === b[i]);

/** 8비트 RGBA·끼워 읽기 없는 PNG를 읽는 작은 해독기 (테스트 전용, 017 그림이 그런 형식) */
function decodePng(name: string): Uint8ClampedArray {
  const buf = nodeFs.readFileSync(`${CHIBI}${name}.png`);
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const w = dv.getUint32(16);
  const h = dv.getUint32(20);
  const idat: Uint8Array[] = [];
  for (let o = 8; o < buf.length; ) {
    const len = dv.getUint32(o);
    if (String.fromCharCode(...buf.subarray(o + 4, o + 8)) === 'IDAT') idat.push(buf.subarray(o + 8, o + 8 + len));
    o += 12 + len;
  }
  const zipped = new Uint8Array(idat.reduce((n, c) => n + c.length, 0));
  let at = 0;
  for (const c of idat) {
    zipped.set(c, at);
    at += c.length;
  }
  const raw = nodeZlib.inflateSync(zipped);
  const stride = w * 4;
  const out = new Uint8ClampedArray(h * stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)];
    for (let x = 0; x < stride; x++) {
      const cur = raw[y * (stride + 1) + 1 + x];
      const a = x >= 4 ? out[y * stride + x - 4] : 0;
      const b = y > 0 ? out[(y - 1) * stride + x] : 0;
      const c = x >= 4 && y > 0 ? out[(y - 1) * stride + x - 4] : 0;
      let v = cur;
      if (f === 1) v = cur + a;
      else if (f === 2) v = cur + b;
      else if (f === 3) v = cur + ((a + b) >> 1);
      else if (f === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        v = cur + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c);
      }
      out[y * stride + x] = v & 255;
    }
  }
  return out;
}

describe('tintHeroImageData: 빠른 길은 tintHeroPixel과 똑같다', () => {
  it('색을 고르게 훑은 표(알파 0·반투명·불투명 포함)에서 모든 세트가 같다', () => {
    const px: number[] = [];
    for (let r = 0; r < 256; r += 15) for (let g = 0; g < 256; g += 15) for (let b = 0; b < 256; b += 15) px.push(r, g, b, 255);
    px.push(...HAIR, ...SHIRT, ...PANTS, 90, 60, 36, 7, 30, 174, 192, 128, 10, 20, 30, 0);
    for (const set of COSTUME_SETS) {
      const fast = new Uint8ClampedArray(px);
      const slow = new Uint8ClampedArray(px);
      tintHeroImageData(fast, set);
      tintHeroImageDataSlow(slow, set);
      expect(same(fast, slow), set.id).toBe(true);
    }
  });

  const has = nodeFs.existsSync(`${CHIBI}walk.png`);
  it.skipIf(!has)('실제 017 그림 다섯 장의 모든 화소가 모든 세트에서 같다', () => {
    for (const name of ['front', 'back', 'idle', 'walk', 'attack']) {
      const img = decodePng(name);
      for (const set of COSTUME_SETS) {
        const fast = new Uint8ClampedArray(img);
        const slow = new Uint8ClampedArray(img);
        tintHeroImageData(fast, set);
        tintHeroImageDataSlow(slow, set);
        expect(same(fast, slow), `${name} ${set.id}`).toBe(true);
      }
    }
  });

  it.skipIf(!has)('속도: 걷기 시트 한 장(약 33만 화소)', () => {
    const img = decodePng('walk');
    const set = getCostume('flag-kr');
    const time = (fn: (d: Uint8ClampedArray, s: typeof set) => void) => {
      const t = performance.now();
      for (let i = 0; i < 5; i++) fn(new Uint8ClampedArray(img), set);
      return (performance.now() - t) / 5;
    };
    const slow = time(tintHeroImageDataSlow);
    const fast = time(tintHeroImageData);
    console.log(`[bench] tint 시트 1장: 느린 길 ${slow.toFixed(1)}ms → 빠른 길 ${fast.toFixed(1)}ms`);
    expect(fast).toBeLessThan(slow);
  });
});
