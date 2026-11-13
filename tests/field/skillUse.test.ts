import { describe, expect, it } from 'vitest';
import { ELEMENT_FX, SPECIAL_FX, STRONG_FX } from '../../src/domain/field/elements';
import { SKILLS, fastSeconds, pickFired, seatedDef, skillButtons, skillDef, type SkillButton } from '../../src/domain/field/skills';
import { CALM_BONUS_MS, TIER_RULES } from '../../src/domain/field/tuning';
import { createWild, type WildState } from '../../src/domain/field/wildBattle';
import { EFFECTS, type FxSpec } from '../../src/field/fx/effects';
import { SKILLS as ALL_SKILLS } from '../../src/domain/field/skills';
import { battleText } from '../../src/field/battle/battleText';
import type { Rng } from '../../src/domain/random';
import {
  answerWithSkill,
  buttonLines,
  buttonPower,
  buttonShortName,
  buttonBrief,
  buttonHiddenText,
  buttonPowerLabel,
  clockRuns,
  combatRng,
  effectPlan,
  foeSkill,
  moveFxRoute,
  gaugeStops,
  gaugeZones,
  heldSkills,
  hitMessage,
  nowDetail,
  nowText,
  readyText,
  skillFxName,
  skillMatchup,
  skillSfxPlan,
  stopPosition,
  strikeMessage,
  tierAt,
} from '../../src/field/battle/skillUse';

const k = (id: string) => skillDef(id);
/** 보통 단계(7초) 문제 하나: 경과 시간만 정해 둔다 */
const at = (elapsedMs: number, over: Partial<WildState> = {}): WildState => ({ ...createWild('normal', 5, 100), elapsedMs, ...over });
/** 구름몬이 held를 가졌을 때의 kind 버튼 */
const btn = (held: string[], kind: SkillButton['kind'] = 'main') => skillButtons(held, 'cloud').find((b) => b.kind === kind)!;
const M12 = ['cloud-1', 'cloud-2'];
/** 빗나가지도 크리티컬도 아니고 효과는 다 성공하는 난수 */
const ok: Rng = () => 0.3;
/** 정해 둔 난수를 차례로 (다 쓰고 또 부르면 실패) */
const seq = (...values: number[]): Rng => () => {
  if (values.length === 0) throw new Error('난수를 너무 많이 씀');
  return values.shift()!;
};
const SP = ['cloud-1', 'cloud-3'];

describe('전투 기술: 가진 기술과 고르기 단계', () => {
  it('저장된 기술 목록을 기술 표로 바꾼다 (없으면 그 레벨의 기본 기술)', () => {
    expect(heldSkills('cloud', { level: 20, skills: ['cloud-1', 'cloud-3'] }).map((d) => d.id)).toEqual(['cloud-1', 'cloud-3']);
    expect(heldSkills('cloud', { level: 1, skills: [] }).map((d) => d.id)).toEqual(['cloud-1']);
    expect(heldSkills('cloud', undefined).map((d) => d.id)).toEqual(['cloud-1']);
  });
  it('기술 1개면 고르기 없이 바로 문제, 2개 이상이면 고르기부터', () => {
    const one = heldSkills('cloud', { level: 5, skills: ['cloud-1'] });
    const two = heldSkills('cloud', { level: 5, skills: ['cloud-1', 'cloud-2'] });
    expect(createWild('normal', 5, 100, one.length).phase).toBe('question');
    expect(createWild('normal', 5, 100, two.length).phase).toBe('pick');
  });
});

