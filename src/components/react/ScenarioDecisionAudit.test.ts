import { describe, expect, test } from 'bun:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { calculateScenarioAudit, ScenarioDecisionAudit, type ScenarioAuditCase, type ScenarioDecisionAuditLabels } from '@/components/react/ScenarioDecisionAudit';

const model = (): ScenarioAuditCase => ({
  id: 'desk', label: 'Desk', window: 240, unit: 'min', preparationUnit: 'worker-min',
  scenarios: ['Normal', 'Rush', 'Link down', 'Both'].map((label, i) => ({ id: String(i), label })),
  plans: [
    { id: 'a', label: 'A', preparation: 80, costs: [10, 30, 40, 60] },
    { id: 'b', label: 'B', preparation: 100, costs: [15, 20, 30, 90] },
    { id: 'c', label: 'C', preparation: 120, costs: [0, 35, 35, 70] },
  ],
  catalogues: [{ id: 'initial', label: 'Initial', indices: [0, 1, 2] }, { id: 'expanded', label: 'Expanded', indices: [0, 1, 2, 3] }],
  budgets: [120, 110, 80, 79].map(amount => ({ id: String(amount), label: String(amount), amount })),
});
const labels: ScenarioDecisionAuditLabels = {
  caseLabel: 'Case', catalogueLabel: 'Catalogue', budgetLabel: 'Preparation budget', criterionLabel: 'Criterion',
  costCriterion: 'Smallest worst cost', regretCriterion: 'Smallest worst regret', planLabel: 'Plan', preparationLabel: 'Preparation',
  eligibilityLabel: 'Budget eligibility', eligibleLabel: 'Available', unavailableLabel: 'Unavailable', costLabel: 'Cost', regretLabel: 'Gap',
  worstCostLabel: 'Worst cost', worstRegretLabel: 'Worst gap', benchmarkLabel: 'Feasible scenario-wise best', tableCaption: 'Costs and gaps',
  eligibilityNote: 'Only preparation eligibility is applied.', scaleLabel: 'Fixed bar scale', selectedLabel: 'Minimizer', emptyMessage: 'No eligible plan.',
  singletonMessage: 'Only one plan is eligible; zero gap does not mean zero cost.', tieMessage: 'All tied minimizers are listed.', noValueLabel: 'Not applicable',
};
const props = (cases = [model()]) => ({ title: 'Audit the table', instructions: 'Compare declared conditional costs.', cases, labels });

