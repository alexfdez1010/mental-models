import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { cx } from '@/components/react/cx';

/** Props for the {@link CriticalMass} island. */
export interface CriticalMassProps {
  /**
   * Side length of the square grid. The board holds `size × size` cells
   * (e.g. `21` → 441 cells). Defaults to `21`.
   */
  size?: number;
  /**
   * Starting amplification factor **k**, as an integer percent of 1 (so `100`
   * means k = 1.00, `140` means k = 1.40). This is the average number of *new*
   * activations each freshly-active cell triggers before it burns out. Below
   * `100` (k < 1) a chain reaction fizzles; above `100` (k > 1) it runs away.
   * The whole point is the sharp change right around `100`. Defaults to `100`.
   */
  initialK?: number;
  /**
   * Maximum amplification the slider allows, in the same integer-percent units.
   * Defaults to `200` (k up to 2.00).
   */
  maxK?: number;
  /**
   * Starting seed density — the percentage of cells that begin active, `0`–`20`.
   * A denser seed makes runaway easier to reach. Defaults to `1` (≈1%).
   */
  initialSeed?: number;
  /**
   * Maximum number of spread steps the auto-run will take before stopping, as a
   * safety cap in case a configuration never settles. Defaults to `120`.
   */
  maxSteps?: number;
  /** Heading above the card. */
  title?: string;
  /** Eyebrow label. Defaults to `'Below the threshold, above the threshold'`. */
  eyebrow?: string;
  /** Instruction line above the grid. */
  instructions?: string;
  /** Caption beneath the card. */
  caption?: string;
  /** Label for the amplification-factor slider. Defaults to `'Amplification factor k (new activations per cell)'`. */
  kLabel?: string;
  /** Label for the seed-density slider. Defaults to `'Starting seed density'`. */
  seedLabel?: string;
  /** Text on the single-step button. Defaults to `'Step ▸'`. */
  stepLabel?: string;
  /** Text on the auto-run button. Defaults to `'Run ▸'`. */
  runLabel?: string;
  /** Text on the button that pauses an in-progress run. Defaults to `'Pause'`. */
  pauseLabel?: string;
  /** Text on the reset button. Defaults to `'Reset'`. */
  resetLabel?: string;
  /** Word for a step, used in the readout. Defaults to `'Step'`. */
  stepWord?: string;
  /**
   * Live readout template. `{step}` (step number), `{active}` (cells currently
   * reacting), `{burned}` (total cells ever activated) and `{share}` (percent of
   * the whole grid ever activated) are replaced.
   */
  readoutTemplate?: string;
  /** Verdict shown once a run settles having barely spread. Defaults to `'Sub-critical — the reaction fizzled out.'`. */
  fizzleVerdict?: string;
  /** Verdict shown once a run settles having swept most of the grid. Defaults to `'Super-critical — the chain reaction ran away.'`. */
  chainVerdict?: string;
  /** Verdict shown once a run settles somewhere in between. Defaults to `'Right at the edge — it spread partway, then stalled.'`. */
  edgeVerdict?: string;
  /** Verdict shown while cells are still reacting. Defaults to `'Reacting…'`. */
  runningVerdict?: string;
  /** Legend label for dormant cells. Defaults to `'Dormant'`. */
  dormantLabel?: string;
  /** Legend label for actively-reacting cells. Defaults to `'Reacting'`. */
  activeLabel?: string;
  /** Legend label for burned-out cells. Defaults to `'Spent'`. */
  spentLabel?: string;
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

const SEED = 0x1f2e3d4c;

/** Cell states. `0` dormant, `1` actively reacting, `2` spent (already fired). */
const DORMANT = 0;
const ACTIVE = 1;
const SPENT = 2;
type Cell = typeof DORMANT | typeof ACTIVE | typeof SPENT;

/**
 * Build a fresh, deterministic starting board: all cells dormant except a
 * scattered seed of active cells. We flag `seedCount` random positions active
 * with the seeded PRNG so SSR and hydration produce the identical board.
 */
function seedBoard(size: number, seedFraction: number, rng: () => number): Cell[] {
  const total = size * size;
  const board: Cell[] = new Array(total).fill(DORMANT);
  // At least one seed, so the demo always has somewhere to start.
  const seedCount = Math.max(1, Math.round(total * seedFraction));
  let placed = 0;
  let guard = 0;
  while (placed < seedCount && guard < total * 8) {
    const idx = Math.floor(rng() * total);
    if (board[idx] === DORMANT) {
      board[idx] = ACTIVE;
      placed += 1;
    }
    guard += 1;
  }
  return board;
}

/**
 * Run ONE step of the chain reaction. Every currently-ACTIVE cell tries to
 * activate each of its four von-Neumann neighbours that is still DORMANT, each
 * with probability `p = k / 4`. Because we always divide by four regardless of
 * how many neighbours a cell actually has, edge cells "leak" — their missing
 * neighbours are activations that escape into nothing, exactly the surface loss
 * that lets a small mass stay sub-critical. Each active cell then becomes SPENT.
 * Neighbour reads come from the CURRENT board so activations within a step don't
 * chain instantly. Returns a fresh array.
 */
function stepBoard(board: Cell[], size: number, k: number, rng: () => number): Cell[] {
  const next = board.slice();
  const p = Math.min(1, k / 4);
  for (let i = 0; i < board.length; i += 1) {
    if (board[i] !== ACTIVE) continue;
    const row = Math.floor(i / size);
    const col = i % size;
    // Four orthogonal neighbours; a missing one (off the edge) is a lost neutron.
    const neighbours = [
      row > 0 ? i - size : -1,
      row < size - 1 ? i + size : -1,
      col > 0 ? i - 1 : -1,
      col < size - 1 ? i + 1 : -1,
    ];
    for (const n of neighbours) {
      if (n < 0) continue;
      if (board[n] === DORMANT && rng() < p) next[n] = ACTIVE;
    }
    next[i] = SPENT;
  }
  return next;
}

/** Count cells by state in one pass. */
function tally(board: Cell[]): { active: number; spent: number } {
  let active = 0;
  let spent = 0;
  for (let i = 0; i < board.length; i += 1) {
    if (board[i] === ACTIVE) active += 1;
    else if (board[i] === SPENT) spent += 1;
  }
  return { active, spent };
}

/**
 * Interactive **critical mass / tipping-point** simulator — the cleanest way to
 * *feel* a threshold. Each cell is a bit of fuel; a scattered seed starts hot.
 * Every reacting cell fires at its dormant neighbours with probability `k / 4`,
 * so on average it triggers **k** new reactions before burning out. Push the
 * `k` slider below `1.00` and the reaction dies within a few steps no matter
 * how you seed it; nudge it past `1.00` and the same board erupts and sweeps
 * edge to edge. The learner hunts for the tipping point and watches a smooth
 * knob produce a sudden phase change.
 *
 * The grid is decorative for screen readers — all meaning lives in the
 * `aria-live` readout (step, cells reacting, total activated, share, verdict).
 * Cells transition gently and instantly under `prefers-reduced-motion`. Fully
 * keyboard-operable (sliders + buttons). Never auto-runs on mount.
 */
export function CriticalMass({
  size = 21,
  initialK = 100,
  maxK = 200,
  initialSeed = 1,
  maxSteps = 120,
  title,
  eyebrow = 'Below the threshold, above the threshold',
  instructions = 'Each square is a scrap of fuel; the coloured ones start the reaction. A reacting cell fires at its neighbours, triggering on average k new reactions before it burns out. Set k below, then step or run — hunt for the tipping point where “fizzles” flips to “runs away”.',
  caption,
  kLabel = 'Amplification factor k (new activations per cell)',
  seedLabel = 'Starting seed density',
  stepLabel = 'Step ▸',
  runLabel = 'Run ▸',
  pauseLabel = 'Pause',
  resetLabel = 'Reset',
  stepWord = 'Step',
  readoutTemplate = '{step}: {active} cells reacting now; {burned} ever activated ({share}% of the grid).',
  fizzleVerdict = 'Sub-critical — the reaction fizzled out.',
  chainVerdict = 'Super-critical — the chain reaction ran away.',
  edgeVerdict = 'Right at the edge — it spread partway, then stalled.',
  runningVerdict = 'Reacting…',
  dormantLabel = 'Dormant',
  activeLabel = 'Reacting',
  spentLabel = 'Spent',
  className,
}: CriticalMassProps) {
  if (!Number.isFinite(size) || size < 3) {
    throw new Error('CriticalMass: `size` must be at least 3.');
  }

  const reactId = useId();
  const clampK = (n: number) => Math.max(0, Math.min(maxK, Math.round(n)));
  const clampSeed = (n: number) => Math.max(0, Math.min(20, Math.round(n)));

  const [k, setK] = useState(() => clampK(initialK));
  const [seed, setSeed] = useState(() => clampSeed(initialSeed));
  const seedFraction = seed / 100;

  // Deterministic starting board keeps SSR and hydration in sync.
  const initialBoard = useMemo(
    () => seedBoard(size, seedFraction, mulberry32(SEED)),
    [size, seedFraction],
  );
  const [board, setBoard] = useState<Cell[]>(initialBoard);
  const [step, setStep] = useState(0);
  const [running, setRunning] = useState(false);

  // A live RNG for the stochastic spread — fresh per mount, reseeded on reset.
  const rng = useRef<() => number>(mulberry32(SEED ^ 0x9e3779b9));

  // Latest values, read inside the interval without re-subscribing.
  const kRef = useRef(k);
  kRef.current = k;
  const boardRef = useRef(board);
  boardRef.current = board;
  const stepRef = useRef(step);
  stepRef.current = step;

  const doStep = () => {
    setBoard((prev) => stepBoard(prev, size, kRef.current / 100, rng.current));
    setStep((s) => s + 1);
  };

  const reset = (nextSeedFraction = seedFraction) => {
    setRunning(false);
    rng.current = mulberry32(SEED ^ 0x9e3779b9);
    setBoard(seedBoard(size, nextSeedFraction, mulberry32(SEED)));
    setStep(0);
  };

  // Changing the seed density re-lays a fresh board (and stops any run) so the
  // slider is a genuine "new experiment" control, not a mid-reaction edit.
  const onSeedChange = (raw: number) => {
    const next = clampSeed(raw);
    setSeed(next);
    reset(next / 100);
  };

  // Auto-run loop: steps on an interval while `running`, stopping when no cell
  // is reacting or the step cap is hit. The stop decision is made from refs
  // (outside any state updater) so the setters stay pure and StrictMode-safe.
  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      const current = boardRef.current;
      const anyActive = current.some((c) => c === ACTIVE);
      if (!anyActive || stepRef.current >= maxSteps) {
        setRunning(false);
        return;
      }
      setBoard((prev) => stepBoard(prev, size, kRef.current / 100, rng.current));
      setStep((s) => s + 1);
    }, 240);
    return () => window.clearInterval(id);
  }, [running, size, maxSteps]);

  const { active, spent } = tally(board);
  const burned = active + spent;
  const total = size * size;
  const sharePct = Math.round((burned / total) * 100);

  // Verdict: while anything is reacting, it's still running; once it settles,
  // classify by how much of the grid ever caught.
  let verdict = runningVerdict;
  if (active === 0 && step > 0) {
    if (sharePct >= 55) verdict = chainVerdict;
    else if (sharePct <= 15) verdict = fizzleVerdict;
    else verdict = edgeVerdict;
  } else if (active === 0 && step === 0) {
    verdict = '';
  }

  const readout = readoutTemplate
    .replace('{step}', `${stepWord} ${step}`)
    .replace('{active}', String(active))
    .replace('{burned}', String(burned))
    .replace('{share}', String(sharePct));

  const kDisplay = (k / 100).toFixed(2);

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
          maxWidth: `${size * 1.15}rem`,
        }}
      >
        {board.map((c, i) => (
          <span
            key={`${reactId}-cell-${i}`}
            className={cx(
              'aspect-square rounded-[2px] transition-colors duration-200 motion-reduce:transition-none',
              c === DORMANT && 'bg-surface-sunken ring-1 ring-inset ring-ink-900/5',
              c === ACTIVE && 'bg-accent-500 animate-pulse motion-reduce:animate-none',
              c === SPENT && 'bg-brand-500/60',
            )}
          />
        ))}
      </div>

      {/* Legend */}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[0.7rem] font-semibold text-ink-600">
        <span className="inline-flex items-center gap-1.5">
          <span
            aria-hidden
            className="size-3 rounded-[2px] bg-surface-sunken ring-1 ring-inset ring-ink-900/10"
          />
          {dormantLabel}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="size-3 rounded-[2px] bg-accent-500" />
          {activeLabel}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="size-3 rounded-[2px] bg-brand-500/60" />
          {spentLabel}
        </span>
      </div>

      {/* Live readout + verdict */}
      <p aria-live="polite" className="mt-4 font-display text-base font-semibold text-ink-900">
        {readout}
        {verdict ? (
          <>
            {' '}
            <span
              className={cx(
                verdict === chainVerdict && 'text-accent-600',
                verdict === fizzleVerdict && 'text-ink-500',
              )}
            >
              {verdict}
            </span>
          </>
        ) : null}
      </p>

      {/* Amplification slider */}
      <div className="mt-3">
        <div className="flex items-center justify-between text-[0.65rem] font-bold uppercase tracking-wide text-ink-500">
          <label htmlFor={`${reactId}-k`}>{kLabel}</label>
          <span>k = {kDisplay}×</span>
        </div>
        <input
          id={`${reactId}-k`}
          type="range"
          min={0}
          max={maxK}
          step={5}
          value={k}
          onChange={(e) => setK(clampK(Number(e.target.value)))}
          aria-valuetext={`k equals ${kDisplay}`}
          className="mt-1 h-1.5 w-full cursor-pointer accent-accent-500"
        />
      </div>

      {/* Seed-density slider */}
      <div className="mt-3">
        <div className="flex items-center justify-between text-[0.65rem] font-bold uppercase tracking-wide text-ink-500">
          <label htmlFor={`${reactId}-seed`}>{seedLabel}</label>
          <span>{seed}%</span>
        </div>
        <input
          id={`${reactId}-seed`}
          type="range"
          min={0}
          max={20}
          step={1}
          value={seed}
          onChange={(e) => onSeedChange(Number(e.target.value))}
          aria-valuetext={`${seed}%`}
          className="mt-1 h-1.5 w-full cursor-pointer accent-accent-500"
        />
      </div>

      {/* Controls */}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={doStep}
          disabled={running || active === 0}
          className="brutal-btn bg-accent-500 px-4 py-2 font-display text-sm text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {stepLabel}
        </button>
        <button
          type="button"
          onClick={() => setRunning((r) => !r)}
          disabled={!running && active === 0}
          className="brutal-btn bg-brand-500 px-4 py-2 font-display text-sm text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {running ? pauseLabel : runLabel}
        </button>
        <button
          type="button"
          onClick={() => reset()}
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

export default CriticalMass;
