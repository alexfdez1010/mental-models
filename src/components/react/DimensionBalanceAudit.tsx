import { useId, useState } from 'react';
import { cx } from '@/components/react/cx';

/** Exponents of mass, length and time, in that order. */
export type DimensionVector = readonly [number, number, number];

export interface DimensionQuantity {
  id: string;
  symbol: string;
  dimension: DimensionVector;
}

export interface DimensionCandidate {
  id: string;
  label: string;
  /** Twice each monomial power; -1 represents a power of -1/2. */
  powersTwice: readonly number[];
}

export interface DimensionCase {
  id: string;
  label: string;
  quantities: readonly DimensionQuantity[];
  candidates: readonly DimensionCandidate[];
  target: DimensionVector;
}

export interface DimensionBalanceLabels {
  case: string;
  candidate: string;
  quantity: string;
  dimension: string;
  power: string;
  mass: string;
  length: string;
  time: string;
  sum: string;
  target: string;
  compatible: string;
  incompatible: string;
  table: string;
  legendSum: string;
  legendTarget: string;
  chart: string;
  /** Tokens: {case}, {candidate}, {sum}, {target}, {verdict}. */
  status: string;
}

export interface DimensionBalanceAuditProps {
  locale?: 'en' | 'es';
  title: string;
  instructions: string;
  cases: readonly DimensionCase[];
  labels: DimensionBalanceLabels;
  caption?: string;
  className?: string;
}

export interface DimensionBalanceResult {
  contributionsTwice: DimensionVector[];
  sumTwice: DimensionVector;
  targetTwice: DimensionVector;
  compatible: boolean;
}

function fail(message: string): never { throw new Error(`DimensionBalanceAudit: ${message}`); }

function text(value: unknown, name: string): asserts value is string {
  if (typeof value !== 'string' || !value.trim()) fail(`${name} must be a non-empty string.`);
}

function dense(value: unknown, minimum: number, maximum: number, name: string): asserts value is unknown[] {
  if (!Array.isArray(value) || value.length < minimum || value.length > maximum) fail(`Invalid ${name} length.`);
  for (let i = 0; i < value.length; i++) if (!Object.hasOwn(value, i)) fail(`${name} must not contain holes.`);
}

function vector(value: DimensionVector, name: string) {
  dense(value, 3, 3, name);
  for (const entry of value) if (!Number.isInteger(entry) || Math.abs(entry) > 4) fail(`${name} needs integer exponents from -4 to 4.`);
}

function validateCases(cases: readonly DimensionCase[]) {
  dense(cases, 1, 8, 'cases');
  const ids = new Set<string>();
  const names = new Set<string>();
  for (const item of cases) {
    if (!item || typeof item !== 'object') fail('Invalid case.');
    text(item.id, 'case id'); text(item.label, 'case label');
    if (ids.has(item.id) || names.has(item.label)) fail('Duplicate case id or label.');
    ids.add(item.id); names.add(item.label); vector(item.target, 'target');
    dense(item.quantities, 1, 6, 'quantities');
    const quantities = new Set<string>();
    for (const quantity of item.quantities) {
      if (!quantity || typeof quantity !== 'object') fail('Invalid quantity.');
      text(quantity.id, 'quantity id'); text(quantity.symbol, 'quantity symbol');
      if (quantities.has(quantity.id)) fail('Duplicate quantity id.');
      quantities.add(quantity.id); vector(quantity.dimension, 'quantity dimension');
    }
    dense(item.candidates, 1, 8, 'candidates');
    const candidates = new Set<string>();
    const candidateNames = new Set<string>();
    for (const candidate of item.candidates) {
      if (!candidate || typeof candidate !== 'object') fail('Invalid candidate.');
      text(candidate.id, 'candidate id'); text(candidate.label, 'candidate label');
      if (candidates.has(candidate.id) || candidateNames.has(candidate.label)) fail('Duplicate candidate id or label.');
      candidates.add(candidate.id); candidateNames.add(candidate.label);
      dense(candidate.powersTwice, item.quantities.length, item.quantities.length, 'powersTwice');
      for (const power of candidate.powersTwice) if (!Number.isInteger(power) || Math.abs(power) > 8) fail('powersTwice needs integers from -8 to 8.');
    }
  }
}

