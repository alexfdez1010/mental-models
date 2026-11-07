import { describe, expect, test } from 'bun:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { calculateFactorChain, FactorChainTrace, formatFactorChainValue, type FactorChainLabels, type FactorChainScenario } from '@/components/react/FactorChainTrace';

const scenario = (a: number[], b: number[], start = 1000): FactorChainScenario => ({ label: 'Known paths', start, unit: 'MB', chains: [{ label: 'A', factorHundredths: a }, { label: 'B', factorHundredths: b }] });
const labels: FactorChainLabels = {
  scenarioLabel: 'Comparison', stepTemplate: 'Round {step} of {total}', startLabel: 'Initial state', backLabel: 'Previous round', nextLabel: 'Next round', resetLabel: 'Start again', chainLabel: 'Schedule', previousLabel: 'Previous amount', factorLabel: 'Factor', resultLabel: 'Result', initialCellLabel: 'No operation yet', tableCaption: 'Exact current operations', chartDescription: 'Discrete period-end values on a shared fixed scale.', valueAxisLabel: 'MB', stepAxisLabel: 'Completed rounds', initialAnnouncementTemplate: '{first}; {second}.', stepAnnouncementTemplate: 'Round {step}: {first}; {second}.', precisionNote: 'Read the table for exact positive amounts, including points close to the baseline.',
};
const props = (scenarios: FactorChainScenario[]) => ({ title: 'Compare the factors', instructions: 'Inspect each completed operation.', scenarios, labels });
const decimal = (n: number, d: number, locale: 'en' | 'es' = 'en') => formatFactorChainValue({ numerator: n, denominator: d }, locale);

describe('bounded exact factor chains', () => {
  test('equal arithmetic mean rates need not preserve the product', () => {
    const input = scenario([120, 100], [110, 110]);
    const before = JSON.stringify(input);
    const result = calculateFactorChain(input);
    expect(result.values).toEqual([
      [{ numerator: 1000, denominator: 1 }, { numerator: 120000, denominator: 100 }, { numerator: 12000000, denominator: 10000 }],
      [{ numerator: 1000, denominator: 1 }, { numerator: 110000, denominator: 100 }, { numerator: 12100000, denominator: 10000 }],
    ]);
    expect(result.scaled).toEqual([[10000000, 12000000, 12000000], [10000000, 11000000, 12100000]]);
    expect(result.scaleNumerator).toBe(12100000);
    expect(JSON.stringify(input)).toBe(before);
  });
  test('order changes the intermediate base, not the product in this declared model', () => {
    const result = calculateFactorChain(scenario([120, 100], [100, 120]));
    expect(result.scaled[0]).toEqual([10000000, 12000000, 12000000]);
    expect(result.scaled[1]).toEqual([10000000, 10000000, 12000000]);
  });
  test('independent transfer uses each updated base', () => {
    const result = calculateFactorChain(scenario([125, 105], [115, 115], 800));
    expect(result.values.map(v => v.map(x => x.numerator / x.denominator))).toEqual([[800, 1000, 1050], [800, 920, 1058]]);
  });
  test('both numeric boundaries stay safe and the smallest admitted quantity stays visible', () => {
    const low = calculateFactorChain(scenario([1, 1, 1, 1], [100, 100, 100, 100], 1));
    expect(low.values[0][4]).toEqual({ numerator: 1, denominator: 100000000 });
    expect(decimal(1, 100000000)).toBe('0.00000001');
    expect(decimal(1, 100000000, 'es')).toBe('0,00000001');
    const high = calculateFactorChain(scenario([200, 200, 200, 200], [1, 1, 1, 1], 1000000));
    expect(high.values[0][4]).toEqual({ numerator: 1600000000000000, denominator: 100000000 });
    expect(high.scaled.flat().every(Number.isSafeInteger)).toBe(true);
    expect(decimal(1600000000000000, 100000000)).toBe('16,000,000');
    expect(decimal(1600000000000000, 100000000, 'es')).toBe('16.000.000');
  });
  test('decimal construction preserves an exact eighth-decimal tail near the upper range', () => {
    expect(decimal(1599999999999999, 100000000)).toBe('15,999,999.99999999');
    expect(decimal(1599999999999999, 100000000, 'es')).toBe('15.999.999,99999999');
  });
  test('zero quantities never display a negative sign in either locale', () => {
    for (const locale of ['en', 'es'] as const) {
      for (const denominator of [1, 100, 10000, 1000000, 100000000]) {
        expect(decimal(0, denominator, locale)).toBe('0');
        expect(decimal(-0, denominator, locale)).toBe('0');
      }
    }
  });
  test('rejects out-of-domain inputs, mismatched lengths and holes', () => {
    for (const start of [0, -1, 1.5, 1000001, NaN, Infinity]) expect(() => calculateFactorChain(scenario([100, 100], [100, 100], start))).toThrow();
    for (const f of [0, -1, 0.5, 201, NaN, Infinity]) expect(() => calculateFactorChain(scenario([100, f], [100, 100]))).toThrow();
    for (const a of [[], [100], [100, 100, 100, 100, 100], [100, , 100] as number[]]) expect(() => calculateFactorChain(scenario(a, [100, 100]))).toThrow();
    expect(() => calculateFactorChain(scenario([100, 100], [100, 100, 100]))).toThrow();
    const sparse = scenario([100, 100], [100, 100]); Reflect.deleteProperty(sparse.chains, 1);
    expect(() => calculateFactorChain(sparse)).toThrow();
  });
  test('validates hidden scenarios and labels before rendering hooks', () => {
    expect(() => renderToStaticMarkup(createElement(FactorChainTrace, props([scenario([100, 100], [100, 100]), scenario([100, 0], [100, 100])])))).toThrow();
    expect(() => renderToStaticMarkup(createElement(FactorChainTrace, { ...props([scenario([100, 100], [100, 100])]), labels: { ...labels, resultLabel: ' ' } }))).toThrow();
    expect(() => renderToStaticMarkup(createElement(FactorChainTrace, { ...props([scenario([100, 100], [100, 100])]), labels: { ...labels, stepTemplate: 'Missing placeholders' } }))).toThrow();
    expect(() => renderToStaticMarkup(createElement(FactorChainTrace, props([])))).toThrow();
    expect(() => renderToStaticMarkup(createElement(FactorChainTrace, props(Array(2) as FactorChainScenario[])))).toThrow();
  });
  test('initial SSR has the exact shared scale, textual table and native boundary controls', () => {
    const h = renderToStaticMarkup(createElement(FactorChainTrace, props([scenario([120, 100], [110, 110])])));
    expect(h).toContain('1,210');
    expect(h).toContain('<table');
    expect(h).toContain('Initial state');
    expect(h).toContain('aria-live="polite"');
    expect(h.match(/disabled=""/g)?.length).toBe(2);
    expect(h).not.toMatch(/NaN|Infinity|undefined/);
  });
});
