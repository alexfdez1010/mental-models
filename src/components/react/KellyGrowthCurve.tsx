import { useId, useMemo, useState } from 'react';
import { cx } from '@/components/react/cx';

/** Props for the {@link KellyGrowthCurve} island. */
export interface KellyGrowthCurveProps {
  /** Heading above the card. */
  title?: string;
  /** Eyebrow label. Defaults to `'Kelly growth curve'`. */
  eyebrow?: string;
  /** Instruction line above the chart. */
  instructions?: string;
  /** Caption beneath the card. */
  caption?: string;
  /** Starting win probability, as a percent 5–95. Defaults to `60`. */
  initialWinPct?: number;
  /** Starting net payoff odds b (win pays b-to-1). Defaults to `1` (even money). */
  initialOdds?: number;
  /** Starting bet fraction, as a percent of bankroll. Defaults to `20`. */
  initialFractionPct?: number;

  // ── Labels (all user-facing strings, for i18n) ────────────────────────────
  /** Label over the win-probability slider. */
  winLabel?: string;
  /** Label over the payoff-odds slider. */
  oddsLabel?: string;
  /** Label over the bet-fraction slider. */
  fractionLabel?: string;
  /** x-axis title (bet fraction). */
  axisFractionLabel?: string;
  /** y-axis title (long-run growth rate). */
  axisGrowthLabel?: string;
  /** Stat label for the Kelly fraction f*. */
  kellyStatLabel?: string;
  /** Stat label for the growth rate at the chosen fraction. */
  growthStatLabel?: string;
  /** Stat label for the zero-growth (double-Kelly) fraction. */
  doubleStatLabel?: string;
  /** Small annotation for the under-betting (safe, slow) zone. */
  underLabel?: string;
  /** Small annotation for the over-betting (fast, fatal) zone. */
  overLabel?: string;
  /** Small annotation on the zero-growth crossing near 2·f*. */
  zeroLabel?: string;
  /**
   * Readout template. `{p}`, `{b}`, `{fstar}`, `{f}`, `{growth}`, `{peak}`,
   * `{double}` are replaced with live values.
   */
  readoutTemplate?: string;
  /** Verdict shown when the chosen fraction is safely below Kelly. */
  verdictUnder?: string;
  /** Verdict shown when the chosen fraction is near Kelly. */
  verdictKelly?: string;
  /** Verdict shown when over Kelly but still growing. */
  verdictOver?: string;
  /** Verdict shown when at or beyond the zero-growth fraction (ruin). */
  verdictRuin?: string;
  /** Extra classes merged onto the root element. */
  className?: string;
}

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

/** Per-round expected log-growth of a fraction-f bet: p·ln(1+f·b) + q·ln(1−f). */
function growth(f: number, p: number, b: number): number {
  const q = 1 - p;
  const winF = 1 + f * b;
  const loseF = 1 - f;
  if (winF <= 0 || loseF <= 0) return Number.NEGATIVE_INFINITY;
  return p * Math.log(winF) + q * Math.log(loseF);
}

// ── Chart geometry ──────────────────────────────────────────────────────────
const CW = 340;
const CH = 220;
const PAD_L = 34;
const PAD_R = 12;
const PAD_T = 16;
const PAD_B = 28;
const PLOT_W = CW - PAD_L - PAD_R;
const PLOT_H = CH - PAD_T - PAD_B;

/**
 * **The Kelly growth curve.** Stake a fraction `f` of a compounding bankroll on a
 * repeated favourable bet (win probability `p`, net payoff odds `b`-to-1). The
 * long-run (geometric) growth rate per round is `g(f) = p·ln(1+f·b) + q·ln(1−f)`,
 * a hump: zero at `f = 0`, rising to a single peak at the **Kelly fraction**
 * `f* = p − q/b`, then falling back through **zero near `2·f*`** and diving to
 * negative infinity as `f → 1`. Under-betting is safe but slow; over-betting is
 * fast then fatal; and because the curve is roughly a downward parabola, erring
 * *low* costs far less growth than erring *high*.
 *
 * Everything is analytic and deterministic (no Monte-Carlo, no hydration
 * mismatch). Meaning lives in the `aria-live` readout; the SVG is decorative.
 * Nothing animates on a loop, so it is safe under `prefers-reduced-motion`.
 */
