import { useId, useState } from 'react';
import { cx } from '@/components/react/cx';

export interface QueueTimelineJob {
  /** A display identifier; equal-time arrivals retain array order, not ID order. */
  id: string;
  /** Whole minutes, zero through thirty, in nondecreasing input order. */
  arrival: number;
  /** Positive whole minutes, at most ten. */
  service: number;
}

export interface QueueTimelineWindow {
  id: string;
  label: string;
  from: number;
  to: number;
}

export interface QueueTimelineScenario {
  id: string;
  label: string;
  jobs: QueueTimelineJob[];
  windows: QueueTimelineWindow[];
}

export interface QueueTimelineLabels {
  title: string;
  instructions: string;
  scenario: string;
  window: string;
  cursor: string;
  reset: string;
  chart: string;
  chartDescription: string;
  timeAxis: string;
  waitingLegend: string;
  serviceLegend: string;
  windowLegend: string;
  system: string;
  waiting: string;
  inService: string;
  duration: string;
  systemArea: string;
  waitingArea: string;
  serviceArea: string;
  meanSystem: string;
  meanWaiting: string;
  busyFraction: string;
  table: string;
  job: string;
  arrival: string;
  service: string;
  start: string;
  departure: string;
  wait: string;
  stay: string;
  observedStay: string;
  observedWait: string;
  observedService: string;
}

export interface QueueTimelineAuditProps {
  scenarios: QueueTimelineScenario[];
  /** Fixed horizontal extent for every supplied scenario and window, at most120. */
  axisEnd: number;
  labels: QueueTimelineLabels;
  locale?: 'en' | 'es';
  className?: string;
}

export interface QueueTimelineRow extends QueueTimelineJob {
  start: number;
  departure: number;
  wait: number;
  stay: number;
}

const labelKeys: (keyof QueueTimelineLabels)[] = [
  'title', 'instructions', 'scenario', 'window', 'cursor', 'reset', 'chart',
  'chartDescription', 'timeAxis', 'waitingLegend', 'serviceLegend', 'windowLegend',
  'system', 'waiting', 'inService', 'duration', 'systemArea', 'waitingArea',
  'serviceArea', 'meanSystem', 'meanWaiting', 'busyFraction', 'table', 'job',
  'arrival', 'service', 'start', 'departure', 'wait', 'stay', 'observedStay',
  'observedWait', 'observedService',
];

function fail(message: string): never {
  throw new Error('QueueTimelineAudit: ' + message);
}

function dense(value: unknown, minimum: number, maximum: number, name: string): asserts value is unknown[] {
  if (!Array.isArray(value) || value.length < minimum || value.length > maximum) {
    fail(name + ' must contain ' + minimum + ' to ' + maximum + ' items.');
  }
  for (let i = 0; i < value.length; i++) {
    if (!Object.hasOwn(value, i)) fail(name + ' cannot contain array holes.');
  }
}

function integer(value: unknown, minimum: number, maximum: number, name: string): asserts value is number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < minimum || value > maximum) {
    fail(name + ' must be an integer from ' + minimum + ' to ' + maximum + '.');
  }
}

function identity(value: unknown, name: string): asserts value is string {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{1,12}$/.test(value)) {
    fail(name + ' must be a one-to-twelve-character ASCII identifier.');
  }
}

function named(value: unknown, name: string): asserts value is string {
  if (typeof value !== 'string' || !value.trim()) fail(name + ' must be nonempty.');
}

/** @internal Pure finite FCFS calculation, exported for independent-oracle unit tests. */
export function computeFCFSRows(jobs: QueueTimelineJob[]): QueueTimelineRow[] {
  dense(jobs, 2, 8, 'jobs');
  const seen = new Set<string>();
  let previousArrival = 0;
  let previousDeparture = 0;
  return jobs.map((job, index) => {
    if (!job || typeof job !== 'object') fail('Each job must be an object.');
    identity(job.id, 'job.id');
    if (seen.has(job.id)) fail('Job IDs must be unique within a scenario.');
    seen.add(job.id);
    integer(job.arrival, 0, 30, 'job.arrival');
    integer(job.service, 1, 10, 'job.service');
    const arrival = job.arrival === 0 ? 0 : job.arrival;
    if (index > 0 && arrival < previousArrival) fail('Arrivals must be in nondecreasing input order.');
    previousArrival = arrival;
    const start = Math.max(arrival, previousDeparture);
    const departure = start + job.service;
    previousDeparture = departure;
    return { id: job.id, arrival, service: job.service, start, departure, wait: start - arrival, stay: departure - arrival };
  });
}

