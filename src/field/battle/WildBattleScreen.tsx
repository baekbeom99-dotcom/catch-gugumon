/**
 * 야생 전투 화면 — 설계서 6절·8절, 필드 모험 3차 2-6·5절. 규칙은 domain/field/wildBattle.ts, 이 화면은 연출·저장·시간만 맡는다.
 * 기술 버튼(주속성·부속성·특수, 최대 3개)이 2개 이상이면 문제마다 먼저 버튼을 고르고(SkillPicker), 보기 버튼은 답 숫자만 보인다.
 * 맞힌 속도로 그 버튼의 어떤 기술이 나갈지 정해지고(pickFired), 시간 막대에 그 기점(눈금)과 지금 나갈 단계 색이 보인다.
 * 문제가 떠 있을 때만 시간이 흐른다(인트로·기술 고르기·명중·피격·힌트·어지러움·도망 확인창·가려진 탭에서는 멈춤).
 */
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Navigate } from 'react-router-dom';
import { playSfx, type Sfx } from '../../audio/sfx';
import { DAN_COLORS } from '../../art/colors';
import type { MonsterMood } from '../../art/MonsterSprite';
import { HintPanel } from '../../components/HintPanel';
import { QuestionView } from '../../components/QuestionView';
import { capsuleFor } from '../../domain/field/capsules';
import { speciesDef } from '../../domain/field/creatures';
import { ELEMENT_FX, SPECIAL_FX, elementOf, subElementOf } from '../../domain/field/elements';
import { createAnswerTimer, elapsedMs, pauseTimer, resumeTimer, startTimer } from '../../domain/field/answerTimer';
import { displayName } from '../../domain/field/growth';
import type { Encounter } from '../../domain/field/encounter';
import {
  CAPSULE_ABSORB_MS,
  CAPSULE_BOUNCE_MS,
  CAPSULE_POP_AT,
  CAPSULE_RESULT_MS,
  CAPSULE_SHAKE_MS,
  CAPSULE_SHAKES,
  CAPSULE_THROW_MS,
  COMPANION_MAX_HP,
  SKILL_EFFECT_DELAY_MS,
  SPECIAL_HEAL,
  TIER_RULES,
  TIMER_WARN_MS,
  WILD_END_MS,
  WILD_FOE_ATTACK_MS,
  WILD_HIT_ANIM_MS,
  WILD_INTRO_MS,
} from '../../domain/field/tuning';
import {
  answerWild,
  createWild,
  strikeDamage,
  healAlly,
  hiddenChoice,
  pickSkill,
  releaseWild,
  resumeWild,
  throwCapsule,
  tick,
  wildHpRatio,
  type ThrowOutcome,
  type WildState,
} from '../../domain/field/wildBattle';
import { M2_EFFECT_OF_SPECIES, buttonFace, skillButtons, type SkillButton, type SkillDef } from '../../domain/field/skills';
import type { FactId } from '../../domain/facts';
import { forcedThrowRng } from '../../domain/field/strength';
import type { Rng } from '../../domain/random';
import { useGameStore, type WildEnd } from '../../store/useGameStore';
import { useSessionStore } from '../../store/useSessionStore';
import { creatureSprite } from '../art/creatureSprite';
import { CapsuleBall } from '../art/CapsuleBall';
import { pickCompanion } from '../companion';
import { debugFlags } from '../debugFlags';
import { playFx, preloadFx } from '../fx/playFx';
import type { FxName } from '../fx/effects';
import { endWildBattle, useFieldSession } from '../useFieldSession';
import { HpBar, TimerBar } from './BattleBars';
import { battleText } from './battleText';
import { SkillPicker } from './SkillPicker';
import {
  answerWithSkill,
  clockRuns,
  effectPlan,
  foeSkill,
  gaugeStops,
  heldSkills,
  hitMessage,
  nowText,
  readyText,
  skillFxName,
  skillMatchup,
  skillSfxPlan,
  tierAt,
  type GaugeStop,
} from './skillUse';
import { useQuestionFeed } from './useQuestionFeed';
import '../../screens/battle.css';
import './wildBattle.css';

const rng: Rng = Math.random;

/** 기술 복사 난수: 디버그 스위치가 있으면 고정 */
const copyRng = (forced: boolean | null): Rng => (forced === true ? () => 0 : forced === false ? () => 1 : rng);
const COMPANION_COLOR = DAN_COLORS[5];

/** 캡슐 던지기 연출 단계: 던짐 → 빨려듦 → 통통 → 흔들림 → 결과 (E2E는 data-capsule-stage로 읽는다) */
type CapsuleStage = 'throw' | 'absorb' | 'bounce' | 'shake' | 'result';
interface CapsuleShow {
  stage: CapsuleStage;
  outcome: ThrowOutcome;
  /** 이 던지기에서 흔드는 횟수 (잡힘은 3번, 실패는 열릴 때까지) */
  shakes: number;
}