describe('전투 기술: answerWithSkill (빠르게 스위치·문제 시간)', () => {
  it('스위치가 없으면 실제 경과 시간으로 판정', () => {
    // 새싹 휙(주②): 7초 × 0.5 → 4초
    expect(answerWithSkill(at(4000), btn(M12), M12, 'light', null, ok).upper).toBe(true);
    expect(answerWithSkill(at(4001), btn(M12), M12, 'light', null, ok).upper).toBe(false);
  });
  it('빠르게 스위치 true면 늘 가장 높은 단계, false면 늘 주① (경과 시간은 그대로 둔다)', () => {
    const slow = answerWithSkill(at(6500), btn(M12), M12, 'light', true, ok);
    expect(slow).toMatchObject({ upper: true, fired: { id: 'cloud-2' }, special: 'stun' });
    expect(slow.state).toMatchObject({ cells: 2, elapsedMs: 6500, stun: true });
    const quick = answerWithSkill(at(0), btn(M12), M12, 'light', false, ok);
    expect(quick).toMatchObject({ upper: false, fired: { id: 'cloud-1' } });
    expect(quick.state).toMatchObject({ cells: 2, elapsedMs: 0 });
  });
  it('특수: 스위치 true면 발동, false면 약한 기술이 대신', () => {
    expect(answerWithSkill(at(6500), btn(SP, 'special'), SP, 'light', true, ok).special).toBe('heal');
    const late = answerWithSkill(at(0), btn(SP, 'special'), SP, 'light', false, ok);
    expect(late).toMatchObject({ usedFallback: true, upper: false });
    expect(late.fired.id).toBe('cloud-1');
  });
  it('단계 기준은 그 단계 문제 시간(TIER_RULES)만 — 여유로 늘어난 시간은 넣지 않는다', () => {
    // 여유로 10초가 된 문제에서 4.5초 걸림: 7초 기준 4초를 넘었으니 주① (10초 기준이면 5초라 주②가 된다)
    const s = at(4500, { timeLeftMs: 5500 });
    expect(answerWithSkill(s, btn(M12), M12, 'light', null, ok).upper).toBe(false);
    // 화나서 강력(5초)이 되면 그 단계 시간으로: 5초 × 0.5 = 2.5 → 3초
    const m = { ...createWild('mighty', 15, 100), elapsedMs: 3000 };
    expect(TIER_RULES.mighty.timeMs).toBe(5000);
    expect(answerWithSkill(m, btn(M12), M12, 'light', null, ok).upper).toBe(true);
    expect(answerWithSkill({ ...m, elapsedMs: 3001 }, btn(M12), M12, 'light', null, ok).upper).toBe(false);
  });
  it('굴림 난수를 그대로 넘긴다: 빗나감·크리티컬 (스위치로 경과 시간을 바꿔도)', () => {
    expect(answerWithSkill(at(6500), btn(M12), M12, 'light', true, seq(0.01))).toMatchObject({ dodged: true, state: { cells: 0, elapsedMs: 6500 } });
    expect(answerWithSkill(at(0), btn(M12), M12, 'light', false, seq(0.5, 0))).toMatchObject({ crit: true, state: { cells: 4 } });
  });
  it('문제 단계가 아니면 상태 그대로 (스위치가 있어도)', () => {
    const p = at(0, { phase: 'pick' });
    expect(answerWithSkill(p, btn(M12), M12, 'light', true, ok).state).toBe(p);
  });
});

describe('전투 기술: 상성·효과 이름·적의 기술', () => {
  it('상성: 속성 기술만 (특수는 null)', () => {
    expect(skillMatchup(k('cloud-1'), 'water')).toBe(1);
    expect(skillMatchup(k('cloud-1'), 'fire')).toBe(-1);
    expect(skillMatchup(k('cloud-1'), 'light')).toBe(0);
    expect(skillMatchup(k('cloud-3'), 'water')).toBeNull();
  });
  it('효과 이름: 속성 기술은 fxIndex 칸(부속성은 4번째) — 윗단계여도 같은 칸(강력 효과는 안 씀), 특수는 특수 효과', () => {
    expect(skillFxName(k('cloud-1'), false)).toBe(ELEMENT_FX.grass[0]);
    expect(skillFxName(k('cloud-2'), true)).toBe(ELEMENT_FX.grass[1]);
    expect(skillFxName(k('cloud-5'), true)).toBe(ELEMENT_FX.grass[2]);
    expect(skillFxName(k('cloud-4'), true)).toBe(ELEMENT_FX.light[3]);
    expect(skillFxName(k('cloud-1'), true)).not.toBe(STRONG_FX.grass[0]);
    expect(skillFxName(k('cloud-3'), false)).toBe(SPECIAL_FX.heal);
    expect(skillFxName(k('mushroom-3'), true)).toBe(SPECIAL_FX.guard);
    // 복사해 부속성 자리에 앉은 뿔몬 2번(물): 원래 종의 칸(주② = 1번 칸)
    expect(skillFxName(seatedDef(k('horn-2'), 'cloud'), true)).toBe(ELEMENT_FX.water[1]);
  });
  it('적의 기술: 그 레벨에서 익힌 속성 기술 중 무작위 (특수 제외)', () => {
    expect(foeSkill('cloud', 2, () => 0.99).id).toBe('cloud-1');
    expect(foeSkill('cloud', 10, () => 0).id).toBe('cloud-1');
    expect(foeSkill('cloud', 10, () => 0.99).id).toBe('cloud-2'); // 3번(특수)은 안 나온다
    const seen = new Set<string>();
    for (let i = 0; i < 20; i++) seen.add(foeSkill('cloud', 20, () => i / 20).id);
    expect([...seen].sort()).toEqual(['cloud-1', 'cloud-2', 'cloud-4', 'cloud-5']);
    expect(foeSkill('legend-horn', 20, () => 0).name).toMatch(/^황금/);
  });
});

