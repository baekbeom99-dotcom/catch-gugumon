/** 전투 화면의 막대들: 체력 막대(야생·내 구구몬)와 문제 시간 막대 */
import type { Ref } from 'react';
import { TIMER_WARN_MS } from '../../domain/field/tuning';
import { stopPosition, tierAt, type GaugeStop } from './skillUse';

/** 체력 막대. ratio는 0~1 */
export function HpBar({ label, ratio, low = false }: { label: string; ratio: number; low?: boolean }) {
  const r = Math.min(1, Math.max(0, ratio));
  return (
    <div className={`wild__hp ${low ? 'wild__hp--low' : ''}`} role="img" aria-label={label}>
      <span className="wild__hp-fill" style={{ width: `${r * 100}%` }} />
    </div>
  );
}

const TIER_MARK = { 1: '①', 2: '②', 3: '③' } as const;

interface TimerProps {
  ms: number;
  totalMs: number;
  fillRef?: Ref<HTMLSpanElement>;
  /** 고른 버튼의 기술이 바뀌는 기점 (경과 시간 기준, gaugeStops) — 없으면 예전처럼 한 가지 색 */
  stops?: readonly GaugeStop[];
  /** 문제를 시작한 뒤 흐른 시간 (지금 나갈 단계 = 막대 색) */
  elapsedMs?: number;
  /** 고르기 버튼 안의 작은 미리보기 (시계가 아니라 그림) */
  preview?: boolean;
}

/**
 * 문제 시간 막대. 남은 시간이 TIMER_WARN_MS 이하이면 테두리가 빨갛게 (1번 구간이면 채움도 빨강).
 * 기점이 있으면 눈금(세로 선)과 구간마다 단계 번호(③·②·①)를 그리고, 막대 색은 지금 나갈 단계(data-tier)를 뜻한다.
 * 기점은 경과 시간으로 고정이라 여유로 시간이 늘어나도(totalMs가 커져도) 판정과 같은 순간에 지난다.
 * 매 프레임 다시 그리지 않도록 화면은 초나 단계가 바뀔 때만 다시 그리고, 채움 너비는 fillRef로 직접 줄인다.
 */
export function TimerBar({ ms, totalMs, fillRef, stops = [], elapsedMs = 0, preview = false }: TimerProps) {
  const warn = !preview && ms <= TIMER_WARN_MS;
  const tier = tierAt(stops, elapsedMs);
  const top = stops.reduce<1 | 2 | 3>((t, s) => (s.tier > t ? s.tier : t), 1);
  const staged = stops.length > 0;
  // 기점 자리 (왼쪽 끝부터 비율). 구간: [0, 첫 눈금] = ①, … , [마지막 눈금, 1] = 가장 윗단계
  const marks = [...stops].map((s) => ({ ...s, pos: stopPosition(s.atMs, totalMs) })).sort((a, b) => a.pos - b.pos);
  const zones = staged
    ? [0, ...marks.map((m) => m.pos)].map((from, i) => ({
        from,
        to: i < marks.length ? marks[i].pos : 1,
        tier: (i === 0 ? 1 : marks[i - 1].tier) as 1 | 2 | 3,
      }))
    : [];
  const cls = [
    'wild__timer',
    staged ? 'wild__timer--staged' : '',
    warn ? 'wild__timer--warn' : '',
    staged && tier < top ? 'wild__timer--dropped' : '',
    preview ? 'wild__timer--preview' : '',
  ]
    .filter(Boolean)
    .join(' ');
  const fill = Math.min(1, Math.max(0, ms / totalMs)) * 100;
  const body = (
    <>
      {preview ? (
        // 미리보기: 구간마다 그 단계 색을 칠해 둔다 (시간이 안 가니 채움 대신)
        zones.map((z) => (
          <span
            key={`c${z.tier}`}
            className={`wild__timer-zone wild__timer-zone--${z.tier}`}
            style={{ left: `${z.from * 100}%`, width: `${(z.to - z.from) * 100}%` }}
          />
        ))
      ) : (
        <span ref={fillRef} className="wild__timer-fill" style={{ width: `${fill}%` }} />
      )}
      {marks.map((m) => (
        <span key={`t${m.atMs}-${m.tier}`} className="wild__timer-tick" style={{ left: `${m.pos * 100}%` }} />
      ))}
      {zones.map((z) =>
        z.to - z.from > 0.001 ? (
          <span
            key={`z${z.tier}`}
            className={`wild__timer-mark wild__timer-mark--${z.tier}`}
            style={{ left: `${((z.from + z.to) / 2) * 100}%` }}
          >
            {TIER_MARK[z.tier]}
          </span>
        ) : null,
      )}
    </>
  );
  if (preview) {
    return (
      // 버튼 안에 들어가므로 span (버튼 안에는 div를 못 넣는다)
      <span className={cls} data-tier={tier} aria-hidden>
        {body}
      </span>
    );
  }
  return (
    <div className={cls} data-tier={tier} role="timer" aria-label={`남은 시간 ${Math.ceil(ms / 1000)}초`}>
      {body}
    </div>
  );
}
