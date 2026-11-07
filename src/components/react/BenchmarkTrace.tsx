import { useId, useState } from 'react';
import { cx } from '@/components/react/cx';

/** A paired measurement of the same lower-is-better quantity at one checkpoint. */
export interface BenchmarkObservation {
  label: string;
  a: number;
  b: number;
}

/** Authored observations only: this island does not infer trends or causal responses. */
export interface BenchmarkTraceProps {
  observations: BenchmarkObservation[];
  aLabel: string;
  bLabel: string;
  unit: string;
  locale?: 'en' | 'es';
  title?: string;
  instructions?: string;
  previousLabel?: string;
  nextLabel?: string;
  checkpointLabel?: string;
  gapLabel?: string;
  reductionLabel?: string;
  caption?: string;
  className?: string;
}

/** Reject every authored row before hooks, including rows not initially visible. */
export function validateBenchmarkTrace({ observations, aLabel, bLabel, unit }: BenchmarkTraceProps): void {
  if (![aLabel, bLabel, unit].every((label) => typeof label === 'string' && label.trim())) {
    throw new Error('BenchmarkTrace: aLabel, bLabel and unit must be non-empty strings.');
  }
  if (!Array.isArray(observations) || observations.length < 2) {
    throw new Error('BenchmarkTrace: observations must contain at least two checkpoints.');
  }
  observations.forEach((row, index) => {
    if (!row || typeof row.label !== 'string' || !row.label.trim() ||
        ![row.a, row.b].every((value) => Number.isFinite(value) && value >= 0)) {
      throw new Error(`BenchmarkTrace: checkpoint ${index} needs a non-empty label and finite non-negative a and b measurements.`);
    }
  });
}

/**
 * Step through paired, lower-is-better measurements. Every bar uses the same
 * zero and maximum across all supplied checkpoints. The signed gap is a − b;
 * reductions are initial − current and may be negative. Units are appended once.
 * Native controls, visible numbers and a live result keep the data available
 * without colour or motion. No interpolation is presented as an observation.
 */
export function BenchmarkTrace(props: BenchmarkTraceProps) {
  validateBenchmarkTrace(props);
  const { observations, aLabel, bLabel, unit, locale = 'en', title, caption, className } = props;
  const es = locale === 'es';
  const instructions = props.instructions ?? (es ? 'Avanza entre mediciones del mismo trabajo. Menos tiempo es mejor; todas las barras comparten escala.' : 'Step through measurements of the same job. Less time is better; every bar shares one scale.');
  const previousLabel = props.previousLabel ?? (es ? 'Medición anterior' : 'Previous checkpoint');
  const nextLabel = props.nextLabel ?? (es ? 'Medición siguiente' : 'Next checkpoint');
  const checkpointLabel = props.checkpointLabel ?? (es ? 'Medición' : 'Checkpoint');
  const gapLabel = props.gapLabel ?? (es ? 'Diferencia firmada, primero menos segundo' : 'Signed gap, first minus second');
  const reductionLabel = props.reductionLabel ?? (es ? 'Reducción desde la medición inicial' : 'Reduction since the initial checkpoint');
  const [index, setIndex] = useState(0);
  const id = useId();
  const currentIndex = Math.min(index, observations.length - 1);
  const current = observations[currentIndex];
  const initial = observations[0];
  const maximum = Math.max(1, ...observations.flatMap((row) => [row.a, row.b]));
  const number = new Intl.NumberFormat(es ? 'es-ES' : 'en-US', { maximumFractionDigits: 2 });
  const signedNumber = new Intl.NumberFormat(es ? 'es-ES' : 'en-US', { maximumFractionDigits: 2, signDisplay: 'exceptZero' });
  const format = (value: number) => `${number.format(value === 0 ? 0 : value)} ${unit}`;
  // Sign the formatted quantity so a change rounded to zero never reads as ±0.
  const signed = (value: number) => `${signedNumber.format(value)} ${unit}`;
  return (
    <figure className={cx('not-prose brutal my-6 bg-surface p-5 sm:p-6', className)} aria-labelledby={title ? `${id}-title` : undefined}>
      {title ? <p id={`${id}-title`} className="font-display text-lg font-semibold text-ink-900">{title}</p> : null}
      <p className="mt-2 text-sm text-ink-700">{instructions}</p>
      <div className="mt-4 flex flex-wrap gap-3">
        <button type="button" disabled={currentIndex === 0} onClick={() => setIndex(Math.max(0, currentIndex - 1))} aria-controls={`${id}-result`} className="brutal-btn px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600">{previousLabel}</button>
        <button type="button" disabled={currentIndex === observations.length - 1} onClick={() => setIndex(Math.min(observations.length - 1, currentIndex + 1))} aria-controls={`${id}-result`} className="brutal-btn px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600">{nextLabel}</button>
      </div>
      <div id={`${id}-result`} aria-live="polite" aria-atomic="true" className="mt-5">
        <p className="font-semibold text-ink-900">{checkpointLabel}: {current.label}</p>
        <dl className="mt-4 space-y-4">
          {([{ label: aLabel, value: current.a }, { label: bLabel, value: current.b }]).map(({ label, value }, i) => (
            <div key={i}>
              <div className="flex flex-wrap justify-between gap-x-3"><dt className="font-medium text-ink-800">{label}</dt><dd className="font-mono text-sm text-ink-900">{format(value)}</dd></div>
              <div aria-hidden="true" className="mt-1 h-3 overflow-hidden rounded-pill bg-surface-sunken"><div data-benchmark-bar={i} className={cx('h-full origin-left transition-transform duration-300 motion-reduce:transition-none', i === 0 ? 'bg-brand-500' : 'bg-accent-500')} style={{ transform: `scaleX(${value / maximum})` }} /></div>
            </div>
          ))}
        </dl>
        <p className="mt-4 text-sm text-ink-800">{gapLabel}: <strong className="font-mono">{signed(current.a - current.b)}</strong></p>
        <p className="mt-3 text-sm font-medium text-ink-700">{reductionLabel}</p>
        <ul className="mt-1 space-y-1 text-sm text-ink-800"><li>{aLabel}: {signed(initial.a - current.a)}</li><li>{bLabel}: {signed(initial.b - current.b)}</li></ul>
      </div>
      {caption ? <figcaption className="mt-4 text-sm text-ink-600">{caption}</figcaption> : null}
    </figure>
  );
}

export default BenchmarkTrace;
