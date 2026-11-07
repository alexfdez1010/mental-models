import { describe, expect, test } from 'bun:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AggregationTrace, evaluateAggregationCase, type AggregationCase, type AggregationTraceLabels } from '@/components/react/AggregationTrace';

const main: AggregationCase = {
  id: 'main', label: 'Completed export attempts',
  strata: [{ id: 'routine', label: 'Routine' }, { id: 'complex', label: 'Complex' }],
  options: [{ id: 'a', label: 'A', cells: [{ events: 9, total: 10 }, { events: 36, total: 90 }] },
    { id: 'b', label: 'B', cells: [{ events: 72, total: 90 }, { events: 3, total: 10 }] }],
  references: [{ id: 'half', label: 'Half of each stratum', weights: [1, 1] },
    { id: 'quarter', label: 'One quarter routine', weights: [1, 3] },
    { id: 'all-routine', label: 'All routine', weights: [1, 0] }],
};
const crossing: AggregationCase = { ...structuredClone(main), id: 'crossing', label: 'Crossing conditional rates',
  options: [{ id: 'x', label: 'X', cells: [{ events: 9, total: 10 }, { events: 1, total: 10 }] },
    { id: 'y', label: 'Y', cells: [{ events: 6, total: 10 }, { events: 4, total: 10 }] }] };
const spanish: AggregationTraceLabels = {
  caseLabel: 'Tabla de recuentos', referenceLabel: 'Referencia común', observedHeading: 'Composición observada',
  referenceHeading: 'Índices con referencia común', observedTableLabel: 'Recuentos observados, pesos propios y aportaciones',
  referenceTableLabel: 'Los mismos pesos de referencia para ambas opciones', optionLabel: 'Opción', stratumLabel: 'Estrato',
  countsLabel: 'Éxitos / observaciones', rateLabel: 'Fracción dentro del estrato', ownWeightLabel: 'Proporción del denominador propio',
  observedContributionLabel: 'Aportación al total observado', referenceWeightLabel: 'Peso de referencia',
  referenceContributionLabel: 'Aportación al índice de referencia', observedTotalLabel: 'Total observado', referenceIndexLabel: 'Índice de referencia',
  observedDifferenceLabel: 'Diferencia observada', referenceDifferenceLabel: 'Diferencia entre índices', segmentOrderLabel: 'Segmentos de izquierda a derecha',
  pointLabel: 'punto porcentual', pointsLabel: 'puntos porcentuales', magnitudeLabel: 'en valor absoluto', tieLabel: 'Los índices de referencia son iguales.',
  higherTemplate: '{option} tiene el índice de referencia más alto.',
};
const render = (cases: AggregationCase[], es = false) => renderToStaticMarkup(createElement(AggregationTrace, { cases, title: es ? 'Compara las mezclas' : 'Compare the mixtures', ...(es ? { locale: 'es', labels: spanish } : {}) }));
const fresh = () => structuredClone(main);
function hasRatio(f: { n: bigint; d: bigint }, n: bigint, d: bigint) { expect(f.n * d).toBe(n * f.d); }

