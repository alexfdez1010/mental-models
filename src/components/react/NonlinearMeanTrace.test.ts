import { describe, expect, test } from 'bun:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { NonlinearMeanTrace, computeNonlinearMeans, type NonlinearMeanCase, type NonlinearMeanLabels, type NonlinearMeanRatio, type NonlinearResponse } from '@/components/react/NonlinearMeanTrace';

const labels: NonlinearMeanLabels = {
  case: 'Supplied case', view: 'Show operations', both: 'Both orders', transformFirst: 'Transform each, then average', averageFirst: 'Average, then transform', reset: 'Reset diagram',
  chart: 'Curve and two weighted operations', chartDescription: 'The markers share the weighted mean input but can have different response heights.', inputAxis: 'Input', responseAxis: 'Response', rule: 'Rule', domain: 'Domain',
  table: 'Inputs, normalized weights and responses', input: 'Input', weight: 'Weight', share: 'Normalized weight', response: 'Response', weightedResponse: 'Weighted response', totalWeight: 'Total weight',
  meanInput: 'Mean input', responseAtMean: 'Response at the mean', meanResponse: 'Mean response', gap: 'Mean response minus response at the mean', equal: 'The two response markers coincide.', positiveSupport: 'Only positive-weight inputs are plotted.',
  curveLegend: 'Curve: response rule', responseAtMeanLegend: 'Response at the mean', meanResponseLegend: 'Mean of the responses',
};
const responses: NonlinearResponse[] = ['square', 'affine', 'concave-square', 'hinge-2', 'hinge-3', 'hinge-4', 'capped-square'];
const make = (response: NonlinearResponse = 'square', points = [{ value: 2, weight: 3 }, { value: 6, weight: 1 }]): NonlinearMeanCase => ({ id: 'main', label: 'Constructed case', response, points, inputUnit: 'jobs', responseUnit: 'staff·min' });
const props = (cases = [make()]) => ({ title: 'Two orders on one law', instructions: 'Select the operation guides; the supplied weights stay fixed.', cases, labels });
const render = (cases = [make()], locale: 'en' | 'es' = 'en') => renderToStaticMarkup(createElement(NonlinearMeanTrace, { ...props(cases), locale }));
// Independent rational operations use BigInt and evaluate a quotient directly.
interface R { n: bigint; d: bigint }
const frac = (n: number | bigint, d: number | bigint = 1): R => ({ n: BigInt(n), d: BigInt(d) });
const add = (a: R, b: R): R => ({ n: a.n * b.d + b.n * a.d, d: a.d * b.d });
const sub = (a: R, b: R): R => ({ n: a.n * b.d - b.n * a.d, d: a.d * b.d });
const mul = (a: R, b: R): R => ({ n: a.n * b.n, d: a.d * b.d });
const evalR = (response: NonlinearResponse, x: R): R => {
  if (response === 'square') return mul(x, x);
  if (response === 'affine') return add(frac(3), mul(frac(2), x));
  if (response === 'concave-square') return sub(frac(36), mul(x, x));
  if (response === 'capped-square') { const v = mul(x, x); return v.n <= 9n * v.d ? v : frac(9); }
  const v = sub(x, frac(Number(response.at(-1)))); return v.n > 0n ? v : frac(0);
};
function oracle(points: { value: number; weight: number }[], response: NonlinearResponse) {
  const w = points.reduce((a, p) => a + p.weight, 0), mean = points.reduce((a, p) => add(a, mul(frac(p.value), frac(p.weight, w))), frac(0)), expected = points.reduce((a, p) => add(a, mul(evalR(response, frac(p.value)), frac(p.weight, w))), frac(0));
  return { meanInput: mean, meanResponse: expected, responseAtMean: evalR(response, mean), gap: sub(expected, evalR(response, mean)) };
}
function same(actual: NonlinearMeanRatio, expected: R) { expect(BigInt(actual.numerator) * expected.d).toBe(expected.n * BigInt(actual.denominator)); }

