import { useId, useState } from 'react';
import { cx } from '@/components/react/cx';

/** The three canonical dose-response shapes the explorer can draw. */
export type DoseResponseShape = 'linear' | 'threshold' | 'hormetic';

/** Props for the {@link DoseResponseExplorer} island. */
export interface DoseResponseExplorerProps {
  /** Heading above the card. */
  title?: string;
  /** Eyebrow label. Defaults to `'Dose-response lab'`. */
  eyebrow?: string;
  /** Instruction line above the chart. */
  instructions?: string;
  /** Caption beneath the card. */
  caption?: string;
  /** Which curve to show first. Defaults to `'hormetic'`. */
  initialShape?: DoseResponseShape;
  /** Starting dose (0–100). Defaults to `33`. */
  initialDose?: number;
  /** Whether the dosing starts chronic (no recovery). Defaults to `false`. */
  initialChronic?: boolean;
  /** Whether the linear-extrapolation ghost line starts visible. Defaults to `false`. */
  initialGhost?: boolean;

  // ── Labels (all user-facing strings, for i18n) ────────────────────────────
  /** Label for the shape-picker group. */
  shapeLabel?: string;
  /** Button text for the linear (no-threshold) shape. */
  linearLabel?: string;
  /** Button text for the threshold shape. */
  thresholdLabel?: string;
  /** Button text for the hormetic (inverted-U / J) shape. */
  hormeticLabel?: string;
  /** Label over the dose slider. */
  doseLabel?: string;
  /** Label for the recovery toggle. */
  recoveryLabel?: string;
  /** Toggle text for the intermittent / with-recovery mode. */
  intermittentLabel?: string;
  /** Toggle text for the chronic / no-recovery mode. */
  chronicLabel?: string;
  /** Toggle text for the linear-extrapolation ghost line. */
  ghostLabel?: string;
  /** x-axis title. Defaults to `'Dose'`. */
  axisDoseLabel?: string;
  /** y-axis title. Defaults to `'Response'`. */
  axisResponseLabel?: string;
  /** Tick label for the harmful (below-zero) region. */
  harmLabel?: string;
  /** Tick label for the beneficial (above-zero) region. */
  benefitLabel?: string;
  /** Stat label for the current response. */
  responseStatLabel?: string;
  /** Stat label for the optimal dose. */
  optimumStatLabel?: string;
  /** Stat label for the net-effect verdict. */
  verdictStatLabel?: string;
  /** Shown as the optimum stat when the curve has no beneficial dose. */
  noOptimumLabel?: string;
  /** Verdict when the current dose is a net benefit. */
  verdictBenefit?: string;
  /** Verdict when the current dose is roughly neutral. */
  verdictNeutral?: string;
  /** Verdict when the current dose is net harm. */
  verdictHarm?: string;
  /**
   * Readout template. `{dose}`, `{response}`, `{optimum}`, `{shape}`,
   * `{verdict}` are replaced with the live values.
   */
  readoutTemplate?: string;
  /** Short caption under the ghost toggle explaining the extrapolation error. */
  ghostNote?: string;
  /** Extra classes merged onto the root element. */
  className?: string;
}

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

// ── Chart geometry ────────────────────────────────────────────────────────────
const CW = 320;
const CH = 210;
const PAD_L = 30;
const PAD_R = 14;
const PAD_T = 14;
const PAD_B = 26;
const PLOT_W = CW - PAD_L - PAD_R;
const PLOT_H = CH - PAD_T - PAD_B;
const R_MAX = 60; // response axis spans [-R_MAX, +R_MAX]

const px = (x: number) => PAD_L + clamp(x, 0, 1) * PLOT_W;
const py = (r: number) => PAD_T + (1 - (clamp(r, -R_MAX, R_MAX) + R_MAX) / (2 * R_MAX)) * PLOT_H;

/** Rising, saturating benefit from a mild stressor (adaptive overcompensation). */
const stim = (x: number) => 60 * (1 - Math.exp(-x / 0.15));
/** Steeply-rising harm that only bites at higher doses. */
const inhib = (x: number) => 100 * x * x * x;

/**
 * Response of the active curve at normalised dose `x ∈ [0,1]`.
 * `chronic` removes most of the adaptive overcompensation and amplifies harm —
 * so the same dose that *builds* when spaced with recovery instead *hurts*.
 */
function responseAt(x: number, shape: DoseResponseShape, chronic: boolean): number {
  const sStim = chronic ? 0.4 : 1;
  const sInh = chronic ? 1.7 : 1;
  if (shape === 'hormetic') {
    return sStim * stim(x) - sInh * inhib(x);
  }
  if (shape === 'linear') {
    // Linear-no-threshold: harm strictly proportional to dose, no safe amount.
    return -70 * x * (chronic ? 1.4 : 1);
  }
  // Threshold: no effect until a cutoff, then linear harm. Chronic lowers the
  // cutoff and steepens the slope.
  const t = chronic ? 0.25 : 0.42;
  if (x <= t) return 0;
  return (-(x - t) / (1 - t)) * (chronic ? 95 : 78);
}

