/**
 * content.ts — shared, typed helpers over the `topics` and `lessons`
 * collections. Centralizes draft filtering, sorting, slug derivation and the
 * getStaticPaths path-builders so the en/es route files stay tiny.
 *
 * Conventions:
 * - Collection ids are "<lang>/<topic>" (topics) and "<lang>/<topic>/<lesson>"
 *   (lessons). We expose BARE slugs (no locale) for routing + localizePath().
 * - Drafts are hidden in production but visible in `astro dev`.
 */
import { getCollection, getEntry, type CollectionEntry } from 'astro:content';
import { parseId, localizePath, locales, type Lang } from '@/i18n/utils';

type TopicEntry = CollectionEntry<'topics'>;
type LessonEntry = CollectionEntry<'lessons'>;

/** Drafts are shown in dev, hidden in production builds. */
const includeDrafts = import.meta.env.DEV;

/** A topic with its locale + bare slug resolved from the id. */
export interface TopicView {
  entry: TopicEntry;
  lang: Lang;
  /** Bare topic slug, no locale prefix (e.g. "photography"). */
  slug: string;
}

/** A lesson with its locale + bare topic/lesson slugs resolved from the id. */
export interface LessonView {
  entry: LessonEntry;
  lang: Lang;
  /** Bare owning-topic slug. */
  topicSlug: string;
  /** Bare lesson slug. */
  lessonSlug: string;
}

/** A localized hreflang/alternate target. */
export interface AlternateLink {
  lang: Lang;
  href: string;
}

const keep = (data: { draft?: boolean }): boolean => includeDrafts || !data.draft;
const byOrder = (a: { data: { order: number } }, b: { data: { order: number } }): number =>
  a.data.order - b.data.order;

/** Zero-to-expert ladder rank — drives the catalog's primary sort. */
const DIFFICULTY_RANK: Record<string, number> = {
  beginner: 0,
  intermediate: 1,
  advanced: 2,
  expert: 3,
};

/**
 * Catalog sort: difficulty tier first (beginner → expert, the zero-to-expert
 * ladder), then the manual `order`, then title as a stable tiebreaker. This is
 * the order courses appear in the catalog graph (within each dependency layer)
 * so the path always reads easy → hard. Topics with no difficulty sort last.
 */
const byDifficultyThenOrder = (
  a: { data: { difficulty?: string; order: number; title: string } },
  b: { data: { difficulty?: string; order: number; title: string } },
): number => {
  const ra = DIFFICULTY_RANK[a.data.difficulty ?? ''] ?? Number.MAX_SAFE_INTEGER;
  const rb = DIFFICULTY_RANK[b.data.difficulty ?? ''] ?? Number.MAX_SAFE_INTEGER;
  if (ra !== rb) return ra - rb;
  if (a.data.order !== b.data.order) return a.data.order - b.data.order;
  return a.data.title.localeCompare(b.data.title);
};

/** Map a topic entry to its bare slug (drops the locale prefix). */
export function topicSlugOf(entry: TopicEntry): string {
  return parseId(entry.id).topic;
}

/** Map a lesson entry to its bare { topicSlug, lessonSlug }. */
export function lessonSlugsOf(entry: LessonEntry): { topicSlug: string; lessonSlug: string } {
  const { topic, lesson } = parseId(entry.id);
  return { topicSlug: topic, lessonSlug: lesson ?? '' };
}

/**
 * Non-draft topics for a locale, sorted by `order`, each with its bare slug.
 */
export async function getTopics(lang: Lang): Promise<TopicView[]> {
  const all = await getCollection('topics', ({ id, data }) => {
    return parseId(id).lang === lang && keep(data);
  });
  return all.sort(byDifficultyThenOrder).map((entry) => ({
    entry,
    lang,
    slug: topicSlugOf(entry),
  }));
}

/**
 * Non-draft lessons for a locale (optionally a single topic), sorted by
 * `order`, each with bare topic/lesson slugs.
 */
export async function getLessons(lang: Lang, topicSlug?: string): Promise<LessonView[]> {
  const all = await getCollection('lessons', ({ id, data }) => {
    const { lang: l, topic } = parseId(id);
    if (l !== lang) return false;
    if (topicSlug && topic !== topicSlug) return false;
    return keep(data);
  });
  return all.sort(byOrder).map((entry) => {
    const { topicSlug: ts, lessonSlug } = lessonSlugsOf(entry);
    return { entry, lang, topicSlug: ts, lessonSlug };
  });
}

