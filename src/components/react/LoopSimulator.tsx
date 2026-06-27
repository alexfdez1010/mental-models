import { useId, useMemo, useState } from 'react';
import { cx } from '@/components/react/cx';

/** Props for the {@link LoopSimulator} island. */
export interface LoopSimulatorProps {
  /** Heading above the card. */
  title?: string;
  /** Eyebrow label. Defaults to `'Run the loop'`. */
  eyebrow?: string;
  /** Instruction line above the chart. */
  instructions?: string;
  /** Caption beneath the card. */
  caption?: string;
  /** Group label for the loop-type toggle. Defaults to `'Loop type'`. */
  modeLabel?: string;
  /** Toggle label for the reinforcing mode. Defaults to `'Reinforcing'`. */
  reinforcingLabel?: string;
  /** Toggle label for the balancing mode. Defaults to `'Balancing'`. */
  balancingLabel?: string;
  /** Slider label for the loop strength. Defaults to `'Loop strength'`. */
  gainLabel?: string;
  /** Slider label for the delay. Defaults to `'Delay (steps)'`. */
  delayLabel?: string;
  /** Axis label for the horizontal time axis. Defaults to `'Time →'`. */
  timeAxisLabel?: string;
  /** Axis label for the vertical stock axis. Defaults to `'Stock'`. */
  stockAxisLabel?: string;
  /** Legend label for the stock trajectory. Defaults to `'Stock level'`. */
  stockLegendLabel?: string;
  /** Legend label for the goal line (balancing mode). Defaults to `'Goal'`. */
  goalLegendLabel?: string;
  /**
   * Readout for the reinforcing regime. Placeholders: `{start}` starting stock,
   * `{final}` final stock, `{multiple}` final ÷ start.
   */
  runawayReadout?: string;
  /**
   * Readout for a balancing loop that glides to the goal with no overshoot.
   * Placeholders: `{goal}` the goal, `{final}` final stock.
   */
  smoothReadout?: string;
  /**
   * Readout for a balancing loop that overshoots, then settles. Placeholders:
   * `{goal}`, `{peak}` highest value reached, `{final}` final stock.
   */
  overshootReadout?: string;
  /**
   * Readout for a balancing loop that keeps swinging. Placeholders: `{goal}`,
   * `{peak}` highest value, `{low}` lowest value.
   */
  oscillateReadout?: string;
  /** Extra classes merged onto the root element. */
  className?: string;
}

// ── Geometry ────────────────────────────────────────────────────────────────
const W = 460;
const H = 300;
const PAD_L = 44;
const PAD_R = 16;
const PAD_T = 16;
const PAD_B = 32;
const PLOT_W = W - PAD_L - PAD_R;
const PLOT_H = H - PAD_T - PAD_B;

const STEPS = 46; // simulation length
const S0 = 20; // starting stock, fixed
const GOAL = 70; // target the balancing loop chases, fixed

type Mode = 'reinforcing' | 'balancing';
type Regime = 'runaway' | 'smooth' | 'overshoot' | 'oscillate';

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const round = (n: number) => Math.round(n);

/**
 * Run the discrete-time stock simulation.
 *
 * Reinforcing: the flow is proportional to the stock itself, so the stock
 * compounds — `S(t+1) = S(t)·(1 + g)`. Output feeds back as input and grows
 * without bound (the screech, the snowball, the bank run).
 *
 * Balancing: the flow closes the gap to a fixed `GOAL`, but it reacts to the
 * stock as it was `delay` steps ago — `S(t+1) = S(t) + g·(GOAL − S(t−delay))`.
 * With no delay the stock glides smoothly to the goal; add delay and the loop
 * keeps correcting on stale information, so it overshoots and oscillates.
 */
function simulate(mode: Mode, g: number, delay: number): number[] {
  const s: number[] = [S0];
  for (let t = 0; t < STEPS; t++) {
    const cur = s[t];
    let next: number;
    if (mode === 'reinforcing') {
      next = cur * (1 + g);
    } else {
      const sensed = s[Math.max(0, t - delay)];
      next = cur + g * (GOAL - sensed);
    }
    s.push(next);
  }
  return s;
}

