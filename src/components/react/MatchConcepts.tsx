import { useId, useMemo, useState } from 'react';
import { cx } from '@/components/react/cx';
import { hash, seededShuffle } from '@/components/react/shuffle';

export interface MatchPair {
  /** The concept/term shown on the left. */
  term: string;
  /** Its correct definition shown (shuffled) on the right. */
  definition: string;
}

export interface MatchConceptsProps {
  /** Concept → definition pairs to match. */
  pairs: MatchPair[];
  /** Optional prompt shown above the exercise. */
  question?: string;
  /** Explanation revealed after checking. */
  explanation?: string;
  /** Label for the check button. */
  checkLabel?: string;
  /** Label for the retry button. */
  retryLabel?: string;
  /** Hint shown while pairing, e.g. "Pick a term, then its definition". */
  instructions?: string;
  /** Verdict shown when every pair is matched right. Defaults to `'✓ All matched'`. */
  allCorrectLabel?: string;
  /** Word after the score in the partial verdict (`✗ 2 / 3 <word>`). Defaults to `'correct'`. */
  partialResultWord?: string;
  /** Sub-label on the active term prompting a definition pick. Defaults to `'→ now pick a definition'`. */
  pickDefinitionHint?: string;
  /** Sub-label on an unlinked term. Defaults to `'not linked yet'`. */
  notLinkedHint?: string;
  /** Accessible label for the terms column. Defaults to `'Terms'`. */
  termsLabel?: string;
  /** Accessible label for the definitions column. Defaults to `'Definitions'`. */
  definitionsLabel?: string;
  /** Called with the overall result so a parent (e.g. Quiz) can aggregate. */
  onResult?: (correct: boolean) => void;
  className?: string;
}

