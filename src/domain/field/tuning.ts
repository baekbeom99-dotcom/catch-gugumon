/**
 * 필드 모험 운영 수치 — 값을 바꿀 때는 이 파일만 고친다.
 * 각 규칙 파일(encounter·wildBattle·growth…)은 여기 값을 가져다 쓰고, 테스트는 그 값으로 규칙을 확인한다.
 * 값을 바꾸면 tests/field/tuning.test.ts의 고정값도 함께 고치고, MVP_DESIGN.md 변경 이력에 한 줄 남긴다.
 */
import type { SpecialKind } from './skills';

// ── 만남 ──
/** 풀숲 한 걸음에 만날 확률 */
export const ENCOUNTER_CHANCE_GRASS = 0.3;
/** 풀숲 밖 길 한 걸음에 만날 확률 */
export const ENCOUNTER_CHANCE_PATH = 0.04;
/** 전투가 끝난 뒤 이 걸음 수 안에는 만나지 않음 */
export const ENCOUNTER_GRACE_STEPS = 3;
/** 만났을 때 레전드일 확률(12단 열린 뒤에만) */
export const LEGEND_CHANCE = 0.02;
/** 아직 못 본 종이 뽑힐 가중치(본 종은 1) */
export const UNSEEN_WEIGHT = 2;
/** 레전드(황금) 구구몬 레벨 — 다른 단계 레벨은 TIER_RULES.levels로 동행 레벨에서 정한다 */
export const LEGEND_LEVEL = 20;

// ── 출제 ──
/** 기술 버튼(보기) 개수 */
export const FIELD_CHOICES = 3;

// ── 성장 ──
export const MAX_LEVEL = 30;
/** 같은 종을 또 잡았을 때 */
export const DUPLICATE_EXP = 40;
/** 전투에 나간 동행이 받는 기본 경험치 */
export const PARTICIPATION_EXP = 10;
/** 그 전투에서 맞힌 문제마다 */
export const CORRECT_EXP = 2;
/** 다음 레벨까지 필요한 경험치 = EXP_BASE + 레벨 × EXP_PER_LEVEL */
export const EXP_BASE = 20;
export const EXP_PER_LEVEL = 10;
/** 진화하는 레벨: 2단계 Lv8, 3단계 Lv18 */
export const EVOLVE_LEVELS = { 2: 8, 3: 18 } as const;

// ── 화면 연출 시간 (ms) — 규칙 결과에는 영향 없음 ──
/** 한 걸음 걷는 시간 */
export const STEP_MS = 180;
/** 이보다 짧게 누르면 걷지 않고 방향만 바꾼다 */
export const TURN_TAP_MS = 120;
/** 이 안에 떼면(가운데에서 안 끌었을 때) 탭으로 쳐서 글·알림을 닫는다 */
export const TAP_CLOSE_MS = 300;
/** 만남 → 전투 화면으로 넘어가기 전 번쩍이는 시간 */
export const ENCOUNTER_FLASH_MS = 800;
/** "나타났다!" 글이 떠 있는 시간 (탭하면 바로 넘김) */
export const WILD_INTRO_MS = 1200;
/** 정답 기술 연출 시간 (이동안 시간은 멈춘다) */
export const WILD_HIT_ANIM_MS = 600;
/** 주②의 효과(스턴·회복·방어) 그림·소리는 기술이 맞은 뒤 이만큼 늦게 (두 소리가 한꺼번에 겹치지 않게, 명중 연출 안) */
export const SKILL_EFFECT_DELAY_MS = 250;
/** 도망갔다·잡았다 글을 보여 주고 필드로 돌아가기까지 */
export const WILD_END_MS = 1500;
/**
 * 캡슐 던지기 연출 (잡힘 기준 모두 더해 3초): 던짐 → 머리에 맞음 → 빨려듦 → 바닥으로 낙하 → 통통 → 흔들림 3번 → 결과.
 * 결과는 던지는 순간 이미 정해져 있고, 연출만 거기에 맞춘다.
 */
