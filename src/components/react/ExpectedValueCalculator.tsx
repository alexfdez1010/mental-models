import { useId, useMemo, useState } from 'react';
import { cx } from '@/components/react/cx';

/** One possible outcome of a bet/decision in an {@link ExpectedValueScenario}. */
export interface ExpectedValueOutcome {
  /** What this outcome is ("The startup is acquired"). */
  label: string;
  /** The payoff if this outcome happens, on a single shared scale. May be negative. */
  payoff: number;
  /** Starting probability of this outcome, as a percent (0–100). Adjustable by the learner. */
  prob: number;
  /** Optional one-line gloss shown under the label. */
  note?: string;
}

/** A single decision whose expected value the learner explores. */
export interface ExpectedValueScenario {
  /** The question/decision ("Should you take the bet?"). */
  prompt: string;
  /** The mutually-exclusive outcomes. Their probabilities should total 100%. */
  outcomes: ExpectedValueOutcome[];
  /** Symbol shown with each payoff (e.g. `'$'`, `'€'`, `' pts'`). */
  unit?: string;
  /** Where the unit sits relative to the number. Defaults to `'prefix'`. */
  unitPosition?: 'prefix' | 'suffix';
  /**
   * Optional price you pay to take the bet. When given, the island compares the
   * expected value against this cost and renders a "worth it / not worth it"
   * verdict — the whole point of EV as a decision tool.
   */
  cost?: number;
}

/** Props for the {@link ExpectedValueCalculator} island. */
export interface ExpectedValueCalculatorProps {
  /** The decision to explore. */
  scenario: ExpectedValueScenario;
  /** Heading above the card. */
  title?: string;
  /** Eyebrow label. Defaults to `'Expected value'`. */
  eyebrow?: string;
  /** Instruction line above the outcomes. */
  instructions?: string;
  /** Caption beneath the card. */
  caption?: string;
  /** Column header over the probability sliders. Defaults to `'Probability'`. */
  probabilityLabel?: string;
  /** Column header over the payoffs. Defaults to `'Payoff'`. */
  payoffLabel?: string;
  /** Column header over the per-outcome contribution. Defaults to `'Contribution'`. */
  contributionLabel?: string;
  /** Label for the running probability total. Defaults to `'Probabilities total'`. */
  totalProbLabel?: string;
  /** Nudge shown when probabilities don't total 100%. `{sum}` is replaced. */
  normalizeHint?: string;
  /** Label on the expected-value result. Defaults to `'Expected value'`. */
  evLabel?: string;
  /** Gloss after the EV result. Defaults to the Σ formula in words. */
  evHint?: string;
  /** Label on the cost line. Defaults to `'Cost to play'`. */
  costLabel?: string;
  /** Label on the net (EV − cost) line. Defaults to `'Net expected value'`. */
  netLabel?: string;
  /** Verdict when net EV is positive. Defaults provided. */
  worthVerdict?: string;
  /** Verdict when net EV is negative. Defaults provided. */
  notWorthVerdict?: string;
  /** Verdict when net EV is ~zero. Defaults provided. */
  breakEvenVerdict?: string;
  /** Label of the reset button. Defaults to `'Reset probabilities'`. */
  resetLabel?: string;
  /** Extra classes merged onto the root element. */
  className?: string;
}

/** Format a value with its unit, placing a minus sign before any unit prefix. */
function fmt(value: number, unit = '', position: 'prefix' | 'suffix' = 'prefix'): string {
  const rounded = Math.round(value * 100) / 100;
  const sign = rounded < 0 ? '-' : '';
  const abs = Math.abs(rounded).toLocaleString('en-US', { maximumFractionDigits: 2 });
  if (!unit) return `${sign}${abs}`;
  return position === 'prefix' ? `${sign}${unit}${abs}` : `${sign}${abs}${unit}`;
}

/**
 * Interactive **expected-value calculator** — "weigh each outcome by how likely
 * it is, not by how vivid it feels."
 *
 * The learner is handed a decision with several mutually-exclusive outcomes, each
 * with a payoff and an adjustable probability. Dragging a slider recomputes, live,
 * every outcome's *contribution* (probability × payoff) and their sum — the
 * **expected value**, EV = Σ(pᵢ × payoffᵢ). When the scenario carries a `cost`,
 * the island subtracts it and delivers the verdict EV is built to give: is the bet
 * worth taking? The probability total is shown with a gentle nudge when it strays
 * from 100%, which teaches the constraint that a probability distribution must sum
 * to one by letting the learner feel it.
 *
 * Each probability is a native `range` input with a visible label, the result is
 * announced via `aria-live`, contribution bars are scaled to the largest absolute
 * contribution, and every transition degrades gracefully under
 * `prefers-reduced-motion`. Fully keyboard-operable.
 */
