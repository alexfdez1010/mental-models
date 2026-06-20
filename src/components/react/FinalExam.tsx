import { useId, useMemo, useState } from 'react';
import { cx } from '@/components/react/cx';
import { hash, seededShuffle } from '@/components/react/shuffle';
import type { MCQOption } from '@/components/react/MCQ';

/** A single exam question. Mirrors the answerable subset of `MCQProps`. */
export interface FinalExamQuestion {
  /** The question prompt. */
  question: string;
  /** Answer options — full {@link MCQOption}s or plain string labels. */
  options: Array<MCQOption | string>;
  /** Index/indices of the correct option(s) when {@link options} are strings. */
  correct?: number | number[];
  /** Explanation revealed once the answer is locked. */
  explanation?: string;
  /** Allow selecting multiple options (checkboxes instead of radios). */
  allowMultiple?: boolean;
  /** Shuffle option order (seeded, SSR-stable). On by default. */
  shuffle?: boolean;
}

/** Props for the {@link FinalExam} component. */
export interface FinalExamProps {
  /** The pool of questions, presented one at a time, in order. */
  questions: FinalExamQuestion[];
  /** Optional heading shown above the exam. */
  title?: string;
  /** Percent correct required to pass. Defaults to `70`. */
  passPercent?: number;
  /** Label prefix for the progress indicator, e.g. "Question 1 of 25". Defaults to `'Question'`. */
  questionLabel?: string;
  /** Connector word in the progress indicator. Defaults to `'of'`. */
  ofLabel?: string;
  /** Button that locks the current answer for good. Defaults to `'Submit answer'`. */
  submitLabel?: string;
  /** Warning shown beneath an un-submitted question. Defaults to a "this is final" note. */
  lockWarningLabel?: string;
  /** Hint shown until an option is selected. Defaults to `'Select an answer to continue.'`. */
  selectHintLabel?: string;
  /** Advance button. Defaults to `'Next question'`. */
  nextLabel?: string;
  /** Advance button on the last question. Defaults to `'See results'`. */
  seeResultsLabel?: string;
  /** Verdict when the locked answer was right. Defaults to `'Correct'`. */
  correctLabel?: string;
  /** Verdict when the locked answer was wrong. Defaults to `'Incorrect'`. */
  incorrectLabel?: string;
  /** Badge on a missed correct option. Defaults to `'Correct answer'`. */
  correctAnswerLabel?: string;
  /** Heading above a revealed explanation. Defaults to `'Explanation'`. */
  explanationLabel?: string;
  /** Eyebrow on the results screen. Defaults to `'Exam complete'`. */
  completeTitleLabel?: string;
  /** Label before the final score, e.g. "You scored 18 / 25". Defaults to `'You scored'`. */
  scoreLabel?: string;
  /** Verdict + message when the learner passed. Defaults provided. */
  passLabel?: string;
  passMessage?: string;
  /** Verdict + message when the learner did not pass. Defaults provided. */
  failLabel?: string;
  failMessage?: string;
  /** Heading above the per-question results breakdown. Defaults to `'Your answers'`. */
  reviewLabel?: string;
  /** Extra classes merged onto the root element. */
  className?: string;
}

interface NormalizedOption extends MCQOption {
  id: string;
  index: number;
}

/** Build + (optionally) seed-shuffle the options for one question. */
function normalizeOptions(q: FinalExamQuestion, groupId: string): NormalizedOption[] {
  const correctIndices = new Set(
    q.correct === undefined ? [] : Array.isArray(q.correct) ? q.correct : [q.correct],
  );
  const built = (q.options ?? []).map((o, index) => {
    const option: MCQOption = typeof o === 'string' ? { text: o } : o;
    return {
      ...option,
      correct: option.correct ?? correctIndices.has(index),
      index,
      id: option.id ?? `${groupId}-opt-${index}`,
    };
  });
  if (q.shuffle === false) return built;
  return seededShuffle(built, hash(built.map((o) => o.text).join(' ')));
}

/**
 * Final-exam island — a graded, **irreversible** run through a pool of
 * multiple-choice questions.
 *
 * The flow is deliberately flat: one question at a time, no themed detours.
 * The learner selects an option and clicks **Submit answer**, which **locks
 * the answer for good** — there is no Back button, no "Try again", and no
 * Restart. The moment an answer is locked the result is revealed inline
 * (correct option green, a wrong pick red), so a mistake is final: you simply
 * fail that question. The running tally stays hidden until the last question
 * is submitted, when a pass/fail score and a per-question review appear.
 *
 * Because there is no Restart, once the exam is finished it cannot be retaken
 * within the session. All user-facing strings are props, so the island stays
 * locale-agnostic.
 */
