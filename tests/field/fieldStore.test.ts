import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { hatch, chooseEgg, initialPet } from '../../src/domain/pet';
import { initialField, mergeField, townStart, type SpeciesEntry, type SpeciesId } from '../../src/store/fieldData';
import { useSessionStore } from '../../src/store/useSessionStore';
import { COPY_CHANCE } from '../../src/domain/field/tuning';
import { useGameStore } from '../../src/store/useGameStore';
import type { Wound } from '../../src/domain/field/wounds';
import { currentSave } from '../../src/screens/admin/DataSecurityPanels';
import { COSTUME_SETS, emptyCostume } from '../../src/domain/field/costumes';
import { createInitialSave, mergeSave } from '../../src/store/saveData';

const NOW = new Date('2026-11-03T09:00:00').getTime();

function batch(over: Partial<Parameters<ReturnType<typeof useGameStore.getState>['finishWildBattle']>[0]> = {}) {
  // 싸운 구구몬: 따로 주지 않으면 저장의 동행 (화면은 전투를 시작할 때 고른 종을 넘긴다)
  const companion = useGameStore.getState().field.companion ?? 'c034';
  // rng: 기술 복사(2%)가 끼어들지 않게 늘 꽝
  return { species: 'c031' as const, companion, level: 4, tier: 'normal' as const, end: 'caught' as const, correct: 3, now: NOW, rng: () => 1, ...over };
}

function hatchedPet() {
  useGameStore.setState({ pet: { ...hatch(chooseEgg(initialPet(NOW), 'cat'), '냥이', NOW), affection: 0 } });
}

describe('필드 스토어 액션', () => {
  beforeEach(() => {
    useGameStore.getState().resetAll();
  });

  it('chooseStarter: 동행·도감 1종·본 종', () => {
    useGameStore.getState().chooseStarter('c036', NOW);
    const f = useGameStore.getState().field;
    expect(f.starterChosen).toBe(true);
    expect(f.companion).toBe('c036');
    expect(Object.keys(f.species)).toEqual(['c036']);
    // 스타터는 기술 1개로 시작한다
    expect(f.species.c036).toEqual({ level: 5, exp: 0, stage: 1, caught: 1, firstCaughtAt: NOW, hp: 100, wounds: [], skills: ['c036-1'] });
    expect(f.seen).toContain('c036');
  });

  it('finishWildBattle: 새 종을 잡으면 도감에 들어가고 기록·친밀도가 오른다', () => {
    hatchedPet();
    const r = useGameStore.getState().finishWildBattle(batch());
    expect(r.newSpecies).toBe(true);
    expect(r.notices).toEqual([]);
    expect(r.affection).toBe(3);
    const s = useGameStore.getState();
    // 야생이 Lv4여도 도감에는 Lv1·기술 1개로 들어간다
    expect(s.field.species.c031).toEqual({ level: 1, exp: 0, stage: 1, caught: 1, firstCaughtAt: NOW, hp: 100, wounds: [], skills: ['c031-1'] });
    expect(s.field.stats).toEqual({ battles: 1, catches: 1, fled: 0 });
    expect(s.pet.affection).toBe(3);
  });

  it('야생이 Lv15여도 처음 잡으면 Lv1·경험치 0·기술 1개 (황금 레전드도)', () => {
    useGameStore.getState().finishWildBattle(batch({ level: 15, tier: 'mighty' }));
    expect(useGameStore.getState().field.species.c031).toMatchObject({ level: 1, exp: 0, skills: ['c031-1'] });
    useGameStore.getState().finishWildBattle(batch({ species: 'c036', level: 15 }));
    expect(useGameStore.getState().field.species.c036).toMatchObject({ level: 1, exp: 0, skills: ['c036-1'] });
  });

  it('같은 종을 또 잡으면 잡은 횟수만 오른다 (레벨은 그대로)', () => {
    useGameStore.getState().finishWildBattle(batch());
    const r = useGameStore.getState().finishWildBattle(batch({ level: 6 }));
    expect(r.newSpecies).toBe(false);
    const e = useGameStore.getState().field.species.c031!;
    expect(e.caught).toBe(2);
    // 야생 레벨(6)로 바뀌지 않는다. 중복 경험치로만 오른다
    expect(e.level).toBe(2);
    expect(useGameStore.getState().field.stats.catches).toBe(2);
  });

  it('도망: 도감은 그대로, fled와 battles만 오른다', () => {
    const r = useGameStore.getState().finishWildBattle(batch({ end: 'escaped', correct: 0 }));
    expect(r.newSpecies).toBe(false);
    const s = useGameStore.getState();
    expect(s.field.species.c031).toBeUndefined();
    expect(s.field.stats).toEqual({ battles: 1, catches: 0, fled: 1 });
  });

  it('펫이 알이면 친밀도는 그대로', () => {
    const before = useGameStore.getState().pet.affection;
    const r = useGameStore.getState().finishWildBattle(batch());
    expect(r.affection).toBe(0);
    expect(useGameStore.getState().pet.affection).toBe(before);
  });

  it('setCompanion: 못 잡은 종은 false, 동행 그대로', () => {
    useGameStore.getState().chooseStarter('c034', NOW);
    expect(useGameStore.getState().setCompanion('c035')).toBe(false);
    expect(useGameStore.getState().field.companion).toBe('c034');
    useGameStore.getState().finishWildBattle(batch());
    expect(useGameStore.getState().setCompanion('c031')).toBe(true);
    expect(useGameStore.getState().field.companion).toBe('c031');
  });

  it('이미 고른 뒤 chooseStarter를 또 불러도 기록과 동행이 그대로', () => {
    const g = useGameStore.getState();
    g.chooseStarter('c036', NOW);
    g.finishWildBattle(batch({ species: 'c036', level: 6 }));
    g.finishWildBattle(batch({ species: 'c036', level: 6 }));
    g.setCompanion('c036');
    const before = JSON.parse(JSON.stringify(useGameStore.getState().field));
    expect(before.species.c036.caught).toBe(3);
    useGameStore.getState().chooseStarter('c036', NOW + 1000);
    useGameStore.getState().chooseStarter('c034', NOW + 2000);
    expect(useGameStore.getState().field).toEqual(before);
  });
});

