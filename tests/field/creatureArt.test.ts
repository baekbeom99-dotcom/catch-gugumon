import { describe, expect, it } from 'vitest';
import { SPECIES } from '../../src/domain/field/creatures';
import { creatureArt, imageView, stageFill, stageSheets, MONSTER_FILL, MONSTER_FOOT } from '../../src/field/art/creatureArt';
import { buildLocalSprites, LOCAL_SPRITE_MAP } from '../../src/field/art/localSprites';
import { bodyFill } from '../../src/field/art/spriteSheet';
import { companionRect } from '../../src/field/world/fieldRenderer';

describe('구구몬 그림 등록표', () => {
  it('등록하지 않은 종은 모두 몬스터 SVG (레전드는 황금)', () => {
    for (const s of SPECIES) {
      expect(creatureArt(s.id, {})).toEqual({ type: 'monster', kind: s.svgKind, golden: s.legend, fill: MONSTER_FILL, foot: MONSTER_FOOT });
    }
  });

  it('이미지로 등록하면 그 그림을 쓰고, 여백 값은 기본 1', () => {
    const art = creatureArt('c034', { c034: { front: 'f.png' } });
    expect(art).toEqual({ type: 'image', front: 'f.png', back: undefined, fill: 1, foot: 1 });
    expect(creatureArt('c034', { c034: { front: 'f.png', fill: 1.2, foot: 0.9 } })).toMatchObject({ fill: 1.2, foot: 0.9 });
  });

  it('뒷모습이 없으면 앞모습을 뒤집어 쓴다', () => {
    const noBack = creatureArt('c034', { c034: { front: 'f.png' } });
    const withBack = creatureArt('c034', { c034: { front: 'f.png', back: 'b.png' } });
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
    const art = creatureArt('c034', { c034: { front: 'f1.png', back: 'b1.png', stages } });
    if (art.type !== 'image') throw new Error('이미지 그림이어야 함');
    expect(imageView(art, 'front', 1)).toEqual({ src: 'f1.png', flip: false });
    expect(imageView(art, 'front', 2)).toEqual({ src: 'f2.png', flip: false });
    expect(imageView(art, 'back', 2)).toEqual({ src: 'f2.png', flip: true });
    expect(imageView(art, 'back', 3)).toEqual({ src: 'b3.png', flip: false });
    const plain = creatureArt('c034', { c034: { front: 'f.png', back: 'b.png' } });
    if (plain.type !== 'image') throw new Error('이미지 그림이어야 함');
    expect(imageView(plain, 'front', 3)).toEqual({ src: 'f.png', flip: false });
    expect(imageView(plain, 'back', 2)).toEqual({ src: 'b.png', flip: false });
  });
});

describe('로컬 스프라이트 등록', () => {
  const map = { c034: { ids: ['0001', '0002', '0003'], fill: 1.1 }, c035: { ids: ['0004'] } };
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
    expect(r.c034?.stages?.map((x) => x.front)).toEqual(['a', 'b', 'c']);
    expect(r.c034?.fill).toBe(1.1);
    expect(r.c035?.stages?.map((x) => x.front)).toEqual(['d', 'd', 'd']);
    expect(r.c035?.stages?.[0].back).toBeUndefined();
  });
  it('일부 번호만 없으면 그 종은 등록하지 않는다', () => {
    expect(buildLocalSprites({ './creatures/pmd/0001-front.png': 'a' }, map)).toEqual({});
  });
});