describe('finite scenario decisions', () => {
  test('cost and regret are distinct objectives over the same full menu', () => {
    const m = model(), before = JSON.stringify(m);
    const cost = calculateScenarioAudit(m, 0, 0, 'cost'), regret = calculateScenarioAudit(m, 0, 0, 'regret');
    expect(cost.benchmark).toEqual([0, 20, 30]);
    expect(cost.rows.map(row => row.worstCost)).toEqual([40, 30, 35]);
    expect(regret.rows.map(row => row.regrets)).toEqual([[10, 10, 10], [15, 0, 0], [0, 15, 5]]);
    expect(cost.winners).toEqual(['b']); expect(cost.best).toBe(30);
    expect(regret.winners).toEqual(['a']); expect(regret.best).toBe(10);
    expect(JSON.stringify(m)).toBe(before);
  });
  test('an unavailable plan is removed from both the comparator and winners', () => {
    const result = calculateScenarioAudit(model(), 0, 1, 'regret');
    expect(result.benchmark).toEqual([10, 20, 30]);
    expect(result.rows.map(row => row.regrets)).toEqual([[0, 10, 10], [5, 0, 0], null]);
    expect(result.winners).toEqual(['b']); expect(result.best).toBe(5);
  });
  test('a joint condition changes cost ranking, with an unchanged global scale', () => {
    const initial = calculateScenarioAudit(model(), 0, 0, 'cost'), expanded = calculateScenarioAudit(model(), 1, 0, 'cost');
    expect(expanded.benchmark).toEqual([0, 20, 30, 60]);
    expect(expanded.rows.map(row => row.worstCost)).toEqual([60, 90, 70]);
    expect(expanded.rows.map(row => row.worstRegret)).toEqual([10, 30, 15]);
    expect(expanded.winners).toEqual(['a']);
    expect(initial.scaleMaximum).toBe(90); expect(expanded.scaleMaximum).toBe(90);
  });
  test('singleton zero regret differs from original cost; empty has no numeric comparator', () => {
    const one = calculateScenarioAudit(model(), 1, 2, 'regret'), none = calculateScenarioAudit(model(), 1, 3, 'regret');
    expect(one.rows[0]!.worstRegret).toBe(0); expect(one.rows[0]!.worstCost).toBe(60);
    expect(one.winners).toEqual(['a']);
    expect(none.benchmark).toBeNull(); expect(none.best).toBeNull(); expect(none.winners).toEqual([]);
    expect(none.rows.every(row => row.regrets === null && row.worstRegret === null)).toBe(true);
  });
  test('all ties are retained, including an all-zero bounded matrix', () => {
    const m = model(); for (const plan of m.plans) plan.costs = [0, 0, 0, 0];
    for (const criterion of ['cost', 'regret'] as const) {
      const result = calculateScenarioAudit(m, 1, 0, criterion);
      expect(result.winners).toEqual(['a', 'b', 'c']); expect(result.best).toBe(0); expect(result.scaleMaximum).toBe(0);
    }
    expect(renderToStaticMarkup(createElement(ScenarioDecisionAudit, props([m])))).not.toMatch(/NaN|Infinity/);
  });
  test('rejects invalid integers, row widths, holes, duplicates and selections', () => {
    for (const invalid of [-1, .5, NaN, Infinity, 241]) { const m = model(); m.plans[0]!.costs[0] = invalid; expect(() => calculateScenarioAudit(m, 0, 0, 'cost')).toThrow(); }
    for (const invalid of [-1, .5, NaN, Infinity, 1001]) { const m = model(); m.budgets[0]!.amount = invalid; expect(() => calculateScenarioAudit(m, 0, 0, 'cost')).toThrow(); }
    const bads = [model(), model(), model(), model(), model(), model()];
    bads[0]!.plans[0]!.costs.pop(); Reflect.deleteProperty(bads[1]!.plans, 1); Reflect.deleteProperty(bads[2]!.plans[0]!.costs, 1);
    bads[3]!.catalogues[0]!.indices = [0, 0]; bads[4]!.scenarios[0]!.id = bads[4]!.scenarios[1]!.id; bads[5]!.plans[0]!.label = ' ';
    for (const m of bads) expect(() => calculateScenarioAudit(m, 0, 0, 'cost')).toThrow();
    for (const [ci, bi] of [[-1, 0], [2, 0], [0, 4], [.5, 0]]) expect(() => calculateScenarioAudit(model(), ci!, bi!, 'cost')).toThrow();
  });
  test('validates hidden cases, labels and upper bounds before hooks', () => {
    const hidden = model(); hidden.plans[0]!.costs[3] = -1;
    expect(() => renderToStaticMarkup(createElement(ScenarioDecisionAudit, props([model(), hidden])))).toThrow();
    expect(() => renderToStaticMarkup(createElement(ScenarioDecisionAudit, { ...props(), labels: { ...labels, emptyMessage: '' } }))).toThrow();
    expect(() => renderToStaticMarkup(createElement(ScenarioDecisionAudit, props(Array(2) as ScenarioAuditCase[])))).toThrow();
    const m = model(); m.window = 1000; m.plans.forEach(plan => { plan.preparation = 1000; plan.costs = [1000, 0, 1000, 0]; }); m.budgets[0]!.amount = 1000;
    expect(calculateScenarioAudit(m, 1, 0, 'regret').best).toBe(0);
  });
  test('enforces every collection bound, an own named record and the window domain', () => {
    for (const window of [0, 1001, .5, NaN, Infinity]) {
      const m = model(); m.window = window;
      expect(() => calculateScenarioAudit(m, 0, 0, 'cost')).toThrow();
    }
    for (const [key, lengths] of [['plans', [1, 5]], ['scenarios', [1, 5]], ['catalogues', [0, 4]], ['budgets', [0, 5]]] as const) {
      for (const length of lengths) {
        const m = model(); (m as unknown as Record<string, unknown>)[key] = Array.from({ length }, (_, i) => ({ id: String(i), label: String(i) }));
        expect(() => calculateScenarioAudit(m, 0, 0, 'cost')).toThrow();
      }
    }
    for (const cases of [[], [model(), model(), model(), model()]]) expect(() => renderToStaticMarkup(createElement(ScenarioDecisionAudit, props(cases)))).toThrow();
    const inherited = model(); inherited.scenarios[0] = Object.create({ id: 'inherited', label: 'Inherited' });
    expect(() => calculateScenarioAudit(inherited, 0, 0, 'cost')).toThrow();
    const m = model(); m.plans[0]!.costs = [10, 10, 10, 10]; m.plans[1]!.costs = [10, 10, 10, 10];
    expect(calculateScenarioAudit(m, 1, 0, 'cost').winners).toEqual(['a', 'b']);
  });
  test('SSR has native named controls, an externally owned scroll region and readable units', () => {
    const html = renderToStaticMarkup(createElement(ScenarioDecisionAudit, props()));
    expect(html).toContain('role="region"'); expect(html).toContain('tabindex="0"'); expect(html).toContain('<caption');
    expect(html).toContain('display:table;overflow:visible;margin:0'); expect(html).toContain('aria-live="polite"');
    expect(html.match(/<select/g)?.length).toBe(3); expect(html).toContain('B: 30');
    // Equal track widths preserve a shared physical scale when column widths differ.
    expect(html.match(/h-2 w-24 bg-ink-100/g)?.length).toBe(9);
    expect(html).not.toMatch(/NaN|Infinity|undefined/);
  });
  test('signed zero stays unsigned in all displayed inputs and both locales', () => {
    const m = model(); m.plans.forEach(plan => { plan.preparation = -0; plan.costs = [-0, 0, 0, 0]; }); m.budgets[0]!.amount = -0;
    for (const locale of ['en', 'es'] as const) {
      const html = renderToStaticMarkup(createElement(ScenarioDecisionAudit, { ...props([m]), locale }));
      expect(html).not.toMatch(/>[-−]0(?:<|\s)|NaN|Infinity/);
    }
  });
});
