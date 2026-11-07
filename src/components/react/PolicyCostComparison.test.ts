import { describe, expect, test } from 'bun:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { auditPolicyCostComparison, PolicyCostComparison, type PolicyCostComparisonProps } from '@/components/react/PolicyCostComparison';
const base: PolicyCostComparisonProps = {
  title: 'Compare declared plans', instructions: 'Only shown plans are compared.', unit: 'cr', locale: 'en', scaleMax: 48,
  labels: { scenario: 'Scenario', plan: 'Plan', resources: 'Resources', harmA: 'Harm A', harmB: 'Harm B', total: 'Combined cost', transfer: 'Transfer', transferNote: 'Transfers are separate.', scale: 'Common scale', tableCaption: 'Exact plan accounts', minimumSummaryTemplate: 'Lowest among shown plans: {plans}, {total}.' },
  scenarios: [{ id: 'common', label: 'Common damage', plans: [
    { id: 'none', label: 'No reduction', resourceCost: 0, harmA: 18, harmB: 18, feeTransfer: 0 },
    { id: 'equal', label: 'Equal standard', resourceCost: 11, harmA: 9, harmB: 9, feeTransfer: 0 },
    { id: 'fee', label: 'Common fee', resourceCost: 10, harmA: 4.5, harmB: 13.5, feeTransfer: 18 },
  ] }],
};
const copy = () => structuredClone(base);
describe('declared policy cost comparison', () => {
  test('sums real-cost terms and excludes transfers', () => {
    const audit = auditPolicyCostComparison(base)[0]!;
    expect(audit.totals).toEqual([36, 29, 28]); expect(audit.minimumIds).toEqual(['fee']);
    const data = copy(); data.scenarios[0]!.plans[2]!.feeTransfer = 1000;
    expect(auditPolicyCostComparison(data)[0]!.totals).toEqual([36, 29, 28]);
  });
  test('keeps all ties and makes no inference about absent plans', () => {
    const data = copy(); data.scenarios[0]!.plans = data.scenarios[0]!.plans.slice(0, 2);
    expect(auditPolicyCostComparison(data)[0]!.minimumIds).toEqual(['equal']);
    data.scenarios[0]!.plans[0]!.resourceCost = 29; data.scenarios[0]!.plans[0]!.harmA = 0; data.scenarios[0]!.plans[0]!.harmB = 0;
    expect(auditPolicyCostComparison(data)[0]!.minimumIds).toEqual(['none', 'equal']);
  });
  test('validates hidden scenarios before any state is read', () => {
    const data = copy(); data.scenarios.push({ ...structuredClone(data.scenarios[0]!), id: 'hidden', label: 'Hidden case' });
    data.scenarios[1]!.plans[0]!.harmB = 48;
    expect(() => auditPolicyCostComparison(data)).toThrow('scale');
    expect(() => renderToStaticMarkup(createElement(PolicyCostComparison, data))).toThrow('scale');
  });
  test('rejects holes in either dense array', () => {
    const a = copy(); a.scenarios.length = 2; expect(() => auditPolicyCostComparison(a)).toThrow('dense');
    const b = copy(); delete b.scenarios[0]!.plans[1]; expect(() => auditPolicyCostComparison(b)).toThrow('dense');
  });
  test('rejects empty or excessive scenario and plan lists', () => {
    for (const count of [0, 4]) { const p = copy(); p.scenarios = Array.from({ length: count }, (_, i) => ({ ...structuredClone(base.scenarios[0]!), id: String(i), label: `Case ${i}` })); expect(() => auditPolicyCostComparison(p)).toThrow('length'); }
    for (const count of [0, 5]) { const p = copy(); p.scenarios[0]!.plans = Array.from({ length: count }, (_, i) => ({ ...base.scenarios[0]!.plans[0]!, id: String(i), label: `Plan ${i}` })); expect(() => auditPolicyCostComparison(p)).toThrow('length'); }
  });
  test('requires own, nonempty, unique ids and labels', () => {
    const inherited = copy(); inherited.scenarios[0]!.plans[0] = Object.assign(Object.create({ id: 'inherited' }), { label: 'Inherited', resourceCost: 0, harmA: 0, harmB: 0, feeTransfer: 0 }); expect(() => auditPolicyCostComparison(inherited)).toThrow('own');
    for (const key of ['id', 'label'] as const) { const p = copy(); p.scenarios[0]!.plans[1]![key] = p.scenarios[0]!.plans[0]![key]; expect(() => auditPolicyCostComparison(p)).toThrow('unique'); }
    const blank = copy(); blank.labels.harmA = ' '; expect(() => auditPolicyCostComparison(blank)).toThrow('nonempty');
  });
  test('rejects negative, nonfinite, quarter-unit and oversized amounts', () => {
    for (const value of [-.5, NaN, Infinity, .25, 1000.5]) { const p = copy(); p.scenarios[0]!.plans[0]!.feeTransfer = value; expect(() => auditPolicyCostComparison(p)).toThrow('half-unit'); }
  });
  test('validates common integer scale and stacked containment', () => {
    for (const scaleMax of [0, -1, .5, 1001, Infinity, NaN]) expect(() => auditPolicyCostComparison({ ...base, scaleMax })).toThrow('scaleMax');
    expect(() => auditPolicyCostComparison({ ...base, scaleMax: 35 })).toThrow('scale');
    const p = copy(); p.scaleMax = 1; p.scenarios[0]!.plans = [{ id: 'edge', label: 'Boundary', resourceCost: .5, harmA: .5, harmB: 0, feeTransfer: 1000 }]; expect(auditPolicyCostComparison(p)[0]!.totals).toEqual([1]);
  });
  test('requires locale and valid summary tokens', () => {
    expect(() => auditPolicyCostComparison({ ...base, locale: 'fr' } as unknown as PolicyCostComparisonProps)).toThrow('locale');
    const p = copy(); p.labels.minimumSummaryTemplate = '{plans}: {total} {other}'; expect(() => auditPolicyCostComparison(p)).toThrow('token');
  });
  test('renders exact English and Spanish amounts and native controls', () => {
    for (const locale of ['en', 'es'] as const) {
      const p = copy(); p.locale = locale; p.scenarios.push({ ...structuredClone(p.scenarios[0]!), id: 'second', label: locale === 'es' ? 'Otro caso' : 'Another case' });
      if (locale === 'es') p.labels = { scenario: 'Escenario', plan: 'Plan', resources: 'Recursos', harmA: 'Daño A', harmB: 'Daño B', total: 'Coste conjunto', transfer: 'Transferencia', transferNote: 'La transferencia se registra aparte.', scale: 'Escala común', tableCaption: 'Cuentas exactas de los planes', minimumSummaryTemplate: 'Menor coste entre los planes mostrados: {plans}, {total}.' };
      const html = renderToStaticMarkup(createElement(PolicyCostComparison, p));
      expect(html).toContain(locale === 'es' ? '4,5 cr' : '4.5 cr'); expect(html).toContain('<select'); expect(html).toContain('role="region"'); expect(html).toContain('tabindex="0"'); expect(html).toContain('display:table;overflow:visible;margin:0'); expect(html).toContain('aria-live="polite"'); expect(html).not.toContain('46 cr'); expect(html).not.toContain('NaN');
    }
  });
});
