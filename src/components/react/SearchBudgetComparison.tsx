import { useId, useState } from 'react';
import { cx } from '@/components/react/cx';

export interface SearchBudgetMethod {
  id: string;
  label: string;
  /** Expected gross benefit on the declared common cardinal scale. */
  gross: number;
  /** Fixed evaluation count for this protocol; not an adaptive stopping rule. */
  evaluations: number;
}
export interface SearchBudgetLabels {
  cost: string;
  method: string;
  gross: string;
  evaluations: string;
  totalCost: string;
  net: string;
  axis: string;
  zero: string;
  tableCaption: string;
}
export interface SearchBudgetComparisonProps {
  title: string;
  instructions: string;
  caption: string;
  methods: SearchBudgetMethod[];
  costs: number[];
  initialCost: number;
  /** Number formatting only; all interface strings are supplied separately. */
  locale?: 'en' | 'es';
  unit: string;
  labels: SearchBudgetLabels;
  className?: string;
}

function validateMethods(methods: SearchBudgetMethod[]): void {
  if (!Array.isArray(methods) || methods.length < 2) throw new Error('SearchBudgetComparison needs at least two methods');
  const ids = new Set<string>();
  for (const m of methods) {
    if (!m || typeof m.id !== 'string' || !m.id.trim() || ids.has(m.id)) throw new Error('SearchBudgetComparison needs unique nonempty method ids');
    ids.add(m.id);
    if (typeof m.label !== 'string' || !m.label.trim() || !Number.isFinite(m.gross) || !Number.isSafeInteger(m.evaluations) || m.evaluations < 0) throw new Error('SearchBudgetComparison needs labels, finite gross values and nonnegative integer counts');
  }
}

/** A fixed-protocol accounting comparison, not a search engine or optimum proof. */
export function searchBudgetAtCost(methods: SearchBudgetMethod[], cost: number) {
  validateMethods(methods);
  if (!Number.isFinite(cost) || cost < 0) throw new Error('SearchBudgetComparison cost must be finite and nonnegative');
  return methods.map(m => {
    const totalCost = m.evaluations * cost;
    const net = m.gross - totalCost;
    if (!Number.isFinite(totalCost) || !Number.isFinite(net)) throw new Error('SearchBudgetComparison arithmetic must remain finite');
    return { ...m, totalCost, net };
  });
}

