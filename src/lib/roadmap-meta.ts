/**
 * Roadmap metadata — PURE data, no astro:content imports, so it is safe to
 * import from anywhere including `astro.config.mjs` (which uses it to emit a
 * 301 redirect per tag from the retired /roadmap/<tag> pages to the catalog's
 * `?tag=` filter). A roadmap is a curated learning path (a subset of the
 * catalog) with a bilingual title, description, and icon. The tag itself
 * lives on each topic's frontmatter (`tags:`), so adding a course to a
 * roadmap is just editing its MDX file — no code changes here.
 *
 * ── TEMPLATE NOTE ──────────────────────────────────────────────────────────
 * Replace the example roadmap below with the learning paths (tag taxonomy) for
 * your subject — see TOPIC.md ("Tag taxonomy"). Each entry's `tag` must match a
 * `tags:` value used in your topic MDX frontmatter. The `bootstrap-topic` skill
 * helps you define these.
 */

export interface RoadmapMeta {
  /** Tag slug — matches the `tags:` value in topic MDX frontmatter. */
  tag: string;
  /** Emoji / icon for the roadmap card. */
  icon: string;
  /** Bilingual title. */
  title: { en: string; es: string };
  /** Bilingual one-line description. */
  description: { en: string; es: string };
  /** Display order on the home page (lower = earlier). */
  order: number;
}

/** All defined roadmaps, in display order. */
export const roadmaps: RoadmapMeta[] = [
  {
    tag: 'getting-started',
    icon: '🌱',
    order: 0,
    title: { en: 'Getting Started', es: 'Primeros Pasos' },
    description: {
      en: 'The zero-to-first-steps path — start here. No prior knowledge assumed.',
      es: 'El camino de cero a los primeros pasos — empieza aquí. Sin conocimientos previos.',
    },
  },
];

/** Quick lookup by tag. */
export const roadmapByTag = new Map<string, RoadmapMeta>(roadmaps.map((r) => [r.tag, r]));

/** All tag slugs in order. */
export const roadmapTags: string[] = roadmaps.map((r) => r.tag);