describe('exact bounded two-by-two aggregation', () => {
  test('observed weights preserve counts and differ from common indexes', () => {
    const v = evaluateAggregationCase(main);
    hasRatio(v.options[0]!.observed, 9n, 20n); hasRatio(v.options[1]!.observed, 3n, 4n);
    hasRatio(v.options[0]!.index, 13n, 20n); hasRatio(v.options[1]!.index, 11n, 20n);
    hasRatio(v.difference, 1n, 10n); hasRatio(v.observedDifference, -3n, 10n);
    hasRatio(v.options[0]!.ownWeights[0]!, 1n, 10n); hasRatio(v.options[1]!.ownWeights[0]!, 9n, 10n);
    hasRatio(v.options[0]!.observedContributions[0]!, 9n, 100n);
    hasRatio(v.options[0]!.referenceContributions[0]!, 9n, 20n);
    expect(v.comparison).toBe('first');
  });
  test('independent integer formulas cover every integer-percent common mix', () => {
    for (let i = 0; i <= 100; i++) {
      const c = fresh(); c.references = [{ id: 'w', label: 'Declared weighting units', weights: [i, 100 - i] }];
      const v = evaluateAggregationCase(c);
      hasRatio(v.options[0]!.index, BigInt(80 + i), 200n); hasRatio(v.options[1]!.index, BigInt(60 + i), 200n);
      hasRatio(v.difference, 1n, 10n); hasRatio(v.options[0]!.observed, 9n, 20n); hasRatio(v.options[1]!.observed, 3n, 4n);
      expect(v.comparison).toBe('first');
      const x = structuredClone(crossing); x.references = c.references;
      const z = evaluateAggregationCase(x);
      hasRatio(z.options[0]!.index, BigInt(50 + 4 * i), 500n); hasRatio(z.options[1]!.index, BigInt(200 + i), 500n);
      expect(z.comparison).toBe(i < 50 ? 'second' : i === 50 ? 'equal' : 'first');
    }
  });
  test('zero reference weight removes its contribution without changing observed data', () => {
    const v = evaluateAggregationCase(main, 2);
    hasRatio(v.referenceWeights[1]!, 0n, 1n); hasRatio(v.options[0]!.referenceContributions[1]!, 0n, 1n);
    hasRatio(v.options[0]!.index, 9n, 10n); expect(v.options[0]!.observations).toBe(100);
    const scaled = fresh(); scaled.references[0]!.weights = [1_000_000, 1_000_000];
    expect(evaluateAggregationCase(scaled).options.map(o => o.index)).toEqual(evaluateAggregationCase(main).options.map(o => o.index));
  });
  test('a tiny difference is not a rounded tie or an unqualified zero', () => {
    const c = fresh(); c.options[0]!.cells = [{ events: 1, total: 999983 }, { events: 1, total: 999983 }];
    c.options[1]!.cells = [{ events: 1, total: 1_000_000 }, { events: 1, total: 1_000_000 }];
    const v = evaluateAggregationCase(c); expect(v.comparison).toBe('first');
    hasRatio(v.difference, 17n, 999_983_000_000n);
    const h = render([c]); expect(h).toContain('&lt;0.01%'); expect(h).toContain('data-comparison="first"');
    expect(h).toContain('17 / 9,999,830,000 percentage points'); expect(h).not.toContain('The reference indexes are equal.');
    const es = render([c], true); expect(es).toContain('&lt;0,01%'); expect(es).not.toContain('higher reference index');
  });
  test('largest approved counts and very small positive products stay exact', () => {
    const c = fresh(); c.options[0]!.cells = [{ events: 1, total: 1_000_000 }, { events: 0, total: 1_000_000 }];
    c.options[1]!.cells = [{ events: 0, total: 1_000_000 }, { events: 0, total: 1_000_000 }];
    c.references = [{ id: 'tiny', label: 'One and one million units', weights: [1, 1_000_000] }];
    const v = evaluateAggregationCase(c); hasRatio(v.options[0]!.index, 1n, 1_000_001_000_000n);
    const h = render([c]); expect(h).toContain('data-denominator="1000001000000"'); expect(h).toContain('1 / 1,000,001,000,000 (&lt;0.01%)');
    expect(h).toContain('data-comparison="first"'); expect(h).not.toContain('NaN');
  });
});

describe('rendered learning contract', () => {
  test('exact tie, fixed bar scale and two named scroll owners', () => {
    const h = render([crossing]); expect(h).toContain('data-comparison="equal"'); expect(h).toContain('The reference indexes are equal.');
    expect((h.match(/aria-live="polite"/g) ?? []).length).toBe(1);
    expect((h.match(/role="region" tabindex="0"/g) ?? []).length).toBe(2);
    expect((h.match(/data-fixed-scale="0,1"/g) ?? []).length).toBe(4);
    expect((h.match(/display:table;overflow:visible;margin:0/g) ?? []).length).toBe(2);
    expect(h).toContain('translateX(45%) scaleX(0.05)');
  });
  test('own table is unchanged across every reference and controlled choices are honest', () => {
    let original = '';
    for (const reference of main.references) {
      const c = fresh(); c.references = [reference]; const h = render([c]);
      const observed = h.slice(h.indexOf('<table'), h.indexOf('</table>') + 8);
      if (original) expect(observed).toBe(original); else original = observed;
      expect(h).not.toContain('<select');
    }
    expect((render([main, crossing]).match(/<select/g) ?? []).length).toBe(2);
  });
  test('template insertion preserves option labels as literal data', () => {
    const c = fresh(); c.options[0]!.label = 'A {option} $&';
    expect(render([c])).toContain('A {option} $&amp; has the higher reference index.');
  });
  test('Spanish fractions/decimals and hidden labels stay Spanish', () => {
    const transfer = fresh(); transfer.options = [{ id: 'c', label: 'C', cells: [{ events: 15, total: 20 }, { events: 18, total: 60 }] }, { id: 'd', label: 'D', cells: [{ events: 42, total: 60 }, { events: 4, total: 20 }] }];
    const h = render([transfer], true); expect(h).toContain('52,5%'); expect(h).toContain('7,5');
    expect(h).toContain('puntos porcentuales'); expect(h).toContain('C tiene el índice de referencia más alto.');
    expect(h).not.toContain('Events / observations'); expect(h).not.toContain('Common reference');
    expect(h).not.toContain('higher reference index');
  });
});

