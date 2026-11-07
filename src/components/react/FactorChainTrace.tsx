import { useId, useState } from 'react';
import { cx } from '@/components/react/cx';

/** A factor of 1.20 is authored as 120, not as a 120% growth rate. */
export interface FactorChain {
  label: string;
  factorHundredths: number[];
}
export interface FactorChainScenario {
  label: string;
  /** Positive integer model quantity, at most one million. */
  start: number;
  unit: string;
  chains: [FactorChain, FactorChain];
}
export interface FactorChainLabels {
  scenarioLabel: string;
  /** Includes both {step} and {total}. */
  stepTemplate: string;
  startLabel: string;
  backLabel: string;
  nextLabel: string;
  resetLabel: string;
  chainLabel: string;
  previousLabel: string;
  factorLabel: string;
  resultLabel: string;
  initialCellLabel: string;
  tableCaption: string;
  chartDescription: string;
  valueAxisLabel: string;
  stepAxisLabel: string;
  /** Includes {first} and {second}, with quantities and units already attached. */
  initialAnnouncementTemplate: string;
  /** Includes {step}, {first} and {second}. */
  stepAnnouncementTemplate: string;
  precisionNote: string;
}
export interface FactorChainTraceProps {
  title: string;
  instructions: string;
  scenarios: FactorChainScenario[];
  labels: FactorChainLabels;
  locale?: 'en' | 'es';
  className?: string;
}
/** Integers remain exact: numerator <= 1,600,000,000,000,000; denominator <= 100^4. */
export interface FactorChainValue { numerator: number; denominator: number }
export interface FactorChainCalculation {
  steps: number;
  values: [FactorChainValue[], FactorChainValue[]];
  /** Every value expressed over the same final denominator, for an exact common scale. */
  scaled: [number[], number[]];
  scaleNumerator: number;
}
const denominators = [1, 100, 10000, 1000000, 100000000];
const labelKeys: (keyof FactorChainLabels)[] = [
  'scenarioLabel', 'stepTemplate', 'startLabel', 'backLabel', 'nextLabel', 'resetLabel',
  'chainLabel', 'previousLabel', 'factorLabel', 'resultLabel', 'initialCellLabel',
  'tableCaption', 'chartDescription', 'valueAxisLabel', 'stepAxisLabel',
  'initialAnnouncementTemplate', 'stepAnnouncementTemplate', 'precisionNote',
];
const nonempty = (x: unknown): x is string => typeof x === 'string' && x.trim().length > 0;
function dense(a: unknown, length?: number): a is unknown[] {
  return Array.isArray(a) && (length === undefined || a.length === length)
    && Array.from({ length: a.length }, (_, i) => Object.hasOwn(a, i)).every(Boolean);
}
/** Validate the complete declared input, including initially hidden factor arrays. */
export function calculateFactorChain(scenario: FactorChainScenario): FactorChainCalculation {
  if (!scenario || !nonempty(scenario.label) || !nonempty(scenario.unit)
    || !Number.isSafeInteger(scenario.start) || scenario.start < 1 || scenario.start > 1000000
    || !dense(scenario.chains, 2)) throw new Error('FactorChainTrace: invalid scenario, start, unit or pair of chains.');
  let steps = 0;
  for (let c = 0; c < 2; c++) {
    const chain = scenario.chains[c];
    if (!chain || !nonempty(chain.label) || !dense(chain.factorHundredths)
      || chain.factorHundredths.length < 2 || chain.factorHundredths.length > 4
      || (c > 0 && chain.factorHundredths.length !== steps)) throw new Error('FactorChainTrace: each named chain needs the same two to four dense factors.');
    steps = chain.factorHundredths.length;
    for (let i = 0; i < steps; i++) {
      const factor = chain.factorHundredths[i];
      if (typeof factor !== 'number' || !Number.isSafeInteger(factor) || factor < 1 || factor > 200) throw new Error('FactorChainTrace: factorHundredths must be integers from one to two hundred.');
    }
  }
  if (scenario.chains[0].label.trim() === scenario.chains[1].label.trim()) throw new Error('FactorChainTrace: chain names must be distinct.');
  const values = scenario.chains.map(chain => {
    const trace: FactorChainValue[] = [{ numerator: scenario.start, denominator: 1 }];
    for (const factor of chain.factorHundredths) {
      const previous = trace[trace.length - 1]!;
      const value = { numerator: previous.numerator * factor, denominator: previous.denominator * 100 };
      if (!Number.isSafeInteger(value.numerator) || value.numerator <= 0 || !Number.isSafeInteger(value.denominator)) throw new Error('FactorChainTrace: arithmetic left the exact integer domain.');
      trace.push(value);
    }
    return trace;
  }) as [FactorChainValue[], FactorChainValue[]];
  const finalDenominator = denominators[steps]!;
  const scaled = values.map(trace => trace.map(v => v.numerator * (finalDenominator / v.denominator))) as [number[], number[]];
  const scaleNumerator = Math.max(...scaled[0], ...scaled[1]);
  if (![...scaled[0], ...scaled[1]].every(x => Number.isSafeInteger(x) && x > 0)) throw new Error('FactorChainTrace: the shared scale must remain exact and positive.');
  return { steps, values, scaled, scaleNumerator };
}
/** Decimal construction from integer remainder; no floating-point rounding of model quantities. */
export function formatFactorChainValue(value: FactorChainValue, locale: 'en' | 'es'): string {
  if ((locale !== 'en' && locale !== 'es') || !Number.isSafeInteger(value.numerator) || value.numerator < 0 || !denominators.includes(value.denominator)) throw new Error('FactorChainTrace: invalid exact value or locale.');
  const whole = Math.floor(value.numerator / value.denominator);
  const remainder = value.numerator % value.denominator;
  const digits = String(value.denominator).length - 1;
  const fraction = remainder === 0 ? '' : String(remainder).padStart(digits, '0').replace(/0+$/, '');
  const integer = new Intl.NumberFormat(locale === 'es' ? 'es-ES' : 'en-US', { maximumFractionDigits: 0 }).format(whole === 0 ? 0 : whole);
  return integer + (fraction ? (locale === 'es' ? ',' : '.') + fraction : '');
}
/** Two known factor schedules, inspected at completed discrete steps; not a forecasting engine. */
export function FactorChainTrace({ title, instructions, scenarios, labels, locale = 'en', className }: FactorChainTraceProps) {
  if (!nonempty(title) || !nonempty(instructions) || !dense(scenarios) || scenarios.length < 1 || scenarios.length > 3
    || (locale !== 'en' && locale !== 'es') || !labels || labelKeys.some(k => !nonempty(labels[k]))) throw new Error('FactorChainTrace: complete scenarios, locale and interface labels are required.');
  for (const [template, tokens] of [[labels.stepTemplate, ['{step}', '{total}']], [labels.initialAnnouncementTemplate, ['{first}', '{second}']], [labels.stepAnnouncementTemplate, ['{step}', '{first}', '{second}']]] as const) {
    if (tokens.some(token => !template.includes(token))) throw new Error('FactorChainTrace: an announcement template is missing a required token.');
  }
  const calculations = Array.from(scenarios, scenario => calculateFactorChain(scenario));
  if (new Set(scenarios.map(s => s.label.trim())).size !== scenarios.length) throw new Error('FactorChainTrace: scenario names must be distinct.');
  const id = useId();
  const [scenarioIndex, setScenarioIndex] = useState(0);
  const [step, setStep] = useState(0);
  const index = Math.min(scenarioIndex, scenarios.length - 1);
  const scenario = scenarios[index]!;
  const calculation = calculations[index]!;
  const current = Math.min(step, calculation.steps);
  const format = (v: FactorChainValue) => formatFactorChainValue(v, locale);
  const amount = (v: FactorChainValue) => `${format(v)} ${scenario.unit}`;
  const factorText = (hundredths: number) => new Intl.NumberFormat(locale === 'es' ? 'es-ES' : 'en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(hundredths / 100);
  const stepText = current === 0 ? labels.startLabel : labels.stepTemplate.replaceAll('{step}', String(current)).replaceAll('{total}', String(calculation.steps));
  const first = `${scenario.chains[0].label}: ${amount(calculation.values[0][current]!)}`;
  const second = `${scenario.chains[1].label}: ${amount(calculation.values[1][current]!)}`;
  const live = (current === 0 ? labels.initialAnnouncementTemplate : labels.stepAnnouncementTemplate)
    .replaceAll('{step}', String(current)).replaceAll('{first}', first).replaceAll('{second}', second);
  const width = 460, height = 250, left = 58, right = 18, top = 30, bottom = 42;
  const x = (i: number) => left + i / calculation.steps * (width - left - right);
  const y = (scaled: number) => top + (1 - scaled / calculation.scaleNumerator) * (height - top - bottom);
  const colors = ['var(--color-brand-700)', 'var(--color-ink-600)'];
  const buttonClass = 'min-h-11 rounded-pill border border-ink-300 bg-surface px-4 py-2 text-sm font-semibold text-ink-900 disabled:cursor-default disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700';
  return (
    <figure className={cx('not-prose my-8 min-w-0 rounded-card border border-ink-200 bg-surface p-4 text-ink-900 sm:p-6', className)} aria-labelledby={`${id}-title`}>
      <figcaption id={`${id}-title`} className="font-display text-lg font-semibold">{title}</figcaption>
      <p className="mt-2 text-sm leading-relaxed text-ink-700">{instructions}</p>
      {scenarios.length > 1 ? <label className="mt-4 block text-sm font-semibold" htmlFor={`${id}-scenario`}>
        {labels.scenarioLabel}
        <select id={`${id}-scenario`} value={index} onChange={e => { setScenarioIndex(Number(e.target.value)); setStep(0); }} className="mt-2 min-h-11 w-full rounded-card border border-ink-300 bg-surface px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700">
          {scenarios.map((s, i) => <option key={i} value={i}>{s.label}</option>)}
        </select>
      </label> : null}
      <p className="mt-4 font-semibold" data-factor-step>{stepText}</p>
      <svg className="mt-3 h-auto w-full" viewBox={`0 0 ${width} ${height}`} role="img" aria-labelledby={`${id}-chart-title ${id}-chart-desc`}>
        <title id={`${id}-chart-title`}>{title}</title>
        <desc id={`${id}-chart-desc`}>{labels.chartDescription}</desc>
        <line x1={left} x2={left} y1={top} y2={height - bottom} stroke="var(--color-ink-400)" />
        <line x1={left} x2={width - right} y1={height - bottom} y2={height - bottom} stroke="var(--color-ink-400)" />
        <text x={left} y={15} fontSize="11" fill="var(--color-ink-700)">{labels.valueAxisLabel}</text>
        <text x={width - right} y={top - 8} textAnchor="end" fontSize="10" fill="var(--color-ink-700)">{format({ numerator: calculation.scaleNumerator, denominator: denominators[calculation.steps]! })}</text>
        <text x={left - 5} y={height - bottom + 3} textAnchor="end" fontSize="10" fill="var(--color-ink-700)">0</text>
        {Array.from({ length: calculation.steps + 1 }, (_, i) => <text key={i} x={x(i)} y={height - bottom + 18} textAnchor="middle" fontSize="10" fill="var(--color-ink-700)">{i}</text>)}
        <text x={width - right} y={height - 3} textAnchor="end" fontSize="11" fill="var(--color-ink-700)">{labels.stepAxisLabel}</text>
        {calculation.scaled.map((values, c) => <g key={c}>
          <path d={values.slice(0, current + 1).map((v, i) => `${i ? 'L' : 'M'}${x(i)},${y(v)}`).join(' ')} fill="none" stroke={colors[c]} strokeWidth="2.5" strokeDasharray={c === 1 ? '6 4' : undefined} />
          {values.slice(0, current + 1).map((v, i) => <circle key={i} cx={x(i)} cy={y(v)} r={c === 1 ? 3 : 5} fill={c === 1 ? 'var(--color-surface)' : colors[c]} stroke={colors[c]} strokeWidth="2" />)}
        </g>)}
      </svg>
      <ul className="mb-4 flex flex-wrap gap-x-5 gap-y-2 text-sm" aria-label={labels.chainLabel}>
        {scenario.chains.map((chain, c) => <li key={c} className="inline-flex items-center gap-2"><span aria-hidden className="inline-block w-5 border-t-[3px]" style={{ borderColor: colors[c], borderStyle: c === 1 ? 'dashed' : 'solid' }} />{chain.label}</li>)}
      </ul>
      <div className="max-w-full overflow-x-auto rounded-card border border-ink-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700" tabIndex={0} role="region" aria-label={labels.tableCaption}>
        <table className="w-full border-collapse text-left text-sm" style={{ display: 'table', overflow: 'visible', margin: 0 }}>
          <caption className="sr-only">{labels.tableCaption}</caption>
          <thead className="bg-surface-sunken"><tr>{[labels.chainLabel, labels.previousLabel + ' × ' + labels.factorLabel, labels.resultLabel].map(label => <th key={label} scope="col" className="p-2 font-semibold">{label}</th>)}</tr></thead>
          <tbody>{scenario.chains.map((chain, c) => <tr key={c} className="border-t border-ink-200">
            <th scope="row" className="p-2 font-semibold">{chain.label}</th>
            {current === 0 ? <td className="p-2 text-ink-600">{labels.initialCellLabel}</td> : <td className="p-2 font-mono"><span className="block">{amount(calculation.values[c]![current - 1]!)}</span><span className="block">×{factorText(chain.factorHundredths[current - 1]!)}</span></td>}
            <td className="p-2 font-mono font-semibold" data-factor-result>{amount(calculation.values[c]![current]!)}</td>
          </tr>)}</tbody>
        </table>
      </div>
      <p className="mt-3 text-xs leading-relaxed text-ink-600">{labels.precisionNote}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" className={buttonClass} disabled={current === 0} onClick={() => setStep(s => Math.max(0, s - 1))}>{labels.backLabel}</button>
        <button type="button" className={buttonClass} disabled={current === calculation.steps} onClick={() => setStep(s => Math.min(calculation.steps, s + 1))}>{labels.nextLabel}</button>
        <button type="button" className={buttonClass} disabled={current === 0} onClick={() => setStep(0)}>{labels.resetLabel}</button>
      </div>
      <p className="sr-only" aria-live="polite" aria-atomic="true">{live}</p>
    </figure>
  );
}
