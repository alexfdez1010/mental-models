import { useId, useMemo, useState } from 'react';
import { cx } from '@/components/react/cx';

/** Props for the {@link ValueFunctionExplorer} island. */
export interface ValueFunctionExplorerProps {
  /** Heading above the card. */
  title?: string;
  /** Eyebrow label. Defaults to `'Losses loom larger'`. */
  eyebrow?: string;
  /** Instruction line above the chart. */
  instructions?: string;
  /** Caption beneath the card. */
  caption?: string;
  /** Slider label for the loss-aversion coefficient. */
  lambdaLabel?: string;
  /** Axis label for the gains side of the x-axis. Defaults to `'Gains →'`. */
  gainsAxisLabel?: string;
  /** Axis label for the losses side of the x-axis. Defaults to `'← Losses'`. */
  lossesAxisLabel?: string;
  /** Axis label for the vertical (subjective value) axis. */
  valueAxisLabel?: string;
  /** Legend label for the gain arm. Defaults to `'Value of a gain'`. */
  gainLegendLabel?: string;
  /** Legend label for the loss arm. Defaults to `'Pain of a loss'`. */
  lossLegendLabel?: string;
  /**
   * Live readout for the curve. Placeholders: `{lambda}` the coefficient,
   * `{gain}` the felt value of a +100 gain, `{loss}` the felt value of a −100
   * loss (a negative number), `{ratio}` how many times more a loss hurts.
   */
  curveReadoutTemplate?: string;
  /** Heading for the framing sub-panel. */
  framingTitle?: string;
  /** Instruction line for the framing sub-panel. */
  framingInstructions?: string;
  /** Label for the gain-frame toggle button. Defaults to `'Framed as lives saved'`. */
  gainFrameLabel?: string;
  /** Label for the loss-frame toggle button. Defaults to `'Framed as lives lost'`. */
  lossFrameLabel?: string;
  /** Description of the sure option in the gain frame. */
  sureGainOption?: string;
  /** Description of the gamble option in the gain frame. */
  gambleGainOption?: string;
  /** Description of the sure option in the loss frame. */
  sureLossOption?: string;
  /** Description of the gamble option in the loss frame. */
  gambleLossOption?: string;
  /** Small badge text on whichever option prospect theory prefers. */
  leansHereLabel?: string;
  /** Readout shown under the gain frame. */
  gainFrameReadout?: string;
  /** Readout shown under the loss frame. */
  lossFrameReadout?: string;
  /** Extra classes merged onto the root element. */
  className?: string;
}

// ── Geometry ────────────────────────────────────────────────────────────────
const W = 460;
const H = 300;
const PAD = 30;
const PLOT_W = W - PAD * 2;
const PLOT_H = H - PAD * 2;
const ORIGIN_X = PAD + PLOT_W / 2;
const ORIGIN_Y = PAD + PLOT_H / 2;

/** Diminishing sensitivity: the Kahneman–Tversky curvature estimate. */
const ALPHA = 0.88;
const X_MAX = 100; // the reference gain/loss magnitude plotted to the edges

/** Prospect-theory value of an outcome `x` (gains positive, losses negative). */
function value(x: number, lambda: number): number {
  if (x >= 0) return Math.pow(x, ALPHA);
  return -lambda * Math.pow(-x, ALPHA);
}

/**
 * Interactive **value-function explorer** — the kinked, S-shaped curve at the
 * heart of prospect theory, plus the framing flip it predicts.
 *
 * The top panel plots the subjective-value function `v(x)`: concave for gains,
 * convex for losses, and *steeper on the loss side*. Drag the **loss-aversion
 * slider (λ)** and watch the loss arm plunge — at the default λ ≈ 2.25 the pain
 * of losing \$100 is more than twice the pleasure of winning \$100, which is
 * exactly why people refuse a coin-flip that pays \$110 against losing \$100.
 *
 * The bottom panel turns the *same* curve loose on the classic Asian-disease
 * problem. Toggle between the **gain frame** ("lives saved") and the **loss
 * frame** ("lives lost") and the island recomputes which option the value
 * function prefers: the concave gain arm makes the sure thing win when outcomes
 * are framed as gains (risk-averse), while the convex loss arm makes the gamble
 * win when the *identical* outcomes are framed as losses (risk-seeking). The
 * preference flips even though the numbers never change — framing is not
 * cosmetic.
 *
 * The slider is a native, keyboard-operable `range` input with a visible label;
 * the frame toggle is a labelled button group; both readouts are announced via
 * `aria-live`; the SVG is static per setting and the only motion is a cosmetic
 * tween disabled under `prefers-reduced-motion`.
 */
