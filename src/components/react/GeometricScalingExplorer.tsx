import { useId, useState } from 'react';
import { cx } from '@/components/react/cx';

export interface CubeGroup {
  label: string;
  count: number;
  /** Edge multiplier in half units: 1 means one half, 4 means double. */
  scaleTwice: number;
}

export interface CubeComparison {
  id: string;
  label: string;
  groups: readonly [CubeGroup, CubeGroup];
}

export interface CubeFraction { numerator: number; denominator: number }
export interface CubeMetrics {
  edge: CubeFraction;
  area: CubeFraction;
  volume: CubeFraction;
  ratio: CubeFraction;
}

export interface GeometricScalingLabels {
  comparison: string;
  group: string;
  count: string;
  edge: string;
  area: string;
  volume: string;
  ratio: string;
  table: string;
  chart: string;
  representative: string;
  /** Tokens: {first}, {second}, {firstCount}, {secondCount}, {firstEdge}, {secondEdge}, {unit}. */
  chartDescription: string;
  /** Also accepts {firstArea}, {secondArea}, {firstVolume}, {secondVolume}, {comparison}. */
  status: string;
}

export interface GeometricScalingExplorerProps {
  locale?: 'en' | 'es';
  title: string;
  instructions: string;
  baseEdge: number;
  unit: string;
  comparisons: readonly CubeComparison[];
  labels: GeometricScalingLabels;
  caption?: string;
  className?: string;
}

function fail(message: string): never { throw new Error(`GeometricScalingExplorer: ${message}`); }

function text(value: unknown, name: string): asserts value is string {
  if (typeof value !== 'string' || !value.trim()) fail(`${name} must be a non-empty string.`);
}

function dense(value: unknown, minimum: number, maximum: number, name: string): asserts value is unknown[] {
  if (!Array.isArray(value) || value.length < minimum || value.length > maximum) fail(`Invalid ${name} length.`);
  for (let i = 0; i < value.length; i++) if (!Object.hasOwn(value, i)) fail(`${name} must not contain holes.`);
}

function validateGroup(baseEdge: number, group: CubeGroup) {
  if (!Number.isInteger(baseEdge) || baseEdge < 1 || baseEdge > 100) fail('baseEdge must be an integer from 1 to 100.');
  if (!group || typeof group !== 'object') fail('Invalid group.');
  text(group.label, 'group label');
  if (!Number.isInteger(group.count) || group.count < 1 || group.count > 8) fail('count must be an integer from 1 to 8.');
  if (!Number.isInteger(group.scaleTwice) || group.scaleTwice < 1 || group.scaleTwice > 4) fail('scaleTwice must be an integer from 1 to 4.');
}

function fraction(numerator: number, denominator: number): CubeFraction {
  let a = numerator, b = denominator;
  while (b) { const remainder = a % b; a = b; b = remainder; }
  return { numerator: numerator / a, denominator: denominator / a };
}

/** Exact integer numerators, bounded by 512 million; no arbitrary geometry input. */
export function getCubeMetrics(baseEdge: number, group: CubeGroup): CubeMetrics {
  validateGroup(baseEdge, group);
  const twiceEdge = baseEdge * group.scaleTwice;
  return {
    edge: fraction(twiceEdge, 2),
    area: fraction(6 * group.count * twiceEdge ** 2, 4),
    volume: fraction(group.count * twiceEdge ** 3, 8),
    ratio: fraction(12, twiceEdge),
  };
}

function interpolate(template: string, values: Record<string, string>) {
  return template.replace(/\{(comparison|first|second|firstCount|secondCount|firstEdge|secondEdge|firstArea|secondArea|firstVolume|secondVolume|unit)\}/g, (token, key: string) => values[key] ?? token);
}

