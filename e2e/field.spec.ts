import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { collectErrors } from './helpers';
import { TOWN_ROWS_ADDED as R } from '../src/domain/field/tuning';

test.use({ viewport: { width: 375, height: 812 } });

/** 레전드 11종의 종 id (014~016·018·019·045~050) */
const LEGEND_ID = /^c0(14|15|16|18|19|45|46|47|48|49|50)$/;

/** 첫 구구몬(꽃등짐몬)을 이미 고른 저장본 — 기술은 1개라 전투에서 고르기 없이 바로 문제 */
const STARTER_FIELD = {
  starterChosen: true,
  companion: 'c034',
  species: { c034: { level: 5, exp: 0, stage: 1, caught: 1, firstCaughtAt: 1, skills: ['c034-1'] } },
  seen: ['c034'],
};

/** 페이지가 열리기 전에 첫 구구몬을 고른 저장본을 넣는다 (이미 저장이 있으면 그대로) */
async function seedStarter(page: Page) {
  await page.addInitScript((field) => {
    if (!localStorage.getItem('catch-gugumon:save')) {
      localStorage.setItem('catch-gugumon:save', JSON.stringify({ version: 1, state: { field } }));
    }
  }, STARTER_FIELD);
}

async function pos(page: Page) {
  const [x, y] = ((await page.getByTestId('field-canvas').getAttribute('data-pos')) ?? '0,0').split(',').map(Number);
  return { x, y };
}

/** 화면 가운데쯤 (조이스틱을 누를 자리) */
async function center(page: Page) {
  const box = (await page.getByTestId('field-canvas').boundingBox())!;
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

test('조이스틱을 오른쪽으로 끌면 걷고, 떼면 멈춘다', async ({ page }) => {
  await seedStarter(page);
  await page.goto('/#/field');
  await expect(page.getByTestId('field-canvas')).toHaveAttribute('data-pos', /\d+,\d+/);
  const c = await center(page);
  const before = await pos(page);
  await expect(page.getByLabel('조이스틱')).toHaveCount(0);
  await page.mouse.move(c.x, c.y);
  await page.mouse.down();
  await page.mouse.move(c.x + 60, c.y, { steps: 4 });
  await expect(page.getByLabel('조이스틱')).toBeVisible();
  await page.waitForTimeout(500);
  expect((await pos(page)).x).toBeGreaterThan(before.x);
  await page.mouse.up();
  await expect(page.getByLabel('조이스틱')).toHaveCount(0);
  await page.waitForTimeout(300);
  const stopped = await pos(page);
  await page.waitForTimeout(400);
  expect(await pos(page)).toEqual(stopped);
});

test('눌린 채 pointercancel이 오면 걸음이 멈춘다', async ({ page }) => {
  await seedStarter(page);
  await page.goto('/#/field');
  await expect(page.getByTestId('field-canvas')).toHaveAttribute('data-pos', /\d+,\d+/);
  const c = await center(page);
  const before = await pos(page);
  await page.mouse.move(c.x, c.y);
  await page.mouse.down();
  await page.mouse.move(c.x - 60, c.y, { steps: 4 });
  await page.waitForTimeout(500);
  expect((await pos(page)).x).toBeLessThan(before.x); // 취소 전에 실제로 걸었다
  await page.getByTestId('joystick-layer').dispatchEvent('pointercancel', { pointerId: 1, pointerType: 'mouse', isPrimary: true });
  await page.waitForTimeout(300);
  const stopped = await pos(page);
  await page.waitForTimeout(500);
  expect(await pos(page)).toEqual(stopped);
  await page.mouse.up();
});

test('화면 밖으로 끌고 나가서 떼도 걸음이 멈춘다', async ({ page }) => {
  await seedStarter(page);
  await page.goto('/#/field');
  await expect(page.getByTestId('field-canvas')).toHaveAttribute('data-pos', /\d+,\d+/);
  const c = await center(page);
  const before = await pos(page);
  await page.mouse.move(c.x, c.y);
  await page.mouse.down();
  await page.mouse.move(c.x + 60, c.y, { steps: 4 });
  await page.waitForTimeout(400);
  expect((await pos(page)).x).toBeGreaterThan(before.x);
  await page.mouse.move(c.x, -50); // 화면 밖(위쪽)으로
  await page.mouse.up();
  await page.waitForTimeout(400);
  const stopped = await pos(page);
  await page.waitForTimeout(500);
  expect(await pos(page)).toEqual(stopped);
});

test('걸은 뒤 새로고침해도 같은 자리', async ({ page }) => {
  await seedStarter(page);
  await page.goto('/#/field');
  await expect(page.getByTestId('field-canvas')).toHaveAttribute('data-pos', /\d+,\d+/);
  const c = await center(page);
  const before = await pos(page);
  await page.mouse.move(c.x, c.y);
  await page.mouse.down();
  await page.mouse.move(c.x + 60, c.y, { steps: 4 });
  await page.waitForTimeout(600);
  await page.mouse.up();
  await page.waitForTimeout(400);
  const after = await pos(page);
  expect(after.x).toBeGreaterThan(before.x);
  await page.reload();
  await expect(page.getByTestId('field-canvas')).toHaveAttribute('data-pos', `${after.x},${after.y}`);
});

test('표지판에 부딪히면 글이 뜨고, 탭하면 닫히고, 계속 눌러도 다시 안 열린다', async ({ page }) => {
  await seedStarter(page);
  await page.goto('/#/field');
  await expect(page.getByTestId('field-canvas')).toHaveAttribute('data-pos', /\d+,\d+/); // 지도가 뜬 뒤에 저장본을 바꾼다
  // 표지판(9,5) 바로 아래 (9,6)에 서 있는 저장본을 만든다
  await page.evaluate((starter) => {
    localStorage.clear();
    localStorage.setItem(
      'catch-gugumon:save',
      JSON.stringify({ version: 1, state: { field: { ...starter, position: { map: 'meadow', x: 9, y: 6, facing: 'up' } } } }),
    );
  }, STARTER_FIELD);
  await page.reload();
  await expect(page.getByTestId('field-canvas')).toHaveAttribute('data-pos', '9,6');
  const dialog = page.getByRole('dialog', { name: '표지판' });
  await page.keyboard.down('ArrowUp');
  await expect(dialog).toContainText('← 물가 · 사막 →');
  await dialog.click();
  await expect(dialog).toHaveCount(0);
  await page.waitForTimeout(300); // 위쪽을 계속 누르고 있어도 다시 안 열린다
  await expect(dialog).toHaveCount(0);
  await page.keyboard.up('ArrowUp');
  expect(await pos(page)).toEqual({ x: 9, y: 6 });
});

async function openSignAtNine(page: Page) {
  await seedStarter(page);
  await page.goto('/#/field');
  await expect(page.getByTestId('field-canvas')).toHaveAttribute('data-pos', /\d+,\d+/);
  await page.evaluate((starter) => {
    localStorage.clear();
    localStorage.setItem(
      'catch-gugumon:save',
      JSON.stringify({ version: 1, state: { field: { ...starter, position: { map: 'meadow', x: 9, y: 6, facing: 'up' } } } }),
    );
  }, STARTER_FIELD);
  await page.reload();
  await expect(page.getByTestId('field-canvas')).toHaveAttribute('data-pos', '9,6');
  await page.keyboard.down('ArrowUp');
  await expect(page.getByRole('dialog', { name: '표지판' })).toBeVisible();
  await page.keyboard.up('ArrowUp');
}

test('표지판 글은 Escape로 닫힌다', async ({ page }) => {
  await openSignAtNine(page);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: '표지판' })).toHaveCount(0);
});

test('표지판 글이 열려 있으면 Space로도 닫힌다', async ({ page }) => {
  await openSignAtNine(page);
  await page.keyboard.press('Space');
  await expect(page.getByRole('dialog', { name: '표지판' })).toHaveCount(0);
});

test('Tab으로 메뉴 버튼에 포커스를 두고 Enter를 누르면 메뉴가 열린다', async ({ page }) => {
  await seedStarter(page);
  await page.goto('/#/field');
  await expect(page.getByTestId('field-canvas')).toHaveAttribute('data-pos', /\d+,\d+/);
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: '메뉴' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('menu')).toBeVisible();
});

test('글 밖을 250ms쯤 눌렀다 떼도 표지판 글이 닫힌다', async ({ page }) => {
  await openSignAtNine(page);
  await page.mouse.move(100, 200);
  await page.mouse.down();
  await page.waitForTimeout(250);
  await page.mouse.up();
  await expect(page.getByRole('dialog', { name: '표지판' })).toHaveCount(0);
});

