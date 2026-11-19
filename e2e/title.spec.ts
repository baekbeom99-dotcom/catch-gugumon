import { expect, test } from './fixtures';
import { seedHatchedPet, enableQuiz } from './helpers';

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
  [768, 1024, 'title-3x4'],
] as const) {
  test(`시작 화면 ${w}×${h}: ${want} 그림, 시작하기는 가운데, 저학년 모드는 오른쪽 위, 가로 스크롤 없음`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    await page.goto('/');
    const img = page.locator('.title__art img');
    await expect(img).toBeVisible();
    await expect.poll(() => img.evaluate((e: HTMLImageElement) => e.currentSrc)).toContain(want);
    // 비율 그대로 덮기 (늘리지 않음)
    await expect(img).toHaveCSS('object-fit', 'cover');

    const start = page.getByRole('button', { name: '시작하기' });
    await expect(start).toBeVisible();
    const sb = (await start.boundingBox())!;
    const vw = page.viewportSize()!.width;
    const vh = page.viewportSize()!.height;
    // 앱이 가운데 고정폭 열이면 그 열의 가운데도 화면 가운데다
    expect(Math.abs(sb.x + sb.width / 2 - vw / 2)).toBeLessThanOrEqual(2);
    const cy = sb.y + sb.height / 2;
    expect(cy).toBeGreaterThan(vh * 0.35);
    expect(cy).toBeLessThan(vh * 0.65);

    const sw = (await page.getByRole('switch', { name: '저학년 모드' }).boundingBox())!;
    expect(sw.x + sw.width).toBeGreaterThan(vw * 0.55);
    expect(sw.y).toBeLessThan(vh * 0.15);
    expect(sw.height).toBeLessThanOrEqual(44);

    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await expect(page.getByRole('heading', { name: '잡아라! 구구단 몬스터' })).toHaveCount(1);
  });
}
