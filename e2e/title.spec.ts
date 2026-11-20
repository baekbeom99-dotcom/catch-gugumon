import { expect, test } from './fixtures';
import { seedHatchedPet, enableQuiz, collectErrors } from './helpers';

// 퀴즈 모험은 배포에서 꺼져 있으므로 이 파일은 스위치로 켜고 본다
test.beforeEach(async ({ page }) => {
  await enableQuiz(page);
  // 시작하기 버튼은 통통 뛰므로(동작 줄이기면 가만히) 누르기 쉽게 멈춰 둔다
  await page.emulateMedia({ reducedMotion: 'reduce' });
});

test('타이틀에서 퀴즈 모험을 고르면 처음 쓰는 사람은 알 고르기로 간다', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.getByRole('button', { name: '퀴즈 모험' })).toBeVisible();
  await expect(page.getByRole('button', { name: '시작하기' })).toBeVisible();
  await page.getByRole('button', { name: '퀴즈 모험' }).click();
  await expect(page).toHaveURL(/#\/welcome/);
});

test('알을 고른 사람은 퀴즈 모험에서 나의 펫으로 간다', async ({ page }) => {
  await seedHatchedPet(page);
  await page.goto('/#/');
  await page.getByRole('button', { name: '퀴즈 모험' }).click();
  await expect(page).toHaveURL(/#\/pet/);
});

test('시작하기 버튼은 바로 #/field로 간다', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '시작하기' }).click();
  await expect(page).toHaveURL(/#\/field/);
});

test('퀴즈 모험 위쪽 [처음 화면]을 누르면 타이틀로 돌아온다', async ({ page }) => {
  await seedHatchedPet(page);
  await page.goto('/#/pet');
  await page.getByRole('button', { name: '처음 화면' }).click();
  await expect(page).toHaveURL(/#\/$/);
  await expect(page.getByRole('button', { name: '퀴즈 모험' })).toBeVisible();
});

// ── 새 시작 화면: 그림 고르기·가운데 버튼·오른쪽 위 스위치 ──

for (const [w, h, want] of [
  [375, 812, 'title-tall'],
  // 시작 화면은 창 전체를 덮으므로(600px 열 제한 없음) 768×1024는 가로÷세로 0.75 → 3:4 그림
  [768, 1024, 'title-3x4'],
  [600, 800, 'title-3x4'],
  [1280, 720, 'title-3x4'],
  [1024, 768, 'title-3x4'],
] as const) {
  test(`시작 화면 ${w}×${h}: ${want} 그림, 시작하기는 가운데, 저학년 모드는 오른쪽 위, 가로 스크롤 없음`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    await page.goto('/');
    const img = page.locator('img.title__art');
    await expect(img).toBeVisible();
    await expect.poll(() => img.evaluate((e: HTMLImageElement) => e.currentSrc)).toContain(want);
    // 비율 그대로 덮기 (늘리지 않음)
    await expect(img).toHaveCSS('object-fit', 'cover');
    // 덮기: 그림 칸이 화면 칸보다 작지 않다 (옆이 잘리지 않게 그림을 고른 것)
    const ib = (await img.boundingBox())!;
    const cb = (await page.locator('.title').boundingBox())!;
    // 화면 전체를 꽉 채운다: 옆 띠 없음 (그림 칸 = 창 크기)
    const vp = page.viewportSize()!;
    expect(Math.abs(ib.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(ib.y)).toBeLessThanOrEqual(1);
    expect(Math.abs(ib.width - vp.width)).toBeLessThanOrEqual(1);
    expect(Math.abs(ib.height - vp.height)).toBeLessThanOrEqual(1);
    expect(ib.width).toBeGreaterThanOrEqual(cb.width - 1);
    expect(ib.height).toBeGreaterThanOrEqual(cb.height - 1);
    const nat = await img.evaluate((e: HTMLImageElement) => e.naturalWidth / e.naturalHeight);
    // 가로로 잘리는 몫이 5% 안쪽 (제목 글자가 옆에서 잘리지 않는다)
    expect(Math.max(0, 1 - cb.width / cb.height / nat)).toBeLessThan(0.05);

    const start = page.getByRole('button', { name: '시작하기' });
    await expect(start).toBeVisible();
    const sb = (await start.boundingBox())!;
    const vw = page.viewportSize()!.width;
    const vh = page.viewportSize()!.height;
    // 앱이 가운데 고정폭 열이면 그 열의 가운데도 화면 가운데다
    expect(Math.abs(sb.x + sb.width / 2 - vw / 2)).toBeLessThanOrEqual(2);
    const cy = sb.y + sb.height / 2;
    expect(cy).toBeGreaterThan(vh * 0.35);
    // 가로로 넓은 창(가로÷세로 ≥ 5:4)에선 제목 글자 아래로 내려온다
    expect(cy).toBeLessThan(vh * (vw / vh >= 1.25 ? 0.9 : 0.65));

    const sw = (await page.getByRole('switch', { name: '저학년 모드' }).boundingBox())!;
    expect(sw.x + sw.width).toBeGreaterThan(vw * 0.55);
    expect(sw.y).toBeLessThan(vh * 0.15);
    expect(sw.height).toBeLessThanOrEqual(46);

    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await expect(page.getByRole('heading', { name: '잡아라! 구구단 몬스터' })).toHaveCount(1);
  });
}

test('타이틀 왼쪽 위에 전체 화면 아이콘 버튼이 있고 누르면 바뀐다', async ({ page }) => {
  const errors = collectErrors(page);
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/');
  const btn = page.getByTestId('fullscreen-btn');
  await expect(btn).toBeVisible();
  await expect(btn).toHaveAttribute('aria-label', '전체 화면');
  await expect(btn).toHaveText('');
  const b = (await btn.boundingBox())!;
  expect(b.x).toBeLessThan(375 * 0.25);
  expect(b.y).toBeLessThan(812 * 0.15);
  expect(b.width).toBeGreaterThanOrEqual(44);
  expect(b.height).toBeGreaterThanOrEqual(44);
  // 오른쪽 위 저학년 모드와 겹치지 않는다
  const sw = (await page.getByRole('switch', { name: '저학년 모드' }).boundingBox())!;
  expect(b.x + b.width).toBeLessThan(sw.x);
  // 헤드리스에서 전체 화면이 거절될 수도 있어, 켜지면 라벨이 바뀌고 안 켜져도 오류는 없어야 한다
  await btn.click();
  await page.waitForTimeout(400);
  const on = await page.evaluate(() => document.fullscreenElement !== null);
  if (on) {
    await expect(btn).toHaveAttribute('aria-label', '전체 화면 끝내기');
    await btn.click();
    await expect(btn).toHaveAttribute('aria-label', '전체 화면');
  }
  expect(errors).toEqual([]);
});

test('전체 화면을 못 하는 브라우저에서는 버튼이 없다', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(Document.prototype, 'fullscreenEnabled', { get: () => false });
    Object.defineProperty(Document.prototype, 'webkitFullscreenEnabled', { get: () => false });
  });
  await page.goto('/');
  await expect(page.getByRole('button', { name: '시작하기' })).toBeVisible();
  await expect(page.getByTestId('fullscreen-btn')).toHaveCount(0);
});
