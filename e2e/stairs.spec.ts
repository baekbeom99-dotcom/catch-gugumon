/** 설계서 4-5: 무한의 계단 — 맞히면 한 칸, 틀리거나 5초가 지나면 끝, 오른 계단만큼 별·최고 기록 */
import type { Page } from '@playwright/test';
import { collectErrors, seedHatchedPet, enableQuiz } from './helpers';
import { expect, test } from './fixtures';

// 퀴즈 모험은 배포에서 꺼져 있으므로 이 파일은 스위치로 켜고 본다
test.beforeEach(async ({ page }) => {
  await enableQuiz(page);
});

async function answerStairs(page: Page, correct: boolean): Promise<void> {
  const [a, , b] = (await page.locator('.stairs__question .question > *').allTextContents()).map((t) => t.trim());
  const answer = Number(a) * Number(b);
  const choices = page.locator('.choices .choice');
  const texts = (await choices.allTextContents()).map((t) => t.trim());
  const pick = correct ? String(answer) : texts.find((t) => t !== String(answer))!;
  await choices.filter({ hasText: new RegExp(`^${pick}$`) }).first().click();
}

test('무한의 계단: 세 칸 오르고 틀리면 끝, 별 6개(계단 × 2)와 최고 기록', async ({ page }) => {
  const errors = collectErrors(page);
  await seedHatchedPet(page);
  await page.getByRole('link', { name: /탐험/ }).click();
  await page.locator('.explore__main--stairs').click();
  await expect(page).toHaveURL(/#\/stairs/);
  await expect(page.getByTestId('stairs-hero')).toBeVisible();
  // 키우는 펫 그림은 이 화면에 없다 (내 주인공만)
  await expect(page.locator('.stairs__pet [aria-label="펫"], .stairs__pet [aria-label="알"]')).toHaveCount(0);
  await page.getByRole('button', { name: '오르기 시작!' }).click();

  let prevHero: import('@playwright/test').ElementHandle | null = null;
  for (let i = 0; i < 3; i++) {
    await expect(page.locator('.stairs__question')).toBeVisible();
    await answerStairs(page, true);
    await expect(page.locator('.stairs__count strong')).toHaveText(String(i + 1));
    // 한 칸 오를 때마다 주인공이 깡충 뛴다 (칸이 바뀌면 그림이 새로 나와 애니메이션을 다시 한다)
    await expect(page.getByTestId('stairs-hero')).toHaveClass(/stairs__pet--hop/);
    await expect(page.getByTestId('stairs-hero')).toBeVisible();
    // 칸마다 요소가 새로 만들어져(key) 애니메이션이 처음부터 다시 돈다: 새 요소는 이전 핸들과 다르고, 애니메이션이 걸려 있거나 이미 끝난 새 요소다
    const handle = await page.getByTestId('stairs-hero').elementHandle();
    if (prevHero) expect(await prevHero.evaluate((a, b) => a === b, handle), '칸이 바뀌면 주인공 요소가 새로 나온다').toBe(false);
    prevHero = handle;
  }
  await answerStairs(page, false);
  await expect(page.locator('.stairs__reason')).toHaveText('앗, 헛디뎠어요!');
  await expect(page.locator('.stairs__result')).toContainText('3칸 올랐어요');
  await expect(page.locator('.stairs__stars')).toHaveText('+6 ★');
  await expect(page.locator('.banner--master')).toContainText('최고 기록');

  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('catch-gugumon:save')!).state);
  expect(saved.stairs).toMatchObject({ best: 3, plays: 1, totalSteps: 3 });
  expect(saved.economy.stars).toBe(56);

  // 다시 오르면 5초 안에 답하지 않아 떨어진다
  await page.getByRole('button', { name: '다시 오르기' }).click();
  await expect(page.locator('.stairs__question')).toBeVisible();
  await expect(page.locator('.stairs__reason')).toHaveText('⏰ 시간이 다 됐어요!', { timeout: 8000 });
  await expect(page.locator('.stairs__record')).toContainText('최고 기록 3칸');

  // 12·13단 넣기 스위치는 저장된다
  const toggle = page.getByRole('checkbox', { name: '12·13단도 내기' });
  await expect(toggle).toBeChecked();
  await page.locator('.stairs__toggle').click();
  await expect(toggle).not.toBeChecked();
  const saved2 = await page.evaluate(() => JSON.parse(localStorage.getItem('catch-gugumon:save')!).state);
  expect(saved2.stairs.includeChallenge).toBe(false);

  await page.getByRole('button', { name: '마을로' }).click();
  // 끝내면 퀴즈 탐험 탭이 아니라 필드로 돌아온다 (이 저장본은 구구몬을 안 골라서 시작 고르기까지 간다)
  await expect(page).toHaveURL(/#\/field(\/starter)?$/);
  expect(errors).toEqual([]);
});
