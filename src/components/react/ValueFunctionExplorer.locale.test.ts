import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, test } from 'bun:test';
import { createHash } from 'node:crypto';
import { ValueFunctionExplorer, type ValueFunctionExplorerProps } from '@/components/react/ValueFunctionExplorer';

const render = (props: ValueFunctionExplorerProps = {}) => renderToStaticMarkup(createElement(ValueFunctionExplorer, props));
const geometry = (html: string) => [...html.matchAll(/<(?:path|line|circle|rect)\b[^>]*>/g)].map(match => match[0]);

describe('ValueFunctionExplorer coefficient locale', () => {
  test('omitted and explicit English keep the immutable legacy initial SSR', () => {
    const omitted = render();
    expect(render({ locale: 'en' })).toBe(omitted);
    // From the immutable pre-locale source at its initial coefficient and frame.
    expect(createHash('sha256').update(omitted).digest('hex')).toBe('7ab2e9543c21dca3980e5b936bff168d1eba7c8d2e8538213821e716b34c72f7');
  });

  test('Spanish changes coefficient text while preserving geometry and machine input', () => {
    const en = render({ locale: 'en' }), es = render({ locale: 'es' });
    expect(es).toContain('aria-valuetext="λ = 2,25"');
    expect(es).toContain('>λ = 2,25</span>');
    expect(es).toContain('At λ = 2,25');
    expect(es).toContain('about 2,25×');
    expect(es.replaceAll('2,25', '2.25')).toBe(en);
    expect(geometry(es)).toEqual(geometry(en));
    for (const html of [en, es]) {
      expect(html).toContain('min="100" max="300" step="5"');
      expect(html).toContain('value="225"');
      expect(html.match(/aria-live="polite"/g)?.length).toBe(2);
      expect(html.match(/type="range"/g)?.length).toBe(1);
      expect(html.match(/aria-pressed="true"/g)?.length).toBe(1);
    }
  });

  test('custom labels retain their tokens and the specified display rounding', () => {
    const html = render({ locale: 'es', curveReadoutTemplate: 'Coeficiente {lambda}; ganancia {gain}; pérdida {loss}; razón {ratio}.', gainFrameLabel: 'R = 0', lossFrameLabel: 'R = 600' });
    expect(html).toContain('Coeficiente 2,25; ganancia 58; pérdida -129; razón 2,25.');
    expect(html).not.toContain('{lambda}');
    expect(html).toContain('R = 0');
    expect(html).toContain('R = 600');
  });

  test('invalid new locale values reject before any hook is called', () => {
    for (const invalid of ['fr', '', null, 1, false, {}, []]) {
      // Calling directly would otherwise reach the invalid-hook path.
      expect(() => ValueFunctionExplorer({ locale: invalid as unknown as ValueFunctionExplorerProps['locale'] })).toThrow('ValueFunctionExplorer: locale must be en or es.');
    }
  });
});
