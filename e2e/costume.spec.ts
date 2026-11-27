/** 상점 「꾸미기」 탭: 별로 색 세트를 사고 입는다. 별점수 꺼짐이면 안내만 */
import type { Page } from '@playwright/test';
import { collectErrors } from './helpers';
import { expect, test } from './fixtures';

test.use({ viewport: { width: 375, height: 812 } });

async function seed(page: Page, stars: boolean, starPoints: number) {
  if (stars) {
    await page.addInitScript(() => {
      (window as unknown as { __GUGU_E2E_STARS__: boolean }).__GUGU_E2E_STARS__ = true;
    });
  }
  await page.addInitScript((sp) => {
    if (!localStorage.getItem('catch-gugumon:save')) {
      const field = {
        starterChosen: true,
        companion: 'c034',
        species: { c034: { level: 5, exp: 0, stage: 1, caught: 1, firstCaughtAt: 1, skills: ['c034-1'] } },
        seen: ['c034'],
        position: { map: 'town', x: 8, y: 25, facing: 'up' },
        starPoints: sp,
      };
      localStorage.setItem('catch-gugumon:save', JSON.stringify({ version: 1, state: { field } }));
    }
  }, starPoints);
  await page.goto('/#/field');
  await expect(page.getByTestId('field-canvas')).toHaveAttribute('data-pos', /\d+,\d+/);
  await page.keyboard.down('ArrowUp'); // 상점 문
  await expect(page.getByRole('dialog', { name: '상점' })).toBeVisible();
  await page.keyboard.up('ArrowUp');
  await page.getByRole('dialog', { name: '상점' }).getByRole('tab', { name: '꾸미기' }).click();
}

const savedField = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem('catch-gugumon:save')!).state.field);

test('별 120개로 한국 세트를 사고 입는다', async ({ page }) => {
  const errors = collectErrors(page);
  await seed(page, true, 120);
  const shop = page.getByRole('dialog', { name: '상점' });
  await expect(shop.getByTestId('costume-stars')).toContainText('120');
  const kr = shop.getByTestId('costume-flag-kr');
  await kr.scrollIntoViewIfNeeded();
  await kr.getByRole('button', { name: '한국 사기' }).click();
  await expect(shop.getByTestId('costume-stars')).toContainText('70');
  await expect(kr.getByRole('button', { name: '한국 입기' })).toBeVisible();
  await expect(shop.getByTestId('costume-basic').getByRole('button', { name: '처음 옷 입는 중' })).toBeDisabled();
  await kr.getByRole('button', { name: '한국 입기' }).click();
  await expect(kr.getByRole('button', { name: '한국 입는 중' })).toBeDisabled();
  const f = await savedField(page);
  expect(f.costume.equipped).toBe('flag-kr');
  expect(f.costume.owned).toContain('flag-kr');
  expect(f.starPoints).toBe(70);
  // 375px 폭 안에 가로 스크롤이 없다
  const w = await shop.locator('.fshop__card').evaluate((el) => ({ sw: el.scrollWidth, cw: el.clientWidth }));
  expect(w.sw).toBeLessThanOrEqual(w.cw);
  expect(errors).toEqual([]);
});

test('별이 모자라면 사기 버튼이 눌리지 않고 이유가 보인다', async ({ page }) => {
  await seed(page, true, 10);
  const shop = page.getByRole('dialog', { name: '상점' });
  const kr = shop.getByTestId('costume-flag-kr');
  await expect(kr.getByRole('button', { name: '한국 사기' })).toBeDisabled();
  await expect(kr.getByText('별이 모자라요')).toBeVisible();
});

test('별점수 꺼짐(기본): 카드 없이 안내만', async ({ page }) => {
  await seed(page, false, 120);
  const shop = page.getByRole('dialog', { name: '상점' });
  await expect(shop.getByText('별점수가 꺼져 있어요')).toBeVisible();
  await expect(shop.getByTestId('costume-flag-kr')).toHaveCount(0);
});
