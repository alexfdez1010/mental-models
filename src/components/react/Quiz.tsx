import { Children, isValidElement, useMemo, useState, type ReactNode } from 'react';
import { MCQ, type MCQProps } from '@/components/react/MCQ';
import { cx } from '@/components/react/cx';

/** Props for the {@link Quiz} component. */
export interface QuizProps {
  /** Optional heading shown above the quiz. */
  title?: string;
  /**
   * The questions to render, sequentially. Each entry is a full set of
   * {@link MCQProps} (minus `onResult`, which the Quiz supplies internally).
   * Optional when questions are supplied as `<MCQ>` children instead.
   */
  questions?: MCQProps[];
  /** Questions authored as `<MCQ>` child elements (alternative to {@link questions}). */
  children?: ReactNode;
  /** Label prefix for the progress indicator, e.g. "Question 1 of 5". Defaults to `'Question'`. */
  questionLabel?: string;
  /** Connector word in the progress indicator, e.g. "Question 1 of 5". Defaults to `'of'`. */
  ofLabel?: string;
  /** Word shown after the running score, e.g. "3 correct". Defaults to `'correct'`. */
  correctCountLabel?: string;
  /** Status shown in the progress header once finished. Defaults to `'Complete'`. */
  completeLabel?: string;
  /** Eyebrow on the results screen. Defaults to `'Quiz complete'`. */
  completeTitleLabel?: string;
  /** Results message for a perfect score. */
  perfectMessage?: string;
  /** Results message for a passing score (≥ half). */
  goodMessage?: string;
  /** Results message for a low score. */
  keepPracticingMessage?: string;
  /** Hint shown until the current question is answered. Defaults to `'Check your answer to continue.'`. */
  gateLabel?: string;
  /** Label for the advance button. Defaults to `'Next'`. */
  nextLabel?: string;
  /** Label for the last-question advance button. Defaults to `'See results'`. */
  seeResultsLabel?: string;
  /** Label for the go-back button. Defaults to `'Back'`. */
  backLabel?: string;
  /** Label shown before the final score, e.g. "You scored 4 / 5". Defaults to `'You scored'`. */
  scoreLabel?: string;
  /** Label for the restart button on the results screen. Defaults to `'Restart'`. */
  restartLabel?: string;
  /** Forwarded to each {@link MCQ} as its check-answer label. Defaults to `'Check'`. */
  checkLabel?: string;
  /** Forwarded to each {@link MCQ} as its try-again label. Defaults to `'Try again'`. */
  retryLabel?: string;
  /** Forwarded to each {@link MCQ} as its correct verdict. Defaults to `'Correct!'`. */
  correctLabel?: string;
  /** Forwarded to each {@link MCQ} as its wrong verdict. Defaults to `'Not quite.'`. */
  incorrectLabel?: string;
  /** Forwarded to each {@link MCQ} as its missed-option badge. Defaults to `'Correct answer'`. */
  correctAnswerLabel?: string;
  /** Forwarded to each {@link MCQ} as its explanation heading. Defaults to `'Explanation'`. */
  explanationLabel?: string;
  /** Extra classes merged onto the root element. */
  className?: string;
}

/**
 * Multi-question quiz wrapping several {@link MCQ}s.
 *
 * Shows one question at a time with a "Question N of M" indicator plus a brand
 * progress bar, and Back/Next controls. Advancing is gated until the current
 * question has been answered (checked). After the last question a score screen
 * ("You scored 4 / 5") is shown with a Restart button.
 *
 * Correctness is captured through each MCQ's `onResult` callback. Every
 * user-facing string is a prop, so the island stays locale-agnostic.
 */