/** 구름몬 Lv20 다섯 기술 */
const ALL = ['cloud-1', 'cloud-2', 'cloud-3', 'cloud-4', 'cloud-5'];
const T7 = TIER_RULES.normal.timeMs;
const T5 = TIER_RULES.mighty.timeMs;

describe('전투 기술: 정답 글 hitMessage', () => {
  it('특수 회복 버튼은 실제로 늘어난 체력만 쓰고, 0이면 이미 가득', () => {
    const heal = answerWithSkill(at(0, { allyHp: 90 }), btn(SP, 'special'), SP, 'light', true, ok);
    expect(hitMessage(heal, 'light', 10, 'special')).toBe('새싹 쑥쑥! 체력을 10 되찾았어요!');
    expect(hitMessage(heal, 'light', 25, 'special')).toBe('새싹 쑥쑥! 체력을 25 되찾았어요!');
    expect(hitMessage(heal, 'light', 0, 'special')).toBe('새싹 쑥쑥! 체력이 이미 가득해요!');
  });
  it('윗단계: "⚡ 빠르다!" 한 줄(번호 나열 없음) + 주②의 효과 줄 + 상성 줄, 느리면 명중만', () => {
    expect(hitMessage(answerWithSkill(at(0), btn(M12), M12, 'water', true, ok), 'water', 0, 'main')).toBe(
      '새싹 휙! ⚡ 빠르다!\n적이 기절했어요! 다음 공격을 한 번 못 해요\n효과가 커요! ▲',
    );
    expect(hitMessage(answerWithSkill(at(0), btn(ALL), ALL, 'light', true, ok), 'light', 0, 'main')).toBe('꽃잎 바람! ⚡ 빠르다!');
    expect(hitMessage(answerWithSkill(at(0), btn(M12), M12, 'light', false, ok), 'light', 0, 'main')).toBe('잎사귀 톡! 명중!');
    expect(hitMessage(answerWithSkill(at(0), btn(SP, 'special'), SP, 'fire', false, ok), 'fire', 0, 'special')).toBe(
      '시간이 지나서 약한 기술이 나갔어요. 잎사귀 톡!\n별로예요… ▼',
    );
  });
  it('부속성 버튼: 빠르면 "⚡ 빠르다!", 느리면 1번 명중', () => {
    const sub = btn(ALL, 'sub');
    expect(hitMessage(answerWithSkill(at(0), sub, ALL, 'grass', true, ok), 'grass', 0, 'sub')).toBe('햇살 반짝! ⚡ 빠르다!');
    expect(hitMessage(answerWithSkill(at(0), sub, ALL, 'grass', false, ok), 'grass', 0, 'sub')).toBe('잎사귀 톡! 명중!');
  });
  it('주② 회복은 실제로 늘어난 양, 방어는 "다음 공격이 약해져요"', () => {
    const mush = ['mushroom-1', 'mushroom-2'];
    const mb = skillButtons(mush, 'mushroom')[0];
    const r = answerWithSkill(at(0), mb, mush, 'poison', true, ok);
    expect(r.special).toBe('heal');
    expect(hitMessage(r, 'poison', 25, 'main')).toBe('데굴데굴! ⚡ 빠르다!\n체력이 25 회복됐어요');
    expect(hitMessage(r, 'poison', 0, 'main')).toBe('데굴데굴! ⚡ 빠르다!\n체력이 이미 가득해요');
    const fluff = ['fluff-1', 'fluff-2'];
    const g = answerWithSkill(at(0), skillButtons(fluff, 'fluff')[0], fluff, 'light', true, ok);
    expect(hitMessage(g, 'light', 0, 'main')).toBe('꼬리 흔들기! ⚡ 빠르다!\n다음 공격이 약해져요');
  });
  it('적이 기절해 공격을 못 했을 때 글', () => {
    expect(battleText.stunBlocked('왕관몬')).toBe('왕관몬이 기절해서 움직이지 못했어요!');
    expect(battleText.stunBlocked('새싹몬')).toBe('새싹몬이 기절해서 움직이지 못했어요!');
  });
});

