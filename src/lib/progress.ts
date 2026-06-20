/**
 * Learning progress — a tiny, framework-agnostic localStorage store shared by
 * the per-lesson "mark complete" button, the topic-page course control, and the
 * catalog graph.
 *
 * Progress is tracked **per lesson**: the store is a set of bare
 * `"<topicSlug>/<lessonSlug>"` keys (no locale prefix), so finishing a lesson
 * in English shows it finished in Spanish and vice versa. A *course* is
 * considered finished when every one of its lessons is — derived, never stored
 * on its own.
 *
 * All mutations broadcast a same-tab event so every island on the page reacts
 * instantly, while the native `storage` event keeps other tabs in sync. Every
 * access is SSR-safe (guards `window`) and tolerant of corrupt/blocked storage,
 * so a private-mode browser or a stale value never throws.
 *
 * Legacy: an older build stored a set of finished *course* slugs under
 * `lessons:finished-courses`. We still honor it — a course flagged there counts
 * as fully complete — and {@link migrateLegacyCourse} folds it into the
 * per-lesson store the moment a caller knows the course's lesson list.
 */

/** Per-lesson completion: a set of bare `"topic/lesson"` keys. */
const LESSONS_KEY = 'lessons:finished-lessons';
/** Legacy per-course flag (set of bare topic slugs) — read for back-compat. */
const LEGACY_COURSES_KEY = 'lessons:finished-courses';
/** Same-tab signal (the `storage` event only fires in *other* tabs). */
const EVENT = 'lessons:progress-change';

/** The stable, locale-agnostic key for one lesson. */
export function lessonKey(topicSlug: string, lessonSlug: string): string {
  return `${topicSlug}/${lessonSlug}`;
}

/** Read a JSON string-array localStorage key into a Set; never throws. */
function readSet(key: string): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? new Set(parsed.filter((s): s is string => typeof s === 'string'))
      : new Set();
  } catch {
    return new Set();
  }
}

/** Persist a Set as a JSON string array; swallows quota/blocked errors. */
function writeSet(key: string, set: Set<string>): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify([...set]));
  } catch {
    // Storage blocked (private mode / quota) — keep the UI responsive anyway.
  }
}

/** Broadcast a same-tab change so every island re-reads storage. */
function notify(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(EVENT));
}

/** Read the raw set of finished `"topic/lesson"` keys; never throws. */
export function getFinishedLessons(): Set<string> {
  return readSet(LESSONS_KEY);
}

/** Read the legacy set of finished course slugs; never throws. */
export function getLegacyFinishedCourses(): Set<string> {
  return readSet(LEGACY_COURSES_KEY);
}

/** Whether a single lesson is marked finished. */
export function isLessonFinished(topicSlug: string, lessonSlug: string): boolean {
  return getFinishedLessons().has(lessonKey(topicSlug, lessonSlug));
}

/** Persist the finished/unfinished state for one lesson and notify listeners. */
export function setLessonFinished(topicSlug: string, lessonSlug: string, finished: boolean): void {
  if (typeof window === 'undefined') return;
  const set = getFinishedLessons();
  const k = lessonKey(topicSlug, lessonSlug);
  if (finished) set.add(k);
  else set.delete(k);
  writeSet(LESSONS_KEY, set);
  notify();
}

/** A course's completion, derived from its lesson list. */
export interface CourseProgress {
  /** Lessons marked finished. */
  completed: number;
  /** Lessons in the course. */
  total: number;
  /** True only when every lesson is finished (and there is at least one). */
  finished: boolean;
}

/**
 * Completion of one course over its `lessonSlugs`. A legacy whole-course flag
 * counts every lesson as done (until {@link migrateLegacyCourse} runs). Pass
 * pre-read `finishedLessons`/`legacyCourses` snapshots to score many courses
 * against a single storage read (the catalog graph does this).
 */
export function courseProgress(
  topicSlug: string,
  lessonSlugs: string[],
  finishedLessons?: Set<string>,
  legacyCourses?: Set<string>,
): CourseProgress {
  const set = finishedLessons ?? getFinishedLessons();
  const legacy = legacyCourses ?? getLegacyFinishedCourses();
  const legacyDone = legacy.has(topicSlug);
  const total = lessonSlugs.length;
  let completed = 0;
  for (const ls of lessonSlugs) {
    if (legacyDone || set.has(lessonKey(topicSlug, ls))) completed++;
  }
  return { completed, total, finished: total > 0 && completed === total };
}

/** Whether every lesson of a course is finished. */
export function isCourseFinished(topicSlug: string, lessonSlugs: string[]): boolean {
  return courseProgress(topicSlug, lessonSlugs).finished;
}

/**
 * Mark/unmark a whole course: marking flags every lesson finished, unmarking
 * clears them all. Also drops any legacy whole-course flag so it can't silently
 * re-complete a lesson the learner just unmarked.
 */
export function setCourseFinished(topicSlug: string, lessonSlugs: string[], finished: boolean): void {
  if (typeof window === 'undefined') return;
  const set = getFinishedLessons();
  for (const ls of lessonSlugs) {
    const k = lessonKey(topicSlug, ls);
    if (finished) set.add(k);
    else set.delete(k);
  }
  writeSet(LESSONS_KEY, set);
  const legacy = getLegacyFinishedCourses();
  if (legacy.has(topicSlug)) {
    legacy.delete(topicSlug);
    writeSet(LEGACY_COURSES_KEY, legacy);
  }
  notify();
}

