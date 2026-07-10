import { useId, useMemo, useState } from 'react';
import { cx } from '@/components/react/cx';

/**
 * A search strategy: a fixed order in which the strategy opens the cells looking
 * for the hidden prize. `order` is a permutation of the cell indices
 * `0…cells-1`. English default names ship below — translated lessons MUST pass a
 * localized `strategies` prop.
 */
export interface NoFreeLunchStrategy {
  /** Display name, e.g. `'Left → right'`. */
  name: string;
  /** One-line description of how this strategy searches. */
  blurb: string;
  /** The fixed order the strategy opens cells in (a permutation of 0…cells-1). */
  order: number[];
}

/** Props for the {@link NoFreeLunchBoard} island. */
export interface NoFreeLunchBoardProps {
  /** Heading above the card. */
  title?: string;
  /** Eyebrow label. Defaults to `'No free lunch'`. */
  eyebrow?: string;
  /** Instruction line above the board. */
  instructions?: string;
  /** Caption beneath the card. */
  caption?: string;
  /**
   * The competing strategies. Each `order` must be a permutation of
   * `0…cells-1`; every strategy is best on some worlds and worst on others, yet
   * all average the same number of steps across the full set of worlds.
   * English defaults — translate for other locales.
   */
  strategies?: NoFreeLunchStrategy[];
  /** How many cells (and, equivalently, how many worlds) there are. Defaults to `6`. */
  cells?: number;
  /** Template for a world's label. `{n}` → the world number. Defaults to `'World {n}'`. */
  worldLabelTemplate?: string;
  /** Label under the board strip. Defaults to `'Where the prize is hidden'`. */
  worldsHeading?: string;
  /** Column header for the running average. Defaults to `'Average steps'`. */
  averageHeading?: string;
  /** Column header for the most-recent world's cost. Defaults to `'This world'`. */
  thisWorldHeading?: string;
  /** Short unit word for a single search step. Defaults to `'steps'`. */
  stepsWord?: string;
  /** Reveal-one-more-world button. Defaults to `'Reveal next world'`. */
  nextLabel?: string;
  /** Reveal-all-worlds button. Defaults to `'Run every world'`. */
  runLabel?: string;
  /** Reset button. Defaults to `'Reset'`. */
  resetLabel?: string;
  /** Prompt shown before any world is revealed. */
  emptyHint?: string;
  /**
   * Readout while worlds are still being revealed. Placeholders: `{done}`
   * worlds revealed, `{total}` worlds in all, `{leader}` current best
   * strategy's name, `{leaderAvg}` its running average, `{spread}` gap between
   * the best and worst running averages.
   */
  progressTemplate?: string;
  /**
   * Readout once every world is revealed. Placeholders: `{total}` worlds,
   * `{avg}` the single average every strategy converged to.
   */
  tieTemplate?: string;
  /** Extra classes merged onto the root element. */
  className?: string;
}

const DEFAULT_STRATEGIES: NoFreeLunchStrategy[] = [
  {
    name: 'Left → right',
    blurb: 'Always open cells in order, from the first to the last.',
    order: [0, 1, 2, 3, 4, 5],
  },
  {
    name: 'Right → left',
    blurb: 'The mirror image — start at the last cell and work back.',
    order: [5, 4, 3, 2, 1, 0],
  },
  {
    name: 'Edges → middle',
    blurb: 'Check the outer cells first, close in on the centre last.',
    order: [0, 5, 1, 4, 2, 3],
  },
  {
    name: 'Clever hunch',
    blurb: 'A “smart”, hand-tuned order that just looks cannier than the rest.',
    order: [2, 0, 4, 1, 5, 3],
  },
];

/**
 * **No-Free-Lunch board** — makes the theorem tangible with a tiny treasure
 * hunt. A prize is hidden in one of N cells; a *world* is one hiding place, and
 * we sweep through **all** of them (the prize sits in each cell exactly once).
 * A *strategy* is a fixed order in which you open cells; its cost on a world is
 * how many cells you open before you hit the prize.
 *
 * The learner reveals worlds one at a time and watches each strategy's
 * **running average** cost. Early on the averages are wildly different — a
 * strategy that opens cell 0 first looks brilliant on the world where the prize
 * is there and terrible on the world where it is last. But because every world
 * is visited, each strategy is best exactly as often as it is worst, and the
 * running averages all **converge to the same number** — `(N+1)/2`. Clever
 * orders and lazy orders tie. That convergence *is* the No Free Lunch theorem:
 * averaged over every possible problem, no search strategy beats another.
 *
 * Fully deterministic (no randomness), so the server render is stable and there
 * is no autoplaying motion to fight `prefers-reduced-motion`.
 */