describe('fail before hooks for any invalid authored entry', () => {
  test('invalid integers and complete-cell bounds, including hidden cases', () => {
    for (const value of [0, -1, 1.2, 1_000_001, Number.NaN, Infinity]) {
      const c = fresh(); c.options[0]!.cells[0]!.total = value; expect(() => render([main, c])).toThrow('AggregationTrace:');
    }
    for (const value of [-1, 1.2, 11, Number.NaN, Infinity]) {
      const c = fresh(); c.options[0]!.cells[0]!.events = value; expect(() => render([c])).toThrow('AggregationTrace:');
    }
  });
  test('all sparse arrays are rejected, not skipped by iteration', () => {
    const holes: AggregationCase[] = Array(1); expect(() => render(holes)).toThrow('missing');
    for (const key of ['strata', 'options', 'references'] as const) { const c = fresh(); delete c[key][0]; expect(() => render([c])).toThrow('missing'); }
    const a = fresh(); delete a.options[1]!.cells[1]; expect(() => render([a])).toThrow('missing');
    const b = fresh(); delete b.references[2]!.weights[0]; expect(() => render([b])).toThrow('missing');
  });
  test('shape, uniqueness, labels and reference guard every hidden branch', () => {
    expect(() => render([])).toThrow(); expect(() => render(Array.from({ length: 9 }, (_, i) => ({ ...fresh(), id: String(i), label: String(i) })))).toThrow();
    for (const key of ['strata', 'options'] as const) { const c = fresh(); c[key].pop(); expect(() => render([c])).toThrow(); }
    const duplicate = fresh(); duplicate.options[1]!.id = 'a'; expect(() => render([duplicate])).toThrow('unique');
    const duplicateLabel = fresh(); duplicateLabel.references[1]!.label = duplicateLabel.references[0]!.label; expect(() => render([duplicateLabel])).toThrow('unique');
    const blank = fresh(); blank.strata[1]!.label = ' '; expect(() => render([blank])).toThrow('nonempty');
    for (const weights of [[0, 0], [-1, 2], [1.5, 2], [1, 1_000_001], [1], [1, 2, 3]]) { const c = fresh(); c.references[2]!.weights = weights; expect(() => render([c])).toThrow('AggregationTrace:'); }
    expect(() => renderToStaticMarkup(createElement(AggregationTrace, { cases: [main], labels: { higherTemplate: 'No token' } }))).toThrow('one {option}');
    expect(() => renderToStaticMarkup(createElement(AggregationTrace, { cases: [main], labels: { caseLabel: ' ' } }))).toThrow('invalid label');
  });
});


test('supplied optional strings reject invalid runtime types before rendering hooks', () => {
  for (const key of ['title', 'caption', 'className'] as const) {
    for (const value of [42, null, false, [], { text: 'Not a string' }]) {
      const invalid = { cases: [main], [key]: value } as unknown as Parameters<typeof AggregationTrace>[0];
      expect(() => renderToStaticMarkup(createElement(AggregationTrace, invalid))).toThrow(`AggregationTrace: ${key} must be a string when supplied.`);
    }
  }
  expect(() => renderToStaticMarkup(createElement(AggregationTrace, { cases: [main], title: '', caption: '', className: '' }))).not.toThrow();
});
