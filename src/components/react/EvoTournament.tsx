import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { cx } from '@/components/react/cx';

/** A single move in the repeated game. */
type Move = 'C' | 'D';

/** The strategies that can compete in the population. */
export type EvoStrategyKey = 'allC' | 'allD' | 'tft' | 'grudger';

/** A strategy: choose this round's move from the history so far. */
type StrategyFn = (own: Move[], opp: Move[]) => Move;

const STRATEGY_FNS: Record<EvoStrategyKey, StrategyFn> = {
  // Always cooperate — the naive altruist.
  allC: () => 'C',
  // Always defect — the pure cheat.
  allD: () => 'D',
  // Tit-for-tat: cooperate first, then echo the opponent's last move.
  tft: (_own, opp) => (opp.length === 0 ? 'C' : opp[opp.length - 1]),
  // Grudger (grim trigger): cooperate until ever crossed, then defect forever.
  grudger: (_own, opp) => (opp.includes('D') ? 'D' : 'C'),
};

/** One competitor in the ecology: a strategy plus its display metadata. */
export interface EvoStrategyOption {
  /** Which built-in strategy this competitor plays. */
  key: EvoStrategyKey;
  /** Display name (locale-specific). */
  label: string;
  /** Starting share of the population, 0–1. Shares are renormalised to sum 1. */
  initial: number;
}

/** Props for the {@link EvoTournament} island. */
export interface EvoTournamentProps {
  /** Heading above the card. */
  title?: string;
  /** Eyebrow label. Defaults to `'Evolutionary tournament'`. */
  eyebrow?: string;
  /** Instruction line above the chart. */
  instructions?: string;
  /** Caption beneath the card. */
  caption?: string;
  /** Temptation payoff — defect while they cooperate. Defaults to `5`. */
  temptation?: number;
  /** Reward payoff — both cooperate. Defaults to `3`. */
  reward?: number;
  /** Punishment payoff — both defect. Defaults to `1`. */
  punishment?: number;
  /** Sucker payoff — cooperate while they defect. Defaults to `0`. */
  sucker?: number;
  /**
   * The competitors and their starting shares. Defaults to an even mix of the
   * four classics with English labels.
   */
  strategies?: EvoStrategyOption[];
  /** Rounds each pair plays per encounter — the "shadow of the future". Defaults to `8`. */
  rounds?: number;
  /** Slider minimum rounds. Defaults to `1`. */
  minRounds?: number;
  /** Slider maximum rounds. Defaults to `20`. */
  maxRounds?: number;
  /** Label over the rounds slider. Defaults to `'Rounds per encounter (length of the future)'`. */
  roundsLabel?: string;
  /** Word for a generation, used in the readout. Defaults to `'Generation'`. */
  generationLabel?: string;
  /** Text on the auto-run button. Defaults to `'Evolve ▸'`. */
  runLabel?: string;
  /** Text on the pause button. Defaults to `'Pause'`. */
  pauseLabel?: string;
  /** Text on the advance-a-generation button. Defaults to `'One generation ▸'`. */
  stepLabel?: string;
  /** Text on the reset button. Defaults to `'Reset'`. */
  resetLabel?: string;
  /**
   * Live readout template. `{gen}` (generation), `{leader}` (dominant strategy
   * name) and `{share}` (its share as a percentage) are replaced.
   */
  readoutTemplate?: string;
  /**
   * Verdict once one strategy has all but taken over. `{leader}` and `{share}`
   * are replaced.
   */
  wonTemplate?: string;
  /** Verdict shown while the population is still mixed. */
  mixedNote?: string;
  /** Extra classes merged onto the root element. */
  className?: string;
}

const DEFAULT_STRATEGIES: EvoStrategyOption[] = [
  { key: 'allC', label: 'Always Cooperate', initial: 0.25 },
  { key: 'allD', label: 'Always Defect', initial: 0.25 },
  { key: 'tft', label: 'Tit-for-Tat', initial: 0.25 },
  { key: 'grudger', label: 'Grudger', initial: 0.25 },
];

/** Design-token tints per strategy, so the same colour always means the same player. */
const TINT: Record<EvoStrategyKey, { bar: string; dot: string; text: string }> = {
  allC: { bar: 'bg-success', dot: 'bg-success', text: 'text-success' },
  allD: { bar: 'bg-danger', dot: 'bg-danger', text: 'text-danger' },
  tft: { bar: 'bg-brand-500', dot: 'bg-brand-500', text: 'text-brand-600' },
  grudger: { bar: 'bg-accent-500', dot: 'bg-accent-500', text: 'text-accent-600' },
};

