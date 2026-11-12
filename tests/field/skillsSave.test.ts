import { beforeEach, describe, expect, it } from 'vitest';
import { initialField, legacySlots, mergeField, newSpeciesEntry, normalizeSkills, SPECIES_IDS, type SpeciesEntry, type SpeciesId } from '../../src/store/fieldData';
import { defaultSkills, skillDef } from '../../src/domain/field/skills';
import { MAX_SKILLS } from '../../src/domain/field/tuning';
import { useGameStore } from '../../src/store/useGameStore';
import { createInitialSave, mergeSave } from '../../src/store/saveData';
import { currentSave } from '../../src/screens/admin/DataSecurityPanels';

const NOW = new Date('2026-11-12T09:00:00').getTime();

/** 3차 전에 쓰던 기술 이름 3개 (옛 레벨 1·3·8에서 배움) — 이월 뒤에도 같은 이름이어야 한다 */
const OLD_MOVES: Record<SpeciesId, [string, string, string]> = {
  cloud: ['잎사귀 톡', '새싹 휙', '꽃잎 바람'],
  mushroom: ['방울 딸랑', '데굴데굴', '무 박치기'],
  fluff: ['왕관 반짝', '꼬리 흔들기', '몸통 박치기'],
  jelly: ['젤리 톡', '출렁 박치기', '거품 뿜기'],
  antenna: ['안테나 찌릿', '신호 빔', '빙글 돌기'],
  horn: ['뿔 콕', '돌진', '물결 치기'],
  pebble: ['블록 쾅', '세눈 빔', '단단해지기'],
  ghost: ['외뿔 찌르기', '꼬리 휘두르기', '공룡 함성'],
  'legend-fluff': ['황금 왕관 빛', '반짝 별가루', '금빛 박치기'],
  'legend-horn': ['황금 뿔 콕', '금빛 돌진', '반짝 물결'],
  'legend-ghost': ['황금 외뿔 찌르기', '금빛 꼬리치기', '황금 함성'],
};

/** 기술 칸이 없던 옛 종 기록 */
const oldEntry = (level: number) => ({ level, exp: 0, stage: 1, caught: 1, firstCaughtAt: 1, hp: 100, wounds: [] });
const merged = (species: SpeciesId, raw: unknown): SpeciesEntry | undefined =>
  mergeField(initialField(), { species: { [species]: raw } }).species[species];

describe('옛 저장 이월 (기술 칸 없음)', () => {
  const cases: [number, number[]][] = [
    [1, [1]], [2, [1]], [3, [1, 2]], [7, [1, 2]], [8, [1, 2, 5]], [14, [1, 2, 5]], [20, [1, 2, 5]],
  ];

  it.each(cases)('레벨 %i → 슬롯 %j', (level, slots) => {
    expect(legacySlots(level)).toEqual(slots);
    for (const sp of SPECIES_IDS) {
      const e = merged(sp, oldEntry(level))!;
      expect(e.skills).toEqual(slots.map((n) => `${sp}-${n}`));
    }
  });

  it('종마다 기술 이름이 예전 이름과 같다 (기술이 줄지 않음)', () => {
    for (const sp of SPECIES_IDS) {
      const at = (level: number) => merged(sp, oldEntry(level))!.skills.map((id) => skillDef(id).name);
      expect(at(1)).toEqual(OLD_MOVES[sp].slice(0, 1));
      expect(at(3)).toEqual(OLD_MOVES[sp].slice(0, 2));
      expect(at(8)).toEqual(OLD_MOVES[sp]);
      expect(at(30)).toEqual(OLD_MOVES[sp]);
    }
  });

  it('이월된 기록은 다시 읽어도 그대로 (슬롯 5가 레벨 8에서도 허용)', () => {
    const once = merged('jelly', oldEntry(8))!;
    expect(merged('jelly', JSON.parse(JSON.stringify(once)))).toEqual(once);
  });

  it('mergeSave를 지나도 이월된다', () => {
    const save = createInitialSave(NOW);
    const raw = { ...save, field: { ...save.field, species: { horn: oldEntry(9) } } };
    expect(mergeSave(createInitialSave(NOW), raw).field.species.horn!.skills).toEqual(['horn-1', 'horn-2', 'horn-5']);
  });
});

