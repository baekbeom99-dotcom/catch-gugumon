import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mock = vi.hoisted(() => ({
  mode: 'normal' as 'normal' | 'createThrows' | 'updateThrows' | 'drawThrows',
  opts: [] as Record<string, unknown>[],
  updates: 0,
}));

vi.mock('pixelfx', async (importOriginal) => {
  const actual = await importOriginal<typeof import('pixelfx')>();
  return {
    ...actual,
    createFx: (m: Parameters<typeof actual.createFx>[0], o: Parameters<typeof actual.createFx>[1]) => {
      mock.opts.push({ ...(o as Record<string, unknown>) });
      if (mock.mode === 'createThrows') throw new Error('만들다 실패');
      const fx = actual.createFx(m, o);
      const upd = fx.update.bind(fx);
      fx.update = (dt: number) => { mock.updates++; upd(dt); };
      if (mock.mode === 'updateThrows') fx.update = () => { throw new Error('update 실패'); };
      if (mock.mode === 'drawThrows') fx.draw = () => { throw new Error('draw 실패'); };
      return fx;
    },
  };
});

vi.setConfig({ testTimeout: 30_000 }); // 효과 코드를 처음 받는 데 오래 걸릴 수 있다

import { EFFECTS, type FxSpec } from '../../src/field/fx/effects';
import { FX_PIXEL, playFx } from '../../src/field/fx/playFx';

/** 가짜 rAF: 손으로 한 프레임씩 넘긴다 */
let queue: FrameRequestCallback[] = [];
let clock = 0;
function frame() {
  const q = queue;
  queue = [];
  clock += 16;
  for (const cb of q) cb(clock);
}
const flush = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };
/** 효과 코드를 받아 오는 비동기까지 기다린 뒤 한 프레임 */
async function until(cond: () => boolean) {
  for (let i = 0; i < 2500 && !cond(); i++) await new Promise((r) => setTimeout(r, 10));
}
/** 효과 코드를 받아 와 첫 프레임을 기다리는 줄이 생길 때까지 기다린 뒤 한 프레임 */
async function step() { await until(() => queue.length > 0); frame(); await flush(); }

function fakeCanvas() {
  const calls = { clear: 0, put: 0, dots: 0 };
  const ctx = {
    putImageData: () => { calls.put++; },
    clearRect: () => { calls.clear++; },
    fillRect: () => { calls.dots++; },
    fillStyle: '',
  };
  const canvas = {
    isConnected: true,
    width: 0,
    height: 0,
    getBoundingClientRect: () => ({ width: 300, height: 180 }),
    getContext: () => ctx,
  } as unknown as HTMLCanvasElement;
  return { canvas, calls };
}

beforeEach(() => {
  queue = [];
  clock = 0;
  mock.mode = 'normal';
  mock.opts = [];
  mock.updates = 0;
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => { queue.push(cb); return queue.length; });
  vi.stubGlobal('ImageData', class { data: Uint8ClampedArray; constructor(public width: number, public height: number) { this.data = new Uint8ClampedArray(width * height * 4); } });
  vi.stubGlobal('matchMedia', undefined);
});
afterEach(() => vi.unstubAllGlobals());

describe('playFx', () => {
  it('같은 캔버스에서 새 효과를 틀면 이전 효과의 루프가 멈춘다', async () => {
    const { canvas } = fakeCanvas();
    const a = playFx(canvas, 'fireball', { x: 100, y: 100 });
    await step();
    await step();
    expect(queue).toHaveLength(1); // A의 다음 프레임 하나
    const b = playFx(canvas, 'splash', { x: 100, y: 100 });
    await until(() => queue.length > 1); // A의 다음 프레임 + B의 첫 프레임
    frame(); // A는 스스로 멈추고, B가 시작한다
    await flush();
    expect(await a).toBe(true);
    expect(queue).toHaveLength(1); // 남은 것은 B의 루프 하나뿐
    for (let i = 0; i < 200 && queue.length; i++) frame();
    expect(await b).toBe(true);
  });

  it('틀자마자 이전 효과의 그림을 지운다', async () => {
    const { canvas, calls } = fakeCanvas();
    void playFx(canvas, 'fireball', { x: 100, y: 100 });
    await step();
    const before = calls.clear;
    void playFx(canvas, 'splash', { x: 100, y: 100 });
    expect(calls.clear).toBeGreaterThan(before);
  });

  it('createFx가 던져도 false를 돌려주고 오류를 남기지 않는다', async () => {
    mock.mode = 'createThrows';
    const err = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const rejections: unknown[] = [];
    const onRej = (r: unknown) => rejections.push(r);
    (globalThis as any).process.on('unhandledRejection', onRej);
    const { canvas } = fakeCanvas();
    expect(await playFx(canvas, 'fireball', { x: 100, y: 100 })).toBe(false);
    await new Promise((r) => setTimeout(r, 20));
    (globalThis as any).process.off('unhandledRejection', onRej);
    expect(rejections).toHaveLength(0);
    expect(err).not.toHaveBeenCalled();
    err.mockRestore();
  });

  it.each(['updateThrows', 'drawThrows'] as const)('%s: 틀다 던져도 false', async (mode) => {
    mock.mode = mode;
    const err = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { canvas } = fakeCanvas();
    const p = playFx(canvas, 'fireball', { x: 100, y: 100 });
    await until(() => queue.length > 0);
    frame();
    expect(await p).toBe(false);
    expect(err).not.toHaveBeenCalled();
    err.mockRestore();
  });

  it('at은 효과 중심을 놓을 자리: 원점 = at − center × FX_PIXEL (mirror면 dx를 뒤집음)', async () => {
    const c = EFFECTS['boulder'].center!;
    const at = { x: 150, y: 90 };
    const { canvas } = fakeCanvas();
    void playFx(canvas, 'boulder', at);
    await until(() => mock.opts.length > 0);
    expect(mock.opts.at(-1)).toMatchObject({ x: Math.round(at.x / FX_PIXEL - c.dx), y: Math.round(at.y / FX_PIXEL - c.dy) });
    const { canvas: c2 } = fakeCanvas();
    void playFx(c2, 'boulder', at, { mirror: true });
    await until(() => mock.opts.length > 1);
    expect(mock.opts.at(-1)).toMatchObject({ x: Math.round(at.x / FX_PIXEL + c.dx), y: Math.round(at.y / FX_PIXEL - c.dy) });
  });
});

