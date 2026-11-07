import { useId, useMemo, useState } from 'react';
import { cx } from '@/components/react/cx';

/** Props for the {@link ElasticityExplorer} island. */
export interface ElasticityExplorerProps {
  /** Number formatting for visible text and range accessible values. */
  locale?: 'en' | 'es';
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
  /** Caption on the inelastic end of the elasticity slider. Defaults to `'inelastic: e < 1'`. */
  inelasticLabel?: string;
  /** Caption on the elastic end of the elasticity slider. Defaults to `'elastic: e > 1'`. */
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

const P_MIN = 5;
const P_MAX = 10;
const Q_MAX = 5;
const P0 = 5; // reference price
const Q0 = 5; // reference quantity at P0

const sx = (q: number) => PAD_L + (q / Q_MAX) * PLOT_W;
const sy = (p: number) => PAD_T + PLOT_H - (p / P_MAX) * PLOT_H;
const round1 = (n: number) => Math.round(n * 10) / 10;

/** The admitted constant-local-elasticity family, not a fitted empirical curve. */
export function calculateElasticityModel(price: number, elasticity: number): {
  quantity: number;
  revenue: number;
  classification: 'inelastic' | 'unit' | 'elastic';
} {
  if (!Number.isFinite(price) || price < P_MIN || price > P_MAX
    || !Number.isFinite(elasticity) || elasticity < 0.2 || elasticity > 2.5) {
    throw new Error('ElasticityExplorer: price must be in [5,10] and local elasticity in [0.2,2.5].');
  }
  const quantity = Q0 * Math.pow(price / P0, -elasticity);
  return {
    quantity,
    revenue: price * quantity,
    classification: elasticity < 1 ? 'inelastic' : elasticity > 1 ? 'elastic' : 'unit',
  };
}

/**
 * Inspect Q(P)=5(P/5)^(-e) only on P in [5,10]. Fixed axes contain the
 * entire admitted family, so a quantity cap never changes the actual elasticity.
 * Native controls drive the revenue rectangle; motion reduction disables tweens.
 */
export function ElasticityExplorer({
  title,
  locale = 'en',
  eyebrow = 'How much does quantity react?',
  instructions = 'Choose a constant local elasticity, then move price between 5 and 10. The shaded rectangle represents modeled revenue.',
  caption,
  priceAxisLabel = 'Price',
  quantityAxisLabel = 'Quantity',
  elasticityLabel = 'Elasticity',
  inelasticLabel = 'inelastic: e < 1',
  elasticLabel = 'elastic: e > 1',
  priceSliderLabel = 'Price',
  pricePrefix = '$',
  demandLabel = 'Demand',
  revenueLabel = 'Revenue = price × quantity',
  elasticVerdict = 'elastic',
  inelasticVerdict = 'inelastic',
  unitVerdict = 'unit elastic',
  readoutTemplate = 'Local elasticity {e} ({verdict}). Price {price}; modeled quantity {qty}. {dir}',
  revenueUpPhrase = 'Within this constant-elasticity model, higher price raises revenue.',
  revenueDownPhrase = 'Within this constant-elasticity model, higher price lowers revenue.',
  revenueFlatPhrase = 'Revenue is constant throughout this model’s price interval.',
  revenueReadoutLabel = 'Total revenue',
  className,
}: ElasticityExplorerProps) {
  if (locale !== 'en' && locale !== 'es') throw new Error('ElasticityExplorer: locale must be en or es.');
  const numberFormat = new Intl.NumberFormat(locale === 'es' ? 'es-ES' : 'en-US', { maximumFractionDigits: 1 });
  const format = (value: number) => numberFormat.format(value === 0 ? 0 : round1(value));
  const reactId = useId();
  const [elasticity, setElasticity] = useState(0.5);
  const [price, setPrice] = useState(P0);

  const model = useMemo(() => {
    const { quantity: q, revenue, classification } = calculateElasticityModel(price, elasticity);
    // Demand curve sampled across the price domain.
    const pts: string[] = [];
    const n = 40;
    for (let i = 0; i <= n; i++) {
      const p = P_MIN + (i / n) * (P_MAX - P_MIN);
      const qq = calculateElasticityModel(p, elasticity).quantity;
      pts.push(`${sx(qq).toFixed(1)},${sy(p).toFixed(1)}`);
    }
    return { q, revenue, classification, path: `M ${pts.join(' L ')}` };
  }, [price, elasticity]);

  const { q, revenue, classification, path } = model;

  const verdict =
    classification === 'elastic' ? elasticVerdict : classification === 'inelastic' ? inelasticVerdict : unitVerdict;
  const dir =
    classification === 'elastic' ? revenueDownPhrase : classification === 'inelastic' ? revenueUpPhrase : revenueFlatPhrase;

  const priceTxt = `${pricePrefix}${format(price)}`;
  const revTxt = `${pricePrefix}${format(revenue)}`;

  const readout = readoutTemplate
    .replace('{e}', format(elasticity))
    .replace('{verdict}', verdict)
    .replace('{price}', priceTxt)
    .replace('{qty}', format(q))
    .replace('{rev}', revTxt)
    .replace('{dir}', dir);

  const lineTween = 'transition-all duration-300 ease-out motion-reduce:transition-none';

  // Revenue rectangle: from origin to (q, price).
  const rectX = PAD_L;
  const rectY = sy(price);
  const rectW = Math.max(0, sx(q) - PAD_L);
  const rectH = Math.max(0, PAD_T + PLOT_H - sy(price));

  return (
    <figure aria-label={title || instructions} className={cx('brutal my-6 bg-surface p-5 sm:p-6', className)}>
      {eyebrow ? <p className="font-display text-xs font-semibold uppercase tracking-wide text-brand-600">
        {eyebrow}
      </p> : null}
      {title ? (
        <p className="mt-1 font-display text-lg font-semibold text-ink-900">{title}</p>
      ) : null}

      <p className="mt-2 text-sm font-medium text-ink-700">{instructions}</p>

      <div className="mt-4 overflow-hidden rounded-card border border-ink-100 bg-surface-sunken">
        <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={`${readout} ${revenueReadoutLabel}: ${revTxt}`}>
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
          <text x={priceAxisLabel.length > 2 ? 20 : 12} y={priceAxisLabel.length > 2 ? 85 : 49} textAnchor={priceAxisLabel.length > 2 ? 'middle' : 'start'} transform={priceAxisLabel.length > 2 ? 'rotate(-90 20 85)' : undefined} className="text-[20px] sm:text-[11px]" fill="var(--color-ink-500)">
            {priceAxisLabel}
          </text>
          <text x={PAD_L + PLOT_W - 20} y={H - 6} textAnchor="end" className="text-[20px] sm:text-[11px]" fill="var(--color-ink-500)">
            {quantityAxisLabel}
          </text>

          {/* Numeric axes stay fixed across both controls. Names sit outside the ticks. */}
          {[5, 10].map(value => <text key={`p-${value}`} x={PAD_L - 6} y={sy(value) + 4} textAnchor="end" className="text-[20px] sm:text-[10px]" fill="var(--color-ink-700)">{format(value)}</text>)}
          {[0, 5].map(value => <text key={`q-${value}`} x={sx(value)} y={PAD_T + PLOT_H + 24} textAnchor="middle" className="text-[20px] sm:text-[10px]" fill="var(--color-ink-700)">{format(value)}</text>)}

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
            aria-valuetext={`${format(elasticity)} — ${verdict}`}
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
              min={P_MIN}
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
