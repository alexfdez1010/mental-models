import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { cx } from '@/components/react/cx';

/** A single move in the repeated game. */
type Move = 'C' | 'D';

/** The strategies the learner can pit against each other. */
export type StrategyKey =
  | 'allC'
  | 'allD'
  | 'tft'
  | 'grudger'
  | 'tf2t';

/** A strategy: choose this round's move from the full history so far. */
type StrategyFn = (own: Move[], opp: Move[]) => Move;

const STRATEGIES: Record<StrategyKey, StrategyFn> = {
  // Always cooperate.
  allC: () => 'C',
  // Always defect.
  allD: () => 'D',
  // Tit-for-tat: cooperate first, then echo the opponent's last move.
  tft: (_own, opp) => (opp.length === 0 ? 'C' : opp[opp.length - 1]),
  // Grudger (grim trigger): cooperate until the opponent ever defects, then
  // defect forever.
  grudger: (_own, opp) => (opp.includes('D') ? 'D' : 'C'),
  // Tit-for-two-tats: only defect after the opponent defects twice in a row.
  tf2t: (_own, opp) =>
    opp.length >= 2 && opp[opp.length - 1] === 'D' && opp[opp.length - 2] === 'D'
      ? 'D'
      : 'C',
};

/** A chooser option shown in the strategy dropdowns. */
export interface DilemmaStrategyOption {
  /** Which built-in strategy this option selects. */
  key: StrategyKey;
  /** Display name (locale-specific). */
  label: string;
}

/** Props for the {@link IteratedDilemma} island. */
export interface IteratedDilemmaProps {
  /** Heading above the card. */
  title?: string;
  /** Eyebrow label. Defaults to `'Repeated game'`. */
  eyebrow?: string;
  /** Instruction line. */
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
   * The strategies offered in both dropdowns, in display order. Defaults to the
   * five classics with English labels.
   */
  strategies?: DilemmaStrategyOption[];
  /** Starting strategy for player A (a `StrategyKey`). Defaults to `'tft'`. */
  initialA?: StrategyKey;
  /** Starting strategy for player B (a `StrategyKey`). Defaults to `'allD'`. */
  initialB?: StrategyKey;
  /** Default number of rounds. Defaults to `10`. */
  rounds?: number;
  /** Slider minimum rounds. Defaults to `4`. */
  minRounds?: number;
  /** Slider maximum rounds. Defaults to `30`. */
  maxRounds?: number;
  /** Name of player A. Defaults to `'Player A'`. */
  playerALabel?: string;
  /** Name of player B. Defaults to `'Player B'`. */
  playerBLabel?: string;
  /** Label over the rounds slider. Defaults to `'Rounds'`. */
  roundsLabel?: string;
  /** Word shown for a cooperate move. Defaults to `'C'`. */
  cooperateMark?: string;
  /** Word shown for a defect move. Defaults to `'D'`. */
  defectMark?: string;
  /** Cooperate legend. Defaults to `'C = cooperate'`. */
  cooperateLegend?: string;
  /** Defect legend. Defaults to `'D = defect'`. */
  defectLegend?: string;
  /** Run/Play button text. Defaults to `'Play ▸'`. */
  runLabel?: string;
  /** Pause button text. Defaults to `'Pause'`. */
  pauseLabel?: string;
  /** Step button text. Defaults to `'Step ▸'`. */
  stepLabel?: string;
  /** Reset button text. Defaults to `'Reset'`. */
  resetLabel?: string;
  /** Word for the total-score readout. Defaults to `'Total'`. */
  totalLabel?: string;
  /**
   * Verdict template once all rounds are revealed. `{nameA}`, `{scoreA}`,
   * `{nameB}`, `{scoreB}` are replaced.
   */
  verdictTemplate?: string;
  /** Shown instead of the verdict when scores tie. `{score}` is replaced. */
  tieTemplate?: string;
  /** Extra classes merged onto the root element. */
  className?: string;
}

const DEFAULT_STRATEGIES: DilemmaStrategyOption[] = [
  { key: 'allC', label: 'Always Cooperate' },
  { key: 'allD', label: 'Always Defect' },
  { key: 'tft', label: 'Tit-for-Tat' },
  { key: 'grudger', label: 'Grudger' },
  { key: 'tf2t', label: 'Tit-for-Two-Tats' },
];

/**
 * Interactive **iterated prisoner's dilemma** — watch why cooperation, which is
 * irrational in a one-shot game, becomes the smart move when the game repeats.
 *
 * The learner pits two strategies against each other (Always Defect, Tit-for-Tat,
 * Grudger, …), sets how many rounds they play, and steps or plays the match. Each
 * round both sides choose Cooperate or Defect from the history so far; the tape
 * fills in move by move and the cumulative scores race ahead. The lessons land
 * themselves: Always Defect crushes a naive cooperator but only ties a grudging
 * one, while two Tit-for-Tat players quietly rack up the cooperative reward and
 * leave the defector behind over a long game. The standard payoffs
 * (T > R > P > S, with 2R > T + S) are editable via props.
 *
 * The match is computed deterministically (no randomness, no `Date.now()`), so
 * SSR and hydration agree and nothing moves until the learner presses Play. The
 * move tape is decorative; the running scores and final verdict are announced via
 * `aria-live`. Reveal transitions are gentle and instant under
 * `prefers-reduced-motion`.
 */
