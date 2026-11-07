import { useId, useState } from 'react';
import { cx } from '@/components/react/cx';

interface ResponseChordProfileBase {
  id: string;
  label: string;
  caption: string;
  inputUnit: string;
  responseUnit: string;
  /** Integer endpoints in the declared domain, from minus twenty through twenty. */
  lower: number;
  upper: number;
  /** Probability of the upper endpoint, in quarters. Zero and four are allowed. */
  upperWeightQuarters: number;
  /** Positive integer multiplier; the response is offset + scale times the family. */
  scale: number;
  offset: number;
}
export type ResponseChordProfile = ResponseChordProfileBase & (
  | { family: 'square' | 'affine' | 'sqrt'; hingeThresholdQuarters?: never }
  | { family: 'hinge'; hingeThresholdQuarters: number }
);
export interface ResponseChordLabels {
  profileLabel: string;
  inputAxisLabel: string;
  responseAxisLabel: string;
  curveLabel: string;
  chordLabel: string;
  meanInputLabel: string;
  atMeanLabel: string;
  meanResponseLabel: string;
  gapLabel: string;
  tableCaption: string;
  endpointLabel: string;
  lowerLabel: string;
  upperLabel: string;
  inputLabel: string;
  weightLabel: string;
  responseLabel: string;
  fixedScaleNote: string;
  /** Each of {meanInput}, {responseAtMean}, {meanResponse}, {gap} occurs once. Amounts include units. */
  resultTemplate: string;
}
export interface ResponseChordDiagramProps {
  title: string;
  instructions: string;
  locale: 'en' | 'es';
  profiles: ResponseChordProfile[];
  labels: ResponseChordLabels;
  className?: string;
}
export interface ResponseChordFraction { numerator: number; denominator: number }
const labelKeys: (keyof ResponseChordLabels)[] = ['profileLabel', 'inputAxisLabel', 'responseAxisLabel', 'curveLabel', 'chordLabel', 'meanInputLabel', 'atMeanLabel', 'meanResponseLabel', 'gapLabel', 'tableCaption', 'endpointLabel', 'lowerLabel', 'upperLabel', 'inputLabel', 'weightLabel', 'responseLabel', 'fixedScaleNote', 'resultTemplate'];
const resultTokens = ['meanInput', 'responseAtMean', 'meanResponse', 'gap'] as const;
const own = (value: unknown, key: string): value is Record<string, unknown> => typeof value === 'object' && value !== null && Object.hasOwn(value, key);
function text(value: unknown, key: string): string {
  if (!own(value, key) || typeof value[key] !== 'string' || !value[key].trim() || value[key] !== value[key].trim()) throw new Error(`ResponseChordDiagram: ${key} must be an own, nonempty, trimmed string.`);
  return value[key];
}
function integer(value: unknown, low: number, high: number, name: string): asserts value is number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < low || value > high) throw new Error(`ResponseChordDiagram: invalid ${name}.`);
}
function fraction(numerator: number, denominator = 1): ResponseChordFraction {
  if (!Number.isSafeInteger(numerator) || !Number.isSafeInteger(denominator) || denominator === 0) throw new Error('ResponseChordDiagram: unsafe rational arithmetic.');
  if (denominator < 0) { numerator = -numerator; denominator = -denominator; }
  let a = Math.abs(numerator), b = denominator;
  while (b) { const remainder = a % b; a = b; b = remainder; }
  return { numerator: numerator === 0 ? 0 : numerator / a, denominator: denominator / a };
}
const add = (a: ResponseChordFraction, b: ResponseChordFraction) => fraction(a.numerator * b.denominator + b.numerator * a.denominator, a.denominator * b.denominator);
const multiply = (a: ResponseChordFraction, b: ResponseChordFraction) => fraction(a.numerator * b.numerator, a.denominator * b.denominator);
const subtract = (a: ResponseChordFraction, b: ResponseChordFraction) => add(a, fraction(-b.numerator, b.denominator));
const compare = (a: ResponseChordFraction, b: ResponseChordFraction) => a.numerator * b.denominator - b.numerator * a.denominator;
const number = (a: ResponseChordFraction) => a.numerator / a.denominator;
function exactRoot(a: ResponseChordFraction): ResponseChordFraction {
  if (a.numerator < 0) throw new Error('ResponseChordDiagram: sqrt needs a nonnegative domain.');
  const n = Math.floor(Math.sqrt(a.numerator)), d = Math.floor(Math.sqrt(a.denominator));
  if (n * n !== a.numerator || d * d !== a.denominator) throw new Error('ResponseChordDiagram: annotated sqrt values must be rational.');
  return fraction(n, d);
}
function response(profile: ResponseChordProfile, input: ResponseChordFraction): ResponseChordFraction {
  let value: ResponseChordFraction;
  if (profile.family === 'square') value = multiply(input, input);
  else if (profile.family === 'affine') value = input;
  else if (profile.family === 'sqrt') value = exactRoot(input);
  else if (profile.family === 'hinge') { const excess = subtract(input, fraction(profile.hingeThresholdQuarters, 4)); value = excess.numerator > 0 ? excess : fraction(0); }
  else throw new Error('ResponseChordDiagram: unknown family.');
  return add(fraction(profile.offset), multiply(fraction(profile.scale), value));
}
/** Exact annotations. Drawn curve samples never decide equality or a model property. */
export function calculateResponseChordProfile(profile: ResponseChordProfile) {
  for (const key of ['id', 'label', 'caption', 'inputUnit', 'responseUnit', 'family']) text(profile, key);
  if (!['square', 'affine', 'hinge', 'sqrt'].includes(profile.family)) throw new Error('ResponseChordDiagram: unknown family.');
  for (const [key, low, high] of [['lower', -20, 20], ['upper', -20, 20], ['upperWeightQuarters', 0, 4], ['scale', 1, 20], ['offset', -100, 100]] as const) {
    if (!own(profile, key)) throw new Error(`ResponseChordDiagram: missing ${key}.`);
    integer(profile[key], low, high, key);
  }
  if (profile.lower >= profile.upper) throw new Error('ResponseChordDiagram: endpoints must be distinct and increasing.');
  if (profile.family === 'hinge') {
    if (!own(profile, 'hingeThresholdQuarters')) throw new Error('ResponseChordDiagram: hinge needs its threshold.');
    integer(profile.hingeThresholdQuarters, 0, 80, 'hinge threshold');
  } else if (own(profile, 'hingeThresholdQuarters')) throw new Error('ResponseChordDiagram: threshold belongs only to hinge.');
  if (profile.family === 'sqrt' && profile.lower < 0) throw new Error('ResponseChordDiagram: sqrt needs nonnegative endpoints.');
  const lowerInput = fraction(profile.lower), upperInput = fraction(profile.upper);
  const upperWeight = fraction(profile.upperWeightQuarters, 4), lowerWeight = fraction(4 - profile.upperWeightQuarters, 4);
  const meanInput = add(multiply(lowerWeight, lowerInput), multiply(upperWeight, upperInput));
  const lowerResponse = response(profile, lowerInput), upperResponse = response(profile, upperInput), responseAtMean = response(profile, meanInput);
  const meanResponse = add(multiply(lowerWeight, lowerResponse), multiply(upperWeight, upperResponse));
  const gap = subtract(meanResponse, responseAtMean);
  // Denominators of annotations are at most sixteen; conservatively |gap numerator| <= 259200.
  const responseMin = profile.family === 'square' && profile.lower <= 0 && profile.upper >= 0 ? fraction(profile.offset) : compare(lowerResponse, upperResponse) <= 0 ? lowerResponse : upperResponse;
  const responseMax = compare(lowerResponse, upperResponse) >= 0 ? lowerResponse : upperResponse;
  const padding = Math.max(1, Math.ceil((number(responseMax) - number(responseMin)) / 10));
  const axisMin = subtract(responseMin, fraction(padding)), axisMax = add(responseMax, fraction(padding));
  return { lowerInput, upperInput, lowerWeight, upperWeight, meanInput, lowerResponse, upperResponse, responseAtMean, meanResponse, gap, responseMin, responseMax, axisMin, axisMax };
}
/** Validate all hidden profiles and localized strings before the first hook. */
export function auditResponseChordDiagram(props: ResponseChordDiagramProps) {
  text(props, 'title'); text(props, 'instructions');
  if (!own(props, 'locale') || (props.locale !== 'en' && props.locale !== 'es')) throw new Error('ResponseChordDiagram: locale must be en or es.');
  if (!own(props, 'profiles') || !Array.isArray(props.profiles) || props.profiles.length < 1 || props.profiles.length > 6) throw new Error('ResponseChordDiagram: supply one through six profiles.');
  const ids = new Set<string>(), labels = new Set<string>(), audits = [];
  for (let i = 0; i < props.profiles.length; i++) {
    if (!Object.hasOwn(props.profiles, i)) throw new Error('ResponseChordDiagram: profiles must be dense.');
    const p = props.profiles[i]!, audit = calculateResponseChordProfile(p);
    if (ids.has(p.id) || labels.has(p.label)) throw new Error('ResponseChordDiagram: ids and labels must be unique.');
    ids.add(p.id); labels.add(p.label); audits.push(audit);
  }
  if (!own(props, 'labels')) throw new Error('ResponseChordDiagram: labels are required.');
  for (const key of labelKeys) text(props.labels, key);
  let template = props.labels.resultTemplate;
  for (const token of resultTokens) { const marker = `{${token}}`; if (template.split(marker).length !== 2) throw new Error(`ResponseChordDiagram: resultTemplate needs ${marker} once.`); template = template.replace(marker, ''); }
  if (/[{}]/.test(template)) throw new Error('ResponseChordDiagram: unknown result token.');
  return audits;
}
export function ResponseChordDiagram(props: ResponseChordDiagramProps) {
  const audits = auditResponseChordDiagram(props);
  const id = useId(), [profileIndex, setProfileIndex] = useState(0);
  const index = Math.min(profileIndex, props.profiles.length - 1), profile = props.profiles[index]!, audit = audits[index]!, { labels } = props;
  const locale = props.locale === 'es' ? 'es-ES' : 'en-US';
  const format = (v: ResponseChordFraction) => (v.numerator === 0 ? 0 : number(v)).toLocaleString(locale, { maximumFractionDigits: 4 });
  const input = (v: ResponseChordFraction) => `${format(v)} ${profile.inputUnit}`;
  const amount = (v: ResponseChordFraction) => `${format(v)} ${profile.responseUnit}`;
  const weight = (v: ResponseChordFraction) => v.denominator === 1 ? format(v) : `${v.numerator}/${v.denominator}`;
  const values = { meanInput: input(audit.meanInput), responseAtMean: amount(audit.responseAtMean), meanResponse: amount(audit.meanResponse), gap: amount(audit.gap) };
  const result = resultTokens.reduce((s, token) => s.replace(`{${token}}`, values[token]), labels.resultTemplate);
  const width = 800, height = 320, left = 76, right = 26, top = 24, bottom = 260;
  const x = (v: number) => left + (v - profile.lower) / (profile.upper - profile.lower) * (width - left - right);
  const y = (v: number) => bottom - (v - number(audit.axisMin)) / (number(audit.axisMax) - number(audit.axisMin)) * (bottom - top);
  const sample = (v: number) => profile.offset + profile.scale * (profile.family === 'square' ? v * v : profile.family === 'affine' ? v : profile.family === 'sqrt' ? Math.sqrt(v) : profile.family === 'hinge' ? Math.max(0, v - profile.hingeThresholdQuarters / 4) : 0);
  const curve = Array.from({ length: 129 }, (_, i) => { const value = profile.lower + (profile.upper - profile.lower) * i / 128; return `${i ? 'L' : 'M'}${x(value)},${y(sample(value))}`; }).join(' ');
  const xMean = x(number(audit.meanInput)), yMean = y(number(audit.meanResponse)), yAtMean = y(number(audit.responseAtMean));
  const region = 'mt-3 max-w-full overflow-x-auto rounded-card border border-ink-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700';
  return <figure className={cx('not-prose my-8 min-w-0', props.className)} aria-labelledby={`${id}-title`}>
    <figcaption id={`${id}-title`} className="font-display text-lg font-semibold text-ink-900">{props.title}</figcaption>
    <p className="mt-2 text-sm leading-relaxed text-ink-700">{props.instructions}</p>
    <label htmlFor={`${id}-profile`} className="mt-5 block text-sm font-semibold text-ink-800">{labels.profileLabel}</label>
    <select id={`${id}-profile`} className="mt-2 min-h-11 w-full max-w-full rounded-card border border-ink-300 bg-surface px-3 py-2 text-sm text-ink-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700" value={index} onChange={event => setProfileIndex(Number(event.currentTarget.value))}>
      {props.profiles.map((p, i) => <option key={p.id} value={i}>{p.label}</option>)}
    </select>
    <p className="mt-3 text-sm leading-relaxed text-ink-700">{profile.caption}</p>
    <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-ink-700">
      <span className="inline-flex items-center gap-2"><span className="h-0 w-5 border-t-2 border-brand-700" aria-hidden="true" />{labels.curveLabel}</span>
      <span className="inline-flex items-center gap-2"><span className="h-0 w-5 border-t-2 border-dashed border-ink-700" aria-hidden="true" />{labels.chordLabel}</span>
      <span className="inline-flex items-center gap-2"><span className="h-0 w-5 border-t border-dotted border-ink-500" aria-hidden="true" />{labels.meanInputLabel}</span>
      <span className="inline-flex items-center gap-2"><span className="h-0 w-5 border-t-2 border-accent-600" aria-hidden="true" />{labels.gapLabel}</span>
      <span className="inline-flex items-center gap-2"><span className="h-3 w-3 rounded-full border-2 border-brand-700" aria-hidden="true" />{labels.atMeanLabel}</span>
      <span className="inline-flex items-center gap-2"><span className="h-3 w-3 border-2 border-ink-900" aria-hidden="true" />{labels.meanResponseLabel}</span>
    </div>
    <div className={region} role="region" tabIndex={0} aria-label={labels.curveLabel}>
      <svg viewBox={`0 0 ${width} ${height}`} className="block w-full min-w-[38rem]" aria-hidden="true" data-response-min={number(audit.axisMin)} data-response-max={number(audit.axisMax)} data-input-min={profile.lower} data-input-max={profile.upper}>
        <line x1={left} x2={width - right} y1={bottom} y2={bottom} className="stroke-ink-300" />
        <line x1={left} x2={left} y1={top} y2={bottom} className="stroke-ink-300" />
        <text x={left - 8} y={top + 4} textAnchor="end" fontSize="12" className="fill-ink-700">{format(audit.axisMax)}</text>
        <text x={left - 8} y={bottom + 4} textAnchor="end" fontSize="12" className="fill-ink-700">{format(audit.axisMin)}</text>
        <text x={left} y={bottom + 21} textAnchor="middle" fontSize="12" className="fill-ink-700">{format(audit.lowerInput)}</text>
        <text x={width - right} y={bottom + 21} textAnchor="middle" fontSize="12" className="fill-ink-700">{format(audit.upperInput)}</text>
        <path d={curve} fill="none" className="stroke-brand-700" strokeWidth="3" data-response-curve="true" />
        <line x1={x(profile.lower)} x2={x(profile.upper)} y1={y(number(audit.lowerResponse))} y2={y(number(audit.upperResponse))} className="stroke-ink-700" strokeWidth="2" strokeDasharray="7 5" data-response-chord="true" />
        <line x1={xMean} x2={xMean} y1={top} y2={bottom} className="stroke-ink-500" strokeDasharray="3 4" data-mean-input={number(audit.meanInput)} />
        <line x1={xMean} x2={xMean} y1={yMean} y2={yAtMean} className="stroke-accent-600" strokeWidth="3" data-response-gap={number(audit.gap)} />
        <circle cx={xMean} cy={yAtMean} r="7" className="fill-surface stroke-brand-700" strokeWidth="3" data-response-at-mean={number(audit.responseAtMean)} />
        <rect x={xMean - 4} y={yMean - 4} width="8" height="8" className="fill-ink-900 stroke-surface" strokeWidth="1" data-mean-response={number(audit.meanResponse)} />
      </svg>
    </div>
    <p className="mt-2 text-xs leading-relaxed text-ink-600">{labels.inputAxisLabel}: {profile.inputUnit}. {labels.responseAxisLabel}: {profile.responseUnit}. {labels.fixedScaleNote}</p>
    <div className={region} role="region" tabIndex={0} aria-label={labels.tableCaption}>
      <table className="w-full min-w-[34rem] border-collapse text-left text-sm" style={{ display: 'table', margin: 0, overflow: 'visible' }}>
        <caption className="px-3 py-3 text-left text-sm text-ink-700">{labels.tableCaption}</caption>
        <thead><tr className="bg-surface-sunken">{[labels.endpointLabel, `${labels.inputLabel} (${profile.inputUnit})`, labels.weightLabel, `${labels.responseLabel} (${profile.responseUnit})`].map(label => <th key={label} scope="col" className="border-b border-ink-300 px-3 py-3 font-semibold text-ink-800">{label}</th>)}</tr></thead>
        <tbody>{[[labels.lowerLabel, audit.lowerInput, audit.lowerWeight, audit.lowerResponse], [labels.upperLabel, audit.upperInput, audit.upperWeight, audit.upperResponse]].map(([label, value, probability, payoff], i) => <tr key={i} className="border-b border-ink-200 last:border-b-0"><th scope="row" className="px-3 py-3 font-semibold text-ink-800">{label as string}</th>{[format(value as ResponseChordFraction), weight(probability as ResponseChordFraction), format(payoff as ResponseChordFraction)].map((v, j) => <td key={j} className="whitespace-nowrap px-3 py-3 font-mono tabular-nums text-ink-800">{v}</td>)}</tr>)}</tbody>
      </table>
    </div>
    <p className="mt-4 text-sm font-semibold leading-relaxed text-ink-900" role="status" aria-live="polite" aria-atomic="true">{result}</p>
  </figure>;
}
