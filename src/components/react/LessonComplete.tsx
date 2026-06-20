import { useEffect, useState } from 'react';
import { cx } from '@/components/react/cx';
import {
  isLessonFinished,
  migrateLegacyCourse,
  onProgressChange,
  setLessonFinished,
} from '@/lib/progress';

/** Props for {@link LessonComplete}. */
export interface LessonCompleteProps {
  /** Bare owning-topic slug — half of the locale-agnostic storage key. */
  topicSlug: string;
  /** Bare lesson slug — the other half of the storage key. */
  lessonSlug: string;
  /** All bare lesson slugs in the course, used to migrate legacy course progress. */
  courseLessonSlugs: string[];
  /** Button label while the lesson is *not* finished. */
  markLabel?: string;
  /** Label/heading once the lesson *is* finished. */
  finishedLabel?: string;
  /** Accessible label for the "undo / mark not complete" control. */
  undoLabel?: string;
  /** Extra classes merged onto the root element. */
  className?: string;
}

/**
 * Per-lesson completion toggle, shown at the foot of every lesson. Progress is
 * stored under the bare `topic/lesson` key (see `@/lib/progress`), so it's
 * locale-agnostic — finishing here also lights up the Spanish twin and feeds
 * the course's `X / Y` count on the catalog. Hydrates from storage on mount to
 * avoid an SSR flash, announces the change via `aria-live`, and respects
 * reduced motion.
 */
export function LessonComplete({
  topicSlug,
  lessonSlug,
  courseLessonSlugs,
  markLabel = 'Mark lesson as complete',
  finishedLabel = 'Lesson complete',
  undoLabel = 'Mark as not complete',
  className,
}: LessonCompleteProps) {
  // `null` = "unknown" so the first paint matches the server (no flash), then
  // resolve from storage on mount and stay in sync with the other islands.
  const [finished, setFinished] = useState<boolean | null>(null);

  useEffect(() => {
    migrateLegacyCourse(topicSlug, courseLessonSlugs);
    const sync = () => setFinished(isLessonFinished(topicSlug, lessonSlug));
    sync();
    return onProgressChange(sync);
  }, [topicSlug, lessonSlug, courseLessonSlugs]);

  const isFinished = finished === true;

  return (
    <section
      aria-live="polite"
      className={cx(
        'mt-12 flex flex-col items-start gap-3 rounded-card border p-5 shadow-soft transition-colors sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:p-6',
        isFinished ? 'border-brand-200 bg-brand-50/60' : 'border-ink-200 bg-surface',
        className,
      )}
    >
      <div className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className={cx(
            'grid h-9 w-9 shrink-0 place-items-center rounded-pill transition-all duration-300 motion-reduce:transition-none',
            isFinished ? 'bg-brand-600 text-white scale-100' : 'bg-ink-100 text-ink-400 scale-95',
          )}
        >
          <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 10.5l3.2 3.2L15 7" />
          </svg>
        </span>
        <p className="font-display font-semibold text-ink-900">
          {isFinished ? finishedLabel : markLabel}
        </p>
      </div>

      <div className="shrink-0">
        {finished === null ? (
          // Pre-hydration placeholder keeps layout stable; never SSR-mismatches.
          <span className="inline-block h-10 w-48 rounded-pill bg-ink-100/60" aria-hidden="true" />
        ) : isFinished ? (
          <button
            type="button"
            onClick={() => setLessonFinished(topicSlug, lessonSlug, false)}
            className="inline-flex items-center gap-2 rounded-pill border border-brand-200 bg-surface px-4 py-2 font-display text-sm font-semibold text-brand-700 transition-colors hover:bg-brand-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
          >
            {undoLabel}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setLessonFinished(topicSlug, lessonSlug, true)}
            className="inline-flex items-center gap-2 rounded-pill bg-brand-600 px-5 py-2.5 font-display text-sm font-semibold text-white shadow-soft transition-all hover:-translate-y-0.5 hover:bg-brand-700 hover:shadow-lift focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
          >
            <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 10.5l3.2 3.2L15 7" />
            </svg>
            {markLabel}
          </button>
        )}
      </div>
    </section>
  );
}

export default LessonComplete;