/** Classify the qualitative behaviour of a trajectory for the readout. */
function classify(mode: Mode, s: number[]): Regime {
  if (mode === 'reinforcing') return 'runaway';
  const peak = Math.max(...s);
  const tail = s.slice(-12);
  const tailRange = Math.max(...tail) - Math.min(...tail);
  if (peak <= GOAL + 1) return 'smooth';
  if (tailRange <= 3) return 'overshoot';
  return 'oscillate';
}

/**
 * Interactive **feedback-loop simulator** — the engine room of systems thinking
 * made visible. The learner picks a **reinforcing** or **balancing** loop, sets
 * its **strength**, and (for balancing loops) dials in a **delay**, then watches
 * the stock's trajectory over time.
 *
 * Three lessons live in one chart: a reinforcing loop **runs away** (compounds
 * to the moon); a balancing loop with no delay **glides smoothly** to its goal;
 * and the same balancing loop *with* a delay **overshoots and oscillates**,
 * because it keeps correcting on out-of-date information. The delay slider is the
 * point — it shows why real systems hunt, overshoot, and ring rather than settle.
 *
 * All controls are native, keyboard-operable inputs with visible labels; the
 * readout is announced via `aria-live`; the SVG is static per setting, and the
 * only motion is a cosmetic opacity tween disabled under `prefers-reduced-motion`.
 */
