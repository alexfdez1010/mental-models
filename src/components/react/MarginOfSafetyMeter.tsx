import { useId, useMemo, useState } from 'react';
import { cx } from '@/components/react/cx';

/** Props for the {@link MarginOfSafetyMeter} island. */
export interface MarginOfSafetyMeterProps {
  /** Heading above the card. */
  title?: string;
  /** Eyebrow label. Defaults to `'Stress the structure'`. */
  eyebrow?: string;
  /** Instruction line above the meter. */
  instructions?: string;
  /** Caption beneath the card. */
  caption?: string;
  /** Slider label for the design margin (safety factor). Defaults to `'Safety factor (design margin)'`. */
  factorLabel?: string;
  /** Slider label for the real load that arrives. Defaults to `'Actual load (× the expected)'`. */
  loadLabel?: string;
  /** Unit printed after a load value (e.g. `'t'` for tonnes, `'units'`). Defaults to `'units'`. */
  unit?: string;
  /** Marker label for the estimated/expected load. Defaults to `'Expected load'`. */
  expectedMarkerLabel?: string;
  /** Marker label for the rated capacity. Defaults to `'Rated capacity'`. */
  capacityMarkerLabel?: string;
  /** Marker label for the actual load that arrived. Defaults to `'Actual load'`. */
  actualMarkerLabel?: string;
  /** Legend label for the shaded buffer band. Defaults to `'Margin of safety (the buffer)'`. */
  marginLegendLabel?: string;
  /** Legend label for the overload / failure zone. Defaults to `'Failure zone (load > capacity)'`. */
  failZoneLabel?: string;
  /** Status pill shown while the structure holds. Defaults to `'Holds'`. */
  safeStatusLabel?: string;
  /** Status pill shown when the structure fails. Defaults to `'Fails'`. */
  failStatusLabel?: string;
  /** Thousands separator for big numbers. Defaults to `','` (use `'.'` for es-ES). */
  groupSeparator?: string;
  /**
   * Live readout while the structure holds. Placeholders: `{factor}` safety
   * factor, `{capacity}` rated capacity, `{actual}` actual load, `{headroom}`
   * spare capacity, `{headroomPct}` spare as % of capacity, `{unit}` unit.
   */
  safeReadoutTemplate?: string;
  /**
   * Live readout when the load exceeds capacity. Placeholders: `{factor}`,
   * `{capacity}`, `{actual}`, `{overload}` amount past the limit, `{unit}`.
   */
  failReadoutTemplate?: string;
  /** Extra classes merged onto the root element. */
  className?: string;
}

// ── Geometry ──────────────────────────────────────────────────────────────
const W = 460;
const H = 132;
const PAD_L = 16;
const PAD_R = 16;
const PAD_T = 34;
const TRACK_H = 30;
const TRACK_W = W - PAD_L - PAD_R;

/** The estimate everything is sized against — fixed baseline of 100. */
const EXPECTED = 100;

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

/** Group the integer part of a number with a thousands separator. */
function groupInt(n: number, sep: string): string {
  return Math.round(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, sep);
}

/**
 * Interactive **margin-of-safety meter** — an engineer's load test made
 * tangible. Everything is sized against a fixed **expected load** (100 units).
 *
 * The learner sets a **safety factor** (how much margin they design in → the
 * *rated capacity* = expected × factor) and then dials the **actual load** that
 * really shows up, as a multiple of the expectation. A horizontal stress bar
 * draws three regions: the load you planned for, the shaded **margin of safety**
 * band between the expectation and the rated capacity, and the red **failure
 * zone** beyond capacity. A moving fill shows the real load pushing into that
 * buffer; the moment it crosses the rated capacity the meter flips to a failure
 * state. The lesson the island teaches by construction: a bigger margin buys
 * survival against the surprises your estimate didn't see — and the buffer is
 * exactly what gets eaten when reality comes in heavier than planned.
 *
 * Both controls are native, keyboard-operable range inputs with visible labels;
 * the verdict is announced via `aria-live`; the SVG is static per setting and
 * the only motion is a cosmetic tween disabled under `prefers-reduced-motion`.
 */
