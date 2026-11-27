/** 별점수: 켜면 필드 HUD에 개수가 보이고 값이 바뀌면 따라 바뀐다. 기본(E2E)은 꺼져 있어 HUD에 없다 */
import type { Page } from '@playwright/test';
import { collectErrors } from './helpers';
import { expect, test } from './fixtures';

test.use({ viewport: { width: 375, height: 812 } });

/** 첫 구구몬을 이미 고른 저장본 (별점수 칸은 값을 정해 넣는다) */
async function seedField(page: Page, starPoints: number) {
  await page.addInitScript((stars) => {
    if (!localStorage.getItem('catch-gugumon:save')) {
      const field = {
        starterChosen: true,
        companion: 'c034',
        species: { c034: { level: 5, exp: 0, stage: 1, caught: 1, firstCaughtAt: 1, skills: ['c034-1'] } },
        seen: ['c034'],
        starPoints: stars,
      };
      localStorage.setItem('catch-gugumon:save', JSON.stringify({ version: 1, state: { field } }));
    }
  }, starPoints);
}

test('별점수 꺼짐(기본): 필드 HUD에 별 개수가 없다', async ({ page }) => {
  const errors = collectErrors(page);
  await seedField(page, 7);
  await page.goto('/#/field');
  await expect(page.getByRole('group', { name: '필드 정보' })).toBeVisible();
  await expect(page.getByTestId('hud-stars')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('별점수 켜짐: HUD에 별 개수가 보이고, 저장 값이 바뀌면 숫자도 바뀐다', async ({ page }) => {
  await page.addInitScript(() => {
    (window as unknown as { __GUGU_E2E_STARS__: boolean }).__GUGU_E2E_STARS__ = true;
  });
  const errors = collectErrors(page);
  await seedField(page, 7);
  await page.goto('/#/field');
  const hud = page.getByTestId('hud-stars');
  await expect(hud).toBeVisible();
  await expect(hud).toContainText('7');
  // 375px 폭 안에 들어온다
  const box = (await page.getByRole('group', { name: '필드 정보' }).boundingBox())!;
  expect(box.x + box.width).toBeLessThanOrEqual(375);

  // 별이 늘어난 저장으로 다시 열면 숫자가 오른다 (발견·포획 적립 자체는 단위 테스트가 고정)
  await page.evaluate(() => {
    const raw = JSON.parse(localStorage.getItem('catch-gugumon:save')!);
    raw.state.field.starPoints = 1234;
    localStorage.setItem('catch-gugumon:save', JSON.stringify(raw));
  });
  await page.reload();
  await expect(page.getByTestId('hud-stars')).toContainText('1,234');
  // 큰 숫자(1,234)도 HUD 상자 오른쪽 끝 안에 있고, 메뉴 버튼과 겹치지 않는다
  const starsBox = (await page.getByTestId('hud-stars').boundingBox())!;
  const hudBox = (await page.getByRole('group', { name: '필드 정보' }).boundingBox())!;
  const menuBox = (await page.getByRole('button', { name: '메뉴', exact: true }).boundingBox())!;
  expect(starsBox.x + starsBox.width).toBeLessThanOrEqual(hudBox.x + hudBox.width + 0.5);
  const overlap = starsBox.x < menuBox.x + menuBox.width && starsBox.x + starsBox.width > menuBox.x && starsBox.y < menuBox.y + menuBox.height && starsBox.y + starsBox.height > menuBox.y;
  expect(overlap).toBe(false);
  expect(errors).toEqual([]);
});
