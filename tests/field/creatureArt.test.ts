import { describe, expect, it } from 'vitest';
import { SPECIES } from '../../src/domain/field/creatures';
import { artBox, artSheets, creatureArt, imageView, MONSTER_FILL, MONSTER_FOOT } from '../../src/field/art/creatureArt';
import { buildChibiArt, buildLocalSprites, chibiNum, CHIBI_FIELD_FILL, HERO_NUM } from '../../src/field/art/localSprites';
import { cellBox } from '../../src/field/art/spriteSheet';
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
    expect(r).toEqual({ x: 0, y: 0, w: 48, h: 48 });
    const m = companionRect(0, 0, tile, { scale: 1, fill: MONSTER_FILL, foot: MONSTER_FOOT });
    expect(m.w).toBe(Math.round(48 * 1.45));
    expect(Math.round(m.y + m.h * MONSTER_FOOT)).toBe(tile);
  });

  it('치비 자리: 칸 비율(box)대로 그리고 발(칸 아래)이 칸 바닥, 가로 가운데', () => {
    const r = companionRect(0, 0, 40, { scale: 1, fill: 1.5, foot: 1, box: { w: 0.5, h: 0.8 } });
    expect(r).toEqual({ x: 5, y: -8, w: 30, h: 48 });
  });

  it('SVG·정사각형 그림은 상자 1×1, 시트 없음', () => {
    expect(artBox(creatureArt('c034', {}))).toEqual({ w: 1, h: 1 });
    expect(artBox(creatureArt('c034', { c034: { front: 'f' } }))).toEqual({ w: 1, h: 1 });
    expect(artSheets(creatureArt('c034', {}))).toBeUndefined();
  });
});

describe('치비 그림 등록 (번호 = 종 id 숫자, 017은 주인공)', () => {
  const manifest = {
    '034': { cw: 120, ch: 130, cols: 4, rows: 4, bodyH: 100, bodyW: 90, idle: { ms: [300, 300, 300, 300] }, walk: { ms: [150, 150, 150, 150] }, attack: { ms: [110, 110, 110, 110] } },
    '035': { cw: 100, ch: 100, bodyH: 80, idle: { ms: [300] }, walk: { ms: [150] } },
    '017': { cw: 144, ch: 143, bodyH: 120, bodyW: 100, idle: { ms: [300] }, walk: { ms: [150] } },
  };
  const full = (n: string, views = ['front', 'back', 'idle', 'walk', 'attack']) =>
    Object.fromEntries(views.map((v) => [`./creatures/chibi/${n}-${v}.png`, `${n}${v}`]));

  it('종 id → 그림 번호, 주인공은 017', () => {
    expect(chibiNum('c034')).toBe('034');
    expect(chibiNum('c001')).toBe('001');
    expect(HERO_NUM).toBe('017');
  });

  it('파일이 없으면 빈 객체 (배포본: 모두 SVG 그대로)', () => {
    expect(buildLocalSprites({}, manifest)).toEqual({});
    expect(buildLocalSprites({})).toEqual({});
    expect(buildChibiArt({}, HERO_NUM, manifest)).toBeUndefined();
  });

  it('번호가 같은 종에만 붙고, 017 그림은 어떤 종에도 붙지 않는다', () => {
    const r = buildLocalSprites({ ...full('034'), ...full('017') }, manifest);
    expect(Object.keys(r)).toEqual(['c034']);
    expect(creatureArt('c035', r).type).toBe('monster');
  });

  it('시트 묶음: 칸 크기·가만히·걷기·공격, 필드 자리 크기·발끝', () => {
    const e = buildLocalSprites(full('034'), manifest).c034!;
    expect(e).toMatchObject({ front: '034front', back: '034back', fill: CHIBI_FIELD_FILL, foot: 1, cell: { cw: 120, ch: 130, bodyH: 100, bodyW: 90 } });
    expect(e.sheets).toEqual({
      cw: 120,
      ch: 130,
      idle: { url: '034idle', ms: [300, 300, 300, 300] },
      walk: { url: '034walk', ms: [150, 150, 150, 150] },
      attack: { url: '034attack', ms: [110, 110, 110, 110] },
    });
    const art = creatureArt('c034', { c034: e });
    expect(artSheets(art)?.cw).toBe(120);
    expect(artBox(art)).toEqual(cellBox({ cw: 120, ch: 130, bodyH: 100, bodyW: 90 }));
  });

  it('공격 시트가 없으면 가만히·걷기만, 걷기가 없으면 시트 없이 정지 그림', () => {
    const noAtk = buildLocalSprites(full('034', ['front', 'idle', 'walk']), manifest).c034!;
    expect(noAtk.sheets?.attack).toBeUndefined();
    expect(noAtk.back).toBeUndefined();
    const noWalk = buildLocalSprites(full('034', ['front', 'idle']), manifest).c034!;
    expect(noWalk.sheets).toBeUndefined();
    expect(noWalk.front).toBe('034front');
  });

  it('manifest가 없으면 정지 그림(정사각형 상자)만', () => {
    const e = buildLocalSprites(full('034'), {}).c034!;
    expect(e.sheets).toBeUndefined();
    expect(e.cell).toBeUndefined();
    expect(artBox(creatureArt('c034', { c034: e }))).toEqual({ w: 1, h: 1 });
  });

  it('주인공(017) 그림은 따로 만든다', () => {
    const h = buildChibiArt(full('017'), HERO_NUM, manifest)!;
    expect(h.front).toBe('017front');
    expect(h.sheets?.walk.url).toBe('017walk');
  });
});
