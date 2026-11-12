import { describe, expect, it } from 'vitest';
import { forcedThrowRng } from '../../src/domain/field/strength';
import { createWild, maxCells, throwCapsule } from '../../src/domain/field/wildBattle';
import type { ThrowOutcome } from '../../src/domain/field/wildBattle';

describe('E2E용 던지기 결과 고정 난수', () => {
  it.each(['weak', 'normal', 'strong', 'mighty', 'legend'] as const)('%s: 정한 결과가 그대로 나온다', (tier) => {
    for (const outcome of ['caught', 'healed', 'escaped', 'angry'] as ThrowOutcome[]) {
      const s = { ...createWild(tier, 5, 100), phase: 'dizzy' as const, cells: maxCells(tier) };
      expect(throwCapsule(s, forcedThrowRng(outcome, tier), 5)!.outcome).toBe(outcome);
    }
  });
});
