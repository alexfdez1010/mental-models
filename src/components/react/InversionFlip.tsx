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
  /** Eyebrow label. Defaults to `'Invert, always invert'`. */
  eyebrow?: string;
  /** Caption beneath the cards. */
  caption?: string;
  /** Instruction line above the cards. Defaults to an English hint. */
  instructions?: string;
  /** The goal/anti-goal pairs. Each renders as one flippable card. */
  pairs: InversionPair[];
  /** Badge on the forward (un-flipped) face. Defaults to `'Forward goal'`. */
  forwardLabel?: string;
  /** Badge on the inverted (flipped) face. Defaults to `'How to guarantee failure'`. */
  invertedLabel?: string;
  /** Label above the safeguard line on the flipped face. Defaults to `'So protect against it'`. */
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
 * Interactive **forward-goal ↔ inverted-anti-goal** island — the core move of
 * inversion made tangible.
 *
 * Each card starts on its *forward* face: a goal you're chasing ("Keep the team
 * motivated"). Flip it and the same card shows the **inverted** question —
 * everything you'd do to *guarantee the opposite* ("Micromanage every decision
 * and never give credit") — plus the safeguard that anti-goal hands you for
 * free. Inversion in one gesture: stop asking how to succeed, ask how you'd
 * fail, then don't do that.
 *
 * Every card is a real `<button>` with `aria-pressed`, only the active face is
 * in the DOM (so screen readers read the current side), and the flip degrades to
 * an instant swap under `prefers-reduced-motion`. Fully keyboard-operable.
 */
export function InversionFlip({
  title,
  eyebrow = 'Invert, always invert',
  caption,
  instructions = 'Each card is a goal. Flip it to see how you’d guarantee the opposite — then read off what to avoid:',
  pairs,
  forwardLabel = 'Forward goal',
  invertedLabel = 'How to guarantee failure',
  safeguardLabel = 'So protect against it',
  flipHint = 'Flip to invert →',
  flipAllLabel = 'Invert all',
  resetLabel = 'Flip back',
  className,
}: InversionFlipProps) {
  // Fail the build on a mis-authored set rather than shipping a broken island.
  if (!Array.isArray(pairs) || pairs.length < 2) {
    throw new Error('InversionFlip: needs at least two `pairs`.');
  }
  const bad = pairs.find((p) => !p?.forward?.trim() || !p?.inverted?.trim());
  if (bad) {
    throw new Error(
      `InversionFlip: every pair needs a non-empty \`forward\` and \`inverted\`. ` +
        `Offending pair: "${bad?.forward ?? '(missing forward)'}".`,
    );
  }

  const reactId = useId();
  const [flipped, setFlipped] = useState<boolean[]>(() => pairs.map(() => false));

  const flippedCount = useMemo(() => flipped.filter(Boolean).length, [flipped]);
  const allFlipped = flippedCount === pairs.length;

  const toggle = (i: number) =>
    setFlipped((prev) => prev.map((v, j) => (j === i ? !v : v)));

  return (
    <figure className={cx('brutal my-6 bg-surface p-5 sm:p-6', className)}>
      <p className="font-display text-xs font-semibold uppercase tracking-wide text-brand-600">
        {eyebrow}
      </p>
      {title ? (
        <p className="mt-1 font-display text-lg font-semibold text-ink-900">{title}</p>
      ) : null}

      <p className="mt-3 text-sm font-medium text-ink-700">{instructions}</p>

      <ul className="mt-3 grid gap-3 sm:grid-cols-2">
        {pairs.map((p, i) => {
          const on = flipped[i];
          return (
            <li key={`${reactId}-${i}`}>
              <button
                type="button"
                onClick={() => toggle(i)}
                aria-pressed={on}
                className={cx(
                  'flex h-full w-full flex-col rounded-card border-2 p-4 text-left transition-colors',
                  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600',
                  on
                    ? 'border-brand-500 bg-brand-50'
                    : 'border-ink-200 bg-surface hover:border-brand-400 hover:bg-brand-50/50',
                )}
              >
                <span
                  className={cx(
                    'inline-flex w-fit items-center gap-1.5 rounded-pill px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-wide',
                    on ? 'bg-brand-600 text-white' : 'bg-surface-sunken text-ink-500',
                  )}
                >
                  {on ? (
                    <>
                      <span aria-hidden>↺</span>
                      {invertedLabel}
                    </>
                  ) : (
                    forwardLabel
                  )}
                </span>

                {/* Only the active face is rendered, so assistive tech reads the
                    current side. The opacity transition is purely cosmetic. */}
                <span
                  key={on ? 'back' : 'front'}
                  className="mt-2 block animate-fade-up font-medium text-ink-900 motion-reduce:animate-none"
                >
                  {on ? p.inverted : p.forward}
                </span>

                {on && p.safeguard ? (
                  <span className="mt-3 block border-t border-brand-200 pt-2">
                    <span className="block text-[0.65rem] font-bold uppercase tracking-wide text-brand-600">
                      {safeguardLabel}
                    </span>
                    <span className="mt-0.5 block text-sm leading-snug text-ink-700">
                      {p.safeguard}
                    </span>
                  </span>
                ) : null}

                {!on ? (
                  <span className="mt-auto pt-3 text-xs font-semibold text-brand-600">
                    {flipHint}
                  </span>
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>

      {/* Controls */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setFlipped(pairs.map(() => true))}
          className="brutal-btn bg-brand-600 px-4 py-2 text-sm text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
        >
          {flipAllLabel}
        </button>
        <button
          type="button"
          onClick={() => setFlipped(pairs.map(() => false))}
          className="brutal-btn bg-surface px-4 py-2 text-sm text-ink-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
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