/** Compare fixed protocols on a shared net-benefit axis as evaluation cost changes. */
export function SearchBudgetComparison({ title, instructions, caption, methods, costs, initialCost, locale = 'en', unit, labels, className }: SearchBudgetComparisonProps) {
  validateMethods(methods);
  if (!Array.isArray(costs) || !costs.length || Array.from(costs).some((c, i) => !Number.isFinite(c) || c < 0 || (i > 0 && c <= costs[i - 1]))) throw new Error('SearchBudgetComparison costs must be increasing, finite and nonnegative');
  if (!costs.includes(initialCost)) throw new Error('SearchBudgetComparison initialCost must occur in costs');
  if (locale !== 'en' && locale !== 'es') throw new Error('SearchBudgetComparison locale must be en or es');
  if ([title, instructions, caption, unit].some(s => typeof s !== 'string' || !s.trim())) throw new Error('SearchBudgetComparison text and unit must be nonempty');
  const keys: (keyof SearchBudgetLabels)[] = ['cost', 'method', 'gross', 'evaluations', 'totalCost', 'net', 'axis', 'zero', 'tableCaption'];
  if (!labels || keys.some(k => typeof labels[k] !== 'string' || !labels[k].trim())) throw new Error('SearchBudgetComparison needs every localised label');
  const allNets = costs.flatMap(c => searchBudgetAtCost(methods, c).map(m => m.net));
  const lo = Math.min(0, ...allNets);
  const hi = Math.max(0, ...allNets);
  const span = hi - lo;
  if (!Number.isFinite(span)) throw new Error('SearchBudgetComparison axis range must remain finite');
  const x = (n: number) => span === 0 ? 50 : ((n - lo) / span) * 100;
  const zero = x(0);
  const id = useId();
  const [cost, setCost] = useState(initialCost);
  const rows = searchBudgetAtCost(methods, cost);
  // Significant digits preserve a genuine tiny negative value instead of displaying zero.
  const number = new Intl.NumberFormat(locale === 'es' ? 'es-ES' : 'en-US', { maximumSignificantDigits: 15 });
  const fmt = (n: number) => `${number.format(n === 0 ? 0 : n)} ${unit.trim()}`;
  return <figure className={cx('not-prose brutal my-6 bg-surface p-5 sm:p-6', className)} aria-labelledby={`${id}-title`}>
    <p id={`${id}-title`} className="font-display text-lg font-semibold text-ink-900">{title}</p>
    <p className="mt-2 text-sm text-ink-700">{instructions}</p>
    <label htmlFor={`${id}-cost`} className="mt-4 grid min-w-0 gap-1 text-sm font-semibold text-ink-800">
      {labels.cost}
      <select id={`${id}-cost`} value={cost} onChange={e => setCost(Number(e.currentTarget.value))} className="min-h-11 min-w-0 w-full rounded-card border border-ink-300 bg-surface px-3 py-2 text-ink-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600">
        {costs.map(c => <option key={c} value={c}>{fmt(c)}</option>)}
      </select>
    </label>
    <div aria-live="polite" aria-atomic="true">
      <p className="mt-5 text-xs font-semibold text-ink-600">{labels.axis}</p>
      <ul className="mt-3 list-none space-y-4 p-0">
        {rows.map(m => <li key={m.id}>
          <p className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-sm text-ink-900"><span className="min-w-0 break-words font-semibold">{m.label}</span><span className="font-mono tabular-nums">{labels.net}: {fmt(m.net)}</span></p>
          <div aria-hidden="true" className="relative mt-2 h-4 bg-surface-sunken">
            <span className={cx('absolute inset-y-0 transition-[left,width] duration-300 motion-reduce:transition-none', m.net < 0 ? 'bg-danger' : 'bg-brand-700')} style={{ left: `${Math.min(zero, x(m.net))}%`, width: `${Math.abs(x(m.net) - zero)}%` }} />
            <span className="absolute -top-1 h-6 w-px bg-ink-800" style={{ left: `${zero}%` }} />
          </div>
        </li>)}
      </ul>
      <div aria-hidden="true" className="relative mt-3 h-10 font-mono text-xs text-ink-600">
        <span className="absolute left-0 top-0">{fmt(lo)}</span>
        <span className="absolute top-5 -translate-x-1/2" style={{ left: `${zero}%` }}>{labels.zero}: {fmt(0)}</span>
        <span className="absolute right-0 top-0">{fmt(hi)}</span>
      </div>
      <div className="mt-4 overflow-x-auto focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600" role="region" tabIndex={0} aria-label={labels.tableCaption}>
        <table className="w-full border-collapse text-left text-xs text-ink-800">
          <caption className="sr-only">{labels.tableCaption}</caption>
          <thead><tr>{[labels.method, labels.gross, labels.evaluations, labels.totalCost].map((s, i) => <th key={i} scope="col" className="px-2 py-2 align-top font-semibold">{s}</th>)}</tr></thead>
          <tbody>{rows.map(m => <tr key={m.id} className="odd:bg-surface-sunken"><th scope="row" className="px-2 py-2 align-top font-medium">{m.label}</th><td className="px-2 py-2 align-top font-mono">{fmt(m.gross)}</td><td className="px-2 py-2 align-top font-mono">{number.format(m.evaluations === 0 ? 0 : m.evaluations)}</td><td className="px-2 py-2 align-top font-mono">{fmt(m.totalCost)}</td></tr>)}</tbody>
        </table>
      </div>
    </div>
    <figcaption className="mt-3 text-sm text-ink-600">{caption}</figcaption>
  </figure>;
}

export default SearchBudgetComparison;
