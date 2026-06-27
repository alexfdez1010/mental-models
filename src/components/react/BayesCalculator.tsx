import { useId, useMemo, useState } from 'react';
import { cx } from '@/components/react/cx';

/** Props for the {@link BayesCalculator} island. */
export interface BayesCalculatorProps {
  /** Eyebrow label. Defaults to `'Bayesian updating'`. */
  eyebrow?: string;
  /** Heading above the card. */
  title?: string;
  /** Instruction line above the sliders. */
  instructions?: string;
  /** Caption beneath the card. */
  caption?: string;

  /** Name of the hypothesis, as a verb phrase ("have the disease"). */
  hypothesisLabel?: string;
  /** Name of the evidence, as a verb phrase ("test positive"). */
  evidenceLabel?: string;

  /** Label on the prior / base-rate slider. */
  priorLabel?: string;
  /** Label on the true-positive (sensitivity) slider. */
  sensitivityLabel?: string;
  /** Label on the false-positive slider. */
  falsePositiveLabel?: string;

  /** Starting prior, as a percent (0–100). Defaults to 1. */
  initialPrior?: number;
  /** Starting true-positive rate, as a percent (0–100). Defaults to 99. */
  initialSensitivity?: number;
  /** Starting false-positive rate, as a percent (0–100). Defaults to 5. */
  initialFalsePositive?: number;

  /**
   * Size of the imaginary population used for the natural-frequency breakdown.
   * A round number reads best. Defaults to 10000.
   */
  populationSize?: number;

  /** Heading over the natural-frequency breakdown. Defaults to `'Out of {n} people'`. */
  breakdownLabel?: string;
  /** Label on the prior bar. Defaults to `'Prior'`. */
  priorBarLabel?: string;
  /** Label on the posterior bar + readout. Defaults to `'Posterior'`. */
  posteriorBarLabel?: string;

  /**
   * Sentence template for the posterior readout. `{posterior}`, `{hypothesis}`
   * and `{evidence}` are replaced.
   */
  readoutTemplate?: string;
  /**
   * Sentence template for the natural-frequency line. `{truePos}`, `{falsePos}`,
   * `{positives}`, `{evidence}` and `{hypothesis}` are replaced.
   */
  frequencyTemplate?: string;

  /** Legend label for the true-positive swatch. Defaults to `'true positives'`. */
  truePosLabel?: string;
  /** Legend label for the false-positive swatch. Defaults to `'false positives'`. */
  falsePosLabel?: string;
  /**
   * Legend tail describing how many of the population truly match. `{have}`,
   * `{n}` and `{hypothesis}` are replaced.
   */
  legendTemplate?: string;

  /** Label of the reset button. Defaults to `'Reset'`. */
  resetLabel?: string;
  /** Extra classes merged onto the root element. */
  className?: string;
}

