import { useId, useMemo, useState } from 'react';
import { cx } from '@/components/react/cx';

/** A single cell's payoffs: what the row player and the column player each get. */
export interface PayoffCell {
  /** Payoff to the **row** player when this cell is reached. */
  row: number;
  /** Payoff to the **column** player when this cell is reached. */
  col: number;
}

/** A 2×2 grid of payoff cells, indexed `[rowStrategy][colStrategy]`. */
export type PayoffGrid = [[PayoffCell, PayoffCell], [PayoffCell, PayoffCell]];

/** Props for the {@link PayoffMatrix} island. */
export interface PayoffMatrixProps {
  /** Heading above the card. */
  title?: string;
  /** Eyebrow label. Defaults to `'Payoff matrix'`. */
  eyebrow?: string;
  /** Instruction line above the grid. */
  instructions?: string;
  /** Caption beneath the card. */
  caption?: string;
  /** Name of the player who picks a **row** (e.g. `'You'`). */
  rowPlayer: string;
  /** Name of the player who picks a **column** (e.g. `'Rival'`). */
  colPlayer: string;
  /** The two strategy labels available to the row player. */
  rowStrategies: [string, string];
  /** The two strategy labels available to the column player. */
  colStrategies: [string, string];
  /** Starting payoffs, `[rowStrategy][colStrategy]` → `{ row, col }`. */
  payoffs: PayoffGrid;
  /** Whether the learner can nudge the payoffs with ± steppers. Defaults to `true`. */
  editable?: boolean;
  /** Lowest payoff a stepper allows. Defaults to `-5`. */
  min?: number;
  /** Highest payoff a stepper allows. Defaults to `10`. */
  max?: number;
  /** Stepper increment. Defaults to `1`. */
  step?: number;
  /** Symbol shown with each payoff (e.g. `' pts'`, `'$'`). Optional. */
  unit?: string;
  /** Where the unit sits. Defaults to `'suffix'`. */
  unitPosition?: 'prefix' | 'suffix';
  /** Heading over the results panel. Defaults to `'What the matrix says'`. */
  analysisLabel?: string;
  /**
   * One line per player describing their dominant strategy. `{player}` and
   * `{strategy}` are replaced. Defaults to `'{player} — dominant strategy: {strategy}'`.
   */
  dominantLineTemplate?: string;
  /** Shown in place of `{strategy}` when a player has no dominant strategy. Defaults to `'none'`. */
  noneLabel?: string;
  /** Label before the listed Nash cells. Defaults to `'Nash equilibrium (pure):'`. */
  nashLabel?: string;
  /** Shown when there is no pure-strategy Nash equilibrium. Defaults to `'none in pure strategies'`. */
  noNashLabel?: string;
  /** Legend text explaining the best-response highlight. */
  bestResponseLegend?: string;
  /** Tiny badge placed on a Nash cell. Defaults to `'NE'`. */
  nashBadge?: string;
  /** Label of the reset button. Defaults to `'Reset payoffs'`. */
  resetLabel?: string;
  /** Accessible verb for the “increase” stepper. Defaults to `'increase'`. */
  increaseLabel?: string;
  /** Accessible verb for the “decrease” stepper. Defaults to `'decrease'`. */
  decreaseLabel?: string;
  /** Extra classes merged onto the root element. */
  className?: string;
}

function fmt(value: number, unit = '', position: 'prefix' | 'suffix' = 'suffix'): string {
  const rounded = Math.round(value * 100) / 100;
  const text = rounded.toLocaleString('en-US', { maximumFractionDigits: 2 });
  if (!unit) return text;
  return position === 'prefix' ? `${unit}${text}` : `${text}${unit}`;
}

/** Indices (0/1) of the row strategies that are a best response to column `c`. */
function rowBestResponses(p: PayoffGrid, c: number): number[] {
  const a = p[0][c].row;
  const b = p[1][c].row;
  if (a > b) return [0];
  if (b > a) return [1];
  return [0, 1];
}

/** Indices (0/1) of the column strategies that are a best response to row `r`. */
function colBestResponses(p: PayoffGrid, r: number): number[] {
  const a = p[r][0].col;
  const b = p[r][1].col;
  if (a > b) return [0];
  if (b > a) return [1];
  return [0, 1];
}

/** Index of a strictly dominant row strategy, or `null` if none. */
function dominantRow(p: PayoffGrid): number | null {
  if (p[0][0].row > p[1][0].row && p[0][1].row > p[1][1].row) return 0;
  if (p[1][0].row > p[0][0].row && p[1][1].row > p[0][1].row) return 1;
  return null;
}

/** Index of a strictly dominant column strategy, or `null` if none. */
function dominantCol(p: PayoffGrid): number | null {
  if (p[0][0].col > p[0][1].col && p[1][0].col > p[1][1].col) return 0;
  if (p[0][1].col > p[0][0].col && p[1][1].col > p[1][0].col) return 1;
  return null;
}

const clone = (p: PayoffGrid): PayoffGrid =>
  p.map((rowArr) => rowArr.map((cell) => ({ ...cell }))) as PayoffGrid;

