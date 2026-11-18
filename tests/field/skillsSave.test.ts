import { beforeEach, describe, expect, it } from 'vitest';
import { initialField, isValidSkills, legacyCarrySkills, legacySlots, mergeField, newSpeciesEntry, normalizeSkills, SPECIES_IDS, type SpeciesEntry, type SpeciesId } from '../../src/store/fieldData';
import { defaultSkills, seatOf, skillDef } from '../../src/domain/field/skills';
import { speciesDef } from '../../src/domain/field/creatures';
import { MAX_SKILLS } from '../../src/domain/field/tuning';
import { useGameStore } from '../../src/store/useGameStore';
import { createInitialSave, mergeSave } from '../../src/store/saveData';
import { currentSave } from '../../src/screens/admin/DataSecurityPanels';

const NOW = new Date('2026-11-12T09:00:00').getTime();

/** 3차 전에 쓰던 기술 3개 자리(슬롯 1·2·5)의 이름 — 이월 뒤에도 같은 이름이어야 한다 */
const OLD_MOVES = (sp: SpeciesId): [string, string, string] => speciesDef(sp).moves;

/** 기술 칸이 없던 옛 종 기록 */
const oldEntry = (level: number) => ({ level, exp: 0, stage: 1, caught: 1, firstCaughtAt: 1, hp: 100, wounds: [] });
const merged = (species: SpeciesId, raw: unknown): SpeciesEntry | undefined =>
  mergeField(initialField(), { species: { [species]: raw } }).species[species];

describe('옛 저장 이월 (기술 칸 없음) — 새 체계 적용: 이월 ∪ 그 레벨에서 익힌 기술 전부', () => {
  const legacy: [number, number[]][] = [
    [1, [1]], [2, [1]], [3, [1, 2]], [7, [1, 2]], [8, [1, 2, 5]], [14, [1, 2, 5]], [20, [1, 2, 5]],
  ];
  it.each(legacy)('옛 이월 슬롯: 레벨 %i → %j', (level, slots) => {
    expect(legacySlots(level)).toEqual(slots);
  });

  const carry: [number, number[]][] = [
    [0, [1]], [1, [1]], [2, [1]], [3, [1, 2]], [7, [1, 2]], [8, [1, 2, 3, 5]], [13, [1, 2, 3, 5]],
    [14, [1, 2, 3, 4, 5]], [19, [1, 2, 3, 4, 5]], [20, [1, 2, 3, 4, 5]], [30, [1, 2, 3, 4, 5]],
  ];
  it.each(carry)('불러오면: 레벨 %i → 슬롯 %j', (level, slots) => {
    for (const sp of SPECIES_IDS) {
      expect(legacyCarrySkills(sp, level)).toEqual(slots.map((n) => `${sp}-${n}`));
      expect(merged(sp, oldEntry(level))!.skills).toEqual(slots.map((n) => `${sp}-${n}`));
    }
  });

  it('종마다 예전에 쓰던 기술 이름이 모두 남는다 (기술이 줄지 않음)', () => {
    for (const sp of SPECIES_IDS) {
      const at = (level: number) => merged(sp, oldEntry(level))!.skills.map((id) => skillDef(id).name);
      expect(at(1)).toEqual(OLD_MOVES(sp).slice(0, 1));
      expect(at(3)).toEqual(OLD_MOVES(sp).slice(0, 2));
      for (const lv of [8, 14, 20, 30]) for (const name of OLD_MOVES(sp)) expect(at(lv)).toContain(name);
    }
  });

  it('이월된 기록은 다시 읽어도 그대로 (슬롯 5가 레벨 8에서도 허용)', () => {
    const once = merged('c036', oldEntry(8))!;
    expect(merged('c036', JSON.parse(JSON.stringify(once)))).toEqual(once);
  });

  it('mergeSave를 지나도 이월된다', () => {
    const save = createInitialSave(NOW);
    const raw = { ...save, field: { ...save.field, species: { c031: oldEntry(9) } } };
    expect(mergeSave(createInitialSave(NOW), raw).field.species.c031!.skills).toEqual(['c031-1', 'c031-2', 'c031-3', 'c031-5']);
  });
});

