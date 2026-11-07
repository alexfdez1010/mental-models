import { useId, useState } from 'react';
import { cx } from '@/components/react/cx';

export interface MM1QueueLabels {
  title: string;
  assumptions: string;
  arrival: string;
  service: string;
  reset: string;
  load: string;
  busyFraction: string;
  meanSystem: string;
  meanWaiting: string;
  meanStay: string;
  meanWait: string;
  nonstationary: string;
  curve: string;
  curveDescription: string;
  arrivalAxis: string;
  timeAxis: string;
  offscale: string;
  distribution: string;
  probability: string;
  tail: string;
  rateUnit: string;
}

export interface MM1QueueExplorerProps {
  initialArrival?: number;
  initialService?: number;
  labels: MM1QueueLabels;
  locale?: 'en' | 'es';
  className?: string;
}

export interface MM1Ratio { numerator: number; denominator: number }
export type MM1Measures =
  | { stable: false; load: MM1Ratio }
  | {
    stable: true;
    load: MM1Ratio;
    meanSystem: MM1Ratio;
    meanWaiting: MM1Ratio;
    meanStay: MM1Ratio;
    meanWait: MM1Ratio;
    probabilityDenominator: number;
    probabilityNumerators: number[];
  };

function fail(message: string): never {
  throw new Error('MM1QueueExplorer: ' + message);
}

function validateRates(arrival: number, service: number): void {
  if (!Number.isSafeInteger(arrival) || arrival < 1 || arrival > 12) fail('arrival must be an integer from 1 to 12 per hour.');
  if (!Number.isSafeInteger(service) || service < 2 || service > 16) fail('service must be an integer from 2 to 16 per hour.');
}

/** @internal Analytical model measures; not an estimator of a supplied trace. */
export function computeMM1Measures(arrival: number, service: number): MM1Measures {
  validateRates(arrival, service);
  const load = { numerator: arrival, denominator: service };
  // These inputs are valid controls but outside the stationary model domain.
  if (arrival >= service) return { stable: false, load };
  const difference = service - arrival;
  const probabilityDenominator = service ** 5;
  const probabilityNumerators = Array.from({ length: 5 }, (_, n) =>
    difference * arrival ** n * service ** (4 - n));
  probabilityNumerators.push(arrival ** 5);
  return {
    stable: true, load,
    meanSystem: { numerator: arrival, denominator: difference },
    meanWaiting: { numerator: arrival * arrival, denominator: service * difference },
    meanStay: { numerator: 60, denominator: difference },
    meanWait: { numerator: 60 * arrival, denominator: service * difference },
    probabilityDenominator, probabilityNumerators,
  };
}

const keys: (keyof MM1QueueLabels)[] = [
  'title', 'assumptions', 'arrival', 'service', 'reset', 'load', 'busyFraction',
  'meanSystem', 'meanWaiting', 'meanStay', 'meanWait', 'nonstationary', 'curve',
  'curveDescription', 'arrivalAxis', 'timeAxis', 'offscale', 'distribution',
  'probability', 'tail', 'rateUnit',
];

function gcd(a: number, b: number): number {
  while (b) [a, b] = [b, a % b];
  return a;
}

/**
 * Exact rational readouts for the stipulated stationary M/M/1 model.
 * Arrival and service controls do not simulate observations or fit a queue.
 */
