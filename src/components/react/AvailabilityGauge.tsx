import { useId, useMemo, useState } from 'react';
import { cx } from '@/components/react/cx';

/** One cause/event compared on two scales: how *available* it is vs how *frequent*. */
export interface AvailabilityItem {
  /** What the row is ("Terrorism", "Heart disease"). */
  label: string;
  /**
   * The **availability** signal — how loudly the item shouts for attention:
   * its share of news coverage, fear, or how easily an example springs to
   * mind. This is what the heuristic mistakes for frequency. Any positive
   * scale (the component normalizes to the largest value shown).
   */
  perceived: number;
  /**
   * The **actual** frequency — its true share of deaths/occurrences. Same
   * units as every other row's `actual`.
   */
  actual: number;
  /** Optional one-line note revealed beside the actual bar. */
  note?: string;
}

/** Props for the {@link AvailabilityGauge} island. */
export interface AvailabilityGaugeProps {
  /** The rows to compare. Rendered in the order given (sort before passing). */
  items: AvailabilityItem[];
  /** Heading above the chart. */
  title?: string;
  /** Eyebrow label. Defaults to `'Availability vs reality'`. */
  eyebrow?: string;
  /** Instruction line above the chart. */
  instructions?: string;
  /** Legend label for the perceived/availability bars. Defaults to `'How available it feels'`. */
  perceivedLabel?: string;
  /** Legend label for the actual-frequency bars. Defaults to `'How often it actually happens'`. */
  actualLabel?: string;
  /** Button text that reveals the actual bars. Defaults to `'Reveal what actually happens'`. */
  revealLabel?: string;
  /** Button text once revealed (hides the actual bars again). Defaults to `'Hide reality'`. */
  hideLabel?: string;
  /** Unit suffix shown after each number. Defaults to `'%'`. */
  unit?: string;
  /** Caption beneath the chart. */
  caption?: string;
  /**
   * Sentence announced (via `aria-live`) when reality is revealed. `{count}`
   * is replaced with the number of rows. A bilingual-friendly default is given.
   */
  revealAnnouncement?: string;
  /** Extra classes merged onto the root element. */
  className?: string;
}

/** Round to at most one decimal, dropping a trailing `.0`. */
function numText(n: number): string {
  const rounded = Math.round(n * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

/**
 * Interactive **availability-heuristic gauge** — the gap between what *feels*
 * common and what *is* common, made visible.
 *
 * The availability heuristic estimates how likely or frequent something is by
 * how easily an example comes to mind — so vivid, scary, heavily covered events
 * feel far more common than they are. This island draws each cause twice: once
 * by how loudly it grabs attention (its share of news coverage / fear — the
 * "available" signal) and once by how often it *actually* happens. The learner
 * first sees only the attention bars, forms an impression of "what's deadly,"
 * then reveals the reality bars and watches the ranking lurch — terrorism and
 * sharks collapse, heart disease and diabetes tower. The mismatch *is* the bias.
 *
 * The reveal is a single button (keyboard-operable), the result is announced via
 * `aria-live`, bars are decorative for screen readers (the numbers carry the
 * meaning), and widths transition gently — instantly under
 * `prefers-reduced-motion`.
 */
export function AvailabilityGauge({
  items,
  title,
  eyebrow = 'Availability vs reality',
  instructions = 'These bars show how much attention each cause grabs. Before you reveal the second set, guess: which one actually happens most? Then reveal reality.',
  perceivedLabel = 'How available it feels (attention / fear)',
  actualLabel = 'How often it actually happens',
  revealLabel = 'Reveal what actually happens',
  hideLabel = 'Hide reality',
  unit = '%',
  caption,
  revealAnnouncement = 'Reality revealed across {count} causes — notice how far the attention ranking drifts from the real one.',
  className,
}: AvailabilityGaugeProps) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('AvailabilityGauge: `items` must be a non-empty array.');
  }

  const reactId = useId();
  const [revealed, setRevealed] = useState(false);

  // Normalize every bar to the single largest value shown, so the two scales
  // share one axis and the mismatch is honest rather than cosmetic.
  const max = useMemo(
    () => Math.max(...items.flatMap((it) => [it.perceived, it.actual]), 1),
    [items],
  );

  return (
    <figure className={cx('brutal my-6 bg-surface p-5 sm:p-6', className)}>
      <p className="font-display text-xs font-semibold uppercase tracking-wide text-brand-600">
        {eyebrow}
      </p>
      {title ? (
        <p className="mt-1 font-display text-lg font-semibold text-ink-900">{title}</p>
      ) : null}

      <p className="mt-2 text-sm font-medium text-ink-700">{instructions}</p>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs font-semibold text-ink-600">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-[3px] bg-accent-500" aria-hidden />
          {perceivedLabel}
        </span>
        <span className={cx('inline-flex items-center gap-1.5 transition-opacity', revealed ? 'opacity-100' : 'opacity-40')}>
          <span className="inline-block h-3 w-3 rounded-[3px] bg-brand-600" aria-hidden />
          {actualLabel}
        </span>
      </div>

      {/* The rows */}
      <ul className="mt-4 space-y-4">
        {items.map((it, i) => (
          <li key={`${reactId}-row-${i}`}>
            <p className="font-display text-sm font-semibold text-ink-900">{it.label}</p>

            {/* Perceived / availability bar — always shown */}
            <div className="mt-1.5 flex items-center gap-2">
              <div className="h-3 flex-1 overflow-hidden rounded-pill bg-surface-sunken ring-1 ring-inset ring-ink-200" aria-hidden>
                <div
                  className="h-full rounded-pill bg-accent-500 transition-[width] duration-700 ease-out motion-reduce:transition-none"
                  style={{ width: `${(it.perceived / max) * 100}%` }}
                />
              </div>
              <span className="w-12 shrink-0 text-right font-mono text-xs font-semibold text-accent-600">
                {numText(it.perceived)}
                {unit}
              </span>
            </div>

            {/* Actual / frequency bar — revealed on demand */}
            <div
              className={cx(
                'grid transition-all duration-500 ease-out motion-reduce:transition-none',
                revealed ? 'mt-1.5 grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
              )}
            >
              <div className="overflow-hidden">
                <div className="flex items-center gap-2">
                  <div className="h-3 flex-1 overflow-hidden rounded-pill bg-surface-sunken ring-1 ring-inset ring-ink-200" aria-hidden>
                    <div
                      className="h-full rounded-pill bg-brand-600 transition-[width] duration-700 ease-out motion-reduce:transition-none"
                      style={{ width: revealed ? `${(it.actual / max) * 100}%` : '0%' }}
                    />
                  </div>
                  <span className="w-12 shrink-0 text-right font-mono text-xs font-semibold text-brand-700">
                    {numText(it.actual)}
                    {unit}
                  </span>
                </div>
                {it.note ? (
                  <p className="mt-1 text-xs text-ink-500">{it.note}</p>
                ) : null}
              </div>
            </div>
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={() => setRevealed((r) => !r)}
        className="mt-5 inline-flex items-center gap-2 rounded-pill bg-ink-900 px-4 py-2 font-display text-sm font-semibold text-surface shadow-soft transition hover:bg-ink-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
      >
        {revealed ? hideLabel : revealLabel}
      </button>

      {/* Screen-reader announcement of the reveal */}
      <p aria-live="polite" className="sr-only">
        {revealed ? revealAnnouncement.replace('{count}', String(items.length)) : ''}
      </p>

      {caption ? (
        <figcaption className="mt-3 text-sm text-ink-500">{caption}</figcaption>
      ) : null}
    </figure>
  );
}

export default AvailabilityGauge;
