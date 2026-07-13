import { useId, useState } from 'react';
import { cx } from '@/components/react/cx';

/** Props for the {@link AnchorEstimator} island. */
export interface AnchorEstimatorProps {
  /** Heading above the card. */
  title?: string;
  /** Eyebrow label. Defaults to `'Anchoring lab'`. */
  eyebrow?: string;
  /** Instruction line above the visualization. */
  instructions?: string;
  /** The estimation question the anchor distorts. */
  question?: string;
  /** Caption beneath the card. */
  caption?: string;

  /** The correct answer to the question. */
  trueValue?: number;
  /** Low end of the number line. Defaults to `0`. */
  min?: number;
  /** High end of the number line. Defaults to `100`. */
  max?: number;
  /** Unit suffix appended to every number (e.g. `'%'`). Defaults to `''`. */
  unit?: string;
  /** Thousands separator for large numbers. Defaults to `','`. */
  groupSeparator?: string;

  /** Starting position of the movable "your anchor" pin. */
  initialAnchor?: number;
  /** Starting adjustment strength, 0–100 (% of the way people move to the truth). */
  initialAdjust?: number;
  /** The low anchor handed to the first witness group. */
  lowAnchor?: number;
  /** The high anchor handed to the second witness group. */
  highAnchor?: number;

  // ── Labels (all user-facing strings, for i18n) ────────────────────────────
  /** Label over the "your anchor" slider. */
  anchorLabel?: string;
  /** Label over the adjustment-strength slider. */
  adjustLabel?: string;
  /** Caption on the truth marker. */
  truthLabel?: string;
  /** Caption on the resulting-estimate marker. */
  estimateLabel?: string;
  /** Word drawn along the adjustment travel arrow. */
  adjustmentTravelLabel?: string;
  /** Heading over the two-witness strip. */
  witnessesLabel?: string;
  /** Caption on the low-anchor witness. */
  lowPersonLabel?: string;
  /** Caption on the high-anchor witness. */
  highPersonLabel?: string;
  /** Stat label for the anchoring gap between the two witnesses. */
  gapLabel?: string;
  /** Stat label for the current estimate. */
  estimateStatLabel?: string;
  /** Stat label for how far the estimate still misses the truth. */
  missStatLabel?: string;
  /** Verdict when adjustment is very small (estimate stuck on the anchor). */
  verdictAnchored?: string;
  /** Verdict for partial, insufficient adjustment. */
  verdictPartial?: string;
  /** Verdict when adjustment is nearly complete. */
  verdictAdjusted?: string;
  /**
   * Readout template. `{anchor}`, `{estimate}`, `{truth}`, `{low}`, `{high}`,
   * `{gap}`, `{adjust}`, `{unit}`, `{verdict}` are replaced with live values.
   */
  readoutTemplate?: string;
  /** Extra classes merged onto the root element. */
  className?: string;
}

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

// ── Chart geometry ────────────────────────────────────────────────────────────
const CW = 340;
const CH = 168;
const PAD_L = 18;
const PAD_R = 18;
const PLOT_W = CW - PAD_L - PAD_R;
const AXIS_Y = 84; // main number-line height
const STRIP_Y = 138; // two-witness strip height

/**
 * **Anchoring & adjustment** — an arbitrary starting number silently drags your
 * estimate toward itself, and you stop adjusting long before you reach the
 * truth. Drag **your anchor** to feel the pull: wherever you start, the estimate
 * lands close to the anchor and far from the real answer. Drag **how much people
 * adjust** to watch the two witness groups — one handed a low anchor, one a high
 * anchor — converge only when adjustment is (unrealistically) near-total. At the
 * ~30–50% adjustment real people manage, the two groups stay a wide **gap**
 * apart, a gap manufactured entirely by two meaningless numbers.
 *
 * Deterministic, no animation loop — safe under `prefers-reduced-motion`.
 */
