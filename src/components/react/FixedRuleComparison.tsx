import { useId, useState } from 'react';
import { cx } from '@/components/react/cx';

/** A declared rule. Parameters are supplied, never fitted by this island. */
export interface FixedRule {
  id: string;
  label: string;
  /** Integer from zero through sixty, in output units. */
  intercept: number;
  /** Integer from zero through twelve, in output units per input unit. */
  perUnit: number;
}
export interface FixedRuleRecord {
  id: string;
  label: string;
  /** Whole-number input in the declared zero-through-twelve domain. */
  input: number;
  /** Whole-number observed output from zero through two hundred forty. */
  observed: number;
}
export interface FixedRuleComparisonLabels {
  ruleLabel: string;
  recordLabel: string;
  inputAxisLabel: string;
  outputAxisLabel: string;
  predictionLabel: string;
  observedLabel: string;
  residualLabel: string;
  tableCaption: string;
  inputLabel: string;
  /** Each of {input}, {predicted}, {observed}, {residual} occurs once. Only input omits its unit. */
  resultTemplate: string;
  fixedScaleNote: string;
}
export interface FixedRuleComparisonProps {
  title: string;
  instructions: string;
  locale: 'en' | 'es';
  inputUnit: string;
  outputUnit: string;
  /** One or two dense, own records with unique ids and labels. */
  rules: FixedRule[];
  /** One through six dense, own records with unique ids and labels. */
  records: FixedRuleRecord[];
  labels: FixedRuleComparisonLabels;
  className?: string;
}
const labelKeys: (keyof FixedRuleComparisonLabels)[] = ['ruleLabel', 'recordLabel', 'inputAxisLabel', 'outputAxisLabel', 'predictionLabel', 'observedLabel', 'residualLabel', 'tableCaption', 'inputLabel', 'resultTemplate', 'fixedScaleNote'];
const resultTokens = ['input', 'predicted', 'observed', 'residual'] as const;
const own = (value: unknown, key: string): value is Record<string, unknown> => typeof value === 'object' && value !== null && Object.hasOwn(value, key);
function stringField(value: unknown, key: string): string {
  if (!own(value, key) || typeof value[key] !== 'string' || !value[key].trim() || value[key] !== value[key].trim()) throw new Error(`FixedRuleComparison: ${key} must be an own, nonempty, trimmed string.`);
  return value[key];
}
function integerField(value: unknown, key: string, maximum: number): number {
  if (!own(value, key) || typeof value[key] !== 'number' || !Number.isInteger(value[key]) || value[key] < 0 || value[key] > maximum) throw new Error(`FixedRuleComparison: invalid ${key}.`);
  return value[key] === 0 ? 0 : value[key];
}
function auditRule(rule: FixedRule) {
  stringField(rule, 'id'); stringField(rule, 'label');
  return { intercept: integerField(rule, 'intercept', 60), perUnit: integerField(rule, 'perUnit', 12) };
}
function auditRecord(record: FixedRuleRecord) {
  stringField(record, 'id'); stringField(record, 'label');
  return { input: integerField(record, 'input', 12), observed: integerField(record, 'observed', 240) };
}
/** Exact integer account, with no scoring, fitting or causal inference. */
export function calculateFixedRuleRecord(rule: FixedRule, record: FixedRuleRecord) {
  const { intercept, perUnit } = auditRule(rule), { input, observed } = auditRecord(record);
  const predicted = intercept + perUnit * input, difference = observed - predicted;
  // Bounded integers: prediction <= 204; residual is between -204 and 240.
  return { input, observed, predicted: predicted === 0 ? 0 : predicted, residual: difference === 0 ? 0 : difference };
}
/** Validate every supplied rule, record and label before the component's first hook. */
export function auditFixedRuleComparison(props: FixedRuleComparisonProps) {
  for (const key of ['title', 'instructions', 'inputUnit', 'outputUnit']) stringField(props, key);
  if (!own(props, 'locale') || (props.locale !== 'en' && props.locale !== 'es')) throw new Error('FixedRuleComparison: locale must be en or es.');
  for (const [key, maximum] of [['rules', 2], ['records', 6]] as const) {
    if (!own(props, key) || !Array.isArray(props[key]) || props[key].length < 1 || props[key].length > maximum) throw new Error(`FixedRuleComparison: invalid ${key} collection.`);
    const ids = new Set<string>(), labels = new Set<string>();
    for (let i = 0; i < props[key].length; i++) {
      if (!Object.hasOwn(props[key], i)) throw new Error(`FixedRuleComparison: ${key} must be dense.`);
      const item = props[key][i]!;
      if (key === 'rules') auditRule(item as FixedRule); else auditRecord(item as FixedRuleRecord);
      if (ids.has(item.id) || labels.has(item.label)) throw new Error(`FixedRuleComparison: ${key} ids and labels must be unique.`);
      ids.add(item.id); labels.add(item.label);
    }
  }
  if (!own(props, 'labels')) throw new Error('FixedRuleComparison: labels are required.');
  for (const key of labelKeys) stringField(props.labels, key);
  let remainder = props.labels.resultTemplate;
  for (const token of resultTokens) {
    const marker = `{${token}}`;
    if (remainder.split(marker).length !== 2) throw new Error(`FixedRuleComparison: resultTemplate needs ${marker} once.`);
    remainder = remainder.replace(marker, '');
  }
  if (/[{}]/.test(remainder)) throw new Error('FixedRuleComparison: unknown result token.');
  const rows = props.rules.map(rule => props.records.map(record => calculateFixedRuleRecord(rule, record)));
  const maximum = Math.max(1, ...props.records.map(record => record.observed), ...props.rules.map(rule => rule.intercept + rule.perUnit * 12));
  return { rows, inputMin: 0, inputMax: 12, outputMin: 0, outputMax: Math.ceil(maximum / 10) * 10 + 10 };
}
export function FixedRuleComparison(props: FixedRuleComparisonProps) {
  const audit = auditFixedRuleComparison(props);
  const id = useId(), [ruleIndex, setRuleIndex] = useState(0), [recordIndex, setRecordIndex] = useState(0);
  const selectedRule = Math.min(ruleIndex, props.rules.length - 1), selectedRecord = Math.min(recordIndex, props.records.length - 1);
  const rule = props.rules[selectedRule]!, record = props.records[selectedRecord]!, row = audit.rows[selectedRule]![selectedRecord]!, { labels } = props;
  const numberLocale = props.locale === 'es' ? 'es-ES' : 'en-US';
  const plain = new Intl.NumberFormat(numberLocale, { maximumFractionDigits: 0 });
  const signed = new Intl.NumberFormat(numberLocale, { maximumFractionDigits: 0, signDisplay: 'exceptZero' });
  const format = (n: number) => plain.format(n === 0 ? 0 : n), residual = (n: number) => signed.format(n === 0 ? 0 : n);
  const amount = (n: number) => `${format(n)} ${props.outputUnit}`;
  const replacements = { input: format(row.input), predicted: amount(row.predicted), observed: amount(row.observed), residual: `${residual(row.residual)} ${props.outputUnit}` };
  const result = labels.resultTemplate.replace(/\{(input|predicted|observed|residual)\}/g, (_marker, token: keyof typeof replacements) => replacements[token]);
  const width = 800, height = 320, left = 76, right = 30, top = 26, bottom = 260;
  const x = (n: number) => left + n / 12 * (width - left - right), y = (n: number) => bottom - n / audit.outputMax * (bottom - top);
  const region = 'mt-4 max-w-full overflow-x-auto rounded-card border border-ink-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700';
  const select = 'mt-2 min-h-11 w-full min-w-0 max-w-full rounded-card border border-ink-300 bg-surface px-3 py-2 text-sm text-ink-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700';
  return <figure className={cx('not-prose my-8 min-w-0', props.className)} aria-labelledby={`${id}-title`} data-rule-id={rule.id} data-record-id={record.id}>
    <figcaption id={`${id}-title`} className="font-display text-lg font-semibold text-ink-900">{props.title}</figcaption>
    <p className="mt-2 text-sm leading-relaxed text-ink-700">{props.instructions}</p>
    <div className={cx('mt-5 grid min-w-0 gap-4', props.rules.length > 1 && 'sm:grid-cols-2')}>
      {props.rules.length > 1 ? <div className="min-w-0">
        <label htmlFor={`${id}-rule`} className="block text-sm font-semibold text-ink-800">{labels.ruleLabel}</label>
        <select id={`${id}-rule`} className={select} value={selectedRule} onChange={event => setRuleIndex(Number(event.currentTarget.value))}>
          {props.rules.map((item, i) => <option key={item.id} value={i}>{item.label}</option>)}
        </select>
      </div> : null}
      <div className="min-w-0">
        <label htmlFor={`${id}-record`} className="block text-sm font-semibold text-ink-800">{labels.recordLabel}</label>
        <select id={`${id}-record`} className={select} value={selectedRecord} onChange={event => setRecordIndex(Number(event.currentTarget.value))}>
          {props.records.map((item, i) => <option key={item.id} value={i}>{item.label}</option>)}
        </select>
      </div>
    </div>
    <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs leading-relaxed text-ink-700">
      <span className="inline-flex items-center gap-2"><span className="relative h-3 w-6 shrink-0" aria-hidden="true"><span className="absolute inset-x-0 top-1.5 border-t-2 border-brand-700" /><span className="absolute left-2 top-0.5 h-2 w-2 bg-ink-900" /></span>{labels.predictionLabel}: {rule.label}</span>
      <span className="inline-flex items-center gap-2"><span className="h-3 w-3 shrink-0 rounded-full border-2 border-brand-700" aria-hidden="true" />{labels.observedLabel}</span>
      <span className="inline-flex items-center gap-2"><span className="h-0 w-5 shrink-0 border-t-2 border-dashed border-ink-700" aria-hidden="true" />{labels.residualLabel}</span>
    </div>
    <div className={region} role="region" tabIndex={0} aria-label={`${labels.inputAxisLabel}; ${labels.outputAxisLabel}`}>
      <svg viewBox={`0 0 ${width} ${height}`} className="block w-full min-w-[38rem]" aria-hidden="true" data-fixed-rule-plot="true" data-input-min={audit.inputMin} data-input-max={audit.inputMax} data-output-min={audit.outputMin} data-output-max={audit.outputMax} data-selected-input={row.input}>
        {[0, audit.outputMax / 2, audit.outputMax].map(value => <g key={value}>
          <line x1={left} x2={width - right} y1={y(value)} y2={y(value)} className={value === 0 ? 'stroke-ink-300' : 'stroke-ink-200'} />
          <text x={left - 10} y={y(value) + 5} textAnchor="end" fontSize="15" className="fill-ink-700">{format(value)}</text>
        </g>)}
        <line x1={left} x2={left} y1={top} y2={bottom} className="stroke-ink-300" />
        {[0, 3, 6, 9, 12].map(value => <text key={value} x={x(value)} y={bottom + 24} textAnchor="middle" fontSize="15" className="fill-ink-700">{format(value)}</text>)}
        <line x1={x(0)} x2={x(12)} y1={y(rule.intercept)} y2={y(rule.intercept + rule.perUnit * 12)} className="stroke-brand-700" strokeWidth="3" data-fixed-rule-line="true" />
        {props.records.map(item => <circle key={item.id} cx={x(item.input)} cy={y(item.observed)} r="4" className="fill-ink-500" data-fixed-rule-record={item.id} data-observed-input={item.input} data-observed-value={item.observed} />)}
        <line x1={x(row.input)} x2={x(row.input)} y1={y(row.predicted)} y2={y(row.observed)} className="stroke-ink-700" strokeWidth="2" strokeDasharray="4 3" data-selected-residual={row.residual} />
        <circle cx={x(row.input)} cy={y(row.observed)} r="8" className="fill-surface stroke-brand-700" strokeWidth="3" data-selected-observed={row.observed} />
        <rect x={x(row.input) - 4} y={y(row.predicted) - 4} width="8" height="8" className="fill-ink-900 stroke-surface" strokeWidth="1" data-selected-prediction={row.predicted} />
      </svg>
    </div>
    <p className="mt-2 text-xs leading-relaxed text-ink-600">{labels.inputAxisLabel} ({props.inputUnit}). {labels.outputAxisLabel} ({props.outputUnit}). {labels.fixedScaleNote}</p>
    <div className={region} role="region" tabIndex={0} aria-label={labels.tableCaption}>
      <table className="w-full min-w-[40rem] border-collapse text-left text-sm" style={{ display: 'table', margin: 0, overflow: 'visible' }}>
        <caption className="px-3 py-3 text-left text-sm text-ink-700">{labels.tableCaption}</caption>
        <thead><tr className="bg-surface-sunken">{[labels.recordLabel, `${labels.inputLabel} (${props.inputUnit})`, `${labels.observedLabel} (${props.outputUnit})`, `${labels.predictionLabel} (${props.outputUnit})`, `${labels.residualLabel} (${props.outputUnit})`].map((label, column) => <th key={column} scope="col" className="border-b border-ink-300 px-3 py-3 font-semibold text-ink-800">{label}</th>)}</tr></thead>
        <tbody>{props.records.map((item, i) => { const data = audit.rows[selectedRule]![i]!, selected = i === selectedRecord; return <tr key={item.id} data-fixed-rule-row={item.id} data-selected-row={selected ? 'true' : 'false'} aria-current={selected ? 'true' : undefined} style={selected ? { backgroundColor: 'var(--color-brand-100)' } : undefined}>
          <th scope="row" className="px-3 py-3 font-semibold text-ink-800">{item.label}</th>
          {[format(data.input), format(data.observed), format(data.predicted), residual(data.residual)].map((value, column) => <td key={column} className="whitespace-nowrap px-3 py-3 font-mono tabular-nums text-ink-800" data-fixed-rule-column={column + 1}>{value}</td>)}
        </tr>; })}</tbody>
      </table>
    </div>
    <p className="mt-4 text-sm font-semibold leading-relaxed text-ink-900" role="status" aria-live="polite" aria-atomic="true">{result}</p>
  </figure>;
}
