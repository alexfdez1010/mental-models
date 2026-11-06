import { describe, expect, test } from 'bun:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { VoiLab, type VoiLabProps } from '@/components/react/VoiLab';

function render(overrides: Partial<VoiLabProps>): string {
  return renderToStaticMarkup(createElement(VoiLab, {
    currencyPrefix: '',
    maxCost: 200,
    maxPayoff: 2000,
    worthItVerdict: 'ACCEPT_{net}',
    overpricedVerdict: 'REJECT_{net}',
    worthlessVerdict: 'UNCHANGED_{net}',
    ...overrides,
  }));
}

function stats(html: string): string[] {
  return [...html.matchAll(/<dd\b[^>]*>([^<]*)<\/dd>/g)].map(match => match[1]!);
}

const highPrior: Partial<VoiLabProps> = {
  initialPrior: 95,
  initialReliability: 90,
  initialGain: 100,
  initialLoss: 1900,
};

describe('VoiLab decision boundaries', () => {
  test('treats an exact 76-minute information value and cost as a tie', () => {
    // 0.95×0.90×100 − 0.05×0.10×1900 = 76; no-test value is zero.
    const html = render({ ...highPrior, initialCost: 76 });
    expect(html).toContain('ACCEPT_0');
    expect(html).not.toContain('REJECT_');
    expect(html).not.toContain('−0');
    expect(stats(html)).toEqual(['95', '76', '0']);
  });

  test('retains the other exact tie at 92 minutes', () => {
    const html = render({ initialPrior: 40, initialReliability: 80, initialGain: 400, initialLoss: 300, initialCost: 92 });
    expect(html).toContain('ACCEPT_0');
    expect(stats(html)).toEqual(['160', '92', '0']);
  });

  test('does not turn a genuine sub-minute loss into an economic tie', () => {
    const html = render({ ...highPrior, initialCost: 76.000001 });
    expect(html).toContain('REJECT_0');
    expect(html).not.toContain('ACCEPT_');
    expect(html).not.toContain('−0');
    expect(stats(html)).toEqual(['95', '76', '0']);
  });

  test('does not let an unused large loss erase a visible negative net', () => {
    const html = render({ initialPrior: 99, initialReliability: 100, initialGain: 100, initialLoss: 1e16, initialCost: 100, maxPayoff: 1e16 });
    expect(stats(html)).toEqual(['99', '99', '−1']);
    expect(html).toContain('REJECT_−1');
    expect(html).not.toContain('ACCEPT_');
  });

  test('does not erase a real cost when information value is exactly zero above a huge baseline', () => {
    const html = render({ initialPrior: 100, initialReliability: 100, initialGain: 1e16, initialLoss: 100, initialCost: 1, maxPayoff: 1e16 });
    expect(stats(html)).toEqual(['0', '0', '−1']);
    expect(html).toContain('UNCHANGED_−1');
  });

  test('retains a small perfect-information improvement above a huge baseline', () => {
    const html = render({ initialPrior: 99, initialReliability: 100, initialGain: 1e16, initialLoss: 100, initialCost: 2, maxPayoff: 1e16 });
    expect(stats(html)).toEqual(['1', '1', '−1']);
    expect(html).toContain('REJECT_−1');
  });

  test('recognizes a small information-price tie above a huge baseline', () => {
    const html = render({ initialPrior: 99, initialReliability: 100, initialGain: 1e16, initialLoss: 100, initialCost: 1, maxPayoff: 1e16 });
    expect(stats(html)).toEqual(['1', '1', '0']);
    expect(html).toContain('ACCEPT_0');
  });

  test('does not charge a large unchanged policy against its tiny information value', () => {
    const html = render({ initialPrior: 99, initialReliability: 50, initialGain: 1e16, initialLoss: 100, initialCost: 1, maxPayoff: 1e16 });
    expect(stats(html)).toEqual(['1', '0', '−1']);
    expect(html).toContain('UNCHANGED_−1');
  });

  test.each([
    [5e15 - 1, '1', 'ACCEPT_1'],
    [5e15, '0', 'ACCEPT_0'],
    [5e15 + 1, '−1', 'REJECT_−1'],
  ] as const)('preserves representable integer differences at a large information value and cost %s', (cost, net, verdict) => {
    const html = render({ initialPrior: 50, initialReliability: 100, initialGain: 1e16, initialLoss: 1e16, initialCost: cost, maxPayoff: 1e16, maxCost: 1e16 });
    expect(stats(html)).toEqual(['5000000000000000', '5000000000000000', net]);
    expect(html).toContain(verdict);
  });

  test.each([
    [1e16, 1e16 - 2, '1', 'act'],
    [1e16 - 2, 1e16, '0', 'walk away'],
  ] as const)('preserves a representable prior-action gap with gain %s and loss %s', (gain, loss, baseline, priorAction) => {
    const html = render({ initialPrior: 50, initialReliability: 100, initialGain: gain, initialLoss: loss, initialCost: 0, maxPayoff: 1e16 });
    expect(stats(html)).toEqual(['4999999999999999', '4999999999999999', '4999999999999999']);
    const bars = [...html.matchAll(/<text[^>]*font-size="10" font-weight="600"[^>]*>([^<]*)<\/text>/g)].map(match => match[1]!);
    expect(bars[0]).toBe(baseline);
    expect(html).toContain('Without a test you would ' + priorAction + '.');
  });

  test.each([
    [1e16, 3e16 - 8, '1', 'walk away/act/walk away'],
    [1e16, 3e16 + 8, '0', 'walk away/walk away/walk away'],
    [3e16 - 8, 1e16, '1', 'act/act/walk away'],
    [3e16 + 8, 1e16, '0', 'act/act/act'],
  ] as const)('preserves a representable conditional-action gap with gain %s and loss %s', (gain, loss, informationValue, actions) => {
    const html = render({ initialPrior: 50, initialReliability: 75, initialGain: gain, initialLoss: loss, initialCost: 0, maxPayoff: 3e16 + 8, decisionTemplate: '{prior}/{posAction}/{negAction}' });
    expect(stats(html)[1]).toBe(informationValue);
    expect(stats(html)[2]).toBe(informationValue);
    expect(html).toContain(actions);
  });

  test('keeps a report-action tie uninformative instead of inventing a tiny gain', () => {
    const html = render({ initialPrior: 20, initialReliability: 75, initialGain: 400, initialLoss: 300, initialCost: 0 });
    expect(stats(html)).toEqual(['80', '0', '0']);
    expect(html).toContain('UNCHANGED_0');
  });

  test('retains a resolvable loss close to the ordinary-scale tie', () => {
    const html = render({ ...highPrior, initialCost: 76.000000000001 });
    expect(html).toContain('REJECT_0');
    expect(html).not.toContain('ACCEPT_');
  });

  test.each([
    [75, 'ACCEPT_0'],
    [76, 'ACCEPT_0'],
    [77, 'REJECT_0'],
  ] as const)('preserves the economic comparison after common payoff/cost scaling at %i', (cost, verdict) => {
    const scale = 1e-18;
    const html = render({ ...highPrior, initialGain: 100 * scale, initialLoss: 1900 * scale, initialCost: cost * scale });
    expect(html).toContain(verdict);
    expect(html).not.toContain('−0');
  });

  test('preserves visible gains and losses around the boundary', () => {
    const gain = render({ ...highPrior, initialCost: 75 });
    const loss = render({ ...highPrior, initialCost: 77 });
    expect(gain).toContain('ACCEPT_1');
    expect(loss).toContain('REJECT_−1');
    expect(stats(gain)).toEqual(['95', '76', '1']);
    expect(stats(loss)).toEqual(['95', '76', '−1']);
  });

  test.each([
    [70, 8, ['70', '13', '5']],
    [80, 16, ['70', '32', '16']],
    [90, 38, ['70', '51', '13']],
  ] as const)('preserves the protocol comparison at %i percent reliability', (reliability, cost, expected) => {
    const html = render({ initialPrior: 30, initialReliability: reliability, initialGain: 400, initialLoss: 100, initialCost: cost });
    expect(stats(html)).toEqual([...expected]);
    expect(html).toContain('ACCEPT_');
  });

  test('preserves an uninformative test and its real cost', () => {
    const html = render({ initialPrior: 30, initialReliability: 60, initialGain: 400, initialLoss: 100, initialCost: 5 });
    expect(html).toContain('UNCHANGED_−5');
    expect(stats(html)).toEqual(['70', '0', '−5']);
  });

  test.each([0, 100])('ignores an impossible report at a certain %i-percent prior', initialPrior => {
    const html = render({ initialPrior, initialReliability: 100, initialGain: 400, initialLoss: 300, initialCost: 5 });
    expect(html).toContain('UNCHANGED_−5');
    expect(stats(html)).toEqual(['0', '0', '−5']);
  });

  test('preserves the review case and its cost reversal', () => {
    const base = { initialPrior: 75, initialReliability: 80, initialGain: 20, initialLoss: 40 };
    expect(stats(render({ ...base, initialCost: 3 }))).toEqual(['10', '5', '2']);
    expect(render({ ...base, initialCost: 6 })).toContain('REJECT_−1');
  });

  test('preserves valuable information at a 97-percent prior', () => {
    const html = render({ ...highPrior, initialPrior: 97, initialCost: 16 });
    expect(stats(html)).toEqual(['57', '42', '26']);
    expect(html).toContain('ACCEPT_26');
  });
});