export function MarginOfSafetyMeter({
  title,
  eyebrow = 'Stress the structure',
  instructions = 'Everything is built for an expected load of 100. Set how big a safety factor you design in, then dial up the load that actually arrives. Watch the margin — the shaded buffer — get eaten as reality comes in heavier than your estimate.',
  caption,
  factorLabel = 'Safety factor (design margin)',
  loadLabel = 'Actual load (× the expected)',
  unit = 'units',
  expectedMarkerLabel = 'Expected load',
  capacityMarkerLabel = 'Rated capacity',
  actualMarkerLabel = 'Actual load',
  marginLegendLabel = 'Margin of safety (the buffer)',
  failZoneLabel = 'Failure zone (load > capacity)',
  safeStatusLabel = 'Holds',
  failStatusLabel = 'Fails',
  groupSeparator = ',',
  safeReadoutTemplate = 'Designed for {factor}× the expected load, this holds up to {capacity} {unit}. The real load arrived at {actual} {unit} — still {headroom} {unit} ({headroomPct}%) of headroom to spare. The margin absorbed the surprise.',
  failReadoutTemplate = 'Designed for {factor}× the expected load, this holds only up to {capacity} {unit}. The real load arrived at {actual} {unit} — {overload} {unit} past the limit. The margin was too thin, and it fails.',
  className,
}: MarginOfSafetyMeterProps) {
  const reactId = useId();
  const [factor, setFactor] = useState(2);
  const [loadMult, setLoadMult] = useState(1.5);

  const model = useMemo(() => {
    const capacity = EXPECTED * factor;
    const actual = EXPECTED * loadMult;
    const safe = actual <= capacity;
    const headroom = Math.max(0, capacity - actual);
    const overload = Math.max(0, actual - capacity);
    const headroomPct = capacity > 0 ? Math.round((headroom / capacity) * 100) : 0;

    // Auto-scale so both the rated capacity and the actual load stay on-screen,
    // with a little headroom above the tallest value.
    const maxV = Math.max(capacity, actual, EXPECTED) * 1.08;
    const sx = (v: number) => PAD_L + (clamp(v, 0, maxV) / maxV) * TRACK_W;

    return {
      capacity,
      actual,
      safe,
      headroom,
      overload,
      headroomPct,
      maxV,
      sx,
      xExpected: sx(EXPECTED),
      xCapacity: sx(capacity),
      xActual: sx(actual),
    };
  }, [factor, loadMult]);

  const fmt = (n: number) => groupInt(n, groupSeparator);
  const factorText = factor.toFixed(1);

  const readout = model.safe
    ? safeReadoutTemplate
        .replace('{factor}', factorText)
        .replace('{capacity}', fmt(model.capacity))
        .replace('{actual}', fmt(model.actual))
        .replace('{headroom}', fmt(model.headroom))
        .replace('{headroomPct}', String(model.headroomPct))
        .replace(/\{unit\}/g, unit)
    : failReadoutTemplate
        .replace('{factor}', factorText)
        .replace('{capacity}', fmt(model.capacity))
        .replace('{actual}', fmt(model.actual))
        .replace('{overload}', fmt(model.overload))
        .replace(/\{unit\}/g, unit);

  const tween = 'transition-all duration-300 ease-out motion-reduce:transition-none';
  const trackTop = PAD_T;
  const trackBottom = PAD_T + TRACK_H;
  const loadColor = model.safe ? 'var(--color-success, #16a34a)' : 'var(--color-danger, #dc2626)';

  return (
    <figure className={cx('brutal my-6 bg-surface p-5 sm:p-6', className)}>
      <div className="flex items-center justify-between gap-3">
        <p className="font-display text-xs font-semibold uppercase tracking-wide text-brand-600">
          {eyebrow}
        </p>
        <span
          className={cx(
            'rounded-pill px-2.5 py-0.5 font-display text-xs font-bold uppercase tracking-wide transition-colors duration-300 motion-reduce:transition-none',
            model.safe ? 'bg-success/15 text-success' : 'bg-danger/15 text-danger',
          )}
        >
          {model.safe ? safeStatusLabel : failStatusLabel}
        </span>
      </div>
      {title ? (
        <p className="mt-1 font-display text-lg font-semibold text-ink-900">{title}</p>
      ) : null}

      <p className="mt-2 text-sm font-medium text-ink-700">{instructions}</p>

      <div className="mt-4 overflow-hidden rounded-card border border-ink-100 bg-surface-sunken">
        <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={readout}>
          <rect x="0" y="0" width={W} height={H} fill="var(--color-surface-sunken)" />

          {/* Failure zone — everything past the rated capacity */}
          <rect
            x={model.xCapacity}
            y={trackTop}
            width={Math.max(0, PAD_L + TRACK_W - model.xCapacity)}
            height={TRACK_H}
            fill="var(--color-danger, #dc2626)"
            opacity="0.1"
            className={tween}
          />
          {/* Planned-load region — up to the expectation */}
          <rect
            x={PAD_L}
            y={trackTop}
            width={Math.max(0, model.xExpected - PAD_L)}
            height={TRACK_H}
            fill="var(--color-ink-200)"
            opacity="0.5"
            className={tween}
          />
          {/* Margin-of-safety band — expectation → rated capacity */}
          <rect
            x={model.xExpected}
            y={trackTop}
            width={Math.max(0, model.xCapacity - model.xExpected)}
            height={TRACK_H}
            fill="var(--color-brand-300)"
            opacity="0.45"
            className={tween}
          />

          {/* Track outline */}
          <rect
            x={PAD_L}
            y={trackTop}
            width={TRACK_W}
            height={TRACK_H}
            fill="none"
            stroke="var(--color-ink-300)"
            strokeWidth="1"
            rx="3"
          />

          {/* Actual-load fill */}
          <rect
            x={PAD_L}
            y={trackTop + 6}
            width={Math.max(0, model.xActual - PAD_L)}
            height={TRACK_H - 12}
            fill={loadColor}
            opacity="0.85"
            rx="2"
            className={tween}
          />

          {/* Rated-capacity marker */}
          <line
            x1={model.xCapacity}
            y1={trackTop - 8}
            x2={model.xCapacity}
            y2={trackBottom + 8}
            stroke="var(--color-brand-700)"
            strokeWidth="2"
            className={tween}
          />
          <text
            x={clamp(model.xCapacity, PAD_L + 4, PAD_L + TRACK_W - 4)}
            y={trackBottom + 20}
            textAnchor="middle"
            fontSize="9"
            fontWeight="700"
            fill="var(--color-brand-700)"
            className={tween}
          >
            {capacityMarkerLabel}
          </text>

          {/* Expected-load marker */}
          <line
            x1={model.xExpected}
            y1={trackTop - 8}
            x2={model.xExpected}
            y2={trackBottom + 8}
            stroke="var(--color-ink-500)"
            strokeWidth="1.5"
            strokeDasharray="3 3"
            className={tween}
          />
          <text
            x={model.xExpected}
            y={trackTop - 12}
            textAnchor="middle"
            fontSize="9"
            fill="var(--color-ink-500)"
            className={tween}
          >
            {expectedMarkerLabel}
          </text>

          {/* Actual-load needle */}
          <polygon
            points={`${model.xActual},${trackTop + 2} ${model.xActual - 5},${trackTop - 6} ${model.xActual + 5},${trackTop - 6}`}
            fill={loadColor}
            className={tween}
          />
        </svg>
      </div>

      {/* Legend */}
      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs font-medium text-ink-600">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="inline-block size-3 rounded-sm bg-brand-300/60" />
          {marginLegendLabel}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="inline-block size-3 rounded-sm bg-danger/15 ring-1 ring-inset ring-danger/30" />
          {failZoneLabel}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="inline-block h-2 w-4 rounded-sm" style={{ background: loadColor, opacity: 0.85 }} />
          {actualMarkerLabel}
        </span>
      </div>

      {/* Live readout */}
      <p
        aria-live="polite"
        className={cx(
          'mt-4 rounded-card border p-3 text-sm leading-relaxed transition-colors duration-300 motion-reduce:transition-none',
          model.safe
            ? 'border-brand-200 bg-brand-50/70 text-ink-700'
            : 'border-danger/30 bg-danger/5 text-ink-700',
        )}
      >
        {readout}
      </p>

      {/* Controls */}
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor={`${reactId}-f`} className="text-[0.65rem] font-bold uppercase tracking-wide text-ink-500">
            {factorLabel}
          </label>
          <div className="mt-1 flex items-center gap-2">
            <input
              id={`${reactId}-f`}
              type="range"
              min={1}
              max={5}
              step={0.1}
              value={factor}
              onChange={(e) => setFactor(Number(e.target.value))}
              aria-valuetext={`${factorText}×`}
              className="h-1.5 w-full cursor-pointer accent-brand-600"
            />
            <span className="w-12 shrink-0 text-right font-mono text-xs font-semibold text-ink-700">{factorText}×</span>
          </div>
        </div>
        <div>
          <label htmlFor={`${reactId}-l`} className="text-[0.65rem] font-bold uppercase tracking-wide text-ink-500">
            {loadLabel}
          </label>
          <div className="mt-1 flex items-center gap-2">
            <input
              id={`${reactId}-l`}
              type="range"
              min={0.5}
              max={6}
              step={0.1}
              value={loadMult}
              onChange={(e) => setLoadMult(Number(e.target.value))}
              aria-valuetext={`${loadMult.toFixed(1)}×`}
              className="h-1.5 w-full cursor-pointer accent-accent-500"
            />
            <span className="w-12 shrink-0 text-right font-mono text-xs font-semibold text-ink-700">{loadMult.toFixed(1)}×</span>
          </div>
        </div>
      </div>

      {caption ? <figcaption className="mt-3 text-sm text-ink-500">{caption}</figcaption> : null}
    </figure>
  );
}

export default MarginOfSafetyMeter;
