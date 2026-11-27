import { describe, expect, it } from 'vitest';
import { SHOP_TABS } from '../../src/field/shop/ShopPopup';

describe('상점 탭', () => {
  it('캡슐·회복약·꾸미기 순서, 모두 열려 있고 준비 중 탭은 없다', () => {
    expect(SHOP_TABS.map((t) => t.id)).toEqual(['capsule', 'potion', 'costume']);
    expect(SHOP_TABS.find((t) => t.id === 'costume')).toMatchObject({ label: '꾸미기', ready: true });
    expect(SHOP_TABS.every((t) => t.ready)).toBe(true);
    expect(SHOP_TABS.some((t) => (t.id as string) === 'soon')).toBe(false);
  });
});