export function AnchorEstimator({
  title,
  eyebrow = 'Anchoring lab',
  instructions = 'An anchor is any number in view when you estimate. Drag your anchor and watch the estimate get dragged with it — then set how far people adjust and watch two arbitrary anchors pull two groups apart.',
  question = 'What percentage of the world’s countries are in Africa?',
  caption,
  trueValue = 28,
  min = 0,
  max = 100,
  unit = '%',
  groupSeparator = ',',
  initialAnchor = 50,
  initialAdjust = 35,
  lowAnchor = 10,
  highAnchor = 65,
  anchorLabel = 'Your anchor',
  adjustLabel = 'How much people adjust',
  truthLabel = 'Truth',
  estimateLabel = 'Estimate',
  adjustmentTravelLabel = 'adjustment',
  witnessesLabel = 'Two groups, two arbitrary anchors',
  lowPersonLabel = 'Low anchor',
  highPersonLabel = 'High anchor',
  gapLabel = 'Anchoring gap',
  estimateStatLabel = 'Your estimate',
  missStatLabel = 'Still off by',
  verdictAnchored = 'Barely adjusted — the estimate is a hostage of the anchor.',
  verdictPartial = 'Adjusted a little, then stopped far short — textbook insufficient adjustment.',
  verdictAdjusted = 'Nearly immune to the anchor — but almost nobody actually adjusts this much.',
  readoutTemplate = 'Start from an anchor of {anchor}{unit} and the estimate lands at {estimate}{unit} — dragged most of the way from the anchor, not toward the truth ({truth}{unit}). With people adjusting only {adjust}%, the low-anchor group guesses {low}{unit} and the high-anchor group {high}{unit}: a {gap}{unit} gap conjured out of two meaningless numbers. {verdict}',
  className,
}: AnchorEstimatorProps) {
  const reactId = useId();

  const span = max - min || 1;
  const [anchor, setAnchor] = useState(() => clamp(initialAnchor, min, max));
  const [adjust, setAdjust] = useState(() => clamp(initialAdjust, 0, 100));

  const a = adjust / 100;
  /** Insufficient-adjustment model: start at the anchor, crawl a fraction toward truth. */
  const estimateOf = (anc: number) => anc + a * (trueValue - anc);

  const estRaw = estimateOf(anchor);
  const estimate = Math.round(estRaw);
  const miss = Math.abs(estimate - trueValue);

  const lowEstRaw = estimateOf(lowAnchor);
  const highEstRaw = estimateOf(highAnchor);
  const lowEst = Math.round(lowEstRaw);
  const highEst = Math.round(highEstRaw);
  const gap = Math.abs(highEst - lowEst);

  const px = (v: number) => PAD_L + (clamp(v, min, max) - min) / span * PLOT_W;

  const fmt = (n: number) => {
    const s = String(Math.round(n));
    if (!groupSeparator) return s;
    return s.replace(/\B(?=(\d{3})+(?!\d))/g, groupSeparator);
  };

  const tone = adjust <= 33 ? 'anchored' : adjust >= 80 ? 'adjusted' : 'partial';
  const verdict = tone === 'anchored' ? verdictAnchored : tone === 'adjusted' ? verdictAdjusted : verdictPartial;

  const readout = readoutTemplate
    .replaceAll('{anchor}', fmt(anchor))
    .replaceAll('{estimate}', fmt(estimate))
    .replaceAll('{truth}', fmt(trueValue))
    .replaceAll('{low}', fmt(lowEst))
    .replaceAll('{high}', fmt(highEst))
    .replaceAll('{gap}', fmt(gap))
    .replaceAll('{adjust}', String(Math.round(adjust)))
    .replaceAll('{unit}', unit)
    .replaceAll('{verdict}', verdict);

  const anchorX = px(anchor);
  const estX = px(estRaw);
  const truthX = px(trueValue);

  return (
    <figure className={cx('brutal my-6 bg-surface p-5 sm:p-6', className)}>
      <p className="font-display text-xs font-semibold uppercase tracking-wide text-accent-600">
        {eyebrow}
      </p>
      {title ? (
        <p className="mt-1 font-display text-lg font-semibold text-ink-900">{title}</p>
      ) : null}

      <p className="mt-2 text-sm font-medium text-ink-700">{instructions}</p>

      <p className="mt-3 rounded-card border border-ink-200 bg-surface-sunken px-3 py-2 text-sm font-semibold text-ink-800">
        {question}
      </p>

      {/* The number line */}
      <div className="mt-4 overflow-hidden rounded-card ring-1 ring-inset ring-ink-200 bg-surface-sunken">
        <svg
          viewBox={`0 0 ${CW} ${CH}`}
          className="block h-auto w-full"
          role="img"
          aria-label={readout}
        >
          <rect x="0" y="0" width={CW} height={CH} fill="var(--color-surface-sunken)" />

          {/* ── Main line: your anchor → estimate → truth ── */}
          <line x1={PAD_L} y1={AXIS_Y} x2={PAD_L + PLOT_W} y2={AXIS_Y} stroke="var(--color-ink-300)" strokeWidth="2" />

          {/* end ticks */}
          {[min, max].map((v) => (
            <g key={v}>
              <line x1={px(v)} y1={AXIS_Y - 4} x2={px(v)} y2={AXIS_Y + 4} stroke="var(--color-ink-300)" strokeWidth="1.5" />
              <text x={px(v)} y={AXIS_Y + 16} textAnchor="middle" fontSize="8" fill="var(--color-ink-500)">
                {fmt(v)}{unit}
              </text>
            </g>
          ))}

          {/* truth marker */}
          <line x1={truthX} y1={AXIS_Y - 30} x2={truthX} y2={AXIS_Y + 4} stroke="var(--color-brand-500)" strokeWidth="1.5" strokeDasharray="3 3" />
          <polygon
            points={`${truthX},${AXIS_Y - 34} ${truthX - 5},${AXIS_Y - 42} ${truthX + 5},${AXIS_Y - 42}`}
            fill="var(--color-brand-600)"
          />
          <text x={truthX} y={AXIS_Y - 46} textAnchor="middle" fontSize="8.5" fontWeight="700" fill="var(--color-brand-600)">
            {truthLabel} {fmt(trueValue)}{unit}
          </text>

          {/* adjustment travel: anchor → estimate */}
          <line x1={anchorX} y1={AXIS_Y} x2={estX} y2={AXIS_Y} stroke="var(--color-accent-600)" strokeWidth="3" opacity="0.55" strokeLinecap="round" />
          {Math.abs(estX - anchorX) > 18 ? (
            <text x={(anchorX + estX) / 2} y={AXIS_Y - 7} textAnchor="middle" fontSize="7.5" fontStyle="italic" fill="var(--color-accent-600)">
              {adjustmentTravelLabel}
            </text>
          ) : null}

          {/* anchor pin */}
          <circle cx={anchorX} cy={AXIS_Y} r="4.5" fill="var(--color-ink-700)" stroke="var(--color-surface)" strokeWidth="1.5" />
          <text x={anchorX} y={AXIS_Y + 30} textAnchor="middle" fontSize="8.5" fontWeight="700" fill="var(--color-ink-700)">
            {anchorLabel} {fmt(anchor)}{unit}
          </text>

          {/* estimate dot */}
          <circle cx={estX} cy={AXIS_Y} r="6.5" fill="var(--color-accent-600)" stroke="var(--color-surface)" strokeWidth="2" />
          <text x={estX} y={AXIS_Y - 12} textAnchor="middle" fontSize="9" fontWeight="800" fill="var(--color-accent-600)">
            {fmt(estimate)}{unit}
          </text>

          {/* ── Witness strip: low vs high anchor groups ── */}
          <line x1={PAD_L} y1={STRIP_Y} x2={PAD_L + PLOT_W} y2={STRIP_Y} stroke="var(--color-ink-200)" strokeWidth="1.5" />
          {/* gap band between the two group estimates */}
          <rect
            x={Math.min(px(lowEstRaw), px(highEstRaw))}
            y={STRIP_Y - 5}
            width={Math.abs(px(highEstRaw) - px(lowEstRaw))}
            height={10}
            fill="var(--color-accent-600)"
            opacity="0.18"
          />
          {/* low-anchor group */}
          <circle cx={px(lowEstRaw)} cy={STRIP_Y} r="5" fill="var(--color-brand-600)" stroke="var(--color-surface)" strokeWidth="1.5" />
          <text x={px(lowEstRaw)} y={STRIP_Y + 15} textAnchor="middle" fontSize="7.5" fill="var(--color-brand-700)">
            {lowPersonLabel} → {fmt(lowEst)}{unit}
          </text>
          {/* high-anchor group */}
          <circle cx={px(highEstRaw)} cy={STRIP_Y} r="5" fill="var(--color-ink-800)" stroke="var(--color-surface)" strokeWidth="1.5" />
          <text x={px(highEstRaw)} y={STRIP_Y - 9} textAnchor="middle" fontSize="7.5" fill="var(--color-ink-800)">
            {highPersonLabel} → {fmt(highEst)}{unit}
          </text>
        </svg>
      </div>

      {/* Stats */}
      <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-card border border-accent-300 bg-accent-300/15 p-2">
          <dt className="text-[0.6rem] uppercase tracking-wide text-ink-500">{estimateStatLabel}</dt>
          <dd className="mt-0.5 font-display text-lg font-semibold tabular-nums text-accent-600">
            {fmt(estimate)}{unit}
          </dd>
        </div>
        <div className="rounded-card border border-ink-200 bg-surface p-2">
          <dt className="text-[0.6rem] uppercase tracking-wide text-ink-500">{missStatLabel}</dt>
          <dd className="mt-0.5 font-display text-lg font-semibold tabular-nums text-ink-800">
            {fmt(miss)}{unit}
          </dd>
        </div>
        <div className="rounded-card border border-ink-200 bg-surface p-2">
          <dt className="text-[0.6rem] uppercase tracking-wide text-ink-500">{gapLabel}</dt>
          <dd className="mt-0.5 font-display text-lg font-semibold tabular-nums text-ink-800">
            {fmt(gap)}{unit}
          </dd>
        </div>
      </dl>

      <p
        aria-live="polite"
        className="mt-3 rounded-card border border-accent-300 bg-accent-300/20 p-3 text-sm leading-relaxed text-ink-700"
      >
        {readout}
      </p>

      {/* Your-anchor slider */}
      <div className="mt-5">
        <label
          htmlFor={`${reactId}-anchor`}
          className="flex items-baseline justify-between gap-2 text-[0.65rem] font-bold uppercase tracking-wide text-ink-600"
        >
          <span>{anchorLabel}</span>
          <span className="text-sm font-semibold tabular-nums text-accent-600">{fmt(anchor)}{unit}</span>
        </label>
        <input
          id={`${reactId}-anchor`}
          type="range"
          min={min}
          max={max}
          step={1}
          value={anchor}
          onChange={(e) => setAnchor(clamp(Number(e.target.value), min, max))}
          className="mt-1 h-1.5 w-full cursor-pointer accent-ink-700"
        />
      </div>

      {/* Adjustment slider */}
      <div className="mt-4">
        <label
          htmlFor={`${reactId}-adjust`}
          className="flex items-baseline justify-between gap-2 text-[0.65rem] font-bold uppercase tracking-wide text-ink-600"
        >
          <span>{adjustLabel}</span>
          <span className="text-sm font-semibold tabular-nums text-accent-600">{Math.round(adjust)}%</span>
        </label>
        <input
          id={`${reactId}-adjust`}
          type="range"
          min={0}
          max={100}
          step={1}
          value={adjust}
          onChange={(e) => setAdjust(clamp(Number(e.target.value), 0, 100))}
          className="mt-1 h-1.5 w-full cursor-pointer accent-brand-500"
        />
      </div>

      <p className="mt-3 text-[0.7rem] font-semibold uppercase tracking-wide text-ink-500">{witnessesLabel}</p>

      {caption ? <figcaption className="mt-2 text-sm text-ink-500">{caption}</figcaption> : null}
    </figure>
  );
}

export default AnchorEstimator;
