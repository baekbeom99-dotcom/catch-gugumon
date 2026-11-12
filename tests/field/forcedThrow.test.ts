import { describe, expect, it } from 'vitest';
import { forcedThrowRng } from '../../src/domain/field/strength';
import { createWild, maxCells, throwCapsule } from '../../src/domain/field/wildBattle';
import type { ThrowOutcome } from '../../src/domain/field/wildBattle';

describe('E2E용 던지기 결과 고정 난수', () => {
  it.each(['weak', 'normal', 'strong', 'mighty', 'legend'] as const)('%s: 정한 결과가 그대로 나온다 (실패 수·기절로 확률이 바뀌어도)', (tier) => {
    for (const outcome of ['caught', 'healed', 'escaped', 'angry'] as ThrowOutcome[]) {
      for (const [throwTries, stun] of [[0, false], [3, false], [2, true], [9, true]] as const) {
        const s = { ...createWild(tier, 5, 100), phase: 'dizzy' as const, cells: maxCells(tier), throwTries, stun };
        expect(throwCapsule(s, forcedThrowRng(outcome, tier, throwTries, stun), 5)!.outcome).toBe(outcome);
      }
    }
  });
});