/**
 * Fold a legacy `lessons:finished-courses` flag into the per-lesson store: if
 * the course was flagged finished, every one of its lessons is recorded
 * finished and the legacy flag is dropped. Idempotent and a no-op once
 * migrated, so it's safe to call on every mount where a lesson list is known.
 */
export function migrateLegacyCourse(topicSlug: string, lessonSlugs: string[]): void {
  if (typeof window === 'undefined' || lessonSlugs.length === 0) return;
  const legacy = getLegacyFinishedCourses();
  if (!legacy.has(topicSlug)) return;
  const set = getFinishedLessons();
  for (const ls of lessonSlugs) set.add(lessonKey(topicSlug, ls));
  legacy.delete(topicSlug);
  writeSet(LESSONS_KEY, set);
  writeSet(LEGACY_COURSES_KEY, legacy);
  notify();
}

/** Schema version stamped on an export; bump only on a breaking shape change. */
const EXPORT_VERSION = 1;
/** Marker proving a file is ours before we trust its contents. */
const EXPORT_APP = 'lessons';

/** A portable snapshot of all learning progress — the shape of the export file. */
export interface ProgressExport {
  /** Always `"lessons"` — identifies the file as a Lessons progress export. */
  app: typeof EXPORT_APP;
  /** Export schema version (see {@link EXPORT_VERSION}). */
  version: number;
  /** ISO timestamp the snapshot was taken. */
  exportedAt: string;
  /** Finished `"topic/lesson"` keys. */
  lessons: string[];
  /** Legacy finished whole-course slugs (carried for back-compat). */
  legacyCourses: string[];
}

/** Build a portable snapshot of every finished lesson on this device. */
export function exportProgress(): ProgressExport {
  return {
    app: EXPORT_APP,
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    lessons: [...getFinishedLessons()].sort(),
    legacyCourses: [...getLegacyFinishedCourses()].sort(),
  };
}

/** Serialize {@link exportProgress} to a pretty JSON string ready for download. */
export function serializeProgress(): string {
  return JSON.stringify(exportProgress(), null, 2);
}

/** Outcome of an {@link importProgress} merge. */
export interface ImportResult {
  /** Lessons newly marked finished (ones not already complete here). */
  added: number;
  /** Total finished lessons after the merge. */
  total: number;
}

/**
 * Merge a previously exported snapshot into this device's progress. Parsing is
 * defensive: a non-object or wrong-`app` payload throws so the caller can show
 * an error. The merge is a **union** — it only ever adds finished lessons,
 * never unmarks one — so importing from another device can't lose progress.
 */
export function importProgress(data: unknown): ImportResult {
  if (typeof window === 'undefined') return { added: 0, total: 0 };
  if (!data || typeof data !== 'object') throw new Error('Not a progress file.');
  const payload = data as Partial<ProgressExport>;
  if (payload.app !== EXPORT_APP) throw new Error('Not a Lessons progress file.');

  const incoming = Array.isArray(payload.lessons)
    ? payload.lessons.filter((s): s is string => typeof s === 'string')
    : [];
  const incomingLegacy = Array.isArray(payload.legacyCourses)
    ? payload.legacyCourses.filter((s): s is string => typeof s === 'string')
    : [];

  const set = getFinishedLessons();
  const before = set.size;
  for (const k of incoming) set.add(k);
  writeSet(LESSONS_KEY, set);

  if (incomingLegacy.length > 0) {
    const legacy = getLegacyFinishedCourses();
    for (const c of incomingLegacy) legacy.add(c);
    writeSet(LEGACY_COURSES_KEY, legacy);
  }
  notify();
  return { added: set.size - before, total: set.size };
}

/** Parse a JSON string and {@link importProgress} it; throws on bad JSON/shape. */
export function importProgressJson(json: string): ImportResult {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    throw new Error('That file isn’t valid JSON.');
  }
  return importProgress(data);
}

/**
 * Subscribe to any change in completion state (this tab or another). Returns an
 * unsubscribe function. The callback fires on:
 *  - the same-tab custom event (a button on this page toggled state),
 *  - the cross-tab native `storage` event (another tab toggled state),
 *  - `pageshow` with `persisted` (the page was restored from the back/forward
 *    bfcache — its islands never re-mounted, so we re-read storage by hand),
 *  - `visibilitychange` back to visible (cheap catch-all when returning to a
 *    backgrounded tab).
 */
export function onProgressChange(cb: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const onStorage = (e: StorageEvent) => {
    if (e.key === null || e.key === LESSONS_KEY || e.key === LEGACY_COURSES_KEY) cb();
  };
  const onPageShow = (e: PageTransitionEvent) => {
    if (e.persisted) cb();
  };
  const onVisible = () => {
    if (document.visibilityState === 'visible') cb();
  };
  window.addEventListener(EVENT, cb);
  window.addEventListener('storage', onStorage);
  window.addEventListener('pageshow', onPageShow);
  document.addEventListener('visibilitychange', onVisible);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener('storage', onStorage);
    window.removeEventListener('pageshow', onPageShow);
    document.removeEventListener('visibilitychange', onVisible);
  };
}