describe('normalizeSkills: 이상한 값 거르기', () => {
  it('맞는 값은 그대로 (순서 유지)', () => {
    expect(normalizeSkills('cloud', 20, ['cloud-5', 'cloud-1', 'cloud-4'])).toEqual(['cloud-5', 'cloud-1', 'cloud-4']);
  });

  it('모르는 id는 버린다', () => {
    expect(normalizeSkills('cloud', 5, ['cloud-1', 'dragon-1', 'cloud-9', 7, null])).toEqual(['cloud-1']);
  });

  it('레벨이 모자란 자기 종 기술은 버린다 (옛 이월 슬롯은 허용)', () => {
    // 레벨 2: 슬롯 2(Lv3)·슬롯 5(Lv20, 이월은 Lv8부터) 모두 안 됨
    expect(normalizeSkills('cloud', 2, ['cloud-1', 'cloud-2', 'cloud-5'])).toEqual(['cloud-1']);
    // 레벨 8: 슬롯 5는 옛 이월로 허용, 슬롯 4(Lv14)는 안 됨
    expect(normalizeSkills('cloud', 8, ['cloud-5', 'cloud-4', 'cloud-3'])).toEqual(['cloud-5', 'cloud-3']);
  });

  it('중복은 한 번만', () => {
    expect(normalizeSkills('cloud', 5, ['cloud-1', 'cloud-1', 'cloud-2', 'cloud-1'])).toEqual(['cloud-1', 'cloud-2']);
  });

  it(`${MAX_SKILLS + 1}개면 앞 ${MAX_SKILLS}개`, () => {
    const six = ['cloud-1', 'cloud-2', 'cloud-3', 'cloud-4', 'cloud-5', 'jelly-1'];
    expect(normalizeSkills('cloud', 30, six)).toEqual(six.slice(0, MAX_SKILLS));
  });

  it('빈 목록·남는 게 없으면 defaultSkills', () => {
    expect(normalizeSkills('jelly', 8, [])).toEqual(defaultSkills('jelly', 8));
    expect(normalizeSkills('jelly', 8, ['nope', 'jelly-4'])).toEqual(defaultSkills('jelly', 8));
  });

  it('배열이 아니면(null·문자열·숫자·객체) defaultSkills', () => {
    for (const bad of [null, 'cloud-1', 3, { 0: 'cloud-1' }]) {
      expect(normalizeSkills('cloud', 14, bad)).toEqual(defaultSkills('cloud', 14));
      expect(merged('cloud', { ...oldEntry(14), skills: bad })!.skills).toEqual(defaultSkills('cloud', 14));
    }
  });

  it('다른 종 기술(따라 배운 것)은 레벨과 상관없이 허용', () => {
    expect(normalizeSkills('cloud', 1, ['cloud-1', 'horn-5', 'legend-ghost-3'])).toEqual(['cloud-1', 'horn-5', 'legend-ghost-3']);
    expect(merged('cloud', { ...oldEntry(1), skills: ['horn-5'] })!.skills).toEqual(['horn-5']);
  });

  it('mergeEntry도 같은 규칙 (깨진 칸만 걸러지고 나머지 기록은 그대로)', () => {
    const e = merged('cloud', { ...oldEntry(2), exp: 7, skills: ['cloud-1', 'cloud-1', 'cloud-5', 'x'] })!;
    expect(e).toEqual({ ...oldEntry(2), exp: 7, skills: ['cloud-1'] });
  });
});

describe('newSpeciesEntry', () => {
  it('그 레벨에서 익힌 기술 전부로 시작', () => {
    expect(newSpeciesEntry('jelly', 8, NOW).skills).toEqual(defaultSkills('jelly', 8));
    expect(newSpeciesEntry('jelly', 8, NOW)).toEqual({ level: 8, exp: 0, stage: 1, caught: 1, firstCaughtAt: NOW, hp: 100, wounds: [], skills: ['jelly-1', 'jelly-2', 'jelly-3'] });
    expect(newSpeciesEntry('horn', 1, NOW).skills).toEqual(['horn-1']);
  });

  it('스타터(레벨 5)와 새로 잡은 구구몬에 기술이 들어간다', () => {
    useGameStore.getState().resetAll();
    useGameStore.getState().chooseStarter('cloud', NOW);
    // 스타터는 기술 1개(슬롯 1)로 시작, 잡은 구구몬은 그 레벨에서 익힌 것 전부
    expect(useGameStore.getState().field.species.cloud!.skills).toEqual(['cloud-1']);
    useGameStore.getState().finishWildBattle({ species: 'horn', companion: 'cloud', level: 14, tier: 'normal', end: 'caught', correct: 0, now: NOW, rng: () => 1 });
    expect(useGameStore.getState().field.species.horn!.skills).toEqual(defaultSkills('horn', 14));
  });
});

