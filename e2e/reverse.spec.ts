import { expect, test } from './fixtures';

test.use({ viewport: { width: 375, height: 812 } });

const FIELD = {
  starterChosen: true,
  companion: 'c034',
  species: { c034: { level: 5, exp: 0, stage: 1, caught: 1, firstCaughtAt: 1, skills: ['c034-1'] } },
  seen: ['c034'],
  position: { map: 'meadow', x: 5, y: 8, facing: 'right' },
  // 모든 단을 마스터한 상태 (초원의 단이 무엇이든 거꾸로 묻는다)
  training: {
    studied: {},
    mastered: Object.fromEntries([2, 3, 4, 5, 6, 7, 8, 9, 12, 13].map((d) => [d, { bestMs: 20000, at: 1 }])),
    legendGranted: {},
    arith: {},
  },
};

test('마스터한 단은 야생 전투에서 ÷ 문제가 나오고 맞히면 기록된다', async ({ page }) => {
  await page.addInitScript((field) => {
    const w = window as unknown as Record<string, unknown>;
    w.__GUGU_E2E_FIELD__ = true;
    w.__GUGU_E2E_NO_TIMER__ = true;
    w.__GUGU_E2E_TIER__ = 'normal';
    w.__GUGU_E2E_REVERSE__ = true;
    if (!localStorage.getItem('catch-gugumon:save')) localStorage.setItem('catch-gugumon:save', JSON.stringify({ version: 1, state: { field } }));
  }, FIELD);
  await page.goto('/#/field');
  await expect(page.getByTestId('field-canvas')).toHaveAttribute('data-pos', '5,8');
  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(120);
  await page.keyboard.up('ArrowRight');
  await expect(page).toHaveURL(/#\/field\/battle$/);

  const q = page.locator('.wild__bubble .question');
  const picker = page.getByRole('group', { name: '기술 고르기' });
  await expect(q.or(picker)).toBeVisible();
  if (await picker.isVisible()) await picker.locator('.skill-pick').first().click();
  await expect(q).toBeVisible();
  const parts = (await q.locator('> *').allTextContents()).map((t) => t.trim());
  const [a, op, b, , r] = parts;
  expect(op).toBe('÷');
  expect(r).toBe('?');
  const answer = Number(a) / Number(b);
  expect(Number.isInteger(answer)).toBe(true);

  await page.locator('.wild-move').filter({ has: page.locator(`.wild-move__num:text-is("${answer}")`) }).click();
  await expect
    .poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('catch-gugumon:save') ?? '{}').state?.learning?.totalAttempts ?? 0))
    .toBeGreaterThan(0);
});
