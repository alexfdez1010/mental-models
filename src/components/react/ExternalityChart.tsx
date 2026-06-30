import { useId, useMemo, useState } from 'react';
import { cx } from '@/components/react/cx';

/** Props for the {@link ExternalityChart} island. */
export interface ExternalityChartProps {
  /** Heading above the card. */
  title?: string;
  /** Eyebrow label. Defaults to `'Private cost vs. social cost'`. */
  eyebrow?: string;
  /** Instruction line above the chart. */
  instructions?: string;
  /** Caption beneath the card. */
  caption?: string;
  /** Axis label for price (vertical). Defaults to `'Price / cost'`. */
  priceAxisLabel?: string;
  /** Axis label for quantity (horizontal). Defaults to `'Quantity'`. */
  quantityAxisLabel?: string;
  /** Legend label for the demand / marginal benefit curve. */
  demandLabel?: string;
  /** Legend label for the supply / marginal private cost curve. */
  supplyLabel?: string;
  /** Legend label for the marginal social cost curve (negative externality). */
  socialCostLabel?: string;
  /** Legend label for the marginal social benefit curve (positive externality). */
  socialBenefitLabel?: string;
  /** Label for the market-outcome point. Defaults to `'Market'`. */
  marketLabel?: string;
  /** Label for the social-optimum point. Defaults to `'Social optimum'`. */
  optimumLabel?: string;
  /** Label over the external-effect slider. */
  externalLabel?: string;
  /** Caption on the "cost" (negative) end of the slider. */
  costEndLabel?: string;
  /** Caption on the "benefit" (positive) end of the slider. */
  benefitEndLabel?: string;
  /** Caption at the neutral middle of the slider. */
  neutralEndLabel?: string;
  /** Label for the corrective-policy toggle. */
  correctionLabel?: string;
  /** Word for the corrective tax (negative externality). Defaults to `'tax'`. */
  taxWord?: string;
  /** Word for the corrective subsidy (positive externality). Defaults to `'subsidy'`. */
  subsidyWord?: string;
  /** Word labelling the shaded deadweight-loss triangle. */
  dwlBandLabel?: string;
  /** Symbol printed before money numbers (e.g. `'$'`). Defaults to `'$'`. */
  pricePrefix?: string;
  /**
   * Starting position of the external-effect slider (signed, clamped to
   * ±4). Negative = a cost (the chart opens on the over-production case);
   * positive = a benefit (the under-production case). Defaults to `-3`.
   */
  initialExternal?: number;
  /** Readout when there is no spillover (slider at 0). `{qm}` replaced. */
  readoutNeutral?: string;
  /** Readout for a negative externality. `{ext}`/`{qm}`/`{qs}`/`{gap}`/`{dwl}` replaced. */
  readoutNegative?: string;
  /** Readout for a positive externality. `{ext}`/`{qm}`/`{qs}`/`{gap}`/`{dwl}` replaced. */
  readoutPositive?: string;
  /** Readout once the corrective policy is applied. `{policy}`/`{ext}`/`{qs}` replaced. */
  readoutCorrected?: string;
  /** Extra classes merged onto the root element. */
  className?: string;
}

// ── Geometry ────────────────────────────────────────────────────────────────
const W = 440;
const H = 320;
const PAD_L = 42;
const PAD_R = 16;
const PAD_T = 16;
const PAD_B = 38;
const PLOT_W = W - PAD_L - PAD_R;
const PLOT_H = H - PAD_T - PAD_B;

const Q_MAX = 12; // quantity domain
const P_MAX = 12; // price domain

// Linear curves on the price = f(quantity) form.
//   Demand / marginal benefit:        P = A − B·Q   (downward)
//   Supply / marginal private cost:    P = C + D·Q   (upward)
const A = 8; // demand intercept
const B = 0.5; // demand slope magnitude
const C = 1; // supply intercept
const D = 0.5; // supply slope
const EXT_MAX = 4; // max external cost/benefit per unit