describe('기술 바꾸기 액션', () => {
  const put = (species: SpeciesId, level: number, skills: string[]) =>
    useGameStore.setState((s) => ({ field: { ...s.field, species: { ...s.field.species, [species]: { ...oldEntry(level), stage: 1 as const, skills } } } }));
  const held = (species: SpeciesId) => useGameStore.getState().field.species[species]!.skills;
  /** 거부되면 상태 객체가 그대로이고 저장 알림도 없어야 한다 */
  const expectUnchanged = (fn: () => boolean) => {
    const before = useGameStore.getState();
    let calls = 0;
    const unsub = useGameStore.subscribe(() => calls++);
    expect(fn()).toBe(false);
    unsub();
    expect(useGameStore.getState()).toBe(before);
    expect(calls).toBe(0);
  };
  const expectOneSet = (fn: () => boolean) => {
    let calls = 0;
    const unsub = useGameStore.subscribe(() => calls++);
    expect(fn()).toBe(true);
    unsub();
    expect(calls).toBe(1);
  };

  beforeEach(() => {
    useGameStore.getState().resetAll();
    put('cloud', 8, ['cloud-1', 'cloud-2', 'cloud-3']);
  });

  describe('replaceSkill', () => {
    it('가진 기술을 잊고 익힌 자기 기술로 바꾼다 (자리 그대로)', () => {
      put('cloud', 8, ['cloud-1', 'cloud-2']);
      expectOneSet(() => useGameStore.getState().replaceSkill('cloud', 'cloud-1', 'cloud-3'));
      expect(held('cloud')).toEqual(['cloud-3', 'cloud-2']);
    });

    it('다른 종 기술(따라 배우기)로 바꿀 수 있다', () => {
      expect(useGameStore.getState().replaceSkill('cloud', 'cloud-2', 'horn-5')).toBe(true);
      expect(held('cloud')).toEqual(['cloud-1', 'horn-5', 'cloud-3']);
    });

    it('옛 이월 슬롯(레벨 8의 슬롯 5)으로 바꿀 수 있다', () => {
      expect(useGameStore.getState().replaceSkill('cloud', 'cloud-3', 'cloud-5')).toBe(true);
      expect(held('cloud')).toEqual(['cloud-1', 'cloud-2', 'cloud-5']);
    });

    it('거부: 안 가진 기술 잊기, 이미 가진 기술·모르는 기술·레벨 모자란 기술 배우기, 같은 기술, 없는 종', () => {
      const g = () => useGameStore.getState();
      expectUnchanged(() => g().replaceSkill('cloud', 'cloud-4', 'horn-1'));
      expectUnchanged(() => g().replaceSkill('cloud', 'cloud-1', 'cloud-2'));
      expectUnchanged(() => g().replaceSkill('cloud', 'cloud-1', 'cloud-1'));
      expectUnchanged(() => g().replaceSkill('cloud', 'cloud-1', 'dragon-1'));
      expectUnchanged(() => g().replaceSkill('cloud', 'cloud-1', 'cloud-4')); // Lv14 기술
      expectUnchanged(() => g().replaceSkill('horn', 'horn-1', 'horn-2')); // 아직 없는 종
      expectUnchanged(() => g().replaceSkill('nope' as SpeciesId, 'cloud-1', 'cloud-4'));
      expect(held('cloud')).toEqual(['cloud-1', 'cloud-2', 'cloud-3']);
    });
  });

  describe('setSkills', () => {
    it('검증을 지나면 한 번에 바꾼다 (순서도 그대로)', () => {
      expectOneSet(() => useGameStore.getState().setSkills('cloud', ['cloud-3', 'jelly-2']));
      expect(held('cloud')).toEqual(['cloud-3', 'jelly-2']);
      expect(useGameStore.getState().setSkills('cloud', ['cloud-1'])).toBe(true);
      expect(held('cloud')).toEqual(['cloud-1']);
    });

    it(`최대 ${MAX_SKILLS}개까지`, () => {
      put('cloud', 20, ['cloud-1']);
      const five = ['cloud-1', 'cloud-2', 'cloud-3', 'cloud-4', 'cloud-5'];
      expect(useGameStore.getState().setSkills('cloud', five)).toBe(true);
      expect(held('cloud')).toEqual(five);
    });

    it('거부: 빈 목록·6개·중복·모르는 기술·레벨 모자란 기술·배열 아님·없는 종', () => {
      const g = () => useGameStore.getState();
      expectUnchanged(() => g().setSkills('cloud', []));
      expectUnchanged(() => g().setSkills('cloud', ['cloud-1', 'cloud-2', 'cloud-3', 'horn-1', 'horn-2', 'horn-3']));
      expectUnchanged(() => g().setSkills('cloud', ['cloud-1', 'cloud-1']));
      expectUnchanged(() => g().setSkills('cloud', ['cloud-1', 'dragon-1']));
      expectUnchanged(() => g().setSkills('cloud', ['cloud-1', 'cloud-4']));
      expectUnchanged(() => g().setSkills('cloud', 'cloud-1' as unknown as string[]));
      expectUnchanged(() => g().setSkills('horn', ['horn-1']));
      expect(held('cloud')).toEqual(['cloud-1', 'cloud-2', 'cloud-3']);
    });
  });

  describe('addSkill', () => {
    it(`${MAX_SKILLS}개 미만이면 뒤에 더한다`, () => {
      expectOneSet(() => useGameStore.getState().addSkill('cloud', 'horn-1'));
      expect(held('cloud')).toEqual(['cloud-1', 'cloud-2', 'cloud-3', 'horn-1']);
      expect(useGameStore.getState().addSkill('cloud', 'cloud-5')).toBe(true); // 옛 이월 슬롯
      expect(held('cloud')).toHaveLength(MAX_SKILLS);
    });

    it(`거부: ${MAX_SKILLS}개 가득·이미 가진 기술·모르는 기술·레벨 모자란 기술·없는 종`, () => {
      const g = () => useGameStore.getState();
      expectUnchanged(() => g().addSkill('cloud', 'cloud-1'));
      expectUnchanged(() => g().addSkill('cloud', 'dragon-1'));
      expectUnchanged(() => g().addSkill('cloud', 'cloud-4'));
      expectUnchanged(() => g().addSkill('horn', 'horn-1'));
      put('cloud', 30, ['cloud-1', 'cloud-2', 'cloud-3', 'cloud-4', 'cloud-5']);
      expectUnchanged(() => g().addSkill('cloud', 'horn-1'));
      expect(held('cloud')).toHaveLength(MAX_SKILLS);
    });
  });
});

describe('기술 저장 왕복', () => {
  beforeEach(() => {
    useGameStore.getState().resetAll();
    useGameStore.getState().chooseStarter('cloud', NOW);
    useGameStore.getState().setSkills('cloud', ['cloud-2', 'pebble-4']);
  });

  it('저장 대상(partialize)과 백업 currentSave()에 skills가 들어간다', () => {
    const persisted = useGameStore.persist.getOptions().partialize!(useGameStore.getState()) as { field: { species: { cloud: SpeciesEntry } } };
    expect(persisted.field.species.cloud.skills).toEqual(['cloud-2', 'pebble-4']);
    expect(currentSave().field.species.cloud!.skills).toEqual(['cloud-2', 'pebble-4']);
  });

  it('저장 → 다시 읽기(mergeSave·replaceSave)에서 값이 그대로', () => {
    const json = JSON.parse(JSON.stringify(currentSave()));
    expect(mergeSave(createInitialSave(NOW), json).field.species.cloud!.skills).toEqual(['cloud-2', 'pebble-4']);
    useGameStore.getState().resetAll();
    useGameStore.getState().replaceSave(json);
    expect(useGameStore.getState().field.species.cloud!.skills).toEqual(['cloud-2', 'pebble-4']);
  });
});
