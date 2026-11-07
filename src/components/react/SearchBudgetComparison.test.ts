import { describe, expect, test } from 'bun:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { SearchBudgetComparison, searchBudgetAtCost, type SearchBudgetComparisonProps } from '@/components/react/SearchBudgetComparison';

const methods = [{ id: 'AB', label: 'AB', gross: 7.5, evaluations: 2 }, { id: 'A', label: 'A only', gross: 5, evaluations: 1 }, { id: 'outside', label: 'Abstain', gross: 0, evaluations: 0 }];
const props: SearchBudgetComparisonProps = {
  title: 'Expected benefit after query costs', instructions: 'Change only query cost.', caption: 'Only these fixed protocols are compared.', methods,
  costs: [0, 1, 2.5, 3, 5, 6], initialCost: 1, unit: 'cr',
  labels: { cost: 'Cost per evaluation', method: 'Protocol', gross: 'Expected gross benefit', evaluations: 'Evaluations', totalCost: 'Total cost', net: 'Expected net benefit', axis: 'Shared net-benefit axis', zero: 'Zero', tableCaption: 'Protocol accounts' },
};
const render = (p: SearchBudgetComparisonProps) => renderToStaticMarkup(createElement(SearchBudgetComparison, p));

describe('SearchBudgetComparison', () => {
  test('subtracts the fixed count once and retains the outside payoff', () => {
    expect(searchBudgetAtCost(methods, 1).map(x => x.net)).toEqual([5.5, 4, 0]);
    expect(searchBudgetAtCost(methods, 3).map(x => x.net)).toEqual([1.5, 2, 0]);
    expect(searchBudgetAtCost(methods, 6).map(x => x.net)).toEqual([-4.5, -1, 0]);
    expect(searchBudgetAtCost(methods, 3).map(x => x.totalCost)).toEqual([6, 3, 0]);
  });
  test('preserves exact ties and a genuinely negative small net value', () => {
    expect(searchBudgetAtCost(methods, 2.5).map(x => x.net)).toEqual([2.5, 2.5, 0]);
    expect(searchBudgetAtCost(methods, 5).map(x => x.net)).toEqual([-2.5, 0, 0]);
    const tiny = [{ id: 'small', label: 'Tiny loss', gross: 1, evaluations: 1 }, methods[2]];
    const cost = 1 + 1e-9;
    const net = searchBudgetAtCost(tiny, cost)[0].net;
    expect(net).toBeLessThan(0);
    const html = render({ ...props, methods: tiny, costs: [cost], initialCost: cost });
    expect(html).toContain(new Intl.NumberFormat('en-US', { maximumSignificantDigits: 15 }).format(net) + ' cr');
    expect(html).toMatch(/-0\.0*[1-9]/);
  });
  test('renders a native control, fixed common axis and complete accessible account', () => {
    const initial = render(props), negative = render({ ...props, initialCost: 6 });
    expect(initial).toContain('<select');
    expect(initial).toContain('aria-labelledby=');
    expect(initial).toContain('not-prose');
    expect(initial).toContain('scope="col"');
    expect(initial).toContain('scope="row"');
    expect(initial).toContain('<caption class="sr-only">Protocol accounts</caption>');
    expect(negative).toContain('-4.5 cr');
    expect(negative).toContain('-1 cr');
    const zero = /class="absolute -top-1 h-6 w-px bg-ink-800" style="([^"]*)"/;
    expect(initial.match(zero)?.[1]).toBe(negative.match(zero)?.[1]);
    expect((negative.match(/aria-live="polite"/g) ?? []).length).toBe(1);
    expect(negative).not.toMatch(/NaN|Infinity/);
  });
  test('uses authored Spanish strings and decimal commas', () => {
    const html = render({ ...props, locale: 'es', initialCost: 2.5,
      title: 'Beneficio tras pagar las consultas', instructions: 'Cambia solo el coste.', caption: 'Comparamos estos protocolos.',
      methods: methods.map((m, i) => ({ ...m, label: ['AB', 'Solo A', 'Abstenerse'][i] })),
      labels: { cost: 'Coste por evaluación', method: 'Protocolo', gross: 'Beneficio bruto esperado', evaluations: 'Evaluaciones', totalCost: 'Coste total', net: 'Beneficio neto esperado', axis: 'Escala neta común', zero: 'Cero', tableCaption: 'Cuentas por protocolo' },
    });
    expect(html).toContain('2,5 cr');
    expect(html).toContain('7,5 cr');
    expect(html).toContain('Solo A');
    expect(html).toContain('Cuentas por protocolo');
    expect(html).not.toContain('Expected benefit');
  });
  test('names the scrollable account region and makes it keyboard focusable', () => {
    const html = render(props);
    const wrapper = html.match(/<div[^>]*class="[^"]*overflow-x-auto[^>]*>/)?.[0] ?? '';
    expect(wrapper).toContain('role="region"');
    expect(wrapper).toContain('tabindex="0"');
    expect(wrapper).toContain('aria-label="Protocol accounts"');
    expect(wrapper).toContain('focus-visible:outline');
  });
  test('formats accepted negative-zero evaluation counts as zero', () => {
    for (const locale of ['en', 'es'] as const) {
      const patch = { ...props, locale, methods: methods.map(m => ({ ...m, evaluations: m.evaluations === 0 ? -0 : m.evaluations })) };
      expect(render(patch)).toBe(render({ ...patch, methods }));
    }
  });
  test('rejects holes in an authored cost menu', () => {
    const sparse = [0, , 3] as number[];
    expect(() => render({ ...props, costs: sparse, initialCost: 0 })).toThrow('SearchBudgetComparison costs');
  });
  test('rejects malformed or misleading accounting inputs', () => {
    expect(() => searchBudgetAtCost(methods, -1)).toThrow();
    expect(() => searchBudgetAtCost([{ ...methods[0], evaluations: 1.5 }, methods[1]], 1)).toThrow();
    expect(() => searchBudgetAtCost([{ ...methods[0], gross: Infinity }, methods[1]], 1)).toThrow();
    expect(() => searchBudgetAtCost([methods[0], methods[0]], 1)).toThrow();
    expect(() => searchBudgetAtCost([{ ...methods[0], gross: -Number.MAX_VALUE }, methods[1]], Number.MAX_VALUE)).toThrow();
    expect(() => render({ ...props, costs: [1, 1] })).toThrow();
    expect(() => render({ ...props, initialCost: 4 })).toThrow();
    expect(() => render({ ...props, labels: { ...props.labels, net: '' } })).toThrow();
    const zeros = render({ ...props, methods: methods.slice(1).map(m => ({ ...m, gross: 0, evaluations: 0 })) });
    expect(zeros).not.toMatch(/NaN|Infinity/);
  });
});
