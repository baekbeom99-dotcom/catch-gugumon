import type { FieldId, MapId } from './fields';

export type Dir = 'up' | 'down' | 'left' | 'right';
export interface Pos {
  x: number;
  y: number;
}
export type Tile = 'path' | 'grass' | 'block' | 'sign' | 'deco' | 'exit' | 'door';

export interface FieldDoor {
  pos: Pos;
  kind: 'shop' | 'gym' | 'stairs';
}

export interface FieldMap {
  id: MapId;
  width: number;
  height: number;
  tiles: Tile[][];
  /** 그 지도에서 돌아올 때 서는 칸(출구 한 칸 안쪽), start는 `@` */
  entrances: Partial<Record<MapId | 'start', Pos>>;
  /** inward: 출구에서 지도 안쪽을 보는 방향 (입구 = 출구 + inward 한 칸) */
  exits: { pos: Pos; to: MapId; inward: Dir }[];
  signs: { pos: Pos; text: string }[];
  /** 문 칸: 상점(`D`)·체육관(`G`)·무한의 계단(`T`) (글자 → 종류는 ParseOpts.doorChars) */
  doors: FieldDoor[];
  /** 체육관 NPC 자리: 서 있는 칸이 막힌다 (말 걸기는 부딪힘 `bump`로) */
  npcs: { id: string; pos: Pos }[];
  /** 장식 동상 칸: 막히고 말을 걸 수 없다 */
  statues: Pos[];
  /** 마을 서식지 칸: `g` 초원, `p` 물가, `a` 사막 (그 필드 구구몬이 노는 곳) */
  zones: Partial<Record<FieldId, Pos[]>>;
  /** 원래 글자 줄 (그림이 `g`·`a`·`p`·`~`를 구분할 때 쓴다) */
  raw: string[];
}

export interface StepResult {
  pos: Pos;
  moved: boolean;
  enteredGrass: boolean;
  /** 움직였으면 도착한 칸 종류, 못 움직였으면 null */
  tile: Tile | null;
  exitTo: MapId | null;
  /** 가려던 칸이 표지판(·문·구구몬)이라 못 갔으면 그 칸, 아니면 null */
  bump: Pos | null;
}

export const DIR_DELTA: Record<Dir, Pos> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

const CHAR_TILE: Record<string, Tile> = {
  '.': 'path',
  ',': 'grass',
  '#': 'block',
  '*': 'deco',
  S: 'sign',
  '<': 'exit',
  '>': 'exit',
  '^': 'exit',
  v: 'exit',
  '@': 'path',
  D: 'door',
  // 마을 건물 문(체육관 G·무한의 계단 T). 종류 표는 town.ts의 TOWN_DOORS
  G: 'door',
  T: 'door',
  // 체육관 안 단상(막힘)
  P: 'block',
  '~': 'block',
  g: 'path',
  a: 'path',
  p: 'path',
};

type ExitChar = '<' | '>' | '^' | 'v';
/** 출구 글자마다 지도 안쪽을 보는 방향 */
const EXIT_INWARD: Record<ExitChar, Dir> = { '<': 'right', '>': 'left', '^': 'down', v: 'up' };
const isExitChar = (ch: string): ch is ExitChar => ch in EXIT_INWARD;
/** 서식지 글자 → 그 필드 */
const ZONE_CHAR: Record<string, FieldId> = { g: 'meadow', p: 'waterside', a: 'desert' };

export interface ParseOpts {
  exits: Partial<Record<ExitChar, MapId>>;
  signTexts: string[];
  /** 문 글자 → 종류. 없으면 `D` = 상점 하나 */
  doorChars?: Record<string, { kind: FieldDoor['kind'] }>;
  /** 체육관 NPC 자리 (그 칸은 바닥 `.`이어야 한다) */
  npcs?: { id: string; pos: Pos }[];
  /** 장식 동상 자리 (그 칸은 바닥 `.`이어야 하고 막힌 칸이 된다) */
  statues?: Pos[];
}

/**
 * 글자 지도를 칸 지도로 바꾼다. `.` 길, `,` 풀숲, `#` 막힘, `*` 꾸밈, `S` 표지판, `<` `>` `^` `v` 출구, `@` 시작,
 * `D` 상점 문(문 글자 표를 주면 그 글자들), `P` 단상(막힘), `~` 물(막힘), `g` `p` `a` 서식지(길처럼 걷는다).
 * NPC·동상 칸은 글자가 아니라 옵션(`npcs`·`statues`)으로 받는다. 체육관 문(`gym`)은 그 앞 칸이 `entrances.gym`
 */
