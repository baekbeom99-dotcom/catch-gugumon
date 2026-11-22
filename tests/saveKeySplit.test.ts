/** 원본 앱과 저장 이름 나누기: 새 이름 catch-gugumon:save, 예전 이름 기록은 처음 한 번만 복사 */
import { describe, expect, it } from 'vitest';
import { BACKUP_FORMAT, LEGACY_BACKUP_FORMAT, LEGACY_SHOP_FORMAT, parseBackup, SHOP_FORMAT } from '../src/domain/shareCode';
import { adoptLegacySave, LEGACY_SAVE_KEY, SAVE_KEY } from '../src/store/saveData';

const memory = (init: Record<string, string> = {}) => {
  const m = new Map(Object.entries(init));
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    map: m,
  };
};

describe('저장 이름 나누기', () => {
  it('이름이 원본 앱과 다르다', () => {
    expect(SAVE_KEY).toBe('catch-gugumon:save');
    expect(LEGACY_SAVE_KEY).toBe('gugu-monster:save');
    expect(SHOP_FORMAT).not.toBe(LEGACY_SHOP_FORMAT);
    expect(BACKUP_FORMAT).not.toBe(LEGACY_BACKUP_FORMAT);
  });

  it('새 이름이 비어 있으면 예전 기록을 복사하고, 예전 기록은 지우지 않는다', () => {
    const s = memory({ [LEGACY_SAVE_KEY]: '{"state":{"economy":{"stars":77}}}' });
    expect(adoptLegacySave(s)).toBe(true);
    expect(s.getItem(SAVE_KEY)).toBe('{"state":{"economy":{"stars":77}}}');
    expect(s.getItem(LEGACY_SAVE_KEY)).not.toBeNull();
  });

  it('새 이름에 이미 기록이 있으면 덮어쓰지 않는다', () => {
    const s = memory({ [SAVE_KEY]: 'new', [LEGACY_SAVE_KEY]: 'old' });
    expect(adoptLegacySave(s)).toBe(false);
    expect(s.getItem(SAVE_KEY)).toBe('new');
  });

  it('저장 이름을 나누기 전에 받은 백업 파일도 불러온다', () => {
    const save = { learning: { facts: {} }, economy: { stars: 5 } };
    expect(parseBackup(JSON.stringify({ format: LEGACY_BACKUP_FORMAT, save })).ok).toBe(true);
    expect(parseBackup(JSON.stringify({ format: BACKUP_FORMAT, save })).ok).toBe(true);
    expect(parseBackup(JSON.stringify({ format: 'other/backup', save })).ok).toBe(false);
  });

  it('예전 기록이 없으면 아무것도 안 한다', () => {
    const s = memory();
    expect(adoptLegacySave(s)).toBe(false);
    expect(s.map.size).toBe(0);
  });
});