describe('필드 경험치·알림', () => {
  beforeEach(() => {
    useGameStore.getState().resetAll();
  });

  it('동행이 정답 4로 끝내면 참여 10 + 4×2 = 18 경험치', () => {
    useGameStore.getState().chooseStarter('c036', NOW);
    useGameStore.getState().finishWildBattle(batch({ species: 'c031', end: 'escaped', correct: 4 }));
    expect(useGameStore.getState().field.species.c036!.exp).toBe(18);
  });

  it('도망쳐도 동행은 참여 경험치를 받는다', () => {
    useGameStore.getState().chooseStarter('c036', NOW);
    useGameStore.getState().finishWildBattle(batch({ end: 'escaped', correct: 0 }));
    expect(useGameStore.getState().field.species.c036!.exp).toBe(10);
  });

  it('이미 있는 종을 또 잡으면 그 종에 +40 (새로 잡을 때는 없음)', () => {
    useGameStore.getState().chooseStarter('c034', NOW);
    useGameStore.getState().finishWildBattle(batch());
    expect(useGameStore.getState().field.species.c031!.exp).toBe(0);
    useGameStore.getState().finishWildBattle(batch({ correct: 0 }));
    // Lv1에서 +40: 레벨이 한 번 오르고 남은 경험치 (expToNext(1) = 30)
    const e = useGameStore.getState().field.species.c031!;
    expect([e.level, e.exp]).toEqual([2, 10]);
  });

  it('동행과 같은 종을 또 잡으면 중복 + 참여 경험치가 같은 칸에 들어간다', () => {
    useGameStore.getState().chooseStarter('c036', NOW);
    useGameStore.getState().finishWildBattle(batch({ species: 'c036', correct: 4 }));
    const e = useGameStore.getState().field.species.c036!;
    expect(e.exp).toBe(40 + 18);
    expect(e.caught).toBe(2);
  });

  it('레벨이 오르면 levelUp(최종 레벨) 알림, 진화는 없다(단계 1 그대로)', () => {
    useGameStore.getState().chooseStarter('c036', NOW);
    useGameStore.setState((s) => ({
      field: { ...s.field, species: { ...s.field.species, c036: { level: 7, exp: 0, stage: 1, caught: 1, firstCaughtAt: NOW, hp: 100, wounds: [], skills: ['c036-1', 'c036-2'] } } },
    }));
    const r = useGameStore.getState().finishWildBattle(batch({ species: 'c036', correct: 5 })); // 60 < 90
    expect(r.notices).toEqual([]);
    useGameStore.setState((s) => ({
      field: { ...s.field, species: { ...s.field.species, c036: { level: 7, exp: 85, stage: 1, caught: 1, firstCaughtAt: NOW, hp: 100, wounds: [], skills: ['c036-1', 'c036-2'] } } },
    }));
    const r2 = useGameStore.getState().finishWildBattle(batch({ species: 'c036', correct: 5 }));
    expect(r2.notices).toEqual([
      { kind: 'levelUp', species: 'c036', level: 8 },
      { kind: 'skill', species: 'c036', skillId: 'c036-3', how: 'learned' },
    ]);
    expect(useGameStore.getState().field.species.c036).toMatchObject({ level: 8, stage: 1 });
  });
});

describe('구구몬 체력·상처 저장', () => {
  const wound: Wound = { factId: '7x8', type: 'product' };
  const setHp = (id: 'c034' | 'c036', hp: number) =>
    useGameStore.setState((s) => ({ field: { ...s.field, species: { ...s.field.species, [id]: { ...s.field.species[id]!, hp } } } }));

  beforeEach(() => {
    useGameStore.getState().resetAll();
    useGameStore.getState().chooseStarter('c034', NOW);
  });

  it('damageCompanion: 체력·상처를 바로 저장', () => {
    const pos = { map: 'meadow' as const, x: 5, y: 8, facing: 'right' as const };
    useGameStore.getState().setFieldPosition(pos);
    const r = useGameStore.getState().damageCompanion('c034', 25, wound);
    expect(r).toEqual({ hp: 75, fainted: false, replacedBy: null });
    const f = useGameStore.getState().field;
    expect(f.species.c034).toMatchObject({ hp: 75, wounds: [wound] });
    expect(f.position).toEqual(pos);
  });

  it('damageCompanion: 틀린 문제가 없으면(적의 주기 공격) 체력만 줄고 상처는 그대로', () => {
    useGameStore.getState().damageCompanion('c034', 25, wound);
    const r = useGameStore.getState().damageCompanion('c034', 25);
    expect(r).toEqual({ hp: 50, fainted: false, replacedBy: null });
    expect(useGameStore.getState().field.species.c034).toMatchObject({ hp: 50, wounds: [wound] });
  });

  it('damageCompanion으로 0이 되면 같은 순간 마을 시작 칸으로', () => {
    setHp('c034', 20);
    useGameStore.setState((s) => ({ field: { ...s.field, position: { map: 'meadow', x: 5, y: 8, facing: 'right' } } }));
    const r = useGameStore.getState().damageCompanion('c034', 25, wound);   // hp 20에서
    expect(r).toEqual({ hp: 0, fainted: true, replacedBy: null });
    expect(useGameStore.getState().field.position).toEqual({ map: 'town', ...townStart(), facing: 'down' });
    expect(useGameStore.getState().field.species.c034).toMatchObject({ hp: 0, wounds: [wound] });
  });

  it('damageCompanion: 없는 종이면 아무것도 안 바꿈, 이상한 피해는 정수 0~100', () => {
    const before = JSON.parse(JSON.stringify(useGameStore.getState().field));
    expect(useGameStore.getState().damageCompanion('c031', 25, wound)).toEqual({ hp: 0, fainted: false, replacedBy: null });
    expect(useGameStore.getState().damageCompanion('nope' as 'c031', 25, wound)).toEqual({ hp: 0, fainted: false, replacedBy: null });
    expect(useGameStore.getState().field).toEqual(before);
    expect(useGameStore.getState().damageCompanion('c034', -40, wound).hp).toBe(100);
    expect(useGameStore.getState().damageCompanion('c034', Number.NaN, wound).hp).toBe(100);
    expect(useGameStore.getState().damageCompanion('c034', 10.4, wound).hp).toBe(90);
    // 이상한 피해에도 상처는 한 번만 남는다
    expect(useGameStore.getState().field.species.c034!.wounds).toEqual([wound]);
  });

  it("recordAnswer({source:'shop'}): 별과 성장 점수는 그대로, 학습 기록만 늘어난다", () => {
    const before = useGameStore.getState();
    const r = useGameStore.getState().recordAnswer({
      factId: '7x8', type: 'product', correct: true, ms: 2000, inputMode: 'choice', isRetry: false,
      firstAttemptInBattle: true, battleStartedAt: NOW - 1000, now: NOW, source: 'shop',
    });
    const after = useGameStore.getState();
    expect(r).toMatchObject({ stars: 0, baseStars: 0, xp: 0 });
    expect(after.economy.stars).toBe(before.economy.stars);
    expect(after.pet.growthXp).toBe(before.pet.growthXp);
    expect(after.learning.totalAttempts).toBe(before.learning.totalAttempts + 1);
  });

  it('setCompanion: 쓰러진 종은 false', () => {
    useGameStore.getState().finishWildBattle(batch({ species: 'c036' }));
    setHp('c036', 0);
    expect(useGameStore.getState().setCompanion('c036')).toBe(false);
    expect(useGameStore.getState().field.companion).toBe('c034');
    setHp('c036', 1);
    expect(useGameStore.getState().setCompanion('c036')).toBe(true);
  });

  it('healSpecies: 체력 100, 상처 비움', () => {
    useGameStore.getState().damageCompanion('c034', 25, wound);
    useGameStore.getState().healSpecies('c034');
    expect(useGameStore.getState().field.species.c034).toMatchObject({ hp: 100, wounds: [] });
    const before = JSON.parse(JSON.stringify(useGameStore.getState().field));
    useGameStore.getState().healSpecies('c031');
    expect(useGameStore.getState().field).toEqual(before);
  });

  it('restoreCompanionHp: 체력만 더한다 (가득을 넘지 않고, 상처는 그대로)', () => {
    useGameStore.getState().damageCompanion('c034', 60, wound);
    expect(useGameStore.getState().restoreCompanionHp('c034', 25)).toBe(65);
    expect(useGameStore.getState().field.species.c034).toMatchObject({ hp: 65, wounds: [wound] });
    expect(useGameStore.getState().restoreCompanionHp('c034', 50)).toBe(100);
    // 없는 종·쓰러진 종·이상한 값은 아무것도 안 바꾼다
    setHp('c034', 0);
    const before = JSON.parse(JSON.stringify(useGameStore.getState().field));
    expect(useGameStore.getState().restoreCompanionHp('c034', 25)).toBe(0);
    expect(useGameStore.getState().restoreCompanionHp('c031', 25)).toBe(0);
    expect(useGameStore.getState().field).toEqual(before);
    setHp('c034', 40);
    expect(useGameStore.getState().restoreCompanionHp('c034', Number.NaN)).toBe(40);
    expect(useGameStore.getState().restoreCompanionHp('c034', -10)).toBe(40);
  });

  it('finishWildBattle: 강함 배율로 경험치, 쓰러짐 알림, 같은 종 잡기 ×배율', () => {
    // correct 3, tier 'strong' → 동행 +Math.round((10+6)*1.6)=26
    useGameStore.getState().finishWildBattle(batch({ species: 'c031', end: 'escaped', tier: 'strong', correct: 3 }));
    expect(useGameStore.getState().field.species.c034!.exp).toBe(26);
    expect(useGameStore.getState().field.stats).toEqual({ battles: 1, catches: 0, fled: 1 });
    // end 'fainted' → notices[0] = { kind: 'fainted', species: 'c034' }
    useGameStore.getState().damageCompanion('c034', 100, wound);
    const r = useGameStore.getState().finishWildBattle(batch({ species: 'c031', end: 'fainted', tier: 'normal', correct: 0 }));
    expect(r.notices[0]).toEqual({ kind: 'fainted', species: 'c034' });
    // 체력·상처는 정산이 건드리지 않는다
    expect(useGameStore.getState().field.species.c034).toMatchObject({ hp: 0, wounds: [wound] });
    expect(useGameStore.getState().field.stats.fled).toBe(2);
    // 같은 종 잡기: Math.round(40 × 0.6) = 24 (새로 잡을 땐 없음)
    useGameStore.getState().finishWildBattle(batch({ species: 'c031', end: 'caught', tier: 'weak', correct: 0 }));
    useGameStore.getState().finishWildBattle(batch({ species: 'c031', end: 'caught', tier: 'weak', correct: 0 }));
    expect(useGameStore.getState().field.species.c031!.exp).toBe(24);
    expect(useGameStore.getState().field.species.c031).toMatchObject({ hp: 100, wounds: [] });
    expect(useGameStore.getState().field.stats).toMatchObject({ catches: 2, fled: 2 });
  });

  it('released·quit도 도망 기록, 강함 legend 배율 3', () => {
    useGameStore.getState().finishWildBattle(batch({ end: 'released', tier: 'legend', correct: 2 }));
    expect(useGameStore.getState().field.species.c034!.exp).toBe(Math.round(14 * 3));
    useGameStore.getState().finishWildBattle(batch({ end: 'quit', correct: 0 }));
    expect(useGameStore.getState().field.stats).toEqual({ battles: 2, catches: 0, fled: 2 });
    expect(useGameStore.getState().field.species.c031).toBeUndefined();
  });
});

