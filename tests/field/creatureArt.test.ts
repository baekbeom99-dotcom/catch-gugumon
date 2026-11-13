import { describe, expect, it } from 'vitest';
import { SPECIES } from '../../src/domain/field/creatures';
import { creatureArt, imageView, stageSheets, MONSTER_FILL, MONSTER_FOOT } from '../../src/field/art/creatureArt';
import { buildLocalSprites } from '../../src/field/art/localSprites';
import { companionRect } from '../../src/field/world/fieldRenderer';

describe('구구몬 그림 등록표', () => {
  it('등록하지 않은 종은 모두 몬스터 SVG (레전드는 황금)', () => {
    for (const s of SPECIES) {
      expect(creatureArt(s.id, {})).toEqual({ type: 'monster', kind: s.kind, golden: s.legend, fill: MONSTER_FILL, foot: MONSTER_FOOT });
    }
  });

  it('이미지로 등록하면 그 그림을 쓰고, 여백 값은 기본 1', () => {
    const art = creatureArt('cloud', { cloud: { front: 'f.png' } });
    expect(art).toEqual({ type: 'image', front: 'f.png', back: undefined, fill: 1, foot: 1 });
    expect(creatureArt('cloud', { cloud: { front: 'f.png', fill: 1.2, foot: 0.9 } })).toMatchObject({ fill: 1.2, foot: 0.9 });
  });

  it('뒷모습이 없으면 앞모습을 뒤집어 쓴다', () => {
    const noBack = creatureArt('cloud', { cloud: { front: 'f.png' } });
    const withBack = creatureArt('cloud', { cloud: { front: 'f.png', back: 'b.png' } });
    if (noBack.type !== 'image' || withBack.type !== 'image') throw new Error('이미지 그림이어야 함');
    expect(imageView(noBack, 'front')).toEqual({ src: 'f.png', flip: false });
    expect(imageView(noBack, 'back')).toEqual({ src: 'f.png', flip: true });
    expect(imageView(withBack, 'back')).toEqual({ src: 'b.png', flip: false });
  });

  it('동행 자리: 칸 가운데에 서고 발끝이 칸 바닥에 닿는다', () => {
    const tile = 48;
    const r = companionRect(0, 0, tile, { scale: 1, fill: 1, foot: 1 });
    expect(r).toEqual({ x: 0, y: 0, size: 48 });
    const m = companionRect(0, 0, tile, { scale: 1, fill: MONSTER_FILL, foot: MONSTER_FOOT });
    expect(m.size).toBe(Math.round(48 * 1.45));
    expect(Math.round(m.y + m.size * MONSTER_FOOT)).toBe(tile);
  });

  it('진화 단계별 그림이 있으면 단계마다 그 그림, 없으면 front/back', () => {
    const stages: [{ front: string; back?: string }, { front: string; back?: string }, { front: string; back?: string }] = [
      { front: 'f1.png', back: 'b1.png' },
      { front: 'f2.png' },
      { front: 'f3.png', back: 'b3.png' },
    ];
    const art = creatureArt('cloud', { cloud: { front: 'f1.png', back: 'b1.png', stages } });
    if (art.type !== 'image') throw new Error('이미지 그림이어야 함');
    expect(imageView(art, 'front', 1)).toEqual({ src: 'f1.png', flip: false });
    expect(imageView(art, 'front', 2)).toEqual({ src: 'f2.png', flip: false });
    expect(imageView(art, 'back', 2)).toEqual({ src: 'f2.png', flip: true });
    expect(imageView(art, 'back', 3)).toEqual({ src: 'b3.png', flip: false });
    const plain = creatureArt('cloud', { cloud: { front: 'f.png', back: 'b.png' } });
    if (plain.type !== 'image') throw new Error('이미지 그림이어야 함');
    expect(imageView(plain, 'front', 3)).toEqual({ src: 'f.png', flip: false });
    expect(imageView(plain, 'back', 2)).toEqual({ src: 'b.png', flip: false });
  });
});