export function parseMap(id: MapId, rows: string[], opts: ParseOpts): FieldMap {
  const height = rows.length;
  const width = rows[0]?.length ?? 0;
  const tiles: Tile[][] = [];
  const entrances: FieldMap['entrances'] = {};
  const exits: FieldMap['exits'] = [];
  const signs: FieldMap['signs'] = [];
  const doors: FieldDoor[] = [];
  const doorChars = opts.doorChars ?? { D: { kind: 'shop' } };
  const zones: FieldMap['zones'] = {};
  let signIdx = 0;

  rows.forEach((row, y) => {
    if (row.length !== width) throw new Error(`지도 ${id}: ${y}번째 줄 길이가 다릅니다`);
    const line: Tile[] = [];
    for (let x = 0; x < width; x++) {
      const ch = row[x];
      const tile = CHAR_TILE[ch] ?? (doorChars[ch] ? 'door' : undefined);
      if (!tile) throw new Error(`지도 ${id}: 알 수 없는 글자 '${ch}' (${x},${y})`);
      line.push(tile);
      if (ch === '@') entrances.start = { x, y };
      else if (ch === 'S') {
        const text = opts.signTexts[signIdx++];
        if (text === undefined) throw new Error(`지도 ${id}: 표지판 글이 모자랍니다`);
        signs.push({ pos: { x, y }, text });
      } else if (isExitChar(ch)) {
        const to = opts.exits[ch];
        if (!to) throw new Error(`지도 ${id}: '${ch}' 출구의 도착 필드가 없습니다`);
        const inward = EXIT_INWARD[ch];
        exits.push({ pos: { x, y }, to, inward });
        // 출구 바로 안쪽 칸이 그 지도에서 돌아올 때의 시작 칸
        const d = DIR_DELTA[inward];
        entrances[to] = { x: x + d.x, y: y + d.y };
      } else if (doorChars[ch]) {
        const { kind } = doorChars[ch];
        doors.push({ pos: { x, y }, kind });
        // 체육관에서 나오면 문 바로 앞(아래) 칸에 선다
        if (kind === 'gym') entrances.gym = { x, y: y + 1 };
      } else if (ZONE_CHAR[ch]) (zones[ZONE_CHAR[ch]] ??= []).push({ x, y });
    }
    tiles.push(line);
  });
  if (signIdx !== opts.signTexts.length) throw new Error(`지도 ${id}: 표지판 글 개수가 다릅니다`);
  const npcs = (opts.npcs ?? []).map((n) => ({ id: n.id, pos: { ...n.pos } }));
  const statues = (opts.statues ?? []).map((p) => ({ ...p }));
  for (const [what, p] of [...npcs.map((n) => [`NPC ${n.id}`, n.pos] as const), ...statues.map((p) => ['동상', p] as const)])
    if (rows[p.y]?.[p.x] !== '.') throw new Error(`지도 ${id}: ${what} 자리 (${p.x},${p.y})가 바닥이 아닙니다`);
  for (const p of statues) tiles[p.y][p.x] = 'block';
  return { id, width, height, tiles, entrances, exits, signs, doors, npcs, statues, zones, raw: rows };
}

/** 이 칸에 서 있는 NPC (없으면 undefined) */
export function npcAt(map: FieldMap, p: Pos): { id: string; pos: Pos } | undefined {
  return map.npcs.find((n) => n.pos.x === p.x && n.pos.y === p.y);
}

/** 한 칸 걷기. 막힘·표지판·문·꾸밈·지도 밖은 못 간다. 표지판·문·NPC·동상과 `occupied`가 true인 칸은 부딪힌 칸(bump)이 된다. */
export function tryStep(map: FieldMap, pos: Pos, dir: Dir, occupied?: (p: Pos) => boolean): StepResult {
  const d = DIR_DELTA[dir];
  const nx = pos.x + d.x;
  const ny = pos.y + d.y;
  const stay: StepResult = { pos, moved: false, enteredGrass: false, tile: null, exitTo: null, bump: null };
  if (nx < 0 || ny < 0 || nx >= map.width || ny >= map.height) return stay;
  const tile = map.tiles[ny][nx];
  const next = { x: nx, y: ny };
  if (tile === 'sign' || tile === 'door' || npcAt(map, next) || map.statues.some((q) => q.x === nx && q.y === ny) || occupied?.(next)) return { ...stay, bump: next };
  if (tile === 'block' || tile === 'deco') return stay;
  if (tile === 'exit') {
    const exit = map.exits.find((e) => e.pos.x === nx && e.pos.y === ny);
    return { pos: next, moved: true, enteredGrass: false, tile, exitTo: exit?.to ?? null, bump: null };
  }
  return { pos: next, moved: true, enteredGrass: tile === 'grass', tile, exitTo: null, bump: null };
}

const WALKABLE: Tile[] = ['path', 'grass', 'exit'];

/** 저장된 자리가 이 지도에서 설 수 있는 곳이면 그대로, 아니면 시작 칸 */
export function safeStartPosition(
  map: FieldMap,
  saved: { map: MapId; x: number; y: number; facing: Dir },
): Pos & { facing: Dir } {
  const { x, y } = saved;
  const ok =
    saved.map === map.id &&
    Number.isInteger(x) &&
    Number.isInteger(y) &&
    x >= 0 &&
    y >= 0 &&
    x < map.width &&
    y < map.height &&
    WALKABLE.includes(map.tiles[y][x]) &&
    !npcAt(map, saved);
  if (ok) return { x, y, facing: saved.facing };
  const start = map.entrances.start ?? { x: 1, y: 1 };
  return { ...start, facing: 'down' };
}

/** 동행이 처음 서는 칸: 주인공이 바라보는 쪽의 반대 칸이 길·풀숲이면 거기, 아니면 주인공 칸 */
export function companionStart(map: FieldMap, hero: Pos, facing: Dir): Pos {
  const d = DIR_DELTA[facing];
  const x = hero.x - d.x;
  const y = hero.y - d.y;
  if (x < 0 || y < 0 || x >= map.width || y >= map.height) return { x: hero.x, y: hero.y };
  const tile = map.tiles[y][x];
  return (tile === 'path' || tile === 'grass') && !npcAt(map, { x, y }) ? { x, y } : { x: hero.x, y: hero.y };
}
