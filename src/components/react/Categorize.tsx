import { useId, useMemo, useState } from 'react';
import { cx } from '@/components/react/cx';
import { hash, seededShuffle } from '@/components/react/shuffle';

/** An item to be sorted into one of the {@link CategorizeProps.buckets}. */
export interface CategorizeItem {
  /** Label shown to the user. */
  text: string;
  /** The label of the bucket this item belongs in (must match a `buckets` entry). */
  bucket: string;
}

/** Props for the {@link Categorize} component. */
export interface CategorizeProps {
  /** Optional prompt shown above the exercise. */
  question?: string;
  /** The category labels to sort items into. */
  buckets: string[];
  /** The items to sort. */
  items: CategorizeItem[];
  /** Explanation revealed after checking. */
  explanation?: string;
  /** Hint shown while sorting. */
  instructions?: string;
  /** Label for the check button. Defaults to `'Check'`. */
  checkLabel?: string;
  /** Label for the retry button. Defaults to `'Try again'`. */
  retryLabel?: string;
  /** Heading above the revealed explanation. Defaults to `'Explanation'`. */
  explanationLabel?: string;
  /** Verdict shown when every item is sorted right. Defaults to `'✓ All sorted'`. */
  allCorrectLabel?: string;
  /** Word after the score in the partial verdict (`✗ 2 / 3 <word>`). Defaults to `'correct'`. */
  partialResultWord?: string;
  /** Called with overall correctness so a parent (e.g. Quiz) can aggregate. */
  onResult?: (correct: boolean) => void;
  className?: string;
}

/**
 * Categorisation exercise — sort each item into its correct bucket.
 *
 * Each item exposes one button per bucket (a `radiogroup`), so the whole
 * exercise is keyboard-operable and screen-reader friendly. **Check** grades
 * every item: correctly-placed items turn success-green, misplaced ones turn
 * danger-red and reveal the bucket they belonged in. A great rotation away from
 * multiple-choice for "which side does this belong on?" ideas (e.g. transparent
 * vs shielded). All user-facing strings are props, so it stays locale-agnostic.
 */
