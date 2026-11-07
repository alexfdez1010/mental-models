import { useId, useState } from 'react';
import { cx } from '@/components/react/cx';

export interface SecretaryLimitLabels {
  slider: string;
  xAxis: string;
  yAxis: string;
  chart: string;
  /** Must contain {x} and {value}; both are formatted as percentages. */
  readout: string;
  endpointNote: string;
}
export interface SecretaryLimitCurveProps {
  title: string;
  labels: SecretaryLimitLabels;
  locale?: 'en' | 'es';
  initialPercent?: number;
  className?: string;
}

/** Continuous extension of x log(1/x), not a finite-n success function. */
export function secretaryLimitValue(x: number): number {
  if (!Number.isFinite(x) || x < 0 || x > 1) throw new Error('SecretaryLimitCurve requires a fraction from zero to one.');
  return x === 0 || x === 1 ? 0 : -x * Math.log(x);
}

export function SecretaryLimitCurve({ title, labels, locale = 'en', initialPercent = 37, className }: SecretaryLimitCurveProps) {
  if (typeof title !== 'string' || !title.trim() || !labels || ['slider', 'xAxis', 'yAxis', 'chart', 'readout', 'endpointNote'].some(k => typeof labels[k as keyof SecretaryLimitLabels] !== 'string' || !labels[k as keyof SecretaryLimitLabels].trim())) throw new Error('SecretaryLimitCurve requires its title and localized labels.');
  if (!labels.readout.includes('{x}') || !labels.readout.includes('{value}')) throw new Error('SecretaryLimitCurve readout requires both placeholders.');
  if (locale !== 'en' && locale !== 'es') throw new Error('SecretaryLimitCurve locale must be en or es.');
  if (!Number.isInteger(initialPercent) || initialPercent < 0 || initialPercent > 100) throw new Error('SecretaryLimitCurve initialPercent must be an integer from zero to one hundred.');
  const id = useId();
  const [percent, setPercent] = useState(initialPercent === 0 ? 0 : initialPercent);
  const x = percent / 100;
  const format = new Intl.NumberFormat(locale === 'es' ? 'es-ES' : 'en-US', { style: 'percent', maximumFractionDigits: 2 });
  const readout = labels.readout.replace('{x}', format.format(x)).replace('{value}', format.format(secretaryLimitValue(x)));
  const width = 460, height = 250, left = 47, right = 14, top = 14, bottom = 43;
  const px = (v: number) => left + v * (width - left - right);
  const py = (v: number) => height - bottom - v / .4 * (height - top - bottom);
  const path = Array.from({ length: 201 }, (_, i) => `${i === 0 ? 'M' : 'L'}${px(i / 200).toFixed(2)},${py(secretaryLimitValue(i / 200)).toFixed(2)}`).join(' ');
  const peak = 1 / Math.E;
  return <figure className={cx('not-prose my-8 text-ink-900', className)} aria-labelledby={`${id}-title`}>
    <figcaption id={`${id}-title`} className="mb-4 font-display text-lg font-semibold">{title}</figcaption>
    <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full" role="img" aria-label={labels.chart}>
      <path d={`M${left},${top} V${height - bottom} H${width - right}`} fill="none" stroke="var(--color-ink-500)" />
      {[0, .2, .4].map(v => <text key={v} x={left - 7} y={py(v) + 4} textAnchor="end" fontSize="12" fill="var(--color-ink-600)">{format.format(v)}</text>)}
      {[0, .5, 1].map(v => <text key={v} x={px(v)} y={height - bottom + 20} textAnchor={v === 0 ? 'start' : v === 1 ? 'end' : 'middle'} fontSize="12" fill="var(--color-ink-600)">{format.format(v)}</text>)}
      <path d={path} fill="none" stroke="var(--color-brand-700)" strokeWidth="2.5" />
      <line x1={px(peak)} x2={px(peak)} y1={py(peak)} y2={height - bottom} stroke="var(--color-accent-600)" strokeDasharray="4 4" />
      <text x={px(peak)} y={top + 8} textAnchor="middle" fontSize="12" fill="var(--color-accent-600)">1/e</text>
      <circle cx={px(x)} cy={py(secretaryLimitValue(x))} r="5" fill="var(--color-brand-700)" />
    </svg>
    <div className="flex flex-wrap justify-between gap-2 text-xs text-ink-600"><span>{labels.xAxis}</span><span>{labels.yAxis}</span></div>
    <label htmlFor={`${id}-fraction`} className="mt-5 block text-sm font-semibold">{labels.slider}</label>
    <input id={`${id}-fraction`} type="range" min={0} max={100} step={1} value={percent} onChange={e => setPercent(Number(e.currentTarget.value))} aria-valuetext={readout} className="mt-3 w-full accent-brand-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-700" />
    <p role="status" aria-live="polite" aria-atomic="true" className="mt-3 font-mono text-sm tabular-nums">{readout}</p>
    <p className="mt-2 text-sm text-ink-600">{labels.endpointNote}</p>
  </figure>;
}
export default SecretaryLimitCurve;
