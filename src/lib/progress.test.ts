/**
 * Unit tests for the progress store. Run with `bun test`.
 *
 * The store guards `typeof window === 'undefined'`, so each test installs a
 * minimal in-memory `window` (localStorage + dispatchEvent) before importing
 * is irrelevant — the module reads `window` lazily at call time.
 */
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import {
  courseProgress,
  getFinishedLessons,
  isCourseFinished,
  isLessonFinished,
  lessonKey,
  migrateLegacyCourse,
  setCourseFinished,
  setLessonFinished,
} from './progress';

const LESSONS_KEY = 'lessons:finished-lessons';
const LEGACY_KEY = 'lessons:finished-courses';

/** Minimal localStorage stand-in. */
class MemStorage {
  private store = new Map<string, string>();
  getItem(k: string): string | null {
    return this.store.has(k) ? this.store.get(k)! : null;
  }
  setItem(k: string, v: string): void {
    this.store.set(k, String(v));
  }
  removeItem(k: string): void {
    this.store.delete(k);
  }
  clear(): void {
    this.store.clear();
  }
}

beforeEach(() => {
  (globalThis as Record<string, unknown>).window = {
    localStorage: new MemStorage(),
    dispatchEvent: () => true,
    addEventListener: () => {},
    removeEventListener: () => {},
  };
  if (typeof (globalThis as Record<string, unknown>).CustomEvent === 'undefined') {
    (globalThis as Record<string, unknown>).CustomEvent = class {
      type: string;
      constructor(type: string) {
        this.type = type;
      }
    };
  }
});

afterEach(() => {
  delete (globalThis as Record<string, unknown>).window;
});

/** Seed localStorage directly. */
function seed(key: string, value: string[]): void {
  (window.localStorage as unknown as MemStorage).setItem(key, JSON.stringify(value));
}

describe('lessonKey', () => {
  test('is a bare, locale-agnostic topic/lesson key', () => {
    expect(lessonKey('topic', 'intro')).toBe('topic/intro');
  });
});

describe('per-lesson completion', () => {
  test('set then read round-trips', () => {
    expect(isLessonFinished('topic', 'intro')).toBe(false);
    setLessonFinished('topic', 'intro', true);
    expect(isLessonFinished('topic', 'intro')).toBe(true);
    expect(getFinishedLessons().has('topic/intro')).toBe(true);
    setLessonFinished('topic', 'intro', false);
    expect(isLessonFinished('topic', 'intro')).toBe(false);
  });

  test('completion is shared across locales (same bare key)', () => {
    // A lesson finished while browsing the English page...
    setLessonFinished('topic', 'intro', true);
    // ...is the same bare key the Spanish page reads.
    expect(isLessonFinished('topic', 'intro')).toBe(true);
    expect(getFinishedLessons().size).toBe(1);
  });
});

describe('courseProgress', () => {
  test('counts finished lessons out of the total', () => {
    setLessonFinished('topic', 'a', true);
    const p = courseProgress('topic', ['a', 'b', 'c']);
    expect(p).toEqual({ completed: 1, total: 3, finished: false });
  });

  test('is finished only when every lesson is done', () => {
    setLessonFinished('topic', 'a', true);
    setLessonFinished('topic', 'b', true);
    expect(isCourseFinished('topic', ['a', 'b'])).toBe(true);
    expect(isCourseFinished('topic', ['a', 'b', 'c'])).toBe(false);
  });

  test('an empty course is never finished', () => {
    expect(courseProgress('topic', [])).toEqual({ completed: 0, total: 0, finished: false });
    expect(isCourseFinished('topic', [])).toBe(false);
  });
});

describe('setCourseFinished', () => {
  test('marks all lessons, then unmarks all', () => {
    setCourseFinished('topic', ['a', 'b', 'c'], true);
    expect(courseProgress('topic', ['a', 'b', 'c']).completed).toBe(3);
    expect(isLessonFinished('topic', 'b')).toBe(true);

    setCourseFinished('topic', ['a', 'b', 'c'], false);
    expect(courseProgress('topic', ['a', 'b', 'c']).completed).toBe(0);
    expect(isLessonFinished('topic', 'b')).toBe(false);
  });

  test('unmarking clears a stale legacy whole-course flag too', () => {
    seed(LEGACY_KEY, ['topic']);
    // Without unmarking, the legacy flag still counts the course complete.
    expect(isCourseFinished('topic', ['a', 'b'])).toBe(true);
    setCourseFinished('topic', ['a', 'b'], false);
    expect(isCourseFinished('topic', ['a', 'b'])).toBe(false);
  });
});

describe('legacy migration', () => {
  test('a flagged course becomes per-lesson complete and the flag is dropped', () => {
    seed(LEGACY_KEY, ['topic', 'other']);
    migrateLegacyCourse('topic', ['a', 'b']);

    // Lessons are now individually finished...
    expect(isLessonFinished('topic', 'a')).toBe(true);
    expect(isLessonFinished('topic', 'b')).toBe(true);
    // ...and the legacy flag for this course is gone (others untouched).
    const legacy = JSON.parse(window.localStorage.getItem(LEGACY_KEY)!);
    expect(legacy).toEqual(['other']);
  });

  test('after migration a single lesson can be unmarked normally', () => {
    seed(LEGACY_KEY, ['topic']);
    migrateLegacyCourse('topic', ['a', 'b']);
    setLessonFinished('topic', 'a', false);
    expect(courseProgress('topic', ['a', 'b'])).toEqual({ completed: 1, total: 2, finished: false });
  });

  test('is a no-op for a course that was never flagged', () => {
    migrateLegacyCourse('topic', ['a', 'b']);
    expect(getFinishedLessons().size).toBe(0);
    expect(window.localStorage.getItem(LESSONS_KEY)).toBeNull();
  });
});
