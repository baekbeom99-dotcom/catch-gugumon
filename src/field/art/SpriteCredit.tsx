/**
 * 그림 출처 표기 — 치비 그림 파일이 있을 때만 화면 아래에 작게 보인다.
 * 이미지가 없는 빌드에서는 아무것도 그리지 않는다. 표기는 권리를 주는 것이 아니다 (docs/sprite-license-audit.md).
 */
import { HERO_ART, LOCAL_SPRITES } from './localSprites';
import './spriteCredit.css';

export const SPRITE_CREDIT_TEXT = '비영리 학습용 팬 앱이에요 — 그림 속 캐릭터의 권리는 각 권리자에게 있고, 내려 달라는 요청이 있으면 내려요';

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
