import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { cx } from '@/components/react/cx';

/** Props for the {@link FitnessLandscape} island. */
export interface FitnessLandscapeProps {
  /** Heading above the card. */
  title?: string;
  /** Eyebrow label. Defaults to `'Hill-climbing'`. */
  eyebrow?: string;
  /** Instruction line above the chart. */
  instructions?: string;
  /** Caption beneath the card. */
  caption?: string;
  /** Label under the horizontal design axis. */
  designAxisLabel?: string;
  /** Label for the vertical fitness axis (shown top-left). */
  fitnessAxisLabel?: string;
  /** Label for the ruggedness slider. */
  ruggednessLabel?: string;
  /** Caption on the low (smooth) end of the ruggedness slider. */
  ruggednessLowLabel?: string;
  /** Caption on the high (rugged) end of the ruggedness slider. */
  ruggednessHighLabel?: string;
  /** Text on the drop-a-population button. */
  dropLabel?: string;
  /** Text on the climb button (auto-run). */
  climbLabel?: string;
  /** Text on the pause button. */
  pauseLabel?: string;
  /** Text on the single-step climb button. */
  stepLabel?: string;
  /** Text on the mutate / big-jump button. */
  mutateLabel?: string;
  /** Text on the Red-Queen (shifting-terrain) toggle. */
  redQueenLabel?: string;
  /** Text on the reset button. */
  resetLabel?: string;
  /** Tag floating over the global (tallest) summit. */
  summitLabel?: string;
  /** Status shown before a population is dropped. */
  statusIdle?: string;
  /** Status shown while the population is still climbing uphill. */
  statusClimbing?: string;
  /** Status shown when stuck on a lower local peak (a taller one exists). `{gap}` is replaced. */
  statusTrapped?: string;
  /** Status shown when the population has reached the global optimum. */
  statusGlobal?: string;
  /** Status shown when the shifting terrain has sunk the peak under the climber's feet. */
  statusSinking?: string;
  /**
   * Live readout template. `{fitness}` (current height, 0–100), `{best}` (the
   * tallest summit's height) and `{status}` are replaced.
   */
  readout?: string;
  /** Starting ruggedness (0–100). Defaults to 30. */
  initialRuggedness?: number;
  /** Extra classes merged onto the root element. */
  className?: string;
}

// ── Geometry ────────────────────────────────────────────────────────────────
const W = 460;
const H = 240;
const PAD_L = 14;
const PAD_R = 14;
const PAD_T = 14;
const PAD_B = 30;
const PLOT_W = W - PAD_L - PAD_R;
const PLOT_H = H - PAD_T - PAD_B;

const SAMPLES = 240; // resolution of the drawn terrain / global-peak search
const EPS = 0.006; // finite-difference half-step for the gradient
const STEP_GAIN = 0.05; // proportional climb-step size
const STEP_CAP = 0.02; // max move per climb tick
const AT_PEAK = 0.0035; // |gradient| below this ⇒ sitting on a peak

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

/**
 * The landscape height at design-position `x ∈ [0,1]`, for a given `rug`
 * (0–1 ruggedness) and `epoch` (Red-Queen time). Pure and deterministic in its
 * three inputs, so the drawn terrain, the climber and the global-peak search all
 * agree. A few fixed Gaussian peaks give the terrain a genuine tallest summit;
 * ruggedness rides high-frequency ripples on top (more, sharper ripples ⇒ more
 * local optima); the epoch drifts the peaks sideways and swells/sinks them, so a
 * conquered summit can subside beneath a rival — the Red Queen underfoot.
 */
function height(x: number, rug: number, epoch: number): number {
  const drift = epoch * 0.9; // radians of slow height modulation
  const shift = epoch * 0.01; // gentle horizontal creep of the ripples
  // Base peaks: [center, baseHeight, width, phase]. The right-hand peak is the
  // tallest, so "climb the nearest hill" often strands you on a lower-left one.
  const peaks: [number, number, number, number][] = [
    [0.2, 0.52, 0.1, 0.0],
    [0.5, 0.4, 0.08, 2.1],
    [0.8, 0.72, 0.07, 4.2],
  ];
  let h = 0;
  for (const [c, a, w, ph] of peaks) {
    // Red-Queen height modulation: peaks breathe up and down out of phase.
    const amp = a * (1 + 0.16 * Math.sin(drift + ph));
    const d = x - c;
    h += amp * Math.exp(-(d * d) / (2 * w * w));
  }
  // Ruggedness ripples — many small local maxima when the slider is high.
  const freq = (7 + 15 * rug) * Math.PI;
  h += rug * 0.11 * Math.sin(freq * (x + shift));
  return Math.max(0, h);
}

