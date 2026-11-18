import { describe, expect, it } from 'vitest';
import { loadField } from '../../src/field/world/loadField';
import { roofNumberRects } from '../../src/field/world/fieldRenderer';

describe('지붕의 빛나는 숫자 자리', () => {
  it('마스터한 단(2·3)의 건물만, 문 바로 위 타일에 나온다', async () => {
    const map = await loadField('town');
    const r = roofNumberRects(map, { 2: { bestMs: 1 }, 3: { bestMs: 1 } });
    expect(r).toHaveLength(2);
    for (const { dan, x, y } of r) {
      const door = map.doors.find((d) => d.kind === 'training' && d.dan === dan)!;
      expect({ x, y }).toEqual({ x: door.pos.x, y: door.pos.y - 1 });
      expect(map.raw[y][x]).toBe('#');
    }
    expect(r.map((q) => q.dan).sort()).toEqual([2, 3]);
  });

  it('마스터가 없으면 빈 배열', async () => {
    const map = await loadField('town');
    expect(roofNumberRects(map, {})).toEqual([]);
  });

  it('목록 밖 단(10)은 무시', async () => {
    const map = await loadField('town');
    expect(roofNumberRects(map, { 10: { bestMs: 1 } } as never)).toEqual([]);
  });

  it('둘째 줄 건물(13단)도 문 위 한 칸', async () => {
    const map = await loadField('town');
    const [q] = roofNumberRects(map, { 13: 1 });
    const door = map.doors.find((d) => d.dan === 13)!;
    expect(q).toEqual({ dan: 13, x: door.pos.x, y: door.pos.y - 1 });
    expect(map.raw[q.y][q.x]).toBe('#');
  });

  it('훈련 문 10개 모두: 위 타일이 지붕(#)이고 두 자리 단도 나온다', async () => {
    const map = await loadField('town');
    const all = Object.fromEntries([2, 3, 4, 5, 6, 7, 8, 9, 11, 12, 13].map((d) => [d, 1]));
    const r = roofNumberRects(map, all);
    expect(r).toHaveLength(10);
    for (const q of r) expect(map.raw[q.y][q.x], `${q.dan}단`).toBe('#');
    expect(r.map((q) => q.dan)).toEqual(expect.arrayContaining([12, 13]));
    expect(r.map((q) => q.dan)).not.toContain(11);
  });
});
