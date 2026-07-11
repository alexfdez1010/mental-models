import { useId, useMemo, useState } from 'react';
import { cx } from '@/components/react/cx';

/** Props for the {@link WinnerCurseSim} island. */
export interface WinnerCurseSimProps {
  /** Heading above the card. */
  title?: string;
  /** Eyebrow label. Defaults to `"Winner's-curse lab"`. */
  eyebrow?: string;
  /** Instruction line above the chart. */
  instructions?: string;
  /** Caption beneath the card. */
  caption?: string;
  /** The hidden true common value every bidder is trying to estimate. Defaults to `100`. */
  trueValue?: number;
  /** Maximum estimate noise the slider allows (half-width of the error band). Defaults to `40`. */
  maxNoise?: number;
  /** Starting number of bidders. Defaults to `6`. */
  initialBidders?: number;
  /** Starting estimate noise. Defaults to `25`. */
  initialNoise?: number;
  /** Minimum bidders. Defaults to `2`. */
  minBidders?: number;
  /** Maximum bidders. Defaults to `24`. */
  maxBidders?: number;
  /** Currency/unit symbol. Defaults to `'$'`. */
  unit?: string;

  // ── Labels (all user-facing strings, for i18n) ────────────────────────────
  /** Label over the bidder-count slider. */
  biddersLabel?: string;
  /** Label over the estimate-noise slider. */
  noiseLabel?: string;
  /** Label over the bid-shading toggle. */
  shadeLabel?: string;
  /** Text on the shading toggle when OFF (naive bidding). */
  shadeOffLabel?: string;
  /** Text on the shading toggle when ON (corrected bidding). */
  shadeOnLabel?: string;
  /** Button that runs a single auction. */
  runOneLabel?: string;
  /** Button that runs many auctions. `{n}` is replaced with the batch size. */
  runManyLabel?: string;
  /** Button that clears the running totals. */
  resetLabel?: string;
  /** Legend/label for the true-value marker. */
  trueValueLabel?: string;
  /** Legend/label for a losing bidder's estimate. */
  bidderLabel?: string;
  /** Legend/label for the winning (highest) estimate. */
  winnerLabel?: string;
  /** Legend/label for the shaded winning bid. */
  shadedBidLabel?: string;
  /** Heading over the last-auction readout. */
  lastLabel?: string;
  /** Heading over the running-average readout. */
  averagesLabel?: string;
  /** Label for "auctions run so far". */
  roundsLabel?: string;
  /** Label for the average selection overshoot stat. */
  overshootLabel?: string;
  /** Label for the average overpayment stat. */
  overpayLabel?: string;
  /** Label for the average winner profit stat. */
  profitLabel?: string;
  /** Prompt shown before any auction has been run. */
  emptyLabel?: string;
  /**
   * Note shown under the toggle when shading is on. `{shade}` is replaced with
   * the current shade amount.
   */
  shadeNoteTemplate?: string;
  /**
   * Template for the last-auction sentence. `{winner}`, `{true}`, `{bid}`,
   * `{profit}` are replaced.
   */
  lastTemplate?: string;
  /** Extra classes merged onto the root element. */
  className?: string;
}

// ── Geometry ────────────────────────────────────────────────────────────────
const W = 460;
const H = 150;
const PAD_L = 20;
const PAD_R = 20;
const PAD_T = 20;
const PAD_B = 34;
const PLOT_W = W - PAD_L - PAD_R;

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

/** One auction outcome, kept for the chart + readout. */
interface AuctionResult {
  estimates: number[];
  winnerIdx: number;
  /** The pre-shade estimate of the winning bidder. */
  winningEstimate: number;
  /** The actual (possibly shaded) winning bid = price paid in a first-price auction. */
  winningBid: number;
  /** True value minus price paid — negative when the curse bites. */
  profit: number;
}

/** Running totals across every auction the learner has fired. */
interface Totals {
  rounds: number;
  /** Σ (winning estimate − true value): the selection overshoot. */
  sumOvershoot: number;
  /** Σ (winning bid − true value): the overpayment. */
  sumOverpay: number;
  /** Σ (true value − winning bid): the winner's profit. */
  sumProfit: number;
}

const EMPTY_TOTALS: Totals = { rounds: 0, sumOvershoot: 0, sumOverpay: 0, sumProfit: 0 };

