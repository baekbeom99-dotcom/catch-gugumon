/** E2E 공통: 똥·병·식중독 주사위와 기술 복사(2%)를 꺼서(언제나 '안 일어남') 테스트 결과가 흔들리지 않게 한다. */
import { test as base } from '@playwright/test';

export const test = base.extend({
  page: async ({ page }, use) => {
    await page.addInitScript(() => {
      const w = window as unknown as {
        __GUGU_E2E_CALM__: boolean;
        __GUGU_E2E_NO_WILD__: boolean;
        __GUGU_E2E_COPY__: boolean;
        __GUGU_E2E_COMBAT__: { crit?: boolean; dodge?: boolean; effect?: boolean };
      };
      w.__GUGU_E2E_CALM__ = true;
      w.__GUGU_E2E_NO_WILD__ = true;
      // 복사를 보는 테스트는 따로 true로 켠다 (나중 init 스크립트가 덮어씀)
      w.__GUGU_E2E_COPY__ = false;
      // 전투 굴림: 크리티컬·회피는 없고 특수효과는 늘 성공 (굴림을 보는 테스트는 따로 바꾼다)
      w.__GUGU_E2E_COMBAT__ = { crit: false, dodge: false, effect: true };
    });
    await use(page);
  },
});

export { expect } from '@playwright/test';
