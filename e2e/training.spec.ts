/** 트레이닝센터: 체육관 트레이너 말 걸기 → 학습 → 마스터 도전 → 결과·보상·저장, 12·13단 레전드, 계단 건물, 퀴즈 모험 끄기 */
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { collectErrors } from './helpers';

test.use({ viewport: { width: 375, height: 812 } });

/** 레전드 11종의 종 id (014~016·018·019·045~050) */
const LEGEND_ID = /^c0(14|15|16|18|19|45|46|47|48|49|50)$/;

type Training = {
  studied: Record<number, true>;
  mastered: Record<number, { bestMs: number; at: number }>;
  legendGranted: Record<number, string>;
};

const DANS = [2, 3, 4, 5, 6, 7, 8, 9, 12, 13];

/** 마스터한 단과 학습을 마친 단을 정해 저장 모양으로 만든다 */
function trainingOf(masteredDans: number[], studiedDans: number[] = masteredDans): Training {
  const studied: Record<number, true> = {};
  const mastered: Record<number, { bestMs: number; at: number }> = {};
  for (const d of studiedDans) studied[d] = true;
  for (const d of masteredDans) mastered[d] = { bestMs: 20000, at: 1 };
  return { studied, mastered, legendGranted: {} };
}

/** 페이지가 열리기 전에 저장본을 넣는다 (이미 저장이 있으면 그대로 — 새로고침해도 진행이 남는다) */
async function seed(page: Page, opts: { training?: Training; map?: 'town' | 'gym'; pos?: { x: number; y: number; facing: string }; noTimer?: boolean; stars?: boolean } = {}) {
  const field = {
    starterChosen: true,
    companion: 'c034',
    species: { c034: { level: 5, exp: 0, stage: 1, caught: 1, firstCaughtAt: 1, skills: ['c034-1'] } },
    seen: ['c034'],
    training: opts.training ?? { studied: {}, mastered: {}, legendGranted: {} },
    position: { map: opts.map ?? 'town', ...(opts.pos ?? { x: 9, y: 5, facing: 'up' }) },
  };
  await page.addInitScript(
    ({ f, noTimer, stars }) => {
      if (stars) (window as unknown as { __GUGU_E2E_STARS__: boolean }).__GUGU_E2E_STARS__ = true;
      if (noTimer) (window as unknown as { __GUGU_E2E_NO_TIMER__: boolean }).__GUGU_E2E_NO_TIMER__ = true;
      if (!localStorage.getItem('gugu-monster:save')) localStorage.setItem('gugu-monster:save', JSON.stringify({ version: 1, state: { field: f } }));
    },
    { f: field, noTimer: !!opts.noTimer, stars: !!opts.stars },
  );
}

async function saved(page: Page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem('gugu-monster:save')!).state.field);
}

/** 문제 9개를 푼다 (화면의 곱하기 숫자를 읽어 정답 보기를 누른다). wrongAt이 있으면 그 번째(0부터)에서 틀린 보기를 누르고 멈춘다 */
async function solveNine(page: Page, dan: number, wrongAt = -1, tapMany = false, quitRight = false) {
  const question = page.locator('.training__question');
  for (let i = 0; i < 9; i++) {
    const m = Number(await question.getAttribute('data-multiplier'));
    if (i === wrongAt) {
      await page.locator('[data-testid=training-choice]:not([data-answer])').first().click();
      return;
    }
    const choice = page.getByRole('button', { name: `답 ${dan * m}`, exact: true });
    if (tapMany && i === 8) {
      // 마지막 답을 같은 작업 안에서 5번 눌러도 결과·정산은 한 번만 (React가 다시 그리기 전이라 낡은 핸들러까지 확인)
      await choice.evaluate((el) => {
        for (let k = 0; k < 5; k++) (el as HTMLButtonElement).click();
      });
    } else if (quitRight && i === 8) {
      // 마지막 답 바로 뒤(결과가 뜨기 전)에 그만하기를 눌러도 결과 화면으로 간다
      await choice.evaluate((el) => {
        (el as HTMLButtonElement).click();
        (document.querySelector('.training__quit') as HTMLButtonElement).click();
      });
    } else {
      await choice.click();
    }
    if (i < 8) await expect(question).not.toHaveAttribute('data-multiplier', String(m));
  }
}