export function ExpectedValueCalculator({
  scenario,
  title,
  eyebrow = 'Expected value',
  instructions = 'Drag each probability. The expected value is every payoff weighted by how likely it is — watch it move.',
  caption,
  probabilityLabel = 'Probability',
  payoffLabel = 'Payoff',
  contributionLabel = 'Contribution',
  totalProbLabel = 'Probabilities total',
  normalizeHint = 'A probability distribution must total 100% — right now it sums to {sum}.',
  evLabel = 'Expected value',
  evHint = 'the sum of every payoff weighted by its probability',
  costLabel = 'Cost to play',
  netLabel = 'Net expected value',
  worthVerdict = 'On these numbers the bet pays: the expected value clears the cost, so repeated many times it wins on average.',
  notWorthVerdict = 'On these numbers the bet loses: the expected value falls short of the cost, so repeated many times it bleeds money on average.',
  breakEvenVerdict = 'This is roughly a coin-flip on value: the expected value barely covers the cost, so the edge is negligible.',
  resetLabel = 'Reset probabilities',
  className,
}: ExpectedValueCalculatorProps) {
  // Fail the build on a mis-authored scenario rather than shipping a broken island.
  if (!scenario?.prompt?.trim() || (scenario?.outcomes?.length ?? 0) < 2) {
    throw new Error(
      'ExpectedValueCalculator: scenario needs a prompt and at least two outcomes.',
    );
  }

  const reactId = useId();
  const { unit, unitPosition = 'prefix', cost } = scenario;

  const [probs, setProbs] = useState<number[]>(() =>
    scenario.outcomes.map((o) => Math.max(0, Math.min(100, o.prob))),
  );

  const setProb = (i: number, value: number) =>
    setProbs((prev) => prev.map((p, j) => (j === i ? value : p)));
  const reset = () =>
    setProbs(scenario.outcomes.map((o) => Math.max(0, Math.min(100, o.prob))));

  const { contributions, ev, sum, maxAbs } = useMemo(() => {
    const contribs = scenario.outcomes.map((o, i) => (probs[i] / 100) * o.payoff);
    const total = probs.reduce((a, b) => a + b, 0);
    const expected = contribs.reduce((a, b) => a + b, 0);
    const peak = Math.max(1, ...contribs.map((c) => Math.abs(c)));
    return { contributions: contribs, ev: expected, sum: total, maxAbs: peak };
  }, [probs, scenario.outcomes]);

  const sumOk = Math.abs(sum - 100) < 0.5;
  const net = cost == null ? null : ev - cost;
  const verdict =
    net == null
      ? null
      : net > 0.5
        ? worthVerdict
        : net < -0.5
          ? notWorthVerdict
          : breakEvenVerdict;

  return (
    <figure className={cx('brutal my-6 bg-surface p-5 sm:p-6', className)}>
      <p className="font-display text-xs font-semibold uppercase tracking-wide text-brand-600">
        {eyebrow}
      </p>
      {title ? (
        <p className="mt-1 font-display text-lg font-semibold text-ink-900">{title}</p>
      ) : null}

      <p className="mt-2 text-sm font-medium text-ink-700">{instructions}</p>

      <p className="mt-4 font-display text-base font-semibold text-ink-900">{scenario.prompt}</p>

      {/* Column headers */}
      <div className="mt-4 grid grid-cols-[1fr_auto] gap-x-3 text-[0.65rem] font-bold uppercase tracking-wide text-ink-500 sm:grid-cols-[1.6fr_1fr_auto]">
        <span>{probabilityLabel}</span>
        <span className="hidden text-right sm:block">{payoffLabel}</span>
        <span className="text-right">{contributionLabel}</span>
      </div>

      <ul className="mt-1 divide-y divide-ink-100">
        {scenario.outcomes.map((o, i) => {
          const contrib = contributions[i];
          const barPct = Math.round((Math.abs(contrib) / maxAbs) * 100);
          return (
            <li key={`${reactId}-${i}`} className="grid grid-cols-[1fr_auto] gap-x-3 py-3 sm:grid-cols-[1.6fr_1fr_auto]">
              {/* Label + probability slider */}
              <div className="min-w-0">
                <label htmlFor={`${reactId}-slider-${i}`} className="block font-medium text-ink-900">
                  {o.label}
                </label>
                {o.note ? (
                  <span className="mt-0.5 block text-xs leading-snug text-ink-500">{o.note}</span>
                ) : null}
                <div className="mt-2 flex items-center gap-2">
                  <input
                    id={`${reactId}-slider-${i}`}
                    type="range"
                    min={0}
                    max={100}
                    step={1}
                    value={probs[i]}
                    onChange={(e) => setProb(i, Number(e.target.value))}
                    aria-label={`${probabilityLabel}: ${o.label}`}
                    className="h-1.5 w-full max-w-[12rem] cursor-pointer accent-brand-600"
                  />
                  <span className="w-12 shrink-0 text-right font-mono text-xs font-semibold text-ink-700">
                    {probs[i]}%
                  </span>
                </div>
              </div>

              {/* Payoff (hidden on narrow screens, shown inline in the bar there) */}
              <span className="hidden self-center text-right font-mono text-sm text-ink-600 sm:block">
                {fmt(o.payoff, unit, unitPosition)}
              </span>

              {/* Contribution + bar */}
              <div className="self-center text-right">
                <span
                  className={cx(
                    'font-mono text-sm font-semibold',
                    contrib < 0 ? 'text-danger' : 'text-ink-900',
                  )}
                >
                  {fmt(contrib, unit, unitPosition)}
                </span>
                <span className="mt-1 block text-[0.65rem] text-ink-400 sm:hidden">
                  {probs[i]}% × {fmt(o.payoff, unit, unitPosition)}
                </span>
                <div className="mt-1 h-1.5 w-full overflow-hidden rounded-pill bg-surface-sunken">
                  <div
                    className={cx(
                      'h-full rounded-pill transition-[width] duration-300 ease-out motion-reduce:transition-none',
                      contrib < 0 ? 'bg-danger' : 'bg-brand-500',
                    )}
                    style={{ width: `${barPct}%` }}
                  />
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      {/* Probability total meter */}
      <div className="mt-3 flex flex-wrap items-baseline justify-between gap-2 text-sm">
        <span className="text-[0.65rem] font-bold uppercase tracking-wide text-ink-500">
          {totalProbLabel}
        </span>
        <span
          className={cx(
            'font-mono font-semibold',
            sumOk ? 'text-success' : 'text-warning',
          )}
        >
          {Math.round(sum)}%
        </span>
      </div>
      {!sumOk ? (
        <p className="mt-1 text-xs font-medium text-warning" role="status">
          {normalizeHint.replace('{sum}', `${Math.round(sum)}%`)}
        </p>
      ) : null}

      {/* The expected value — the model doing its work */}
      <div aria-live="polite" className="mt-4 rounded-card border-2 border-ink-200 bg-surface-sunken p-4">
        <p className="flex flex-wrap items-baseline justify-between gap-2">
          <span>
            <span className="font-semibold text-ink-900">{evLabel}</span>{' '}
            <span className="text-xs text-ink-500">({evHint})</span>
          </span>
          <span
            className={cx(
              'font-display text-xl font-bold',
              ev < 0 ? 'text-danger' : 'text-ink-900',
            )}
          >
            {fmt(ev, unit, unitPosition)}
          </span>
        </p>

        {net != null ? (
          <>
            <div className="mt-3 space-y-1 border-t border-ink-200 pt-3 text-sm">
              <p className="flex items-baseline justify-between gap-2 text-ink-600">
                <span>{costLabel}</span>
                <span className="font-mono">−{fmt(Math.abs(cost ?? 0), unit, unitPosition)}</span>
              </p>
              <p className="flex items-baseline justify-between gap-2">
                <span className="font-semibold text-ink-900">{netLabel}</span>
                <span
                  className={cx(
                    'font-mono font-bold',
                    net < 0 ? 'text-danger' : 'text-success',
                  )}
                >
                  {fmt(net, unit, unitPosition)}
                </span>
              </p>
            </div>
            <p
              className={cx(
                'mt-3 rounded-card border-l-4 p-3 text-sm font-medium',
                net > 0.5
                  ? 'border-success bg-success/10 text-ink-800'
                  : net < -0.5
                    ? 'border-danger bg-danger/10 text-ink-800'
                    : 'border-warning bg-warning/10 text-ink-800',
              )}
            >
              {verdict}
            </p>
          </>
        ) : null}

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

export default ExpectedValueCalculator;
