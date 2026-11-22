import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';

test.use({ viewport: { width: 375, height: 812 } });

const SHOTS = '.superpowers/sdd/2026-11-12-field-adventure-3/task-13-shots';
const SAVE_KEY = 'catch-gugumon:save';

interface SeedOptions {
  /** 동행 구구몬의 기록 */
  c034: Record<string, unknown>;
  /** 동행 종 (기본 꽃등짐몬) */
  who?: string;
  /** 풀숲(6,8) 바로 왼쪽에 서고 만남 100%·문제 시간 멈춤·약한 야생·복사 100% */
  battle?: boolean;
  capsules?: Record<string, number>;
}

/** 페이지가 열리기 전에 동행 저장본을 넣는다 (이미 저장이 있으면 그대로 — 새로고침해도 유지) */
async function seed(page: Page, opts: SeedOptions) {
  await page.addInitScript(
    ([c034, battle, capsules, key, who]) => {
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
        companion: who,
        species: { [who as string]: { exp: 0, stage: 1, caught: 1, firstCaughtAt: 1, ...(c034 as object) } },
        seen: [who],
        position: { map: 'meadow', x: 5, y: 8, facing: 'right' },
        ...(capsules ? { capsules } : {}),
      };
      localStorage.setItem(key as string, JSON.stringify({ version: 1, state: { field } }));
    },
    [opts.c034, !!opts.battle, opts.capsules ?? null, SAVE_KEY, opts.who ?? 'c034'] as const,
  );
}

async function savedSkills(page: Page, who = 'c034'): Promise<string[]> {
  return page.evaluate(([k, w]) => JSON.parse(localStorage.getItem(k)!).state.field.species[w].skills, [SAVE_KEY, who]);
}

