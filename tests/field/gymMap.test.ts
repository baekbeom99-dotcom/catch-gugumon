import { describe, expect, it } from 'vitest';
import { GYM_EXITS, GYM_NPCS, GYM_ROWS, GYM_SIGNS, GYM_STATUES } from '../../src/field/world/maps/gym';
import { DIR_DELTA, type Dir, type FieldMap, type Pos, npcAt, safeStartPosition, tryStep } from '../../src/domain/field/movement';
import { TRAINING_DANS } from '../../src/domain/field/tuning';
import { loadField } from '../../src/field/world/loadField';
import { encounterChance } from '../../src/domain/field/encounter';

const DIRS = Object.keys(DIR_DELTA) as Dir[];
const key = (p: Pos) => `${p.x},${p.y}`;
const around = (p: Pos) => DIRS.map((d) => ({ x: p.x + DIR_DELTA[d].x, y: p.y + DIR_DELTA[d].y }));

/** tryStep으로 걸어서 닿는 칸들 (출구 칸에 서면 거기서 멈춘다) */
function reach(map: FieldMap, from: Pos): Set<string> {
  const seen = new Set<string>([key(from)]);
  const queue: Pos[] = [from];
  while (queue.length) {
    const p = queue.shift()!;
    if (map.tiles[p.y][p.x] === 'exit') continue;
    for (const d of DIRS) {
      const r = tryStep(map, p, d);
      if (r.moved && !seen.has(key(r.pos))) {
        seen.add(key(r.pos));
        queue.push(r.pos);
      }
    }
  }
  return seen;
}

describe('체육관 NPC 표', () => {
  it('정확히 13명: 단 10명(TRAINING_DANS 순서) + 셈연습 3명(기본·고수·보수)', () => {
    expect(GYM_NPCS).toHaveLength(13);
    const dan = GYM_NPCS.filter((n) => n.kind === 'dan');
    expect(dan.map((n) => (n.kind === 'dan' ? n.dan : 0))).toEqual([...TRAINING_DANS]);
    const arith = GYM_NPCS.filter((n) => n.kind === 'arith');
    expect(arith.map((n) => (n.kind === 'arith' ? n.level : ''))).toEqual(['basic', 'hard', 'comp']);
  });

  it('id·위치·색이 서로 다르다, 색 계수는 0~2', () => {
    expect(new Set(GYM_NPCS.map((n) => n.id)).size).toBe(13);
    expect(new Set(GYM_NPCS.map((n) => key(n.pos))).size).toBe(13);
    expect(new Set(GYM_NPCS.map((n) => `${n.tint.r},${n.tint.g},${n.tint.b}`)).size).toBe(13);
    for (const n of GYM_NPCS) for (const v of [n.tint.r, n.tint.g, n.tint.b]) expect(v >= 0 && v <= 2).toBe(true);
  });

  it('낮은 단일수록 입구(아래)에 가깝다', () => {
    const ys = GYM_NPCS.filter((n) => n.kind === 'dan').map((n) => n.pos.y);
    for (let i = 1; i < ys.length; i++) expect(ys[i], `${i}번째`).toBeLessThanOrEqual(ys[i - 1]);
  });
});

