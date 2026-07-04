import { useId, useMemo, useState } from 'react';
import { cx } from '@/components/react/cx';

/** Props for the {@link AuctionSandbox} island. */
export interface AuctionSandboxProps {
  /** Heading above the card. */
  title?: string;
  /** Eyebrow label. Defaults to `'Auction sandbox'`. */
  eyebrow?: string;
  /** Instruction line above the chart. */
  instructions?: string;
  /** Caption beneath the card. */
  caption?: string;
  /** Label over the auction-rule toggle. Defaults to `'Auction rule'`. */
  ruleLabel?: string;
  /** Label on the first-price toggle button. */
  firstPriceLabel?: string;
  /** Label on the second-price toggle button. */
  secondPriceLabel?: string;
  /** Label over the true-value slider. */
  valueLabel?: string;
  /** Label over the your-bid slider. */
  bidLabel?: string;
  /** Label over the top-rival-bid slider. */
  rivalLabel?: string;
  /** Word substituted for `{win}` in the outcome template. Defaults to `'win'`. */
  winWord?: string;
  /** Word substituted for `{lose}` in the outcome template. Defaults to `'lose'`. */
  loseWord?: string;
  /** Heading over the live result readout. Defaults to `'Result'`. */
  resultLabel?: string;
  /**
   * Readout template shown when you win the item. `{win}`/`{price}`/`{value}`/
   * `{surplus}` are replaced.
   */
  outcomeWinTemplate?: string;
  /**
   * Readout template shown when you lose the item. `{lose}`/`{rival}`/`{bid}`/
   * `{surplus}` are replaced.
   */
  outcomeLoseTemplate?: string;
  /** Heading over the strategy-analysis panel. */
  analysisLabel?: string;
  /** Note shown in a second-price auction when your bid equals your value. */
  secondPriceTruthfulNote?: string;
  /** Note shown in a second-price auction when your bid is above your value. */
  secondPriceOverbidNote?: string;
  /** Note shown in a second-price auction when your bid is below your value. */
  secondPriceUnderbidNote?: string;
  /** Note shown in a first-price auction (bid shading). */
  firstPriceNote?: string;
  /** Auction rule at first render. Defaults to `'second'`. */
  initialRule?: 'first' | 'second';
  /** Starting true value. Defaults to `70`. */
  initialValue?: number;
  /** Starting bid. Defaults to `70`. */
  initialBid?: number;
  /** Starting top rival bid. Defaults to `50`. */
  initialRival?: number;
  /** Minimum slider amount. Defaults to `0`. */
  min?: number;
  /** Maximum slider amount. Defaults to `100`. */
  max?: number;
  /** Slider step. Defaults to `5`. */
  step?: number;
  /** Currency/unit symbol. Defaults to `'$'`. */
  unit?: string;
  /** Whether the unit sits before or after the number. Defaults to `'prefix'`. */
  unitPosition?: 'prefix' | 'suffix';
  /** Extra classes merged onto the root element. */
  className?: string;
}

// ── Geometry ────────────────────────────────────────────────────────────────
const W = 460;
const H = 200;
const PAD_L = 96; // room for the row labels on the left
const PAD_R = 24;
const PAD_T = 22;
const PAD_B = 30;
const PLOT_W = W - PAD_L - PAD_R;

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

/**
 * Interactive **incentive compatibility** island — auctions as a mechanism-design
 * lab. The learner picks an **auction rule** and sets their **true value**, their
 * **bid**, and the **top rival bid**, then watches who wins, what price is paid,
 * and the resulting surplus.
 *
 * The whole point is to make a dominant strategy *visible*:
 *
 * - In a **second-price (Vickrey) auction** you pay the runner-up's bid, so the
 *   price you pay never depends on your own bid. Bidding exactly your true value
 *   is a dominant strategy — you win precisely when winning is profitable, and you
 *   can never overpay by overbidding nor forgo a profitable win by underbidding.
 * - In a **first-price auction** you pay your own bid, so bidding your true value
 *   locks in zero surplus. You must *shade* below value, trading a lower chance of
 *   winning for a margin when you do.
 *
 * A horizontal money axis draws markers for your value, your bid, and the top
 * rival bid, plus a distinct **price-paid** marker (and a shaded surplus span)
 * when you win. Surplus can go negative when you overpay, and is coloured
 * accordingly. All state is derived; the only motion is a cosmetic tween of the
 * markers, disabled under `prefers-reduced-motion`, and nothing animates on mount.
 */
