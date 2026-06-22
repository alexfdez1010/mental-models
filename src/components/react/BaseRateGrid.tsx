import { useId, useMemo, useState } from 'react';
import { cx } from '@/components/react/cx';

/** Props for the {@link BaseRateGrid} island. */
export interface BaseRateGridProps {
  /**
   * How many units are in the population (the grid is drawn with this many
   * dots). Keep it a "nice" number for a tidy grid — 100 (10×10) is ideal.
   * Defaults to 100.
   */
  total?: number;
  /** Dots per row. Defaults to 10 (a 10×10 grid for `total = 100`). */
  columns?: number;
  /** Starting count of highlighted dots (the base group). Defaults to 10. */
  initialCount?: number;
  /** Smallest count the slider allows. Defaults to 0. */
  min?: number;
  /** Largest count the slider allows. Defaults to {@link total}. */
  max?: number;
  /** Slider step. Defaults to 1. */
  step?: number;
  /** What the highlighted dots represent ("actually have the disease"). */
  groupLabel: string;
  /** What the population is ("people in the city"). */
  populationLabel?: string;
  /** Heading above the grid. */
  title?: string;
  /** Eyebrow label. Defaults to `'Base rate'`. */
  eyebrow?: string;
  /** Instruction line above the grid. */
  instructions?: string;
  /** Caption beneath the grid. */
  caption?: string;
  /** Label on the slider. Defaults to `'Highlighted'`. */
  sliderLabel?: string;
  /**
   * Readout template under the grid. `{count}`, `{total}`, `{pct}`, `{group}`
   * and `{population}` are replaced. A sensible bilingual-friendly default is
   * provided.
   */
  readoutTemplate?: string;
  /** Lock the slider so the grid is a static illustration. Defaults to false. */
  readOnly?: boolean;
  /** Extra classes merged onto the root element. */
  className?: string;
}

/** Round a percentage to at most one decimal, dropping a trailing `.0`. */
function pctText(count: number, total: number): string {
  if (total === 0) return '0';
  const p = (count / total) * 100;
  const rounded = Math.round(p * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

/**
 * Interactive **base-rate visualizer** — the "outside view" made literally
 * visible.
 *
 * A base rate is how common something is *before* you look at the specifics of
 * one case: out of everyone, how many are in the group? This island draws the
 * whole population as a grid of dots and shines a light on the base group, so a
 * raw percentage ("3% of people") becomes a concrete picture ("3 dots out of
 * 100"). Dragging the slider re-paints the grid and updates the natural-frequency
 * readout live, building the intuition that a small base rate stays small no
 * matter how vivid the single case in front of you feels.
 *
 * The slider is a native `range` input with a visible label, the readout is
 * announced via `aria-live`, the grid is marked decorative for screen readers
 * (the readout carries the meaning), and dot fills transition gently — instantly
 * under `prefers-reduced-motion`. Fully keyboard-operable.
 */
export function BaseRateGrid({
  total = 100,
  columns = 10,
  initialCount = 10,
  min = 0,
  max,
  step = 1,
  groupLabel,
  populationLabel = 'in the population',
  title,
  eyebrow = 'Base rate',
  instructions = 'Drag the slider. A base rate is just “how many out of everyone” — see what a percentage actually looks like.',
  caption,
  sliderLabel = 'Highlighted',
  readoutTemplate = '{count} in {total} — {pct}% — are {group}.',
  readOnly = false,
  className,
}: BaseRateGridProps) {
  if (!Number.isFinite(total) || total < 1) {
    throw new Error('BaseRateGrid: `total` must be a positive number.');
  }
  if (!groupLabel?.trim()) {
    throw new Error('BaseRateGrid: `groupLabel` is required.');
  }

  const reactId = useId();
  const upper = max ?? total;
  const clamp = (n: number) => Math.max(min, Math.min(upper, n));
  const [count, setCount] = useState(() => clamp(initialCount));

  const readout = useMemo(
    () =>
      readoutTemplate
        .replace('{count}', String(count))
        .replace('{total}', String(total))
        .replace('{pct}', pctText(count, total))
        .replace('{group}', groupLabel)
        .replace('{population}', populationLabel),
    [readoutTemplate, count, total, groupLabel, populationLabel],
  );

  // The dots, in reading order. The first `count` are "on".
  const dots = useMemo(() => Array.from({ length: total }, (_, i) => i < count), [total, count]);

  return (
    <figure className={cx('brutal my-6 bg-surface p-5 sm:p-6', className)}>
      <p className="font-display text-xs font-semibold uppercase tracking-wide text-brand-600">
        {eyebrow}
      </p>
      {title ? (
        <p className="mt-1 font-display text-lg font-semibold text-ink-900">{title}</p>
      ) : null}

      <p className="mt-2 text-sm font-medium text-ink-700">{instructions}</p>

      {/* The population grid. Decorative — meaning lives in the live readout. */}
      <div
        aria-hidden
        className="mt-4 grid gap-1"
        style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`, maxWidth: `${columns * 1.75}rem` }}
      >
        {dots.map((on, i) => (
          <span
            key={`${reactId}-dot-${i}`}
            className={cx(
              'aspect-square rounded-[3px] transition-colors duration-300 ease-out motion-reduce:transition-none',
              on ? 'bg-brand-500' : 'bg-surface-sunken ring-1 ring-inset ring-ink-200',
            )}
          />
        ))}
      </div>

      {/* Live natural-frequency readout */}
      <p
        aria-live="polite"
        className="mt-4 font-display text-base font-semibold text-ink-900"
      >
        {readout}
      </p>

      {/* Slider */}
      {!readOnly ? (
        <div className="mt-3 flex items-center gap-3">
          <label
            htmlFor={`${reactId}-range`}
            className="text-[0.65rem] font-bold uppercase tracking-wide text-ink-500"
          >
            {sliderLabel}
          </label>
          <input
            id={`${reactId}-range`}
            type="range"
            min={min}
            max={upper}
            step={step}
            value={count}
            onChange={(e) => setCount(clamp(Number(e.target.value)))}
            aria-valuetext={`${count} ${groupLabel}`}
            className="h-1.5 w-full max-w-sm cursor-pointer accent-brand-600"
          />
          <span className="w-14 shrink-0 text-right font-mono text-xs font-semibold text-ink-700">
            {count}/{total}
          </span>
        </div>
      ) : null}

      {caption ? (
        <figcaption className="mt-3 text-sm text-ink-500">{caption}</figcaption>
      ) : null}
    </figure>
  );
}

export default BaseRateGrid;