/** Map design-position 0…1 → SVG x. */
const rx = (x: number) => PAD_L + clamp(x, 0, 1) * PLOT_W;
/** Map a fitness height → SVG y (taller points up). Scaled so ~1.0 fills the plot. */
const ry = (h: number) => PAD_T + PLOT_H - clamp(h / 1.05, 0, 1) * PLOT_H;

/**
 * Interactive **fitness landscape** — the search-over-a-terrain model made
 * visible (Sewall Wright, 1932). Every possible design is a point along the
 * horizontal axis; its **fitness** (how well it works) is the height. The learner
 * **drops a population** somewhere and watches selection **hill-climb** — moving
 * only uphill, one small improving step at a time, with no foresight — until it
 * reaches a peak.
 *
 * The lesson lives in where it stops: on a **rugged** landscape the climber
 * usually halts on the nearest **local peak**, marooned below a taller summit it
 * can't reach because every path there runs *downhill* first, across a valley
 * selection won't cross. **Mutate / big jump** throws the population to a fresh
 * spot so it can (sometimes) discover a higher hill — the explore-vs-exploit
 * trade-off. The **ruggedness** slider morphs the terrain from one smooth hill
 * (easy) to a jagged range full of traps. **Shifting terrain (Red Queen)** slowly
 * deforms the landscape so a conquered peak subsides — there is no final summit.
 *
 * The SVG is decorative for assistive tech; the meaning lives in the `aria-live`
 * readout (current fitness, the tallest summit's fitness, and a status: climbing
 * / trapped-on-a-local-peak / on-the-global-summit / sinking). Auto-climb is
 * suppressed under `prefers-reduced-motion`; every state stays reachable with the
 * step, drop, mutate and toggle buttons. Fully keyboard-operable.
 */