export function MatchConcepts({
  pairs,
  question,
  explanation,
  checkLabel = 'Check',
  retryLabel = 'Try again',
  instructions = 'Pick a term, then click its definition.',
  allCorrectLabel = '✓ All matched',
  partialResultWord = 'correct',
  pickDefinitionHint = '→ now pick a definition',
  notLinkedHint = 'not linked yet',
  termsLabel = 'Terms',
  definitionsLabel = 'Definitions',
  onResult,
  className,
}: MatchConceptsProps) {
  // Fail the build on a mis-authored matcher rather than shipping an empty or
  // trivial one. Runs during SSR/prerender → red build.
  if (!Array.isArray(pairs) || pairs.length < 2) {
    throw new Error(
      `MatchConcepts "${question ?? ''}": needs at least two term/definition pairs.`,
    );
  }
  const bad = pairs.find((p) => !p?.term?.trim() || !p?.definition?.trim());
  if (bad) {
    throw new Error(
      `MatchConcepts "${question ?? ''}": every pair needs a non-empty \`term\` ` +
        'and `definition`.',
    );
  }

  const reactId = useId();
  // Term and definition display orders are **seeded** from content (proper
  // mulberry32 PRNG) so SSR and client agree, and scrambled independently so
  // the correct pairing is never the visible diagonal. Both are indices into
  // `pairs`; grading compares original indices, so display order is cosmetic.
  const termOrder = useMemo(
    () => seededShuffle(pairs.map((_, i) => i), hash(pairs.map((p) => p.term).join('|'))),
    [pairs],
  );
  const defOrder = useMemo(
    () => seededShuffle(pairs.map((_, i) => i), hash(pairs.map((p) => p.definition).join('|') + '#d')),
    [pairs],
  );
  // assignment[termIndex] = pairs-index of the chosen definition (or null).
  const [assignment, setAssignment] = useState<(number | null)[]>(
    () => pairs.map(() => null),
  );
  const [activeTerm, setActiveTerm] = useState<number | null>(null);
  const [checked, setChecked] = useState(false);

  const assignDefinition = (defIndex: number) => {
    if (checked || activeTerm === null) return;
    setAssignment((prev) => {
      const next = prev.slice();
      // A definition can only be used once — clear any other term holding it.
      for (let t = 0; t < next.length; t++) {
        if (next[t] === defIndex) next[t] = null;
      }
      next[activeTerm] = defIndex;
      return next;
    });
    setActiveTerm(null);
  };

  const allAssigned = assignment.every((a) => a !== null);
  const correctCount = assignment.filter((a, t) => a === t).length;
  const allCorrect = correctCount === pairs.length;

  const check = () => {
    setChecked(true);
    onResult?.(allCorrect);
  };

  const reset = () => {
    setChecked(false);
    setActiveTerm(null);
    setAssignment(pairs.map(() => null));
  };

  return (
    <div
      className={cx(
        'brutal my-6 bg-surface p-5',
        className,
      )}
    >
      {question ? <p className="font-medium text-ink-900">{question}</p> : null}
      {!checked ? (
        <p className="mt-1 text-sm text-ink-500">{instructions}</p>
      ) : null}

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {/* Terms */}
        <ul className="space-y-2" role="group" aria-label={termsLabel}>
          {termOrder.map((t) => {
            const pair = pairs[t];
            const assigned = assignment[t];
            const isActive = activeTerm === t;
            const showCorrect = checked && assigned === t;
            const showWrong = checked && assigned !== t;
            return (
              <li key={`${reactId}-term-${t}`}>
                <button
                  type="button"
                  onClick={() => !checked && setActiveTerm(isActive ? null : t)}
                  disabled={checked}
                  aria-pressed={isActive}
                  className={cx(
                    'brutal flex w-full flex-col gap-1 px-4 py-2.5 text-left text-sm',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400',
                    !checked && 'brutal-interactive hover:bg-brand-50',
                    isActive && !checked && 'border-brand-400 bg-brand-50 ring-2 ring-brand-300',
                    showCorrect && 'border-success-400 bg-success-50',
                    showWrong && 'border-danger-400 bg-danger-50',
                  )}
                >
                  <span className="font-semibold text-ink-900">{pair.term}</span>
                  <span className="text-xs text-ink-500">
                    {assigned !== null
                      ? pairs[assigned].definition
                      : isActive
                        ? pickDefinitionHint
                        : notLinkedHint}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        {/* Definitions (shuffled) */}
        <ul className="space-y-2" role="group" aria-label={definitionsLabel}>
          {defOrder.map((defIndex) => {
            const usedBy = assignment.indexOf(defIndex);
            const isUsed = usedBy !== -1;
            return (
              <li key={`${reactId}-def-${defIndex}`}>
                <button
                  type="button"
                  onClick={() => assignDefinition(defIndex)}
                  disabled={checked || activeTerm === null}
                  className={cx(
                    'brutal w-full px-4 py-2.5 text-left text-sm',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400',
                    'disabled:cursor-not-allowed',
                    activeTerm !== null && !checked && 'brutal-interactive hover:bg-brand-50',
                    isUsed ? 'bg-brand-50/50 text-ink-500' : 'text-ink-700',
                  )}
                >
                  {pairs[defIndex].definition}
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      {!checked ? (
        <button
          type="button"
          onClick={check}
          disabled={!allAssigned}
          className={cx(
            'brutal-btn mt-4 bg-brand-600 px-5 py-2 text-sm text-white',
            'hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400',
            'disabled:cursor-not-allowed disabled:opacity-50',
          )}
        >
          {checkLabel}
        </button>
      ) : (
        <div className="mt-4" aria-live="polite">
          <p
            className={cx(
              'font-semibold',
              allCorrect ? 'text-success-700' : 'text-danger-700',
            )}
          >
            {allCorrect
              ? allCorrectLabel
              : `✗ ${correctCount} / ${pairs.length} ${partialResultWord}`}
          </p>
          {explanation ? <p className="mt-1 text-sm text-ink-600">{explanation}</p> : null}
          <button
            type="button"
            onClick={reset}
            className={cx(
              'brutal-btn mt-3 bg-surface px-4 py-1.5 text-sm text-ink-700',
              'hover:text-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400',
            )}
          >
            {retryLabel}
          </button>
        </div>
      )}
    </div>
  );
}

export default MatchConcepts;
