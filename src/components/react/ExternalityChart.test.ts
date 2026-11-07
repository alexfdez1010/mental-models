import { describe, expect, test } from 'bun:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ExternalityChart } from '@/components/react/ExternalityChart';
const render = (props: Parameters<typeof ExternalityChart>[0] = {}) => renderToStaticMarkup(createElement(ExternalityChart, props));
const geometry = (html: string) => [...html.matchAll(/\b(?:d|points|cx|cy|x1|x2|y1|y2|x|y|r|width|height|viewBox|transform)="[^"]*"/g)].map(match => match[0]);

describe('externality chart optional text locale', () => {
  test('explicit English preserves the default DOM across initial slider settings', () => {
    for (let step = -8; step <= 8; step++) {
      const initialExternal = step / 2;
      expect(render({ initialExternal, locale: 'en', perUnitLabel: 'unit' })).toBe(render({ initialExternal }));
    }
  });
  test('Spanish fractional readout and accessible value use commas with unchanged geometry', () => {
    const text = { readoutNegative: 'Coste {ext}; mercado {qm}; óptimo {qs}; diferencia {gap}; pérdida {dwl}.', costEndLabel: 'coste externo' };
    const es = render({ ...text, locale: 'es', perUnitLabel: 'unidad', initialExternal: -.5 });
    const en = render({ ...text, locale: 'en', initialExternal: -.5 });
    expect(es).toContain('$0,5'); expect(es).toContain('6,5'); expect(es).toContain('$0,1');
    expect(es).toContain('aria-valuetext="$0,5 coste externo"'); expect(es).not.toContain('$0.5');
    expect(geometry(es)).toEqual(geometry(en));
  });
  test('all signed initial settings preserve geometry and finite textual values', () => {
    for (let step = -8; step <= 8; step++) {
      const initialExternal = step / 2;
      const en = render({ locale: 'en', initialExternal }), es = render({ locale: 'es', perUnitLabel: 'unidad', initialExternal });
      expect(geometry(es)).toEqual(geometry(en)); expect(es).not.toContain('NaN'); expect(es).not.toContain('undefined');
    }
  });
});
