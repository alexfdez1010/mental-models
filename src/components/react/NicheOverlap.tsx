import { useId, useMemo, useState } from 'react';
import { cx } from '@/components/react/cx';

/** Props for the {@link NicheOverlap} island. */
export interface NicheOverlapProps {
  /** Heading above the card. */
  title?: string;
  /** Eyebrow label. Defaults to `'Competitive exclusion'`. */
  eyebrow?: string;
  /** Instruction line above the chart. */
  instructions?: string;
  /** Caption beneath the card. */
  caption?: string;
  /** Axis label for the horizontal resource axis (e.g. seed size). */
  resourceAxisLabel?: string;
  /** Label over the niche-separation slider. */
  separationLabel?: string;
  /** Caption on the low end of the separation slider (fully overlapping). */
  separationLowLabel?: string;
  /** Caption on the high end of the separation slider (fully partitioned). */
  separationHighLabel?: string;
  /** Legend / label for the first species' resource-use curve. */
  speciesALabel?: string;
  /** Legend / label for the second species' resource-use curve. */
  speciesBLabel?: string;
  /** Legend label for the shaded contested-overlap region. */
  overlapLabel?: string;
  /** Label above the population bars. */
  populationLabel?: string;
  /** Tag shown on the losing species when it is competitively excluded. */
  excludedTag?: string;
  /** Verdict shown when overlap is low enough for stable coexistence. */
  verdictCoexist?: string;
  /** Verdict shown when overlap is near the critical limit (precarious). */
  verdictKnifeEdge?: string;
  /** Verdict shown when overlap is too high and the weaker species is excluded. */
  verdictExcluded?: string;
  /**
   * Readout template. `{overlap}`/`{popA}`/`{popB}`/`{verdict}` are replaced.
   */
  readout?: string;
  /** Starting niche separation (0–56). Lower = more overlap. Defaults to `10`. */
  initialSeparation?: number;
  /** Extra classes merged onto the root element. */
  className?: string;
}

// ── Geometry ────────────────────────────────────────────────────────────────
const W = 460;
const H = 260;
const PAD_L = 16;
const PAD_R = 16;
const PAD_T = 16;
const PAD_B = 34;
const PLOT_W = W - PAD_L - PAD_R;
const PLOT_H = H - PAD_T - PAD_B;

const SIGMA = 14; // width of each species' resource-use curve
const AXIS_MIN = 0;
const AXIS_MAX = 100;
const MAX_SEP = 56; // slider max: peaks this far apart ≈ almost no overlap
const CRITICAL = 0.55; // overlap above which the weaker competitor is excluded
const KNIFE_BAND = 0.12; // width of the precarious band just below CRITICAL

const SAMPLES = 160;

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const round = (n: number) => Math.round(n);

const gauss = (x: number, mu: number) => Math.exp(-((x - mu) * (x - mu)) / (2 * SIGMA * SIGMA));

/** Map a resource value (0…100) to an SVG x. */
const rx = (r: number) => PAD_L + ((r - AXIS_MIN) / (AXIS_MAX - AXIS_MIN)) * PLOT_W;
/** Map a curve height (0…1) to an SVG y (peak points up). */
const ry = (h: number) => PAD_T + PLOT_H - clamp(h, 0, 1) * PLOT_H;

/**
 * Interactive **ecosystems & niches** island — the competitive exclusion
 * principle made visible. Two species use the same resource axis (say, seed
 * size), each with a bell-shaped **resource-use curve**. The learner drags the
 * **niche separation** slider to pull the two curves apart or push them together.
 *
 * The shaded region where the curves overlap is the *contested* slice of the
 * niche — resource both species fight over. When that **overlap** is small, both
 * species coexist by dividing the resource (resource partitioning). As the curves
 * are pushed together, the overlap climbs; past a **critical** level the slightly
 * weaker competitor can no longer hold any uncontested resource and is driven to
 * local extinction — Gause's principle that "complete competitors cannot coexist".
 *
 * The island plots both curves, shades the overlap, prints the overlap fraction
 * and a verdict (coexist / precarious / excluded), and shows each species'
 * resulting population as a bar so "push the niches together and one collapses"
 * is something the learner *watches happen*.
 *
 * The control is a native, keyboard-operable range input with a visible label;
 * the readout is announced via `aria-live`; the SVG is static at each setting and
 * the only motion is a cosmetic tween, disabled under `prefers-reduced-motion`.
 */