describe('normalizeSkills: 이상한 값 거르기', () => {
  it('맞는 값은 그대로 (순서 유지)', () => {
    expect(normalizeSkills('c034', 20, ['c034-5', 'c034-1', 'c034-4'])).toEqual(['c034-5', 'c034-1', 'c034-4']);
  });

  it('모르는 id는 버린다', () => {
    expect(normalizeSkills('c034', 5, ['c034-1', 'dragon-1', 'c034-9', 7, null])).toEqual(['c034-1']);
  });

  it('레벨이 모자란 자기 종 기술은 버린다 (옛 이월 슬롯은 허용)', () => {
    // 레벨 2: 슬롯 2(Lv3)·슬롯 5(Lv20, 이월은 Lv8부터) 모두 안 됨
    expect(normalizeSkills('c034', 2, ['c034-1', 'c034-2', 'c034-5'])).toEqual(['c034-1']);
    // 레벨 8: 슬롯 5는 옛 이월로 허용, 슬롯 4(Lv14)는 안 됨 (주①이 없으면 맨 앞에 넣는다)
    expect(normalizeSkills('c034', 8, ['c034-5', 'c034-4', 'c034-3'])).toEqual(['c034-1', 'c034-5', 'c034-3']);
  });

  it('프로토타입 이름(constructor·__proto__ 등)은 id로 안 받는다', () => {
    expect(normalizeSkills('c034', 5, ['constructor', '__proto__', 'toString', 'c034-1'])).toEqual(['c034-1']);
    expect(normalizeSkills('c034', 5, ['constructor', '__proto__'])).toEqual(defaultSkills('c034', 5));
  });

  it('중복은 한 번만', () => {
    expect(normalizeSkills('c034', 5, ['c034-1', 'c034-1', 'c034-2', 'c034-1'])).toEqual(['c034-1', 'c034-2']);
  });

  it(`${MAX_SKILLS + 1}개면 자리가 겹치는 쪽이 빠져 ${MAX_SKILLS}개`, () => {
    const six = ['c034-1', 'c034-2', 'c034-3', 'c034-4', 'c034-5', 'c036-1'];
    expect(normalizeSkills('c034', 30, six)).toEqual(six.slice(0, MAX_SKILLS));
    const sixMixed = ['c036-1', 'c034-1', 'c034-2', 'c034-3', 'c034-4', 'c034-5'];
    expect(normalizeSkills('c034', 30, sixMixed)).toEqual(['c036-1', 'c034-1', 'c034-2', 'c034-3', 'c034-5']);
  });

  it('빈 목록·남는 게 없으면 defaultSkills', () => {
    expect(normalizeSkills('c036', 8, [])).toEqual(defaultSkills('c036', 8));
    expect(normalizeSkills('c036', 8, ['nope', 'c036-4'])).toEqual(defaultSkills('c036', 8));
  });

  it('배열이 아니면(null·문자열·숫자·객체): normalizeSkills는 defaultSkills, 불러오기는 옛 저장처럼 이월 ∪ 익힌 기술', () => {
    for (const bad of [null, 'c034-1', 3, { 0: 'c034-1' }]) {
      expect(normalizeSkills('c034', 14, bad)).toEqual(defaultSkills('c034', 14));
      expect(merged('c034', { ...oldEntry(14), skills: bad })!.skills).toEqual(legacyCarrySkills('c034', 14));
      // Lv8~19도 슬롯 5(옛 이월)를 잃지 않는다
      expect(merged('c034', { ...oldEntry(8), skills: bad })!.skills).toEqual(['c034-1', 'c034-2', 'c034-3', 'c034-5']);
    }
  });

  it('다른 종 기술(따라 배운 것)은 레벨과 상관없이 허용', () => {
    expect(normalizeSkills('c034', 1, ['c034-1', 'c031-5', 'c048-3'])).toEqual(['c034-1', 'c031-5', 'c048-3']);
    // 주①이 없으면 맨 앞에 넣는다 (주속성 버튼이 비지 않게, 기술은 줄지 않음)
    expect(merged('c034', { ...oldEntry(1), skills: ['c031-5'] })!.skills).toEqual(['c034-1', 'c031-5']);
  });

  it('mergeEntry도 같은 규칙 (깨진 칸만 걸러지고 나머지 기록은 그대로)', () => {
    const e = merged('c034', { ...oldEntry(2), exp: 7, skills: ['c034-1', 'c034-1', 'c034-5', 'x'] })!;
    expect(e).toEqual({ ...oldEntry(2), exp: 7, skills: ['c034-1'] });
  });
});

