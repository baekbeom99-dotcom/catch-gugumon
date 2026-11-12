import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';

test.use({ viewport: { width: 375, height: 812 } });

const SHOTS = '.superpowers/sdd/2026-11-12-field-adventure-3/task-6-shots';
const SAVE_KEY = 'gugu-monster:save';

interface SeedOptions {
  cloud: Record<string, unknown>;
  /** 풀숲(6,8) 바로 왼쪽에 서고 만남 100%·문제 시간 멈춤·약한 야생·복사 100% */
  battle?: boolean;
  capsules?: Record<string, number>;
}

/** 페이지가 열리기 전에 구름몬 저장본을 넣는다 (이미 저장이 있으면 그대로 — 새로고침해도 유지) */
async function seed(page: Page, opts: SeedOptions) {
  await page.addInitScript(
    ([cloud, battle, capsules, key]) => {
      const w = window as unknown as Record<string, unknown>;
      if (battle) {
        w.__GUGU_E2E_FIELD__ = true;
        w.__GUGU_E2E_NO_TIMER__ = true;
        w.__GUGU_E2E_TIER__ = 'weak';
        w.__GUGU_E2E_COPY__ = true;
      }
      if (localStorage.getItem(key as string)) return;
      const field = {
        starterChosen: true,
        companion: 'cloud',
        species: { cloud: { exp: 0, stage: 1, caught: 1, firstCaughtAt: 1, ...(cloud as object) } },
        seen: ['cloud'],
        position: { map: 'meadow', x: 5, y: 8, facing: 'right' },
        ...(capsules ? { capsules } : {}),
      };
      localStorage.setItem(key as string, JSON.stringify({ version: 1, state: { field } }));
    },
    [opts.cloud, !!opts.battle, opts.capsules ?? null, SAVE_KEY] as const,
  );
}

async function savedSkills(page: Page): Promise<string[]> {
  return page.evaluate((k) => JSON.parse(localStorage.getItem(k)!).state.field.species.cloud.skills, SAVE_KEY);
}