/**
 * Interactive **2×2 payoff matrix** — the workbench of game theory.
 *
 * Two players each choose one of two strategies; every combination lands in a
 * cell holding *both* players' payoffs. The learner can nudge any payoff with ±
 * steppers and the island recomputes, live, three things the prose can only
 * assert: each player's **best response** to the other (marked with a ring),
 * any **dominant strategy** (a move that beats its alternative no matter what
 * the rival does), and the **Nash equilibrium** — the cell(s) where neither
 * player can do better by switching alone, drawn with a highlighted outline and
 * an "NE" badge. Editing the famous prisoner's-dilemma numbers until the trap
 * dissolves is the fastest way to *feel* why the equilibrium sits where it does.
 *
 * The grid is a real `<table>` with header cells, every stepper has an
 * accessible label, and the analysis panel is announced via `aria-live`, so the
 * full result is available without seeing the colour. Rings and outlines fade
 * gently and instantly under `prefers-reduced-motion`. Never animates on mount.
 */
export function PayoffMatrix({
  title,
  eyebrow = 'Payoff matrix',
  instructions = 'Each cell shows what both players get. Nudge any payoff and watch the best responses, dominant strategies, and the Nash equilibrium update live.',
  caption,
  rowPlayer,
  colPlayer,
  rowStrategies,
  colStrategies,
  payoffs,
  editable = true,
  min = -5,
  max = 10,
  step = 1,
  unit = '',
  unitPosition = 'suffix',
  analysisLabel = 'What the matrix says',
  dominantLineTemplate = '{player} — dominant strategy: {strategy}',
  noneLabel = 'none',
  nashLabel = 'Nash equilibrium (pure):',
  noNashLabel = 'none in pure strategies',
  bestResponseLegend = 'A ringed payoff is that player’s best response to the rival’s choice. A cell where both are ringed is a Nash equilibrium.',
  nashBadge = 'NE',
  resetLabel = 'Reset payoffs',
  increaseLabel = 'increase',
  decreaseLabel = 'decrease',
  className,
}: PayoffMatrixProps) {
  const reactId = useId();
  const [grid, setGrid] = useState<PayoffGrid>(() => clone(payoffs));

  const clamp = (n: number) => Math.max(min, Math.min(max, n));
  const bump = (r: number, c: number, who: 'row' | 'col', delta: number) =>
    setGrid((prev) => {
      const next = clone(prev);
      next[r][c][who] = clamp(next[r][c][who] + delta);
      return next;
    });
  const reset = () => setGrid(clone(payoffs));

  const { domRow, domCol, nashCells, rowBest, colBest } = useMemo(() => {
    const rb = [rowBestResponses(grid, 0), rowBestResponses(grid, 1)]; // index by column
    const cb = [colBestResponses(grid, 0), colBestResponses(grid, 1)]; // index by row
    const cells: Array<[number, number]> = [];
    for (let r = 0; r < 2; r += 1) {
      for (let c = 0; c < 2; c += 1) {
        if (rb[c].includes(r) && cb[r].includes(c)) cells.push([r, c] as [number, number]);
      }
    }
    return {
      domRow: dominantRow(grid),
      domCol: dominantCol(grid),
      nashCells: cells,
      rowBest: rb,
      colBest: cb,
    };
  }, [grid]);

  const isNash = (r: number, c: number) =>
    nashCells.some(([nr, nc]) => nr === r && nc === c);

  const dominantLine = (player: string, idx: number | null, labels: [string, string]) =>
    dominantLineTemplate
      .replace('{player}', player)
      .replace('{strategy}', idx == null ? noneLabel : labels[idx]);

  const nashText =
    nashCells.length === 0
      ? noNashLabel
      : nashCells
          .map(([r, c]) => `(${rowStrategies[r]}, ${colStrategies[c]})`)
          .join('  ·  ');

  // A single payoff number with optional ± steppers and best-response ring.
  const Payoff = ({
    r,
    c,
    who,
    ringed,
  }: {
    r: number;
    c: number;
    who: 'row' | 'col';
    ringed: boolean;
  }) => {
    const value = grid[r][c][who];
    const tint = who === 'row' ? 'text-brand-700' : 'text-accent-600';
    const stratLabel = who === 'row' ? rowStrategies[r] : colStrategies[c];
    const playerName = who === 'row' ? rowPlayer : colPlayer;
    return (
      <span className="inline-flex flex-col items-center gap-1">
        <span
          className={cx(
            'inline-flex min-w-[2.1rem] justify-center rounded-pill px-1.5 py-0.5 font-mono text-sm font-bold tabular-nums transition-shadow duration-200 motion-reduce:transition-none',
            tint,
            ringed && 'ring-2 ring-inset ring-success bg-success/10',
          )}
        >
          {fmt(value, unit, unitPosition)}
        </span>
        {editable ? (
          <span className="inline-flex items-center gap-1">
            <button
              type="button"
              onClick={() => bump(r, c, who, -step)}
              aria-label={`${decreaseLabel} ${playerName} ${stratLabel}`}
              className="flex size-5 items-center justify-center rounded-pill text-xs font-bold text-ink-500 ring-1 ring-inset ring-ink-300 transition-colors hover:bg-surface-sunken focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-600 motion-reduce:transition-none"
            >
              −
            </button>
            <button
              type="button"
              onClick={() => bump(r, c, who, step)}
              aria-label={`${increaseLabel} ${playerName} ${stratLabel}`}
              className="flex size-5 items-center justify-center rounded-pill text-xs font-bold text-ink-500 ring-1 ring-inset ring-ink-300 transition-colors hover:bg-surface-sunken focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-600 motion-reduce:transition-none"
            >
              +
            </button>
          </span>
        ) : null}
      </span>
    );
  };

  return (
    <figure className={cx('brutal my-6 bg-surface p-5 sm:p-6', className)}>
      <p className="font-display text-xs font-semibold uppercase tracking-wide text-brand-600">
        {eyebrow}
      </p>
      {title ? (
        <p className="mt-1 font-display text-lg font-semibold text-ink-900">{title}</p>
      ) : null}

      <p className="mt-2 text-sm font-medium text-ink-700">{instructions}</p>

      {/* Legend: which colour belongs to which player */}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[0.7rem] font-semibold">
        <span className="inline-flex items-center gap-1.5 text-brand-700">
          <span aria-hidden className="size-2.5 rounded-pill bg-brand-500" />
          {rowPlayer}
        </span>
        <span className="inline-flex items-center gap-1.5 text-accent-600">
          <span aria-hidden className="size-2.5 rounded-pill bg-accent-500" />
          {colPlayer}
        </span>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full border-collapse text-center">
          <caption className="sr-only">
            {rowPlayer} chooses a row; {colPlayer} chooses a column. Each cell lists the
            row payoff then the column payoff.
          </caption>
          <thead>
            <tr>
              <th className="p-1" />
              <th
                colSpan={2}
                scope="colgroup"
                className="pb-1 font-display text-xs font-semibold uppercase tracking-wide text-accent-600"
              >
                {colPlayer}
              </th>
            </tr>
            <tr>
              <th className="p-1" />
              {colStrategies.map((s, c) => (
                <th
                  key={`${reactId}-ch-${c}`}
                  scope="col"
                  className="border-b-2 border-ink-200 px-2 pb-2 font-display text-sm font-semibold text-ink-800"
                >
                  {s}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rowStrategies.map((rs, r) => (
              <tr key={`${reactId}-row-${r}`}>
                <th
                  scope="row"
                  className="border-r-2 border-ink-200 px-2 py-2 text-left align-middle font-display text-sm font-semibold text-ink-800"
                >
                  <span className="block text-[0.6rem] font-bold uppercase tracking-wide text-brand-600">
                    {r === 0 ? rowPlayer : ' '}
                  </span>
                  {rs}
                </th>
                {colStrategies.map((_, c) => (
                  <td
                    key={`${reactId}-cell-${r}-${c}`}
                    className={cx(
                      'relative border border-ink-100 p-2 align-middle transition-colors duration-200 motion-reduce:transition-none',
                      isNash(r, c) ? 'bg-success/5 ring-2 ring-inset ring-success/70' : 'bg-surface-sunken/40',
                    )}
                  >
                    {isNash(r, c) ? (
                      <span className="absolute right-1 top-1 rounded-pill bg-success px-1.5 py-0.5 text-[0.55rem] font-bold uppercase leading-none text-white">
                        {nashBadge}
                      </span>
                    ) : null}
                    <span className="flex items-center justify-center gap-1.5">
                      <Payoff r={r} c={c} who="row" ringed={rowBest[c].includes(r)} />
                      <span aria-hidden className="text-ink-300">/</span>
                      <Payoff r={r} c={c} who="col" ringed={colBest[r].includes(c)} />
                    </span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-2 text-xs leading-snug text-ink-500">{bestResponseLegend}</p>

      {/* Live analysis */}
      <div
        aria-live="polite"
        className="mt-4 rounded-card border-2 border-ink-200 bg-surface-sunken p-4 text-sm"
      >
        <p className="text-[0.65rem] font-bold uppercase tracking-wide text-ink-500">
          {analysisLabel}
        </p>
        <p className="mt-2 text-ink-800">
          {dominantLine(rowPlayer, domRow, rowStrategies)}
        </p>
        <p className="mt-1 text-ink-800">
          {dominantLine(colPlayer, domCol, colStrategies)}
        </p>
        <p className="mt-2 font-semibold text-ink-900">
          {nashLabel}{' '}
          <span className={cx(nashCells.length === 0 ? 'text-warning' : 'text-success')}>
            {nashText}
          </span>
        </p>
      </div>

      {editable ? (
        <button
          type="button"
          onClick={reset}
          className="brutal-btn mt-4 bg-surface px-4 py-2 text-sm text-ink-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
        >
          {resetLabel}
        </button>
      ) : null}

      {caption ? (
        <figcaption className="mt-3 text-sm text-ink-500">{caption}</figcaption>
      ) : null}
    </figure>
  );
}

export default PayoffMatrix;
