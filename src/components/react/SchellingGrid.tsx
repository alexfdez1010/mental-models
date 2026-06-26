import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { cx } from '@/components/react/cx';

/** Props for the {@link SchellingGrid} island. */
export interface SchellingGridProps {
  /**
   * Side length of the square grid. The board therefore holds `size × size`
   * cells (e.g. `15` → 225 cells). Defaults to `15`.
   */
  size?: number;
  /**
   * Fraction of cells left empty at the start, from `0` to `1`. Empty cells are
   * the vacancies that unhappy agents move into, so a few are essential. The
   * remaining cells are split roughly evenly between the two groups. Defaults to
   * `0.1` (≈10% empty).
   */
  emptyFraction?: number;
  /**
   * Starting tolerance threshold, as a percentage `0`–`100`. An agent is "happy"
   * when at least this share of its occupied neighbours share its type. The
   * famous result is that even a *mild* value here (the default `33` — "I just
   * don't want to be a small minority") drives the board to stark segregation.
   * Defaults to `33`.
   */
  initialTolerance?: number;
  /**
   * Maximum number of rounds the auto-settle loop will run before stopping, as a
   * safety cap in case a configuration never fully settles. Defaults to `60`.
   */
  maxRounds?: number;
  /** Heading above the card. */
  title?: string;
  /** Eyebrow label. Defaults to `'Local rules, global pattern'`. */
  eyebrow?: string;
  /** Instruction line above the grid. */
  instructions?: string;
  /** Caption beneath the card. */
  caption?: string;
  /** Label for the tolerance slider. Defaults to `'Wants at least … similar neighbours'`. */
  toleranceLabel?: string;
  /** Text on the single-step button. Defaults to `'Step ▸'`. */
  stepLabel?: string;
  /** Text on the auto-settle button. Defaults to `'Settle ▸'`. */
  runLabel?: string;
  /** Text on the button that pauses an in-progress auto-settle. Defaults to `'Pause'`. */
  pauseLabel?: string;
  /** Text on the reset button. Defaults to `'Reset'`. */
  resetLabel?: string;
  /** Word for a round, used in the readout. Defaults to `'Round'`. */
  roundLabel?: string;
  /**
   * Live readout template. `{round}` (round number), `{happy}` (percentage of
   * occupied agents that are happy) and `{seg}` (segregation index, 0–100) are
   * replaced.
   */
  readoutTemplate?: string;
  /** Legend label for group A (rendered in the accent colour). Defaults to `'Group A'`. */
  typeALabel?: string;
  /** Legend label for group B (rendered in the brand colour). Defaults to `'Group B'`. */
  typeBLabel?: string;
  /** Legend label for empty cells. Defaults to `'Empty'`. */
  emptyLabel?: string;
  /** Extra classes merged onto the root element. */
  className?: string;
}

/** A deterministic PRNG (mulberry32) so the server and client agree on the
 *  initial board — no hydration flicker. NO `Math.random()` / `Date.now()`. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SEED = 0x5c4e1234;

/** Cell states. `0` empty, `1` group A, `2` group B. */
const EMPTY = 0;
const TYPE_A = 1;
const TYPE_B = 2;
type Cell = typeof EMPTY | typeof TYPE_A | typeof TYPE_B;

/**
 * Build a fresh, deterministic starting board. We fill an array with the right
 * counts of empty / A / B, then Fisher–Yates shuffle it with the seeded PRNG so
 * SSR and hydration produce the identical scatter.
 */
function seedBoard(size: number, emptyFraction: number, rng: () => number): Cell[] {
  const total = size * size;
  const emptyCount = Math.round(total * emptyFraction);
  const occupied = total - emptyCount;
  const aCount = Math.floor(occupied / 2);
  const bCount = occupied - aCount;

  const cells: Cell[] = [];
  for (let i = 0; i < aCount; i += 1) cells.push(TYPE_A);
  for (let i = 0; i < bCount; i += 1) cells.push(TYPE_B);
  for (let i = 0; i < emptyCount; i += 1) cells.push(EMPTY);

  // Fisher–Yates shuffle with the deterministic RNG.
  for (let i = cells.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = cells[i];
    cells[i] = cells[j];
    cells[j] = tmp;
  }
  return cells;
}

