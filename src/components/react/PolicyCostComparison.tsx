import { useId, useState } from 'react';
import { cx } from '@/components/react/cx';

export interface PolicyCostPlan {
  id: string;
  label: string;
  resourceCost: number;
  harmA: number;
  harmB: number;
  /** Payment to another included account; always excluded from the stacked total. */
  feeTransfer: number;
}

export interface PolicyCostScenario {
  id: string;
  label: string;
  plans: PolicyCostPlan[];
}

export interface PolicyCostLabels {
  scenario: string;
  plan: string;
  resources: string;
  harmA: string;
  harmB: string;
  total: string;
  transfer: string;
  transferNote: string;
  scale: string;
  tableCaption: string;
  /** Must include {plans} and {total}; the comparison covers displayed plans only. */
  minimumSummaryTemplate: string;
}

export interface PolicyCostComparisonProps {
  title: string;
  instructions: string;
  locale: 'en' | 'es';
  unit: string;
  /** A fixed common zero-based scale for every scenario, positive integer at most 1000. */
  scaleMax: number;
  scenarios: PolicyCostScenario[];
  labels: PolicyCostLabels;
  className?: string;
}

const labelKeys = ['scenario', 'plan', 'resources', 'harmA', 'harmB', 'total', 'transfer', 'transferNote', 'scale', 'tableCaption', 'minimumSummaryTemplate'] as const;
const amountKeys = ['resourceCost', 'harmA', 'harmB', 'feeTransfer'] as const;
function own(object: unknown, key: string): object is Record<string, unknown> {
  return typeof object === 'object' && object !== null && Object.hasOwn(object, key);
}
function text(object: unknown, key: string, path: string): string {
  if (!own(object, key) || typeof object[key] !== 'string' || !object[key].trim() || object[key].trim() !== object[key]) {
    throw new Error(`PolicyCostComparison: ${path}.${key} must be an own nonempty trimmed string.`);
  }
  return object[key];
}
function dense(value: unknown, min: number, max: number, path: string): asserts value is unknown[] {
  if (!Array.isArray(value) || value.length < min || value.length > max) throw new Error(`PolicyCostComparison: ${path} has an invalid length.`);
  for (let index = 0; index < value.length; index++) if (!Object.hasOwn(value, index)) throw new Error(`PolicyCostComparison: ${path} must be dense.`);
}

/** Validate every authored scenario, then sum exact half-units and retain every shown minimum. No policy responses are generated. */
export function auditPolicyCostComparison(props: PolicyCostComparisonProps) {
  for (const key of ['title', 'instructions', 'unit'] as const) text(props, key, 'props');
  if (!own(props, 'locale') || (props.locale !== 'en' && props.locale !== 'es')) throw new Error('PolicyCostComparison: locale must be en or es.');
  if (!own(props, 'scaleMax') || !Number.isInteger(props.scaleMax) || props.scaleMax <= 0 || props.scaleMax > 1000) throw new Error('PolicyCostComparison: invalid scaleMax.');
  if (!own(props, 'labels')) throw new Error('PolicyCostComparison: labels are required.');
  for (const key of labelKeys) text(props.labels, key, 'labels');
  const template = props.labels.minimumSummaryTemplate;
  for (const token of ['{plans}', '{total}']) if (template.split(token).length !== 2) throw new Error('PolicyCostComparison: minimum summary needs each token exactly once.');
  if (template.replace('{plans}', '').replace('{total}', '').match(/[{}]/)) throw new Error('PolicyCostComparison: unknown summary token.');
  if (!own(props, 'scenarios')) throw new Error('PolicyCostComparison: scenarios are required.');
  dense(props.scenarios, 1, 3, 'scenarios');
  const scenarioIds = new Set<string>(), scenarioLabels = new Set<string>();
  return props.scenarios.map((scenario, index) => {
    const path = `scenarios[${index}]`;
    const id = text(scenario, 'id', path), label = text(scenario, 'label', path);
    if (scenarioIds.has(id) || scenarioLabels.has(label)) throw new Error('PolicyCostComparison: scenario ids and labels must be unique.');
    scenarioIds.add(id); scenarioLabels.add(label);
    if (!own(scenario, 'plans')) throw new Error(`PolicyCostComparison: ${path}.plans is required.`);
    dense(scenario.plans, 1, 4, `${path}.plans`);
    const ids = new Set<string>(), labels = new Set<string>();
    const totals = scenario.plans.map((plan, planIndex) => {
      const pp = `${path}.plans[${planIndex}]`, pid = text(plan, 'id', pp), plabel = text(plan, 'label', pp);
      if (ids.has(pid) || labels.has(plabel)) throw new Error('PolicyCostComparison: plan ids and labels must be unique within each scenario.');
      ids.add(pid); labels.add(plabel);
      for (const key of amountKeys) if (!own(plan, key) || typeof plan[key] !== 'number' || !Number.isFinite(plan[key]) || plan[key] < 0 || plan[key] > 1000 || !Number.isInteger(plan[key] * 2)) throw new Error(`PolicyCostComparison: ${pp}.${key} must be a half-unit amount from zero to one thousand.`);
      // Doubled integers keep both summation and ties exact. Transfers are deliberately absent.
      const twice = plan.resourceCost * 2 + plan.harmA * 2 + plan.harmB * 2;
      if (twice > props.scaleMax * 2) throw new Error(`PolicyCostComparison: ${pp} exceeds the common scale.`);
      return twice / 2;
    });
    const minimum = Math.min(...totals);
    return { totals, minimum, minimumIds: scenario.plans.filter((_, i) => totals[i] === minimum).map(plan => plan.id) };
  });
}