export function FitnessLandscape({
  title,
  eyebrow = 'Hill-climbing',
  instructions = 'Every possible design sits along the bottom axis; its fitness — how well it works — is the height. Drop a population, then let selection climb: it only ever steps uphill. Watch where it gets stuck, crank up the ruggedness, and try a big mutation jump to escape.',
  caption,
  designAxisLabel = 'Every possible design →',
  fitnessAxisLabel = 'Fitness ↑',
  ruggednessLabel = 'Ruggedness of the landscape',
  ruggednessLowLabel = 'smooth — one hill',
  ruggednessHighLabel = 'rugged — many peaks',
  dropLabel = 'Drop a population',
  climbLabel = 'Let it climb ▸',
  pauseLabel = 'Pause',
  stepLabel = 'Climb one step ▸',
  mutateLabel = 'Mutate / big jump',
  redQueenLabel = 'Shifting terrain (Red Queen)',
  resetLabel = 'Reset',
  summitLabel = 'tallest summit',
  statusIdle = 'Drop a population somewhere on the landscape, then let selection climb the nearest hill.',
  statusClimbing = 'Climbing uphill — selection is taking every small step that raises fitness, with no foresight.',
  statusTrapped = 'Stuck on a local peak. Every direction from here runs downhill, yet a taller summit sits {gap} points higher across a valley selection won’t cross. “Good enough” is trapped below “best”.',
  statusGlobal = 'On the global optimum — the tallest summit on the whole landscape. Nowhere is higher.',
  statusSinking = 'The terrain shifted under the population: the peak it conquered is sinking, so it must climb all over again. There is no final summit.',
  readout = 'Fitness {fitness} out of a possible {best}. {status}',
  initialRuggedness = 30,
  className,
}: FitnessLandscapeProps) {
  const reactId = useId();
  const [rug, setRug] = useState(clamp(initialRuggedness, 0, 100));
  const [epoch, setEpoch] = useState(0);
  const [pos, setPos] = useState<number | null>(null); // climber's x, or null = not dropped
  const [playing, setPlaying] = useState(false);
  const [redQueen, setRedQueen] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [justSank, setJustSank] = useState(false);

  const rugN = rug / 100;

  // Respect prefers-reduced-motion (client-only; SSR-safe default).
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const apply = () => setReduced(mq.matches);
    apply();
    mq.addEventListener?.('change', apply);
    return () => mq.removeEventListener?.('change', apply);
  }, []);

  const h = useCallback((x: number) => height(x, rugN, epoch), [rugN, epoch]);
  const grad = useCallback((x: number) => h(x + EPS) - h(x - EPS), [h]);

  // ── Global-peak search + drawn terrain (re-run when the terrain changes) ────
  const terrain = useMemo(() => {
    const pts: { x: number; y: number }[] = [];
    let bestX = 0;
    let bestH = -Infinity;
    for (let i = 0; i <= SAMPLES; i++) {
      const x = i / SAMPLES;
      const y = height(x, rugN, epoch);
      pts.push({ x, y });
      if (y > bestH) {
        bestH = y;
        bestX = x;
      }
    }
    return { pts, bestX, bestH };
  }, [rugN, epoch]);

  const step = useCallback(() => {
    setPos((p) => {
      if (p === null) return p;
      const g = grad(p);
      if (Math.abs(g) < AT_PEAK) return p; // already on a peak
      const move = clamp(g * (STEP_GAIN / (2 * EPS)) * 0.02, -STEP_CAP, STEP_CAP);
      return clamp(p + move, 0, 1);
    });
  }, [grad]);

  // Auto-climb loop. Disabled under reduced-motion. Also advances the terrain
  // when the Red Queen is running, so a conquered peak slowly subsides.
  const posRef = useRef<number | null>(pos);
  posRef.current = pos;
  useEffect(() => {
    if (!playing || reduced) return;
    const t = setInterval(() => {
      const p = posRef.current;
      if (p === null) return;
      const onPeak = Math.abs(grad(p)) < AT_PEAK;
      if (redQueen) {
        // Keep deforming the terrain; the climber never truly finishes.
        setEpoch((e) => e + 0.06);
        setJustSank(onPeak);
        step();
      } else if (onPeak) {
        setPlaying(false); // settled on a peak with a fixed landscape
      } else {
        step();
      }
    }, 90);
    return () => clearInterval(t);
  }, [playing, reduced, redQueen, grad, step]);

  const drop = () => {
    setPos(Math.random());
    setJustSank(false);
    setPlaying(!reduced);
  };

  const mutate = () => {
    // A large random jump — the explore move that can (sometimes) land on the
    // slope of a taller hill the local climb could never reach.
    setPos(Math.random());
    setJustSank(false);
    if (!reduced) setPlaying(true);
  };

  const reset = () => {
    setPos(null);
    setPlaying(false);
    setRedQueen(false);
    setEpoch(0);
    setJustSank(false);
  };

  // ── Derived state for the readout ──────────────────────────────────────────
  const fit = pos === null ? 0 : h(pos);
  const best = terrain.bestH;
  const onPeakNow = pos !== null && Math.abs(grad(pos)) < AT_PEAK;
  const gap = Math.round((best - fit) * 100);
  const isGlobal = onPeakNow && gap <= 2;

  let statusKind: 'idle' | 'climbing' | 'trapped' | 'global' | 'sinking';
  if (pos === null) statusKind = 'idle';
  else if (redQueen && justSank && onPeakNow) statusKind = 'sinking';
  else if (!onPeakNow) statusKind = 'climbing';
  else if (isGlobal) statusKind = 'global';
  else statusKind = 'trapped';

  const statusText =
    statusKind === 'idle'
      ? statusIdle
      : statusKind === 'climbing'
        ? statusClimbing
        : statusKind === 'global'
          ? statusGlobal
          : statusKind === 'sinking'
            ? statusSinking
            : statusTrapped.replace('{gap}', String(Math.max(1, gap)));

  const readoutText = readout
    .replace('{fitness}', String(Math.round(fit * 100)))
    .replace('{best}', String(Math.round(best * 100)))
    .replace('{status}', statusText);

  // ── Build the terrain path ─────────────────────────────────────────────────
  const line = terrain.pts
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${rx(p.x).toFixed(1)} ${ry(p.y).toFixed(1)}`)
    .join(' ');
  const area = `${line} L ${rx(1).toFixed(1)} ${ry(0).toFixed(1)} L ${rx(0).toFixed(1)} ${ry(0).toFixed(1)} Z`;

  const climberColor =
    statusKind === 'global'
      ? 'var(--color-accent-600)'
      : statusKind === 'trapped'
        ? 'var(--color-danger)'
        : 'var(--color-brand-600)';

  const tween = 'transition-all duration-200 ease-out motion-reduce:transition-none';

  return (
    <figure className={cx('brutal my-6 bg-surface p-5 sm:p-6', className)}>
      <p className="font-display text-xs font-semibold uppercase tracking-wide text-accent-600">
        {eyebrow}
      </p>
      {title ? (
        <p className="mt-1 font-display text-lg font-semibold text-ink-900">{title}</p>
      ) : null}

      <p className="mt-2 text-sm font-medium text-ink-700">{instructions}</p>

      {/* The landscape */}
      <div className="mt-4 overflow-hidden rounded-card border border-ink-100 bg-surface-sunken">
        <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={readoutText}>
          <rect x="0" y="0" width={W} height={H} fill="var(--color-surface-sunken)" />

          {/* Filled terrain */}
          <path d={area} fill="color-mix(in oklab, var(--color-accent-500) 13%, transparent)" />
          <path
            d={line}
            fill="none"
            stroke="var(--color-accent-500)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Tallest-summit flag */}
          <g className={tween}>
            <line
              x1={rx(terrain.bestX)}
              y1={ry(terrain.bestH)}
              x2={rx(terrain.bestX)}
              y2={ry(terrain.bestH) - 22}
              stroke="var(--color-ink-400)"
              strokeWidth="1.5"
              strokeDasharray="3 3"
            />
            <polygon
              points={`${rx(terrain.bestX)},${ry(terrain.bestH) - 22} ${rx(terrain.bestX) + 16},${ry(terrain.bestH) - 17} ${rx(terrain.bestX)},${ry(terrain.bestH) - 12}`}
              fill="var(--color-ink-400)"
            />
          </g>

          {/* The population / climber */}
          {pos !== null ? (
            <circle
              cx={rx(pos)}
              cy={ry(fit)}
              r={6}
              fill={climberColor}
              stroke="var(--color-surface)"
              strokeWidth="2"
              className={tween}
            />
          ) : null}

          {/* Axis labels */}
          <text x={PAD_L} y={PAD_T + 4} textAnchor="start" fontSize="11" fill="var(--color-ink-500)">
            {fitnessAxisLabel}
          </text>
          <text x={PAD_L} y={H - 8} textAnchor="start" fontSize="11" fill="var(--color-ink-500)">
            {designAxisLabel}
          </text>
        </svg>
      </div>

      {/* Legend */}
      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs font-medium text-ink-600">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="inline-block size-3 rounded-full bg-brand-600" />
          {dropLabel}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="inline-block h-0 w-5 border-t-2 border-dashed border-ink-400" />
          {summitLabel}
        </span>
      </div>

      {/* Live readout */}
      <p
        aria-live="polite"
        className="mt-4 rounded-card border border-accent-200 bg-accent-50/70 p-3 text-sm leading-relaxed text-ink-700"
      >
        {readoutText}
      </p>

      {/* Ruggedness slider */}
      <div className="mt-4">
        <label
          htmlFor={`${reactId}-rug`}
          className="text-[0.65rem] font-bold uppercase tracking-wide text-ink-600"
        >
          {ruggednessLabel}
        </label>
        <input
          id={`${reactId}-rug`}
          type="range"
          min={0}
          max={100}
          step={1}
          value={rug}
          onChange={(e) => setRug(Number(e.target.value))}
          aria-valuetext={`ruggedness ${rug} percent`}
          className="mt-1 h-1.5 w-full cursor-pointer accent-accent-500"
        />
        <div className="flex justify-between text-[0.6rem] font-medium uppercase tracking-wide text-ink-400">
          <span>{ruggednessLowLabel}</span>
          <span>{ruggednessHighLabel}</span>
        </div>
      </div>

      {/* Controls */}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={drop}
          className="brutal-btn bg-accent-500 px-4 py-2 font-display text-sm text-white"
        >
          {dropLabel}
        </button>
        {!reduced ? (
          <button
            type="button"
            onClick={() => setPlaying((p) => !p)}
            disabled={pos === null}
            className="inline-flex items-center rounded-pill px-3 py-2 font-display text-sm font-semibold text-ink-600 ring-1 ring-inset ring-ink-300 transition-colors hover:bg-surface-sunken motion-reduce:transition-none disabled:cursor-not-allowed disabled:opacity-50"
          >
            {playing ? pauseLabel : climbLabel}
          </button>
        ) : (
          <button
            type="button"
            onClick={step}
            disabled={pos === null}
            className="brutal-btn bg-brand-500 px-3 py-2 font-display text-sm text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {stepLabel}
          </button>
        )}
        <button
          type="button"
          onClick={mutate}
          disabled={pos === null}
          className="inline-flex items-center rounded-pill px-3 py-2 font-display text-sm font-semibold text-ink-600 ring-1 ring-inset ring-ink-300 transition-colors hover:bg-surface-sunken motion-reduce:transition-none disabled:cursor-not-allowed disabled:opacity-50"
        >
          {mutateLabel}
        </button>
        <button
          type="button"
          onClick={() => setRedQueen((r) => !r)}
          aria-pressed={redQueen}
          className={cx(
            'inline-flex items-center rounded-pill px-3 py-2 font-display text-sm font-semibold ring-1 ring-inset transition-colors motion-reduce:transition-none',
            redQueen
              ? 'bg-accent-300 text-ink-900 ring-accent-400 hover:bg-accent-400'
              : 'text-ink-600 ring-ink-300 hover:bg-surface-sunken',
          )}
        >
          {redQueenLabel}
        </button>
        <button
          type="button"
          onClick={reset}
          className="inline-flex items-center rounded-pill px-3 py-2 font-display text-sm font-semibold text-ink-500 ring-1 ring-inset ring-ink-200 transition-colors hover:bg-surface-sunken motion-reduce:transition-none"
        >
          {resetLabel}
        </button>
      </div>

      {caption ? <figcaption className="mt-3 text-sm text-ink-500">{caption}</figcaption> : null}
    </figure>
  );
}

export default FitnessLandscape;
