/**
 * Roadmaps — content-aware helpers over the pure tag registry in
 * `roadmap-meta.ts`. A roadmap is a curated learning path (a subset of the
 * catalog); since the catalog filters by tag via URL params
 * (`/catalog?tag=basics`), a roadmap needs no dedicated page — just a link.
 */

import { getTopics } from '@/lib/content';
import { roadmaps, type RoadmapMeta } from '@/lib/roadmap-meta';
import { localizePath, type Lang } from '@/i18n/utils';

export { roadmaps, roadmapByTag, roadmapTags, type RoadmapMeta } from '@/lib/roadmap-meta';

/**
 * Canonical link to a roadmap: the catalog pre-filtered to its tag.
 * Single source of truth for every "open this path" link on the site.
 */
export function roadmapHref(tag: string, lang: Lang): string {
  return `${localizePath('/catalog', lang)}?tag=${tag}`;
}

/**
 * Summary of a roadmap for a given locale — includes live course count and
 * the difficulty range of the topics that carry this tag.
 */
export interface RoadmapSummary {
  meta: RoadmapMeta;
  courseCount: number;
  minDifficulty: string;
  maxDifficulty: string;
}

/** Difficulty rank for range comparison. */
const DIFF_RANK: Record<string, number> = {
  beginner: 0,
  intermediate: 1,
  advanced: 2,
  expert: 3,
};

function rankOf(d?: string): number {
  return d && d in DIFF_RANK ? DIFF_RANK[d] : -1;
}

/**
 * Return summaries for every roadmap in display order, with live counts
 * and difficulty ranges from the actual topics collection.
 */
export async function getRoadmapSummaries(lang: Lang): Promise<RoadmapSummary[]> {
  const allTopics = await getTopics(lang);
  return roadmaps.map((meta) => {
    const topics = allTopics.filter((t) => t.entry.data.tags?.includes(meta.tag));
    const difficulties = topics
      .map((t) => t.entry.data.difficulty)
      .filter((d): d is 'beginner' | 'intermediate' | 'advanced' | 'expert' => !!d && d in DIFF_RANK)
      .sort((a, b) => rankOf(a) - rankOf(b));
    return {
      meta,
      courseCount: topics.length,
      minDifficulty: difficulties[0] ?? 'beginner',
      maxDifficulty: difficulties[difficulties.length - 1] ?? 'beginner',
    };
  });
}
