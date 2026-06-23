import { useId, useMemo, useState } from 'react';
import { cx } from '@/components/react/cx';

/** Props for the {@link IncentiveSlider} island. */
export interface IncentiveSliderProps {
  /**
   * How many actors are in the population (drawn as a grid of icons). Keep it a
   * "nice" number for a tidy grid. Defaults to 24.
   */
  count?: number;
  /** Icons per row. Defaults to 8. */
  columns?: number;
  /** Largest reward the slider allows. Defaults to 100. */
  rewardMax?: number;
  /** Slider step. Defaults to 1. */
  rewardStep?: number;
  /** Reward the slider starts at. Defaults to 0. */
  initialReward?: number;
  /** Text printed before the reward number (e.g. `'$'`). */
  rewardPrefix?: string;
  /** Text printed after the reward number (e.g. `' / tail'`). */
  rewardSuffix?: string;
  /** What the reward is paying for — the proxy. ("Bounty per rat tail handed in") */
  rewardLabel: string;
  /** The behavior the reward was *meant* to produce. ("Hunting wild rats") */
  intendedLabel: string;
  /** The behavior people drift to when gaming the proxy pays. ("Farming rats for their tails") */
  gamedLabel: string;
  /** Emoji shown for an actor doing the intended thing. Defaults to `'🐀'`. */
  intendedIcon?: string;
  /** Emoji shown for an actor gaming the metric. Defaults to `'🏭'`. */
  gamedIcon?: string;
  /** Heading above the card. */
  title?: string;
  /** Eyebrow label. Defaults to `'Follow the reward'`. */
  eyebrow?: string;
  /** Instruction line above the grid. */
  instructions?: string;
  /** Caption beneath the card. */
  caption?: string;
  /** Slider label. Defaults to `'Reward'`. */
  sliderLabel?: string;
  /**
   * Live readout while the proxy is being rewarded. `{pct}`, `{count}`,
   * `{total}`, `{gamed}`, `{intended}` are replaced.
   */
  readoutTemplate?: string;
  /** Label on the governance toggle. Defaults to `'Reward the outcome, not the proxy'`. */
  fixLabel?: string;
  /** One-line gloss explaining the fixed design. */
  fixHint?: string;
  /** Readout shown while the fix is on (gaming no longer pays). */
  fixedReadout?: string;
  /** Extra classes merged onto the root element. */
  className?: string;
}

/** Round a percentage to a whole number. */
function pct(part: number, whole: number): number {
  return whole === 0 ? 0 : Math.round((part / whole) * 100);
}

/**
 * Interactive **incentive slider** — "show me the incentive and I'll show you
 * the outcome," made tangible.
 *
 * A population of actors each has a private price at which gaming a rewarded
 * *proxy* becomes worth it. Drag the reward up and watch the crowd defect from
 * the behavior you *wanted* (`intendedLabel`) to the behavior the metric
 * actually pays for (`gamedLabel`) — the cobra effect happening in front of you.
 * The point the island teaches by construction: behavior tracks the real payoff,
 * not the stated goal, so a high enough reward on the wrong proxy *manufactures*
 * the gaming.
 *
 * Flip the **governance toggle** and the reward is tied to the true outcome
 * instead of the proxy — now raising it no longer pays anyone to cheat, and the
 * crowd stays on task. Same lever, opposite result, because the reward finally
 * points at the thing you wanted.
 *
 * The slider is a native `range` input with a visible label, the readout is
 * announced via `aria-live`, the grid is decorative for screen readers (the
 * readout carries the meaning), and icon swaps transition gently — instantly
 * under `prefers-reduced-motion`. Fully keyboard-operable.
 */