describe('normalizeSkills: 자리 규칙 (개정 3 — 주속성 사슬·부속성 자리 1·특수 자리 1)', () => {
  it('부속성 자리는 하나만: 앞에서부터 하나 남긴다 (자기 종 4번·복사한 속성 기술)', () => {
    expect(normalizeSkills('c034', 20, ['c034-1', 'c031-1', 'c036-2', 'c034-4'])).toEqual(['c034-1', 'c031-1']);
    expect(normalizeSkills('c034', 20, ['c034-1', 'c034-4', 'c031-1'])).toEqual(['c034-1', 'c034-4']);
  });
  it('다른 종의 주속성 사슬 기술(1·2·5번)은 부속성 자리로 본다', () => {
    expect(normalizeSkills('c034', 5, ['c034-1', 'c031-1', 'c031-2'])).toEqual(['c034-1', 'c031-1']);
    expect(normalizeSkills('c034', 5, ['c034-1', 'c031-5', 'c034-2'])).toEqual(['c034-1', 'c031-5', 'c034-2']);
  });
  it('특수 자리는 하나만: 자기 종 3번이든 복사한 특수든 앞의 것', () => {
    expect(normalizeSkills('c034', 8, ['c034-1', 'c034-3', 'c036-3'])).toEqual(['c034-1', 'c034-3']);
    expect(normalizeSkills('c034', 8, ['c034-1', 'c036-3', 'c034-3'])).toEqual(['c034-1', 'c036-3']);
  });
  it('주①이 없으면 맨 앞에 넣는다 (남은 기술은 그대로)', () => {
    expect(normalizeSkills('c034', 8, ['c034-2', 'c034-3'])).toEqual(['c034-1', 'c034-2', 'c034-3']);
    expect(normalizeSkills('c034', 8, ['c036-3'])).toEqual(['c034-1', 'c036-3']);
  });
  it('어떤 목록이 와도: 최대 5개, 주① 있음, 부속성·특수 자리 각각 1개 이하, 다시 다듬어도 그대로', () => {
    const ids = SPECIES_IDS.flatMap((sp) => [1, 2, 3, 4, 5].map((n) => `${sp}-${n}`));
    let seed = 7;
    const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
    for (let i = 0; i < 400; i++) {
      const owner = SPECIES_IDS[Math.floor(rnd() * SPECIES_IDS.length)];
      const level = 1 + Math.floor(rnd() * 30);
      const list = Array.from({ length: Math.floor(rnd() * 9) }, () => ids[Math.floor(rnd() * ids.length)]);
      const out = normalizeSkills(owner, level, list);
      expect(out.length).toBeGreaterThanOrEqual(1);
      expect(out.length).toBeLessThanOrEqual(MAX_SKILLS);
      expect(out).toContain(`${owner}-1`);
      const seats = out.map((id) => seatOf(skillDef(id), owner));
      expect(seats.filter((x) => x === 'sub').length).toBeLessThanOrEqual(1);
      expect(seats.filter((x) => x === 'special').length).toBeLessThanOrEqual(1);
      expect(normalizeSkills(owner, level, out)).toEqual(out);
      expect(isValidSkills(owner, level, out)).toBe(true);
    }
  });
  it('옛 저장 이월(슬롯 1·2·5)과 새 체계 적용 결과는 모든 종·레벨에서 그대로 유효 (기술이 줄지 않음)', () => {
    for (const sp of SPECIES_IDS) {
      for (let level = 0; level <= 30; level++) {
        const legacy = legacySlots(level).map((n) => `${sp}-${n}`);
        expect(normalizeSkills(sp, level, legacy)).toEqual(legacy);
        expect(isValidSkills(sp, level, legacy)).toBe(true);
        const carried = merged(sp, oldEntry(level))!.skills;
        for (const id of legacy) expect(carried).toContain(id);
        expect(isValidSkills(sp, level, carried)).toBe(true);
      }
    }
  });
});

