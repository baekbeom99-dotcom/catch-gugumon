import { beforeEach, describe, expect, it } from 'vitest';
import { initialField, mergeField, migrateSkillId, migrateSpeciesId, OLD_SPECIES_MAP, SPECIES_IDS } from '../../src/store/fieldData';
import { createInitialSave, mergeSave } from '../../src/store/saveData';
import { useGameStore } from '../../src/store/useGameStore';
import { exportBackup, parseBackup } from '../../src/domain/shareCode';
import { currentSave } from '../../src/screens/admin/DataSecurityPanels';
import { MAIN_ELEMENT } from '../../src/domain/field/elements';
import { speciesDef } from '../../src/domain/field/creatures';

const NOW = new Date('2026-11-18T09:00:00').getTime();

/** v1.60 전(11종) 저장의 필드 칸: 옛 종 id·옛 기술 id 그대로 */
function oldField() {
  return {
    starterChosen: true,
    companion: 'cloud',
    species: {
      cloud: { level: 15, exp: 7, stage: 2, caught: 4, firstCaughtAt: 100, hp: 40, wounds: [{ factId: '6x7', type: 'product' }], skills: ['cloud-1', 'cloud-2', 'cloud-3', 'ghost-4'] },
      'legend-horn': { level: 20, exp: 0, stage: 1, caught: 1, firstCaughtAt: 300, hp: 0, wounds: [], skills: ['legend-horn-1', 'legend-horn-2', 'legend-horn-3', 'legend-horn-5'] },
      pebble: { level: 9, exp: 3, stage: 3, caught: 2, firstCaughtAt: 200 },
    },
    seen: ['cloud', 'legend-horn', 'pebble', 'jelly', 'mushroom'],
    position: { map: 'meadow', x: 5, y: 8, facing: 'right' },
    stats: { battles: 12, catches: 3, fled: 1 },
    capsules: { meadow: 2, waterside: 1, desert: 0, legend: 1 },
  };
}

