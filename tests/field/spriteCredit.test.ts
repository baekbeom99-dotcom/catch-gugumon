import { describe, expect, it } from 'vitest';
import { hasSpriteCredit, SPRITE_CREDIT_TEXT } from '../../src/field/art/SpriteCredit';

describe('그림 출처 표기', () => {
  it('등록된 그림이 없으면(이미지 없는 배포본) 표기를 그리지 않는다', () => {
    expect(hasSpriteCredit({})).toBe(false);
    expect(hasSpriteCredit({ c034: {} })).toBe(true);
  });
  it('원 그림 권리자와 SpriteCollab·라이선스 이름이 들어 있다', () => {
    for (const w of ['SpriteCollab', 'CHUNSOFT', 'CC BY-NC 4.0']) expect(SPRITE_CREDIT_TEXT).toContain(w);
  });
});
