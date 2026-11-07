import { useId, useState } from 'react';
import { cx } from '@/components/react/cx';

/** The numerator of a reproduction probability over the fixed denominator four. */
export type BranchingQuarter = 1 | 2 | 3;
/** Exact finite law; weights share the positive integer denominator. */
export interface BranchingLaw {
  weights: number[];
  denominator: number;
  meanNumerator: number;
  meanDenominator: number;
}
/** Optional replacements for the component's localized interface strings. */
export interface BranchingDistributionLabels {
  probability: string;
  founders: string;
  generation: string;
  rule: string;
  scale: string;
  count: string;
  exact: string;
  approximate: string;
  mean: string;
  zero: string;
  impossibleMean: string;
  possibleMean: string;
  otherCounts: string;
  table: string;
}
/** A bounded abstract zero-or-two offspring law, never a physical simulation. */
export interface BranchingDistributionProps {
  title: string;
  initialProbabilityQuarter?: BranchingQuarter;
  initialFounders?: 1 | 2;
  initialGeneration?: 0 | 1 | 2 | 3;
  locale?: 'en' | 'es';
  labels?: Partial<BranchingDistributionLabels>;
  className?: string;
}

const defaults: Record<'en' | 'es', BranchingDistributionLabels> = {
  en: {
    probability: 'Probability of two descendants', founders: 'Initial count', generation: 'Generation',
    rule: 'Each entity leaves zero descendants with probability 1 − p, or two with probability p. All reproduction choices are independent; the parent leaves.',
    scale: 'Fixed scales: count from zero to sixteen; probability from zero to one hundred percent. Dashed line: expected count, not a path.',
    count: 'Count', exact: 'Exact probability', approximate: 'Approximate probability', mean: 'Expected count', zero: 'Probability of zero by this generation',
    impossibleMean: 'This expected count is not a possible outcome in this generation.',
    possibleMean: 'The mean is also a possible outcome here; consult its probability to see whether it is certain.',
    otherCounts: 'Every count omitted from the table has probability zero.', table: 'Exact generation-size distribution',
  },
  es: {
    probability: 'Probabilidad de dos descendientes', founders: 'Recuento inicial', generation: 'Generación',
    rule: 'Cada entidad deja cero descendientes con probabilidad 1 − p, o dos con probabilidad p. Todas las decisiones de reproducción son independientes; la entidad original sale.',
    scale: 'Escalas fijas: recuento de cero a dieciséis; probabilidad de cero a cien por cien. Línea discontinua: recuento esperado, no una trayectoria.',
    count: 'Recuento', exact: 'Probabilidad exacta', approximate: 'Probabilidad aproximada', mean: 'Recuento esperado', zero: 'Probabilidad de cero hasta esta generación',
    impossibleMean: 'Este recuento esperado no es un resultado posible en esta generación.',
    possibleMean: 'En este estado, la media también es un resultado posible; consulta su probabilidad para saber si es seguro.',
    otherCounts: 'Los recuentos omitidos de la tabla tienen probabilidad cero.', table: 'Distribución exacta del tamaño de la generación',
  },
};

function validate(quarter: number, founders: number, generation: number): void {
  if (![1, 2, 3].includes(quarter) || ![1, 2].includes(founders) || ![0, 1, 2, 3].includes(generation)) {
    throw new Error('BranchingDistribution: use a quarter numerator 1–3, one or two founders, and generation 0–3.');
  }
}
function gcd(a: number, b: number): number { return b === 0 ? a : gcd(b, a % b); }
function convolve(a: number[], b: number[]): number[] {
  const result = Array<number>(a.length + b.length - 1).fill(0);
  for (const [i, x] of a.entries()) for (const [j, y] of b.entries()) result[i + j]! += x * y;
  return result;
}
function reduce(weights: number[], denominator: number): { weights: number[]; denominator: number } {
  const divisor = weights.reduce((d, weight) => gcd(d, weight), denominator);
  return { weights: weights.map(weight => weight / divisor), denominator: denominator / divisor };
}

/**
 * Compute the exact law by polynomial composition: P₀(s)=s,
 * Pₜ₊₁(s)=(1−p)+pPₜ(s)². Independent founders multiply polynomials.
 * The bounded domain keeps every intermediate integer safely exact in Number.
 */
