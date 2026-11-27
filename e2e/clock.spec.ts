/** 시계 읽기 트레이너: 체육관 NPC(정각·5분·1분)에게 말 걸기 → 시계 문제 9개 → 결과·열림 */
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { collectErrors } from './helpers';

test.use({ viewport: { width: 375, height: 812 } });

type Seed = { pos: { x: number; y: number; facing: string }; clockMastered?: string[]; lowGrade?: boolean };

async function seed(page: Page, o: Seed) {
  const clock: Record<string, { bestMs: number; at: number }> = {};
  for (const l of o.clockMastered ?? []) clock[l] = { bestMs: 20000, at: 1 };
  const field = {
    starterChosen: true,
    companion: 'c034',
    species: { c034: { level: 5, exp: 0, stage: 1, caught: 1, firstCaughtAt: 1, skills: ['c034-1'] } },
    seen: ['c034'],
    training: { studied: {}, mastered: {}, legendGranted: {}, arith: {}, clock },
    position: { map: 'gym', ...o.pos },
  };
  await page.addInitScript(
    ({ f, lowGrade }) => {
      (window as unknown as { __GUGU_E2E_NO_TIMER__: boolean }).__GUGU_E2E_NO_TIMER__ = true;
      if (!localStorage.getItem('catch-gugumon:save')) {
        localStorage.setItem('catch-gugumon:save', JSON.stringify({ version: 1, state: { field: f, settings: lowGrade ? { lowGrade: true } : undefined } }));
      }
    },
    { f: field, lowGrade: !!o.lowGrade },
  );
}

const canvas = (page: Page) => page.getByTestId('field-canvas');

async function bump(page: Page, key: string, check: () => Promise<void>) {
  await page.keyboard.down(key);
  await check();
  await page.keyboard.up(key);
}

async function saved(page: Page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem('catch-gugumon:save')!).state.field);
}

/** 시계 SVG의 data-h·data-m에서 정답 버튼을 눌러 n문제를 푼다. wrongAt이 있으면 그 번째에서 틀린 보기를 누른다 */
async function solve(page: Page, n: number, wrongAt = -1) {
  const q = page.locator('.training__question');
  for (let i = 0; i < n; i++) {
    if (i === wrongAt) {
      await page.locator('[data-testid=training-choice]:not([data-answer])').first().click();
      return;
    }
    const key = await q.getAttribute('data-key');
    const svg = page.locator('svg.clock-face');
    const h = Number(await svg.getAttribute('data-h'));
    const m = Number(await svg.getAttribute('data-m'));
    await page.getByRole('button', { name: `답 ${h}:${String(m).padStart(2, '0')}`, exact: true }).click();
    if (i < n - 1) await expect(q).not.toHaveAttribute('data-key', key ?? '');
  }
}

