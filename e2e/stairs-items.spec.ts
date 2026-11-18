/** 무한의 계단 아이템: 계단 위에 보이고, 밟으면 바로 저장된다 (4~10칸마다 하나) */
import type { Page } from '@playwright/test';
import { collectErrors, seedHatchedPet, enableQuiz } from './helpers';
import { expect, test } from './fixtures';

test.beforeEach(async ({ page }) => {
  await enableQuiz(page);
});

async function answerCorrect(page: Page): Promise<void> {
  const [a, , b] = (await page.locator('.stairs__question .question > *').allTextContents()).map((t) => t.trim());
  const answer = String(Number(a) * Number(b));
  await page.locator('.choices .choice').filter({ hasText: new RegExp(`^${answer}$`) }).first().click();
}

/** 다음 칸에 놓인 아이템 종류 (없으면 null) */
async function itemOnStep(page: Page, step: number): Promise<string | null> {
  const el = page.locator(`.stair[data-step="${step}"] .stair__item`);
  return (await el.count()) > 0 ? await el.getAttribute('data-item') : null;
}

async function climb(page: Page, count: number): Promise<string[]> {
  await page.getByRole('button', { name: '오르기 시작!' }).click();
  const seen: string[] = [];
  for (let i = 0; i < count; i++) {
    await expect(page.locator('.stairs__question')).toBeVisible();
    // 다음 칸(i + 1)에 아이템이 보이는가
    const kind = await itemOnStep(page, i + 1);
    if (kind) seen.push(kind);
    await answerCorrect(page);
    await expect(page.locator('.stairs__count strong')).toHaveText(String(i + 1));
    if (kind) {
      await expect(page.locator('.stairs__loot')).toBeVisible();
      await expect(page.locator(`.stair[data-step="${i + 1}"] .stair__item`)).toHaveCount(0);
    }
  }
  return seen;
}

async function savedField(page: Page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem('gugu-monster:save')!).state.field);
}

test('계단 아이템: 12칸을 오르면 캡슐을 얻어 저장된다 (별점수는 꺼져 있어 캡슐만)', async ({ page }) => {
  const errors = collectErrors(page);
  await seedHatchedPet(page);
  await page.goto('/#/stairs');
  await expect(page.locator('.stairs__pet svg')).toBeVisible();

  const seen = await climb(page, 12);
  // 첫 아이템은 4~10칸 사이라 12칸 안에 반드시 하나 이상
  expect(seen.length).toBeGreaterThanOrEqual(1);
  expect(seen.every((k) => k.startsWith('capsule-'))).toBe(true);

  const field = await savedField(page);
  const sum = (Object.values(field.capsules) as number[]).reduce((a, b) => a + b, 0);
  // 시작 캡슐은 초원·물가·사막 3개씩 9개
  expect(sum).toBe(9 + seen.length);
  expect(field.starPoints).toBe(0);
  expect(errors).toEqual([]);
});

test('계단 아이템: 별점수가 켜져 있으면 별 아이템(+3)도 나오고 저장된다', async ({ page }) => {
  await page.addInitScript(() => {
    (window as unknown as { __GUGU_E2E_STARS__: boolean }).__GUGU_E2E_STARS__ = true;
  });
  const errors = collectErrors(page);
  await seedHatchedPet(page);
  await page.goto('/#/stairs');
  await expect(page.locator('.stairs__pet svg')).toBeVisible();

  const seen = await climb(page, 22);
  expect(seen.length).toBeGreaterThanOrEqual(2);
  const stars = seen.filter((k) => k === 'stars').length;
  const field = await savedField(page);
  const sum = (Object.values(field.capsules) as number[]).reduce((a, b) => a + b, 0);
  expect(field.starPoints).toBe(stars * 3);
  expect(sum).toBe(9 + (seen.length - stars));
  expect(errors).toEqual([]);
});