/** Round to at most one decimal, dropping a trailing `.0`. */
function pct1(p: number): string {
  const rounded = Math.round(p * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

/** Whole-number with thousands separators. */
function whole(n: number): string {
  return Math.round(n).toLocaleString('en-US');
}

interface Slider {
  id: keyof Pick<BayesState, 'prior' | 'sensitivity' | 'falsePositive'>;
  label: string;
  value: number;
}

interface BayesState {
  prior: number;
  sensitivity: number;
  falsePositive: number;
}

/**
 * Interactive **Bayesian posterior calculator** — "a positive test is not the
 * same as having the disease."
 *
 * The learner sets three numbers — the **prior** (base rate of the hypothesis),
 * the **true-positive rate** (how often the evidence shows up when the hypothesis
 * is true) and the **false-positive rate** (how often it shows up when the
 * hypothesis is false) — and the island computes, live, the **posterior**: the
 * probability the hypothesis is true *given* the evidence, via Bayes' theorem
 * `P(H|E) = P(H)·P(E|H) / P(E)`.
 *
 * Crucially it shows the answer two ways at once: as the abstract percentage and
 * as a **natural-frequency breakdown** over a concrete population (of N people, X
 * truly have it and test positive, while Y are healthy yet still test positive —
 * so only X of the X+Y positives are real). Natural frequencies are the format
 * that makes base-rate neglect evaporate. The prior-vs-posterior bars let the
 * learner *see* how far a single piece of evidence actually moves a belief — often
 * far less than intuition screams, because the base rate holds most of the weight.
 *
 * Each input is a native `range` with a visible label, the result is announced via
 * `aria-live`, bars transition gently (instantly under `prefers-reduced-motion`),
 * and the whole thing is keyboard-operable.
 */
export function BayesCalculator({
  eyebrow = 'Bayesian updating',
  title,
  instructions = 'Set the three numbers. The posterior — your chance of the hypothesis after the evidence — updates live.',
  caption,
  hypothesisLabel = 'have the disease',
  evidenceLabel = 'test positive',
  priorLabel = 'Prior — base rate',
  sensitivityLabel = 'True-positive rate',
  falsePositiveLabel = 'False-positive rate',
  initialPrior = 1,
  initialSensitivity = 99,
  initialFalsePositive = 5,
  populationSize = 10000,
  breakdownLabel = 'Out of {n} people',
  priorBarLabel = 'Prior (before the test)',
  posteriorBarLabel = 'Posterior (after a positive test)',
  readoutTemplate = 'After a positive test, the chance you actually {hypothesis} is {posterior}%.',
  frequencyTemplate = 'Of {positives} who {evidence}, only {truePos} truly {hypothesis} — the other {falsePos} are false alarms.',
  truePosLabel = 'true positives',
  falsePosLabel = 'false positives',
  legendTemplate = '{have} of {n} truly {hypothesis}',
  resetLabel = 'Reset',
  className,
}: BayesCalculatorProps) {
  const reactId = useId();
  const clampPct = (n: number) => Math.max(0, Math.min(100, n));

  const [state, setState] = useState<BayesState>(() => ({
    prior: clampPct(initialPrior),
    sensitivity: clampPct(initialSensitivity),
    falsePositive: clampPct(initialFalsePositive),
  }));

  const reset = () =>
    setState({
      prior: clampPct(initialPrior),
      sensitivity: clampPct(initialSensitivity),
      falsePositive: clampPct(initialFalsePositive),
    });

  const set = (id: Slider['id'], value: number) =>
    setState((prev) => ({ ...prev, [id]: clampPct(value) }));

  const { prior, sensitivity, falsePositive } = state;

  const { posterior, truePos, falsePos, positives, have } = useMemo(() => {
    const p = prior / 100;
    const s = sensitivity / 100;
    const f = falsePositive / 100;
    const N = populationSize;
    const haveIt = N * p;
    const tp = haveIt * s;
    const fp = N * (1 - p) * f;
    const pos = tp + fp;
    const post = pos > 0 ? (tp / pos) * 100 : 0;
    return { posterior: post, truePos: tp, falsePos: fp, positives: pos, have: haveIt };
  }, [prior, sensitivity, falsePositive, populationSize]);

  const sliders: Slider[] = [
    { id: 'prior', label: priorLabel, value: prior },
    { id: 'sensitivity', label: sensitivityLabel, value: sensitivity },
    { id: 'falsePositive', label: falsePositiveLabel, value: falsePositive },
  ];

  const readout = readoutTemplate
    .replace('{posterior}', pct1(posterior))
    .replace('{hypothesis}', hypothesisLabel)
    .replace('{evidence}', evidenceLabel);

  const frequencyLine = frequencyTemplate
    .replace('{positives}', whole(positives))
    .replace('{truePos}', whole(truePos))
    .replace('{falsePos}', whole(falsePos))
    .replace('{evidence}', evidenceLabel)
    .replace('{hypothesis}', hypothesisLabel);

  return (
    <figure className={cx('brutal my-6 bg-surface p-5 sm:p-6', className)}>
      <p className="font-display text-xs font-semibold uppercase tracking-wide text-brand-600">
        {eyebrow}
      </p>
      {title ? (
        <p className="mt-1 font-display text-lg font-semibold text-ink-900">{title}</p>
      ) : null}

      <p className="mt-2 text-sm font-medium text-ink-700">{instructions}</p>

      {/* The three inputs */}
      <ul className="mt-4 space-y-3">
        {sliders.map((s) => (
          <li key={`${reactId}-${s.id}`} className="grid grid-cols-[1fr_auto] items-center gap-x-3">
            <label
              htmlFor={`${reactId}-${s.id}`}
              className="text-[0.7rem] font-bold uppercase tracking-wide text-ink-600"
            >
              {s.label}
            </label>
            <span className="row-span-2 self-center text-right font-mono text-sm font-semibold text-ink-900">
              {pct1(s.value)}%
            </span>
            <input
              id={`${reactId}-${s.id}`}
              type="range"
              min={0}
              max={100}
              step={0.1}
              value={s.value}
              onChange={(e) => set(s.id, Number(e.target.value))}
              aria-valuetext={`${pct1(s.value)} percent`}
              className="col-start-1 h-1.5 w-full cursor-pointer accent-brand-600"
            />
          </li>
        ))}
      </ul>

      {/* Prior vs posterior bars — see how far the evidence actually moves you */}
      <div className="mt-5 space-y-3">
        <BeliefBar label={priorBarLabel} pct={prior} tone="muted" />
        <BeliefBar label={posteriorBarLabel} pct={posterior} tone="brand" />
      </div>

      {/* The live posterior + natural-frequency breakdown */}
      <div
        aria-live="polite"
        className="mt-5 rounded-card border-2 border-ink-200 bg-surface-sunken p-4"
      >
        <p className="font-display text-base font-semibold text-ink-900">{readout}</p>

        <p className="mt-2 text-xs font-bold uppercase tracking-wide text-ink-500">
          {breakdownLabel.replace('{n}', whole(populationSize))}
        </p>
        {/* Stacked natural-frequency strip: true positives vs false positives */}
        <div className="mt-2 flex h-3 w-full overflow-hidden rounded-pill bg-ink-100">
          <div
            className="h-full bg-success transition-[width] duration-300 ease-out motion-reduce:transition-none"
            style={{ width: `${positives > 0 ? (truePos / positives) * 100 : 0}%` }}
          />
          <div
            className="h-full bg-warning transition-[width] duration-300 ease-out motion-reduce:transition-none"
            style={{ width: `${positives > 0 ? (falsePos / positives) * 100 : 0}%` }}
          />
        </div>
        <p className="mt-2 text-sm text-ink-700">{frequencyLine}</p>
        <p className="mt-1 text-xs text-ink-500">
          <span className="font-semibold text-success">■</span> {truePosLabel} ·{' '}
          <span className="font-semibold text-warning">■</span> {falsePosLabel} ·{' '}
          {legendTemplate
            .replace('{have}', whole(have))
            .replace('{n}', whole(populationSize))
            .replace('{hypothesis}', hypothesisLabel)}
        </p>

        <button
          type="button"
          onClick={reset}
          className="brutal-btn mt-4 bg-surface px-4 py-2 text-sm text-ink-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
        >
          {resetLabel}
        </button>
      </div>

      {caption ? (
        <figcaption className="mt-3 text-sm text-ink-500">{caption}</figcaption>
      ) : null}
    </figure>
  );
}

/** A single labelled probability bar (0–100%). */
function BeliefBar({
  label,
  pct,
  tone,
}: {
  label: string;
  pct: number;
  tone: 'muted' | 'brand';
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[0.7rem] font-bold uppercase tracking-wide text-ink-500">{label}</span>
        <span className="font-mono text-sm font-semibold text-ink-900">{pct1(pct)}%</span>
      </div>
      <div className="mt-1 h-2.5 w-full overflow-hidden rounded-pill bg-surface-sunken">
        <div
          className={cx(
            'h-full rounded-pill transition-[width] duration-300 ease-out motion-reduce:transition-none',
            tone === 'brand' ? 'bg-brand-500' : 'bg-ink-300',
          )}
          style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
        />
      </div>
    </div>
  );
}

export default BayesCalculator;
