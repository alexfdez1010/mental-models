import { useId, useMemo, useState } from 'react';
import { cx } from '@/components/react/cx';

/** Props for the {@link MoatErosion} island. */
export interface MoatErosionProps {
  /** Heading above the card. */
  title?: string;
  /** Eyebrow label. Defaults to `'Excess returns over time'`. */
  eyebrow?: string;
  /** Instruction line above the chart. */
  instructions?: string;
  /** Caption beneath the card. */
  caption?: string;
  /** Axis label for the vertical (excess return) axis. */
  returnAxisLabel?: string;
  /** Axis label for the horizontal (time) axis. */
  timeAxisLabel?: string;
  /** Label over the moat-strength slider. */
  moatLabel?: string;
  /** Label over the competitive-pressure slider. */
  pressureLabel?: string;
  /** Caption on the low end of the moat slider. */
  moatLowLabel?: string;
  /** Caption on the high end of the moat slider. */
  moatHighLabel?: string;
  /** Caption on the low end of the pressure slider. */
  pressureLowLabel?: string;
  /** Caption on the high end of the pressure slider. */
  pressureHighLabel?: string;
  /** Legend label for the firm's excess-return curve. */
  curveLabel?: string;
  /** Legend label for the commodity baseline (zero excess return). */
  baselineLabel?: string;
  /** Symbol printed before the return numbers (e.g. `'+'`). Defaults to `''`. */
  valuePrefix?: string;
  /** Symbol printed after the return numbers (e.g. `' pts'`). Defaults to `' pts'`. */
  valueSuffix?: string;
  /**
   * Starting moat strength (0–10). Higher = harder for rivals to copy the
   * advantage. Defaults to `3`.
   */
  initialMoat?: number;
  /**
   * Starting competitive pressure (0–10). Higher = rivals imitate and attack
   * faster. Defaults to `6`.
   */
  initialPressure?: number;
  /** Verdict shown when the advantage compounds (net positive). */
  verdictDurable?: string;
  /** Verdict shown when the advantage slowly erodes but survives. */
  verdictEroding?: string;
  /** Verdict shown when the advantage is fully competed away to commodity. */
  verdictCommodity?: string;
  /**
   * Readout template. `{moat}`/`{pressure}`/`{start}`/`{final}`/`{years}`/
   * `{verdict}` are replaced.
   */
  readout?: string;
  /** Extra classes merged onto the root element. */
  className?: string;
}

// ── Geometry ────────────────────────────────────────────────────────────────
const W = 440;
const H = 300;
const PAD_L = 44;
const PAD_R = 14;
const PAD_T = 16;
const PAD_B = 36;
const PLOT_W = W - PAD_L - PAD_R;
const PLOT_H = H - PAD_T - PAD_B;

const YEARS = 24; // horizon
const E0 = 20; // starting excess return (percentage points above cost of capital)
const E_MAX = 36; // ceiling for a compounding moat
const COMMODITY = 2; // below this, the advantage is effectively gone

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const round = (n: number) => Math.round(n);

/** Map a year (0…YEARS) to an SVG x. */
const sx = (t: number) => PAD_L + (t / YEARS) * PLOT_W;
/** Map an excess return (0…E_MAX) to an SVG y (return grows upward). */
const sy = (e: number) => PAD_T + PLOT_H - (clamp(e, 0, E_MAX) / E_MAX) * PLOT_H;

/**
 * Interactive **moats** island — durable advantage vs. the gravity of
 * competition, made visible as a curve of *excess returns* over time.
 *
 * A firm starts earning returns on capital well above its cost of capital (the
 * `E0` starting "excess return"). Every year, the **net** of two forces decides
 * what happens to that excess: the **moat strength** the learner sets (how hard
 * the advantage is to copy) versus the **competitive pressure** (how fast rivals
 * imitate and attack). When pressure beats the moat, the excess return decays
 * toward the **commodity baseline** of zero — the classic "high profits invite
 * imitation that competes them away". When the moat beats pressure (a genuine
 * network effect, switching costs, scale), the excess *compounds*, widening over
 * the years instead of melting.
 *
 * The island plots the excess-return path across {@link YEARS} years, shades the
 * area as cumulative excess profit, marks the start and end, and prints a verdict
 * — commodity, eroding, or durable — with the numbers.
 *
 * Both controls are native, keyboard-operable range inputs with visible labels;
 * the readout is announced via `aria-live`; the SVG is static at each setting and
 * the only motion is a cosmetic tween, disabled under `prefers-reduced-motion`.
 */