export function LoopSimulator({
  title,
  eyebrow = 'Run the loop',
  instructions = 'Pick a loop type, set its strength, and — for a balancing loop — add a delay. Watch how a reinforcing loop runs away, a balancing loop glides to its goal, and a delay makes that same loop overshoot and oscillate.',
  caption,
  modeLabel = 'Loop type',
  reinforcingLabel = 'Reinforcing',
  balancingLabel = 'Balancing',
  gainLabel = 'Loop strength',
  delayLabel = 'Delay (steps)',
  timeAxisLabel = 'Time →',
  stockAxisLabel = 'Stock',
  stockLegendLabel = 'Stock level',
  goalLegendLabel = 'Goal',
  runawayReadout = 'A reinforcing loop feeds on itself: {start} compounds to about {final} — roughly {multiple}× the start — and just keeps climbing. Nothing here pulls it back; the output is its own input.',
  smoothReadout = 'A balancing loop with no delay glides straight to its goal of {goal} and stays there (it settles near {final}). The gap shrinks every step, so it never overshoots.',
  overshootReadout = 'Add a delay and the loop corrects on stale information: it sails past the goal of {goal} up to about {peak} before swinging back and finally settling near {final}. That post-goal hump is the cost of acting on old data.',
  oscillateReadout = 'With this much delay and strength the loop never settles — it keeps hunting around the goal of {goal}, swinging from about {peak} down to {low} and back. The delay turns a stabiliser into an oscillator.',
  className,
}: LoopSimulatorProps) {
  const reactId = useId();
  const [mode, setMode] = useState<Mode>('reinforcing');
  const [strengthPct, setStrengthPct] = useState(12);
  const [delay, setDelay] = useState(0);

  const g = strengthPct / 100;

  const model = useMemo(() => {
    const s = simulate(mode, g, delay);
    const regime = classify(mode, s);

    const rawMax = Math.max(...s, GOAL);
    const rawMin = Math.min(...s, 0);
    // Pad the range a touch so the trace never kisses the frame.
    const span = Math.max(rawMax - rawMin, 1);
    const maxV = rawMax + span * 0.06;
    const minV = rawMin - span * 0.06;

    const sx = (t: number) => PAD_L + (t / STEPS) * PLOT_W;
    const sy = (v: number) => PAD_T + PLOT_H - ((clamp(v, minV, maxV) - minV) / (maxV - minV)) * PLOT_H;

    const pts = s.map((v, t) => `${sx(t).toFixed(1)},${sy(v).toFixed(1)}`);
    const stockPath = `M ${pts.join(' L ')}`;

    return {
      s,
      regime,
      sx,
      sy,
      maxV,
      minV,
      stockPath,
      peak: Math.max(...s),
      low: Math.min(...s),
      final: s[s.length - 1],
    };
  }, [mode, g, delay]);

  const readout = useMemo(() => {
    const { regime, peak, low, final } = model;
    switch (regime) {
      case 'runaway':
        return runawayReadout
          .replace('{start}', String(S0))
          .replace('{final}', String(round(final)))
          .replace('{multiple}', (final / S0).toFixed(1));
      case 'smooth':
        return smoothReadout.replace('{goal}', String(GOAL)).replace('{final}', String(round(final)));
      case 'overshoot':
        return overshootReadout
          .replace('{goal}', String(GOAL))
          .replace('{peak}', String(round(peak)))
          .replace('{final}', String(round(final)));
      case 'oscillate':
        return oscillateReadout
          .replace('{goal}', String(GOAL))
          .replace('{peak}', String(round(peak)))
          .replace('{low}', String(round(low)));
    }
  }, [model, runawayReadout, smoothReadout, overshootReadout, oscillateReadout]);

  const isBalancing = mode === 'balancing';
  const fade = 'transition-opacity duration-300 ease-out motion-reduce:transition-none';

  // Horizontal gridlines at quartiles of the value range, for reference.
  const gridLines = [0.25, 0.5, 0.75].map((f) => model.minV + f * (model.maxV - model.minV));

  return (
    <figure className={cx('brutal my-6 bg-surface p-5 sm:p-6', className)}>
      <p className="font-display text-xs font-semibold uppercase tracking-wide text-brand-600">{eyebrow}</p>
      {title ? <p className="mt-1 font-display text-lg font-semibold text-ink-900">{title}</p> : null}

      <p className="mt-2 text-sm font-medium text-ink-700">{instructions}</p>

      {/* Mode toggle */}
      <div className="mt-4" role="group" aria-label={modeLabel}>
        <span className="text-[0.65rem] font-bold uppercase tracking-wide text-ink-500">{modeLabel}</span>
        <div className="mt-1 inline-flex rounded-pill border border-ink-200 bg-surface-sunken p-0.5">
          {(['reinforcing', 'balancing'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              aria-pressed={mode === m}
              className={cx(
                'rounded-pill px-4 py-1.5 text-sm font-semibold transition-colors motion-reduce:transition-none',
                mode === m
                  ? m === 'reinforcing'
                    ? 'bg-accent-500 text-white shadow-soft'
                    : 'bg-brand-600 text-white shadow-soft'
                  : 'text-ink-600 hover:text-ink-900',
              )}
            >
              {m === 'reinforcing' ? reinforcingLabel : balancingLabel}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div className="mt-4 overflow-hidden rounded-card border border-ink-100 bg-surface-sunken">
        <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={readout}>
          <rect x="0" y="0" width={W} height={H} fill="var(--color-surface-sunken)" />

          {/* Gridlines */}
          {gridLines.map((v, i) => (
            <line
              key={i}
              x1={PAD_L}
              y1={model.sy(v)}
              x2={PAD_L + PLOT_W}
              y2={model.sy(v)}
              stroke="var(--color-ink-200)"
              strokeWidth="1"
              strokeDasharray="2 4"
            />
          ))}

          {/* Axes */}
          <line x1={PAD_L} y1={PAD_T} x2={PAD_L} y2={PAD_T + PLOT_H} stroke="var(--color-ink-400)" strokeWidth="1.5" />
          <line x1={PAD_L} y1={PAD_T + PLOT_H} x2={PAD_L + PLOT_W} y2={PAD_T + PLOT_H} stroke="var(--color-ink-400)" strokeWidth="1.5" />
          <text x={PAD_L - 6} y={PAD_T + 4} textAnchor="end" fontSize="10" fill="var(--color-ink-500)">
            {stockAxisLabel}
          </text>
          <text x={PAD_L + PLOT_W} y={H - 8} textAnchor="end" fontSize="10" fill="var(--color-ink-500)">
            {timeAxisLabel}
          </text>

          {/* Goal line (balancing only) */}
          {isBalancing ? (
            <g className={fade}>
              <line
                x1={PAD_L}
                y1={model.sy(GOAL)}
                x2={PAD_L + PLOT_W}
                y2={model.sy(GOAL)}
                stroke="var(--color-brand-400)"
                strokeWidth="1.5"
                strokeDasharray="6 4"
              />
              <text x={PAD_L + PLOT_W} y={model.sy(GOAL) - 4} textAnchor="end" fontSize="9" fill="var(--color-brand-500)">
                {goalLegendLabel} · {GOAL}
              </text>
            </g>
          ) : null}

          {/* Stock trajectory */}
          <path
            key={`${mode}-${strengthPct}-${delay}`}
            d={model.stockPath}
            fill="none"
            stroke={isBalancing ? 'var(--color-brand-600)' : 'var(--color-accent-500)'}
            strokeWidth="2.75"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={fade}
          />

          {/* End dot */}
          <circle
            cx={model.sx(STEPS)}
            cy={model.sy(model.final)}
            r="4.5"
            fill={isBalancing ? 'var(--color-brand-600)' : 'var(--color-accent-500)'}
            stroke="var(--color-surface)"
            strokeWidth="2"
            className={fade}
          />
        </svg>
      </div>

      {/* Legend */}
      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs font-medium text-ink-600">
        <span className="inline-flex items-center gap-1.5">
          <span
            aria-hidden
            className={cx('inline-block h-0 w-5 border-t-[3px]', isBalancing ? 'border-brand-600' : 'border-accent-500')}
          />
          {stockLegendLabel}
        </span>
        {isBalancing ? (
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden className="inline-block h-0 w-5 border-t-2 border-dashed border-brand-400" />
            {goalLegendLabel}
          </span>
        ) : null}
      </div>

      {/* Live readout */}
      <p
        aria-live="polite"
        className="mt-4 rounded-card border border-brand-200 bg-brand-50/70 p-3 text-sm leading-relaxed text-ink-700"
      >
        {readout}
      </p>

      {/* Controls */}
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor={`${reactId}-g`} className="text-[0.65rem] font-bold uppercase tracking-wide text-ink-500">
            {gainLabel}
          </label>
          <div className="mt-1 flex items-center gap-2">
            <input
              id={`${reactId}-g`}
              type="range"
              min={4}
              max={60}
              step={2}
              value={strengthPct}
              onChange={(e) => setStrengthPct(Number(e.target.value))}
              aria-valuetext={`${strengthPct}%`}
              className={cx('h-1.5 w-full cursor-pointer', isBalancing ? 'accent-brand-600' : 'accent-accent-500')}
            />
            <span className="w-10 shrink-0 text-right font-mono text-xs font-semibold text-ink-700">{strengthPct}%</span>
          </div>
        </div>
        <div>
          <label
            htmlFor={`${reactId}-d`}
            className={cx(
              'text-[0.65rem] font-bold uppercase tracking-wide',
              isBalancing ? 'text-ink-500' : 'text-ink-300',
            )}
          >
            {delayLabel}
          </label>
          <div className="mt-1 flex items-center gap-2">
            <input
              id={`${reactId}-d`}
              type="range"
              min={0}
              max={6}
              step={1}
              value={delay}
              disabled={!isBalancing}
              onChange={(e) => setDelay(Number(e.target.value))}
              aria-valuetext={`${delay}`}
              className="h-1.5 w-full cursor-pointer accent-brand-600 disabled:cursor-not-allowed disabled:opacity-40"
            />
            <span
              className={cx(
                'w-10 shrink-0 text-right font-mono text-xs font-semibold',
                isBalancing ? 'text-ink-700' : 'text-ink-300',
              )}
            >
              {delay}
            </span>
          </div>
        </div>
      </div>

      {caption ? <figcaption className="mt-3 text-sm text-ink-500">{caption}</figcaption> : null}
    </figure>
  );
}

export default LoopSimulator;