describe('시트 등록', () => {
  const map = { c034: { ids: ['0001'], fill: 1.0, foot: 0.98 } };
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
    const sh = buildLocalSprites(files, map, manifest).c034?.stages?.[0].sheets;
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
    const sh = buildLocalSprites(withAtk, map, manifest).c034?.stages?.[0].sheets;
    expect(sh?.attack).toEqual({ url: 'a', ms: [67, 33, 67], rows: 2, side: 144, ax: 72, ay: 72, ix: 38, iy: 57 });
    // 파일이 없으면 attack만 빠지고 나머지 시트는 그대로
    const noFile = buildLocalSprites(files, map, manifest).c034?.stages?.[0].sheets;
    expect(noFile?.attack).toBeUndefined();
    expect(noFile?.idle.url).toBe('i');
  });
  it('manifest나 시트 파일이 없으면 시트 없이 정지 그림만', () => {
    expect(buildLocalSprites(files, map).c034?.stages?.[0].sheets).toBeUndefined();
    const noWalk = { ...files };
    delete (noWalk as Record<string, string>)['./creatures/pmd/0001-walk.png'];
    const r = buildLocalSprites(noWalk, map, manifest);
    expect(r.c034?.stages?.[0].sheets).toBeUndefined();
    expect(r.c034?.stages?.[0].front).toBe('f');
  });
  it('stageSheets: 시트 있는 이미지만 돌려준다', () => {
    const imgs = buildLocalSprites(files, map, manifest);
    expect(stageSheets(creatureArt('c034', imgs), 2)?.side).toBe(70);
    expect(stageSheets(creatureArt('c034', {}), 1)).toBeUndefined();
  });
});


describe('종-번호 표 (LOCAL_SPRITE_MAP)', () => {
  const speciesIds = new Set<string>(SPECIES.map((x) => x.id));
  it('키는 모두 SpeciesId, 번호는 4자리 3단계', () => {
    for (const [k, v] of Object.entries(LOCAL_SPRITE_MAP)) {
      expect(speciesIds.has(k), k).toBe(true);
      expect(v.ids).toHaveLength(3);
      for (const id of v.ids) expect(id).toMatch(/^\d{4}$/);
    }
  });
  it('49종으로 바꾼 뒤에는 비어 있다 (새 그림은 다음 작업에서 연결)', () => {
    expect(Object.keys(LOCAL_SPRITE_MAP)).toEqual([]);
  });
  it('한 종의 번호 하나라도 그림이 없으면 그 종만 SVG로 (다른 종은 그대로)', () => {
    const map = { c034: { ids: ['0001', '0002', '0003'] }, c035: { ids: ['0004', '0005', '0006'] } };
    const files: Record<string, string> = {};
    for (const id of ['0001', '0002', '0003', '0004', '0005']) files[`./creatures/pmd/${id}-front.png`] = id;
    const r = buildLocalSprites(files, map);
    expect(Object.keys(r)).toEqual(['c034']);
    expect(creatureArt('c035', r).type).toBe('monster');
  });
  it('Sleep·Hurt·Attack이 없는 번호도 Idle·Walk만으로 시트가 붙는다', () => {
    const map = { c034: { ids: ['0015'] } };
    const files = { './creatures/pmd/0015-front.png': 'f', './creatures/pmd/0015-idle.png': 'i', './creatures/pmd/0015-walk.png': 'w' };
    const manifest = { '0015': { side: 90, baseSide: 50, foot: 0.989, bodyH: 48, bodyW: 46, idle: { ms: [67], rows: 6 }, walk: { ms: [67], rows: 4 } } };
    const sh = buildLocalSprites(files, map, manifest).c034?.stages?.[0].sheets;
    expect(sh?.idle.url).toBe('i');
    expect(sh?.hurt).toBeUndefined();
    expect(sh?.sleep).toBeUndefined();
    expect(sh?.attack).toBeUndefined();
  });
  it('단계마다 몸 높이로 fill을 계산해 붙인다 (stageFill)', () => {
    const map = { c034: { ids: ['0001', '0002'] } };
    const files = { './creatures/pmd/0001-front.png': 'a', './creatures/pmd/0002-front.png': 'b' };
    const manifest = {
      '0001': { side: 70, baseSide: 44, foot: 0.98, bodyH: 42, bodyW: 34 },
      '0002': { side: 90, baseSide: 130, foot: 0.98, bodyH: 128, bodyW: 78 },
    };
    const imgs = buildLocalSprites(files, map, manifest);
    const art = creatureArt('c034', imgs);
    expect(stageFill(art, 1)).toBeCloseTo(bodyFill({ baseSide: 44, bodyH: 42, bodyW: 34 }), 5);
    expect(stageFill(art, 2)).toBeCloseTo(0.8 * 130 / 128, 2);
    expect(stageFill(creatureArt('c042', imgs), 2)).toBe(1);
  });
});
