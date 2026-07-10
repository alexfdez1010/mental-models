import { useId, useMemo, useState } from 'react';
import { cx } from '@/components/react/cx';

/** Props for the {@link CommonKnowledgeCoordinator} island. */
export interface CommonKnowledgeCoordinatorProps {
  /** Heading above the card. */
  title?: string;
  /** Eyebrow label. Defaults to `'Mutual knowledge vs. common knowledge'`. */
  eyebrow?: string;
  /** Instruction line above the crowd. */
  instructions?: string;
  /** Caption beneath the card. */
  caption?: string;
  /**
   * How many people are in the crowd. Each has a private threshold — the share
   * of the crowd they must *believe* will act before they will act themselves.
   * Defaults to `40`.
   */
  population?: number;
  /**
   * Starting shared grievance, `0`–`100`. Higher grievance lowers everyone's
   * threshold (they privately want to act more), but — and this is the point —
   * it does **not** move a frozen crowd on its own. Defaults to `55`.
   */
  initialGrievance?: number;
  /** Whether the public signal starts ON. Defaults to `false` (mutual knowledge). */
  initialSignal?: boolean;
  /** Label for the grievance slider. Defaults to `'Shared grievance (how much everyone privately wants change)'`. */
  grievanceLabel?: string;
  /** Label for the public-signal toggle. Defaults to `'Public signal — everyone sees that everyone sees it'`. */
  signalLabel?: string;
  /** Text shown on the toggle when the signal is ON. Defaults to `'Signal is PUBLIC'`. */
  signalOnText?: string;
  /** Text shown on the toggle when the signal is OFF. Defaults to `'Signal is private'`. */
  signalOffText?: string;
  /** Reset button label. Defaults to `'Reset'`. */
  resetLabel?: string;
  /** Legend label for a person who is waiting. Defaults to `'Waiting'`. */
  waitingLabel?: string;
  /** Legend label for a person who has acted. Defaults to `'Acting'`. */
  actingLabel?: string;
  /** Heading for the knowledge-ladder strip. Defaults to `'Which kind of knowledge is in the room?'`. */
  ladderHeading?: string;
  /** Rung 1 label. Defaults to `'Private'`. */
  privateLabel?: string;
  /** Rung 2 label. Defaults to `'Mutual'`. */
  mutualLabel?: string;
  /** Rung 3 label. Defaults to `'Common'`. */
  commonLabel?: string;
  /** One-line gloss under the highlighted rung when the signal is OFF. */
  mutualGloss?: string;
  /** One-line gloss under the highlighted rung when the signal is ON. */
  commonGloss?: string;
  /**
   * Readout template. Placeholders: `{believed}` believed participation %,
   * `{actual}` actual participation %, `{acting}` count acting, `{total}` crowd
   * size.
   */
  readoutTemplate?: string;
  /** Verdict when the crowd stays frozen. Defaults describe pluralistic ignorance. */
  frozenVerdict?: string;
  /** Verdict when a partial group moves but it stalls. */
  partialVerdict?: string;
  /** Verdict when the crowd cascades into collective action. */
  cascadeVerdict?: string;
  /** Extra classes merged onto the root element. */
  className?: string;
}

/** A deterministic PRNG (mulberry32) so SSR and hydration agree — no flicker,
 *  no `Math.random()` / `Date.now()`. */
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

const SEED = 0x5c0de17;

/**
 * Base thresholds for the crowd, drawn once and deterministically. Each value
 * is the share of the crowd (0–100) a person must *believe* will act before
 * they themselves will move. We spread them fairly evenly from a tiny vanguard
 * (≈0, the unconditional actors) up to the near-immovable (≈95), with a little
 * seeded jitter so the crowd looks organic but renders identically every time.
 */
function baseThresholds(n: number): number[] {
  const rng = mulberry32(SEED);
  return Array.from({ length: n }, (_, i) => {
    const even = (i / Math.max(1, n - 1)) * 96; // 0 … 96
    const jitter = (rng() - 0.5) * 12;
    return Math.max(0, Math.min(99, even + jitter));
  });
}