/** 단계마다 공 애니메이션 시간(·흔들림 횟수)을 tuning 값으로 */
function capsuleBallStyle(stage: CapsuleStage | null, shakes: number): CSSProperties | undefined {
  switch (stage) {
    case 'throw':
      return { animationDuration: `${CAPSULE_THROW_MS}ms` };
    case 'absorb':
      return { animationDuration: `${CAPSULE_ABSORB_MS}ms` };
    case 'bounce':
      return { animationDuration: `${CAPSULE_BOUNCE_MS}ms` };
    case 'shake':
      return { animationDuration: `${CAPSULE_SHAKE_MS}ms`, animationIterationCount: shakes };
    case 'result':
      return { animationDuration: `${CAPSULE_RESULT_MS}ms` };
    default:
      return undefined;
  }
}

/** 끝난 단계 → 정산의 끝 모양 (직접 도망치기는 quit) */
function endOf(w: WildState, quit: boolean): WildEnd | null {
  if (quit) return 'quit';
  if (w.phase === 'caught' || w.phase === 'escaped' || w.phase === 'released' || w.phase === 'fainted') return w.phase;
  return null;
}

/** 시간 막대를 다시 그려야 하는 변화(초가 바뀜·빨개짐·기점을 지나 단계가 바뀜)인가 */
function timerChanged(a: WildState, b: WildState, stops: readonly GaugeStop[]): boolean {
  return (
    Math.ceil(a.timeLeftMs / 1000) !== Math.ceil(b.timeLeftMs / 1000) ||
    a.timeLeftMs <= TIMER_WARN_MS !== b.timeLeftMs <= TIMER_WARN_MS ||
    tierAt(stops, a.elapsedMs) !== tierAt(stops, b.elapsedMs)
  );
}

export function WildBattleScreen() {
  const encounter = useFieldSession((s) => s.encounter);
  // 새로고침 등으로 만남이 사라졌으면 필드로
  if (!encounter) return <Navigate to="/field" replace />;
  return <WildBattle encounter={encounter} />;
}

