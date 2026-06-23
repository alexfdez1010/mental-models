import { useId, useMemo, useState } from 'react';
import { cx } from '@/components/react/cx';

/** Props for the {@link ElasticityExplorer} island. */
export interface ElasticityExplorerProps {
  /** Heading above the card. */
  title?: string;
  /** Eyebrow label. Defaults to `'How much does quantity react?'`. */
  eyebrow?: string;
  /** Instruction line above the chart. */
  instructions?: string;
  /** Caption beneath the card. */
  caption?: string;
  /** Axis label for price (vertical). Defaults to `'Price'`. */
  priceAxisLabel?: string;
  /** Axis label for quantity (horizontal). Defaults to `'Quantity'`. */
  quantityAxisLabel?: string;
  /** Slider label for the elasticity dial. Defaults to `'Elasticity'`. */
  elasticityLabel?: string;
  /** Caption on the inelastic end of the elasticity slider. Defaults to `'inelastic (a necessity)'`. */
  inelasticLabel?: string;
  /** Caption on the elastic end of the elasticity slider. Defaults to `'elastic (a luxury)'`. */
  elasticLabel?: string;
  /** Slider label for the price the learner sets. Defaults to `'Price'`. */
  priceSliderLabel?: string;
  /** Symbol printed before a price (e.g. `'$'`). Defaults to `'$'`. */
  pricePrefix?: string;
  /** Legend label for the demand curve. Defaults to `'Demand'`. */
  demandLabel?: string;
  /** Legend label for the revenue rectangle. Defaults to `'Revenue = price × quantity'`. */
  revenueLabel?: string;
  /** Word for an elastic verdict. Defaults to `'elastic'`. */
  elasticVerdict?: string;
  /** Word for an inelastic verdict. Defaults to `'inelastic'`. */
  inelasticVerdict?: string;
  /** Word for unit-elastic. Defaults to `'unit elastic'`. */
  unitVerdict?: string;
  /**
   * Live readout. `{e}` elasticity, `{verdict}` classification, `{price}` price,
   * `{qty}` quantity, `{rev}` revenue, `{dir}` revenue direction phrase.
   */
  readoutTemplate?: string;
  /** Phrase when raising the price raised revenue. Defaults provided. */
  revenueUpPhrase?: string;
  /** Phrase when raising the price lowered revenue. Defaults provided. */
  revenueDownPhrase?: string;
  /** Phrase when revenue is flat (unit elastic). Defaults provided. */
  revenueFlatPhrase?: string;
  /** Label on the revenue readout line. Defaults to `'Total revenue'`. */
  revenueReadoutLabel?: string;
  /** Extra classes merged onto the root element. */
  className?: string;
}

// ── Geometry ────────────────────────────────────────────────────────────────
const W = 440;
const H = 300;
const PAD_L = 40;
const PAD_R = 18;
const PAD_T = 16;
const PAD_B = 38;
const PLOT_W = W - PAD_L - PAD_R;
const PLOT_H = H - PAD_T - PAD_B;

const P_MAX = 10;
const Q_MAX = 10;
const P0 = 5; // reference price
const Q0 = 5; // reference quantity at P0

const sx = (q: number) => PAD_L + (q / Q_MAX) * PLOT_W;
const sy = (p: number) => PAD_T + PLOT_H - (p / P_MAX) * PLOT_H;
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const round1 = (n: number) => Math.round(n * 10) / 10;

/** Constant-elasticity demand: Q(P) = Q0 · (P/P0)^(−E). */
function quantityAt(price: number, e: number): number {
  if (price <= 0) return Q_MAX;
  return clamp(Q0 * Math.pow(price / P0, -e), 0, Q_MAX);
}

/**
 * Interactive **elasticity explorer** — "how hard does quantity react when the
 * price moves?" made visible, with the revenue twist that makes elasticity
 * matter.
 *
 * The learner sets an **elasticity** dial (from a steep, barely-reacting
 * necessity to a flat, wildly-reacting luxury) and drags the **price**. The
 * demand curve reshapes, the quantity demanded slides along it, and a shaded
 * **revenue rectangle** (price × quantity) grows or shrinks. The lesson the
 * island teaches by construction: when demand is *inelastic* (E < 1) raising the
 * price *raises* revenue, but when it is *elastic* (E > 1) raising the price
 * *lowers* revenue — the rectangle visibly flips direction as the dial crosses 1.
 *
 * Both controls are native, keyboard-operable range inputs with visible labels;
 * the readout is announced via `aria-live`; the SVG is static per setting and the
 * tweens are cosmetic, disabled under `prefers-reduced-motion`.
 */