describe('전투 기술: 주②의 효과 연출 effectPlan', () => {
  it('스턴은 적 위에 스턴 그림·skillStun, 회복·방어는 내 구구몬 위', () => {
    expect(effectPlan(answerWithSkill(at(0), btn(M12), M12, 'light', true, ok))).toEqual({ fx: 'stunned', sfx: 'skillStun', on: 'foe' });
    const mush = ['mushroom-1', 'mushroom-2'];
    expect(effectPlan(answerWithSkill(at(0), skillButtons(mush, 'mushroom')[0], mush, 'light', true, ok))).toEqual({
      fx: SPECIAL_FX.heal,
      sfx: 'skillHeal',
      on: 'ally',
    });
    const fluff = ['fluff-1', 'fluff-2'];
    expect(effectPlan(answerWithSkill(at(0), skillButtons(fluff, 'fluff')[0], fluff, 'light', true, ok))).toEqual({
      fx: SPECIAL_FX.guard,
      sfx: 'skillGuard',
      on: 'ally',
    });
  });
  it('주①·주③·부속성·대신 나감·특수 버튼 성공은 따로 틀 효과가 없다 (특수 버튼은 기술 효과 자체가 특수 그림)', () => {
    expect(effectPlan(answerWithSkill(at(0), btn(M12), M12, 'light', false, ok))).toBeNull();
    expect(effectPlan(answerWithSkill(at(0), btn(ALL), ALL, 'light', true, ok))).toBeNull();
    expect(effectPlan(answerWithSkill(at(0), btn(ALL, 'sub'), ALL, 'light', true, ok))).toBeNull();
    expect(effectPlan(answerWithSkill(at(0), btn(SP, 'special'), SP, 'light', true, ok))).toBeNull();
    expect(effectPlan(answerWithSkill(at(0), btn(SP, 'special'), SP, 'light', false, ok))).toBeNull();
  });
});

describe('전투 기술: skillSfxPlan (맞는 순간 소리 목록)', () => {
  const leaf = k('cloud-1'); // 풀 속성 기술
  it('내 속성 기술: 평소엔 속성 소리 하나', () => {
    expect(skillSfxPlan('ally', leaf, false, 0)).toEqual(['fxGrass']);
    expect(skillSfxPlan('ally', leaf, false, null)).toEqual(['fxGrass']);
  });
  it('윗단계(upper)면 fxPower가 겹친다', () => {
    expect(skillSfxPlan('ally', k('cloud-2'), true, 0)).toEqual(['fxGrass', 'fxPower']);
  });
  it('상성 강함·약함은 소리가 붙고 보통(0)은 없다', () => {
    expect(skillSfxPlan('ally', leaf, false, 1)).toEqual(['fxGrass', 'superEffective']);
    expect(skillSfxPlan('ally', leaf, false, -1)).toEqual(['fxGrass', 'notVery']);
    expect(skillSfxPlan('ally', leaf, true, 1)).toEqual(['fxGrass', 'fxPower', 'superEffective']);
  });
  it('화면이 넘기는 upper = 결과의 upper (주①·대신 나감은 false, 주②·주③·부속성은 true)', () => {
    const r1 = answerWithSkill(at(0), btn(M12), M12, 'light', false, ok);
    const r2 = answerWithSkill(at(0), btn(ALL, 'sub'), ALL, 'light', true, ok);
    expect(skillSfxPlan('ally', r1.fired, r1.upper, 0)).toEqual(['fxGrass']);
    expect(skillSfxPlan('ally', r2.fired, r2.upper, 0)).toEqual(['fxLight', 'fxPower']);
  });
  it('특수 성공은 특수 소리 하나 (윗단계·상성 없음)', () => {
    expect(skillSfxPlan('ally', k('cloud-3'), false, null)).toEqual(['skillHeal']);
    expect(skillSfxPlan('ally', k('cloud-3'), true, 1)).toEqual(['skillHeal']);
  });
  it('적 공격은 속성 소리만 (윗단계·상성 소리 없음)', () => {
    expect(skillSfxPlan('foe', leaf, true, 1)).toEqual(['fxGrass']);
    expect(skillSfxPlan('foe', leaf, false, -1)).toEqual(['fxGrass']);
  });
});

