import { useId, useMemo, useState } from 'react';
import { cx } from '@/components/react/cx';

/** Props for the {@link CutAndChoose} island. */
export interface CutAndChooseProps {
  /** Heading above the card. */
  title?: string;
  /** Eyebrow label. Defaults to `'Fair division'`. */
  eyebrow?: string;
  /** Instruction line above the diagram. */
  instructions?: string;
  /** Caption beneath the card. */
  caption?: string;
  /** Label naming the person who cuts (and is the learner). Defaults to `'Cutter (you)'`. */
  cutterLabel?: string;
  /** Label naming the person who chooses. Defaults to `'Chooser'`. */
  chooserLabel?: string;
  /** Label over the cut slider. Defaults to `'Where you cut the cake'`. */
  cutLabel?: string;
  /** Label for the left piece. Defaults to `'Left piece'`. */
  pieceALabel?: string;
  /** Label for the right piece. Defaults to `'Right piece'`. */
  pieceBLabel?: string;
  /** Label above the "chooser takes" stat bar. Defaults to `'Chooser takes'`. */
  chooserTakesLabel?: string;
  /** Label above the "you keep" stat bar. Defaults to `'You keep'`. */
  cutterGetsLabel?: string;
  /** Heading of the analysis panel. Defaults to `'What your self-interest does'`. */
  analysisLabel?: string;
  /**
   * Readout template. `{a}`/`{b}`/`{taken}`/`{kept}`/`{verdict}` are replaced.
   */
  readout?: string;
  /** Verdict shown when the cut is within 3 points of a 50/50 split. */
  verdictFair?: string;
  /** Verdict shown when the cut is lopsided. */
  verdictLopsided?: string;
  /** Starting size of the LEFT piece as a percent (1–99). Defaults to `35`. */
  initialCut?: number;
  /** Extra classes merged onto the root element. */
  className?: string;
}

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

/**
 * Interactive **fair-division** island — the classic "I cut, you choose"
 * mechanism made tangible. The learner *is the cutter*: they drag a slider to
 * choose where to slice a cake into a left and a right piece. The **chooser**,
 * assumed perfectly rational and self-interested, always grabs the bigger of the
 * two pieces, leaving the cutter with whatever remains.
 *
 * The point the island teaches is **incentive compatibility**: because the
 * chooser will pounce on any advantage the cutter leaves on the table, the
 * cutter's *own greed* is best served by cutting as close to 50/50 as possible.
 * Cut lopsided and you hand the fat piece straight to the chooser — you only hurt
 * yourself. So a mechanism built on nothing but self-interest produces a fair
 * outcome, with no referee required.
 *
 * The cake bar splits live at the cut, tinting the piece the chooser takes and
 * the piece the cutter keeps in distinct colours with tags, and two stat bars
 * plus an `aria-live` readout and an analysis panel report the split and the
 * verdict (fair / lopsided). The control is a native, keyboard-operable range
 * input with a visible label; motion is a cosmetic tween disabled under
 * `prefers-reduced-motion`.
 */
