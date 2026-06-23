import { useId, useMemo, useState } from 'react';
import { cx } from '@/components/react/cx';

/** Which price control, if any, is clamped onto the market. */
export type PriceControl = 'none' | 'ceiling' | 'floor';

/** Props for the {@link SupplyDemandChart} island. */
export interface SupplyDemandChartProps {
  /** Heading above the card. */
  title?: string;
  /** Eyebrow label. Defaults to `'Where the curves cross'`. */
  eyebrow?: string;
  /** Instruction line above the chart. */
  instructions?: string;
  /** Caption beneath the card. */
  caption?: string;
  /** Axis label for price (vertical). Defaults to `'Price'`. */
  priceAxisLabel?: string;
  /** Axis label for quantity (horizontal). Defaults to `'Quantity'`. */
  quantityAxisLabel?: string;
  /** Legend label for the demand curve. Defaults to `'Demand'`. */
  demandLabel?: string;
  /** Legend label for the supply curve. Defaults to `'Supply'`. */
  supplyLabel?: string;
  /** Label for the equilibrium point. Defaults to `'Equilibrium'`. */
  equilibriumLabel?: string;
  /** Slider label for shifting demand. Defaults to `'Demand'`. */
  demandShiftLabel?: string;
  /** Slider label for shifting supply. Defaults to `'Supply'`. */
  supplyShiftLabel?: string;
  /** Caption on the "less" end of the demand slider. Defaults to `'less wanted'`. */
  demandLessLabel?: string;
  /** Caption on the "more" end of the demand slider. Defaults to `'more wanted'`. */
  demandMoreLabel?: string;
  /** Caption on the "less" end of the supply slider. Defaults to `'less produced'`. */
  supplyLessLabel?: string;
  /** Caption on the "more" end of the supply slider. Defaults to `'more produced'`. */
  supplyMoreLabel?: string;
  /** Symbol printed before the price number (e.g. `'$'`). Defaults to `'$'`. */
  pricePrefix?: string;
  /** Live readout while the market clears freely. `{price}`/`{qty}` are replaced. */
  readoutTemplate?: string;
  /** Whether to show the price-control row at all. Defaults to `true`. */
  showControl?: boolean;
  /** Label over the price-control selector. Defaults to `'Price control'`. */
  controlLabel?: string;
  /** Option label for no control. Defaults to `'Free market'`. */
  noneLabel?: string;
  /** Option label for a price ceiling. Defaults to `'Price ceiling'`. */
  ceilingLabel?: string;
  /** Option label for a price floor. Defaults to `'Price floor'`. */
  floorLabel?: string;
  /** Slider label for the controlled price. Defaults to `'Set the price'`. */
  controlPriceLabel?: string;
  /** Readout when a binding ceiling creates a shortage. `{gap}`/`{price}` replaced. */
  shortageTemplate?: string;
  /** Readout when a binding floor creates a surplus. `{gap}`/`{price}` replaced. */
  surplusTemplate?: string;
  /** Readout when the control isn't binding (sits on the wrong side of equilibrium). */
  notBindingTemplate?: string;
  /** Word labelling the shaded shortage band. Defaults to `'Shortage'`. */
  shortageBandLabel?: string;
  /** Word labelling the shaded surplus band. Defaults to `'Surplus'`. */
  surplusBandLabel?: string;
  /** Extra classes merged onto the root element. */
  className?: string;
}

// ── Geometry ────────────────────────────────────────────────────────────────
const W = 440;
const H = 320;
const PAD_L = 40;
const PAD_R = 18;
const PAD_T = 16;
const PAD_B = 38;
const PLOT_W = W - PAD_L - PAD_R;
const PLOT_H = H - PAD_T - PAD_B;

const Q_MAX = 10; // quantity domain
const P_MAX = 10; // price domain

// Base linear curves on the price = f(quantity) form.
//   Demand:  P = (DA + demandShift) − DB·Q   (downward sloping)
//   Supply:  P = (SC − supplyShift) + SD·Q   (upward sloping)
const DA = 9; // demand intercept (price at Q=0)
const DB = 0.8; // demand slope magnitude
const SC = 1; // supply intercept (price at Q=0)
const SD = 0.8; // supply slope
const SHIFT_MAX = 3;