/**
 * Count, for the cell at `index`, how many of its occupied Moore-neighbours
 * (the 8 surrounding cells) share its type and how many are occupied in total.
 */
function neighbourCounts(
  board: Cell[],
  size: number,
  index: number,
): { same: number; occupied: number } {
  const row = Math.floor(index / size);
  const col = index % size;
  const self = board[index];
  let same = 0;
  let occupied = 0;
  for (let dr = -1; dr <= 1; dr += 1) {
    for (let dc = -1; dc <= 1; dc += 1) {
      if (dr === 0 && dc === 0) continue;
      const r = row + dr;
      const c = col + dc;
      if (r < 0 || r >= size || c < 0 || c >= size) continue;
      const n = board[r * size + c];
      if (n === EMPTY) continue;
      occupied += 1;
      if (n === self) same += 1;
    }
  }
  return { same, occupied };
}

/** Is the occupied cell at `index` happy under `threshold` (a 0–1 fraction)?
 *  A cell with no occupied neighbours counts as happy. */
function isHappy(board: Cell[], size: number, index: number, threshold: number): boolean {
  const { same, occupied } = neighbourCounts(board, size, index);
  if (occupied === 0) return true;
  return same / occupied >= threshold;
}

/**
 * Run ONE round of the model. Every unhappy agent relocates to a randomly chosen
 * currently-empty cell. We collect all movers and all vacancies up front, then
 * assign movers to a shuffled pool of vacancies — so counts of A / B / empty are
 * conserved exactly. Returns the new board (a fresh array).
 */
function stepBoard(board: Cell[], size: number, threshold: number, rng: () => number): Cell[] {
  const next = board.slice();

  const movers: number[] = [];
  const vacancies: number[] = [];
  for (let i = 0; i < next.length; i += 1) {
    if (next[i] === EMPTY) {
      vacancies.push(i);
    } else if (!isHappy(next, size, i, threshold)) {
      movers.push(i);
    }
  }
  if (movers.length === 0 || vacancies.length === 0) return next;

  // Shuffle the vacancy pool so destinations are unbiased and deterministic.
  for (let i = vacancies.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = vacancies[i];
    vacancies[i] = vacancies[j];
    vacancies[j] = tmp;
  }

  // Move each unhappy agent into the next free vacancy. Once vacancies run out,
  // the remaining movers simply stay put this round (they'll get another chance
  // next round once others have vacated cells).
  let v = 0;
  for (const from of movers) {
    if (v >= vacancies.length) break;
    const to = vacancies[v];
    v += 1;
    next[to] = next[from];
    next[from] = EMPTY;
  }
  return next;
}

/** Aggregate statistics over the whole board: count of happy / occupied agents
 *  and the segregation index (mean same-type-neighbour fraction over occupied
 *  cells; cells with no occupied neighbours contribute 0 so isolated agents
 *  don't inflate the score). */
function boardStats(
  board: Cell[],
  size: number,
  threshold: number,
): { happy: number; occupied: number; seg: number } {
  let happy = 0;
  let occupied = 0;
  let segSum = 0;
  for (let i = 0; i < board.length; i += 1) {
    if (board[i] === EMPTY) continue;
    occupied += 1;
    const { same, occupied: nOcc } = neighbourCounts(board, size, i);
    if (nOcc === 0) {
      happy += 1; // no neighbours → content
    } else {
      segSum += same / nOcc;
      if (same / nOcc >= threshold) happy += 1;
    }
  }
  const seg = occupied ? segSum / occupied : 0;
  return { happy, occupied, seg };
}

