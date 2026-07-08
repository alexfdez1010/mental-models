import { useId, useMemo, useState } from 'react';
import { cx } from '@/components/react/cx';

/** Props for the {@link ErgodicityEngine} island. */
export interface ErgodicityEngineProps {
  /** Heading above the card. */
  title?: string;
  /** Eyebrow label. Defaults to `'Ergodicity engine'`. */
  eyebrow?: string;
  /** Instruction line above the simulation. */
  instructions?: string;
  /** Caption beneath the card. */
  caption?: string;
  /** Legend label for the ENSEMBLE mean line. Defaults to `'Ensemble average'`. */
  ensembleLabel?: string;
  /** Legend label for the TYPICAL (median) player line. Defaults to `'Typical player'`. */
  medianLabel?: string;
  /** Label above the up-move slider (the win multiplier). */
  upLabel?: string;
  /** Label above the down-move slider (the loss multiplier). */
  downLabel?: string;
  /** Label above the win-probability slider. */
  winLabel?: string;
  /** Label above the rounds slider. */
  roundsLabel?: string;
  /** Label above the bet-fraction (Kelly) slider. */
  betLabel?: string;
  /** Caption on the low end of the bet-fraction slider (bet a sliver). */
  betLowLabel?: string;
  /** Caption on the high end of the bet-fraction slider (bet it all / lever up). */
  betHighLabel?: string;
  /** Text on the run button. Defaults to `'Run the gamble ▸'`. */
  runLabel?: string;
  /** Text on the reset button. Defaults to `'Reset ↻'`. */
  resetLabel?: string;
  /** Word for the vertical axis unit (a multiple of the starting stake). Defaults to `'× stake'`. */
  axisLabel?: string;
  /** Verdict when the time-average growth rate is clearly negative (the path decays to ruin). */
  verdictRuin?: string;
  /** Verdict when the time-average growth rate is essentially flat (knife-edge). */
  verdictFlat?: string;
  /** Verdict when the time-average growth rate is positive (the path compounds up). */
  verdictGrow?: string;
  /** Prompt shown in the readout before the first run. */
  idlePrompt?: string;
  /**
   * Live readout template. `{rounds}`, `{players}`, `{ensemble}` (mean final wealth,
   * formatted), `{median}` (typical final wealth), `{eGrowth}` (ensemble per-round
   * growth %, signed), `{tGrowth}` (time-average per-round growth %, signed),
   * `{wiped}` (share of players ruined, %), and `{verdict}` are replaced.
   */
  readout?: string;
  /** Starting up-move as a percent gain on the staked slice (e.g. `50` = ×1.5). Defaults to `50`. */
  initialUpPct?: number;
  /** Starting down-move as a percent loss on the staked slice (e.g. `40` = ×0.6). Defaults to `40`. */
  initialDownPct?: number;
  /** Starting win probability as a percent. Defaults to `50`. */
  initialWinPct?: number;
  /** Starting number of rounds each player lives through. Defaults to `50`. */
  initialRounds?: number;
  /** Starting bet fraction as a percent of wealth staked each round. Defaults to `100`. */
  initialBetPct?: number;
  /** Thousands separator for formatted wealth. Defaults to `','` (use `'.'` for es). */
  groupSeparator?: string;
  /** Extra classes merged onto the root element. */
  className?: string;
}

// ── Model constants ──────────────────────────────────────────────────────────
const PLAYERS = 400; // parallel bettors in the ensemble
const RUIN_FRACTION = 0.01; // below 1% of the starting stake counts as "wiped out"
const WEALTH_FLOOR = 1e-12; // numerical floor so log10 never sees a true zero

// ── Chart geometry ───────────────────────────────────────────────────────────
const W = 460;
const H = 190;
const PAD_L = 8;
const PAD_R = 8;
const PAD_T = 12;
const PAD_B = 12;
const PLOT_W = W - PAD_L - PAD_R;
const PLOT_H = H - PAD_T - PAD_B;

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

/** Format a wealth multiple (× starting stake) compactly: 3.1M, 12.4k, 1.05, 0.006. */
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