describe('싸운 구구몬으로 정산 (end.companion)', () => {
  beforeEach(() => {
    useGameStore.getState().resetAll();
  });

  it('저장의 companion이 null이어도 end.companion의 구구몬이 경험치를 받고 쓰러짐 알림이 그 종으로 뜬다', () => {
    useGameStore.getState().chooseStarter('c036', NOW);
    useGameStore.setState((s) => ({
      field: {
        ...s.field,
        companion: null,
        // 젤리몬도 쓰러져 있어 고를 구구몬이 없다 → 쓰러짐 알림
        species: {
          ...s.field.species,
          c036: { ...s.field.species.c036!, hp: 0 },
          c034: { level: 5, exp: 0, stage: 1, caught: 1, firstCaughtAt: NOW, hp: 0, wounds: [], skills: ['c034-1', 'c034-2'] },
        },
      },
    }));
    const r = useGameStore.getState().finishWildBattle(batch({ companion: 'c034', end: 'fainted', correct: 2 }));
    const f = useGameStore.getState().field;
    expect(f.species.c034!.exp).toBe(14);
    expect(f.species.c036!.exp).toBe(0);
    expect(r.notices[0]).toEqual({ kind: 'fainted', species: 'c034' });
  });

  it('저장의 companion과 다른 종이 싸웠으면 싸운 종이 받는다', () => {
    useGameStore.getState().chooseStarter('c036', NOW);
    useGameStore.setState((s) => ({
      field: { ...s.field, species: { ...s.field.species, c034: { level: 5, exp: 0, stage: 1, caught: 1, firstCaughtAt: NOW, hp: 100, wounds: [], skills: ['c034-1', 'c034-2'] } } },
    }));
    useGameStore.getState().finishWildBattle(batch({ companion: 'c034', end: 'escaped', correct: 0 }));
    expect(useGameStore.getState().field.species.c034!.exp).toBe(10);
    expect(useGameStore.getState().field.species.c036!.exp).toBe(0);
  });
});

