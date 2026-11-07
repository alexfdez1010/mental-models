import { useId, useState } from 'react';
import { cx } from '@/components/react/cx';

interface Named { id: string; label: string }
export interface ScenarioAuditPlan extends Named { preparation: number; costs: number[] }
export interface ScenarioAuditCatalogue extends Named { indices: number[] }
export interface ScenarioAuditBudget extends Named { amount: number }
export interface ScenarioAuditCase extends Named {
  /** The positive service-window length, in the same unit as costs. */
  window: number;
  unit: string;
  preparationUnit: string;
  scenarios: Named[];
  plans: ScenarioAuditPlan[];
  catalogues: ScenarioAuditCatalogue[];
  budgets: ScenarioAuditBudget[];
}
export interface ScenarioDecisionAuditLabels {
  caseLabel: string; catalogueLabel: string; budgetLabel: string; criterionLabel: string;
  costCriterion: string; regretCriterion: string; planLabel: string; preparationLabel: string;
  eligibilityLabel: string; eligibleLabel: string; unavailableLabel: string;
  costLabel: string; regretLabel: string; worstCostLabel: string; worstRegretLabel: string;
  benchmarkLabel: string; tableCaption: string; eligibilityNote: string;
  scaleLabel: string; selectedLabel: string; emptyMessage: string; singletonMessage: string;
  tieMessage: string; noValueLabel: string;
}
export interface ScenarioDecisionAuditProps {
  title: string;
  instructions: string;
  cases: ScenarioAuditCase[];
  labels: ScenarioDecisionAuditLabels;
  locale?: 'en' | 'es';
  className?: string;
}
export type ScenarioAuditCriterion = 'cost' | 'regret';
export interface ScenarioAuditResult {
  indices: number[];
  /** null means no preparation-feasible plan, not a zero-cost benchmark. */
  benchmark: number[] | null;
  rows: { id: string; eligible: boolean; costs: number[]; regrets: number[] | null; worstCost: number; worstRegret: number | null }[];
  winners: string[];
  best: number | null;
  scaleMaximum: number;
}
const labelKeys: (keyof ScenarioDecisionAuditLabels)[] = [
  'caseLabel', 'catalogueLabel', 'budgetLabel', 'criterionLabel', 'costCriterion', 'regretCriterion',
  'planLabel', 'preparationLabel', 'eligibilityLabel', 'eligibleLabel', 'unavailableLabel',
  'costLabel', 'regretLabel', 'worstCostLabel', 'worstRegretLabel', 'benchmarkLabel', 'tableCaption',
  'eligibilityNote', 'scaleLabel', 'selectedLabel', 'emptyMessage', 'singletonMessage', 'tieMessage', 'noValueLabel',
];
const text = (x: unknown): x is string => typeof x === 'string' && x.trim().length > 0;
const integer = (x: unknown, min: number, max: number): x is number => typeof x === 'number' && Number.isSafeInteger(x) && x >= min && x <= max;
function dense(x: unknown, min: number, max: number): x is unknown[] {
  return Array.isArray(x) && x.length >= min && x.length <= max
    && Array.from({ length: x.length }, (_, i) => Object.hasOwn(x, i)).every(Boolean);
}
function named(items: unknown[], name: string) {
  const ids = new Set<string>(), names = new Set<string>();
  for (const item of items) {
    const value = item as Named | null;
    if (!value || !Object.hasOwn(value, 'id') || !Object.hasOwn(value, 'label') || !text(value.id) || !text(value.label) || ids.has(value.id.trim()) || names.has(value.label.trim())) throw new Error(`ScenarioDecisionAudit: ${name} need unique own nonempty ids and labels.`);
    ids.add(value.id.trim()); names.add(value.label.trim());
  }
}
/** No probability model: all integer costs are authored conditional outcomes. */
export function validateScenarioAuditCase(input: ScenarioAuditCase): void {
  if (!input || !text(input.id) || !text(input.label) || !text(input.unit) || !text(input.preparationUnit)
    || !integer(input.window, 1, 1000) || !dense(input.scenarios, 2, 4) || !dense(input.plans, 2, 4)
    || !dense(input.catalogues, 1, 3) || !dense(input.budgets, 1, 4)) throw new Error('ScenarioDecisionAudit: invalid bounded case, window, scenarios, plans, catalogues or budgets.');
  named([input], 'case');
  named(input.scenarios, 'scenarios'); named(input.plans, 'plans'); named(input.catalogues, 'catalogues'); named(input.budgets, 'budgets');
  for (const plan of input.plans) {
    if (!integer(plan.preparation, 0, 1000) || !dense(plan.costs, input.scenarios.length, input.scenarios.length)
      || !plan.costs.every(cost => integer(cost, 0, input.window))) throw new Error('ScenarioDecisionAudit: dense cost rows must align with scenarios and remain within the window; preparation must be an integer from 0 to 1000.');
  }
  for (const catalogue of input.catalogues) {
    if (!dense(catalogue.indices, 1, input.scenarios.length) || !catalogue.indices.every(i => integer(i, 0, input.scenarios.length - 1))
      || new Set(catalogue.indices).size !== catalogue.indices.length) throw new Error('ScenarioDecisionAudit: each catalogue needs distinct valid scenario indices.');
  }
  if (!input.budgets.every(budget => integer(budget.amount, 0, 1000))) throw new Error('ScenarioDecisionAudit: budgets must be integers from 0 to 1000.');
}
/** Recompute the comparator over the current preparation-feasible menu. */
export function calculateScenarioAudit(input: ScenarioAuditCase, catalogueIndex: number, budgetIndex: number, criterion: ScenarioAuditCriterion): ScenarioAuditResult {
  validateScenarioAuditCase(input);
  if (!integer(catalogueIndex, 0, input.catalogues.length - 1) || !integer(budgetIndex, 0, input.budgets.length - 1)
    || (criterion !== 'cost' && criterion !== 'regret')) throw new Error('ScenarioDecisionAudit: invalid selection.');
  const indices = input.catalogues[catalogueIndex]!.indices;
  const amount = input.budgets[budgetIndex]!.amount;
  const eligible = input.plans.filter(plan => plan.preparation <= amount);
  const benchmark = eligible.length ? indices.map(i => Math.min(...eligible.map(plan => plan.costs[i]!))) : null;
  const rows = input.plans.map(plan => {
    const costs = indices.map(i => plan.costs[i]!);
    const available = plan.preparation <= amount;
    const regrets = available && benchmark ? costs.map((cost, i) => cost - benchmark[i]!) : null;
    return { id: plan.id, eligible: available, costs, regrets, worstCost: Math.max(...costs), worstRegret: regrets ? Math.max(...regrets) : null };
  });
  const scores = rows.filter(row => row.eligible).map(row => criterion === 'cost' ? row.worstCost : row.worstRegret!);
  const best = scores.length ? Math.min(...scores) : null;
  const winners = best === null ? [] : rows.filter(row => row.eligible && (criterion === 'cost' ? row.worstCost : row.worstRegret) === best).map(row => row.id);
  return { indices: [...indices], benchmark, rows, winners, best, scaleMaximum: Math.max(...input.plans.flatMap(plan => plan.costs)) };
}