describe('newSpeciesEntry', () => {
  it('그 레벨에서 익힌 기술 전부로 시작', () => {
    expect(newSpeciesEntry('c036', 8, NOW).skills).toEqual(defaultSkills('c036', 8));
    expect(newSpeciesEntry('c036', 8, NOW)).toEqual({ level: 8, exp: 0, stage: 1, caught: 1, firstCaughtAt: NOW, hp: 100, wounds: [], skills: ['c036-1', 'c036-2', 'c036-3'] });
    expect(newSpeciesEntry('c031', 1, NOW).skills).toEqual(['c031-1']);
  });

  it('스타터(레벨 5)와 새로 잡은 구구몬(Lv1)은 기술 1개로 시작', () => {
    useGameStore.getState().resetAll();
    useGameStore.getState().chooseStarter('c034', NOW);
    // 스타터도 잡은 구구몬도 기술 1개(슬롯 1)로 시작 (잡으면 야생 레벨과 상관없이 Lv1)
    expect(useGameStore.getState().field.species.c034!.skills).toEqual(['c034-1']);
    useGameStore.getState().finishWildBattle({ species: 'c031', companion: 'c034', level: 14, tier: 'normal', end: 'caught', correct: 0, now: NOW, rng: () => 1 });
    expect(useGameStore.getState().field.species.c031!.skills).toEqual(['c031-1']);
    expect(useGameStore.getState().field.species.c031!.level).toBe(1);
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
    put('c034', 8, ['c034-1', 'c034-2', 'c034-3']);
  });

  describe('replaceSkill', () => {
    it('부속성 자리끼리: 복사한 기술을 잊고 익힌 자기 종 4번으로 (자리 그대로)', () => {
      put('c034', 14, ['c034-1', 'c034-2', 'c031-1', 'c034-3']);
      expectOneSet(() => useGameStore.getState().replaceSkill('c034', 'c031-1', 'c034-4'));
      expect(held('c034')).toEqual(['c034-1', 'c034-2', 'c034-4', 'c034-3']);
      // 다시 다른 종 속성 기술로 (어느 종의 1·2·4·5번이든 부속성 자리)
      expect(useGameStore.getState().replaceSkill('c034', 'c034-4', 'c031-5')).toBe(true);
      expect(held('c034')).toEqual(['c034-1', 'c034-2', 'c031-5', 'c034-3']);
    });

    it('특수 자리끼리: 자기 종 특수를 복사한 특수로', () => {
      expectOneSet(() => useGameStore.getState().replaceSkill('c034', 'c034-3', 'c036-3'));
      expect(held('c034')).toEqual(['c034-1', 'c034-2', 'c036-3']);
    });

    it('거부: 자리가 다르면(특수↔부속성), 주속성 사슬은 바꾸기 대상이 아님 (레벨로만 생김)', () => {
      const g = () => useGameStore.getState();
      expectUnchanged(() => g().replaceSkill('c034', 'c034-3', 'c031-1')); // 특수 → 부속성
      expectUnchanged(() => g().replaceSkill('c034', 'c034-2', 'c034-5')); // 주② → 주③ (옛 이월 슬롯이어도)
      expectUnchanged(() => g().replaceSkill('c034', 'c034-1', 'c031-1')); // 주① → 복사
      put('c034', 14, ['c034-1', 'c034-2', 'c031-1', 'c034-3']);
      expectUnchanged(() => g().replaceSkill('c034', 'c031-1', 'c036-3')); // 부속성 → 특수
      expectUnchanged(() => g().replaceSkill('c034', 'c031-1', 'c034-5')); // 부속성 → 자기 종 주③
      expect(held('c034')).toEqual(['c034-1', 'c034-2', 'c031-1', 'c034-3']);
    });

    it('거부: 안 가진 기술 잊기, 이미 가진 기술·모르는 기술·레벨 모자란 기술 배우기, 같은 기술, 없는 종', () => {
      const g = () => useGameStore.getState();
      expectUnchanged(() => g().replaceSkill('c034', 'c034-4', 'c031-1'));
      expectUnchanged(() => g().replaceSkill('c034', 'c034-1', 'c034-2'));
      expectUnchanged(() => g().replaceSkill('c034', 'c034-1', 'c034-1'));
      expectUnchanged(() => g().replaceSkill('c034', 'c034-1', 'dragon-1'));
      expectUnchanged(() => g().replaceSkill('c034', 'c034-1', 'c034-4')); // Lv14 기술
      expectUnchanged(() => g().replaceSkill('c031', 'c031-1', 'c031-2')); // 아직 없는 종
      expectUnchanged(() => g().replaceSkill('nope' as SpeciesId, 'c034-1', 'c034-4'));
      expect(held('c034')).toEqual(['c034-1', 'c034-2', 'c034-3']);
    });
  });

  describe('setSkills', () => {
    it('검증을 지나면 한 번에 바꾼다 (순서도 그대로)', () => {
      expectOneSet(() => useGameStore.getState().setSkills('c034', ['c034-3', 'c034-1', 'c036-2']));
      expect(held('c034')).toEqual(['c034-3', 'c034-1', 'c036-2']);
      expect(useGameStore.getState().setSkills('c034', ['c034-1'])).toBe(true);
      expect(held('c034')).toEqual(['c034-1']);
    });

    it(`최대 ${MAX_SKILLS}개까지`, () => {
      put('c034', 20, ['c034-1']);
      const five = ['c034-1', 'c034-2', 'c034-3', 'c034-4', 'c034-5'];
      expect(useGameStore.getState().setSkills('c034', five)).toBe(true);
      expect(held('c034')).toEqual(five);
    });

    it('거부: 빈 목록·6개·중복·모르는 기술·레벨 모자란 기술·배열 아님·없는 종', () => {
      const g = () => useGameStore.getState();
      expectUnchanged(() => g().setSkills('c034', []));
      expectUnchanged(() => g().setSkills('c034', ['c034-1', 'c034-2', 'c034-3', 'c031-1', 'c031-2', 'c031-3']));
      expectUnchanged(() => g().setSkills('c034', ['c034-1', 'c034-1']));
      expectUnchanged(() => g().setSkills('c034', ['c034-1', 'dragon-1']));
      expectUnchanged(() => g().setSkills('c034', ['c034-1', 'c034-4']));
      expectUnchanged(() => g().setSkills('c034', 'c034-1' as unknown as string[]));
      expectUnchanged(() => g().setSkills('c031', ['c031-1']));
      expect(held('c034')).toEqual(['c034-1', 'c034-2', 'c034-3']);
    });

    it('거부: 자리가 겹침(부속성 2개·특수 2개), 주① 없음', () => {
      const g = () => useGameStore.getState();
      expectUnchanged(() => g().setSkills('c034', ['c034-1', 'c031-1', 'c036-1']));
      expectUnchanged(() => g().setSkills('c034', ['c034-1', 'c034-3', 'c036-3']));
      expectUnchanged(() => g().setSkills('c034', ['c034-2', 'c034-3']));
      expect(held('c034')).toEqual(['c034-1', 'c034-2', 'c034-3']);
    });
  });

  describe('addSkill', () => {
    it(`${MAX_SKILLS}개 미만이면 뒤에 더한다`, () => {
      expectOneSet(() => useGameStore.getState().addSkill('c034', 'c031-1'));
      expect(held('c034')).toEqual(['c034-1', 'c034-2', 'c034-3', 'c031-1']);
      expect(useGameStore.getState().addSkill('c034', 'c034-5')).toBe(true); // 옛 이월 슬롯
      expect(held('c034')).toHaveLength(MAX_SKILLS);
    });

    it(`거부: ${MAX_SKILLS}개 가득·이미 가진 기술·모르는 기술·레벨 모자란 기술·없는 종`, () => {
      const g = () => useGameStore.getState();
      expectUnchanged(() => g().addSkill('c034', 'c034-1'));
      expectUnchanged(() => g().addSkill('c034', 'dragon-1'));
      expectUnchanged(() => g().addSkill('c034', 'c034-4'));
      expectUnchanged(() => g().addSkill('c031', 'c031-1'));
      put('c034', 30, ['c034-1', 'c034-2', 'c034-3', 'c034-4', 'c034-5']);
      expectUnchanged(() => g().addSkill('c034', 'c031-1'));
      expect(held('c034')).toHaveLength(MAX_SKILLS);
    });

    it('거부: 그 자리가 이미 차 있으면 (부속성·특수)', () => {
      const g = () => useGameStore.getState();
      put('c034', 8, ['c034-1', 'c034-2', 'c034-3', 'c031-1']);
      expectUnchanged(() => g().addSkill('c034', 'c036-1'));
      expectUnchanged(() => g().addSkill('c034', 'c036-3'));
      expect(held('c034')).toEqual(['c034-1', 'c034-2', 'c034-3', 'c031-1']);
    });
  });
});

