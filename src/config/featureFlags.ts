/** 퀴즈 모험(펫·탐험·상점 탭 등) 켜기. 다시 열려면 true로 바꾼다 — 화면과 저장 데이터는 그대로 남아 있다. */
export const QUIZ_ADVENTURE_ENABLED = false;

const QUIZ_ROOTS = ['/pet', '/explore', '/shop', '/records', '/dex', '/battle', '/practice', '/hatch', '/welcome'];

/**
 * 퀴즈 모험이 켜져 있는가. E2E에서는 window.__GUGU_E2E_QUIZ__ (true·false)가 있으면 그것을 따른다.
 * 없으면 배포 설정(QUIZ_ADVENTURE_ENABLED). 화면을 그릴 때마다 읽는다.
 */
export function isQuizEnabled(): boolean {
  const v = (globalThis as { __GUGU_E2E_QUIZ__?: unknown }).__GUGU_E2E_QUIZ__;
  return typeof v === 'boolean' ? v : QUIZ_ADVENTURE_ENABLED;
}

/** 이 경로를 열어도 되는가 (퀴즈 모험이 꺼져 있으면 퀴즈 경로와 그 하위 경로만 막는다) */
export function isRouteEnabled(path: string, quizEnabled: boolean = isQuizEnabled()): boolean {
  if (quizEnabled) return true;
  const clean = path.split(/[?#]/)[0];
  return !QUIZ_ROOTS.some((root) => clean === root || clean.startsWith(`${root}/`));
}
