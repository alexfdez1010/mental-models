import { useId, useState } from 'react';
import { cx } from '@/components/react/cx';

/** A fixed multiplier applied once per completed step, with a target relative to start. */
export interface GeometricThresholdScenario {
  id: string;
  label: string;
  /** Positive integer, at most one million. */
  start: number;
  /** Positive integers, each at most two hundred. */
  factorNumerator: number;
  factorDenominator: number;
  /** Integer from one through twenty-four; no extrapolation outside this window. */
  maxSteps: number;
  targetNumerator: number;
  targetDenominator: number;
  comparison: 'atLeast' | 'atMost';
}
export interface GeometricThresholdPoint {
  step: number;
  numerator: bigint;
  denominator: bigint;
  meetsTarget: boolean;
}
export interface GeometricThresholdCalculation {
  points: GeometricThresholdPoint[];
  target: { numerator: bigint; denominator: bigint };
  /** First qualifying completed step in this window, including zero; null means none in the window. */
  firstCrossing: number | null;
}
export interface GeometricThresholdTraceLabels {
  scenarioLabel: string;
  stepLabel: string;
  startLabel: string;
  previousLabel: string;
  nextLabel: string;
  /** Names a step reset; the selected scenario is retained. */
  resetLabel: string;
  valueLabel: string;
  targetLabel: string;
  stepAxisLabel: string;
  valueAxisLabel: string;
  tableCaption: string;
  stepColumnLabel: string;
  valueColumnLabel: string;
  statusColumnLabel: string;
  meetsTargetLabel: string;
  belowTargetLabel: string;
  aboveTargetLabel: string;
  /** Exactly one {step} token; describes the entire declared window. */
  firstCrossingTemplate: string;
  /** Exactly one {max} token; does not assert impossibility after this window. */
  notReachedLabel: string;
  /** Explain the completed-step points and the connecting lines as visual guides. */
  chartDescription: string;
  /** Explain four-decimal display separately from exact threshold comparisons. */
  precisionNote: string;
}
export interface GeometricThresholdTraceProps {
  title: string;
  instructions: string;
  unit: string;
  /** Fixed vertical maximum for the entire catalogue, from one through one billion. */
  scaleMax: number;
  /** One through eight dense scenarios, each with a unique id and label. */
  scenarios: GeometricThresholdScenario[];
  labels: GeometricThresholdTraceLabels;
  locale?: 'en' | 'es';
  className?: string;
}
const labelKeys: (keyof GeometricThresholdTraceLabels)[] = ['scenarioLabel', 'stepLabel', 'startLabel', 'previousLabel', 'nextLabel', 'resetLabel', 'valueLabel', 'targetLabel', 'stepAxisLabel', 'valueAxisLabel', 'tableCaption', 'stepColumnLabel', 'valueColumnLabel', 'statusColumnLabel', 'meetsTargetLabel', 'belowTargetLabel', 'aboveTargetLabel', 'firstCrossingTemplate', 'notReachedLabel', 'chartDescription', 'precisionNote'];
const own = (value: unknown, key: string): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value) && Object.hasOwn(value, key);
function stringField(value: unknown, key: string): string {
  if (!own(value, key) || typeof value[key] !== 'string' || !value[key].trim() || value[key] !== value[key].trim()) throw new Error(`GeometricThresholdTrace: ${key} must be an own, nonempty, trimmed string.`);
  return value[key];
}
function integerField(value: unknown, key: string, maximum: number): number {
  if (!own(value, key) || typeof value[key] !== 'number' || !Number.isSafeInteger(value[key]) || value[key] < 1 || value[key] > maximum) throw new Error(`GeometricThresholdTrace: ${key} must be an integer from one through ${maximum}.`);
  return value[key];
}
function scale(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1 || value > 1_000_000_000) throw new Error('GeometricThresholdTrace: scaleMax must be an integer from one through one billion.');
  return value;
}
function fraction(numerator: bigint, denominator: bigint) {
  let a = numerator, b = denominator;
  while (b !== 0n) { const remainder = a % b; a = b; b = remainder; }
  return { numerator: numerator / a, denominator: denominator / a };
}
/** Exact finite recurrence. Display rounding and SVG coordinates never determine target status. */
export function calculateGeometricThresholdScenario(scenario: GeometricThresholdScenario, scaleMax: number): GeometricThresholdCalculation {
  const ceiling = BigInt(scale(scaleMax));
  stringField(scenario, 'id'); stringField(scenario, 'label');
  const start = BigInt(integerField(scenario, 'start', 1_000_000));
  const factorNumerator = BigInt(integerField(scenario, 'factorNumerator', 200));
  const factorDenominator = BigInt(integerField(scenario, 'factorDenominator', 200));
  const maxSteps = integerField(scenario, 'maxSteps', 24);
  const targetNumerator = BigInt(integerField(scenario, 'targetNumerator', 200));
  const targetDenominator = BigInt(integerField(scenario, 'targetDenominator', 200));
  if (!own(scenario, 'comparison') || (scenario.comparison !== 'atLeast' && scenario.comparison !== 'atMost')) throw new Error('GeometricThresholdTrace: comparison must be atLeast or atMost.');
  const target = fraction(start * targetNumerator, targetDenominator);
  if (target.numerator > ceiling * target.denominator) throw new Error('GeometricThresholdTrace: target exceeds scaleMax.');
  const points: GeometricThresholdPoint[] = [];
  let amount = { numerator: start, denominator: 1n }, firstCrossing: number | null = null;
  for (let step = 0; step <= maxSteps; step++) {
    if (amount.numerator > ceiling * amount.denominator) throw new Error(`GeometricThresholdTrace: step ${step} exceeds scaleMax.`);
    const left = amount.numerator * target.denominator, right = target.numerator * amount.denominator;
    const meetsTarget = scenario.comparison === 'atLeast' ? left >= right : left <= right;
    points.push({ step, ...amount, meetsTarget });
    if (meetsTarget && firstCrossing === null) firstCrossing = step;
    if (step < maxSteps) amount = fraction(amount.numerator * factorNumerator, amount.denominator * factorDenominator);
  }
  return { points, target, firstCrossing };
}
/** Nonnegative rational, half-up to exactly four decimal places; no floating-point rounding. */
export function formatGeometricRational(numerator: bigint, denominator: bigint, locale: 'en' | 'es' = 'en'): string {
  if (typeof numerator !== 'bigint' || typeof denominator !== 'bigint' || numerator < 0n || denominator <= 0n) throw new Error('GeometricThresholdTrace: formatting needs a nonnegative BigInt numerator and positive BigInt denominator.');
  if (locale !== 'en' && locale !== 'es') throw new Error('GeometricThresholdTrace: locale must be en or es.');
  const rounded = (2n * numerator * 10_000n + denominator) / (2n * denominator);
  const whole = new Intl.NumberFormat(locale === 'es' ? 'es-ES' : 'en-US', { maximumFractionDigits: 0 }).format(rounded / 10_000n);
  return whole + (locale === 'es' ? ',' : '.') + (rounded % 10_000n).toString().padStart(4, '0');
}
function template(value: string, token: string, name: string) {
  const marker = `{${token}}`;
  if (value.split(marker).length !== 2 || /[{}]/.test(value.replace(marker, ''))) throw new Error(`GeometricThresholdTrace: ${name} needs only ${marker}, exactly once.`);
}
/** Audit the hidden catalogue and all text before the component's first hook. */
export function auditGeometricThresholdTrace(props: GeometricThresholdTraceProps) {
  for (const key of ['title', 'instructions', 'unit']) stringField(props, key);
  if (!own(props, 'scaleMax')) throw new Error('GeometricThresholdTrace: scaleMax is required.');
  const scaleMax = scale(props.scaleMax);
  if (props.locale !== undefined && props.locale !== 'en' && props.locale !== 'es') throw new Error('GeometricThresholdTrace: locale must be en or es.');
  if (props.className !== undefined && typeof props.className !== 'string') throw new Error('GeometricThresholdTrace: className must be a string.');
  if (!own(props, 'scenarios') || !Array.isArray(props.scenarios) || props.scenarios.length < 1 || props.scenarios.length > 8) throw new Error('GeometricThresholdTrace: scenarios must contain one through eight entries.');
  const ids = new Set<string>(), names = new Set<string>(), calculations: GeometricThresholdCalculation[] = [];
  for (let i = 0; i < props.scenarios.length; i++) {
    if (!Object.hasOwn(props.scenarios, i)) throw new Error('GeometricThresholdTrace: scenarios must be dense.');
    const scenario = props.scenarios[i]!;
    const calculation = calculateGeometricThresholdScenario(scenario, scaleMax);
    if (ids.has(scenario.id) || names.has(scenario.label)) throw new Error('GeometricThresholdTrace: scenario ids and labels must be unique.');
    ids.add(scenario.id); names.add(scenario.label); calculations.push(calculation);
  }
  if (!own(props, 'labels')) throw new Error('GeometricThresholdTrace: labels are required.');
  for (const key of labelKeys) stringField(props.labels, key);
  template(props.labels.firstCrossingTemplate, 'step', 'firstCrossingTemplate');
  template(props.labels.notReachedLabel, 'max', 'notReachedLabel');
  return { calculations, scaleMax, stepMax: Math.max(...props.scenarios.map(s => s.maxSteps)) };
}
export function GeometricThresholdTrace(props: GeometricThresholdTraceProps) {
  const audit = auditGeometricThresholdTrace(props);
  const id = useId(), [scenarioIndex, setScenarioIndex] = useState(0), [selectedStep, setSelectedStep] = useState(0);
  const index = Math.min(scenarioIndex, props.scenarios.length - 1), scenario = props.scenarios[index]!, calculation = audit.calculations[index]!;
  const step = Math.min(selectedStep, scenario.maxSteps), point = calculation.points[step]!, { labels } = props, locale = props.locale ?? 'en';
  const integer = (n: number) => new Intl.NumberFormat(locale === 'es' ? 'es-ES' : 'en-US', { maximumFractionDigits: 0 }).format(n);
  const format = (p: { numerator: bigint; denominator: bigint }) => formatGeometricRational(p.numerator, p.denominator, locale);
  const status = (p: GeometricThresholdPoint) => p.meetsTarget ? labels.meetsTargetLabel : p.numerator * calculation.target.denominator < calculation.target.numerator * p.denominator ? labels.belowTargetLabel : labels.aboveTargetLabel;
  const crossing = calculation.firstCrossing === null ? labels.notReachedLabel.replace('{max}', integer(scenario.maxSteps)) : labels.firstCrossingTemplate.replace('{step}', integer(calculation.firstCrossing));
  const width = 560, height = 320, left = 174, right = 24, top = 24, bottom = 268;
  const x = (n: number) => left + n / audit.stepMax * (width - left - right);
  // Conversion is for bounded SVG geometry only; the exact fractions above supply all decisions.
  const y = (p: { numerator: bigint; denominator: bigint }) => bottom - Math.min(audit.scaleMax, Number(p.numerator) / Number(p.denominator)) / audit.scaleMax * (bottom - top);
  const ticks = [...new Set([0, Math.round(audit.stepMax / 4), Math.round(audit.stepMax / 2), Math.round(3 * audit.stepMax / 4), audit.stepMax])];
  const region = 'mt-4 min-w-0 max-w-full overflow-x-auto rounded-card border border-ink-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700';
  const control = 'min-h-11 rounded-card border border-ink-300 bg-surface px-3 py-2 text-sm text-ink-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700 disabled:cursor-not-allowed disabled:opacity-50';
  const changeStep = (value: number) => setSelectedStep(Math.max(0, Math.min(scenario.maxSteps, value)));
  return <figure className={cx('not-prose my-8 min-w-0 max-w-full [overflow-wrap:anywhere]', props.className)} aria-labelledby={`${id}-title`} data-geometric-scenario={scenario.id} data-geometric-step={step} data-first-crossing={calculation.firstCrossing ?? 'none'}>
    <figcaption id={`${id}-title`} className="font-display text-lg font-semibold text-ink-900">{props.title}</figcaption>
    <p className="mt-2 text-sm leading-relaxed text-ink-700">{props.instructions}</p>
    {props.scenarios.length > 1 ? <div className="mt-5 min-w-0">
      <label htmlFor={`${id}-scenario`} className="block text-sm font-semibold text-ink-800">{labels.scenarioLabel}</label>
      <select id={`${id}-scenario`} className={cx(control, 'mt-2 w-full min-w-0 max-w-full')} value={index} onChange={event => { setScenarioIndex(Number(event.currentTarget.value)); setSelectedStep(0); }}>
        {props.scenarios.map((s, i) => <option key={s.id} value={i}>{s.label}</option>)}
      </select>
    </div> : null}
    <dl className="mt-4 flex flex-wrap gap-x-8 gap-y-3 text-sm">
      <div><dt className="text-ink-700">{labels.startLabel}</dt><dd className="mt-1 font-mono tabular-nums text-ink-900">{format({ numerator: BigInt(scenario.start), denominator: 1n })} {props.unit}</dd></div>
      <div><dt className="inline-flex items-center gap-2 text-ink-700"><span aria-hidden="true" className="w-5 border-t-2 border-dashed border-ink-700" />{labels.targetLabel}</dt><dd className="mt-1 font-mono tabular-nums text-ink-900">{format(calculation.target)} {props.unit}</dd></div>
    </dl>
    <div className="mt-5 min-w-0">
      <label htmlFor={`${id}-step`} className="block text-sm font-semibold text-ink-800">{labels.stepLabel}</label>
      <input id={`${id}-step`} type="range" min={0} max={scenario.maxSteps} step={1} value={step} onChange={event => changeStep(Number(event.currentTarget.value))} className="mt-2 min-h-11 w-full accent-brand-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700" aria-valuetext={`${labels.stepLabel} ${integer(step)}`} />
      <div className="mt-2 flex flex-wrap gap-2">
        <button type="button" className={control} onClick={() => changeStep(step - 1)} disabled={step === 0}>{labels.previousLabel}</button>
        <button type="button" className={control} onClick={() => changeStep(step + 1)} disabled={step === scenario.maxSteps}>{labels.nextLabel}</button>
        <button type="button" className={control} onClick={() => setSelectedStep(0)} disabled={step === 0}>{labels.resetLabel}</button>
      </div>
    </div>
    <p role="status" aria-live="polite" aria-atomic="true" className="mt-4 text-sm leading-relaxed text-ink-900">
      <span className="font-mono tabular-nums">{labels.stepLabel} {integer(step)}: {labels.valueLabel} {format(point)} {props.unit}</span>
      <span className="mt-1 block font-semibold">{status(point)}</span>
    </p>
    <p className="mt-2 text-sm leading-relaxed text-ink-700" data-geometric-first-crossing="true">{crossing}</p>
    <div className={region} role="region" tabIndex={0} aria-label={labels.chartDescription}>
      <svg viewBox={`0 0 ${width} ${height}`} className="block w-full min-w-[36rem]" aria-hidden="true" data-geometric-plot="true" data-step-min={0} data-step-max={audit.stepMax} data-value-min={0} data-value-max={audit.scaleMax} data-target-numerator={calculation.target.numerator.toString()} data-target-denominator={calculation.target.denominator.toString()}>
        {[0, 1, 2].map(n => { const value = { numerator: BigInt(audit.scaleMax) * BigInt(n), denominator: 2n }; return <g key={n}>
          <line x1={left} x2={width - right} y1={y(value)} y2={y(value)} className={n === 0 ? 'stroke-ink-300' : 'stroke-ink-200'} />
          <text x={left - 10} y={y(value) + 5} textAnchor="end" fontSize="14" className="fill-ink-700">{format(value)}</text>
        </g>; })}
        <line x1={left} x2={left} y1={top} y2={bottom} className="stroke-ink-300" />
        {ticks.map(n => <text key={n} x={x(n)} y={bottom + 24} textAnchor="middle" fontSize="14" className="fill-ink-700">{integer(n)}</text>)}
        <line x1={left} x2={width - right} y1={y(calculation.target)} y2={y(calculation.target)} className="stroke-ink-700" strokeWidth="2" strokeDasharray="5 5" data-geometric-target="true" />
        <polyline fill="none" className="stroke-brand-700" strokeWidth="2" points={calculation.points.map(p => `${x(p.step)},${y(p)}`).join(' ')} data-geometric-series="true" />
        {calculation.points.map(p => <circle key={p.step} cx={x(p.step)} cy={y(p)} r="3" className="fill-brand-700" data-geometric-point={p.step} data-numerator={p.numerator.toString()} data-denominator={p.denominator.toString()} data-meets-target={p.meetsTarget ? 'true' : 'false'} />)}
        <circle cx={x(step)} cy={y(point)} r="7" fill="none" className="stroke-ink-900" strokeWidth="3" data-geometric-selected-point="true" />
      </svg>
    </div>
    <p className="mt-2 text-xs leading-relaxed text-ink-700">{labels.stepAxisLabel}; {labels.valueAxisLabel} ({props.unit}). {labels.chartDescription}</p>
    <p className="mt-2 text-xs leading-relaxed text-ink-700">{labels.precisionNote}</p>
    <div className={region} role="region" tabIndex={0} aria-label={labels.tableCaption}>
      <table className="w-full min-w-[36rem] border-collapse text-left text-sm" style={{ display: 'table', overflow: 'visible', margin: 0 }}>
        <caption className="px-3 py-3 text-left text-sm text-ink-700">{labels.tableCaption}</caption>
        <thead className="bg-surface-sunken"><tr>{[labels.stepColumnLabel, `${labels.valueColumnLabel} (${props.unit})`, labels.statusColumnLabel].map((label, i) => <th key={i} scope="col" className="px-3 py-3 font-semibold text-ink-800">{label}</th>)}</tr></thead>
        <tbody>{calculation.points.map(p => { const selected = p.step === step; return <tr key={p.step} data-geometric-row={p.step} aria-current={selected ? 'true' : undefined} style={selected ? { backgroundColor: 'var(--color-brand-100)' } : undefined}>
          <th scope="row" className="whitespace-nowrap px-3 py-3 font-mono tabular-nums text-ink-800">{integer(p.step)}</th>
          <td className="whitespace-nowrap px-3 py-3 font-mono tabular-nums text-ink-900">{format(p)}</td>
          <td className="px-3 py-3 text-ink-800">{status(p)}</td>
        </tr>; })}</tbody>
      </table>
    </div>
  </figure>;
}