export function MM1QueueExplorer(props: MM1QueueExplorerProps) {
  const { initialArrival = 6, initialService = 10, labels: l, locale = 'en', className } = props;
  validateRates(initialArrival, initialService);
  if (locale !== 'en' && locale !== 'es') fail('locale must be en or es.');
  for (const key of keys) if (typeof l?.[key] !== 'string' || !l[key].trim()) fail('labels.' + key + ' must be nonempty.');
  const id = useId();
  const [arrival, setArrival] = useState(initialArrival);
  const [service, setService] = useState(initialService);
  const model = computeMM1Measures(arrival, service);
  const format = new Intl.NumberFormat(locale === 'es' ? 'es-ES' : 'en-US', { maximumFractionDigits: 2 });
  const approximate = new Intl.NumberFormat(locale === 'es' ? 'es-ES' : 'en-US', { maximumSignificantDigits: 3 });
  const number = (n: number) => format.format(n === 0 ? 0 : n);
  const ratio = ({ numerator: n, denominator: d }: MM1Ratio) => {
    const divisor = gcd(n, d);
    const a = n / divisor;
    const b = d / divisor;
    return b === 1 ? number(a) : a + '/' + b + ((n * 100) % d === 0 ? ' = ' + number(n / d) : ' ≈ ' + approximate.format(n / d));
  };
  const x = (rate: number) => 48 + rate * 46;
  const y = (minutes: number) => 250 - minutes * 3.5;
  // The visible analytic branch ends at60min. Its continuation is marked, never capped as a result.
  const lastVisible = Math.min(12, service - 1);
  const points = Array.from({ length: Math.round((lastVisible - 1) * 20) + 1 }, (_, i) => {
    const rate = 1 + i / 20;
    return x(rate) + ',' + y(60 / (service - rate));
  }).join(' ');
  const offscale = service <= 12;
  const border = service <= 12 ? x(service) : null;
  const stableMetrics = model.stable ? [
    { name: 'busy-fraction', label: l.busyFraction, value: model.load },
    { name: 'mean-system', label: l.meanSystem, value: model.meanSystem },
    { name: 'mean-waiting', label: l.meanWaiting, value: model.meanWaiting },
    { name: 'mean-stay', label: l.meanStay, value: model.meanStay },
    { name: 'mean-wait', label: l.meanWait, value: model.meanWait },
  ] : [];
  const summary = l.arrival + ': ' + number(arrival) + '; ' + l.service + ': ' + number(service) + '; ' + l.load + ': ' + ratio(model.load)
    + (model.stable ? '; ' + l.meanStay + ': ' + ratio(model.meanStay) : '; ' + l.nonstationary);
  return (
    <figure className={cx('not-prose my-8 min-w-0 max-w-full', className)} aria-labelledby={id + '-title'}>
      <figcaption id={id + '-title'} className="font-display text-lg font-semibold text-ink-900">{l.title}</figcaption>
      <p className="mt-2 text-sm text-ink-700">{l.assumptions}</p>
      <div className="mt-4 grid gap-5 sm:grid-cols-2">
        <label htmlFor={id + '-arrival'} className="text-sm font-semibold text-ink-800">{l.arrival}: <output htmlFor={id + '-arrival'} className="font-mono">{number(arrival)}</output> <span className="font-normal">({l.rateUnit})</span>
          <input id={id + '-arrival'} className="mt-2 block w-full accent-brand-700" type="range" min="1" max="12" step="1" value={arrival} aria-valuetext={l.arrival + ' (' + l.rateUnit + '): ' + number(arrival)} onChange={(e) => setArrival(Number(e.currentTarget.value))} />
        </label>
        <label htmlFor={id + '-service'} className="text-sm font-semibold text-ink-800">{l.service}: <output htmlFor={id + '-service'} className="font-mono">{number(service)}</output> <span className="font-normal">({l.rateUnit})</span>
          <input id={id + '-service'} className="mt-2 block w-full accent-brand-700" type="range" min="2" max="16" step="1" value={service} aria-valuetext={l.service + ' (' + l.rateUnit + '): ' + number(service)} onChange={(e) => setService(Number(e.currentTarget.value))} />
        </label>
      </div>
      <button type="button" className="brutal-btn mt-4 min-h-11 px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600" disabled={arrival === initialArrival && service === initialService} onClick={() => { setArrival(initialArrival); setService(initialService); }}>{l.reset}</button>
      <p className="mt-3 text-sm text-ink-800" aria-live="polite" aria-atomic="true" data-mm1-result="" data-stable={model.stable} data-arrival={arrival} data-service={service}>{summary}</p>
      <dl className="mt-4 grid gap-x-6 gap-y-4 sm:grid-cols-2">
        <div><dt className="text-sm text-ink-700">{l.load}</dt><dd className="mt-1 font-mono font-semibold text-ink-900" data-mm1-metric="load" data-numerator={model.load.numerator} data-denominator={model.load.denominator}>{ratio(model.load)}</dd></div>
        {stableMetrics.map((item) => <div key={item.name}><dt className="text-sm text-ink-700">{item.label}</dt><dd className="mt-1 font-mono font-semibold text-ink-900" data-mm1-metric={item.name} data-numerator={item.value.numerator} data-denominator={item.value.denominator}>{ratio(item.value)}</dd></div>)}
      </dl>
      <div className="mt-6 max-w-full overflow-x-auto focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-600" tabIndex={0} role="region" aria-label={l.curve}>
        <svg viewBox="0 0 640 318" width="640" className="mx-auto block w-[40rem] max-w-none" role="img" aria-labelledby={id + '-curve-title'} aria-describedby={id + '-curve-desc'}>
          <title id={id + '-curve-title'}>{l.curve}</title>
          {border !== null ? <rect x={border} y="30" width={600 - border} height="220" fill="var(--color-ink-100)" data-mm1-nonstationary-region="" /> : null}
          <path d="M48 30 V250 H608" fill="none" stroke="var(--color-ink-500)" strokeWidth="2" />
          {[0, 15, 30, 45, 60].map((tick) => <text key={tick} x="40" y={y(tick) + 5} fontSize="14" textAnchor="end" fill="var(--color-ink-800)">{tick}</text>)}
          {[0, 3, 6, 9, 12].map((tick) => <text key={tick} x={x(tick)} y="275" fontSize="14" textAnchor="middle" fill="var(--color-ink-800)">{tick}</text>)}
          <text x="320" y="301" fontSize="15" textAnchor="middle" fill="var(--color-ink-900)">{l.arrivalAxis}</text>
          <text x="52" y="19" fontSize="15" fill="var(--color-ink-900)">{l.timeAxis}</text>
          <polyline points={points} fill="none" stroke="var(--color-brand-700)" strokeWidth="3" data-mm1-curve="" />
          {border !== null ? <line x1={border} x2={border} y1="30" y2="250" stroke="var(--color-ink-700)" strokeWidth="2" strokeDasharray="5 4" data-mm1-boundary={service} /> : null}
          {offscale ? <path d={'M ' + x(lastVisible) + ' 40 l 8 -17 m -8 6 l 8 -6 l 1 9'} fill="none" stroke="var(--color-brand-700)" strokeWidth="2" data-mm1-offscale="" /> : null}
          <line x1={x(arrival)} x2={x(arrival)} y1="30" y2="250" stroke="var(--color-danger)" strokeWidth="1" strokeDasharray="3 4" data-mm1-arrival-marker="" />
          {model.stable ? <circle cx={x(arrival)} cy={y(60 / (service - arrival))} r="5" fill="var(--color-surface)" stroke="var(--color-danger)" strokeWidth="3" data-mm1-selected-minutes={60 / (service - arrival)} /> : null}
        </svg>
      </div>
      <p id={id + '-curve-desc'} className="mt-2 text-sm text-ink-700">{l.curveDescription}</p>
      {offscale ? <p className="mt-2 text-sm text-ink-700">{l.offscale}</p> : null}
      {model.stable ? <div className="mt-6">
        <p className="font-semibold text-ink-900">{l.distribution}</p>
        <ul className="mt-3 space-y-3" role="list">
          {model.probabilityNumerators.map((n, index) => <li key={index}>
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-sm text-ink-800"><span>{index < 5 ? 'N = ' + index : l.tail}</span><span className="break-all font-mono" data-mm1-probability={index} data-numerator={n} data-denominator={model.probabilityDenominator}><span className="sr-only">{l.probability}: </span>{ratio({ numerator: n, denominator: model.probabilityDenominator })}</span></div>
            <div aria-hidden="true" className="mt-1 h-2 overflow-hidden rounded-pill bg-ink-100"><div className="h-full w-full origin-left bg-brand-600" style={{ transform: 'scaleX(' + n / model.probabilityDenominator + ')' }} /></div>
          </li>)}
        </ul>
        <div aria-hidden="true" className="mt-2 flex justify-between font-mono text-xs text-ink-600"><span>0</span><span>1</span></div>
      </div> : null}
    </figure>
  );
}

export default MM1QueueExplorer;