export const CAPSULE_SHAKES = 3;
export const CAPSULE_SHAKE_MS = 400;
export const CAPSULE_THROW_MS = 500;
/** 캡슐이 구구몬 머리에 닿는 순간 */
export const CAPSULE_HIT_MS = 150;
export const CAPSULE_ABSORB_MS = 400;
/** 머리 높이에서 바닥까지 떨어지는 시간 */
export const CAPSULE_FALL_MS = 300;
/** 바닥에서 한 번 통통 */
export const CAPSULE_BOUNCE_MS = 300;
/** 결과(찰칵·열림)를 보여 주는 시간 */
export const CAPSULE_RESULT_MS = 150;
/** 실패하면 몇 번째 흔들림 끝에서 캡슐이 열리나 (잡힘은 세 번 다 흔든다) */
export const CAPSULE_POP_AT = { healed: 1, escaped: 2, angry: 2 } as const;
/** 필드 불러오기 화면을 적어도 이만큼은 보여준다 */
export const MIN_LOADING_MS = 600;
/** 물결 그림이 바뀌는 시간 */
export const WATER_FRAME_MS = 500;

// ── 마을에서 돌아다니는 구구몬 ──
/** 가만히 서 있는 시간 범위 */
export const ROAM_IDLE_MIN_MS = 1500;
export const ROAM_IDLE_MAX_MS = 3000;
/** 한 칸 걷는 시간 / 점프 / 잠 */
export const ROAM_MOVE_MS = 360;
export const ROAM_JUMP_MS = 600;
export const ROAM_SLEEP_MS = 5000;
/** 다음 모션을 고르는 가중치 */
export const ROAM_WEIGHTS = { move: 0.6, idle: 0.25, jump: 0.1, sleep: 0.05 };
/** 말풍선이 떠 있는 시간 */
export const ROAM_BUBBLE_MS = 2500;

// ── 야생 강함 4단계 (설계서 6-1) ──
/** 만났을 때 단계 확률(합 1) */
export const TIER_CHANCE = { weak: 0.15, normal: 0.65, strong: 0.15, mighty: 0.05 } as const;
/**
 * 단계별 규칙. levels는 동행 레벨에 더하는 값 범위(legend는 레벨 고정이라 null),
 * timeMs 문제 시간, hitsToDizzy 어지러워지는 정답 수, damage 우리 몬스터가 받는 피해,
 * expScale 경험치 배율, ultimateCatch 끝내 잡을 확률.
 */
export const TIER_RULES = {
  weak: { levels: [-5, -3], timeMs: 7000, hitsToDizzy: 3, damage: 10, expScale: 0.6, ultimateCatch: 0.3 },
  normal: { levels: [-1, 1], timeMs: 7000, hitsToDizzy: 4, damage: 13, expScale: 1, ultimateCatch: 0.25 },
  strong: { levels: [3, 5], timeMs: 5000, hitsToDizzy: 4, damage: 17, expScale: 1.6, ultimateCatch: 0.15 },
  mighty: { levels: [6, 9], timeMs: 5000, hitsToDizzy: 6, damage: 25, expScale: 3, ultimateCatch: 0.1 },
  legend: { levels: null, timeMs: 7000, hitsToDizzy: 4, damage: 17, expScale: 3, ultimateCatch: 0.1 },
} as const;
/** 캡슐을 던질 때 한 번에 빠져나올 확률 / 화낼 확률 */
export const THROW_ESCAPE = 0.21;
export const THROW_ANGRY = 0.03;
/** 동행 몬스터 체력 */
export const COMPANION_MAX_HP = 100;
/** 문제 시간이 이만큼 남으면 빨갛게 */
export const TIMER_WARN_MS = 2000;
/** 야생 몬스터가 공격하는 연출 시간 */
export const WILD_FOE_ATTACK_MS = 700;
/** 상처 목록에 남기는 최근 문제 수 */
export const WOUNDS_MAX = 10;

// ── 캡슐 (설계서 4절·5절) ──
/** 처음 갖고 시작하는 캡슐 (옛 저장도 업데이트 때 같은 개수) */
export const CAPSULE_START = { meadow: 3, waterside: 3, desert: 3, legend: 0 } as const;
/** 상점에서 캡슐 연습(문제 9개)을 끝까지 풀면 받는 캡슐 수 (Task 17: 3 → 5) */
export const CAPSULE_REWARD = 5;
/** 캡슐은 한 종류에 이만큼까지만 (손으로 고친 저장의 터무니없는 수를 막는다) */
export const CAPSULE_MAX = 999;

