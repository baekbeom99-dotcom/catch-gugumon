/** 셈연습 트레이너 화면과 체육관 동상 화면 (NPC 말 걸기는 아직 연결 전이라 주소로 바로 간다) */
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { collectErrors } from './helpers';

test.use({ viewport: { width: 375, height: 812 } });

/** 레전드 11종의 종 id (014~016·018·019·045~050) */
const LEGEND_ID = /^c0(14|15|16|18|19|45|46|47|48|49|50)$/;

async function seed(page: Page, opts: { stars?: boolean; lowGrade?: boolean } = {}) {
  const field = {
    starterChosen: true,
    companion: 'c034',
    species: { c034: { level: 5, exp: 0, stage: 1, caught: 1, firstCaughtAt: 1, skills: ['c034-1'] } },
    seen: ['c034'],
    position: { map: 'town', x: 2, y: 3, facing: 'up' },
  };
  await page.addInitScript(
    ({ f, stars, lowGrade }) => {
      const w = window as unknown as { __GUGU_E2E_NO_TIMER__: boolean; __GUGU_E2E_STARS__?: boolean };
      w.__GUGU_E2E_NO_TIMER__ = true;
      if (stars) w.__GUGU_E2E_STARS__ = true;
      if (!localStorage.getItem('gugu-monster:save')) {
        localStorage.setItem('gugu-monster:save', JSON.stringify({ version: 1, state: { field: f, settings: lowGrade ? { lowGrade: true } : undefined } }));
      }
    },
    { f: field, stars: !!opts.stars, lowGrade: !!opts.lowGrade },
  );
}

async function saved(page: Page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem('gugu-monster:save')!).state.field);
}

const capsuleTotal = (f: { capsules?: Record<string, number> }) => Object.values(f.capsules ?? {}).reduce((a, b) => a + b, 0);

/** 지금 문제의 답을 화면 글에서 계산한다: `7 × 8`, `53 − 8`, `7 + ? = 10`, `? + 3 = 10` */
async function answerOf(page: Page): Promise<number> {
  const text = ((await page.locator('.training__question > span').first().textContent()) ?? '').replace(/\s+/g, ' ').trim();
  let m = text.match(/^(\d+) × (\d+)$/);
  if (m) return Number(m[1]) * Number(m[2]);
  m = text.match(/^(\d+) \+ (\d+)$/);
  if (m) return Number(m[1]) + Number(m[2]);
  m = text.match(/^(\d+) − (\d+)$/);
  if (m) return Number(m[1]) - Number(m[2]);
  m = text.match(/^(\d+) \+ \? = (\d+)$/);
  if (m) return Number(m[2]) - Number(m[1]);
  m = text.match(/^\? \+ (\d+) = (\d+)$/);
  if (m) return Number(m[2]) - Number(m[1]);
  throw new Error(`모르는 문제 글: ${text}`);
}

/** n문제를 푼다. wrongAt이 있으면 그 번째(0부터)에서 틀린 보기를 눌러 본다 */
async function solve(page: Page, n: number, wrongAt = -1) {
  const q = page.locator('.training__question');
  for (let i = 0; i < n; i++) {
    if (i === wrongAt) {
      await page.locator('[data-testid=training-choice]:not([data-answer])').first().click();
      return;
    }
    const key = await q.getAttribute('data-key');
    const ans = await answerOf(page);
    await page.getByRole('button', { name: `답 ${ans}`, exact: true }).click();
    if (i < n - 1) await expect(q).not.toHaveAttribute('data-key', key ?? '');
  }
}