describe('쓰러지면 도감의 다른 구구몬이 대신 함께 다님', () => {
  const wound: Wound = { factId: '7x8', type: 'product' };
  const entry = (level: number, hp: number, firstCaughtAt: number) => ({ level, exp: 0, stage: 1 as const, caught: 1, firstCaughtAt, hp, wounds: [], skills: ['c034-1'] });
  const meadow = { map: 'meadow' as const, x: 5, y: 8, facing: 'right' as const };
  const town = () => ({ map: 'town', ...townStart(), facing: 'down' });

  beforeEach(() => {
    useGameStore.getState().resetAll();
    useGameStore.getState().chooseStarter('c034', NOW);
    useGameStore.setState((s) => ({
      field: {
        ...s.field,
        position: meadow,
        species: { c034: entry(5, 20, 1), c036: entry(4, 100, 2), c031: entry(7, 0, 3), c037: entry(6, 60, 4) },
      },
    }));
  });

  it('체력이 0이 되는 한 번의 저장에서 체력·상처·마을 위치·동행이 함께 바뀐다', () => {
    const states: ReturnType<typeof useGameStore.getState>['field'][] = [];
    const unsub = useGameStore.subscribe((s) => states.push(s.field));
    const r = useGameStore.getState().damageCompanion('c034', 25, wound);
    unsub();
    // 쓰러진 c031(Lv7)은 빼고, 건강한 것 중 레벨이 가장 높은 c037(Lv6)
    expect(r).toEqual({ hp: 0, fainted: true, replacedBy: 'c037' });
    expect(states).toHaveLength(1);
    const f = states[0];
    expect(f.species.c034).toMatchObject({ hp: 0, wounds: [wound] });
    expect(f.position).toEqual(town());
    expect(f.companion).toBe('c037');
    // 대신 다니는 구구몬의 기록은 그대로
    expect(f.species.c037).toEqual(entry(6, 60, 4));
  });

  it('쓰러지지 않으면 동행은 그대로', () => {
    const r = useGameStore.getState().damageCompanion('c034', 10, wound);
    expect(r).toEqual({ hp: 10, fainted: false, replacedBy: null });
    expect(useGameStore.getState().field.companion).toBe('c034');
  });

  it('건강한 다른 구구몬이 없으면 동행은 그대로 (쓰러진 채)', () => {
    useGameStore.setState((s) => ({ field: { ...s.field, species: { c034: entry(5, 20, 1), c031: entry(7, 0, 3) } } }));
    const r = useGameStore.getState().damageCompanion('c034', 25, wound);
    expect(r).toEqual({ hp: 0, fainted: true, replacedBy: null });
    const f = useGameStore.getState().field;
    expect(f.companion).toBe('c034');
    expect(f.position).toEqual(town());
  });

  it('이미 쓰러진 종을 또 때려도 아무것도 안 바뀐다 (위치·상처·동행 그대로)', () => {
    useGameStore.setState((s) => ({ field: { ...s.field, species: { ...s.field.species, c034: entry(5, 0, 1) } } }));
    const before = useGameStore.getState().field;
    const r = useGameStore.getState().damageCompanion('c034', 25, wound);
    expect(r).toEqual({ hp: 0, fainted: true, replacedBy: null });
    expect(useGameStore.getState().field).toBe(before);
    expect(useGameStore.getState().field.position).toEqual(meadow);
    expect(useGameStore.getState().field.species.c034!.wounds).toEqual([]);
  });

  it('동행이 아닌 종이 쓰러지면 동행은 바뀌지 않는다', () => {
    useGameStore.setState((s) => ({ field: { ...s.field, companion: 'c036' } }));
    const r = useGameStore.getState().damageCompanion('c034', 25, wound);
    expect(r.replacedBy).toBeNull();
    expect(useGameStore.getState().field.companion).toBe('c036');
  });

  it('옛 저장(companion null): 화면이 고른 첫 종이 쓰러지면 대신 다닐 종이 정해진다', () => {
    useGameStore.setState((s) => ({ field: { ...s.field, companion: null } }));
    const r = useGameStore.getState().damageCompanion('c034', 25, wound);
    expect(r.replacedBy).toBe('c037');
    expect(useGameStore.getState().field.companion).toBe('c037');
  });

  it('옛 저장(companion null, 다른 종 없음): 깨지지 않고 동행은 null 그대로', () => {
    useGameStore.setState((s) => ({ field: { ...s.field, companion: null, species: { c034: entry(5, 20, 1) } } }));
    const r = useGameStore.getState().damageCompanion('c034', 25, wound);
    expect(r).toEqual({ hp: 0, fainted: true, replacedBy: null });
    expect(useGameStore.getState().field.companion).toBeNull();
  });

  it('옛 저장(종 기록이 없음): 아무것도 안 바뀐다', () => {
    useGameStore.setState((s) => ({ field: { ...s.field, companion: null, species: {} } }));
    const before = useGameStore.getState().field;
    expect(useGameStore.getState().damageCompanion('c034', 25, wound)).toEqual({ hp: 0, fainted: false, replacedBy: null });
    expect(useGameStore.getState().field).toBe(before);
  });

  it('finishWildBattle: 대신 다니게 된 종을 쓰러짐 알림에 담고, 경험치는 싸운 종이 받는다', () => {
    useGameStore.getState().damageCompanion('c034', 25, wound);
    const r = useGameStore.getState().finishWildBattle(batch({ companion: 'c034', end: 'fainted', correct: 2 }));
    expect(r.notices[0]).toEqual({ kind: 'fainted', species: 'c034', replacedBy: 'c037' });
    const f = useGameStore.getState().field;
    expect(f.species.c034!.exp).toBe(14);
    expect(f.species.c037!.exp).toBe(0);
    expect(f.companion).toBe('c037');
  });

  it('finishWildBattle: 대신 다닐 종이 없으면 알림은 예전 그대로', () => {
    useGameStore.setState((s) => ({ field: { ...s.field, species: { c034: entry(5, 20, 1) } } }));
    useGameStore.getState().damageCompanion('c034', 25, wound);
    const r = useGameStore.getState().finishWildBattle(batch({ companion: 'c034', end: 'fainted', correct: 0 }));
    expect(r.notices[0]).toEqual({ kind: 'fainted', species: 'c034' });
  });

  it('finishWildBattle: 쓰러지지 않고 끝나면 동행이 달라도 replacedBy가 없다', () => {
    const r = useGameStore.getState().finishWildBattle(batch({ companion: 'c036', end: 'escaped', correct: 0 }));
    expect(r.notices.some((n) => n.kind === 'fainted')).toBe(false);
  });

  it('회복해도 원래 동행으로 저절로 돌아가지 않는다', () => {
    useGameStore.getState().damageCompanion('c034', 25, wound);
    useGameStore.getState().healSpecies('c034');
    expect(useGameStore.getState().field.companion).toBe('c037');
    expect(useGameStore.getState().field.species.c034!.hp).toBe(100);
  });

  it('대신 다니는 동행은 저장 대상(partialize)과 백업 currentSave()에 들어간다', () => {
    useGameStore.getState().damageCompanion('c034', 25, wound);
    const persisted = useGameStore.persist.getOptions().partialize!(useGameStore.getState()) as { field: { companion: unknown } };
    expect(persisted.field.companion).toBe('c037');
    expect(currentSave().field.companion).toBe('c037');
  });
});

