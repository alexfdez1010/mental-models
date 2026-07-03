import { useId, useMemo, useState } from 'react';
import { cx } from '@/components/react/cx';

/** A single cell's payoffs: what the row and column players each receive. */
export interface MixCell {
  /** Payoff to the **row** player (the one who mixes) when this cell is reached. */
  row: number;
  /** Payoff to the **column** player when this cell is reached. */
  col: number;
}

/** A 2×2 grid of payoff cells, indexed `[rowStrategy][colStrategy]`. */
export type MixGrid = [[MixCell, MixCell], [MixCell, MixCell]];

/** Props for the {@link MixedStrategyExplorer} island. */
export interface MixedStrategyExplorerProps {
  /** Heading above the card. */
  title?: string;
  /** Eyebrow label. Defaults to `'Mixed strategy'`. */
  eyebrow?: string;
  /** Instruction line above the chart. */
  instructions?: string;
  /** Caption beneath the card. */
  caption?: string;
  /** Name of the player who mixes (picks the row). */
  rowPlayer: string;
  /** Name of the opponent (picks the column). */
  colPlayer: string;
  /** The two strategy labels available to the mixing (row) player. */
  rowStrategies: [string, string];
  /** The two strategy labels available to the opponent (column player). */
  colStrategies: [string, string];
  /** Payoffs, `[rowStrategy][colStrategy]` → `{ row, col }`. */
  payoffs: MixGrid;
  /** Starting mix, as the percentage chance the row player plays strategy 0. Defaults to `50`. */
  initialMixPercent?: number;
  /** Symbol shown with each payoff (e.g. `' pts'`). Optional. */
  unit?: string;
  /** Where the unit sits. Defaults to `'suffix'`. */
  unitPosition?: 'prefix' | 'suffix';
  /**
   * Slider label. `{s0}` and `{s1}` are replaced with the row strategy labels.
   * Defaults to `'How often {rowPlayer} plays {s0} (vs {s1})'` style text.
   */
  mixLabel?: string;
  /** Axis label under the horizontal axis. */
  xAxisLabel?: string;
  /** Axis label beside the vertical axis. */
  yAxisLabel?: string;
  /**
   * Live readout template. Placeholders: `{p}` the current mix %, `{s0}`/`{s1}`
   * the opponent's two responses, `{r0}`/`{r1}` the row player's payoff if the
   * opponent plays each response, `{worst}` the guaranteed (worst-case) payoff at
   * the current mix, `{exploit}` the response a smart opponent will pick, `{opt}`
   * the unexploitable mix %, `{value}` the payoff guaranteed by that mix, and
   * `{verdict}` — one of the two verdict strings below.
   */
  readoutTemplate?: string;
  /** Verdict substituted for `{verdict}` when the current mix is (near) optimal. */
  verdictSafe?: string;
  /** Verdict substituted for `{verdict}` when the opponent can still exploit the mix. */
  verdictExploited?: string;
  /** Legend label for the "opponent plays strategy 0" line. `{s}` → the label. */
  responseLegend0?: string;
  /** Legend label for the "opponent plays strategy 1" line. `{s}` → the label. */
  responseLegend1?: string;
  /** Legend label for the guaranteed (worst-case) payoff envelope. */
  guaranteeLegend?: string;
  /** Small tag on the optimal-mix guide line. Defaults to `'Unexploitable mix'`. */
  optimalTag?: string;
  /** Extra classes merged onto the root element. */
  className?: string;
}

// ── Geometry ────────────────────────────────────────────────────────────────
const W = 460;
const H = 300;
const PAD_L = 42;
const PAD_R = 18;
const PAD_T = 22;
const PAD_B = 40;
const PLOT_W = W - PAD_L - PAD_R;
const PLOT_H = H - PAD_T - PAD_B;

function fmt(value: number, unit = '', position: 'prefix' | 'suffix' = 'suffix'): string {
  const rounded = Math.round(value * 100) / 100;
  const text = rounded.toLocaleString('en-US', { maximumFractionDigits: 2 });
  if (!unit) return text;
  return position === 'prefix' ? `${unit}${text}` : `${text}${unit}`;
}

