import { useId, useMemo, useState } from 'react';
import { cx } from '@/components/react/cx';

/** A candidate solution to the stuck problem. */
export interface ReframeSolution {
  /** The solution text. */
  text: string;
  /**
   * Ids of the assumptions that must be DROPPED before this solution becomes
   * reachable. Empty (or omitted) means it is one of the obvious, front-door
   * answers you can already see without questioning anything.
   */
  requires?: string[];
  /** Reachable only after firing a random-word provocation. */
  viaProvocation?: boolean;
}

/** A hidden assumption the solver forgot they were making. */
export interface ReframeAssumption {
  /** Stable id referenced by a solution's `requires`. */
  id: string;
  /** The assumption, phrased as the silent "of course…" the mind never states. */
  text: string;
}

/** Props for the {@link ReframeLab} island. */
export interface ReframeLabProps {
  /** Heading above the card. */
  title?: string;
  /** Eyebrow label. Defaults to `'Reframe lab'`. */
  eyebrow?: string;
  /** Instruction line above the panel. */
  instructions?: string;
  /** Caption beneath the card. */
  caption?: string;
  /** Label above the problem statement. Defaults to `'The stuck problem'`. */
  problemLabel?: string;
  /** The problem the learner is stuck on. */
  problem: string;
  /** Heading of the assumptions column. */
  assumptionsLabel?: string;
  /** The hidden assumptions the learner can drop one at a time. */
  assumptions: ReframeAssumption[];
  /** Heading of the solutions column. */
  solutionsLabel?: string;
  /** All candidate solutions; each names which assumption unlocks it. */
  solutions: ReframeSolution[];
  /** Label on the provocation button. */
  provokeLabel?: string;
  /** Small hint under the provocation button. */
  provokeHint?: string;
  /** Prefix shown before the drawn random word. Defaults to `'Random word:'`. */
  randomWordLabel?: string;
  /** Pool of unrelated words fed in as provocations. */
  randomWords?: string[];
  /** Text shown on a still-locked solution. */
  lockedLabel?: string;
  /** Badge on the obvious, always-visible solutions. Defaults to `'obvious'`. */
  obviousBadge?: string;
  /** Badge on a newly unlocked solution. Defaults to `'unlocked'`. */
  newBadge?: string;
  /** Badge on a provocation-only solution. Defaults to `'provoked'`. */
  provokedBadge?: string;
  /** Label on the reset button. Defaults to `'Reset'`. */
  resetLabel?: string;
  /**
   * Readout template. `{reached}`/`{total}`/`{dropped}` are replaced with the
   * count of reachable solutions, the total, and the number of dropped
   * assumptions.
   */
  readout?: string;
  /** Verdict when nothing has been questioned yet. */
  verdictStuck?: string;
  /** Verdict when some assumptions have been dropped. */
  verdictOpening?: string;
  /** Verdict when every assumption has been dropped. */
  verdictOpen?: string;
  /** Extra classes merged onto the root element. */
  className?: string;
}

/**
 * Interactive **reframe lab** — makes visible the core claim of lateral
 * thinking: you don't unlock a stuck problem by thinking *harder* down the same
 * line, you unlock it by *removing an assumption* you never noticed you were
 * making.
 *
 * A single stuck problem is shown alongside the hidden assumptions baked into
 * how it's usually read. Every candidate solution starts locked behind one of
 * those assumptions — only the handful of "obvious" answers (that question
 * nothing) are visible at the start. As the learner drops an assumption, the
 * solutions that were sitting on the other side of it light up: the reachable
 * set *expands* without anyone thinking any harder. A **provocation** button
 * feeds in an unrelated random word (de Bono's random-entry technique) and
 * surfaces the wilder ideas that only a deliberate jolt would reach.
 *
 * An `aria-live` readout reports how many solutions are now in reach, and a
 * verdict panel narrates the lesson: the doors were always there; the
 * assumptions were the walls. All controls are native, keyboard-operable
 * inputs; the only motion is a cosmetic tween disabled under
 * `prefers-reduced-motion`.
 */