describe('캡슐 개수 저장', () => {
  beforeEach(() => {
    useGameStore.getState().resetAll();
  });

  it('처음은 3·3·3·0', () => {
    expect(useGameStore.getState().field.capsules).toEqual({ meadow: 3, waterside: 3, desert: 3, legend: 0 });
  });

  it('spendCapsule: 0 아래로 안 감', () => {
    useGameStore.setState((s) => ({ field: { ...s.field, capsules: { ...s.field.capsules, desert: 1 } } }));
    expect(useGameStore.getState().spendCapsule('desert')).toBe(true);
    expect(useGameStore.getState().spendCapsule('desert')).toBe(false);
    expect(useGameStore.getState().field.capsules.desert).toBe(0);
  });

  it('spendCapsule: 한 번에 그 종류만 정확히 1개, 0이면 상태를 바꾸지 않는다', () => {
    useGameStore.getState().chooseStarter('c034', NOW);
    expect(useGameStore.getState().spendCapsule('meadow')).toBe(true);
    expect(useGameStore.getState().field.capsules).toEqual({ meadow: 2, waterside: 3, desert: 3, legend: 0 });
    const before = useGameStore.getState().field;
    expect(useGameStore.getState().spendCapsule('legend')).toBe(false);
    expect(useGameStore.getState().field).toBe(before);
  });

  it('grantCapsules: 더한다, 음수·소수는 무시', () => {
    useGameStore.getState().grantCapsules('legend', 3);
    useGameStore.getState().grantCapsules('meadow', 3);
    expect(useGameStore.getState().field.capsules).toEqual({ meadow: 6, waterside: 3, desert: 3, legend: 3 });
    useGameStore.getState().grantCapsules('meadow', -5);
    useGameStore.getState().grantCapsules('meadow', 1.5);
    expect(useGameStore.getState().field.capsules.meadow).toBe(6);
  });

  it('쓴 캡슐은 저장 대상(partialize)과 백업 currentSave()에 들어간다', () => {
    useGameStore.getState().spendCapsule('waterside');
    const persisted = useGameStore.persist.getOptions().partialize!(useGameStore.getState()) as { field: { capsules: unknown } };
    expect(persisted.field.capsules).toEqual({ meadow: 3, waterside: 2, desert: 3, legend: 0 });
    expect(currentSave().field.capsules).toEqual({ meadow: 3, waterside: 2, desert: 3, legend: 0 });
  });
});