/**
 * Interactive **Schelling segregation model** — the canonical demonstration that
 * a *mild* individual preference produces *stark* global segregation, with no
 * one intending it.
 *
 * Every coloured square is an agent of one of two groups; grey squares are empty
 * lots. Each agent follows one tiny local rule: *"I'm happy as long as at least
 * X% of my neighbours are my own type"* — set X with the slider. Press **Step**
 * and every unhappy agent hops to a random empty lot; press **Settle** to repeat
 * until everyone's content (or the round cap). The shock is the macro pattern:
 * even at a tolerant `33%` ("I just don't want to be a small minority"), the
 * board sorts itself into big single-colour blocks and the segregation index
 * climbs toward 70–85%. Nobody wanted segregation; the algorithm produced it
 * anyway. That gap between mild local rules and a stark global pattern is
 * *emergence*.
 *
 * The grid is decorative for screen readers — all meaning lives in the
 * `aria-live` readout (round number + % happy + segregation index). Cell colours
 * transition gently, and instantly under `prefers-reduced-motion`. Fully
 * keyboard-operable (slider + buttons). Never auto-runs on mount.
 */
export function SchellingGrid({
  size = 15,
  emptyFraction = 0.1,
  initialTolerance = 33,
  maxRounds = 60,
  title,
  eyebrow = 'Local rules, global pattern',
  instructions = 'Every square is someone who just wants at least a fraction of their neighbours to share their group — set that fraction below. Step the simulation and watch unhappy agents relocate. Nobody wants segregation, yet a mild preference still tips the whole board into stark blocks.',
  caption,
  toleranceLabel = 'Wants at least … similar neighbours',
  stepLabel = 'Step ▸',
  runLabel = 'Settle ▸',
  pauseLabel = 'Pause',
  resetLabel = 'Reset',
  roundLabel = 'Round',
  readoutTemplate = '{round}: {happy}% of agents are happy; segregation index {seg}/100.',
  typeALabel = 'Group A',
  typeBLabel = 'Group B',
  emptyLabel = 'Empty',
  className,
}: SchellingGridProps) {
  if (!Number.isFinite(size) || size < 3) {
    throw new Error('SchellingGrid: `size` must be at least 3.');
  }

  const reactId = useId();
  const clampPct = (n: number) => Math.max(0, Math.min(100, Math.round(n)));
  const clampedEmpty = Math.max(0, Math.min(0.9, emptyFraction));

  // A deterministic starting board (seeded) keeps SSR and hydration in sync.
  const initialBoard = useMemo(
    () => seedBoard(size, clampedEmpty, mulberry32(SEED)),
    [size, clampedEmpty],
  );
  const [board, setBoard] = useState<Cell[]>(initialBoard);
  const [round, setRound] = useState(0);
  const [tolerance, setTolerance] = useState(() => clampPct(initialTolerance));
  const [running, setRunning] = useState(false);

  // A live RNG for the stochastic relocation — fresh per mount, reseeded on reset.
  const rng = useRef<() => number>(mulberry32(SEED ^ 0x9e3779b9));
  // Latest tolerance/round, read inside the interval without re-subscribing.
  const toleranceRef = useRef(tolerance);
  toleranceRef.current = tolerance;
  const roundRef = useRef(round);
  roundRef.current = round;

  const threshold = tolerance / 100;

  const step = () => {
    setBoard((prev) => stepBoard(prev, size, toleranceRef.current / 100, rng.current));
    setRound((r) => r + 1);
  };

  const reset = () => {
    setRunning(false);
    rng.current = mulberry32(SEED ^ 0x9e3779b9);
    setBoard(seedBoard(size, clampedEmpty, mulberry32(SEED)));
    setRound(0);
  };

  // Latest board, read inside the interval without re-subscribing.
  const boardRef = useRef(board);
  boardRef.current = board;

  // Auto-settle loop: steps on an interval while `running`, stopping when no
  // agent is unhappy or the round cap is hit. Cleared on pause/unmount. The
  // stop decision is made from refs (outside any state updater) so the state
  // setters stay pure and StrictMode-safe.
  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      const current = boardRef.current;
      const t = toleranceRef.current / 100;
      const anyUnhappy = current.some(
        (c, i) => c !== EMPTY && !isHappy(current, size, i, t),
      );
      if (!anyUnhappy || roundRef.current >= maxRounds) {
        setRunning(false);
        return;
      }
      setBoard((prev) => stepBoard(prev, size, t, rng.current));
      setRound((r) => r + 1);
    }, 350);
    return () => window.clearInterval(id);
  }, [running, size, maxRounds]);

  const { happy, occupied, seg } = boardStats(board, size, threshold);
  const happyPct = occupied ? Math.round((happy / occupied) * 100) : 100;
  const segPct = Math.round(seg * 100);

  const readout = readoutTemplate
    .replace('{round}', `${roundLabel} ${round}`)
    .replace('{happy}', String(happyPct))
    .replace('{seg}', String(segPct));

  return (
    <figure className={cx('brutal my-6 bg-surface p-5 sm:p-6', className)}>
      <p className="font-display text-xs font-semibold uppercase tracking-wide text-accent-600">
        {eyebrow}
      </p>
      {title ? (
        <p className="mt-1 font-display text-lg font-semibold text-ink-900">{title}</p>
      ) : null}

      <p className="mt-2 text-sm font-medium text-ink-700">{instructions}</p>

      {/* The board. Decorative — meaning lives in the live readout. */}
      <div
        aria-hidden
        className="mt-4 grid gap-0.5"
        style={{
          gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))`,
          maxWidth: `${size * 1.4}rem`,
        }}
      >
        {board.map((c, i) => (
          <span
            key={`${reactId}-cell-${i}`}
            className={cx(
              'aspect-square rounded-sm transition-colors duration-300 motion-reduce:transition-none',
              c === TYPE_A && 'bg-accent-500',
              c === TYPE_B && 'bg-brand-500',
              c === EMPTY && 'bg-surface-sunken ring-1 ring-inset ring-ink-900/5',
            )}
          />
        ))}
      </div>

      {/* Legend */}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[0.7rem] font-semibold text-ink-600">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="size-3 rounded-sm bg-accent-500" />
          {typeALabel}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="size-3 rounded-sm bg-brand-500" />
          {typeBLabel}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span
            aria-hidden
            className="size-3 rounded-sm bg-surface-sunken ring-1 ring-inset ring-ink-900/10"
          />
          {emptyLabel}
        </span>
      </div>

      {/* Live readout */}
      <p aria-live="polite" className="mt-4 font-display text-base font-semibold text-ink-900">
        {readout}
      </p>

      {/* Tolerance slider */}
      <div className="mt-3">
        <div className="flex items-center justify-between text-[0.65rem] font-bold uppercase tracking-wide text-ink-500">
          <label htmlFor={`${reactId}-tolerance`}>{toleranceLabel}</label>
          <span>{tolerance}%</span>
        </div>
        <input
          id={`${reactId}-tolerance`}
          type="range"
          min={0}
          max={100}
          step={1}
          value={tolerance}
          onChange={(e) => setTolerance(clampPct(Number(e.target.value)))}
          aria-valuetext={`${tolerance}%`}
          className="mt-1 h-1.5 w-full cursor-pointer accent-accent-500"
        />
      </div>

      {/* Controls */}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={step}
          disabled={running}
          className="brutal-btn bg-accent-500 px-4 py-2 font-display text-sm text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {stepLabel}
        </button>
        <button
          type="button"
          onClick={() => setRunning((r) => !r)}
          className="brutal-btn bg-brand-500 px-4 py-2 font-display text-sm text-white"
        >
          {running ? pauseLabel : runLabel}
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

export default SchellingGrid;
