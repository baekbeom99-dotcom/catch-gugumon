/**
 * 필드 모험 운영 수치 — 값을 바꿀 때는 이 파일만 고친다.
 * 각 규칙 파일(encounter·wildBattle·growth…)은 여기 값을 가져다 쓰고, 테스트는 그 값으로 규칙을 확인한다.
 * 값을 바꾸면 tests/field/tuning.test.ts의 고정값도 함께 고치고, MVP_DESIGN.md 변경 이력에 한 줄 남긴다.
 */
import type { SpecialKind } from './skills';
import type { CapsuleType } from './capsules';
import type { ArithLevel } from '../arith';
import type { ClockLevel } from './clock';
import type { FieldId } from './fields';
import { PRACTICE_MASTER_SEC_PER_Q } from '../arithPractice';

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
/** 내 두 번째 공격 연출이 끝난 뒤, 적의 주기 공격이 시작되기까지 잠깐 쉬는 시간 (입력은 그동안도 막힘) */
export const WILD_COUNTER_GAP_MS = 500;
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
/** 회복약 연습 한 바퀴에 나오는 문제 수 (지금까지 틀린 문제 중 최근 것부터, 모자라면 그 구구몬 필드 문제로 채움) */
export const HEAL_QUESTIONS = 5;
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
/** 야생 남은 체력이 1/4(CAPSULE_ACTIVE_RATIO) 아래로 내려갈수록 잡힘 확률에 더하는 값: 1/4에서 0, 체력 0에서 이 값까지 직선으로 오른다 (소폭) */
export const CATCH_LOW_HP_BONUS = 0.1;
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
/** 주②(두 번째 속성 기술)에 붙은 회복 효과의 성공 확률 — 특수 버튼의 회복(SPECIAL_SUCCESS.heal)보다 낮다. 실패해도 공격 칸은 그대로 들어간다 */
export const M2_HEAL_SUCCESS = 0.5;

// ── 트레이닝센터 ──
/** 훈련할 수 있는 단 (10·11단은 없고 9단 다음은 12·13단) */
export const TRAINING_DANS = [2, 3, 4, 5, 6, 7, 8, 9, 12, 13] as const;
export type TrainingDan = (typeof TRAINING_DANS)[number];
/** 마스터 도전: 9문제를 모두 맞히고 이 시간(밀리초) 안에 끝내야 한다 */
export const TRAINING_MASTER_MS = 27_000;
/** 마지막 답의 효과·흔들림을 잠깐 보여 준 뒤 결과 화면으로 넘어가는 시간 (밀리초) */
export const TRAINING_RESULT_DELAY_MS = 700;
/** 마스터 도전에서 남은 시간이 이만큼(밀리초) 이하면 시계가 빨개진다 */
export const TRAINING_WARN_MS = 5000;
/** 트레이닝 시계가 한 프레임에 셀 수 있는 최대 시간 (밀리초, 탭에 돌아온 직후 긴 틈을 한꺼번에 세지 않게) */
export const TRAINING_MAX_FRAME_MS = 100;
/** 성공(학습을 끝까지 마침·도전 합격)하면 받는 캡슐 개수. 도전에 실패하면 없다 */
export const TRAINING_CAPSULES = 5;
/** 그 단(셈연습은 그 단계)을 처음 마스터한 도전에서 받는 캡슐 개수 (5개를 더하지 않고 이것만) */
export const TRAINING_FIRST_MASTER_CAPSULES = 20;
/** 훈련 보상 캡슐 종류 (2~9단은 그 단이 나오는 필드, 12·13단은 황금) */
export const TRAINING_CAPSULE_OF_DAN: Record<TrainingDan, CapsuleType> = {
  2: 'meadow',
  3: 'waterside',
  4: 'meadow',
  5: 'desert',
  6: 'waterside',
  7: 'desert',
  8: 'meadow',
  9: 'waterside',
  12: 'legend',
  13: 'legend',
};
/** 무한의 계단이 열리는 조건: 이 단을 마스터한 뒤 (null이면 항상 열림) */
export const STAIRS_OPEN_AFTER_DAN: TrainingDan | null = null;

// ── 셈연습 트레이너 (마스터 도전만) ──
/** 셈연습 트레이너 단계: 기본·고수·보수 (처음부터 모두 열림) */
export const ARITH_TRAINER_LEVELS = ['basic', 'hard', 'comp'] as const satisfies readonly ArithLevel[];
/** 셈연습 도전 문제 수 */
export const ARITH_TRAINER_QUESTIONS = 9;
/** 셈연습 마스터: 하나도 안 틀리고 이 시간(밀리초) 안에 (셈 연습 MASTER 기준과 같다 — 문제당 기본·보수 3초, 고수 5초) */
export const ARITH_TRAINER_MASTER_MS: Record<ArithLevel, number> = {
  basic: PRACTICE_MASTER_SEC_PER_Q.basic * ARITH_TRAINER_QUESTIONS * 1000,
  hard: PRACTICE_MASTER_SEC_PER_Q.hard * ARITH_TRAINER_QUESTIONS * 1000,
  comp: PRACTICE_MASTER_SEC_PER_Q.comp * ARITH_TRAINER_QUESTIONS * 1000,
};
/** 셈연습 보상 캡슐은 이 중에서 무작위 (황금은 없음) */
export const ARITH_CAPSULE_CHOICES = ['meadow', 'waterside', 'desert'] as const satisfies readonly CapsuleType[];