export function MoatErosion({
  title,
  eyebrow = 'Excess returns over time',
  instructions = 'A firm starts earning fat returns above its cost of capital. Set how strong its moat is and how hard rivals push. When pressure beats the moat, the excess melts to commodity zero; when the moat wins, it compounds.',
  caption,
  returnAxisLabel = 'Excess return',
  timeAxisLabel = 'Years',
  moatLabel = 'Moat strength (how hard to copy)',
  pressureLabel = 'Competitive pressure (how fast rivals attack)',
  moatLowLabel = 'none',
  moatHighLabel = 'fortress',
  pressureLowLabel = 'calm',
  pressureHighLabel = 'brutal',
  curveLabel = 'Excess return on capital',
  baselineLabel = 'Commodity baseline (zero excess)',
  valuePrefix = '',
  valueSuffix = ' pts',
  initialMoat = 3,
  initialPressure = 6,
  verdictDurable = 'a durable, compounding moat — the advantage widens instead of melting',
  verdictEroding = 'a slowly eroding edge — real for now, but pressure is grinding it down',
  verdictCommodity = 'a mirage — fully competed away to commodity returns',
  readout = 'Moat {moat}/10 against pressure {pressure}/10: the firm starts {start} above its cost of capital and ends at {final} after {years} years — {verdict}.',
  className,
}: MoatErosionProps) {
  const reactId = useId();
  const [moat, setMoat] = useState(clamp(initialMoat, 0, 10));
  const [pressure, setPressure] = useState(clamp(initialPressure, 0, 10));

  const model = useMemo(() => {
    // Net force per year: a positive net compounds the excess, a negative net
    // erodes it. Scaled so a 5-point gap moves the excess ~20% a year.
    const net = moat - pressure;
    const rate = net * 0.04;

    const series: number[] = [E0];
    for (let t = 1; t <= YEARS; t++) {
      const prev = series[t - 1];
      const next = clamp(prev * (1 + rate), 0, E_MAX);
      series.push(next);
    }
    const final = series[YEARS];

    let verdict: 'durable' | 'eroding' | 'commodity';
    if (final <= COMMODITY) verdict = 'commodity';
    else if (final >= E0) verdict = 'durable';
    else verdict = 'eroding';

    return { net, series, final, verdict };
  }, [moat, pressure]);

  const { series, final, verdict } = model;

  const fmt = (n: number) => `${valuePrefix}${round(n)}${valueSuffix}`;

  // Build the curve path and the filled area underneath it.
  const linePts = series.map((e, t) => `${round(sx(t))},${round(sy(e))}`).join(' ');
  const areaPts = `${sx(0)},${sy(0)} ${linePts} ${sx(YEARS)},${sy(0)}`;

  const curveColor =
    verdict === 'durable'
      ? 'var(--color-success)'
      : verdict === 'commodity'
        ? 'var(--color-danger)'
        : 'var(--color-warning)';

  const verdictWord =
    verdict === 'durable' ? verdictDurable : verdict === 'commodity' ? verdictCommodity : verdictEroding;

  const readoutText = readout
    .replace('{moat}', String(moat))
    .replace('{pressure}', String(pressure))
    .replace('{start}', fmt(E0))
    .replace('{final}', fmt(final))
    .replace('{years}', String(YEARS))
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

          {/* Axes */}
          <line x1={PAD_L} y1={PAD_T} x2={PAD_L} y2={PAD_T + PLOT_H} stroke="var(--color-ink-400)" strokeWidth="1.5" />
          <line x1={PAD_L} y1={PAD_T + PLOT_H} x2={PAD_L + PLOT_W} y2={PAD_T + PLOT_H} stroke="var(--color-ink-400)" strokeWidth="1.5" />
          <text x={PAD_L - 6} y={PAD_T + 4} textAnchor="end" fontSize="11" fill="var(--color-ink-500)">
            {returnAxisLabel}
          </text>
          <text x={PAD_L + PLOT_W} y={H - 8} textAnchor="end" fontSize="11" fill="var(--color-ink-500)">
            {timeAxisLabel}
          </text>

          {/* Commodity baseline (zero excess return) */}
          <line
            x1={sx(0)}
            y1={sy(0)}
            x2={sx(YEARS)}
            y2={sy(0)}
            stroke="var(--color-ink-300)"
            strokeWidth="1.5"
            strokeDasharray="4 4"
          />

          {/* Starting-level guide */}
          <line
            x1={sx(0)}
            y1={sy(E0)}
            x2={sx(YEARS)}
            y2={sy(E0)}
            stroke="var(--color-ink-200)"
            strokeWidth="1"
            strokeDasharray="2 5"
          />

          {/* Cumulative excess-profit area */}
          <polygon
            points={areaPts}
            fill={`color-mix(in oklab, ${curveColor} 16%, transparent)`}
            className={tween}
          />

          {/* The excess-return curve */}
          <polyline
            points={linePts}
            fill="none"
            stroke={curveColor}
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={tween}
          />

          {/* Start dot */}
          <circle cx={sx(0)} cy={sy(E0)} r="5" fill="var(--color-brand-600)" stroke="var(--color-surface)" strokeWidth="2" />
          {/* End dot */}
          <circle cx={sx(YEARS)} cy={sy(final)} r="6" fill={curveColor} stroke="var(--color-surface)" strokeWidth="2" className={tween} />
        </svg>
      </div>

      {/* Legend */}
      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs font-medium text-ink-600">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="inline-block h-0 w-5 border-t-[3px]" style={{ borderColor: curveColor }} />
          {curveLabel}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="inline-block h-0 w-5 border-t-[3px] border-dashed border-ink-300" />
          {baselineLabel}
        </span>
      </div>

      {/* Live readout */}
      <p
        aria-live="polite"
        className="mt-4 rounded-card border border-brand-200 bg-brand-50/70 p-3 text-sm leading-relaxed text-ink-700"
      >
        {readoutText}
      </p>

      {/* Moat-strength slider */}
      <div className="mt-4">
        <label
          htmlFor={`${reactId}-moat`}
          className="text-[0.65rem] font-bold uppercase tracking-wide text-ink-600"
        >
          {moatLabel}
        </label>
        <input
          id={`${reactId}-moat`}
          type="range"
          min={0}
          max={10}
          step={1}
          value={moat}
          onChange={(e) => setMoat(Number(e.target.value))}
          aria-valuetext={`${moat} of 10`}
          className="mt-1 h-1.5 w-full cursor-pointer accent-success"
        />
        <div className="flex justify-between text-[0.6rem] font-medium uppercase tracking-wide text-ink-400">
          <span>{moatLowLabel}</span>
          <span>{moatHighLabel}</span>
        </div>
      </div>

      {/* Competitive-pressure slider */}
      <div className="mt-3">
        <label
          htmlFor={`${reactId}-pressure`}
          className="text-[0.65rem] font-bold uppercase tracking-wide text-ink-600"
        >
          {pressureLabel}
        </label>
        <input
          id={`${reactId}-pressure`}
          type="range"
          min={0}
          max={10}
          step={1}
          value={pressure}
          onChange={(e) => setPressure(Number(e.target.value))}
          aria-valuetext={`${pressure} of 10`}
          className="mt-1 h-1.5 w-full cursor-pointer accent-danger"
        />
        <div className="flex justify-between text-[0.6rem] font-medium uppercase tracking-wide text-ink-400">
          <span>{pressureLowLabel}</span>
          <span>{pressureHighLabel}</span>
        </div>
      </div>

      {caption ? <figcaption className="mt-3 text-sm text-ink-500">{caption}</figcaption> : null}
    </figure>
  );
}

export default MoatErosion;