export function FinalExam({
  questions,
  title,
  passPercent = 70,
  questionLabel = 'Question',
  ofLabel = 'of',
  submitLabel = 'Submit answer',
  lockWarningLabel = 'Heads up — once you submit, this answer is final. You can’t change it.',
  selectHintLabel = 'Select an answer to continue.',
  nextLabel = 'Next question',
  seeResultsLabel = 'See results',
  correctLabel = 'Correct',
  incorrectLabel = 'Incorrect',
  correctAnswerLabel = 'Correct answer',
  explanationLabel = 'Explanation',
  completeTitleLabel = 'Exam complete',
  scoreLabel = 'You scored',
  passLabel = 'Passed',
  passMessage = 'You cleared the bar — solid work.',
  failLabel = 'Did not pass',
  failMessage = 'Below the pass mark this time — revisit the lessons and come back.',
  reviewLabel = 'Your answers',
  className,
}: FinalExamProps) {
  const groupId = useId();

  // Build + shuffle every question once. Seeded shuffle → identical SSR/CSR
  // order, no hydration mismatch; `index`/`id` stay bound to the authored
  // option so grading is unaffected by display order.
  const prepared = useMemo(
    () =>
      (questions ?? []).map((q, qi) => ({
        ...q,
        normalized: normalizeOptions(q, `${groupId}-q${qi}`),
      })),
    [questions, groupId],
  );

  // Fail the build on a mis-authored exam rather than shipping unanswerable
  // cards. Runs during SSR/prerender → red build, not green-but-broken.
  if (prepared.length === 0) {
    throw new Error('FinalExam: no questions. Pass `questions={[{ question, options, ... }]}`.');
  }
  prepared.forEach((q, i) => {
    if (q.normalized.length < 2) {
      throw new Error(`FinalExam: question ${i + 1} ("${q.question}") needs at least two options.`);
    }
    if (!q.normalized.some((o) => o.correct)) {
      throw new Error(
        `FinalExam: question ${i + 1} ("${q.question}") has no correct answer marked. ` +
          'Set `correct={index}` or mark an option `{ text, correct: true }`.',
      );
    }
  });

  const total = prepared.length;
  const [current, setCurrent] = useState(0);
  // Per-question selection (the picked option ids) and whether it's locked.
  const [selected, setSelected] = useState<Set<string>>(new Set());
  // locked[i] === undefined => not yet submitted; otherwise the correctness boolean.
  const [locked, setLocked] = useState<Array<boolean | undefined>>(() =>
    Array.from({ length: total }, () => undefined),
  );
  const [finished, setFinished] = useState(false);

  const q = prepared[current];
  const isLocked = locked[current] !== undefined;
  const isLast = current === total - 1;
  const score = useMemo(() => locked.filter((r) => r === true).length, [locked]);

  const correctIds = useMemo(
    () => new Set(q.normalized.filter((o) => o.correct).map((o) => o.id)),
    [q],
  );

  const isAllCorrect = useMemo(() => {
    if (selected.size !== correctIds.size) return false;
    for (const id of selected) if (!correctIds.has(id)) return false;
    return true;
  }, [selected, correctIds]);

  const toggle = (id: string) => {
    if (isLocked) return;
    setSelected((prev) => {
      if (q.allowMultiple) {
        const next = new Set(prev);
        next.has(id) ? next.delete(id) : next.add(id);
        return next;
      }
      return new Set([id]);
    });
  };

  const submit = () => {
    if (selected.size === 0 || isLocked) return;
    setLocked((prev) => {
      const next = [...prev];
      next[current] = isAllCorrect;
      return next;
    });
  };

  const advance = () => {
    if (isLast) {
      setFinished(true);
    } else {
      setCurrent((c) => c + 1);
      setSelected(new Set());
    }
  };

  const optionState = (o: NormalizedOption): 'correct' | 'wrong' | 'missed' | 'neutral' => {
    if (!isLocked) return 'neutral';
    const picked = selected.has(o.id);
    if (picked && o.correct) return 'correct';
    if (picked && !o.correct) return 'wrong';
    if (!picked && o.correct) return 'missed';
    return 'neutral';
  };

  const passed = score / total >= passPercent / 100;
  const progressPct = finished
    ? 100
    : Math.round(((current + (isLocked ? 1 : 0)) / total) * 100);

  return (
    <section
      aria-label={title ?? 'Final exam'}
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
              ? completeTitleLabel
              : `${questionLabel} ${current + 1} ${ofLabel} ${total}`}
          </span>
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
          <p
            className={cx(
              'font-display text-sm font-semibold uppercase tracking-wide',
              passed ? 'text-[color:var(--color-success)]' : 'text-[color:var(--color-danger)]',
            )}
          >
            {passed ? passLabel : failLabel}
          </p>
          <p className="mt-2 font-display text-3xl font-bold text-ink-900">
            {scoreLabel} {score} / {total}
          </p>
          <p className="mt-1 text-sm text-ink-500">{passed ? passMessage : failMessage}</p>

          {/* Per-question review — read-only, no path back into the exam. */}
          <p className="mt-6 mb-2 text-left font-display text-xs font-semibold uppercase tracking-wide text-ink-500">
            {reviewLabel}
          </p>
          <ol className="flex flex-col gap-2 text-left">
            {prepared.map((pq, i) => {
              const ok = locked[i] === true;
              return (
                <li
                  key={i}
                  className={cx(
                    'brutal flex items-start gap-3 px-4 py-3 text-sm',
                    ok
                      ? 'border-[color:var(--color-success)]/40 bg-[color:var(--color-success)]/5'
                      : 'border-[color:var(--color-danger)]/40 bg-[color:var(--color-danger)]/5',
                  )}
                >
                  <span
                    aria-hidden
                    className={cx(
                      'mt-0.5 font-semibold',
                      ok
                        ? 'text-[color:var(--color-success)]'
                        : 'text-[color:var(--color-danger)]',
                    )}
                  >
                    {ok ? '✓' : '✕'}
                  </span>
                  <span className="flex-1 text-ink-700">
                    <span className="sr-only">{ok ? correctLabel : incorrectLabel}: </span>
                    {pq.question}
                  </span>
                </li>
              );
            })}
          </ol>
        </div>
      ) : (
        <>
          <p
            id={`${groupId}-question`}
            className="mb-4 font-display text-base font-semibold text-balance text-ink-900 sm:text-lg"
          >
            {q.question}
          </p>

          <div
            role={q.allowMultiple ? 'group' : 'radiogroup'}
            aria-labelledby={`${groupId}-question`}
            className="flex flex-col gap-2.5"
          >
            {q.normalized.map((o) => {
              const picked = selected.has(o.id);
              const st = optionState(o);
              return (
                <label
                  key={o.id}
                  className={cx(
                    'brutal group flex cursor-pointer items-center gap-3 px-4 py-3 text-sm',
                    'focus-within:ring-2 focus-within:ring-brand-500 focus-within:ring-offset-1',
                    isLocked && 'cursor-default',
                    st === 'neutral' &&
                      picked &&
                      'border-brand-400 bg-brand-50 text-ink-900',
                    st === 'neutral' &&
                      !picked &&
                      'bg-surface text-ink-700 hover:bg-brand-50/60',
                    st === 'correct' &&
                      'border-[color:var(--color-success)] bg-[color:var(--color-success)]/10 text-ink-900',
                    st === 'wrong' &&
                      'border-[color:var(--color-danger)] bg-[color:var(--color-danger)]/10 text-ink-900',
                    st === 'missed' &&
                      'border-dashed border-[color:var(--color-success)] bg-surface text-ink-700',
                  )}
                >
                  <input
                    type={q.allowMultiple ? 'checkbox' : 'radio'}
                    name={`${groupId}-${current}`}
                    value={o.id}
                    checked={picked}
                    disabled={isLocked}
                    onChange={() => toggle(o.id)}
                    className="h-4 w-4 shrink-0 accent-brand-600"
                  />
                  <span className="flex-1">{o.text}</span>
                  {st === 'correct' && (
                    <span aria-hidden className="text-[color:var(--color-success)]">✓</span>
                  )}
                  {st === 'wrong' && (
                    <span aria-hidden className="text-[color:var(--color-danger)]">✕</span>
                  )}
                  {st === 'missed' && (
                    <span className="text-xs font-medium text-[color:var(--color-success)]">
                      {correctAnswerLabel}
                    </span>
                  )}
                </label>
              );
            })}
          </div>

          {/* Verdict (revealed instantly on submit, but the running score stays hidden). */}
          <div aria-live="polite" className={cx('mt-4', !isLocked && 'sr-only')}>
            {isLocked && (
              <span
                className={cx(
                  'text-sm font-semibold',
                  locked[current]
                    ? 'text-[color:var(--color-success)]'
                    : 'text-[color:var(--color-danger)]',
                )}
              >
                {locked[current] ? correctLabel : incorrectLabel}
              </span>
            )}
          </div>

          {isLocked && q.explanation && (
            <div className="brutal mt-3 bg-brand-50/70 p-4 text-sm leading-relaxed text-ink-700 animate-fade-up">
              <p className="mb-1 font-display text-xs font-semibold uppercase tracking-wide text-brand-700">
                {explanationLabel}
              </p>
              {q.explanation}
            </div>
          )}

          <div className="mt-5 flex flex-wrap items-center justify-end gap-3">
            {!isLocked ? (
              <button
                type="button"
                onClick={submit}
                disabled={selected.size === 0}
                className={cx(
                  'brutal-btn bg-brand-600 px-5 py-2 text-sm text-white',
                  'hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2',
                  'disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-brand-600',
                )}
              >
                {submitLabel}
              </button>
            ) : (
              <button
                type="button"
                onClick={advance}
                className={cx(
                  'brutal-btn bg-brand-600 px-5 py-2 text-sm text-white',
                  'hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2',
                )}
              >
                {isLast ? seeResultsLabel : nextLabel}
              </button>
            )}
          </div>
          {!isLocked && (
            <p className="mt-2 text-right text-xs text-ink-400">
              {selected.size === 0 ? selectHintLabel : lockWarningLabel}
            </p>
          )}
        </>
      )}
    </section>
  );
}

export default FinalExam;
