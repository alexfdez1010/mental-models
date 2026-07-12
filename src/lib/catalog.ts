/**
 * Catalog view-model builders — the shared frontmatter logic behind the
 * en/es catalog pages (and any page that renders a CourseGraph). Keeping the
 * node/label/tag-option assembly here means the locale pages only differ in
 * `lang` and copy, never in logic.
 */

import type { CourseNode, TagOption } from '@/components/react';
import { getTopics, getLessons } from '@/lib/content';
import { getRoadmapSummaries } from '@/lib/roadmaps';
import type { Difficulty } from '@/lib/catalog-filter';
import { useTranslations, localizePath, type Lang } from '@/i18n/utils';

/**
 * Every topic as a CourseGraph node, with live lesson counts.
 */
export async function getCourseNodes(lang: Lang): Promise<CourseNode[]> {
  const topics = await getTopics(lang);
  const lessonsByTopic = await Promise.all(topics.map((tp) => getLessons(lang, tp.slug)));
  const built: CourseNode[] = topics.map((tp, i) => ({
    slug: tp.slug,
    title: tp.entry.data.title,
    description: tp.entry.data.description,
    icon: tp.entry.data.icon,
    href: localizePath(`/${tp.slug}`, lang),
    lessons: lessonsByTopic[i].length,
    lessonSlugs: lessonsByTopic[i].map((l) => l.lessonSlug),
    accent: tp.entry.data.accent,
    difficulty: tp.entry.data.difficulty,
    dependencies: tp.entry.data.dependencies,
    tags: tp.entry.data.tags,
  }));
  return built;
}

/** Localized name for each difficulty tier. */
export function getDifficultyLabels(lang: Lang): Record<Difficulty, string> {
  const t = useTranslations(lang);
  return {
    beginner: t('difficulty.beginner'),
    intermediate: t('difficulty.intermediate'),
    advanced: t('difficulty.advanced'),
    expert: t('difficulty.expert'),
  };
}

/** Roadmap tags as filter-bar options, localized and in display order. */
export async function getTagOptions(lang: Lang): Promise<TagOption[]> {
  const summaries = await getRoadmapSummaries(lang);
  return summaries.map((r) => ({
    tag: r.meta.tag,
    label: r.meta.title[lang],
    icon: r.meta.icon,
  }));
}
