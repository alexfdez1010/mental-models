import { useId, useMemo, useState } from 'react';
import { cx } from '@/components/react/cx';

/** A single zoom/detail step in a {@link MapTerritoryZoom}. */
export interface MapTerritoryStep {
  /** Short label for this level of detail (e.g. "Subway map"). */
  label: string;
  /**
   * How many points the simplified coastline keeps at this step. Higher = more
   * faithful to the "territory". The component samples the full coastline down
   * to this many vertices, so each step visibly drops detail.
   */
  detail: number;
  /** One-line note explaining what this level of simplification is good (or bad) for. */
  note: string;
}

/** Props for the {@link MapTerritoryZoom} component. */
export interface MapTerritoryZoomProps {
  /**
   * The detail steps, ordered from most simplified (fewest points) to most
   * faithful (most points). At least two are required. The slider walks them.
   */
  steps?: MapTerritoryStep[];
  /** Heading above the figure. */
  title?: string;
  /** Eyebrow label. Defaults to `'Map vs. territory'`. */
  eyebrow?: string;
  /** Caption beneath the figure. */
  caption?: string;
  /** Label for the simplified ("map") layer in the legend. Defaults to `'The map'`. */
  mapLabel?: string;
  /** Label for the full-detail ("territory") layer in the legend. Defaults to `'The territory'`. */
  territoryLabel?: string;
  /** Prefix for the detail readout, e.g. "Detail kept". Defaults to `'Detail kept'`. */
  detailLabel?: string;
  /** Accessible label for the step slider. Defaults to `'Level of detail'`. */
  sliderLabel?: string;
  /** Extra classes merged onto the root element. */
  className?: string;
}

const DEFAULT_STEPS: MapTerritoryStep[] = [
  {
    label: 'Subway map',
    detail: 5,
    note: 'Almost no real geography — just which stops connect. Perfect for catching a train, useless for walking.',
  },
  {
    label: 'Road atlas',
    detail: 11,
    note: 'The big bends are back, but coves and inlets are smoothed away. Good enough to drive the coast.',
  },
  {
    label: 'Hiking map',
    detail: 24,
    note: 'Most bays and headlands appear. Close enough to plan a walk along the shore.',
  },
  {
    label: 'Survey chart',
    detail: 60,
    note: 'Nearly every wrinkle of the coast. Detailed — but slow to read and expensive to make.',
  },
  {
    label: 'The real coastline',
    detail: 240,
    note: 'The territory itself: infinitely detailed. No map can ever fully contain it.',
  },
];

/**
 * A smooth, wiggly reference "coastline" sampled across the full width. We
 * generate it once from a sum of sines so it has detail at several scales (big
 * bays + small inlets), then each step keeps only `detail` evenly-spaced
 * samples of it — visibly dropping detail as you simplify. Deterministic, so SSR
 * and client markup match (no hydration mismatch).
 */
function coastlineY(t: number): number {
  // t in [0,1] → a y offset around a baseline. Several frequencies = multi-scale
  // detail, exactly the thing a coarse map throws away first.
  return (
    18 * Math.sin(t * Math.PI * 2 * 1.0 + 0.6) +
    9 * Math.sin(t * Math.PI * 2 * 2.7 + 1.3) +
    5 * Math.sin(t * Math.PI * 2 * 6.1 + 0.2) +
    2.5 * Math.sin(t * Math.PI * 2 * 13.0 + 2.1)
  );
}

const W = 480;
const H = 200;
const BASELINE = 96; // y of the mean coast line
const LEFT = 12;
const RIGHT = W - 12;

/** Build an SVG path for a coast sampled to `count` vertices, as a filled land mass. */
function buildPath(count: number): string {
  const n = Math.max(2, count);
  const pts: Array<[number, number]> = [];
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const x = LEFT + t * (RIGHT - LEFT);
    const y = BASELINE + coastlineY(t);
    pts.push([x, y]);
  }
  const top = pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' L ');
  // Close the shape down to the bottom edge so it reads as a landmass below the coast.
  return `M ${LEFT},${H - 8} L ${top} L ${RIGHT},${H - 8} Z`;
}

/**
 * Interactive **map-vs-territory** island.
 *
 * A reference "coastline" (the territory) is drawn faintly in the background.
 * On top, a bold simplified coastline is redrawn at the detail level the learner
 * selects with a slider — from a 5-point subway-style sketch up to a 240-point
 * near-faithful survey. Stepping toward "simpler" visibly erases coves and
 * inlets, making concrete the core idea that **every model omits detail**: the
 * map is not the territory.
 *
 * The control is a real, keyboard-operable `<input type="range">` with a label
 * and a live text readout, so the information is fully available without motion
 * and to screen readers. No animation is essential — the SVG is static at each
 * step — so `prefers-reduced-motion` users lose nothing; the path transition is
 * purely cosmetic and disabled by the global reduced-motion rule.
 */
