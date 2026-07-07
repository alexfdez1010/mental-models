import { useId, useMemo, useState } from 'react';
import { cx } from '@/components/react/cx';

/** Props for the {@link SignallingSeparator} island. */
export interface SignallingSeparatorProps {
  /** Heading above the card. */
  title?: string;
  /** Eyebrow label. Defaults to `'Signalling separator'`. */
  eyebrow?: string;
  /** Instruction line above the chart. */
  instructions?: string;
  /** Caption beneath the card. */
  caption?: string;
  /** Label over the cost-to-high slider. */
  costHighLabel?: string;
  /** Label over the cost-to-low slider. */
  costLowLabel?: string;
  /** Label over the receiver's-prior slider. */
  priorLabel?: string;
  /** Small note under the prior slider. */
  priorHint?: string;
  /** Y-axis title on the chart. Defaults to `'Cost of the signal'`. */
  axisLabel?: string;
  /** X-axis title on the chart. Defaults to `'Signal intensity (how big / how much)'`. */
  xAxisLabel?: string;
  /** Label on the benefit line. Defaults to `'Benefit of being believed “high”'`. */
  benefitLabel?: string;
  /** Label on the high-type cost line. Defaults to `'Cost to a HIGH type'`. */
  highLineLabel?: string;
  /** Label on the low-type cost line. Defaults to `'Cost to a LOW type'`. */
  lowLineLabel?: string;
  /** Label on the shaded separating window. Defaults to `'Separating window'`. */
  windowLabel?: string;
  /** Heading over the live stat readout. Defaults to `'What the receiver sees'`. */
  readoutLabel?: string;
  /** Label for the equilibrium stat. Defaults to `'Equilibrium'`. */
  equilibriumStatLabel?: string;
  /** Label for the who-signals stat. Defaults to `'Who signals'`. */
  signalsStatLabel?: string;
  /** Label for the receiver-belief stat. Defaults to `'Belief on a signal'`. */
  beliefStatLabel?: string;
  /** Label for the burned-cost (waste) stat. Defaults to `'Cost burned'`. */
  wasteStatLabel?: string;
  /** Word shown for a separating equilibrium. Defaults to `'Separating'`. */
  separatingWord?: string;
  /** Word shown for a pooling equilibrium. Defaults to `'Pooling'`. */
  poolingWord?: string;
  /** Who-signals text under separation. Defaults to `'Only HIGH types'`. */
  onlyHighWord?: string;
  /** Who-signals text under pooling. Defaults to `'No one can separate'`. */
  noneWord?: string;
  /** Belief text under separation. Defaults to `'High (correct)'`. */
  beliefHighWord?: string;
  /** Heading over the analysis panel. Defaults to `'Reading the equilibrium'`. */
  analysisLabel?: string;
  /** Analysis note when pooling (the signal is not cheaper for the good type). */
  poolingNote?: string;
  /** Analysis note when separating but the burned cost is heavy (wasteful zone). */
  wastefulNote?: string;
  /** Analysis note when separating cleanly. */
  separatingNote?: string;
  /** Starting cost-to-high (6–40). Defaults to `12`. */
  initialCostHigh?: number;
  /** Starting cost-to-low (6–40). Defaults to `26`. */
  initialCostLow?: number;
  /** Starting receiver prior, % that are high type (0–100). Defaults to `40`. */
  initialPrior?: number;
  /** Extra classes merged onto the root element. */
  className?: string;
}

// ── Geometry ────────────────────────────────────────────────────────────────
const W = 460;
const H = 230;
const PAD_L = 40;
const PAD_R = 16;
const PAD_T = 22;
const PAD_B = 42;
const PLOT_W = W - PAD_L - PAD_R;
const PLOT_H = H - PAD_T - PAD_B;

// ── The signalling model (Spence, kept deliberately simple) ──────────────────
// Two hidden types face a common REWARD for being believed the "high" type. The
// benefit gap `V` is the extra reward from a "high" verdict over a "low" one. A
// sender can buy a SIGNAL of intensity `s` (0..S_MAX): education, a warranty, a
// peacock's tail. Its cost is linear in intensity but the per-unit cost differs
// by type: cheaper for a high type (`cH`) than a low type (`cL`).
//
// A signal SEPARATES the types when there is an intensity a high type is willing
// to send but a low type is not:
//   • the high type sends `s` iff  V ≥ cH·s   ⟺  s ≤ V/cH   (high-willing bound)
//   • the low type refrains  iff  V < cL·s    ⟺  s > V/cL    (low-refrain bound)
// The window  V/cL < s < V/cH  is non-empty exactly when cL > cH — the single-
// crossing / Spence condition. The cheapest credible signal sits just above the
// low-refrain bound, so the high type burns cost `cH·(V/cL)`. When cL ≤ cH the
// low type can mimic as cheaply, the window collapses, and the market POOLS on
// the prior. All of it is pure deadweight: the signal proves quality without
// creating any.
const V = 60; // benefit gap from a "high" verdict (high value 90 − low value 30)
const S_MAX = 10;
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