/**
 * Interactive **winner's-curse** island. A hidden true *common value* sits behind
 * the scenes; each of *N* simulated bidders draws a noisy private estimate of it
 * (`trueValue ± noise`, uniform) and bids. The **highest** bidder wins and — in a
 * first-price auction — pays their own bid.
 *
 * The whole point is to make *conditioning on winning* visible. The winner is,
 * by construction, whoever drew the most *optimistic* estimate, so the winning
 * estimate sits systematically **above** the truth — and that gap grows with more
 * bidders and more noise. Run auctions and watch the running **average
 * overpayment** climb: winning is bad news.
 *
 * A **bid-shading** toggle applies the classic correction (shade down by
 * `noise·(N−1)/(N+1)`, the optimum for uniform errors in a common-value
 * first-price auction), which pulls the winner's expected profit back toward zero —
 * and shades *more* the more rivals there are, the model's signature paradox that
 * tougher competition means bidding *less* per signal.
 *
 * Randomness lives entirely in event handlers (button clicks), so nothing is
 * generated during render and there is no motion on mount; the only transition is a
 * cosmetic tween of the markers, disabled under `prefers-reduced-motion`.
 */
export function WinnerCurseSim({
  title,
  eyebrow = "Winner's-curse lab",
  instructions = 'Every bidder guesses the same hidden true value, then bids. The highest guess wins and pays its own bid. Run auctions and watch the average overpayment — winning means you were the most optimistic.',
  caption,
  trueValue = 100,
  maxNoise = 40,
  initialBidders = 6,
  initialNoise = 25,
  minBidders = 2,
  maxBidders = 24,
  unit = '$',
  biddersLabel = 'Number of bidders',
  noiseLabel = 'Estimate noise (how wrong each guess can be)',
  shadeLabel = 'Bidding rule',
  shadeOffLabel = 'Naive (bid your estimate)',
  shadeOnLabel = 'Shaded (correct for winning)',
  runOneLabel = 'Run one auction',
  runManyLabel = 'Run ×50',
  resetLabel = 'Reset',
  trueValueLabel = 'True value',
  bidderLabel = 'A bid',
  winnerLabel = 'Winning estimate',
  shadedBidLabel = 'Shaded winning bid',
  lastLabel = 'Last auction',
  averagesLabel = 'Averages so far',
  roundsLabel = 'Auctions run',
  overshootLabel = 'Avg winning estimate over truth',
  overpayLabel = 'Avg overpayment (bid − value)',
  profitLabel = "Avg winner's profit",
  emptyLabel = 'Press “Run one auction” to hold an auction. Then run ×50 to see the averages settle.',
  shadeNoteTemplate = 'Shading down by {shade} = noise × (N−1)/(N+1). Deeper with more rivals.',
  lastTemplate = 'The winner estimated {winner} for something worth {true}, bid {bid}, and walked away with a profit of {profit}.',
  className,
}: WinnerCurseSimProps) {
  const reactId = useId();

  const [bidders, setBidders] = useState(clamp(initialBidders, minBidders, maxBidders));
  const [noise, setNoise] = useState(clamp(initialNoise, 0, maxNoise));
  const [shade, setShade] = useState(false);
  const [last, setLast] = useState<AuctionResult | null>(null);
  const [totals, setTotals] = useState<Totals>(EMPTY_TOTALS);

  /** Format a money amount. */
  const fmt = (n: number) => `${unit}${Math.round(n)}`;
  /** Format a signed money amount (keeps a leading + / −). */
  const fmtSigned = (n: number) => {
    const r = Math.round(n);
    const sign = r > 0 ? '+' : r < 0 ? '−' : '';
    return `${sign}${unit}${Math.abs(r)}`;
  };
  /** Format a one-decimal signed number for the averages. */
  const fmtSigned1 = (n: number) => {
    const sign = n > 0.05 ? '+' : n < -0.05 ? '−' : '';
    return `${sign}${unit}${Math.abs(n).toFixed(1)}`;
  };

  /**
   * The optimal shade for uniform errors in [−noise, +noise], first-price common
   * value: subtract `noise·(N−1)/(N+1)` from your estimate. Zero when noise is 0.
   */
  const shadeAmount = useMemo(
    () => (noise * (bidders - 1)) / (bidders + 1),
    [noise, bidders],
  );

  /** Simulate one auction under the current settings. Pure of render (called on click). */
  const simulate = (): AuctionResult => {
    const estimates: number[] = [];
    let winnerIdx = 0;
    let bestBid = -Infinity;
    let winningEstimate = trueValue;
    for (let i = 0; i < bidders; i++) {
      // Uniform error in [−noise, +noise].
      const est = trueValue + (Math.random() * 2 - 1) * noise;
      estimates.push(est);
      const bid = shade ? est - shadeAmount : est;
      if (bid > bestBid) {
        bestBid = bid;
        winnerIdx = i;
        winningEstimate = est;
      }
    }
    return {
      estimates,
      winnerIdx,
      winningEstimate,
      winningBid: bestBid,
      profit: trueValue - bestBid,
    };
  };

  /** Run `k` auctions, accumulate the totals, and keep the final one for the chart. */
  const run = (k: number) => {
    // Simulate OUTSIDE the state updater so the updater stays pure (React may
    // invoke it twice under StrictMode, which would otherwise double-count).
    let latest: AuctionResult | null = null;
    let dOvershoot = 0;
    let dOverpay = 0;
    let dProfit = 0;
    for (let i = 0; i < k; i++) {
      const r = simulate();
      latest = r;
      dOvershoot += r.winningEstimate - trueValue;
      dOverpay += r.winningBid - trueValue;
      dProfit += r.profit;
    }
    setTotals((prev) => ({
      rounds: prev.rounds + k,
      sumOvershoot: prev.sumOvershoot + dOvershoot,
      sumOverpay: prev.sumOverpay + dOverpay,
      sumProfit: prev.sumProfit + dProfit,
    }));
    if (latest) setLast(latest);
  };

  const reset = () => {
    setTotals(EMPTY_TOTALS);
    setLast(null);
  };

  const avg = {
    overshoot: totals.rounds ? totals.sumOvershoot / totals.rounds : 0,
    overpay: totals.rounds ? totals.sumOverpay / totals.rounds : 0,
    profit: totals.rounds ? totals.sumProfit / totals.rounds : 0,
  };

  // ── Axis mapping ─────────────────────────────────────────────────────────
  const axisMin = trueValue - maxNoise - 8;
  const axisMax = trueValue + maxNoise + 8;
  const mx = (n: number) =>
    PAD_L + ((clamp(n, axisMin, axisMax) - axisMin) / (axisMax - axisMin || 1)) * PLOT_W;

  const axisY = H - PAD_B;
  const dotY = PAD_T + 34;
  const tween = 'transition-all duration-300 ease-out motion-reduce:transition-none';

  const trueColor = 'var(--color-ink-500)';
  const bidColor = 'var(--color-ink-400)';
  const winColor = 'var(--color-accent-500)';
  const shadeColor = 'var(--color-brand-500)';

  const profitTone =
    avg.profit > 0.05 ? 'text-success' : avg.profit < -0.05 ? 'text-danger' : 'text-ink-500';

  const lastText = last
    ? lastTemplate
        .replace('{winner}', fmt(last.winningEstimate))
        .replace('{true}', fmt(trueValue))
        .replace('{bid}', fmt(last.winningBid))
        .replace('{profit}', fmtSigned(last.profit))
    : emptyLabel;

  return (
    <figure className={cx('brutal my-6 bg-surface p-5 sm:p-6', className)}>
      <p className="font-display text-xs font-semibold uppercase tracking-wide text-brand-600">
        {eyebrow}
      </p>
      {title ? (
        <p className="mt-1 font-display text-lg font-semibold text-ink-900">{title}</p>
      ) : null}

      <p className="mt-2 text-sm font-medium text-ink-700">{instructions}</p>

      {/* The chart: a number line with each bidder's estimate, the winner, and true value */}
      <div className="mt-4 overflow-hidden rounded-card border border-ink-100 bg-surface-sunken">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="h-auto w-full"
          role="img"
          aria-label={lastText}
        >
          <rect x="0" y="0" width={W} height={H} fill="var(--color-surface-sunken)" />

          {/* Value axis baseline */}
          <line
            x1={PAD_L}
            y1={axisY}
            x2={mx(axisMax)}
            y2={axisY}
            stroke="var(--color-ink-300)"
            strokeWidth="1.5"
          />
          <text x={PAD_L} y={axisY + 16} textAnchor="start" fontSize="10" fill="var(--color-ink-500)">
            {fmt(axisMin)}
          </text>
          <text x={mx(axisMax)} y={axisY + 16} textAnchor="end" fontSize="10" fill="var(--color-ink-500)">
            {fmt(axisMax)}
          </text>

          {/* True value line */}
          <line
            x1={mx(trueValue)}
            y1={PAD_T}
            x2={mx(trueValue)}
            y2={axisY}
            stroke={trueColor}
            strokeWidth="2"
            strokeDasharray="4 3"
          />
          <text
            x={mx(trueValue)}
            y={PAD_T - 6}
            textAnchor="middle"
            fontSize="10"
            fontWeight="700"
            fill={trueColor}
          >
            {trueValueLabel} {fmt(trueValue)}
          </text>

          {/* Each bidder's estimate as a dot; loser vs winner coloured */}
          {last
            ? last.estimates.map((est, i) => {
                const isWinner = i === last.winnerIdx;
                return (
                  <circle
                    key={i}
                    cx={mx(est)}
                    cy={dotY}
                    r={isWinner ? 6 : 4}
                    fill={isWinner ? winColor : bidColor}
                    opacity={isWinner ? 1 : 0.55}
                    className={tween}
                  />
                );
              })
            : null}

          {/* The shaded winning bid marker (distinct from the winning estimate) */}
          {last && shade ? (
            <g className={tween}>
              <line
                x1={mx(last.winningBid)}
                y1={dotY}
                x2={mx(last.winningBid)}
                y2={axisY}
                stroke={shadeColor}
                strokeWidth="2"
                strokeDasharray="3 3"
              />
              <rect
                x={mx(last.winningBid) - 4}
                y={dotY - 4}
                width="8"
                height="8"
                fill={shadeColor}
              />
            </g>
          ) : null}

          {/* Winner callout */}
          {last ? (
            <text
              x={mx(last.winningEstimate)}
              y={dotY - 12}
              textAnchor="middle"
              fontSize="10"
              fontWeight="700"
              fill={winColor}
              className={tween}
            >
              {fmt(last.winningEstimate)}
            </text>
          ) : null}
        </svg>
      </div>

      {/* Legend */}
      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs font-medium text-ink-600">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="inline-block h-2 w-2 rounded-full" style={{ background: bidColor }} />
          {bidderLabel}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: winColor }} />
          {winnerLabel}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="inline-block h-0 w-5 border-t-[3px] border-dashed" style={{ borderColor: trueColor }} />
          {trueValueLabel}
        </span>
        {shade ? (
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden className="inline-block h-2.5 w-2.5" style={{ background: shadeColor }} />
            {shadedBidLabel}
          </span>
        ) : null}
      </div>

      {/* Last-auction readout */}
      <div
        aria-live="polite"
        className="mt-4 rounded-card border border-accent-200 bg-accent-50/60 p-3"
      >
        <p className="text-[0.65rem] font-bold uppercase tracking-wide text-ink-600">{lastLabel}</p>
        <p className="mt-1 text-sm leading-relaxed text-ink-700">{lastText}</p>
      </div>

      {/* Running averages */}
      <div
        aria-live="polite"
        className="mt-3 rounded-card border border-ink-200 bg-surface p-3"
      >
        <p className="text-[0.65rem] font-bold uppercase tracking-wide text-ink-600">{averagesLabel}</p>
        <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-xs text-ink-500">{roundsLabel}</dt>
            <dd className="font-semibold tabular-nums text-ink-800">{totals.rounds}</dd>
          </div>
          <div>
            <dt className="text-xs text-ink-500">{overshootLabel}</dt>
            <dd className="font-semibold tabular-nums text-accent-600">{fmtSigned1(avg.overshoot)}</dd>
          </div>
          <div>
            <dt className="text-xs text-ink-500">{overpayLabel}</dt>
            <dd className="font-semibold tabular-nums text-ink-800">{fmtSigned1(avg.overpay)}</dd>
          </div>
          <div>
            <dt className="text-xs text-ink-500">{profitLabel}</dt>
            <dd className={cx('font-semibold tabular-nums', profitTone)}>{fmtSigned1(avg.profit)}</dd>
          </div>
        </dl>
      </div>

      {/* Run controls */}
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => run(1)}
          className={cx(
            'rounded-pill border-2 border-ink-900 bg-brand-500 px-4 py-1.5 text-sm font-semibold text-white',
            tween,
            'hover:bg-brand-600',
          )}
        >
          {runOneLabel}
        </button>
        <button
          type="button"
          onClick={() => run(50)}
          className={cx(
            'rounded-pill border-2 border-ink-900 bg-surface px-4 py-1.5 text-sm font-semibold text-ink-700',
            tween,
            'hover:bg-surface-sunken',
          )}
        >
          {runManyLabel.replace('{n}', '50')}
        </button>
        <button
          type="button"
          onClick={reset}
          className={cx(
            'rounded-pill border-2 border-ink-300 bg-surface px-4 py-1.5 text-sm font-semibold text-ink-500',
            tween,
            'hover:bg-surface-sunken',
          )}
        >
          {resetLabel}
        </button>
      </div>

      {/* Bidding-rule toggle */}
      <div className="mt-4">
        <p
          id={`${reactId}-shade`}
          className="text-[0.65rem] font-bold uppercase tracking-wide text-ink-600"
        >
          {shadeLabel}
        </p>
        <div
          role="group"
          aria-labelledby={`${reactId}-shade`}
          className="mt-2 flex flex-col gap-2 sm:flex-row"
        >
          <button
            type="button"
            aria-pressed={!shade}
            onClick={() => setShade(false)}
            className={cx(
              'flex-1 rounded-pill border-2 border-ink-900 px-3 py-1.5 text-sm font-semibold',
              tween,
              !shade ? 'bg-brand-500 text-white' : 'bg-surface text-ink-700 hover:bg-surface-sunken',
            )}
          >
            {shadeOffLabel}
          </button>
          <button
            type="button"
            aria-pressed={shade}
            onClick={() => setShade(true)}
            className={cx(
              'flex-1 rounded-pill border-2 border-ink-900 px-3 py-1.5 text-sm font-semibold',
              tween,
              shade ? 'bg-brand-500 text-white' : 'bg-surface text-ink-700 hover:bg-surface-sunken',
            )}
          >
            {shadeOnLabel}
          </button>
        </div>
        {shade ? (
          <p className="mt-2 text-xs text-ink-500">
            {shadeNoteTemplate.replace('{shade}', fmt(shadeAmount))}
          </p>
        ) : null}
      </div>

      {/* Sliders */}
      <div className="mt-4 space-y-4">
        <div>
          <label
            htmlFor={`${reactId}-bidders`}
            className="flex items-baseline justify-between gap-2 text-[0.65rem] font-bold uppercase tracking-wide text-ink-600"
          >
            <span>{biddersLabel}</span>
            <span className="text-sm font-semibold tabular-nums text-ink-800">{bidders}</span>
          </label>
          <input
            id={`${reactId}-bidders`}
            type="range"
            min={minBidders}
            max={maxBidders}
            step={1}
            value={bidders}
            onChange={(e) => setBidders(Number(e.target.value))}
            aria-valuetext={String(bidders)}
            className="mt-1 h-1.5 w-full cursor-pointer accent-brand-500"
          />
        </div>

        <div>
          <label
            htmlFor={`${reactId}-noise`}
            className="flex items-baseline justify-between gap-2 text-[0.65rem] font-bold uppercase tracking-wide text-ink-600"
          >
            <span>{noiseLabel}</span>
            <span className="text-sm font-semibold tabular-nums text-accent-600">±{fmt(noise)}</span>
          </label>
          <input
            id={`${reactId}-noise`}
            type="range"
            min={0}
            max={maxNoise}
            step={1}
            value={noise}
            onChange={(e) => setNoise(Number(e.target.value))}
            aria-valuetext={`±${fmt(noise)}`}
            className="mt-1 h-1.5 w-full cursor-pointer accent-accent-500"
          />
        </div>
      </div>

      {caption ? <figcaption className="mt-3 text-sm text-ink-500">{caption}</figcaption> : null}
    </figure>
  );
}

export default WinnerCurseSim;
