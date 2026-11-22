import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';

test.use({ viewport: { width: 375, height: 812 } });

/** 첫 구구몬(꽃등짐몬)을 이미 고른 필드 저장 (기술 1개라 전투에서 고르기 없이 바로 문제) */
const STARTER = {
  starterChosen: true,
  companion: 'c034',
  species: { c034: { level: 5, exp: 0, stage: 1, caught: 1, firstCaughtAt: 1, skills: ['c034-1'] } },
  seen: ['c034'],
};

interface Seed {
  lowGrade: boolean;
  position: { map: string; x: number; y: number; facing: string };
  field?: Record<string, unknown>;
}

/** 페이지가 열리기 전에 저장본을 넣는다 (이미 저장이 있으면 그대로 — 새로고침해도 유지) */
async function seed(page: Page, { lowGrade, position, field }: Seed) {
  await page.addInitScript(
    ([starter, lg, pos, extra]) => {
      if (localStorage.getItem('catch-gugumon:save')) return;
      const f = { ...(starter as object), position: pos, ...(extra as object) };
      localStorage.setItem('catch-gugumon:save', JSON.stringify({ version: 1, state: { field: f, settings: { lowGrade: lg } } }));
    },
    [STARTER, lowGrade, position, field ?? {}] as const,
  );
}

const saved = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem('catch-gugumon:save') ?? '{}').state ?? {});
const totalAttempts = async (page: Page) => ((await saved(page)).learning?.totalAttempts ?? 0) as number;

/** 비밀번호 창의 숫자판 누르기 (4번째 숫자에서 바로 확인된다) */
async function pressPin(page: Page, pin: string) {
  const dialog = page.getByRole('dialog', { name: '저학년 모드 비밀번호' });
  for (const d of pin) await dialog.locator('.pinpad__keys .key', { hasText: new RegExp(`^${d}$`) }).click();
}

/** "a op b = ?" 문제 카드 칸들 → 식과 답 */
async function readEquation(q: ReturnType<Page['locator']>) {
  await expect(q).toBeVisible();
  const parts = (await q.locator('> *').allTextContents()).map((t) => t.trim());
  const [a, op, b] = parts;
  return { text: parts.join(' '), op, answer: op === '+' ? Number(a) + Number(b) : Number(a) - Number(b) };
}

// ── 타이틀 스위치 ──