describe('NonlinearMeanTrace bounded arithmetic', () => {
  test('checks all seven responses on the complete bounded two-row integer grid', () => {
    for (let x = 0; x <= 6; x++) for (let y = 0; y <= 6; y++) for (let a = 0; a <= 8; a++) for (let b = 0; b <= 8; b++) {
      if (a + b === 0) continue;
      const points = [{ value: x, weight: a }, { value: y, weight: b }];
      for (const response of responses) {
        const actual = computeNonlinearMeans(points, response), expected = oracle(points, response);
        for (const key of ['meanInput', 'meanResponse', 'responseAtMean', 'gap'] as const) same(actual[key], expected[key]);
        expect(Number.isSafeInteger(actual.gap.numerator)).toBe(true);
        if (response === 'square') expect(actual.gap.numerator >= 0).toBe(true);
        if (response === 'concave-square') expect(actual.gap.numerator <= 0).toBe(true);
        if (response === 'affine') expect(actual.gap.numerator).toBe(0);
      }
    }
  });

  test('retains singleton, duplicate, zero-weight and maximum-weight cases exactly', () => {
    const samples = [[{ value: 3, weight: 1 }], [{ value: 1, weight: 1 }, { value: 3, weight: 1 }], [{ value: 0, weight: 1 }, { value: 6, weight: 0 }], [{ value: 0, weight: 2 }, { value: 2, weight: 1 }, { value: 6, weight: 1 }], Array.from({ length: 6 }, () => ({ value: 6, weight: 8 }))];
    for (const points of samples) for (const response of responses) { const actual = computeNonlinearMeans(points, response), expected = oracle(points, response); for (const key of ['meanInput', 'meanResponse', 'responseAtMean', 'gap'] as const) same(actual[key], expected[key]); }
    expect(computeNonlinearMeans(samples[4]!, 'square').totalWeight).toBe(48);
    expect(computeNonlinearMeans(samples[4]!, 'square').responseAtMean.numerator).toBe(82944);
    expect(computeNonlinearMeans(samples[1]!, 'hinge-4').gap.numerator).toBe(0);
    expect(computeNonlinearMeans(make().points, 'capped-square').gap.numerator < 0).toBe(true);
    expect(computeNonlinearMeans(make().points, 'square').gap.numerator).toBe(48);
  });

  test('has exact opposite hinge rankings at equal mean and variance', () => {
    const a = [{ value: 1, weight: 1 }, { value: 3, weight: 1 }], b = [{ value: 0, weight: 1 }, { value: 2, weight: 6 }, { value: 4, weight: 1 }];
    same(computeNonlinearMeans(a, 'hinge-2').meanResponse, frac(1, 2)); same(computeNonlinearMeans(b, 'hinge-2').meanResponse, frac(1, 4));
    same(computeNonlinearMeans(a, 'hinge-3').meanResponse, frac(0)); same(computeNonlinearMeans(b, 'hinge-3').meanResponse, frac(1, 8));
  });

  test('normalizes numeric minus zero without erasing negative or positive gaps', () => {
    const c = make('square', [{ value: -0, weight: 1 }, { value: 6, weight: -0 }]), result = computeNonlinearMeans(c.points, c.response);
    expect(Object.is(result.meanInput.numerator, -0)).toBe(false); expect(Object.is(result.gap.numerator, -0)).toBe(false);
    expect(render([c])).not.toMatch(/>-0<|>−0<|NaN|Infinity/);
    expect(computeNonlinearMeans(make().points, 'concave-square').gap.numerator).toBe(-48);
  });
});

