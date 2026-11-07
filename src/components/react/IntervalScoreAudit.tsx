import { useId, useState } from 'react';
import { cx } from '@/components/react/cx';

export interface IntervalAuditRecord { id: string; label: string; value: number }
export interface IntervalAuditRule { id: string; label: string; intervals: [number, number][] }
export interface IntervalAuditScenario {
  id: string;
  label: string;
  nominalPercent: 50 | 80 | 90;
  records: IntervalAuditRecord[];
  rules: IntervalAuditRule[];
}
export interface IntervalScoreLabels {
  scenario: string; rule: string; record: string; bounds: string; outcome: string;
  width: string; outside: string; penalty: string; score: string; total: string;
  mean: string; hits: string; nominal: string; fixedScale: string;
  intervalLegend: string; outcomeLegend: string; tableCaption: string;
  lowest: string; allTied: string; reset: string; summaryTemplate: string;
}
export interface IntervalScoreAuditProps {
  title: string;
  instructions: string;
  locale: 'en' | 'es';
  /** A unit label in headings, never appended to a quantity to invent a plural. */
  unit: string;
  scenarios: IntervalAuditScenario[];
  labels: IntervalScoreLabels;
  className?: string;
}
const labelKeys = ['scenario', 'rule', 'record', 'bounds', 'outcome', 'width', 'outside', 'penalty', 'score', 'total', 'mean', 'hits', 'nominal', 'fixedScale', 'intervalLegend', 'outcomeLegend', 'tableCaption', 'lowest', 'allTied', 'reset', 'summaryTemplate'] as const;
const tokens = ['rule', 'total', 'mean', 'hits', 'count'] as const;
function own(v: unknown, key: string): v is Record<string, unknown> { return !!v && typeof v === 'object' && !Array.isArray(v) && Object.hasOwn(v, key); }
function text(v: unknown, key: string): string {
  if (!own(v, key) || typeof v[key] !== 'string' || !v[key].trim() || v[key] !== v[key].trim()) throw new Error(`IntervalScoreAudit: ${key} must be an own nonempty trimmed string.`);
  return v[key];
}
function dense(v: unknown, min: number, max: number): asserts v is unknown[] {
  if (!Array.isArray(v) || v.length < min || v.length > max) throw new Error('IntervalScoreAudit: invalid array length.');
  for (let i = 0; i < v.length; i++) if (!Object.hasOwn(v, i)) throw new Error('IntervalScoreAudit: arrays must be dense.');
}
function amount(v: unknown): asserts v is number {
  if (typeof v !== 'number' || !Number.isInteger(v) || v < 0 || v > 24) throw new Error('IntervalScoreAudit: values must be integers from zero through twenty-four.');
}
function unique(items: unknown[]): void {
  for (const key of ['id', 'label']) {
    const values = items.map(v => text(v, key));
    if (new Set(values).size !== values.length) throw new Error(`IntervalScoreAudit: duplicate ${key}.`);
  }
}
/** Check every authored scenario before hooks; all bounded products/sums are exact safe integers. */
export function auditIntervalScore(props: IntervalScoreAuditProps) {
  for (const key of ['title', 'instructions', 'unit']) text(props, key);
  if (!own(props, 'locale') || !['en', 'es'].includes(props.locale)) throw new Error('IntervalScoreAudit: locale must be en or es.');
  if (!own(props, 'labels')) throw new Error('IntervalScoreAudit: labels are required.');
  for (const key of labelKeys) text(props.labels, key);
  let template = props.labels.summaryTemplate;
  for (const key of tokens) {
    const token = `{${key}}`;
    if (template.split(token).length !== 2) throw new Error(`IntervalScoreAudit: summaryTemplate needs ${token} once.`);
    template = template.replace(token, '');
  }
  if (/[{}]/.test(template)) throw new Error('IntervalScoreAudit: unknown summary token.');
  if (!own(props, 'scenarios')) throw new Error('IntervalScoreAudit: scenarios required.');
  dense(props.scenarios, 1, 3); unique(props.scenarios);
  return props.scenarios.map(scenario => {
    if (!own(scenario, 'nominalPercent') || ![50, 80, 90].includes(scenario.nominalPercent)) throw new Error('IntervalScoreAudit: nominalPercent must be fifty, eighty or ninety.');
    if (!own(scenario, 'records') || !own(scenario, 'rules')) throw new Error('IntervalScoreAudit: records and rules required.');
    dense(scenario.records, 1, 12); unique(scenario.records);
    for (const record of scenario.records) { if (!own(record, 'value')) throw new Error('IntervalScoreAudit: outcome required.'); amount(record.value); }
    dense(scenario.rules, 2, 4); unique(scenario.rules);
    const factor = 200 / (100 - scenario.nominalPercent);
    const rules = scenario.rules.map(rule => {
      if (!own(rule, 'intervals')) throw new Error('IntervalScoreAudit: intervals required.');
      dense(rule.intervals, scenario.records.length, scenario.records.length);
      const rows = rule.intervals.map((bounds, index) => {
        dense(bounds, 2, 2); amount(bounds[0]); amount(bounds[1]);
        const [lower, upper] = bounds;
        if (lower > upper) throw new Error('IntervalScoreAudit: lower must not exceed upper.');
        const value = scenario.records[index]!.value;
        const width = upper - lower, outside = Math.max(lower - value, value - upper, 0);
        const penalty = factor * outside;
        return { lower, upper, value, width, outside, penalty, score: width + penalty, hit: outside === 0 };
      });
      return { rows, total: rows.reduce((sum, row) => sum + row.score, 0), hits: rows.filter(row => row.hit).length };
    });
    const minimum = Math.min(...rules.map(rule => rule.total));
    return { factor, rules, minima: rules.flatMap((rule, i) => rule.total === minimum ? [i] : []) };
  });
}
function gcd(a: number, b: number): number { return b ? gcd(b, a % b) : a; }