/** Count of non-draft lessons within a topic (for catalog cards). */
export async function getLessonCount(lang: Lang, topicSlug: string): Promise<number> {
  const lessons = await getLessons(lang, topicSlug);
  return lessons.length;
}

/**
 * Previous/next lesson within the same topic, by `order`. Each neighbor is a
 * { title, href } using a localized path, or null at the ends.
 */
export async function getLessonNeighbors(
  lang: Lang,
  topicSlug: string,
  lessonSlug: string,
): Promise<{
  prev: { title: string; href: string } | null;
  next: { title: string; href: string } | null;
}> {
  const lessons = await getLessons(lang, topicSlug);
  const idx = lessons.findIndex((l) => l.lessonSlug === lessonSlug);
  if (idx === -1) return { prev: null, next: null };

  const toLink = (l: LessonView | undefined) =>
    l
      ? { title: l.entry.data.title, href: localizePath(`/${l.topicSlug}/${l.lessonSlug}`, lang) }
      : null;

  return {
    prev: toLink(lessons[idx - 1]),
    next: toLink(lessons[idx + 1]),
  };
}

/**
 * hreflang alternates for a bare topic path (e.g. "/photography").
 * Includes only locales where the topic entry EXISTS; missing locales fall
 * back to that locale's home. The current locale is always represented.
 */
export async function getTopicAlternates(
  bareTopicPath: string,
): Promise<AlternateLink[]> {
  const slug = bareTopicPath.replace(/^\/+/, '').split('/')[0];
  const out: AlternateLink[] = [];
  for (const lang of locales) {
    const entry = await getEntry('topics', `${lang}/${slug}`);
    const exists = entry && keep(entry.data);
    out.push({
      lang,
      href: exists ? localizePath(`/${slug}`, lang) : localizePath('/', lang),
    });
  }
  return out;
}

/**
 * hreflang alternates for a bare lesson path (e.g. "/photography/exposure").
 * Includes only locales where the lesson entry EXISTS; missing locales fall
 * back to that locale's home. The current locale is always represented.
 */
export async function getAlternates(
  bareLessonPath: string,
): Promise<AlternateLink[]> {
  const parts = bareLessonPath.replace(/^\/+/, '').split('/');
  const [topicSlug, lessonSlug] = parts;
  const out: AlternateLink[] = [];
  for (const lang of locales) {
    const entry = lessonSlug
      ? await getEntry('lessons', `${lang}/${topicSlug}/${lessonSlug}`)
      : undefined;
    const exists = entry && keep(entry.data);
    out.push({
      lang,
      href: exists
        ? localizePath(`/${topicSlug}/${lessonSlug}`, lang)
        : localizePath('/', lang),
    });
  }
  return out;
}

/**
 * getStaticPaths builder for topic landing pages. Returns one path per
 * non-draft topic in the locale, params: { topic: bareSlug }.
 */
export async function topicPaths(lang: Lang): Promise<
  { params: { topic: string }; props: { lang: Lang; topicSlug: string } }[]
> {
  const topics = await getTopics(lang);
  return topics.map((t) => ({
    params: { topic: t.slug },
    props: { lang, topicSlug: t.slug },
  }));
}

/**
 * getStaticPaths builder for lesson pages. Returns one path per non-draft
 * lesson in the locale, params: { topic, lesson } (bare slugs).
 */
export async function lessonPaths(lang: Lang): Promise<
  {
    params: { topic: string; lesson: string };
    props: { lang: Lang; topicSlug: string; lessonSlug: string };
  }[]
> {
  const lessons = await getLessons(lang);
  return lessons.map((l) => ({
    params: { topic: l.topicSlug, lesson: l.lessonSlug },
    props: { lang, topicSlug: l.topicSlug, lessonSlug: l.lessonSlug },
  }));
}

/** Look up a topic entry by locale + bare slug (or null). */
export async function getTopicEntry(
  lang: Lang,
  topicSlug: string,
): Promise<TopicEntry | null> {
  const entry = await getEntry('topics', `${lang}/${topicSlug}`);
  return entry ?? null;
}

/** Look up a lesson entry by locale + bare slugs (or null). */
export async function getLessonEntry(
  lang: Lang,
  topicSlug: string,
  lessonSlug: string,
): Promise<LessonEntry | null> {
  const entry = await getEntry('lessons', `${lang}/${topicSlug}/${lessonSlug}`);
  return entry ?? null;
}
