import { useId, useState } from 'react';
import { cx } from '@/components/react/cx';

export interface AggregationCell { events: number; total: number }
export interface AggregationStratum { id: string; label: string }
export interface AggregationOption { id: string; label: string; cells: AggregationCell[] }
export interface AggregationReference { id: string; label: string; weights: number[] }
export interface AggregationCase {
  id: string;
  label: string;
  strata: AggregationStratum[];
  options: AggregationOption[];
  references: AggregationReference[];
}
export interface AggregationRational { n: bigint; d: bigint }
export interface AggregationTraceLabels {
  caseLabel: string;
  referenceLabel: string;
  observedHeading: string;
  referenceHeading: string;
  observedTableLabel: string;
  referenceTableLabel: string;
  optionLabel: string;
  stratumLabel: string;
  countsLabel: string;
  rateLabel: string;
  ownWeightLabel: string;
  observedContributionLabel: string;
  referenceWeightLabel: string;
  referenceContributionLabel: string;
  observedTotalLabel: string;
  referenceIndexLabel: string;
  observedDifferenceLabel: string;
  referenceDifferenceLabel: string;
  segmentOrderLabel: string;
  pointLabel: string;
  pointsLabel: string;
  magnitudeLabel: string;
  tieLabel: string;
  higherTemplate: string;
}
export interface AggregationTraceProps {
  /** Complete, authored two-option/two-stratum count cases, never generated observations. */
  cases: AggregationCase[];
  title?: string;
  caption?: string;
  locale?: 'en' | 'es';
  /** Translate every key on Spanish callers; locale changes numbers only. */
  labels?: Partial<AggregationTraceLabels>;
  className?: string;
}
const DEFAULT_LABELS: AggregationTraceLabels = {
  caseLabel: 'Count table', referenceLabel: 'Common reference',
  observedHeading: 'Observed composition', referenceHeading: 'Common-reference indexes',
  observedTableLabel: 'Observed counts, own weights and contributions',
  referenceTableLabel: 'Same reference weights applied to both options',
  optionLabel: 'Option', stratumLabel: 'Stratum', countsLabel: 'Events / observations',
  rateLabel: 'Within-stratum fraction', ownWeightLabel: 'Own denominator share',
  observedContributionLabel: 'Contribution to observed total', referenceWeightLabel: 'Reference share',
  referenceContributionLabel: 'Contribution to reference index', observedTotalLabel: 'Observed total',
  referenceIndexLabel: 'Reference index', observedDifferenceLabel: 'Observed difference',
  referenceDifferenceLabel: 'Reference-index difference', segmentOrderLabel: 'Segments from left to right',
  pointLabel: 'percentage point', pointsLabel: 'percentage points', magnitudeLabel: 'in magnitude',
  tieLabel: 'The reference indexes are equal.',
  higherTemplate: '{option} has the higher reference index.',
};
function dense(value: unknown, low: number, high: number, path: string): asserts value is unknown[] {
  if (!Array.isArray(value) || value.length < low || value.length > high) throw Error(`AggregationTrace: ${path} must have ${low}–${high} entries.`);
  for (let i = 0; i < value.length; i++) if (!Object.hasOwn(value, i) || value[i] == null) throw Error(`AggregationTrace: ${path}[${i}] is missing.`);
}
function named(value: unknown, path: string): asserts value is { id: string; label: string } {
  if (!value || typeof value !== 'object') throw Error(`AggregationTrace: ${path} must be an object.`);
  for (const key of ['id', 'label'] as const) if (typeof (value as Record<string, unknown>)[key] !== 'string' || !(value as Record<string, string>)[key]!.trim()) throw Error(`AggregationTrace: ${path}.${key} must be nonempty.`);
}
function unique(values: Array<{ id: string; label: string }>, path: string) {
  for (const key of ['id', 'label'] as const) if (new Set(values.map(v => v[key].trim())).size !== values.length) throw Error(`AggregationTrace: ${path} ${key}s must be unique.`);
}
function integer(value: unknown, low: number, high: number, path: string): asserts value is number {
  if (!Number.isSafeInteger(value) || (value as number) < low || (value as number) > high) throw Error(`AggregationTrace: ${path} must be an integer between ${low} and ${high}.`);
}
function validateCases(cases: AggregationCase[]) {
  dense(cases, 1, 8, 'cases');
  for (const [i, c] of cases.entries()) {
    named(c, `cases[${i}]`);
    dense(c.strata, 2, 2, `${c.id}.strata`); c.strata.forEach((s, j) => named(s, `${c.id}.strata[${j}]`)); unique(c.strata, `${c.id}.strata`);
    dense(c.options, 2, 2, `${c.id}.options`);
    for (const [j, option] of c.options.entries()) {
      named(option, `${c.id}.options[${j}]`); dense(option.cells, 2, 2, `${option.id}.cells`);
      for (const [k, cell] of option.cells.entries()) {
        integer(cell.total, 1, 1_000_000, `${option.id}.cells[${k}].total`);
        integer(cell.events, 0, cell.total, `${option.id}.cells[${k}].events`);
      }
    }
    unique(c.options, `${c.id}.options`); dense(c.references, 1, 8, `${c.id}.references`);
    for (const [j, ref] of c.references.entries()) {
      named(ref, `${c.id}.references[${j}]`); dense(ref.weights, 2, 2, `${ref.id}.weights`);
      ref.weights.forEach((w, k) => integer(w, 0, 1_000_000, `${ref.id}.weights[${k}]`));
      if (ref.weights[0]! + ref.weights[1]! <= 0) throw Error(`AggregationTrace: ${ref.id}.weights must have a positive sum.`);
    }
    unique(c.references, `${c.id}.references`);
  }
  unique(cases, 'cases');
}
function gcd(a: bigint, b: bigint): bigint { while (b) { const rest = a % b; a = b; b = rest; } return a; }
function rational(n: bigint, d = 1n): AggregationRational {
  if (d <= 0n) throw Error('AggregationTrace: a rational denominator must be positive.');
  const factor = gcd(n < 0n ? -n : n, d);
  return { n: n / factor, d: d / factor };
}
const add = (a: AggregationRational, b: AggregationRational) => rational(a.n * b.d + b.n * a.d, a.d * b.d);
const times = (a: AggregationRational, b: AggregationRational) => rational(a.n * b.n, a.d * b.d);
const subtract = (a: AggregationRational, b: AggregationRational) => add(a, { n: -b.n, d: b.d });
function evaluateValidated(c: AggregationCase, referenceIndex: number) {
  const ref = c.references[referenceIndex]!;
  const weightTotal = BigInt(ref.weights[0]! + ref.weights[1]!);
  const referenceWeights = ref.weights.map(w => rational(BigInt(w), weightTotal));
  const options = c.options.map(option => {
    const observations = option.cells.reduce((s, v) => s + v.total, 0);
    const events = option.cells.reduce((s, v) => s + v.events, 0);
    const rates = option.cells.map(v => rational(BigInt(v.events), BigInt(v.total)));
    const ownWeights = option.cells.map(v => rational(BigInt(v.total), BigInt(observations)));
    const observedContributions = option.cells.map(v => rational(BigInt(v.events), BigInt(observations)));
    const referenceContributions = rates.map((v, i) => times(v, referenceWeights[i]!));
    return { id: option.id, observations, events, rates, ownWeights, observedContributions,
      observed: rational(BigInt(events), BigInt(observations)), referenceContributions,
      index: referenceContributions.reduce(add, rational(0n)) };
  });
  const difference = subtract(options[0]!.index, options[1]!.index);
  return { options, referenceWeights, difference,
    observedDifference: subtract(options[0]!.observed, options[1]!.observed),
    comparison: difference.n === 0n ? 'equal' as const : difference.n > 0n ? 'first' as const : 'second' as const };
}
/** Exact evaluator of this bounded complete two-by-two model; direct-module test API only. */
export function evaluateAggregationCase(c: AggregationCase, referenceIndex = 0) {
  validateCases([c]); integer(referenceIndex, 0, c.references.length - 1, 'referenceIndex');
  return evaluateValidated(c, referenceIndex);
}
function decimal(f: AggregationRational, locale: 'en' | 'es') {
  const abs = f.n < 0n ? -f.n : f.n, scaled = abs * 100n, remainder = scaled % f.d;
  const hundredths = scaled / f.d + (2n * remainder >= f.d ? 1n : 0n);
  const whole = hundredths / 100n, tail = String(hundredths % 100n).padStart(2, '0').replace(/0+$/, '');
  return { tiny: f.n !== 0n && hundredths === 0n, exact: remainder === 0n,
    text: `${f.n < 0n ? '−' : ''}${new Intl.NumberFormat(locale === 'es' ? 'es-ES' : 'en-US').format(whole)}${tail ? (locale === 'es' ? ',' : '.') + tail : ''}` };
}
function fraction(f: AggregationRational, locale: 'en' | 'es') {
  const fmt = new Intl.NumberFormat(locale === 'es' ? 'es-ES' : 'en-US');
  const numerator = fmt.format(f.n);
  return f.d === 1n ? numerator : `${numerator} / ${fmt.format(f.d)}`;
}
function proportionText(f: AggregationRational, locale: 'en' | 'es') {
  const pct = decimal(times(f, rational(100n)), locale), limit = locale === 'es' ? '0,01' : '0.01';
  return `${fraction(f, locale)} (${pct.tiny ? '<' + limit : (pct.exact ? '' : '≈') + pct.text}%)`;
}
function pointsText(f: AggregationRational, locale: 'en' | 'es', labels: AggregationTraceLabels) {
  const points = times(f, rational(100n)), number = decimal(points, locale);
  const unit = points.n === points.d || points.n === -points.d ? labels.pointLabel : labels.pointsLabel;
  if (points.d === 1n) return `${fraction(points, locale)} ${unit}`;
  return `${fraction(points, locale)} ${unit} (${number.tiny ? labels.magnitudeLabel + ' <' + (locale === 'es' ? '0,01' : '0.01') : (number.exact ? '' : '≈') + number.text})`;
}
const ratio = (f: AggregationRational) => Number(f.n) / Number(f.d);

