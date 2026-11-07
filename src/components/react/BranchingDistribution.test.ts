import { describe, expect, test } from 'bun:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { BranchingDistribution, getBranchingDistribution } from '@/components/react/BranchingDistribution';
import type { BranchingQuarter } from '@/components/react/BranchingDistribution';

describe('exact bounded offspring distributions', () => {
  test('enumerates the critical second generation rather than putting its mass at the mean', () => {
    expect(getBranchingDistribution(2, 1, 2)).toEqual({ weights: [5, 0, 2, 0, 1], denominator: 8, meanNumerator: 1, meanDenominator: 1 });
    expect(getBranchingDistribution(2, 2, 2)).toEqual({ weights: [25, 0, 20, 0, 14, 0, 4, 0, 1], denominator: 64, meanNumerator: 2, meanDenominator: 1 });
  });
  test('all twenty-four laws have exact unit mass, correct mean and finite support', () => {
    for (const quarter of [1, 2, 3] as const) for (const founders of [1, 2] as const) for (const generation of [0, 1, 2, 3] as const) {
      const law = getBranchingDistribution(quarter, founders, generation);
      expect(law.weights.reduce((a, b) => a + b, 0)).toBe(law.denominator);
      expect(law.weights.length).toBe(founders * 2 ** generation + 1);
      expect(law.meanNumerator * 2 ** generation).toBe(founders * quarter ** generation * law.meanDenominator);
      expect(law.weights.every(Number.isSafeInteger)).toBe(true);
    }
  });
  test('rejects invalid domains instead of silently rounding or truncating', () => {
    for (const value of [0, 4, 1.5, NaN, Infinity]) expect(() => getBranchingDistribution(value as BranchingQuarter, 1, 2)).toThrow('BranchingDistribution:');
    expect(() => renderToStaticMarkup(createElement(BranchingDistribution, { title: '' }))).toThrow('title');
    expect(() => renderToStaticMarkup(createElement(BranchingDistribution, { title: 'Test', labels: { mean: '' } }))).toThrow('label');
    expect(() => renderToStaticMarkup(createElement(BranchingDistribution, { title: 'Test', labels: { toString: 'Inherited name' } as never }))).toThrow('label');
  });
  test('exposes the impossible mean, exact table and localized interface without physical claims', () => {
    const en = renderToStaticMarkup(createElement(BranchingDistribution, { title: 'Exact family' }));
    const es = renderToStaticMarkup(createElement(BranchingDistribution, { title: 'Familia exacta', locale: 'es' }));
    expect(en).toContain('not a possible outcome');
    expect(en).toContain('5/8');
    expect(es).toContain('62,5');
    expect(es).toContain('no es un resultado posible');
    expect(es).not.toContain('Expected count');
    expect(es).toContain('aria-live="polite"');
    expect(en.match(/<select/g)?.length).toBe(3);
  });
});
