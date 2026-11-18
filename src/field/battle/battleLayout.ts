/**
 * 전투 무대 배치 (순수 계산) — 포켓몬 3세대처럼 적은 오른쪽 위(정면), 내 구구몬은 왼쪽 아래(뒷모습).
 * 무대(.wild__stage) 크기 w×h(CSS 픽셀)에 대한 비율로 정해서 휴대폰(375px)·넓은 화면 모두 같은 모양이 된다.
 * 크기는 그림 자리(정사각형 한 변) — 치비 그림은 이 자리에서 몸 높이를 맞춰 그리고, SVG 그림도 같은 자리를 쓴다.
 */
export const BATTLE_LAYOUT = {
  /** 적 그림 가운데: 무대 가로의 67% */
  foeX: 0.67,
  /** 내 구구몬 그림 가운데: 무대 가로의 30% */
  allyX: 0.3,
  /** 자리 크기: 무대 가로 비율, 그리고 무대 세로 비율 상한 */
  foeW: 0.41,
  foeMaxH: 0.45,
  allyW: 0.47,
  allyMaxH: 0.5,
  /** 적 자리 위쪽은 문제 말풍선(무대 왼쪽 위, 높이 약 76px) 아래에서 시작 */
  bubbleReserve: 82,
  /** 내 정보 상자 너비(.wild__ally-card, 무대 오른쪽 아래)와 그림 사이 틈 */
  allyCard: 168,
  gap: 6,
  /** 내 구구몬 발이 무대 아래에서 떨어진 거리 */
  allyFoot: 4,
} as const;

export interface BattleLayout {
  /** 적: 자리 크기, 가운데 x, 자리 위 y, 발 y */
  foe: number;
  foeCx: number;
  foeTop: number;
  foeFeet: number;
  /** 내 구구몬: 자리 크기, 가운데 x, 발 y */
  ally: number;
  allyCx: number;
  allyFeet: number;
}

export function battleLayout(w: number, h: number, L = BATTLE_LAYOUT): BattleLayout {
  const allyCx = Math.round(L.allyX * w);
  // 내 정보 상자(오른쪽 아래)와 겹치지 않게: 자리 오른쪽 끝 ≤ 상자 왼쪽 - 틈
  const allyRoom = 2 * (w - L.allyCard - L.gap - allyCx);
  const ally = Math.max(48, Math.round(Math.min(L.allyW * w, L.allyMaxH * h, allyRoom)));
  const foeCx = Math.round(L.foeX * w);
  // 무대 오른쪽 밖으로 나가지 않게
  let foe = Math.max(48, Math.round(Math.min(L.foeW * w, L.foeMaxH * h, 2 * (w - foeCx))));
  const foeTop = L.bubbleReserve;
  // 잔디 받침(자리의 0.12만큼 발 아래로 나옴)이 무대 아래 글 상자를 덮지 않게 발을 올린다
  const feetOf = (size: number) => Math.round(h - Math.max(L.allyFoot, size * 0.12 - 6));
  // 두 자리가 가로로 겹치면 적 발이 내 구구몬 머리(자리 위 + 여유 20px)보다 아래로 내려가지 않게 둘 다 조금씩 줄인다
  let a = ally;
  while (a > 48 && foe > 48 && foeCx - foe / 2 < allyCx + a / 2 && foeTop + foe > feetOf(a) - a + 20) {
    foe -= 2;
    a -= 2;
  }
  return { foe, foeCx, foeTop, foeFeet: foeTop + foe, ally: a, allyCx, allyFeet: feetOf(a) };
}
