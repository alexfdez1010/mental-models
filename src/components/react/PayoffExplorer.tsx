import { useId, useMemo, useState } from 'react';
import { cx } from '@/components/react/cx';

/** The three payoff shapes the explorer can preset. */
export type PayoffShape = 'convex' | 'concave' | 'barbell';

/** A selectable payoff-shape preset. */
export interface PayoffShapeOption {
  /** Which shape this button selects. */
  shape: PayoffShape;
  /** Button label (e.g. `'Convex (smile)'`). */
  label: string;
  /** One-line description shown when the shape is active. */
  blurb: string;
}

/** Props for the {@link PayoffExplorer} island. */
export interface PayoffExplorerProps {
  /** Heading above the card. */
  title?: string;
  /** Eyebrow label. Defaults to `'Shape the payoff'`. */
  eyebrow?: string;
  /** Instruction line above the chart. */
  instructions?: string;
  /** Caption beneath the card. */
  caption?: string;
  /** The three shape presets (order fixed: convex, concave, barbell). */
  shapes?: PayoffShapeOption[];
  /** Label for the win-probability slider. Defaults to `'Win probability'`. */
  winProbLabel?: string;
  /** Label for the upside slider. Defaults to `'Upside on a win'`. */
  upsideLabel?: string;
  /** Label for the downside slider. Defaults to `'Downside cap on a loss'`. */
  downsideLabel?: string;
  /** Stat label for expected value per trial. Defaults to `'Expected value / trial'`. */
  evLabel?: string;
  /** Stat label for number of trials run. Defaults to `'Trials run'`. */
  trialsLabel?: string;
  /** Stat label for actual win rate. Defaults to `'Actual win rate'`. */
  winRateLabel?: string;
  /** Stat label for cumulative profit/loss. Defaults to `'Total profit / loss'`. */
  totalLabel?: string;
  /** Label for the run button. Defaults to `'Run 100 trials'`. */
  runLabel?: string;
  /** Label for the reset button. Defaults to `'Reset'`. */
  resetLabel?: string;
  /** Axis caption at the top of the payoff chart. Defaults to `'Upside (open-ended)'`. */
  upAxisLabel?: string;
  /** Axis caption at the bottom of the payoff chart. Defaults to `'Downside (capped)'`. */
  downAxisLabel?: string;
  /** Text for the expected-value marker. Defaults to `'EV'`. */
  evMarkerLabel?: string;
  /** Prompt shown before any trials are run. */
  emptyHint?: string;
  /**
   * Live readout template. Placeholders: `{shape}` active shape label,
   * `{ev}` expected value per trial, `{trials}` trials run, `{winrate}` the
   * actual win rate %, `{total}` cumulative profit/loss.
   */
  readoutTemplate?: string;
  /** Extra classes merged onto the root element. */
  className?: string;
}

// ── Geometry ────────────────────────────────────────────────────────────────
const W = 460;
const H = 250;
const PAD_L = 54;
const PAD_R = 16;
const PAD_T = 18;
const PAD_B = 18;
const PLOT_W = W - PAD_L - PAD_R;
const PLOT_H = H - PAD_T - PAD_B;
const MID_Y = PAD_T + PLOT_H / 2; // value = 0 line

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

/** Preset slider values for each shape. */
const PRESETS: Record<PayoffShape, { p: number; up: number; down: number }> = {
  // Rare, big win; small capped loss. Lose most trials, win the war.
  convex: { p: 20, up: 10, down: 1 },
  // Frequent small win; rare huge loss. Win most trials, lose the war.
  concave: { p: 90, up: 1, down: 15 },
  // Safe core + a lottery slice: downside is tiny by construction, upside open.
  barbell: { p: 15, up: 12, down: 1 },
};

const DEFAULT_SHAPES: PayoffShapeOption[] = [
  {
    shape: 'convex',
    label: 'Convex (smile)',
    blurb: 'Lose a little, often; win a lot, rarely. Downside capped, upside open.',
  },
  {
    shape: 'concave',
    label: 'Concave (frown)',
    blurb: 'Win a little, often; lose a lot, rarely. Pennies in front of a steamroller.',
  },
  {
    shape: 'barbell',
    label: 'Barbell',
    blurb: 'A safe core plus a small lottery slice — a convex shape built on purpose.',
  },
];

