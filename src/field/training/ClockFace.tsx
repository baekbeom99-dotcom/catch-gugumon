/**
 * 시계 읽기 문제의 시계 그림 (SVG) — 숫자 1~12, 눈금, 시침(분에 따라 조금씩 움직임), 분침.
 * 접근성: 시각을 읽어 주지 않는다(정답이 새면 안 된다). data-h·data-m은 테스트 보조 속성이다.
 */
import { CLOCK_SPOKEN } from './boardQuestion';

/** 시침·분침의 각도(도, 12시 방향이 0, 시계 방향). 시침은 분만큼 더 간다 (3:30 → 시침 105도) */
export function clockHandAngles(h: number, m: number): { hour: number; minute: number } {
  return { hour: (h % 12) * 30 + m * 0.5, minute: m * 6 };
}

/** 각도(도)와 반지름으로 시계 중심(50,50) 기준 점 */
function polar(deg: number, r: number): { x: number; y: number } {
  const a = (deg * Math.PI) / 180;
  return { x: 50 + r * Math.sin(a), y: 50 - r * Math.cos(a) };
}

const TICKS = Array.from({ length: 60 }, (_, i) => i);
const NUMBERS = Array.from({ length: 12 }, (_, i) => i + 1);

export function ClockFace({ h, m, size = 160 }: { h: number; m: number; size?: number }) {
  const { hour, minute } = clockHandAngles(h, m);
  const hourEnd = polar(hour, 22);
  const minuteEnd = polar(minute, 40);
  return (
    <svg
      className="clock-face"
      viewBox="0 0 100 100"
      width={size}
      height={size}
      role="img"
      aria-label={CLOCK_SPOKEN}
      data-h={h}
      data-m={m}
    >
      <circle cx="50" cy="50" r="47" style={{ fill: 'var(--paper)', stroke: 'var(--ink)' }} strokeWidth="3" />
      {TICKS.map((i) => {
        const big = i % 5 === 0;
        const a = polar(i * 6, 43.5);
        const b = polar(i * 6, big ? 39 : 41.5);
        return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} style={{ stroke: 'var(--ink)' }} strokeWidth={big ? 1.6 : 0.7} strokeLinecap="round" />;
      })}
      {NUMBERS.map((n) => {
        const p = polar(n * 30, 31.5);
        return (
          <text key={n} x={p.x} y={p.y} textAnchor="middle" dominantBaseline="central" fontSize="10" style={{ fill: 'var(--ink)', fontFamily: 'var(--font-display)' }}>
            {n}
          </text>
        );
      })}
      <line x1="50" y1="50" x2={hourEnd.x} y2={hourEnd.y} style={{ stroke: 'var(--ink)' }} strokeWidth="4.2" strokeLinecap="round" />
      <line x1="50" y1="50" x2={minuteEnd.x} y2={minuteEnd.y} style={{ stroke: 'var(--orange, #e8590c)' }} strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="50" cy="50" r="2.6" style={{ fill: 'var(--ink)' }} />
    </svg>
  );
}
