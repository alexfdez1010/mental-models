import { useId, useMemo, useState } from 'react';
import { cx } from '@/components/react/cx';

/** Which statistic of the wealth distribution the chosen-fraction line shows. */
export type KellyView = 'median' | 'mean';

/** Props for the {@link KellyBankrollSimulator} island. */
export interface KellyBankrollSimulatorProps {
  /** Heading above the card. */
  title?: string;
  /** Eyebrow label. Defaults to `'Kelly bankroll simulator'`. */
  eyebrow?: string;
  /** Instruction line above the simulation. */
  instructions?: string;
  /** Caption beneath the card. */
  caption?: string;
  /** Starting win probability, as a percent 5–95. Defaults to `60`. */
  initialWinPct?: number;
  /** Starting net payoff odds b (win pays b-to-1). Defaults to `1`. */
  initialOdds?: number;
  /** Starting chosen bet fraction, as a percent of bankroll. Defaults to `40`. */
  initialBetPct?: number;
  /** Starting number of rounds. Defaults to `80`. */
  initialRounds?: number;

  // ── Labels (all user-facing strings, for i18n) ────────────────────────────
  /** Label over the win-probability slider. */
  winLabel?: string;
  /** Label over the payoff-odds slider. */
  oddsLabel?: string;
  /** Label over the chosen bet-fraction slider. */
  betLabel?: string;
  /** Label over the rounds slider. */
  roundsLabel?: string;
  /** Legend label for the chosen-fraction line. */
  chosenLabel?: string;
  /** Legend label for the full-Kelly line. */
  kellyLabel?: string;
  /** Legend label for the half-Kelly line. */
  halfKellyLabel?: string;
  /** View-toggle group label. */
  viewLabel?: string;
  /** Toggle text for the median (typical player) view. */
  medianViewLabel?: string;
  /** Toggle text for the mean (ensemble average) view. */
  meanViewLabel?: string;
  /** Run button text. */
  runLabel?: string;
  /** Reset button text. */
  resetLabel?: string;
  /** y-axis unit label (a multiple of the starting bankroll, log scale). */
  axisLabel?: string;
  /** Stat label for the Kelly fraction f*. */
  kellyStatLabel?: string;
  /** Stat label for the chosen fraction's long-run growth. */
  growthStatLabel?: string;
  /** Stat label for the share of players wiped out at the chosen fraction. */
  ruinStatLabel?: string;
  /** Prompt shown before the first run. */
  idlePrompt?: string;
  /**
   * Live readout template. `{rounds}`, `{players}`, `{fstar}`, `{f}`,
   * `{chosenMedian}`, `{chosenMean}`, `{growth}`, `{ruin}`, `{verdict}` are replaced.
   */
  readout?: string;
  /** Verdict when the chosen fraction over-bets (2f* or beyond): ruin. */
  verdictRuin?: string;
  /** Verdict when over Kelly but still growing. */
  verdictOver?: string;
  /** Verdict near full Kelly. */
  verdictKelly?: string;
  /** Verdict safely under Kelly. */
  verdictUnder?: string;
  /** Thousands separator for formatted wealth. Defaults to `','` (use `'.'` for es). */
  groupSeparator?: string;
  /** Extra classes merged onto the root element. */
  className?: string;
}

const PLAYERS = 300;
const RUIN_FRACTION = 0.01; // below 1% of the start counts as wiped out
const WEALTH_FLOOR = 1e-15;

// ── Chart geometry ──────────────────────────────────────────────────────────
const W = 460;
const H = 210;
const PAD_L = 8;
const PAD_R = 8;
const PAD_T = 12;
const PAD_B = 12;
const PLOT_W = W - PAD_L - PAD_R;
const PLOT_H = H - PAD_T - PAD_B;

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

function fmtWealth(x: number, sep: string): string {
  if (!isFinite(x)) return '∞';
  if (x <= 0) return '0';
  const withSep = (s: string) => s.replace(/,/g, sep);
  if (x >= 1e9) return withSep(`${(x / 1e9).toFixed(1)}B`);
  if (x >= 1e6) return withSep(`${(x / 1e6).toFixed(1)}M`);
  if (x >= 1e3) return withSep(`${(x / 1e3).toFixed(1)}k`);
  if (x >= 10) return Math.round(x).toString();
  if (x >= 1) return x.toFixed(2);
  if (x >= 0.01) return x.toFixed(3);
  return x.toExponential(1);
}

const signed = (n: number, d = 2) => (n >= 0 ? '+' : '') + n.toFixed(d);

