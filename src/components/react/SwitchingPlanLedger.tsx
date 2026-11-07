import { useId, useState } from 'react';
import { cx } from '@/components/react/cx';

export interface SwitchingPlanLabels {
  installed: string;
  horizon: string;
  fee: string;
  periodsTemplate: string;
  tableCaption: string;
  trace: string;
  gross: string;
  changes: string;
  totalCost: string;
  net: string;
  best: string;
  axis: string;
  zero: string;
  /** Live result with {plans} and {net}; the latter includes the unit. */
  bestTemplate: string;
}
export interface SwitchingPlanLedgerProps {
  title: string;
  instructions: string;
  caption: string;
  /** Two or three known per-period benefits, after routine costs but before migration. */
  benefitsA: number[];
  benefitsB: number[];
  /** Increasing menu of repeated transactional costs, charged on every change. */
  fees: number[];
  initialFee: number;
  initialInstalled?: 'A' | 'B';
  initialHorizon?: 2 | 3;
  platformA?: string;
  platformB?: string;
  /** A defined abbreviation avoids singular/plural ambiguity. */
  unit: string;
  locale?: 'en' | 'es';
  labels: SwitchingPlanLabels;
  className?: string;
}
export interface SwitchingPlanRow {
  plan: ('A' | 'B')[];
  gross: number;
  changes: number;
  totalCost: number;
  net: number;
}
function validateBenefits(a: number[], b: number[]) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length || (a.length !== 2 && a.length !== 3) || [...a, ...b].some(x => !Number.isFinite(x))) throw new Error('SwitchingPlanLedger needs matching finite benefit arrays of length two or three');
}
/** Enumerate every binary continuation; the installed state is the first transition origin. */
export function switchingPlans(a: number[], b: number[], installed: 'A' | 'B', horizon: 2 | 3, fee: number): SwitchingPlanRow[] {
  validateBenefits(a, b);
  if ((installed !== 'A' && installed !== 'B') || (horizon !== 2 && horizon !== 3) || horizon > a.length || !Number.isFinite(fee) || fee < 0) throw new Error('SwitchingPlanLedger needs a valid installed state, available horizon and nonnegative finite fee');
  return Array.from({ length: 2 ** horizon }, (_, n) => {
    const plan = Array.from({ length: horizon }, (_, t): 'A' | 'B' => (n & (1 << (horizon - 1 - t))) ? 'B' : 'A');
    let previous = installed;
    let changes = 0;
    let gross = 0;
    for (let t = 0; t < horizon; t++) {
      if (plan[t] !== previous) changes++;
      gross += plan[t] === 'A' ? a[t] : b[t];
      previous = plan[t];
    }
    const totalCost = changes * fee;
    const net = gross - totalCost;
    if (![gross, totalCost, net].every(Number.isFinite)) throw new Error('SwitchingPlanLedger arithmetic must remain finite');
    return { plan, gross, changes, totalCost, net };
  });
}
/** Finite accounting, not a market simulation or a forecast of participant behaviour. */
export function SwitchingPlanLedger({ title, instructions, caption, benefitsA, benefitsB, fees, initialFee, initialInstalled = 'A', initialHorizon = 2, platformA = 'A', platformB = 'B', unit, locale = 'en', labels, className }: SwitchingPlanLedgerProps) {
  validateBenefits(benefitsA, benefitsB);
  if (!Array.isArray(fees) || !fees.length || Array.from(fees).some((x, i) => !Number.isFinite(x) || x < 0 || (i > 0 && x <= fees[i - 1])) || !fees.includes(initialFee)) throw new Error('SwitchingPlanLedger needs increasing finite nonnegative fees including initialFee');
  const keys: (keyof SwitchingPlanLabels)[] = ['installed', 'horizon', 'fee', 'periodsTemplate', 'tableCaption', 'trace', 'gross', 'changes', 'totalCost', 'net', 'best', 'axis', 'zero', 'bestTemplate'];
  if ([title, instructions, caption, platformA, platformB, unit].some(x => typeof x !== 'string' || !x.trim()) || platformA === platformB || !labels || keys.some(k => typeof labels[k] !== 'string' || !labels[k].trim()) || !labels.periodsTemplate.includes('{count}') || (!labels.bestTemplate.includes('{plans}') || !labels.bestTemplate.includes('{net}'))) throw new Error('SwitchingPlanLedger needs distinct platform names, text and every localized label/template');
  if (locale !== 'en' && locale !== 'es') throw new Error('SwitchingPlanLedger locale must be en or es');
  switchingPlans(benefitsA, benefitsB, initialInstalled, initialHorizon, initialFee);
  const horizons: (2 | 3)[] = benefitsA.length === 3 ? [2, 3] : [2];
  const all = horizons.flatMap(h => (['A', 'B'] as const).flatMap(s => fees.flatMap(k => switchingPlans(benefitsA, benefitsB, s, h, k).map(r => r.net))));
  const lo = Math.min(0, ...all);
  const hi = Math.max(0, ...all);
  const span = hi - lo;
  if (!Number.isFinite(span)) throw new Error('SwitchingPlanLedger axis range must remain finite');
  // Normalize first so valid large benefits cannot overflow the percentage calculation.
  const position = (x: number) => span === 0 ? 50 : ((x - lo) / span) * 100;
  const zero = position(0);
  const id = useId();
  const [installed, setInstalled] = useState(initialInstalled);
  const [horizon, setHorizon] = useState<2 | 3>(initialHorizon);
  const [fee, setFee] = useState(initialFee);
  const rows = switchingPlans(benefitsA, benefitsB, installed, horizon, fee);
  const best = Math.max(...rows.map(r => r.net));
  const number = new Intl.NumberFormat(locale === 'es' ? 'es-ES' : 'en-US', { maximumSignificantDigits: 15 });
  const fmt = (n: number) => number.format(n === 0 ? 0 : n);
  const name = (p: 'A' | 'B') => p === 'A' ? platformA : platformB;
  const plans = rows.filter(r => r.net === best).map(r => r.plan.map(name).join(' → ')).join('; ');
  const field = 'min-h-11 min-w-0 w-full rounded-card border border-ink-300 bg-surface px-3 py-2 text-ink-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600';
  return <figure className={cx('not-prose brutal my-6 bg-surface p-5 sm:p-6', className)} aria-labelledby={`${id}-title`}>
    <p id={`${id}-title`} className="font-display text-lg font-semibold text-ink-900">{title}</p>
    <p className="mt-2 text-sm text-ink-700">{instructions}</p>
    <div className="mt-4 grid items-end gap-3 sm:grid-cols-3">
      <label htmlFor={`${id}-installed`} className="grid min-w-0 gap-1 text-sm font-semibold text-ink-800">{labels.installed}<select id={`${id}-installed`} value={installed} onChange={e => setInstalled(e.currentTarget.value as 'A' | 'B')} className={field}><option value="A">{platformA}</option><option value="B">{platformB}</option></select></label>
      <label htmlFor={`${id}-horizon`} className="grid min-w-0 gap-1 text-sm font-semibold text-ink-800">{labels.horizon}<select id={`${id}-horizon`} value={horizon} onChange={e => setHorizon(Number(e.currentTarget.value) as 2 | 3)} className={field}>{horizons.map(h => <option key={h} value={h}>{labels.periodsTemplate.replace('{count}', fmt(h))}</option>)}</select></label>
      <label htmlFor={`${id}-fee`} className="grid min-w-0 gap-1 text-sm font-semibold text-ink-800">{labels.fee}<select id={`${id}-fee`} value={fee} onChange={e => setFee(Number(e.currentTarget.value))} className={field}>{fees.map(k => <option key={k} value={k}>{fmt(k)} {unit}</option>)}</select></label>
    </div>
    <p className="sr-only" aria-live="polite" aria-atomic="true">{labels.bestTemplate.replace('{plans}', plans).replace('{net}', `${fmt(best)} ${unit}`)}</p>
    <p className="mt-5 text-xs text-ink-600">{labels.axis}</p>
    <div className="mt-3 overflow-x-auto focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600" role="region" tabIndex={0} aria-label={labels.tableCaption}>
      <table className="w-full min-w-[36rem] border-collapse text-left text-sm text-ink-800">
        <caption className="sr-only">{labels.tableCaption}</caption>
        <thead><tr>{[labels.trace, `${labels.gross} (${unit})`, labels.changes, `${labels.totalCost} (${unit})`, `${labels.net} (${unit})`].map((text, i) => <th key={i} scope="col" className="px-2 py-2 align-top font-semibold">{text}</th>)}</tr></thead>
        <tbody>{rows.map(r => <tr key={r.plan.join('')} className="odd:bg-surface-sunken">
          <th scope="row" className="px-2 py-3 align-top font-medium"><span className="whitespace-nowrap font-mono">{[installed, ...r.plan].map(name).join(' → ')}</span>{r.net === best && <span className="mt-1 block text-xs font-semibold text-brand-700">{labels.best}</span>}</th>
          <td className="px-2 py-3 align-top font-mono tabular-nums">{fmt(r.gross)}</td><td className="px-2 py-3 align-top font-mono tabular-nums">{fmt(r.changes)}</td><td className="px-2 py-3 align-top font-mono tabular-nums">{fmt(r.totalCost)}</td>
          <td className="min-w-40 px-2 py-3 align-top"><span className="font-mono tabular-nums">{fmt(r.net)}</span><div aria-hidden="true" className="relative mt-2 h-3 bg-surface-sunken"><span className={cx('absolute inset-y-0', r.net < 0 ? 'bg-danger' : 'bg-brand-700')} style={{ left: `${Math.min(zero, position(r.net))}%`, width: `${Math.abs(position(r.net) - zero)}%` }} /><span className="absolute -top-1 h-5 w-px bg-ink-800" style={{ left: `${zero}%` }} /></div></td>
        </tr>)}</tbody>
      </table>
    </div>
    <p className="mt-2 text-xs font-mono text-ink-600">{fmt(lo)} {unit} — {labels.zero}: {fmt(0)} {unit} — {fmt(hi)} {unit}</p>
    <figcaption className="mt-3 text-sm text-ink-600">{caption}</figcaption>
  </figure>;
}
export default SwitchingPlanLedger;
