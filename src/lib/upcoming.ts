/**
 * Upcoming courses — the build queue, as PURE data (no astro:content imports,
 * so it is safe to import from anywhere). This file is the SINGLE SOURCE OF
 * TRUTH for "what gets built next": each entry is a course that is *planned but
 * not yet built*. The catalog renders these as dimmed "Coming soon" nodes on
 * the dependency graph, wired to their prerequisites exactly like real courses,
 * and on the `/upcoming` page.
 *
 * Two operations are meant to be trivial:
 *
 *   • ADD a planned course → append an `UpcomingCourse` object to the array
 *     below. It immediately shows up on the catalog graph. No other change.
 *
 *   • GRADUATE a course to "created" → once its topic MDX exists under
 *     `src/content/topics/`, DELETE its entry here. The built topic is now the
 *     record; an upcoming entry only describes what is still missing. (Keeping
 *     a slug in both places would draw the node twice.)
 *
 * ── Autonomous daily-agent contract (`scripts/daily-lesson.sh`) ──────────────
 * The daily agent builds the LOWEST-`order` entry, then DELETES that entry.
 *
 *   • Build strictly within the subject scope defined in TOPIC.md (and the
 *     mission in CLAUDE.md). One topic per run, en + es twin.
 *   • Go in order: build the lowest-`order` upcoming entry first. Never build
 *     something easier than the most recently built course (keep the ramp
 *     monotone).
 *   • Use the entry's `buildNotes` as the build brief, its `dependencies`/`tags`
 *     for catalog wiring, and keep the same `slug` for the topic MDX so it
 *     graduates cleanly.
 *   • After building, REMOVE its entry here (the topic MDX is now the record).
 *   • When fewer than 3 entries remain, APPEND the next harder topics (each one
 *     notch up) so the queue never empties.
 *
 * ── TEMPLATE NOTE ──────────────────────────────────────────────────────────
 * The two entries below are EXAMPLES for the placeholder "Getting Started"
 * topic. Replace them with the real build queue for your subject (see TOPIC.md).
 * The `bootstrap-topic` skill seeds this for you.
 */

import type { Difficulty } from '@/lib/catalog-filter';

/** A planned-but-unbuilt course, rendered as a "Coming soon" node. */
export interface UpcomingCourse {
  /** Bare topic slug — the id used to wire dependencies and, later, the MDX. */
  slug: string;
  /** Emoji / icon for the node. */
  icon: string;
  /** Where it sits on the zero-to-expert ladder. */
  difficulty: Difficulty;
  /** Build order — the agent builds the LOWEST order first. */
  order: number;
  /** Accent token suffix used for the node tint (defaults to `brand`). */
  accent?: 'brand' | 'accent';
  /** Bilingual title. */
  title: { en: string; es: string };
  /** Bilingual one-line summary shown on the card. */
  description: { en: string; es: string };
  /** Bare slugs of prerequisite courses (drawn as incoming edges). */
  dependencies?: string[];
  /** Roadmap tags the course will carry — drives the tag filter. */
  tags?: string[];
  /**
   * Free-text build brief for the authoring agent (sub-topics to cover,
   * islands to build). Not rendered in the UI — it is the spec the agent
   * follows when it builds this course.
   */
  buildNotes?: string;
}

/**
 * The queue, in build order. Append to grow it; delete an entry once its topic
 * MDX exists. Keep the same `slug` you intend the built topic to use.
 */
export const upcomingCourses: UpcomingCourse[] = [
  {
    slug: 'core-concepts',
    icon: '🧩',
    difficulty: 'beginner',
    order: 1,
    accent: 'brand',
    title: {
      en: 'Core Concepts',
      es: 'Conceptos Básicos',
    },
    description: {
      en: 'The foundational vocabulary and ideas of the subject — the second step after Getting Started.',
      es: 'El vocabulario y las ideas fundamentales de la materia — el segundo paso tras Primeros Pasos.',
    },
    dependencies: ['getting-started'],
    tags: ['getting-started'],
    buildNotes:
      'EXAMPLE ENTRY — replace with your subject. The first real course after the intro: define the core vocabulary every later course depends on, one ## section per concept, with an analogy, a worked example, a common misconception, and a recap Quiz + MindMap.',
  },
  {
    slug: 'going-deeper',
    icon: '🪜',
    difficulty: 'intermediate',
    order: 2,
    accent: 'accent',
    title: {
      en: 'Going Deeper',
      es: 'Profundizando',
    },
    description: {
      en: 'Builds on the core concepts toward real, applied understanding.',
      es: 'Construye sobre los conceptos básicos hacia una comprensión real y aplicada.',
    },
    dependencies: ['core-concepts'],
    tags: ['getting-started'],
    buildNotes:
      'EXAMPLE ENTRY — replace with your subject. The intermediate rung: assume Core Concepts is complete and push into applied, slightly rigorous territory with at least one teaching animation island.',
  },
];

/** Quick lookup by slug. */
export const upcomingBySlug = new Map<string, UpcomingCourse>(
  upcomingCourses.map((c) => [c.slug, c]),
);