interface OneRun {
  medianPath: number[];
  meanPath: number[];
  medianFinal: number;
  meanFinal: number;
  ruinShare: number;
}

/** Simulate PLAYERS bankrolls over `rounds` at fraction `f`. */
function simulate(f: number, p: number, b: number, rounds: number): OneRun {
  const wealth = new Array<number>(PLAYERS).fill(1);
  const medianPath: number[] = [1];
  const meanPath: number[] = [1];
  const winF = 1 + f * b;
  const loseF = 1 - f;
  for (let r = 0; r < rounds; r++) {
    let sum = 0;
    for (let i = 0; i < PLAYERS; i++) {
      const factor = Math.random() < p ? winF : loseF;
      let w = wealth[i] * factor;
      if (w < WEALTH_FLOOR) w = 0;
      wealth[i] = w;
      sum += w;
    }
    const sorted = [...wealth].sort((a, c) => a - c);
    const mid = PLAYERS >> 1;
    medianPath.push((sorted[mid - 1] + sorted[mid]) / 2);
    meanPath.push(sum / PLAYERS);
  }
  const ruin = wealth.filter((w) => w < RUIN_FRACTION).length / PLAYERS;
  return {
    medianPath,
    meanPath,
    medianFinal: medianPath[medianPath.length - 1],
    meanFinal: meanPath[meanPath.length - 1],
    ruinShare: ruin,
  };
}

/** Per-round expected log-growth for fraction f. */
function growthRate(f: number, p: number, b: number): number {
  const q = 1 - p;
  const winF = 1 + f * b;
  const loseF = 1 - f;
  if (winF <= 0 || loseF <= 0) return Number.NEGATIVE_INFINITY;
  return p * Math.log(winF) + q * Math.log(loseF);
}

interface SimState {
  chosen: OneRun;
  kelly: OneRun;
  half: OneRun;
  f: number;
  fStar: number;
}

/**
 * Interactive **Kelly bankroll simulator.** A repeated favourable bet (win
 * probability `p`, net payoff odds `b`-to-1) is played by 300 parallel bankrolls
 * at three staking fractions at once: **half-Kelly**, **full Kelly** `f* = p−q/b`,
 * and the learner's **chosen fraction** (which can be pushed into the over-betting
 * zone). Each round multiplies a bankroll by `1+f·b` on a win or `1−f` on a loss,
 * so wealth compounds multiplicatively.
 *
 * The chart plots the typical (median) trajectory of each fraction on a **log
 * axis**: half-Kelly crawls, full Kelly climbs fastest, and an over-bet chosen
 * fraction spikes then collapses toward ruin. A **median vs mean** toggle switches
 * the chosen line between the typical player and the ensemble average — exposing
 * the ergodicity gap, where the mean rockets up on a few lucky paths while the
 * median (and almost everyone) is wiped out.
 *
 * All meaning lives in the `aria-live` readout. Nothing runs until the learner
 * presses the button; the simulation is a plain Monte-Carlo (uses `Math.random`).
 */