export function AuctionSandbox({
  title,
  eyebrow = 'Auction sandbox',
  instructions = 'Pick the auction rule, then set your true value, your bid, and the top rival bid. Watch who wins, what price is paid, and whether your bid is actually a best response.',
  caption,
  ruleLabel = 'Auction rule',
  firstPriceLabel = 'First-price (pay your own bid)',
  secondPriceLabel = 'Second-price (pay the runner-up bid)',
  valueLabel = 'Your true value',
  bidLabel = 'Your bid',
  rivalLabel = 'Top rival bid',
  winWord = 'win',
  loseWord = 'lose',
  resultLabel = 'Result',
  outcomeWinTemplate = 'You {win} the item, paying {price} for something worth {value} — a surplus of {surplus}.',
  outcomeLoseTemplate = 'You {lose}: the top rival bid {rival} beats your {bid}, so you walk away with a surplus of {surplus}.',
  analysisLabel = 'Is your bid a best response?',
  secondPriceTruthfulNote = 'Bidding exactly your value is a dominant strategy. You win precisely when it is profitable, and the price you pay (the runner-up bid) never depends on your own bid — so you can never overpay or forgo a profitable win.',
  secondPriceOverbidNote = 'Bidding above your value can only hurt. It risks winning at a runner-up price above what the item is worth (negative surplus), and never wins you anything you would actually have wanted.',
  secondPriceUnderbidNote = 'Bidding below your value can only hurt. It risks losing an item you would have profited from, and never lowers the price you pay when you do win — that price is set by the runner-up, not by you.',
  firstPriceNote = 'In a first-price auction you pay your own bid, so bidding your true value guarantees zero surplus. You must shade below your value — trading a lower chance of winning for a margin when you do.',
  initialRule = 'second',
  initialValue = 70,
  initialBid = 70,
  initialRival = 50,
  min = 0,
  max = 100,
  step = 5,
  unit = '$',
  unitPosition = 'prefix',
  className,
}: AuctionSandboxProps) {
  const reactId = useId();

  const [rule, setRule] = useState<'first' | 'second'>(initialRule);
  const [value, setValue] = useState(clamp(initialValue, min, max));
  const [bid, setBid] = useState(clamp(initialBid, min, max));
  const [rival, setRival] = useState(clamp(initialRival, min, max));

  /** Format a money amount with the configured unit and position. */
  const fmt = (n: number) =>
    unitPosition === 'prefix' ? `${unit}${n}` : `${n}${unit}`;

  /** Format a signed surplus (keeps a leading + / − sign). */
  const fmtSigned = (n: number) => {
    const sign = n > 0 ? '+' : n < 0 ? '−' : '';
    const body = unitPosition === 'prefix' ? `${unit}${Math.abs(n)}` : `${Math.abs(n)}${unit}`;
    return `${sign}${body}`;
  };

  const model = useMemo(() => {
    // You win iff your bid strictly beats the rival (a tie goes to the rival).
    const win = bid > rival;
    const price = win ? (rule === 'second' ? rival : bid) : 0;
    const surplus = win ? value - price : 0;
    return { win, price, surplus };
  }, [rule, value, bid, rival]);

  const { win, price, surplus } = model;

  const surplusTone =
    surplus > 0 ? 'text-success' : surplus < 0 ? 'text-danger' : 'text-ink-500';

  // Analysis note selection.
  const analysisNote =
    rule === 'first'
      ? firstPriceNote
      : bid === value
        ? secondPriceTruthfulNote
        : bid > value
          ? secondPriceOverbidNote
          : secondPriceUnderbidNote;

  const readoutText = win
    ? outcomeWinTemplate
        .replace('{win}', winWord)
        .replace('{lose}', loseWord)
        .replace('{price}', fmt(price))
        .replace('{value}', fmt(value))
        .replace('{bid}', fmt(bid))
        .replace('{rival}', fmt(rival))
        .replace('{surplus}', fmtSigned(surplus))
    : outcomeLoseTemplate
        .replace('{win}', winWord)
        .replace('{lose}', loseWord)
        .replace('{price}', fmt(price))
        .replace('{value}', fmt(value))
        .replace('{bid}', fmt(bid))
        .replace('{rival}', fmt(rival))
        .replace('{surplus}', fmtSigned(surplus));

  // ── SVG helpers ─────────────────────────────────────────────────────────
  /** Map a money amount to an SVG x. */
  const mx = (n: number) => PAD_L + ((clamp(n, min, max) - min) / (max - min || 1)) * PLOT_W;

  const priceColor = surplus < 0 ? 'var(--color-danger)' : 'var(--color-success)';
  const valueColor = 'var(--color-ink-400)';
  const bidColor = 'var(--color-brand-500)';
  const rivalColor = 'var(--color-accent-500)';

  const tween = 'transition-all duration-300 ease-out motion-reduce:transition-none';

  // Rows down the plot: value, your bid, rival bid.
  const rowValueY = PAD_T + 8;
  const rowBidY = PAD_T + 54;
  const rowRivalY = PAD_T + 100;
  const axisY = H - PAD_B;

  // A vertical marker with a labelled amount.
  const Marker = ({
    amount,
    y,
    color,
    label,
    dashed,
  }: {
    amount: number;
    y: number;
    color: string;
    label: string;
    dashed?: boolean;
  }) => {
    const x = mx(amount);
    return (
      <g className={tween}>
        {/* Row label */}
        <text
          x={PAD_L - 10}
          y={y + 4}
          textAnchor="end"
          fontSize="11"
          fontWeight="600"
          fill="var(--color-ink-600)"
        >
          {label}
        </text>
        {/* Guide line from the label track out to the marker */}
        <line
          x1={PAD_L}
          y1={y}
          x2={x}
          y2={y}
          stroke={color}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeDasharray={dashed ? '4 4' : undefined}
          className={tween}
          opacity={0.55}
        />
        {/* Dot at the amount */}
        <circle cx={x} cy={y} r="5" fill={color} className={tween} />
        {/* Amount label */}
        <text
          x={x}
          y={y - 10}
          textAnchor="middle"
          fontSize="11"
          fontWeight="700"
          fill={color}
          className={tween}
        >
          {fmt(amount)}
        </text>
      </g>
    );
  };

  return (
    <figure className={cx('brutal my-6 bg-surface p-5 sm:p-6', className)}>
      <p className="font-display text-xs font-semibold uppercase tracking-wide text-brand-600">
        {eyebrow}
      </p>
      {title ? (
        <p className="mt-1 font-display text-lg font-semibold text-ink-900">{title}</p>
      ) : null}

      <p className="mt-2 text-sm font-medium text-ink-700">{instructions}</p>

      {/* Rule toggle (segmented control) */}
      <div className="mt-4">
        <p
          id={`${reactId}-rule`}
          className="text-[0.65rem] font-bold uppercase tracking-wide text-ink-600"
        >
          {ruleLabel}
        </p>
        <div
          role="group"
          aria-labelledby={`${reactId}-rule`}
          className="mt-2 flex flex-col gap-2 sm:flex-row"
        >
          <button
            type="button"
            aria-pressed={rule === 'second'}
            onClick={() => setRule('second')}
            className={cx(
              'flex-1 rounded-pill border-2 border-ink-900 px-3 py-1.5 text-sm font-semibold',
              tween,
              rule === 'second'
                ? 'bg-brand-500 text-white'
                : 'bg-surface text-ink-700 hover:bg-surface-sunken',
            )}
          >
            {secondPriceLabel}
          </button>
          <button
            type="button"
            aria-pressed={rule === 'first'}
            onClick={() => setRule('first')}
            className={cx(
              'flex-1 rounded-pill border-2 border-ink-900 px-3 py-1.5 text-sm font-semibold',
              tween,
              rule === 'first'
                ? 'bg-brand-500 text-white'
                : 'bg-surface text-ink-700 hover:bg-surface-sunken',
            )}
          >
            {firstPriceLabel}
          </button>
        </div>
      </div>

      {/* The chart */}
      <div className="mt-4 overflow-hidden rounded-card border border-ink-100 bg-surface-sunken">
        <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={readoutText}>
          <rect x="0" y="0" width={W} height={H} fill="var(--color-surface-sunken)" />

          {/* Money axis baseline */}
          <line
            x1={PAD_L}
            y1={axisY}
            x2={mx(max)}
            y2={axisY}
            stroke="var(--color-ink-300)"
            strokeWidth="1.5"
          />
          {/* Axis end labels */}
          <text x={PAD_L} y={axisY + 16} textAnchor="start" fontSize="10" fill="var(--color-ink-500)">
            {fmt(min)}
          </text>
          <text x={mx(max)} y={axisY + 16} textAnchor="end" fontSize="10" fill="var(--color-ink-500)">
            {fmt(max)}
          </text>

          {/* Surplus span (price → value) when you win */}
          {win ? (
            <rect
              x={Math.min(mx(price), mx(value))}
              y={rowValueY - 6}
              width={Math.abs(mx(value) - mx(price))}
              height={axisY - (rowValueY - 6)}
              fill={`color-mix(in oklab, ${priceColor} 12%, transparent)`}
              className={tween}
            />
          ) : null}

          {/* Row markers */}
          <Marker amount={value} y={rowValueY} color={valueColor} label={valueLabel} />
          <Marker amount={bid} y={rowBidY} color={bidColor} label={bidLabel} />
          <Marker amount={rival} y={rowRivalY} color={rivalColor} label={rivalLabel} dashed />

          {/* Price-paid marker (drops to the axis) when you win */}
          {win ? (
            <g className={tween}>
              <line
                x1={mx(price)}
                y1={rowBidY}
                x2={mx(price)}
                y2={axisY}
                stroke={priceColor}
                strokeWidth="2"
                strokeDasharray="3 3"
                className={tween}
              />
              <rect
                x={mx(price) - 4}
                y={axisY - 4}
                width="8"
                height="8"
                fill={priceColor}
                className={tween}
              />
              <text
                x={mx(price)}
                y={axisY + 16}
                textAnchor="middle"
                fontSize="10"
                fontWeight="700"
                fill={priceColor}
                className={tween}
              >
                {fmt(price)}
              </text>
            </g>
          ) : null}
        </svg>
      </div>

      {/* Legend */}
      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs font-medium text-ink-600">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="inline-block h-0 w-5 border-t-[3px]" style={{ borderColor: valueColor }} />
          {valueLabel}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="inline-block h-0 w-5 border-t-[3px]" style={{ borderColor: bidColor }} />
          {bidLabel}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="inline-block h-0 w-5 border-t-[3px] border-dashed" style={{ borderColor: rivalColor }} />
          {rivalLabel}
        </span>
      </div>

      {/* Live result readout */}
      <div
        aria-live="polite"
        className="mt-4 rounded-card border border-brand-200 bg-brand-50/70 p-3"
      >
        <p className="text-[0.65rem] font-bold uppercase tracking-wide text-ink-600">{resultLabel}</p>
        <p className="mt-1 text-sm leading-relaxed text-ink-700">{readoutText}</p>
        <p className="mt-1 text-sm font-semibold">
          <span className="text-ink-600">Surplus: </span>
          <span className={cx('tabular-nums', surplusTone)}>{fmtSigned(surplus)}</span>
        </p>
      </div>

      {/* Sliders */}
      <div className="mt-4 space-y-4">
        {/* True value */}
        <div>
          <label
            htmlFor={`${reactId}-value`}
            className="flex items-baseline justify-between gap-2 text-[0.65rem] font-bold uppercase tracking-wide text-ink-600"
          >
            <span>{valueLabel}</span>
            <span className="text-sm font-semibold tabular-nums text-ink-800">{fmt(value)}</span>
          </label>
          <input
            id={`${reactId}-value`}
            type="range"
            min={min}
            max={max}
            step={step}
            value={value}
            onChange={(e) => setValue(Number(e.target.value))}
            aria-valuetext={fmt(value)}
            className="mt-1 h-1.5 w-full cursor-pointer accent-ink-400"
          />
        </div>

        {/* Your bid */}
        <div>
          <label
            htmlFor={`${reactId}-bid`}
            className="flex items-baseline justify-between gap-2 text-[0.65rem] font-bold uppercase tracking-wide text-ink-600"
          >
            <span>{bidLabel}</span>
            <span className="text-sm font-semibold tabular-nums text-brand-600">{fmt(bid)}</span>
          </label>
          <input
            id={`${reactId}-bid`}
            type="range"
            min={min}
            max={max}
            step={step}
            value={bid}
            onChange={(e) => setBid(Number(e.target.value))}
            aria-valuetext={fmt(bid)}
            className="mt-1 h-1.5 w-full cursor-pointer accent-brand-500"
          />
        </div>

        {/* Top rival bid */}
        <div>
          <label
            htmlFor={`${reactId}-rival`}
            className="flex items-baseline justify-between gap-2 text-[0.65rem] font-bold uppercase tracking-wide text-ink-600"
          >
            <span>{rivalLabel}</span>
            <span className="text-sm font-semibold tabular-nums text-accent-600">{fmt(rival)}</span>
          </label>
          <input
            id={`${reactId}-rival`}
            type="range"
            min={min}
            max={max}
            step={step}
            value={rival}
            onChange={(e) => setRival(Number(e.target.value))}
            aria-valuetext={fmt(rival)}
            className="mt-1 h-1.5 w-full cursor-pointer accent-accent-500"
          />
        </div>
      </div>

      {/* Strategy analysis panel */}
      <div
        aria-live="polite"
        className="mt-4 rounded-card border border-ink-200 bg-surface p-3"
      >
        <p className="text-[0.65rem] font-bold uppercase tracking-wide text-ink-600">{analysisLabel}</p>
        <p className="mt-1 text-sm leading-relaxed text-ink-700">{analysisNote}</p>
      </div>

      {caption ? <figcaption className="mt-3 text-sm text-ink-500">{caption}</figcaption> : null}
    </figure>
  );
}

export default AuctionSandbox;