export function NoFreeLunchBoard({
  title,
  eyebrow = 'No free lunch',
  instructions = 'A prize hides in one cell. Each “world” is a different hiding place — and we visit every one. A strategy’s cost is how many cells it opens before finding the prize. Reveal worlds one by one and watch each strategy’s running average.',
  caption,
  strategies = DEFAULT_STRATEGIES,
  cells = 6,
  worldLabelTemplate = 'World {n}',
  worldsHeading = 'Where the prize is hidden',
  averageHeading = 'Average steps',
  thisWorldHeading = 'This world',
  stepsWord = 'steps',
  nextLabel = 'Reveal next world',
  runLabel = 'Run every world',
  resetLabel = 'Reset',
  emptyHint = 'Press “Reveal next world”. Watch the averages start far apart — then collapse together.',
  progressTemplate = '{done} of {total} worlds revealed. Right now “{leader}” looks best at {leaderAvg} steps, and the strategies are {spread} steps apart. Keep going.',
  tieTemplate = 'All {total} worlds revealed — and every strategy landed on exactly {avg} steps. The clever order and the lazy one tie. That is the No Free Lunch theorem you can see.',
  className,
}: NoFreeLunchBoardProps) {
  const reactId = useId();
  const [done, setDone] = useState(0);

  // The worlds, in reveal order: world k hides the prize in cell k. Sweeping all
  // of them is what makes every strategy's average identical.
  const worlds = useMemo(
    () => Array.from({ length: cells }, (_, k) => k),
    [cells],
  );

  // Cost of a strategy on a world = 1-based position of that world's prize cell
  // in the strategy's opening order.
  const costOf = (strategy: NoFreeLunchStrategy, prizeCell: number) =>
    strategy.order.indexOf(prizeCell) + 1;

  // Running averages after `done` worlds, plus each strategy's cost on the most
  // recently revealed world.
  const stats = useMemo(() => {
    return strategies.map((s) => {
      let sum = 0;
      for (let i = 0; i < done; i++) sum += costOf(s, worlds[i]);
      const avg = done > 0 ? sum / done : 0;
      const last = done > 0 ? costOf(s, worlds[done - 1]) : 0;
      return { name: s.name, blurb: s.blurb, avg, last };
    });
  }, [strategies, worlds, done]);

  const complete = done >= cells;
  const finalAvg = (cells + 1) / 2;

  const avgValues = stats.map((s) => s.avg);
  const bestAvg = done > 0 ? Math.min(...avgValues) : 0;
  const worstAvg = done > 0 ? Math.max(...avgValues) : 0;
  const spread = worstAvg - bestAvg;
  const leader = done > 0 ? stats.reduce((a, b) => (b.avg < a.avg ? b : a)) : stats[0];

  const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2));

  const readout = complete
    ? tieTemplate.replace('{total}', String(cells)).replace('{avg}', fmt(finalAvg))
    : done === 0
      ? emptyHint
      : progressTemplate
          .replace('{done}', String(done))
          .replace('{total}', String(cells))
          .replace('{leader}', leader.name)
          .replace('{leaderAvg}', fmt(leader.avg))
          .replace('{spread}', fmt(spread));

  const currentPrize = done > 0 ? worlds[done - 1] : -1;
  const worldLabel = (n: number) => worldLabelTemplate.replace('{n}', String(n));

  return (
    <figure className={cx('brutal my-6 bg-surface p-5 sm:p-6', className)}>
      <p className="font-display text-xs font-semibold uppercase tracking-wide text-accent-600">
        {eyebrow}
      </p>
      {title ? (
        <p className="mt-1 font-display text-lg font-semibold text-ink-900">{title}</p>
      ) : null}

      <p className="mt-2 text-sm font-medium text-ink-700">{instructions}</p>

      {/* Worlds strip — one tile per world; revealed tiles show the prize cell */}
      <p className="mt-4 text-[0.65rem] font-bold uppercase tracking-wide text-ink-500">
        {worldsHeading}
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        {worlds.map((prizeCell, wi) => {
          const revealed = wi < done;
          const isCurrent = wi === done - 1;
          return (
            <div
              key={wi}
              className={cx(
                'rounded-card border p-1.5',
                revealed ? 'border-ink-200 bg-surface-sunken' : 'border-dashed border-ink-100 opacity-50',
                isCurrent ? 'ring-2 ring-brand-500' : '',
              )}
            >
              <div className="mb-1 text-center text-[0.55rem] font-semibold uppercase tracking-wide text-ink-400">
                {worldLabel(wi + 1)}
              </div>
              <div className="flex gap-0.5">
                {Array.from({ length: cells }, (_, ci) => {
                  const isPrize = revealed && ci === prizeCell;
                  return (
                    <div
                      key={ci}
                      aria-hidden="true"
                      className={cx(
                        'h-4 w-4 rounded-[3px] border',
                        isPrize
                          ? 'border-brand-600 bg-brand-500'
                          : revealed
                            ? 'border-ink-200 bg-surface'
                            : 'border-ink-100 bg-surface',
                      )}
                    >
                      {isPrize ? (
                        <span className="flex h-full w-full items-center justify-center text-[0.5rem] leading-none">
                          ★
                        </span>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Live readout */}
      <p
        aria-live="polite"
        className="mt-4 rounded-card border border-accent-300 bg-accent-300/20 p-3 text-sm leading-relaxed text-ink-700"
      >
        {readout}
      </p>

      {/* Strategy running-average bars */}
      <div className="mt-4 overflow-hidden rounded-card border border-ink-100 bg-surface-sunken p-3">
        <div className="mb-2 flex items-center justify-between text-[0.6rem] font-bold uppercase tracking-wide text-ink-400">
          <span>{averageHeading}</span>
          <span>{thisWorldHeading}</span>
        </div>
        <ul className="space-y-3">
          {stats.map((s, i) => {
            // Bar scaled so the maximum possible average (= cells) fills the track.
            const pct = cells > 0 ? (s.avg / cells) * 100 : 0;
            const isLeader = complete ? false : done > 0 && s.name === leader.name;
            return (
              <li key={i}>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-display text-sm font-semibold text-ink-800">{s.name}</span>
                  <span className="shrink-0 font-mono text-xs text-ink-500">
                    {done > 0 ? `${s.last} ${stepsWord}` : '—'}
                  </span>
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <div className="relative h-3 flex-1 overflow-hidden rounded-full bg-surface">
                    <div
                      className={cx(
                        'h-full rounded-full transition-all duration-300',
                        complete ? 'bg-brand-500' : isLeader ? 'bg-accent-500' : 'bg-brand-400',
                      )}
                      style={{ width: `${Math.max(2, pct)}%` }}
                    />
                  </div>
                  <span className="w-12 shrink-0 text-right font-mono text-sm font-semibold text-ink-900">
                    {done > 0 ? fmt(s.avg) : '—'}
                  </span>
                </div>
                <p className="mt-0.5 text-xs italic text-ink-400">{s.blurb}</p>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Buttons */}
      <div className="mt-5 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setDone((d) => Math.min(cells, d + 1))}
          disabled={complete}
          className="brutal-btn bg-brand-600 px-4 py-2 text-sm text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {nextLabel}
        </button>
        <button
          type="button"
          onClick={() => setDone(cells)}
          disabled={complete}
          className="brutal-btn bg-surface px-4 py-2 text-sm text-ink-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {runLabel}
        </button>
        <button
          type="button"
          onClick={() => setDone(0)}
          className="brutal-btn bg-surface px-4 py-2 text-sm text-ink-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
        >
          {resetLabel}
        </button>
      </div>

      {caption ? <figcaption className="mt-3 text-sm text-ink-500">{caption}</figcaption> : null}
    </figure>
  );
}

export default NoFreeLunchBoard;