test('정각 트레이너에게 말을 걸어 9문제를 모두 맞히면 합격·캡슐, 돌아오면 마스터 표식', async ({ page }) => {
  const errors = collectErrors(page);
  await seed(page, { pos: { x: 12, y: 13, facing: 'up' } }); // 한 칸 아래에서 걸어 올라가 (12,12) 트레이너에게 부딪힌다
  await page.goto('/#/field');
  await expect(canvas(page)).toHaveAttribute('data-pos', '12,13');
  await expect(canvas(page)).toHaveAttribute('data-npcs', /clockHour:0,clockFive:0,clockOne:0$/);
  await bump(page, 'ArrowUp', async () => {
    await expect(page).toHaveURL(/#\/field\/training\/clock\/hour$/);
  });
  await expect(page.getByTestId('clock-entry')).toBeVisible();
  await expect(page.getByRole('heading', { name: '정각 시계 트레이너' })).toBeVisible();
  await page.getByTestId('clock-challenge-btn').click();
  await expect(page.getByTestId('clock-challenge')).toBeVisible();
  await expect(page.locator('.training__pip')).toHaveCount(9);
  await expect(page.locator('svg.clock-face')).toHaveAttribute('aria-label', '몇 시 몇 분일까요?');
  await expect(page.locator('[data-testid=training-choice]')).toHaveCount(3);
  await solve(page, 9);

  const result = page.getByTestId('training-result');
  await expect(result).toHaveAttribute('data-result', 'pass');
  await expect(result).toContainText('정각 시계 트레이너 마스터!');
  await expect(page.getByTestId('training-capsules')).toBeVisible();
  expect(Number(await page.getByTestId('training-capsules').getAttribute('data-capsules'))).toBeGreaterThan(0);
  expect((await saved(page)).training.clock.hour).toBeTruthy();

  await page.getByRole('button', { name: '체육관으로' }).click();
  await expect(page).toHaveURL(/#\/field$/);
  await expect(canvas(page)).toHaveAttribute('data-npcs', /clockHour:1,clockFive:0,clockOne:0$/);
  expect(errors).toEqual([]);
});

test('정각을 마스터하기 전에는 5분 트레이너가 잠겨 있다 (글 + 주소로 가도 필드로)', async ({ page }) => {
  await seed(page, { pos: { x: 11, y: 9, facing: 'up' } });
  await page.goto('/#/field');
  await expect(canvas(page)).toHaveAttribute('data-pos', '11,9');
  await bump(page, 'ArrowUp', async () => {
    await expect(page.getByRole('dialog', { name: '표지판' })).toContainText('정각을 먼저 마스터해요');
  });
  await expect(page).toHaveURL(/#\/field$/);
  await page.goto('/#/field/training/clock/five');
  await expect(page).toHaveURL(/#\/field$/);
  await page.goto('/#/field/training/clock/zzz');
  await expect(page).toHaveURL(/#\/field$/);
});

test('정각을 마스터했으면 5분 트레이너가 열린다, 1분은 아직 잠김', async ({ page }) => {
  await seed(page, { pos: { x: 11, y: 9, facing: 'up' }, clockMastered: ['hour'] });
  await page.goto('/#/field');
  await expect(canvas(page)).toHaveAttribute('data-npcs', /clockHour:1,clockFive:0,clockOne:0$/);
  await bump(page, 'ArrowUp', async () => {
    await expect(page).toHaveURL(/#\/field\/training\/clock\/five$/);
  });
  await expect(page.getByRole('heading', { name: '5분 시계 트레이너' })).toBeVisible();
  await page.getByTestId('clock-challenge-btn').click();
  await solve(page, 9);
  await expect(page.getByTestId('training-result')).toHaveAttribute('data-result', 'pass');
  await page.getByRole('button', { name: '체육관으로' }).click();
  await expect(canvas(page)).toHaveAttribute('data-pos', '11,9');
  await expect(canvas(page)).toHaveAttribute('data-npcs', /clockHour:1,clockFive:1,clockOne:0$/);
});

test('틀리면 바로 끝나고 캡슐·마스터 기록이 없다', async ({ page }) => {
  await seed(page, { pos: { x: 12, y: 13, facing: 'up' } });
  await page.goto('/#/field/training/clock/hour');
  await page.getByTestId('clock-challenge-btn').click();
  await solve(page, 9, 2);
  const result = page.getByTestId('training-result');
  await expect(result).toContainText('아쉬워요');
  await expect(page.getByTestId('training-capsules')).toHaveCount(0);
  expect((await saved(page)).training?.clock?.hour).toBeUndefined();
});

test('저학년 모드여도 시계 트레이너는 똑같이 열리고 시계 문제가 나온다', async ({ page }) => {
  await seed(page, { pos: { x: 12, y: 13, facing: 'up' }, lowGrade: true });
  await page.goto('/#/field');
  await expect(canvas(page)).toHaveAttribute('data-pos', '12,13');
  await bump(page, 'ArrowUp', async () => {
    await expect(page).toHaveURL(/#\/field\/training\/clock\/hour$/);
  });
  await page.getByTestId('clock-challenge-btn').click();
  await expect(page.locator('svg.clock-face')).toBeVisible();
  await expect(page.locator('.training__question')).not.toContainText(/[+−×]/);
  await solve(page, 9);
  await expect(page.getByTestId('training-result')).toHaveAttribute('data-result', 'pass');
});

test('학습 기록 화면에 시계 읽기 최고 기록 줄이 있다', async ({ page }) => {
  await seed(page, { pos: { x: 12, y: 13, facing: 'up' }, clockMastered: ['hour'] });
  await page.goto('/#/field/records');
  const rec = page.getByTestId('clock-records');
  await expect(rec).toContainText('정각: ⭐ 20.0초');
  await expect(rec).toContainText('5분: 아직 도전 전');
  await expect(rec).toContainText('1분: 아직 도전 전');
});