describe('시간 게이지 기점: gaugeStops · tierAt', () => {
  it('주속성 사슬 1개(스타터)는 기점이 없고 늘 1단계', () => {
    const stops = gaugeStops(btn(['cloud-1']), T7);
    expect(stops).toEqual([]);
    expect(tierAt(stops, 0)).toBe(1);
    expect(tierAt(stops, 9999)).toBe(1);
  });
  it('주속성 사슬 2개(7초): 4초 기점 ②', () => {
    expect(gaugeStops(btn(M12), T7)).toEqual([{ atMs: 4000, tier: 2, skillName: '새싹 휙' }]);
  });
  it('주속성 사슬 3개(7초): 2초 ③ · 4초 ② (빠른 기점부터), 경계는 판정과 같다', () => {
    const stops = gaugeStops(btn(ALL), T7);
    expect(stops).toEqual([
      { atMs: 2000, tier: 3, skillName: '꽃잎 바람' },
      { atMs: 4000, tier: 2, skillName: '새싹 휙' },
    ]);
    expect(tierAt(stops, 0)).toBe(3);
    expect(tierAt(stops, 2000)).toBe(3);
    expect(tierAt(stops, 2001)).toBe(2);
    expect(tierAt(stops, 4000)).toBe(2);
    expect(tierAt(stops, 4001)).toBe(1);
  });
  it('5초 단계(강력): 2초 ③ · 3초 ②', () => {
    expect(gaugeStops(btn(ALL), T5).map((s) => [s.atMs, s.tier])).toEqual([
      [2000, 3],
      [3000, 2],
    ]);
  });
  it('부속성·특수 버튼은 기점 하나 (②)', () => {
    expect(gaugeStops(btn(ALL, 'sub'), T7)).toEqual([{ atMs: 4000, tier: 2, skillName: '햇살 반짝' }]);
    expect(gaugeStops(btn(ALL, 'special'), T5)).toEqual([{ atMs: 3000, tier: 2, skillName: '새싹 쑥쑥' }]);
  });
  it('여유(calm)로 시간이 늘어도 기점(경과 시간)은 그대로 — 단계 시간만 넘긴다', () => {
    // 화면은 TIER_RULES[tier].timeMs만 넘긴다: 여유로 10초가 된 문제도 7초 기준
    expect(gaugeStops(btn(ALL), T7)).toEqual(gaugeStops(btn(ALL), TIER_RULES.normal.timeMs));
    expect(CALM_BONUS_MS).toBeGreaterThan(0);
  });
  it('tierAt은 판정(pickFired)과 늘 같다: 0~8초를 100ms마다', () => {
    for (const held of [['cloud-1'], M12, ALL]) {
      for (const b of skillButtons(held, 'cloud')) {
        for (const time of [T7, T5]) {
          const stops = gaugeStops(b, time);
          for (let e = 0; e <= 8000; e += 100) {
            const p = pickFired(b, held, e, time);
            const fast = b.kind === 'special' ? !p.usedFallback : p.tier;
            const want = b.kind === 'special' ? (fast ? 2 : 1) : p.tier;
            expect(tierAt(stops, e)).toBe(want);
          }
        }
      }
    }
  });
  it('기점 위치: 게이지가 줄어드는 쪽 기준, 남은 시간 비율 = (한도 − 기점) / 한도', () => {
    expect(stopPosition(2000, 7000)).toBeCloseTo(5 / 7);
    expect(stopPosition(4000, 10000)).toBeCloseTo(0.6); // 여유로 10초
    expect(stopPosition(9000, 7000)).toBe(0);
  });
});

describe('고르기 버튼 글: buttonLines (단계별 시간 조건은 fastSeconds와 같다)', () => {
  it('주속성 1·2·3번 (7초)', () => {
    expect(buttonLines(btn(ALL), T7)).toEqual(['1번 잎사귀 톡', '4초 안: 2번 새싹 휙 +기절', '2초 안: 3번 꽃잎 바람']);
    expect(fastSeconds(k('cloud-2'), T7)).toBe(4);
    expect(fastSeconds(k('cloud-5'), T7)).toBe(2);
  });
  it('주속성 (5초): 3초·2초', () => {
    expect(buttonLines(btn(ALL), T5)).toEqual(['1번 잎사귀 톡', '3초 안: 2번 새싹 휙 +기절', '2초 안: 3번 꽃잎 바람']);
  });
  it('스타터(1개)', () => {
    expect(buttonLines(btn(['cloud-1']), T7)).toEqual(['1번 잎사귀 톡']);
  });
  it('부속성: 빠르면 그 기술, 느리면 1번 (복사 기술도 이름 그대로)', () => {
    expect(buttonLines(btn(ALL, 'sub'), T7)).toEqual(['4초 안: 햇살 반짝(부속성)', '그보다 느리면 1번 잎사귀 톡']);
    const copied = ['cloud-1', 'horn-2'];
    expect(buttonLines(btn(copied, 'sub'), T5)).toEqual(['3초 안: 돌진(부속성)', '그보다 느리면 1번 잎사귀 톡']);
  });
  it('특수: 효과 · 못 풀면 약한 기술', () => {
    expect(buttonLines(btn(ALL, 'special'), T7)).toEqual(['4초 안: 회복 효과', '못 풀면 약한 기술']);
  });
  it('위력: 주속성은 가진 단계의 범위, 부속성 3, 특수 2', () => {
    expect(buttonPower(btn(ALL))).toBe('★★~★★★');
    expect(buttonPower(btn(M12))).toBe('★★');
    expect(buttonPower(btn(ALL, 'sub'))).toBe('★★★');
    expect(buttonPower(btn(['cloud-1', 'horn-1'], 'sub'))).toBe('★★★');
    expect(buttonPower(btn(ALL, 'special'))).toBe('★★');
  });
  it('준비 글·지금 쓰는 기술 줄은 간결하게 ("N초 안" 없음), 자세한 시간은 숨김 글(nowDetail)', () => {
    expect(readyText(btn(['cloud-1']))).toBe('잎사귀 톡 준비!');
    expect(readyText(btn(ALL))).toBe('잎사귀 톡 준비!');
    expect(readyText(btn(ALL, 'sub'))).toBe('햇살 반짝 준비!');
    expect(readyText(btn(SP, 'special'))).toBe('새싹 쑥쑥 준비! 빨리 풀면 회복!');
    expect(nowText(btn(['cloud-1']))).toBe('잎사귀 톡');
    expect(nowText(btn(ALL))).toBe('잎사귀 톡');
    expect(nowText(btn(ALL, 'sub'))).toBe('햇살 반짝');
    expect(nowText(btn(SP, 'special'))).toBe('새싹 쑥쑥 · 빨리 풀면 회복');
    for (const b of [btn(ALL), btn(ALL, 'sub'), btn(SP, 'special')]) {
      expect(readyText(b)).not.toMatch(/초 안/);
      expect(nowText(b)).not.toMatch(/초 안/);
    }
    expect(nowDetail(btn(['cloud-1']), T7)).toBe('잎사귀 톡');
    expect(nowDetail(btn(ALL), T7)).toBe('잎사귀 톡 · 4초 안 2번 · 2초 안 3번');
    expect(nowDetail(btn(ALL, 'sub'), T7)).toBe('햇살 반짝 · 4초 안에 풀어요');
    expect(nowDetail(btn(SP, 'special'), T7)).toBe('새싹 쑥쑥 · 4초 안에 풀면 회복!');
  });
});