function WildBattle({ encounter }: { encounter: Encounter }) {
  const { recordAnswer, markSeen } = useGameStore.getState();
  // 싸우는 구구몬은 전투 내내 같은 종 (만남 레벨을 굴린 종과 같은 헬퍼)
  const [companion] = useState(() => pickCompanion(useGameStore.getState()));
  const companionStage = useGameStore((s) => s.field.species[companion]?.stage ?? 1);
  const companionLevel = useGameStore((s) => s.field.species[companion]?.level ?? 1);
  const wildDef = speciesDef(encounter.species);
  // 이 야생을 잡는 캡슐 종류 (화나서 강력해져도 종 기준이라 그대로)와 남은 수
  const capsuleType = capsuleFor(encounter.species);
  const capsulesLeft = useGameStore((s) => s.field.capsules[capsuleType]);
  const allyName = displayName(companion, companionStage);
  // 가진 기술은 전투를 시작할 때 정해 두고 전투 중에는 바뀌지 않는다
  const [held] = useState(() => heldSkills(companion, useGameStore.getState().field.species[companion]));
  const heldIds = useMemo(() => held.map((d) => d.id), [held]);
  // 기술 버튼 최대 3개 (주속성·부속성·특수, 가진 것만)
  const buttons = useMemo(() => skillButtons(heldIds, companion), [heldIds, companion]);
  /** 지금 쓰는 버튼 (버튼이 하나면 그것). 틀려서 힌트 뒤 같은 문제를 다시 풀 때도 그대로 */
  const buttonRef = useRef<SkillButton>(buttons[0]);
  const [picked, setPicked] = useState<SkillButton>(buttons[0]);

  const { item, fact, question, key, next } = useQuestionFeed(encounter, rng);
  const itemRef = useRef(item);
  itemRef.current = item;

  const wildRef = useRef<WildState | null>(null);
  if (!wildRef.current) {
    wildRef.current = createWild(
      encounter.tier,
      encounter.level,
      useGameStore.getState().field.species[companion]?.hp ?? COMPANION_MAX_HP,
      buttons.length,
    );
  }
  const [wild, setWildState] = useState<WildState>(wildRef.current);
  // ref를 바로 바꿔 두면 같은 순간의 두 번째 클릭은 'question'이 아니라서 무시된다
  const setWild = useCallback((w: WildState) => {
    if (w === wildRef.current) return;
    wildRef.current = w;
    setWildState(w);
  }, []);

  const [intro, setIntro] = useState(() => wildRef.current!.phase !== 'fainted');
  const [confirmQuit, setConfirmQuit] = useState(false);
  const [quit, setQuit] = useState(false);
  const wildNameNow = battleText.tierName(wildDef.name, wild.tier);
  const [message, setMessage] = useState(() => battleText.appear(battleText.tierName(wildDef.name, encounter.tier), wildDef.legend));
  const [hitCount, setHitCount] = useState(0);
  /** 맞은 횟수 (내 구구몬 흔들림을 다시 틀기 위한 key) */
  const [struckCount, setStruckCount] = useState(0);
  /** 캡슐이 흔들리는 중: 결과가 나올 때까지 아무것도 흐르지 않는다 */
  const [throwing, setThrowing] = useState(false);
  /** 같은 순간의 두 번째 누름을 막는다 (state는 다시 그린 뒤에야 바뀐다) */
  const throwingRef = useRef(false);
  /** 캡슐 연출이 지금 어느 단계인지 (보기만 하는 값. 결과는 던질 때 이미 정해졌다) */
  const [capsule, setCapsule] = useState<CapsuleShow | null>(null);
  const settledRef = useRef(false);
  /** 이 전투에서 맞아서 쓰러졌나 (쓰러짐 글을 공격 연출 뒤에 보인다) */
  const struckDownRef = useRef(false);
  /** 방금 적이 기절해서 공격하지 못했다 (맞는 흔들림 대신 기절 그림) */
  const [stunBlocked, setStunBlocked] = useState(false);
  const [battleStartedAt] = useState(() => Date.now());
  const answeredFacts = useRef(new Set<FactId>());
  /** 답하는 데 걸린 시간: 도망 확인창·가려진 화면 동안은 멈춘다 */
  const timerRef = useRef(createAnswerTimer());
  const timerFillRef = useRef<HTMLSpanElement>(null);
  const timers = useRef<number[]>([]);
  const later = useCallback((fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms));
  }, []);
  useEffect(() => () => timers.current.forEach((t) => clearTimeout(t)), []);

  // 효과(기술·잡기): 구구몬 발치에서 틀어 준다. 보기만 하는 것이라 시간·결과와 상관없다
  const stageRef = useRef<HTMLElement>(null);
  const fxRef = useRef<HTMLCanvasElement>(null);
  const wildElement = elementOf(encounter.species);
  useEffect(() => {
    // 내 기술 효과 + 주②의 효과(스턴·회복·방어) + 적이 기절했을 때 그림 + 야생 구구몬의 속성 기술 효과(주·부속성 4칸)를 미리 불러 둔다
    const names = [
      ...held.map((d) => skillFxName(d)),
      SPECIAL_FX[M2_EFFECT_OF_SPECIES[companion]],
      SPECIAL_FX.stun,
      ...ELEMENT_FX[wildElement],
      ...ELEMENT_FX[subElementOf(encounter.species)],
    ];
    preloadFx('hit', 'catch', ...new Set(names));
  }, [held, companion, wildElement, encounter.species]);
  /**
   * 두 구구몬(.wild__foe 야생·.wild__ally 내 구구몬) 중 `side` 쪽 그림(이름 상자 말고 그림)의 가로 한가운데, 세로는 위에서 yFrac (캔버스 안 CSS px) —
   * 효과 중심을 놓을 자리 (보통 한가운데 0.5, 기절 별은 머리 쪽)
   */
  const fxPoint = useCallback((side: 'foe' | 'ally', yFrac = 0.5) => {
    const stage = stageRef.current;
    const box = stage?.querySelector(`.wild__${side}`);
    const art = box?.firstElementChild ?? box;
    if (!stage || !art) return null;
    const s = stage.getBoundingClientRect();
    const f = art.getBoundingClientRect();
    return { x: f.left - s.left + f.width / 2, y: f.top - s.top + f.height * yFrac };
  }, []);
  /** 캡슐로 잡았을 때 야생 구구몬 위에서 */
  const catchFx = useCallback(() => {
    const canvas = fxRef.current;
    const at = fxPoint('foe');
    if (canvas && at) void playFx(canvas, 'catch', at, { gold: speciesDef(encounter.species).legend });
  }, [fxPoint, encounter.species]);
  /**
   * 기술 효과: 나간 기술(`def`, skillDef 기준)의 효과를 맞는 쪽 구구몬 그림 한가운데에 효과 중심이 오게 튼다.
   * 윗단계(upper)여도 그림은 그 기술의 칸 그대로(ELEMENT_FX), 소리만 fxPower가 겹친다.
   * 내 공격(왼→오)은 야생 위에 효과 기본 방향, 적 공격(오→왼)은 내 구구몬 위에 뒤집어서, 특수 기술은 쓴 구구몬 위에 그대로. 내 공격이 효과를 못 틀면(불러오기 실패) 불꽃으로 대신한다.
   */
  const moveFx = useCallback(
    (attacker: 'ally' | 'foe', def: SkillDef, upper: boolean, matchupValue: -1 | 0 | 1 | null = null) => {
      // 효과음: 효과 그림과 같은 순간 (그림을 못 틀어도 소리는 난다)
      for (const name of skillSfxPlan(attacker, def, upper, matchupValue)) playSfx(name);
      const canvas = fxRef.current;
      if (!canvas) return;
      const ally = attacker === 'ally';
      const name = skillFxName(def);
      // 특수 기술(회복·방어·힌트·여유·충전)은 쓴 구구몬 자신 위에서, 방향 없이
      const onSelf = !!def.special;
      const at = fxPoint(onSelf === ally ? 'ally' : 'foe');
      if (!at) return;
      const gold = speciesDef(ally ? companion : encounter.species).legend;
      void playFx(canvas, name, at, { mirror: !ally && !onSelf, gold }).then((ok) => {
        if (ok || !ally || onSelf) return;
        const hitAt = fxPoint('foe');
        if (hitAt) void playFx(canvas, 'hit', hitAt);
      });
    },
    [companion, encounter.species, fxPoint],
  );
  /**
   * 효과 하나를 한쪽 구구몬 위에 방향 없이 튼다 (주②의 스턴·회복·방어, 기절해서 못 움직임). 소리도 같은 순간.
   * 기절 별은 머리 쪽(위에서 25%)에, 나머지는 한가운데. 색은 효과를 낸 내 구구몬 기준(황금이면 금색)
   */
  const sideFx = useCallback(
    (fx: FxName, sfx: Sfx, on: 'foe' | 'ally') => {
      playSfx(sfx);
      const canvas = fxRef.current;
      const at = fxPoint(on, fx === SPECIAL_FX.stun ? 0.25 : 0.5);
      if (canvas && at) void playFx(canvas, fx, at, { gold: speciesDef(companion).legend });
    },
    [companion, fxPoint],
  );

  useEffect(() => {
    markSeen(encounter.species);
  }, [markSeen, encounter.species]);

  // 시작 글: 1.2초 뒤 자동으로 넘어간다
  useEffect(() => {
    if (!intro) {
      const w = wildRef.current!;
      // 고르기면 고르기 제목("어떤 기술을 쓸까?")이 있으니 글 칸은 나타났다 글 그대로
      if (w.phase === 'question') setMessage(readyText(buttonRef.current, TIER_RULES[w.tier].timeMs));
      return;
    }
    const t = window.setTimeout(() => setIntro(false), WILD_INTRO_MS);
    return () => clearTimeout(t);
  }, [intro]);

  /** 학습 기록: 고르는 순간(시간 초과는 그 순간) 바로 저장한다 (전투 중 앱을 닫아도 남게) */
  const record = useCallback(
    (correct: boolean, ms: number, retryAfterHint = false) => {
      const it = itemRef.current;
      recordAnswer({
        factId: it.factId,
        type: it.type,
        correct,
        ms,
        inputMode: 'choice',
        // 틀린 뒤 힌트를 보고 같은 문제를 다시 푼 답은 재출제처럼 센다 (빛나는 답을 보고 맞혀도 상자가 오르지 않게)
        isRetry: it.isRetry || retryAfterHint,
        firstAttemptInBattle: !answeredFacts.current.has(it.factId),
        battleStartedAt,
        now: Date.now(),
        source: 'field',
      });
      answeredFacts.current.add(it.factId);
    },
    [recordAnswer, battleStartedAt],
  );

  /**
   * 적의 공격 (오답·시간 초과): 문제에서 struck/fainted로 바뀐 순간 한 번만 불린다.
   * 체력·상처는 이 순간 저장되고(쓰러지면 자리도 마을로), 연출 뒤 힌트로 간다. 쓰러졌으면 힌트 없이 끝(R9).
   */
  const onStruck = useCallback(
    (before: WildState, s: WildState) => {
      const it = itemRef.current;
      // 저장할 피해는 화면(도메인)과 같은 값: 공격 전 상태로 계산한다 (스턴이면 0이라 저장도 상처도 그대로)
      const dmg = strikeDamage(before);
      if (dmg > 0) useGameStore.getState().damageCompanion(companion, dmg, { factId: it.factId, type: it.type });
      setStruckCount((n) => n + 1);
      const foeName = battleText.tierName(wildDef.name, s.tier);
      if (before.stun) {
        // 스턴: 적이 기절해서 공격하지 못했다 (피해 0 — 저장·상처도 그대로). 적 공격 그림 대신 머리 위 기절 별, 막는 소리
        setStunBlocked(true);
        sideFx(SPECIAL_FX.stun, 'skillGuard', 'foe');
        setMessage(battleText.stunBlocked(foeName));
      } else {
        // 적의 기술: 그 레벨에서 익힌 속성 기술 중 무작위 (피해는 단계 값, 방어는 strikeDamage가 반영)
        const foe = foeSkill(encounter.species, s.level, rng);
        moveFx('foe', foe, false);
        setMessage(battleText.foeAttack(foeName, foe.name));
      }
      if (s.phase === 'fainted') {
        struckDownRef.current = true;
        return;
      }
      const timedOut = s.timedOut;
      later(() => {
        if (settledRef.current) return; // 그 사이 도망쳐 끝났으면 끝 글을 덮지 않는다
        setStunBlocked(false);
        setWild(resumeWild(wildRef.current!));
        setMessage(timedOut ? battleText.timeUp : battleText.miss(buttonFace(buttonRef.current).name));
      }, WILD_FOE_ATTACK_MS);
    },
    [companion, encounter.species, moveFx, sideFx, later, setWild, wildDef],
  );
  const onStruckRef = useRef(onStruck);
  onStruckRef.current = onStruck;

  const ending = endOf(wild, quit);
  const noTimer = debugFlags().noTimer;
  // 캡슐에서 빠져나오거나 화난 결과를 보여 주는 동안(throwing)은 문제가 떠 있어도 시계가 멈춘다
  const running = clockRuns({ intro, confirmQuit, ending: !!ending, phase: wild.phase, noTimer, throwing });
  // 고른 버튼의 기술이 바뀌는 기점 (그 단계 문제 시간 기준 — 여유로 늘어난 시간은 넣지 않아 판정과 같다)
  const stops = useMemo(() => gaugeStops(picked, TIER_RULES[wild.tier].timeMs), [picked, wild.tier]);
  const stopsRef = useRef(stops);
  stopsRef.current = stops;

  // 문제 시계: 화면이 가려져 있으면 흐르지 않는다. 시간이 다 되면 tick이 struck/fainted로 바꾼다
  useEffect(() => {
    if (!running) return;
    let raf = 0;
    let last = performance.now();
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = document.hidden ? 0 : now - last;
      last = now;
      const prev = wildRef.current!;
      const t = tick(prev, dt, rng);
      if (t === prev) return;
      wildRef.current = t;
      const fill = timerFillRef.current;
      if (fill) fill.style.width = `${(t.timeLeftMs / t.limitMs) * 100}%`;
      if (t.phase !== 'question') {
        // 시간 초과: 오답처럼 기록하고(R8) 적이 공격한다
        setWildState(t);
        record(false, TIER_RULES[t.tier].timeMs, prev.missed);
        onStruckRef.current(prev, t);
        return;
      }
      // 매 프레임 다시 그리지 않는다: 초가 바뀌거나 빨개지거나 기점을 지날 때만
      if (timerChanged(prev, t, stopsRef.current)) setWildState(t);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [running, record]);

  const asking = !intro && wild.phase === 'question';
  const inHint = wild.phase === 'hint';
  // 힌트 특수: 이 문제에서 숨길 틀린 보기 하나 (문제가 바뀔 때 한 번 뽑는다)
  const hiddenAt = useMemo(
    () => (wild.hideChoice ? hiddenChoice(question.choices, question.answer, rng) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key, wild.hideChoice],
  );
  const hideIndex = asking || inHint ? hiddenAt : null;
  useEffect(() => {
    if (asking) timerRef.current = startTimer(timerRef.current, performance.now());
  }, [key, asking]);
  useEffect(() => {
    const sync = () => {
      const now = performance.now();
      timerRef.current = document.hidden || confirmQuit ? pauseTimer(timerRef.current, now) : resumeTimer(timerRef.current, now);
    };
    sync();
    document.addEventListener('visibilitychange', sync);
    return () => document.removeEventListener('visibilitychange', sync);
  }, [confirmQuit, key, asking]);

  // 끝: 결과를 저장하고(전투당 한 번), 글을 잠깐 보여 준 뒤 필드로 (만남이 지워지면 화면이 알아서 돌아간다)
  useEffect(() => {
    if (!ending) return;
    const w = wildRef.current!;
    let newSpecies = false;
    if (!settledRef.current) {
      settledRef.current = true;
      // 정산은 끝났을 때의 단계·레벨로 (화나서 강력이 되었으면 강력 값, R12)
      const r = useGameStore.getState().finishWildBattle({
        species: encounter.species,
        companion,
        level: w.level,
        tier: w.tier,
        end: ending,
        correct: w.correct,
        now: Date.now(),
        // 기술 복사 스위치: true 늘 당첨(후보 중 첫 기술), false 늘 꽝
        rng: copyRng(debugFlags().copy),
      });
      newSpecies = r.newSpecies;
      if (r.evolvedTo) useSessionStore.getState().set({ pendingEvolution: r.evolvedTo });
      if (r.levelUp) useSessionStore.getState().set({ pendingLevelUp: r.levelUp });
      if (r.notices.length) {
        const ss = useSessionStore.getState();
        ss.set({ pendingFieldNotices: [...ss.pendingFieldNotices, ...r.notices] });
      }
      // 기술이 가득 차서 못 가진 새 기술은 선택창 대기열로 (저장 안 됨)
      if (r.offers.length) useSessionStore.getState().pushSkillOffer(...r.offers);
    }
    const name = battleText.tierName(wildDef.name, w.tier);
    const text =
      ending === 'caught'
        ? battleText.caught(name, newSpecies)
        : ending === 'escaped'
          ? battleText.escaped(name)
          : ending === 'released'
            ? battleText.noCapsule
            : ending === 'fainted'
              ? battleText.fainted(allyName)
              : battleText.quit;
    // 맞아서 쓰러졌으면 적의 공격 글을 잠깐 보인 뒤
    const delay = ending === 'fainted' && struckDownRef.current ? WILD_FOE_ATTACK_MS : 0;
    const t1 = window.setTimeout(() => setMessage(text), delay);
    const t2 = window.setTimeout(endWildBattle, delay + WILD_END_MS);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
    // 끝 모양이 정해지면 한 번만 (이름 등은 그 순간 값)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ending]);

  // B 버튼(키보드 X·Esc) → 도망칠지 묻기
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'KeyX' || e.key === 'Escape') setConfirmQuit((v) => v || !(ending || throwing));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [ending, throwing]);

  /** 어지러워졌다: 맞는 캡슐이 없으면 버튼 없이 돌려보낸다 (R18, 다른 종류 캡슐은 못 쓴다) */
  const onDizzy = useCallback(
    (w: WildState) => {
      if (useGameStore.getState().field.capsules[capsuleType] <= 0) setWild(releaseWild(w));
    },
    [capsuleType, setWild],
  );

  /** 기술 고르기: 고른 버튼으로 문제 시계를 시작한다 */
  const onPickSkill = (button: SkillButton) => {
    const w = wildRef.current!;
    if (intro || confirmQuit || throwing || w.phase !== 'pick') return;
    buttonRef.current = button;
    setPicked(button);
    setWild(pickSkill(w));
    setMessage(readyText(button, TIER_RULES[w.tier].timeMs));
  };

  /** 답 고르기 (보기 버튼 i번) */
  const onAnswer = (i: number) => {
    const w = wildRef.current!;
    if (intro || confirmQuit || throwing || w.phase !== 'question' || i === hideIndex) return;
    const correct = question.choices[i] === question.answer;
    const ms = Math.round(elapsedMs(timerRef.current, performance.now()));

    if (!correct) {
      const after = answerWild(w, false, rng);
      setWild(after);
      record(false, ms, w.missed);
      onStruck(w, after);
      return;
    }
    const button = buttonRef.current;
    const r = answerWithSkill(w, button, heldIds, wildElement, debugFlags().fast);
    let after = r.state;
    let healed = 0;
    if (r.special === 'heal') {
      // 회복(특수 버튼 성공이나 주②의 효과): 내 구구몬 체력을 채우고 바로 저장한다 (스토어 한 번). 글에는 실제로 늘어난 만큼만
      after = healAlly(after, SPECIAL_HEAL);
      healed = after.allyHp - r.state.allyHp;
      useGameStore.getState().restoreCompanionHp(companion, SPECIAL_HEAL);
    }
    setWild(after);
    record(true, ms, w.missed);
    setHitCount((n) => n + 1);
    // 윗단계(주②·주③·부속성)가 나가면 fxPower 소리 (특수 발동·대신 나간 기술은 upper가 아님). 그림은 나간 기술의 칸 그대로
    moveFx('ally', r.fired, r.upper, skillMatchup(r.fired, wildElement));
    // 주②의 효과(스턴·회복·방어): 기술이 맞은 조금 뒤에 효과 그림·소리
    const effect = effectPlan(r);
    if (effect) later(() => sideFx(effect.fx, effect.sfx, effect.on), SKILL_EFFECT_DELAY_MS);
    const text = hitMessage(r, wildElement, healed, button.kind);
    // 이 문제에서 틀렸었으면 다음으로 넘어갈 때 틀린 사실을 몇 문제 뒤에 다시 넣는다
    const retryWrong = w.missed;
    setMessage(text);
    if (after.phase === 'hit') {
      later(() => {
        if (settledRef.current) return;
        // 다음 문제: 기술이 2개 이상이면 고르기부터 (글은 방금 맞힌 글을 그대로 둔다)
        setWild(resumeWild(wildRef.current!, buttons.length));
        next(retryWrong);
      }, WILD_HIT_ANIM_MS);
    } else if (after.phase === 'dizzy') {
      setMessage(`${text}\n${battleText.dizzy(battleText.tierName(wildDef.name, after.tier))}`);
      next(retryWrong);
      onDizzy(after);
    }
  };

  /** 힌트의 빛나는 답을 누르면 같은 문제를 같은 기술로 다시 푼다 (설계 2-6). 틀린 사실은 맞힌 뒤 넘어갈 때 다시 넣는다 */
  const onHintPick = () => {
    if (wildRef.current!.phase !== 'hint') return;
    setWild(resumeWild(wildRef.current!));
    setMessage(battleText.retry);
  };

  const onCapsule = () => {
    const w = wildRef.current!;
    if (w.phase !== 'dizzy' || throwing || throwingRef.current) return;
    // 결과는 던지는 순간 정해 두고, 연출은 거기에 맞춰 보여 준다 (E2E 만남 스위치면 언제나 잡히고, 결과 스위치가 있으면 그 결과)
    const flags = debugFlags();
    const roll = flags.throwOutcome ? forcedThrowRng(flags.throwOutcome, w.tier) : flags.encounter ? () => 0 : rng;
    const thrown = throwCapsule(w, roll, companionLevel, buttons.length);
    if (!thrown) return;
    // 맞는 캡슐 1개를 던지는 순간 바로 저장해 쓴다 (결과와 상관없이). 없으면 돌려보낸다
    if (!useGameStore.getState().spendCapsule(capsuleType)) {
      setWild(releaseWild(w));
      return;
    }
    throwingRef.current = true;
    setThrowing(true);
    setMessage(battleText.throwCapsule);

    const { outcome } = thrown;
    const shakes = outcome === 'caught' ? CAPSULE_SHAKES : CAPSULE_POP_AT[outcome];
    const show = (stage: CapsuleStage) => setCapsule({ stage, outcome, shakes });
    let t = 0;
    show('throw');
    playSfx('throw');
    t += CAPSULE_THROW_MS;
    later(() => {
      show('absorb');
      playSfx('capsuleOpen');
    }, t);
    t += CAPSULE_ABSORB_MS;
    later(() => {
      show('bounce');
      playSfx('capsuleBounce');
    }, t);
    t += CAPSULE_BOUNCE_MS;
    later(() => show('shake'), t);
    for (let k = 0; k < shakes; k++) later(() => playSfx('capsuleShake'), t + k * CAPSULE_SHAKE_MS);
    t += shakes * CAPSULE_SHAKE_MS;
    // 결과: 잡히면 찰칵, 아니면 뻥 하고 열려 야생 구구몬이 튀어나온다
    later(() => {
      show('result');
      const after = thrown.state;
      const name = battleText.tierName(wildDef.name, after.tier);
      if (outcome === 'caught') {
        playSfx('capsuleClick');
        later(() => playSfx('capture'), 180);
        catchFx();
      } else {
        playSfx('capsulePop');
      }
      switch (outcome) {
        case 'caught':
          setWild(after);
          break;
        case 'healed':
          // 빠져나와 힘을 조금 되찾고 문제(기술이 2개 이상이면 고르기)로 돌아간다 (화남과 같이 다음 문제는 이미 넘겨 두었다). 체력 막대는 부드럽게 차오른다
          setWild(after);
          setHitCount((n) => n + 1);
          setMessage(battleText.healed);
          break;
        case 'escaped':
          setWild(after);
          break;
        case 'angry':
          // 강력해져서 체력을 다 채우고 문제(기술이 2개 이상이면 고르기)로 돌아간다. 다음 문제는 어지러워질 때 이미 넘겨 두었으니(말풍선이 안 보여 아직 안 낸 문제)
          // 여기서 또 넘기지 않는다 — 넘기면 끼워 둔 틀린 문제(insertRetry)를 건너뛸 수 있다. 시간은 throwCapsule이 처음부터로 돌려 둔다
          setWild(after);
          setHitCount((n) => n + 1);
          setMessage(battleText.angry(name));
          break;
      }
    }, t);
    // 결과를 잠깐 보여 준 뒤 연출 끝 (그때까지 다른 입력은 막힌다)
    later(() => {
      throwingRef.current = false;
      setThrowing(false);
      setCapsule(null);
    }, t + CAPSULE_RESULT_MS);
  };
  const hpRatio = wildHpRatio(wild);
  const picking = !intro && wild.phase === 'pick';
  const timeMs = TIER_RULES[wild.tier].timeMs;
  // 내 구구몬에 남아 있는 특수 효과 (다음 문제·다음 공격에 쓰인다)
  const buffs = [
    wild.guard && battleText.buff.guard,
    wild.charge > 0 && battleText.buff.charge,
    (wild.calmMs > 0 || ((asking || picking) && wild.limitMs > timeMs)) && battleText.buff.calm,
    wild.hideChoice && battleText.buff.clue,
  ].filter((b): b is string => !!b);
  const dizzy = wild.phase === 'dizzy';
  // 적이 기절해 공격하지 못했으면 맞는 흔들림·공격 움직임은 없다
  const struck = (wild.phase === 'struck' && !stunBlocked) || (wild.phase === 'fainted' && struckCount > 0);
  const wildMood: MonsterMood =
    wild.phase === 'hit' ? 'hit' : dizzy ? 'sleep' : wild.phase === 'caught' ? 'happy' : 'idle';
  const strongCard = wild.tier === 'strong' ? 'wild__card--strong' : wild.tier === 'mighty' ? 'wild__card--mighty' : '';
  const gone = ending === 'escaped' || ending === 'released' || ending === 'quit';
  // 캡슐 연출: 공이 보이는 동안(실패로 열린 뒤에는 사라진다. 잡힌 뒤에는 닫힌 채 그대로) 야생 그림은 숨는다
  const stage = capsule?.stage ?? null;
  const caughtShow = capsule?.outcome === 'caught' || (!capsule && wild.phase === 'caught');
  const ballShown = capsule ? stage !== 'result' || caughtShow : wild.phase === 'caught';
  const foeHidden = ballShown && stage !== 'throw' && stage !== 'absorb';
  const popped = stage === 'result' && !caughtShow;

  return (
    <div className={`wild ${wildDef.legend ? 'wild--legend' : ''}`}>
      <header className="wild__top">
        <button
          type="button"
          className="btn btn--ghost wild__run"
          aria-label="도망치기"
          disabled={!!ending || throwing}
          onClick={() => setConfirmQuit(true)}
        >
          🏃 도망
        </button>
        <div className={`wild__card ${strongCard}`}>
          <div className="wild__name">
            {wildNameNow} <small>Lv{wild.level}</small>
            {wild.stun && (
              <span className="wild__buff wild__buff--foe" aria-label="남은 효과 기절">
                {battleText.buff.stun}
              </span>
            )}
          </div>
          <HpBar label={`야생 체력 ${Math.round(hpRatio * 100)}`} ratio={hpRatio} />
        </div>
      </header>

      <section ref={stageRef} data-species={encounter.species} data-capsule-stage={stage ?? undefined} className={`wild__stage ${wildDef.legend ? 'wild__stage--legend' : ''} ${intro ? 'wild__stage--intro' : ''} ${intro && wildDef.legend ? 'wild__stage--sparkle' : ''}`}>
        {asking || inHint ? (
          <div className="wild__bubble" data-fact={item.factId}>
            {asking && (
              <TimerBar key={key} ms={wild.timeLeftMs} totalMs={wild.limitMs} fillRef={timerFillRef} stops={stops} elapsedMs={wild.elapsedMs} />
            )}
            <QuestionView display={question.display} />
          </div>
        ) : null}
        {inHint ? (
          <div className="wild__hint">
            <HintPanel fact={fact} type={item.type} />
          </div>
        ) : (
          <>
            <div
              key={`w${hitCount}`}
              className={`wild__foe ${wild.phase === 'hit' ? 'wild__foe--hit' : ''} ${struck ? 'wild__foe--attack' : ''} ${gone ? 'wild__foe--gone' : ''} ${stage === 'absorb' ? 'wild__foe--absorb' : ''} ${foeHidden ? 'wild__foe--capsule' : ''} ${popped ? 'wild__foe--pop' : ''}`}
              style={stage === 'absorb' ? { animationDuration: `${CAPSULE_ABSORB_MS}ms` } : undefined}
            >
              {creatureSprite(encounter.species, { view: 'front', mood: wildMood, color: DAN_COLORS[encounter.dan], size: 150 })}
            </div>
            {ballShown && (
              <div
                key={stage ?? 'rest'}
                className={`wild__capsule-ball wild__capsule-ball--${stage ?? 'rest'}`}
                aria-hidden
                style={capsuleBallStyle(stage, capsule?.shakes ?? 0)}
              >
                <CapsuleBall type={capsuleType} size={64} />
              </div>
            )}
            <div key={`a${hitCount}-${struckCount}`} className={`wild__ally ${wild.phase === 'hit' ? 'wild__ally--attack' : ''} ${struck ? 'wild__ally--struck' : ''}`}>
              {creatureSprite(companion, { view: 'back', stage: companionStage, color: COMPANION_COLOR, size: 120 })}
            </div>
          </>
        )}
        <canvas ref={fxRef} className="wild__fx" aria-hidden />
      </section>

      <div className="wild__ally-card">
        <div className="wild__ally-name">
          {allyName} <small>Lv{companionLevel}</small>
          {buffs.length > 0 && (
            <span className="wild__buffs" aria-label={`남은 효과 ${buffs.join(' ')}`}>
              {buffs.map((b) => (
                <span key={b} className="wild__buff">
                  {b}
                </span>
              ))}
            </span>
          )}
        </div>
        <HpBar label={`내 체력 ${wild.allyHp}`} ratio={wild.allyHp / COMPANION_MAX_HP} low={wild.allyHp <= TIER_RULES[wild.tier].damage} />
      </div>

      <p className="wild__message" role="status" onClick={() => intro && setIntro(false)}>
        {message}
      </p>

      <section className="wild__actions">
        {intro ? (
          <button type="button" className="btn btn--primary wild__next" onClick={() => setIntro(false)}>
            싸우자!
          </button>
        ) : dizzy ? (
          <button type="button" className="btn btn--primary wild__capsule" aria-label="캡슐 던지기" disabled={throwing} onClick={onCapsule}>
            <CapsuleBall type={capsuleType} size={28} /> {battleText.throwButton(capsulesLeft)}
          </button>
        ) : ending ? null : picking ? (
          <SkillPicker buttons={buttons} timeMs={timeMs} wildMain={wildElement} disabled={confirmQuit} onPick={onPickSkill} />
        ) : (
          <>
            {inHint ? (
              <p className="hint-instruction">{battleText.hintInstruction}</p>
            ) : (
              <p className="wild__skill-now">{nowText(picked, timeMs)}</p>
            )}
            <div className="wild__answers">
              {question.choices.map((num, i) => {
                const glow = inHint && num === question.answer;
                const gone = hideIndex === i;
                return (
                  <button
                    key={i}
                    type="button"
                    className={`wild-move ${glow ? 'wild-move--glow' : ''} ${gone ? 'wild-move--gone' : ''}`}
                    aria-label={gone ? '숨긴 답' : `답 ${num}`}
                    disabled={throwing || gone || (inHint ? !glow : !asking)}
                    onClick={() => (inHint ? onHintPick() : onAnswer(i))}
                  >
                    {gone ? <span className="wild-move__gone">✕</span> : <span className="wild-move__num">{num}</span>}
                  </button>
                );
              })}
            </div>
          </>
        )}
      </section>

      {confirmQuit && (
        <div className="modal" role="dialog" aria-modal="true" aria-label="도망치기">
          <div className="modal__card">
            <p className="modal__title">도망칠까요?</p>
            <p className="modal__body">맞힌 문제 기록은 저장돼요.</p>
            <div className="modal__actions">
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => {
                  setConfirmQuit(false);
                  setQuit(true);
                }}
              >
                도망갈래
              </button>
              <button type="button" className="btn btn--primary" onClick={() => setConfirmQuit(false)}>
                계속 싸우기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