/** Map a quantity (0…Q_MAX) to an SVG x. */
const sx = (q: number) => PAD_L + (q / Q_MAX) * PLOT_W;
/** Map a price (0…P_MAX) to an SVG y (price grows upward). */
const sy = (p: number) => PAD_T + PLOT_H - (p / P_MAX) * PLOT_H;

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Interactive **externalities** island — the wedge between *private* cost and
 * *social* cost, made visible.
 *
 * The learner drags one slider for the **external effect** per unit: pull it
 * negative and the activity imposes a **cost** on third parties (pollution,
 * noise), so the true **marginal social cost** curve lifts above private supply
 * and the market **over-produces**; pull it positive and the activity confers a
 * **benefit** on others (vaccines, education), so the **marginal social benefit**
 * curve lifts above private demand and the market **under-produces**. The island
 * shades the **over/under-production gap** and the **deadweight-loss triangle**
 * (the welfare the spillover destroys), and prints the market quantity, the
 * social optimum, the gap, and the welfare loss in numbers.
 *
 * Flip the **corrective-policy** toggle and a Pigouvian **tax** (negative case)
 * or **subsidy** (positive case) equal to the spillover drags the private curve
 * onto the social one: the market outcome slides to the social optimum and the
 * deadweight loss vanishes.
 *
 * Every control is a native, keyboard-operable input with a visible label; the
 * readout is announced via `aria-live`; the SVG is static at each setting and
 * the tweens are cosmetic, disabled under `prefers-reduced-motion`.
 */