describe('문제 시계가 흐르는 조건 clockRuns', () => {
  const base = { intro: false, confirmQuit: false, ending: false, phase: 'question' as const, noTimer: false, throwing: false };
  it('문제가 떠 있고 막는 것이 없을 때만', () => {
    expect(clockRuns(base)).toBe(true);
    expect(clockRuns({ ...base, intro: true })).toBe(false);
    expect(clockRuns({ ...base, confirmQuit: true })).toBe(false);
    expect(clockRuns({ ...base, ending: true })).toBe(false);
    expect(clockRuns({ ...base, phase: 'pick' })).toBe(false);
    expect(clockRuns({ ...base, noTimer: true })).toBe(false);
  });
  it('캡슐에서 빠져나온 뒤 연출(throwing)이 끝날 때까지는 문제가 떠도 흐르지 않는다', () => {
    expect(clockRuns({ ...base, throwing: true })).toBe(false);
  });
});

describe('시간 막대 구간: gaugeZones (같은 기점에서도 단계가 맞다)', () => {
  it('기점이 둘이면 ① ② ③ 구간 (왼쪽부터)', () => {
    const zones = gaugeZones(gaugeStops(btn(ALL), T7), T7);
    expect(zones.map((z) => z.tier)).toEqual([1, 2, 3]);
    expect(zones[0].from).toBe(0);
    expect(zones[zones.length - 1].to).toBe(1);
  });

  it('기점이 같은 자리에 겹쳐도 가장 높은 단계가 마지막 구간이고 tierAt과 같다', () => {
    const stops = [
      { atMs: 3000, tier: 2 as const, skillName: 'a' },
      { atMs: 3000, tier: 3 as const, skillName: 'b' },
    ];
    for (const order of [stops, [...stops].reverse()]) {
      const zones = gaugeZones(order, T7);
      expect(zones[zones.length - 1].tier).toBe(3);
      // 구간 가운데 시각의 단계가 tierAt과 같다
      for (const z of zones) {
        if (z.to - z.from <= 0.001) continue;
        const mid = T7 - ((z.from + z.to) / 2) * T7;
        expect(z.tier).toBe(tierAt(order, mid));
      }
    }
  });

  it('높은 단계 기점이 더 느린 쪽에 있어도 지난 뒤에는 낮아지지 않는다', () => {
    const stops = [
      { atMs: 5000, tier: 3 as const, skillName: 'a' },
      { atMs: 2000, tier: 2 as const, skillName: 'b' },
    ];
    expect(gaugeZones(stops, T7).map((z) => z.tier)).toEqual([1, 3, 3]);
  });

  it('기점이 없으면 구간도 없다', () => {
    expect(gaugeZones([], T7)).toEqual([]);
  });
});

