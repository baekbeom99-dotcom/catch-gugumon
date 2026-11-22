/** 체육관: 마을 문 → 체육관 안 → 트레이너(NPC)에게 말 걸기 → 트레이닝·셈연습·동상 화면 → 돌아오면 그 NPC 앞 */
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { collectErrors } from './helpers';

test.use({ viewport: { width: 375, height: 812 } });

type Seed = {
  map?: 'town' | 'gym';
  pos: { x: number; y: number; facing: string };
  masteredDans?: number[];
  studiedDans?: number[];
  arithMastered?: string[];
  stars?: boolean;
  lowGrade?: boolean;
};

/** 페이지가 열리기 전에 저장본을 넣는다 (이미 저장이 있으면 그대로 — 트레이닝에서 돌아와도 진행이 남는다) */
async function seed(page: Page, o: Seed) {
  const mastered: Record<number, { bestMs: number; at: number }> = {};
  const studied: Record<number, true> = {};
  for (const d of o.masteredDans ?? []) mastered[d] = { bestMs: 20000, at: 1 };
  for (const d of o.studiedDans ?? o.masteredDans ?? []) studied[d] = true;
  const arith: Record<string, { bestMs: number; at: number }> = {};
  for (const l of o.arithMastered ?? []) arith[l] = { bestMs: 20000, at: 1 };
  const field = {
    starterChosen: true,
    companion: 'c034',
    species: { c034: { level: 5, exp: 0, stage: 1, caught: 1, firstCaughtAt: 1, skills: ['c034-1'] } },
    seen: ['c034'],
    training: { studied, mastered, legendGranted: {}, arith },
    position: { map: o.map ?? 'gym', ...o.pos },
  };
  await page.addInitScript(
    ({ f, stars, lowGrade }) => {
      const w = window as unknown as { __GUGU_E2E_NO_TIMER__: boolean; __GUGU_E2E_STARS__?: boolean };
      w.__GUGU_E2E_NO_TIMER__ = true;
      if (stars) w.__GUGU_E2E_STARS__ = true;
      if (!localStorage.getItem('catch-gugumon:save')) {
        localStorage.setItem('catch-gugumon:save', JSON.stringify({ version: 1, state: { field: f, settings: lowGrade ? { lowGrade: true } : undefined } }));
      }
    },
    { f: field, stars: !!o.stars, lowGrade: !!o.lowGrade },
  );
}

const canvas = (page: Page) => page.getByTestId('field-canvas');

/** 한 방향을 눌러 부딪히게 하고 뗀다 (부딪힌 결과는 check가 확인) */
async function bump(page: Page, key: string, check: () => Promise<void>) {
  await page.keyboard.down(key);
  await check();
  await page.keyboard.up(key);
}

/** 저장된 주인공 자리 (이동 직후 확인용) */
async function savedPos(page: Page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem('catch-gugumon:save')!).state.field.position);
}

/** 단 학습·도전 문제 9개를 푼다 */
async function solveDan(page: Page, dan: number) {
  const question = page.locator('.training__question');
  for (let i = 0; i < 9; i++) {
    const m = Number(await question.getAttribute('data-multiplier'));
    await page.getByRole('button', { name: `답 ${dan * m}`, exact: true }).click();
    if (i < 8) await expect(question).not.toHaveAttribute('data-multiplier', String(m));
  }
}

test('마을 체육관 문 앞에서 위로 걸으면 체육관 입구에 들어서고, 트레이너 13명은 아직 아무도 마스터 전이다', async ({ page }) => {
  const errors = collectErrors(page);
  await seed(page, { map: 'town', pos: { x: 9, y: 5, facing: 'up' } });
  await page.goto('/#/field');
  await expect(canvas(page)).toHaveAttribute('data-map', 'town');
  await expect(canvas(page)).toHaveAttribute('data-pos', '9,5');
  await page.keyboard.down('ArrowUp');
  await expect(canvas(page)).toHaveAttribute('data-map', 'gym');
  await page.keyboard.up('ArrowUp');
  await expect(canvas(page)).toHaveAttribute('data-pos', '7,18');
  const npcs = ((await canvas(page).getAttribute('data-npcs')) ?? '').split(',');
  expect(npcs).toEqual(['dan2:0', 'dan3:0', 'dan4:0', 'dan5:0', 'dan6:0', 'dan7:0', 'dan8:0', 'dan9:0', 'dan12:0', 'dan13:0', 'arithBasic:0', 'arithHard:0', 'arithComp:0']);
  expect(errors).toEqual([]);
});