describe('NonlinearMeanTrace rendering and boundaries', () => {
  test('plots exact shared-mean markers on fixed response-family scales', () => {
    for (const response of responses) for (const locale of ['en', 'es'] as const) {
      const c = make(response), h = render([c], locale), expected = oracle(c.points, response), yMax = response === 'affine' ? 15 : response.startsWith('hinge-') ? 6 : response === 'capped-square' ? 9 : 36, mean = Number(expected.meanInput.n) / Number(expected.meanInput.d), at = Number(expected.responseAtMean.n) / Number(expected.responseAtMean.d), avg = Number(expected.meanResponse.n) / Number(expected.meanResponse.d);
      const circle = h.match(/<circle[^>]*data-nonlinear-at-mean=""[^>]*>/)![0]!;
      expect(circle).toContain('cx="' + (72 + mean * 88) + '"'); expect(circle).toContain('cy="' + (280 - at * 240 / yMax) + '"');
      expect(h).toContain('data-nonlinear-aggregate-x="' + (72 + mean * 88) + '"'); expect(h).toContain('data-nonlinear-aggregate-y="' + (280 - avg * 240 / yMax) + '"'); expect(h).toContain('data-nonlinear-y-max="' + yMax + '"');
      const points = h.match(/<polyline points="([^"]+)"/)![1]!.split(' ').map(pair => pair.split(',').map(Number)); expect(points.length).toBe(121); expect(points[0]![0]).toBe(72); expect(points.at(-1)![0]).toBe(600);
      for (const [x, y] of points) { expect(x! >= 72 && x! <= 600).toBe(true); expect(y! >= 40 && y! <= 280).toBe(true); }
      expect((h.match(/aria-live="polite"/g) ?? []).length).toBe(1); expect((h.match(/role="region"/g) ?? []).length).toBe(2); expect((h.match(/tabindex="0"/g) ?? []).length).toBe(2); expect(h).toContain('display:table;overflow:visible;margin:0');
    }
  });

  test('does not label a many-point weighted ordinate as an arbitrary chord', () => {
    const h = render([make('square', [{ value: 0, weight: 2 }, { value: 2, weight: 1 }, { value: 6, weight: 1 }])]);
    expect(h).not.toContain('data-nonlinear-chord='); expect((h.match(/data-nonlinear-support=/g) ?? []).length).toBe(3);
    const zero = render([make('square', [{ value: 0, weight: 1 }, { value: 6, weight: 0 }])]); expect(zero).not.toContain('data-nonlinear-chord='); expect((zero.match(/data-nonlinear-row=/g) ?? []).length).toBe(2); expect((zero.match(/data-nonlinear-support=/g) ?? []).length).toBe(1); expect(zero).toContain(labels.equal); expect(zero).not.toContain('data-nonlinear-gap=');
  });

  test('validates hidden cases, sparse arrays, closed formulas and all labels before hooks', () => {
    const bad: unknown[] = [[], Array(2), [make(), { ...make(), id: 'other', label: 'Other', response: 'arbitrary' }], [make(), { ...make(), label: 'Other' }], [make(), { ...make(), id: 'other' }], [{ ...make(), points: [] }], [{ ...make(), points: Array(2) }], [make('square', [{ value: 7, weight: 1 }])], [make('square', [{ value: 1.5, weight: 1 }])], [make('square', [{ value: 1, weight: -1 }])], [make('square', [{ value: 1, weight: 9 }])], [make('square', [{ value: 1, weight: 0 }])], [{ ...make(), id: '<invalid>' }], [{ ...make(), inputUnit: '' }]];
    for (const cases of bad) expect(() => render(cases as NonlinearMeanCase[])).toThrow('NonlinearMeanTrace:');
    expect(() => renderToStaticMarkup(createElement(NonlinearMeanTrace, { ...props(), locale: 'fr' as 'en' }))).toThrow('locale');
    expect(() => renderToStaticMarkup(createElement(NonlinearMeanTrace, { ...props(), labels: { ...labels, equal: '' } }))).toThrow('labels.equal');
    for (const className of [123, {}]) expect(() => renderToStaticMarkup(createElement(NonlinearMeanTrace, { ...props(), className: className as unknown as string }))).toThrow('className');
    expect(renderToStaticMarkup(createElement(NonlinearMeanTrace, { ...props(), className: '' }))).toContain('data-nonlinear-result');
  });
});