test('글이 없을 때 Enter는 아무 일도 없다', async ({ page }) => {
  await seedStarter(page);
  await page.goto('/#/field');
  await expect(page.getByTestId('field-canvas')).toHaveAttribute('data-pos', /\d+,\d+/);
  const before = await pos(page);
  const prevented = await page.evaluate(
    () =>
      new Promise<boolean[]>((resolve) => {
        const out: boolean[] = [];
        // 화면의 keydown 처리(window, 버블링)가 끝난 뒤 값을 읽는다
        const on = (e: KeyboardEvent) => {
          setTimeout(() => out.push(e.defaultPrevented));
        };
        document.addEventListener('keydown', on);
        for (const code of ['Enter', 'Space', 'Escape']) {
          document.body.dispatchEvent(new KeyboardEvent('keydown', { code, bubbles: true, cancelable: true }));
        }
        setTimeout(() => resolve(out), 50);
      }),
  );
  expect(prevented).toEqual([false, false, false]);
  await page.waitForTimeout(300);
  expect(await pos(page)).toEqual(before);
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('메뉴의 처음 화면으로 돌아간다', async ({ page }) => {
  await seedStarter(page);
  await page.goto('/#/field');
  await page.getByRole('button', { name: '메뉴' }).click();
  await page.getByRole('button', { name: '처음 화면' }).click();
  await expect(page).toHaveURL(/#\/$/);
});

// ── 야생 전투 ──

interface GrassOptions {
  /** 문제 시간이 흐르게 둔다 (기본은 __GUGU_E2E_NO_TIMER__로 멈춤) */
  timer?: boolean;
  /** 꽃등짐몬 기록에 덧붙일 값 (예: { hp: 20 }) */
  c034?: Record<string, unknown>;
  /** 야생 강함 단계 고정 (__GUGU_E2E_TIER__) */
  tier?: string;
  /** 저장본의 캡슐 개수 (없으면 기본 3·3·3·0) */
  capsules?: Record<string, number>;
  /** 꽃등짐몬 말고 더 잡아 둔 종 (예: { c036: { level: 4, ... } }) */
  others?: Record<string, Record<string, unknown>>;
  /**
   * 동행을 꽃등짐몬(c034) 대신 이 종으로 (c034 값·기술 id도 이 종으로 옮긴다).
   * 48종은 특수·주② 효과가 종마다 달라, 스턴은 c023(수박곰몬, 풀·주② 스턴), 회복은 c022(키위곰몬, 풀·특수 회복)를 쓴다
   */
  as?: string;
}

/** 풀숲(6,8) 바로 왼쪽 (5,8)에 오른쪽을 보고 선 저장본 + 만남 100% 스위치 */
async function standBesideGrass(page: Page, opts: GrassOptions = {}) {
  await page.addInitScript(
    ([timer, tier]) => {
      const w = window as unknown as Record<string, unknown>;
      w.__GUGU_E2E_FIELD__ = true;
      if (!timer) w.__GUGU_E2E_NO_TIMER__ = true;
      if (tier) w.__GUGU_E2E_TIER__ = tier;
    },
    [!!opts.timer, opts.tier ?? ''] as const,
  );
  await seedStarter(page);
  await page.goto('/#/field');
  await expect(page.getByTestId('field-canvas')).toHaveAttribute('data-pos', /\d+,\d+/);
  await page.evaluate(
    ([starter, c034, capsules, others, as]) => {
      localStorage.clear();
      const s = starter as typeof STARTER_FIELD;
      const me = { ...s.species.c034, ...(c034 as object) } as { skills: string[] };
      const id = as || 'c034';
      const mine = { ...me, skills: me.skills.map((k) => k.replace(/^c034-/, `${id}-`)) };
      const field = {
        ...s,
        companion: id,
        seen: [id],
        species: { [id]: mine, ...(others as object) },
        position: { map: 'meadow', x: 5, y: 8, facing: 'right' },
        ...(capsules ? { capsules } : {}),
      };
      localStorage.setItem('catch-gugumon:save', JSON.stringify({ version: 1, state: { field } }));
    },
    [STARTER_FIELD, opts.c034 ?? {}, opts.capsules ?? null, opts.others ?? {}, opts.as ?? ''] as const,
  );
  await page.reload();
  await expect(page.getByTestId('field-canvas')).toHaveAttribute('data-pos', '5,8');
}

/** 저장본의 꽃등짐몬 기록 */
async function savedCloud(page: Page): Promise<{ hp: number; wounds: { factId: string; type: string }[] }> {
  return page.evaluate(() => {
    const f = JSON.parse(localStorage.getItem('catch-gugumon:save')!).state.field;
    return f.species[f.companion];
  });
}

/** 정답이 아닌 기술 버튼 하나 */
function wrongMoveButton(page: Page, answer: number) {
  return page.locator('.wild-move').filter({ hasNot: page.locator(`.wild-move__num:text-is("${answer}")`) }).first();
}

async function stepIntoGrass(page: Page) {
  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(120);
  await page.keyboard.up('ArrowRight');
  await expect(page).toHaveURL(/#\/field\/battle$/);
}

/** 말풍선의 문제를 읽어 답을 계산한다 (기술 고르기가 먼저 나오면 첫 기술을 고른다) */
async function solveWild(page: Page): Promise<number> {
  const q = page.locator('.wild__bubble .question');
  const picker = page.getByRole('group', { name: '기술 고르기' });
  await expect(q.or(picker)).toBeVisible();
  if (await picker.isVisible()) await picker.locator('.skill-pick').first().click();
  await expect(q).toBeVisible();
  const parts = (await q.locator('> *').allTextContents()).map((t) => t.trim());
  const [a, , b, , r] = parts;
  if (r === '?') return Number(a) * Number(b);
  if (a === '?') return Number(r) / Number(b);
  return Number(r) / Number(a);
}

function moveButton(page: Page, answer: number) {
  return page.locator('.wild-move').filter({ has: page.locator(`.wild-move__num:text-is("${answer}")`) });
}

/** 별 개수와 펫 성장 점수 (상점 연습은 둘 다 안 바뀐다) */
async function starsAndGrowth(page: Page): Promise<{ stars: number; growthXp: number }> {
  return page.evaluate(() => {
    const st = JSON.parse(localStorage.getItem('catch-gugumon:save') ?? '{}').state ?? {};
    return { stars: st.economy?.stars ?? 0, growthXp: st.pet?.growthXp ?? 0 };
  });
}

async function totalAttempts(page: Page): Promise<number> {
  return page.evaluate(() => JSON.parse(localStorage.getItem('catch-gugumon:save') ?? '{}').state?.learning?.totalAttempts ?? 0);
}

test('길 스위치를 켜면 풀숲 밖 길 한 걸음에도 만나 전투 화면으로 간다', async ({ page }) => {
  await page.addInitScript(() => {
    (window as unknown as { __GUGU_E2E_PATH__: boolean }).__GUGU_E2E_PATH__ = true;
  });
  await standBesideGrass(page); // (5,8)에서 오른쪽을 봄. 아래 (5,9)는 길 칸
  await page.keyboard.down('ArrowDown');
  await page.waitForTimeout(400);
  await page.keyboard.up('ArrowDown');
  await expect(page).toHaveURL(/#\/field\/battle$/);
});

test('풀숲에서 만나 정답으로 HP를 0으로 만들면 캡슐 던지기 버튼이 나온다', async ({ page }) => {
  await standBesideGrass(page, { tier: 'normal' }); // 강력(5%)은 주기 공격 두 번에 쓰러질 수 있어 고정
  await stepIntoGrass(page);
  await expect(page.getByText(/나타났다/)).toBeVisible();
  // 상성이 약하면 한 번에 1칸 ("빠르면 +1칸"은 없어짐) — 넉넉히
  for (let i = 0; i < 14; i++) {
    if (await page.getByRole('button', { name: '캡슐 던지기' }).isVisible()) break;
    const answer = await solveWild(page);
    const buttons = page.locator('.wild-move');
    await expect(buttons).toHaveCount(3);
    await expect(moveButton(page, answer)).toHaveCount(1);
    await moveButton(page, answer).click();
    await page.waitForTimeout(800);
  }
  await expect(page.getByRole('button', { name: '캡슐 던지기' })).toBeVisible();
  await expect(page.getByLabel('야생 체력 0')).toBeVisible();
});

test('HP가 0이 되면 캡슐 던지기와 놓아주기를 고를 수 있고, 놓아주면 캡슐을 쓰지 않는다', async ({ page }) => {
  await standBesideGrass(page, { tier: 'normal' });
  await stepIntoGrass(page);
  await expect(page.getByText(/나타났다/)).toBeVisible();
  for (let i = 0; i < 14; i++) {
    if (await page.getByRole('button', { name: '캡슐 던지기' }).isVisible()) break;
    const answer = await solveWild(page);
    await moveButton(page, answer).click();
    await page.waitForTimeout(800);
  }
  await expect(page.getByRole('button', { name: '캡슐 던지기' })).toBeVisible();
  const before = await savedCapsules(page);
  await page.getByRole('button', { name: '놓아주기' }).click();
  await expect(page.getByText(/놓아주었어요/)).toBeVisible();
  await expect(page).toHaveURL(/#\/field$/);
  expect(await savedCapsules(page)).toEqual(before);
});

/** 저장본의 캡슐 개수 */
async function savedCapsules(page: Page): Promise<Record<string, number>> {
  return page.evaluate(() => JSON.parse(localStorage.getItem('catch-gugumon:save')!).state.field.capsules);
}

/** 정답만 골라 어지러워질 때까지 (캡슐 버튼이 나오거나, 캡슐이 없어 돌려보낼 때까지) */
async function answerUntilDizzy(page: Page) {
  for (let i = 0; i < 14; i++) {
    if (await page.getByRole('button', { name: '캡슐 던지기' }).isVisible()) return;
    if (await page.getByText(/캡슐이 없어서/).isVisible()) return;
    const answer = await solveWild(page);
    await moveButton(page, answer).click();
    await page.waitForTimeout(800);
  }
}

test('던지기 버튼에 맞는 캡슐의 남은 수 (3)가 보인다', async ({ page }) => {
  await standBesideGrass(page, { tier: 'weak' });
  await stepIntoGrass(page);
  await answerUntilDizzy(page);
  const button = page.getByRole('button', { name: '캡슐 던지기' });
  await expect(button).toBeVisible();
  await expect(button).toContainText('캡슐 던지기 (3)');
  await expect(button).toHaveAttribute('data-sparkle', '1'); // 던질 수 있으면 반짝인다
  await page.screenshot({ path: '.superpowers/sdd/2026-11-12-field-adventure-2/task-14-shots/capsule-button-375.png' });
});

test('잡으면 초원 캡슐이 1개 준다 (3 → 2, 저장본)', async ({ page }) => {
  await standBesideGrass(page, { tier: 'weak' });
  await stepIntoGrass(page);
  await answerUntilDizzy(page);
  // 연타해도 한 번만 던진다
  await page.getByRole('button', { name: '캡슐 던지기' }).click();
  await page.getByRole('button', { name: '캡슐 던지기' }).click({ force: true }).catch(() => undefined);
  // 던지는 중에는 반짝이지 않는다
  await expect(page.locator('[data-sparkle="1"]')).toHaveCount(0);
  // 던지는 순간 바로 저장된다 (흔들리는 중)
  expect((await savedCapsules(page)).meadow).toBe(2);
  await expect(page.getByText(/잡았다!/)).toBeVisible({ timeout: 5000 });
  await expect(page).toHaveURL(/#\/field$/, { timeout: 5000 });
  expect(await savedCapsules(page)).toEqual({ meadow: 2, waterside: 3, desert: 3, legend: 0 });
});

test('캡슐 0개면 어지러워질 때 돌려보낸다 (버튼 없음)', async ({ page }) => {
  await standBesideGrass(page, { tier: 'weak', capsules: { meadow: 0, waterside: 3, desert: 3, legend: 0 } });
  await stepIntoGrass(page);
  await answerUntilDizzy(page);
  await expect(page.getByRole('status')).toHaveText('캡슐이 없어서 돌려보냈어! 상점에서 캡슐을 구해 오자');
  await expect(page.getByRole('button', { name: '캡슐 던지기' })).toHaveCount(0);
  await expect(page).toHaveURL(/#\/field$/, { timeout: 5000 });
  const field = await page.evaluate(() => JSON.parse(localStorage.getItem('catch-gugumon:save')!).state.field);
  expect(field.capsules.meadow).toBe(0);
  expect(field.stats).toMatchObject({ battles: 1, catches: 0, fled: 1 });
});

test('다른 종류 캡슐만 있으면 초원 구구몬은 돌려보낸다', async ({ page }) => {
  await standBesideGrass(page, { tier: 'weak', capsules: { meadow: 0, waterside: 5, desert: 5, legend: 5 } });
  await stepIntoGrass(page);
  await answerUntilDizzy(page);
  await expect(page.getByRole('status')).toHaveText(/캡슐이 없어서 돌려보냈어/);
  await expect(page.getByRole('button', { name: '캡슐 던지기' })).toHaveCount(0);
  await expect(page).toHaveURL(/#\/field$/, { timeout: 5000 });
  expect(await savedCapsules(page)).toEqual({ meadow: 0, waterside: 5, desert: 5, legend: 5 });
});

test('전투 중 답 하나 뒤 새로고침하면 필드로 돌아오고 답은 기록돼 있다', async ({ page }) => {
  await standBesideGrass(page);
  const before = await totalAttempts(page);
  await stepIntoGrass(page);
  const answer = await solveWild(page);
  await moveButton(page, answer).click();
  await page.reload();
  await expect(page).toHaveURL(/#\/field$/);
  expect(await totalAttempts(page)).toBe(before + 1);
});

test('정답 버튼을 빠르게 두 번 눌러도 한 번만 기록된다', async ({ page }) => {
  await standBesideGrass(page);
  const before = await totalAttempts(page);
  await stepIntoGrass(page);
  const answer = await solveWild(page);
  await moveButton(page, answer).dblclick();
  await page.waitForTimeout(300);
  expect(await totalAttempts(page)).toBe(before + 1);
});

test('오답이면 적이 공격해 내 체력이 줄고, 힌트의 빛나는 기술을 누르면 다음 문제', async ({ page }) => {
  await standBesideGrass(page);
  await stepIntoGrass(page);
  await page.getByRole('button', { name: '싸우자!' }).click();
  await expect(page.getByLabel('내 체력 100')).toBeVisible();
  const answer = await solveWild(page);
  await wrongMoveButton(page, answer).click();
  const ally = page.getByLabel(/^내 체력 (90|87|83|75)$/);
  await expect(ally).toBeVisible();
  await expect(page.getByRole('status')).toContainText(/의 .+!/); // "○○의 기술!"
  const shown = Number(((await ally.getAttribute('aria-label')) ?? '').replace(/\D/g, ''));
  const glow = page.locator('.wild-move--glow');
  await expect(glow).toHaveCount(1);
  await glow.click();
  await expect(glow).toHaveCount(0);
  await expect(page.locator('.wild__hint')).toHaveCount(0);
  await expect(page.locator('.wild__bubble .question')).toBeVisible();
  await expect(page.locator('.wild-move:enabled')).toHaveCount(3);
  const c034 = await savedCloud(page);
  expect(c034.hp).toBe(shown);
  expect(c034.wounds).toHaveLength(1);
});

test('속성 효과: 정답(내 공격)과 오답(적 공격)에서 콘솔 오류가 없다', async ({ page }) => {
  const errors = collectErrors(page);
  await standBesideGrass(page);
  await stepIntoGrass(page);
  await page.getByRole('button', { name: '싸우자!' }).click();
  const answer = await solveWild(page);
  await moveButton(page, answer).click();
  await page.waitForTimeout(900); // 효과가 도는 동안
  await expect(page.locator('.wild__bubble .question')).toBeVisible();
  const answer2 = await solveWild(page);
  await wrongMoveButton(page, answer2).click();
  await expect(page.getByLabel(/^내 체력 (90|87|83|75)$/)).toBeVisible();
  await page.waitForTimeout(900);
  expect(errors).toEqual([]);
});

test('동작 줄이기: 효과 없이도 오답 → 체력이 줄고 힌트로 가고 오류가 없다', async ({ page }) => {
  const errors = collectErrors(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await standBesideGrass(page);
  await stepIntoGrass(page);
  await page.getByRole('button', { name: '싸우자!' }).click();
  await expect(page.getByLabel('내 체력 100')).toBeVisible();
  const answer = await solveWild(page);
  await wrongMoveButton(page, answer).click();
  await expect(page.getByLabel(/^내 체력 (90|87|83|75)$/)).toBeVisible();
  await expect(page.locator('.wild-move--glow')).toHaveCount(1);
  expect(errors).toEqual([]);
});

test('시간이 다 되면 적이 공격하고, 쓰러지면 태초마을로 돌아가 "쓰러졌어…" 알림', async ({ page }) => {
  await page.addInitScript(() => {
    (window as unknown as { __GUGU_E2E_QUESTION__: unknown }).__GUGU_E2E_QUESTION__ = { factId: '7x8', type: 'product' };
  });
  // 단계를 보통(7초)으로 고정한다: 강함·강력(5초)이면 쓰러짐 글이 보이는 때가 달라진다
  await standBesideGrass(page, { timer: true, c034: { hp: 10 }, tier: 'normal' });
  await stepIntoGrass(page);
  await expect(page.locator('.wild__bubble')).toHaveAttribute('data-fact', '7x8');
  await expect(page.getByRole('timer')).toBeVisible();
  // 필드로 돌아갈 때의 불러오기 화면은 아주 잠깐이라 화면 바뀜을 지켜 기록해 둔다
  await page.evaluate(() => {
    const w = window as unknown as { __loadingSeen: string[] };
    w.__loadingSeen = [];
    new MutationObserver(() => {
      const el = document.querySelector('[aria-label="불러오는 중"]');
      if (el) w.__loadingSeen.push(el.textContent ?? '');
    }).observe(document.body, { childList: true, subtree: true, characterData: true });
  });
  // 정해진 시간만큼 자지 않고 쓰러짐 글이 뜨기를 기다린다 (7초 + 공격 연출)
  await expect(page.getByRole('status').filter({ hasText: '쓰러졌다' })).toBeVisible({ timeout: 10000 });
  await expect(page).toHaveURL(/#\/field$/, { timeout: 5000 });
  await expect(page.getByTestId('field-canvas')).toHaveAttribute('data-pos', '10,40'); // 태초마을 시작 칸
  const seen = await page.evaluate(() => (window as unknown as { __loadingSeen: string[] }).__loadingSeen);
  expect(seen.some((t) => t.includes('태초마을'))).toBe(true);
  await expect(page.getByRole('dialog', { name: '쓰러짐 알림' })).toContainText('쓰러졌어…');
  // 대신 다닐 건강한 구구몬이 없으면 동행은 그대로, 알림은 예전 글
  await expect(page.getByRole('dialog', { name: '쓰러짐 알림' })).toContainText('구구몬이 쓰러졌어요. 상점에서 회복시켜요');
  await expect(page.getByRole('dialog', { name: '쓰러짐 알림' })).not.toContainText('대신 함께 다녀요');
  const field = await page.evaluate(() => JSON.parse(localStorage.getItem('catch-gugumon:save')!).state.field);
  expect(field.position.map).toBe('town');
  expect(field.companion).toBe('c034');
  expect(field.species.c034.hp).toBe(0);
  expect(field.species.c034.wounds[0]).toEqual({ factId: '7x8', type: 'product' });
});

test('쓰러지면 도감의 건강한 다른 구구몬이 대신 함께 다닌다 (알림·저장본·도감·마을)', async ({ page }) => {
  await page.addInitScript(() => {
    (window as unknown as { __GUGU_E2E_QUESTION__: unknown }).__GUGU_E2E_QUESTION__ = { factId: '7x8', type: 'product' };
  });
  // 물거북몬(Lv4, 건강)이 대신 다닐 후보. 블루베리곰몬(Lv9)은 쓰러져 있어 후보가 아니다. 단계는 보통(7초)으로 고정
  await standBesideGrass(page, {
    timer: true,
    tier: 'normal',
    c034: { hp: 10 },
    others: {
      c036: { level: 4, exp: 0, stage: 1, caught: 1, firstCaughtAt: 2 },
      c031: { level: 9, exp: 0, stage: 1, caught: 1, firstCaughtAt: 3, hp: 0 },
    },
  });
  await stepIntoGrass(page);
  await expect(page.locator('.wild__bubble')).toHaveAttribute('data-fact', '7x8');
  // 시간이 다 되어 맞고 쓰러지기를 기다린다 (자지 않고 글을 기다림)
  await expect(page.getByRole('status').filter({ hasText: '쓰러졌다' })).toBeVisible({ timeout: 10000 });
  await expect(page).toHaveURL(/#\/field$/, { timeout: 5000 });
  const canvas = page.getByTestId('field-canvas');
  await expect(canvas).toHaveAttribute('data-pos', '10,40');
  const notice = page.getByRole('dialog', { name: '쓰러짐 알림' });
  await expect(notice).toContainText('쓰러졌어…');
  await expect(notice).toContainText('물거북몬이 대신 함께 다녀요');
  const field = await page.evaluate(() => JSON.parse(localStorage.getItem('catch-gugumon:save')!).state.field);
  expect(field.companion).toBe('c036');
  expect(field.species.c034.hp).toBe(0);
  expect(field.position.map).toBe('town');
  // 마을: 쓰러진 꽃등짐몬은 돌아다니는 목록에 누워 있고, 물거북몬은 목록에서 빠져 주인공을 따라온다
  await expect(canvas).toHaveAttribute('data-roamers', /c034:/);
  await expect(canvas).not.toHaveAttribute('data-roamers', /c036:/);
  await expect(canvas).toHaveAttribute('data-sleeping', /c034/);
  await expect(canvas).toHaveAttribute('data-companion', 'c036');
  await notice.click();
  await expect(notice).toHaveCount(0);
  // 아래를 보고 서 있으므로 짧게 한 번은 오른쪽으로 돌기만 하고, 한 번 더 누르면 한 칸 걷는다
  await tap(page, 'ArrowRight');
  await tap(page, 'ArrowRight');
  await expect(canvas).toHaveAttribute('data-pos', '11,40');
  await expect.poll(() => companionPos(page)).toBe('10,40');
  // 도감: 물거북몬이 "함께 다니는 중", 쓰러진 꽃등짐몬은 함께 다니기 버튼이 꺼져 있다
  await page.goto('/#/field/dex');
  await expect(page.locator('.fdex__cell--caught').filter({ hasText: '함께 다니는 중' })).toContainText('물거북몬');
  await page.getByRole('button', { name: '꽃등짐몬 잡음' }).click(); // c034의 이름
  await expect(page.getByRole('button', { name: /함께 다니기/ })).toBeDisabled();
});

test('쓰러진 동행이면 풀숲에서 만나지 않고 "구구몬이 쓰러졌어요" 알림이 보인다', async ({ page }) => {
  await standBesideGrass(page, { c034: { hp: 0 } });
  await expect(page.getByRole('status').filter({ hasText: '구구몬이 쓰러졌어요' })).toBeVisible();
  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(120);
  await page.keyboard.up('ArrowRight');
  await expect(page.getByTestId('field-canvas')).toHaveAttribute('data-pos', '6,8');
  await page.waitForTimeout(1200);
  await expect(page).toHaveURL(/#\/field$/);
  await expect(page.getByText('구구몬이 쓰러졌어요. 상점에서 회복시켜요')).toBeVisible();
});

test('전투 중 맞고 새로고침하면 필드로 돌아오고, 체력은 줄어 있다', async ({ page }) => {
  await standBesideGrass(page);
  await stepIntoGrass(page);
  await page.getByRole('button', { name: '싸우자!' }).click();
  const answer = await solveWild(page);
  await wrongMoveButton(page, answer).click();
  await expect(page.getByLabel(/^내 체력 (90|87|83|75)$/)).toBeVisible();
  await page.reload();
  await expect(page).toHaveURL(/#\/field$/);
  await expect(page.getByTestId('field-canvas')).toHaveAttribute('data-pos', /\d+,\d+/);
  expect((await savedCloud(page)).hp).toBeLessThan(100);
});

test('도망 확인창을 6초 열어 둬도 시간이 흐르지 않아 맞지 않는다', async ({ page }) => {
  await standBesideGrass(page, { timer: true, tier: 'normal' }); // 시간 상한(7초)을 정해 둔다
  await stepIntoGrass(page);
  await page.getByRole('button', { name: '싸우자!' }).click();
  await expect(page.locator('.wild__bubble .question')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: '도망치기' })).toBeVisible();
  await page.waitForTimeout(6000);
  await page.getByRole('button', { name: '계속 싸우기' }).click();
  const label = (await page.getByRole('timer').getAttribute('aria-label')) ?? '';
  expect(Number(label.replace(/\D/g, ''))).toBeGreaterThanOrEqual(3);
  await expect(page.getByLabel('내 체력 100')).toBeVisible();
  await expect(page.getByRole('status')).not.toContainText(/시간이 지났어|의 .+!/);
});

test('강력한 야생은 이름 앞에 단계 말이 붙고 이름 카드에 색 테두리', async ({ page }) => {
  await standBesideGrass(page, { tier: 'mighty' });
  await stepIntoGrass(page);
  await expect(page.locator('.wild__card')).toHaveClass(/wild__card--mighty/);
  await expect(page.locator('.wild__name')).toHaveText(/^강력한 \S+ Lv\d+$/);
});

test('도망치기로 끝내고 돌아오면 바로 다음 풀숲 걸음에는 만나지 않는다', async ({ page }) => {
  await standBesideGrass(page);
  await stepIntoGrass(page);
  await page.getByRole('button', { name: '도망치기' }).click();
  await page.getByRole('dialog', { name: '도망치기' }).getByRole('button', { name: '도망갈래' }).click();
  await expect(page.getByText('무사히 도망쳤다!')).toBeVisible();
  await expect(page).toHaveURL(/#\/field$/);
  await expect(page.getByTestId('field-canvas')).toHaveAttribute('data-pos', '6,8');
  // 풀숲 (7,8)으로 한 걸음: 안전 걸음이라 만나지 않는다
  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(120);
  await page.keyboard.up('ArrowRight');
  await expect(page.getByTestId('field-canvas')).toHaveAttribute('data-pos', '7,8');
  await page.waitForTimeout(1200);
  await expect(page).toHaveURL(/#\/field$/);
});

test('처음 필드는 첫 구구몬 고르기로 가고, 물거북몬을 골라 풀숲에서 잡으면 도감에 색으로 남는다', async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as unknown as { __GUGU_E2E_FIELD__: boolean; __GUGU_E2E_NO_TIMER__: boolean };
    w.__GUGU_E2E_FIELD__ = true;
    w.__GUGU_E2E_NO_TIMER__ = true;
  });
  await page.goto('/#/field');
  await expect(page).toHaveURL(/#\/field\/starter$/);
  await page.getByRole('button', { name: '물거북몬 고르기' }).click();
  await expect(page).toHaveURL(/#\/field$/);
  await expect(page.getByTestId('field-canvas')).toHaveAttribute('data-pos', /\d+,\d+/);

  // 풀숲 바로 옆으로 자리를 옮긴다 — 물거북몬은 초원 종이라, 같은 종을 만나지 않게 물가 풀숲에서
  await page.evaluate(() => {
    const raw = JSON.parse(localStorage.getItem('catch-gugumon:save')!);
    raw.state.field.position = { map: 'waterside', x: 4, y: 9, facing: 'right' };
    localStorage.setItem('catch-gugumon:save', JSON.stringify(raw));
  });
  await page.reload();
  await expect(page.getByTestId('field-canvas')).toHaveAttribute('data-pos', '4,9');
  await stepIntoGrass(page);
  // "약한 ○○ Lv3"처럼 단계 말이 앞에 붙는다
  const wildName = ((await page.locator('.wild__name').textContent()) ?? '')
    .replace(/\s*Lv\d+\s*$/, '')
    .replace(/^(약한|강한|강력한)\s+/, '')
    .trim();

  // 물거북몬 주①(물)은 풀 상대로 1칸이라 ("빠르면 +1칸"은 없어짐) 강력(12칸)까지 넉넉히
  for (let i = 0; i < 14; i++) {
    if (await page.getByRole('button', { name: '캡슐 던지기' }).isVisible()) break;
    const answer = await solveWild(page);
    await moveButton(page, answer).click();
    await page.waitForTimeout(800);
  }
  await page.getByRole('button', { name: '캡슐 던지기' }).click();
  await expect(page.getByText(/잡았다!/)).toBeVisible({ timeout: 5000 });
  await expect(page.getByText(/Lv1로 도감에 들어갔어요/)).toBeVisible();
  await expect(page).toHaveURL(/#\/field$/, { timeout: 5000 });

  await page.getByRole('button', { name: '메뉴' }).click();
  await page.getByRole('button', { name: '구구몬 도감' }).click();
  await expect(page).toHaveURL(/#\/field\/dex$/);
  await expect(page.getByLabel(`${wildName} 잡음`)).toBeVisible();
  // 야생 레벨과 상관없이 Lv1로 수록
  await expect(page.getByLabel(`${wildName} 잡음`)).toContainText('Lv1');
  await expect(page.getByLabel('물거북몬 잡음')).toBeVisible();
  await expect(page.locator('.fdex__cell--caught')).toHaveCount(2);
  await expect(page.locator('.fdex__cell--unknown')).toHaveCount(46);
  // 별점수는 꺼져 있어 발견·포획으로 쌓이지 않는다
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('catch-gugumon:save')!).state.field.starPoints)).toBe(0);

  // 잡은 구구몬을 동행으로
  await page.getByLabel(`${wildName} 잡음`).click();
  await page.getByRole('button', { name: '함께 다니기' }).click();
  await expect(page.getByLabel(`${wildName} 잡음`).getByText('함께 다니는 중')).toBeVisible();
});

// ── 필드 사이 이동 ──

/** 이미 첫 구구몬을 고른 저장본에서 원하는 필드·자리로 옮겨 서게 한다 */
async function standAt(page: Page, map: string, x: number, y: number, facing: string) {
  await seedStarter(page);
  await page.goto('/#/field');
  await expect(page.getByTestId('field-canvas')).toHaveAttribute('data-pos', /\d+,\d+/);
  await page.evaluate(
    ([starter, position]) => {
      localStorage.clear();
      localStorage.setItem('catch-gugumon:save', JSON.stringify({ version: 1, state: { field: { ...(starter as object), position } } }));
    },
    [STARTER_FIELD, { map, x, y, facing }] as const,
  );
  await page.reload();
  await expect(page.getByTestId('field-canvas')).toHaveAttribute('data-pos', `${x},${y}`);
}

async function tap(page: Page, key: string, ms = 120) {
  await page.keyboard.down(key);
  await page.waitForTimeout(ms);
  await page.keyboard.up(key);
}

test('초원 왼쪽 출구로 나가면 불러오기 화면 뒤 물가 입구에 서고, 새로고침해도 물가', async ({ page }) => {
  await standAt(page, 'meadow', 1, 10, 'left');
  await tap(page, 'ArrowLeft');
  await expect(page.getByRole('status', { name: '불러오는 중' })).toContainText('물가 · 3·6·9단');
  await expect(page.getByTestId('field-canvas')).toHaveAttribute('data-pos', '18,10');
  await page.reload();
  await expect(page.getByTestId('field-canvas')).toHaveAttribute('data-pos', '18,10');
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('catch-gugumon:save')!).state.field.position.map);
  expect(saved).toBe('waterside');
});

test('물가 오른쪽 출구로 나가면 초원 왼쪽 입구로 돌아온다', async ({ page }) => {
  await standAt(page, 'waterside', 18, 10, 'right');
  await tap(page, 'ArrowRight');
  await expect(page.getByTestId('field-canvas')).toHaveAttribute('data-pos', '1,10');
});

test('초원 오른쪽 출구로 나가면 사막 (5·7단)', async ({ page }) => {
  await standAt(page, 'meadow', 18, 10, 'right');
  await tap(page, 'ArrowRight');
  await expect(page.getByRole('status', { name: '불러오는 중' })).toContainText('사막 · 5·7단');
  await expect(page.getByTestId('field-canvas')).toHaveAttribute('data-pos', '1,10');
});

test('처음 필드는 첫 구구몬 고르기로 가고, 고르면 태초마을 @에서 시작한다', async ({ page }) => {
  await page.goto('/#/field');
  await expect(page).toHaveURL(/#\/field\/starter$/);
  await page.getByRole('button', { name: '물거북몬 고르기' }).click();
  await expect(page).toHaveURL(/#\/field$/);
  await expect(page.getByTestId('field-canvas')).toHaveAttribute('data-pos', '10,40');
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('catch-gugumon:save')!).state.field);
  expect(saved.position).toEqual({ map: 'town', x: 10, y: 40, facing: 'down' });
  // 스타터는 기술 1개(슬롯 1)로 시작한다
  expect(saved.species.c036.skills).toEqual(['c036-1']);
});

// ── 상점 팝업 ──

// 저장본 자리는 옛 마을(상점 문 8,24 · 앞 8,25)로 적고, 마을 위쪽 구역(체육관 건물) 줄(TOWN_ROWS_ADDED=9)만큼 저절로 밀린다
/** 마을 상점 문(8,33) 바로 아래 (8,34)에서 위를 보고 선 저장본. extra로 필드 저장을 덧붙인다 */
async function standAtShopDoor(page: Page, extra: { species?: Record<string, unknown>; field?: Record<string, unknown> } = {}) {
  await seedStarter(page);
  await page.goto('/#/field');
  await expect(page.getByTestId('field-canvas')).toHaveAttribute('data-pos', /\d+,\d+/);
  await page.evaluate(
    ([starter, ex]) => {
      localStorage.clear();
      const s = starter as typeof STARTER_FIELD;
      const e = ex as { species?: Record<string, unknown>; field?: Record<string, unknown> };
      const field = { ...s, species: e.species ?? s.species, position: { map: 'town', x: 8, y: 25, facing: 'up' }, ...(e.field ?? {}) };
      localStorage.setItem('catch-gugumon:save', JSON.stringify({ version: 1, state: { field } }));
    },
    [STARTER_FIELD, extra] as const,
  );
  await page.reload();
  await expect(page.getByTestId('field-canvas')).toHaveAttribute('data-pos', '8,34');
}

async function openShop(page: Page) {
  await page.keyboard.down('ArrowUp'); // 문(8,33)
  await expect(page.getByRole('dialog', { name: '상점' })).toBeVisible();
  await page.keyboard.up('ArrowUp');
}

async function savedFact(page: Page, id: string): Promise<{ box: number; dueAt: number | null }> {
  return page.evaluate((f) => JSON.parse(localStorage.getItem('catch-gugumon:save')!).state.learning.facts[f], id);
}

async function savedField(page: Page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem('catch-gugumon:save')!).state.field);
}

/** 연습 문제의 답 (a × b = ?) */
async function practiceAnswer(page: Page): Promise<number> {
  const q = page.getByRole('dialog', { name: '상점' }).locator('.practice__q .question');
  await expect(q).toBeVisible();
  const parts = (await q.locator('> *').allTextContents()).map((t) => t.trim());
  const [a, , b, , r] = parts;
  if (r === '?') return Number(a) * Number(b);
  if (a === '?') return Number(r) / Number(b);
  return Number(r) / Number(a);
}

/** 연습 보기: 숫자로 찾는다 (보기는 눌릴 때까지 자동으로 기다린다) */
function choice(page: Page, n: number) {
  return page.getByRole('dialog', { name: '상점' }).locator('.fshop-choice').filter({ hasText: new RegExp(`^${n}$`) });
}

async function wrongChoice(page: Page, answer: number) {
  const texts = await page.getByRole('dialog', { name: '상점' }).locator('.fshop-choice').allTextContents();
  return Number(texts.find((t) => Number(t) !== answer));
}

async function solveShop(page: Page) {
  const answer = await practiceAnswer(page);
  await choice(page, answer).click();
}

test('마을 문에 부딪히면 상점 팝업이 뜨고, 캡슐 탭에 네 줄이 있다 (13단이 잠겨 있으면 황금 캡슐은 못 얻음)', async ({ page }) => {
  await standAtShopDoor(page);
  await openShop(page);
  const shop = page.getByRole('dialog', { name: '상점' });
  await expect(shop.getByText('초원 캡슐')).toBeVisible();
  await expect(shop.getByText('물가 캡슐')).toBeVisible();
  await expect(shop.getByText('사막 캡슐')).toBeVisible();
  await expect(shop.getByText('황금 캡슐', { exact: true })).toBeVisible();
  await expect(shop.getByRole('button', { name: '황금 캡슐 얻기' })).toBeDisabled();
  await expect(shop.getByText('13단 도전이 열리면 황금 캡슐을 얻을 수 있어요')).toBeVisible();
  await expect(shop.getByRole('button', { name: '초원 캡슐 얻기' })).toBeEnabled();
});

test('상점이 열려 있는 동안은 걷지 않고, 닫기·Escape로 닫으면 문 앞 칸 그대로', async ({ page }) => {
  await standAtShopDoor(page);
  await openShop(page);
  await page.keyboard.down('ArrowLeft');
  await page.waitForTimeout(400);
  await page.keyboard.up('ArrowLeft');
  await expect(page.getByTestId('field-canvas')).toHaveAttribute('data-pos', '8,34');
  await page.getByRole('dialog', { name: '상점' }).getByRole('button', { name: '닫기' }).click();
  await expect(page.getByRole('dialog', { name: '상점' })).toHaveCount(0);
  await expect(page.getByTestId('field-canvas')).toHaveAttribute('data-pos', '8,34');
  // 방향을 떼었다 다시 누르면 다시 열리고, Escape로도 닫힌다
  await openShop(page);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: '상점' })).toHaveCount(0);
  await expect(page.getByTestId('field-canvas')).toHaveAttribute('data-pos', '8,34');
});

/** 지금 문제의 사실 번호 (예: '4x7') */
async function practiceFact(page: Page): Promise<string> {
  const id = await page.getByRole('dialog', { name: '상점' }).locator('.practice').getAttribute('data-fact');
  return id!;
}

test('초원 캡슐 얻기: 단 선택 없이 바로 문제 (초원 단만), 틀리면 힌트 → 다음 카드 → 잠시 뒤 다시, 끝나면 캡슐 5개', async ({ page }) => {
  await standAtShopDoor(page);
  await openShop(page);
  const shop = page.getByRole('dialog', { name: '상점' });
  const before = await totalAttempts(page);
  const rewardBefore = await starsAndGrowth(page);
  await shop.getByRole('button', { name: '초원 캡슐 얻기' }).click();
  // 단 고르는 화면 없이 바로 첫 문제
  await expect(shop.getByRole('button', { name: /^\d+단$/ })).toHaveCount(0);
  await expect(shop.locator('.practice__q .question')).toBeVisible();
  await expect(shop.locator('.practice-head__title')).toHaveText('초원 캡슐 얻기 (1/9)');
  // 첫 문제: 일부러 틀린다
  const wrongFact = await practiceFact(page);
  const answer = await practiceAnswer(page);
  await choice(page, await wrongChoice(page, answer)).click();
  await expect(shop.locator('.fshop-choice--glow')).toHaveCount(1);
  await expect(shop.locator('.practice__hint')).toBeVisible();
  await shop.locator('.fshop-choice--glow').click();
  // 힌트를 닫으면 다음 카드 (번호 2, 길이는 10으로 늘어남)
  await expect(shop.locator('.practice__hint')).toHaveCount(0);
  await expect(shop.locator('.practice-head__title')).toHaveText('초원 캡슐 얻기 (2/10)');
  // 끝까지 풀며, 지역(초원 2·4·8단) 밖의 단이 안 나오고 틀린 문제가 다시 나오는지 본다
  let reappeared = 0;
  let solved = 0;
  while (!(await shop.getByText('초원 캡슐 5개를 받았어요!').isVisible())) {
    const id = await practiceFact(page);
    expect([2, 4, 8]).toContain(Number(id.split('x')[0]));
    if (id === wrongFact) reappeared++;
    await solveShop(page);
    solved++;
    expect(solved).toBeLessThan(30);
  }
  expect(reappeared).toBeGreaterThanOrEqual(1);
  expect(solved).toBe(9); // 처음 틀린 1장 빼고 9장을 맞혔다
  expect((await savedField(page)).capsules.meadow).toBe(8);
  expect(await totalAttempts(page)).toBe(before + 10);
  // 상점 연습은 별도 성장 점수도 주지 않는다
  expect(await starsAndGrowth(page)).toEqual(rewardBefore);
  // 틀렸다가 다시 맞힌 사실은 지금 복습 대상
  expect((await savedFact(page, wrongFact)).dueAt!).toBeLessThanOrEqual(Date.now());
  await shop.getByRole('button', { name: '확인' }).click();
  await expect(shop.getByLabel('초원 캡슐 8개')).toBeVisible();
  expect((await savedField(page)).capsules.meadow).toBe(8);
});

test('연습 도중에 나가면 캡슐은 그대로 (그만하기·Escape)', async ({ page }) => {
  await standAtShopDoor(page);
  await openShop(page);
  const shop = page.getByRole('dialog', { name: '상점' });
  await shop.getByRole('button', { name: '초원 캡슐 얻기' }).click();
  await solveShop(page);
  await solveShop(page);
  await shop.getByRole('button', { name: '그만하기' }).click();
  await expect(shop.getByText('초원 캡슐')).toBeVisible();
  expect((await savedField(page)).capsules.meadow).toBe(3);
  // Escape는 연습만 그만두고 상점은 그대로
  await shop.getByRole('button', { name: '초원 캡슐 얻기' }).click();
  await solveShop(page);
  await page.keyboard.press('Escape');
  await expect(shop).toBeVisible();
  await expect(shop.getByText('초원 캡슐')).toBeVisible();
  expect((await savedField(page)).capsules.meadow).toBe(3);
});

test('회복약: 쓰러진 구구몬을 틀린 문제(없으면 필드 문제) 5개씩 3바퀴로 회복한다', async ({ page }) => {
  await standAtShopDoor(page, {
    species: { c034: { ...STARTER_FIELD.species.c034, hp: 0, wounds: [{ factId: '7x8', type: 'product' }] } },
  });
  await openShop(page);
  const shop = page.getByRole('dialog', { name: '상점' });
  await shop.getByRole('tab', { name: '회복약' }).click();
  await expect(shop.getByText('쓰러짐')).toBeVisible();
  await shop.getByRole('button', { name: /고치기/ }).click();
  // 틀린 기록이 없으니 초원 단에서 5문제 × 3바퀴 = 15번 맞힌다
  for (let i = 0; i < 15; i++) {
    await expect(shop.locator('.practice-head__title')).toContainText(`${Math.floor(i / 5) + 1}`);
    await solveShop(page);
  }
  await expect(shop.getByText(/다 나았어요/)).toBeVisible();
  const c034 = await savedCloud(page);
  expect(c034.hp).toBe(100);
  expect(c034.wounds).toEqual([]);
  await shop.getByRole('button', { name: '확인' }).click();
  await expect(shop.getByText('모두 건강해요!')).toBeVisible();
  await shop.getByRole('button', { name: '닫기' }).click();
  await expect(page.getByRole('dialog', { name: '상점' })).toHaveCount(0);
});

test('회복약: 틀리면 힌트를 보고 넘어가고 그 문제를 다시, 틀린 답도 학습 기록에 남는다', async ({ page }) => {
  await standAtShopDoor(page, {
    species: { c034: { ...STARTER_FIELD.species.c034, hp: 40, wounds: [{ factId: '7x8', type: 'product' }] } },
  });
  await openShop(page);
  const shop = page.getByRole('dialog', { name: '상점' });
  await shop.getByRole('tab', { name: '회복약' }).click();
  await shop.getByRole('button', { name: /고치기/ }).click();
  const before = await totalAttempts(page);
  await choice(page, await wrongChoice(page, await practiceAnswer(page))).click();
  await expect(shop.locator('.fshop-choice--glow')).toHaveCount(1);
  await shop.locator('.fshop-choice--glow').click();
  await solveShop(page);
  expect(await totalAttempts(page)).toBe(before + 2);
  expect((await savedCloud(page)).hp).toBe(40); // 아직 안 나음 (다 맞혀야)
});

test('회복약: 쓰러진 마을 구구몬은 회복하고 상점을 닫으면 일어난다', async ({ page }) => {
  await seedStarter(page);
  await page.goto('/#/field');
  await expect(page.getByTestId('field-canvas')).toHaveAttribute('data-pos', /\d+,\d+/);
  await page.evaluate((starter) => {
    localStorage.clear();
    const field = {
      ...starter,
      species: { ...starter.species, c036: { level: 3, exp: 0, stage: 1, caught: 1, firstCaughtAt: 1, hp: 0, wounds: [] } },
      seen: ['c034', 'c036'],
      position: { map: 'town', x: 8, y: 25, facing: 'up' },
    };
    localStorage.setItem('catch-gugumon:save', JSON.stringify({ version: 1, state: { field } }));
  }, STARTER_FIELD);
  await page.reload();
  const canvas = page.getByTestId('field-canvas');
  await expect(canvas).toHaveAttribute('data-sleeping', 'c036');
  await openShop(page);
  const shop = page.getByRole('dialog', { name: '상점' });
  await shop.getByRole('tab', { name: '회복약' }).click();
  await shop.getByRole('button', { name: /고치기/ }).click(); // 상처가 없어도 물가 단 문제를 풀어서 낫는다
  for (let i = 0; i < 15; i++) await solveShop(page);
  await expect(shop.getByText(/다 나았어요/)).toBeVisible();
  await shop.getByRole('button', { name: '확인' }).click();
  await shop.getByRole('button', { name: '닫기' }).click();
  await expect(canvas).toHaveAttribute('data-sleeping', '');
});

test('초원 위 출구로 나가면 태초마을 아래 출구 위 칸, 마을 아래 출구로 나가면 초원 위 출구 아래 칸', async ({ page }) => {
  await standAt(page, 'meadow', 7, 1, 'up');
  await tap(page, 'ArrowUp');
  await expect(page.getByRole('status', { name: '불러오는 중' })).toContainText('태초마을');
  await expect(page.getByTestId('field-canvas')).toHaveAttribute('data-pos', `9,${38 + R}`);
  await page.reload();
  await expect(page.getByTestId('field-canvas')).toHaveAttribute('data-pos', `9,${38 + R}`);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('catch-gugumon:save')!).state.field.position.map)).toBe('town');

  await tap(page, 'ArrowDown', 400); // 도착하면 위를 보고 있어서 돌아선 뒤 걷는다
  await expect(page.getByRole('status', { name: '불러오는 중' })).toContainText('초원');
  await expect(page.getByTestId('field-canvas')).toHaveAttribute('data-pos', '7,1');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('catch-gugumon:save')!).state.field.position.map)).toBe('meadow');
});

