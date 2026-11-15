/**
 * 그림 출처 표기 — SpriteCollab(PMD Collab) 스프라이트를 쓰고 있을 때만(이 PC에 이미지 파일이 있을 때) 화면 아래에 작게 보인다.
 * 이미지가 없는 배포본에서는 아무것도 그리지 않는다. 표기는 권리를 주는 것이 아니다 (docs/sprite-license-audit.md).
 */
import { LOCAL_SPRITES } from './localSprites';
import './spriteCredit.css';

export const SPRITE_CREDIT_TEXT =
  '구구몬 그림: SpriteCollab(PMD Collab, sprites.pmdcollab.org)의 스프라이트 — 원 그림 © CHUNSOFT·Nintendo·Game Freak 등 각 권리자, 커뮤니티 기여분 CC BY-NC 4.0 (이 PC 테스트용)';

/** 지금 쓰는 시트·그림이 하나라도 있나 */
export function hasSpriteCredit(sprites: object = LOCAL_SPRITES): boolean {
  return Object.keys(sprites).length > 0;
}

export function SpriteCredit() {
  if (!hasSpriteCredit()) return null;
  return (
    <p className="sprite-credit" role="note">
      {SPRITE_CREDIT_TEXT}
    </p>
  );
}