export function KellyBankrollSimulator({
  title,
  eyebrow = 'Kelly bankroll simulator',
  instructions = 'The same favourable bet, staked three ways at once: half-Kelly, full Kelly, and your chosen fraction. Each line is the typical (median) bankroll over time on a log axis. Set the bet, press run, and watch half-Kelly crawl, full Kelly climb fastest, and an over-bet fraction spike then crash. Flip to the mean view to see the ensemble average lie about how the typical player actually did.',
  caption,
  initialWinPct = 60,
  initialOdds = 1,
  initialBetPct = 40,
  initialRounds = 80,
  winLabel = 'Win probability p',
  oddsLabel = 'Payoff odds b (win pays b-to-1)',
  betLabel = 'Your chosen bet fraction f',
  roundsLabel = 'Rounds played',
  chosenLabel = 'Your fraction',
  kellyLabel = 'Full Kelly f*',
  halfKellyLabel = 'Half-Kelly',
  viewLabel = 'Chosen-fraction line shows',
  medianViewLabel = 'Typical player (median)',
  meanViewLabel = 'Ensemble average (mean)',
  runLabel = 'Run the bankrolls ▸',
  resetLabel = 'Reset ↻',
  axisLabel = '× bankroll (log scale)',
  kellyStatLabel = 'Kelly f*',
  growthStatLabel = 'Growth / round',
  ruinStatLabel = 'Wiped out',
  idlePrompt = 'Set the bet and press run. Watch the three staking fractions split apart over time.',
  readout = 'After {rounds} rounds at {b}-to-1 with a {p}% win chance (Kelly f* = {fstar}%): staking your {f}% leaves the typical player at {chosenMedian}× the bankroll (long-run growth {growth}%/round), while the ensemble average reads {chosenMean}× and {ruin}% of players were wiped out. {verdict}',
  verdictRuin = 'Your fraction over-bets to ruin: the mean is dragged up by a lucky few while the typical bankroll collapses — a positive edge squandered by betting too big.',
  verdictOver = 'Your fraction over-bets: more violent swings for LESS growth than full Kelly. Erring high is punished hard.',
  verdictKelly = 'Your fraction is near full Kelly: the fastest long-run growth, at the cost of stomach-churning volatility.',
  verdictUnder = 'Your fraction is under Kelly: slower than f*, but far smoother and robust to an over-estimated edge.',
  groupSeparator = ',',
  className,
}: KellyBankrollSimulatorProps) {
  const reactId = useId();

  const [winPct, setWinPct] = useState(() => clamp(Math.round(initialWinPct), 5, 95));
  const [odds, setOdds] = useState(() => clamp(initialOdds, 0.2, 5));
  const [betPct, setBetPct] = useState(() => clamp(Math.round(initialBetPct), 0, 100));
  const [rounds, setRounds] = useState(() => clamp(Math.round(initialRounds), 10, 120));
  const [view, setView] = useState<KellyView>('median');
  const [sim, setSim] = useState<SimState | null>(null);

  const p = winPct / 100;
  const q = 1 - p;
  const b = odds;
  const f = betPct / 100;
  const fStar = clamp(p - q / b, 0, 1);
  const hasEdge = p - q / b > 0;

  const growthChosen = growthRate(f, p, b);

  const run = () => {
    setSim({
      chosen: simulate(f, p, b, rounds),
      kelly: simulate(fStar, p, b, rounds),
      half: simulate(fStar / 2, p, b, rounds),
      f,
      fStar,
    });
  };
  const reset = () => setSim(null);

  const onInput = (setter: (n: number) => void, lo: number, hi: number, raw: number, round = true) => {
    setter(clamp(round ? Math.round(raw) : raw, lo, hi));
    setSim(null);
  };

  // Numeric zero-growth (≈2f*) crossing for the verdict.
  const fZero = useMemo(() => {
    if (!hasEdge) return 0;
    let lo = fStar;
    let hi = 0.999;
    if (growthRate(hi, p, b) > 0) return hi;
    for (let i = 0; i < 50; i++) {
      const mid = (lo + hi) / 2;
      if (growthRate(mid, p, b) > 0) lo = mid;
      else hi = mid;
    }
    return (lo + hi) / 2;
  }, [p, b, fStar, hasEdge]);

  let verdict = verdictUnder;
  if (!hasEdge || f >= fZero - 1e-6) verdict = verdictRuin;
  else if (f > fStar + 0.03) verdict = verdictOver;
  else if (f >= fStar - 0.03) verdict = verdictKelly;
  else verdict = verdictUnder;

  // ── Chart paths (log10, shared axis across all lines) ──────────────────────
  const chart = useMemo(() => {
    if (!sim) return null;
    const chosenPath = view === 'mean' ? sim.chosen.meanPath : sim.chosen.medianPath;
    const lines = [sim.half.medianPath, sim.kelly.medianPath, chosenPath];
    const all = lines.flat().map((v) => Math.max(v, WEALTH_FLOOR));
    let lo = Math.log10(Math.min(...all));
    let hi = Math.log10(Math.max(...all));
    if (hi - lo < 1) {
      const mid = (hi + lo) / 2;
      lo = mid - 0.5;
      hi = mid + 0.5;
    }
    const span = hi - lo;
    const n = sim.chosen.medianPath.length;
    const toPoints = (path: number[]) =>
      path
        .map((v, i) => {
          const x = PAD_L + (i / (n - 1)) * PLOT_W;
          const ly = Math.log10(Math.max(v, WEALTH_FLOOR));
          const y = PAD_T + (1 - (ly - lo) / span) * PLOT_H;
          return `${Math.round(x * 10) / 10},${Math.round(y * 10) / 10}`;
        })
        .join(' ');
    const grid: { y: number; label: string }[] = [];
    const from = Math.ceil(lo);
    const to = Math.floor(hi);
    for (let e = from; e <= to; e++) {
      const y = PAD_T + (1 - (e - lo) / span) * PLOT_H;
      grid.push({ y, label: e === 0 ? '1×' : `10^${e}` });
    }
    return {
      half: toPoints(sim.half.medianPath),
      kelly: toPoints(sim.kelly.medianPath),
      chosen: toPoints(chosenPath),
      grid,
    };
  }, [sim, view]);

  const colorChosen = 'var(--color-brand-600)';
  const colorKelly = 'var(--color-accent-500)';
  const colorHalf = 'var(--color-ink-400)';

  const readoutText = sim
    ? readout
        .replace('{rounds}', String(rounds))
        .replace('{players}', String(PLAYERS))
        .replace('{fstar}', (fStar * 100).toFixed(0))
        .replace('{f}', String(betPct))
        .replace('{b}', b.toFixed(b % 1 === 0 ? 0 : 1))
        .replace('{p}', String(winPct))
        .replace('{chosenMedian}', fmtWealth(sim.chosen.medianFinal, groupSeparator))
        .replace('{chosenMean}', fmtWealth(sim.chosen.meanFinal, groupSeparator))
        .replace('{growth}', isFinite(growthChosen) ? signed((Math.exp(growthChosen) - 1) * 100) : '−∞')
        .replace('{ruin}', Math.round(sim.chosen.ruinShare * 100).toString())
        .replace('{verdict}', verdict)
    : idlePrompt;

  const sliderCls = 'mt-1 h-1.5 w-full cursor-pointer accent-brand-500';

  return (
    <figure className={cx('brutal my-6 bg-surface p-5 sm:p-6', className)}>
      <p className="font-display text-xs font-semibold uppercase tracking-wide text-accent-600">
        {eyebrow}
      </p>
      {title ? (
        <p className="mt-1 font-display text-lg font-semibold text-ink-900">{title}</p>
      ) : null}

      <p className="mt-2 text-sm font-medium text-ink-700">{instructions}</p>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs font-medium text-ink-600">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="inline-block h-3 w-3 rounded-sm" style={{ background: colorChosen }} />
          {chosenLabel}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="inline-block h-3 w-3 rounded-sm" style={{ background: colorKelly }} />
          {kellyLabel}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="inline-block h-3 w-3 rounded-sm" style={{ background: colorHalf }} />
          {halfKellyLabel}
        </span>
      </div>

      {/* Trajectories */}
      <div className="mt-3 overflow-hidden rounded-card border border-ink-100 bg-surface-sunken">
        <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={readoutText}>
          <rect x="0" y="0" width={W} height={H} fill="var(--color-surface-sunken)" />
          {chart?.grid.map((g, i) => (
            <g key={i}>
              <line
                x1={PAD_L}
                y1={g.y}
                x2={W - PAD_R}
                y2={g.y}
                stroke="var(--color-ink-200)"
                strokeWidth="1"
                strokeDasharray="3 4"
              />
              <text x={PAD_L + 2} y={g.y - 2} fontSize="8" fill="var(--color-ink-400)">
                {g.label}
              </text>
            </g>
          ))}
          {chart ? (
            <>
              <polyline points={chart.half} fill="none" stroke={colorHalf} strokeWidth="2" strokeDasharray="1 4" strokeLinecap="round" strokeLinejoin="round" />
              <polyline points={chart.kelly} fill="none" stroke={colorKelly} strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" />
              <polyline points={chart.chosen} fill="none" stroke={colorChosen} strokeWidth="2.75" strokeLinecap="round" strokeLinejoin="round" />
            </>
          ) : (
            <text x={W / 2} y={H / 2} fontSize="11" textAnchor="middle" fill="var(--color-ink-400)">
              {axisLabel}
            </text>
          )}
        </svg>
      </div>

      {/* Readout */}
      <p
        aria-live="polite"
        className="mt-4 rounded-card border border-accent-200 bg-accent-50/70 p-3 text-sm leading-relaxed text-ink-700"
      >
        {readoutText}
      </p>

      {/* Stat chips */}
      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-card border border-ink-100 bg-surface-sunken px-2 py-2">
          <div className="text-[0.6rem] font-bold uppercase tracking-wide text-ink-400">{kellyStatLabel}</div>
          <div className="font-display text-sm font-semibold tabular-nums" style={{ color: colorKelly }}>
            {(fStar * 100).toFixed(0)}%
          </div>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken px-2 py-2">
          <div className="text-[0.6rem] font-bold uppercase tracking-wide text-ink-400">{growthStatLabel}</div>
          <div
            className="font-display text-sm font-semibold tabular-nums"
            style={{ color: growthChosen >= 0 ? colorChosen : 'var(--color-danger)' }}
          >
            {isFinite(growthChosen) ? signed((Math.exp(growthChosen) - 1) * 100) : '−∞'}%
          </div>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken px-2 py-2">
          <div className="text-[0.6rem] font-bold uppercase tracking-wide text-ink-400">{ruinStatLabel}</div>
          <div className="font-display text-sm font-semibold tabular-nums text-ink-700">
            {sim ? `${Math.round(sim.chosen.ruinShare * 100)}%` : '—'}
          </div>
        </div>
      </div>

      {/* View toggle */}
      <div className="mt-4" role="group" aria-label={viewLabel}>
        <p className="text-[0.65rem] font-bold uppercase tracking-wide text-ink-600">{viewLabel}</p>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {(
            [
              { key: 'median' as const, label: medianViewLabel },
              { key: 'mean' as const, label: meanViewLabel },
            ]
          ).map((o) => (
            <button
              key={o.key}
              type="button"
              aria-pressed={view === o.key}
              onClick={() => setView(o.key)}
              className={cx(
                'rounded-pill border px-3 py-1 text-xs font-semibold transition-colors motion-reduce:transition-none',
                view === o.key
                  ? 'border-accent-600 bg-accent-300/30 text-accent-600'
                  : 'border-ink-200 bg-surface text-ink-600 hover:border-ink-300',
              )}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      {/* Sliders */}
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div>
          <div className="flex items-center justify-between text-[0.65rem] font-bold uppercase tracking-wide text-ink-500">
            <label htmlFor={`${reactId}-win`}>{winLabel}</label>
            <span>{winPct}%</span>
          </div>
          <input
            id={`${reactId}-win`}
            type="range"
            min={5}
            max={95}
            step={1}
            value={winPct}
            onChange={(e) => onInput(setWinPct, 5, 95, Number(e.target.value))}
            className={sliderCls}
          />
        </div>
        <div>
          <div className="flex items-center justify-between text-[0.65rem] font-bold uppercase tracking-wide text-ink-500">
            <label htmlFor={`${reactId}-odds`}>{oddsLabel}</label>
            <span>{b.toFixed(1)}-to-1</span>
          </div>
          <input
            id={`${reactId}-odds`}
            type="range"
            min={0.2}
            max={5}
            step={0.1}
            value={odds}
            onChange={(e) => onInput(setOdds, 0.2, 5, Number(e.target.value), false)}
            className={sliderCls}
          />
        </div>
        <div>
          <div className="flex items-center justify-between text-[0.65rem] font-bold uppercase tracking-wide text-ink-500">
            <label htmlFor={`${reactId}-rounds`}>{roundsLabel}</label>
            <span>{rounds}</span>
          </div>
          <input
            id={`${reactId}-rounds`}
            type="range"
            min={10}
            max={120}
            step={5}
            value={rounds}
            onChange={(e) => onInput(setRounds, 10, 120, Number(e.target.value))}
            className={sliderCls}
          />
        </div>
        <div className="rounded-card border border-accent-200 bg-accent-50/40 p-2">
          <div className="flex items-center justify-between text-[0.65rem] font-bold uppercase tracking-wide text-accent-700">
            <label htmlFor={`${reactId}-bet`}>{betLabel}</label>
            <span>{betPct}%</span>
          </div>
          <input
            id={`${reactId}-bet`}
            type="range"
            min={0}
            max={100}
            step={1}
            value={betPct}
            onChange={(e) => onInput(setBetPct, 0, 100, Number(e.target.value))}
            className="mt-1 h-1.5 w-full cursor-pointer accent-accent-500"
          />
        </div>
      </div>

      {/* Controls */}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button type="button" onClick={run} className="brutal-btn bg-brand-500 px-4 py-2 font-display text-sm text-white">
          {runLabel}
        </button>
        <button
          type="button"
          onClick={reset}
          disabled={!sim}
          className="inline-flex items-center rounded-pill px-3 py-2 font-display text-sm font-semibold text-ink-600 ring-1 ring-inset ring-ink-300 transition-colors hover:bg-surface-sunken disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none"
        >
          {resetLabel}
        </button>
      </div>

      {caption ? <figcaption className="mt-3 text-sm text-ink-500">{caption}</figcaption> : null}
    </figure>
  );
}

export default KellyBankrollSimulator;