test('물가 풀숲에서 만난 구구몬은 물가 13종(020~032) 중 하나', async ({ page }) => {
  await page.addInitScript(() => {
    (window as unknown as { __GUGU_E2E_FIELD__: boolean }).__GUGU_E2E_FIELD__ = true;
  });
  await standAt(page, 'waterside', 4, 9, 'right');
  await tap(page, 'ArrowRight');
  await expect(page).toHaveURL(/#\/field\/battle$/);
  const species = await page.locator('.wild__stage').getAttribute('data-species');
  expect(['c020', 'c021', 'c022', 'c023', 'c024', 'c025', 'c026', 'c027', 'c028', 'c029', 'c030', 'c031', 'c032']).toContain(species);
});

// ── 레전드 전투 ──

/** 12·13단이 열린 저장본으로 풀숲 바로 옆에 서서(만남 100%, 레전드 강제) 한 걸음 */
async function standBesideGrassWith(page: Page, unlocked: boolean) {
  await page.addInitScript(() => {
    const w = window as unknown as { __GUGU_E2E_FIELD__: boolean; __GUGU_E2E_LEGEND__: boolean; __GUGU_E2E_NO_TIMER__: boolean };
    w.__GUGU_E2E_FIELD__ = true;
    w.__GUGU_E2E_LEGEND__ = true;
    w.__GUGU_E2E_NO_TIMER__ = true;
  });
  await seedStarter(page);
  await page.goto('/#/field');
  await expect(page.getByTestId('field-canvas')).toHaveAttribute('data-pos', /\d+,\d+/);
  await page.evaluate(
    ([starter, open]) => {
      localStorage.clear();
      const learning = open ? { challengeUnlocked: true, challengeUnlockedBy: 'admin' } : {};
      localStorage.setItem(
        'catch-gugumon:save',
        JSON.stringify({
          version: 1,
          state: { field: { ...(starter as object), position: { map: 'meadow', x: 5, y: 8, facing: 'right' } }, learning },
        }),
      );
    },
    [STARTER_FIELD, unlocked] as const,
  );
  await page.reload();
  await expect(page.getByTestId('field-canvas')).toHaveAttribute('data-pos', '5,8');
}

test('12·13단이 열렸으면 레전드가 나타나 13단 문제를 낸다', async ({ page }) => {
  // 강력(+1)과 상성(+1)이 겹치면 두 번 만에 어지러워져 세 번째 문제가 없다 → 늘 "늦게"로 고정해 문제 3개를 본다
  await page.addInitScript(() => {
    (window as unknown as { __GUGU_E2E_FAST__: boolean }).__GUGU_E2E_FAST__ = false;
  });
  await standBesideGrassWith(page, true);
  await stepIntoGrass(page);
  await expect(page.getByRole('status').filter({ hasText: /^전설의 .*나타났다!$/ })).toBeVisible();
  await expect(page.locator('.wild__stage')).toHaveAttribute('data-species', LEGEND_ID);
  await expect(page.locator('.wild__stage')).toHaveClass(/wild__stage--legend/);
  await expect(page.locator('.wild__bubble')).toBeVisible();
  for (let i = 0; i < 3; i++) {
    await expect(page.locator('.wild__bubble')).toHaveAttribute('data-fact', /^13x\d+$/);
    const answer = await solveWild(page);
    await moveButton(page, answer).click();
    await page.waitForTimeout(800);
  }
});

test('황금 캡슐이 0개여도 레전드를 만나고, 어지러워지면 캡슐이 없어 돌려보낸다', async ({ page }) => {
  // 상성이 약하면 한 번에 1칸이라 8번 맞혀야 하고, 그 사이 주기 공격(34) 3번에 쓰러진다 → 크리티컬로 싸움을 짧게
  await forceCombat(page, { crit: true, dodge: false, effect: true });
  await standBesideGrassWith(page, true);
  await expect(page.getByRole('group', { name: '필드 정보' }).getByLabel('황금 캡슐 0개')).toBeVisible();
  await stepIntoGrass(page);
  await expect(page.locator('.wild__stage')).toHaveAttribute('data-species', LEGEND_ID);
  await answerUntilDizzy(page);
  await expect(page.getByRole('status')).toHaveText('캡슐이 없어서 돌려보냈어! 상점에서 캡슐을 구해 오자');
  await expect(page.getByRole('button', { name: '캡슐 던지기' })).toHaveCount(0);
  await expect(page).toHaveURL(/#\/field$/, { timeout: 5000 });
  const field = await page.evaluate(() => JSON.parse(localStorage.getItem('catch-gugumon:save')!).state.field);
  expect(field.capsules.legend).toBe(0);
  expect(Object.keys(field.species).some((id) => id.startsWith('legend-'))).toBe(false);
  expect(field.stats).toMatchObject({ battles: 1, catches: 0, fled: 1 });
});

test('13단이 잠긴 저장본에서는 레전드 스위치가 있어도 보통 만남', async ({ page }) => {
  await standBesideGrassWith(page, false);
  await stepIntoGrass(page);
  await expect(page.locator('.wild__stage')).not.toHaveAttribute('data-species', LEGEND_ID);
  await expect(page.getByText(/전설의/)).toHaveCount(0);
});

// ── 성장과 동행 ──

async function companionPos(page: Page) {
  return page.getByTestId('field-canvas').getAttribute('data-companion-pos');
}

test('동행이 주인공이 방금 떠난 칸을 따라온다', async ({ page }) => {
  await standAt(page, 'meadow', 5, 8, 'right');
  await expect.poll(() => companionPos(page)).toBe('4,8'); // 처음에는 바로 뒤 칸
  await tap(page, 'ArrowRight');
  await expect(page.getByTestId('field-canvas')).toHaveAttribute('data-pos', '6,8');
  await expect.poll(() => companionPos(page)).toBe('5,8');
  await tap(page, 'ArrowUp', 200);
  await expect(page.getByTestId('field-canvas')).toHaveAttribute('data-pos', '6,7');
  await expect.poll(() => companionPos(page)).toBe('6,8');
});

test('주인공(치비 017 또는 픽셀)과 동행이 걸을 때만 걷기, 멈추면 가만히', async ({ page }) => {
  await standAt(page, 'meadow', 5, 8, 'right');
  const canvas = page.getByTestId('field-canvas');
  await expect(canvas).toHaveAttribute('data-companion', 'c034');
  await page.waitForTimeout(800); // 시트 그림을 읽는 동안은 still·pixel이라 읽은 뒤에 정한다
  // 치비 그림이 없으면(배포본) 픽셀 주인공·정지 그림 동행
  const heroSheet = (await canvas.getAttribute('data-hero-anim')) === 'idle';
  const compSheet = (await canvas.getAttribute('data-companion-anim')) === 'idle';
  if (!heroSheet) await expect(canvas).toHaveAttribute('data-hero-anim', 'pixel');
  if (!compSheet) await expect(canvas).toHaveAttribute('data-companion-anim', 'still');
  await page.keyboard.down('ArrowRight');
  if (heroSheet) await expect(canvas).toHaveAttribute('data-hero-anim', 'walk');
  if (compSheet) await expect(canvas).toHaveAttribute('data-companion-anim', 'walk');
  await expect(canvas).toHaveAttribute('data-pos', /^(6|7|8),8$/);
  await page.keyboard.up('ArrowRight');
  await expect(canvas).toHaveAttribute('data-hero-anim', heroSheet ? 'idle' : 'pixel');
  await expect(canvas).toHaveAttribute('data-companion-anim', compSheet ? 'idle' : 'still');
});

test('전투를 마치면 필드에서 "레벨이 올랐어!" 알림이 뜨고, 도감에 새 레벨이 남는다', async ({ page }) => {
  await page.addInitScript(() => {
    (window as unknown as { __GUGU_E2E_FIELD__: boolean }).__GUGU_E2E_FIELD__ = true;
  });
  await seedStarter(page);
  await page.goto('/#/field');
  await expect(page.getByTestId('field-canvas')).toHaveAttribute('data-pos', /\d+,\d+/);
  await page.evaluate((starter) => {
    localStorage.clear();
    // 꽃등짐몬 Lv5, 다음 레벨까지 5 모자란 상태 (전투 참여 +10이면 Lv6)
    const field = {
      ...starter,
      species: { c034: { level: 5, exp: 65, stage: 1, caught: 1, firstCaughtAt: 1 } },
      position: { map: 'meadow', x: 5, y: 8, facing: 'right' },
    };
    localStorage.setItem('catch-gugumon:save', JSON.stringify({ version: 1, state: { field } }));
  }, STARTER_FIELD);
  await page.reload();
  await expect(page.getByTestId('field-canvas')).toHaveAttribute('data-pos', '5,8');
  await stepIntoGrass(page);
  await page.getByRole('button', { name: '도망치기' }).click();
  await page.getByRole('dialog', { name: '도망치기' }).getByRole('button', { name: '도망갈래' }).click();
  await expect(page).toHaveURL(/#\/field$/, { timeout: 5000 });
  const notice = page.getByRole('dialog', { name: '성장 알림' });
  await expect(notice).toContainText('레벨이 올랐어!');
  await expect(notice).toContainText('Lv6');
  await notice.click();
  await expect(notice).toHaveCount(0);

  await page.getByRole('button', { name: '메뉴' }).click();
  await page.getByRole('button', { name: '구구몬 도감' }).click();
  await expect(page.getByLabel('꽃등짐몬 잡음')).toContainText('Lv6');
});

// ── 기술 배우기·복사 ──

async function savedSkills(page: Page): Promise<string[]> {
  return page.evaluate(() => JSON.parse(localStorage.getItem('catch-gugumon:save')!).state.field.species.c034.skills);
}

function copyOn(page: Page) {
  return page.addInitScript(() => {
    (window as unknown as { __GUGU_E2E_COPY__: boolean }).__GUGU_E2E_COPY__ = true;
  });
}

test('레벨이 올라 새 기술을 익히면 "새 기술을 배웠어!" 알림이 레벨업 다음에 뜬다 (기술 1개 → 2개)', async ({ page }) => {
  // 꽃등짐몬 Lv5, 기술 1개, 다음 레벨까지 5 모자람 (도망쳐도 참여 +10)
  await standBesideGrass(page, { c034: { exp: 65 } });
  await stepIntoGrass(page);
  await page.getByRole('button', { name: '도망치기' }).click();
  await page.getByRole('dialog', { name: '도망치기' }).getByRole('button', { name: '도망갈래' }).click();
  await expect(page).toHaveURL(/#\/field$/, { timeout: 5000 });
  const grow = page.getByRole('dialog', { name: '성장 알림' });
  await expect(grow).toContainText('Lv6');
  await grow.click();
  const skill = page.getByRole('dialog', { name: '기술 알림' });
  await expect(skill).toContainText('새 기술을 배웠어!');
  await expect(skill).toContainText('꽃등짐몬이 「덩굴 휘리릭」을 배웠어요!');
  await page.screenshot({ path: '.superpowers/sdd/2026-11-12-field-adventure-3/task-5-shots/learned-375.png' });
  await skill.click();
  await expect(skill).toHaveCount(0);
  expect(await savedSkills(page)).toEqual(['c034-1', 'c034-2']);
});

test('복사 스위치: 잡으면 기술이 5개 미만이라 바로 따라 배우고 알림이 뜬다', async ({ page }) => {
  await copyOn(page);
  // Lv8(★★, 진화 알림 없음)이라 약한 야생(Lv3~5)의 슬롯 2까지 후보가 된다 — 같은 꽃등짐몬이어도 후보가 있다
  await standBesideGrass(page, { tier: 'weak', c034: { level: 8, stage: 2, skills: ['c034-1'] } });
  await stepIntoGrass(page);
  await answerUntilDizzy(page);
  await page.getByRole('button', { name: '캡슐 던지기' }).click();
  await expect(page.getByText(/잡았다!/)).toBeVisible({ timeout: 5000 });
  await expect(page).toHaveURL(/#\/field$/, { timeout: 5000 });
  const skill = page.getByRole('dialog', { name: '기술 알림' });
  await expect(skill).toContainText('기술을 따라 배웠어!');
  await expect(skill).toContainText(/꽃등짐몬이 .+에게서 「.+」[을를] 따라 배웠어요!/);
  await page.screenshot({ path: '.superpowers/sdd/2026-11-12-field-adventure-3/task-5-shots/copied-375.png' });
  const skills = await savedSkills(page);
  expect(skills).toHaveLength(2);
  expect(skills[0]).toBe('c034-1');
  await expect(page.locator('section.fieldmode')).toHaveAttribute('data-skill-offers', '0');
});

test('복사 스위치: 그 자리(부속성)가 차 있으면 저장은 그대로, 제안이 대기열에 쌓인다 (돌려보내도)', async ({ page }) => {
  await copyOn(page);
  // 주속성 1·2·3번과 특수를 다 가졌고 부속성 자리는 복사한 c036-1 → 초원 야생(꽃등짐몬·버섯몬·왕관몬) 무엇이 나와도 첫 후보는 부속성 자리
  const five = ['c034-1', 'c034-2', 'c034-5', 'c034-3', 'c036-1'];
  await standBesideGrass(page, {
    tier: 'weak',
    c034: { level: 20, stage: 3, skills: five },
    capsules: { meadow: 0, waterside: 3, desert: 3, legend: 0 },
  });
  await stepIntoGrass(page);
  await answerUntilDizzy(page);
  await expect(page.getByRole('status')).toHaveText(/캡슐이 없어서 돌려보냈어/);
  await expect(page).toHaveURL(/#\/field$/, { timeout: 5000 });
  await expect(page.locator('section.fieldmode')).toHaveAttribute('data-skill-offers', '1');
  await expect(page.getByRole('dialog', { name: '기술 알림' })).toHaveCount(0);
  expect(await savedSkills(page)).toEqual(five);
  // 선택창: 잊을 기술은 그 자리(부속성)의 c036-1 하나뿐, 처음 포커스는 되돌릴 수 있는 "포기"
  const offer = page.getByRole('dialog', { name: '기술 선택창' });
  await expect(offer).toBeVisible();
  await expect(offer.locator('.skill-offer__forget')).toHaveCount(1);
  await expect(offer.locator('.skill-offer__forget')).toHaveAttribute('data-skill', 'c036-1');
  await expect(offer.getByRole('button', { name: '포기' })).toBeFocused();
  // Enter를 눌러도 기술을 잃지 않는다 (포기 = 제안만 사라짐)
  await page.screenshot({ path: `${shot12}/6-offer-dialog-375.png` });
  await offer.locator('.skill-offer__forget').click();
  await expect(offer).toHaveCount(0);
  const after = await savedSkills(page);
  expect(after.slice(0, 4)).toEqual(five.slice(0, 4));
  expect(after[4]).not.toBe('c036-1');
  expect(after).toHaveLength(5);
});

test('복사 선택창: Enter(처음 포커스)는 포기라 기술이 그대로', async ({ page }) => {
  await copyOn(page);
  const five = ['c034-1', 'c034-2', 'c034-5', 'c034-3', 'c036-1'];
  await standBesideGrass(page, {
    tier: 'weak',
    c034: { level: 20, stage: 3, skills: five },
    capsules: { meadow: 0, waterside: 3, desert: 3, legend: 0 },
  });
  await stepIntoGrass(page);
  await answerUntilDizzy(page);
  await expect(page).toHaveURL(/#\/field$/, { timeout: 5000 });
  const offer = page.getByRole('dialog', { name: '기술 선택창' });
  await expect(offer).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(offer).toHaveCount(0);
  expect(await savedSkills(page)).toEqual(five);
});

test('복사 스위치가 false(E2E 기본)면 잡아도 기술이 그대로', async ({ page }) => {
  await standBesideGrass(page, { tier: 'weak', c034: { level: 8, stage: 2, skills: ['c034-1'] } });
  await stepIntoGrass(page);
  await answerUntilDizzy(page);
  await page.getByRole('button', { name: '캡슐 던지기' }).click();
  await expect(page).toHaveURL(/#\/field$/, { timeout: 8000 });
  await expect(page.getByRole('dialog', { name: '기술 알림' })).toHaveCount(0);
  expect(await savedSkills(page)).toEqual(['c034-1']);
});

// ── 꾸미기 (375px 화면 배치) ──

/** 가장 긴 문제("13 × ? = 130"·"? × 13 = 130")를 강제로 띄운다 */
async function battleWithQuestion(page: Page, factId: string, type: string) {
  await page.addInitScript(
    ([f, t]) => {
      (window as unknown as { __GUGU_E2E_QUESTION__: unknown }).__GUGU_E2E_QUESTION__ = { factId: f, type: t };
    },
    [factId, type] as const,
  );
  await standBesideGrassWith(page, true);
  await stepIntoGrass(page);
  await page.getByRole('button', { name: '싸우자!' }).click();
  await expect(page.locator('.wild__bubble')).toHaveAttribute('data-fact', factId);
}

/** 두 상자가 겹치는지 */
function overlaps(a: { x: number; y: number; width: number; height: number }, b: { x: number; y: number; width: number; height: number }) {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

for (const vp of [
  { width: 375, height: 812 },
  { width: 360, height: 800 },
  { width: 320, height: 640 },
]) {
for (const [type, text] of [
  ['missingSecond', '13×?=130'],
  ['missingFirst', '?×10=130'], // 단(13)은 늘 앞자리라 "? × 13"은 나오지 않는다. 글자 수가 같은 가장 긴 꼴
] as const) {
  test(`가장 긴 문제 "${text}"도 ${vp.width}px에서 말풍선이 야생 구구몬과 겹치지 않고 한 줄에 들어간다`, async ({ page }) => {
    await page.setViewportSize(vp);
    await battleWithQuestion(page, '13x10', type);
    const q = page.locator('.wild__bubble .question');
    await expect(q).toHaveText(text.replace(/\s/g, ''), { useInnerText: false });
    const bubble = (await page.locator('.wild__bubble').boundingBox())!;
    // 야생 그림: 몬스터 SVG, 아니면 시트·정지 이미지(이 PC에 그림 파일이 있을 때) — 자리 상자
    const foeSvg = (await page.locator('.wild__foe svg, .wild__foe [data-sheet], .wild__foe img').first().boundingBox())!;
    const viewport = page.viewportSize()!;
    expect(overlaps({ ...bubble, width: bubble.width + 12 }, foeSvg)).toBe(false); // 꼬리(12px)까지
    expect(bubble.x).toBeGreaterThanOrEqual(0);
    expect(bubble.x + bubble.width).toBeLessThanOrEqual(viewport.width);
    // 넘치지 않는다 (글자가 말풍선 밖으로 나가거나 줄이 바뀌지 않음)
    const fits = await q.evaluate((el) => el.scrollWidth <= el.clientWidth + 1 && el.getBoundingClientRect().height < 60);
    expect(fits).toBe(true);
    await page.screenshot({ path: test.info().outputPath(`battle-longest-${vp.width}.png`) });
  });
}
}

test('도망 확인창을 열어 둔 시간은 답하는 데 걸린 시간에 들어가지 않는다', async ({ page }) => {
  await battleWithQuestion(page, '13x10', 'missingSecond');
  const answer = await solveWild(page);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.waitForTimeout(2500);
  await page.getByRole('button', { name: '계속 싸우기' }).click();
  await moveButton(page, answer).click();
  await expect
    .poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('catch-gugumon:save')!).state.learning.facts['13x10']?.avgMs ?? -1))
    .toBeGreaterThanOrEqual(0);
  const ms = await page.evaluate(() => JSON.parse(localStorage.getItem('catch-gugumon:save')!).state.learning.facts['13x10'].avgMs);
  expect(ms).toBeLessThan(1500);
});

test('정답 명중 연출 중에는 도망 버튼과 Esc가 막혀 확인창이 뜨지 않는다', async ({ page }) => {
  await battleWithQuestion(page, '13x10', 'missingSecond');
  const answer = await solveWild(page);
  await moveButton(page, answer).click();
  await expect(page.getByRole('button', { name: '도망치기' })).toBeDisabled({ timeout: 500 });
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: '도망치기' })).toHaveCount(0);
  // 연출이 끝나면 다시 눌린다
  await expect(page.getByRole('button', { name: '도망치기' })).toBeEnabled({ timeout: 3000 });
});

// ── 마을에서 돌아다니는 구구몬 ──

/** 물거북몬을 잡았고 동행은 꽃등짐몬인 저장본. Math.random은 pin이 켜져 있는 동안 0을 돌려줘 처음 자리를 정한다 */
async function seedTownRoam(page: Page, at: { x: number; y: number }, facing: string, extra: { c034?: Record<string, unknown> } = {}) {
  await page.addInitScript(
    ([position, c034]) => {
      if (!localStorage.getItem('catch-gugumon:save')) {
        const field = {
          starterChosen: true,
          companion: 'c034',
          species: {
            c034: { level: 5, exp: 0, stage: 1, caught: 1, firstCaughtAt: 1, ...(c034 as object) },
            c020: { level: 4, exp: 0, stage: 1, caught: 1, firstCaughtAt: 2 },
          },
          seen: ['c034', 'c020'],
          position,
        };
        localStorage.setItem('catch-gugumon:save', JSON.stringify({ version: 1, state: { field } }));
      }
      const w = window as unknown as { __pin: boolean };
      w.__pin = true;
      const real = Math.random;
      Math.random = () => (w.__pin ? 0 : real());
    },
    [{ map: 'town', ...at, facing }, extra.c034 ?? {}] as const,
  );
  await page.goto('/#/field');
  await expect(page.getByTestId('field-canvas')).toHaveAttribute('data-pos', `${at.x},${at.y + R}`); // 옛 저장 자리는 마을 위쪽 구역(체육관 건물) 줄(R)만큼 밀려 읽힌다
}

test('마을에서는 잡은 구구몬(동행 빼고)이 자기 서식지에서 돌아다닌다', async ({ page }) => {
  await seedTownRoam(page, { x: 10, y: 31 }, 'down');
  const canvas = page.getByTestId('field-canvas');
  await expect(canvas).toHaveAttribute('data-roamers', /^c020:\d+,\d+$/);
  await page.evaluate(() => ((window as unknown as { __pin: boolean }).__pin = false));
  const seen = new Set<string>();
  for (let i = 0; i < 12; i++) {
    const [, x, y] = ((await canvas.getAttribute('data-roamers')) ?? '').match(/^c020:(\d+),(\d+)$/)!.map(Number);
    seen.add(`${x},${y}`);
    // 물가 서식지(옛 지도 기준 + R): 연못(5~10, 8~9) 둘레 4~11 × 7~10
    expect(x >= 4 && x <= 11 && y >= 7 + R && y <= 10 + R).toBe(true);
    expect(x >= 5 && x <= 10 && y >= 8 + R && y <= 9 + R).toBe(false);
    await page.waitForTimeout(500);
  }
});

test('구구몬에게 부딪히면 말풍선이 뜬다 (이름·Lv·체력)', async ({ page }) => {
  await seedTownRoam(page, { x: 4, y: 6 }, 'down');
  const canvas = page.getByTestId('field-canvas');
  await expect(canvas).toHaveAttribute('data-roamers', `c020:4,${7 + R}`); // pin: 첫 서식지 칸
  await page.evaluate(() => ((window as unknown as { __pin: boolean }).__pin = false));
  await page.keyboard.down('ArrowDown'); // 이미 아래를 보고 있어 곧바로 부딪힌다
  const bubble = page.getByRole('dialog', { name: '구구몬 말풍선' });
  await expect(bubble).toContainText('복숭아곰몬');
  await expect(bubble).toContainText('Lv4');
  await expect(bubble).toContainText('체력 100');
  await page.keyboard.up('ArrowDown');
  expect(await pos(page)).toEqual({ x: 4, y: 6 + R }); // 못 지나간다
  await expect(bubble).toHaveCount(0, { timeout: 4000 }); // 잠시 뒤 사라진다
});

test('구구몬이 있는 칸을 탭해도 말풍선이 뜬다', async ({ page }) => {
  await seedTownRoam(page, { x: 4, y: 12 }, 'down');
  const canvas = page.getByTestId('field-canvas');
  await expect(canvas).toHaveAttribute('data-roamers', `c020:4,${7 + R}`);
  await page.evaluate(() => ((window as unknown as { __pin: boolean }).__pin = false));
  const box = (await canvas.boundingBox())!;
  const [camX, camY, tile] = ((await canvas.getAttribute('data-cam')) ?? '0,0,1').split(',').map(Number);
  const cw = await canvas.evaluate((c) => (c as HTMLCanvasElement).width);
  const css = (tile * box.width) / cw;
  await page.mouse.click(box.x + (4.5 - camX) * css, box.y + (7.5 + R - camY) * css);
  await expect(page.getByRole('dialog', { name: '구구몬 말풍선' })).toContainText('복숭아곰몬');
});

// ── 왼쪽 위 표시·태초마을로·도감 체력 ──

test('옛 저장에 013(c013)이 있어도 열리고, 도감은 48종이며 저장에서 c013이 사라진다', async ({ page }) => {
  const errors = collectErrors(page);
  await page.addInitScript(() => {
    if (localStorage.getItem('catch-gugumon:save')) return;
    const f = {
      starterChosen: true,
      companion: 'c013',
      species: { c013: { level: 7, exp: 3, stage: 1, caught: 1, firstCaughtAt: 1, skills: ['c013-1'] } },
      seen: ['c013'],
    };
    localStorage.setItem('catch-gugumon:save', JSON.stringify({ version: 1, state: { field: f } }));
  });
  await page.goto('/#/field');
  await expect(page).toHaveURL(/#\/field$/);
  const hud = page.getByRole('group', { name: '필드 정보' });
  await expect(hud).toContainText('도감 1/48');
  await expect(page.getByTestId('field-canvas')).toHaveAttribute('data-pos', /\d+,\d+/);
  // 한 칸 걸어 저장이 다시 쓰이게 한다
  const before = await pos(page);
  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(500);
  await page.keyboard.up('ArrowRight');
  await expect.poll(async () => (await pos(page)).x).not.toBe(before.x);
  const field = await page.evaluate(() => JSON.parse(localStorage.getItem('catch-gugumon:save')!).state.field);
  expect(field.species.c013).toBeUndefined();
  expect(field.species.c046.level).toBe(7);
  expect(field.companion).toBe('c046');
  expect(JSON.stringify(field)).not.toContain('c013');
  expect(errors).toEqual([]);
});

test('HUD에 도감 1/48과 캡슐 3개씩, 동행 체력이 보인다', async ({ page }) => {
  await seedStarter(page);
  await page.goto('/#/field');
  const hud = page.getByRole('group', { name: '필드 정보' });
  await expect(hud).toBeVisible();
  await expect(hud).toContainText('도감 1/48');
  await expect(hud.getByLabel('초원 캡슐 3개')).toBeVisible();
  await expect(hud.getByLabel('황금 캡슐 0개')).toBeVisible();
  await expect(hud.getByLabel('동행 체력 100')).toBeVisible();
  // 메뉴 버튼과 겹치지 않는다
  const a = (await hud.boundingBox())!;
  const b = (await page.getByRole('button', { name: '메뉴' }).boundingBox())!;
  expect(a.x + a.width).toBeLessThanOrEqual(b.x);
});

test('초원에서 메뉴의 태초마을로를 누르면 마을 @에 서고 저장본도 마을', async ({ page }) => {
  await standAt(page, 'meadow', 5, 8, 'right');
  await page.getByRole('button', { name: '메뉴' }).click();
  await page.getByRole('button', { name: '태초마을로' }).click();
  await expect(page.getByTestId('field-canvas')).toHaveAttribute('data-pos', '10,40');
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('catch-gugumon:save')!).state.field.position);
  expect(saved).toEqual({ map: 'town', x: 10, y: 40, facing: 'down' });
});

test('마을에서는 메뉴에 태초마을로가 없다', async ({ page }) => {
  await seedStarter(page);
  await page.goto('/#/field');
  await expect(page.getByTestId('field-canvas')).toHaveAttribute('data-pos', '10,40');
  await page.getByRole('button', { name: '메뉴' }).click();
  await expect(page.getByRole('button', { name: '구구몬 도감' })).toBeVisible();
  await expect(page.getByRole('button', { name: '태초마을로' })).toHaveCount(0);
});

test('도감에서 쓰러진 종은 쓰러짐 꼬리표와 빨간 막대, 함께 다니기가 꺼져 있다', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      'catch-gugumon:save',
      JSON.stringify({
        version: 1,
        state: {
          field: {
            starterChosen: true,
            companion: 'c034',
            species: {
              c034: { level: 5, exp: 0, stage: 1, caught: 1, firstCaughtAt: 1 },
              c036: { level: 3, exp: 0, stage: 1, caught: 1, firstCaughtAt: 2, hp: 0 },
              c031: { level: 3, exp: 0, stage: 1, caught: 1, firstCaughtAt: 3, hp: 40 },
            },
            seen: ['c034', 'c036', 'c031'],
          },
        },
      }),
    );
  });
  await page.goto('/#/field/dex');
  await expect(page.getByLabel('체력 0')).toHaveCount(1);
  await expect(page.getByLabel('체력 40')).toHaveCount(1);
  await expect(page.locator('.fdex__cell--caught').filter({ hasText: '쓰러짐' })).toHaveCount(1);
  await page.locator('.fdex__cell--caught').filter({ hasText: '쓰러짐' }).click();
  const btn = page.getByRole('button', { name: /함께 다니기/ });
  await expect(btn).toBeDisabled();
  await expect(page.getByRole('dialog')).toContainText('상점에서 회복시켜요');
});

