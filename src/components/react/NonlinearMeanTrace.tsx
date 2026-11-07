import { useId, useState } from 'react';
import { cx } from '@/components/react/cx';

/** Closed response catalogue on the common input domain [0,6]. */
export type NonlinearResponse = 'square' | 'affine' | 'concave-square' | 'hinge-2' | 'hinge-3' | 'hinge-4' | 'capped-square';
export interface NonlinearMeanPoint { value: number; weight: number }
export interface NonlinearMeanCase {
  id: string;
  label: string;
  response: NonlinearResponse;
  points: NonlinearMeanPoint[];
  inputUnit: string;
  responseUnit: string;
}
export interface NonlinearMeanLabels {
  case: string;
  view: string;
  both: string;
  transformFirst: string;
  averageFirst: string;
  reset: string;
  chart: string;
  chartDescription: string;
  inputAxis: string;
  responseAxis: string;
  rule: string;
  domain: string;
  table: string;
  input: string;
  weight: string;
  share: string;
  response: string;
  weightedResponse: string;
  totalWeight: string;
  meanInput: string;
  responseAtMean: string;
  meanResponse: string;
  gap: string;
  equal: string;
  positiveSupport: string;
  curveLegend: string;
  responseAtMeanLegend: string;
  meanResponseLegend: string;
}
export interface NonlinearMeanTraceProps {
  title: string;
  instructions: string;
  cases: NonlinearMeanCase[];
  labels: NonlinearMeanLabels;
  locale?: 'en' | 'es';
  className?: string;
}
export interface NonlinearMeanRatio { numerator: number; denominator: number }
export interface NonlinearMeanMeasures {
  totalWeight: number;
  weightedInput: number;
  weightedOutput: number;
  meanInput: NonlinearMeanRatio;
  responseAtMean: NonlinearMeanRatio;
  meanResponse: NonlinearMeanRatio;
  gap: NonlinearMeanRatio;
}

