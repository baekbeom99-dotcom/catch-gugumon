/**
 * 주소 이사 설정. 배포 때 `VITE_MIGRATE_TO=<새 주소>`를 주면 이 빌드는 게임 대신 "이사했어요" 화면만 보여 준다
 * (옛 주소용 빌드). 없으면 평소 게임이다 — 새 주소는 이 값을 주지 않는다.
 */
const raw = (import.meta.env.VITE_MIGRATE_TO as string | undefined)?.trim();

/** 옛 주소 빌드일 때만 새 주소(끝 `/` 없음), 아니면 빈 글 */
export const MIGRATE_TO: string = raw ? raw.replace(/\/+$/, '') : '';

export const isMigrationBuild = (): boolean => MIGRATE_TO !== '';