// ── 필드 모험 3차: 기술 고르기·강력·특수·상성 ──

const shotDir = '.superpowers/sdd/2026-11-12-field-adventure-3/task-4-shots';

/** 전투 문제를 7×8로 고정하고(답 56) "빠르게" 스위치를 정해 둔다 (null이면 실제 시간) */
async function fixBattle(page: Page, fast: boolean | null) {
  await page.addInitScript(
    ([f]) => {
      const w = window as unknown as Record<string, unknown>;
      w.__GUGU_E2E_QUESTION__ = { factId: '7x8', type: 'product' };
      if (f !== null) w.__GUGU_E2E_FAST__ = f;
    },
    [fast] as const,
  );
}

async function setFast(page: Page, fast: boolean) {
  await page.evaluate((f) => {
    (window as unknown as Record<string, unknown>).__GUGU_E2E_FAST__ = f;
  }, fast);
}

/** 야생 체력 막대의 숫자 (0~100) */
async function wildHp(page: Page): Promise<number> {
  const label = (await page.locator('.wild__card [role="img"]').getAttribute('aria-label')) ?? '';
  return Number(label.replace(/\D/g, ''));
}

const skillPicker = (page: Page) => page.getByRole('group', { name: '기술 고르기' });

test('기술이 1개면 고르기 없이 바로 문제, 보기 버튼은 답 숫자만', async ({ page }) => {
  await fixBattle(page, null);
  await standBesideGrass(page, { tier: 'normal' });
  await stepIntoGrass(page);
  await page.getByRole('button', { name: '싸우자!' }).click();
  await expect(page.locator('.wild__bubble .question')).toBeVisible();
  await expect(skillPicker(page)).toHaveCount(0);
  await expect(page.getByRole('status')).toHaveText('잎사귀 톡 준비!');
  // 기술이 하나라 시간 막대에 기점(눈금)이 없다
  await expect(page.locator('.wild__timer')).toHaveAttribute('data-tier', '1');
  await expect(page.locator('.wild__timer-tick')).toHaveCount(0);
  const buttons = page.locator('.wild-move');
  await expect(buttons).toHaveCount(3);
  for (const t of await buttons.allTextContents()) expect(t.trim()).toMatch(/^\d+$/);
  await expect(moveButton(page, 56)).toHaveCount(1);
});