function calculate(item: DimensionCase, index: number): DimensionBalanceResult {
  const candidate = item.candidates[index];
  const contributionsTwice = item.quantities.map((quantity, i): DimensionVector => [
    quantity.dimension[0] * candidate.powersTwice[i],
    quantity.dimension[1] * candidate.powersTwice[i],
    quantity.dimension[2] * candidate.powersTwice[i],
  ]);
  const sumTwice: DimensionVector = [
    contributionsTwice.reduce((sum, row) => sum + row[0], 0),
    contributionsTwice.reduce((sum, row) => sum + row[1], 0),
    contributionsTwice.reduce((sum, row) => sum + row[2], 0),
  ];
  const targetTwice: DimensionVector = [item.target[0] * 2, item.target[1] * 2, item.target[2] * 2];
  return { contributionsTwice, sumTwice, targetTwice, compatible: sumTwice.every((value, i) => value === targetTwice[i]) };
}

/** Bounded exact half-integer arithmetic; no formula parser or physical solver. */
export function getDimensionBalance(item: DimensionCase, candidateIndex: number): DimensionBalanceResult {
  validateCases([item]);
  if (!Number.isInteger(candidateIndex) || candidateIndex < 0 || candidateIndex >= item.candidates.length) fail('Invalid candidate index.');
  return calculate(item, candidateIndex);
}

function interpolate(template: string, values: Record<string, string>) {
  return template.replace(/\{(case|candidate|sum|target|verdict)\}/g, (token, key: string) => values[key] ?? token);
}