async function stepIntoGrass(page: Page) {
  await expect(page.getByTestId('field-canvas')).toHaveAttribute('data-pos', '5,8');
  await page.keyboard.down('ArrowRight');
  try {
    await expect(page).toHaveURL(/#\/field\/battle$/);
  } finally {
    await page.keyboard.up('ArrowRight');
  }
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
    // 돌려보내기까지 끝나 필드로 돌아왔으면 그만
    if (!/#\/field\/battle$/.test(page.url())) return;
    if (await page.getByRole('button', { name: '캡슐 던지기' }).isVisible()) return;
    if (await page.getByText(/캡슐이 없어서/).isVisible()) return;
    const bubble = page.locator('.wild__bubble');
    let answer: number;
    try {
      answer = await solveWild(page);
    } catch (e) {
      // 문제가 안 뜬 까닭이 전투가 이미 끝나 필드로 돌아온 것이면 그만
      if (!/#\/field\/battle$/.test(page.url())) return;
      throw e;
    }
    const fact = await bubble.getAttribute('data-fact');
    await page.locator('.wild-move').filter({ has: page.locator(`.wild-move__num:text-is("${answer}")`) }).click();
    // 다음 문제로 넘어가거나(문제가 바뀜) 어지러워질 때까지 기다린다
    await expect(async () => {
      const done = (await page.getByRole('button', { name: '캡슐 던지기' }).isVisible()) || (await page.getByText(/캡슐이 없어서/).isVisible());
      const now = (await bubble.count()) > 0 ? await bubble.getAttribute('data-fact') : null;
      expect(done || now !== fact).toBe(true);
    }).toPass({ timeout: 8000 });
  }
}

/** 전투를 마치고 필드로 돌아와, 알림을 닫으며 기술 선택창이 뜨기를 기다린다 */
async function waitOffer(page: Page) {
  const offer = page.getByRole('dialog', { name: '기술 선택창' });
  await expect(page).toHaveURL(/#\/field$/, { timeout: 8000 });
  const notices = ['성장 알림', '기술 알림'].map((name) => page.getByRole('dialog', { name }));
  for (let i = 0; i < 10 && !(await offer.isVisible()); i++) {
    // 알림이나 선택창 중 하나가 뜰 때까지 기다렸다가, 알림이면 닫는다
    await expect(offer.or(notices[0]).or(notices[1])).toBeVisible();
    for (const n of notices) if (await n.isVisible()) await n.click();
  }
  await expect(offer).toBeVisible();
  return offer;
}

async function openManager(page: Page) {
  await page.goto('/#/field/dex');
  await page.locator('.fdex__cell--caught').first().click();
  await page.getByRole('button', { name: '기술 보기·바꾸기' }).click();
  return page.getByRole('dialog', { name: '기술 관리' });
}

// 물거북몬(Lv8): 부속성 자리는 복사한 블루베리곰몬 기술이 차지, 주속성 사슬 1·2번과 특수 3번이 있다.
// 초원의 야생(초원 12종 Lv3~5)에서 복사하면 속성 기술이므로 늘 부속성 자리 제안이 온다
const JELLY = ['c036-1', 'c036-2', 'c036-3', 'c031-1'];
const NO_CAPSULES = { meadow: 0, waterside: 3, desert: 3, legend: 0 };

/** 복사 스위치로 돌려보내 복사 제안 선택창을 띄운다 */
async function openCopyOffer(page: Page) {
  await seed(page, { who: 'c036', c034: { level: 8, stage: 2, skills: JELLY }, battle: true, capsules: NO_CAPSULES });
  await page.goto('/#/field');
  await stepIntoGrass(page);
  await answerUntilDizzy(page);
  return waitOffer(page);
}

test('복사 제안: 새 기술 카드와 그 자리 기술 하나만 보이고, "이 기술을 잊고 배우기"로 바뀐다', async ({ page }) => {
  const offer = await openCopyOffer(page);
  const newId = (await offer.locator('.skill-card').first().getAttribute('data-skill'))!;
  await expect(offer).toContainText('따라 배울까?');
  await expect(offer).toContainText('부속성 자리');
  // 카드 둘: 새 기술 + 그 자리의 지금 기술(블루베리곰몬에게서 따라 배운 기술)
  await expect(offer.locator('.skill-card')).toHaveCount(2);
  await expect(offer.locator('.skill-card').nth(1)).toHaveAttribute('data-skill', 'c031-1');
  // 복사한 기술은 부속성 자리 위력(★★★)과 부속성 조건 글
  await expect(offer.locator('.skill-card').first()).toContainText('★★★');
  await expect(offer.locator('.skill-card').first()).toContainText('(부속성)');
  // 둘째 버튼(포기)에 처음 포커스
  await expect(offer.getByRole('button', { name: '포기' })).toBeFocused();
  await page.screenshot({ path: `${SHOTS}/offer-copy-375.png` });
  const box = (await offer.locator('.skill-offer__card').boundingBox())!;
  const fb = (await offer.getByRole('button', { name: '이 기술을 잊고 배우기' }).boundingBox())!;
  expect(fb.x).toBeGreaterThanOrEqual(box.x);
  expect(fb.x + fb.width).toBeLessThanOrEqual(box.x + box.width + 1);
  await offer.getByRole('button', { name: '이 기술을 잊고 배우기' }).click();
  await expect(offer).toHaveCount(0);
  await expect(page.locator('section.fieldmode')).toHaveAttribute('data-skill-offers', '0');
  const after = await savedSkills(page, 'c036');
  expect(after).toEqual(['c036-1', 'c036-2', 'c036-3', newId]);
  await page.reload();
  expect(await savedSkills(page, 'c036')).toEqual(after);
});

test('복사 제안: "포기"는 저장을 바꾸지 않는다', async ({ page }) => {
  const offer = await openCopyOffer(page);
  await offer.getByRole('button', { name: '포기' }).click();
  await expect(offer).toHaveCount(0);
  await expect(page.locator('section.fieldmode')).toHaveAttribute('data-skill-offers', '0');
  expect(await savedSkills(page, 'c036')).toEqual(JELLY);
});

test('복사 제안: Esc는 "포기"와 같다', async ({ page }) => {
  const offer = await openCopyOffer(page);
  await page.keyboard.press('Escape');
  await expect(offer).toHaveCount(0);
  expect(await savedSkills(page, 'c036')).toEqual(JELLY);
});

test('레벨 제안: 부속성 자리가 복사 기술이면 "배우지 않기"로 지키고, 도감에서 바꿔 배울 수 있다', async ({ page }) => {
  // 꽃등짐몬 Lv13 (다음 레벨까지 5 모자람) → 도망쳐도 참여 +10으로 Lv14, 부속성 4번(부속성 기술) 제안
  const held = ['c034-1', 'c034-2', 'c034-3', 'c031-1'];
  await seed(page, { c034: { level: 13, exp: 145, stage: 2, skills: held }, battle: true });
  await page.goto('/#/field');
  await stepIntoGrass(page);
  await page.getByRole('button', { name: '도망치기' }).click();
  await page.getByRole('dialog', { name: '도망치기' }).getByRole('button', { name: '도망갈래' }).click();
  const offer = await waitOffer(page);
  await expect(offer).toContainText('새 기술을 배울 수 있어');
  await expect(offer.locator('.skill-card').first()).toHaveAttribute('data-skill', 'c034-4');
  await expect(offer.locator('.skill-card').nth(1)).toHaveAttribute('data-skill', 'c031-1');
  await expect(offer.getByRole('button', { name: '배우지 않기' })).toBeFocused();
  await page.screenshot({ path: `${SHOTS}/offer-level-375.png` });
  await offer.getByRole('button', { name: '배우지 않기' }).click();
  await expect(offer).toHaveCount(0);
  expect(await savedSkills(page)).toEqual(held);

  // 도감에서 다시 배우기: 복사 기술을 잊는 것이라 한 번 더 묻는다
  const manage = await openManager(page);
  const sub = manage.getByTestId('seat-sub');
  await sub.locator('[data-skill="c034-4"]').getByRole('button', { name: '이 기술로 바꾸기' }).click();
  await expect(sub.getByRole('group', { name: '바꾸기 확인' })).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/manage-confirm-375.png` });
  await sub.getByRole('button', { name: '그만두기' }).click();
  expect(await savedSkills(page)).toEqual(held);
  await sub.locator('[data-skill="c034-4"]').getByRole('button', { name: '이 기술로 바꾸기' }).click();
  await sub.locator('[data-action="confirm"]').click();
  const after = ['c034-1', 'c034-2', 'c034-3', 'c034-4'];
  expect(await savedSkills(page)).toEqual(after);
  await page.reload();
  expect(await savedSkills(page)).toEqual(after);
});

test('관리 화면: 세 구역(주속성 사슬·부속성 자리·특수 자리), 못 익힌 기술은 잠기고 단계별 조건과 M2 효과가 보인다', async ({ page }) => {
  await seed(page, { c034: { level: 5, skills: ['c034-1', 'c034-2'] } });
  const manage = await openManager(page);
  await page.screenshot({ path: `${SHOTS}/manage-375.png` });
  const main = manage.getByTestId('seat-main');
  const sub = manage.getByTestId('seat-sub');
  const special = manage.getByTestId('seat-special');
  await expect(main).toContainText('주속성 사슬');
  await expect(sub).toContainText('부속성 자리');
  await expect(special).toContainText('특수 자리');

  // ① 주속성 사슬: 가진 1·2번 + 못 배운 3번(Lv20 잠금). 읽기 전용 — 누를 수 있는 버튼이 없다
  await expect(main.locator('.skill-card')).toHaveCount(3);
  await expect(main.locator('[data-skill="c034-5"]').getByRole('button', { name: 'Lv20에 배워요' })).toBeDisabled();
  await expect(main.locator('button:enabled')).toHaveCount(0);
  // 카드: 단계별 시간 조건 + M2 특수효과(스턴)
  const m2 = main.locator('[data-skill="c034-2"]');
  await expect(m2).toContainText('4초 안: 2번 덩굴 휘리릭');
  await expect(m2).toContainText('빨리 풀면: 다음 적 공격이 약해져요');
  await expect(main.locator('[data-skill="c034-1"]')).toContainText('1번 잎사귀 톡');

  // ②③: 자리가 비어 있고 못 배운 기술은 잠김
  await expect(sub).toContainText('아직 비어 있어요');
  await expect(sub.locator('[data-skill="c034-4"]').getByRole('button', { name: 'Lv14에 배워요' })).toBeDisabled();
  await expect(special.locator('[data-skill="c034-3"]').getByRole('button', { name: 'Lv8에 배워요' })).toBeDisabled();
  await sub.locator('[data-skill="c034-4"]').getByRole('button').click({ force: true });
  expect(await savedSkills(page)).toEqual(['c034-1', 'c034-2']);

  // 기술을 줄이는 버튼(해제·잊기)은 없다 — 바꾸기만
  await expect(manage.getByRole('button', { name: /해제|잊기|버리기/ })).toHaveCount(0);
});

test('관리 화면: 빈 자리에 아는 기술을 바로 배우고 새로고침해도 남는다', async ({ page }) => {
  await seed(page, { c034: { level: 14, stage: 2, skills: ['c034-1', 'c034-2', 'c034-3'] } });
  const manage = await openManager(page);
  const sub = manage.getByTestId('seat-sub');
  await expect(sub).toContainText('아직 비어 있어요');
  await sub.locator('[data-skill="c034-4"]').getByRole('button', { name: '배우기' }).click();
  const after = ['c034-1', 'c034-2', 'c034-3', 'c034-4'];
  expect(await savedSkills(page)).toEqual(after);
  await expect(sub).not.toContainText('아직 비어 있어요');
  await expect(sub.locator('.skill-card')).toHaveCount(1);
  await page.reload();
  expect(await savedSkills(page)).toEqual(after);
});

test('관리 화면: 특수 자리의 복사 기술을 자기 종 특수로 바꾼다 (같은 자리끼리만)', async ({ page }) => {
  await seed(page, { c034: { level: 14, stage: 2, skills: ['c034-1', 'c034-2', 'c034-4', 'c042-3'] } });
  const manage = await openManager(page);
  await page.screenshot({ path: `${SHOTS}/manage-swap-375.png` });
  const special = manage.getByTestId('seat-special');
  await expect(special.locator('.skill-card').first()).toHaveAttribute('data-skill', 'c042-3');
  // 부속성 자리에는 이미 자기 기술(4번)이라 바꿀 후보가 없다
  await expect(manage.getByTestId('seat-sub').getByRole('button')).toHaveCount(0);
  await special.locator('[data-skill="c034-3"]').getByRole('button', { name: '이 기술로 바꾸기' }).click();
  await special.locator('[data-action="confirm"]').click();
  const after = ['c034-1', 'c034-2', 'c034-4', 'c034-3'];
  expect(await savedSkills(page)).toEqual(after);
  await page.reload();
  expect(await savedSkills(page)).toEqual(after);
});