describe('로컬 스프라이트 등록', () => {
  const map = { cloud: { ids: ['0001', '0002', '0003'], fill: 1.1 }, ghost: { ids: ['0004'] } };
  it('파일이 없으면 빈 객체 (기존 SVG 그대로)', () => {
    expect(buildLocalSprites({}, map)).toEqual({});
  });
  it('파일이 모두 있는 종만 단계별로 등록, 단계가 모자라면 마지막 그림을 되풀이', () => {
    const files = {
      './creatures/pmd/0001-front.png': 'a', './creatures/pmd/0001-back.png': 'A',
      './creatures/pmd/0002-front.png': 'b', './creatures/pmd/0002-back.png': 'B',
      './creatures/pmd/0003-front.png': 'c', './creatures/pmd/0003-back.png': 'C',
      './creatures/pmd/0004-front.png': 'd',
    };
    const r = buildLocalSprites(files, map);
    expect(r.cloud?.stages?.map((x) => x.front)).toEqual(['a', 'b', 'c']);
    expect(r.cloud?.fill).toBe(1.1);
    expect(r.ghost?.stages?.map((x) => x.front)).toEqual(['d', 'd', 'd']);
    expect(r.ghost?.stages?.[0].back).toBeUndefined();
  });
  it('일부 번호만 없으면 그 종은 등록하지 않는다', () => {
    expect(buildLocalSprites({ './creatures/pmd/0001-front.png': 'a' }, map)).toEqual({});
  });
});

describe('시트 등록', () => {
  const map = { cloud: { ids: ['0001'], fill: 1.0, foot: 0.98 } };
  const files = {
    './creatures/pmd/0001-front.png': 'f', './creatures/pmd/0001-back.png': 'b',
    './creatures/pmd/0001-idle.png': 'i', './creatures/pmd/0001-walk.png': 'w',
    './creatures/pmd/0001-hurt.png': 'h', './creatures/pmd/0001-sleep.png': 's',
  };
  const manifest = {
    '0001': {
      side: 70, baseSide: 44, foot: 0.986,
      idle: { ms: [667, 100, 100], rows: 4 }, walk: { ms: [67, 67], rows: 4 },
      hurt: { ms: [33, 133], rows: 2 }, sleep: { ms: [500, 583], rows: 1 },
      attack: { ms: [67, 33, 67], rows: 2, side: 144, ax: 72, ay: 72, ix: 38, iy: 57 },
    },
  };
  it('manifest가 있으면 단계에 시트를 붙이고 크기 보정값을 채운다', () => {
    const sh = buildLocalSprites(files, map, manifest).cloud?.stages?.[0].sheets;
    expect(sh?.idle).toEqual({ url: 'i', ms: [667, 100, 100], rows: 4 });
    expect(sh?.walk.url).toBe('w');
    expect(sh?.hurt?.rows).toBe(2);
    expect(sh?.sleep?.url).toBe('s');
    expect(sh?.scale).toBeCloseTo(70 / 44, 5);
    expect(sh?.foot).toBe(0.986);
    expect(sh?.side).toBe(70);
  });
  it('attack 시트 등록: 파일과 manifest가 둘 다 있을 때만', () => {
    const withAtk = { ...files, './creatures/pmd/0001-attack.png': 'a' };
    const sh = buildLocalSprites(withAtk, map, manifest).cloud?.stages?.[0].sheets;
    expect(sh?.attack).toEqual({ url: 'a', ms: [67, 33, 67], rows: 2, side: 144, ax: 72, ay: 72, ix: 38, iy: 57 });
    // 파일이 없으면 attack만 빠지고 나머지 시트는 그대로
    const noFile = buildLocalSprites(files, map, manifest).cloud?.stages?.[0].sheets;
    expect(noFile?.attack).toBeUndefined();
    expect(noFile?.idle.url).toBe('i');
  });
  it('manifest나 시트 파일이 없으면 시트 없이 정지 그림만', () => {
    expect(buildLocalSprites(files, map).cloud?.stages?.[0].sheets).toBeUndefined();
    const noWalk = { ...files };
    delete (noWalk as Record<string, string>)['./creatures/pmd/0001-walk.png'];
    const r = buildLocalSprites(noWalk, map, manifest);
    expect(r.cloud?.stages?.[0].sheets).toBeUndefined();
    expect(r.cloud?.stages?.[0].front).toBe('f');
  });
  it('stageSheets: 시트 있는 이미지만 돌려준다', () => {
    const imgs = buildLocalSprites(files, map, manifest);
    expect(stageSheets(creatureArt('cloud', imgs), 2)?.side).toBe(70);
    expect(stageSheets(creatureArt('cloud', {}), 1)).toBeUndefined();
  });
});