export function Quiz({
  title,
  questions: questionsProp,
  children,
  questionLabel = 'Question',
  ofLabel = 'of',
  correctCountLabel = 'correct',
  completeLabel = 'Complete',
  completeTitleLabel = 'Quiz complete',
  perfectMessage = 'Perfect score — nicely done!',
  goodMessage = 'Good work — review the ones you missed.',
  keepPracticingMessage = 'Keep practicing — you’ve got this.',
  gateLabel = 'Check your answer to continue.',
  nextLabel = 'Next',
  seeResultsLabel = 'See results',
  backLabel = 'Back',
  scoreLabel = 'You scored',
  restartLabel = 'Restart',
  checkLabel = 'Check',
  retryLabel = 'Try again',
  correctLabel = 'Correct!',
  incorrectLabel = 'Not quite.',
  correctAnswerLabel = 'Correct answer',
  explanationLabel = 'Explanation',
  className,
}: QuizProps) {
  const questions: MCQProps[] =
    questionsProp ??
    Children.toArray(children)
      .filter(isValidElement)
      .map((child) => (child as { props: MCQProps }).props);

  // Fail loudly at build time on a mis-authored quiz instead of silently
  // shipping an empty card. The classic trap: authoring `<Quiz>` with `<MCQ>`
  // *children* in MDX. Across a `client:visible` island boundary Astro turns
  // those children into an opaque HTML slot, so `child.props` carries no
  // `question`/`options` and every card renders blank. Authoring MUST use the
  // `questions={[...]}` prop. These checks throw during SSR/prerender, so the
  // build goes red rather than green-but-broken.
  if (questions.length === 0) {
    throw new Error(
      'Quiz: no questions. Pass `questions={[{ question, options, ... }]}`. ' +
        'Authoring `<Quiz>` with `<MCQ>` children does not work across a ' +
        'client:visible island boundary — the children become an HTML slot.',
    );
  }
  questions.forEach((q, i) => {
    const structureOk =
      q &&
      typeof q.question === 'string' &&
      q.question.trim().length > 0 &&
      Array.isArray(q.options) &&
      q.options.length >= 2;
    if (!structureOk) {
      throw new Error(
        `Quiz: question ${i + 1} is missing a \`question\` string or a 2+ entry ` +
          '`options` array. If you wrote `<Quiz>` with `<MCQ>` children, switch ' +
          'to `questions={[{ question, options, correct, explanation }]}` — ' +
          'children do not cross the client:visible island boundary.',
      );
    }
    // Every question must have at least one correct answer — flagged either via
    // `correct={index|indices}` (string options) or `{ correct: true }` (object
    // options). Otherwise the question is unanswerable.
    const idx = q.correct;
    const flaggedIndices = new Set(
      idx === undefined ? [] : Array.isArray(idx) ? idx : [idx],
    );
    const hasCorrect = q.options.some(
      (o, oi) => (typeof o === 'string' ? false : o.correct === true) || flaggedIndices.has(oi),
    );
    if (!hasCorrect) {
      throw new Error(
        `Quiz: question ${i + 1} ("${q.question}") has no correct answer marked. ` +
          'Set `correct={index}` or mark an option `{ text, correct: true }`.',
      );
    }
  });

  const total = questions.length;
  const [current, setCurrent] = useState(0);
  // results[i] === undefined => unanswered; otherwise the correctness boolean.
  const [results, setResults] = useState<Array<boolean | undefined>>(() =>
    Array.from({ length: total }, () => undefined),
  );
  const [finished, setFinished] = useState(false);

  const score = useMemo(() => results.filter((r) => r === true).length, [results]);
  const answeredCurrent = results[current] !== undefined;
  const isLast = current === total - 1;

  const recordResult = (index: number, correct: boolean) => {
    setResults((prev) => {
      const next = [...prev];
      next[index] = correct;
      return next;
    });
  };

  const goNext = () => {
    if (isLast) {
      setFinished(true);
    } else {
      setCurrent((c) => Math.min(c + 1, total - 1));
    }
  };
  const goBack = () => setCurrent((c) => Math.max(c - 1, 0));

  const restart = () => {
    setResults(Array.from({ length: total }, () => undefined));
    setCurrent(0);
    setFinished(false);
  };

  const progressPct = finished ? 100 : Math.round(((current + (answeredCurrent ? 1 : 0)) / total) * 100);

  return (
    <section
      aria-label={title ?? 'Quiz'}
      className={cx(
        'brutal-lg bg-surface-muted p-5 sm:p-6',
        className,
      )}
    >
      {title && (
        <h3 className="mb-4 font-display text-lg font-semibold text-ink-900">{title}</h3>
      )}

      {/* Progress header */}
      <div className="mb-4">
        <div className="mb-2 flex items-center justify-between text-xs font-medium text-ink-500">
          <span aria-live="polite">
            {finished
              ? completeLabel
              : `${questionLabel} ${current + 1} ${ofLabel} ${total}`}
          </span>
          <span>{`${score} ${correctCountLabel}`}</span>
        </div>
        <div
          className="h-2 w-full overflow-hidden rounded-pill bg-surface-sunken"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progressPct}
        >
          <div
            className="h-full rounded-pill bg-brand-500 transition-[width] duration-500 ease-out motion-reduce:transition-none"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {finished ? (
        <div className="brutal bg-surface p-6 text-center animate-fade-up">
          <p className="font-display text-sm font-semibold uppercase tracking-wide text-brand-600">
            {completeTitleLabel}
          </p>
          <p className="mt-2 font-display text-3xl font-bold text-ink-900">
            {scoreLabel} {score} / {total}
          </p>
          <p className="mt-1 text-sm text-ink-500">
            {score === total
              ? perfectMessage
              : score >= total / 2
                ? goodMessage
                : keepPracticingMessage}
          </p>
          <button
            type="button"
            onClick={restart}
            className="brutal-btn mt-5 bg-brand-600 px-5 py-2 text-sm text-white hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
          >
            {restartLabel}
          </button>
        </div>
      ) : (
        <>
          {/* Render only the active question; key forces fresh MCQ state per slot. */}
          <MCQ
            key={current}
            checkLabel={checkLabel}
            retryLabel={retryLabel}
            correctLabel={correctLabel}
            incorrectLabel={incorrectLabel}
            correctAnswerLabel={correctAnswerLabel}
            explanationLabel={explanationLabel}
            {...questions[current]}
            onResult={(correct) => recordResult(current, correct)}
          />

          <div className="mt-5 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={goBack}
              disabled={current === 0}
              className={cx(
                'brutal-btn bg-surface px-4 py-2 text-sm text-ink-700',
                'hover:bg-brand-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2',
                'disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-surface',
              )}
            >
              {backLabel}
            </button>
            <button
              type="button"
              onClick={goNext}
              disabled={!answeredCurrent}
              className={cx(
                'brutal-btn bg-brand-600 px-5 py-2 text-sm text-white',
                'hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2',
                'disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-brand-600',
              )}
            >
              {isLast ? seeResultsLabel : nextLabel}
            </button>
          </div>
          {!answeredCurrent && (
            <p className="mt-2 text-right text-xs text-ink-400">
              {gateLabel}
            </p>
          )}
        </>
      )}
    </section>
  );
}

export default Quiz;
