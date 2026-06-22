import { useId, useMemo, useState } from 'react';
import { cx } from '@/components/react/cx';

/** A single point in time in a {@link MapDriftScrubber}. */
export interface MapDriftStep {
  /** Short label for this moment (e.g. "Today", "1 year later"). */
  label: string;
  /**
   * How far the territory has drifted from the frozen map, 0–1. `0` = the map
   * still matches the ground exactly; `1` = the territory has moved as far as
   * this figure shows. Each step should drift further than the last.
   */
  drift: number;
  /** One-line note describing what has changed on the ground at this step. */
  note: string;
}

/** Props for the {@link MapDriftScrubber} component. */
export interface MapDriftScrubberProps {
  /**
   * The time steps, ordered from "map just drawn" (drift 0) to "map badly out
   * of date" (drift near 1). At least two are required. The slider walks them.
   */
  steps?: MapDriftStep[];
  /** Heading above the figure. */
  title?: string;
  /** Eyebrow label. Defaults to `'When the map goes stale'`. */
  eyebrow?: string;
  /** Caption beneath the figure. */
  caption?: string;
  /** Label for the frozen planned route ("the map") in the legend. Defaults to `'The map (frozen)'`. */
  mapLabel?: string;
  /** Label for the real, moving route ("the territory"). Defaults to `'The territory (moved)'`. */
  territoryLabel?: string;
  /** Label for the shaded error band. Defaults to `'The gap'`. */
  gapLabel?: string;
  /** Prefix for the mismatch readout. Defaults to `'Map–territory mismatch'`. */
  mismatchLabel?: string;
  /** Accessible label for the time slider. Defaults to `'Time since the map was drawn'`. */
  sliderLabel?: string;
  /** Extra classes merged onto the root element. */
  className?: string;
}

const DEFAULT_STEPS: MapDriftStep[] = [
  {
    label: 'The day you drew it',
    drift: 0,
    note: 'Map and territory agree perfectly. Following the map takes you exactly where you meant to go.',
  },
  {
    label: 'A few months later',
    drift: 0.3,
    note: 'A road has been rerouted. The map still looks right, and small detours feel like nothing — yet.',
  },
  {
    label: 'A year later',
    drift: 0.6,
    note: 'The territory has moved a lot. Trust the map now and you arrive somewhere the map never warned you about.',
  },
  {
    label: 'Years later',
    drift: 1,
    note: 'The map is a museum piece. It feels exactly as confident as it did on day one — that is the trap.',
  },
];

const W = 480;
const H = 200;
const BASELINE = 120; // y of the frozen planned route
const LEFT = 24;
const RIGHT = W - 24;
const MAX_DEV = 78; // how far the territory can bend away at full drift

/** Build the actual ("territory") route: a smooth hump that grows with drift. */
function territoryPath(drift: number): string {
  const amp = Math.max(0, Math.min(1, drift)) * MAX_DEV;
  const n = 48;
  const pts: string[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const x = LEFT + t * (RIGHT - LEFT);
    // A single smooth detour bump peaking at the middle of the span.
    const y = BASELINE - amp * Math.sin(Math.PI * t);
    pts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
  }
  return `M ${pts.join(' L ')}`;
}

/** Build the shaded gap between the frozen map line and the drifted territory. */
function gapPath(drift: number): string {
  const amp = Math.max(0, Math.min(1, drift)) * MAX_DEV;
  const n = 48;
  const top: string[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const x = LEFT + t * (RIGHT - LEFT);
    const y = BASELINE - amp * Math.sin(Math.PI * t);
    top.push(`${x.toFixed(1)},${y.toFixed(1)}`);
  }
  // Close along the flat map line back to the start.
  return `M ${top.join(' L ')} L ${RIGHT},${BASELINE} L ${LEFT},${BASELINE} Z`;
}

/**
 * Interactive **stale-map** island.
 *
 * A straight "planned route" (the map) is drawn frozen across the figure. On top,
 * the "actual route" (the territory) bends further and further away as the learner
 * scrubs a time slider — and the widening shaded band between them is the error you
 * inherit by trusting an out-of-date map. It makes concrete the third way the
 * map–territory gap bites: **the territory moved but the map didn't.**
 *
 * The control is a real, keyboard-operable `<input type="range">` with a label and
 * a live text readout, so all information is available without motion and to screen
 * readers. The SVG is static at each step; the path transition is purely cosmetic
 * and disabled by the global `prefers-reduced-motion` rule.
 */
