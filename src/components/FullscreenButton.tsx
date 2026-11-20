/** 전체 화면 아이콘 버튼 (글자 없음). 이 브라우저가 전체 화면을 못 하면 아예 그리지 않는다 */
import { useFullscreen } from '../lib/fullscreen';
import './fullscreenButton.css';

export function FullscreenButton({ className = '' }: { className?: string }) {
  const { supported, active, toggle } = useFullscreen();
  if (!supported) return null;
  const label = active ? '전체 화면 끝내기' : '전체 화면';
  return (
    <button type="button" className={`fsbtn ${className}`.trim()} aria-label={label} title={label} data-testid="fullscreen-btn" onClick={toggle}>
      <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        {active ? (
          <path d="M9 3v6H3M15 3v6h6M9 21v-6H3M15 21v-6h6" />
        ) : (
          <path d="M3 9V3h6M21 9V3h-6M3 15v6h6M21 15v6h-6" />
        )}
      </svg>
    </button>
  );
}