export function IncentiveSlider({
  count = 24,
  columns = 8,
  rewardMax = 100,
  rewardStep = 1,
  initialReward = 0,
  rewardPrefix = '',
  rewardSuffix = '',
  rewardLabel,
  intendedLabel,
  gamedLabel,
  intendedIcon = '🐀',
  gamedIcon = '🏭',
  title,
  eyebrow = 'Follow the reward',
  instructions = 'Drag the reward up. Each actor defects to gaming the metric once the payoff clears their personal price — behavior follows the reward, not the stated goal.',
  caption,
  sliderLabel = 'Reward',
  readoutTemplate = 'Reward {reward}: {pct}% ({count}/{total}) now choose “{gamed}” over “{intended}”.',
  fixLabel = 'Reward the outcome, not the proxy',
  fixHint = 'Tie the payout to the result you actually want, and gaming stops paying.',
  fixedReadout = 'Fixed: the reward now tracks the real outcome, so raising it pays nobody to cheat — everyone stays on “{intended}”.',
  className,
}: IncentiveSliderProps) {
  if (!Number.isFinite(count) || count < 2) {
    throw new Error('IncentiveSlider: `count` must be at least 2.');
  }
  if (!rewardLabel?.trim() || !intendedLabel?.trim() || !gamedLabel?.trim()) {
    throw new Error('IncentiveSlider: `rewardLabel`, `intendedLabel` and `gamedLabel` are required.');
  }

  const reactId = useId();
  const clamp = (n: number) => Math.max(0, Math.min(rewardMax, n));
  const [reward, setReward] = useState(() => clamp(initialReward));
  const [fixed, setFixed] = useState(false);

  // Each actor has a private threshold — the reward at which gaming becomes
  // worth it for them — spread evenly across the range. Low thresholds defect
  // first; the most scrupulous hold out until the reward is large.
  const thresholds = useMemo(
    () => Array.from({ length: count }, (_, i) => (rewardMax * (i + 0.5)) / count),
    [count, rewardMax],
  );

  // With the proxy rewarded, an actor games once the reward clears their price.
  // With the fix on, the reward points at the real outcome, so nobody games.
  const gaming = useMemo(
    () => thresholds.map((t) => !fixed && reward >= t),
    [thresholds, reward, fixed],
  );
  const gamedCount = gaming.filter(Boolean).length;

  const rewardText = `${rewardPrefix}${reward}${rewardSuffix}`;
  const readout = fixed
    ? fixedReadout.replace('{intended}', intendedLabel).replace('{gamed}', gamedLabel)
    : readoutTemplate
        .replace('{reward}', rewardText)
        .replace('{pct}', String(pct(gamedCount, count)))
        .replace('{count}', String(gamedCount))
        .replace('{total}', String(count))
        .replace('{gamed}', gamedLabel)
        .replace('{intended}', intendedLabel);

  return (
    <figure className={cx('brutal my-6 bg-surface p-5 sm:p-6', className)}>
      <p className="font-display text-xs font-semibold uppercase tracking-wide text-accent-600">
        {eyebrow}
      </p>
      {title ? (
        <p className="mt-1 font-display text-lg font-semibold text-ink-900">{title}</p>
      ) : null}

      <p className="mt-2 text-sm font-medium text-ink-700">{instructions}</p>

      {/* What is being rewarded — the proxy. */}
      <p className="mt-4 flex flex-wrap items-baseline gap-2">
        <span className="text-[0.65rem] font-bold uppercase tracking-wide text-ink-500">
          {rewardLabel}
        </span>
      </p>

      {/* The population. Decorative — meaning lives in the live readout. */}
      <div
        aria-hidden
        className="mt-3 grid gap-1.5"
        style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`, maxWidth: `${columns * 2.4}rem` }}
      >
        {gaming.map((on, i) => (
          <span
            key={`${reactId}-actor-${i}`}
            className={cx(
              'flex aspect-square items-center justify-center rounded-card text-lg ring-1 ring-inset transition-colors duration-300 ease-out motion-reduce:transition-none',
              on
                ? 'bg-warning/15 ring-warning/40'
                : 'bg-brand-50 ring-brand-200',
            )}
          >
            {on ? gamedIcon : intendedIcon}
          </span>
        ))}
      </div>

      {/* Legend */}
      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-ink-600">
        <span className="inline-flex items-center gap-1.5">
          <span className="text-base">{intendedIcon}</span> {intendedLabel}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="text-base">{gamedIcon}</span> {gamedLabel}
        </span>
      </div>

      {/* Live readout */}
      <p aria-live="polite" className="mt-4 font-display text-base font-semibold text-ink-900">
        {readout}
      </p>

      {/* Reward slider */}
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
          min={0}
          max={rewardMax}
          step={rewardStep}
          value={reward}
          disabled={fixed}
          onChange={(e) => setReward(clamp(Number(e.target.value)))}
          aria-valuetext={rewardText}
          className="h-1.5 w-full max-w-sm cursor-pointer accent-accent-500 disabled:cursor-not-allowed disabled:opacity-50"
        />
        <span className="w-16 shrink-0 text-right font-mono text-xs font-semibold text-ink-700">
          {rewardText}
        </span>
      </div>

      {/* Governance toggle — the fix. */}
      <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-card border-2 border-ink-200 bg-surface-sunken p-3">
        <input
          type="checkbox"
          checked={fixed}
          onChange={(e) => setFixed(e.target.checked)}
          className="mt-0.5 size-4 shrink-0 cursor-pointer accent-success"
        />
        <span className="text-sm">
          <span className="font-semibold text-ink-900">{fixLabel}</span>
          <span className="mt-0.5 block text-ink-600">{fixHint}</span>
        </span>
      </label>

      {caption ? (
        <figcaption className="mt-3 text-sm text-ink-500">{caption}</figcaption>
      ) : null}
    </figure>
  );
}

export default IncentiveSlider;
