import { useId, useMemo, useState } from 'react';
import { cx } from '@/components/react/cx';

/** One mutually-exclusive option in an {@link OpportunityCostScenario}. */
export interface OpportunityCostOption {
  /** What the choice is ("Take the $95k job at BigCo"). */
  label: string;
  /**
   * A comparable worth on a single scale shared by every option in the
   * scenario. Used to find the *next-best forgone* alternative — the one true
   * opportunity cost — and to judge whether the pick was a sound trade.
   */
  value: number;
  /** One-line gloss of the payoff ("Stable, but caps your upside"). */
  detail?: string;
}

/** A single decision the learner works through. */
export interface OpportunityCostScenario {
  /** The question put to the learner ("How do you spend the one free Saturday?"). */
  prompt: string;
  /** The scarce thing being spent ("One free Saturday", "$10,000", "One engineer-month"). */
  resource: string;
  /**
   * The options on the table. At least two — opportunity cost only exists when
   * there's a road not taken. Author them in any order; the island finds the
   * best forgone alternative itself.
   */
  options: OpportunityCostOption[];
  /** How to render each option's `value` (e.g. `'k/yr'`, `' pts'`, `'%'`). */
  unit?: string;
}

/** Props for the {@link OpportunityCostChooser} island. */
export interface OpportunityCostChooserProps {
  /** The decisions to work through. Renders a stepper when there's more than one. */
  scenarios: OpportunityCostScenario[];
  /** Heading above the card. */
  title?: string;
  /** Eyebrow label. Defaults to `'Compared to what?'`. */
  eyebrow?: string;
  /** Instruction line above the options. */
  instructions?: string;
  /** Caption beneath the card. */
  caption?: string;
  /** Label on the scarce-resource chip. Defaults to `'You can spend, once:'`. */
  resourceLabel?: string;
  /** Heading on the chosen option in the verdict. Defaults to `'You chose'`. */
  choiceLabel?: string;
  /** Heading on the opportunity-cost line. Defaults to `'Opportunity cost'`. */
  costLabel?: string;
  /** Gloss after the cost heading. Defaults to `'the single best thing you gave up'`. */
  costHint?: string;
  /** Heading on the "other forgone but uncounted" list. Defaults to `'Also on the table'`. */
  alsoLabel?: string;
  /** Gloss on that list. Defaults to `'given up too — but not your opportunity cost'`. */
  alsoHint?: string;
  /** Verdict when the pick is the highest-value option. `{cost}` is replaced. */
  soundVerdict?: string;
  /** Verdict when a better alternative was forgone. `{cost}` is replaced. */
  costlyVerdict?: string;
  /** Verb shown before a value, e.g. `'worth'`. Defaults to `'worth'`. */
  worthLabel?: string;
  /** Stepper position template; `{n}`/`{total}` are replaced. Defaults to `'Decision {n} of {total}'`. */
  stepLabel?: string;
  /** Label of the "previous scenario" button. Defaults to `'Previous'`. */
  prevLabel?: string;
  /** Label of the "next scenario" button. Defaults to `'Next'`. */
  nextLabel?: string;
  /** Label of the reset button. Defaults to `'Choose again'`. */
  resetLabel?: string;
  /** Extra classes merged onto the root element. */
  className?: string;
}

/** Format a value with its optional unit. */
function fmt(value: number, unit?: string): string {
  return unit ? `${value}${unit}` : `${value}`;
}

/**
 * Interactive **opportunity-cost chooser** — "the real cost of anything is the
 * next-best thing you gave up to get it," made tangible.
 *
 * Each scenario hands the learner a single scarce resource and a menu of
 * mutually-exclusive options. Picking one reveals the move that defines the
 * model: the island ignores the *sum* of everything forgone and surfaces only
 * the **single best alternative not taken** — that one is the opportunity cost.
 * It then judges the trade: if a better option was left on the table, the pick
 * cost more than it gained. The subtle, often-missed point the island teaches by
 * construction is that opportunity cost is the *one* next-best forgone, not the
 * pile of all the roads not taken.
 *
 * The options are a real `radiogroup` of `<button>`s with `aria-checked`, the
 * verdict is announced via `aria-live`, only the relevant panel is in the DOM,
 * and the reveal degrades to an instant swap under `prefers-reduced-motion`.
 * Fully keyboard-operable.
 */