export function ValueFunctionExplorer({
  title,
  eyebrow = 'Losses loom larger',
  instructions = 'Drag the loss-aversion slider and watch the curve. Gains bend gently up; losses plunge — and the more loss-averse you are (higher λ), the deeper the drop. The kink at zero is the whole model.',
  caption,
  lambdaLabel = 'Loss aversion (λ): how heavy a loss feels vs. an equal gain',
  gainsAxisLabel = 'Gains →',
  lossesAxisLabel = '← Losses',
  valueAxisLabel = 'How it feels',
  gainLegendLabel = 'Value of a gain',
  lossLegendLabel = 'Pain of a loss',
  curveReadoutTemplate = 'At λ = {lambda}, winning $100 feels like +{gain}, but losing $100 feels like {loss} — the loss hurts about {ratio}× as much as the equal gain feels good. That asymmetry is loss aversion.',
  framingTitle = 'Same numbers, opposite choice: the framing flip',
  framingInstructions = 'A disease threatens 600 people. The two programs below are numerically identical across the frames — only the wording changes. Toggle the frame and watch which option the curve above prefers.',
  gainFrameLabel = 'Framed as lives saved',
  lossFrameLabel = 'Framed as lives lost',
  sureGainOption = 'Program A: save 200 people for sure',
  gambleGainOption = 'Program B: ⅓ chance to save all 600, ⅔ chance to save no one',
  sureLossOption = 'Program C: 400 people die for sure',
  gambleLossOption = 'Program D: ⅓ chance no one dies, ⅔ chance all 600 die',
  leansHereLabel = 'people lean here',
  gainFrameReadout = 'In the gain frame the curve is concave, so a sure 200 saved beats the risky gamble: most people play it safe (risk-averse).',
  lossFrameReadout = 'In the loss frame the curve is convex, so the sure 400 deaths feels worse than gambling to avoid them: most people roll the dice (risk-seeking) — the exact same outcomes, the opposite choice.',
  className,
}: ValueFunctionExplorerProps) {
  const reactId = useId();
  const [lambdaPct, setLambdaPct] = useState(225); // λ × 100, so 100..300
  const [frame, setFrame] = useState<'gain' | 'loss'>('gain');

  const lambda = lambdaPct / 100;

  const model = useMemo(() => {
    // Scale y to the deepest possible loss so the asymmetry is visible: as λ
    // grows the loss arm reaches the floor and the gain arm shrinks upward.
    const vMax = lambda * Math.pow(X_MAX, ALPHA);
    const sx = (x: number) => ORIGIN_X + (x / X_MAX) * (PLOT_W / 2);
    const sy = (v: number) => ORIGIN_Y - (v / vMax) * (PLOT_H / 2);

    const pathPts: string[] = [];
    for (let x = -X_MAX; x <= X_MAX; x += 2) {
      pathPts.push(`${sx(x).toFixed(1)},${sy(value(x, lambda)).toFixed(1)}`);
    }

    const gain100 = value(100, lambda);
    const loss100 = value(-100, lambda);

    return {
      sx,
      sy,
      vMax,
      path: `M ${pathPts.join(' L ')}`,
      gain100,
      loss100,
    };
  }, [lambda]);

  // The framing model: evaluate each option's prospect-theory value. The frame
  // sets the reference point, so identical outcomes become gains or losses.
  const framing = useMemo(() => {
    // Gain frame (reference = nobody saved): outcomes are lives SAVED.
    const gainSure = value(200, lambda);
    const gainGamble = (1 / 3) * value(600, lambda);
    // Loss frame (reference = everybody saved): outcomes are lives LOST.
    const lossSure = value(-400, lambda);
    const lossGamble = (2 / 3) * value(-600, lambda);
    return {
      gainPrefersSure: gainSure >= gainGamble,
      lossPrefersSure: lossSure >= lossGamble,
    };
  }, [lambda]);

  const ratio = lambda.toFixed(2);
  const curveReadout = curveReadoutTemplate
    .replace('{lambda}', lambda.toFixed(2))
    .replace('{gain}', model.gain100.toFixed(0))
    .replace('{loss}', model.loss100.toFixed(0))
    .replace('{ratio}', ratio);

  const lineTween = 'transition-all duration-300 ease-out motion-reduce:transition-none';

  const isGain = frame === 'gain';
  const sureChosen = isGain ? framing.gainPrefersSure : framing.lossPrefersSure;

  const sureText = isGain ? sureGainOption : sureLossOption;
  const gambleText = isGain ? gambleGainOption : gambleLossOption;
  const frameReadout = isGain ? gainFrameReadout : lossFrameReadout;

  return (
    <figure className={cx('brutal my-6 bg-surface p-5 sm:p-6', className)}>
      <p className="font-display text-xs font-semibold uppercase tracking-wide text-accent-600">
        {eyebrow}
      </p>
      {title ? (
        <p className="mt-1 font-display text-lg font-semibold text-ink-900">{title}</p>
      ) : null}

      <p className="mt-2 text-sm font-medium text-ink-700">{instructions}</p>

      {/* The value-function curve */}
      <div className="mt-4 overflow-hidden rounded-card border border-ink-100 bg-surface-sunken">
        <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={curveReadout}>
          <rect x="0" y="0" width={W} height={H} fill="var(--color-surface-sunken)" />

          {/* Axes through the origin */}
          <line x1={PAD} y1={ORIGIN_Y} x2={W - PAD} y2={ORIGIN_Y} stroke="var(--color-ink-300)" strokeWidth="1.5" />
          <line x1={ORIGIN_X} y1={PAD} x2={ORIGIN_X} y2={H - PAD} stroke="var(--color-ink-300)" strokeWidth="1.5" />

          {/* Axis labels */}
          <text x={W - PAD} y={ORIGIN_Y - 8} textAnchor="end" fontSize="11" fontWeight="600" fill="var(--color-ink-500)">
            {gainsAxisLabel}
          </text>
          <text x={PAD} y={ORIGIN_Y - 8} textAnchor="start" fontSize="11" fontWeight="600" fill="var(--color-ink-500)">
            {lossesAxisLabel}
          </text>
          <text x={ORIGIN_X + 6} y={PAD + 4} textAnchor="start" fontSize="10" fill="var(--color-ink-400)">
            {valueAxisLabel}
          </text>

          {/* Reference guides for the ±100 markers */}
          <line
            x1={model.sx(100)}
            y1={ORIGIN_Y}
            x2={model.sx(100)}
            y2={model.sy(model.gain100)}
            stroke="var(--color-brand-400)"
            strokeWidth="1"
            strokeDasharray="3 3"
            className={lineTween}
          />
          <line
            x1={model.sx(-100)}
            y1={ORIGIN_Y}
            x2={model.sx(-100)}
            y2={model.sy(model.loss100)}
            stroke="var(--color-danger, #dc2626)"
            strokeWidth="1"
            strokeDasharray="3 3"
            className={lineTween}
          />

          {/* The S-shaped value curve */}
          <path
            d={model.path}
            fill="none"
            stroke="var(--color-accent-600)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={lineTween}
          />

          {/* Markers at +100 (gain) and −100 (loss) */}
          <circle cx={model.sx(100)} cy={model.sy(model.gain100)} r="5" fill="var(--color-brand-600)" stroke="var(--color-surface)" strokeWidth="2" className={lineTween} />
          <circle cx={model.sx(-100)} cy={model.sy(model.loss100)} r="5" fill="var(--color-danger, #dc2626)" stroke="var(--color-surface)" strokeWidth="2" className={lineTween} />
        </svg>
      </div>

      {/* Legend */}
      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs font-medium text-ink-600">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="inline-block size-2.5 rounded-full bg-brand-600" />
          {gainLegendLabel}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="inline-block size-2.5 rounded-full bg-danger" />
          {lossLegendLabel}
        </span>
      </div>

      {/* Curve readout */}
      <p aria-live="polite" className="mt-4 rounded-card border border-accent-500/40 bg-accent-500/10 p-3 text-sm leading-relaxed text-ink-700">
        {curveReadout}
      </p>

      {/* Loss-aversion slider */}
      <div className="mt-4 flex items-center gap-3">
        <label htmlFor={`${reactId}-lambda`} className="max-w-[18rem] text-[0.65rem] font-bold uppercase tracking-wide text-ink-500">
          {lambdaLabel}
        </label>
        <input
          id={`${reactId}-lambda`}
          type="range"
          min={100}
          max={300}
          step={5}
          value={lambdaPct}
          onChange={(e) => setLambdaPct(Number(e.target.value))}
          aria-valuetext={`λ = ${lambda.toFixed(2)}`}
          className="h-1.5 w-full cursor-pointer accent-accent-600"
        />
        <span className="w-16 shrink-0 text-right font-mono text-xs font-semibold text-ink-700">λ = {lambda.toFixed(2)}</span>
      </div>

      {/* ── Framing flip ─────────────────────────────────────────────────── */}
      <div className="mt-6 border-t-2 border-dashed border-ink-200 pt-5">
        <p className="font-display text-base font-semibold text-ink-900">{framingTitle}</p>
        <p className="mt-1.5 text-sm font-medium text-ink-700">{framingInstructions}</p>

        {/* Frame toggle */}
        <div role="group" aria-label={framingTitle} className="mt-3 inline-flex rounded-pill border-2 border-ink-200 bg-surface-sunken p-1">
          <button
            type="button"
            onClick={() => setFrame('gain')}
            aria-pressed={isGain}
            className={cx(
              'rounded-pill px-3 py-1.5 text-xs font-semibold transition-colors duration-200 motion-reduce:transition-none',
              isGain ? 'bg-brand-600 text-white' : 'text-ink-600 hover:text-ink-900',
            )}
          >
            {gainFrameLabel}
          </button>
          <button
            type="button"
            onClick={() => setFrame('loss')}
            aria-pressed={!isGain}
            className={cx(
              'rounded-pill px-3 py-1.5 text-xs font-semibold transition-colors duration-200 motion-reduce:transition-none',
              !isGain ? 'bg-brand-600 text-white' : 'text-ink-600 hover:text-ink-900',
            )}
          >
            {lossFrameLabel}
          </button>
        </div>

        {/* The two options */}
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <OptionCard text={sureText} chosen={sureChosen} leansHereLabel={leansHereLabel} />
          <OptionCard text={gambleText} chosen={!sureChosen} leansHereLabel={leansHereLabel} />
        </div>

        <p aria-live="polite" className="mt-3 rounded-card border border-brand-200 bg-brand-50/70 p-3 text-sm leading-relaxed text-ink-700">
          {frameReadout}
        </p>
      </div>

      {caption ? <figcaption className="mt-3 text-sm text-ink-500">{caption}</figcaption> : null}
    </figure>
  );
}

/** One framing option, highlighted when prospect theory prefers it. */
function OptionCard({
  text,
  chosen,
  leansHereLabel,
}: {
  text: string;
  chosen: boolean;
  leansHereLabel: string;
}) {
  return (
    <div
      className={cx(
        'relative rounded-card border-2 p-3 text-sm transition-colors duration-200 motion-reduce:transition-none',
        chosen ? 'border-brand-500 bg-brand-50 text-ink-900' : 'border-ink-200 bg-surface text-ink-600',
      )}
    >
      <p className="font-medium">{text}</p>
      {chosen ? (
        <span className="mt-2 inline-flex items-center gap-1 rounded-pill bg-brand-600 px-2 py-0.5 text-[0.6rem] font-bold uppercase tracking-wide text-white">
          ★ {leansHereLabel}
        </span>
      ) : null}
    </div>
  );
}

export default ValueFunctionExplorer;