/** Format a signed number with a fixed number of decimals, keeping a leading + for gains. */
function signed(n: number, dp = 2): string {
  const r = n.toFixed(dp);
  return n > 0 ? `+${r}` : r;
}

/**
 * Interactive **payoff-shape explorer** — the difference between *convex* and
 * *concave* bets made tactile, and the whole point of asymmetry: a decision's
 * value is probability *times magnitude*, so when the magnitudes are lopsided the
 * win-rate can lie about who comes out ahead.
 *
 * The learner sets a **win probability**, an **upside** (what a win pays) and a
 * **downside cap** (the most a loss can take), or snaps to one of three presets:
 * a **convex** bet (small capped loss, big rare win), its **concave** mirror
 * (small frequent win, rare catastrophic loss — "picking up pennies in front of a
 * steamroller"), and a **barbell** (a safe core plus a lottery slice, engineered
 * to be convex). The payoff diagram shows the two outcomes as bars above/below the
 * zero line, with the downside visibly *floored* and the upside open; the dashed
 * line marks the expected value per trial.
 *
 * Pressing **Run 100 trials** samples the bet and accumulates the results. The
 * teaching moment: a convex bet can *lose most of its individual trials* and still
 * pile up a large positive total, because the rare wins are so much bigger than the
 * frequent losses — while the concave bet wins almost every trial and still bleeds
 * to ruin on the rare disaster. Trials only run on interaction, so the server
 * render is empty and deterministic, and there is no autoplaying motion to fight
 * `prefers-reduced-motion`.
 */