/** Compare declared resource costs and remaining harms; fee transfers stay in a separate column. */
export function PolicyCostComparison(props: PolicyCostComparisonProps) {
  const audits = auditPolicyCostComparison(props); // Includes initially hidden scenarios, before hooks.
  const id = useId();
  const [scenarioIndex, setScenarioIndex] = useState(0);
  const activeIndex = Math.min(scenarioIndex, props.scenarios.length - 1), scenario = props.scenarios[activeIndex]!, audit = audits[activeIndex]!;
  const { title, instructions, locale, unit, labels, scaleMax, className } = props;
  const numberLocale = locale === 'es' ? 'es-ES' : 'en-US';
  const format = (value: number) => `${value.toLocaleString(numberLocale, { maximumFractionDigits: 1 })} ${unit}`;
  const minimumNames = scenario.plans.filter(plan => audit.minimumIds.includes(plan.id)).map(plan => plan.label);
  const summary = labels.minimumSummaryTemplate.replace('{plans}', new Intl.ListFormat(numberLocale, { style: 'long', type: 'conjunction' }).format(minimumNames)).replace('{total}', format(audit.minimum));
  const segments = [{ key: 'resourceCost', label: labels.resources, color: 'bg-brand-700' }, { key: 'harmA', label: labels.harmA, color: 'bg-ink-500' }, { key: 'harmB', label: labels.harmB, color: 'bg-ink-900' }] as const;
  return (
    <figure className={cx('not-prose my-8 min-w-0', className)} aria-labelledby={`${id}-title`}>
      <figcaption id={`${id}-title`} className="font-display text-lg font-semibold text-ink-900">{title}</figcaption>
      <p className="mt-2 text-sm leading-relaxed text-ink-700">{instructions}</p>
      {props.scenarios.length > 1 ? <div className="mt-5">
        <label htmlFor={`${id}-scenario`} className="block text-sm font-semibold text-ink-800">{labels.scenario}</label>
        <select id={`${id}-scenario`} value={activeIndex} onChange={event => setScenarioIndex(Number(event.currentTarget.value))} className="mt-2 min-h-11 w-full rounded-card border border-ink-300 bg-surface px-3 py-2 text-sm text-ink-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700">
          {props.scenarios.map((item, index) => <option key={item.id} value={index}>{item.label}</option>)}
        </select>
      </div> : <p className="mt-5 text-sm font-semibold text-ink-800">{scenario.label}</p>}
      <div className="mt-5 space-y-4" aria-hidden="true">
        <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-ink-700">{segments.map(segment => <span key={segment.key} className="inline-flex items-center gap-2"><span className={cx('h-3 w-3 shrink-0', segment.color)} />{segment.label}</span>)}</div>
        <div className="flex justify-between gap-3 font-mono text-xs text-ink-600"><span>{labels.scale}: {format(0)}</span><span>{format(scaleMax)}</span></div>
        {scenario.plans.map(plan => <div key={plan.id} data-policy-plan={plan.id}>
          <p className="mb-1 break-words text-sm font-medium text-ink-800">{plan.label}</p>
          <div className="flex h-5 w-full overflow-hidden rounded-sm bg-ink-100 ring-1 ring-ink-300">{segments.map(segment => <div key={segment.key} className={cx('h-full shrink-0', segment.color)} style={{ width: `${plan[segment.key] / scaleMax * 100}%` }} />)}</div>
        </div>)}
      </div>
      <div role="region" aria-label={labels.tableCaption} tabIndex={0} className="mt-6 max-w-full overflow-x-auto rounded-card border border-ink-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700">
        <table className="w-full min-w-[42rem] border-collapse text-left text-sm" style={{ display: 'table', overflow: 'visible', margin: 0 }}>
          <caption className="sr-only">{labels.tableCaption}</caption>
          <thead><tr className="bg-surface-sunken">{[labels.plan, labels.resources, labels.harmA, labels.harmB, labels.total, labels.transfer].map((label, index) => <th key={index} scope="col" className="border-b border-ink-300 px-3 py-3 font-semibold text-ink-800">{label}</th>)}</tr></thead>
          <tbody>{scenario.plans.map((plan, index) => <tr key={plan.id} className="border-b border-ink-200 last:border-b-0">
            <th scope="row" className="min-w-40 px-3 py-3 font-medium text-ink-900">{plan.label}</th>
            {[plan.resourceCost, plan.harmA, plan.harmB, audit.totals[index]!, plan.feeTransfer].map((amount, column) => <td key={column} className="whitespace-nowrap px-3 py-3 font-mono tabular-nums text-ink-800" data-policy-total={column === 3 ? plan.id : undefined}>{format(amount)}</td>)}
          </tr>)}</tbody>
        </table>
      </div>
      <p className="mt-3 text-sm leading-relaxed text-ink-700">{labels.transferNote}</p>
      <p className="mt-4 text-sm font-semibold text-ink-900" aria-live="polite" aria-atomic="true" role="status">{summary}</p>
    </figure>
  );
}