describe('예전 저장 이전표 (옛 11종 → 새 종)', () => {
  beforeEach(() => {
    useGameStore.getState().resetAll();
  });

  it('이전표 고정: 11종이 모두 새 종으로, 겹치지 않고, 주속성이 같다', () => {
    expect(OLD_SPECIES_MAP).toEqual({
      cloud: 'c034', ghost: 'c035', jelly: 'c036', antenna: 'c033', pebble: 'c037', mushroom: 'c042', fluff: 'c040', horn: 'c031',
      'legend-fluff': 'c015', 'legend-horn': 'c047', 'legend-ghost': 'c048',
      c013: 'c046',
    });
    const targets = Object.entries(OLD_SPECIES_MAP).filter(([k]) => k !== 'c013').map(([, v]) => v);
    expect(new Set(targets).size).toBe(targets.length);
    for (const t of targets) expect(SPECIES_IDS).toContain(t);
    // 옛 종의 속성 (예전 설계서 2-1 표) — 옮겨도 주속성이 바뀌지 않게 골랐다
    const oldMain: Record<string, string> = {
      cloud: 'grass', ghost: 'fire', jelly: 'water', antenna: 'thunder', pebble: 'earth', mushroom: 'poison', fluff: 'light', horn: 'water',
      'legend-fluff': 'light', 'legend-horn': 'water', 'legend-ghost': 'fire',
      c013: 'light',
    };
    for (const [old, to] of Object.entries(OLD_SPECIES_MAP)) expect(MAIN_ELEMENT[to]).toBe(oldMain[old]);
    // 옛 레전드는 새 레전드로
    for (const old of ['legend-fluff', 'legend-horn', 'legend-ghost', 'c013']) expect(speciesDef(OLD_SPECIES_MAP[old]).legend).toBe(true);
  });

  it('id 옮기기: 옛 종·옛 기술 id만 바꾸고 나머지는 그대로', () => {
    expect(migrateSpeciesId('cloud')).toBe('c034');
    expect(migrateSpeciesId('legend-ghost')).toBe('c048');
    expect(migrateSpeciesId('c034')).toBe('c034');
    expect(migrateSpeciesId('toString')).toBe('toString');
    expect(migrateSpeciesId(3)).toBe(3);
    expect(migrateSkillId('cloud-2')).toBe('c034-2');
    expect(migrateSkillId('legend-horn-4')).toBe('c047-4');
    expect(migrateSkillId('c031-5')).toBe('c031-5');
    expect(migrateSkillId('nope-1')).toBe('nope-1');
    expect(migrateSkillId(null)).toBe(null);
  });

  it('mergeField: 도감·레벨·경험치·체력·상처·잡은 수·본 종·동행이 새 종 키로 옮겨진다 (진화 단계는 1)', () => {
    const f = mergeField(initialField(), oldField());
    expect(Object.keys(f.species).sort()).toEqual(['c034', 'c037', 'c047']);
    expect(f.species.c034).toEqual({
      level: 15, exp: 7, stage: 1, caught: 4, firstCaughtAt: 100, hp: 40,
      wounds: [{ factId: '6x7', type: 'product' }],
      // 따라 배운 ghost-4(불꼬리도마뱀몬 부속성)도 새 id로
      skills: ['c034-1', 'c034-2', 'c034-3', 'c035-4'],
    });
    expect(f.species.c047).toMatchObject({ level: 20, hp: 0, stage: 1, skills: ['c047-1', 'c047-2', 'c047-3', 'c047-5'] });
    // 기술 칸이 없던 더 옛 저장: 새 종 기준 이월 (Lv9 → 슬롯 1·2·3·5)
    expect(f.species.c037).toMatchObject({ level: 9, stage: 1, skills: ['c037-1', 'c037-2', 'c037-3', 'c037-5'] });
    expect(f.seen).toEqual(['c034', 'c047', 'c037', 'c036', 'c042']);
    expect(f.companion).toBe('c034');
    expect(f.starterChosen).toBe(true);
    expect(f.position).toEqual({ map: 'meadow', x: 5, y: 8, facing: 'right' });
    expect(f.stats).toEqual({ battles: 12, catches: 3, fled: 1 });
    expect(f.capsules).toEqual({ meadow: 2, waterside: 1, desert: 0, legend: 1 });
  });

  it('옮긴 저장을 다시 읽어도 그대로 (두 번 옮기지 않는다)', () => {
    const once = mergeField(initialField(), oldField());
    expect(mergeField(initialField(), JSON.parse(JSON.stringify(once)))).toEqual(once);
  });

  it('같은 새 종 키가 이미 있으면 먼저 읽은 기록을 지킨다 (깨진 저장 대비)', () => {
    const f = mergeField(initialField(), {
      species: {
        c034: { level: 3, exp: 0, stage: 1, caught: 1, firstCaughtAt: 1, hp: 100, wounds: [], skills: ['c034-1'] },
        cloud: { level: 9, exp: 0, stage: 1, caught: 1, firstCaughtAt: 1, hp: 100, wounds: [], skills: ['cloud-1'] },
      },
    });
    expect(f.species.c034?.level).toBe(3);
  });

  it('localStorage의 옛 저장(mergeSave)·옛 백업 파일 모두 옮겨지고, 백업(currentSave)에는 새 id가 들어간다', () => {
    const save = { ...createInitialSave(NOW), field: oldField() };
    const merged = mergeSave(createInitialSave(NOW), save);
    expect(merged.field.companion).toBe('c034');
    expect(merged.field.species.c034?.level).toBe(15);

    const r = parseBackup(exportBackup(save as never, NOW));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    useGameStore.getState().replaceSave(r.save);
    const f = useGameStore.getState().field;
    expect(f.companion).toBe('c034');
    expect(f.species.c034?.skills).toEqual(['c034-1', 'c034-2', 'c034-3', 'c035-4']);
    const backup = JSON.stringify(currentSave());
    for (const old of Object.keys(OLD_SPECIES_MAP)) expect(backup).not.toContain(`"${old}"`);
  });
});