describe('위력 별 읽는 글: buttonPowerLabel', () => {
  it('범위와 하나', () => {
    expect(buttonPowerLabel(btn(ALL))).toBe('위력 2~3');
    expect(buttonPowerLabel(btn(['cloud-1']))).toBe('위력 2');
    expect(buttonPowerLabel(btn(ALL, 'sub'))).toBe('위력 3');
  });
});

describe('전투 화면 간결 표시: buttonShortName · buttonHiddenText (선택창·관리 화면의 skillLines는 그대로)', () => {
  it('주속성 버튼은 가진 단계와 무관하게 1번 기술 이름, 부속성·특수는 그 기술 이름', () => {
    expect(buttonShortName(btn(ALL))).toBe('잎사귀 톡');
    expect(buttonShortName(btn(M12))).toBe('잎사귀 톡');
    expect(buttonShortName(btn(ALL, 'sub'))).toBe('햇살 반짝');
    expect(buttonShortName(btn(ALL, 'special'))).toBe('새싹 쑥쑥');
  });
  it('기술 이름은 모두 10글자 이하라 두 줄로 줄바꿈하면 버튼 폭(1/3)에 들어간다', () => {
    for (const d of SKILLS) expect(d.name.length).toBeLessThanOrEqual(10);
  });
  it('숨김 글은 단계별 시간 조건과 위력을 그대로 가진다 (화면에는 안 보이고 읽기 도구용)', () => {
    const t = buttonHiddenText(btn(ALL), T7);
    for (const line of buttonLines(btn(ALL), T7)) expect(t).toContain(line);
    expect(t).toContain(buttonPowerLabel(btn(ALL)));
    expect(buttonHiddenText(btn(ALL, 'special'), T7)).toContain('4초 안: 회복 효과');
  });
  it('특수 버튼에만 짧은 설명 한 줄, 속성 버튼은 없음', () => {
    expect(buttonBrief(btn(ALL, 'special'))).toBe('체력 회복');
    expect(buttonBrief(btn(ALL))).toBeNull();
    expect(buttonBrief(btn(ALL, 'sub'))).toBeNull();
    expect(battleText.specialBrief).toEqual({ heal: '체력 회복', guard: '방어', clue: '힌트', calm: '여유 시간', charge: '충전', stun: '적 기절' });
  });
  it('안내 글과 빠르다 글', () => {
    expect(battleText.chooseHint).toBe('빨리 풀면 더 세져요 ⚡');
    expect(battleText.quick).toBe('⚡ 빠르다!');
  });
});

describe('전투 굴림 글: 크리티컬·빗나감·효과 실패 (설계서 0-2절)', () => {
  it('내 공격: 크리티컬이면 맨 앞에 "크리티컬!" 한 줄, 빗나가면 "○○! …빗나갔어요!" 한 줄만', () => {
    const crit = answerWithSkill(at(0), btn(M12), M12, 'light', false, seq(0.5, 0));
    expect(hitMessage(crit, 'light', 0, 'main')).toBe('💥 크리티컬!\n잎사귀 톡! 명중!');
    const miss = answerWithSkill(at(0), btn(M12), M12, 'water', true, seq(0.01));
    expect(hitMessage(miss, 'water', 0, 'main')).toBe('새싹 휙! …빗나갔어요!');
  });
  it('효과 실패: 주②는 "⚡ 빠르다!" 뒤 "효과가 실패했어요…", 특수 버튼은 명중 뒤 한 줄 (효과 연출 없음)', () => {
    const m2 = answerWithSkill(at(0), btn(M12), M12, 'light', true, seq(0.5, 0.5, 0.9));
    expect(m2.effect).toEqual({ kind: 'stun', ok: false });
    expect(hitMessage(m2, 'light', 0, 'main')).toBe('새싹 휙! ⚡ 빠르다!\n효과가 실패했어요…');
    expect(effectPlan(m2)).toBeNull();
    const sp = answerWithSkill(at(0, { allyHp: 50 }), btn(SP, 'special'), SP, 'light', true, seq(0.5, 0.5, 0.95));
    expect(sp.special).toBeUndefined();
    expect(hitMessage(sp, 'light', 0, 'special')).toBe('새싹 쑥쑥! 명중!\n효과가 실패했어요…');
  });
  it('적 공격 글: 기절해서 못 움직임 / 빗나감 / 크리티컬 / 보통', () => {
    const r = (o: Partial<{ damage: number; dodged: boolean; crit: boolean; blocked: boolean }>) => ({ damage: 25, dodged: false, crit: false, blocked: false, ...o });
    expect(strikeMessage('왕관몬', '박치기', r({ blocked: true, damage: 0 }))).toBe('왕관몬이 기절해서 움직이지 못했어요!');
    expect(strikeMessage('왕관몬', '박치기', r({ dodged: true, damage: 0 }))).toBe('왕관몬의 박치기! 빗나갔어요!');
    expect(strikeMessage('왕관몬', '박치기', r({ crit: true, damage: 50 }))).toBe('왕관몬의 박치기!\n💥 크리티컬!');
    expect(strikeMessage('왕관몬', '박치기', r({}))).toBe('왕관몬의 박치기!');
  });
  it('굴림 고정 난수(combatRng): 회피 → 크리티컬 → 효과 순서로 정한 값, 빈 칸은 원래 난수', () => {
    const base = seq(0.42, 0.43);
    const g = combatRng({ dodge: false, crit: true, effect: null }, base);
    expect([g(), g(), g(), g()]).toEqual([0.9999, 0, 0.42, 0.43]);
    const none = combatRng({ dodge: null, crit: null, effect: false }, seq(0.5, 0.6));
    expect([none(), none(), none()]).toEqual([0.5, 0.6, 0.9999]);
    // 실제 판정에 넣으면: 크리티컬 고정 → 칸 ×2, 빗나감 고정 → 칸 0, 효과 실패 고정 → 효과 없음
    expect(answerWithSkill(at(0), btn(M12), M12, 'light', false, combatRng({ dodge: false, crit: true, effect: null }, ok))).toMatchObject({ crit: true, state: { cells: 4 } });
    expect(answerWithSkill(at(0), btn(M12), M12, 'light', false, combatRng({ dodge: true, crit: null, effect: null }, ok))).toMatchObject({ dodged: true, state: { cells: 0 } });
    expect(answerWithSkill(at(0), btn(M12), M12, 'light', true, combatRng({ dodge: false, crit: false, effect: false }, ok)).effect).toEqual({ kind: 'stun', ok: false });
  });
});

