import { describe, expect, it } from 'vitest';
import * as T from '../../src/domain/field/tuning';

// 운영 수치 고정표 — tuning.ts 값을 바꾸면 여기도 같이 바꾼다 (실수로 바뀌는 것을 막는다)
describe('필드 모험 운영 수치', () => {
  it('설계서 값 그대로', () => {
    expect({ ...T }).toEqual({
      ENCOUNTER_CHANCE_GRASS: 0.3,
      ENCOUNTER_CHANCE_PATH: 0.04,
      ENCOUNTER_GRACE_STEPS: 3,
      LEGEND_CHANCE: 0.02,
      UNSEEN_WEIGHT: 2,
      LEGEND_LEVEL: 20,
      FIELD_CHOICES: 3,
      MAX_LEVEL: 30,
      DUPLICATE_EXP: 40,
      PARTICIPATION_EXP: 10,
      CORRECT_EXP: 2,
      EXP_BASE: 20,
      EXP_PER_LEVEL: 10,
      EVOLVE_LEVELS: { 2: 8, 3: 18 },
      STEP_MS: 180,
      TURN_TAP_MS: 120,
      TAP_CLOSE_MS: 300,
      ENCOUNTER_FLASH_MS: 800,
      WILD_INTRO_MS: 1200,
      WILD_HIT_ANIM_MS: 600,
      SKILL_EFFECT_DELAY_MS: 250,
      WILD_END_MS: 1500,
      CAPSULE_SHAKES: 3,
      CAPSULE_SHAKE_MS: 400,
      CAPSULE_THROW_MS: 500,
      CAPSULE_HIT_MS: 150,
      CAPSULE_ABSORB_MS: 400,
      CAPSULE_FALL_MS: 300,
      CAPSULE_BOUNCE_MS: 300,
      CAPSULE_RESULT_MS: 150,
      CAPSULE_POP_AT: { healed: 1, escaped: 2, angry: 2 },
      MIN_LOADING_MS: 600,
      WATER_FRAME_MS: 500,
      ROAM_IDLE_MIN_MS: 1500,
      ROAM_IDLE_MAX_MS: 3000,
      ROAM_MOVE_MS: 360,
      ROAM_JUMP_MS: 600,
      ROAM_SLEEP_MS: 5000,
      ROAM_WEIGHTS: { move: 0.6, idle: 0.25, jump: 0.1, sleep: 0.05 },
      ROAM_BUBBLE_MS: 2500,
      TIER_CHANCE: { weak: 0.15, normal: 0.65, strong: 0.15, mighty: 0.05 },
      TIER_RULES: {
        weak: { levels: [-5, -3], timeMs: 7000, hitsToDizzy: 3, damage: 10, expScale: 0.6, ultimateCatch: 0.3 },
        normal: { levels: [-1, 1], timeMs: 7000, hitsToDizzy: 4, damage: 13, expScale: 1, ultimateCatch: 0.25 },
        strong: { levels: [3, 5], timeMs: 5000, hitsToDizzy: 4, damage: 17, expScale: 1.6, ultimateCatch: 0.15 },
        mighty: { levels: [6, 9], timeMs: 5000, hitsToDizzy: 6, damage: 25, expScale: 3, ultimateCatch: 0.1 },
        legend: { levels: null, timeMs: 7000, hitsToDizzy: 4, damage: 17, expScale: 3, ultimateCatch: 0.1 },
      },
      THROW_ESCAPE: 0.21,
      THROW_ANGRY: 0.03,
      COMPANION_MAX_HP: 100,
      WOUNDS_MAX: 10,
      TIMER_WARN_MS: 2000,
      WILD_FOE_ATTACK_MS: 700,
      CAPSULE_START: { meadow: 3, waterside: 3, desert: 3, legend: 0 },
      CAPSULE_REWARD: 5,
      CAPSULE_MAX: 999,
      HEAL_ROUNDS: 3,
      SHOP_ANSWER_GUARD_MS: 300,
      MAX_SKILLS: 5,
      COPY_CHANCE: 0.02,
      CELLS_PER_HIT: 2,
      SUB_FAST_RATIO: 0.5,
      MAX_CHIP_CELLS: 4,
      SPECIAL_HEAL: 25,
      CALM_BONUS_MS: 3000,
      CHARGE_BONUS_CELLS: 1,
      CAPTURE_FAIL_HEAL_RATIO: 0.5,
      CRIT_CHANCE: 0.1,
      CRIT_MULT: 2,
      MAX_CHIP_CRIT_CELLS: 8,
      DODGE_CHANCE: 0.05,
      ENEMY_ATTACK_EVERY: 2,
      CAPSULE_ACTIVE_RATIO: 0.25,
      CATCH_PER_FAIL: 0.1,
      CATCH_STATUS_BONUS: 0.1,
      CATCH_LOW_HP_BONUS: 0.1,
      CATCH_CAP: 0.7,
      SPECIAL_SUCCESS: { heal: 0.9, guard: 0.9, stun: 0.5, clue: 0.8, calm: 0.8, charge: 0.7 },
    });
  });
});

describe('캡슐 던지기 연출 시간', () => {
  it('잡힘은 던짐부터 결과까지 약 3초', () => {
    // 던짐 → 맞음 → 빨려듦 → 낙하 → 통통 → 흔들림 3번 → 결과
    const total =
      T.CAPSULE_THROW_MS +
      T.CAPSULE_HIT_MS +
      T.CAPSULE_ABSORB_MS +
      T.CAPSULE_FALL_MS +
      T.CAPSULE_BOUNCE_MS +
      T.CAPSULE_SHAKES * T.CAPSULE_SHAKE_MS +
      T.CAPSULE_RESULT_MS;
    expect(total).toBe(3000);
  });

  it('실패는 1~2번째 흔들림에서 열린다', () => {
    for (const n of Object.values(T.CAPSULE_POP_AT)) {
      expect(n).toBeGreaterThanOrEqual(1);
      expect(n).toBeLessThan(T.CAPSULE_SHAKES);
    }
  });
});