export function AggregationTrace({ cases, title, caption, locale = 'en', labels: supplied, className }: AggregationTraceProps) {
  validateCases(cases);
  if (locale !== 'en' && locale !== 'es') throw Error('AggregationTrace: locale must be en or es.');
  if (supplied !== undefined && (!supplied || typeof supplied !== 'object' || Array.isArray(supplied))) throw Error('AggregationTrace: labels must be an object when supplied.');
  for (const [key, value] of Object.entries(supplied ?? {})) {
    if (!Object.hasOwn(DEFAULT_LABELS, key) || typeof value !== 'string' || !value.trim()) throw Error(`AggregationTrace: invalid label ${key}.`);
  }
  const labels = { ...DEFAULT_LABELS, ...supplied };
  if ((labels.higherTemplate.match(/\{option\}/g) ?? []).length !== 1) throw Error('AggregationTrace: higherTemplate needs exactly one {option} token.');
  for (const [key, value] of Object.entries({ title, caption, className })) {
    if (value !== undefined && typeof value !== 'string') throw Error(`AggregationTrace: ${key} must be a string when supplied.`);
  }
  const id = useId(), [caseIndex, setCaseIndex] = useState(0), [referenceIndex, setReferenceIndex] = useState(0);
  const c = cases[Math.min(caseIndex, cases.length - 1)]!, ri = Math.min(referenceIndex, c.references.length - 1);
  const selected = c.references[ri]!, value = evaluateValidated(c, ri);
  const count = new Intl.NumberFormat(locale === 'es' ? 'es-ES' : 'en-US');
  const cellClass = 'p-3 align-top text-left';
  const scrollClass = 'my-4 max-w-full overflow-x-auto focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700';
  const tableStyle = { display: 'table', overflow: 'visible', margin: 0, minWidth: '48rem' } as const;
  const comparison = value.comparison === 'equal' ? labels.tieLabel : labels.higherTemplate.replace('{option}', () => c.options[value.comparison === 'first' ? 0 : 1]!.label);
  const bars = (mode: 'observed' | 'reference') => <div className="space-y-4" data-aggregation-bars={mode}>
    {value.options.map((option, i) => {
      const pieces = mode === 'observed' ? option.observedContributions : option.referenceContributions;
      const total = mode === 'observed' ? option.observed : option.index;
      return <div key={option.id}>
        <div className="mb-1 flex flex-wrap justify-between gap-x-4 gap-y-1 text-sm"><span className="font-semibold">{c.options[i]!.label}</span><span className="break-words font-mono tabular-nums" data-option-total={option.id} data-mode={mode} data-numerator={String(total.n)} data-denominator={String(total.d)}>{proportionText(total, locale)}</span></div>
        <div aria-hidden="true" className="relative h-5 overflow-hidden bg-ink-100" data-fixed-scale="0,1">
          {pieces.map((part, j) => <div key={j} className={cx('absolute inset-0 origin-left', j === 0 ? 'bg-brand-700' : 'bg-ink-500')} style={{ transform: `translateX(${j === 0 ? 0 : ratio(pieces[0]!) * 100}%) scaleX(${ratio(part)})` }} data-stratum={c.strata[j]!.id} data-numerator={String(part.n)} data-denominator={String(part.d)} />)}
        </div>
      </div>;
    })}
    <div aria-hidden="true" className="flex justify-between font-mono text-xs text-ink-600"><span>0%</span><span>100%</span></div>
  </div>;
  return <figure className={cx('not-prose my-8 min-w-0 max-w-full', className)} aria-labelledby={title ? `${id}-title` : undefined} data-aggregation-trace="">
    {title ? <figcaption id={`${id}-title`} className="font-display text-lg font-semibold text-ink-900">{title}</figcaption> : null}
    {cases.length > 1 ? <div className="mt-4"><label className="block text-sm font-semibold" htmlFor={`${id}-case`}>{labels.caseLabel}</label><select id={`${id}-case`} value={caseIndex} onChange={e => { setCaseIndex(Number(e.currentTarget.value)); setReferenceIndex(0); }} className="mt-1 min-h-11 w-full border border-ink-400 bg-surface px-3 text-sm focus-visible:outline-2 focus-visible:outline-brand-700">{cases.map((x, i) => <option key={x.id} value={i}>{x.label}</option>)}</select></div> : <p className="mt-3 font-semibold text-ink-800">{c.label}</p>}
    <p className="mt-5 font-semibold text-ink-900">{labels.observedHeading}</p>
    <div className={scrollClass} role="region" tabIndex={0} aria-label={labels.observedTableLabel}>
      <table style={tableStyle} className="w-full text-sm text-ink-800"><caption className="sr-only">{labels.observedTableLabel}</caption><thead><tr>{[labels.optionLabel, labels.stratumLabel, labels.countsLabel, labels.rateLabel, labels.ownWeightLabel, labels.observedContributionLabel].map(x => <th scope="col" className={cellClass} key={x}>{x}</th>)}</tr></thead><tbody>
        {c.options.flatMap((option, i) => option.cells.map((cell, j) => <tr key={`${option.id}-${j}`}><th scope="row" className={cellClass}>{option.label}</th><td className={cellClass}>{c.strata[j]!.label}</td><td className={cellClass}>{count.format(cell.events)} / {count.format(cell.total)}</td><td className={cellClass}>{proportionText(value.options[i]!.rates[j]!, locale)}</td><td className={cellClass}>{proportionText(value.options[i]!.ownWeights[j]!, locale)}</td><td className={cellClass}>{fraction(value.options[i]!.observedContributions[j]!, locale)} ({pointsText(value.options[i]!.observedContributions[j]!, locale, labels)})</td></tr>))}
      </tbody></table>
    </div>
    <p className="mb-2 text-sm font-semibold">{labels.observedTotalLabel}</p>{bars('observed')}
    <p className="mt-3 text-sm text-ink-700">{labels.observedDifferenceLabel}, {c.options[0]!.label} − {c.options[1]!.label}: <span className="font-mono">{pointsText(value.observedDifference, locale, labels)}</span></p>
    <p className="mt-7 font-semibold text-ink-900">{labels.referenceHeading}</p>
    {c.references.length > 1 ? <div className="mt-3"><label className="block text-sm font-semibold" htmlFor={`${id}-reference`}>{labels.referenceLabel}</label><select id={`${id}-reference`} value={ri} onChange={e => setReferenceIndex(Number(e.currentTarget.value))} className="mt-1 min-h-11 w-full border border-ink-400 bg-surface px-3 text-sm focus-visible:outline-2 focus-visible:outline-brand-700">{c.references.map((r, i) => <option value={i} key={r.id}>{r.label}</option>)}</select></div> : <p className="mt-2 text-sm">{labels.referenceLabel}: {selected.label}</p>}
    <p className="mt-3 text-sm text-ink-600">{labels.segmentOrderLabel}: {c.strata.map(x => x.label).join(' → ')}</p>
    <div className={scrollClass} role="region" tabIndex={0} aria-label={labels.referenceTableLabel}>
      <table style={{ ...tableStyle, minWidth: '38rem' }} className="w-full text-sm text-ink-800"><caption className="sr-only">{labels.referenceTableLabel}</caption><thead><tr>{[labels.optionLabel, labels.stratumLabel, labels.referenceWeightLabel, labels.referenceContributionLabel].map(x => <th scope="col" className={cellClass} key={x}>{x}</th>)}</tr></thead><tbody>
        {c.options.flatMap((option, i) => option.cells.map((_, j) => <tr key={`${option.id}-${j}`}><th scope="row" className={cellClass}>{option.label}</th><td className={cellClass}>{c.strata[j]!.label}</td><td className={cellClass}>{proportionText(value.referenceWeights[j]!, locale)}</td><td className={cellClass}>{fraction(value.options[i]!.referenceContributions[j]!, locale)} ({pointsText(value.options[i]!.referenceContributions[j]!, locale, labels)})</td></tr>))}
      </tbody></table>
    </div>
    <p className="mb-2 text-sm font-semibold">{labels.referenceIndexLabel}</p>{bars('reference')}
    <p className="mt-3 break-words text-sm text-ink-800" aria-live="polite" aria-atomic="true" data-comparison={value.comparison}>{labels.referenceDifferenceLabel}, {c.options[0]!.label} − {c.options[1]!.label}: <span className="font-mono">{pointsText(value.difference, locale, labels)}</span>. {comparison}</p>
    {caption ? <p className="mt-4 text-sm text-ink-600">{caption}</p> : null}
  </figure>;
}
