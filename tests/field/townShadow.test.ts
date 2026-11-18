import { describe, expect, it } from 'vitest';
import { BUILDING_SHADOW, buildingShadowTiles } from '../../src/field/art/shadow';
import { parseMap } from '../../src/domain/field/movement';
import { TOWN_DOORS, TOWN_EXITS, TOWN_ROWS, TOWN_SIGNS } from '../../src/field/world/maps/town';

const small = (rows: string[], signs: string[] = []) => parseMap('town', rows, { exits: TOWN_EXITS, signTexts: signs, doorChars: TOWN_DOORS });
const townMap = () => parseMap('town', TOWN_ROWS, { exits: TOWN_EXITS, signTexts: TOWN_SIGNS, doorChars: TOWN_DOORS });
const keys = (m: ReturnType<typeof small>) => buildingShadowTiles(m).map((p) => `${p.x},${p.y}`).sort();

describe('건물 그림자 칸', () => {
  it('수치 고정', () => {
    expect(BUILDING_SHADOW).toEqual({ dx: 0.5, dy: 0.5, alpha: 0.18 });
  });
  it('건물 몸 오른쪽·아래 길 칸이 한 번씩 들어간다', () => {
    const m = small(['#######', '#.....#', '#.###.#', '#.###.#', '#.....#', '#######']);
    expect(keys(m)).toEqual(['2,4', '3,4', '4,4', '5,2', '5,3'].sort());
  });
  it('지도 둘레 벽은 그림자를 만들지 않는다', () => {
    const m = small(['#####', '#...#', '#...#', '#####']);
    expect(buildingShadowTiles(m)).toEqual([]);
  });
  it('홀로 선 나무는 그림자가 없다', () => {
    const m = small(['#####', '#...#', '#.#.#', '#...#', '#####']);
    expect(buildingShadowTiles(m)).toEqual([]);
  });
  it('다른 건물 칸·표지판·출구는 빼고 지도 밖은 건너뛴다', () => {
    // 두 건물 사이 한 칸 길은 들어가고, 표지판(S) 칸은 빠진다
    const m = small(['#######', '#.....#', '#.##.##', '#.##S##', '#.....#', '#######'], ['표']);
    const k = keys(m);
    expect(k).not.toContain('4,3');
    expect(new Set(k).size).toBe(k.length);
    for (const p of buildingShadowTiles(m)) expect(p.x < m.width && p.y < m.height).toBe(true);
  });
});

describe('실제 마을 지도의 건물 그림자', () => {
  const town = townMap();
  const shadows = buildingShadowTiles(town);
  const has = (x: number, y: number) => shadows.some((p) => p.x === x && p.y === y);
  it('체육관·상점·계단 건물 옆에 그림자 칸이 있다', () => {
    for (const kind of ['gym', 'shop', 'stairs'] as const) {
      const d = town.doors.find((q) => q.kind === kind)!;
      // 문이 있는 벽 줄 바로 아래(길)나 그 건물 오른쪽
      let near = false;
      for (let dx = -6; dx <= 6; dx++) for (let dy = 0; dy <= 2; dy++) near ||= has(d.pos.x + dx, d.pos.y + dy);
      expect(near, kind).toBe(true);
    }
  });
  it('모두 걷는 길 칸이고 문·표지판·출구·둘레 벽이 아니다', () => {
    expect(shadows.length).toBeGreaterThan(10);
    for (const p of shadows) {
      expect(['path', 'grass']).toContain(town.tiles[p.y][p.x]);
      expect(p.x).toBeGreaterThan(0);
      expect(p.y).toBeGreaterThan(0);
    }
    expect(new Set(shadows.map((p) => `${p.x},${p.y}`)).size).toBe(shadows.length);
  });
});
