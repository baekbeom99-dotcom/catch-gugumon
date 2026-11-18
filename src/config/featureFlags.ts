/** 퀴즈 모험(펫·탐험·상점 탭 등) 켜기. 다시 열려면 true로 바꾼다 — 화면과 저장 데이터는 그대로 남아 있다. */
export const QUIZ_ADVENTURE_ENABLED = false;

const QUIZ_ROOTS = ['/pet', '/explore', '/shop', '/records', '/dex', '/battle', '/practice', '/hatch', '/welcome'];

/** 이 경로를 열어도 되는가 (퀴즈 모험이 꺼져 있으면 퀴즈 경로와 그 하위 경로만 막는다) */
export function isRouteEnabled(path: string, quizEnabled: boolean = QUIZ_ADVENTURE_ENABLED): boolean {
  if (quizEnabled) return true;
  const clean = path.split(/[?#]/)[0];
  return !QUIZ_ROOTS.some((root) => clean === root || clean.startsWith(`${root}/`));
}