describe('발사체 기술의 출발·도착 (moveFxRoute)', () => {
  const pts = { ally: { x: 60, y: 200 }, foe: { x: 250, y: 70 } };
  const travelDef = ALL_SKILLS.find((d) => !d.special && (EFFECTS as Record<string, FxSpec>)[skillFxName(d)].motion === 'travel')!;
  const burstDef = ALL_SKILLS.find((d) => !d.special && ((EFFECTS as Record<string, FxSpec>)[skillFxName(d)].motion ?? 'burst') === 'burst')!;
  const specialDef = ALL_SKILLS.find((d) => d.special)!;

  it('내 공격: 내 구구몬에서 출발해 야생 구구몬에 도착하고, 효과음·피해는 날아가는 시간만큼 늦다', () => {
    const r = moveFxRoute('ally', travelDef, pts)!;
    expect(r.from).toEqual(pts.ally);
    expect(r.at).toEqual(pts.foe);
    expect(r.arriveMs).toBe((EFFECTS as Record<string, FxSpec>)[skillFxName(travelDef)].travelMs);
    expect(r.arriveMs).toBeGreaterThan(0);
    expect(r.arriveMs).toBeLessThanOrEqual(300);
  });
  it('적 공격: 야생에서 출발해 내 구구몬에 도착한다', () => {
    const r = moveFxRoute('foe', travelDef, pts)!;
    expect(r.from).toEqual(pts.foe);
    expect(r.at).toEqual(pts.ally);
    expect(r.arriveMs).toBe((EFFECTS as Record<string, FxSpec>)[skillFxName(travelDef)].travelMs);
  });
  it('날아가지 않는 효과는 출발 없이 맞는 쪽에서 바로, 지연 0', () => {
    const r = moveFxRoute('ally', burstDef, pts)!;
    expect(r.from).toBeNull();
    expect(r.at).toEqual(pts.foe);
    expect(r.arriveMs).toBe(0);
  });
  it('특수 기술은 쓴 구구몬 위에서 날아가지 않는다', () => {
    const a = moveFxRoute('ally', specialDef, pts)!;
    expect(a.at).toEqual(pts.ally);
    expect(a.from).toBeNull();
    expect(a.arriveMs).toBe(0);
  });
  it('동작 줄이기면 이동 없이 바로 (지연 0)', () => {
    const r = moveFxRoute('ally', travelDef, pts, true)!;
    expect(r.from).toBeNull();
    expect(r.arriveMs).toBe(0);
  });
  it('맞는 쪽 자리를 못 구하면 null, 쏘는 쪽만 못 구하면 날아가지 않고 바로 터진다', () => {
    expect(moveFxRoute('ally', travelDef, { ally: pts.ally, foe: null })).toBeNull();
    const r = moveFxRoute('ally', travelDef, { ally: null, foe: pts.foe })!;
    expect(r.from).toBeNull();
    expect(r.arriveMs).toBe(0);
  });
});