/** Fixed issued intervals and resolved observations; selectors inspect, never refit, the data. */
export function IntervalScoreAudit(props: IntervalScoreAuditProps) {
  const audit = auditIntervalScore(props);
  const id = useId();
  const [scenarioIndex, setScenarioIndex] = useState(0);
  const [ruleIndex, setRuleIndex] = useState(0);
  const [recordIndex, setRecordIndex] = useState(0);
  const si = Math.min(scenarioIndex, props.scenarios.length - 1), scenario = props.scenarios[si]!, result = audit[si]!;
  const ri = Math.min(ruleIndex, scenario.rules.length - 1), qi = Math.min(recordIndex, scenario.records.length - 1);
  const rule = scenario.rules[ri]!, stats = result.rules[ri]!, row = stats.rows[qi]!, { labels, unit } = props;
  const nf = new Intl.NumberFormat(props.locale === 'es' ? 'es-ES' : 'en-US');
  const number = (n: number) => nf.format(n === 0 ? 0 : n);
  const mean = (sum: number) => { const d = gcd(sum, scenario.records.length); return scenario.records.length === d ? number(sum / d) : `${number(sum / d)}/${number(scenario.records.length / d)}`; };
  const values = { rule: rule.label, total: number(stats.total), mean: mean(stats.total), hits: number(stats.hits), count: number(scenario.records.length) };
  const summary = labels.summaryTemplate.replace(/\{(rule|total|mean|hits|count)\}/g, (_match, token: keyof typeof values) => values[token]);
  const select = 'mt-2 min-h-11 w-full rounded-card border border-ink-300 bg-surface px-3 py-2 text-sm text-ink-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700';
  const scroll = 'mt-4 max-w-full overflow-x-auto rounded-card border border-ink-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700';
  const x = (n: number) => 36 + n / 24 * 608;
  const changeScenario = (value: string) => { setScenarioIndex(Number(value)); setRuleIndex(0); setRecordIndex(0); };
  const reset = () => { setScenarioIndex(0); setRuleIndex(0); setRecordIndex(0); };
  const cell = { padding: 'calc(var(--spacing) * 2) calc(var(--spacing) * 3)', verticalAlign: 'middle' as const };
  return <figure className={cx('not-prose my-8 min-w-0', props.className)} aria-labelledby={`${id}-title`}>
    <figcaption id={`${id}-title`} className="font-display text-lg font-semibold text-ink-900">{props.title}</figcaption>
    <p className="mt-2 text-sm leading-relaxed text-ink-700">{props.instructions}</p>
    <div className={cx('mt-4 grid gap-4', props.scenarios.length > 1 ? 'sm:grid-cols-3' : 'sm:grid-cols-2')}>
      {props.scenarios.length > 1 ? <label className="text-sm font-semibold text-ink-800">{labels.scenario}<select className={select} value={si} onChange={e => changeScenario(e.currentTarget.value)}>{props.scenarios.map((s, i) => <option key={s.id} value={i}>{s.label}</option>)}</select></label> : null}
      <label className="text-sm font-semibold text-ink-800">{labels.rule}<select className={select} value={ri} onChange={e => setRuleIndex(Number(e.currentTarget.value))}>{scenario.rules.map((s, i) => <option key={s.id} value={i}>{s.label}</option>)}</select></label>
      <label className="text-sm font-semibold text-ink-800">{labels.record}<select className={select} value={qi} onChange={e => setRecordIndex(Number(e.currentTarget.value))}>{scenario.records.map((s, i) => <option key={s.id} value={i}>{s.label}</option>)}</select></label>
    </div>
    <p className="mt-3 text-sm text-ink-700">{labels.nominal}: {number(scenario.nominalPercent)}%</p>
    <p className="mt-2 text-sm text-ink-600">{labels.fixedScale} ({unit})</p>
    <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-ink-800"><span>{labels.intervalLegend}</span><span>{labels.outcomeLegend}</span></div>
    <div className={scroll} tabIndex={0} role="region" aria-label={`${labels.bounds} (${unit})`}>
      <svg viewBox="0 0 680 170" className="block w-full min-w-[40rem]" aria-hidden="true" data-axis-min="0" data-axis-max="24">
        <line x1="36" x2="644" y1="120" y2="120" className="stroke-ink-900" />
        {[0, 4, 8, 12, 16, 20, 24].map(value => <g key={value}><line x1={x(value)} x2={x(value)} y1="116" y2="125" className="stroke-ink-700" /><text x={x(value)} y="148" textAnchor="middle" fontSize="15" className="fill-ink-900">{number(value)}</text></g>)}
        <line x1={x(row.lower)} x2={x(row.upper)} y1="54" y2="54" className="stroke-brand-700" strokeWidth="8" data-interval-lower={row.lower} data-interval-upper={row.upper} />
        {[row.lower, row.upper].map((value, i) => <line key={i} x1={x(value)} x2={x(value)} y1="42" y2="66" className="stroke-brand-700" strokeWidth="3" />)}
        {row.outside > 0 ? <line x1={x(row.value)} x2={x(row.value < row.lower ? row.lower : row.upper)} y1="88" y2="88" className="stroke-accent-600" strokeWidth="3" strokeDasharray="5 4" data-outside-distance={row.outside} /> : null}
        <circle cx={x(row.value)} cy="88" r="6" className="fill-ink-900" data-outcome={row.value} />
      </svg>
    </div>
    <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-3">
      {[[labels.bounds, `[${number(row.lower)}, ${number(row.upper)}]`], [labels.outcome, number(row.value)], [labels.width, number(row.width)], [labels.outside, number(row.outside)], [labels.penalty, `${number(result.factor)} × ${number(row.outside)} = ${number(row.penalty)}`], [labels.score, `${number(row.width)} + ${number(row.penalty)} = ${number(row.score)}`]].map(([label, value]) => <div key={label}><dt className="text-ink-600">{label} ({unit})</dt><dd className="mt-1 font-mono font-semibold text-ink-900">{value}</dd></div>)}
    </dl>
    <p className="mt-4 text-sm font-semibold text-ink-900" aria-live="polite" aria-atomic="true">{summary}</p>
    <p className="mt-2 text-sm text-ink-700">{result.minima.length === scenario.rules.length ? labels.allTied : `${labels.lowest}: ${new Intl.ListFormat(props.locale === 'es' ? 'es-ES' : 'en-US', { type: 'conjunction' }).format(result.minima.map(i => scenario.rules[i]!.label))}`}</p>
    <div className={scroll} tabIndex={0} role="region" aria-label={labels.tableCaption}>
      <table className="w-full min-w-[54rem] border-collapse text-left text-sm" style={{ display: 'table', overflow: 'visible', margin: 0 }}>
        <caption className="px-3 py-3 text-left text-sm text-ink-700">{labels.tableCaption} ({unit})</caption>
        <thead><tr>{[labels.rule, labels.record, labels.bounds, labels.outcome, labels.width, labels.penalty, labels.score, labels.hits].map(label => <th key={label} scope="col" style={cell} className="bg-surface-sunken font-semibold text-ink-900">{label}</th>)}</tr></thead>
        <tbody>{scenario.rules.flatMap((r, index) => result.rules[index]!.rows.map((v, j) => <tr key={`${r.id}-${scenario.records[j]!.id}`} className={index === ri && j === qi ? 'bg-brand-50' : ''} style={index === ri && j === qi ? { backgroundColor: 'var(--color-brand-50)' } : undefined} data-rule-id={r.id} data-record-id={scenario.records[j]!.id}><th scope="row" style={cell} className="font-medium text-ink-900">{r.label}</th><td style={cell}>{scenario.records[j]!.label}</td><td style={cell}>[{number(v.lower)}, {number(v.upper)}]</td><td style={cell}>{number(v.value)}</td><td style={cell}>{number(v.width)}</td><td style={cell}>{number(v.penalty)}</td><td style={cell}>{number(v.score)}</td><td style={cell}>{v.hit ? number(1) : number(0)}</td></tr>))}</tbody>
        <tfoot>{scenario.rules.map((r, index) => <tr key={r.id} className="bg-surface-sunken"><th scope="row" style={cell}>{r.label}</th><td style={cell} colSpan={3}>{labels.total}: {number(result.rules[index]!.total)}</td><td style={cell} colSpan={3}>{labels.mean}: {mean(result.rules[index]!.total)}</td><td style={cell}>{number(result.rules[index]!.hits)}/{number(scenario.records.length)}</td></tr>)}</tfoot>
      </table>
    </div>
    <button type="button" onClick={reset} className="mt-4 min-h-11 rounded-pill border border-ink-300 px-4 py-2 text-sm font-semibold text-ink-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700">{labels.reset}</button>
  </figure>;
}