/** Scan for the dose (0–100) that maximises response; null if never positive. */
function findOptimum(shape: DoseResponseShape, chronic: boolean): number | null {
  let bestX = 0;
  let bestR = 0;
  for (let i = 1; i <= 100; i++) {
    const x = i / 100;
    const r = responseAt(x, shape, chronic);
    if (r > bestR + 1e-9) {
      bestR = r;
      bestX = x;
    }
  }
  return bestR > 1 ? Math.round(bestX * 100) : null;
}

/**
 * **Hormesis & the dose-response curve** — the biological response to a stressor
 * is often *not* a straight line. Low doses can stimulate and strengthen (an
 * adaptive overcompensation) while high doses of the very same thing harm or
 * kill, tracing a J-shaped or inverted-U curve. "The dose makes the poison."
 *
 * Pick a shape — linear-no-threshold, threshold, or hormetic — then sweep the
 * **dose** slider and watch the response climb, peak at an optimum, and turn to
 * harm past it. Flip **recovery** off to see the same dose become toxic when it
 * arrives chronically with no rest. Switch on the **linear-extrapolation ghost**
 * to see the classic error: assuming a straight line through the origin, which
 * predicts harm at low doses where the real curve shows benefit.
 *
 * Deterministic, no animation loop — safe under `prefers-reduced-motion`.
 */