describe('체육관 지도', () => {
  it('표 값: 동상 2개, 출구 v → 마을, 표지판 글', () => {
    expect(GYM_STATUES).toHaveLength(2);
    expect(GYM_EXITS).toEqual({ v: 'town' });
    expect(GYM_SIGNS.length).toBeGreaterThan(0);
  });

  it('불러오면 NPC·동상이 지도에 들어 있고, 출구는 맨 아래 가운데 하나', async () => {
    const m = await loadField('gym');
    expect(m.id).toBe('gym');
    expect(m.npcs).toHaveLength(13);
    expect(m.statues).toHaveLength(2);
    expect(m.zones).toEqual({});
    expect(m.doors).toEqual([]);
    expect(m.exits).toHaveLength(1);
    expect(m.exits[0]).toMatchObject({ to: 'town', inward: 'up', pos: { y: m.height - 1 } });
    expect(Math.abs(m.exits[0].pos.x - (m.width - 1) / 2)).toBeLessThanOrEqual(0.5);
    expect(m.entrances.town).toEqual({ x: m.exits[0].pos.x, y: m.height - 2 });
    expect(m.width).toBeGreaterThanOrEqual(14);
    expect(m.width).toBeLessThanOrEqual(16);
    expect(m.height).toBeGreaterThanOrEqual(18);
    expect(GYM_ROWS).toHaveLength(m.height);
  });

  it('NPC·동상 칸은 걸어서 들어갈 수 없다 (NPC는 부딪힘)', async () => {
    const m = await loadField('gym');
    for (const n of GYM_NPCS) {
      expect(npcAt(m, n.pos)?.id).toBe(n.id);
      for (const p of around(n.pos)) {
        if (p.x < 0 || p.y < 0 || p.x >= m.width || p.y >= m.height) continue;
        const dir = DIRS.find((d) => p.x + DIR_DELTA[d].x === n.pos.x && p.y + DIR_DELTA[d].y === n.pos.y)!;
        const r = tryStep(m, p, dir);
        expect(r.moved, `${n.id} ${key(p)}→`).toBe(false);
      }
    }
    for (const s of GYM_STATUES) {
      expect(npcAt(m, s)).toBeUndefined();
      expect(m.tiles[s.y][s.x]).toBe('block');
    }
  });

  it('단상 칸은 막혀 있다 (P)', async () => {
    const m = await loadField('gym');
    const plat: Pos[] = [];
    m.raw.forEach((row, y) => [...row].forEach((ch, x) => ch === 'P' && plat.push({ x, y })));
    expect(plat.length).toBeGreaterThanOrEqual(4);
    for (const p of plat) expect(m.tiles[p.y][p.x]).toBe('block');
  });

  it('NPC·동상은 걷는 바닥 칸 위에 있고, 시작·입구 칸을 가리지 않는다', async () => {
    const m = await loadField('gym');
    const spots = [...GYM_NPCS.map((n) => n.pos), ...GYM_STATUES];
    for (const p of spots) {
      expect(m.raw[p.y][p.x], `${key(p)}`).toBe('.');
      expect(key(p)).not.toBe(key(m.entrances.start!));
      expect(key(p)).not.toBe(key(m.entrances.town!));
    }
  });

  it('입구에서 모든 NPC 곁(네 방향 중 걷는 칸)과 표지판 옆·출구에 닿는다', async () => {
    const m = await loadField('gym');
    for (const from of [m.entrances.start!, m.entrances.town!]) {
      const seen = reach(m, from);
      for (const n of GYM_NPCS) {
        const near = around(n.pos).filter((p) => seen.has(key(p)));
        expect(near.length, `${n.id} 곁에 닿는 칸`).toBeGreaterThanOrEqual(1);
      }
      for (const s of m.signs) expect(around(s.pos).some((p) => seen.has(key(p))), `표지판 ${key(s.pos)}`).toBe(true);
      expect(seen.has(key(m.exits[0].pos))).toBe(true);
    }
  });

  it('체육관에서는 야생 구구몬이 나오지 않는다', () => {
    expect(encounterChance('gym', 'path')).toBe(0);
    expect(encounterChance('gym', 'grass')).toBe(0);
  });

  it('저장된 자리가 NPC·동상 칸이면 시작 칸으로 되돌린다', async () => {
    const m = await loadField('gym');
    const n = GYM_NPCS[0].pos;
    expect(safeStartPosition(m, { map: 'gym', x: n.x, y: n.y, facing: 'left' })).toMatchObject({ ...m.entrances.start });
    const s = GYM_STATUES[0];
    expect(safeStartPosition(m, { map: 'gym', x: s.x, y: s.y, facing: 'left' })).toMatchObject({ ...m.entrances.start });
    const ok = { x: m.entrances.town!.x, y: m.entrances.town!.y };
    expect(safeStartPosition(m, { map: 'gym', ...ok, facing: 'left' })).toEqual({ ...ok, facing: 'left' });
  });
});