describe('레벨업으로 기술 배우기 · 2% 복사', () => {
  /** 동행 구구몬 기록을 직접 넣는다 */
  function seed(species: SpeciesId, over: Partial<SpeciesEntry>) {
    useGameStore.getState().resetAll();
    useGameStore.setState((s) => ({
      field: {
        ...s.field,
        starterChosen: true,
        companion: species,
        species: { [species]: { level: 1, exp: 0, stage: 1, caught: 1, firstCaughtAt: NOW, hp: 100, wounds: [], skills: [`${species}-1`], ...over } },
      },
    }));
  }
  const held = (id: SpeciesId) => useGameStore.getState().field.species[id]!.skills;
  /** 차례로 값을 돌려주는 가짜 난수 (다 쓰면 1 = 꽝) */
  const seq = (...v: number[]) => vi.fn(() => (v.length ? v.shift()! : 1));
  /** 부속성 자리를 복사한 기술(c031-1)이 차지한 Lv8~ 구름몬 (주①·주②·특수 + 복사) */
  const COPIED_SUB = ['c034-1', 'c034-2', 'c034-3', 'c031-1'];

  beforeEach(() => useGameStore.getState().resetAll());

  it('Lv1→3: 슬롯 2를 자동으로 가지고 "배웠어요" 알림', () => {
    seed('c034', {});
    // 참여 10 + 30×2 = 70 = Lv1(30)+Lv2(40)
    const r = useGameStore.getState().finishWildBattle(batch({ companion: 'c034', end: 'escaped', correct: 30 }));
    expect(useGameStore.getState().field.species.c034!.level).toBe(3);
    expect(held('c034')).toEqual(['c034-1', 'c034-2']);
    expect(r.notices).toEqual([
      { kind: 'levelUp', species: 'c034', level: 3 },
      { kind: 'skill', species: 'c034', skillId: 'c034-2', how: 'learned' },
    ]);
    expect(r.offers).toEqual([]);
  });

  it('Lv1→9: 슬롯 2·3을 레벨 순서로', () => {
    seed('c034', {});
    // 30+40+…+100 = 520 = 10 + 255×2
    const r = useGameStore.getState().finishWildBattle(batch({ companion: 'c034', end: 'escaped', correct: 255 }));
    expect(useGameStore.getState().field.species.c034!.level).toBe(9);
    expect(held('c034')).toEqual(['c034-1', 'c034-2', 'c034-3']);
    expect(r.notices.flatMap((n) => (n.kind === 'skill' ? [n.skillId] : []))).toEqual(['c034-2', 'c034-3']);
  });

  it('스타터(Lv5, 기술 1개)는 Lv6이 되면 슬롯 2를 채운다', () => {
    useGameStore.getState().chooseStarter('c034', NOW);
    expect(held('c034')).toEqual(['c034-1']);
    useGameStore.getState().finishWildBattle(batch({ companion: 'c034', end: 'escaped', correct: 30 })); // 70 = Lv5→6
    expect(held('c034')).toEqual(['c034-1', 'c034-2']);
  });

  it('레벨이 오르지 않으면 모자란 기술도 채우지 않는다', () => {
    seed('c034', { level: 5 });
    const r = useGameStore.getState().finishWildBattle(batch({ companion: 'c034', end: 'escaped', correct: 0 }));
    expect(held('c034')).toEqual(['c034-1']);
    expect(r.notices).toEqual([]);
  });

  it('옛 저장 이월(Lv8: 슬롯 1·2·5) → Lv9에 3, Lv14에 4를 채우고, Lv20의 슬롯 5는 건너뛴다', () => {
    seed('c034', { level: 8, skills: ['c034-1', 'c034-2', 'c034-5'] });
    useGameStore.getState().finishWildBattle(batch({ companion: 'c034', end: 'escaped', correct: 45 })); // 100 = Lv8→9
    expect(held('c034')).toEqual(['c034-1', 'c034-2', 'c034-5', 'c034-3']);
    seed('c034', { level: 13, skills: ['c034-1', 'c034-2', 'c034-5', 'c034-3'] });
    useGameStore.getState().finishWildBattle(batch({ companion: 'c034', end: 'escaped', correct: 70 })); // 150 = Lv13→14
    expect(held('c034')).toEqual(['c034-1', 'c034-2', 'c034-5', 'c034-3', 'c034-4']);
    seed('c034', { level: 19, skills: ['c034-1', 'c034-2', 'c034-5', 'c034-3', 'c034-4'] });
    const r = useGameStore.getState().finishWildBattle(batch({ companion: 'c034', end: 'escaped', correct: 100 })); // 210 = Lv19→20
    expect(useGameStore.getState().field.species.c034!.level).toBe(20);
    expect(r.offers).toEqual([]);
    expect(r.notices.some((n) => n.kind === 'skill')).toBe(false);
  });

  it('부속성 자리가 복사한 기술로 차 있으면 새로 익힌 4번은 제안만 쌓이고 저장(기술)은 그대로, set은 한 번', () => {
    seed('c034', { level: 13, skills: COPIED_SUB });
    let calls = 0;
    const unsub = useGameStore.subscribe(() => calls++);
    const r = useGameStore.getState().finishWildBattle(batch({ companion: 'c034', end: 'escaped', correct: 70 })); // Lv14
    unsub();
    expect(calls).toBe(1);
    expect(useGameStore.getState().field.species.c034!.level).toBe(14);
    expect(held('c034')).toEqual(COPIED_SUB);
    expect(r.offers).toEqual([{ species: 'c034', skillId: 'c034-4', source: 'level', seat: 'sub', removeId: 'c031-1' }]);
    expect(r.notices.some((n) => n.kind === 'skill')).toBe(false);
  });

  it('특수 자리가 복사한 특수로 차 있으면 Lv8의 3번은 제안으로', () => {
    seed('c034', { level: 7, skills: ['c034-1', 'c034-2', 'c036-3'] });
    const r = useGameStore.getState().finishWildBattle(batch({ companion: 'c034', end: 'escaped', correct: 40 })); // 90 = Lv7→8
    expect(useGameStore.getState().field.species.c034!.level).toBe(8);
    expect(held('c034')).toEqual(['c034-1', 'c034-2', 'c036-3']);
    expect(r.offers).toEqual([{ species: 'c034', skillId: 'c034-3', source: 'level', seat: 'special', removeId: 'c036-3' }]);
  });

  it('주속성은 자리 제한 없이 레벨이 되면 채운다, 예전에 익힌 4번은 다시 제안하지 않는다', () => {
    seed('c034', { level: 15, skills: ['c034-1', 'c034-3', 'c031-1'] }); // c034-2 없음, 부속성 자리는 복사
    const r = useGameStore.getState().finishWildBattle(batch({ companion: 'c034', end: 'escaped', correct: 85 })); // 180 = Lv15→16
    expect(useGameStore.getState().field.species.c034!.level).toBe(16);
    expect(held('c034')).toEqual(['c034-1', 'c034-3', 'c031-1', 'c034-2']);
    expect(r.offers).toEqual([]);
  });

  it('여러 개를 배우다: 주속성·빈 특수 자리는 채우고, 차 있는 부속성 자리의 새 4번은 제안', () => {
    seed('c034', { level: 13, skills: ['c034-1', 'c031-1'] }); // 슬롯 2·3은 아직
    // 150+160+170+180+190+200+210 = 1260 = 10 + 625×2 → Lv20
    const r = useGameStore.getState().finishWildBattle(batch({ companion: 'c034', end: 'escaped', correct: 625 }));
    expect(useGameStore.getState().field.species.c034!.level).toBe(20);
    expect(held('c034')).toEqual(['c034-1', 'c031-1', 'c034-2', 'c034-3', 'c034-5']);
    expect(r.offers).toEqual([{ species: 'c034', skillId: 'c034-4', source: 'level', seat: 'sub', removeId: 'c031-1' }]);
  });

  it('옛 저장(기술 칸 없음)을 읽은 뒤 레벨이 올라도 깨지지 않는다', () => {
    const field = mergeField(initialField(), {
      starterChosen: true,
      companion: 'c036',
      species: { c036: { level: 7, exp: 85, stage: 1, caught: 1, firstCaughtAt: 1 } },
    });
    useGameStore.setState({ field });
    const r = useGameStore.getState().finishWildBattle(batch({ species: 'c036', companion: 'c036', correct: 5 }));
    expect(held('c036')).toEqual(['c036-1', 'c036-2', 'c036-3']);
    expect(r.notices).toContainEqual({ kind: 'skill', species: 'c036', skillId: 'c036-3', how: 'learned' });
  });

  describe('복사', () => {
    it('경계: COPY_CHANCE 미만이면 당첨(5개 미만이라 바로 가짐 + 알림), 이상이면 없음', () => {
      seed('c034', { level: 5 });
      const r = useGameStore.getState().finishWildBattle(batch({ companion: 'c034', correct: 0, rng: seq(0.0199, 0) }));
      expect(held('c034')).toEqual(['c034-1', 'c031-1']);
      expect(r.notices).toContainEqual({ kind: 'skill', species: 'c034', skillId: 'c031-1', how: 'copied', fromSpecies: 'c031' });
      expect(r.offers).toEqual([]);

      seed('c034', { level: 5 });
      const r2 = useGameStore.getState().finishWildBattle(batch({ companion: 'c034', correct: 0, rng: seq(COPY_CHANCE, 0) }));
      expect(held('c034')).toEqual(['c034-1']);
      expect(r2.notices).toEqual([]);
    });

    it('돌려보냄(released)도 복사', () => {
      seed('c034', { level: 5 });
      useGameStore.getState().finishWildBattle(batch({ companion: 'c034', end: 'released', correct: 0, rng: seq(0, 0.99) }));
      expect(held('c034')).toEqual(['c034-1', 'c031-2']); // 야생 뿔몬 Lv4: 1·2 중 마지막
    });

    it('후보가 없으면(야생 기술을 이미 다 가짐) 아무 일 없음', () => {
      seed('c034', { level: 5, skills: ['c034-1', 'c031-1'] });
      // 야생 뿔몬 Lv1은 1번만 안다
      const r = useGameStore.getState().finishWildBattle(batch({ companion: 'c034', level: 1, correct: 0, rng: seq(0, 0) }));
      expect(held('c034')).toEqual(['c034-1', 'c031-1']);
      expect(r.notices).toEqual([]);
      expect(r.offers).toEqual([]);
    });

    it('부속성 자리가 차 있으면 제안만 (출처 종과 함께), 저장 그대로', () => {
      seed('c034', { level: 8, skills: COPIED_SUB });
      const before = held('c034');
      const r = useGameStore.getState().finishWildBattle(batch({ companion: 'c034', correct: 0, rng: seq(0, 0) }));
      expect(held('c034')).toBe(before);
      expect(r.offers).toEqual([{ species: 'c034', skillId: 'c031-2', source: 'copy', fromSpecies: 'c031', seat: 'sub', removeId: 'c031-1' }]); // c031-1은 이미 가짐
      expect(r.notices.some((n) => n.kind === 'skill')).toBe(false);
    });

    it('특수 복사: 특수 자리가 비면 바로 가지고, 차 있으면 제안', () => {
      // 야생 버섯몬 Lv8: 1·2·3 → 가진 1·2를 빼면 2개, 두 번째 난수 0.99면 3번(방어)
      seed('c034', { level: 5 });
      useGameStore.getState().finishWildBattle(batch({ species: 'c042', companion: 'c034', level: 8, correct: 0, rng: seq(0, 0.99) }));
      expect(held('c034')).toEqual(['c034-1', 'c042-3']);
      seed('c034', { level: 8, skills: ['c034-1', 'c034-3'] });
      const r = useGameStore.getState().finishWildBattle(batch({ species: 'c042', companion: 'c034', level: 8, correct: 0, rng: seq(0, 0.99) }));
      expect(held('c034')).toEqual(['c034-1', 'c034-3']);
      expect(r.offers).toEqual([{ species: 'c034', skillId: 'c042-3', source: 'copy', fromSpecies: 'c042', seat: 'special', removeId: 'c034-3' }]);
    });

    it('도망(escaped)·쓰러짐(fainted)·그만하기(quit)는 굴리지 않는다', () => {
      for (const end of ['escaped', 'fainted', 'quit'] as const) {
        seed('c034', { level: 5 });
        const rng = seq(0, 0);
        useGameStore.getState().finishWildBattle(batch({ companion: 'c034', end, correct: 0, rng }));
        expect(rng).not.toHaveBeenCalled();
        expect(held('c034')).toEqual(['c034-1']);
      }
    });

    it('한 전투에 한 번만 굴린다', () => {
      seed('c034', { level: 5 });
      const rng = seq(0, 0);
      useGameStore.getState().finishWildBattle(batch({ companion: 'c034', correct: 0, rng }));
      expect(rng).toHaveBeenCalledTimes(2); // 당첨 1번 + 고르기 1번
    });

    it('같은 종 야생: 동행 레벨에서 아직 못 익히는 자기 종 기술은 후보가 아니다', () => {
      seed('c034', { level: 5 });
      // 야생 구름몬 Lv14(1~4 익힘), 동행 Lv5는 1·2까지 → 가진 1을 빼면 2만 (경험치 50으로는 레벨이 안 오름)
      useGameStore.getState().finishWildBattle(batch({ species: 'c034', companion: 'c034', level: 14, correct: 0, rng: seq(0, 0.99) }));
      expect(held('c034')).toEqual(['c034-1', 'c034-2']);
    });

    it('레벨업으로 배운 다음에 복사 (한 번의 set)', () => {
      seed('c034', { level: 1 });
      let calls = 0;
      const unsub = useGameStore.subscribe(() => calls++);
      const r = useGameStore.getState().finishWildBattle(batch({ companion: 'c034', correct: 30, rng: seq(0, 0) }));
      unsub();
      expect(calls).toBe(1);
      expect(held('c034')).toEqual(['c034-1', 'c034-2', 'c031-1']);
      expect(r.notices.flatMap((n) => (n.kind === 'skill' ? [n.how] : []))).toEqual(['learned', 'copied']);
    });
  });

  describe('제안의 자리(seat)와 잊을 기술(removeId)', () => {
    it('Lv14: 복사 기술이 부속성 자리를 차지하면 4번은 seat sub·removeId 복사 기술로 제안 (주속성·빈 특수 자리는 그대로 자동)', () => {
      seed('c034', { level: 13, skills: ['c034-1', 'c034-2', 'c036-1'] });
      const r = useGameStore.getState().finishWildBattle(batch({ companion: 'c034', end: 'escaped', correct: 70 })); // Lv14
      expect(held('c034')).toEqual(['c034-1', 'c034-2', 'c036-1', 'c034-3']);
      expect(r.offers).toEqual([{ species: 'c034', skillId: 'c034-4', source: 'level', seat: 'sub', removeId: 'c036-1' }]);
    });
    it('복사한 다른 종의 주속성 기술은 부속성 자리로: 비어 있으면 바로, 차 있으면 그 자리 기술을 잊는 제안', () => {
      seed('c034', { level: 8, skills: ['c034-1', 'c034-2', 'c034-3'] });
      useGameStore.getState().finishWildBattle(batch({ companion: 'c034', level: 1, correct: 0, rng: seq(0, 0) }));
      expect(held('c034')).toEqual(['c034-1', 'c034-2', 'c034-3', 'c031-1']);
      // 이번엔 부속성 자리가 c031-1로 차 있다 → 야생 젤리몬 1번은 제안 (removeId = c031-1)
      const r = useGameStore.getState().finishWildBattle(batch({ species: 'c036', companion: 'c034', level: 1, correct: 0, rng: seq(0, 0) }));
      expect(held('c034')).toEqual(['c034-1', 'c034-2', 'c034-3', 'c031-1']);
      expect(r.offers).toEqual([{ species: 'c034', skillId: 'c036-1', source: 'copy', fromSpecies: 'c036', seat: 'sub', removeId: 'c031-1' }]);
      // 받으면 c031-1이 빠지고 c036-1이 그 자리에
      expect(useGameStore.getState().acceptSkillOffer(r.offers[0], r.offers[0].removeId!)).toBe(true);
      expect(held('c034')).toEqual(['c034-1', 'c034-2', 'c034-3', 'c036-1']);
    });
    it('자기 종 4번을 잊고 복사 기술을 받으면 4번은 "아는 기술"로 남아 같은 자리로 되돌릴 수 있다', () => {
      seed('c034', { level: 14, skills: ['c034-1', 'c034-2', 'c034-3', 'c034-4'] });
      const r = useGameStore.getState().finishWildBattle(batch({ companion: 'c034', level: 1, correct: 0, rng: seq(0, 0) }));
      expect(r.offers).toEqual([{ species: 'c034', skillId: 'c031-1', source: 'copy', fromSpecies: 'c031', seat: 'sub', removeId: 'c034-4' }]);
      expect(useGameStore.getState().acceptSkillOffer(r.offers[0], 'c034-4')).toBe(true);
      expect(held('c034')).toEqual(['c034-1', 'c034-2', 'c034-3', 'c031-1']);
      expect(useGameStore.getState().replaceSkill('c034', 'c031-1', 'c034-4')).toBe(true);
    });
  });

  describe('acceptSkillOffer (같은 자리끼리만)', () => {
    it('하나 잊고 배우기: 부속성 자리의 복사 기술을 잊고 4번, 잊은 자리에 넣고 set 한 번', () => {
      seed('c034', { level: 14, skills: COPIED_SUB });
      let calls = 0;
      const unsub = useGameStore.subscribe(() => calls++);
      const ok = useGameStore.getState().acceptSkillOffer({ species: 'c034', skillId: 'c034-4', source: 'level', seat: 'sub', removeId: 'c031-1' }, 'c031-1');
      unsub();
      expect(ok).toBe(true);
      expect(calls).toBe(1);
      expect(held('c034')).toEqual(['c034-1', 'c034-2', 'c034-3', 'c034-4']);
    });

    it('복사 제안도 받는다 (속성 → 부속성 자리, 특수 → 특수 자리)', () => {
      seed('c034', { level: 8, skills: COPIED_SUB });
      expect(useGameStore.getState().acceptSkillOffer({ species: 'c034', skillId: 'c037-1', source: 'copy', fromSpecies: 'c037', seat: 'sub' }, 'c031-1')).toBe(true);
      expect(held('c034')).toEqual(['c034-1', 'c034-2', 'c034-3', 'c037-1']);
      expect(useGameStore.getState().acceptSkillOffer({ species: 'c034', skillId: 'c037-3', source: 'copy', fromSpecies: 'c037', seat: 'special' }, 'c034-3')).toBe(true);
      expect(held('c034')).toEqual(['c034-1', 'c034-2', 'c037-3', 'c037-1']);
    });

    it('거부: 자리가 다름·주속성 잊기·레벨이 모자람·잊을 기술을 안 가짐·이미 가짐·없는 종·모르는 기술 → false, 상태 그대로', () => {
      seed('c034', { level: 8, skills: COPIED_SUB });
      const before = useGameStore.getState();
      let calls = 0;
      const unsub = useGameStore.subscribe(() => calls++);
      const accept = useGameStore.getState().acceptSkillOffer;
      expect(accept({ species: 'c034', skillId: 'c037-1', source: 'copy', seat: 'sub' }, 'c034-2')).toBe(false); // 주② 자리를 복사로
      expect(accept({ species: 'c034', skillId: 'c037-1', source: 'copy', seat: 'sub' }, 'c034-3')).toBe(false); // 특수 자리에 속성 기술
      expect(accept({ species: 'c034', skillId: 'c037-3', source: 'copy', seat: 'special' }, 'c031-1')).toBe(false); // 부속성 자리에 특수
      expect(accept({ species: 'c034', skillId: 'c034-4', source: 'level', seat: 'sub' }, 'c031-1')).toBe(false); // Lv8에 슬롯 4(Lv14)
      expect(accept({ species: 'c034', skillId: 'c037-1', source: 'copy', seat: 'sub' }, 'c042-1')).toBe(false);
      expect(accept({ species: 'c034', skillId: 'c031-1', source: 'copy', seat: 'sub' }, 'c034-3')).toBe(false);
      expect(accept({ species: 'c036', skillId: 'c036-2', source: 'level', seat: 'sub' }, 'c036-1')).toBe(false);
      expect(accept({ species: 'c034', skillId: 'nope', source: 'copy', seat: 'sub' }, 'c031-1')).toBe(false);
      unsub();
      expect(calls).toBe(0);
      expect(useGameStore.getState()).toBe(before);
    });
  });
});