export function getBranchingDistribution(quarter: BranchingQuarter, founders: 1 | 2, generation: 0 | 1 | 2 | 3): BranchingLaw {
  validate(quarter, founders, generation);
  let weights = [0, 1], denominator = 1;
  for (let t = 0; t < generation; t++) {
    const next = convolve(weights, weights).map(weight => quarter * weight);
    next[0]! += (4 - quarter) * denominator ** 2;
    ({ weights, denominator } = reduce(next, 4 * denominator ** 2));
  }
  if (founders === 2) ({ weights, denominator } = reduce(convolve(weights, weights), denominator ** 2));
  const numerator = weights.reduce((sum, weight, count) => sum + count * weight, 0);
  const divisor = gcd(numerator, denominator);
  return { weights, denominator, meanNumerator: numerator / divisor, meanDenominator: denominator / divisor };
}

/** Exact finite distributions with native controls, a fixed-scale chart and a readable table. */
export function BranchingDistribution({
  title, initialProbabilityQuarter = 2, initialFounders = 1, initialGeneration = 2,
  locale = 'en', labels, className,
}: BranchingDistributionProps) {
  // Reject malformed authored data during SSR, before any hook or hidden state.
  validate(initialProbabilityQuarter, initialFounders, initialGeneration);
  if (typeof title !== 'string' || !title.trim()) throw new Error('BranchingDistribution: title must be nonempty.');
  if (locale !== 'en' && locale !== 'es') throw new Error('BranchingDistribution: locale must be en or es.');
  if (labels !== undefined && (!labels || typeof labels !== 'object' || Array.isArray(labels))) throw new Error('BranchingDistribution: labels must be an object.');
  for (const [key, value] of Object.entries(labels ?? {})) {
    if (!Object.hasOwn(defaults.en, key) || typeof value !== 'string' || !value.trim()) throw new Error(`BranchingDistribution: invalid label ${key}.`);
  }
  const id = useId();
  const [quarter, setQuarter] = useState(initialProbabilityQuarter);
  const [founders, setFounders] = useState(initialFounders);
  const [generation, setGeneration] = useState(initialGeneration);
  const text = { ...defaults[locale], ...labels };
  const law = getBranchingDistribution(quarter, founders, generation);
  const mean = law.meanNumerator / law.meanDenominator;
  const possibleMean = Number.isInteger(mean) && (law.weights[mean] ?? 0) > 0;
  const integer = new Intl.NumberFormat(locale === 'es' ? 'es-ES' : 'en-US', { useGrouping: false });
  const percent = new Intl.NumberFormat(locale === 'es' ? 'es-ES' : 'en-US', { style: 'percent', maximumFractionDigits: 2 });
  const exact = (numerator: number, denominator: number): string => {
    const d = gcd(numerator, denominator);
    return denominator / d === 1 ? integer.format(numerator / d) : `${integer.format(numerator / d)}/${integer.format(denominator / d)}`;
  };
  const selectClass = 'mt-auto min-h-11 w-full rounded-card border border-ink-300 bg-surface px-3 py-2 text-sm text-ink-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700';
  const cell = { padding: 'calc(var(--spacing) * 2) calc(var(--spacing) * 3)', verticalAlign: 'middle' as const };
  return (
    <figure className={cx('not-prose my-8 text-ink-900', className)} aria-labelledby={`${id}-title`}>
      <figcaption id={`${id}-title`} className="mb-3 font-display text-lg font-semibold">{title}</figcaption>
      <p className="m-0 text-sm leading-relaxed text-ink-700">{text.rule}</p>
      <div className="my-5 grid gap-4 sm:grid-cols-3">
        <label className="flex min-w-0 flex-col gap-2 text-sm font-semibold" htmlFor={`${id}-p`}><span>{text.probability}</span>
          <select id={`${id}-p`} className={selectClass} value={quarter} onChange={event => setQuarter(Number(event.currentTarget.value) as BranchingQuarter)}>
            {[1, 2, 3].map(value => <option key={value} value={value}>{exact(value, 4)}</option>)}
          </select>
        </label>
        <label className="flex min-w-0 flex-col gap-2 text-sm font-semibold" htmlFor={`${id}-n`}><span>{text.founders}</span>
          <select id={`${id}-n`} className={selectClass} value={founders} onChange={event => setFounders(Number(event.currentTarget.value) as 1 | 2)}>
            {[1, 2].map(value => <option key={value} value={value}>{integer.format(value)}</option>)}
          </select>
        </label>
        <label className="flex min-w-0 flex-col gap-2 text-sm font-semibold" htmlFor={`${id}-t`}><span>{text.generation}</span>
          <select id={`${id}-t`} className={selectClass} value={generation} onChange={event => setGeneration(Number(event.currentTarget.value) as 0 | 1 | 2 | 3)}>
            {[0, 1, 2, 3].map(value => <option key={value} value={value}>{integer.format(value)}</option>)}
          </select>
        </label>
      </div>
      <p className="mb-2 text-sm leading-relaxed text-ink-700">{text.scale}</p>
      <div aria-hidden="true" className="flex gap-2">
        <div className="flex h-48 shrink-0 flex-col justify-between text-right font-mono text-xs tabular-nums text-ink-600">
          <span>{percent.format(1)}</span><span>{percent.format(0.5)}</span><span>{percent.format(0)}</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="relative h-48 border-b border-l border-ink-500 bg-surface">
            <div className="absolute inset-0 grid grid-cols-[repeat(17,minmax(0,1fr))] items-end gap-px">
              {Array.from({ length: 17 }, (_, count) => <div key={count} className="h-full origin-bottom bg-brand-700 transition-transform duration-300 motion-reduce:transition-none" style={{ transform: `scaleY(${(law.weights[count] ?? 0) / law.denominator})` }} />)}
            </div>
            <div className="pointer-events-none absolute inset-y-0 border-l-2 border-dashed border-ink-900" style={{ left: `${(mean + 0.5) / 17 * 100}%` }} />
          </div>
          <div className="mt-1 grid grid-cols-[repeat(17,minmax(0,1fr))] text-center font-mono text-xs tabular-nums text-ink-600">
            {Array.from({ length: 17 }, (_, count) => <span key={count}>{count % 4 === 0 ? integer.format(count) : ''}</span>)}
          </div>
          <p className="mt-1 text-center text-xs text-ink-600">{text.count}</p>
        </div>
      </div>
      <div role="status" aria-live="polite" aria-atomic="true" className="my-5 border-l-2 border-ink-900 pl-4 text-sm leading-relaxed">
        <p className="m-0">{text.generation}: <strong>{integer.format(generation)}</strong>. {text.mean}: <strong className="font-mono tabular-nums">{exact(law.meanNumerator, law.meanDenominator)}</strong>.</p>
        <p className="my-1">{text.zero}: <strong className="font-mono tabular-nums">{exact(law.weights[0] ?? 0, law.denominator)}</strong> (≈ {percent.format((law.weights[0] ?? 0) / law.denominator)}).</p>
        <p className="m-0">{possibleMean ? text.possibleMean : text.impossibleMean}</p>
      </div>
      <div role="region" aria-label={text.table} tabIndex={0} className="max-w-full overflow-x-auto focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-700">
        <table className="w-full border-collapse text-sm" style={{ margin: 0, boxShadow: 'none', borderRadius: 0 }}>
          <caption className="mb-2 text-left text-sm font-semibold">{text.table}</caption>
          <thead><tr className="border-b border-ink-300">
            <th scope="col" style={{ ...cell, textAlign: 'right' }}>{text.count}</th>
            <th scope="col" style={{ ...cell, textAlign: 'right' }}>{text.exact}</th>
            <th scope="col" style={{ ...cell, textAlign: 'right' }}>{text.approximate}</th>
          </tr></thead>
          <tbody>{law.weights.map((weight, count) => weight > 0 || count === 0 ? <tr key={count} className="border-b border-ink-200 font-mono tabular-nums">
            <th scope="row" style={{ ...cell, textAlign: 'right' }}>{integer.format(count)}</th>
            <td style={{ ...cell, textAlign: 'right' }}>{exact(weight, law.denominator)}</td>
            <td style={{ ...cell, textAlign: 'right' }}>≈ {percent.format(weight / law.denominator)}</td>
          </tr> : null)}</tbody>
        </table>
      </div>
      <p className="mt-2 text-sm text-ink-700">{text.otherCounts}</p>
    </figure>
  );
}
export default BranchingDistribution;