// ── 시계 읽기 트레이너 (마스터 도전만, 보상 캡슐은 ARITH_CAPSULE_CHOICES에서 무작위) ──
/** 시계 읽기 도전 문제 수 */
export const CLOCK_TRAINER_QUESTIONS = 9;
/** 시계 읽기 마스터: 하나도 안 틀리고 이 시간(밀리초) 안에 — 정각 30초·5분 45초·1분 60초 */
export const CLOCK_TRAINER_MASTER_MS: Record<ClockLevel, number> = {
  hour: 30_000,
  five: 45_000,
  one: 60_000,
};
/**
 * 마을 지도 맨 위에 새로 넣은 줄 수 (트레이닝센터 거리: 새 줄 10 − 옛 맨 윗벽 1). 예전 저장의 마을 자리를 이만큼 아래로 옮긴다.
 */
export const TOWN_ROWS_ADDED = 9;

// ── 별점수 (코스튬을 살 화폐 — src/config/featureFlags.ts의 STAR_POINTS_ENABLED가 켜져야 쌓인다) ──
// ── 무한의 계단 아이템 (계단 위 아이템: 밟으면 바로 얻는다. 규칙은 stairsItems.ts) ──
/** 아이템과 아이템 사이 계단 수: 4~10칸 중 무작위 (평균 7칸) */
export const STAIRS_ITEM_GAP_MIN = 4;
export const STAIRS_ITEM_GAP_MAX = 10;
/** 캡슐 아이템이 황금일 확률 (아니면 초원·물가·사막 고르게) */
export const STAIRS_ITEM_LEGEND_CHANCE = 0.1;
/** 별점수 아이템 하나가 주는 별점수 */
export const STAIRS_ITEM_STARS = 3;
/** 별점수가 켜져 있을 때 아이템이 별점수일 확률 (꺼져 있으면 별 아이템은 안 나온다) */
export const STAIRS_ITEM_STAR_SHARE = 0.5;

/** 새 구구몬을 처음 만났을 때 */
export const STAR_DISCOVER = 5;
/** 새 구구몬을 처음 잡았을 때 */
export const STAR_CATCH = 5;
/** 트레이닝 성공(학습 끝까지 마침·도전 합격)마다 */
export const STAR_TRAINING = 3;
/** 레전드 구구몬을 트레이닝 보상으로 받을 때 (12·13단·셈연습 고수 첫 마스터. 이미 가진 레전드여도 받는다) */
export const STAR_LEGEND_REWARD = 20;
/** 체육관 동상 문제 수 */
export const STATUE_QUESTIONS = 7;
/** 동상 별점수: 가장 적게·가장 많이 (7문제를 모두 맞혔을 때만) */
export const STATUE_STARS_MIN = 5;
export const STATUE_STARS_MAX = 15;
/** 동상: 이 시간(밀리초) 안에 다 풀면 가장 많이 */
export const STATUE_FAST_MS = 20_000;
/** 동상: 이 시간(밀리초)보다 오래 걸리면 가장 적게 (사이는 시간에 반비례) */
export const STATUE_SLOW_MS = 70_000;

// ── 저학년 모드 (구구단 대신 덧셈·뺄셈 — 규칙은 lowGrade.ts) ──
/** 저학년 모드를 켜고 끌 때 넣는 비밀번호 */
export const LOWGRADE_PASSWORD = '1234';
/** 저학년 틀린 문제를 이만큼까지 기억한다 (최근 것부터) */
export const LOWGRADE_WRONG_KEEP = 20;
/** 상점 캡슐 연습 문제 수 (저학년 모드) */
export const LOWGRADE_SHOP_QUESTIONS = 5;
/** 저학년 야생 전투가 한 번에 미리 만드는 문제 수 */
export const LOWGRADE_BATCH = 5;
/** 저학년 모드 야생 전투의 문제 시간 배수 (단계 시간 × 2 — 속도 기준·기술 조건 시간도 같이 늘어난다) */
export const LOWGRADE_TIME_FACTOR = 2;
/**
 * 쓰이지 않음: 전투 시간은 기존 단계 규칙(TIER_RULES)에 LOWGRADE_TIME_FACTOR(2배)를 곱해 쓴다. 문제 종류별 시간은 나중에 쓸 수 있어 보관.
 * 저학년 문제 하나에 쓰는 시간(초). 셈 연습 마스터 기준과 같은 크기:
 * 초원(한 자리 덧뺄셈)은 기본 단계 문제당 시간, 물가·사막(두 자리 ± 한 자리)은 고수 단계 문제당 시간
 */
export const LOWGRADE_ANSWER_SEC: Record<FieldId, number> = {
  meadow: PRACTICE_MASTER_SEC_PER_Q.basic,
  waterside: PRACTICE_MASTER_SEC_PER_Q.hard,
  desert: PRACTICE_MASTER_SEC_PER_Q.hard,
};

/** 마스터한 단의 문제를 나눗셈(56 ÷ 7 = □)으로 바꿔 내는 확률 */
export const REVERSE_CHANCE = 0.25;

/** 주인공 꾸미기 세트 하나의 값 (별점수). 세트 표는 costumes.ts */
export const COSTUME_PRICE = 50;