export function ElasticityExplorer({
  title,
  eyebrow = 'How much does quantity react?',
  instructions = 'Set how elastic demand is, then move the price. Watch the quantity react — and watch total revenue (the shaded box) grow or shrink.',
  caption,
  priceAxisLabel = 'Price',
  quantityAxisLabel = 'Quantity',
  elasticityLabel = 'Elasticity',
  inelasticLabel = 'inelastic (a necessity)',
  elasticLabel = 'elastic (a luxury)',
  priceSliderLabel = 'Price',
  pricePrefix = '$',
  demandLabel = 'Demand',
  revenueLabel = 'Revenue = price × quantity',
  elasticVerdict = 'elastic',
  inelasticVerdict = 'inelastic',
  unitVerdict = 'unit elastic',
  readoutTemplate = 'Elasticity ≈ {e} ({verdict}). At {price}, buyers take {qty} units. {dir}',
  revenueUpPhrase = 'Demand is inelastic, so raising the price RAISES total revenue — the box gets bigger as price climbs.',
  revenueDownPhrase = 'Demand is elastic, so raising the price LOWERS total revenue — buyers flee faster than the price rises and the box shrinks.',
  revenueFlatPhrase = 'Demand is unit elastic, so revenue barely moves — the percentage drop in quantity just offsets the rise in price.',
  revenueReadoutLabel = 'Total revenue',
  className,
}: ElasticityExplorerProps) {
  const reactId = useId();
  const [elasticity, setElasticity] = useState(0.5);
  const [price, setPrice] = useState(P0);

  const model = useMemo(() => {
    const q = quantityAt(price, elasticity);
    const revenue = price * q;
    // Demand curve sampled across the price domain.
    const pts: string[] = [];
    const n = 40;
    for (let i = 0; i <= n; i++) {
      const p = (i / n) * P_MAX;
      const qq = quantityAt(p, elasticity);
      pts.push(`${sx(qq).toFixed(1)},${sy(p).toFixed(1)}`);
    }
    return { q, revenue, path: `M ${pts.join(' L ')}` };
  }, [price, elasticity]);

  const { q, revenue, path } = model;

  const verdict =
    elasticity > 1.1 ? elasticVerdict : elasticity < 0.9 ? inelasticVerdict : unitVerdict;
  const dir =
    elasticity > 1.1 ? revenueDownPhrase : elasticity < 0.9 ? revenueUpPhrase : revenueFlatPhrase;

  const priceTxt = `${pricePrefix}${round1(price)}`;
  const revTxt = `${pricePrefix}${round1(revenue)}`;

  const readout = readoutTemplate
    .replace('{e}', String(round1(elasticity)))
    .replace('{verdict}', verdict)
    .replace('{price}', priceTxt)
    .replace('{qty}', String(round1(q)))
    .replace('{rev}', revTxt)
    .replace('{dir}', dir);

  const lineTween = 'transition-all duration-300 ease-out motion-reduce:transition-none';

  // Revenue rectangle: from origin to (q, price).
  const rectX = PAD_L;
  const rectY = sy(price);
  const rectW = Math.max(0, sx(q) - PAD_L);
  const rectH = Math.max(0, PAD_T + PLOT_H - sy(price));

  return (
    <figure className={cx('brutal my-6 bg-surface p-5 sm:p-6', className)}>
      <p className="font-display text-xs font-semibold uppercase tracking-wide text-brand-600">
        {eyebrow}
      </p>
      {title ? (
        <p className="mt-1 font-display text-lg font-semibold text-ink-900">{title}</p>
      ) : null}

      <p className="mt-2 text-sm font-medium text-ink-700">{instructions}</p>

      <div className="mt-4 overflow-hidden rounded-card border border-ink-100 bg-surface-sunken">
        <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={readout}>
          <rect x="0" y="0" width={W} height={H} fill="var(--color-surface-sunken)" />

          {/* Revenue rectangle */}
          <rect
            x={rectX}
            y={rectY}
            width={rectW}
            height={rectH}
            fill="color-mix(in oklab, var(--color-success) 16%, transparent)"
            stroke="color-mix(in oklab, var(--color-success) 45%, transparent)"
            strokeWidth="1"
            className={lineTween}
          />

          {/* Axes */}
          <line x1={PAD_L} y1={PAD_T} x2={PAD_L} y2={PAD_T + PLOT_H} stroke="var(--color-ink-400)" strokeWidth="1.5" />
          <line x1={PAD_L} y1={PAD_T + PLOT_H} x2={PAD_L + PLOT_W} y2={PAD_T + PLOT_H} stroke="var(--color-ink-400)" strokeWidth="1.5" />
          <text x={PAD_L - 6} y={PAD_T + 4} textAnchor="end" fontSize="11" fill="var(--color-ink-500)">
            {priceAxisLabel}
          </text>
          <text x={PAD_L + PLOT_W} y={H - 10} textAnchor="end" fontSize="11" fill="var(--color-ink-500)">
            {quantityAxisLabel}
          </text>

          {/* Demand curve */}
          <path d={path} fill="none" stroke="var(--color-brand-600)" strokeWidth="3" strokeLinecap="round" className={lineTween} />

          {/* Guide lines to the current (q, price) point */}
          <line x1={sx(q)} y1={sy(price)} x2={sx(q)} y2={PAD_T + PLOT_H} stroke="var(--color-ink-300)" strokeWidth="1.5" strokeDasharray="4 4" className={lineTween} />
          <line x1={PAD_L} y1={sy(price)} x2={sx(q)} y2={sy(price)} stroke="var(--color-ink-300)" strokeWidth="1.5" strokeDasharray="4 4" className={lineTween} />
          <circle cx={sx(q)} cy={sy(price)} r="6" fill="var(--color-brand-600)" stroke="var(--color-surface)" strokeWidth="2" className={lineTween} />
        </svg>
      </div>

      {/* Legend */}
      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs font-medium text-ink-600">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="inline-block h-0 w-5 border-t-[3px] border-brand-600" />
          {demandLabel}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span
            aria-hidden
            className="inline-block h-3 w-4 rounded-sm"
            style={{ background: 'color-mix(in oklab, var(--color-success) 16%, transparent)', border: '1px solid color-mix(in oklab, var(--color-success) 45%, transparent)' }}
          />
          {revenueLabel}
        </span>
      </div>

      {/* Live readout */}
      <p aria-live="polite" className="mt-4 rounded-card border border-brand-200 bg-brand-50/70 p-3 text-sm leading-relaxed text-ink-700">
        {readout}
        <span className="mt-1 block font-semibold text-ink-900">
          {revenueReadoutLabel}: {revTxt}
        </span>
      </p>

      {/* Controls */}
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor={`${reactId}-e`} className="text-[0.65rem] font-bold uppercase tracking-wide text-ink-500">
            {elasticityLabel}
          </label>
          <input
            id={`${reactId}-e`}
            type="range"
            min={0.2}
            max={2.5}
            step={0.1}
            value={elasticity}
            onChange={(e) => setElasticity(Number(e.target.value))}
            aria-valuetext={`${round1(elasticity)} — ${verdict}`}
            className="mt-1 h-1.5 w-full cursor-pointer accent-brand-600"
          />
          <div className="flex justify-between text-[0.6rem] font-medium uppercase tracking-wide text-ink-400">
            <span>{inelasticLabel}</span>
            <span>{elasticLabel}</span>
          </div>
        </div>
        <div>
          <label htmlFor={`${reactId}-p`} className="text-[0.65rem] font-bold uppercase tracking-wide text-ink-500">
            {priceSliderLabel}
          </label>
          <div className="mt-1 flex items-center gap-2">
            <input
              id={`${reactId}-p`}
              type="range"
              min={1}
              max={P_MAX}
              step={0.5}
              value={price}
              onChange={(e) => setPrice(Number(e.target.value))}
              aria-valuetext={priceTxt}
              className="h-1.5 w-full cursor-pointer accent-accent-500"
            />
            <span className="w-12 shrink-0 text-right font-mono text-xs font-semibold text-ink-700">
              {priceTxt}
            </span>
          </div>
        </div>
      </div>

      {caption ? <figcaption className="mt-3 text-sm text-ink-500">{caption}</figcaption> : null}
    </figure>
  );
}

export default ElasticityExplorer;
