import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ClockFace, clockHandAngles } from '../../src/field/training/ClockFace';

describe('시계 바늘 각도', () => {
  it('정각: 분침 0도, 시침은 시 × 30도', () => {
    expect(clockHandAngles(3, 0)).toEqual({ hour: 90, minute: 0 });
    expect(clockHandAngles(12, 0)).toEqual({ hour: 0, minute: 0 });
    expect(clockHandAngles(6, 0)).toEqual({ hour: 180, minute: 0 });
  });
  it('시침은 분만큼 더 간다 (3:30 → 105도), 분침은 분 × 6도', () => {
    expect(clockHandAngles(3, 30)).toEqual({ hour: 105, minute: 180 });
    expect(clockHandAngles(12, 15)).toEqual({ hour: 7.5, minute: 90 });
    expect(clockHandAngles(11, 59)).toEqual({ hour: 359.5, minute: 354 });
  });
});

describe('ClockFace', () => {
  it('접근성 글은 시각을 알려 주지 않고, 시험용 data-h·data-m이 있고, 숫자 1~12가 있다', () => {
    const html = renderToStaticMarkup(createElement(ClockFace, { h: 4, m: 25 }));
    expect(html).toContain('role="img"');
    expect(html).toContain('aria-label="몇 시 몇 분일까요?"');
    expect(html).toContain('data-h="4"');
    expect(html).toContain('data-m="25"');
    for (let n = 1; n <= 12; n++) expect(html).toContain(`>${n}</text>`);
    expect((html.match(/<line/g) ?? []).length).toBe(60 + 2); // 눈금 60 + 시침·분침
  });
});
