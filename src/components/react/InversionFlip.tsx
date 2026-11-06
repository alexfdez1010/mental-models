import { useId, useMemo, useState } from 'react';
import { cx } from '@/components/react/cx';

/** A single forward goal paired with its inverted anti-goal and the safeguard it reveals. */
export interface InversionPair {
  /** The forward goal — what you're trying to achieve ("Ship a great product"). */
  forward: string;
  /** The inverted anti-goal — how you'd *guarantee* the opposite ("Ignore every user complaint"). */
  inverted: string;
  /** The action the inversion hands you: avoid the anti-goal / do this instead. */
  safeguard?: string;
}

/** Props for the {@link InversionFlip} island. */
export interface InversionFlipProps {
  /** Heading above the cards. */
  title?: string;
  /** Eyebrow label. Defaults to `'Invert the goal'`. */
  eyebrow?: string;
  /** Caption beneath the cards. */
  caption?: string;
  /** Instruction line above the cards. Defaults to an English hint. */
  instructions?: string;
  /** The goal/anti-goal pairs. Each renders as one flippable card. */
  pairs: InversionPair[];
  /** Label for the goal, which stays visible throughout the exercise. */
  forwardLabel?: string;
  /** Label introducing the actions that undermine the goal. */
  invertedLabel?: string;
  /** Label of the separate disclosure for a suggested safeguard. */
  safeguardLabel?: string;
  /** Hint shown on the forward face inviting a flip. Defaults to `'Flip to invert →'`. */
  flipHint?: string;
  /** Label of the "flip every card" button. Defaults to `'Invert all'`. */
  flipAllLabel?: string;
  /** Label of the reset button. Defaults to `'Flip back'`. */
  resetLabel?: string;
  /** Extra classes merged onto the root element. */
  className?: string;
}

/**
 * Keep a goal in view while revealing the actions that could undermine it.
 * A second disclosure lets the learner propose a safeguard before reading one.
 * Keyboard, touch and reduced-motion users follow the same reasoning steps.
 */
export function InversionFlip({
  title,
  eyebrow = 'Invert the goal',
  caption,
  instructions = 'Reveal what could undermine each goal. Work out a safeguard before opening the suggested response.',
  pairs,
  forwardLabel = 'Forward goal',
  invertedLabel = 'What could cause failure',
  safeguardLabel = 'Reveal a safeguard',
  flipHint = 'Flip to invert →',
  flipAllLabel = 'Invert all',
  resetLabel = 'Flip back',
  className,
}: InversionFlipProps) {
  // Fail the build on a mis-authored set rather than shipping a broken island.
  if (!Array.isArray(pairs) || pairs.length < 2) {
    throw new Error('InversionFlip: needs at least two `pairs`.');
  }
  const badIndex = pairs.findIndex((p) => !p?.forward?.trim() || !p?.inverted?.trim());
  if (badIndex !== -1) {
    throw new Error(`InversionFlip: every pair needs a non-empty \`forward\` and \`inverted\`. Invalid pair: ${badIndex}.`);
  }

  const reactId = useId();
  const [flipped, setFlipped] = useState<boolean[]>(() => pairs.map(() => false));

  const flippedCount = useMemo(() => flipped.filter(Boolean).length, [flipped]);
  const allFlipped = flippedCount === pairs.length;

  const toggle = (i: number) =>
    setFlipped((prev) => prev.map((v, j) => (j === i ? !v : v)));

  return (
    <figure className={cx('not-prose brutal my-6 bg-surface p-5 sm:p-6', className)}>
      <p className="font-display text-xs font-semibold uppercase tracking-wide text-brand-600">
        {eyebrow}
      </p>
      {title ? (
        <p className="mt-1 font-display text-lg font-semibold text-ink-900">{title}</p>
      ) : null}

      <p className="mt-3 text-sm font-medium text-ink-700">{instructions}</p>

      <ul className="mt-3 grid gap-3 sm:grid-cols-2">
        {pairs.map((pair, i) => {
          const on = flipped[i];
          const resultId = `${reactId}-${i}-inverted`;
          return (
            <li key={`${reactId}-${i}`} className={cx('flex flex-col rounded-card p-4 transition-colors motion-reduce:transition-none', on ? 'bg-brand-50' : 'bg-surface-sunken')}>
              <p className="text-xs font-semibold text-ink-600">{forwardLabel}</p>
              <p className="mt-1 font-medium leading-relaxed text-ink-900">{pair.forward}</p>
              <button
                type="button"
                onClick={() => toggle(i)}
                aria-expanded={on}
                aria-controls={resultId}
                className="mt-3 flex min-h-11 w-fit items-center rounded-pill bg-surface px-4 py-2 text-left text-sm font-semibold text-brand-700 shadow-xs focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
              >
                {on ? resetLabel : flipHint}
              </button>
              <div id={resultId} hidden={!on}>
                {on ? (
                  <div className="mt-4 animate-fade-up motion-reduce:animate-none">
                    <p className="text-xs font-semibold text-brand-700">{invertedLabel}</p>
                    <p className="mt-1 text-sm leading-relaxed text-ink-800">{pair.inverted}</p>
                    {pair.safeguard ? (
                      <details className="mt-3 rounded-card bg-surface p-3">
                        <summary className="min-h-6 cursor-pointer text-sm font-semibold text-brand-700 focus-visible:rounded-card focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-600">
                          {safeguardLabel}
                        </summary>
                        <p className="mt-2 text-sm leading-relaxed text-ink-700">{pair.safeguard}</p>
                      </details>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>

      {/* Controls */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setFlipped(pairs.map(() => true))}
          disabled={allFlipped}
          className="brutal-btn bg-brand-600 px-4 py-2 text-sm text-white disabled:cursor-default disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
        >
          {flipAllLabel}
        </button>
        <button
          type="button"
          onClick={() => setFlipped(pairs.map(() => false))}
          disabled={flippedCount === 0}
          className="brutal-btn bg-surface px-4 py-2 text-sm text-ink-700 disabled:cursor-default disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
        >
          {resetLabel}
        </button>
        <span aria-live="polite" className="text-sm text-ink-500">
          {flippedCount} / {pairs.length}
        </span>
      </div>

      {caption ? (
        <figcaption className="mt-3 text-sm text-ink-500">{caption}</figcaption>
      ) : null}
    </figure>
  );
}

export default InversionFlip;