const count = (f: { capsules: Record<string, number> }, type: string) => f.capsules[type] ?? 0;

async function openTraining(page: Page, dan: number) {
  await page.goto(`/#/field/training/${dan}`);
  await expect(page.getByTestId('training-entry')).toBeVisible();
}

test('마을 체육관 문으로 들어가 2단 트레이너에게 말을 걸면 2단 트레이닝센터로 들어간다', async ({ page }) => {
  const errors = collectErrors(page);
  await seed(page, { map: 'town', pos: { x: 9, y: 5, facing: 'up' } });
  await page.goto('/#/field');
  await expect(page.getByTestId('field-canvas')).toHaveAttribute('data-pos', '9,5'); // 체육관 문 앞
  await page.keyboard.down('ArrowUp');
  await expect(page.getByTestId('field-canvas')).toHaveAttribute('data-map', 'gym');
  await page.keyboard.up('ArrowUp');
  await expect(page.getByTestId('field-canvas')).toHaveAttribute('data-pos', '7,18'); // 체육관 입구
  // 2단 트레이너(4,16) 앞 칸으로 저장 자리를 옮겨 둔 것처럼 다시 연다
  await page.evaluate(() => {
    const raw = JSON.parse(localStorage.getItem('gugu-monster:save')!);
    raw.state.field.position = { map: 'gym', x: 4, y: 17, facing: 'up' };
    localStorage.setItem('gugu-monster:save', JSON.stringify(raw));
  });
  await page.reload();
  await expect(page.getByTestId('field-canvas')).toHaveAttribute('data-pos', '4,17');
  await page.keyboard.down('ArrowUp');
  await expect(page).toHaveURL(/#\/field\/training\/2$/);
  await page.keyboard.up('ArrowUp');
  await expect(page.getByTestId('training-entry')).toBeVisible();
  await expect(page.getByRole('heading', { name: '2단 트레이닝센터' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('잠긴 3단 트레이너에게 말을 걸면 "2단 트레이너를 먼저 이겨요"가 뜨고 들어가지 않는다', async ({ page }) => {
  await seed(page, { map: 'gym', pos: { x: 2, y: 15, facing: 'up' } });
  await page.goto('/#/field');
  await expect(page.getByTestId('field-canvas')).toHaveAttribute('data-pos', '2,15');
  await page.keyboard.down('ArrowUp');
  await expect(page.getByRole('dialog', { name: '표지판' })).toContainText('2단 트레이너를 먼저 이겨요');
  await page.keyboard.up('ArrowUp');
  await expect(page).toHaveURL(/#\/field$/);
  // 주소로 직접 가도 닫힌 단은 마을로 돌려보낸다
  await page.goto('/#/field/training/3');
  await expect(page).toHaveURL(/#\/field$/);
});

test('학습 전에는 마스터 도전이 잠겨 있고, 학습을 끝내면 캡슐 5개를 한 번만 받고 도전이 열린다', async ({ page }) => {
  const errors = collectErrors(page);
  await seed(page);
  await openTraining(page, 2);
  const challenge = page.getByTestId('training-challenge-btn');
  await expect(challenge).toHaveAttribute('aria-disabled', 'true');
  await expect(challenge).toContainText('학습을 먼저 마쳐요');
  await challenge.click({ force: true }); // 눌러도 도전은 시작하지 않는다
  await expect(page.getByTestId('training-entry')).toBeVisible();
  await expect(page.getByTestId('training-challenge')).toHaveCount(0);

  const before = count(await saved(page), 'meadow');
  await page.getByTestId('training-study-btn').click();
  await expect(page.getByTestId('training-study')).toBeVisible();
  await solveNine(page, 2);
  const result = page.getByTestId('training-result');
  await expect(result).toBeVisible();
  await expect(result).toContainText('2단 학습 끝!');
  await expect(page.getByTestId('training-capsules')).toHaveAttribute('data-capsules', '5');

  const f = await saved(page);
  expect(f.training.studied[2]).toBe(true);
  expect(count(f, 'meadow')).toBe(before + 5);
  expect(f.starPoints).toBe(0); // 별점수는 꺼져 있어 쌓이지 않는다

  // 마을로 나가고 다시 들어와도 캡슐은 그대로
  await page.getByRole('button', { name: '체육관으로' }).click();
  await expect(page).toHaveURL(/#\/field$/);
  expect(count(await saved(page), 'meadow')).toBe(before + 5);
  await openTraining(page, 2);
  await expect(page.getByTestId('training-challenge-btn')).toHaveAttribute('aria-disabled', 'false');
  expect(errors).toEqual([]);
});

test('마스터 도전 첫 성공: 마스터 저장·캡슐 20개·다음 3단이 열린다', async ({ page }) => {
  const errors = collectErrors(page);
  await seed(page, { training: trainingOf([], [2]), noTimer: true });
  await openTraining(page, 2);
  const before = count(await saved(page), 'meadow');
  await page.getByTestId('training-challenge-btn').click();
  await expect(page.getByTestId('training-challenge')).toBeVisible();
  await expect(page.getByTestId('training-clock')).toBeVisible();
  await solveNine(page, 2, -1, true); // 마지막 답을 여러 번 눌러도 한 번만 정산
  const result = page.getByTestId('training-result');
  await expect(result).toBeVisible();
  await expect(result).toHaveAttribute('data-result', 'pass');
  await expect(result).toContainText('2단 마스터!');
  await expect(result).toContainText('처음 마스터');
  await expect(page.getByTestId('training-capsules')).toHaveAttribute('data-capsules', '20');

  const f = await saved(page);
  expect(f.training.mastered[2]).toBeTruthy();
  expect(count(f, 'meadow')).toBe(before + 20); // 중복 지급 없음 (5개를 더하지 않는다)
  expect(f.starPoints).toBe(0); // 별점수 꺼짐: 성공해도 0
  // 3단 건물이 열렸다
  await page.getByRole('button', { name: '체육관으로' }).click();
  await openTraining(page, 3);
  expect(errors).toEqual([]);
});

test('별점수를 켜면 트레이닝 성공 한 번에 별점수 3이 저장된다', async ({ page }) => {
  await seed(page, { training: trainingOf([], [2]), noTimer: true, stars: true });
  await openTraining(page, 2);
  await page.getByTestId('training-challenge-btn').click();
  await solveNine(page, 2);
  await expect(page.getByTestId('training-result')).toHaveAttribute('data-result', 'pass');
  expect((await saved(page)).starPoints).toBe(3);
});

test('마지막 답 바로 뒤에 그만하기를 눌러도 결과 화면이 나오고 캡슐은 한 번만 받는다', async ({ page }) => {
  const errors = collectErrors(page);
  await seed(page);
  await openTraining(page, 2);
  const before = count(await saved(page), 'meadow');
  await page.getByTestId('training-study-btn').click();
  await solveNine(page, 2, -1, false, true);
  const result = page.getByTestId('training-result');
  await expect(result).toBeVisible();
  await expect(result).toContainText('2단 학습 끝!');
  await expect(page.getByTestId('training-entry')).toHaveCount(0);
  expect(count(await saved(page), 'meadow')).toBe(before + 5);
  expect(errors).toEqual([]);
});

test('학습에서 틀린 뒤 정답을 눌러도 그 문제는 처음 맞힘으로 기록되지 않는다', async ({ page }) => {
  await seed(page);
  await openTraining(page, 2);
  await page.getByTestId('training-study-btn').click();
  await page.locator('[data-testid=training-choice]:not([data-answer])').first().click(); // 2×1 틀림
  await page.locator('[data-testid=training-choice][data-answer]').click(); // 정답을 눌러 봄
  await expect(page.locator('.training__question')).not.toHaveAttribute('data-multiplier', '1');
  const facts = await page.evaluate(() => JSON.parse(localStorage.getItem('gugu-monster:save')!).state.learning.facts['2x1']);
  expect(facts.box).toBe(1);
  expect(facts.attempts).toBe(2);
});

test('마스터 도전 실패(틀림): 마스터도 캡슐도 없다', async ({ page }) => {
  await seed(page, { training: trainingOf([], [2]), noTimer: true });
  await openTraining(page, 2);
  const before = count(await saved(page), 'meadow');
  await page.getByTestId('training-challenge-btn').click();
  await solveNine(page, 2, 0); // 첫 문제에서 틀림 → 바로 끝
  const result = page.getByTestId('training-result');
  await expect(result).toBeVisible();
  await expect(result).toHaveAttribute('data-result', 'wrong');
  await expect(page.getByTestId('training-capsules')).toHaveCount(0);
  const f = await saved(page);
  expect(f.training.mastered[2]).toBeUndefined();
  expect(count(f, 'meadow')).toBe(before);
});

test('12단 첫 마스터는 레전드 구구몬 한 마리, 두 번째 마스터에는 또 주지 않는다', async ({ page }) => {
  const errors = collectErrors(page);
  await seed(page, { training: trainingOf([2, 3, 4, 5, 6, 7, 8, 9], DANS.filter((d) => d !== 13)), noTimer: true });
  await openTraining(page, 12);
  const before = await saved(page);
  await page.getByTestId('training-challenge-btn').click();
  await solveNine(page, 12);
  await expect(page.getByTestId('training-result')).toHaveAttribute('data-result', 'pass');
  const legend = page.getByTestId('training-legend');
  await expect(legend).toBeVisible();
  const id = await legend.getAttribute('data-species');
  expect(id).toMatch(LEGEND_ID);

  const first = await saved(page);
  expect(Object.keys(first.species).length).toBe(Object.keys(before.species).length + 1);
  expect(first.species[id!]).toBeTruthy();
  expect(first.training.legendGranted[12]).toBe(id);
  expect(count(first, 'legend')).toBe(count(before, 'legend') + 20);

  // 같은 단을 다시 마스터: 캡슐 5개는 받지만 레전드는 더 오지 않는다
  await page.getByRole('button', { name: '다시 하기' }).click();
  await expect(page.getByTestId('training-challenge')).toBeVisible();
  await solveNine(page, 12);
  await expect(page.getByTestId('training-result')).toHaveAttribute('data-result', 'pass');
  await expect(page.getByTestId('training-legend')).toHaveCount(0);
  const second = await saved(page);
  expect(Object.keys(second.species).length).toBe(Object.keys(first.species).length);
  expect(second.species[id!].caught).toBe(first.species[id!].caught);
  expect(count(second, 'legend')).toBe(count(first, 'legend') + 5);
  expect(errors).toEqual([]);
});

test('무한의 계단 건물에 부딪히면 계단으로 들어가고, 나오면 마을 문 앞으로 돌아온다', async ({ page }) => {
  const errors = collectErrors(page);
  await seed(page, { pos: { x: 9, y: 9, facing: 'up' } });
  await page.goto('/#/field');
  await expect(page.getByTestId('field-canvas')).toHaveAttribute('data-pos', '9,9');
  await page.keyboard.down('ArrowUp');
  await expect(page).toHaveURL(/#\/stairs$/);
  await page.keyboard.up('ArrowUp');
  await page.getByRole('button', { name: '무한의 계단 그만하기' }).click();
  await expect(page).toHaveURL(/#\/field$/);
  await expect(page.getByTestId('field-canvas')).toHaveAttribute('data-pos', '9,9');
  expect(errors).toEqual([]);
});

test('퀴즈 모험이 꺼져 있으면 #/pet은 필드로 가고 타이틀에는 퀴즈 모험 버튼이 없다', async ({ page }) => {
  await seed(page);
  await page.goto('/#/');
  await expect(page.getByRole('button', { name: '필드 모험' })).toBeVisible();
  await expect(page.getByRole('button', { name: '퀴즈 모험' })).toHaveCount(0);
  await page.goto('/#/pet');
  await expect(page).toHaveURL(/#\/field$/);
  await page.goto('/#/explore');
  await expect(page).toHaveURL(/#\/field$/);
});

test('퀴즈 모험이 꺼져 있어도 타이틀의 작은 관리 글자로 관리자 화면(탭 없음)에 간다', async ({ page }) => {
  await seed(page);
  await page.goto('/#/');
  await page.getByRole('button', { name: '관리', exact: true }).click();
  await expect(page).toHaveURL(/#\/admin$/);
  await expect(page.getByRole('heading', { name: /어른용 화면|PIN/ }).first()).toBeVisible();
  await expect(page.locator('.tabbar')).toHaveCount(0);
});