export function MapTerritoryZoom({
  steps = DEFAULT_STEPS,
  title,
  eyebrow = 'Map vs. territory',
  caption,
  mapLabel = 'The map',
  territoryLabel = 'The territory',
  detailLabel = 'Detail kept',
  sliderLabel = 'Level of detail',
  className,
}: MapTerritoryZoomProps) {
  // Fail the build on a mis-authored figure rather than shipping a broken slider.
  // Runs during SSR/prerender → red build.
  if (!Array.isArray(steps) || steps.length < 2) {
    throw new Error('MapTerritoryZoom: needs at least two `steps`.');
  }
  const bad = steps.find((s) => !s?.label?.trim() || !s?.note?.trim() || !(s.detail >= 2));
  if (bad) {
    throw new Error(
      `MapTerritoryZoom: every step needs a non-empty \`label\`, a \`note\`, and a ` +
        `\`detail\` of at least 2. Offending step: "${bad?.label ?? '(missing label)'}".`,
    );
  }

  const reactId = useId();
  const sliderId = `${reactId}-detail`;
  const [index, setIndex] = useState(0);
  const step = steps[index];

  // The faint reference layer always shows the richest available detail.
  const territoryDetail = useMemo(
    () => Math.max(...steps.map((s) => s.detail)),
    [steps],
  );
  const territoryPath = useMemo(() => buildPath(territoryDetail), [territoryDetail]);
  const mapPath = useMemo(() => buildPath(step.detail), [step.detail]);

  return (
    <figure
      className={cx(
        'my-6 rounded-card border border-ink-200 bg-surface p-5 shadow-soft sm:p-6',
        className,
      )}
    >
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
          aria-label={`${step.label}: a coastline drawn with ${step.detail} points — ${step.note}`}
        >
          {/* Sea label tint band, purely decorative. */}
          <rect x="0" y="0" width={W} height={H} fill="var(--color-surface-sunken)" />
          {/* Territory: the faint, full-detail truth underneath. */}
          <path
            d={territoryPath}
            fill="var(--color-ink-200)"
            stroke="var(--color-ink-300)"
            strokeWidth="1"
          />
          {/* Map: the bold simplified coastline the learner controls. */}
          <path
            d={mapPath}
            fill="color-mix(in oklab, var(--color-brand-400) 32%, transparent)"
            stroke="var(--color-brand-600)"
            strokeWidth="2.5"
            strokeLinejoin="round"
            className="transition-all duration-500 ease-out motion-reduce:transition-none"
          />
          {/* Vertex dots on the map so dropped detail is unmistakable. */}
          {Array.from({ length: step.detail }).map((_, i) => {
            const t = i / (step.detail - 1);
            const x = LEFT + t * (RIGHT - LEFT);
            const y = BASELINE + coastlineY(t);
            return (
              <circle
                key={i}
                cx={x}
                cy={y}
                r="2.6"
                fill="var(--color-brand-700)"
              />
            );
          })}
        </svg>
      </div>

      {/* Legend */}
      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs font-medium text-ink-600">
        <span className="inline-flex items-center gap-1.5">
          <span
            aria-hidden
            className="inline-block h-2.5 w-4 rounded-pill border-2 border-brand-600 bg-brand-400/30"
          />
          {mapLabel}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span
            aria-hidden
            className="inline-block h-2.5 w-4 rounded-pill border border-ink-300 bg-ink-200"
          />
          {territoryLabel}
        </span>
      </div>

      {/* Control */}
      <div className="mt-4">
        <div className="mb-1.5 flex items-baseline justify-between gap-3">
          <label htmlFor={sliderId} className="text-sm font-semibold text-ink-800">
            {sliderLabel}
          </label>
          <span className="font-display text-sm font-semibold text-brand-700">
            {step.label}
          </span>
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
          {detailLabel}: {step.detail} {step.detail === 1 ? 'point' : 'points'}.
        </span>{' '}
        {step.note}
      </p>

      {caption ? (
        <figcaption className="mt-3 text-sm text-ink-500">{caption}</figcaption>
      ) : null}
    </figure>
  );
}

export default MapTerritoryZoom;