test('타이틀 스위치: 비밀번호 1234로 켜고, 틀린 번호는 그대로, 다시 1234로 끈다', async ({ page }) => {
  await page.goto('/');
  const sw = page.getByRole('switch', { name: '저학년 모드' });
  await expect(sw).toHaveAttribute('aria-checked', 'false');
  await expect(sw).toContainText('꺼짐');

  // 틀린 번호: 안내가 뜨고 창은 그대로, 값은 그대로 (몇 번이든 다시 누를 수 있다)
  await sw.click();
  const dialog = page.getByRole('dialog', { name: '저학년 모드 비밀번호' });
  await expect(dialog).toBeVisible();
  await pressPin(page, '0000');
  await expect(dialog.getByRole('alert')).toHaveText('비밀번호가 맞지 않아요');
  await pressPin(page, '9999');
  await expect(dialog.getByRole('alert')).toHaveText('비밀번호가 맞지 않아요');
  await expect(dialog).toBeVisible();
  expect((await saved(page)).settings?.lowGrade ?? false).toBe(false);

  // 취소: 아무것도 바뀌지 않는다
  await dialog.getByRole('button', { name: '취소' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(sw).toHaveAttribute('aria-checked', 'false');

  // 맞는 번호: 켜짐
  await sw.click();
  await pressPin(page, '1234');
  await expect(dialog).toHaveCount(0);
  await expect(sw).toHaveAttribute('aria-checked', 'true');
  await expect(sw).toContainText('켜짐');
  expect((await saved(page)).settings.lowGrade).toBe(true);

  // 새로고침해도 켜짐
  await page.reload();
  await expect(page.getByRole('switch', { name: '저학년 모드' })).toHaveAttribute('aria-checked', 'true');

  // 끌 때도 비밀번호: 틀리면 그대로, 맞으면 꺼짐
  await page.getByRole('switch', { name: '저학년 모드' }).click();
  await pressPin(page, '1111');
  await expect(dialog.getByRole('alert')).toHaveText('비밀번호가 맞지 않아요');
  expect((await saved(page)).settings.lowGrade).toBe(true);
  await pressPin(page, '1234');
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('switch', { name: '저학년 모드' })).toHaveAttribute('aria-checked', 'false');
  expect((await saved(page)).settings.lowGrade).toBe(false);
});

// ── 야생 전투 ──

async function intoMeadowBattle(page: Page, lowGrade: boolean) {
  await page.addInitScript(() => {
    const w = window as unknown as Record<string, unknown>;
    w.__GUGU_E2E_FIELD__ = true;
    w.__GUGU_E2E_NO_TIMER__ = true;
  });
  await seed(page, { lowGrade, position: { map: 'meadow', x: 5, y: 8, facing: 'right' } });
  await page.goto('/#/field');
  await expect(page.getByTestId('field-canvas')).toHaveAttribute('data-pos', '5,8');
  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(120);
  await page.keyboard.up('ArrowRight');
  await expect(page).toHaveURL(/#\/field\/battle$/);
}

test('저학년 모드 초원 전투: 문제는 덧셈·뺄셈(× 없음), 틀리면 틀린 문제 목록에만 남고 구구단 기록은 그대로', async ({ page }) => {
  await intoMeadowBattle(page, true);
  const q = page.locator('.wild__bubble .question');
  const eq = await readEquation(q);
  expect(eq.text).toMatch(/[+−]/);
  expect(eq.text).not.toContain('×');
  expect(eq.text.endsWith('= ?')).toBe(true);
  await expect(page.locator('.wild__bubble')).toHaveAttribute('data-lowgrade', 'true');
  await expect(page.locator('.wild-move')).toHaveCount(3);

  // 오답: 적이 공격하고 힌트(식과 답)가 뜬다. 목록에는 그 문제가 남고 구구단 기록은 0
  await page.locator('.wild-move').filter({ hasNot: page.locator(`.wild-move__num:text-is("${eq.answer}")`) }).first().click();
  await expect(page.locator('[data-lowgrade-hint]')).toBeVisible();
  const afterWrong = await saved(page);
  expect(afterWrong.field.lowGrade.recentWrong.length).toBe(1);
  expect(afterWrong.field.lowGrade.recentWrong[0].result).toBe(eq.answer);
  expect(await totalAttempts(page)).toBe(0);
  // 힌트의 빛나는 답을 누르면 다음 문제
  await page.locator('.wild-move--glow').click();
  await expect(page.locator('[data-lowgrade-hint]')).toHaveCount(0);
  const next = await readEquation(q);
  expect(next.text).not.toContain('×');
  // 맞히면 구구단 기록은 여전히 0
  await page.locator('.wild-move').filter({ has: page.locator(`.wild-move__num:text-is("${next.answer}")`) }).click();
  expect(await totalAttempts(page)).toBe(0);
});

test('저학년 모드가 꺼져 있으면 초원 전투 문제는 구구단(×)이다', async ({ page }) => {
  await intoMeadowBattle(page, false);
  const q = page.locator('.wild__bubble .question');
  await expect(q).toBeVisible();
  expect(await q.textContent()).toContain('×');
  await expect(page.locator('.wild__bubble')).not.toHaveAttribute('data-lowgrade', 'true');
});

// ── 상점 ──

async function openShopAt(page: Page, lowGrade: boolean, field: Record<string, unknown> = {}) {
  await seed(page, { lowGrade, position: { map: 'town', x: 8, y: 25, facing: 'up' }, field });
  await page.goto('/#/field');
  await expect(page.getByTestId('field-canvas')).toHaveAttribute('data-pos', '8,34');
  await page.keyboard.down('ArrowUp');
  await expect(page.getByRole('dialog', { name: '상점' })).toBeVisible();
  await page.keyboard.up('ArrowUp');
  return page.getByRole('dialog', { name: '상점' });
}

test('저학년 모드 캡슐 얻기: 덧셈·뺄셈 정확히 5문제, 끝나면 캡슐 5개 (구구단 기록 그대로)', async ({ page }) => {
  const shop = await openShopAt(page, true);
  await shop.getByRole('button', { name: '초원 캡슐 얻기' }).click();
  await expect(shop.locator('.practice-head__title')).toHaveText('초원 캡슐 얻기 (1/5)');
  for (let i = 1; i <= 5; i++) {
    await expect(shop.locator('.practice-head__title')).toHaveText(`초원 캡슐 얻기 (${i}/5)`);
    const eq = await readEquation(shop.locator('.practice__q .question'));
    expect(eq.text).toMatch(/[+−]/);
    expect(eq.text).not.toContain('×');
    await shop.locator('.fshop-choice').filter({ hasText: new RegExp(`^${eq.answer}$`) }).click();
  }
  await expect(shop.getByText('초원 캡슐 5개를 받았어요!')).toBeVisible();
  expect((await saved(page)).field.capsules.meadow).toBe(8);
  expect(await totalAttempts(page)).toBe(0);
});

test('저학년 모드 회복약: 예전에 틀린 문제가 먼저 나오고, 맞히면 그 문제가 틀린 목록에서 빠진다', async ({ page }) => {
  const wrong = { a: 47, op: '+', b: 6, result: 53 };
  const shop = await openShopAt(page, true, {
    species: { c034: { ...STARTER.species.c034, hp: 40, wounds: [] } },
    lowGrade: { recentWrong: [wrong] },
  });
  await shop.getByRole('tab', { name: '회복약' }).click();
  await shop.getByRole('button', { name: /고치기/ }).click();
  const q = shop.locator('.practice__q .question');
  const first = await readEquation(q);
  expect(first.text).toBe('47 + 6 = ?');
  expect(first.answer).toBe(53);
  await shop.locator('.fshop-choice').filter({ hasText: /^53$/ }).click();
  expect((await saved(page)).field.lowGrade.recentWrong).toEqual([]);
  // 나머지도 모두 덧뺄셈 (5문제 × 3바퀴 = 15번 맞히면 다 낫는다)
  for (let i = 1; i < 15; i++) {
    const eq = await readEquation(q);
    expect(eq.text).not.toContain('×');
    await shop.locator('.fshop-choice').filter({ hasText: new RegExp(`^${eq.answer}$`) }).click();
  }
  await expect(shop.getByText(/다 나았어요/)).toBeVisible();
  expect((await saved(page)).field.species.c034.hp).toBe(100);
  expect(await totalAttempts(page)).toBe(0);
});