const labelKeys: (keyof NonlinearMeanLabels)[] = [
  'case', 'view', 'both', 'transformFirst', 'averageFirst', 'reset', 'chart',
  'chartDescription', 'inputAxis', 'responseAxis', 'rule', 'domain', 'table',
  'input', 'weight', 'share', 'response', 'weightedResponse', 'totalWeight',
  'meanInput', 'responseAtMean', 'meanResponse', 'gap', 'equal', 'positiveSupport',
  'curveLegend', 'responseAtMeanLegend', 'meanResponseLegend',
];
const responses: NonlinearResponse[] = ['square', 'affine', 'concave-square', 'hinge-2', 'hinge-3', 'hinge-4', 'capped-square'];
const formula: Record<NonlinearResponse, string> = {
  square: 'f(x) = x²', affine: 'f(x) = 3 + 2x', 'concave-square': 'f(x) = 36 − x²',
  'hinge-2': 'f(x) = max(0, x − 2)', 'hinge-3': 'f(x) = max(0, x − 3)',
  'hinge-4': 'f(x) = max(0, x − 4)', 'capped-square': 'f(x) = min(x², 9)',
};
function fail(message: string): never { throw new Error('NonlinearMeanTrace: ' + message); }
function named(value: unknown, name: string): asserts value is string {
  if (typeof value !== 'string' || !value.trim()) fail(name + ' must be nonempty.');
}
function dense(value: unknown, name: string): asserts value is unknown[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 6) fail(name + ' must contain one to six entries.');
  for (let i = 0; i < value.length; i++) if (!Object.hasOwn(value, i)) fail(name + ' cannot contain holes.');
}
function integer(value: unknown, max: number, name: string): asserts value is number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0 || value > max) fail(name + ' must be an integer from zero to ' + max + '.');
}
function checkResponse(response: unknown): asserts response is NonlinearResponse {
  if (typeof response !== 'string' || !responses.includes(response as NonlinearResponse)) fail('Unknown response identifier.');
}
function validatePoints(points: NonlinearMeanPoint[]) {
  dense(points, 'points');
  let sum = 0;
  for (const point of points) {
    if (!point || typeof point !== 'object') fail('Each point must be an object.');
    integer(point.value, 6, 'point.value'); integer(point.weight, 8, 'point.weight'); sum += point.weight;
  }
  if (sum === 0) fail('The total weight must be positive.');
}
/** For plotting supplied formula values; never determines an arithmetic sign or tie. */
function responseAt(response: NonlinearResponse, x: number): number {
  if (response === 'square') return x * x;
  if (response === 'affine') return 3 + 2 * x;
  if (response === 'concave-square') return 36 - x * x;
  if (response === 'capped-square') return Math.min(x * x, 9);
  return Math.max(0, x - Number(response.at(-1)));
}
/** @internal Exact bounded-integer calculation, exported from this module for focused oracle tests only. */
export function computeNonlinearMeans(points: NonlinearMeanPoint[], response: NonlinearResponse): NonlinearMeanMeasures {
  validatePoints(points); checkResponse(response);
  const totalWeight = points.reduce((sum, p) => sum + p.weight, 0);
  const weightedInput = points.reduce((sum, p) => sum + p.weight * p.value, 0);
  const weightedOutput = points.reduce((sum, p) => sum + p.weight * responseAt(response, p.value), 0);
  const w = totalWeight, s = weightedInput, d = w * w;
  let atMeanNumerator: number;
  if (response === 'square') atMeanNumerator = s * s;
  else if (response === 'affine') atMeanNumerator = (3 * w + 2 * s) * w;
  else if (response === 'concave-square') atMeanNumerator = 36 * d - s * s;
  else if (response === 'capped-square') atMeanNumerator = Math.min(s * s, 9 * d);
  else atMeanNumerator = Math.max(0, s - Number(response.at(-1)) * w) * w;
  const difference = weightedOutput * w - atMeanNumerator;
  return {
    totalWeight, weightedInput: s === 0 ? 0 : s, weightedOutput: weightedOutput === 0 ? 0 : weightedOutput,
    meanInput: { numerator: s === 0 ? 0 : s, denominator: w },
    responseAtMean: { numerator: atMeanNumerator === 0 ? 0 : atMeanNumerator, denominator: d },
    meanResponse: { numerator: weightedOutput === 0 ? 0 : weightedOutput, denominator: w },
    gap: { numerator: difference === 0 ? 0 : difference, denominator: d },
  };
}
function prepare(props: NonlinearMeanTraceProps) {
  named(props?.title, 'title'); named(props.instructions, 'instructions');
  if (props.className !== undefined && typeof props.className !== 'string') fail('className must be a string when supplied.');
  if (props.locale !== undefined && props.locale !== 'en' && props.locale !== 'es') fail('locale must be en or es.');
  for (const key of labelKeys) named(props.labels?.[key], 'labels.' + key);
  dense(props.cases, 'cases');
  const ids = new Set<string>(), names = new Set<string>();
  return props.cases.map((item) => {
    if (!item || typeof item !== 'object') fail('Each case must be an object.');
    if (typeof item.id !== 'string' || !/^[A-Za-z0-9_-]{1,16}$/.test(item.id)) fail('Each case needs a one-to-sixteen-character ASCII ID.');
    named(item.label, 'case.label'); named(item.inputUnit, 'case.inputUnit'); named(item.responseUnit, 'case.responseUnit');
    if (ids.has(item.id) || names.has(item.label)) fail('Case IDs and labels must be unique.');
    ids.add(item.id); names.add(item.label);
    const measures = computeNonlinearMeans(item.points, item.response);
    return { ...item, points: item.points.map(p => ({ value: p.value === 0 ? 0 : p.value, weight: p.weight === 0 ? 0 : p.weight })), measures };
  });
}
function gcd(a: number, b: number): number { while (b) [a, b] = [b, a % b]; return a; }
type View = 'both' | 'transform-first' | 'average-first';