/**
 * Interactive **mixed-strategy explorer** — the picture behind "randomise so the
 * opponent can't exploit you."
 *
 * The row player mixes: a slider sets `p`, the chance they play their first
 * strategy. Two faint lines show the row player's expected payoff if the
 * opponent *always* plays each of their two responses — both linear in `p`. A
 * rational opponent, of course, picks whichever response is *worst* for the row
 * player, so the payoff the row player can actually **guarantee** is the *lower*
 * of the two lines: an inverted-V whose single peak is the **unexploitable
 * mix**. At that peak the two response lines cross — the opponent is
 * *indifferent* between their options, which is exactly why they can no longer
 * punish you. Drift off the peak in either direction and a smart opponent leans
 * on the response that drags you down the steeper arm.
 *
 * This is built for strictly-competitive (zero-sum-style) 2×2 games — matching
 * pennies, penalty kicks, attacker/defender — where making the opponent
 * indifferent is the whole game.
 *
 * The slider is a native, keyboard-operable `range` with a visible label; the
 * chart is static per setting (only a cosmetic tween that stops under
 * `prefers-reduced-motion`); all meaning is mirrored in the `aria-live` readout
 * and the SVG's `aria-label`, so nothing depends on seeing colour.
 */
export function MixedStrategyExplorer({
  title,
  eyebrow = 'Mixed strategy',
  instructions = 'Drag the slider to change how often you randomise between your two moves. The faint lines are your payoff if the opponent commits to one response; a smart opponent always picks the one that is worst for you, so the bold line is what you can actually guarantee. Find its peak — the mix the opponent cannot exploit.',
  caption,
  rowPlayer,
  colPlayer,
  rowStrategies,
  colStrategies,
  payoffs,
  initialMixPercent = 50,
  unit = '',
  unitPosition = 'suffix',
  mixLabel = 'How often you play {s0} (vs {s1})',
  xAxisLabel = 'Your mix →',
  yAxisLabel = 'Your payoff',
  readoutTemplate = 'Playing {s0} {p}% of the time: if the opponent answers {s0} you get {r0}, if they answer {s1} you get {r1}. A smart opponent picks {exploit}, so you can only count on {worst}. {verdict}',
  verdictSafe = 'That is the unexploitable mix — the opponent is indifferent, so they cannot punish you.',
  verdictExploited = 'Shift toward the unexploitable mix ({opt}% {s0}) to lift your guaranteed payoff to {value}.',
  responseLegend0 = 'If opponent plays {s}',
  responseLegend1 = 'If opponent plays {s}',
  guaranteeLegend = 'What you can guarantee',
  optimalTag = 'Unexploitable mix',
  className,
}: MixedStrategyExplorerProps) {
  const reactId = useId();
  const [mixPct, setMixPct] = useState(() =>
    Math.max(0, Math.min(100, Math.round(initialMixPercent))),
  );
  const p = mixPct / 100;

  // Row-player payoff lines as a function of p, one per opponent response.
  // R_c(p) = p·payoffs[0][c].row + (1−p)·payoffs[1][c].row  (linear in p).
  const a0 = payoffs[0][0].row;
  const b0 = payoffs[1][0].row;
  const a1 = payoffs[0][1].row;
  const b1 = payoffs[1][1].row;
  const R0 = (t: number) => t * a0 + (1 - t) * b0;
  const R1 = (t: number) => t * a1 + (1 - t) * b1;

  const model = useMemo(() => {
    // The opponent's indifference point: where the two response lines cross.
    const dA = a0 - a1;
    const dB = b0 - b1;
    const denom = dB - dA;
    let optP: number | null = null;
    if (Math.abs(denom) > 1e-9) {
      const raw = dB / denom;
      if (raw >= 0 && raw <= 1) optP = raw;
    }

    // y-range across both lines over the whole [0,1] domain, with light padding.
    const ys = [R0(0), R0(1), R1(0), R1(1)];
    let yMin = Math.min(...ys, 0);
    let yMax = Math.max(...ys, 0);
    const span = yMax - yMin || 1;
    yMin -= span * 0.08;
    yMax += span * 0.08;

    const sx = (t: number) => PAD_L + t * PLOT_W;
    const sy = (v: number) => PAD_T + (1 - (v - yMin) / (yMax - yMin)) * PLOT_H;

    // The guaranteed (lower-envelope) payoff, sampled for the bold path.
    const guard: string[] = [];
    for (let i = 0; i <= 60; i += 1) {
      const t = i / 60;
      guard.push(`${sx(t).toFixed(1)},${sy(Math.min(R0(t), R1(t))).toFixed(1)}`);
    }

    const optValue = optP == null ? null : Math.min(R0(optP), R1(optP));

    return { optP, optValue, sx, sy, yMin, yMax, guardPath: `M ${guard.join(' L ')}` };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [a0, b0, a1, b1]);

  const r0 = R0(p);
  const r1 = R1(p);
  const worst = Math.min(r0, r1);
  // A rational opponent answers with whichever response drags the row player down.
  const exploitIdx = r0 <= r1 ? 0 : 1;
  const exploitLabel = colStrategies[exploitIdx];

  const optPct = model.optP == null ? null : Math.round(model.optP * 100);
  const atOptimum =
    model.optP != null && Math.abs(p - model.optP) <= 0.02;

  const u = (v: number) => fmt(v, unit, unitPosition);

  const fill = (s: string) =>
    s
      .replace('{p}', String(mixPct))
      .replace('{s0}', colStrategies[0])
      .replace('{s1}', colStrategies[1])
      .replace('{r0}', u(r0))
      .replace('{r1}', u(r1))
      .replace('{worst}', u(worst))
      .replace('{exploit}', exploitLabel)
      .replace('{opt}', optPct == null ? '—' : String(optPct))
      .replace('{value}', model.optValue == null ? '—' : u(model.optValue));

  const verdict = fill(atOptimum ? verdictSafe : verdictExploited);
  const readout = fill(readoutTemplate).replace('{verdict}', verdict);

  const mixLabelText = mixLabel
    .replace('{s0}', rowStrategies[0])
    .replace('{s1}', rowStrategies[1])
    .replace('{rowPlayer}', rowPlayer);

  const tween = 'transition-all duration-300 ease-out motion-reduce:transition-none';

  return (
    <figure className={cx('brutal my-6 bg-surface p-5 sm:p-6', className)}>
      <p className="font-display text-xs font-semibold uppercase tracking-wide text-accent-600">
        {eyebrow}
      </p>
      {title ? (
        <p className="mt-1 font-display text-lg font-semibold text-ink-900">{title}</p>
      ) : null}

      <p className="mt-2 text-sm font-medium text-ink-700">{instructions}</p>

      {/* Chart */}
      <div className="mt-4 overflow-hidden rounded-card border border-ink-100 bg-surface-sunken">
        <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={readout}>
          <rect x="0" y="0" width={W} height={H} fill="var(--color-surface-sunken)" />

          {/* Axes */}
          <line x1={PAD_L} y1={PAD_T} x2={PAD_L} y2={H - PAD_B} stroke="var(--color-ink-300)" strokeWidth="1.5" />
          <line x1={PAD_L} y1={H - PAD_B} x2={W - PAD_R} y2={H - PAD_B} stroke="var(--color-ink-300)" strokeWidth="1.5" />

          {/* Zero line, if it sits inside the plotted range */}
          {model.yMin < 0 && model.yMax > 0 ? (
            <line
              x1={PAD_L}
              y1={model.sy(0)}
              x2={W - PAD_R}
              y2={model.sy(0)}
              stroke="var(--color-ink-200)"
              strokeWidth="1"
              strokeDasharray="2 4"
            />
          ) : null}

          {/* Axis labels + ticks */}
          <text x={PAD_L} y={H - PAD_B + 16} textAnchor="middle" fontSize="10" fill="var(--color-ink-400)">
            0%
          </text>
          <text x={W - PAD_R} y={H - PAD_B + 16} textAnchor="middle" fontSize="10" fill="var(--color-ink-400)">
            100%
          </text>
          <text x={(PAD_L + W - PAD_R) / 2} y={H - 8} textAnchor="middle" fontSize="11" fontWeight="600" fill="var(--color-ink-500)">
            {xAxisLabel}
          </text>
          <text
            x={12}
            y={PAD_T + PLOT_H / 2}
            textAnchor="middle"
            fontSize="11"
            fontWeight="600"
            fill="var(--color-ink-500)"
            transform={`rotate(-90 12 ${PAD_T + PLOT_H / 2})`}
          >
            {yAxisLabel}
          </text>

          {/* Optimal-mix guide line */}
          {model.optP != null ? (
            <g className={tween}>
              <line
                x1={model.sx(model.optP)}
                y1={PAD_T}
                x2={model.sx(model.optP)}
                y2={H - PAD_B}
                stroke="var(--color-brand-500)"
                strokeWidth="1.5"
                strokeDasharray="4 3"
              />
              <circle
                cx={model.sx(model.optP)}
                cy={model.sy(model.optValue as number)}
                r="4"
                fill="var(--color-brand-600)"
                stroke="var(--color-surface)"
                strokeWidth="1.5"
              />
            </g>
          ) : null}

          {/* Response line 0 (opponent commits to colStrategies[0]) */}
          <line
            x1={model.sx(0)}
            y1={model.sy(R0(0))}
            x2={model.sx(1)}
            y2={model.sy(R0(1))}
            stroke="var(--color-accent-400)"
            strokeWidth="1.5"
            strokeDasharray="5 4"
          />
          {/* Response line 1 (opponent commits to colStrategies[1]) */}
          <line
            x1={model.sx(0)}
            y1={model.sy(R1(0))}
            x2={model.sx(1)}
            y2={model.sy(R1(1))}
            stroke="var(--color-ink-400)"
            strokeWidth="1.5"
            strokeDasharray="5 4"
          />

          {/* Guaranteed payoff — the bold lower envelope */}
          <path
            d={model.guardPath}
            fill="none"
            stroke="var(--color-accent-600)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Current mix marker */}
          <line
            x1={model.sx(p)}
            y1={PAD_T}
            x2={model.sx(p)}
            y2={H - PAD_B}
            stroke="var(--color-ink-500)"
            strokeWidth="1"
            className={tween}
          />
          <circle
            cx={model.sx(p)}
            cy={model.sy(worst)}
            r="5.5"
            fill="var(--color-ink-900)"
            stroke="var(--color-surface)"
            strokeWidth="2"
            className={tween}
          />

          {/* Optimal-mix tag */}
          {model.optP != null ? (
            <text
              x={model.sx(model.optP)}
              y={PAD_T - 8}
              textAnchor="middle"
              fontSize="10"
              fontWeight="700"
              fill="var(--color-brand-600)"
            >
              {optimalTag}
            </text>
          ) : null}
        </svg>
      </div>

      {/* Legend */}
      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs font-medium text-ink-600">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="inline-block h-0.5 w-4 rounded bg-accent-600" />
          {guaranteeLegend}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="inline-block h-0.5 w-4 rounded bg-accent-400" />
          {responseLegend0.replace('{s}', colStrategies[0])}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="inline-block h-0.5 w-4 rounded bg-ink-400" />
          {responseLegend1.replace('{s}', colStrategies[1])}
        </span>
      </div>

      {/* Live readout */}
      <p
        aria-live="polite"
        className={cx(
          'mt-4 rounded-card border p-3 text-sm leading-relaxed text-ink-700',
          atOptimum
            ? 'border-brand-500/50 bg-brand-500/10'
            : 'border-accent-500/40 bg-accent-500/10',
        )}
      >
        {readout}
      </p>

      {/* Mix slider */}
      <div className="mt-4">
        <div className="flex items-center justify-between text-[0.65rem] font-bold uppercase tracking-wide text-ink-500">
          <label htmlFor={`${reactId}-mix`}>{mixLabelText}</label>
          <span className="font-mono text-ink-700">
            {rowStrategies[0]} {mixPct}% · {rowStrategies[1]} {100 - mixPct}%
          </span>
        </div>
        <input
          id={`${reactId}-mix`}
          type="range"
          min={0}
          max={100}
          step={1}
          value={mixPct}
          onChange={(e) => setMixPct(Number(e.target.value))}
          aria-valuetext={`${rowStrategies[0]} ${mixPct}%, ${rowStrategies[1]} ${100 - mixPct}%`}
          className="mt-1 h-1.5 w-full cursor-pointer accent-accent-600"
        />
      </div>

      {caption ? <figcaption className="mt-3 text-sm text-ink-500">{caption}</figcaption> : null}
    </figure>
  );
}

export default MixedStrategyExplorer;