const shot12 = '.superpowers/sdd/2026-11-12-field-adventure-3/task-12-shots';

const shot15 = '.superpowers/sdd/2026-11-12-field-adventure-3/task-15-shots';

test('기술 5개: 고르기 단계에 버튼 3개가 한 줄에 나란히, 초 안·별 문구는 안 보이고(숨김 글만) 특수에만 설명 한 줄, 375px 안에 들어간다', async ({ page }) => {
  await fixBattle(page, null);
  await standBesideGrass(page, {
    tier: 'normal',
    c034: { level: 20, skills: ['c034-1', 'c034-2', 'c034-3', 'c034-4', 'c034-5'] },
  });
  await stepIntoGrass(page);
  await page.getByRole('button', { name: '싸우자!' }).click();
  const picker = skillPicker(page);
  const buttons = picker.locator('.skill-pick');
  await expect(buttons).toHaveCount(3);
  await expect(page.locator('.wild__bubble')).toHaveCount(0);
  await expect(picker.locator('.skill-picker__title')).toHaveText('어떤 기술을 쓸까?');
  await expect(page.getByText('어떤 기술을 쓸까?')).toHaveCount(1);
  await expect(picker.locator('.skill-picker__hint')).toHaveText('빨리 풀면 더 세져요 ⚡');
  // 이름만: 주속성은 1번 기술 이름, 부속성·특수는 그 기술 이름
  await expect(buttons.nth(0)).toHaveAttribute('data-button', 'main');
  await expect(buttons.nth(0).locator('.skill-pick__name')).toHaveText('잎사귀 톡');
  await expect(buttons.nth(0).locator('.skill-pick__tag')).toHaveText('풀');
  await expect(buttons.nth(1)).toHaveAttribute('data-skill', 'c034-4');
  await expect(buttons.nth(1).locator('.skill-pick__name')).toHaveText('끈적 독방울');
  await expect(buttons.nth(2).locator('.skill-pick__tag')).toHaveText('특수');
  // 특수 버튼에만 설명 한 줄 (속성 버튼은 이름만)
  await expect(buttons.nth(2).locator('.skill-pick__brief')).toHaveText('힌트');
  await expect(buttons.nth(0).locator('.skill-pick__brief')).toHaveCount(0);
  await expect(buttons.nth(1).locator('.skill-pick__brief')).toHaveCount(0);
  // 화면에 단계별 시간 조건·위력 별·①②③·작은 막대가 없다 (숨김 글에만 있다)
  for (let i = 0; i < 3; i++) {
    const visible = await buttons.nth(i).evaluate((el) => {
      const c = el.cloneNode(true) as HTMLElement; // 숨김 글(sr)은 빼고 눈에 보이는 글만
      c.querySelectorAll('.skill-pick__sr').forEach((n) => n.remove());
      return c.textContent ?? '';
    });
    expect(visible).not.toContain('초 안');
    expect(visible).not.toContain('★★');
    expect(visible).not.toMatch(/[①②③]/);
  }
  await expect(picker.locator('.wild__timer')).toHaveCount(0);
  await expect(buttons.nth(0).locator('.skill-pick__sr')).toContainText('4초 안: 2번 덩굴 휘리릭 +방어');
  await expect(buttons.nth(1).locator('.skill-pick__sr')).toContainText('4초 안: 끈적 독방울(부속성)');
  await expect(buttons.nth(2).locator('.skill-pick__sr')).toContainText('4초 안: 힌트 효과');
  // 상성은 글자와 기호로 크게 (특수는 없음)
  for (const i of [0, 1]) {
    const t = await buttons.nth(i).locator('.skill-pick__match').count();
    if (t) await expect(buttons.nth(i).locator('.skill-pick__match')).toHaveText(/^(▲ 효과가 커요|▼ 별로예요)$/);
  }
  await expect(buttons.nth(2).locator('.skill-pick__match')).toHaveCount(0);
  // 세 버튼이 한 줄에, 폭이 비슷하고, 모양(테두리)이 같다
  const boxes = await Promise.all([0, 1, 2].map((i) => buttons.nth(i).boundingBox()));
  const vp = page.viewportSize()!;
  for (const b of boxes) {
    expect(b!.x).toBeGreaterThanOrEqual(0);
    expect(b!.x + b!.width).toBeLessThanOrEqual(vp.width);
    expect(b!.y + b!.height).toBeLessThanOrEqual(vp.height);
    expect(Math.abs(b!.y - boxes[0]!.y)).toBeLessThanOrEqual(1);
    expect(Math.abs(b!.width - boxes[0]!.width)).toBeLessThanOrEqual(2);
  }
  const borders = await buttons.evaluateAll((els) => els.map((e) => getComputedStyle(e).border));
  expect(new Set(borders).size).toBe(1);
  for (let i = 0; i < 3; i++) {
    expect(await buttons.nth(i).evaluate((el) => el.scrollWidth <= el.clientWidth + 1 && el.scrollHeight <= el.clientHeight + 1)).toBe(true);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: `${shot15}/1-picker-3-buttons-375.png` });
  await buttons.nth(1).click();
  await expect(picker).toHaveCount(0);
  await expect(page.locator('.wild__bubble .question')).toBeVisible();
  // 준비 글·지금 쓰는 기술 줄은 간결하게 (몇 초 안인지는 숨김 글에만)
  await expect(page.getByRole('status')).toHaveText('끈적 독방울 준비!');
  await expect(page.locator('.wild__skill-now')).toContainText('끈적 독방울');
  await expect(page.locator('.wild__skill-now .wild__sr')).toHaveText('. 끈적 독방울 · 4초 안에 풀어요');
  expect(await page.locator('.wild__skill-now').evaluate((el) => {
    const c = el.cloneNode(true) as HTMLElement;
    c.querySelectorAll('.wild__sr').forEach((n) => n.remove());
    return c.textContent ?? '';
  })).not.toContain('초 안');
  await expect(page.locator('.wild__timer-tick')).toHaveCount(1);
});