const signed = (n: number, digits = 1) => (n >= 0 ? '+' : '') + n.toFixed(digits);

interface SimResult {
  ensemblePath: number[]; // mean wealth across players, per round (length rounds+1)
  medianPath: number[]; // median wealth across players, per round
  wipedShare: number; // fraction of players below the ruin floor at the end
  ensembleFinal: number;
  medianFinal: number;
}

/**
 * Interactive **ergodicity** sandbox. A multiplicative gamble is played by a
 * whole ENSEMBLE of parallel players (400 of them) and, in the same picture,
 * lived through by the TYPICAL (median) single player over TIME.
 *
 * Each round a player either wins — multiplying the staked fraction `f` of their
 * wealth by the up-factor — or loses, multiplying it by the down-factor. Wealth
 * updates by `W ← W · (1 − f + f·up)` on a win and `W ← W · (1 − f + f·down)` on
 * a loss. The default coin (up ×1.5, down ×0.6, fair, full stake) has a *positive*
 * ensemble growth rate (+5%/round) yet a *negative* time-average growth rate
 * (√(1.5·0.6) ≈ 0.949, about −5%/round) — so the ensemble mean explodes upward
 * while the typical path decays toward ruin. That gap is **non-ergodicity**.
 *
 * The bet-fraction slider is the Kelly knob: shrinking `f` bends the loss factor
 * back toward 1, and at a small enough stake the time-average growth turns
 * positive — the individual path finally compounds up. All meaning lives in the
 * `aria-live` readout (ensemble vs time-average growth, share wiped out, verdict);
 * the two-line log-scale chart is decorative. Nothing runs until the learner
 * presses the button, and the simulation is a plain Monte-Carlo (uses Math.random).
 */
