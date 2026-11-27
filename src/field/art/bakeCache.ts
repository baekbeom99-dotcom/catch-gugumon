/**
 * 굽기 결과 캐시 (순수, 시계·굽기 함수를 받는다): 성공은 영원히 기억하고, 실패는 원래 그림을 돌려주되
 * retryMs(기본 5초)가 지나면 잊어서 다음 요청에 다시 굽는다. 같은 열쇠를 동시에 굽지 않는다.
 */
export interface BakeCache<T> {
  /** 동기 읽기: 성공한 것만 */
  peek(key: string): T | undefined;
  /** 굽기(또는 캐시). 실패하면 fallback */
  get(key: string): Promise<T>;
}

export const BAKE_RETRY_MS = 5000;

/** 굽기를 건너뛰었다(아무도 안 기다림): 실패가 아니므로 재시도 대기를 걸지 않는다 */
export class BakeSkipped extends Error {
  constructor() {
    super('굽기를 건너뜀');
  }
}

export function createBakeCache<T>(bake: (key: string) => Promise<T>, fallback: T, now: () => number = Date.now, retryMs = BAKE_RETRY_MS): BakeCache<T> {
  const done = new Map<string, T>();
  const failedAt = new Map<string, number>();
  const pending = new Map<string, Promise<T>>();
  return {
    peek: (key) => done.get(key),
    get(key) {
      const hit = done.get(key);
      if (hit !== undefined) return Promise.resolve(hit);
      const failed = failedAt.get(key);
      if (failed !== undefined) {
        if (now() - failed < retryMs) return Promise.resolve(fallback);
        failedAt.delete(key);
      }
      let p = pending.get(key);
      if (!p) {
        p = bake(key)
          .then(
            (v) => {
              done.set(key, v);
              return v;
            },
            (e: unknown) => {
              if (!(e instanceof BakeSkipped)) failedAt.set(key, now());
              return fallback;
            },
          )
          .finally(() => pending.delete(key));
        pending.set(key, p);
      }
      return p;
    },
  };
}