/**
 * Interactive **evolutionary tournament** — natural selection acting on
 * strategies instead of on genes. A whole population of strategies (Always
 * Cooperate, Always Defect, Tit-for-Tat, Grudger) plays a round-robin iterated
 * prisoner's dilemma; each generation, every strategy reproduces in proportion
 * to the average score it earned against the current population (replicator
 * dynamics), so successful strategies grow and failures dwindle.
 *
 * The single most important control is **rounds per encounter** — the length of
 * the shadow of the future. Turn it down to 1 (effectively one-shot) and Always
 * Defect sweeps the population, exactly as the one-shot dilemma predicts. Turn
 * it up and the reciprocators (Tit-for-Tat, Grudger) take over, because the long
 * future lets them punish defection and reap the cooperative reward with each
 * other. Always Cooperate is the naive altruist that gets exploited whenever a
 * defector is around. The learner watches cooperation *evolve* — or collapse —
 * from nothing but selection.
 *
 * Everything is computed deterministically (no `Date.now()`, no `Math.random()`),
 * so SSR and hydration agree and nothing moves until the learner presses a
 * button. The population bar and the running leader are announced via
 * `aria-live`; transitions are instant under `prefers-reduced-motion`.
 */
export function EvoTournament({
  title,
  eyebrow = 'Evolutionary tournament',
  instructions = 'A whole population of strategies plays the repeated dilemma against each other. Each generation, strategies breed in proportion to how well they scored — natural selection on behaviour. Set how many rounds each pair plays (the length of the future), then evolve the population and watch who takes over.',
  caption,
  temptation = 5,
  reward = 3,
  punishment = 1,
  sucker = 0,
  strategies = DEFAULT_STRATEGIES,
  rounds = 8,
  minRounds = 1,
  maxRounds = 20,
  roundsLabel = 'Rounds per encounter (length of the future)',
  generationLabel = 'Generation',
  runLabel = 'Evolve ▸',
  pauseLabel = 'Pause',
  stepLabel = 'One generation ▸',
  resetLabel = 'Reset',
  readoutTemplate = 'Generation {gen}: {leader} leads with {share}% of the population.',
  wonTemplate = '{leader} has taken over — {share}% of the population and climbing.',
  mixedNote = 'The population is still mixed — keep evolving.',
  className,
}: EvoTournamentProps) {
  const reactId = useId();

  // Normalise the starting shares once.
  const initialShares = useMemo(() => {
    const total = strategies.reduce((s, o) => s + Math.max(0, o.initial), 0) || 1;
    return strategies.map((o) => Math.max(0, o.initial) / total);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [strategies]);

  const [numRounds, setNumRounds] = useState(() =>
    Math.max(minRounds, Math.min(maxRounds, rounds)),
  );
  const [shares, setShares] = useState<number[]>(initialShares);
  const [gen, setGen] = useState(0);
  const [running, setRunning] = useState(false);

  // Score one strategy against another over `numRounds` — total payoff to A.
  const totalPayoff = useMemo(() => {
    const scoreRound = (a: Move, b: Move): number => {
      if (a === 'C' && b === 'C') return reward;
      if (a === 'C' && b === 'D') return sucker;
      if (a === 'D' && b === 'C') return temptation;
      return punishment;
    };
    return (keyA: EvoStrategyKey, keyB: EvoStrategyKey): number => {
      const fnA = STRATEGY_FNS[keyA];
      const fnB = STRATEGY_FNS[keyB];
      const movesA: Move[] = [];
      const movesB: Move[] = [];
      let total = 0;
      for (let i = 0; i < numRounds; i += 1) {
        const a = fnA(movesA, movesB);
        const b = fnB(movesB, movesA);
        movesA.push(a);
        movesB.push(b);
        total += scoreRound(a, b);
      }
      return total / numRounds; // per-round average keeps the scale rounds-independent
    };
  }, [numRounds, reward, sucker, temptation, punishment]);

  // Payoff matrix between every pair of present strategies (recomputed on rounds).
  const payoffMatrix = useMemo(() => {
    return strategies.map((si) =>
      strategies.map((sj) => totalPayoff(si.key, sj.key)),
    );
  }, [strategies, totalPayoff]);

  // One replicator step: each strategy's fitness is its average payoff against
  // the current population; shares grow in proportion to fitness.
  const advance = () => {
    setShares((prev) => {
      const fitness = payoffMatrix.map((row) =>
        row.reduce((acc, pay, j) => acc + pay * prev[j], 0),
      );
      const meanFitness =
        fitness.reduce((acc, f, i) => acc + f * prev[i], 0) || 1;
      let next = prev.map((p, i) => (p * fitness[i]) / meanFitness);
      // Kill off vanishingly small shares so a strategy can go genuinely extinct.
      next = next.map((p) => (p < 0.002 ? 0 : p));
      const sum = next.reduce((a, b) => a + b, 0) || 1;
      return next.map((p) => p / sum);
    });
    setGen((g) => g + 1);
  };

  const advanceRef = useRef(advance);
  advanceRef.current = advance;

  // Reset the population whenever the rounds change — a new world to evolve in.
  useEffect(() => {
    setShares(initialShares);
    setGen(0);
    setRunning(false);
  }, [numRounds, initialShares]);

  const leaderIdx = shares.reduce(
    (best, p, i) => (p > shares[best] ? i : best),
    0,
  );
  const leaderShare = shares[leaderIdx] ?? 0;
  const won = leaderShare >= 0.98;

  // Auto-run loop.
  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      advanceRef.current();
    }, 650);
    return () => window.clearInterval(id);
  }, [running]);

  // Stop auto-running once someone has essentially won.
  useEffect(() => {
    if (won && running) setRunning(false);
  }, [won, running]);

  const reset = () => {
    setRunning(false);
    setShares(initialShares);
    setGen(0);
  };

  const leaderLabel = strategies[leaderIdx]?.label ?? '';
  const sharePct = Math.round(leaderShare * 100);
  const readout = readoutTemplate
    .replace('{gen}', String(gen))
    .replace('{leader}', leaderLabel)
    .replace('{share}', String(sharePct));
  const verdict = won
    ? wonTemplate
        .replace('{leader}', leaderLabel)
        .replace('{share}', String(sharePct))
    : mixedNote;

  return (
    <figure className={cx('brutal my-6 bg-surface p-5 sm:p-6', className)}>
      <p className="font-display text-xs font-semibold uppercase tracking-wide text-accent-600">
        {eyebrow}
      </p>
      {title ? (
        <p className="mt-1 font-display text-lg font-semibold text-ink-900">{title}</p>
      ) : null}

      <p className="mt-2 text-sm font-medium text-ink-700">{instructions}</p>

      {/* Rounds slider — the shadow of the future */}
      <div className="mt-4">
        <div className="flex items-center justify-between text-[0.65rem] font-bold uppercase tracking-wide text-ink-500">
          <label htmlFor={`${reactId}-rounds`}>{roundsLabel}</label>
          <span className="font-mono">{numRounds}</span>
        </div>
        <input
          id={`${reactId}-rounds`}
          type="range"
          min={minRounds}
          max={maxRounds}
          step={1}
          value={numRounds}
          onChange={(e) => setNumRounds(Number(e.target.value))}
          className="mt-1 h-1.5 w-full cursor-pointer accent-brand-600"
        />
      </div>

      {/* Population composition bar */}
      <div className="mt-5">
        <div
          className="flex h-9 w-full overflow-hidden rounded-pill ring-1 ring-inset ring-ink-200"
          role="img"
          aria-label={readout}
        >
          {strategies.map((s, i) =>
            shares[i] > 0 ? (
              <div
                key={`${reactId}-seg-${s.key}`}
                className={cx(
                  'h-full transition-[width] duration-500 ease-out motion-reduce:transition-none',
                  TINT[s.key].bar,
                )}
                style={{ width: `${shares[i] * 100}%` }}
              />
            ) : null,
          )}
        </div>

        {/* Legend + live shares */}
        <ul className="mt-3 grid gap-x-4 gap-y-1.5 sm:grid-cols-2">
          {strategies.map((s, i) => (
            <li
              key={`${reactId}-leg-${s.key}`}
              className="flex items-center justify-between gap-2 text-sm"
            >
              <span className="flex items-center gap-2">
                <span className={cx('inline-block size-3 rounded-sm', TINT[s.key].dot)} />
                <span className="font-medium text-ink-800">{s.label}</span>
              </span>
              <span
                className={cx(
                  'font-mono text-xs font-bold tabular-nums',
                  shares[i] > 0 ? 'text-ink-900' : 'text-ink-400 line-through',
                )}
              >
                {Math.round(shares[i] * 100)}%
              </span>
            </li>
          ))}
        </ul>
      </div>

      {/* Readout / verdict */}
      <div aria-live="polite" className="mt-4">
        <p
          className={cx(
            'rounded-card border-l-4 p-3 text-sm font-medium',
            won
              ? 'border-brand-500 bg-brand-50 text-ink-900'
              : 'border-ink-200 bg-surface-sunken/60 text-ink-700',
          )}
        >
          <span className="font-mono text-xs uppercase tracking-wide text-ink-500">
            {generationLabel} {gen}
          </span>
          <br />
          {verdict}
        </p>
      </div>

      {/* Controls */}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => setRunning((r) => !r)}
          disabled={won}
          className="brutal-btn bg-brand-600 px-4 py-2 font-display text-sm text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {running ? pauseLabel : runLabel}
        </button>
        <button
          type="button"
          onClick={() => {
            setRunning(false);
            advance();
          }}
          disabled={won}
          className="brutal-btn bg-accent-500 px-4 py-2 font-display text-sm text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {stepLabel}
        </button>
        <button
          type="button"
          onClick={reset}
          className="inline-flex items-center rounded-pill px-3 py-2 font-display text-sm font-semibold text-ink-600 ring-1 ring-inset ring-ink-300 transition-colors hover:bg-surface-sunken motion-reduce:transition-none"
        >
          {resetLabel}
        </button>
      </div>

      {caption ? (
        <figcaption className="mt-3 text-sm text-ink-500">{caption}</figcaption>
      ) : null}
    </figure>
  );
}

export default EvoTournament;