export function NonlinearMeanTrace(props: NonlinearMeanTraceProps) {
  const prepared = prepare(props); // Validate every hidden case before hooks.
  const { title, instructions, labels: l, locale = 'en', className } = props;
  const id = useId();
  const [caseIndex, setCaseIndex] = useState(0);
  const [view, setView] = useState<View>('both');
  const index = Math.min(caseIndex, prepared.length - 1), current = prepared[index]!, m = current.measures;
  const exactFormat = new Intl.NumberFormat(locale === 'es' ? 'es-ES' : 'en-US', { maximumFractionDigits: 2 });
  const approximation = new Intl.NumberFormat(locale === 'es' ? 'es-ES' : 'en-US', { maximumSignificantDigits: 3 });
  const num = (n: number) => exactFormat.format(n === 0 ? 0 : n);
  const ratio = ({ numerator: n, denominator: d }: NonlinearMeanRatio) => {
    const divisor = gcd(Math.abs(n), d), a = n / divisor, b = d / divisor;
    return b === 1 ? num(a) : a + '/' + b + ((n * 100) % d === 0 ? ' = ' + num(n / d) : ' ≈ ' + approximation.format(n / d));
  };
  const yMax = current.response === 'affine' ? 15 : current.response.startsWith('hinge-') ? 6 : current.response === 'capped-square' ? 9 : 36;
  const x = (n: number) => 72 + n * 88, y = (n: number) => 280 - n * 240 / yMax;
  const mean = m.meanInput.numerator / m.meanInput.denominator, atMean = m.responseAtMean.numerator / m.responseAtMean.denominator, meanResponse = m.meanResponse.numerator / m.meanResponse.denominator;
  const curve = Array.from({ length: 121 }, (_, i) => x(i / 20) + ',' + y(responseAt(current.response, i / 20))).join(' ');
  const support = [...new Set(current.points.filter(p => p.weight > 0).map(p => p.value))].sort((a, b) => a - b);
  const showTransformed = view !== 'average-first', showAtMean = view !== 'transform-first';
  const control = 'min-h-11 w-full rounded-card border border-ink-300 bg-surface px-3 py-2 text-sm text-ink-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600';
  const viewName = view === 'both' ? l.both : view === 'transform-first' ? l.transformFirst : l.averageFirst;
  const metrics = [
    { key: 'mean-input', label: l.meanInput, unit: current.inputUnit, value: m.meanInput },
    { key: 'response-at-mean', label: l.responseAtMean, unit: current.responseUnit, value: m.responseAtMean },
    { key: 'mean-response', label: l.meanResponse, unit: current.responseUnit, value: m.meanResponse },
    { key: 'gap', label: l.gap, unit: current.responseUnit, value: m.gap },
  ];
  return <figure className={cx('not-prose my-8 min-w-0 max-w-full', className)} aria-labelledby={id + '-title'}>
    <figcaption id={id + '-title'} className="font-display text-lg font-semibold text-ink-900">{title}</figcaption>
    <p className="mt-2 text-sm text-ink-700">{instructions}</p>
    <div className="mt-4 grid min-w-0 gap-4 sm:grid-cols-2">
      {prepared.length > 1 ? <label className="min-w-0 text-sm font-semibold text-ink-800">{l.case}<select className={cx(control, 'mt-1')} value={index} onChange={e => { setCaseIndex(Number(e.currentTarget.value)); setView('both'); }}>{prepared.map((c, i) => <option key={c.id} value={i}>{c.label}</option>)}</select></label> : <p className="text-sm font-semibold text-ink-800">{current.label}</p>}
      <label className="min-w-0 text-sm font-semibold text-ink-800">{l.view}<select className={cx(control, 'mt-1')} value={view} onChange={e => setView(e.currentTarget.value as View)}><option value="both">{l.both}</option><option value="transform-first">{l.transformFirst}</option><option value="average-first">{l.averageFirst}</option></select></label>
    </div>
    <button type="button" className="brutal-btn mt-4 min-h-11 px-4 py-2 text-sm disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600" onClick={() => { setCaseIndex(0); setView('both'); }} disabled={index === 0 && view === 'both'}>{l.reset}</button>
    <p className="mt-3 text-sm text-ink-800"><span className="font-semibold">{l.rule}: </span>{formula[current.response]}; {l.domain}: 0 ≤ x ≤ 6</p>
    <p className="mt-2 text-sm text-ink-800" aria-live="polite" aria-atomic="true" data-nonlinear-result="" data-case={current.id} data-view={view} data-weight={m.totalWeight} data-weighted-input={m.weightedInput} data-weighted-output={m.weightedOutput}>{current.label}; {viewName}; {l.responseAtMean}: {ratio(m.responseAtMean)}; {l.meanResponse}: {ratio(m.meanResponse)}; {l.gap}: {ratio(m.gap)}</p>
    <div className="mt-5 max-w-full overflow-x-auto focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-600" tabIndex={0} role="region" aria-label={l.chart}>
      <svg viewBox="0 0 640 350" width="640" className="mx-auto block w-[40rem] max-w-none" role="img" aria-labelledby={id + '-chart-title ' + id + '-chart-desc'} data-nonlinear-y-max={yMax}>
        <title id={id + '-chart-title'}>{l.chart}</title><desc id={id + '-chart-desc'}>{l.chartDescription}</desc>
        <path d="M72 40 V280 H608" fill="none" stroke="var(--color-ink-500)" strokeWidth="2" />
        {[0, 1, 2, 3, 4, 5, 6].map(t => <text key={t} x={x(t)} y="303" fontSize="14" textAnchor="middle" fill="var(--color-ink-800)">{t}</text>)}
        {[0, 1, 2, 3].map(t => <text key={t} x="64" y={y(yMax * t / 3) + 5} fontSize="14" textAnchor="end" fill="var(--color-ink-800)">{num(yMax * t / 3)}</text>)}
        <text x="336" y="331" fontSize="15" textAnchor="middle" fill="var(--color-ink-900)">{l.inputAxis} ({current.inputUnit})</text>
        <text x="72" y="22" fontSize="15" fill="var(--color-ink-900)">{l.responseAxis} ({current.responseUnit})</text>
        <polyline points={curve} fill="none" stroke="var(--color-ink-800)" strokeWidth="3" data-nonlinear-curve="" />
        {showTransformed && support.length === 2 ? <line x1={x(support[0]!)} y1={y(responseAt(current.response, support[0]!))} x2={x(support[1]!)} y2={y(responseAt(current.response, support[1]!))} stroke="var(--color-ink-500)" strokeWidth="2" strokeDasharray="5 4" data-nonlinear-chord="" /> : null}
        {showTransformed ? support.map(value => <circle key={value} cx={x(value)} cy={y(responseAt(current.response, value))} r="4" fill="var(--color-ink-700)" data-nonlinear-support={value} />) : null}
        <line x1={x(mean)} x2={x(mean)} y1="40" y2="280" stroke="var(--color-ink-500)" strokeDasharray="3 4" data-nonlinear-mean-guide="" />
        {view === 'both' && m.gap.numerator !== 0 ? <line x1={x(mean)} x2={x(mean)} y1={y(atMean)} y2={y(meanResponse)} stroke="var(--color-accent-600)" strokeWidth="4" data-nonlinear-gap="" /> : null}
        {showTransformed ? <path d={'M ' + x(mean) + ' ' + (y(meanResponse) - 7) + ' l 7 7 l -7 7 l -7 -7 Z'} fill="var(--color-accent-600)" data-nonlinear-aggregate-x={x(mean)} data-nonlinear-aggregate-y={y(meanResponse)} /> : null}
        {showAtMean ? <circle cx={x(mean)} cy={y(atMean)} r={m.gap.numerator === 0 && view === 'both' ? 10 : 6} fill="var(--color-surface)" fillOpacity={m.gap.numerator === 0 && view === 'both' ? 0 : 1} stroke="var(--color-brand-700)" strokeWidth="3" data-nonlinear-at-mean="" /> : null}
      </svg>
    </div>
    <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-ink-800" role="list"><li>{l.curveLegend}</li><li>○ {l.responseAtMeanLegend}</li><li>◆ {l.meanResponseLegend}</li></ul>
    {m.gap.numerator === 0 ? <p className="mt-2 text-sm text-ink-800">{l.equal}</p> : null}
    <dl className="mt-5 grid min-w-0 gap-x-6 gap-y-4 sm:grid-cols-2">{metrics.map(item => <div key={item.key}><dt className="text-sm text-ink-700">{item.label} ({item.unit})</dt><dd className="mt-1 break-words font-mono font-semibold text-ink-900" data-nonlinear-metric={item.key} data-numerator={item.value.numerator} data-denominator={item.value.denominator}>{ratio(item.value)}</dd></div>)}</dl>
    <p className="mt-4 text-sm text-ink-700">{l.totalWeight}: <span className="font-mono">{m.totalWeight}</span>. {l.positiveSupport}</p>
    <div className="mt-4 max-w-full overflow-x-auto focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-600" tabIndex={0} role="region" aria-label={l.table}>
      <table className="w-full text-left text-sm text-ink-800" style={{ display: 'table', overflow: 'visible', margin: 0, minWidth: '40rem' }}>
        <caption className="mb-3 text-left text-sm font-semibold">{l.table}</caption><thead><tr>{[l.input + ' (' + current.inputUnit + ')', l.weight, l.share, l.response + ' (' + current.responseUnit + ')', l.weightedResponse + ' (' + current.responseUnit + ')'].map((label, i) => <th key={i} scope="col" className="p-3 align-bottom">{label}</th>)}</tr></thead>
        <tbody>{current.points.map((p, i) => <tr key={i} data-nonlinear-row={i}><th scope="row" className="p-3 font-mono">{num(p.value)}</th><td className="p-3 font-mono">{num(p.weight)}</td><td className="p-3 font-mono">{ratio({ numerator: p.weight, denominator: m.totalWeight })}</td><td className="p-3 font-mono">{num(responseAt(current.response, p.value))}</td><td className="p-3 font-mono">{ratio({ numerator: p.weight * responseAt(current.response, p.value), denominator: m.totalWeight })}</td></tr>)}</tbody>
      </table>
    </div>
  </figure>;
}
export default NonlinearMeanTrace;
