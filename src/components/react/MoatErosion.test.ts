import { describe, expect, test } from 'bun:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MoatErosion, type MoatErosionProps } from '@/components/react/MoatErosion';

const render = (Component: typeof MoatErosion, props: MoatErosionProps = {}) =>
  renderToStaticMarkup(createElement(Component, props));
const geometries = (html: string) => [...html.matchAll(/<(?:polyline|polygon|line|circle)\b[^>]*>/g)].map(x => x[0]);

describe('MoatErosion accessible value template', () => {
  test('uses the established English slider value format by default', () => {
    const html = render(MoatErosion);
    expect(html).toContain('aria-valuetext="3 of 10"');
    expect(html).toContain('aria-valuetext="6 of 10"');
    expect(html).toBe(render(MoatErosion, { valueTextTemplate: '{value} of 10' }));
  });
  test('preserves all finite control pairs and changes only the two authored aria values', () => {
    for (let moat = 0; moat <= 10; moat++) {
      for (let pressure = 0; pressure <= 10; pressure++) {
        const props = { initialMoat: moat, initialPressure: pressure };
        const explicitEnglish = render(MoatErosion, { ...props, valueTextTemplate: '{value} of 10' });
        const english = render(MoatErosion, props);
        const spanish = render(MoatErosion, { ...props, valueTextTemplate: '{value} de 10' });
        expect(english).toBe(explicitEnglish);
        expect(spanish).toBe(english.replaceAll(/aria-valuetext="(\d+) of 10"/g, 'aria-valuetext="$1 de 10"'));
        expect([...spanish.matchAll(/aria-valuetext="([^"]*)"/g)].map(x => x[1])).toEqual([`${moat} de 10`, `${pressure} de 10`]);
        expect(geometries(spanish)).toEqual(geometries(english));
      }
    }
  });
  test('localizes the boundary values and an interior value without changing numeric inputs', () => {
    for (const value of [0, 1, 10]) {
      const html = render(MoatErosion, { initialMoat: value, initialPressure: value, valueTextTemplate: '{value} de 10' });
      expect((html.match(new RegExp(`aria-valuetext="${value} de 10"`, 'g')) ?? []).length).toBe(2);
      expect((html.match(new RegExp(`value="${value}"`, 'g')) ?? []).length).toBe(2);
      expect(html).toContain('step="1"');
    }
  });
});