export function MapDriftScrubber({
  steps = DEFAULT_STEPS,
  title,
  eyebrow = 'When the map goes stale',
  caption,
  mapLabel = 'The map (frozen)',
  territoryLabel = 'The territory (moved)',
  gapLabel = 'The gap',
  mismatchLabel = 'Map–territory mismatch',
  sliderLabel = 'Time since the map was drawn',
  className,
}: MapDriftScrubberProps) {
  // Fail the build on a mis-authored figure rather than shipping a broken slider.
  // Runs during SSR/prerender → red build.
  if (!Array.isArray(steps) || steps.length < 2) {
    throw new Error('MapDriftScrubber: needs at least two `steps`.');
  }
  const bad = steps.find(
    (s) => !s?.label?.trim() || !s?.note?.trim() || !(s.drift >= 0 && s.drift <= 1),
  );
  if (bad) {
    throw new Error(
      'MapDriftScrubber: every step needs a non-empty `label`, a `note`, and a ' +
        `\`drift\` between 0 and 1. Offending step: "${bad?.label ?? '(missing label)'}".`,
    );
  }

  const reactId = useId();
  const sliderId = `${reactId}-time`;
  const [index, setIndex] = useState(0);
  const step = steps[index];

  const tPath = useMemo(() => territoryPath(step.drift), [step.drift]);
  const gPath = useMemo(() => gapPath(step.drift), [step.drift]);
  const mismatchPct = Math.round(step.drift * 100);

  return (
    <figure className={cx('brutal my-6 bg-surface p-5 sm:p-6', className)}>
      <p className="font-display text-xs font-semibold uppercase tracking-wide text-brand-600">
        {eyebrow}
      </p>
      {title ? (
        <p className="mt-1 font-display text-lg font-semibold text-ink-900">{title}</p>
      ) : null}

      <div className="mt-4 overflow-hidden rounded-card border border-ink-100 bg-surface-sunken">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="h-auto w-full"
          role="img"
          aria-label={`${step.label}: the territory has drifted ${mismatchPct}% away from the frozen map — ${step.note}`}
        >
          <rect x="0" y="0" width={W} height={H} fill="var(--color-surface-sunken)" />

          {/* The widening gap — the error you inherit from a stale map. */}
          <path
            d={gPath}
            fill="color-mix(in oklab, var(--color-danger) 18%, transparent)"
            className="transition-all duration-500 ease-out motion-reduce:transition-none"
          />

          {/* The map: the frozen, straight planned route. */}
          <line
            x1={LEFT}
            y1={BASELINE}
            x2={RIGHT}
            y2={BASELINE}
            stroke="var(--color-ink-400)"
            strokeWidth="2.5"
            strokeDasharray="7 5"
          />

          {/* The territory: the real route, bending away over time. */}
          <path
            d={tPath}
            fill="none"
            stroke="var(--color-brand-600)"
            strokeWidth="3"
            strokeLinecap="round"
            className="transition-all duration-500 ease-out motion-reduce:transition-none"
          />

          {/* Start + end pins (the two routes share the same endpoints). */}
          <circle cx={LEFT} cy={BASELINE} r="4" fill="var(--color-ink-700)" />
          <circle cx={RIGHT} cy={BASELINE} r="4" fill="var(--color-ink-700)" />
        </svg>
      </div>

      {/* Legend */}
      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs font-medium text-ink-600">
        <span className="inline-flex items-center gap-1.5">
          <span
            aria-hidden
            className="inline-block h-0 w-5 border-t-[3px] border-dashed border-ink-400"
          />
          {mapLabel}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="inline-block h-0 w-5 border-t-[3px] border-brand-600" />
          {territoryLabel}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span
            aria-hidden
            className="inline-block h-2.5 w-4 rounded-sm"
            style={{ background: 'color-mix(in oklab, var(--color-danger) 18%, transparent)' }}
          />
          {gapLabel}
        </span>
      </div>

      {/* Control */}
      <div className="mt-4">
        <div className="mb-1.5 flex items-baseline justify-between gap-3">
          <label htmlFor={sliderId} className="text-sm font-semibold text-ink-800">
            {sliderLabel}
          </label>
          <span className="font-display text-sm font-semibold text-brand-700">{step.label}</span>
        </div>
        <input
          id={sliderId}
          type="range"
          min={0}
          max={steps.length - 1}
          step={1}
          value={index}
          onChange={(e) => setIndex(Number(e.target.value))}
          aria-valuetext={step.label}
          className="h-2 w-full cursor-pointer appearance-none rounded-pill bg-surface-sunken accent-brand-600"
        />
        <div className="mt-1 flex justify-between text-[0.65rem] font-medium uppercase tracking-wide text-ink-400">
          <span>{steps[0].label}</span>
          <span>{steps[steps.length - 1].label}</span>
        </div>
      </div>

      {/* Live readout */}
      <p
        aria-live="polite"
        className="mt-3 rounded-card border border-brand-200 bg-brand-50/70 p-3 text-sm leading-relaxed text-ink-700"
      >
        <span className="font-semibold text-brand-700">
          {mismatchLabel}: {mismatchPct}%.
        </span>{' '}
        {step.note}
      </p>

      {caption ? (
        <figcaption className="mt-3 text-sm text-ink-500">{caption}</figcaption>
      ) : null}
    </figure>
  );
}

export default MapDriftScrubber;