export function IteratedDilemma({
  title,
  eyebrow = 'Repeated game',
  instructions = 'Pick a strategy for each side, choose how many rounds they play, then step or play the match. Watch who pulls ahead — and notice that the defector’s edge fades the longer the game runs.',
  caption,
  temptation = 5,
  reward = 3,
  punishment = 1,
  sucker = 0,
  strategies = DEFAULT_STRATEGIES,
  initialA = 'tft',
  initialB = 'allD',
  rounds = 10,
  minRounds = 4,
  maxRounds = 30,
  playerALabel = 'Player A',
  playerBLabel = 'Player B',
  roundsLabel = 'Rounds',
  cooperateMark = 'C',
  defectMark = 'D',
  cooperateLegend = 'C = cooperate',
  defectLegend = 'D = defect',
  runLabel = 'Play ▸',
  pauseLabel = 'Pause',
  stepLabel = 'Step ▸',
  resetLabel = 'Reset',
  totalLabel = 'Total',
  verdictTemplate = '{nameA} ({stratA}) scored {scoreA}; {nameB} ({stratB}) scored {scoreB}.',
  tieTemplate = 'A dead heat — both scored {score}.',
  className,
}: IteratedDilemmaProps) {
  const reactId = useId();

  const [stratA, setStratA] = useState<StrategyKey>(initialA);
  const [stratB, setStratB] = useState<StrategyKey>(initialB);
  const [numRounds, setNumRounds] = useState(() =>
    Math.max(minRounds, Math.min(maxRounds, rounds)),
  );
  const [revealed, setRevealed] = useState(0);
  const [running, setRunning] = useState(false);

  // Score a single round for both players.
  const scoreRound = (a: Move, b: Move): [number, number] => {
    if (a === 'C' && b === 'C') return [reward, reward];
    if (a === 'C' && b === 'D') return [sucker, temptation];
    if (a === 'D' && b === 'C') return [temptation, sucker];
    return [punishment, punishment];
  };

  // The full deterministic match, recomputed whenever the inputs change.
  const match = useMemo(() => {
    const fnA = STRATEGIES[stratA];
    const fnB = STRATEGIES[stratB];
    const movesA: Move[] = [];
    const movesB: Move[] = [];
    const cumA: number[] = [];
    const cumB: number[] = [];
    let runningA = 0;
    let runningB = 0;
    for (let i = 0; i < numRounds; i += 1) {
      const a = fnA(movesA, movesB);
      const b = fnB(movesB, movesA);
      movesA.push(a);
      movesB.push(b);
      const [sa, sb] = scoreRound(a, b);
      runningA += sa;
      runningB += sb;
      cumA.push(runningA);
      cumB.push(runningB);
    }
    return { movesA, movesB, cumA, cumB };
    // scoreRound is pure over the payoff props, which are in the dep list.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stratA, stratB, numRounds, temptation, reward, punishment, sucker]);

  // Reset the reveal whenever the match definition changes.
  useEffect(() => {
    setRevealed(0);
    setRunning(false);
  }, [stratA, stratB, numRounds]);

  // Play loop: reveal one more round on an interval while running.
  const revealedRef = useRef(revealed);
  revealedRef.current = revealed;
  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      if (revealedRef.current >= numRounds) {
        setRunning(false);
        return;
      }
      setRevealed((n) => Math.min(numRounds, n + 1));
    }, 550);
    return () => window.clearInterval(id);
  }, [running, numRounds]);

  const step = () => {
    setRunning(false);
    setRevealed((n) => Math.min(numRounds, n + 1));
  };
  const reset = () => {
    setRunning(false);
    setRevealed(0);
  };

  const scoreA = revealed > 0 ? match.cumA[revealed - 1] : 0;
  const scoreB = revealed > 0 ? match.cumB[revealed - 1] : 0;
  const done = revealed >= numRounds;
  const maxScore = Math.max(1, scoreA, scoreB);

  const labelFor = (key: StrategyKey) =>
    strategies.find((s) => s.key === key)?.label ?? key;

  const verdict = done
    ? scoreA === scoreB
      ? tieTemplate.replace('{score}', String(scoreA))
      : verdictTemplate
          .replace('{nameA}', playerALabel)
          .replace('{stratA}', labelFor(stratA))
          .replace('{scoreA}', String(scoreA))
          .replace('{nameB}', playerBLabel)
          .replace('{stratB}', labelFor(stratB))
          .replace('{scoreB}', String(scoreB))
    : '';

  const Tape = ({ moves, who }: { moves: Move[]; who: 'a' | 'b' }) => (
    <div className="flex flex-wrap gap-1">
      {moves.slice(0, revealed).map((m, i) => (
        <span
          key={`${reactId}-${who}-${i}`}
          className={cx(
            'flex size-6 items-center justify-center rounded-md font-mono text-xs font-bold transition-transform duration-200 motion-reduce:transition-none',
            m === 'C'
              ? 'bg-success/15 text-success ring-1 ring-inset ring-success/40'
              : 'bg-danger/15 text-danger ring-1 ring-inset ring-danger/40',
          )}
        >
          {m === 'C' ? cooperateMark : defectMark}
        </span>
      ))}
    </div>
  );

  const ScoreBar = ({
    name,
    strat,
    score,
    tint,
  }: {
    name: string;
    strat: StrategyKey;
    score: number;
    tint: string;
  }) => (
    <div>
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="font-semibold text-ink-800">
          {name} <span className="text-xs font-normal text-ink-500">· {labelFor(strat)}</span>
        </span>
        <span className="font-mono font-bold tabular-nums text-ink-900">{score}</span>
      </div>
      <div className="mt-1 h-2.5 w-full overflow-hidden rounded-pill bg-surface-sunken">
        <div
          className={cx('h-full rounded-pill transition-[width] duration-300 ease-out motion-reduce:transition-none', tint)}
          style={{ width: `${Math.round((score / maxScore) * 100)}%` }}
        />
      </div>
    </div>
  );

  return (
    <figure className={cx('brutal my-6 bg-surface p-5 sm:p-6', className)}>
      <p className="font-display text-xs font-semibold uppercase tracking-wide text-accent-600">
        {eyebrow}
      </p>
      {title ? (
        <p className="mt-1 font-display text-lg font-semibold text-ink-900">{title}</p>
      ) : null}

      <p className="mt-2 text-sm font-medium text-ink-700">{instructions}</p>

      {/* Strategy pickers */}
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="block text-[0.65rem] font-bold uppercase tracking-wide text-brand-600">
            {playerALabel}
          </span>
          <select
            value={stratA}
            onChange={(e) => setStratA(e.target.value as StrategyKey)}
            className="mt-1 w-full rounded-card border-2 border-ink-200 bg-surface px-3 py-2 text-sm font-medium text-ink-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-600"
          >
            {strategies.map((s) => (
              <option key={`${reactId}-a-${s.key}`} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="block text-[0.65rem] font-bold uppercase tracking-wide text-accent-600">
            {playerBLabel}
          </span>
          <select
            value={stratB}
            onChange={(e) => setStratB(e.target.value as StrategyKey)}
            className="mt-1 w-full rounded-card border-2 border-ink-200 bg-surface px-3 py-2 text-sm font-medium text-ink-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent-500"
          >
            {strategies.map((s) => (
              <option key={`${reactId}-b-${s.key}`} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* Rounds slider */}
      <div className="mt-3">
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

      {/* Move tapes */}
      <div className="mt-4 space-y-3 rounded-card border-2 border-ink-200 bg-surface-sunken/50 p-3">
        <div>
          <p className="mb-1 text-[0.65rem] font-bold uppercase tracking-wide text-brand-600">
            {playerALabel}
          </p>
          <Tape moves={match.movesA} who="a" />
        </div>
        <div>
          <p className="mb-1 text-[0.65rem] font-bold uppercase tracking-wide text-accent-600">
            {playerBLabel}
          </p>
          <Tape moves={match.movesB} who="b" />
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1 text-[0.7rem] font-semibold text-ink-500">
          <span>{cooperateLegend}</span>
          <span>{defectLegend}</span>
        </div>
      </div>

      {/* Scores */}
      <div aria-live="polite" className="mt-4 space-y-3">
        <ScoreBar name={playerALabel} strat={stratA} score={scoreA} tint="bg-brand-500" />
        <ScoreBar name={playerBLabel} strat={stratB} score={scoreB} tint="bg-accent-500" />
        {verdict ? (
          <p className="rounded-card border-l-4 border-brand-500 bg-brand-50 p-3 text-sm font-medium text-ink-800">
            {verdict}
          </p>
        ) : null}
      </div>

      {/* Controls */}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => setRunning((r) => !r)}
          disabled={done}
          className="brutal-btn bg-brand-600 px-4 py-2 font-display text-sm text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {running ? pauseLabel : runLabel}
        </button>
        <button
          type="button"
          onClick={step}
          disabled={done}
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
        <span className="ml-auto font-mono text-xs text-ink-500">
          {totalLabel}: {revealed}/{numRounds}
        </span>
      </div>

      {caption ? (
        <figcaption className="mt-3 text-sm text-ink-500">{caption}</figcaption>
      ) : null}
    </figure>
  );
}

export default IteratedDilemma;