export function ErgodicityEngine({
  title,
  eyebrow = 'Ergodicity engine',
  instructions = 'A multiplicative coin-flip, played two ways at once. The ENSEMBLE line is the average wealth across 400 parallel players; the TYPICAL line is the single median player living the sequence over time. Set the gamble, then run it. With the default coin the ensemble average rockets up while the typical player is quietly ground toward zero — the same bet, two opposite fates. Shrink the bet fraction and watch the typical path finally turn upward.',
  caption,
  ensembleLabel = 'Ensemble average (400 parallel players)',
  medianLabel = 'Typical player (median, over time)',
  upLabel = 'Win move — the staked slice grows by',
  downLabel = 'Loss move — the staked slice shrinks by',
  winLabel = 'Chance of a win',
  roundsLabel = 'Rounds played',
  betLabel = 'Bet fraction — how much of your wealth you stake each round',
  betLowLabel = 'a sliver',
  betHighLabel = 'everything',
  runLabel = 'Run the gamble ▸',
  resetLabel = 'Reset ↻',
  axisLabel = '× stake (log scale)',
  verdictRuin = 'NON-ERGODIC ruin — the ensemble average climbs, but the typical player is dragged toward zero. The +EV lives only in a vanishing fraction of astronomically lucky paths; almost everyone busts.',
  verdictFlat = 'the knife-edge — the typical path barely holds its ground while the ensemble average still drifts up. A touch more stake and the individual starts to decay.',
  verdictGrow = 'the bet is now small enough that the TIME-AVERAGE growth is positive — the typical player compounds upward too. This is the Kelly region: size the bet to survive, and the path finally grows.',
  idlePrompt = 'Set the gamble and press run. Watch the ensemble average and the typical player split apart.',
  readout = 'After {rounds} rounds across {players} players: the ensemble average ends at {ensemble}× the stake (growing {eGrowth}%/round), but the typical player ends at {median}× (time-average {tGrowth}%/round), and {wiped}% of players were wiped out. {verdict}',
  initialUpPct = 50,
  initialDownPct = 40,
  initialWinPct = 50,
  initialRounds = 50,
  initialBetPct = 100,
  groupSeparator = ',',
  className,
}: ErgodicityEngineProps) {
  const reactId = useId();

  const clampUp = (n: number) => clamp(Math.round(n), 5, 200);
  const clampDown = (n: number) => clamp(Math.round(n), 5, 95);
  const clampWin = (n: number) => clamp(Math.round(n), 5, 95);
  const clampRounds = (n: number) => clamp(Math.round(n), 5, 100);
  const clampBet = (n: number) => clamp(Math.round(n), 0, 150);

  const [upPct, setUpPct] = useState(() => clampUp(initialUpPct));
  const [downPct, setDownPct] = useState(() => clampDown(initialDownPct));
  const [winPct, setWinPct] = useState(() => clampWin(initialWinPct));
  const [rounds, setRounds] = useState(() => clampRounds(initialRounds));
  const [betPct, setBetPct] = useState(() => clampBet(initialBetPct));
  const [result, setResult] = useState<SimResult | null>(null);

  // Derived per-round factors for the currently staked fraction.
  const f = betPct / 100;
  const up = 1 + upPct / 100; // e.g. 1.5
  const down = 1 - downPct / 100; // e.g. 0.6
  const p = winPct / 100;
  const fUp = 1 - f + f * up; // multiplier on a win
  const fDown = 1 - f + f * down; // multiplier on a loss

  // Analytic growth rates (clean, they do not wobble like the Monte-Carlo).
  const ensembleFactor = p * fUp + (1 - p) * fDown; // arithmetic mean factor
  const eGrowthPct = (ensembleFactor - 1) * 100;
  // Time-average (geometric) growth: exp(E[ln factor]) − 1. A ≤0 loss factor = certain ruin.
  const canLog = fUp > 0 && fDown > 0;
  const logG = canLog ? p * Math.log(fUp) + (1 - p) * Math.log(fDown) : -Infinity;
  const tGrowthPct = canLog ? (Math.exp(logG) - 1) * 100 : -100;

  const runSim = () => {
    const wealth = new Array<number>(PLAYERS).fill(1);
    const ensemblePath: number[] = [1];
    const medianPath: number[] = [1];
    for (let r = 0; r < rounds; r++) {
      let sum = 0;
      for (let i = 0; i < PLAYERS; i++) {
        const factor = Math.random() < p ? fUp : fDown;
        let w = wealth[i] * factor;
        if (w < WEALTH_FLOOR) w = 0;
        wealth[i] = w;
        sum += w;
      }
      ensemblePath.push(sum / PLAYERS);
      const sorted = [...wealth].sort((a, b) => a - b);
      const mid = PLAYERS >> 1;
      medianPath.push((sorted[mid - 1] + sorted[mid]) / 2);
    }
    const wiped = wealth.filter((w) => w < RUIN_FRACTION).length / PLAYERS;
    setResult({
      ensemblePath,
      medianPath,
      wipedShare: wiped,
      ensembleFinal: ensemblePath[ensemblePath.length - 1],
      medianFinal: medianPath[medianPath.length - 1],
    });
  };

  const reset = () => setResult(null);

  // Changing any input invalidates the last run.
  const onInput = (setter: (n: number) => void, clampFn: (n: number) => number, raw: number) => {
    setter(clampFn(raw));
    setResult(null);
  };

  // ── Verdict from the time-average growth rate ──────────────────────────────
  let verdict: string;
  if (tGrowthPct > 0.4) verdict = verdictGrow;
  else if (tGrowthPct < -0.4) verdict = verdictRuin;
  else verdict = verdictFlat;

  // ── Chart paths (log10 wealth, shared axis) ────────────────────────────────
  const { ensPath, medPath, gridY } = useMemo(() => {
    if (!result) return { ensPath: '', medPath: '', gridY: [] as { y: number; label: string }[] };
    const all = result.ensemblePath.concat(result.medianPath).map((v) => Math.max(v, WEALTH_FLOOR));
    let lo = Math.log10(Math.min(...all));
    let hi = Math.log10(Math.max(...all));
    if (hi - lo < 1) {
      const mid = (hi + lo) / 2;
      lo = mid - 0.5;
      hi = mid + 0.5;
    }
    const span = hi - lo;
    const n = result.ensemblePath.length;
    const toPoints = (path: number[]) =>
      path
        .map((v, i) => {
          const x = PAD_L + (i / (n - 1)) * PLOT_W;
          const ly = Math.log10(Math.max(v, WEALTH_FLOOR));
          const y = PAD_T + (1 - (ly - lo) / span) * PLOT_H;
          return `${Math.round(x * 10) / 10},${Math.round(y * 10) / 10}`;
        })
        .join(' ');
    // Gridlines at each integer power of ten inside the range.
    const grid: { y: number; label: string }[] = [];
    const from = Math.ceil(lo);
    const to = Math.floor(hi);
    for (let e = from; e <= to; e++) {
      const y = PAD_T + (1 - (e - lo) / span) * PLOT_H;
      grid.push({ y, label: e === 0 ? '1×' : `10^${e}` });
    }
    return { ensPath: toPoints(result.ensemblePath), medPath: toPoints(result.medianPath), gridY: grid };
  }, [result]);

  const colorEnsemble = 'var(--color-brand-500)';
  const colorMedian = 'var(--color-accent-500)';

  const readoutText = result
    ? readout
        .replace('{rounds}', String(rounds))
        .replace('{players}', String(PLAYERS))
        .replace('{ensemble}', fmtWealth(result.ensembleFinal, groupSeparator))
        .replace('{median}', fmtWealth(result.medianFinal, groupSeparator))
        .replace('{eGrowth}', signed(eGrowthPct))
        .replace('{tGrowth}', signed(tGrowthPct))
        .replace('{wiped}', Math.round(result.wipedShare * 100).toString())
        .replace('{verdict}', verdict)
    : idlePrompt;

  const sliderCls = 'mt-1 h-1.5 w-full cursor-pointer';

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
          <span aria-hidden className="inline-block h-3 w-3 rounded-sm" style={{ background: colorEnsemble }} />
          {ensembleLabel}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="inline-block h-3 w-3 rounded-sm" style={{ background: colorMedian }} />
          {medianLabel}
        </span>
      </div>

      {/* Two paths over time — decorative; meaning lives in the readout */}
      <div className="mt-3 overflow-hidden rounded-card border border-ink-100 bg-surface-sunken">
        <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={readoutText}>
          <rect x="0" y="0" width={W} height={H} fill="var(--color-surface-sunken)" />
          {gridY.map((g, i) => (
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
          {ensPath ? (
            <polyline
              points={ensPath}
              fill="none"
              stroke={colorEnsemble}
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ) : null}
          {medPath ? (
            <polyline
              points={medPath}
              fill="none"
              stroke={colorMedian}
              strokeWidth="2.5"
              strokeDasharray="1 5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ) : null}
          {!result ? (
            <text
              x={W / 2}
              y={H / 2}
              fontSize="11"
              textAnchor="middle"
              fill="var(--color-ink-400)"
            >
              {axisLabel}
            </text>
          ) : null}
        </svg>
      </div>

      {/* Live readout + verdict */}
      <p
        aria-live="polite"
        className="mt-4 rounded-card border border-accent-200 bg-accent-50/70 p-3 text-sm leading-relaxed text-ink-700"
      >
        {readoutText}
      </p>

      {/* Growth-rate chips (always visible, from the analytic formulas) */}
      <div className="mt-3 grid grid-cols-2 gap-2 text-center sm:grid-cols-3">
        <div className="rounded-card border border-ink-100 bg-surface-sunken px-2 py-2">
          <div className="text-[0.6rem] font-bold uppercase tracking-wide text-ink-400">ensemble / round</div>
          <div className="font-display text-sm font-semibold tabular-nums" style={{ color: colorEnsemble }}>
            {signed(eGrowthPct)}%
          </div>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken px-2 py-2">
          <div className="text-[0.6rem] font-bold uppercase tracking-wide text-ink-400">time-average / round</div>
          <div
            className="font-display text-sm font-semibold tabular-nums"
            style={{ color: tGrowthPct >= 0 ? colorMedian : 'var(--color-brand-600)' }}
          >
            {signed(tGrowthPct)}%
          </div>
        </div>
        <div className="col-span-2 rounded-card border border-ink-100 bg-surface-sunken px-2 py-2 sm:col-span-1">
          <div className="text-[0.6rem] font-bold uppercase tracking-wide text-ink-400">wiped out</div>
          <div className="font-display text-sm font-semibold tabular-nums text-ink-700">
            {result ? `${Math.round(result.wipedShare * 100)}%` : '—'}
          </div>
        </div>
      </div>

      {/* Sliders */}
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div>
          <div className="flex items-center justify-between text-[0.65rem] font-bold uppercase tracking-wide text-ink-500">
            <label htmlFor={`${reactId}-up`}>{upLabel}</label>
            <span>+{upPct}% (×{up.toFixed(2)})</span>
          </div>
          <input
            id={`${reactId}-up`}
            type="range"
            min={5}
            max={200}
            step={5}
            value={upPct}
            onChange={(e) => onInput(setUpPct, clampUp, Number(e.target.value))}
            aria-valuetext={`win multiplier ${up.toFixed(2)}`}
            className={cx(sliderCls, 'accent-brand-500')}
          />
        </div>
        <div>
          <div className="flex items-center justify-between text-[0.65rem] font-bold uppercase tracking-wide text-ink-500">
            <label htmlFor={`${reactId}-down`}>{downLabel}</label>
            <span>−{downPct}% (×{down.toFixed(2)})</span>
          </div>
          <input
            id={`${reactId}-down`}
            type="range"
            min={5}
            max={95}
            step={5}
            value={downPct}
            onChange={(e) => onInput(setDownPct, clampDown, Number(e.target.value))}
            aria-valuetext={`loss multiplier ${down.toFixed(2)}`}
            className={cx(sliderCls, 'accent-brand-500')}
          />
        </div>
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
            step={5}
            value={winPct}
            onChange={(e) => onInput(setWinPct, clampWin, Number(e.target.value))}
            aria-valuetext={`win chance ${winPct} percent`}
            className={cx(sliderCls, 'accent-brand-500')}
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
            min={5}
            max={100}
            step={5}
            value={rounds}
            onChange={(e) => onInput(setRounds, clampRounds, Number(e.target.value))}
            aria-valuetext={`${rounds} rounds`}
            className={cx(sliderCls, 'accent-brand-500')}
          />
        </div>
      </div>

      {/* Bet-fraction (Kelly) slider — the star knob, full width */}
      <div className="mt-4 rounded-card border border-accent-200 bg-accent-50/40 p-3">
        <div className="flex items-center justify-between text-[0.65rem] font-bold uppercase tracking-wide text-accent-700">
          <label htmlFor={`${reactId}-bet`}>{betLabel}</label>
          <span>{betPct}%</span>
        </div>
        <input
          id={`${reactId}-bet`}
          type="range"
          min={0}
          max={150}
          step={5}
          value={betPct}
          onChange={(e) => onInput(setBetPct, clampBet, Number(e.target.value))}
          aria-valuetext={`staking ${betPct} percent of wealth each round`}
          className={cx(sliderCls, 'accent-accent-500')}
        />
        <div className="flex justify-between text-[0.6rem] font-medium uppercase tracking-wide text-ink-400">
          <span>{betLowLabel}</span>
          <span>{betHighLabel}</span>
        </div>
      </div>

      {/* Controls */}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={runSim}
          className="brutal-btn bg-brand-500 px-4 py-2 font-display text-sm text-white"
        >
          {runLabel}
        </button>
        <button
          type="button"
          onClick={reset}
          disabled={!result}
          className="inline-flex items-center rounded-pill px-3 py-2 font-display text-sm font-semibold text-ink-600 ring-1 ring-inset ring-ink-300 transition-colors hover:bg-surface-sunken disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none"
        >
          {resetLabel}
        </button>
      </div>

      {caption ? <figcaption className="mt-3 text-sm text-ink-500">{caption}</figcaption> : null}
    </figure>
  );
}

export default ErgodicityEngine;
