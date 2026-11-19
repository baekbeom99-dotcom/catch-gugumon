import { describe, expect, it } from 'vitest';
import { GYM_EXITS, GYM_NPCS, GYM_ROWS, GYM_SIGNS, GYM_STATUES } from '../../src/field/world/maps/gym';
import { DIR_DELTA, type Dir, type FieldMap, type Pos, npcAt, safeStartPosition, tryStep } from '../../src/domain/field/movement';
import { TRAINING_DANS } from '../../src/domain/field/tuning';
import { loadField } from '../../src/field/world/loadField';
import { MASTER_HAIR_LOOKS, isYellowHue, hsvToRgb, rgbToHsv, tintPixel } from '../../src/field/art/npcTint';
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

  it('단 트레이너는 왼쪽에서 입구 가까운 쪽부터 위로, x=4·x=2를 번갈아 선다', () => {
    const dan = GYM_NPCS.filter((n) => n.kind === 'dan');
    for (const n of dan) expect(n.pos.x, n.id).toBeLessThanOrEqual(5);
    for (let i = 1; i < dan.length; i++) {
      expect(dan[i].pos.y, `${i}번째`).toBeLessThan(dan[i - 1].pos.y); // 입구에서 멀어질수록 위
      expect(dan[i].pos.x, `${i}번째 열`).not.toBe(dan[i - 1].pos.x); // 번갈아
    }
    expect(new Set(dan.map((n) => n.pos.x))).toEqual(new Set([2, 4]));
    expect(dan[0].pos.y).toBeGreaterThanOrEqual(15); // 첫 사람은 입구 가까이
  });

  it('셈연습 트레이너는 오른쪽 세로줄(x 10 이상)에 위로 늘어선다', () => {
    const arith = GYM_NPCS.filter((n) => n.kind === 'arith');
    for (const n of arith) expect(n.pos.x, n.id).toBeGreaterThanOrEqual(10);
    for (let i = 1; i < arith.length; i++) expect(arith[i].pos.y).toBeLessThan(arith[i - 1].pos.y);
  });

  it('머리색은 사람마다 다르고 노랑(마스터 전용)이 아니다, 옷색도 다 다르다', () => {
    const look = (n: (typeof GYM_NPCS)[number]) => `${n.hair.hue},${n.hair.sat ?? 1},${n.hair.val ?? 1}`;
    expect(new Set(GYM_NPCS.map(look)).size).toBe(13);
    expect(new Set(GYM_NPCS.map((n) => n.hair.hue)).size).toBe(13);
    for (const n of GYM_NPCS) expect(isYellowHue(n.hair.hue), `${n.id} 머리 ${n.hair.hue}도`).toBe(false);
  });

  it('바라보는 쪽은 올바른 값이고 모두 같지 않다', () => {
    const ok = ['down', 'up', 'left', 'right'];
    for (const n of GYM_NPCS) expect(ok, n.id).toContain(n.facing);
    expect(new Set(GYM_NPCS.map((n) => n.facing)).size).toBeGreaterThanOrEqual(3);
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

describe('체육관 NPC 머리 색칠 (원본 머리 화소 전체)', () => {
  const ONE = { r: 1, g: 1, b: 1 };
  /** 013 머리 범위(색상 8~45, 채도 0.5~1, 밝기 0.55~1)를 성기게 훑는 원본 화소들 */
  const sources: [number, number, number][] = [];
  for (const h of [10, 16, 24, 32, 40, 44]) for (const s of [0.55, 0.65, 0.8, 1]) for (const v of [0.6, 0.7, 0.85, 1]) sources.push(hsvToRgb(h, s, v));

  it('안 마스터한 NPC는 어떤 머리 화소도 노랗게 보이지 않는다', () => {
    for (const n of GYM_NPCS) {
      for (const [r, g, b] of sources) {
        const [nr, ng, nb] = tintPixel([r, g, b, 255], ONE, false, n.hair);
        const [h, s] = rgbToHsv(nr, ng, nb);
        if (s >= 0.05) expect(isYellowHue(h), `${n.id} 원본 ${r},${g},${b} → ${nr},${ng},${nb} (색상 ${h.toFixed(1)})`).toBe(false);
      }
    }
  });

  it('마스터한 트레이너는 두 반짝임 모습 모두 머리가 노랗다', () => {
    for (const phase of MASTER_HAIR_LOOKS.keys()) {
      for (const [r, g, b] of sources) {
        const [nr, ng, nb] = tintPixel([r, g, b, 255], ONE, true, undefined, phase);
        expect(isYellowHue(rgbToHsv(nr, ng, nb)[0]), `모습 ${phase} 원본 ${r},${g},${b}`).toBe(true);
      }
    }
  });
});