describe('세션: 기술 제안 대기열', () => {
  it('pushSkillOffer는 뒤에 쌓고, shiftSkillOffer는 앞에서 하나 뺀다', () => {
    useSessionStore.getState().set({ skillOffers: [] });
    useSessionStore.getState().pushSkillOffer(
      { species: 'c034', skillId: 'c034-4', source: 'level', seat: 'sub' },
      { species: 'c034', skillId: 'c031-2', source: 'copy', fromSpecies: 'c031', seat: 'sub' },
    );
    useSessionStore.getState().pushSkillOffer();
    expect(useSessionStore.getState().skillOffers.map((o) => o.skillId)).toEqual(['c034-4', 'c031-2']);
    useSessionStore.getState().shiftSkillOffer();
    expect(useSessionStore.getState().skillOffers.map((o) => o.skillId)).toEqual(['c031-2']);
    useSessionStore.getState().shiftSkillOffer();
    useSessionStore.getState().shiftSkillOffer();
    expect(useSessionStore.getState().skillOffers).toEqual([]);
  });
});

describe('꾸미기 저장·스토어 (field.costume)', () => {
  const g = globalThis as { __GUGU_E2E_STARS__?: unknown };
  const st = () => useGameStore.getState();
  const paid = COSTUME_SETS.find((s) => s.price > 0)!;
  const setStars = (n: number) => useGameStore.setState({ field: { ...st().field, starPoints: n } });
  beforeEach(() => {
    g.__GUGU_E2E_STARS__ = true;
    st().resetAll();
  });
  afterEach(() => {
    delete g.__GUGU_E2E_STARS__;
  });

  it('새 저장은 basic만 가지고 basic을 입음', () => {
    expect(initialField().costume).toEqual(emptyCostume());
    expect(createInitialSave(NOW).field.costume).toEqual(emptyCostume());
    expect(st().field.costume).toEqual(emptyCostume());
  });
  it('옛 저장(costume 칸 없음)은 기본값으로 채워진다 — 다른 칸은 그대로', () => {
    const { costume: _c, ...old } = initialField() as unknown as Record<string, unknown>;
    const merged = mergeField(initialField(), { ...old, starPoints: 30 });
    expect(merged.costume).toEqual(emptyCostume());
    expect(merged.starPoints).toBe(30);
    const save = { ...createInitialSave(NOW), field: { ...old, starPoints: 8 } };
    const m2 = mergeSave(createInitialSave(NOW), save);
    expect(m2.field.costume).toEqual(emptyCostume());
    expect(m2.field.starPoints).toBe(8);
  });
  it('모르는 id는 버리고, 입은 것이 사라지면 basic', () => {
    const merged = mergeField(initialField(), { ...initialField(), costume: { owned: ['nope', paid.id], equipped: 'nope' } });
    expect(merged.costume).toEqual({ owned: ['basic', paid.id], equipped: 'basic' });
    expect(mergeField(initialField(), { ...initialField(), costume: 'garbage' }).costume).toEqual(emptyCostume());
  });
  it('사기: 별 49는 실패(그대로), 50은 성공(가격만큼만 줄어듦)', () => {
    setStars(49);
    const before = st().field;
    expect(st().buyCostume(paid.id)).toEqual({ ok: false });
    expect(st().field).toBe(before);
    setStars(50 + 7);
    expect(st().buyCostume(paid.id)).toEqual({ ok: true });
    expect(st().field.starPoints).toBe(7);
    expect(st().field.costume.owned).toEqual(['basic', paid.id]);
    expect(st().field.costume.equipped).toBe('basic');
  });
  it('이미 가짐·모르는 id·basic은 실패, 별은 그대로', () => {
    setStars(500);
    st().buyCostume(paid.id);
    expect(st().buyCostume(paid.id)).toEqual({ ok: false });
    expect(st().buyCostume('nope')).toEqual({ ok: false });
    expect(st().buyCostume('basic')).toEqual({ ok: false });
    expect(st().field.starPoints).toBe(450);
  });
  it('별점수가 꺼져 있으면 사기 실패, 아무것도 안 바뀜', () => {
    setStars(500);
    g.__GUGU_E2E_STARS__ = false;
    const before = st().field;
    expect(st().buyCostume(paid.id)).toEqual({ ok: false });
    expect(st().field).toBe(before);
    expect(st().field.starPoints).toBe(500);
  });
  it('입기: 가진 것만, 저장에 남고 백업(currentSave)·불러오기(replaceSave)에 실린다', () => {
    setStars(50);
    expect(st().equipCostume(paid.id)).toEqual({ ok: false });
    st().buyCostume(paid.id);
    expect(st().equipCostume(paid.id)).toEqual({ ok: true });
    expect(st().field.costume.equipped).toBe(paid.id);
    expect(st().equipCostume('nope')).toEqual({ ok: false });
    expect(st().field.costume.equipped).toBe(paid.id);
    const backup = JSON.parse(JSON.stringify(currentSave()));
    expect(backup.field.costume).toEqual({ owned: ['basic', paid.id], equipped: paid.id });
    st().resetAll();
    expect(st().field.costume).toEqual(emptyCostume());
    st().replaceSave(backup);
    expect(st().field.costume).toEqual({ owned: ['basic', paid.id], equipped: paid.id });
  });
});