/**
 * **Common-knowledge coordinator** — makes the difference between *mutual* and
 * *common* knowledge something you can watch flip a crowd.
 *
 * Every person carries a private **threshold**: the share of the crowd they'd
 * have to believe is about to act before they'll risk acting too (step into the
 * square, pull their money out, point at the naked emperor). Raising **shared
 * grievance** lowers those thresholds — everyone privately wants change more —
 * yet the crowd still doesn't move, because no one can be *sure* enough others
 * will move with them. Each person, not knowing what the others know, assumes
 * they're nearly alone. That's *mutual* knowledge: we may each know, but we
 * don't know that we all know.
 *
 * Flip the **public signal** on — a shout, a broadcast, a visible crowd, the
 * child in the fable — and the very same private dispositions cascade. Now it's
 * *common* knowledge: everyone knows, and everyone knows that everyone knows, so
 * believed participation jumps, the low-threshold movers go first, that pushes
 * believed participation higher, and the wave sweeps to its self-consistent
 * fixed point. Same people, same grievance — the only thing that changed is what
 * everyone knows the others know.
 *
 * Fully deterministic (seeded PRNG, no autoplay), so the server render is stable
 * and nothing fights `prefers-reduced-motion`. All meaning lives in the
 * `aria-live` readout; the crowd grid is decorative for screen readers.
 */
