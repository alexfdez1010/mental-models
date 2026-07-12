import { useId, useState } from 'react';
import { cx } from '@/components/react/cx';

/** Props for the {@link CarnotGauge} island. */
export interface CarnotGaugeProps {
  /** Heading above the card. */
  title?: string;
  /** Eyebrow label. Defaults to `'Heat-engine lab'`. */
  eyebrow?: string;
  /** Instruction line above the gauge. */
  instructions?: string;
  /** Caption beneath the card. */
  caption?: string;
  /** Starting hot-reservoir temperature (kelvin). Defaults to `900`. */
  initialHot?: number;
  /** Starting cold-reservoir temperature (kelvin). Defaults to `300`. */
  initialCold?: number;
  /** Starting claimed efficiency (%). Defaults to `35`. */
  initialClaim?: number;
  /** Minimum temperature on the sliders. Defaults to `280`. */
  minTemp?: number;
  /** Maximum temperature on the sliders. Defaults to `1500`. */
  maxTemp?: number;

  // ── Labels (all user-facing strings, for i18n) ────────────────────────────
  /** Label over the hot-temperature slider. */
  hotLabel?: string;
  /** Label over the cold-temperature slider. */
  coldLabel?: string;
  /** Label over the claimed-efficiency slider. */
  claimLabel?: string;
  /** Label for the Carnot-limit stat. */
  carnotLabel?: string;
  /** Label for the work-out stat. */
  workLabel?: string;
  /** Label for the waste-heat stat. */
  wasteLabel?: string;
  /** Verdict text when the claim is within the Carnot limit. `{waste}` is filled. */
  verdictOk?: string;
  /** Verdict text when the claim exceeds the Carnot limit (impossible). */
  verdictImpossible?: string;
  /** Label for the "forbidden" band above the Carnot ceiling. */
  forbiddenLabel?: string;
  /** Kelvin unit suffix. Defaults to `' K'`. */
  kelvinUnit?: string;
  /**
   * Readout template. `{th}`, `{tc}`, `{carnot}`, `{claim}`, `{verdict}` are
   * replaced with the live values.
   */
  readoutTemplate?: string;
  /** Extra classes merged onto the root element. */
  className?: string;
}

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

// ── Gauge geometry ───────────────────────────────────────────────────────────
const GW = 120;
const GH = 190;
const GPAD_T = 16;
const GPAD_B = 22;
const TRACK_X = 46;
const TRACK_W = 26;
const PLOT_H = GH - GPAD_T - GPAD_B;

/** Map an efficiency in [0,100] to a y-coordinate (0% at bottom, 100% at top). */
const effY = (pct: number) => GPAD_T + (1 - clamp(pct, 0, 100) / 100) * PLOT_H;

/**
 * **The Carnot limit** — a heat engine turns a flow of heat from a hot reservoir
 * into work, dumping the leftover into a cold one. The first law says you cannot
 * get out more energy than you put in; the *second* law says something stricter
 * and stranger: even a perfect, frictionless engine can convert only a *fraction*
 * of the heat into work, set purely by the two temperatures —
 * `η_max = 1 − T_cold / T_hot`. The rest *must* be dumped as waste heat. You can
 * never break even, and 100% efficiency (or any perpetual-motion machine) is
 * flatly impossible.
 *
 * Drag the reservoir temperatures and a *claimed* efficiency. The gauge draws the
 * Carnot ceiling and shades everything above it as the forbidden zone: park your
 * claim there and the verdict flips to "impossible — this violates the second
 * law." Widen the temperature gap and the ceiling rises; shrink it and even a
 * flawless engine becomes nearly useless.
 *
 * Pure, deterministic, no animation — safe under `prefers-reduced-motion`.
 */
