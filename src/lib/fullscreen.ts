/** 전체 화면 켜기·끄기 (브라우저 Fullscreen API). 화면 그림과 따로 둔 순수 함수라 가짜 document로 시험한다 */
import { useEffect, useState } from 'react';

type FsDoc = {
  fullscreenEnabled?: boolean;
  webkitFullscreenEnabled?: boolean;
  fullscreenElement?: Element | null;
  webkitFullscreenElement?: Element | null;
  exitFullscreen?: () => Promise<void> | void;
  webkitExitFullscreen?: () => Promise<void> | void;
};
type FsEl = {
  requestFullscreen?: () => Promise<void> | void;
  webkitRequestFullscreen?: () => Promise<void> | void;
};

/** 이 브라우저가 전체 화면을 켤 수 있나 (아이폰 사파리 등은 false) */
export function isFullscreenSupported(doc: FsDoc): boolean {
  return !!(doc.fullscreenEnabled || doc.webkitFullscreenEnabled);
}

/** 지금 전체 화면인가 */
export function isFullscreen(doc: FsDoc): boolean {
  return !!(doc.fullscreenElement || doc.webkitFullscreenElement);
}

/** 전체 화면을 켜고 끈다. 거절당해도 오류를 밖으로 내보내지 않는다 */
export async function toggleFullscreen(doc: FsDoc, el: FsEl): Promise<void> {
  try {
    if (isFullscreen(doc)) {
      await (doc.exitFullscreen ?? doc.webkitExitFullscreen)?.call(doc);
    } else {
      await (el.requestFullscreen ?? el.webkitRequestFullscreen)?.call(el);
    }
  } catch {
    /* 사용자 동작이 아니거나 막힌 경우: 조용히 넘어간다 */
  }
}

/** 전체 화면 상태를 따라간다 (Esc로 나가도 아이콘이 맞게 바뀜) */
export function useFullscreen(): { supported: boolean; active: boolean; toggle: () => void } {
  const doc = document as unknown as FsDoc;
  const [active, setActive] = useState(() => isFullscreen(doc));
  useEffect(() => {
    const sync = () => setActive(isFullscreen(document as unknown as FsDoc));
    document.addEventListener('fullscreenchange', sync);
    document.addEventListener('webkitfullscreenchange', sync);
    sync();
    return () => {
      document.removeEventListener('fullscreenchange', sync);
      document.removeEventListener('webkitfullscreenchange', sync);
    };
  }, []);
  return {
    supported: isFullscreenSupported(doc),
    active,
    toggle: () => void toggleFullscreen(doc, document.documentElement as unknown as FsEl),
  };
}
