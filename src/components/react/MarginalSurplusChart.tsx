import { useId, useState } from 'react';
import { cx } from '@/components/react/cx';

export interface MarginalSurplusScenario {
  id: string;
  label: string;
  externalPerUnit: number;
}

export interface MarginalSurplusLabels {
  scenario: string;
  quantity: string;
  marginalTitle: string;
  cumulativeTitle: string;
  marginalUnit: string;
  quantityUnit: string;
  benefit: string;
  privateCost: string;
  socialCost: string;
  totalBenefit: string;
  totalResources: string;
  totalHarm: string;
  privateCombined: string;
  socialNet: string;
  loss: string;
  privateMaximizers: string;
  socialMaximizers: string;
  fixedScale: string;
  tableCaption: string;
  notApplicable: string;
  /** All six tokens below must occur exactly once. Amount tokens include the unit. */
  resultTemplate: string;
}

export interface MarginalSurplusChartProps {
  title: string;
  instructions: string;
  locale: 'en' | 'es';
  unit: string;
  /** Each prefix, including the empty prefix, is a feasible integer quantity. */
  marginalBenefits: number[];
  marginalPrivateCosts: number[];
  scenarios: MarginalSurplusScenario[];
  initialQuantity: number;
  labels: MarginalSurplusLabels;
  className?: string;
}

const labelKeys = ['scenario', 'quantity', 'marginalTitle', 'cumulativeTitle', 'marginalUnit', 'quantityUnit', 'benefit', 'privateCost', 'socialCost', 'totalBenefit', 'totalResources', 'totalHarm', 'privateCombined', 'socialNet', 'loss', 'privateMaximizers', 'socialMaximizers', 'fixedScale', 'tableCaption', 'notApplicable', 'resultTemplate'] as const;
const tokens = ['quantity', 'private', 'social', 'loss', 'privateMaxima', 'socialMaxima'] as const;

function own(value: unknown, key: string): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && Object.hasOwn(value, key);
}
function text(value: unknown, key: string, path: string): string {
  if (!own(value, key) || typeof value[key] !== 'string' || !value[key].trim() || value[key].trim() !== value[key]) {
    throw new Error(`MarginalSurplusChart: ${path}.${key} must be an own, nonempty, trimmed string.`);
  }
  return value[key];
}
function dense(value: unknown, min: number, max: number, path: string): asserts value is unknown[] {
  if (!Array.isArray(value) || value.length < min || value.length > max) throw new Error(`MarginalSurplusChart: ${path} has an invalid length.`);
  for (let i = 0; i < value.length; i++) if (!Object.hasOwn(value, i)) throw new Error(`MarginalSurplusChart: ${path} must be dense.`);
}
function amount(value: unknown, path: string): asserts value is number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > 1000) throw new Error(`MarginalSurplusChart: ${path} must be an integer from zero through one thousand.`);
}
function maxima(values: number[]): number[] {
  const best = Math.max(...values);
  return values.flatMap((value, q) => value === best ? [q] : []);
}
function cumulative(values: number[]): number[] {
  const result = [0];
  for (const value of values) result.push(result[result.length - 1]! + value);
  return result;
}

