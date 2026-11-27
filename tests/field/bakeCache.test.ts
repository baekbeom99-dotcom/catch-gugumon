import { describe, expect, it } from 'vitest';
import { createBakeCache } from '../../src/field/art/bakeCache';

describe('createBakeCache', () => {
  it('성공은 한 번만 굽고 기억한다', async () => {
    let n = 0;
    const c = createBakeCache(async (k) => `${k}${++n}`, 'orig');
    expect(await c.get('a')).toBe('a1');
    expect(await c.get('a')).toBe('a1');
    expect(c.peek('a')).toBe('a1');
    expect(n).toBe(1);
  });
  it('동시에 같은 열쇠는 한 번만 굽는다', async () => {
    let n = 0;
    const c = createBakeCache(async () => ++n, 0);
    const [x, y] = await Promise.all([c.get('a'), c.get('a')]);
    expect(x).toBe(y);
    expect(n).toBe(1);
  });
  it('실패는 원래 그림을 돌려주고, 5초 뒤 다음 요청에 다시 굽는다', async () => {
    let t = 1000;
    let n = 0;
    const c = createBakeCache(
      async () => {
        n++;
        if (n === 1) throw new Error('x');
        return 'baked';
      },
      'orig',
      () => t,
    );
    expect(await c.get('a')).toBe('orig');
    expect(c.peek('a')).toBeUndefined();
    t += 4000;
    expect(await c.get('a')).toBe('orig');
    expect(n).toBe(1);
    t += 1500;
    expect(await c.get('a')).toBe('baked');
    expect(n).toBe(2);
    expect(c.peek('a')).toBe('baked');
  });
});
