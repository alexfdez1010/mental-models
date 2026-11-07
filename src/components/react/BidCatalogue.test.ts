import { expect, test } from 'bun:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { BidCatalogue, evaluateBidCatalogue, type BidCatalogueProps } from '@/components/react/BidCatalogue';
const states = [{ label: 'Low', value: 80, rivalBid: 70, weight: 1 }, { label: 'Middle', value: 120, rivalBid: 110, weight: 1 }, { label: 'High', value: 160, rivalBid: 150, weight: 1 }];
const bids = [0, 75, 95, 120, 155];
const render = (props: BidCatalogueProps) => renderToStaticMarkup(createElement(BidCatalogue, props));
test('exact first- and second-price profits, with winning-only burden and abstention', () => {
  const numerators = { 'first-price': [[0, 5, -15, -40, -105], [0, -15, -35, -80, -165]], 'second-price': [[0, 10, 10, 20, 30], [0, -10, -10, -20, -30]] };
  for (const rule of ['first-price', 'second-price'] as const) for (const [ci, cost] of [0, 20].entries()) for (const [i, bid] of bids.entries()) {
    const r = evaluateBidCatalogue(states, bid, rule, cost);
    expect(r.overallProfit).toEqual({ numerator: numerators[rule][ci][i], denominator: 3 });
    expect(r.winProbability).toEqual({ numerator: [0, 1, 1, 2, 3][i], denominator: 3 });
    for (const row of r.rows) { expect(row.payment).toBe(row.awarded ? rule === 'first-price' ? bid : row.rivalBid : 0); expect(row.cost).toBe(row.awarded ? cost : 0); }
  }
});
test('zero is abstention; no-award conditional means are undefined, not zero', () => {
  const zero = evaluateBidCatalogue([{ label: 'Zero rival', value: 10, rivalBid: 0, weight: 1 }], 0, 'second-price', 20);
  expect(zero.conditionalValue).toBeNull(); expect(zero.conditionalPayment).toBeNull(); expect(zero.conditionalProfit).toBeNull(); expect(zero.rows[0].awarded).toBe(false); expect(zero.overallProfit.numerator).toBe(0);
});
test('we lose ties, and conditional averages use winning weights only', () => {
  for (const [bid, wins] of [[70, 0], [110, 1], [150, 2]]) expect(evaluateBidCatalogue(states, bid, 'first-price').winProbability.numerator).toBe(wins);
  const weighted = evaluateBidCatalogue([{ label: 'Low', value: 50, rivalBid: 40, weight: 3 }, { label: 'High', value: 110, rivalBid: 100, weight: 1 }], 45, 'first-price');
  expect(weighted.priorValue).toEqual({ numerator: 260, denominator: 4 }); expect(weighted.conditionalValue).toEqual({ numerator: 150, denominator: 3 }); expect(weighted.conditionalProfit).toEqual({ numerator: 15, denominator: 3 }); expect(weighted.overallProfit).toEqual({ numerator: 15, denominator: 4 });
});
test('native select, common signed scale, exact fractions, localized chrome and reduced motion', () => {
  const html = render({ states, bids, paymentRule: 'first-price', initialBid: 120, locale: 'es', profitLimit: 60 });
  expect(html).toContain('<select'); expect(html.match(/<option/g)?.length).toBe(5); expect(html).toContain('aria-live="polite"'); expect(html).toContain('aria-atomic="true"'); expect(html).toContain('not-prose'); expect(html).toContain('motion-reduce:transition-none'); expect(html).toContain('-40/3 (≈ -13,33) créditos'); expect(html).toContain('Primer precio'); expect(html).toContain('scaleX(0.5833333333333334)'); expect(html).not.toMatch(/NaN|undefined|Our candidate|Not awarded/);
});
test('rejects malformed hidden states, rules, menus, clipping and unsafe arithmetic before hooks', () => {
  const good = { states, bids, paymentRule: 'first-price' as const };
  for (const bad of [NaN, Infinity, -1, 1.5]) expect(() => render({ ...good, states: [states[0], { ...states[1], value: bad }] })).toThrow('BidCatalogue: state 1');
  const sparseStates = states.slice(); delete sparseStates[1]; const sparseBids = [0, 75]; delete sparseBids[1];
  expect(() => render({ ...good, states: sparseStates })).toThrow('BidCatalogue: state 1'); expect(() => render({ ...good, bids: sparseBids })).toThrow('BidCatalogue: bids');
  expect(() => render({ ...good, states: [{ ...states[0], weight: 0 }] })).toThrow('BidCatalogue: state 0');
  expect(() => render({ ...good, states: [{ ...states[0], label: ' ' }] })).toThrow('BidCatalogue: state 0');
  expect(() => render({ ...good, bids: [75, 95] })).toThrow('BidCatalogue: bids'); expect(() => render({ ...good, bids: [0, 75, 75] })).toThrow('BidCatalogue: bids');
  expect(() => render({ ...good, initialBid: 5 })).toThrow('BidCatalogue: initialBid'); expect(() => render({ ...good, profitLimit: 1 })).toThrow('BidCatalogue: profitLimit');
  expect(() => evaluateBidCatalogue(states, 75, 'invalid' as never)).toThrow('BidCatalogue: paymentRule'); expect(() => evaluateBidCatalogue(states, 75, 'first-price', -1)).toThrow('BidCatalogue: bid and winningCost');
  expect(() => evaluateBidCatalogue([{ ...states[0], weight: Number.MAX_SAFE_INTEGER }], 75, 'first-price')).toThrow('BidCatalogue: weighted arithmetic');
});