export function DoseResponseExplorer({
  title,
  eyebrow = 'Dose-response lab',
  instructions = 'The effect of a stressor is a function of the dose — and that function is usually curved, not straight. Pick a curve, then drag the dose to hunt for the optimum and watch benefit tip into harm.',
  caption,
  initialShape = 'hormetic',
  initialDose = 33,
  initialChronic = false,
  initialGhost = false,
  shapeLabel = 'Dose-response shape',
  linearLabel = 'Linear (no threshold)',
  thresholdLabel = 'Threshold',
  hormeticLabel = 'Hormetic (J / inverted-U)',
  doseLabel = 'Dose',
  recoveryLabel = 'Dosing',
  intermittentLabel = 'Spaced — with recovery',
  chronicLabel = 'Chronic — no recovery',
  ghostLabel = 'Show linear extrapolation',
  axisDoseLabel = 'Dose →',
  axisResponseLabel = 'Response',
  harmLabel = 'harm',
  benefitLabel = 'benefit',
  responseStatLabel = 'Response now',
  optimumStatLabel = 'Optimal dose',
  verdictStatLabel = 'Net effect',
  noOptimumLabel = 'none',
  verdictBenefit = 'net benefit',
  verdictNeutral = 'no net effect',
  verdictHarm = 'net harm',
  readoutTemplate = 'At a dose of {dose}, the response is {response} — {verdict}. The optimum sits at a dose of {optimum}. Past the peak, more is not better; it is worse.',
  ghostNote = 'The dashed line is what you get by extrapolating high-dose harm straight down to zero — it wrongly predicts harm at the low doses where the real curve helps.',
  className,
}: DoseResponseExplorerProps) {
  const reactId = useId();

  const [shape, setShape] = useState<DoseResponseShape>(initialShape);
  const [dose, setDose] = useState(() => clamp(initialDose, 0, 100));
  const [chronic, setChronic] = useState(initialChronic);
  const [ghost, setGhost] = useState(initialGhost);

  const x = dose / 100;
  const response = responseAt(x, shape, chronic);
  const optimum = findOptimum(shape, chronic);

  // Sample the active curve into an SVG path.
  const N = 80;
  const points: string[] = [];
  for (let i = 0; i <= N; i++) {
    const xi = i / N;
    points.push(`${px(xi).toFixed(1)},${py(responseAt(xi, shape, chronic)).toFixed(1)}`);
  }
  const curvePath = `M ${points.join(' L ')}`;

  // The ghost: a straight line through the origin and the full-dose response.
  const fullResponse = responseAt(1, shape, chronic);
  const ghostPath = `M ${px(0).toFixed(1)},${py(0).toFixed(1)} L ${px(1).toFixed(1)},${py(fullResponse).toFixed(1)}`;

  const verdict = response > 4 ? verdictBenefit : response < -4 ? verdictHarm : verdictNeutral;
  const verdictTone = response > 4 ? 'benefit' : response < -4 ? 'harm' : 'neutral';

  const shapeName =
    shape === 'hormetic' ? hormeticLabel : shape === 'linear' ? linearLabel : thresholdLabel;

  const readout = readoutTemplate
    .replace('{dose}', String(Math.round(dose)))
    .replace('{response}', response.toFixed(0))
    .replace('{optimum}', optimum === null ? noOptimumLabel : String(optimum))
    .replace('{shape}', shapeName)
    .replace('{verdict}', verdict);

  const shapes: { key: DoseResponseShape; label: string }[] = [
    { key: 'hormetic', label: hormeticLabel },
    { key: 'threshold', label: thresholdLabel },
    { key: 'linear', label: linearLabel },
  ];

  const dotColor =
    verdictTone === 'benefit'
      ? 'var(--color-brand-500)'
      : verdictTone === 'harm'
        ? 'var(--color-danger, #dc2626)'
        : 'var(--color-ink-500)';

  return (
    <figure className={cx('brutal my-6 bg-surface p-5 sm:p-6', className)}>
      <p className="font-display text-xs font-semibold uppercase tracking-wide text-accent-600">
        {eyebrow}
      </p>
      {title ? (
        <p className="mt-1 font-display text-lg font-semibold text-ink-900">{title}</p>
      ) : null}

      <p className="mt-2 text-sm font-medium text-ink-700">{instructions}</p>

      {/* Shape picker */}
      <div className="mt-4" role="group" aria-label={shapeLabel}>
        <p className="text-[0.65rem] font-bold uppercase tracking-wide text-ink-600">{shapeLabel}</p>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {shapes.map((s) => (
            <button
              key={s.key}
              type="button"
              aria-pressed={shape === s.key}
              onClick={() => setShape(s.key)}
              className={cx(
                'rounded-pill border px-3 py-1 text-xs font-semibold transition-colors motion-reduce:transition-none',
                shape === s.key
                  ? 'border-accent-600 bg-accent-300/30 text-accent-600'
                  : 'border-ink-200 bg-surface text-ink-600 hover:border-ink-300',
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 grid gap-5 sm:grid-cols-[auto_1fr] sm:items-start">
        {/* The chart */}
        <div className="mx-auto overflow-hidden rounded-card ring-1 ring-inset ring-ink-200 bg-surface-sunken">
          <svg
            viewBox={`0 0 ${CW} ${CH}`}
            className="block h-auto w-[320px] max-w-full"
            role="img"
            aria-label={readout}
          >
            <rect x="0" y="0" width={CW} height={CH} fill="var(--color-surface-sunken)" />

            {/* Benefit / harm bands */}
            <rect x={PAD_L} y={PAD_T} width={PLOT_W} height={py(0) - PAD_T} fill="var(--color-brand-500)" opacity="0.06" />
            <rect x={PAD_L} y={py(0)} width={PLOT_W} height={PAD_T + PLOT_H - py(0)} fill="var(--color-danger, #dc2626)" opacity="0.06" />

            {/* Zero line */}
            <line x1={PAD_L} y1={py(0)} x2={PAD_L + PLOT_W} y2={py(0)} stroke="var(--color-ink-300)" strokeWidth="1.5" />
            {/* y axis */}
            <line x1={PAD_L} y1={PAD_T} x2={PAD_L} y2={PAD_T + PLOT_H} stroke="var(--color-ink-300)" strokeWidth="1" />

            {/* Optimum marker */}
            {optimum !== null ? (
              <line
                x1={px(optimum / 100)}
                y1={PAD_T}
                x2={px(optimum / 100)}
                y2={PAD_T + PLOT_H}
                stroke="var(--color-accent-600)"
                strokeWidth="1"
                strokeDasharray="3 3"
                opacity="0.7"
              />
            ) : null}

            {/* Ghost linear-extrapolation line */}
            {ghost ? (
              <path d={ghostPath} fill="none" stroke="var(--color-ink-500)" strokeWidth="1.5" strokeDasharray="5 4" opacity="0.8" />
            ) : null}

            {/* The active curve */}
            <path d={curvePath} fill="none" stroke="var(--color-brand-600)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />

            {/* Current-dose marker */}
            <line
              x1={px(x)}
              y1={PAD_T}
              x2={px(x)}
              y2={PAD_T + PLOT_H}
              stroke="var(--color-ink-400)"
              strokeWidth="1"
              opacity="0.5"
            />
            <circle cx={px(x)} cy={py(response)} r="5" fill={dotColor} stroke="var(--color-surface)" strokeWidth="1.5" />

            {/* Axis labels */}
            <text x={PAD_L - 5} y={py(R_MAX) + 4} textAnchor="end" fontSize="8" fill="var(--color-brand-600)">
              +{benefitLabel}
            </text>
            <text x={PAD_L - 5} y={py(-R_MAX) - 1} textAnchor="end" fontSize="8" fill="var(--color-danger, #dc2626)">
              −{harmLabel}
            </text>
            <text x={PAD_L + PLOT_W} y={CH - 8} textAnchor="end" fontSize="8.5" fontWeight="700" fill="var(--color-ink-500)">
              {axisDoseLabel}
            </text>
          </svg>
        </div>

        {/* Stats + readout */}
        <div>
          <dl className="grid grid-cols-3 gap-2 text-center">
            <div
              className={cx(
                'rounded-card border p-2',
                verdictTone === 'benefit'
                  ? 'border-brand-200 bg-brand-50/60'
                  : verdictTone === 'harm'
                    ? 'border-danger/40 bg-danger/5'
                    : 'border-ink-200 bg-surface',
              )}
            >
              <dt className="text-[0.6rem] uppercase tracking-wide text-ink-500">{responseStatLabel}</dt>
              <dd
                className={cx(
                  'mt-0.5 font-display text-lg font-semibold tabular-nums',
                  verdictTone === 'benefit'
                    ? 'text-brand-700'
                    : verdictTone === 'harm'
                      ? 'text-danger'
                      : 'text-ink-700',
                )}
              >
                {response > 0 ? '+' : ''}
                {response.toFixed(0)}
              </dd>
            </div>
            <div className="rounded-card border border-accent-300 bg-accent-300/15 p-2">
              <dt className="text-[0.6rem] uppercase tracking-wide text-ink-500">{optimumStatLabel}</dt>
              <dd className="mt-0.5 font-display text-lg font-semibold tabular-nums text-accent-600">
                {optimum === null ? noOptimumLabel : optimum}
              </dd>
            </div>
            <div className="rounded-card border border-ink-200 bg-surface p-2">
              <dt className="text-[0.6rem] uppercase tracking-wide text-ink-500">{verdictStatLabel}</dt>
              <dd className="mt-0.5 font-display text-[0.8rem] font-semibold leading-tight text-ink-800">
                {verdict}
              </dd>
            </div>
          </dl>

          <p
            aria-live="polite"
            className={cx(
              'mt-3 rounded-card border p-3 text-sm leading-relaxed',
              verdictTone === 'harm'
                ? 'border-danger/40 bg-danger/5 text-ink-800'
                : 'border-accent-300 bg-accent-300/20 text-ink-700',
            )}
          >
            {readout}
          </p>

          {ghost ? <p className="mt-2 text-xs leading-relaxed text-ink-500">{ghostNote}</p> : null}
        </div>
      </div>

      {/* Dose slider */}
      <div className="mt-5">
        <label
          htmlFor={`${reactId}-dose`}
          className="flex items-baseline justify-between gap-2 text-[0.65rem] font-bold uppercase tracking-wide text-ink-600"
        >
          <span>{doseLabel}</span>
          <span className="text-sm font-semibold tabular-nums text-accent-600">{Math.round(dose)}</span>
        </label>
        <input
          id={`${reactId}-dose`}
          type="range"
          min={0}
          max={100}
          step={1}
          value={dose}
          onChange={(e) => setDose(clamp(Number(e.target.value), 0, 100))}
          className="mt-1 h-1.5 w-full cursor-pointer accent-brand-500"
        />
      </div>

      {/* Toggles */}
      <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-3">
        <div>
          <p className="text-[0.65rem] font-bold uppercase tracking-wide text-ink-600">{recoveryLabel}</p>
          <div className="mt-1 inline-flex overflow-hidden rounded-pill border border-ink-200">
            <button
              type="button"
              aria-pressed={!chronic}
              onClick={() => setChronic(false)}
              className={cx(
                'px-3 py-1 text-xs font-semibold transition-colors motion-reduce:transition-none',
                !chronic ? 'bg-brand-500 text-white' : 'bg-surface text-ink-600 hover:bg-surface-sunken',
              )}
            >
              {intermittentLabel}
            </button>
            <button
              type="button"
              aria-pressed={chronic}
              onClick={() => setChronic(true)}
              className={cx(
                'px-3 py-1 text-xs font-semibold transition-colors motion-reduce:transition-none',
                chronic ? 'bg-danger text-white' : 'bg-surface text-ink-600 hover:bg-surface-sunken',
              )}
            >
              {chronicLabel}
            </button>
          </div>
        </div>

        <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-semibold text-ink-700">
          <input
            type="checkbox"
            checked={ghost}
            onChange={(e) => setGhost(e.target.checked)}
            className="h-4 w-4 cursor-pointer accent-ink-500"
          />
          {ghostLabel}
        </label>
      </div>

      {caption ? <figcaption className="mt-3 text-sm text-ink-500">{caption}</figcaption> : null}
    </figure>
  );
}

export default DoseResponseExplorer;
