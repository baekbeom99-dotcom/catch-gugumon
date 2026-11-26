import { describe, expect, it } from 'vitest';
import { createInitialSave } from '../src/store/saveData';
import { decodeMigration, encodeMigration, migrationUrl, readMigration } from '../src/domain/migration';

const save = () => {
  const s = createInitialSave(1000);
  s.economy.stars = 321;
  s.pet.name = '구구';
  return s;
};

describe('주소 이사 꾸러미', () => {
  it('저장 데이터를 싣고 풀면 같은 기록이 나온다', async () => {
    const payload = await encodeMigration(save(), 5000);
    const r = await readMigration(payload);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.summary.stars).toBe(321);
    expect(r.summary.petName).toBe('구구');
    expect((r.save as { economy: { stars: number } }).economy.stars).toBe(321);
  });

  it('주소에 쓸 수 있는 글자만 쓴다 (+ / = 없음)', async () => {
    const payload = await encodeMigration(save(), 5000);
    expect(payload).toMatch(/^[gp]\.[A-Za-z0-9_-]+$/);
  });

  it('깨진 꾸러미는 null·오류로 돌려주고 아무것도 바꾸지 않는다', async () => {
    expect(await decodeMigration('g.@@@@')).toBeNull();
    expect(await decodeMigration('x.abc')).toBeNull();
    expect((await readMigration('g.AAAA')).ok).toBe(false);
    expect((await readMigration('')).ok).toBe(false);
  });

  it('백업이 아닌 글은 오류', async () => {
    const bytes = btoa(JSON.stringify({ hello: 1 })).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    expect((await readMigration('p.' + bytes)).ok).toBe(false);
  });

  it('새 주소 만들기: 끝 슬래시를 정리하고 # 뒤에 싣는다', () => {
    expect(migrationUrl('https://a.pages.dev/', 'g.abc')).toBe('https://a.pages.dev/#/migrate/g.abc');
    expect(migrationUrl('https://a.pages.dev', 'g.abc')).toBe('https://a.pages.dev/#/migrate/g.abc');
  });
});