export function NicheOverlap({
  title,
  eyebrow = 'Competitive exclusion',
  instructions = 'Two species feed along the same resource axis. Drag the niche separation: pull their curves apart and both coexist; push them together and the overlap they fight over grows — until the weaker one is squeezed out entirely.',
  caption,
  resourceAxisLabel = 'Resource (e.g. seed size) →',
  separationLabel = 'Niche separation (how differently the two species feed)',
  separationLowLabel = 'identical niches',
  separationHighLabel = 'fully partitioned',
  speciesALabel = 'Species A',
  speciesBLabel = 'Species B',
  overlapLabel = 'Contested overlap',
  populationLabel = 'Population',
  excludedTag = 'excluded',
  verdictCoexist = 'low enough overlap — both species coexist, each keeping a slice of the resource the other barely touches',
  verdictKnifeEdge = 'near the critical limit — coexistence is precarious; a nudge more overlap and the weaker species is gone',
  verdictExcluded = 'too much overlap — the weaker competitor is competitively excluded and collapses to local extinction',
  readout = 'Niche overlap {overlap}% → Species A holds {popA}% and Species B holds {popB}% of capacity: {verdict}.',
  initialSeparation = 10,
  className,
}: NicheOverlapProps) {
  const reactId = useId();
  const [sep, setSep] = useState(clamp(initialSeparation, 0, MAX_SEP));

  const model = useMemo(() => {
    const cA = 50 - sep / 2;
    const cB = 50 + sep / 2;

    // Overlap coefficient: ∫min(fA,fB) / ∫fA over the axis (equal-area curves).
    let overlapSum = 0;
    let areaSum = 0;
    for (let i = 0; i <= SAMPLES; i++) {
      const x = AXIS_MIN + ((AXIS_MAX - AXIS_MIN) * i) / SAMPLES;
      const a = gauss(x, cA);
      const b = gauss(x, cB);
      overlapSum += Math.min(a, b);
      areaSum += a;
    }
    const overlap = clamp(overlapSum / areaSum, 0, 1);

    // Outcome. Below CRITICAL both coexist (the weaker, B, squeezed harder as
    // overlap rises); above CRITICAL the weaker competitor is excluded.
    let popA: number;
    let popB: number;
    let verdict: 'coexist' | 'knife' | 'excluded';
    if (overlap > CRITICAL) {
      popA = 100;
      popB = 0;
      verdict = 'excluded';
    } else {
      const t = overlap / CRITICAL; // 0 (no overlap) → 1 (at the limit)
      popA = round(96 - 8 * t); // A barely squeezed
      popB = round(92 - 62 * t); // B squeezed hard as the niches close
      verdict = overlap >= CRITICAL - KNIFE_BAND ? 'knife' : 'coexist';
    }

    return { cA, cB, overlap, popA, popB, verdict };
  }, [sep]);

  const { cA, cB, overlap, popA, popB, verdict } = model;

  const excluded = verdict === 'excluded';
  const colorA = 'var(--color-brand-500)';
  const colorB = excluded ? 'var(--color-ink-300)' : 'var(--color-accent-500)';

  // Build the filled curve areas and the shaded overlap region.
  const buildArea = (mu: number) => {
    const pts: string[] = [`${round(rx(AXIS_MIN))},${round(ry(0))}`];
    for (let i = 0; i <= SAMPLES; i++) {
      const x = AXIS_MIN + ((AXIS_MAX - AXIS_MIN) * i) / SAMPLES;
      pts.push(`${round(rx(x) * 10) / 10},${round(ry(gauss(x, mu)) * 10) / 10}`);
    }
    pts.push(`${round(rx(AXIS_MAX))},${round(ry(0))}`);
    return pts.join(' ');
  };
  const buildLine = (mu: number) => {
    const pts: string[] = [];
    for (let i = 0; i <= SAMPLES; i++) {
      const x = AXIS_MIN + ((AXIS_MAX - AXIS_MIN) * i) / SAMPLES;
      pts.push(`${round(rx(x) * 10) / 10},${round(ry(gauss(x, mu)) * 10) / 10}`);
    }
    return pts.join(' ');
  };
  const buildOverlap = () => {
    const pts: string[] = [`${round(rx(AXIS_MIN))},${round(ry(0))}`];
    for (let i = 0; i <= SAMPLES; i++) {
      const x = AXIS_MIN + ((AXIS_MAX - AXIS_MIN) * i) / SAMPLES;
      const h = Math.min(gauss(x, cA), gauss(x, cB));
      pts.push(`${round(rx(x) * 10) / 10},${round(ry(h) * 10) / 10}`);
    }
    pts.push(`${round(rx(AXIS_MAX))},${round(ry(0))}`);
    return pts.join(' ');
  };

  const overlapPct = round(overlap * 100);
  const verdictWord =
    verdict === 'excluded' ? verdictExcluded : verdict === 'knife' ? verdictKnifeEdge : verdictCoexist;

  const readoutText = readout
    .replace('{overlap}', String(overlapPct))
    .replace('{popA}', String(popA))
    .replace('{popB}', String(popB))
    .replace('{verdict}', verdictWord);

  const tween = 'transition-all duration-500 ease-out motion-reduce:transition-none';

  return (
    <figure className={cx('brutal my-6 bg-surface p-5 sm:p-6', className)}>
      <p className="font-display text-xs font-semibold uppercase tracking-wide text-brand-600">
        {eyebrow}
      </p>
      {title ? (
        <p className="mt-1 font-display text-lg font-semibold text-ink-900">{title}</p>
      ) : null}

      <p className="mt-2 text-sm font-medium text-ink-700">{instructions}</p>

      {/* The chart */}
      <div className="mt-4 overflow-hidden rounded-card border border-ink-100 bg-surface-sunken">
        <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={readoutText}>
          <rect x="0" y="0" width={W} height={H} fill="var(--color-surface-sunken)" />

          {/* Baseline (resource axis) */}
          <line
            x1={rx(AXIS_MIN)}
            y1={ry(0)}
            x2={rx(AXIS_MAX)}
            y2={ry(0)}
            stroke="var(--color-ink-400)"
            strokeWidth="1.5"
          />

          {/* Species A filled area */}
          <polygon
            points={buildArea(cA)}
            fill={`color-mix(in oklab, ${colorA} 14%, transparent)`}
            className={tween}
          />
          {/* Species B filled area */}
          <polygon
            points={buildArea(cB)}
            fill={`color-mix(in oklab, ${colorB} 14%, transparent)`}
            className={tween}
            opacity={excluded ? 0.4 : 1}
          />

          {/* Contested overlap region */}
          <polygon
            points={buildOverlap()}
            fill="color-mix(in oklab, var(--color-danger) 30%, transparent)"
            className={tween}
          />

          {/* Species A curve */}
          <polyline
            points={buildLine(cA)}
            fill="none"
            stroke={colorA}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={tween}
          />
          {/* Species B curve */}
          <polyline
            points={buildLine(cB)}
            fill="none"
            stroke={colorB}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={excluded ? '5 4' : undefined}
            className={tween}
            opacity={excluded ? 0.6 : 1}
          />

          {/* Peak labels */}
          <text
            x={rx(cA)}
            y={ry(1) - 6}
            textAnchor="middle"
            fontSize="12"
            fontWeight="700"
            fill={colorA}
            className={tween}
          >
            A
          </text>
          <text
            x={rx(cB)}
            y={ry(1) - 6}
            textAnchor="middle"
            fontSize="12"
            fontWeight="700"
            fill={excluded ? 'var(--color-ink-400)' : colorB}
            className={tween}
          >
            {excluded ? '✕' : 'B'}
          </text>

          {/* Resource axis label */}
          <text x={PAD_L} y={H - 8} textAnchor="start" fontSize="11" fill="var(--color-ink-500)">
            {resourceAxisLabel}
          </text>
        </svg>
      </div>

      {/* Legend */}
      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs font-medium text-ink-600">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="inline-block h-0 w-5 border-t-[3px]" style={{ borderColor: colorA }} />
          {speciesALabel}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="inline-block h-0 w-5 border-t-[3px]" style={{ borderColor: colorB }} />
          {speciesBLabel}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span
            aria-hidden
            className="inline-block h-3 w-3 rounded-sm"
            style={{ background: 'color-mix(in oklab, var(--color-danger) 30%, transparent)' }}
          />
          {overlapLabel}
        </span>
      </div>

      {/* Population bars */}
      <div className="mt-4">
        <p className="text-[0.65rem] font-bold uppercase tracking-wide text-ink-600">{populationLabel}</p>
        <div className="mt-2 space-y-2">
          {/* Species A bar */}
          <div className="flex items-center gap-2">
            <span className="w-24 shrink-0 text-xs font-medium text-ink-600">{speciesALabel}</span>
            <div className="relative h-4 flex-1 overflow-hidden rounded-pill bg-surface-sunken">
              <div
                className={cx('h-full rounded-pill', tween)}
                style={{ width: `${popA}%`, background: colorA }}
              />
            </div>
            <span className="w-10 shrink-0 text-right text-xs font-semibold tabular-nums text-ink-700">
              {popA}%
            </span>
          </div>
          {/* Species B bar */}
          <div className="flex items-center gap-2">
            <span className="w-24 shrink-0 text-xs font-medium text-ink-600">
              {speciesBLabel}
              {excluded ? <span className="ml-1 font-semibold text-danger">· {excludedTag}</span> : null}
            </span>
            <div className="relative h-4 flex-1 overflow-hidden rounded-pill bg-surface-sunken">
              <div
                className={cx('h-full rounded-pill', tween)}
                style={{ width: `${popB}%`, background: colorB }}
              />
            </div>
            <span className="w-10 shrink-0 text-right text-xs font-semibold tabular-nums text-ink-700">
              {popB}%
            </span>
          </div>
        </div>
      </div>

      {/* Live readout */}
      <p
        aria-live="polite"
        className="mt-4 rounded-card border border-brand-200 bg-brand-50/70 p-3 text-sm leading-relaxed text-ink-700"
      >
        {readoutText}
      </p>

      {/* Niche-separation slider */}
      <div className="mt-4">
        <label
          htmlFor={`${reactId}-sep`}
          className="text-[0.65rem] font-bold uppercase tracking-wide text-ink-600"
        >
          {separationLabel}
        </label>
        <input
          id={`${reactId}-sep`}
          type="range"
          min={0}
          max={MAX_SEP}
          step={1}
          value={sep}
          onChange={(e) => setSep(Number(e.target.value))}
          aria-valuetext={`niche overlap ${overlapPct} percent`}
          className="mt-1 h-1.5 w-full cursor-pointer accent-brand-500"
        />
        <div className="flex justify-between text-[0.6rem] font-medium uppercase tracking-wide text-ink-400">
          <span>{separationLowLabel}</span>
          <span>{separationHighLabel}</span>
        </div>
      </div>

      {caption ? <figcaption className="mt-3 text-sm text-ink-500">{caption}</figcaption> : null}
    </figure>
  );
}

export default NicheOverlap;
