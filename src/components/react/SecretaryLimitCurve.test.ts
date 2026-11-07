import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { SecretaryLimitCurve, secretaryLimitValue } from '@/components/react/SecretaryLimitCurve';

const labels = { slider:'Fraction', xAxis:'Rejected fraction', yAxis:'Limit value', chart:'Continuous limit curve', readout:'x {x}; value {value}', endpointNote:'Endpoint values use the continuous extension, not finite-pool probabilities.' };
describe('classical secretary continuous limit', () => {
  test('has the continuous endpoints, theoretical peak and equal quarter/half heights', () => {
    expect(secretaryLimitValue(0)).toBe(0);
    expect(secretaryLimitValue(1)).toBe(0);
    expect(secretaryLimitValue(1 / Math.E)).toBeCloseTo(1 / Math.E, 14);
    expect(secretaryLimitValue(.25)).toBeCloseTo(secretaryLimitValue(.5), 14);
    for (const x of [.01, .1, .25, .37, .5, .9, .99]) expect(secretaryLimitValue(x)).toBeLessThanOrEqual(1 / Math.E);
  });
  test('renders finite chart geometry and locale formatting at both boundaries', () => {
    for (const initialPercent of [0, 37, 100]) for (const locale of ['en', 'es'] as const) {
      const html = renderToStaticMarkup(createElement(SecretaryLimitCurve, { title:'Limit', labels, initialPercent, locale }));
      expect(html).not.toMatch(/NaN|Infinity|undefined/);
      expect(html).toContain('aria-live="polite"');
      expect(html).toContain('type="range"');
      if (initialPercent === 37) expect(html).toContain(locale === 'es' ? '36,79' : '36.79');
    }
  });
  test('normalizes a signed zero before formatting the selected fraction', () => {
    expect(secretaryLimitValue(-0)).toBe(0);
    for (const locale of ['en', 'es'] as const) {
      const html = renderToStaticMarkup(createElement(SecretaryLimitCurve, { title:'Limit', labels, initialPercent:-0, locale }));
      const format = new Intl.NumberFormat(locale === 'es' ? 'es-ES' : 'en-US', { style:'percent', maximumFractionDigits:2 });
      expect(html).toContain('x '+format.format(0));
      expect(html).not.toContain('x '+format.format(-0));
    }
  });
  test('anchors endpoint tick labels into the SVG viewport in both locales', () => {
    for (const locale of ['en', 'es'] as const) {
      const html = renderToStaticMarkup(createElement(SecretaryLimitCurve, { title:'Limit', labels, locale }));
      expect(html).toMatch(/<text x="47" y="227" text-anchor="start"/);
      expect(html).toMatch(/<text x="446" y="227" text-anchor="end"/);
      expect(html).toMatch(/<text x="246.5" y="227" text-anchor="middle"/);
    }
  });
  test('rejects a false domain or incomplete localized interface before rendering', () => {
    for (const x of [-.1, 1.1, NaN, Infinity]) expect(() => secretaryLimitValue(x)).toThrow();
    for (const initialPercent of [-1, 101, 3.5, NaN]) expect(() => renderToStaticMarkup(createElement(SecretaryLimitCurve, { title:'Limit', labels, initialPercent }))).toThrow();
    expect(() => renderToStaticMarkup(createElement(SecretaryLimitCurve, { title:'Limit', labels:{ ...labels, readout:'Missing placeholders' } }))).toThrow();
  });
});
