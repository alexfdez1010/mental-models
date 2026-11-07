import { useId, useState } from 'react';

export interface RationalInput { numerator: number; denominator: number }
export interface ExactRational { numerator: bigint; denominator: bigint }
export function rational(numerator: bigint, denominator: bigint = 1n): ExactRational {
  if (denominator === 0n) throw new Error('A rational denominator cannot be zero.');
  if (denominator < 0n) { numerator = -numerator; denominator = -denominator; }
  let a = numerator < 0n ? -numerator : numerator, b = denominator;
  while (b !== 0n) { const t = a % b; a = b; b = t; }
  return { numerator: numerator / a, denominator: denominator / a };
}
export const addRational = (a: ExactRational, b: ExactRational) => rational(a.numerator * b.denominator + b.numerator * a.denominator, a.denominator * b.denominator);
export const multiplyRational = (a: ExactRational, b: ExactRational) => rational(a.numerator * b.numerator, a.denominator * b.denominator);
export const compareRational = (a: ExactRational, b: ExactRational) => a.numerator * b.denominator < b.numerator * a.denominator ? -1 : a.numerator * b.denominator > b.numerator * a.denominator ? 1 : 0;
export const rationalText = (a: ExactRational) => a.denominator === 1n ? String(a.numerator) : `${a.numerator}/${a.denominator}`;
export const rationalNumber = (a: ExactRational) => Number(a.numerator) / Number(a.denominator);
export function validateRationalInput(value: RationalInput, unit = false): ExactRational {
  if (!value || !Object.hasOwn(value, 'numerator') || !Object.hasOwn(value, 'denominator') || !Number.isSafeInteger(value.numerator) || !Number.isSafeInteger(value.denominator) || value.numerator < 0 || value.numerator > 1_000_000 || value.denominator < 1 || value.denominator > 1_000_000 || (unit && value.numerator > value.denominator)) throw new Error('Expected a bounded nonnegative rational input.');
  return rational(BigInt(value.numerator), BigInt(value.denominator));
}
export interface SamplingCase {
  id: string; label: string; note: string; n: number;
  weights: number[]; denominator: number; truth: RationalInput;
  varianceEstimates?: RationalInput[];
  varianceEstimateLabel?: string;
  varianceEstimateNote?: string;
}
export interface SamplingCatalogueLabels {
  caseLabel: string; countLabel: string; chartLabel: string; chartDescription: string;
  xAxisLabel: string; yAxisLabel: string; tableLabel: string;
  countColumn: string; estimateColumn: string; probabilityColumn: string;
  meanLabel: string; truthLabel: string; biasLabel: string; varianceLabel: string; mseLabel: string; seLabel: string;
  exactNote: string; selectionTemplate: string;
}
export interface SamplingCatalogueProps {
  title: string; instructions: string; cases: SamplingCase[];
  labels: SamplingCatalogueLabels; locale?: 'en' | 'es'; className?: string;
}
const keys: (keyof SamplingCatalogueLabels)[] = ['caseLabel','countLabel','chartLabel','chartDescription','xAxisLabel','yAxisLabel','tableLabel','countColumn','estimateColumn','probabilityColumn','meanLabel','truthLabel','biasLabel','varianceLabel','mseLabel','seLabel','exactNote','selectionTemplate'];
export function requireText(value: unknown, name: string): asserts value is string {
  if (typeof value !== 'string' || !value.trim() || value.trim() !== value) throw new Error(`${name} must be nonempty trimmed text.`);
}
export function auditSamplingCase(c: SamplingCase) {
  if (!c || typeof c !== 'object') throw new Error('Sampling case is required.');
  for (const field of ['id','label','note'] as const) requireText(c[field], field);
  if (!Number.isSafeInteger(c.n) || c.n < 1 || c.n > 16 || !Number.isSafeInteger(c.denominator) || c.denominator < 1 || c.denominator > 1_000_000) throw new Error('Sampling n or denominator is outside the catalogue bounds.');
  if (!Array.isArray(c.weights) || c.weights.length !== c.n + 1) throw new Error('Sampling weights must be dense from zero through n.');
  let total = 0n, first = 0n, second = 0n;
  for (let k = 0; k <= c.n; k++) {
    if (!Object.hasOwn(c.weights, k) || !Number.isSafeInteger(c.weights[k]) || c.weights[k] < 0 || c.weights[k] > 1_000_000) throw new Error('Invalid sampling weight.');
    const w = BigInt(c.weights[k]); total += w; first += w * BigInt(k); second += w * BigInt(k * k);
  }
  if (total !== BigInt(c.denominator)) throw new Error('Sampling weights must sum exactly to denominator.');
  const truth = validateRationalInput(c.truth, true), n = BigInt(c.n);
  const mean = rational(first, total * n);
  const variance = rational(total * second - first * first, total * total * n * n);
  const bias = rational(mean.numerator * truth.denominator - truth.numerator * mean.denominator, mean.denominator * truth.denominator);
  const mse = addRational(variance, multiplyRational(bias, bias));
  let estimatedVarianceMean: ExactRational | undefined;
  if (c.varianceEstimates !== undefined) {
    if (!Array.isArray(c.varianceEstimates) || c.varianceEstimates.length !== c.n + 1) throw new Error('Estimated variance array must be dense from zero through n.');
    requireText(c.varianceEstimateLabel, 'varianceEstimateLabel'); requireText(c.varianceEstimateNote, 'varianceEstimateNote');
    estimatedVarianceMean = rational(0n);
    for (let k = 0; k <= c.n; k++) {
      if (!Object.hasOwn(c.varianceEstimates, k)) throw new Error('Sparse estimated variance array.');
      const v = validateRationalInput(c.varianceEstimates[k]);
      estimatedVarianceMean = addRational(estimatedVarianceMean, multiplyRational(rational(BigInt(c.weights[k]), total), v));
    }
  } else if (c.varianceEstimateLabel !== undefined || c.varianceEstimateNote !== undefined) throw new Error('Estimated variance labels require values.');
  return { mean, variance, bias, mse, truth, estimatedVarianceMean };
}
export function auditSamplingCatalogue(p: SamplingCatalogueProps) {
  requireText(p.title, 'title'); requireText(p.instructions, 'instructions');
  if (p.locale !== undefined && p.locale !== 'en' && p.locale !== 'es') throw new Error('Invalid locale.');
  if (!Array.isArray(p.cases) || p.cases.length < 1 || p.cases.length > 8) throw new Error('Expected one through eight cases.');
  if (!p.labels) throw new Error('Labels are required.');
  keys.forEach(k => requireText(p.labels[k], k));
  let template = p.labels.selectionTemplate;
  for (const token of ['count','estimate','probability']) {
    const marker = `{${token}}`; if (template.split(marker).length !== 2) throw new Error('Selection template needs each token exactly once.'); template = template.replace(marker, '');
  }
  if (/[{}]/.test(template)) throw new Error('Unknown template token.');
  const ids = new Set<string>();
  const result = [];
  for (let i = 0; i < p.cases.length; i++) { const c = p.cases[i]; const a = auditSamplingCase(c); if (ids.has(c.id)) throw new Error('Duplicate case id.'); ids.add(c.id); result.push(a); }
  return result;
}
export function SamplingCatalogue(props: SamplingCatalogueProps) {
  // Validate every case, including hidden cases, before any hook.
  const audits = auditSamplingCatalogue(props);
  const id = useId(), [caseIndex, setCaseIndex] = useState(0), [count, setCount] = useState(() => props.cases[0].weights.findIndex(w => w > 0));
  const c = props.cases[caseIndex], a = audits[caseIndex], l = props.labels, locale = props.locale ?? 'en';
  const format = (x: number, digits = 4) => new Intl.NumberFormat(locale === 'es' ? 'es-ES' : 'en-US', { maximumFractionDigits: digits }).format(x);
  const estimate = rational(BigInt(count), BigInt(c.n)), probability = rational(BigInt(c.weights[count]), BigInt(c.denominator));
  const result = l.selectionTemplate.replace('{count}', String(count)).replace('{estimate}', rationalText(estimate)).replace('{probability}', rationalText(probability));
  const stats = [[l.meanLabel,a.mean,'mean'],[l.truthLabel,a.truth,'truth'],[l.biasLabel,a.bias,'bias'],[l.varianceLabel,a.variance,'variance'],[l.mseLabel,a.mse,'mse']] as const;
  return <section className={`not-prose my-8 rounded-card border border-ink-200 bg-surface p-4 sm:p-6 ${props.className ?? ''}`} aria-labelledby={`${id}-title`} data-sampling-catalogue="" data-case={c.id}>
    <h3 id={`${id}-title`} className="m-0 font-display text-xl font-semibold text-ink-900">{props.title}</h3>
    <p className="mt-2 text-sm leading-relaxed text-ink-700">{props.instructions}</p>
    <div className="my-4 flex flex-wrap items-end gap-4">
      {props.cases.length > 1 && <label className="flex min-w-0 flex-col gap-1 text-sm font-semibold">{l.caseLabel}<select className="max-w-full rounded-lg border border-ink-300 bg-surface px-3 py-2 font-normal" value={caseIndex} onChange={e => { const i = Number(e.target.value); setCaseIndex(i); setCount(props.cases[i].weights.findIndex(w => w > 0)); }}>{props.cases.map((v,i) => <option key={v.id} value={i}>{v.label}</option>)}</select></label>}
      <label className="flex flex-col gap-1 text-sm font-semibold">{l.countLabel}<select className="rounded-lg border border-ink-300 bg-surface px-3 py-2 font-normal" value={count} onChange={e => setCount(Number(e.target.value))}>{c.weights.flatMap((w,k) => w > 0 ? [<option key={k} value={k}>{k}</option>] : [])}</select></label>
    </div>
    <p className="my-3 text-sm leading-relaxed text-ink-700">{c.note}</p>
    <div tabIndex={0} role="region" aria-label={l.chartLabel} className="overflow-x-auto rounded-lg border border-ink-200 focus-visible:outline-2 focus-visible:outline-brand-500">
      <svg viewBox="0 0 640 290" className="block w-full min-w-[32rem]" role="img" aria-labelledby={`${id}-chart-title ${id}-chart-desc`}>
        <title id={`${id}-chart-title`}>{l.chartLabel}</title><desc id={`${id}-chart-desc`}>{l.chartDescription}</desc>
        <line x1="60" x2="600" y1="230" y2="230" stroke="var(--color-ink-400)"/><line x1="60" x2="60" y1="30" y2="230" stroke="var(--color-ink-400)"/>
        {[0,0.25,0.5,0.75,1].map(v => <g key={v}><text x={60+540*v} y="252" textAnchor="middle" fontSize="12" fill="var(--color-ink-700)">{format(v,2)}</text><text x="50" y={234-200*v} textAnchor="end" fontSize="12" fill="var(--color-ink-700)">{format(v,2)}</text></g>)}
        {c.weights.map((w,k) => <rect key={k} data-count={k} data-probability={rationalText(rational(BigInt(w),BigInt(c.denominator)))} x={60+540*k/c.n-Math.min(20,210/c.n)/2} y={230-200*w/c.denominator} width={Math.min(20,210/c.n)} height={200*w/c.denominator} fill={k===count?'var(--color-brand-600)':'var(--color-brand-300)'} stroke={k===count?'var(--color-ink-900)':'none'} />)}
        <line data-moment="truth" x1={60+540*rationalNumber(a.truth)} x2={60+540*rationalNumber(a.truth)} y1="25" y2="230" stroke="var(--color-ink-700)" strokeDasharray="3 4"/>
        <line data-moment="mean" x1={60+540*rationalNumber(a.mean)} x2={60+540*rationalNumber(a.mean)} y1="25" y2="230" stroke="var(--color-brand-700)" strokeDasharray="8 4"/>
        <text x="330" y="279" textAnchor="middle" fontSize="13" fill="var(--color-ink-900)">{l.xAxisLabel}</text><text x="60" y="17" fontSize="13" fill="var(--color-ink-900)">{l.yAxisLabel}</text>
      </svg>
    </div>
    <dl className="my-4 grid grid-cols-2 gap-3 sm:grid-cols-3">{stats.map(([label,value,key]) => <div key={key} className="rounded-lg bg-surface-sunken p-3"><dt className="text-xs text-ink-600">{label}</dt><dd className="m-0 mt-1 break-words font-mono text-sm text-ink-900" data-stat={key} data-exact={rationalText(value)}>{rationalText(value)}</dd></div>)}<div className="rounded-lg bg-surface-sunken p-3"><dt className="text-xs text-ink-600">{l.seLabel}</dt><dd className="m-0 mt-1 font-mono text-sm">≈ {format(Math.sqrt(rationalNumber(a.variance)))}</dd></div></dl>
    <p className="text-xs leading-relaxed text-ink-600">{l.exactNote}</p>
    <p role="status" aria-live="polite" aria-atomic="true" className="my-4 rounded-lg bg-brand-50 p-3 text-sm text-ink-900" data-selected-count={count}>{result}</p>
    <div tabIndex={0} role="region" aria-label={l.tableLabel} className="overflow-x-auto rounded-lg border border-ink-200 focus-visible:outline-2 focus-visible:outline-brand-500"><table className="w-full min-w-[36rem] border-collapse text-left text-sm" style={{ display: 'table', overflow: 'visible', margin: 0 }}><caption className="p-3 text-left font-semibold">{l.tableLabel}</caption><thead><tr>{[l.countColumn,l.estimateColumn,l.probabilityColumn,...(c.varianceEstimates?[c.varianceEstimateLabel!]:[])].map(t=><th key={t} className="border-b border-ink-200 p-3 font-semibold">{t}</th>)}</tr></thead><tbody>{c.weights.map((w,k)=><tr key={k} className={k===count?'bg-brand-50':''} style={k===count?{backgroundColor:'var(--color-brand-50)'}:undefined} data-row-count={k}><th scope="row" className="border-b border-ink-100 p-3 font-mono font-normal">{k}</th><td className="border-b border-ink-100 p-3 font-mono">{rationalText(rational(BigInt(k),BigInt(c.n)))}</td><td className="border-b border-ink-100 p-3 font-mono">{rationalText(rational(BigInt(w),BigInt(c.denominator)))}</td>{c.varianceEstimates&&<td className="border-b border-ink-100 p-3 font-mono">{rationalText(validateRationalInput(c.varianceEstimates[k]))}</td>}</tr>)}</tbody></table></div>
    {c.varianceEstimateNote&&<p className="mt-3 text-xs leading-relaxed text-ink-600">{c.varianceEstimateNote}</p>}
  </section>;
}