function evaluate(cH: number, cL: number, prior: number) {
  const sLowRefrain = V / cL; // low type refrains above this intensity
  const sHighWilling = V / cH; // high type willing below this intensity
  // Small margin so a knife-edge (cL ≈ cH) reads as pooling, not separating.
  const separates = sLowRefrain < sHighWilling - 0.15;
  // Cheapest credible separating signal — just past the low-refrain bound.
  const sStar = separates ? Math.min(sLowRefrain + 0.2, (sLowRefrain + sHighWilling) / 2) : 0;
  const burnPerHigh = separates ? cH * sStar : 0;
  // Only high types signal; low types send nothing. Waste = share·cost.
  const waste = burnPerHigh * clamp(prior, 0, 1);
  return { sLowRefrain, sHighWilling, separates, sStar, burnPerHigh, waste };
}

/**
 * Interactive **signalling separator**. The learner sets how costly a signal is
 * for a **high** type versus a **low** type, plus the receiver's **prior** on
 * how common high types are, and watches the equilibrium flip between
 * **pooling** (no signal is cheaper for the good type, so nobody can be believed
 * and the receiver falls back on the prior) and **separating** (only the high
 * type finds the signal worth sending, so it is believed).
 *
 * The chart draws each type's cost line against signal intensity and the flat
 * benefit line; the wedge between the two cost lines *below* the benefit is the
 * **separating window**. It exists only when the good type's line is the
 * *flatter* one — the single-crossing (Spence) condition — which the learner can
 * open and close by dragging the two cost sliders. A readout reports the
 * equilibrium, who signals, the receiver's belief, and the pure-waste cost
 * burned to prove quality that already existed.
 *
 * All state is derived; the only motion is a cosmetic tween of the markers,
 * disabled under `prefers-reduced-motion`, and nothing animates on mount.
 */