/** Separate closed cubes, common length scale and three separately scaled metrics. */
export function GeometricScalingExplorer({ locale = 'en', title, instructions, baseEdge, unit, comparisons, labels, caption, className }: GeometricScalingExplorerProps) {
  if (locale !== 'en' && locale !== 'es') fail('locale must be en or es.');
  if (caption !== undefined && typeof caption !== 'string') fail('caption must be a string.');
  if (className !== undefined && typeof className !== 'string') fail('className must be a string.');
  text(title, 'title'); text(instructions, 'instructions'); text(unit, 'unit');
  dense(comparisons, 1, 8, 'comparisons');
  const ids = new Set<string>();
  const names = new Set<string>();
  for (const comparison of comparisons) {
    if (!comparison || typeof comparison !== 'object') fail('Invalid comparison.');
    text(comparison.id, 'comparison id'); text(comparison.label, 'comparison label');
    if (ids.has(comparison.id) || names.has(comparison.label)) fail('Duplicate comparison id or label.');
    ids.add(comparison.id); names.add(comparison.label);
    dense(comparison.groups, 2, 2, 'groups');
    for (const group of comparison.groups) validateGroup(baseEdge, group);
  }
  if (!labels || typeof labels !== 'object') fail('Missing labels.');
  const labelKeys: (keyof GeometricScalingLabels)[] = ['comparison', 'group', 'count', 'edge', 'area', 'volume', 'ratio', 'table', 'chart', 'representative', 'chartDescription', 'status'];
  for (const key of labelKeys) text(labels[key], key);
  const id = useId();
  const [selectedId, setSelectedId] = useState(comparisons[0].id);
  const selected = comparisons.find(value => value.id === selectedId) ?? comparisons[0];
  const metrics = selected.groups.map(group => getCubeMetrics(baseEdge, group));
  const allMetrics = comparisons.flatMap(value => value.groups.map(group => getCubeMetrics(baseEdge, group)));
  const value = (entry: CubeFraction) => entry.numerator / entry.denominator;
  const number = new Intl.NumberFormat(locale === 'es' ? 'es-ES' : 'en-US', { maximumFractionDigits: 4 });
  const integer = new Intl.NumberFormat(locale === 'es' ? 'es-ES' : 'en-US', { maximumFractionDigits: 0 });
  const display = (entry: CubeFraction) => entry.denominator === 1 ? integer.format(entry.numerator) : `${integer.format(entry.numerator)}/${integer.format(entry.denominator)} (≈${number.format(value(entry))})`;
  const maximumEdge = Math.max(...allMetrics.map(row => value(row.edge)));
  const metricKeys = ['area', 'volume', 'ratio'] as const;
  const maxima = Object.fromEntries(metricKeys.map(key => [key, Math.max(...allMetrics.map(row => value(row[key])))])) as Record<(typeof metricKeys)[number], number>;
  const values = {
    comparison: selected.label, first: selected.groups[0].label, second: selected.groups[1].label,
    firstCount: integer.format(selected.groups[0].count), secondCount: integer.format(selected.groups[1].count),
    firstEdge: display(metrics[0].edge), secondEdge: display(metrics[1].edge),
    firstArea: display(metrics[0].area), secondArea: display(metrics[1].area),
    firstVolume: display(metrics[0].volume), secondVolume: display(metrics[1].volume), unit,
  };
  const description = interpolate(labels.chartDescription, values);
  const status = interpolate(labels.status, values);
  const focus = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700';
  const tween = 'transition-transform duration-300 motion-reduce:transition-none';
  const units = { edge: unit, area: `${unit}²`, volume: `${unit}³`, ratio: `${unit}⁻¹` };
  return <figure className={cx('not-prose brutal my-6 min-w-0 bg-surface p-5 sm:p-6', className)}>
    <p className="font-display text-lg font-semibold text-ink-900">{title}</p>
    <p className="mt-2 text-sm leading-relaxed text-ink-700">{instructions}</p>
    {comparisons.length > 1 ? <label htmlFor={`${id}-comparison`} className="mt-4 block text-sm font-semibold">{labels.comparison}
      <select id={`${id}-comparison`} className={cx('mt-1 block w-full min-w-0 rounded-card border border-ink-300 bg-surface p-2', focus)} value={selected.id} onChange={event => setSelectedId(event.target.value)}>
        {comparisons.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
      </select>
    </label> : null}
    <p className="mt-4 break-words rounded-card border border-ink-200 bg-surface-sunken p-3 text-sm leading-relaxed" aria-live="polite" aria-atomic="true">{status}</p>
    <svg viewBox="0 0 460 260" className="mt-4 h-auto w-full" role="img" aria-labelledby={`${id}-title ${id}-description`} data-global-edge={maximumEdge}>
      <title id={`${id}-title`}>{labels.chart}</title><desc id={`${id}-description`}>{description}</desc>
      {selected.groups.map((group, i) => {
        const scale = value(metrics[i].edge) / maximumEdge;
        const centre = i === 0 ? 115 : 335;
        return <g key={i} data-cube-group={i} data-edge={value(metrics[i].edge)}>
          <g transform={`translate(${centre - 50 * scale}, 205) scale(${scale})`} className={tween} data-cube-shape="">
            <polygon points="0,-100 35,-125 135,-125 100,-100" fill="var(--color-surface-sunken)" stroke="var(--color-ink-600)" strokeWidth="2" />
            <polygon points="100,-100 135,-125 135,-25 100,0" fill="var(--color-ink-200)" stroke="var(--color-ink-600)" strokeWidth="2" />
            <rect x="0" y="-100" width="100" height="100" fill={i === 0 ? 'var(--color-brand-500)' : 'var(--color-accent-500)'} stroke="var(--color-ink-700)" strokeWidth="2" />
          </g>
          <text x={centre} y="238" textAnchor="middle" fontSize="16" fontWeight="600" fill="var(--color-ink-800)">{i + 1}</text>
        </g>;
      })}
    </svg>
    <div className="grid min-w-0 grid-cols-2 gap-3 text-center text-sm">
      {selected.groups.map((group, i) => <div key={i} className="min-w-0 break-words"><p className="font-semibold">{i + 1}. {group.label}</p><p className="mt-1 text-ink-600">{labels.count}: {integer.format(group.count)}</p></div>)}
    </div>
    <p className="mt-2 text-xs leading-relaxed text-ink-600">{labels.representative}</p>
    <div className="mt-5 grid min-w-0 gap-4">
      {metricKeys.map(key => <div key={key} className="min-w-0 rounded-card border border-ink-200 p-3" data-cube-metric={key} data-metric-maximum={maxima[key]}>
        <p className="font-semibold">{labels[key]} ({units[key]})</p>
        <ul className="mt-2 space-y-3">{selected.groups.map((group, i) => <li key={i}>
          <div className="flex min-w-0 flex-wrap justify-between gap-x-3 gap-y-1 text-sm"><span className="break-words">{group.label}</span><span className="font-mono">{display(metrics[i][key])}</span></div>
          <div className="mt-1 h-3 overflow-hidden rounded-pill bg-surface-sunken" aria-hidden="true"><div className={cx('h-full origin-left', tween, i === 0 ? 'bg-brand-500' : 'bg-accent-500')} style={{ transform: `scaleX(${value(metrics[i][key]) / maxima[key]})` }} data-cube-bar={i} /></div>
        </li>)}</ul>
      </div>)}
    </div>
    <div role="region" tabIndex={0} aria-label={labels.table} className={cx('mt-5 max-w-full overflow-x-auto', focus)}>
      <table className="w-full text-left text-sm" style={{ minWidth: '36rem', display: 'table', overflow: 'visible', margin: 0 }}>
        <caption className="mb-2 text-left font-semibold">{labels.table}</caption>
        <thead><tr>{[labels.group, labels.count, `${labels.edge} (${units.edge})`, `${labels.area} (${units.area})`, `${labels.volume} (${units.volume})`, `${labels.ratio} (${units.ratio})`].map(label => <th scope="col" key={label} className="p-3">{label}</th>)}</tr></thead>
        <tbody>{selected.groups.map((group, i) => <tr key={i}>
          <th scope="row" className="p-3">{group.label}</th><td className="p-3 font-mono">{integer.format(group.count)}</td>
          {(['edge', 'area', 'volume', 'ratio'] as const).map(key => <td key={key} className="p-3 font-mono">{display(metrics[i][key])}</td>)}
        </tr>)}</tbody>
      </table>
    </div>
    {caption ? <figcaption className="mt-3 text-sm leading-relaxed text-ink-600">{caption}</figcaption> : null}
  </figure>;
}

export default GeometricScalingExplorer;