export function CommonKnowledgeCoordinator({
  title,
  eyebrow = 'Mutual knowledge vs. common knowledge',
  instructions = 'Every person will act only once they believe enough others will too. Drag up the shared grievance — watch the crowd stay frozen anyway. Then flip the public signal on and watch the exact same people move as one.',
  caption,
  population = 40,
  initialGrievance = 55,
  initialSignal = false,
  grievanceLabel = 'Shared grievance (how much everyone privately wants change)',
  signalLabel = 'Public signal — everyone sees that everyone sees it',
  signalOnText = 'Signal is PUBLIC',
  signalOffText = 'Signal is private',
  resetLabel = 'Reset',
  waitingLabel = 'Waiting',
  actingLabel = 'Acting',
  ladderHeading = 'Which kind of knowledge is in the room?',
  privateLabel = 'Private',
  mutualLabel = 'Mutual',
  commonLabel = 'Common',
  mutualGloss = 'Each person knows — but not that the others know. So everyone waits.',
  commonGloss = 'Everyone knows that everyone knows. Now it is safe to be the one who moves.',
  readoutTemplate = 'Believed turnout: {believed}%. Actual turnout: {actual}% ({acting} of {total}).',
  frozenVerdict = 'Frozen. Plenty of private discontent, but nobody dares be first — pluralistic ignorance holds the crowd still.',
  partialVerdict = 'A few brave souls step out — then it stalls. Not enough believe the rest will follow.',
  cascadeVerdict = 'It cascades. The public signal made the discontent common knowledge, and the whole crowd moves as one.',
  className,
}: CommonKnowledgeCoordinatorProps) {
  const reactId = useId();
  const n = Math.max(6, Math.min(120, Math.round(population)));

  const clampG = (x: number) => Math.max(0, Math.min(100, Math.round(x)));
  const [grievance, setGrievance] = useState(() => clampG(initialGrievance));
  const [signal, setSignal] = useState(() => Boolean(initialSignal));

  const bases = useMemo(() => baseThresholds(n), [n]);

  // Grievance lowers every threshold: a more discontented crowd needs to believe
  // fewer others will move. Even so, high grievance alone does not unfreeze the
  // crowd under mutual knowledge — that is the preference-falsification point.
  const thresholds = useMemo(
    () => bases.map((b) => Math.max(0, Math.min(100, b - grievance * 0.85))),
    [bases, grievance],
  );

  // The two outcomes for the SAME thresholds:
  //  • Mutual knowledge (signal off): each person, not knowing others know,
  //    believes only the visible vanguard will act. No cascade can bootstrap, so
  //    only the near-unconditional movers (threshold ≈ 0) step out.
  //  • Common knowledge (signal on): everyone knows everyone knows, so the
  //    Granovetter cascade runs from the top down to its largest self-consistent
  //    fixed point — believed turnout and actual turnout meet.
  const result = useMemo(() => {
    const share = (p: number) =>
      (thresholds.filter((t) => t <= p).length / n) * 100;

    if (!signal) {
      const floor = 4; // only the unconditional vanguard is visible
      const believed = floor;
      const acting = thresholds.map((t) => t <= floor);
      const actual = (acting.filter(Boolean).length / n) * 100;
      return { believed, actual, acting };
    }

    // Largest fixed point: iterate p ← share(p) starting from 100 (everyone
    // believes everyone is ready). Monotone, so it descends to the top equilibrium.
    let p = 100;
    for (let i = 0; i < 200; i += 1) {
      const next = share(p);
      if (Math.abs(next - p) < 0.01) break;
      p = next;
    }
    const believed = p;
    const acting = thresholds.map((t) => t <= p);
    const actual = (acting.filter(Boolean).length / n) * 100;
    return { believed, actual, acting };
  }, [thresholds, n, signal]);

  const actingCount = result.acting.filter(Boolean).length;
  const actualPct = Math.round(result.actual);
  const believedPct = Math.round(result.believed);

  const verdict =
    actualPct >= 55 ? cascadeVerdict : actualPct <= 18 ? frozenVerdict : partialVerdict;

  const readout = readoutTemplate
    .replace('{believed}', String(believedPct))
    .replace('{actual}', String(actualPct))
    .replace('{acting}', String(actingCount))
    .replace('{total}', String(n));

  // Grid dimensions — aim for a tidy near-square block.
  const cols = Math.ceil(Math.sqrt(n * 1.6));

  const reset = () => {
    setGrievance(clampG(initialGrievance));
    setSignal(Boolean(initialSignal));
  };

  return (
    <figure className={cx('brutal my-6 bg-surface p-5 sm:p-6', className)}>
      <p className="font-display text-xs font-semibold uppercase tracking-wide text-accent-600">
        {eyebrow}
      </p>
      {title ? (
        <p className="mt-1 font-display text-lg font-semibold text-ink-900">{title}</p>
      ) : null}

      <p className="mt-2 text-sm font-medium text-ink-700">{instructions}</p>

      {/* Knowledge ladder */}
      <p className="mt-4 text-[0.65rem] font-bold uppercase tracking-wide text-ink-500">
        {ladderHeading}
      </p>
      <div className="mt-2 flex items-stretch gap-2">
        {[
          { key: 'private', label: privateLabel },
          { key: 'mutual', label: mutualLabel },
          { key: 'common', label: commonLabel },
        ].map((rung) => {
          const active = signal ? rung.key === 'common' : rung.key === 'mutual';
          return (
            <div
              key={rung.key}
              className={cx(
                'flex-1 rounded-card border p-2 text-center transition-colors',
                active
                  ? 'border-accent-500 bg-accent-300/25 text-ink-900'
                  : 'border-ink-100 bg-surface-sunken text-ink-400',
              )}
            >
              <span className="font-display text-sm font-semibold">{rung.label}</span>
            </div>
          );
        })}
      </div>
      <p className="mt-1.5 text-xs italic text-ink-500">
        {signal ? commonGloss : mutualGloss}
      </p>

      {/* The crowd. Decorative — meaning lives in the readout. */}
      <div
        aria-hidden
        className="mt-4 grid gap-1"
        style={{
          gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
          maxWidth: `${cols * 1.5}rem`,
        }}
      >
        {result.acting.map((isActing, i) => (
          <span
            key={`${reactId}-p-${i}`}
            className={cx(
              'flex aspect-square items-center justify-center rounded-[3px] text-[0.7rem] leading-none transition-colors duration-200 motion-reduce:transition-none',
              isActing
                ? 'bg-accent-500 text-white'
                : 'bg-surface-sunken text-ink-400 ring-1 ring-inset ring-ink-900/5',
            )}
          >
            {isActing ? '✊' : '•'}
          </span>
        ))}
      </div>

      {/* Legend */}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[0.7rem] font-semibold text-ink-600">
        <span className="inline-flex items-center gap-1.5">
          <span
            aria-hidden
            className="size-3 rounded-[2px] bg-surface-sunken ring-1 ring-inset ring-ink-900/10"
          />
          {waitingLabel}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="size-3 rounded-[2px] bg-accent-500" />
          {actingLabel}
        </span>
      </div>

      {/* Live readout + verdict */}
      <p aria-live="polite" className="mt-4 font-display text-base font-semibold text-ink-900">
        {readout}{' '}
        <span className={cx(actualPct >= 55 && 'text-accent-600', actualPct <= 18 && 'text-ink-500')}>
          {verdict}
        </span>
      </p>

      {/* Grievance slider */}
      <div className="mt-4">
        <div className="flex items-center justify-between text-[0.65rem] font-bold uppercase tracking-wide text-ink-500">
          <label htmlFor={`${reactId}-g`}>{grievanceLabel}</label>
          <span>{grievance}%</span>
        </div>
        <input
          id={`${reactId}-g`}
          type="range"
          min={0}
          max={100}
          step={1}
          value={grievance}
          onChange={(e) => setGrievance(clampG(Number(e.target.value)))}
          aria-valuetext={`${grievance}%`}
          className="mt-1 h-1.5 w-full cursor-pointer accent-accent-500"
        />
      </div>

      {/* Public-signal toggle */}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <span className="text-[0.65rem] font-bold uppercase tracking-wide text-ink-500">
          {signalLabel}
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={signal}
          onClick={() => setSignal((s) => !s)}
          className={cx(
            'brutal-btn px-4 py-2 font-display text-sm text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600',
            signal ? 'bg-accent-500' : 'bg-ink-400',
          )}
        >
          {signal ? signalOnText : signalOffText}
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

export default CommonKnowledgeCoordinator;
