import { defineCollection, reference, z } from 'astro:content';
import { glob } from 'astro/loaders';

/**
 * Content model
 * -------------
 * A "topic" is a subject (e.g. "photography"). It owns many "lessons".
 * URLs are slug-based and SEO-friendly:
 *   /<topic>            -> topic landing page      (topics collection id)
 *   /<topic>/<lesson>   -> a single lesson page    (lessons collection id)
 *
 * File layout:
 *   src/content/topics/<topic>.mdx
 *   src/content/lessons/<topic>/<lesson>.mdx
 *
 * The lesson id (used for the slug) is "<topic>/<lesson>" thanks to the glob
 * pattern below, so routing can split on "/".
 */

const seo = z
  .object({
    /** Override the <title>. Defaults to the page title. */
    title: z.string().optional(),
    /** Override the meta description. Defaults to `description`. */
    description: z.string().optional(),
    /** Override the generated OG image path (e.g. "/og/custom.png"). */
    ogImage: z.string().optional(),
    /** Comma-free list of keywords for the meta keywords tag. */
    keywords: z.array(z.string()).default([]),
    /** Exclude from sitemap + add noindex when true. */
    noindex: z.boolean().default(false),
  })
  .default({ keywords: [], noindex: false });

const topics = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/topics' }),
  schema: z.object({
    title: z.string(),
    /** One-line summary shown on cards + used as default meta description. */
    description: z.string(),
    /** Short tagline rendered under the hero title. */
    tagline: z.string().optional(),
    /** Emoji or short label for the topic chip. */
    icon: z.string().default('📘'),
    /** Sort order within the catalog. Lower = earlier. */
    order: z.number().default(999),
    /** Accent color token suffix, e.g. "brand" | "accent". */
    accent: z.enum(['brand', 'accent']).default('brand'),
    /**
     * How demanding the course is, shown as a badge on the catalog and used to
     * signal the zero-to-expert path. `beginner` assumes **no prior
     * knowledge of the subject**; `expert` is the deepest, most demanding tier.
     * Locale-agnostic: set the same value in the en and es twins.
     */
    difficulty: z.enum(['beginner', 'intermediate', 'advanced', 'expert']).default('beginner'),
    /**
     * Bare slugs of prerequisite topics, used to draw the catalog dependency
     * graph (roadmap.sh-style). Locale-agnostic: list the same slugs in the en
     * and es twins. Unknown slugs are ignored, so adding a course is just a new
     * MDX file with its `dependencies` array — no code changes.
     */
    dependencies: z.array(z.string()).default([]),
    tags: z.array(z.string()).default([]),
    draft: z.boolean().default(false),
    seo,
  }),
});

const lessons = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/lessons' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    /** Reference to the owning topic (its collection id). */
    topic: reference('topics'),
    /** Position within the topic. Lower = earlier. */
    order: z.number().default(999),
    /** Estimated read/work time, minutes. */
    minutes: z.number().optional(),
    draft: z.boolean().default(false),
    updated: z.coerce.date().optional(),
    seo,
  }),
});

export const collections = { topics, lessons };