/** 잎사귀 톡(풀) → 초원 야생 12종 주속성 상성: 물·땅 +1, 불·독 −1, 나머지 0 */
const LEAF_VS: Record<string, number> = {
  c033: 0, c034: 0, c035: -1, c036: 1, c037: 1, c038: 1, c039: 0, c040: 0, c041: 0, c042: -1, c043: 1, c044: 0,
};

test('빠르게 풀면 주속성 2번(덩굴 휘리릭)이 나간다, 느리면 1번 (__GUGU_E2E_FAST__)', async ({ page }) => {
  await fixBattle(page, false);
  // 주①·주② = 주속성 버튼 하나라 고르기 없음. 보통: 8칸
  await standBesideGrass(page, { tier: 'normal', as: 'c023', c034: { skills: ['c034-1', 'c034-2'] } });
  await stepIntoGrass(page);
  const species = (await page.locator('.wild__stage').getAttribute('data-species'))!;
  const m = LEAF_VS[species];
  expect(m).toBeDefined();
  const hpOf = (cells: number) => Math.round((1 - cells / 8) * 100);
  await page.getByRole('button', { name: '싸우자!' }).click();
  await expect(page.locator('.wild__bubble .question')).toBeVisible();
  // 평소: 위력 2 + 상성
  await moveButton(page, 56).click();
  await expect(page.getByRole('status')).toContainText('잎사귀 톡! 명중!');
  await expect(page.getByRole('status')).not.toContainText('⚡');
  const cells1 = 2 + m;
  await expect(page.getByLabel(`야생 체력 ${hpOf(cells1)}`)).toBeVisible();
  expect(await wildHp(page)).toBe(hpOf(cells1));
  // 빠르면 주②: 위력 2 + 상성 (+스턴 효과, "빠르면 +1칸"은 없어짐)
  await setFast(page, true);
  await expect(page.locator('.wild__bubble .question')).toBeVisible();
  await moveButton(page, 56).click();
  await expect(page.getByRole('status')).toContainText('덩굴 휘리릭! ⚡ 빠르다!');
  await expect(page.getByRole('status')).toContainText('적이 기절했어요! 다음 공격을 한 번 못 해요');
  await expect(page.getByRole('status')).not.toContainText('강력');
  const cells2 = cells1 + 2 + m;
  await expect(page.getByLabel(`야생 체력 ${hpOf(cells2)}`)).toBeVisible();
  expect(await wildHp(page)).toBe(hpOf(cells2));
  // 야생 이름 옆에 "기절" (다음 공격 한 번을 못 함)
  await expect(page.locator('.wild__buff--foe')).toHaveText('기절');
  await page.screenshot({ path: `${shot15}/3-quick-375.png` });
});