export function KellyGrowthCurve({
  title,
  eyebrow = 'Kelly growth curve',
  instructions = 'Stake a fraction of your bankroll on a repeated favourable bet. The curve is your long-run growth rate per round as a function of that fraction. It peaks at the Kelly fraction f*, falls back to zero near twice f*, and turns negative beyond — bet past there and a positive-edge game still grinds you to ruin. Drag the fraction and watch where you land on the hump.',
  caption,
  initialWinPct = 60,
  initialOdds = 1,
  initialFractionPct = 20,
  winLabel = 'Win probability p',
  oddsLabel = 'Payoff odds b (win pays b-to-1)',
  fractionLabel = 'Bet fraction f (share of bankroll staked)',
  axisFractionLabel = 'Bet fraction f →',
  axisGrowthLabel = 'Growth / round',
  kellyStatLabel = 'Kelly f*',
  growthStatLabel = 'Growth here',
  doubleStatLabel = 'Zero growth ≈ 2f*',
  underLabel = 'safe, slow',
  overLabel = 'fast, then fatal',
  zeroLabel = 'zero growth',
  readoutTemplate = 'With a {p}% win chance at {b}-to-1 odds, the Kelly fraction is f* = {fstar}%. Betting {f}% of your bankroll gives a long-run growth of {growth}%/round; the peak growth (at f*) is {peak}%/round, and growth falls back to zero at about {double}%. {verdict}',
  verdictUnder = 'You are under Kelly: safe, and you keep most of the growth — a sensible place to be.',
  verdictKelly = 'You are near full Kelly: maximum long-run growth, but also maximum volatility.',
  verdictOver = 'You are over Kelly: taking on more swings for LESS growth than f* — a strictly bad trade.',
  verdictRuin = 'You are at or past twice Kelly: your long-run growth is zero or negative — a positive-edge game that still ends in ruin.',
  className,
}: KellyGrowthCurveProps) {
  const reactId = useId();

  const [winPct, setWinPct] = useState(() => clamp(Math.round(initialWinPct), 5, 95));
  const [odds, setOdds] = useState(() => clamp(initialOdds, 0.2, 5));
  const [fPct, setFPct] = useState(() => clamp(Math.round(initialFractionPct), 0, 100));

  const p = winPct / 100;
  const q = 1 - p;
  const b = odds;
  const f = fPct / 100;

  // Kelly fraction and the zero-growth (≈ double-Kelly) crossing.
  const fStarRaw = p - q / b;
  const fStar = clamp(fStarRaw, 0, 1);
  const hasEdge = fStarRaw > 0;

  // Numeric zero crossing above f* (growth returns to 0). Bisection.
  const fZero = useMemo(() => {
    if (!hasEdge) return 0;
    let lo = fStar;
    let hi = 0.999;
    if (growth(hi, p, b) > 0) return hi; // never crosses inside domain
    for (let i = 0; i < 60; i++) {
      const mid = (lo + hi) / 2;
      if (growth(mid, p, b) > 0) lo = mid;
      else hi = mid;
    }
    return (lo + hi) / 2;
  }, [p, b, fStar, hasEdge]);

  // Domain of the plot: show a little past the zero crossing (or 2f*).
  const fMax = clamp(Math.max(0.5, hasEdge ? Math.min(0.99, fZero * 1.15) : 0.5), 0.2, 0.99);

  const K = 140;
  const curve = useMemo(() => {
    const pts: { f: number; g: number }[] = [];
    for (let i = 0; i <= K; i++) {
      const ff = (i / K) * fMax;
      pts.push({ f: ff, g: growth(ff, p, b) });
    }
    return pts;
  }, [p, b, fMax]);

  const peakGrowth = hasEdge ? growth(fStar, p, b) : 0;
  const growthHere = growth(f, p, b);

  // y-axis range: cap the negative plunge so the hump stays readable.
  const yHi = Math.max(peakGrowth * 1.2, 0.01);
  const yLo = -Math.max(peakGrowth * 1.6, 0.02);

  const px = (ff: number) => PAD_L + (ff / fMax) * PLOT_W;
  const py = (g: number) => {
    const gc = clamp(g, yLo, yHi);
    return PAD_T + (1 - (gc - yLo) / (yHi - yLo)) * PLOT_H;
  };

  const linePath =
    'M ' +
    curve
      .map((pt) => `${px(pt.f).toFixed(1)},${py(pt.g).toFixed(1)}`)
      .join(' L ');

  const yZero = py(0);

  const fmtPct = (x: number, d = 1) => (x * 100).toFixed(d);
  const fmtGrowth = (g: number) => {
    if (!isFinite(g)) return '−∞';
    const v = (Math.exp(g) - 1) * 100;
    return (v >= 0 ? '+' : '') + v.toFixed(2);
  };

  let verdict = verdictUnder;
  if (!hasEdge) verdict = verdictRuin;
  else if (f >= fZero - 1e-6) verdict = verdictRuin;
  else if (f > fStar + 0.03) verdict = verdictOver;
  else if (f >= fStar - 0.03) verdict = verdictKelly;
  else verdict = verdictUnder;

  const readout = readoutTemplate
    .replace('{p}', String(winPct))
    .replace('{b}', b.toFixed(b < 1 ? 2 : b % 1 === 0 ? 0 : 1))
    .replace('{fstar}', fmtPct(fStar))
    .replace('{f}', String(fPct))
    .replace('{growth}', fmtGrowth(growthHere))
    .replace('{peak}', fmtGrowth(peakGrowth))
    .replace('{double}', fmtPct(hasEdge ? fZero : 0))
    .replace('{verdict}', verdict);

  return (
    <figure className={cx('brutal my-6 bg-surface p-5 sm:p-6', className)}>
      <p className="font-display text-xs font-semibold uppercase tracking-wide text-accent-600">
        {eyebrow}
      </p>
      {title ? (
        <p className="mt-1 font-display text-lg font-semibold text-ink-900">{title}</p>
      ) : null}

      <p className="mt-2 text-sm font-medium text-ink-700">{instructions}</p>

      <div className="mt-4 grid gap-5 sm:grid-cols-[auto_1fr] sm:items-start">
        {/* The chart */}
        <div className="mx-auto overflow-hidden rounded-card ring-1 ring-inset ring-ink-200 bg-surface-sunken">
          <svg
            viewBox={`0 0 ${CW} ${CH}`}
            className="block h-auto w-[340px] max-w-full"
            role="img"
            aria-label={readout}
          >
            <rect x="0" y="0" width={CW} height={CH} fill="var(--color-surface-sunken)" />

            {/* zero-growth baseline */}
            <line
              x1={PAD_L}
              y1={yZero}
              x2={PAD_L + PLOT_W}
              y2={yZero}
              stroke="var(--color-ink-300)"
              strokeWidth="1"
              strokeDasharray="2 3"
            />
            <text x={PAD_L + PLOT_W} y={yZero - 3} textAnchor="end" fontSize="7.5" fill="var(--color-ink-400)">
              {zeroLabel}
            </text>

            {/* axes */}
            <line x1={PAD_L} y1={PAD_T} x2={PAD_L} y2={PAD_T + PLOT_H} stroke="var(--color-ink-300)" strokeWidth="1" />

            {hasEdge ? (
              <>
                {/* Kelly f* marker */}
                <line
                  x1={px(fStar)}
                  y1={PAD_T}
                  x2={px(fStar)}
                  y2={PAD_T + PLOT_H}
                  stroke="var(--color-accent-600)"
                  strokeWidth="1"
                  strokeDasharray="3 3"
                  opacity="0.8"
                />
                <text x={px(fStar)} y={PAD_T - 4} textAnchor="middle" fontSize="8" fontWeight="700" fill="var(--color-accent-600)">
                  f*
                </text>
                {/* 2f* / zero-growth marker */}
                <line
                  x1={px(Math.min(fZero, fMax))}
                  y1={PAD_T}
                  x2={px(Math.min(fZero, fMax))}
                  y2={PAD_T + PLOT_H}
                  stroke="var(--color-ink-400)"
                  strokeWidth="1"
                  strokeDasharray="2 2"
                  opacity="0.6"
                />
              </>
            ) : null}

            {/* the growth curve */}
            <path
              d={linePath}
              fill="none"
              stroke="var(--color-brand-600)"
              strokeWidth="2.5"
              strokeLinejoin="round"
              strokeLinecap="round"
            />

            {/* current fraction marker */}
            <line
              x1={px(Math.min(f, fMax))}
              y1={PAD_T}
              x2={px(Math.min(f, fMax))}
              y2={PAD_T + PLOT_H}
              stroke="var(--color-ink-500)"
              strokeWidth="1"
              opacity="0.5"
            />
            <circle
              cx={px(Math.min(f, fMax))}
              cy={py(growthHere)}
              r="5"
              fill="var(--color-brand-500)"
              stroke="var(--color-surface)"
              strokeWidth="1.5"
            />

            {/* zone annotations */}
            {hasEdge ? (
              <>
                <text x={px(fStar / 2)} y={PAD_T + PLOT_H + 18} textAnchor="middle" fontSize="7" fill="var(--color-ink-400)">
                  {underLabel}
                </text>
                <text
                  x={px(Math.min((fStar + fMax) / 2, fMax - 0.02))}
                  y={PAD_T + PLOT_H + 18}
                  textAnchor="middle"
                  fontSize="7"
                  fill="var(--color-ink-400)"
                >
                  {overLabel}
                </text>
              </>
            ) : null}

            {/* axis labels */}
            <text x={PAD_L - 4} y={PAD_T + 6} textAnchor="end" fontSize="7.5" fill="var(--color-ink-500)">
              {axisGrowthLabel}
            </text>
            <text x={PAD_L + PLOT_W} y={CH - 10} textAnchor="end" fontSize="8.5" fontWeight="700" fill="var(--color-ink-500)">
              {axisFractionLabel}
            </text>
            <text x={PAD_L} y={CH - 10} textAnchor="start" fontSize="7.5" fill="var(--color-ink-400)">
              0%
            </text>
          </svg>
        </div>

        {/* Stats + readout */}
        <div>
          <dl className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-card border border-accent-300 bg-accent-300/15 p-2">
              <dt className="text-[0.6rem] uppercase tracking-wide text-ink-500">{kellyStatLabel}</dt>
              <dd className="mt-0.5 font-display text-lg font-semibold tabular-nums text-accent-600">
                {fmtPct(fStar, 0)}%
              </dd>
            </div>
            <div className="rounded-card border border-brand-200 bg-brand-50/60 p-2">
              <dt className="text-[0.6rem] uppercase tracking-wide text-ink-500">{growthStatLabel}</dt>
              <dd className="mt-0.5 font-display text-lg font-semibold tabular-nums text-brand-700">
                {fmtGrowth(growthHere)}%
              </dd>
            </div>
            <div className="rounded-card border border-ink-200 bg-surface p-2">
              <dt className="text-[0.6rem] uppercase tracking-wide text-ink-500">{doubleStatLabel}</dt>
              <dd className="mt-0.5 font-display text-lg font-semibold tabular-nums text-ink-700">
                {fmtPct(hasEdge ? fZero : 0, 0)}%
              </dd>
            </div>
          </dl>

          <p
            aria-live="polite"
            className="mt-3 rounded-card border border-accent-300 bg-accent-300/20 p-3 text-sm leading-relaxed text-ink-700"
          >
            {readout}
          </p>
        </div>
      </div>

      {/* Win-probability slider */}
      <div className="mt-5">
        <label
          htmlFor={`${reactId}-win`}
          className="flex items-baseline justify-between gap-2 text-[0.65rem] font-bold uppercase tracking-wide text-ink-600"
        >
          <span>{winLabel}</span>
          <span className="text-sm font-semibold tabular-nums text-accent-600">{winPct}%</span>
        </label>
        <input
          id={`${reactId}-win`}
          type="range"
          min={5}
          max={95}
          step={1}
          value={winPct}
          onChange={(e) => setWinPct(clamp(Number(e.target.value), 5, 95))}
          className="mt-1 h-1.5 w-full cursor-pointer accent-brand-500"
        />
      </div>

      {/* Odds slider */}
      <div className="mt-4">
        <label
          htmlFor={`${reactId}-odds`}
          className="flex items-baseline justify-between gap-2 text-[0.65rem] font-bold uppercase tracking-wide text-ink-600"
        >
          <span>{oddsLabel}</span>
          <span className="text-sm font-semibold tabular-nums text-accent-600">{b.toFixed(1)}-to-1</span>
        </label>
        <input
          id={`${reactId}-odds`}
          type="range"
          min={0.2}
          max={5}
          step={0.1}
          value={odds}
          onChange={(e) => setOdds(clamp(Number(e.target.value), 0.2, 5))}
          className="mt-1 h-1.5 w-full cursor-pointer accent-brand-500"
        />
      </div>

      {/* Bet-fraction slider */}
      <div className="mt-4">
        <label
          htmlFor={`${reactId}-frac`}
          className="flex items-baseline justify-between gap-2 text-[0.65rem] font-bold uppercase tracking-wide text-ink-600"
        >
          <span>{fractionLabel}</span>
          <span className="text-sm font-semibold tabular-nums text-brand-700">{fPct}%</span>
        </label>
        <input
          id={`${reactId}-frac`}
          type="range"
          min={0}
          max={100}
          step={1}
          value={fPct}
          onChange={(e) => setFPct(clamp(Number(e.target.value), 0, 100))}
          className="mt-1 h-1.5 w-full cursor-pointer accent-brand-500"
        />
      </div>

      {caption ? <figcaption className="mt-3 text-sm text-ink-500">{caption}</figcaption> : null}
    </figure>
  );
}

export default KellyGrowthCurve;