export function PayoffExplorer({
  title,
  eyebrow = 'Shape the payoff',
  instructions = 'Set how often you win, how big a win pays, and how much a loss can take — or snap to a preset. Then run 100 trials and watch the total. A convex bet can lose most of its trials and still win big.',
  caption,
  shapes = DEFAULT_SHAPES,
  winProbLabel = 'Win probability',
  upsideLabel = 'Upside on a win',
  downsideLabel = 'Downside cap on a loss',
  evLabel = 'Expected value / trial',
  trialsLabel = 'Trials run',
  winRateLabel = 'Actual win rate',
  totalLabel = 'Total profit / loss',
  runLabel = 'Run 100 trials',
  resetLabel = 'Reset',
  upAxisLabel = 'Upside (open-ended)',
  downAxisLabel = 'Downside (capped)',
  evMarkerLabel = 'EV',
  emptyHint = 'Press “Run 100 trials” to sample this bet and watch the total build up.',
  readoutTemplate = 'The {shape} bet has an expected value of {ev} per trial. Across {trials} trials you actually won {winrate}% of them — and your running total is {total}.',
  className,
}: PayoffExplorerProps) {
  const reactId = useId();
  const [shape, setShape] = useState<PayoffShape>('convex');
  const [p, setP] = useState(PRESETS.convex.p);
  const [up, setUp] = useState(PRESETS.convex.up);
  const [down, setDown] = useState(PRESETS.convex.down);
  const [trials, setTrials] = useState<{ wins: number; total: number; count: number }>({
    wins: 0,
    total: 0,
    count: 0,
  });

  const activeShape = shapes.find((s) => s.shape === shape) ?? shapes[0];

  const applyPreset = (s: PayoffShape) => {
    setShape(s);
    setP(PRESETS[s].p);
    setUp(PRESETS[s].up);
    setDown(PRESETS[s].down);
    setTrials({ wins: 0, total: 0, count: 0 });
  };

  const prob = p / 100;
  const ev = prob * up - (1 - prob) * down;

  // Vertical scale: the larger of the two magnitudes fills ~85% of the half-plot.
  const scale = useMemo(() => {
    const m = Math.max(up, down, 1);
    return (PLOT_H / 2) * 0.85 / m;
  }, [up, down]);

  const upBarH = up * scale;
  const downBarH = down * scale;
  const evY = MID_Y - clamp(ev * scale, -(PLOT_H / 2) * 0.95, (PLOT_H / 2) * 0.95);

  const runTrials = () => {
    setTrials((prev) => {
      let wins = 0;
      let total = 0;
      for (let i = 0; i < 100; i++) {
        if (Math.random() < prob) {
          wins += 1;
          total += up;
        } else {
          total -= down;
        }
      }
      return {
        wins: prev.wins + wins,
        total: prev.total + total,
        count: prev.count + 100,
      };
    });
  };

  const winRate = trials.count > 0 ? (trials.wins / trials.count) * 100 : 0;

  const readout =
    trials.count === 0
      ? emptyHint
      : readoutTemplate
          .replace('{shape}', activeShape.label.toLowerCase())
          .replace('{ev}', signed(ev))
          .replace('{trials}', String(trials.count))
          .replace('{winrate}', winRate.toFixed(0))
          .replace('{total}', signed(trials.total, 0));

  const barW = 46;
  const upX = PAD_L + PLOT_W * 0.32 - barW / 2;
  const downX = PAD_L + PLOT_W * 0.68 - barW / 2;

  return (
    <figure className={cx('brutal my-6 bg-surface p-5 sm:p-6', className)}>
      <p className="font-display text-xs font-semibold uppercase tracking-wide text-accent-600">
        {eyebrow}
      </p>
      {title ? (
        <p className="mt-1 font-display text-lg font-semibold text-ink-900">{title}</p>
      ) : null}

      <p className="mt-2 text-sm font-medium text-ink-700">{instructions}</p>

      {/* Shape presets */}
      <div className="mt-4 flex flex-wrap gap-2">
        {shapes.map((s) => {
          const active = s.shape === shape;
          return (
            <button
              key={s.shape}
              type="button"
              aria-pressed={active}
              onClick={() => applyPreset(s.shape)}
              className={cx(
                'brutal-btn px-3 py-1.5 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600',
                active ? 'bg-brand-600 text-white' : 'bg-surface text-ink-700',
              )}
            >
              {s.label}
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-sm italic text-ink-500">{activeShape.blurb}</p>

      {/* Payoff diagram */}
      <div className="mt-4 overflow-hidden rounded-card border border-ink-100 bg-surface-sunken">
        <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={readout}>
          <rect x="0" y="0" width={W} height={H} fill="var(--color-surface-sunken)" />

          {/* Zero (value = 0) line */}
          <line
            x1={PAD_L}
            y1={MID_Y}
            x2={PAD_L + PLOT_W}
            y2={MID_Y}
            stroke="var(--color-ink-400)"
            strokeWidth="1.5"
          />
          <text x={PAD_L - 6} y={MID_Y + 3} textAnchor="end" fontSize="10" fill="var(--color-ink-500)">
            0
          </text>
          <text x={PAD_L + 2} y={PAD_T + 10} fontSize="10" fill="var(--color-brand-700)">
            {upAxisLabel}
          </text>
          <text x={PAD_L + 2} y={PAD_T + PLOT_H - 4} fontSize="10" fill="var(--color-accent-700)">
            {downAxisLabel}
          </text>

          {/* Downside floor — the cap that makes a convex bet safe */}
          <line
            x1={PAD_L}
            y1={MID_Y + downBarH}
            x2={PAD_L + PLOT_W}
            y2={MID_Y + downBarH}
            stroke="var(--color-accent-500)"
            strokeWidth="1.5"
            strokeDasharray="4 3"
          />

          {/* Upside bar (a win) */}
          <rect
            x={upX}
            y={MID_Y - upBarH}
            width={barW}
            height={Math.max(1, upBarH)}
            rx="2"
            fill="var(--color-brand-400)"
          />
          <text x={upX + barW / 2} y={MID_Y - upBarH - 6} textAnchor="middle" fontSize="11" fill="var(--color-brand-700)" fontWeight="600">
            +{up}
          </text>
          <text x={upX + barW / 2} y={MID_Y + 14} textAnchor="middle" fontSize="10" fill="var(--color-ink-500)">
            {(prob * 100).toFixed(0)}%
          </text>

          {/* Downside bar (a loss) */}
          <rect
            x={downX}
            y={MID_Y}
            width={barW}
            height={Math.max(1, downBarH)}
            rx="2"
            fill="var(--color-accent-400)"
          />
          <text x={downX + barW / 2} y={MID_Y + downBarH + 14} textAnchor="middle" fontSize="11" fill="var(--color-accent-700)" fontWeight="600">
            −{down}
          </text>
          <text x={downX + barW / 2} y={MID_Y - 6} textAnchor="middle" fontSize="10" fill="var(--color-ink-500)">
            {((1 - prob) * 100).toFixed(0)}%
          </text>

          {/* Expected-value line */}
          <line
            x1={PAD_L}
            y1={evY}
            x2={PAD_L + PLOT_W}
            y2={evY}
            stroke="var(--color-brand-700)"
            strokeWidth="2"
            strokeDasharray="6 4"
          />
          <text
            x={PAD_L + PLOT_W - 4}
            y={clamp(evY - 4, PAD_T + 10, PAD_T + PLOT_H - 4)}
            textAnchor="end"
            fontSize="10"
            fill="var(--color-brand-700)"
            fontWeight="600"
          >
            {evMarkerLabel} {signed(ev, 1)}
          </text>
        </svg>
      </div>

      {/* Live readout */}
      <p
        aria-live="polite"
        className="mt-4 rounded-card border border-accent-300 bg-accent-300/20 p-3 text-sm leading-relaxed text-ink-700"
      >
        {readout}
      </p>

      {/* Stats grid */}
      <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { k: evLabel, v: signed(ev) },
          { k: trialsLabel, v: String(trials.count) },
          { k: winRateLabel, v: trials.count ? `${winRate.toFixed(0)}%` : '—' },
          { k: totalLabel, v: trials.count ? signed(trials.total, 0) : '—' },
        ].map((s, i) => (
          <div key={i} className="rounded-card border border-ink-100 bg-surface-sunken p-2.5 text-center">
            <dt className="text-[0.6rem] font-bold uppercase tracking-wide text-ink-500">{s.k}</dt>
            <dd className="mt-0.5 font-mono text-base font-semibold text-ink-900">{s.v}</dd>
          </div>
        ))}
      </dl>

      {/* Sliders */}
      <div className="mt-5 grid gap-4 sm:grid-cols-3">
        <div>
          <label htmlFor={`${reactId}-p`} className="text-[0.65rem] font-bold uppercase tracking-wide text-ink-500">
            {winProbLabel}: {p}%
          </label>
          <input
            id={`${reactId}-p`}
            type="range"
            min={1}
            max={99}
            step={1}
            value={p}
            onChange={(e) => {
              setP(Number(e.target.value));
              setTrials({ wins: 0, total: 0, count: 0 });
            }}
            className="mt-1 h-1.5 w-full cursor-pointer accent-brand-600"
          />
        </div>
        <div>
          <label htmlFor={`${reactId}-up`} className="text-[0.65rem] font-bold uppercase tracking-wide text-ink-500">
            {upsideLabel}: +{up}
          </label>
          <input
            id={`${reactId}-up`}
            type="range"
            min={1}
            max={30}
            step={1}
            value={up}
            onChange={(e) => {
              setUp(Number(e.target.value));
              setTrials({ wins: 0, total: 0, count: 0 });
            }}
            className="mt-1 h-1.5 w-full cursor-pointer accent-brand-600"
          />
        </div>
        <div>
          <label htmlFor={`${reactId}-down`} className="text-[0.65rem] font-bold uppercase tracking-wide text-ink-500">
            {downsideLabel}: −{down}
          </label>
          <input
            id={`${reactId}-down`}
            type="range"
            min={1}
            max={30}
            step={1}
            value={down}
            onChange={(e) => {
              setDown(Number(e.target.value));
              setTrials({ wins: 0, total: 0, count: 0 });
            }}
            className="mt-1 h-1.5 w-full cursor-pointer accent-accent-500"
          />
        </div>
      </div>

      {/* Buttons */}
      <div className="mt-5 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={runTrials}
          className="brutal-btn bg-brand-600 px-4 py-2 text-sm text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
        >
          {runLabel}
        </button>
        <button
          type="button"
          onClick={() => setTrials({ wins: 0, total: 0, count: 0 })}
          className="brutal-btn bg-surface px-4 py-2 text-sm text-ink-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
        >
          {resetLabel}
        </button>
      </div>

      {caption ? <figcaption className="mt-3 text-sm text-ink-500">{caption}</figcaption> : null}
    </figure>
  );
}

export default PayoffExplorer;
