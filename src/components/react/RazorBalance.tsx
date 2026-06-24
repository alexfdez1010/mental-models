import { useId, useMemo, useState } from 'react';
import { cx } from '@/components/react/cx';

/** One candidate explanation for a claim, with the assumptions it quietly requires. */
export interface RazorExplanation {
  /** Short label for the explanation ("It's a bug in our code"). */
  label: string;
  /** The assumptions this explanation needs to be true. Fewer = leaner. */
  assumptions: string[];
  /** Optional one-line note shown once the razor is applied. */
  note?: string;
}

/** A claim plus the competing explanations the learner weighs with Occam's razor. */
export interface RazorScenario {
  /** The thing to be explained ("The website went down at 3am"). */
  claim: string;
  /** Two or more competing explanations. The leanest is Occam's pick. */
  explanations: RazorExplanation[];
}

/** Props for the {@link RazorBalance} island. */
export interface RazorBalanceProps {
  /** Heading above the card. */
  title?: string;
  /** Eyebrow label. Defaults to `"Occam’s razor"`. */
  eyebrow?: string;
  /** Instruction line above the explanations. */
  instructions?: string;
  /** One or more scenarios. Each is a claim with competing explanations. */
  scenarios: RazorScenario[];
  /** Label above each explanation's assumption list. Defaults to `"Assumes:"`. */
  assumptionsLabel?: string;
  /** Singular noun for one assumption. Defaults to `"assumption"`. */
  assumptionWord?: string;
  /** Plural noun for the assumption count. Defaults to `"assumptions"`. */
  assumptionWordPlural?: string;
  /** Button that highlights the leanest explanation. Defaults to `"Apply Occam’s razor"`. */
  applyLabel?: string;
  /** Reset button label. Defaults to `"Reset"`. */
  resetLabel?: string;
  /** Badge on the chosen (leanest) explanation. Defaults to `"Occam’s pick — fewest assumptions"`. */
  pickLabel?: string;
  /** Previous-scenario button label. Defaults to `"← Previous"`. */
  prevLabel?: string;
  /** Next-scenario button label. Defaults to `"Next →"`. */
  nextLabel?: string;
  /** Word joining the scenario counter, e.g. "1 of 3". Defaults to `"of"`. */
  ofLabel?: string;
  /** Standing reminder that the leaner pick is a prior, not a proof. */
  caption?: string;
  /** Extra classes merged onto the root element. */
  className?: string;
}

/**
 * Interactive **Occam's razor** island: a claim with two or more competing
 * explanations, each carrying the assumptions it quietly needs to be true. The
 * learner reads the explanations, then "applies the razor" — the island counts
 * the assumptions each one requires and highlights the **leanest** as the one
 * Occam's razor prefers (fewest assumptions = fewest ways to be wrong).
 *
 * The caption keeps the lesson honest: the lean pick is a *prior*, not a proof —
 * the razor is a tie-breaker, not a verdict.
 *
 * Fully keyboard-operable: the apply/reset controls and the scenario stepper are
 * real `<button>`s, the result region is `aria-live`, and the reveal degrades to
 * an instant state change under `prefers-reduced-motion`.
 */