export function ReframeLab({
  title,
  eyebrow = 'Reframe lab',
  instructions = 'The problem below looks stuck. It isn’t — you just can’t see past the assumptions hidden in how it’s phrased. Drop an assumption and watch new solutions light up. Nothing about the problem changed; only what you let yourself consider did.',
  caption,
  problemLabel = 'The stuck problem',
  problem,
  assumptionsLabel = 'Hidden assumptions — drop one to open a door',
  assumptions,
  solutionsLabel = 'Solutions now in reach',
  solutions,
  provokeLabel = 'Throw in a random word (provocation)',
  provokeHint = 'Random-entry: force an unrelated word into the problem and harvest whatever new idea it jolts loose.',
  randomWordLabel = 'Random word:',
  randomWords = ['candle', 'river', 'mirror', 'orchestra', 'magnet', 'garden'],
  lockedLabel = 'Locked — an assumption is still in the way',
  obviousBadge = 'obvious',
  newBadge = 'unlocked',
  provokedBadge = 'provoked',
  resetLabel = 'Reset',
  readout = '{reached} of {total} solutions in reach — {dropped} assumption(s) dropped.',
  verdictStuck = 'Right now you can only see the obvious answers — the ones that question nothing. This is where "just think harder" traps you: harder thinking only digs the same hole deeper. Try dropping an assumption instead.',
  verdictOpening = 'See what happened? You didn’t think harder — you removed a wall. Each assumption you drop wasn’t part of the problem at all; it was smuggled in by how the problem was phrased. Keep going: there are more doors.',
  verdictOpen = 'Every assumption gone, and the solution space is wide open. Notice you never solved the "original" problem — you dissolved it by refusing its hidden rules. That is the whole move: lateral thinking changes the starting point, not the effort.',
  className,
}: ReframeLabProps) {
  const reactId = useId();
  const [dropped, setDropped] = useState<Set<string>>(new Set());
  const [wordIndex, setWordIndex] = useState<number>(-1);

  const provoked = wordIndex >= 0;

  const toggle = (id: string) =>
    setDropped((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const provoke = () =>
    setWordIndex((i) => (randomWords.length ? (i + 1) % randomWords.length : -1));

  const reset = () => {
    setDropped(new Set());
    setWordIndex(-1);
  };

  const model = useMemo(() => {
    const scored = solutions.map((s) => {
      const needs = s.requires ?? [];
      const assumptionsMet = needs.every((id) => dropped.has(id));
      const provocationMet = !s.viaProvocation || provoked;
      const reachable = assumptionsMet && provocationMet;
      const obvious = needs.length === 0 && !s.viaProvocation;
      return { ...s, reachable, obvious };
    });
    const reached = scored.filter((s) => s.reachable).length;
    return { scored, reached };
  }, [solutions, dropped, provoked]);

  const { scored, reached } = model;

  const verdictKey =
    dropped.size === 0
      ? 'stuck'
      : dropped.size >= assumptions.length
        ? 'open'
        : 'opening';
  const verdictText = { stuck: verdictStuck, opening: verdictOpening, open: verdictOpen }[
    verdictKey
  ];
  const good = verdictKey !== 'stuck';

  const readoutText = readout
    .replace('{reached}', String(reached))
    .replace('{total}', String(solutions.length))
    .replace('{dropped}', String(dropped.size));

  const tween = 'transition-all duration-300 ease-out motion-reduce:transition-none';
  const currentWord = provoked ? randomWords[wordIndex] : null;

  return (
    <figure className={cx('brutal my-6 bg-surface p-5 sm:p-6', className)}>
      <p className="font-display text-xs font-semibold uppercase tracking-wide text-brand-600">
        {eyebrow}
      </p>
      {title ? (
        <p className="mt-1 font-display text-lg font-semibold text-ink-900">{title}</p>
      ) : null}

      <p className="mt-2 text-sm font-medium text-ink-700">{instructions}</p>

      {/* The stuck problem */}
      <div className="mt-4 rounded-card border border-accent-200 bg-accent-50/70 p-3">
        <p className="text-[0.65rem] font-bold uppercase tracking-wide text-accent-600">
          {problemLabel}
        </p>
        <p className="mt-1 text-sm font-semibold leading-relaxed text-ink-800">{problem}</p>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* Assumptions column */}
        <div>
          <p className="text-[0.65rem] font-bold uppercase tracking-wide text-ink-600">
            {assumptionsLabel}
          </p>
          <div className="mt-2 space-y-2">
            {assumptions.map((a) => {
              const isDropped = dropped.has(a.id);
              return (
                <label
                  key={a.id}
                  htmlFor={`${reactId}-${a.id}`}
                  className={cx(
                    'flex cursor-pointer items-start gap-2.5 rounded-card border p-2.5',
                    tween,
                    isDropped
                      ? 'border-brand-300 bg-brand-50/70'
                      : 'border-ink-200 bg-surface-sunken',
                  )}
                >
                  <input
                    id={`${reactId}-${a.id}`}
                    type="checkbox"
                    checked={isDropped}
                    onChange={() => toggle(a.id)}
                    className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-brand-500"
                  />
                  <span
                    className={cx(
                      'text-xs font-medium leading-snug',
                      isDropped ? 'text-ink-400 line-through' : 'text-ink-700',
                    )}
                  >
                    {a.text}
                  </span>
                </label>
              );
            })}
          </div>

          {/* Provocation control */}
          <div className="mt-3 rounded-card border border-ink-200 bg-surface-sunken p-3">
            <button
              type="button"
              onClick={provoke}
              className="brutal-btn w-full bg-accent-500 px-3 py-2 text-xs font-semibold text-white"
            >
              {provokeLabel}
            </button>
            {currentWord ? (
              <p className="mt-2 text-center text-sm font-semibold text-accent-600">
                {randomWordLabel}{' '}
                <span className="rounded-pill bg-accent-100 px-2 py-0.5">{currentWord}</span>
              </p>
            ) : null}
            <p className="mt-1.5 text-[0.6rem] font-medium leading-snug text-ink-400">
              {provokeHint}
            </p>
          </div>
        </div>

        {/* Solutions column */}
        <div>
          <p className="text-[0.65rem] font-bold uppercase tracking-wide text-ink-600">
            {solutionsLabel}
          </p>
          <div className="mt-2 space-y-2">
            {scored.map((s, i) => (
              <div
                key={i}
                className={cx(
                  'rounded-card border p-2.5',
                  tween,
                  s.reachable
                    ? s.obvious
                      ? 'border-ink-200 bg-surface'
                      : 'border-brand-500 bg-brand-50/80 shadow-soft'
                    : 'border-dashed border-ink-200 bg-surface-sunken opacity-55',
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <span
                    className={cx(
                      'text-xs font-medium leading-snug',
                      s.reachable ? 'text-ink-800' : 'text-ink-400',
                    )}
                  >
                    {s.reachable ? s.text : lockedLabel}
                  </span>
                  {s.reachable ? (
                    <span
                      className={cx(
                        'shrink-0 rounded-pill px-1.5 py-0.5 text-[0.55rem] font-bold uppercase tracking-wide',
                        s.obvious
                          ? 'bg-ink-100 text-ink-500'
                          : s.viaProvocation
                            ? 'bg-accent-500 text-white'
                            : 'bg-brand-500 text-white',
                      )}
                    >
                      {s.obvious ? obviousBadge : s.viaProvocation ? provokedBadge : newBadge}
                    </span>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Live readout */}
      <p
        aria-live="polite"
        className="mt-4 rounded-card border border-brand-200 bg-brand-50/70 p-3 text-sm font-semibold text-ink-700"
      >
        {readoutText}
      </p>

      {/* Verdict panel */}
      <div className="mt-3 rounded-card border border-ink-200 bg-surface-sunken p-3">
        <p
          className={cx(
            'text-sm font-medium leading-relaxed',
            good ? 'text-success' : 'text-ink-600',
          )}
        >
          {verdictText}
        </p>
      </div>

      <div className="mt-3">
        <button
          type="button"
          onClick={reset}
          className="brutal-btn bg-surface-sunken px-4 py-1.5 text-xs font-semibold text-ink-700"
        >
          {resetLabel}
        </button>
      </div>

      {caption ? <figcaption className="mt-3 text-sm text-ink-500">{caption}</figcaption> : null}
    </figure>
  );
}

export default ReframeLab;
