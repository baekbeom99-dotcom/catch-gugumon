/**
 * 그림 출처 표기 — 이 PC에 치비 그림 파일이 있을 때만 화면 아래에 작게 보인다.
 * 이미지가 없는 배포본에서는 아무것도 그리지 않는다. 표기는 권리를 주는 것이 아니다 (docs/sprite-license-audit.md).
 */
import { HERO_ART, LOCAL_SPRITES } from './localSprites';
import './spriteCredit.css';

export const SPRITE_CREDIT_TEXT = '이 PC 테스트용 그림 — 그림 속 원작 캐릭터의 권리는 각 권리자에게 있어요 (공개 배포에는 넣지 않음)';

/** 지금 쓰는 그림(구구몬·주인공)이 하나라도 있나 */
export function hasSpriteCredit(sprites: object = LOCAL_SPRITES, hero: unknown = HERO_ART): boolean {
  return Object.keys(sprites).length > 0 || !!hero;
}

export function SpriteCredit() {
  if (!hasSpriteCredit()) return null;
  return (
    <p className="sprite-credit" role="note">
      {SPRITE_CREDIT_TEXT}
    </p>
  );
}
