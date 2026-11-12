/**
 * 필드 모험 디버그 스위치 — 한곳에서 읽는다. E2E와 개발 중 브라우저 콘솔(또는 #/dev/field 화면)에서 켠다.
 *
 *   window.__GUGU_E2E_FIELD__ = true     풀숲 걸음마다 만남 · 캡슐 100%
 *   window.__GUGU_E2E_PATH__ = true      풀숲 밖 길 걸음마다 만남
 *   window.__GUGU_E2E_NO_WILD__ = true   강제하지 않은 야생 만남 끄기 (E2E 기본)
 *   window.__GUGU_E2E_NO_TIMER__ = true  전투 문제 시간이 줄지 않음
 *   window.__GUGU_E2E_TIER__ = 'mighty'  야생 강함 단계 고정 (weak·normal·strong·mighty, 레전드는 그대로)
 *   window.__GUGU_E2E_LEGEND__ = true    만남이 레전드 (12단이 열려 있을 때)
 *   window.__GUGU_E2E_QUESTION__ = { factId: '7x8', type: 'product' }   전투 문제 고정
 *   window.__GUGU_E2E_FAST__ = true      전투 정답이 늘 "빠르게"(강력·특수 발동). false면 늘 늦게. 없으면 실제 시간 (NO_TIMER와 함께 쓴다)
 *   window.__GUGU_E2E_COPY__ = true      잡거나 돌려보내면 기술 복사 100% (후보 중 첫 기술). false면 0% (E2E 기본). 없으면 2%
 *   window.__GUGU_E2E_THROW__ = 'healed'  캡슐 던지기 결과 고정 (caught·healed·escaped·angry)
 *
 * 새 스위치를 만들면 여기에 더하고 CLAUDE.md 'E2E 스위치' 줄도 고친다.
 */

import { TIER_CHANCE } from '../domain/field/tuning';
import type { WildTier } from '../domain/field/strength';
import type { ThrowOutcome } from '../domain/field/wildBattle';

export interface FieldDebugFlags {
  /** 만남·캡슐 100% */
  encounter: boolean;
  /** 길에서도 만남 100% */
  path: boolean;
  /** 강제하지 않은 야생 만남 끄기 */
  noWild: boolean;
  /** 문제 시간이 줄지 않음 */
  noTimer: boolean;
  /** 야생 강함 단계 고정 (레전드 만남은 그대로). 평소에는 null */
  tier: WildTier | null;
  /** 만남이 레전드 */
  legend: boolean;
  /** 전투 문제를 이 사실·모양으로 고정 (375px 배치 확인용). 평소에는 null */
  question: { factId: string; type: string } | null;
  /** "빠르게 풀었나" 고정: true 늘 빠르게, false 늘 늦게, null이면 실제 걸린 시간 */
  fast: boolean | null;
  /** 기술 복사 고정: true 늘 당첨, false 늘 꽝, null이면 실제 확률 */
  copy: boolean | null;
  /** 캡슐 던지기 결과 고정 (캡슐 연출 확인용). 평소에는 null */
  throwOutcome: ThrowOutcome | null;
}

interface DebugGlobals {
  __GUGU_E2E_FIELD__?: boolean;
  __GUGU_E2E_LEGEND__?: boolean;
  __GUGU_E2E_PATH__?: boolean;
  __GUGU_E2E_NO_WILD__?: boolean;
  __GUGU_E2E_NO_TIMER__?: boolean;
  __GUGU_E2E_TIER__?: string;
  __GUGU_E2E_QUESTION__?: { factId: string; type: string };
  __GUGU_E2E_FAST__?: unknown;
  __GUGU_E2E_COPY__?: unknown;
  __GUGU_E2E_THROW__?: unknown;
}

const g = () => globalThis as DebugGlobals;

export function debugFlags(): FieldDebugFlags {
  return {
    encounter: !!g().__GUGU_E2E_FIELD__,
    path: !!g().__GUGU_E2E_PATH__,
    noWild: !!g().__GUGU_E2E_NO_WILD__,
    noTimer: !!g().__GUGU_E2E_NO_TIMER__,
    tier: readTier(g().__GUGU_E2E_TIER__),
    legend: !!g().__GUGU_E2E_LEGEND__,
    question: g().__GUGU_E2E_QUESTION__ ?? null,
    fast: readSwitch(g().__GUGU_E2E_FAST__),
    copy: readSwitch(g().__GUGU_E2E_COPY__),
    throwOutcome: readThrow(g().__GUGU_E2E_THROW__),
  };
}

/** true·false만 받는다. 그 밖의 값은 null(실제 시간·실제 확률) */
function readSwitch(v: unknown): boolean | null {
  return v === true || v === false ? v : null;
}

const THROWS: readonly string[] = ['caught', 'healed', 'escaped', 'angry'];

/** 모르는 결과 이름은 무시한다 */
function readThrow(v: unknown): ThrowOutcome | null {
  return typeof v === 'string' && THROWS.includes(v) ? (v as ThrowOutcome) : null;
}

/** 모르는 단계 이름은 무시한다 */
function readTier(v: unknown): WildTier | null {
  return typeof v === 'string' && Object.prototype.hasOwnProperty.call(TIER_CHANCE, v) ? (v as WildTier) : null;
}

/** 개발 화면에서 스위치를 켜고 끈다 (새로고침하면 꺼진다) */
export function setDebugFlag(name: 'encounter' | 'path' | 'legend', on: boolean): void {
  if (name === 'encounter') g().__GUGU_E2E_FIELD__ = on;
  else if (name === 'path') g().__GUGU_E2E_PATH__ = on;
  else g().__GUGU_E2E_LEGEND__ = on;
}