test('마스터한 트레이너는 data-npcs가 1이다 (단 둘, 셈연습 기본)', async ({ page }) => {
  await seed(page, { pos: { x: 7, y: 17, facing: 'up' }, masteredDans: [2, 3], arithMastered: ['basic'] });
  await page.goto('/#/field');
  await expect(canvas(page)).toHaveAttribute('data-map', 'gym');
  await expect(canvas(page)).toHaveAttribute('data-npcs', /^dan2:1,dan3:1,dan4:0,.*,arithBasic:1,arithHard:0,arithComp:0$/);
});

test('체육관 출구(7,19)로 나가면 마을 체육관 문 앞(9,5)에 선다', async ({ page }) => {
  await seed(page, { pos: { x: 7, y: 18, facing: 'down' } });
  await page.goto('/#/field');
  await expect(canvas(page)).toHaveAttribute('data-map', 'gym');
  await page.keyboard.down('ArrowDown');
  await expect(canvas(page)).toHaveAttribute('data-map', 'town');
  await page.keyboard.up('ArrowDown');
  await expect(canvas(page)).toHaveAttribute('data-pos', '9,5');
});

test('잠긴 3단 트레이너에게 말을 걸면 "2단 트레이너를 먼저 이겨요"가 뜨고 들어가지 않는다', async ({ page }) => {
  await seed(page, { pos: { x: 2, y: 15, facing: 'up' } });
  await page.goto('/#/field');
  await expect(canvas(page)).toHaveAttribute('data-pos', '2,15');
  await bump(page, 'ArrowUp', async () => {
    await expect(page.getByRole('dialog', { name: '표지판' })).toContainText('2단 트레이너를 먼저 이겨요');
  });
  await expect(page).toHaveURL(/#\/field$/);
  await expect(canvas(page)).toHaveAttribute('data-pos', '2,15');
});

test('2단 트레이너 → 학습 → 돌아오면 그 앞 → 도전 합격 → 마스터 표식 1 → 3단 트레이너 표식은 아직 0', async ({ page }) => {
  const errors = collectErrors(page);
  await seed(page, { pos: { x: 4, y: 18, facing: 'up' } }); // 한 칸 아래에서 걸어 올라가 트레이너 앞 칸(4,17)에서 부딪힌다
  await page.goto('/#/field');
  await expect(canvas(page)).toHaveAttribute('data-pos', '4,18');
  await bump(page, 'ArrowUp', async () => {
    await expect(page).toHaveURL(/#\/field\/training\/2$/);
  });
  expect(await savedPos(page)).toMatchObject({ map: 'gym', x: 4, y: 17, facing: 'up' }); // 이동 전에 현재 칸·바라보는 쪽을 저장했다
  await expect(page.getByTestId('training-entry')).toBeVisible();
  await expect(page.getByTestId('training-challenge-btn')).toHaveAttribute('aria-disabled', 'true');

  // 학습
  await page.getByTestId('training-study-btn').click();
  await solveDan(page, 2);
  await expect(page.getByTestId('training-result')).toContainText('2단 학습 끝!');
  await page.getByRole('button', { name: '체육관으로' }).click();
  await expect(page).toHaveURL(/#\/field$/);
  await expect(canvas(page)).toHaveAttribute('data-map', 'gym');
  await expect(canvas(page)).toHaveAttribute('data-pos', '4,17'); // 그 트레이너 앞 칸
  await expect(canvas(page)).toHaveAttribute('data-npcs', /^dan2:0,/);

  // 다시 말을 걸어 마스터 도전 (시계는 멈춰 있다)
  await bump(page, 'ArrowUp', async () => {
    await expect(page).toHaveURL(/#\/field\/training\/2$/);
  });
  await expect(page.getByTestId('training-challenge-btn')).toHaveAttribute('aria-disabled', 'false');
  await page.getByTestId('training-challenge-btn').click();
  await solveDan(page, 2);
  await expect(page.getByTestId('training-result')).toHaveAttribute('data-result', 'pass');
  await page.getByRole('button', { name: '체육관으로' }).click();
  await expect(canvas(page)).toHaveAttribute('data-pos', '4,17');
  await expect(canvas(page)).toHaveAttribute('data-npcs', /^dan2:1,dan3:0,/);
  expect(errors).toEqual([]);
});

test('2단을 마스터했으면 3단 트레이너에게 말을 걸어 3단 트레이닝센터로 들어간다', async ({ page }) => {
  await seed(page, { pos: { x: 2, y: 15, facing: 'up' }, masteredDans: [2] });
  await page.goto('/#/field');
  await expect(canvas(page)).toHaveAttribute('data-pos', '2,15');
  await bump(page, 'ArrowUp', async () => {
    await expect(page).toHaveURL(/#\/field\/training\/3$/);
  });
  await expect(page.getByRole('heading', { name: '3단 트레이닝센터' })).toBeVisible();
});

test('셈연습 트레이너(기본)에게 말을 걸면 처음부터 열려 있고, 나오면 그 앞에 선다', async ({ page }) => {
  await seed(page, { pos: { x: 11, y: 16, facing: 'up' } }); // 한 칸 아래에서 걸어 올라간다
  await page.goto('/#/field');
  await expect(canvas(page)).toHaveAttribute('data-pos', '11,16');
  await bump(page, 'ArrowUp', async () => {
    await expect(page).toHaveURL(/#\/field\/training\/arith\/basic$/);
  });
  expect(await savedPos(page)).toMatchObject({ map: 'gym', x: 11, y: 15, facing: 'up' });
  await expect(page.getByTestId('arith-entry')).toBeVisible();
  await page.getByRole('button', { name: '체육관으로' }).click();
  await expect(page).toHaveURL(/#\/field$/);
  await expect(canvas(page)).toHaveAttribute('data-pos', '11,15');
});

test('동상은 별점수가 꺼져 있으면 아무 반응이 없다', async ({ page }) => {
  await seed(page, { pos: { x: 2, y: 16, facing: 'down' } });
  await page.goto('/#/field');
  await expect(canvas(page)).toHaveAttribute('data-pos', '2,16');
  await page.keyboard.down('ArrowDown');
  await page.waitForTimeout(700);
  await page.keyboard.up('ArrowDown');
  await expect(page).toHaveURL(/#\/field$/);
  await expect(canvas(page)).toHaveAttribute('data-pos', '2,16');
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('별점수를 켜면 동상에게 말을 걸어 동상 화면으로 간다', async ({ page }) => {
  await seed(page, { pos: { x: 2, y: 16, facing: 'down' }, stars: true });
  await page.goto('/#/field');
  await expect(canvas(page)).toHaveAttribute('data-pos', '2,16');
  await bump(page, 'ArrowDown', async () => {
    await expect(page).toHaveURL(/#\/field\/statue$/);
  });
  await expect(page.getByTestId('statue-board')).toBeVisible();
});

test('저학년 모드여도 체육관 트레이닝 화면은 구구단(×) 그대로다', async ({ page }) => {
  await seed(page, { pos: { x: 4, y: 17, facing: 'up' }, lowGrade: true });
  await page.goto('/#/field');
  await expect(canvas(page)).toHaveAttribute('data-pos', '4,17');
  await bump(page, 'ArrowUp', async () => {
    await expect(page).toHaveURL(/#\/field\/training\/2$/);
  });
  await page.getByTestId('training-study-btn').click();
  await expect(page.locator('.training__question')).toContainText('×');
});