/** Validate all authored cases before hooks; enumerate every feasible prefix, retaining all exact ties. */
export function auditMarginalSurplusChart(props: MarginalSurplusChartProps) {
  for (const key of ['title', 'instructions', 'unit'] as const) text(props, key, 'props');
  if (!own(props, 'locale') || (props.locale !== 'en' && props.locale !== 'es')) throw new Error('MarginalSurplusChart: locale must be en or es.');
  for (const key of ['marginalBenefits', 'marginalPrivateCosts'] as const) {
    if (!own(props, key)) throw new Error(`MarginalSurplusChart: ${key} is required.`);
    dense(props[key], 2, 8, key);
    props[key].forEach((value, i) => amount(value, `${key}[${i}]`));
  }
  if (props.marginalBenefits.length !== props.marginalPrivateCosts.length) throw new Error('MarginalSurplusChart: marginal arrays need matching lengths.');
  const n = props.marginalBenefits.length;
  if (!own(props, 'initialQuantity') || !Number.isInteger(props.initialQuantity) || props.initialQuantity < 0 || props.initialQuantity > n) throw new Error('MarginalSurplusChart: invalid initialQuantity.');
  if (!own(props, 'labels')) throw new Error('MarginalSurplusChart: labels are required.');
  for (const key of labelKeys) text(props.labels, key, 'labels');
  let remainder = props.labels.resultTemplate;
  for (const token of tokens) {
    const placeholder = `{${token}}`;
    if (remainder.split(placeholder).length !== 2) throw new Error(`MarginalSurplusChart: resultTemplate needs {${token}} exactly once.`);
    remainder = remainder.replace(placeholder, '');
  }
  if (/[{}]/.test(remainder)) throw new Error('MarginalSurplusChart: unknown resultTemplate token.');
  if (!own(props, 'scenarios')) throw new Error('MarginalSurplusChart: scenarios are required.');
  dense(props.scenarios, 1, 3, 'scenarios');
  const ids = new Set<string>(), names = new Set<string>();
  for (const scenario of props.scenarios) {
    const id = text(scenario, 'id', 'scenario'), name = text(scenario, 'label', 'scenario');
    if (ids.has(id) || names.has(name)) throw new Error('MarginalSurplusChart: scenario ids and labels must be unique.');
    ids.add(id); names.add(name);
    if (!own(scenario, 'externalPerUnit')) throw new Error('MarginalSurplusChart: externalPerUnit is required.');
    amount(scenario.externalPerUnit, 'scenario.externalPerUnit');
  }
  const benefits = cumulative(props.marginalBenefits), resources = cumulative(props.marginalPrivateCosts);
  const privateCombined = benefits.map((value, q) => value - resources[q]!);
  const privateMaxima = maxima(privateCombined);
  const cases = props.scenarios.map(scenario => {
    const harm = benefits.map((_, q) => scenario.externalPerUnit === 0 ? 0 : scenario.externalPerUnit * q);
    const socialNet = privateCombined.map((value, q) => value - harm[q]!);
    const socialMaxima = maxima(socialNet), best = Math.max(...socialNet);
    return { harm, socialNet, socialMaxima, loss: socialNet.map(value => best - value) };
  });
  // Conservative bounds: all sums stay within ±16000; welfare differences within 24000.
  const marginalScale = Math.max(1, ...props.marginalBenefits, ...props.scenarios.flatMap(s => props.marginalPrivateCosts.map(cost => cost + s.externalPerUnit)));
  const cumulativeMin = Math.min(0, ...privateCombined, ...cases.flatMap(c => c.socialNet));
  const rawMax = Math.max(0, ...privateCombined, ...cases.flatMap(c => c.socialNet));
  const cumulativeMax = rawMax === cumulativeMin ? rawMax + 1 : rawMax;
  return { benefits, resources, privateCombined, privateMaxima, cases, marginalScale, cumulativeMin, cumulativeMax };
}

