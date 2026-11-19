import { describe, expect, it } from 'vitest';
import { otherPhaseKeys } from '../../src/field/art/npcSprite';
import { NPC_SPARKLE_PHASES } from '../../src/field/art/npcTint';

describe('NPC 반짝임 시트 미리 굽기', () => {
  it('한 모습을 구울 때 나머지 모든 모습의 열쇠(id:마스터:모습)가 나온다', () => {
    expect(otherPhaseKeys('dan2', 0)).toEqual([{ key: 'dan2:1:1', phase: 1 }]);
    expect(otherPhaseKeys('dan2', 1)).toEqual([{ key: 'dan2:1:0', phase: 0 }]);
    expect(otherPhaseKeys('x', 0)).toHaveLength(NPC_SPARKLE_PHASES - 1);
  });
});