describe('playFx 날아가는 효과', () => {
  const FROM = { x: 30, y: 150 };
  const AT = { x: 240, y: 60 };
  const TRAVEL = (EFFECTS as Record<string, FxSpec>)['fireball'].travelMs!;

  it('fireball은 날아가는 효과다', () => {
    expect((EFFECTS as Record<string, FxSpec>)['fireball'].motion).toBe('travel');
  });

  it('from이 있으면 먼저 구슬이 날아가고(효과는 그대로 멈춰 있고) 도착한 뒤에야 효과가 재생된다', async () => {
    const { canvas, calls } = fakeCanvas();
    const p = playFx(canvas, 'fireball', AT, { from: FROM });
    await step();
    // 이동 중: 구슬만 그려지고 효과는 진행하지 않는다
    for (let i = 0; i < 5; i++) await step();
    expect(calls.dots).toBeGreaterThan(0);
    expect(mock.updates).toBe(0);
    expect(calls.put).toBe(0);
    // 도착 뒤: 효과가 재생된다
    for (let i = 0; i < Math.ceil(TRAVEL / 16) + 3; i++) await step();
    expect(mock.updates).toBeGreaterThan(0);
    expect(calls.put).toBeGreaterThan(0);
    for (let i = 0; i < 200 && queue.length; i++) frame();
    expect(await p).toBe(true);
  });

  it('효과 중심은 출발 지점이 아니라 도착 지점(at)에 놓인다', async () => {
    const c = EFFECTS['fireball'].center!;
    const { canvas } = fakeCanvas();
    void playFx(canvas, 'fireball', AT, { from: FROM });
    await until(() => mock.opts.length > 0);
    expect(mock.opts.at(-1)).toMatchObject({ x: Math.round(AT.x / FX_PIXEL - c.dx), y: Math.round(AT.y / FX_PIXEL - c.dy) });
  });

  it('이동+터짐 시간은 0.6초 이하다 (프레임 수로 센다)', async () => {
    const { canvas } = fakeCanvas();
    const p = playFx(canvas, 'fireball', AT, { from: FROM });
    await until(() => queue.length > 0);
    let frames = 0;
    while (queue.length && frames < 200) { frame(); frames++; await flush(); }
    expect(await p).toBe(true);
    expect(frames * 16).toBeLessThanOrEqual(600 + 64);
  });

  it('from이 없으면 지금처럼 첫 프레임부터 효과가 재생된다 (구슬 없음)', async () => {
    const { canvas, calls } = fakeCanvas();
    void playFx(canvas, 'fireball', AT);
    await step();
    expect(mock.updates).toBeGreaterThan(0);
    expect(calls.dots).toBe(0);
  });

  it('burst 효과는 from이 있어도 날아가지 않는다', async () => {
    const { canvas, calls } = fakeCanvas();
    void playFx(canvas, 'thorns', AT, { from: FROM });
    await step();
    expect(mock.updates).toBeGreaterThan(0);
    expect(calls.dots).toBe(0);
  });

  it('동작 줄이기면 아무것도 틀지 않는다 (이동도 없이 바로 끝)', async () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true }));
    const { canvas, calls } = fakeCanvas();
    expect(await playFx(canvas, 'fireball', AT, { from: FROM })).toBe(true);
    expect(queue).toHaveLength(0);
    expect(calls.dots + calls.put).toBe(0);
  });

  it('날아가는 중에 새 효과를 틀면 이전 이동이 끊기고 구슬이 더 그려지지 않는다', async () => {
    const { canvas, calls } = fakeCanvas();
    const a = playFx(canvas, 'fireball', AT, { from: FROM });
    await step();
    await step();
    const b = playFx(canvas, 'splash', AT);
    await until(() => queue.length > 1);
    const dotsBefore = calls.dots;
    frame();
    await flush();
    expect(await a).toBe(true);
    expect(calls.dots).toBe(dotsBefore); // 이전 효과는 구슬을 더 그리지 않는다
    for (let i = 0; i < 200 && queue.length; i++) frame();
    expect(await b).toBe(true);
  });

  it('날아가는 효과도 틀다 던지면 false', async () => {
    mock.mode = 'drawThrows';
    const { canvas } = fakeCanvas();
    const p = playFx(canvas, 'fireball', AT, { from: FROM });
    await until(() => queue.length > 0);
    for (let i = 0; i < Math.ceil(TRAVEL / 16) + 3; i++) frame();
    expect(await p).toBe(false);
  });
});