export function SignallingSeparator({
  title,
  eyebrow = 'Signalling separator',
  instructions = 'A signal is only believed if it is too expensive for the wrong type to fake. Set how costly the signal is for a HIGH type versus a LOW type, and how common high types are. Watch the equilibrium flip between pooling and separating.',
  caption,
  costHighLabel = 'Cost of the signal to a HIGH type (per unit)',
  costLowLabel = 'Cost of the signal to a LOW type (per unit)',
  priorLabel = 'Receiver’s prior — share that are HIGH type',
  priorHint = 'When no signal separates the types, the receiver is stuck paying everyone this pooled average.',
  axisLabel = 'Cost of the signal',
  xAxisLabel = 'Signal intensity (how big / how much)',
  benefitLabel = 'Benefit of being believed “high”',
  highLineLabel = 'Cost to a HIGH type',
  lowLineLabel = 'Cost to a LOW type',
  windowLabel = 'Separating window',
  readoutLabel = 'What the receiver sees',
  equilibriumStatLabel = 'Equilibrium',
  signalsStatLabel = 'Who signals',
  beliefStatLabel = 'Belief on a signal',
  wasteStatLabel = 'Cost burned',
  separatingWord = 'Separating',
  poolingWord = 'Pooling',
  onlyHighWord = 'Only HIGH types',
  noneWord = 'No one can separate',
  beliefHighWord = 'High (correct)',
  analysisLabel = 'Reading the equilibrium',
  poolingNote = 'The signal is no cheaper for the good type than the bad one, so the bad type can mimic it stride for stride. Nothing a sender does is credible, the receiver is stuck with the prior, and everyone is paid the pooled average — good types underpaid, bad types overpaid. This is the world of cheap talk: “trust me” carries no information.',
  wastefulNote = 'The types now separate — only high types send the signal, and it is believed. But look at the cost burned: the good type is torching real resources purely to prove what it already is. Honest, yes — and pure deadweight. This is the wasteful heart of every signalling arms race.',
  separatingNote = 'The good type’s signal is cheap for it and ruinous for a faker, so only high types send it and the receiver believes it. The types separate on a signal that is too expensive to fake — costly enough to be honest, and not much more.',
  initialCostHigh = 12,
  initialCostLow = 26,
  initialPrior = 40,
  className,
}: SignallingSeparatorProps) {
  const reactId = useId();

  const [costHigh, setCostHigh] = useState(clamp(initialCostHigh, 6, 40));
  const [costLow, setCostLow] = useState(clamp(initialCostLow, 6, 40));
  const [prior, setPrior] = useState(clamp(initialPrior, 0, 100));

  const p = prior / 100;
  const model = useMemo(() => evaluate(costHigh, costLow, p), [costHigh, costLow, p]);

  // ── SVG mappers ───────────────────────────────────────────────────────────
  const yMax = V * 1.35; // leave headroom above the benefit line
  const px = (s: number) => PAD_L + (s / S_MAX) * PLOT_W;
  const py = (c: number) => PAD_T + PLOT_H - (clamp(c, 0, yMax) / yMax) * PLOT_H;

  // A linear cost line from the origin; stop where it leaves the top of the plot.
  const costLine = (c: number) => {
    const sEnd = Math.min(S_MAX, yMax / c);
    return `M${px(0).toFixed(1)},${py(0).toFixed(1)} L${px(sEnd).toFixed(1)},${py(c * sEnd).toFixed(1)}`;
  };

  const benefitY = py(V);
  const winLo = px(clamp(model.sLowRefrain, 0, S_MAX));
  const winHi = px(clamp(model.sHighWilling, 0, S_MAX));
  const starX = px(clamp(model.sStar, 0, S_MAX));

  const tween = 'transition-all duration-300 ease-out motion-reduce:transition-none';

  const poolWage = Math.round(90 * p + 30 * (1 - p));
  const analysisNote = !model.separates
    ? poolingNote
    : model.burnPerHigh > 0.55 * V
      ? wastefulNote
      : separatingNote;

  const Stat = ({ label, value, tone }: { label: string; value: string; tone?: string }) => (
    <div className="rounded-card border border-ink-100 bg-surface-sunken px-3 py-2">
      <p className="text-[0.6rem] font-bold uppercase tracking-wide text-ink-500">{label}</p>
      <p className={cx('mt-0.5 font-display text-base font-semibold tabular-nums', tone ?? 'text-ink-900')}>
        {value}
      </p>
    </div>
  );

  return (
    <figure className={cx('brutal my-6 bg-surface p-5 sm:p-6', className)}>
      <p className="font-display text-xs font-semibold uppercase tracking-wide text-accent-600">{eyebrow}</p>
      {title ? <p className="mt-1 font-display text-lg font-semibold text-ink-900">{title}</p> : null}

      <p className="mt-2 text-sm font-medium text-ink-700">{instructions}</p>

      {/* The cost-vs-intensity chart */}
      <div className="mt-4 overflow-hidden rounded-card border border-ink-100 bg-surface-sunken">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="h-auto w-full"
          role="img"
          aria-label={`${axisLabel} against ${xAxisLabel}. The signal costs ${costHigh} per unit for a high type and ${costLow} for a low type. The equilibrium is ${model.separates ? separatingWord : poolingWord}.`}
        >
          <rect x="0" y="0" width={W} height={H} fill="var(--color-surface-sunken)" />

          {/* Separating window (only when it exists) */}
          {model.separates ? (
            <g className={tween}>
              <rect
                x={winLo}
                y={PAD_T}
                width={Math.max(0, winHi - winLo)}
                height={PLOT_H}
                fill="var(--color-success)"
                opacity={0.12}
              />
              <text
                x={(winLo + winHi) / 2}
                y={PAD_T + 12}
                textAnchor="middle"
                fontSize="9"
                fontWeight="700"
                fill="var(--color-success)"
              >
                {windowLabel}
              </text>
            </g>
          ) : null}

          {/* Axes */}
          <line x1={PAD_L} y1={PAD_T} x2={PAD_L} y2={PAD_T + PLOT_H} stroke="var(--color-ink-300)" strokeWidth="1.5" />
          <line x1={PAD_L} y1={PAD_T + PLOT_H} x2={PAD_L + PLOT_W} y2={PAD_T + PLOT_H} stroke="var(--color-ink-300)" strokeWidth="1.5" />

          {/* Benefit line */}
          <line x1={PAD_L} y1={benefitY} x2={PAD_L + PLOT_W} y2={benefitY} stroke="var(--color-ink-400)" strokeWidth="1.5" strokeDasharray="4 3" />
          <text x={PAD_L + PLOT_W} y={benefitY - 5} textAnchor="end" fontSize="9" fontWeight="600" fill="var(--color-ink-500)">
            {benefitLabel}
          </text>

          {/* Cost lines */}
          <path className={tween} d={costLine(costLow)} fill="none" stroke="var(--color-accent-500)" strokeWidth="2.5" strokeLinecap="round" />
          <path className={tween} d={costLine(costHigh)} fill="none" stroke="var(--color-brand-500)" strokeWidth="2.5" strokeLinecap="round" />

          {/* Equilibrium signal marker */}
          {model.separates ? (
            <g className={tween}>
              <line x1={starX} y1={PAD_T} x2={starX} y2={PAD_T + PLOT_H} stroke="var(--color-success)" strokeWidth="1.5" strokeDasharray="2 3" opacity={0.8} />
              <circle cx={starX} cy={py(costHigh * model.sStar)} r="5" fill="var(--color-success)" stroke="white" strokeWidth="1.5" />
            </g>
          ) : null}

          {/* X ticks */}
          {[0, 0.5, 1].map((t) => (
            <text key={`xt-${t}`} x={px(t * S_MAX)} y={PAD_T + PLOT_H + 15} textAnchor="middle" fontSize="9" fill="var(--color-ink-500)">
              {t === 0 ? 'none' : t === 1 ? 'max' : 'more →'}
            </text>
          ))}
          <text x={PAD_L + PLOT_W / 2} y={H - 6} textAnchor="middle" fontSize="10" fontWeight="600" fill="var(--color-ink-600)">
            {xAxisLabel}
          </text>
          <text x={PAD_L - 4} y={PAD_T - 9} textAnchor="start" fontSize="10" fontWeight="600" fill="var(--color-ink-600)">
            {axisLabel}
          </text>
        </svg>
      </div>

      {/* Legend */}
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[0.7rem] font-medium text-ink-600">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-4 rounded bg-brand-500" /> {highLineLabel}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-4 rounded bg-accent-500" /> {lowLineLabel}
        </span>
      </div>

      {/* Live stat readout */}
      <div aria-live="polite">
        <p className="mt-4 text-[0.65rem] font-bold uppercase tracking-wide text-ink-600">{readoutLabel}</p>
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat
            label={equilibriumStatLabel}
            value={model.separates ? separatingWord : poolingWord}
            tone={model.separates ? 'text-success' : 'text-danger'}
          />
          <Stat label={signalsStatLabel} value={model.separates ? onlyHighWord : noneWord} />
          <Stat label={beliefStatLabel} value={model.separates ? beliefHighWord : `${prior}% → ${poolWage}`} />
          <Stat
            label={wasteStatLabel}
            value={model.separates ? `−${Math.round(model.waste)}` : '0'}
            tone={model.burnPerHigh > 0.55 * V ? 'text-danger' : 'text-ink-700'}
          />
        </div>
      </div>

      {/* Sliders */}
      <div className="mt-4 space-y-4">
        <div>
          <label
            htmlFor={`${reactId}-ch`}
            className="flex items-baseline justify-between gap-2 text-[0.65rem] font-bold uppercase tracking-wide text-ink-600"
          >
            <span>{costHighLabel}</span>
            <span className="text-sm font-semibold tabular-nums text-brand-600">{costHigh}</span>
          </label>
          <input
            id={`${reactId}-ch`}
            type="range"
            min={6}
            max={40}
            step={1}
            value={costHigh}
            onChange={(e) => setCostHigh(clamp(Number(e.target.value), 6, 40))}
            aria-valuetext={`${costHigh} cost per unit to a high type`}
            className="mt-1 h-1.5 w-full cursor-pointer accent-brand-500"
          />
        </div>

        <div>
          <label
            htmlFor={`${reactId}-cl`}
            className="flex items-baseline justify-between gap-2 text-[0.65rem] font-bold uppercase tracking-wide text-ink-600"
          >
            <span>{costLowLabel}</span>
            <span className="text-sm font-semibold tabular-nums text-accent-600">{costLow}</span>
          </label>
          <input
            id={`${reactId}-cl`}
            type="range"
            min={6}
            max={40}
            step={1}
            value={costLow}
            onChange={(e) => setCostLow(clamp(Number(e.target.value), 6, 40))}
            aria-valuetext={`${costLow} cost per unit to a low type`}
            className="mt-1 h-1.5 w-full cursor-pointer accent-accent-500"
          />
        </div>

        <div>
          <label
            htmlFor={`${reactId}-p`}
            className="flex items-baseline justify-between gap-2 text-[0.65rem] font-bold uppercase tracking-wide text-ink-600"
          >
            <span>{priorLabel}</span>
            <span className="text-sm font-semibold tabular-nums text-ink-700">{prior}%</span>
          </label>
          <input
            id={`${reactId}-p`}
            type="range"
            min={0}
            max={100}
            step={1}
            value={prior}
            onChange={(e) => setPrior(clamp(Number(e.target.value), 0, 100))}
            aria-valuetext={`${prior}% high type`}
            className="mt-1 h-1.5 w-full cursor-pointer accent-ink-400"
          />
          <p className="mt-1 text-xs text-ink-500">{priorHint}</p>
        </div>
      </div>

      {/* Analysis panel */}
      <div aria-live="polite" className="mt-4 rounded-card border border-ink-200 bg-surface p-3">
        <p className="text-[0.65rem] font-bold uppercase tracking-wide text-ink-600">{analysisLabel}</p>
        <p className="mt-1 text-sm leading-relaxed text-ink-700">{analysisNote}</p>
      </div>

      {caption ? <figcaption className="mt-3 text-sm text-ink-500">{caption}</figcaption> : null}
    </figure>
  );
}

export default SignallingSeparator;
