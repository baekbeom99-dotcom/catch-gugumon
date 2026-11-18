import { describe, expect, it } from 'vitest';
import { hasSpriteCredit, SPRITE_CREDIT_TEXT } from '../../src/field/art/SpriteCredit';

describe('그림 출처 표기', () => {
  it('등록된 그림이 없으면(이미지 없는 배포본) 표기를 그리지 않는다', () => {
    expect(hasSpriteCredit({}, null)).toBe(false);
    expect(hasSpriteCredit({ c034: {} }, null)).toBe(true);
    expect(hasSpriteCredit({}, { front: '017' })).toBe(true);
  });
  it('이 PC 테스트용 그림이고 원작 권리는 각 권리자에게 있다고 적는다', () => {
    for (const w of ['비영리', '각 권리자']) expect(SPRITE_CREDIT_TEXT).toContain(w);
  });
});