export function CarnotGauge({
  title,
  eyebrow = 'Heat-engine lab',
  instructions = 'A heat engine can only turn part of a heat flow into work — the rest is dumped as waste heat, and the ceiling is fixed by the two temperatures alone. Set the reservoirs and a claimed efficiency, and see whether your engine is merely wasteful or outright impossible.',
  caption,
  initialHot = 900,
  initialCold = 300,
  initialClaim = 35,
  minTemp = 280,
  maxTemp = 1500,
  hotLabel = 'Hot reservoir  T_hot',
  coldLabel = 'Cold reservoir  T_cold',
  claimLabel = 'Claimed engine efficiency',
  carnotLabel = 'Carnot limit  η = 1 − Tc/Th',
  workLabel = 'Useful work out',
  wasteLabel = 'Waste heat dumped',
  verdictOk = 'Allowed by the second law — but {waste}% of the heat still leaves as waste. No engine beats this.',
  verdictImpossible = 'Impossible. This claim sits above the Carnot ceiling, so it would violate the second law — a perpetual-motion machine.',
  forbiddenLabel = 'Forbidden',
  kelvinUnit = ' K',
  readoutTemplate = 'Between {th} and {tc}, even a perfect engine caps at {carnot}%. A claim of {claim}% is: {verdict}',
  className,
}: CarnotGaugeProps) {
  const reactId = useId();

  const [hot, setHot] = useState(() => clamp(initialHot, minTemp, maxTemp));
  const [cold, setCold] = useState(() => clamp(initialCold, minTemp, maxTemp));
  const [claim, setClaim] = useState(() => clamp(initialClaim, 0, 100));

  // Keep cold strictly below hot so the Carnot fraction is well-defined.
  const tHot = Math.max(hot, cold + 10);
  const tCold = Math.min(cold, tHot - 10);

  const carnot = (1 - tCold / tHot) * 100;
  const impossible = claim > carnot + 1e-9;
  const work = Math.min(claim, 100);
  const waste = 100 - work;

  const verdict = impossible
    ? verdictImpossible
    : verdictOk.replace('{waste}', String(Math.round(waste)));

  const readout = readoutTemplate
    .replace('{th}', `${Math.round(tHot)}${kelvinUnit}`)
    .replace('{tc}', `${Math.round(tCold)}${kelvinUnit}`)
    .replace('{carnot}', carnot.toFixed(0))
    .replace('{claim}', claim.toFixed(0))
    .replace('{verdict}', verdict);

  const yCarnot = effY(carnot);
  const yClaim = effY(claim);

  const claimColor = impossible ? 'var(--color-danger, #dc2626)' : 'var(--color-brand-500)';

  return (
    <figure className={cx('brutal my-6 bg-surface p-5 sm:p-6', className)}>
      <p className="font-display text-xs font-semibold uppercase tracking-wide text-accent-600">
        {eyebrow}
      </p>
      {title ? (
        <p className="mt-1 font-display text-lg font-semibold text-ink-900">{title}</p>
      ) : null}

      <p className="mt-2 text-sm font-medium text-ink-700">{instructions}</p>

      <div className="mt-4 grid gap-5 sm:grid-cols-[auto_1fr] sm:items-center">
        {/* The gauge */}
        <div className="mx-auto overflow-hidden rounded-card ring-1 ring-inset ring-ink-200 bg-surface-sunken">
          <svg
            viewBox={`0 0 ${GW} ${GH}`}
            className="block h-auto w-[180px]"
            role="img"
            aria-label={readout}
          >
            <rect x="0" y="0" width={GW} height={GH} fill="var(--color-surface-sunken)" />

            {/* Forbidden band: above the Carnot ceiling */}
            <rect
              x={TRACK_X}
              y={GPAD_T}
              width={TRACK_W}
              height={yCarnot - GPAD_T}
              fill="var(--color-danger, #dc2626)"
              opacity="0.14"
            />
            {/* Allowed band: at or below the ceiling */}
            <rect
              x={TRACK_X}
              y={yCarnot}
              width={TRACK_W}
              height={GPAD_T + PLOT_H - yCarnot}
              fill="var(--color-accent-500)"
              opacity="0.12"
            />
            {/* Track outline */}
            <rect
              x={TRACK_X}
              y={GPAD_T}
              width={TRACK_W}
              height={PLOT_H}
              fill="none"
              stroke="var(--color-ink-300)"
              strokeWidth="1.5"
            />

            {/* Claimed-efficiency fill (from bottom up to the claim) */}
            <rect
              x={TRACK_X}
              y={yClaim}
              width={TRACK_W}
              height={GPAD_T + PLOT_H - yClaim}
              fill={claimColor}
              opacity="0.85"
            />

            {/* Carnot ceiling line */}
            <line
              x1={TRACK_X - 8}
              y1={yCarnot}
              x2={TRACK_X + TRACK_W + 8}
              y2={yCarnot}
              stroke="var(--color-ink-700)"
              strokeWidth="2"
            />
            <text
              x={TRACK_X + TRACK_W + 11}
              y={yCarnot + 3}
              fontSize="9"
              fontWeight="700"
              fill="var(--color-ink-700)"
            >
              {carnot.toFixed(0)}%
            </text>
            <text
              x={TRACK_X + TRACK_W / 2}
              y={GPAD_T - 5}
              textAnchor="middle"
              fontSize="8"
              fontWeight="700"
              fill="var(--color-danger, #dc2626)"
            >
              {forbiddenLabel}
            </text>

            {/* Axis ticks 0 / 100 */}
            <text x={TRACK_X - 6} y={GPAD_T + PLOT_H + 3} textAnchor="end" fontSize="8" fill="var(--color-ink-500)">
              0%
            </text>
            <text x={TRACK_X - 6} y={GPAD_T + 3} textAnchor="end" fontSize="8" fill="var(--color-ink-500)">
              100%
            </text>
          </svg>
        </div>

        {/* Stats + energy split */}
        <div>
          <dl className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-card border border-ink-200 bg-surface p-2">
              <dt className="text-[0.6rem] uppercase tracking-wide text-ink-500">{carnotLabel}</dt>
              <dd className="mt-0.5 font-display text-lg font-semibold tabular-nums text-ink-900">
                {carnot.toFixed(0)}%
              </dd>
            </div>
            <div className="rounded-card border border-brand-200 bg-brand-50/60 p-2">
              <dt className="text-[0.6rem] uppercase tracking-wide text-ink-500">{workLabel}</dt>
              <dd className="mt-0.5 font-display text-lg font-semibold tabular-nums text-brand-700">
                {Math.round(work)}%
              </dd>
            </div>
            <div className="rounded-card border border-ink-200 bg-surface p-2">
              <dt className="text-[0.6rem] uppercase tracking-wide text-ink-500">{wasteLabel}</dt>
              <dd className="mt-0.5 font-display text-lg font-semibold tabular-nums text-ink-600">
                {Math.round(waste)}%
              </dd>
            </div>
          </dl>

          {/* Energy split bar: 100 units of heat in → work + waste */}
          <div className="mt-3 flex h-4 w-full overflow-hidden rounded-pill ring-1 ring-inset ring-ink-200">
            <div
              className="h-full transition-[width] duration-200 ease-out motion-reduce:transition-none"
              style={{ width: `${work}%`, background: claimColor }}
            />
            <div
              className="h-full bg-ink-200 transition-[width] duration-200 ease-out motion-reduce:transition-none"
              style={{ width: `${waste}%` }}
            />
          </div>

          <p
            aria-live="polite"
            className={cx(
              'mt-3 rounded-card border p-3 text-sm leading-relaxed',
              impossible
                ? 'border-danger/40 bg-danger/5 text-ink-800'
                : 'border-accent-300 bg-accent-300/20 text-ink-700',
            )}
          >
            {readout}
          </p>
        </div>
      </div>

      {/* Sliders */}
      <div className="mt-5 grid gap-4 sm:grid-cols-3">
        <div>
          <label
            htmlFor={`${reactId}-hot`}
            className="flex items-baseline justify-between gap-2 text-[0.65rem] font-bold uppercase tracking-wide text-ink-600"
          >
            <span>{hotLabel}</span>
            <span className="text-sm font-semibold tabular-nums text-accent-600">
              {Math.round(tHot)}
              {kelvinUnit}
            </span>
          </label>
          <input
            id={`${reactId}-hot`}
            type="range"
            min={minTemp}
            max={maxTemp}
            step={5}
            value={hot}
            onChange={(e) => setHot(clamp(Number(e.target.value), minTemp, maxTemp))}
            className="mt-1 h-1.5 w-full cursor-pointer accent-accent-500"
          />
        </div>
        <div>
          <label
            htmlFor={`${reactId}-cold`}
            className="flex items-baseline justify-between gap-2 text-[0.65rem] font-bold uppercase tracking-wide text-ink-600"
          >
            <span>{coldLabel}</span>
            <span className="text-sm font-semibold tabular-nums text-accent-600">
              {Math.round(tCold)}
              {kelvinUnit}
            </span>
          </label>
          <input
            id={`${reactId}-cold`}
            type="range"
            min={minTemp}
            max={maxTemp}
            step={5}
            value={cold}
            onChange={(e) => setCold(clamp(Number(e.target.value), minTemp, maxTemp))}
            className="mt-1 h-1.5 w-full cursor-pointer accent-accent-500"
          />
        </div>
        <div>
          <label
            htmlFor={`${reactId}-claim`}
            className="flex items-baseline justify-between gap-2 text-[0.65rem] font-bold uppercase tracking-wide text-ink-600"
          >
            <span>{claimLabel}</span>
            <span
              className={cx(
                'text-sm font-semibold tabular-nums',
                impossible ? 'text-danger' : 'text-brand-600',
              )}
            >
              {claim.toFixed(0)}%
            </span>
          </label>
          <input
            id={`${reactId}-claim`}
            type="range"
            min={0}
            max={100}
            step={1}
            value={claim}
            onChange={(e) => setClaim(clamp(Number(e.target.value), 0, 100))}
            className="mt-1 h-1.5 w-full cursor-pointer accent-brand-500"
          />
        </div>
      </div>

      {caption ? <figcaption className="mt-3 text-sm text-ink-500">{caption}</figcaption> : null}
    </figure>
  );
}

export default CarnotGauge;