/** A finite matrix inspector, with no stochastic forecasts or hidden extra constraints. */
export function ScenarioDecisionAudit({ title, instructions, cases, labels, locale = 'en', className }: ScenarioDecisionAuditProps) {
  if (!text(title) || !text(instructions) || !dense(cases, 1, 3) || !labels || labelKeys.some(key => !text(labels[key]))
    || (locale !== 'en' && locale !== 'es')) throw new Error('ScenarioDecisionAudit: complete cases, title, instructions, locale and labels are required.');
  // Validate every hidden case before the first hook, so bad authored data fails SSR/build.
  cases.forEach(validateScenarioAuditCase); named(cases, 'cases');
  const id = useId();
  const [caseIndex, setCaseIndex] = useState(0);
  const [catalogueIndex, setCatalogueIndex] = useState(0);
  const [budgetIndex, setBudgetIndex] = useState(0);
  const [criterion, setCriterion] = useState<ScenarioAuditCriterion>('cost');
  const current = cases[Math.min(caseIndex, cases.length - 1)]!;
  const ci = Math.min(catalogueIndex, current.catalogues.length - 1);
  const bi = Math.min(budgetIndex, current.budgets.length - 1);
  const result = calculateScenarioAudit(current, ci, bi, criterion);
  const nf = new Intl.NumberFormat(locale === 'es' ? 'es-ES' : 'en-US', { maximumFractionDigits: 0 });
  const format = (n: number) => nf.format(n === 0 ? 0 : n);
  const eligibleCount = result.rows.filter(row => row.eligible).length;
  const winnerNames = current.plans.filter(plan => result.winners.includes(plan.id)).map(plan => plan.label).join(', ');
  const criterionName = criterion === 'cost' ? labels.costCriterion : labels.regretCriterion;
  const selectClass = 'mt-1 w-full rounded-card border border-ink-300 bg-surface px-3 py-2 text-sm text-ink-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600';
  const cell = 'px-3 py-3 text-left align-top';
  return (
    <figure className={cx('not-prose my-8 rounded-card border border-ink-200 bg-surface p-4 sm:p-6', className)} aria-labelledby={`${id}-title`}>
      <figcaption id={`${id}-title`} className="font-display text-xl font-bold text-ink-900">{title}</figcaption>
      <p className="mt-2 text-sm leading-relaxed text-ink-700">{instructions}</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {cases.length > 1 && <label className="text-sm text-ink-800" htmlFor={`${id}-case`}>{labels.caseLabel}
          <select id={`${id}-case`} className={selectClass} value={caseIndex} onChange={event => { setCaseIndex(Number(event.target.value)); setCatalogueIndex(0); setBudgetIndex(0); }}>
            {cases.map((item, i) => <option key={item.id} value={i}>{item.label}</option>)}
          </select>
        </label>}
        {current.catalogues.length > 1 && <label className="text-sm text-ink-800" htmlFor={`${id}-catalogue`}>{labels.catalogueLabel}
          <select id={`${id}-catalogue`} className={selectClass} value={ci} onChange={event => setCatalogueIndex(Number(event.target.value))}>
            {current.catalogues.map((item, i) => <option key={item.id} value={i}>{item.label}</option>)}
          </select>
        </label>}
        {current.budgets.length > 1 && <label className="text-sm text-ink-800" htmlFor={`${id}-budget`}>{labels.budgetLabel} ({current.preparationUnit})
          <select id={`${id}-budget`} className={selectClass} value={bi} onChange={event => setBudgetIndex(Number(event.target.value))}>
            {current.budgets.map((item, i) => <option key={item.id} value={i}>{item.label}: {format(item.amount)}</option>)}
          </select>
        </label>}
        <label className="text-sm text-ink-800" htmlFor={`${id}-criterion`}>{labels.criterionLabel}
          <select id={`${id}-criterion`} className={selectClass} value={criterion} onChange={event => setCriterion(event.target.value as ScenarioAuditCriterion)}>
            <option value="cost">{labels.costCriterion}</option><option value="regret">{labels.regretCriterion}</option>
          </select>
        </label>
      </div>
      {(current.catalogues.length === 1 || current.budgets.length === 1) && <p className="mt-3 text-sm text-ink-700">{[
        current.catalogues.length === 1 ? `${labels.catalogueLabel}: ${current.catalogues[ci]!.label}.` : '',
        current.budgets.length === 1 ? `${labels.budgetLabel} (${current.preparationUnit}): ${format(current.budgets[bi]!.amount)}.` : '',
      ].filter(Boolean).join(' ')}</p>}
      <p className="mt-2 text-sm text-ink-700">{labels.eligibilityNote}</p>
      <p className="mt-2 font-mono text-xs text-ink-700">{labels.scaleLabel} ({current.unit}): 0–{format(result.scaleMaximum)}</p>
      <div tabIndex={0} role="region" aria-label={labels.tableCaption} className="mt-3 overflow-x-auto rounded-card focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600">
        <table className="w-full min-w-[44rem] border-collapse text-sm text-ink-900" style={{ display: 'table', overflow: 'visible', margin: 0 }}>
          <caption className="sr-only">{labels.tableCaption}</caption>
          <thead className="bg-surface-sunken"><tr>
            <th scope="col" className={cell}>{labels.planLabel}</th>
            <th scope="col" className={cell}>{labels.preparationLabel}<br />({current.preparationUnit})</th>
            <th scope="col" className={cell}>{labels.eligibilityLabel}</th>
            {result.indices.map(i => <th scope="col" key={current.scenarios[i]!.id} className={cell}>{current.scenarios[i]!.label}<br />({current.unit})</th>)}
            <th scope="col" className={cell}>{labels.worstCostLabel}<br />({current.unit})</th>
            <th scope="col" className={cell}>{labels.worstRegretLabel}<br />({current.unit})</th>
          </tr></thead>
          <tbody>{result.rows.map((row, index) => <tr key={row.id} data-plan={row.id} className={result.winners.includes(row.id) ? 'bg-brand-50' : index % 2 ? 'bg-surface-sunken' : 'bg-surface'}>
            <th scope="row" className={cell}>{current.plans[index]!.label}</th>
            <td className={`${cell} font-mono`}>{format(current.plans[index]!.preparation)}</td>
            <td className={cell}>{row.eligible ? labels.eligibleLabel : labels.unavailableLabel}</td>
            {row.costs.map((cost, j) => {
              const gap = row.regrets?.[j] ?? null;
              const plotted = criterion === 'cost' ? cost : gap;
              return <td key={result.indices[j]} className={cell}>
                <dl className="m-0 text-xs"><div><dt className="inline text-ink-700">{labels.costLabel}: </dt><dd className="m-0 inline font-mono">{format(cost)}</dd></div>
                  <div><dt className="inline text-ink-700">{labels.regretLabel}: </dt><dd className="m-0 inline font-mono">{gap === null ? labels.noValueLabel : format(gap)}</dd></div></dl>
                {plotted !== null && <div aria-hidden="true" className="mt-2 h-2 w-24 bg-ink-100"><div className="h-2 bg-brand-600 motion-safe:transition-[width] motion-safe:duration-200" style={{ width: `${result.scaleMaximum === 0 ? 0 : plotted / result.scaleMaximum * 100}%` }} /></div>}
              </td>;
            })}
            <td className={`${cell} font-mono`}>{format(row.worstCost)}</td>
            <td className={`${cell} font-mono`}>{row.worstRegret === null ? labels.noValueLabel : format(row.worstRegret)}</td>
          </tr>)}</tbody>
          <tfoot className="bg-surface-sunken"><tr>
            <th scope="row" colSpan={3} className={cell}>{labels.benchmarkLabel} ({current.unit})</th>
            {result.indices.map((i, j) => <td key={i} className={`${cell} font-mono`}>{result.benchmark ? format(result.benchmark[j]!) : labels.noValueLabel}</td>)}
            <td className={cell}>{labels.noValueLabel}</td><td className={cell}>{labels.noValueLabel}</td>
          </tr></tfoot>
        </table>
      </div>
      <div role="status" aria-live="polite" className="mt-4 text-sm leading-relaxed text-ink-900">
        {result.best === null ? <p>{labels.emptyMessage}</p> : <>
          <dl className="m-0"><dt>{labels.selectedLabel}: {criterionName} ({current.unit})</dt><dd className="m-0 font-mono font-semibold">{winnerNames}: {format(result.best)}</dd></dl>
          {eligibleCount === 1 && <p className="mt-2">{labels.singletonMessage}</p>}
          {result.winners.length > 1 && <p className="mt-2">{labels.tieMessage}</p>}
        </>}
      </div>
    </figure>
  );
}

export default ScenarioDecisionAudit;