/** 013(주황머리몬)을 종에서 뺀 v1.xx 전 저장: c013 기록이 있는 저장 */
function entry(level: number, hp: number, skills: string[], caught = 1) {
  return { level, exp: 4, stage: 1, caught, firstCaughtAt: 50, hp, wounds: [{ factId: '13x7', type: 'product' }], skills };
}

describe('013을 종에서 뺀 뒤 옛 저장 (c013 → c046)', () => {
  beforeEach(() => {
    useGameStore.getState().resetAll();
  });

  it('id 옮기기: c013과 c013 기술은 c046으로', () => {
    expect(migrateSpeciesId('c013')).toBe('c046');
    expect(migrateSkillId('c013-5')).toBe('c046-5');
    expect(migrateSkillId('c046-2')).toBe('c046-2');
    expect(SPECIES_IDS).not.toContain('c013');
  });

  it('c013만 있으면 c046으로 옮긴다 (레벨·체력·상처·잡은 수 그대로, 도감·동행도)', () => {
    const f = mergeField(initialField(), {
      starterChosen: true,
      companion: 'c013',
      species: { c034: entry(5, 100, ['c034-1']), c013: entry(22, 37, ['c013-1', 'c013-2', 'c013-3', 'c013-5'], 2) },
      seen: ['c034', 'c013'],
    });
    expect(Object.keys(f.species).sort()).toEqual(['c034', 'c046']);
    expect(f.species.c046).toEqual({
      level: 22, exp: 4, stage: 1, caught: 2, firstCaughtAt: 50, hp: 37,
      wounds: [{ factId: '13x7', type: 'product' }],
      skills: ['c046-1', 'c046-2', 'c046-3', 'c046-5'],
    });
    expect(f.companion).toBe('c046');
    expect(f.seen).toEqual(['c034', 'c046']);
  });

  it('c013과 c046이 둘 다 있으면 순서와 상관없이 c046 기록만 남는다', () => {
    const c046 = entry(8, 90, ['c046-1']);
    const c013 = entry(30, 10, ['c013-1', 'c013-2']);
    for (const species of [{ c013, c046 }, { c046, c013 }]) {
      const f = mergeField(initialField(), { species, seen: ['c013', 'c046'], companion: 'c013' });
      expect(Object.keys(f.species)).toEqual(['c046']);
      expect(f.species.c046).toMatchObject({ level: 8, hp: 90, skills: ['c046-1'] });
      expect(f.seen).toEqual(['c046']);
      expect(f.companion).toBe('c046');
    }
  });

  it('다른 구구몬이 따라 배운 c013 기술도 c046 기술로', () => {
    const f = mergeField(initialField(), { species: { c034: entry(30, 100, ['c034-1', 'c034-2', 'c034-3', 'c013-4']) } });
    expect(f.species.c034?.skills).toContain('c046-4');
    expect(JSON.stringify(f)).not.toContain('c013');
  });

  it('트레이닝센터 레전드 보상으로 받은 c013도 c046으로', () => {
    const f = mergeField(initialField(), { training: { studied: {}, mastered: {}, legendGranted: { 12: 'c013', 13: 'c047' } } });
    expect(f.training.legendGranted).toEqual({ 12: 'c046', 13: 'c047' });
  });

  it('옮긴 저장을 다시 읽어도 그대로, localStorage 저장(mergeSave)도 옮겨진다', () => {
    const raw = { starterChosen: true, companion: 'c013', species: { c013: entry(12, 60, ['c013-1']) }, seen: ['c013'] };
    const once = mergeField(initialField(), raw);
    expect(mergeField(initialField(), JSON.parse(JSON.stringify(once)))).toEqual(once);
    const merged = mergeSave(createInitialSave(NOW), { ...createInitialSave(NOW), field: raw });
    expect(merged.field.companion).toBe('c046');
    expect(merged.field.species.c046?.level).toBe(12);
    expect(JSON.stringify(merged.field)).not.toContain('c013');
  });
});