function prepare(props: QueueTimelineAuditProps) {
  if (!props || typeof props !== 'object') fail('Props must be an object.');
  integer(props.axisEnd, 1, 120, 'axisEnd');
  if (props.locale !== undefined && props.locale !== 'en' && props.locale !== 'es') fail('locale must be en or es.');
  for (const key of labelKeys) named(props.labels?.[key], 'labels.' + key);
  dense(props.scenarios, 1, 3, 'scenarios');
  const ids = new Set<string>();
  const names = new Set<string>();
  return props.scenarios.map((scenario) => {
    if (!scenario || typeof scenario !== 'object') fail('Each scenario must be an object.');
    identity(scenario.id, 'scenario.id');
    named(scenario.label, 'scenario.label');
    if (ids.has(scenario.id) || names.has(scenario.label)) fail('Scenario IDs and labels must be unique.');
    ids.add(scenario.id);
    names.add(scenario.label);
    const rows = computeFCFSRows(scenario.jobs);
    if (rows.some((row) => row.departure > props.axisEnd)) fail('axisEnd must cover every departure, including hidden scenarios.');
    dense(scenario.windows, 1, 4, 'windows');
    const windowIds = new Set<string>();
    const windowNames = new Set<string>();
    const windows = scenario.windows.map((window) => {
      if (!window || typeof window !== 'object') fail('Each window must be an object.');
      identity(window.id, 'window.id');
      named(window.label, 'window.label');
      if (windowIds.has(window.id) || windowNames.has(window.label)) fail('Window IDs and labels must be unique within a scenario.');
      windowIds.add(window.id);
      windowNames.add(window.label);
      integer(window.from, 0, props.axisEnd, 'window.from');
      integer(window.to, 1, props.axisEnd, 'window.to');
      if (window.from >= window.to) fail('Every window must have positive duration.');
      return { ...window, from: window.from === 0 ? 0 : window.from };
    });
    return { ...scenario, rows, windows };
  });
}

function exposure(from: number, to: number, left: number, right: number): number {
  return Math.max(0, Math.min(to, right) - Math.max(from, left));
}

function gcd(a: number, b: number): number {
  while (b) [a, b] = [b, a % b];
  return a;
}

/**
 * A supplied finite trace, not a stochastic simulation or a waiting-time forecast.
 * State snapshots are after the events at t; selected-window areas use [from,to).
 */