export function Categorize({
  question,
  buckets,
  items,
  explanation,
  instructions = 'Place each item in the right group.',
  checkLabel = 'Check',
  retryLabel = 'Try again',
  explanationLabel = 'Explanation',
  allCorrectLabel = '✓ All sorted',
  partialResultWord = 'correct',
  onResult,
  className,
}: CategorizeProps) {
  // Fail the build on a mis-authored exercise instead of shipping an
  // ungradable one. Runs during SSR/prerender → red build.
  if (!Array.isArray(buckets) || buckets.length < 2) {
    throw new Error(`Categorize "${question ?? ''}": needs at least two buckets.`);
  }
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error(`Categorize "${question ?? ''}": needs at least one item.`);
  }
  const orphan = items.find((it) => !buckets.includes(it.bucket));
  if (orphan) {
    throw new Error(
      `Categorize "${question ?? ''}": item "${orphan.text}" has bucket ` +
        `"${orphan.bucket}", which is not one of [${buckets.join(', ')}].`,
    );
  }

  const groupId = useId();
  // Display orders are **seeded** from content so SSR and client hydration
  // agree (no reorder flash / hydration mismatch), but each is seeded from a
  // different slice so item order and bucket order scramble independently —
  // the answer can't be inferred from "first N items → first bucket". Grading
  // keys off the original item index and the bucket label, so scrambling the
  // display order never affects correctness.
  const itemOrder = useMemo(
    () => seededShuffle(items.map((_, i) => i), hash(items.map((it) => it.text).join('|'))),
    [items],
  );
  const bucketOrder = useMemo(
    () => seededShuffle(buckets, hash(buckets.join('|') + '#b')),
    [buckets],
  );
  // assignment[itemIndex] = chosen bucket label (or null).
  const [assignment, setAssignment] = useState<(string | null)[]>(() => items.map(() => null));
  const [checked, setChecked] = useState(false);

  const allAssigned = assignment.every((a) => a !== null);
  const correctCount = assignment.filter((a, i) => a === items[i].bucket).length;
  const allCorrect = correctCount === items.length;

  const assign = (itemIndex: number, bucket: string) => {
    if (checked) return;
    setAssignment((prev) => {
      const next = prev.slice();
      next[itemIndex] = bucket;
      return next;
    });
  };

  const check = () => {
    setChecked(true);
    onResult?.(allCorrect);
  };

  const reset = () => {
    setChecked(false);
    setAssignment(items.map(() => null));
  };

  return (
    <div
      className={cx(
        'my-6 rounded-card border border-ink-200 bg-surface p-5 shadow-soft sm:p-6',
        className,
      )}
    >
      {question ? (
        <p className="font-display text-base font-semibold text-balance text-ink-900 sm:text-lg">
          {question}
        </p>
      ) : null}
      {!checked ? <p className="mt-1 text-sm text-ink-500">{instructions}</p> : null}

      <ul className="mt-4 space-y-2.5">
        {itemOrder.map((i) => {
          const item = items[i];
          const chosen = assignment[i];
          const isRight = checked && chosen === item.bucket;
          const isWrong = checked && chosen !== item.bucket;
          return (
            <li
              key={`${groupId}-item-${i}`}
              className={cx(
                'flex flex-col gap-2 rounded-card border px-4 py-3 transition sm:flex-row sm:items-center sm:justify-between',
                isRight && 'border-[color:var(--color-success)] bg-[color:var(--color-success)]/10',
                isWrong && 'border-[color:var(--color-danger)] bg-[color:var(--color-danger)]/10',
                !checked && 'border-ink-200',
              )}
            >
              <span className="text-sm font-medium text-ink-900">
                {item.text}
                {isWrong ? (
                  <span className="ml-2 text-xs font-semibold text-[color:var(--color-success)]">
                    → {item.bucket}
                  </span>
                ) : null}
              </span>
              <div
                role="radiogroup"
                aria-label={item.text}
                className="flex flex-wrap gap-1.5"
              >
                {bucketOrder.map((b) => {
                  const selected = chosen === b;
                  return (
                    <button
                      key={b}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      disabled={checked}
                      onClick={() => assign(i, b)}
                      className={cx(
                        'rounded-pill border px-3 py-1 text-xs font-semibold transition',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400',
                        selected
                          ? 'border-brand-500 bg-brand-600 text-white'
                          : 'border-ink-200 bg-surface text-ink-600 hover:border-brand-300 hover:bg-brand-50',
                        checked && 'cursor-default',
                      )}
                    >
                      {b}
                    </button>
                  );
                })}
              </div>
            </li>
          );
        })}
      </ul>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        {!checked ? (
          <button
            type="button"
            onClick={check}
            disabled={!allAssigned}
            className={cx(
              'inline-flex items-center rounded-pill bg-brand-600 px-5 py-2 text-sm font-semibold text-white shadow-soft transition-colors duration-200',
              'hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2',
              'disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-brand-600',
            )}
          >
            {checkLabel}
          </button>
        ) : (
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center rounded-pill border border-ink-200 bg-surface px-5 py-2 text-sm font-semibold text-ink-700 transition-colors duration-200 hover:border-brand-300 hover:bg-brand-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
          >
            {retryLabel}
          </button>
        )}
        {checked && (
          <span
            className={cx(
              'text-sm font-semibold',
              allCorrect
                ? 'text-[color:var(--color-success)]'
                : 'text-[color:var(--color-danger)]',
            )}
            aria-live="polite"
          >
            {allCorrect
              ? allCorrectLabel
              : `✗ ${correctCount} / ${items.length} ${partialResultWord}`}
          </span>
        )}
      </div>

      {checked && explanation && (
        <div className="mt-4 rounded-card border border-brand-200 bg-brand-50/70 p-4 text-sm leading-relaxed text-ink-700 animate-fade-up">
          <p className="mb-1 font-display text-xs font-semibold uppercase tracking-wide text-brand-700">
            {explanationLabel}
          </p>
          {explanation}
        </div>
      )}
    </div>
  );
}

export default Categorize;