describe('기술 저장 왕복', () => {
  beforeEach(() => {
    useGameStore.getState().resetAll();
    useGameStore.getState().chooseStarter('c034', NOW);
    expect(useGameStore.getState().setSkills('c034', ['c034-1', 'c034-2', 'c037-4'])).toBe(true);
  });

  it('저장 대상(partialize)과 백업 currentSave()에 skills가 들어간다', () => {
    const persisted = useGameStore.persist.getOptions().partialize!(useGameStore.getState()) as { field: { species: { c034: SpeciesEntry } } };
    expect(persisted.field.species.c034.skills).toEqual(['c034-1', 'c034-2', 'c037-4']);
    expect(currentSave().field.species.c034!.skills).toEqual(['c034-1', 'c034-2', 'c037-4']);
  });

  it('저장 → 다시 읽기(mergeSave·replaceSave)에서 값이 그대로', () => {
    const json = JSON.parse(JSON.stringify(currentSave()));
    expect(mergeSave(createInitialSave(NOW), json).field.species.c034!.skills).toEqual(['c034-1', 'c034-2', 'c037-4']);
    useGameStore.getState().resetAll();
    useGameStore.getState().replaceSave(json);
    expect(useGameStore.getState().field.species.c034!.skills).toEqual(['c034-1', 'c034-2', 'c037-4']);
  });
});