/** Map a quantity (0…Q_MAX) to an SVG x. */
const sx = (q: number) => PAD_L + (q / Q_MAX) * PLOT_W;
/** Map a price (0…P_MAX) to an SVG y (price grows upward). */
const sy = (p: number) => PAD_T + PLOT_H - (p / P_MAX) * PLOT_H;

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Interactive **supply & demand** island — the price is where the two curves
 * cross, and pushing either curve moves it in a predictable direction.
 *
 * The learner drags a **demand** slider (how much people want) and a **supply**
 * slider (how much is produced) and watches the **equilibrium** price and
 * quantity slide along with them: more demand or less supply lifts the price,
 * less demand or more supply lowers it. Flip on a **price ceiling** or **price
 * floor** and a horizontal control line clamps the price off equilibrium — the
 * island shades the gap between how much buyers want and how much sellers offer,
 * making a **shortage** (binding ceiling) or **surplus** (binding floor) visible
 * as an actual band on the chart.
 *
 * Every control is a native, keyboard-operable input with a visible label; the
 * equilibrium / shortage / surplus readout is announced via `aria-live`; the SVG
 * is static at each setting and the line tweens are purely cosmetic, disabled
 * under `prefers-reduced-motion`.
 */
export function SupplyDemandChart({
  title,
  eyebrow = 'Where the curves cross',
  instructions = 'Drag demand and supply. The price settles where the two curves meet — push either one and watch the equilibrium move.',
  caption,
  priceAxisLabel = 'Price',
  quantityAxisLabel = 'Quantity',
  demandLabel = 'Demand',
  supplyLabel = 'Supply',
  equilibriumLabel = 'Equilibrium',
  demandShiftLabel = 'Demand',
  supplyShiftLabel = 'Supply',
  demandLessLabel = 'less wanted',
  demandMoreLabel = 'more wanted',
  supplyLessLabel = 'less produced',
  supplyMoreLabel = 'more produced',
  pricePrefix = '$',
  readoutTemplate = 'Free market: the price clears at {price} and {qty} units change hands — the one point where the amount wanted equals the amount supplied.',
  showControl = true,
  controlLabel = 'Price control',
  noneLabel = 'Free market',
  ceilingLabel = 'Price ceiling',
  floorLabel = 'Price floor',
  controlPriceLabel = 'Set the price',
  shortageTemplate = 'Ceiling at {price}: buyers want {qd} but sellers only offer {qs}, leaving a shortage of {gap} units. The price can’t rise to clear the queue.',
  surplusTemplate = 'Floor at {price}: sellers offer {qs} but buyers only want {qd}, leaving a surplus of {gap} units. The price can’t fall to clear the glut.',
  notBindingTemplate = 'This control isn’t binding — it sits on the slack side of equilibrium, so the market still clears at {price} with {qty} units. A ceiling only bites below the market price; a floor only above it.',
  shortageBandLabel = 'Shortage',
  surplusBandLabel = 'Surplus',
  className,
}: SupplyDemandChartProps) {
  const reactId = useId();
  const [demandShift, setDemandShift] = useState(0);
  const [supplyShift, setSupplyShift] = useState(0);
  const [control, setControl] = useState<PriceControl>('none');
  const [controlPrice, setControlPrice] = useState(5);

  const model = useMemo(() => {
    const a = DA + demandShift; // demand intercept
    const c = SC - supplyShift; // supply intercept (more supply → lower)
    // Equilibrium: a − DB·Q = c + SD·Q  →  Q* = (a − c)/(DB + SD)
    const qStar = clamp((a - c) / (DB + SD), 0, Q_MAX);
    const pStar = clamp(c + SD * qStar, 0, P_MAX);

    // Curve endpoints across the visible quantity domain.
    const demandP0 = a; // price at Q=0
    const demandP1 = a - DB * Q_MAX; // price at Q=Q_MAX
    const supplyP0 = c;
    const supplyP1 = c + SD * Q_MAX;

    // Quantities demanded / supplied at a hypothetical clamped price.
    const qd = clamp((a - controlPrice) / DB, 0, Q_MAX);
    const qs = clamp((controlPrice - c) / SD, 0, Q_MAX);

    return { a, c, qStar, pStar, demandP0, demandP1, supplyP0, supplyP1, qd, qs };
  }, [demandShift, supplyShift, controlPrice]);

  const { qStar, pStar, demandP0, demandP1, supplyP0, supplyP1, qd, qs } = model;

  const priceTxt = (p: number) => `${pricePrefix}${round1(p)}`;

  // Decide whether the control actually binds and how big the gap is.
  const binding =
    control === 'ceiling'
      ? controlPrice < pStar - 0.05
      : control === 'floor'
        ? controlPrice > pStar + 0.05
        : false;
  const gap = Math.abs(round1(qd) - round1(qs));

  let readout: string;
  if (control === 'none') {
    readout = readoutTemplate
      .replace('{price}', priceTxt(pStar))
      .replace('{qty}', String(round1(qStar)));
  } else if (!binding) {
    readout = notBindingTemplate
      .replace('{price}', priceTxt(pStar))
      .replace('{qty}', String(round1(qStar)));
  } else if (control === 'ceiling') {
    readout = shortageTemplate
      .replace('{price}', priceTxt(controlPrice))
      .replace('{qd}', String(round1(qd)))
      .replace('{qs}', String(round1(qs)))
      .replace('{gap}', String(gap));
  } else {
    readout = surplusTemplate
      .replace('{price}', priceTxt(controlPrice))
      .replace('{qd}', String(round1(qd)))
      .replace('{qs}', String(round1(qs)))
      .replace('{gap}', String(gap));
  }

  // The shaded shortage/surplus band sits along the control-price line,
  // spanning from the short side to the long side of the market.
  const bandX1 = sx(Math.min(qd, qs));
  const bandX2 = sx(Math.max(qd, qs));
  const bandY = sy(controlPrice);

  const lineTween = 'transition-all duration-500 ease-out motion-reduce:transition-none';

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
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="h-auto w-full"
          role="img"
          aria-label={readout}
        >
          <rect x="0" y="0" width={W} height={H} fill="var(--color-surface-sunken)" />

          {/* Axes */}
          <line x1={PAD_L} y1={PAD_T} x2={PAD_L} y2={PAD_T + PLOT_H} stroke="var(--color-ink-400)" strokeWidth="1.5" />
          <line x1={PAD_L} y1={PAD_T + PLOT_H} x2={PAD_L + PLOT_W} y2={PAD_T + PLOT_H} stroke="var(--color-ink-400)" strokeWidth="1.5" />

          {/* Axis arrows */}
          <text x={PAD_L - 6} y={PAD_T + 4} textAnchor="end" fontSize="11" fill="var(--color-ink-500)">
            {priceAxisLabel}
          </text>
          <text x={PAD_L + PLOT_W} y={H - 10} textAnchor="end" fontSize="11" fill="var(--color-ink-500)">
            {quantityAxisLabel}
          </text>

          {/* Shortage / surplus band */}
          {control !== 'none' && binding ? (
            <>
              <rect
                x={bandX1}
                y={bandY - 7}
                width={Math.max(0, bandX2 - bandX1)}
                height={14}
                fill={
                  control === 'ceiling'
                    ? 'color-mix(in oklab, var(--color-danger) 22%, transparent)'
                    : 'color-mix(in oklab, var(--color-warning) 24%, transparent)'
                }
                className={lineTween}
              />
              <text
                x={(bandX1 + bandX2) / 2}
                y={bandY - 12}
                textAnchor="middle"
                fontSize="10"
                fontWeight="700"
                fill={control === 'ceiling' ? 'var(--color-danger)' : 'var(--color-warning)'}
              >
                {control === 'ceiling' ? shortageBandLabel : surplusBandLabel}
              </text>
            </>
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
            className={lineTween}
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
            className={lineTween}
          />

          {/* Control-price line */}
          {control !== 'none' ? (
            <line
              x1={PAD_L}
              y1={bandY}
              x2={PAD_L + PLOT_W}
              y2={bandY}
              stroke="var(--color-ink-500)"
              strokeWidth="2"
              strokeDasharray="6 4"
              className={lineTween}
            />
          ) : null}

          {/* Equilibrium guide lines + dot (only meaningful with no binding control) */}
          {control === 'none' || !binding ? (
            <>
              <line
                x1={sx(qStar)}
                y1={sy(pStar)}
                x2={sx(qStar)}
                y2={PAD_T + PLOT_H}
                stroke="var(--color-ink-300)"
                strokeWidth="1.5"
                strokeDasharray="4 4"
                className={lineTween}
              />
              <line
                x1={PAD_L}
                y1={sy(pStar)}
                x2={sx(qStar)}
                y2={sy(pStar)}
                stroke="var(--color-ink-300)"
                strokeWidth="1.5"
                strokeDasharray="4 4"
                className={lineTween}
              />
              <circle cx={sx(qStar)} cy={sy(pStar)} r="6" fill="var(--color-success)" stroke="var(--color-surface)" strokeWidth="2" className={lineTween} />
            </>
          ) : null}
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
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="inline-block size-3 rounded-full bg-success" />
          {equilibriumLabel}
        </span>
      </div>

      {/* Live readout */}
      <p
        aria-live="polite"
        className="mt-4 rounded-card border border-brand-200 bg-brand-50/70 p-3 text-sm leading-relaxed text-ink-700"
      >
        {readout}
      </p>

      {/* Shift sliders */}
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <label
            htmlFor={`${reactId}-demand`}
            className="text-[0.65rem] font-bold uppercase tracking-wide text-brand-700"
          >
            {demandShiftLabel}
          </label>
          <input
            id={`${reactId}-demand`}
            type="range"
            min={-SHIFT_MAX}
            max={SHIFT_MAX}
            step={0.5}
            value={demandShift}
            onChange={(e) => setDemandShift(Number(e.target.value))}
            aria-valuetext={demandShift > 0 ? demandMoreLabel : demandShift < 0 ? demandLessLabel : 'neutral'}
            className="mt-1 h-1.5 w-full cursor-pointer accent-brand-600"
          />
          <div className="flex justify-between text-[0.6rem] font-medium uppercase tracking-wide text-ink-400">
            <span>{demandLessLabel}</span>
            <span>{demandMoreLabel}</span>
          </div>
        </div>
        <div>
          <label
            htmlFor={`${reactId}-supply`}
            className="text-[0.65rem] font-bold uppercase tracking-wide text-accent-600"
          >
            {supplyShiftLabel}
          </label>
          <input
            id={`${reactId}-supply`}
            type="range"
            min={-SHIFT_MAX}
            max={SHIFT_MAX}
            step={0.5}
            value={supplyShift}
            onChange={(e) => setSupplyShift(Number(e.target.value))}
            aria-valuetext={supplyShift > 0 ? supplyMoreLabel : supplyShift < 0 ? supplyLessLabel : 'neutral'}
            className="mt-1 h-1.5 w-full cursor-pointer accent-accent-500"
          />
          <div className="flex justify-between text-[0.6rem] font-medium uppercase tracking-wide text-ink-400">
            <span>{supplyLessLabel}</span>
            <span>{supplyMoreLabel}</span>
          </div>
        </div>
      </div>

      {/* Price-control row */}
      {showControl ? (
        <div className="mt-4 rounded-card border-2 border-ink-200 bg-surface-sunken p-3">
          <p className="text-[0.65rem] font-bold uppercase tracking-wide text-ink-500">{controlLabel}</p>
          <div
            role="radiogroup"
            aria-label={controlLabel}
            className="mt-2 flex flex-wrap gap-2"
          >
            {(
              [
                ['none', noneLabel],
                ['ceiling', ceilingLabel],
                ['floor', floorLabel],
              ] as [PriceControl, string][]
            ).map(([value, label]) => {
              const on = control === value;
              return (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setControl(value)}
                  className={cx(
                    'rounded-pill border-2 px-3 py-1 text-xs font-semibold transition-colors',
                    'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600',
                    on
                      ? 'border-brand-500 bg-brand-600 text-white'
                      : 'border-ink-200 bg-surface text-ink-700 hover:border-brand-400',
                  )}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {control !== 'none' ? (
            <div className="mt-3 flex items-center gap-3">
              <label
                htmlFor={`${reactId}-control-price`}
                className="text-[0.65rem] font-bold uppercase tracking-wide text-ink-500"
              >
                {controlPriceLabel}
              </label>
              <input
                id={`${reactId}-control-price`}
                type="range"
                min={0}
                max={P_MAX}
                step={0.5}
                value={controlPrice}
                onChange={(e) => setControlPrice(Number(e.target.value))}
                aria-valuetext={priceTxt(controlPrice)}
                className="h-1.5 w-full max-w-sm cursor-pointer accent-ink-500"
              />
              <span className="w-12 shrink-0 text-right font-mono text-xs font-semibold text-ink-700">
                {priceTxt(controlPrice)}
              </span>
            </div>
          ) : null}
        </div>
      ) : null}

      {caption ? <figcaption className="mt-3 text-sm text-ink-500">{caption}</figcaption> : null}
    </figure>
  );
}

export default SupplyDemandChart;