async function stepIntoGrass(page: Page) {
  await expect(page.getByTestId('field-canvas')).toHaveAttribute('data-pos', '5,8');
  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(120);
  await page.keyboard.up('ArrowRight');
  await expect(page).toHaveURL(/#\/field\/battle$/);
}

/** 문제를 읽어 답을 계산한다 (기술 고르기가 먼저 나오면 첫 기술을 고른다) */
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

/** 어지러워질 때까지(또는 캡슐이 없어 돌려보낼 때까지) 정답을 누른다 */
async function answerUntilDizzy(page: Page) {
  for (let i = 0; i < 8; i++) {
    if (await page.getByRole('button', { name: '캡슐 던지기' }).isVisible()) return;
    if (await page.getByText(/캡슐이 없어서/).isVisible()) return;
    const answer = await solveWild(page);
    await page.locator('.wild-move').filter({ has: page.locator(`.wild-move__num:text-is("${answer}")`) }).click();
    await page.waitForTimeout(800);
  }
}

/** 전투를 마치고 필드로 돌아와, 알림을 닫으며 기술 선택창이 뜨기를 기다린다 */
async function waitOffer(page: Page) {
  const offer = page.getByRole('dialog', { name: '기술 선택창' });
  await expect(page).toHaveURL(/#\/field$/, { timeout: 8000 });
  for (let i = 0; i < 10 && !(await offer.isVisible()); i++) {
    for (const name of ['성장 알림', '기술 알림']) {
      const n = page.getByRole('dialog', { name });
      if (await n.isVisible()) await n.click();
    }
    await page.waitForTimeout(200);
  }
  await expect(offer).toBeVisible();
  return offer;
}

const FIVE = ['cloud-1', 'horn-1', 'horn-2', 'jelly-1', 'jelly-2'];
const NO_CAPSULES = { meadow: 0, waterside: 3, desert: 3, legend: 0 };

/** 복사 스위치로 돌려보내 복사 제안 선택창을 띄운다 */
async function openCopyOffer(page: Page) {
  await seed(page, { cloud: { level: 8, stage: 2, skills: FIVE }, battle: true, capsules: NO_CAPSULES });
  await page.goto('/#/field');
  await stepIntoGrass(page);
  await answerUntilDizzy(page);
  return waitOffer(page);
}

test('복사 제안: "잊고 배우기"를 누르면 그 기술이 새 기술로 바뀐다', async ({ page }) => {
  const offer = await openCopyOffer(page);
  const newId = (await offer.locator('.skill-card').first().getAttribute('data-skill'))!;
  await expect(offer).toContainText('따라 배울까?');
  await expect(offer.getByRole('button', { name: '포기' })).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/offer-375.png` });
  // 가진 기술 5개 버튼이 모두 화면 안에 있다
  const box = (await offer.locator('.skill-offer__card').boundingBox())!;
  for (const b of await offer.locator('.skill-offer__pick').all()) {
    const r = (await b.boundingBox())!;
    expect(r.x).toBeGreaterThanOrEqual(box.x);
    expect(r.x + r.width).toBeLessThanOrEqual(box.x + box.width + 1);
  }
  expect(await offer.locator('.skill-offer__pick').count()).toBe(5);
  await offer.locator('.skill-offer__pick[data-skill="jelly-2"]').click();
  await expect(offer).toHaveCount(0);
  await expect(page.locator('section.fieldmode')).toHaveAttribute('data-skill-offers', '0');
  const after = await savedSkills(page);
  expect(after).toEqual(['cloud-1', 'horn-1', 'horn-2', 'jelly-1', newId]);
  await page.reload();
  expect(await savedSkills(page)).toEqual(after);
});

test('복사 제안: "포기"는 저장을 바꾸지 않는다', async ({ page }) => {
  const offer = await openCopyOffer(page);
  await offer.getByRole('button', { name: '포기' }).click();
  await expect(offer).toHaveCount(0);
  await expect(page.locator('section.fieldmode')).toHaveAttribute('data-skill-offers', '0');
  expect(await savedSkills(page)).toEqual(FIVE);
});

test('복사 제안: Esc는 "포기"와 같다', async ({ page }) => {
  const offer = await openCopyOffer(page);
  await page.keyboard.press('Escape');
  await expect(offer).toHaveCount(0);
  expect(await savedSkills(page)).toEqual(FIVE);
});

test('레벨 제안: "배우지 않기"는 아는 기술로 남아 도감에서 바꿔 배울 수 있다', async ({ page }) => {
  // 구름몬 Lv19 (다음 레벨까지 5 모자람), 기술 5개 → 도망쳐도 참여 +10으로 Lv20, 슬롯 5 제안
  const held = ['cloud-1', 'cloud-2', 'cloud-3', 'cloud-4', 'horn-1'];
  await seed(page, { cloud: { level: 19, exp: 205, stage: 3, skills: held }, battle: true });
  await page.goto('/#/field');
  await stepIntoGrass(page);
  await page.getByRole('button', { name: '도망치기' }).click();
  await page.getByRole('dialog', { name: '도망치기' }).getByRole('button', { name: '도망갈래' }).click();
  const offer = await waitOffer(page);
  await expect(offer).toContainText('새 기술을 배울 수 있어');
  await expect(offer.locator('.skill-card').first()).toHaveAttribute('data-skill', 'cloud-5');
  await offer.getByRole('button', { name: '배우지 않기' }).click();
  await expect(offer).toHaveCount(0);
  expect(await savedSkills(page)).toEqual(held);

  // 도감에서 다시 배우기: 가진 게 5개라 바꿀 기술을 고른다
  await page.goto('/#/field/dex');
  await page.locator('.fdex__cell--caught').first().click();
  await page.getByRole('button', { name: '기술 보기·바꾸기' }).click();
  const manage = page.getByRole('dialog', { name: '기술 관리' });
  await expect(manage.getByTestId('held-skills').locator('.skill-card')).toHaveCount(5);
  await manage.getByTestId('other-skills').locator('[data-skill="cloud-5"]').getByRole('button', { name: '배우기' }).click();
  await page.screenshot({ path: `${SHOTS}/manage-replace-375.png` });
  await manage.locator('.skill-card[data-skill="horn-1"]').getByRole('button', { name: '이 기술을 잊기' }).click();
  const after = ['cloud-1', 'cloud-2', 'cloud-3', 'cloud-4', 'cloud-5'];
  expect(await savedSkills(page)).toEqual(after);
  await page.reload();
  expect(await savedSkills(page)).toEqual(after);
});

test('관리 화면: 못 익힌 기술은 잠겨 눌러도 안 배워지고, 익힌 기술은 바로 배운다. 기술을 비울 수는 없다', async ({ page }) => {
  await seed(page, { cloud: { level: 5, skills: ['cloud-1'] } });
  await page.goto('/#/field/dex');
  await page.locator('.fdex__cell--caught').first().click();
  await page.getByRole('button', { name: '기술 보기·바꾸기' }).click();
  const manage = page.getByRole('dialog', { name: '기술 관리' });
  await expect(manage).toContainText('가진 기술 1/5');
  await page.screenshot({ path: `${SHOTS}/manage-375.png` });

  const locked = manage.getByTestId('other-skills').locator('[data-skill="cloud-3"]').getByRole('button', { name: 'Lv8에 배워요' });
  await expect(locked).toBeDisabled();
  await locked.click({ force: true });
  expect(await savedSkills(page)).toEqual(['cloud-1']);

  // 기술을 줄이는 버튼(해제·잊기)은 없다 — 바꾸기만
  await expect(manage.getByRole('button', { name: /해제|잊기|버리기/ })).toHaveCount(0);

  await manage.getByTestId('other-skills').locator('[data-skill="cloud-2"]').getByRole('button', { name: '배우기' }).click();
  expect(await savedSkills(page)).toEqual(['cloud-1', 'cloud-2']);
  await expect(manage).toContainText('가진 기술 2/5');
  await page.reload();
  expect(await savedSkills(page)).toEqual(['cloud-1', 'cloud-2']);
});