test('특수 회복: 빠르게 풀면 내 체력이 25 늘고, 늦으면 약한 기술이 대신 나간다', async ({ page }) => {
  await fixBattle(page, true);
  await standBesideGrass(page, { tier: 'normal', as: 'c022', c034: { level: 8, hp: 50, skills: ['c034-1', 'c034-3'] } });
  await stepIntoGrass(page);
  await page.getByRole('button', { name: '싸우자!' }).click();
  await expect(page.getByLabel('내 체력 50')).toBeVisible();
  await skillPicker(page).locator('[data-skill="c022-3"]').click();
  await expect(page.getByRole('status')).toHaveText('새싹 쑥쑥 준비! 빨리 풀면 회복!');
  await moveButton(page, 56).click();
  await expect(page.getByRole('status')).toContainText('새싹 쑥쑥! 체력을 25 되찾았어요!');
  await expect(page.getByLabel('내 체력 75')).toBeVisible();
  expect((await savedCloud(page)).hp).toBe(75);
  await page.screenshot({ path: `${shotDir}/special-heal-375.png` });

  await setFast(page, false);
  await skillPicker(page).locator('[data-skill="c022-3"]').click();
  await moveButton(page, 56).click();
  await expect(page.getByRole('status')).toContainText('시간이 지나서 약한 기술이 나갔어요. 잎사귀 톡!');
  await expect(page.getByLabel('내 체력 75')).toBeVisible();
  expect((await savedCloud(page)).hp).toBe(75);
});

test('틀리면 힌트 뒤 다른 문제로 넘어가고(기록·피해 없음), 틀린 문제는 몇 문제 뒤에 다시 나온다', async ({ page }) => {
  // 문제를 고정하지 않는다. 기술 1개(주①), 초원 야생이 물·땅이면 한 번에 3칸이라
  // 강력(12칸)으로 둬서 세 번 맞혀도(최대 9칸) 어지럽지 않다
  await standBesideGrass(page, { tier: 'mighty' });
  await stepIntoGrass(page);
  await page.getByRole('button', { name: '싸우자!' }).click();
  const bubble = page.locator('.wild__bubble');
  await expect(bubble.locator('.question')).toBeVisible();
  const fact = (await bubble.getAttribute('data-fact'))!;
  const answer = await solveWild(page);
  const before = await totalAttempts(page);
  await wrongMoveButton(page, answer).click();
  const glow = page.locator('.wild-move--glow');
  await expect(glow).toHaveCount(1);
  await expect(page.getByRole('status')).toHaveText('아쉬워! 힌트를 보자!');
  expect(await totalAttempts(page)).toBe(before + 1);
  const hpAfterHit = (await savedCloud(page)).hp;
  await glow.click();
  await expect(page.getByRole('status')).toHaveText('좋아, 다음 문제!');
  await expect(page.locator('.wild__hint')).toHaveCount(0);
  await expect(bubble.locator('.question')).toBeVisible();
  // 힌트 탭은 기록·피해 없음, 다른 문제(재출제 표시가 없는 새 문제)
  expect(await totalAttempts(page)).toBe(before + 1);
  expect((await savedCloud(page)).hp).toBe(hpAfterHit);
  await expect(bubble).not.toHaveAttribute('data-retry', 'true');
  // 몇 문제(2~3) 뒤 틀린 문제가 재출제로 다시 나온다
  let seen = false;
  for (let i = 0; i < 4 && !seen; i++) {
    await expect(bubble.locator('.question')).toBeVisible();
    if ((await bubble.getAttribute('data-retry')) === 'true') {
      expect(await bubble.getAttribute('data-fact')).toBe(fact);
      seen = true;
      break;
    }
    await moveButton(page, await solveWild(page)).click();
    await page.waitForTimeout(800);
  }
  expect(seen).toBe(true);
});

// ── 개정 4 (설계서 0-2절): 크리티컬·회피·효과 성공률·주기 공격·캡슐 활성화 ──

const shot16 = '.superpowers/sdd/2026-11-12-field-adventure-3/task-16-shots';

/** 전투 굴림 고정 (__GUGU_E2E_COMBAT__, 기본 fixture의 값을 덮는다) */
async function forceCombat(page: Page, c: { crit?: boolean; dodge?: boolean; effect?: boolean }) {
  await page.addInitScript((v) => {
    (window as unknown as Record<string, unknown>).__GUGU_E2E_COMBAT__ = v;
  }, c);
}

test('크리티컬: 깎는 칸이 2배, "💥 크리티컬!" 글이 크게', async ({ page }) => {
  await fixBattle(page, false);
  await forceCombat(page, { crit: true, dodge: false, effect: true });
  await standBesideGrass(page, { tier: 'normal' });
  await stepIntoGrass(page);
  const m = LEAF_VS[(await page.locator('.wild__stage').getAttribute('data-species'))!];
  await page.getByRole('button', { name: '싸우자!' }).click();
  await moveButton(page, 56).click();
  await expect(page.getByRole('status')).toContainText('💥 크리티컬!');
  await expect(page.locator('[data-burst="crit"]')).toBeVisible();
  await page.screenshot({ path: `${shot16}/1-crit-375.png` });
  const cells = (2 + m) * 2;
  await expect(page.getByLabel(`야생 체력 ${Math.round((1 - cells / 8) * 100)}`)).toBeVisible();
});

test('빗나감: 정답이어도 야생이 피하면 칸이 안 깎이고 "빗나갔어요!"', async ({ page }) => {
  await fixBattle(page, false);
  await forceCombat(page, { dodge: true });
  await standBesideGrass(page, { tier: 'normal' });
  await stepIntoGrass(page);
  await page.getByRole('button', { name: '싸우자!' }).click();
  const before = await totalAttempts(page);
  await moveButton(page, 56).click();
  await expect(page.getByRole('status')).toHaveText('잎사귀 톡! …빗나갔어요!');
  await expect(page.locator('[data-burst="dodge"]')).toBeVisible();
  await page.screenshot({ path: `${shot16}/2-dodge-375.png` });
  await expect(page.getByLabel('야생 체력 100')).toBeVisible();
  // 정답 기록은 그대로 남는다
  expect(await totalAttempts(page)).toBe(before + 1);
});

test('효과 실패: 주② 스턴이 확률에 지면 칸은 깎이고 "효과가 실패했어요…"만, 기절 표시 없음', async ({ page }) => {
  await fixBattle(page, true);
  await forceCombat(page, { crit: false, dodge: false, effect: false });
  await standBesideGrass(page, { tier: 'normal', as: 'c023', c034: { skills: ['c034-1', 'c034-2'] } });
  await stepIntoGrass(page);
  const m = LEAF_VS[(await page.locator('.wild__stage').getAttribute('data-species'))!];
  await page.getByRole('button', { name: '싸우자!' }).click();
  await moveButton(page, 56).click();
  // (상성 줄이 붙는 종도 있다)
  await expect(page.getByRole('status')).toContainText('덩굴 휘리릭! ⚡ 빠르다!');
  await expect(page.getByRole('status')).toContainText('효과가 실패했어요…');
  await expect(page.getByRole('status')).not.toContainText('기절했어요');
  await page.screenshot({ path: `${shot16}/3-effect-failed-375.png` });
  await expect(page.locator('.wild__buff--foe')).toHaveCount(0);
  await expect(page.getByLabel(`야생 체력 ${Math.round((1 - (2 + m) / 8) * 100)}`)).toBeVisible();
});

test('주기 공격: 정답 2번째 뒤에 적이 한 번 공격해 체력이 줄고(상처는 없음), 힌트 없이 다음 문제', async ({ page }) => {
  await fixBattle(page, false);
  await standBesideGrass(page, { tier: 'normal' });
  await stepIntoGrass(page);
  await page.getByRole('button', { name: '싸우자!' }).click();
  await moveButton(page, 56).click();
  await page.waitForTimeout(900);
  await expect(page.locator('.wild__bubble .question')).toBeVisible();
  await expect(page.getByLabel('내 체력 100')).toBeVisible();
  await moveButton(page, 56).click();
  await expect(page.getByLabel('내 체력 87')).toBeVisible();
  await expect(page.getByRole('status')).toHaveText(/의 .+!$/);
  await page.screenshot({ path: `${shot16}/4-counter-375.png` });
  await expect(page.locator('.wild-move--glow')).toHaveCount(0);
  await expect(page.locator('.wild__bubble .question')).toBeVisible();
  await expect(page.locator('.wild__hint')).toHaveCount(0);
  const c034 = await savedCloud(page);
  expect(c034.hp).toBe(87);
  expect(c034.wounds).toHaveLength(0);
});

test('캡슐 버튼: 야생 체력 1/4 이하에서만 켜지고, 문제를 푸는 중에도 던져 잡을 수 있다', async ({ page }) => {
  await fixBattle(page, false);
  await standBesideGrass(page, { tier: 'normal' });
  await stepIntoGrass(page);
  await page.getByRole('button', { name: '싸우자!' }).click();
  await expect(page.locator('.wild__bubble .question')).toBeVisible();
  const catchBtn = page.getByRole('button', { name: '캡슐로 잡기' });
  await expect(catchBtn).toBeDisabled();
  await expect(page.locator('.wild__catch-note')).toHaveText('체력이 1/4 이하일 때 던질 수 있어요');
  await page.screenshot({ path: `${shot16}/5-capsule-locked-375.png` });
  for (let i = 0; i < 8; i++) {
    await expect(page.locator('.wild__bubble .question')).toBeVisible();
    if (await catchBtn.isEnabled()) break;
    expect(await wildHp(page)).toBeGreaterThan(25);
    await moveButton(page, 56).click();
    await page.waitForTimeout(1500); // 명중 + (2번째마다) 적의 공격
  }
  await expect(catchBtn).toBeEnabled();
  expect(await wildHp(page)).toBeLessThanOrEqual(25);
  await expect(page.locator('.wild__catch-note')).toHaveCount(0);
  await page.screenshot({ path: `${shot16}/6-capsule-ready-375.png` });
  const attempts = await totalAttempts(page);
  await catchBtn.click();
  await expect(page.getByText(/잡았다!/)).toBeVisible({ timeout: 5000 });
  // 던질 때 풀던 문제는 틀린 것으로 치지 않는다
  expect(await totalAttempts(page)).toBe(attempts);
  expect((await savedCapsules(page)).meadow).toBe(2);
});

test('주② 스턴으로 막은 적 공격은 저장 체력도 그대로, 그다음 공격은 화면과 저장이 같이 준다', async ({ page }) => {
  await fixBattle(page, true); // 늘 빠르게 → 주속성 버튼에서 덩굴 휘리릭(주②, 스턴)
  // 보통(7초·피해 13)
  await standBesideGrass(page, { tier: 'normal', as: 'c023', c034: { hp: 100, skills: ['c034-1', 'c034-2'] } });
  await stepIntoGrass(page);
  await page.getByRole('button', { name: '싸우자!' }).click();
  await expect(page.locator('.wild__bubble .question')).toBeVisible();
  await moveButton(page, 56).click();
  await expect(page.getByRole('status')).toContainText('덩굴 휘리릭!');
  // 다음 문제에서 틀린다: 스턴이 막아 피해 0, 적 공격 대신 "기절해서 움직이지 못했어요"
  await expect(page.locator('.wild__bubble .question')).toBeVisible();
  await wrongMoveButton(page, 56).click();
  await expect(page.getByRole('status')).toHaveText(/^(약한 |강한 |강력한 )?\S+[이가] 기절해서 움직이지 못했어요!$/);
  await expect(page.locator('.wild__ally--struck')).toHaveCount(0);
  await page.screenshot({ path: `${shot12}/4-stun-blocked-375.png` });
  await expect(page.locator('.wild-move--glow')).toHaveCount(1);
  await expect(page.getByLabel('내 체력 100')).toBeVisible();
  await expect(page.locator('.wild__buff--foe')).toHaveCount(0);
  expect((await savedCloud(page)).hp).toBe(100);
  // 힌트 뒤 다음 문제에서 또 틀리면 이번엔 맞는다 (화면 87 = 저장 87)
  await page.locator('.wild-move--glow').click();
  await expect(page.locator('.wild__bubble .question')).toBeVisible();
  await wrongMoveButton(page, 56).click();
  await expect(page.getByLabel('내 체력 87')).toBeVisible();
  expect((await savedCloud(page)).hp).toBe(87);
});

// ── 캡슐 던지기 연출과 효과음 (필드 모험 3차 4-1·4-2) ──

type ThrowResult = 'caught' | 'healed' | 'escaped' | 'angry';

/** 던지기 결과를 고정한다 (__GUGU_E2E_THROW__). 안 부르면 캡슐 100% 잡힘 스위치 */
async function forceThrow(page: Page, outcome: ThrowResult) {
  await page.addInitScript((o) => {
    (window as unknown as Record<string, unknown>).__GUGU_E2E_THROW__ = o;
  }, outcome);
}

/** 소리가 울린 순서를 적어 둔다: 합성음이 시작될 때마다 첫 음높이를 모은다 (소리 이름은 첫 음높이로 알아본다) */
async function spyAudio(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __sfxFreqs: number[]; AudioContext: typeof AudioContext };
    w.__sfxFreqs = [];
    const make = w.AudioContext.prototype.createOscillator;
    w.AudioContext.prototype.createOscillator = function () {
      const osc = make.call(this);
      const start = osc.start.bind(osc);
      osc.start = (when?: number) => {
        w.__sfxFreqs.push(osc.frequency.value);
        start(when);
      };
      return osc;
    };
  });
}

/** 던지기 연출 단계 순서: 던짐 → 머리에 맞음 → 빨려듦 → 낙하 → 통통 → 흔들림 → 결과 */
const CAPSULE_ORDER = ['throw', 'hit', 'absorb', 'fall', 'bounce', 'shake', 'result'];

/** 연출 단계(data-capsule-stage)가 바뀔 때마다 기록한다 (그 순간까지 '통통' 소리가 몇 번 났는지도 함께: __bounceAt) */
async function watchCapsuleStages(page: Page) {
  const bounceFreq = await sfxFirstFreq('capsuleBounce');
  await page.evaluate((bounceFreq) => {
    const el = document.querySelector('[data-species]')!;
    const seen: string[] = [];
    const bounceAt: number[] = [];
    (window as unknown as { __stages: string[]; __bounceAt: number[] }).__stages = seen;
    (window as unknown as { __bounceAt: number[] }).__bounceAt = bounceAt;
    new MutationObserver(() => {
      const v = el.getAttribute('data-capsule-stage');
      if (v && seen[seen.length - 1] !== v) {
        seen.push(v);
        const w = window as unknown as { __sfxFreqs?: number[] };
        bounceAt.push((w.__sfxFreqs ?? []).filter((x) => x === bounceFreq).length);
      }
    }).observe(el, { attributes: true, attributeFilter: ['data-capsule-stage'] });
  }, bounceFreq);
}