// ── 상점 연습 (설계서 5절·7절) ──
/** 회복약: 상처 문제를 하나하나 이만큼 바퀴 동안 맞혀야 낫는다 */
export const HEAL_ROUNDS = 3;
/** 새 문제가 뜬 뒤 이 시간 동안은 보기가 눌리지 않는다 (연타로 다음 문제까지 답해 버리는 것을 막는다) */
export const SHOP_ANSWER_GUARD_MS = 300;

// ── 기술 (필드 모험 3차 설계서 2절) ──
/** 구구몬 한 마리가 가질 수 있는 기술 수 */
export const MAX_SKILLS = 5;
/** 잡거나 보낸 뒤 그 야생 구구몬의 기술을 따라 배울 확률 */
export const COPY_CHANCE = 0.02;
/** 야생 체력 한 칸 단위: 정답 한 번(위력 2칸)이 예전의 "한 번 깎임" */
export const CELLS_PER_HIT = 2;
/**
 * 부속성 자리 기술의 "빨리 풀기" 비율 (설계서 0-1절): 이 시간 안에 풀면 부속성 기술, 넘으면 주속성 1번.
 * 복사해 부속성 자리에 넣은 다른 종 기술도 원래 비율 대신 이 값을 쓴다.
 * (개정 3에서 "빨리 풀면 +1칸"은 없어졌다 — 빨리 풀면 윗단계 기술이 나가는 것이 그 몫)
 */
export const SUB_FAST_RATIO = 0.5;
/** 정답 한 번에 깎는 칸의 위쪽 한계 */
export const MAX_CHIP_CELLS = 4;
/** 특수 기술: 회복 체력 / 여유로 늘어나는 문제 시간 */
export const SPECIAL_HEAL = 25;
export const CALM_BONUS_MS = 3000;
/** 특수 기술 충전: 다음 속성 기술에 더하는 칸 (겹쳐 쌓이지 않음) */
export const CHARGE_BONUS_CELLS = 1;
/** 캡슐에서 빠져나오면 최대 칸의 이만큼(올림)을 되찾는다 — 약함 3·보통 4·강함 4·강력 6칸 */
export const CAPTURE_FAIL_HEAL_RATIO = 0.5;

// ── 전투 규칙 4 (필드 모험 3차 설계서 0-2절) ──
/** 크리티컬 확률: 내 공격은 깎는 칸 ×2, 적 공격은 내게 오는 피해 ×2 */
export const CRIT_CHANCE = 0.1;
export const CRIT_MULT = 2;
/** 크리티컬일 때 한 번에 깎는 칸의 위쪽 한계 */
export const MAX_CHIP_CRIT_CELLS = 8;
/** 회피 확률: 공격이 빗나가 피해 0 (내 공격·적 공격 똑같이) */
export const DODGE_CHANCE = 0.05;
/** 정답으로 이만큼 때릴 때마다 적이 한 번 자동으로 공격한다 */
export const ENEMY_ATTACK_EVERY = 2;
/** 야생 남은 체력이 최대의 이만큼 이하가 되면 캡슐을 던질 수 있다 */
export const CAPSULE_ACTIVE_RATIO = 0.25;
/** 같은 야생에게 캡슐이 실패할 때마다 잡힘 확률에 더하는 값 */
export const CATCH_PER_FAIL = 0.1;
/** 야생이 기절(스턴)해 있으면 잡힘 확률에 더하는 값 */
export const CATCH_STATUS_BONUS = 0.1;
/** 잡힘 확률의 위쪽 한계 */
export const CATCH_CAP = 0.7;
/**
 * 특수효과 성공 확률: 특수 버튼 효과와 주②에 붙은 효과는 조건을 채워도 이 확률로만 성공한다.
 * 실패해도 공격 칸은 그대로 들어간다. (회복·방어·스턴은 사용자 지시, 나머지는 가정)
 */
export const SPECIAL_SUCCESS: Record<SpecialKind, number> = {
  heal: 0.9,
  guard: 0.9,
  stun: 0.5,
  clue: 0.8,
  calm: 0.8,
  charge: 0.7,
};