export function RazorBalance({
  title,
  eyebrow = 'Occam’s razor',
  instructions = 'Two explanations for the same thing. Count what each one quietly assumes, then apply the razor:',
  scenarios,
  assumptionsLabel = 'Assumes:',
  assumptionWord = 'assumption',
  assumptionWordPlural = 'assumptions',
  applyLabel = 'Apply Occam’s razor',
  resetLabel = 'Reset',
  pickLabel = 'Occam’s pick — fewest assumptions',
  prevLabel = '← Previous',
  nextLabel = 'Next →',
  ofLabel = 'of',
  caption = 'The leaner explanation is the better first guess — a prior, not a proof. The razor breaks ties; it does not declare winners.',
  className,
}: RazorBalanceProps) {
  // Fail the build on a mis-authored set rather than shipping a broken island.
  if (!Array.isArray(scenarios) || scenarios.length < 1) {
    throw new Error('RazorBalance: needs at least one `scenario`.');
  }
  scenarios.forEach((s, i) => {
    if (!s?.claim?.trim()) {
      throw new Error(`RazorBalance: scenario ${i} is missing a \`claim\`.`);
    }
    if (!Array.isArray(s.explanations) || s.explanations.length < 2) {
      throw new Error(
        `RazorBalance: scenario "${s.claim}" needs at least two \`explanations\`.`,
      );
    }
  });

  const reactId = useId();
  const [step, setStep] = useState(0);
  const [applied, setApplied] = useState<boolean[]>(() => scenarios.map(() => false));

  const scenario = scenarios[step];
  const isApplied = applied[step];

  // The minimum assumption count among this scenario's explanations.
  const minCount = useMemo(
    () => Math.min(...scenario.explanations.map((e) => e.assumptions.length)),
    [scenario],
  );

  const apply = () =>
    setApplied((prev) => prev.map((v, i) => (i === step ? true : v)));
  const reset = () =>
    setApplied((prev) => prev.map((v, i) => (i === step ? false : v)));

  const go = (delta: number) =>
    setStep((s) => Math.min(scenarios.length - 1, Math.max(0, s + delta)));

  const countWord = (n: number) => (n === 1 ? assumptionWord : assumptionWordPlural);

  return (
    <figure className={cx('brutal my-6 bg-surface p-5 sm:p-6', className)}>
      <p className="font-display text-xs font-semibold uppercase tracking-wide text-brand-600">
        {eyebrow}
      </p>
      {title ? (
        <p className="mt-1 font-display text-lg font-semibold text-ink-900">{title}</p>
      ) : null}

      <p className="mt-3 text-sm font-medium text-ink-700">{instructions}</p>

      {/* The claim */}
      <p className="mt-3 rounded-card border-2 border-ink-200 bg-surface-sunken px-4 py-3 text-sm font-semibold text-ink-900">
        <span className="mr-1 text-base" aria-hidden>
          ❓
        </span>
        {scenario.claim}
      </p>

      {/* The competing explanations */}
      <ul className="mt-3 grid gap-3 sm:grid-cols-2">
        {scenario.explanations.map((e, i) => {
          const n = e.assumptions.length;
          const isPick = isApplied && n === minCount;
          return (
            <li key={`${reactId}-${step}-${i}`}>
              <div
                className={cx(
                  'flex h-full flex-col rounded-card border-2 p-4 transition-colors',
                  isPick
                    ? 'border-brand-500 bg-brand-50'
                    : isApplied
                      ? 'border-ink-200 bg-surface opacity-70'
                      : 'border-ink-200 bg-surface',
                )}
              >
                <p className="font-display text-sm font-semibold text-ink-900">
                  {e.label}
                </p>

                <p className="mt-2 text-[0.65rem] font-bold uppercase tracking-wide text-ink-500">
                  {assumptionsLabel}
                </p>
                <ul className="mt-1 space-y-1">
                  {e.assumptions.map((a, j) => (
                    <li
                      key={`${reactId}-${step}-${i}-a${j}`}
                      className="flex items-start gap-1.5 text-sm leading-snug text-ink-700"
                    >
                      <span className="mt-0.5 text-brand-500" aria-hidden>
                        •
                      </span>
                      <span>{a}</span>
                    </li>
                  ))}
                </ul>

                <p
                  className={cx(
                    'mt-3 inline-flex w-fit items-center gap-1.5 rounded-pill px-2 py-0.5 text-[0.7rem] font-bold tabular-nums',
                    isPick ? 'bg-brand-600 text-white' : 'bg-surface-sunken text-ink-600',
                  )}
                >
                  {n} {countWord(n)}
                </p>

                {isPick ? (
                  <p className="mt-2 block animate-fade-up text-xs font-bold text-brand-700 motion-reduce:animate-none">
                    ✓ {pickLabel}
                  </p>
                ) : null}

                {isApplied && e.note ? (
                  <p className="mt-2 border-t border-ink-200 pt-2 text-sm leading-snug text-ink-600">
                    {e.note}
                  </p>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>

      {/* Controls */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {!isApplied ? (
          <button
            type="button"
            onClick={apply}
            className="brutal-btn bg-brand-600 px-4 py-2 text-sm text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
          >
            {applyLabel}
          </button>
        ) : (
          <button
            type="button"
            onClick={reset}
            className="brutal-btn bg-surface px-4 py-2 text-sm text-ink-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
          >
            {resetLabel}
          </button>
        )}

        {scenarios.length > 1 ? (
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={() => go(-1)}
              disabled={step === 0}
              className="brutal-btn bg-surface px-3 py-2 text-sm text-ink-700 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
            >
              {prevLabel}
            </button>
            <span className="text-sm tabular-nums text-ink-500">
              {step + 1} {ofLabel} {scenarios.length}
            </span>
            <button
              type="button"
              onClick={() => go(1)}
              disabled={step === scenarios.length - 1}
              className="brutal-btn bg-surface px-3 py-2 text-sm text-ink-700 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
            >
              {nextLabel}
            </button>
          </div>
        ) : null}
      </div>

      <p aria-live="polite" className="sr-only">
        {isApplied
          ? `Occam’s razor favours the explanation with ${minCount} ${countWord(minCount)}.`
          : ''}
      </p>

      {caption ? (
        <figcaption className="mt-3 text-sm text-ink-500">{caption}</figcaption>
      ) : null}
    </figure>
  );
}

export default RazorBalance;