const bounceAtSeen = (page: Page) => page.evaluate(() => (window as unknown as { __bounceAt: number[] }).__bounceAt);
const stagesSeen = (page: Page) => page.evaluate(() => (window as unknown as { __stages: string[] }).__stages);
const freqsSeen = (page: Page) => page.evaluate(() => (window as unknown as { __sfxFreqs: number[] }).__sfxFreqs);

/** 소리 이름 → 소리를 알아보는 첫 음높이 (sfx.ts의 SOUNDS와 같아야 한다: tests/audio/sfx.test.ts가 서로 다름을 지킨다) */
async function sfxFirstFreq(name: string): Promise<number> {
  const { SOUNDS } = await import('../src/audio/sfx');
  return SOUNDS[name as keyof typeof SOUNDS][0].freq;
}

test('잡힘: 던짐→맞음→빨려듦→낙하→통통→흔들림→결과 순서, 통통 소리는 바닥에 닿을 때, 흔들림 3번과 찰칵·잡았다 소리', async ({ page }) => {
  await spyAudio(page);
  await standBesideGrass(page, { tier: 'weak' });
  await stepIntoGrass(page);
  await answerUntilDizzy(page);
  await watchCapsuleStages(page);
  const button = page.getByRole('button', { name: '캡슐 던지기' });
  await button.click();
  // 던지는 동안 다시 눌러도 더 던지지 않는다
  await button.click({ force: true }).catch(() => undefined);
  // 던지는 순간 바로 저장된다 (연타해도 한 번만)
  expect((await savedCapsules(page)).meadow).toBe(2);
  // 결과(찰칵)는 0.2초라 화면 찍는 사이에 지나간다 — 순서는 아래 기록으로 본다
  await expect(page.getByText(/잡았다!/)).toBeVisible({ timeout: 5000 });
  expect(await stagesSeen(page)).toEqual(CAPSULE_ORDER);
  expect((await savedCapsules(page)).meadow).toBe(2);
  // '통통' 소리는 낙하가 끝나 바닥에 닿는 순간(통통 단계가 시작될 때) 처음 난다: 그 전 단계에서는 0번
  const stageList = await stagesSeen(page);
  const bounceAt = await bounceAtSeen(page);
  expect(bounceAt[stageList.indexOf('fall')]).toBe(0);
  expect(bounceAt[stageList.indexOf('bounce')]).toBe(1);
  const freqs = await freqsSeen(page);
  const times = async (n: string) => {
    const first = await sfxFirstFreq(n);
    return freqs.filter((x) => x === first).length;
  };
  expect(await times('throw')).toBe(1);
  expect(await times('capsuleOpen')).toBe(1);
  expect(await times('capsuleBounce')).toBe(1);
  expect(await times('capsuleShake')).toBe(3);
  expect(await times('capsuleClick')).toBe(1);
  expect(await times('capsulePop')).toBe(0);
});

test('연출 단계별 화면 (375px 스크린샷)', async ({ page }) => {
  const dir = '.superpowers/sdd/2026-11-12-field-adventure-3/task-14-shots';
  await standBesideGrass(page, { tier: 'weak' });
  await stepIntoGrass(page);
  await answerUntilDizzy(page);
  await page.getByRole('button', { name: '캡슐 던지기' }).click();
  // 던짐 → 맞음 → 빨려듦 → 낙하 → 통통 → 흔들림: 단계가 나타나길 기다렸다가(고정 시간 아님) 그 단계 한가운데쯤을 찍는다
  const shots: Array<[string, string]> = [
    ['throw', '1-throw'],
    ['hit', '2-hit'],
    ['absorb', '3-absorb'],
    ['fall', '4-fall'],
    ['bounce', '5-bounce'],
    ['shake', '6-shake'],
  ];
  for (const [stage, name] of shots) {
    await page.locator(`[data-capsule-stage="${stage}"]`).waitFor({ timeout: 5000 });
    await page.waitForTimeout(stage === 'hit' ? 30 : 70);
    await page.screenshot({ path: `${dir}/${name}.png` });
  }
  await expect(page.getByText(/잡았다!/)).toBeVisible({ timeout: 5000 });
  await page.screenshot({ path: `${dir}/7-caught.png` });
});

test('빠져나옴: 첫 흔들림에서 열려 야생이 튀어나오고, 체력이 차오르고 다시 문제', async ({ page }) => {
  await forceThrow(page, 'healed');
  await spyAudio(page);
  await standBesideGrass(page, { tier: 'weak' });
  await stepIntoGrass(page);
  await answerUntilDizzy(page);
  await expect(page.getByLabel('야생 체력 0')).toBeVisible();
  await watchCapsuleStages(page);
  await page.getByRole('button', { name: '캡슐 던지기' }).click();
  await expect(page.getByRole('status')).toHaveText('앗! 캡슐에서 빠져나왔어요! 힘을 조금 되찾았어요!', { timeout: 5000 });
  await page.screenshot({ path: '.superpowers/sdd/2026-11-12-field-adventure-3/task-14-shots/8-pop-healed.png' });
  expect(await stagesSeen(page)).toEqual(CAPSULE_ORDER);
  await expect(page.getByLabel('야생 체력 0')).toHaveCount(0);
  await expect(page.getByLabel(/야생 체력 [1-9]/)).toBeVisible();
  // 다시 문제로 (연출이 끝나면 캡슐 버튼은 없고 문제와 보기가 나온다)
  await expect(page.locator('.wild__bubble .question')).toBeVisible({ timeout: 3000 });
  await expect(page.getByRole('button', { name: '캡슐 던지기' })).toHaveCount(0);
  expect((await savedCapsules(page)).meadow).toBe(2);
  const freqs = await freqsSeen(page);
  const times = async (n: string) => {
    const first = await sfxFirstFreq(n);
    return freqs.filter((x) => x === first).length;
  };
  expect(await times('capsuleShake')).toBe(1);
  expect(await times('capsulePop')).toBe(1);
  expect(await times('capsuleClick')).toBe(0);
});

test('도망: 두 번째 흔들림에서 열리고 도망간다', async ({ page }) => {
  await forceThrow(page, 'escaped');
  await spyAudio(page);
  await standBesideGrass(page, { tier: 'weak' });
  await stepIntoGrass(page);
  await answerUntilDizzy(page);
  await page.getByRole('button', { name: '캡슐 던지기' }).click();
  await expect(page.getByText(/도망/).first()).toBeVisible({ timeout: 5000 });
  await expect(page).toHaveURL(/#\/field$/, { timeout: 5000 });
  const freqs = await freqsSeen(page);
  const times = async (n: string) => {
    const first = await sfxFirstFreq(n);
    return freqs.filter((x) => x === first).length;
  };
  expect(await times('capsuleShake')).toBe(2);
  expect(await times('capsulePop')).toBe(1);
});

test('화남: 두 번째 흔들림에서 열리고 강력해져 다시 문제', async ({ page }) => {
  await forceThrow(page, 'angry');
  await standBesideGrass(page, { tier: 'weak' });
  await stepIntoGrass(page);
  await answerUntilDizzy(page);
  await watchCapsuleStages(page);
  await page.getByRole('button', { name: '캡슐 던지기' }).click();
  await expect(page.getByText(/화가 났다!/)).toBeVisible({ timeout: 5000 });
  expect(await stagesSeen(page)).toEqual(CAPSULE_ORDER);
  await expect(page.locator('.wild__bubble .question')).toBeVisible({ timeout: 3000 });
});

// ── 기술 효과음 (필드 모험 3차 4-4) ──

test('윗단계(주②) 발동 때 속성 소리와 fxPower, 주①은 fxPower 없음', async ({ page }) => {
  await spyAudio(page);
  await fixBattle(page, false);
  await standBesideGrass(page, { tier: 'normal', as: 'c023', c034: { skills: ['c034-1', 'c034-2'] } });
  await stepIntoGrass(page);
  await page.getByRole('button', { name: '싸우자!' }).click();
  await expect(page.locator('.wild__bubble .question')).toBeVisible();
  const power = await sfxFirstFreq('fxPower');
  const grass = await sfxFirstFreq('fxGrass');
  await moveButton(page, 56).click();
  await expect(page.getByRole('status')).toContainText('잎사귀 톡! 명중!');
  // 덩굴 효과는 날아가는 효과라 속성 소리는 맞는 순간(날아간 뒤)에 난다
  await expect.poll(async () => (await freqsSeen(page)).filter((x) => x === grass).length).toBe(1);
  let freqs = await freqsSeen(page);
  expect(freqs.filter((x) => x === power).length).toBe(0);
  await setFast(page, true);
  await expect(page.locator('.wild__bubble .question')).toBeVisible();
  await moveButton(page, 56).click();
  await expect(page.getByRole('status')).toContainText('덩굴 휘리릭! ⚡ 빠르다!');
  // 스턴 소리는 기술이 맞은 조금 뒤 (SKILL_EFFECT_DELAY_MS)
  const stun = await sfxFirstFreq('skillStun');
  await expect.poll(async () => (await freqsSeen(page)).filter((x) => x === stun).length).toBe(1);
  freqs = await freqsSeen(page);
  expect(freqs.filter((x) => x === grass).length).toBe(2);
  expect(freqs.filter((x) => x === power).length).toBe(1);
});

test('특수 회복 성공 때 skillHeal 소리, 늦어 약한 기술이 나가면 속성 소리만', async ({ page }) => {
  await spyAudio(page);
  await fixBattle(page, true);
  await standBesideGrass(page, { tier: 'normal', as: 'c022', c034: { level: 8, hp: 50, skills: ['c034-1', 'c034-3'] } });
  await stepIntoGrass(page);
  await page.getByRole('button', { name: '싸우자!' }).click();
  await skillPicker(page).locator('[data-skill="c022-3"]').click();
  await moveButton(page, 56).click();
  await expect(page.getByRole('status')).toContainText('체력을 25 되찾았어요!');
  const heal = await sfxFirstFreq('skillHeal');
  const grass = await sfxFirstFreq('fxGrass');
  let freqs = await freqsSeen(page);
  expect(freqs.filter((x) => x === heal).length).toBe(1);
  expect(freqs.filter((x) => x === grass).length).toBe(0);
  await setFast(page, false);
  await skillPicker(page).locator('[data-skill="c022-3"]').click();
  await moveButton(page, 56).click();
  await expect(page.getByRole('status')).toContainText('약한 기술이 나갔어요');
  // 날아가는 효과라 속성 소리는 맞는 순간(날아간 뒤)에 난다
  await expect.poll(async () => (await freqsSeen(page)).filter((x) => x === grass).length).toBe(1);
  freqs = await freqsSeen(page);
  expect(freqs.filter((x) => x === heal).length).toBe(1);
});

// ── 시간 막대의 기점 눈금·구간 색 (설계서 0-1절 "시간 게이지 표시") ──

test('시간 막대: 눈금(굵은 선, 글자 없음)과 지금 나갈 단계 색(data-tier)이 기점을 지나면 바뀐다', async ({ page }) => {
  await fixBattle(page, null);
  // 시계가 실제로 흐르게 (보통 7초: 3번 2초 안, 2번 4초 안)
  await standBesideGrass(page, { timer: true, tier: 'normal', c034: { level: 20, skills: ['c034-1', 'c034-2', 'c034-5'] } });
  await stepIntoGrass(page);
  await page.getByRole('button', { name: '싸우자!' }).click();
  const timer = page.locator('.wild__timer');
  await expect(timer).toBeVisible();
  await expect(page.locator('.wild__timer-tick')).toHaveCount(2);
  await expect(page.locator('.wild__timer-mark')).toHaveCount(0);
  expect(await timer.evaluate((el) => /[①②③]/.test((el as HTMLElement).innerText))).toBe(false);
  await expect(timer).toHaveAttribute('data-tier', '3');
  // 눈금은 막대 안에 있고 서로 겹치지 않는다 (375px)
  const bar = (await timer.boundingBox())!;
  const ticks = await page.locator('.wild__timer-tick').evaluateAll((els) => els.map((e) => e.getBoundingClientRect().x));
  for (const x of ticks) {
    expect(x).toBeGreaterThan(bar.x);
    expect(x).toBeLessThan(bar.x + bar.width);
  }
  expect(Math.abs(ticks[1] - ticks[0])).toBeGreaterThan(20);
  await page.screenshot({ path: `${shot15}/2a-gauge-tier3-375.png` });
  await expect(timer).toHaveAttribute('data-tier', '2', { timeout: 3500 });
  await page.screenshot({ path: `${shot15}/2b-gauge-tier2-375.png` });
  await expect(timer).toHaveAttribute('data-tier', '1', { timeout: 3500 });
  await page.screenshot({ path: `${shot15}/2c-gauge-tier1-375.png` });
});

test('캡슐에서 빠져나온 뒤 결과를 보여 주는 동안(150ms)은 문제가 떠도 시계가 흐르지 않는다', async ({ page }) => {
  await forceThrow(page, 'healed');
  await standBesideGrass(page, { timer: true, tier: 'weak' });
  await stepIntoGrass(page);
  await answerUntilDizzy(page);
  // 빠져나옴 글이 뜬 때와 시간 막대 채움이 처음 줄어든 때를 기록한다
  await page.evaluate(() => {
    const w = window as unknown as { __healedAt: number; __fillAt: number };
    w.__healedAt = 0;
    w.__fillAt = 0;
    const status = document.querySelector('[role="status"]')!;
    new MutationObserver(() => {
      if (!w.__healedAt && status.textContent?.includes('빠져나왔어요')) w.__healedAt = performance.now();
    }).observe(status, { childList: true, characterData: true, subtree: true });
    new MutationObserver((list) => {
      for (const m of list) {
        const el = m.target as HTMLElement;
        if (w.__healedAt && !w.__fillAt && el.classList?.contains('wild__timer-fill') && el.style.width !== '100%') w.__fillAt = performance.now();
      }
    }).observe(document.body, { attributes: true, attributeFilter: ['style'], subtree: true });
  });
  await page.getByRole('button', { name: '캡슐 던지기' }).click();
  await expect(page.getByRole('status')).toHaveText(/빠져나왔어요/, { timeout: 5000 });
  await expect(page.locator('.wild__bubble .question')).toBeVisible({ timeout: 3000 });
  await expect.poll(() => page.evaluate(() => (window as unknown as { __fillAt: number }).__fillAt), { timeout: 3000 }).toBeGreaterThan(0);
  const { healedAt, fillAt } = await page.evaluate(() => {
    const w = window as unknown as { __healedAt: number; __fillAt: number };
    return { healedAt: w.__healedAt, fillAt: w.__fillAt };
  });
  // CAPSULE_RESULT_MS(150ms) 동안은 멈춰 있다 (프레임 오차를 조금 둔다)
  expect(fillAt - healedAt).toBeGreaterThanOrEqual(130);
});

test('필드 오른쪽 위: 전체 화면 아이콘 버튼은 메뉴 버튼·알약과 겹치지 않는다', async ({ page }) => {
  const errors = collectErrors(page);
  await seedStarter(page);
  await page.goto('/#/field');
  const fs = page.getByTestId('fullscreen-btn');
  await expect(fs).toBeVisible();
  await expect(fs).toHaveAttribute('aria-label', '전체 화면');
  const f = (await fs.boundingBox())!;
  const m = (await page.getByRole('button', { name: '메뉴' }).boundingBox())!;
  const h = (await page.locator('.fieldhud').boundingBox())!;
  const hit = (a: typeof f, b: typeof f) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
  expect(hit(f, m)).toBe(false);
  expect(hit(f, h)).toBe(false);
  expect(f.x + f.width).toBeLessThanOrEqual(375);
  expect(errors).toEqual([]);
});