export function CutAndChoose({
  title,
  eyebrow = 'Fair division',
  instructions = 'You are the cutter. Drag to choose where to slice the cake — then watch: the chooser is rational and always takes the bigger piece, leaving you the rest. See what your own self-interest tells you to do.',
  caption,
  cutterLabel = 'Cutter (you)',
  chooserLabel = 'Chooser',
  cutLabel = 'Where you cut the cake',
  pieceALabel = 'Left piece',
  pieceBLabel = 'Right piece',
  chooserTakesLabel = 'Chooser takes',
  cutterGetsLabel = 'You keep',
  analysisLabel = 'What your self-interest does',
  readout = 'You cut {a}% / {b}%. The chooser rationally grabs the bigger piece ({taken}%), leaving you {kept}%. {verdict}',
  verdictFair = 'You cut it almost exactly in half — and this is the best you can do: whichever piece the chooser takes, you still keep about half. Your own greed pushed you straight to a fair split.',
  verdictLopsided = 'You cut it unevenly, and the chooser simply took the bigger half — so cutting lopsided only hurt YOU. Your best move is to cut 50/50.',
  initialCut = 35,
  className,
}: CutAndChooseProps) {
  const reactId = useId();
  const [cut, setCut] = useState(clamp(Math.round(initialCut), 1, 99));

  const model = useMemo(() => {
    const a = cut;
    const b = 100 - cut;
    const tie = a === b; // 50 / 50
    // The chooser rationally takes the bigger piece; on a tie, either piece.
    const taken = Math.max(a, b);
    const kept = Math.min(a, b);
    // "Fair" if within 3 points of a perfect halving.
    const fair = Math.abs(cut - 50) <= 3;
    return { a, b, tie, taken, kept, fair };
  }, [cut]);

  const { a, b, tie, taken, kept, fair } = model;

  // The left piece is the one the chooser takes iff it is the (weakly) bigger one.
  const chooserTakesLeft = a >= b;

  const keepColor = 'var(--color-brand-500)';
  const takeColor = 'var(--color-accent-500)';

  const verdictWord = fair ? verdictFair : verdictLopsided;

  const readoutText = readout
    .replace('{a}', String(a))
    .replace('{b}', String(b))
    .replace('{taken}', String(taken))
    .replace('{kept}', String(kept))
    .replace('{verdict}', verdictWord);

  const tween = 'transition-all duration-300 ease-out motion-reduce:transition-none';

  // Per-piece styling: which side the chooser takes vs the cutter keeps.
  const leftIsTaken = chooserTakesLeft;
  const leftColor = leftIsTaken ? takeColor : keepColor;
  const rightColor = leftIsTaken ? keepColor : takeColor;
  const leftTag = tie ? chooserLabel : leftIsTaken ? chooserLabel : cutterLabel;
  const rightTag = tie ? cutterLabel : leftIsTaken ? cutterLabel : chooserLabel;

  return (
    <figure className={cx('brutal my-6 bg-surface p-5 sm:p-6', className)}>
      <p className="font-display text-xs font-semibold uppercase tracking-wide text-brand-600">
        {eyebrow}
      </p>
      {title ? (
        <p className="mt-1 font-display text-lg font-semibold text-ink-900">{title}</p>
      ) : null}

      <p className="mt-2 text-sm font-medium text-ink-700">{instructions}</p>

      {/* Piece legend */}
      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs font-medium text-ink-600">
        <span className="inline-flex items-center gap-1.5">
          <span
            aria-hidden
            className="inline-block h-3 w-3 rounded-sm"
            style={{ background: takeColor }}
          />
          {chooserLabel}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span
            aria-hidden
            className="inline-block h-3 w-3 rounded-sm"
            style={{ background: keepColor }}
          />
          {cutterLabel}
        </span>
      </div>

      {/* The cake bar */}
      <div className="mt-3">
        <div className="relative flex h-12 w-full overflow-hidden rounded-card border border-ink-200 bg-surface-sunken">
          {/* Left piece */}
          <div
            className={cx('relative flex h-full items-center justify-center', tween)}
            style={{
              width: `${a}%`,
              background: `color-mix(in oklab, ${leftColor} 22%, var(--color-surface))`,
            }}
          >
            <div className="text-center leading-tight">
              <span className="block text-sm font-bold tabular-nums text-ink-800">{a}%</span>
              <span
                className="block text-[0.55rem] font-bold uppercase tracking-wide"
                style={{ color: leftColor }}
              >
                {leftTag}
              </span>
            </div>
          </div>

          {/* The cut line */}
          <div
            aria-hidden
            className={cx('h-full w-1 shrink-0 bg-ink-900/70', tween)}
          />

          {/* Right piece */}
          <div
            className={cx('relative flex h-full items-center justify-center', tween)}
            style={{
              width: `${b}%`,
              background: `color-mix(in oklab, ${rightColor} 22%, var(--color-surface))`,
            }}
          >
            <div className="text-center leading-tight">
              <span className="block text-sm font-bold tabular-nums text-ink-800">{b}%</span>
              <span
                className="block text-[0.55rem] font-bold uppercase tracking-wide"
                style={{ color: rightColor }}
              >
                {rightTag}
              </span>
            </div>
          </div>
        </div>

        {/* Piece captions under the bar */}
        <div className="mt-1 flex justify-between text-[0.6rem] font-medium uppercase tracking-wide text-ink-400">
          <span>{pieceALabel}</span>
          <span>{pieceBLabel}</span>
        </div>
      </div>

      {/* Outcome stat bars */}
      <div className="mt-4 space-y-2">
        {/* Chooser takes */}
        <div className="flex items-center gap-2">
          <span className="w-28 shrink-0 text-xs font-medium text-ink-600">{chooserTakesLabel}</span>
          <div className="relative h-4 flex-1 overflow-hidden rounded-pill bg-surface-sunken">
            <div
              className={cx('h-full rounded-pill', tween)}
              style={{ width: `${taken}%`, background: takeColor }}
            />
          </div>
          <span className="w-10 shrink-0 text-right text-xs font-semibold tabular-nums text-ink-700">
            {taken}%
          </span>
        </div>
        {/* You keep */}
        <div className="flex items-center gap-2">
          <span className="w-28 shrink-0 text-xs font-medium text-ink-600">{cutterGetsLabel}</span>
          <div className="relative h-4 flex-1 overflow-hidden rounded-pill bg-surface-sunken">
            <div
              className={cx('h-full rounded-pill', tween)}
              style={{ width: `${kept}%`, background: keepColor }}
            />
          </div>
          <span className="w-10 shrink-0 text-right text-xs font-semibold tabular-nums text-ink-700">
            {kept}%
          </span>
        </div>
      </div>

      {/* Live readout */}
      <p
        aria-live="polite"
        className="mt-4 rounded-card border border-brand-200 bg-brand-50/70 p-3 text-sm leading-relaxed text-ink-700"
      >
        {readoutText}
      </p>

      {/* Cut slider */}
      <div className="mt-4">
        <label
          htmlFor={`${reactId}-cut`}
          className="text-[0.65rem] font-bold uppercase tracking-wide text-ink-600"
        >
          {cutLabel}
        </label>
        <input
          id={`${reactId}-cut`}
          type="range"
          min={1}
          max={99}
          step={1}
          value={cut}
          onChange={(e) => setCut(clamp(Number(e.target.value), 1, 99))}
          aria-valuetext={`left piece ${a} percent`}
          className="mt-1 h-1.5 w-full cursor-pointer accent-brand-500"
        />
        <div className="flex justify-between text-[0.6rem] font-medium uppercase tracking-wide text-ink-400">
          <span>{pieceALabel}</span>
          <span>{pieceBLabel}</span>
        </div>
      </div>

      {/* Analysis panel */}
      <div className="mt-4 rounded-card border border-ink-200 bg-surface-sunken p-3">
        <p className="text-[0.65rem] font-bold uppercase tracking-wide text-ink-600">
          {analysisLabel}
        </p>
        <p
          className={cx(
            'mt-1 text-sm font-medium leading-relaxed',
            fair ? 'text-success' : 'text-danger',
          )}
        >
          {verdictWord}
        </p>
      </div>

      {caption ? <figcaption className="mt-3 text-sm text-ink-500">{caption}</figcaption> : null}
    </figure>
  );
}

export default CutAndChoose;