test('기본 트레이너: 처음 마스터는 캡슐 20개, 다시 하면 5개 (한 번씩만 받는다)', async ({ page }) => {
  const errors = collectErrors(page);
  await seed(page);
  await page.goto('/#/field/training/arith/basic');
  await expect(page.getByTestId('arith-entry')).toBeVisible();
  await expect(page.getByRole('heading', { name: '기본 트레이너' })).toBeVisible();
  await expect(page.getByTestId('arith-challenge-btn')).toBeVisible();
  await expect(page.getByTestId('training-study-btn')).toHaveCount(0); // 학습은 없다

  const c0 = capsuleTotal(await saved(page));
  await page.getByTestId('arith-challenge-btn').click();
  await expect(page.getByTestId('arith-challenge')).toBeVisible();
  await expect(page.locator('.training__pip')).toHaveCount(9);
  await solve(page, 9);
  const result = page.getByTestId('training-result');
  await expect(result).toBeVisible();
  await expect(result).toContainText('기본 트레이너 마스터!');
  await expect(result).toContainText('처음 마스터 선물! 캡슐 20개');
  await expect(page.getByTestId('training-capsules')).toHaveAttribute('data-capsules', '20');
  await expect(page.getByTestId('training-legend')).toHaveCount(0);
  const f = await saved(page);
  expect(f.training.arith.basic).toBeTruthy();
  expect(capsuleTotal(f)).toBe(c0 + 20);

  // 다시 하기 → 합격 5개
  await page.getByRole('button', { name: '다시 하기' }).click();
  await solve(page, 9);
  await expect(page.getByTestId('training-capsules')).toHaveAttribute('data-capsules', '5');
  await expect(page.getByTestId('training-result')).not.toContainText('처음 마스터');
  expect(capsuleTotal(await saved(page))).toBe(c0 + 25);

  // 나가기: 체육관으로 → 필드
  await page.getByRole('button', { name: '체육관으로' }).click();
  await expect(page).toHaveURL(/#\/field$/);
  expect(errors).toEqual([]);
});

test('틀리면 바로 끝나고 캡슐이 없다 (마스터 기록도 없다)', async ({ page }) => {
  await seed(page);
  await page.goto('/#/field/training/arith/basic');
  const c0 = capsuleTotal(await saved(page));
  await page.getByTestId('arith-challenge-btn').click();
  await solve(page, 9, 3);
  const result = page.getByTestId('training-result');
  await expect(result).toBeVisible();
  await expect(result).toContainText('아쉬워요');
  await expect(page.getByTestId('training-capsules')).toHaveCount(0);
  await expect(result).not.toContainText('캡슐');
  const f = await saved(page);
  expect(capsuleTotal(f)).toBe(c0);
  expect(f.training?.arith?.basic).toBeUndefined();
  await expect(page.getByRole('button', { name: '다시 하기' })).toBeVisible();
});

test('중간에 그만두면 정산하지 않는다', async ({ page }) => {
  await seed(page);
  await page.goto('/#/field/training/arith/comp');
  const c0 = capsuleTotal(await saved(page));
  await page.getByTestId('arith-challenge-btn').click();
  await solve(page, 4);
  await page.locator('.training__quit').click();
  await expect(page.getByTestId('arith-entry')).toBeVisible();
  expect(capsuleTotal(await saved(page))).toBe(c0);
});

test('보수 문제는 "7 + ? = 10" 식으로 보이고 풀린다', async ({ page }) => {
  await seed(page);
  await page.goto('/#/field/training/arith/comp');
  await page.getByTestId('arith-challenge-btn').click();
  await expect(page.locator('.training__question > span').first()).toContainText(/\? = \d+|\? \+/);
  await solve(page, 9);
  await expect(page.getByTestId('training-result')).toContainText('보수 트레이너 마스터!');
});

test('고수 트레이너 처음 마스터는 레전드 구구몬을 받는다', async ({ page }) => {
  await seed(page);
  await page.goto('/#/field/training/arith/hard');
  await expect(page.getByRole('heading', { name: '고수 트레이너' })).toBeVisible();
  await page.getByTestId('arith-challenge-btn').click();
  await solve(page, 9);
  const legend = page.getByTestId('training-legend');
  await expect(legend).toBeVisible();
  const id = await legend.getAttribute('data-species');
  expect(id).toMatch(LEGEND_ID);
  const f = await saved(page);
  expect(f.species[id!]).toBeTruthy();
  expect(f.training.legendGranted.arithHard).toBe(id);
});

test('모르는 단계 주소는 필드로 돌아간다', async ({ page }) => {
  await seed(page);
  await page.goto('/#/field/training/arith/zzz');
  await expect(page).toHaveURL(/#\/field$/);
});

test('동상은 별점수가 꺼져 있으면 주소로 가도 필드로 돌아간다', async ({ page }) => {
  await seed(page);
  await page.goto('/#/field/statue');
  await expect(page).toHaveURL(/#\/field$/);
  await expect(page.getByTestId('statue-board')).toHaveCount(0);
});

test('동상: 별점수를 켜면 7문제 — 모두 맞히면 별점수 5 이상', async ({ page }) => {
  const errors = collectErrors(page);
  await seed(page, { stars: true });
  await page.goto('/#/field/statue');
  await expect(page.getByTestId('statue-board')).toBeVisible();
  await expect(page.locator('.training__pip')).toHaveCount(7);
  await solve(page, 7);
  const result = page.getByTestId('statue-result');
  await expect(result).toBeVisible();
  const stars = Number(await result.getAttribute('data-stars'));
  expect(stars).toBeGreaterThanOrEqual(5);
  expect((await saved(page)).starPoints).toBe(stars);
  await page.getByTestId('statue-gym-btn').click();
  await expect(page).toHaveURL(/#\/field$/);
  expect(errors).toEqual([]);
});

test('동상: 한 번이라도 틀리면 별점수가 0이고, 같은 문제를 다시 풀 수 있다', async ({ page }) => {
  await seed(page, { stars: true });
  await page.goto('/#/field/statue');
  await expect(page.getByTestId('statue-board')).toBeVisible();
  const q = page.locator('.training__question');
  const key = await q.getAttribute('data-key');
  await page.locator('[data-testid=training-choice]:not([data-answer])').first().click(); // 틀림
  await expect(q).toHaveAttribute('data-key', key ?? ''); // 같은 문제 그대로
  await solve(page, 7);
  const result = page.getByTestId('statue-result');
  await expect(result).toBeVisible();
  await expect(result).toHaveAttribute('data-stars', '0');
  expect((await saved(page)).starPoints).toBe(0);
});

test('동상: 저학년 모드면 덧뺄셈이 나온다', async ({ page }) => {
  await seed(page, { stars: true, lowGrade: true });
  await page.goto('/#/field/statue');
  await expect(page.getByTestId('statue-board')).toBeVisible();
  await expect(page.locator('.training__question > span').first()).toContainText(/^\d+ [+−] \d+$/);
  await solve(page, 7);
  await expect(page.getByTestId('statue-result')).toBeVisible();
});