export function OpportunityCostChooser({
  scenarios,
  title,
  eyebrow = 'Compared to what?',
  instructions = 'Pick one — you can’t have both. Then see the single best thing you gave up: that, not the price tag, is the real cost.',
  caption,
  resourceLabel = 'You can spend, once:',
  choiceLabel = 'You chose',
  costLabel = 'Opportunity cost',
  costHint = 'the single best thing you gave up',
  alsoLabel = 'Also on the table',
  alsoHint = 'given up too — but not your opportunity cost',
  soundVerdict = 'A sound trade: nothing you gave up was worth more than what you got. The best forgone option ({cost}) is your opportunity cost — real, but smaller than your gain.',
  costlyVerdict = 'Look again: the best option you passed up ({cost}) is worth MORE than what you chose. On these numbers the opportunity cost outweighs the gain — a trade worth rethinking.',
  worthLabel = 'worth',
  stepLabel = 'Decision {n} of {total}',
  prevLabel = 'Previous',
  nextLabel = 'Next',
  resetLabel = 'Choose again',
  className,
}: OpportunityCostChooserProps) {
  // Fail the build on a mis-authored set rather than shipping a broken island.
  if (!Array.isArray(scenarios) || scenarios.length === 0) {
    throw new Error('OpportunityCostChooser: needs at least one scenario.');
  }
  const bad = scenarios.find((s) => !s?.prompt?.trim() || (s?.options?.length ?? 0) < 2);
  if (bad) {
    throw new Error(
      `OpportunityCostChooser: every scenario needs a prompt and at least two ` +
        `options. Offending scenario: "${bad?.prompt ?? '(missing prompt)'}".`,
    );
  }

  const reactId = useId();
  const [step, setStep] = useState(0);
  // One selection slot per scenario, so moving between decisions keeps answers.
  const [picks, setPicks] = useState<Array<number | null>>(() => scenarios.map(() => null));

  const scenario = scenarios[step];
  const picked = picks[step];

  // The best alternative *not* chosen — the lone option that is the true
  // opportunity cost. Recomputed only when the pick or scenario changes.
  const analysis = useMemo(() => {
    if (picked == null) return null;
    const chosen = scenario.options[picked];
    const others = scenario.options
      .map((opt, i) => ({ opt, i }))
      .filter((o) => o.i !== picked);
    const bestForgone = others.reduce((best, o) =>
      o.opt.value > best.opt.value ? o : best,
    );
    const rest = others.filter((o) => o.i !== bestForgone.i);
    return {
      chosen,
      bestForgone: bestForgone.opt,
      rest: rest.map((o) => o.opt),
      sound: chosen.value >= bestForgone.opt.value,
    };
  }, [picked, scenario]);

  const select = (i: number) =>
    setPicks((prev) => prev.map((v, j) => (j === step ? i : v)));
  const reset = () =>
    setPicks((prev) => prev.map((v, j) => (j === step ? null : v)));

  const verdict = analysis
    ? (analysis.sound ? soundVerdict : costlyVerdict).replace(
        '{cost}',
        `${analysis.bestForgone.label} — ${worthLabel} ${fmt(analysis.bestForgone.value, scenario.unit)}`,
      )
    : '';

  return (
    <figure className={cx('brutal my-6 bg-surface p-5 sm:p-6', className)}>
      <p className="font-display text-xs font-semibold uppercase tracking-wide text-brand-600">
        {eyebrow}
      </p>
      {title ? (
        <p className="mt-1 font-display text-lg font-semibold text-ink-900">{title}</p>
      ) : null}

      {scenarios.length > 1 ? (
        <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-ink-400">
          {stepLabel.replace('{n}', String(step + 1)).replace('{total}', String(scenarios.length))}
        </p>
      ) : null}

      <p className="mt-3 text-sm font-medium text-ink-700">{instructions}</p>

      {/* The scarce resource: the budget every option is spent against. */}
      <p className="mt-4 flex flex-wrap items-baseline gap-2">
        <span className="text-[0.65rem] font-bold uppercase tracking-wide text-ink-500">
          {resourceLabel}
        </span>
        <span className="inline-flex items-center rounded-pill bg-surface-sunken px-3 py-1 font-display text-sm font-semibold text-ink-900">
          {scenario.resource}
        </span>
      </p>

      <p className="mt-3 font-display text-base font-semibold text-ink-900">{scenario.prompt}</p>

      {/* Options — a radiogroup; the chosen one stays highlighted. */}
      <ul role="radiogroup" aria-label={scenario.prompt} className="mt-3 grid gap-2 sm:grid-cols-2">
        {scenario.options.map((opt, i) => {
          const on = picked === i;
          const isCost = analysis != null && !on && opt === analysis.bestForgone;
          return (
            <li key={`${reactId}-${step}-${i}`}>
              <button
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => select(i)}
                className={cx(
                  'flex h-full w-full flex-col rounded-card border-2 p-3 text-left transition-colors',
                  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600',
                  on
                    ? 'border-brand-500 bg-brand-50'
                    : isCost
                      ? 'border-warning bg-warning/10'
                      : 'border-ink-200 bg-surface hover:border-brand-400 hover:bg-brand-50/50',
                )}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="font-medium text-ink-900">{opt.label}</span>
                  <span className="shrink-0 font-mono text-xs font-semibold text-ink-500">
                    {fmt(opt.value, scenario.unit)}
                  </span>
                </span>
                {opt.detail ? (
                  <span className="mt-1 text-sm leading-snug text-ink-600">{opt.detail}</span>
                ) : null}
                {on ? (
                  <span className="mt-2 inline-flex w-fit items-center rounded-pill bg-brand-600 px-2 py-0.5 text-[0.6rem] font-bold uppercase tracking-wide text-white">
                    {choiceLabel}
                  </span>
                ) : isCost ? (
                  <span className="mt-2 inline-flex w-fit items-center rounded-pill bg-warning px-2 py-0.5 text-[0.6rem] font-bold uppercase tracking-wide text-white">
                    {costLabel}
                  </span>
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>

      {/* The verdict — the model doing its work. */}
      <div aria-live="polite">
        {analysis ? (
          <div className="mt-4 rounded-card border-2 border-ink-200 bg-surface-sunken p-4 motion-safe:animate-fade-up">
            <p className="text-sm text-ink-700">
              <span className="font-semibold text-ink-900">{costLabel}</span>{' '}
              <span className="text-ink-500">({costHint}):</span>{' '}
              <span className="font-semibold text-ink-900">{analysis.bestForgone.label}</span>{' '}
              <span className="text-ink-500">
                — {worthLabel} {fmt(analysis.bestForgone.value, scenario.unit)}
              </span>
            </p>

            <p
              className={cx(
                'mt-3 rounded-card border-l-4 p-3 text-sm font-medium',
                analysis.sound
                  ? 'border-success bg-success/10 text-ink-800'
                  : 'border-warning bg-warning/10 text-ink-800',
              )}
            >
              {verdict}
            </p>

            {analysis.rest.length ? (
              <div className="mt-3">
                <p className="text-[0.65rem] font-bold uppercase tracking-wide text-ink-500">
                  {alsoLabel} <span className="font-normal normal-case text-ink-400">— {alsoHint}</span>
                </p>
                <ul className="mt-1 space-y-0.5">
                  {analysis.rest.map((opt, i) => (
                    <li key={`${reactId}-rest-${i}`} className="text-sm text-ink-500">
                      {opt.label}{' '}
                      <span className="text-ink-400">({fmt(opt.value, scenario.unit)})</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <button
              type="button"
              onClick={reset}
              className="brutal-btn mt-4 bg-surface px-4 py-2 text-sm text-ink-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
            >
              {resetLabel}
            </button>
          </div>
        ) : null}
      </div>

      {/* Scenario stepper. */}
      {scenarios.length > 1 ? (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0}
            className="brutal-btn bg-surface px-4 py-2 text-sm text-ink-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {prevLabel}
          </button>
          <button
            type="button"
            onClick={() => setStep((s) => Math.min(scenarios.length - 1, s + 1))}
            disabled={step === scenarios.length - 1}
            className="brutal-btn bg-brand-600 px-4 py-2 text-sm text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {nextLabel}
          </button>
        </div>
      ) : null}

      {caption ? (
        <figcaption className="mt-3 text-sm text-ink-500">{caption}</figcaption>
      ) : null}
    </figure>
  );
}

export default OpportunityCostChooser;
