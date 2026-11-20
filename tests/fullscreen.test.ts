import { describe, expect, it, vi } from 'vitest';
import { isFullscreen, isFullscreenSupported, toggleFullscreen } from '../src/lib/fullscreen';

describe('전체 화면 도우미', () => {
  it('지원 여부: 표준·webkit·없음', () => {
    expect(isFullscreenSupported({ fullscreenEnabled: true })).toBe(true);
    expect(isFullscreenSupported({ webkitFullscreenEnabled: true })).toBe(true);
    expect(isFullscreenSupported({})).toBe(false);
    expect(isFullscreenSupported({ fullscreenEnabled: false })).toBe(false);
  });
  it('지금 상태 읽기 (webkit 포함)', () => {
    expect(isFullscreen({})).toBe(false);
    expect(isFullscreen({ fullscreenElement: null })).toBe(false);
    expect(isFullscreen({ fullscreenElement: {} as Element })).toBe(true);
    expect(isFullscreen({ webkitFullscreenElement: {} as Element })).toBe(true);
  });
  it('꺼져 있으면 켜고, 켜져 있으면 끈다', async () => {
    const req = vi.fn().mockResolvedValue(undefined);
    const exit = vi.fn().mockResolvedValue(undefined);
    await toggleFullscreen({ exitFullscreen: exit }, { requestFullscreen: req });
    expect(req).toHaveBeenCalledTimes(1);
    expect(exit).not.toHaveBeenCalled();
    await toggleFullscreen({ fullscreenElement: {} as Element, exitFullscreen: exit }, { requestFullscreen: req });
    expect(exit).toHaveBeenCalledTimes(1);
    expect(req).toHaveBeenCalledTimes(1);
  });
  it('webkit 이름으로도 켜고 끈다', async () => {
    const req = vi.fn();
    const exit = vi.fn();
    await toggleFullscreen({ webkitExitFullscreen: exit }, { webkitRequestFullscreen: req });
    expect(req).toHaveBeenCalledTimes(1);
    await toggleFullscreen({ webkitFullscreenElement: {} as Element, webkitExitFullscreen: exit }, {});
    expect(exit).toHaveBeenCalledTimes(1);
  });
  it('거절당해도 오류를 내지 않는다 (동기·비동기 모두)', async () => {
    await expect(toggleFullscreen({}, { requestFullscreen: () => Promise.reject(new Error('no')) })).resolves.toBeUndefined();
    await expect(
      toggleFullscreen({}, {
        requestFullscreen: () => {
          throw new Error('no');
        },
      }),
    ).resolves.toBeUndefined();
    await expect(toggleFullscreen({}, {})).resolves.toBeUndefined();
  });
});