export function QueueTimelineAudit(props: QueueTimelineAuditProps) {
  // Validate all hidden data before hooks. Input bounds keep all arithmetic exact.
  const prepared = prepare(props);
  const { labels: l, axisEnd, locale = 'en', className } = props;
  const id = useId();
  const [scenarioIndex, setScenarioIndex] = useState(0);
  const [windowIndex, setWindowIndex] = useState(0);
  const [cursor, setCursor] = useState(prepared[0]!.windows[0]!.from);
  const activeScenario = Math.min(scenarioIndex, prepared.length - 1);
  const scenario = prepared[activeScenario]!;
  const activeWindow = Math.min(windowIndex, scenario.windows.length - 1);
  const window = scenario.windows[activeWindow]!;
  const time = Math.max(0, Math.min(cursor, axisEnd));
  const rows = scenario.rows;
  const maxJobs = Math.max(...prepared.map((item) => item.rows.length));
  const format = new Intl.NumberFormat(locale === 'es' ? 'es-ES' : 'en-US', { maximumFractionDigits: 2 });
  const number = (n: number) => format.format(n === 0 ? 0 : n);
  const ratio = (n: number, d: number) => {
    const divisor = gcd(n, d);
    const numerator = n / divisor;
    const denominator = d / divisor;
    return denominator === 1 ? number(numerator)
      : numerator + '/' + denominator + ((n * 100) % d === 0 ? ' = ' : ' ≈ ') + number(n / d);
  };
  const present = rows.filter((r) => r.arrival <= time && time < r.departure).length;
  const waiting = rows.filter((r) => r.arrival <= time && time < r.start).length;
  const inService = rows.filter((r) => r.start <= time && time < r.departure).length;
  const clipped = rows.map((r) => ({
    ...r,
    observedStay: exposure(r.arrival, r.departure, window.from, window.to),
    observedWait: exposure(r.arrival, r.start, window.from, window.to),
    observedService: exposure(r.start, r.departure, window.from, window.to),
  }));
  const area = clipped.reduce((sum, r) => sum + r.observedStay, 0);
  const queueArea = clipped.reduce((sum, r) => sum + r.observedWait, 0);
  const busyArea = clipped.reduce((sum, r) => sum + r.observedService, 0);
  const duration = window.to - window.from;
  const x = (t: number) => 140 + 470 * t / axisEnd;
  const occupancyTop = 66 + rows.length * 30;
  const baseline = occupancyTop + 96;
  const y = (n: number) => baseline - 96 * n / maxJobs;
  const events = [...new Set([0, axisEnd, ...rows.flatMap((r) => [r.arrival, r.start, r.departure])])].sort((a, b) => a - b);
  const path = (queue: boolean) => events.map((t, index) => {
    const count = rows.filter((r) => r.arrival <= t && t < (queue ? r.start : r.departure)).length;
    return (index ? 'H ' + x(t) + ' V ' : 'M ' + x(t) + ' ') + y(count);
  }).join(' ');
  const summary = scenario.label + '; ' + l.cursor + ': ' + number(time) + '; ' + l.system + ': ' + present + '; ' + l.waiting + ': ' + waiting + '; ' + l.inService + ': ' + inService;
  const atDefault = activeScenario === 0 && activeWindow === 0 && time === prepared[0]!.windows[0]!.from;
  const control = 'min-h-11 w-full rounded-card border border-ink-300 bg-surface px-3 py-2 text-sm text-ink-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600';
  const reset = () => { setScenarioIndex(0); setWindowIndex(0); setCursor(prepared[0]!.windows[0]!.from); };
  const metrics = [
    { key: 'duration', label: l.duration, n: duration, d: 1 },
    { key: 'system-area', label: l.systemArea, n: area, d: 1 },
    { key: 'waiting-area', label: l.waitingArea, n: queueArea, d: 1 },
    { key: 'service-area', label: l.serviceArea, n: busyArea, d: 1 },
    { key: 'mean-system', label: l.meanSystem, n: area, d: duration },
    { key: 'mean-waiting', label: l.meanWaiting, n: queueArea, d: duration },
    { key: 'busy-fraction', label: l.busyFraction, n: busyArea, d: duration },
  ];
  return (
    <figure className={cx('not-prose my-8 min-w-0 max-w-full', className)} aria-labelledby={id + '-title'}>
      <figcaption id={id + '-title'} className="font-display text-lg font-semibold text-ink-900">{l.title}</figcaption>
      <p className="mt-2 text-sm text-ink-700">{l.instructions}</p>
      <div className="mt-4 grid min-w-0 gap-4 sm:grid-cols-2">
        {prepared.length > 1 ? <label className="min-w-0 text-sm font-semibold text-ink-800">{l.scenario}
          <select className={cx(control, 'mt-1')} value={activeScenario} onChange={(e) => {
            const index = Number(e.currentTarget.value);
            setScenarioIndex(index); setWindowIndex(0); setCursor(prepared[index]!.windows[0]!.from);
          }}>{prepared.map((item, index) => <option key={item.id} value={index}>{item.label}</option>)}</select>
        </label> : <p className="text-sm font-semibold text-ink-800">{scenario.label}</p>}
        {scenario.windows.length > 1 ? <label className="min-w-0 text-sm font-semibold text-ink-800">{l.window}
          <select className={cx(control, 'mt-1')} value={activeWindow} onChange={(e) => {
            const index = Number(e.currentTarget.value); setWindowIndex(index); setCursor(scenario.windows[index]!.from);
          }}>{scenario.windows.map((item, index) => <option key={item.id} value={index}>{item.label}</option>)}</select>
        </label> : <p className="text-sm text-ink-700">{window.label}</p>}
      </div>
      <div className="mt-4 flex flex-wrap items-end gap-4">
        <label htmlFor={id + '-cursor'} className="min-w-0 flex-1 text-sm font-semibold text-ink-800">{l.cursor}: <output htmlFor={id + '-cursor'} className="font-mono">{number(time)}</output>
          <input id={id + '-cursor'} className="mt-2 block w-full min-w-40 accent-brand-700" type="range" min={0} max={axisEnd} step={1} value={time} aria-valuetext={l.cursor + ': ' + number(time)} onChange={(e) => setCursor(Number(e.currentTarget.value))} />
        </label>
        <button type="button" className="brutal-btn min-h-11 px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600" onClick={reset} disabled={atDefault}>{l.reset}</button>
      </div>
      <p className="mt-3 text-sm text-ink-800" aria-live="polite" aria-atomic="true" data-queue-snapshot="" data-time={time} data-system={present} data-waiting={waiting} data-service={inService}>{summary}</p>
      <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-ink-800" role="list"><li>{l.waitingLegend}</li><li>{l.serviceLegend}</li><li>{l.windowLegend}: {number(window.from)}–{number(window.to)}</li></ul>
      <div className="mt-3 max-w-full overflow-x-auto focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-600" tabIndex={0} role="region" aria-label={l.chart}>
        <svg viewBox={'0 0 640 ' + (baseline + 50)} width="640" className="mx-auto block w-[40rem] max-w-none" role="img" aria-labelledby={id + '-chart-title ' + id + '-chart-desc'}>
          <title id={id + '-chart-title'}>{l.chart}</title><desc id={id + '-chart-desc'}>{l.chartDescription}</desc>
          <rect x={x(window.from)} y="28" width={x(window.to) - x(window.from)} height={baseline - 28} fill="var(--color-accent-300)" opacity="0.5" data-queue-observation="" />
          {rows.map((r, index) => <g key={r.id} data-queue-job={r.id}>
            <text x="10" y={53 + index * 30} fontSize="15" fill="var(--color-ink-900)">{r.id}</text>
            {r.wait > 0 ? <rect x={x(r.arrival)} y={37 + index * 30} width={x(r.start) - x(r.arrival)} height="21" fill="var(--color-ink-100)" stroke="var(--color-ink-700)" strokeDasharray="4 3" data-queue-wait={r.wait} /> : null}
            <rect x={x(r.start)} y={37 + index * 30} width={x(r.departure) - x(r.start)} height="21" fill="var(--color-brand-600)" data-queue-service={r.service} />
          </g>)}
          <text x="10" y={occupancyTop + 10} fontSize="14" fill="var(--color-ink-800)">N</text>
          <text x="10" y={occupancyTop + 31} fontSize="14" fill="var(--color-ink-800)">Nq</text>
          <path d={'M 140 ' + occupancyTop + ' V ' + baseline + ' H 610'} fill="none" stroke="var(--color-ink-500)" />
          <text x="130" y={occupancyTop + 5} textAnchor="end" fontSize="14" fill="var(--color-ink-700)">{maxJobs}</text>
          <text x="130" y={baseline + 5} textAnchor="end" fontSize="14" fill="var(--color-ink-700)">0</text>
          <path d={path(false)} fill="none" stroke="var(--color-brand-700)" strokeWidth="3" data-queue-system-path="" />
          <path d={path(true)} fill="none" stroke="var(--color-ink-800)" strokeWidth="2" strokeDasharray="5 3" data-queue-waiting-path="" />
          <line x1={x(time)} x2={x(time)} y1="25" y2={baseline} stroke="var(--color-danger)" strokeWidth="2" data-queue-cursor="" />
          {[0, 1, 2, 3, 4].map((tick) => <text key={tick} x={x(axisEnd * tick / 4)} y={baseline + 22} textAnchor="middle" fontSize="14" fill="var(--color-ink-800)">{number(axisEnd * tick / 4)}</text>)}
          <text x="375" y={baseline + 44} textAnchor="middle" fontSize="15" fill="var(--color-ink-900)">{l.timeAxis}</text>
        </svg>
      </div>
      <dl className="mt-5 grid gap-x-6 gap-y-4 sm:grid-cols-2">
        {metrics.map((metric) => <div key={metric.key}><dt className="text-sm text-ink-700">{metric.label}</dt><dd className="mt-1 font-mono text-base font-semibold text-ink-900" data-queue-metric={metric.key} data-numerator={metric.n} data-denominator={metric.d}>{ratio(metric.n, metric.d)}</dd></div>)}
      </dl>
      <div className="mt-6 max-w-full overflow-x-auto focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-600" tabIndex={0} role="region" aria-label={l.table}>
        <table className="w-full text-left text-sm text-ink-800" style={{ display: 'table', overflow: 'visible', margin: 0, minWidth: '58rem' }}>
          <caption className="mb-3 text-left text-sm font-semibold text-ink-800">{l.table}</caption>
          <thead><tr>{[l.job, l.arrival, l.service, l.start, l.departure, l.wait, l.stay, l.observedStay, l.observedWait, l.observedService].map((label, index) => <th key={index} scope="col" className="p-3 align-bottom">{label}</th>)}</tr></thead>
          <tbody>{clipped.map((r) => <tr key={r.id} data-queue-row={r.id} data-arrival={r.arrival} data-start={r.start} data-departure={r.departure}>
            <th scope="row" className="p-3 font-semibold">{r.id}</th>
            {[r.arrival, r.service, r.start, r.departure, r.wait, r.stay, r.observedStay, r.observedWait, r.observedService].map((value, index) => <td key={index} className="p-3 font-mono tabular-nums">{number(value)}</td>)}
          </tr>)}</tbody>
        </table>
      </div>
    </figure>
  );
}

export default QueueTimelineAudit;