/** Compare dimensional exponent vectors on one fixed scale for the whole catalogue. */
export function DimensionBalanceAudit({ locale = 'en', title, instructions, cases, labels, caption, className }: DimensionBalanceAuditProps) {
  if (locale !== 'en' && locale !== 'es') fail('locale must be en or es.');
  if (caption !== undefined && typeof caption !== 'string') fail('caption must be a string.');
  if (className !== undefined && typeof className !== 'string') fail('className must be a string.');
  text(title, 'title'); text(instructions, 'instructions'); validateCases(cases);
  const labelKeys: (keyof DimensionBalanceLabels)[] = ['case', 'candidate', 'quantity', 'dimension', 'power', 'mass', 'length', 'time', 'sum', 'target', 'compatible', 'incompatible', 'table', 'legendSum', 'legendTarget', 'chart', 'status'];
  if (!labels || typeof labels !== 'object') fail('Missing labels.');
  for (const key of labelKeys) text(labels[key], key);
  const id = useId();
  const [selection, setSelection] = useState({ caseId: cases[0].id, candidateId: cases[0].candidates[0].id });
  const item = cases.find(value => value.id === selection.caseId) ?? cases[0];
  const candidateIndex = selection.caseId === item.id ? Math.max(0, item.candidates.findIndex(value => value.id === selection.candidateId)) : 0;
  const candidate = item.candidates[candidateIndex];
  const result = calculate(item, candidateIndex);
  const number = new Intl.NumberFormat(locale === 'es' ? 'es-ES' : 'en-US', { maximumFractionDigits: 1 });
  const half = (value: number) => number.format(value === 0 ? 0 : value / 2);
  const tuple = (values: DimensionVector) => `(${values.map(half).join('; ')})`;
  const verdict = result.compatible ? labels.compatible : labels.incompatible;
  const status = interpolate(labels.status, { case: item.label, candidate: candidate.label, sum: tuple(result.sumTwice), target: tuple(result.targetTwice), verdict });
  const limit = Math.max(1, ...cases.flatMap(value => value.candidates.flatMap((_, index) => {
    const row = calculate(value, index);
    return [...row.sumTwice, ...row.targetTwice].map(entry => Math.abs(entry / 2));
  })));
  const x = (valueTwice: number) => 80 + ((valueTwice / 2 + limit) / (2 * limit)) * 300;
  const focus = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700';
  const tween = 'transition-all duration-200 motion-reduce:transition-none';
  return <figure className={cx('not-prose brutal my-6 min-w-0 bg-surface p-5 sm:p-6', className)}>
    <p className="font-display text-lg font-semibold text-ink-900">{title}</p>
    <p className="mt-2 text-sm leading-relaxed text-ink-700">{instructions}</p>
    <div className="mt-4 grid min-w-0 gap-3 sm:grid-cols-2">
      {cases.length > 1 ? <label className="block min-w-0 text-sm font-semibold" htmlFor={`${id}-case`}>{labels.case}
        <select id={`${id}-case`} className={cx('mt-1 block w-full min-w-0 rounded-card border border-ink-300 bg-surface p-2', focus)} value={item.id} onChange={event => {
          const next = cases.find(value => value.id === event.target.value);
          if (next) setSelection({ caseId: next.id, candidateId: next.candidates[0].id });
        }}>{cases.map(value => <option key={value.id} value={value.id}>{value.label}</option>)}</select>
      </label> : null}
      {item.candidates.length > 1 ? <label className="block min-w-0 text-sm font-semibold" htmlFor={`${id}-candidate`}>{labels.candidate}
        <select id={`${id}-candidate`} className={cx('mt-1 block w-full min-w-0 rounded-card border border-ink-300 bg-surface p-2', focus)} value={candidate.id} onChange={event => setSelection({ caseId: item.id, candidateId: event.target.value })}>
          {item.candidates.map(value => <option key={value.id} value={value.id}>{value.label}</option>)}
        </select>
      </label> : null}
    </div>
    <p className="mt-4 break-words rounded-card border border-ink-200 bg-surface-sunken p-3 text-sm leading-relaxed" aria-live="polite" aria-atomic="true" data-dimensional-result={result.compatible ? 'compatible' : 'incompatible'}>{status}</p>
    <svg className="mt-4 h-auto w-full" viewBox="0 0 420 205" role="img" aria-labelledby={`${id}-chart-title ${id}-chart-description`} data-exponent-limit={limit}>
      <title id={`${id}-chart-title`}>{labels.chart}</title><desc id={`${id}-chart-description`}>{status}</desc>
      <line x1={x(0)} x2={x(0)} y1="20" y2="165" stroke="var(--color-ink-300)" strokeDasharray="4 4" />
      {['M', 'L', 'T'].map((symbol, i) => <g key={symbol} data-balance-axis={symbol} data-balance-sum-twice={result.sumTwice[i]} data-balance-target-twice={result.targetTwice[i]}>
        <text x="20" y={49 + i * 50} fontSize="15" fontWeight="600" fill="var(--color-ink-800)">{symbol}</text>
        <line x1="80" x2="380" y1={44 + i * 50} y2={44 + i * 50} stroke="var(--color-ink-300)" />
        <circle cx={x(result.targetTwice[i])} cy={44 + i * 50} r="9" fill="none" stroke="var(--color-ink-700)" strokeWidth="2" />
        <circle cx={x(result.sumTwice[i])} cy={44 + i * 50} r="5" fill="var(--color-brand-600)" className={tween} />
      </g>)}
      {[-limit, 0, limit].map(value => <text key={value} x={x(value * 2)} y="188" textAnchor="middle" fontSize="13" fill="var(--color-ink-700)">{number.format(value)}</text>)}
    </svg>
    <p className="text-xs leading-relaxed text-ink-600"><span aria-hidden="true">● </span>{labels.legendSum}<span aria-hidden="true"> · ◯ </span>{labels.legendTarget}</p>
    <div role="region" tabIndex={0} aria-label={labels.table} className={cx('mt-4 max-w-full overflow-x-auto', focus)}>
      <table className="w-full text-left text-sm" style={{ minWidth: '34rem', display: 'table', overflow: 'visible', margin: 0 }}>
        <caption className="mb-2 text-left font-semibold">{labels.table}</caption>
        <thead><tr>{[labels.quantity, labels.dimension, labels.power, labels.mass, labels.length, labels.time].map(label => <th key={label} scope="col" className="p-3">{label}</th>)}</tr></thead>
        <tbody>{item.quantities.map((quantity, i) => <tr key={quantity.id}>
          <th scope="row" className="p-3 font-mono">{quantity.symbol}</th>
          <td className="p-3 font-mono">{tuple([quantity.dimension[0] * 2, quantity.dimension[1] * 2, quantity.dimension[2] * 2])}</td>
          <td className="p-3 font-mono">{half(candidate.powersTwice[i])}</td>
          {result.contributionsTwice[i].map((value, axis) => <td key={axis} className="p-3 font-mono">{half(value)}</td>)}
        </tr>)}</tbody>
        <tfoot>{[[labels.sum, result.sumTwice], [labels.target, result.targetTwice]].map(([label, values], row) => <tr key={row} className="border-t border-ink-200 font-semibold">
          <th scope="row" className="p-3">{label as string}</th><td className="p-3" colSpan={2}>—</td>
          {(values as DimensionVector).map((value, axis) => <td key={axis} className="p-3 font-mono">{half(value)}</td>)}
        </tr>)}</tfoot>
      </table>
    </div>
    {caption ? <figcaption className="mt-3 text-sm leading-relaxed text-ink-600">{caption}</figcaption> : null}
  </figure>;
}

export default DimensionBalanceAudit;
