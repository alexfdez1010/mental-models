import { describe, expect, test } from 'bun:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { GeometricThresholdTrace, auditGeometricThresholdTrace, calculateGeometricThresholdScenario, formatGeometricRational, type GeometricThresholdScenario, type GeometricThresholdTraceProps } from '@/components/react/GeometricThresholdTrace';

const scenarios: GeometricThresholdScenario[] = [
  { id: 'grow-eight', label: 'Growth at eight percent', start: 100, factorNumerator: 27, factorDenominator: 25, maxSteps: 12, targetNumerator: 2, targetDenominator: 1, comparison: 'atLeast' },
  { id: 'decline-eight', label: 'Direct decline at eight percent', start: 100, factorNumerator: 23, factorDenominator: 25, maxSteps: 12, targetNumerator: 1, targetDenominator: 2, comparison: 'atMost' },
  { id: 'prices-eight', label: 'Reciprocal of prices growing eight percent', start: 100, factorNumerator: 25, factorDenominator: 27, maxSteps: 12, targetNumerator: 1, targetDenominator: 2, comparison: 'atMost' },
  { id: 'grow-twenty-four', label: 'Growth at twenty-four percent', start: 100, factorNumerator: 31, factorDenominator: 25, maxSteps: 4, targetNumerator: 2, targetDenominator: 1, comparison: 'atLeast' },
];
const transfer: GeometricThresholdScenario = { id: 'transfer-twelve', label: 'New initial quantity and rate', start: 250, factorNumerator: 28, factorDenominator: 25, maxSteps: 8, targetNumerator: 2, targetDenominator: 1, comparison: 'atLeast' };
const ideal: GeometricThresholdScenario = { id: 'ideal-nine-period-block', label: 'Exact doubling per nine-period block', start: 1000, factorNumerator: 2, factorDenominator: 1, maxSteps: 5, targetNumerator: 2, targetDenominator: 1, comparison: 'atLeast' };
function fixture(): GeometricThresholdTraceProps {
  return { title: 'Check completed steps against a target', instructions: 'Choose a declared scenario and inspect a completed step.', unit: 'u', scaleMax: 300, scenarios: structuredClone(scenarios), labels: {
    scenarioLabel: 'Scenario', stepLabel: 'Completed step', startLabel: 'Initial quantity', previousLabel: 'Previous step', nextLabel: 'Next step', resetLabel: 'Reset step', valueLabel: 'Quantity', targetLabel: 'Target', stepAxisLabel: 'Horizontal axis: completed steps', valueAxisLabel: 'Vertical axis: quantity', tableCaption: 'All declared completed steps', stepColumnLabel: 'Step', valueColumnLabel: 'Quantity', statusColumnLabel: 'Exact target condition', meetsTargetLabel: 'Meets the declared condition', belowTargetLabel: 'Below target', aboveTargetLabel: 'Above target', firstCrossingTemplate: 'First qualifying step in this window: {step}.', notReachedLabel: 'No qualifying completed step through {max}.', chartDescription: 'Points are completed steps; joining segments are visual guides, not fractional postings.', precisionNote: 'Quantities are displayed to four decimal places. Exact fractions decide the target condition.',
  } };
}
// Independent oracle uses direct integer powers; production reduces an iterative recurrence.
function oracle(s: GeometricThresholdScenario) {
  const targetN = BigInt(s.start) * BigInt(s.targetNumerator), targetD = BigInt(s.targetDenominator), points = [];
  for (let k = 0; k <= s.maxSteps; k++) {
    const n = BigInt(s.start) * BigInt(s.factorNumerator) ** BigInt(k), d = BigInt(s.factorDenominator) ** BigInt(k), left = n * targetD, right = targetN * d;
    points.push({ n, d, meets: s.comparison === 'atLeast' ? left >= right : left <= right });
  }
  const index = points.findIndex(p => p.meets);
  return { targetN, targetD, points, first: index < 0 ? null : index };
}
const attrs = (tag: string) => Object.fromEntries([...tag.matchAll(/([\w-]+)="([^"]*)"/g)].map(m => [m[1]!, m[2]!]));

describe('GeometricThresholdTrace exact finite arithmetic', () => {
  test('the approved catalogue distinguishes growth, decline and reciprocal price factors', () => {
    const main = auditGeometricThresholdTrace(fixture());
    expect(main.calculations.map(s => s.firstCrossing)).toEqual([10, 9, 10, 4]); expect(main.stepMax).toBe(12); expect(main.scaleMax).toBe(300);
    const transferred = calculateGeometricThresholdScenario(transfer, 700); expect(transferred.firstCrossing).toBe(7);
    const blocks = calculateGeometricThresholdScenario(ideal, 40_000); expect(blocks.firstCrossing).toBe(1); expect(blocks.points.map(p => p.numerator / p.denominator)).toEqual([1000n, 2000n, 4000n, 8000n, 16000n, 32000n]);
    for (const [i, s] of [...scenarios, transfer, ideal].entries()) {
      const a = calculateGeometricThresholdScenario(s, i === 4 ? 700 : i === 5 ? 40_000 : 300), e = oracle(s);
      expect(a.points.length).toBe(s.maxSteps + 1); expect(a.firstCrossing).toBe(e.first);
      for (let k = 0; k < a.points.length; k++) { const p = a.points[k]!, o = e.points[k]!; expect(p.numerator * o.d).toBe(o.n * p.denominator); expect(p.meetsTarget).toBe(o.meets); expect(p.step).toBe(k); }
    }
    expect(formatGeometricRational(main.calculations[0]!.points[9]!.numerator, main.calculations[0]!.points[9]!.denominator)).toBe('199.9005');
    expect(main.calculations[0]!.points[9]!.meetsTarget).toBe(false); expect(main.calculations[0]!.points[10]!.meetsTarget).toBe(true);
    expect(main.calculations[1]!.points[8]!.meetsTarget).toBe(false); expect(main.calculations[1]!.points[9]!.meetsTarget).toBe(true);
    expect(main.calculations[2]!.points[9]!.meetsTarget).toBe(false); expect(main.calculations[2]!.points[10]!.meetsTarget).toBe(true);
  });

  test('direct powers independently cover varied valid and overscale finite catalogues', () => {
    let valid = 0, rejected = 0;
    for (const start of [1, 17, 100, 1_000_000]) for (const fn of [1, 3, 23, 25, 27, 31, 200]) for (const fd of [1, 3, 23, 25, 27, 31, 200]) for (const [tn, td] of [[1, 2], [1, 1], [2, 1], [200, 1]]) for (const maxSteps of [1, 4, 12, 24]) for (const comparison of ['atLeast', 'atMost'] as const) {
      const s: GeometricThresholdScenario = { id: 'varied', label: 'Varied declared scenario', start, factorNumerator: fn, factorDenominator: fd, targetNumerator: tn!, targetDenominator: td!, maxSteps, comparison }, e = oracle(s), scaleMax = 1_000_000_000;
      const over = e.targetN > BigInt(scaleMax) * e.targetD || e.points.some(p => p.n > BigInt(scaleMax) * p.d);
      if (over) { expect(() => calculateGeometricThresholdScenario(s, scaleMax)).toThrow('GeometricThresholdTrace:'); rejected++; continue; }
      const a = calculateGeometricThresholdScenario(s, scaleMax); expect(a.firstCrossing).toBe(e.first); expect(a.target.numerator * e.targetD).toBe(e.targetN * a.target.denominator);
      for (let i = 0; i < a.points.length; i++) { const p = a.points[i]!, o = e.points[i]!; expect(p.numerator * o.d).toBe(o.n * p.denominator); expect(p.meetsTarget).toBe(o.meets); expect(p.numerator <= BigInt(scaleMax) * p.denominator).toBe(true); }
      valid++;
    }
    expect(valid).toBeGreaterThan(3_000); expect(rejected).toBeGreaterThan(500); expect(valid + rejected).toBe(6_272);
  });

  test('both inclusive directions, step zero, constant factors and window limits remain distinct', () => {
    const s: GeometricThresholdScenario = { ...scenarios[0]!, start: 1, factorNumerator: 1, factorDenominator: 1, targetNumerator: 1, targetDenominator: 1, maxSteps: 24 };
    for (const comparison of ['atLeast', 'atMost'] as const) { const a = calculateGeometricThresholdScenario({ ...s, comparison }, 2); expect(a.firstCrossing).toBe(0); expect(a.points.every(p => p.meetsTarget)).toBe(true); }
    expect(calculateGeometricThresholdScenario({ ...s, targetNumerator: 2 }, 2).firstCrossing).toBeNull();
    expect(calculateGeometricThresholdScenario({ ...s, factorNumerator: 2, maxSteps: 1, targetNumerator: 2 }, 2).firstCrossing).toBe(1);
    expect(calculateGeometricThresholdScenario({ ...s, factorDenominator: 2, maxSteps: 1, targetDenominator: 2, comparison: 'atMost' }, 2).firstCrossing).toBe(1);
    const decreasing = calculateGeometricThresholdScenario({ ...s, factorDenominator: 2, targetDenominator: 2, maxSteps: 2 }, 2); expect(decreasing.firstCrossing).toBe(0); expect(decreasing.points.map(p => p.meetsTarget)).toEqual([true, true, false]);
    // These two values both display as0.9900, yet the point remains strictly ABOVE the target.
    const close = calculateGeometricThresholdScenario({ ...s, factorNumerator: 199, factorDenominator: 200, targetNumerator: 99, targetDenominator: 100, comparison: 'atMost', maxSteps: 2 }, 1), point = close.points[2]!;
    expect(formatGeometricRational(point.numerator, point.denominator)).toBe('0.9900'); expect(formatGeometricRational(close.target.numerator, close.target.denominator)).toBe('0.9900'); expect(point.meetsTarget).toBe(false); expect(close.firstCrossing).toBeNull();
    // No expected answer supplied by a caller can override the derived crossing.
    expect(calculateGeometricThresholdScenario({ ...scenarios[0]!, ...{ firstCrossing: 0 } }, 300).firstCrossing).toBe(10);
  });

  test('four-place half-up display handles ties, carry, BigInt grouping and locale without negative zero', () => {
    const rows: [bigint, bigint, string, string][] = [[0n, 7n, '0.0000', '0,0000'], [1n, 3n, '0.3333', '0,3333'], [1n, 20_000n, '0.0001', '0,0001'], [3n, 20_000n, '0.0002', '0,0002'], [1n, 20_001n, '0.0000', '0,0000'], [199_999n, 20_000n, '10.0000', '10,0000'], [123_456_789n, 10_000n, '12,345.6789', '12.345,6789'], [10n ** 30n, 1n, '1,000,000,000,000,000,000,000,000,000,000.0000', '1.000.000.000.000.000.000.000.000.000.000,0000']];
    for (const [n, d, en, es] of rows) { expect(formatGeometricRational(n, d)).toBe(en); expect(formatGeometricRational(n, d, 'en')).toBe(en); expect(formatGeometricRational(n, d, 'es')).toBe(es); }
    for (const [n, d] of [[-1n, 2n], [1n, 0n], [1n, -2n], [1, 2n], [1n, 2], [NaN, Infinity]]) expect(() => formatGeometricRational(n as bigint, d as bigint)).toThrow('GeometricThresholdTrace:');
    expect(() => formatGeometricRational(1n, 2n, 'fr' as 'en')).toThrow('GeometricThresholdTrace:');
  });

  test('SSR exposes complete tables, fixed scales, native controls and exactly one live result', () => {
    for (let i = 0; i < scenarios.length; i++) {
      const p = fixture(); p.scenarios = [p.scenarios[i]!, ...p.scenarios.filter((_, j) => j !== i)]; const h = renderToStaticMarkup(createElement(GeometricThresholdTrace, p)), a = calculateGeometricThresholdScenario(p.scenarios[0]!, p.scaleMax);
      expect((h.match(/<select /g) ?? []).length).toBe(1); expect((h.match(/role="region"/g) ?? []).length).toBe(2); expect((h.match(/tabindex="0"/g) ?? []).length).toBe(2); expect((h.match(/role="status"/g) ?? []).length).toBe(1); expect((h.match(/aria-live="polite"/g) ?? []).length).toBe(1);
      expect(h).toContain('data-step-max="12"'); expect(h).toContain('data-value-max="300"'); expect(h).toContain('min-w-[36rem]'); expect(h).toContain('display:table;overflow:visible;margin:0'); expect(h).toContain('background-color:var(--color-brand-100)'); expect(h).toContain('aria-current="true"');
      expect(h).toContain('type="range" min="0"'); expect(h).toContain('max="' + p.scenarios[0]!.maxSteps + '"'); expect((h.match(/data-geometric-row=/g) ?? []).length).toBe(a.points.length); expect((h.match(/data-geometric-point=/g) ?? []).length).toBe(a.points.length);
      const plot = attrs(h.match(/<svg[^>]*data-geometric-plot[^>]*>/)![0]!); expect(plot['viewBox']).toBe('0 0 560 320');
      const last = attrs([...h.matchAll(/<circle[^>]*data-geometric-point[^>]*>/g)].at(-1)![0]); expect(Number(last['cx'])).toBe(174 + p.scenarios[0]!.maxSteps / 12 * 362); expect(Number(last['cy'])).toBeGreaterThanOrEqual(24); expect(Number(last['cy'])).toBeLessThanOrEqual(268);
      expect(h).toContain(p.labels.firstCrossingTemplate.replace('{step}', String(a.firstCrossing))); expect(h).not.toContain('NaN'); expect(h).not.toContain('undefined');
    }
    const p = fixture(); p.scenarios = [transfer]; p.scaleMax = 700; p.locale = 'es'; p.title = 'Traza de pasos completos'; p.instructions = 'Inspecciona un paso completo.'; p.unit = 'u'; for (const key of Object.keys(p.labels) as (keyof typeof p.labels)[]) p.labels[key] = key === 'firstCrossingTemplate' ? 'Primer paso que cumple: {step}.' : key === 'notReachedLabel' ? 'No se alcanza hasta el paso {max}.' : 'Etiqueta ' + key;
    const h = renderToStaticMarkup(createElement(GeometricThresholdTrace, p)); expect(h).not.toContain('<select'); expect(h).toContain('250,0000'); expect(h).toContain('500,0000'); expect(h).toContain('data-step-max="8"'); expect(h).toContain('data-value-max="700"'); expect(h).toContain('Primer paso que cumple: 7.'); expect(h).not.toContain('250.0000');
  });

  test('invalid selected or hidden scenarios and labels fail before hooks', () => {
    const invalid: Array<(p: GeometricThresholdTraceProps) => void> = [p => { p.title = ''; }, p => { p.instructions = ' '; }, p => { p.unit = ' u'; }, p => { Object.assign(p, { locale: 'fr' }); }, p => { Object.assign(p, { locale: null }); }, p => { Object.assign(p, { className: 3 }); }, p => { p.scenarios = []; }, p => { p.scenarios = Array.from({ length: 9 }, (_, i) => ({ ...scenarios[0]!, id: String(i), label: String(i) })); }, p => { delete p.scenarios[3]; }, p => { p.scenarios[3] = null as unknown as GeometricThresholdScenario; }, p => { p.scenarios[3] = Object.create(p.scenarios[3]); }, p => { p.scenarios[3]!.id = p.scenarios[0]!.id; }, p => { p.scenarios[3]!.label = p.scenarios[0]!.label; }, p => { p.scenarios[3]!.id = ' bad'; }, p => { p.scenarios[3]!.label = ''; }, p => { p.scenarios[3]!.comparison = 'above' as 'atLeast'; }, p => { p.labels = Object.create(p.labels); }, p => { p.labels.firstCrossingTemplate = 'No token'; }, p => { p.labels.firstCrossingTemplate += ' {step}'; }, p => { p.labels.firstCrossingTemplate += ' {max}'; }, p => { p.labels.notReachedLabel = '{step}'; }, p => { p.labels.notReachedLabel += ' {}'; }, p => { p.scaleMax = 100; }, p => { p.scenarios[3]!.start = 301; }, p => { p.scenarios[3]!.factorNumerator = 200; }, p => { p.scenarios[3]!.targetNumerator = 4; }];
    for (const value of [0, -1, 1.5, NaN, Infinity, 1_000_000_001, Number.MAX_SAFE_INTEGER + 1, '300', 300n, undefined]) invalid.push(p => { Object.assign(p, { scaleMax: value }); });
    const maximums = { start: 1_000_000, factorNumerator: 200, factorDenominator: 200, maxSteps: 24, targetNumerator: 200, targetDenominator: 200 };
    for (const [key, maximum] of Object.entries(maximums)) for (const value of [0, -1, 1.5, NaN, Infinity, maximum + 1, Number.MAX_SAFE_INTEGER + 1, '2', 2n, undefined]) invalid.push(p => { Object.assign(p.scenarios[3]!, { [key]: value }); });
    for (const key of Object.keys(fixture().labels) as (keyof GeometricThresholdTraceProps['labels'])[]) { invalid.push(p => { p.labels[key] = ''; }); invalid.push(p => { delete (p.labels as Partial<typeof p.labels>)[key]; }); }
    for (const mutation of invalid) { const p = fixture(); mutation(p); expect(() => GeometricThresholdTrace(p)).toThrow('GeometricThresholdTrace:'); expect(() => renderToStaticMarkup(createElement(GeometricThresholdTrace, p))).toThrow('GeometricThresholdTrace:'); }
    for (const value of [null, undefined, [], {}, 'bad']) expect(() => GeometricThresholdTrace(value as unknown as GeometricThresholdTraceProps)).toThrow('GeometricThresholdTrace:');
    expect(invalid.length).toBeGreaterThan(130);
  });
});