export function ExternalityChart({
  title,
  eyebrow = 'Private cost vs. social cost',
  instructions = 'Drag the external effect. Negative = a cost dumped on others (the market over-produces); positive = a benefit spilled onto others (it under-produces). Then apply the corrective policy and watch the gap close.',
  caption,
  priceAxisLabel = 'Price / cost',
  quantityAxisLabel = 'Quantity',
  demandLabel = 'Demand (private benefit)',
  supplyLabel = 'Supply (private cost)',
  socialCostLabel = 'Social cost',
  socialBenefitLabel = 'Social benefit',
  marketLabel = 'Market',
  optimumLabel = 'Social optimum',
  externalLabel = 'External effect per unit',
  costEndLabel = 'external cost',
  benefitEndLabel = 'external benefit',
  neutralEndLabel = 'none',
  correctionLabel = 'Apply the corrective policy',
  taxWord = 'tax',
  subsidyWord = 'subsidy',
  dwlBandLabel = 'Deadweight loss',
  pricePrefix = '$',
  initialExternal = -3,
  readoutNeutral = 'No spillover: the market lands at {qm} units — exactly the social optimum. Private cost equals social cost, so the price tells the truth and nothing is wasted.',
  readoutNegative = 'A {ext} external cost per unit lifts true social cost above private cost. The market makes {qm} units but only {qs} is optimal — it over-produces by {gap}, destroying {dwl} of welfare (the shaded triangle).',
  readoutPositive = 'A {ext} external benefit per unit lifts true social value above private. The market makes {qm} units but {qs} is optimal — it under-produces by {gap}, leaving {dwl} of welfare (the shaded triangle) on the table.',
  readoutCorrected = 'With a Pigouvian {policy} of {ext} per unit, the private curve is dragged onto the social one. The market now makes {qs} units — the social optimum — and the deadweight loss is gone.',
  className,
}: ExternalityChartProps) {
  const reactId = useId();
  // ext < 0 → external cost (negative externality); ext > 0 → external benefit.
  const [ext, setExt] = useState(clamp(initialExternal, -EXT_MAX, EXT_MAX));
  const [corrected, setCorrected] = useState(false);

  const model = useMemo(() => {
    const e = ext; // signed per-unit external effect
    const mag = Math.abs(e);

    // Free-market equilibrium: demand = supply.
    const qMarket = (A - C) / (B + D);
    const pMarket = C + D * qMarket; // = demand(qMarket)

    // Social optimum quantity:
    //   negative externality: demand = supply + |e|  → (A − C − |e|)/(B+D)
    //   positive externality: demand + e = supply    → (A − C + e)/(B+D)
    const qSocial = clamp((A - C + e) / (B + D), 0, Q_MAX);

    const gap = Math.abs(qMarket - qSocial);
    const dwl = 0.5 * mag * gap;

    return { e, mag, qMarket, pMarket, qSocial, gap, dwl };
  }, [ext]);

  const { e, mag, qMarket, pMarket, qSocial, gap, dwl } = model;

  const money = (n: number) => `${pricePrefix}${round1(n)}`;
  const num = (n: number) => String(round1(n));

  // Curve endpoints (private demand & supply) across the visible domain.
  const demandP0 = A;
  const demandP1 = A - B * Q_MAX;
  const supplyP0 = C;
  const supplyP1 = C + D * Q_MAX;

  // Social curve endpoints: shift supply up (cost) or demand up (benefit).
  const isNeg = e < -0.001;
  const socP0 = isNeg ? supplyP0 + mag : demandP0 + mag;
  const socP1 = isNeg ? supplyP1 + mag : demandP1 + mag;

  // Where to anchor the two dots on the chart.
  const demandAt = (q: number) => A - B * q;
  const supplyAt = (q: number) => C + D * q;
  const marketDot = { q: qMarket, p: pMarket };
  const optimumDot = { q: qSocial, p: isNeg ? demandAt(qSocial) : supplyAt(qSocial) };

  // Deadweight-loss triangle vertices (only when an externality is present).
  // Negative: between social-cost and demand over [qSocial, qMarket].
  // Positive: between social-benefit and supply over [qMarket, qSocial].
  const dwlPts = (() => {
    if (mag < 0.05) return '';
    if (isNeg) {
      const v1 = `${sx(qSocial)},${sy(demandAt(qSocial))}`;
      const v2 = `${sx(qMarket)},${sy(demandAt(qMarket))}`;
      const v3 = `${sx(qMarket)},${sy(clamp(supplyAt(qMarket) + mag, 0, P_MAX))}`;
      return `${v1} ${v2} ${v3}`;
    }
    const v1 = `${sx(qMarket)},${sy(supplyAt(qMarket))}`;
    const v2 = `${sx(qMarket)},${sy(clamp(demandAt(qMarket) + mag, 0, P_MAX))}`;
    const v3 = `${sx(qSocial)},${sy(supplyAt(qSocial))}`;
    return `${v1} ${v2} ${v3}`;
  })();

  const showSocial = mag >= 0.05;
  const showDwl = showSocial && !corrected;
  const effectiveMarketQ = corrected ? qSocial : qMarket;

  let readout: string;
  if (mag < 0.05) {
    readout = readoutNeutral.replace('{qm}', num(qMarket));
  } else if (corrected) {
    readout = readoutCorrected
      .replace('{policy}', isNeg ? taxWord : subsidyWord)
      .replace('{ext}', money(mag))
      .replace('{qs}', num(qSocial));
  } else if (isNeg) {
    readout = readoutNegative
      .replace('{ext}', money(mag))
      .replace('{qm}', num(qMarket))
      .replace('{qs}', num(qSocial))
      .replace('{gap}', num(gap))
      .replace('{dwl}', money(dwl));
  } else {
    readout = readoutPositive
      .replace('{ext}', money(mag))
      .replace('{qm}', num(qMarket))
      .replace('{qs}', num(qSocial))
      .replace('{gap}', num(gap))
      .replace('{dwl}', money(dwl));
  }

  const tween = 'transition-all duration-500 ease-out motion-reduce:transition-none';
  const socialLabel = isNeg ? socialCostLabel : socialBenefitLabel;

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
        <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={readout}>
          <rect x="0" y="0" width={W} height={H} fill="var(--color-surface-sunken)" />

          {/* Axes */}
          <line x1={PAD_L} y1={PAD_T} x2={PAD_L} y2={PAD_T + PLOT_H} stroke="var(--color-ink-400)" strokeWidth="1.5" />
          <line x1={PAD_L} y1={PAD_T + PLOT_H} x2={PAD_L + PLOT_W} y2={PAD_T + PLOT_H} stroke="var(--color-ink-400)" strokeWidth="1.5" />
          <text x={PAD_L - 6} y={PAD_T + 4} textAnchor="end" fontSize="11" fill="var(--color-ink-500)">
            {priceAxisLabel}
          </text>
          <text x={PAD_L + PLOT_W} y={H - 10} textAnchor="end" fontSize="11" fill="var(--color-ink-500)">
            {quantityAxisLabel}
          </text>

          {/* Deadweight-loss triangle */}
          {showDwl && dwlPts ? (
            <polygon
              points={dwlPts}
              fill="color-mix(in oklab, var(--color-danger) 24%, transparent)"
              stroke="var(--color-danger)"
              strokeWidth="1"
              className={tween}
            />
          ) : null}

          {/* Demand curve (downward) */}
          <line
            x1={sx(0)}
            y1={sy(clamp(demandP0, 0, P_MAX))}
            x2={sx(Q_MAX)}
            y2={sy(clamp(demandP1, 0, P_MAX))}
            stroke="var(--color-brand-600)"
            strokeWidth="3"
            strokeLinecap="round"
          />
          {/* Supply curve (upward) */}
          <line
            x1={sx(0)}
            y1={sy(clamp(supplyP0, 0, P_MAX))}
            x2={sx(Q_MAX)}
            y2={sy(clamp(supplyP1, 0, P_MAX))}
            stroke="var(--color-accent-600)"
            strokeWidth="3"
            strokeLinecap="round"
          />

          {/* Social curve (dashed) — marginal social cost or benefit */}
          {showSocial ? (
            <line
              x1={sx(0)}
              y1={sy(clamp(socP0, 0, P_MAX))}
              x2={sx(Q_MAX)}
              y2={sy(clamp(socP1, 0, P_MAX))}
              stroke="var(--color-danger)"
              strokeWidth="2.5"
              strokeDasharray="7 4"
              strokeLinecap="round"
              className={tween}
            />
          ) : null}

          {/* Guide line at the effective market quantity */}
          <line
            x1={sx(effectiveMarketQ)}
            y1={sy(isNeg ? demandAt(effectiveMarketQ) : supplyAt(effectiveMarketQ))}
            x2={sx(effectiveMarketQ)}
            y2={PAD_T + PLOT_H}
            stroke="var(--color-ink-300)"
            strokeWidth="1.5"
            strokeDasharray="4 4"
            className={tween}
          />

          {/* Social-optimum dot (green) */}
          {showSocial ? (
            <circle
              cx={sx(optimumDot.q)}
              cy={sy(clamp(optimumDot.p, 0, P_MAX))}
              r="6"
              fill="var(--color-success)"
              stroke="var(--color-surface)"
              strokeWidth="2"
              className={tween}
            />
          ) : null}

          {/* Market dot (danger when distorted, success when corrected/neutral) */}
          <circle
            cx={sx(corrected ? qSocial : marketDot.q)}
            cy={sy(clamp(corrected ? optimumDot.p : marketDot.p, 0, P_MAX))}
            r="6"
            fill={!showSocial || corrected ? 'var(--color-success)' : 'var(--color-danger)'}
            stroke="var(--color-surface)"
            strokeWidth="2"
            className={tween}
          />
        </svg>
      </div>

      {/* Legend */}
      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs font-medium text-ink-600">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="inline-block h-0 w-5 border-t-[3px] border-brand-600" />
          {demandLabel}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="inline-block h-0 w-5 border-t-[3px] border-accent-600" />
          {supplyLabel}
        </span>
        {showSocial ? (
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden className="inline-block h-0 w-5 border-t-[3px] border-dashed border-danger" />
            {socialLabel}
          </span>
        ) : null}
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="inline-block size-3 rounded-full bg-success" />
          {optimumLabel}
        </span>
        {showSocial && !corrected ? (
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden className="inline-block size-3 rounded-full bg-danger" />
            {marketLabel}
          </span>
        ) : null}
        {showDwl ? (
          <span className="inline-flex items-center gap-1.5">
            <span
              aria-hidden
              className="inline-block size-3 rounded-[2px]"
              style={{ background: 'color-mix(in oklab, var(--color-danger) 24%, transparent)' }}
            />
            {dwlBandLabel}
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

      {/* External-effect slider */}
      <div className="mt-4">
        <label
          htmlFor={`${reactId}-ext`}
          className="text-[0.65rem] font-bold uppercase tracking-wide text-ink-600"
        >
          {externalLabel}
        </label>
        <input
          id={`${reactId}-ext`}
          type="range"
          min={-EXT_MAX}
          max={EXT_MAX}
          step={0.5}
          value={ext}
          onChange={(e2) => {
            setExt(Number(e2.target.value));
            setCorrected(false);
          }}
          aria-valuetext={
            ext < 0
              ? `${money(mag)} ${costEndLabel}`
              : ext > 0
                ? `${money(mag)} ${benefitEndLabel}`
                : neutralEndLabel
          }
          className="mt-1 h-1.5 w-full cursor-pointer accent-brand-600"
        />
        <div className="flex justify-between text-[0.6rem] font-medium uppercase tracking-wide text-ink-400">
          <span>{costEndLabel}</span>
          <span>{neutralEndLabel}</span>
          <span>{benefitEndLabel}</span>
        </div>
      </div>

      {/* Corrective-policy toggle */}
      <div className="mt-4 rounded-card border-2 border-ink-200 bg-surface-sunken p-3">
        <label className="flex cursor-pointer items-center gap-3">
          <input
            type="checkbox"
            checked={corrected}
            disabled={!showSocial}
            onChange={(e2) => setCorrected(e2.target.checked)}
            className="size-4 cursor-pointer accent-success disabled:cursor-not-allowed"
          />
          <span className="text-sm font-semibold text-ink-700">
            {correctionLabel}
            {showSocial ? (
              <span className="ml-1 font-mono text-xs font-medium text-ink-500">
                ({isNeg ? taxWord : subsidyWord} {money(mag)}/unit)
              </span>
            ) : null}
          </span>
        </label>
      </div>

      {caption ? <figcaption className="mt-3 text-sm text-ink-500">{caption}</figcaption> : null}
    </figure>
  );
}

export default ExternalityChart;
