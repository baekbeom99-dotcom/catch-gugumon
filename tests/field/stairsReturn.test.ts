import { afterEach, describe, expect, it, vi } from 'vitest';
import { returnPathAfterStairs } from '../../src/field/training/routes';
import { emptyTraining, isStairsOpen } from '../../src/domain/field/training';

describe('무한의 계단', () => {
  it('끝나면 필드로 돌아온다', () => {
    expect(returnPathAfterStairs()).toBe('/field');
  });
  it('STAIRS_OPEN_AFTER_DAN이 null이면 항상 열림', () => {
    expect(isStairsOpen(emptyTraining())).toBe(true);
  });
});

describe('숫자로 잠글 때', () => {
  afterEach(() => {
    vi.doUnmock('../../src/domain/field/tuning');
    vi.resetModules();
  });
  it('그 단을 마스터한 뒤에만 열림', async () => {
    vi.resetModules();
    vi.doMock('../../src/domain/field/tuning', async (orig) => ({
      ...(await orig<typeof import('../../src/domain/field/tuning')>()),
      STAIRS_OPEN_AFTER_DAN: 3,
    }));
    const m = await import('../../src/domain/field/training');
    const t = m.emptyTraining();
    expect(m.isStairsOpen(t)).toBe(false);
    t.mastered[3] = { bestMs: 20000, at: 1 };
    expect(m.isStairsOpen(t)).toBe(true);
  });
});