/** Two discrete panels share authored data and fixed scales; no price or policy response is generated. */
export function MarginalSurplusChart(props: MarginalSurplusChartProps) {
  const audit = auditMarginalSurplusChart(props);
  const id = useId();
  const [scenarioIndex, setScenarioIndex] = useState(0);
  const [quantity, setQuantity] = useState(props.initialQuantity);
  const activeIndex = Math.min(scenarioIndex, props.scenarios.length - 1);
  const scenario = props.scenarios[activeIndex]!, current = audit.cases[activeIndex]!;
  const q = Math.min(quantity, props.marginalBenefits.length), n = props.marginalBenefits.length;
  const { title, instructions, labels, unit, className } = props;
  const numberLocale = props.locale === 'es' ? 'es-ES' : 'en-US';
  const number = (value: number) => (value === 0 ? 0 : value).toLocaleString(numberLocale);
  const money = (value: number) => `${number(value)} ${unit}`;
  const list = (values: number[]) => new Intl.ListFormat(numberLocale, { style: 'long', type: 'conjunction' }).format(values.map(number));
  const resultValues = { quantity: number(q), private: money(audit.privateCombined[q]!), social: money(current.socialNet[q]!), loss: money(current.loss[q]!), privateMaxima: list(audit.privateMaxima), socialMaxima: list(current.socialMaxima) };
  const result = tokens.reduce((value, token) => value.replace(`{${token}}`, resultValues[token]), labels.resultTemplate);
  const width = 840, left = 82, right = 18, top = 18, bottom = 214, plotWidth = width - left - right;
  const marginalY = (value: number) => bottom - value / audit.marginalScale * (bottom - top);
  const cumulativeY = (value: number) => bottom - (value - audit.cumulativeMin) / (audit.cumulativeMax - audit.cumulativeMin) * (bottom - top);
  const zeroY = cumulativeY(0), group = plotWidth / n, totalGroup = plotWidth / (n + 1);
  const marginalSeries = [
    { label: labels.benefit, values: props.marginalBenefits, color: 'fill-ink-500', swatch: 'bg-ink-500' },
    { label: labels.privateCost, values: props.marginalPrivateCosts, color: 'fill-ink-900', swatch: 'bg-ink-900' },
    { label: labels.socialCost, values: props.marginalPrivateCosts.map(value => value + scenario.externalPerUnit), color: 'fill-brand-700', swatch: 'bg-brand-700' },
  ];
  const cumulativeSeries = [
    { label: labels.privateCombined, values: audit.privateCombined, color: 'fill-ink-500', swatch: 'bg-ink-500' },
    { label: labels.socialNet, values: current.socialNet, color: 'fill-brand-700', swatch: 'bg-brand-700' },
  ];
  const scrollClass = 'mt-3 max-w-full overflow-x-auto rounded-card border border-ink-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700';
  const selectClass = 'mt-2 min-h-11 w-full rounded-card border border-ink-300 bg-surface px-3 py-2 text-sm text-ink-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700';
  const headers = [labels.quantity, labels.benefit, labels.privateCost, labels.socialCost, labels.totalBenefit, labels.totalResources, labels.totalHarm, labels.privateCombined, labels.socialNet, labels.loss];
  return (
    <figure className={cx('not-prose my-8 min-w-0', className)} aria-labelledby={`${id}-title`}>
      <figcaption id={`${id}-title`} className="font-display text-lg font-semibold text-ink-900">{title}</figcaption>
      <p className="mt-2 text-sm leading-relaxed text-ink-700">{instructions}</p>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div><label htmlFor={`${id}-scenario`} className="block text-sm font-semibold text-ink-800">{labels.scenario}</label>
          <select id={`${id}-scenario`} value={activeIndex} onChange={event => setScenarioIndex(Number(event.currentTarget.value))} className={selectClass}>
            {props.scenarios.map((item, index) => <option key={item.id} value={index}>{item.label}</option>)}
          </select>
        </div>
        <div><label htmlFor={`${id}-quantity`} className="block text-sm font-semibold text-ink-800">{labels.quantity}</label>
          <select id={`${id}-quantity`} value={q} onChange={event => setQuantity(Number(event.currentTarget.value))} className={selectClass}>
            {audit.benefits.map((_, value) => <option key={value} value={value}>{number(value)}</option>)}
          </select>
        </div>
      </div>
      <p className="mt-4 text-sm leading-relaxed text-ink-600">{labels.fixedScale}</p>
      <div className="mt-6">
        <p className="font-semibold text-ink-900">{labels.marginalTitle}</p>
        <p className="mt-1 text-xs text-ink-600">{labels.marginalUnit}</p>
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs text-ink-700">{marginalSeries.map(series => <span key={series.label} className="inline-flex items-center gap-2"><span className={cx('h-3 w-3 shrink-0', series.swatch)} aria-hidden="true" />{series.label}</span>)}</div>
        <div className={scrollClass} role="region" tabIndex={0} aria-label={labels.marginalTitle}>
          <svg viewBox={`0 0 ${width} 260`} className="block w-full min-w-[38rem]" aria-hidden="true" data-marginal-scale={audit.marginalScale}>
            {q > 0 ? <rect x={left + (q - 1) * group} y={top} width={group} height={bottom - top} className="fill-accent-300" opacity="0.25" /> : null}
            <line x1={left} x2={width - right} y1={bottom} y2={bottom} className="stroke-ink-300" />
            <text x={left - 8} y={top + 5} textAnchor="end" className="fill-ink-600" fontSize="13">{number(audit.marginalScale)}</text>
            <text x={left - 8} y={bottom + 4} textAnchor="end" className="fill-ink-600" fontSize="13">{number(0)}</text>
            {props.marginalBenefits.map((_, i) => <g key={i}>
              {marginalSeries.map((series, j) => <rect key={series.label} x={left + i * group + group * (0.14 + j * 0.24)} y={marginalY(series.values[i]!)} width={group * 0.2} height={bottom - marginalY(series.values[i]!)} className={series.color} data-marginal-unit={i + 1} data-marginal-series={j} data-amount={series.values[i]} />)}
              <text x={left + (i + 0.5) * group} y={bottom + 22} textAnchor="middle" className="fill-ink-700" fontSize="13">{number(i + 1)}</text>
            </g>)}
          </svg>
        </div>
      </div>
      <div className="mt-6">
        <p className="font-semibold text-ink-900">{labels.cumulativeTitle}</p>
        <p className="mt-1 text-xs text-ink-600">{labels.quantityUnit}</p>
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs text-ink-700">{cumulativeSeries.map(series => <span key={series.label} className="inline-flex items-center gap-2"><span className={cx('h-3 w-3 shrink-0', series.swatch)} aria-hidden="true" />{series.label}</span>)}</div>
        <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2 text-xs text-ink-700">
          <span className="inline-flex items-center gap-2"><span aria-hidden="true" className="h-3 w-3 border-2 border-ink-900" />{labels.privateMaximizers}</span>
          <span className="inline-flex items-center gap-2"><span aria-hidden="true" className="h-3 w-3 rounded-full border-2 border-brand-700" />{labels.socialMaximizers}</span>
        </div>
        <div className={scrollClass} role="region" tabIndex={0} aria-label={labels.cumulativeTitle}>
          <svg viewBox={`0 0 ${width} 260`} className="block w-full min-w-[38rem]" aria-hidden="true" data-cumulative-min={audit.cumulativeMin} data-cumulative-max={audit.cumulativeMax}>
            <rect x={left + q * totalGroup} y={top} width={totalGroup} height={bottom - top} className="fill-accent-300" opacity="0.25" />
            <line x1={left} x2={width - right} y1={zeroY} y2={zeroY} className="stroke-ink-900" />
            <text x={left - 8} y={top + 5} textAnchor="end" className="fill-ink-600" fontSize="13">{number(audit.cumulativeMax)}</text>
            <text x={left - 8} y={bottom + 4} textAnchor="end" className="fill-ink-600" fontSize="13">{number(audit.cumulativeMin)}</text>
            {audit.cumulativeMin < 0 && audit.cumulativeMax > 0 ? <text x={left - 8} y={zeroY + 4} textAnchor="end" className="fill-ink-600" fontSize="13">{number(0)}</text> : null}
            {audit.benefits.map((_, quantityIndex) => <g key={quantityIndex}>
              {cumulativeSeries.map((series, j) => {
                const value = series.values[quantityIndex]!, x = left + quantityIndex * totalGroup + totalGroup * (0.23 + j * 0.3), y = cumulativeY(value);
                return <rect key={series.label} x={x} y={Math.min(y, zeroY)} width={totalGroup * 0.24} height={Math.abs(zeroY - y)} className={series.color} data-cumulative-q={quantityIndex} data-cumulative-series={j} data-amount={value} />;
              })}
              {audit.privateMaxima.includes(quantityIndex) ? <rect x={left + (quantityIndex + 0.35) * totalGroup - 5} y={cumulativeY(audit.privateCombined[quantityIndex]!) - 5} width="10" height="10" className="fill-surface stroke-ink-900" strokeWidth="2" data-private-maximum={quantityIndex} /> : null}
              {current.socialMaxima.includes(quantityIndex) ? <circle cx={left + (quantityIndex + 0.65) * totalGroup} cy={cumulativeY(current.socialNet[quantityIndex]!)} r="5" className="fill-surface stroke-brand-700" strokeWidth="2" data-social-maximum={quantityIndex} /> : null}
              <text x={left + (quantityIndex + 0.5) * totalGroup} y={bottom + 22} textAnchor="middle" className="fill-ink-700" fontSize="13">{number(quantityIndex)}</text>
            </g>)}
          </svg>
        </div>
      </div>
      <div className={scrollClass} role="region" tabIndex={0} aria-label={labels.tableCaption}>
        <table className="w-full min-w-[72rem] border-collapse text-left text-sm" style={{ display: 'table', overflow: 'visible', margin: 0 }}>
          <caption className="px-3 py-3 text-left text-sm text-ink-700">{labels.tableCaption}</caption>
          <thead><tr className="bg-surface-sunken">{headers.map((label, i) => <th key={i} scope="col" className="border-b border-ink-300 px-3 py-3 font-semibold text-ink-800">{label}</th>)}</tr></thead>
          <tbody>{audit.benefits.map((_, row) => {
            const values = [row === 0 ? null : props.marginalBenefits[row - 1]!, row === 0 ? null : props.marginalPrivateCosts[row - 1]!, row === 0 ? null : props.marginalPrivateCosts[row - 1]! + scenario.externalPerUnit, audit.benefits[row]!, audit.resources[row]!, current.harm[row]!, audit.privateCombined[row]!, current.socialNet[row]!, current.loss[row]!];
            return <tr key={row} className={cx('border-b border-ink-200 last:border-b-0', row === q && 'bg-accent-300/20')} data-surplus-row={row}>
              <th scope="row" className="px-3 py-3 font-mono font-semibold tabular-nums text-ink-900">{number(row)}</th>
              {values.map((value, i) => <td key={i} className="whitespace-nowrap px-3 py-3 font-mono tabular-nums text-ink-800" data-surplus-column={i}>{value === null ? labels.notApplicable : money(value)}</td>)}
            </tr>;
          })}</tbody>
        </table>
      </div>
      <p className="mt-5 text-sm font-semibold leading-relaxed text-ink-900" role="status" aria-live="polite" aria-atomic="true">{result}</p>
    </figure>
  );
}
