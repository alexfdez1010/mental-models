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
 * ── Mental Models build queue ───────────────────────────────────────────────
 * The zero-to-expert ladder of models still to build (see TOPIC.md). The first
 * course, `what-are-mental-models`, has graduated and been removed. Lowest
 * `order` is built next; keep the ramp monotone in difficulty.
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
    slug: 'thinking-in-probabilities',
    icon: '🎲',
    difficulty: 'intermediate',
    order: 6,
    accent: 'accent',
    title: {
      en: 'Thinking in Probabilities',
      es: 'Pensar en Probabilidades',
    },
    description: {
      en: 'Swap true/false for odds. Base rates, expected value, and the habit of asking “how likely?” instead of “is it possible?”',
      es: 'Cambia verdadero/falso por probabilidades. Tasas base, valor esperado y el hábito de preguntar «¿qué probabilidad hay?» en vez de «¿es posible?».',
    },
    dependencies: ['what-are-mental-models'],
    tags: ['probability', 'decision-making'],
    buildNotes:
      'Foundations of probabilistic thinking. Sections: possibility vs. probability; base rates (the outside view) and the base-rate fallacy; expected value = Σ(probability × payoff) with worked numeric examples; thinking in ranges not point estimates. Use KaTeX for the EV formula and at least one worked table. Build an interactive EV calculator / base-rate visualizer island (e.g. a dot grid showing a base rate). Pitfall: confusing a good decision with a good outcome. Recap Quiz. en + es twin. This sets up the advanced Probability & Uncertainty path (Bayesian updating, fat tails).',
  },
  {
    slug: 'feedback-loops',
    icon: '🔄',
    difficulty: 'advanced',
    order: 7,
    accent: 'accent',
    title: {
      en: 'Feedback Loops & Systems Thinking',
      es: 'Bucles de Retroalimentación y Pensamiento Sistémico',
    },
    description: {
      en: 'Why systems run away, settle down, or oscillate. Reinforcing loops amplify, balancing loops resist, and delays make both misbehave — the engine room beneath second-order effects.',
      es: 'Por qué los sistemas se disparan, se estabilizan u oscilan. Los bucles reforzadores amplifican, los equilibradores resisten y los retardos descontrolan a ambos: la sala de máquinas bajo los efectos de segundo orden.',
    },
    dependencies: ['second-order-thinking'],
    tags: ['systems-thinking', 'science-engineering'],
    buildNotes:
      'Systems & feedback, the advanced rung above second-order thinking. Sections: stocks vs. flows; reinforcing (amplifying) loops — compounding, viral growth, bank runs; balancing (stabilizing) loops — thermostats, predator–prey, market clearing; the role of delays (why loops overshoot and oscillate, e.g. the shower-temperature lag, the beer-game bullwhip); leverage points (where to push a system). Worked examples with simple stock-and-flow numbers and at least one oscillation traced over time. Build an interactive loop-simulator island (a stock with an adjustable reinforcing/balancing rate + delay slider, plotting the trajectory; respect prefers-reduced-motion). Connect explicitly to second-order thinking (loops are *why* downstream effects compound) and to incentives. Pitfall: assuming systems move linearly / ignoring delay. Recap Quiz + MindMap. en + es twin.',
  },
  {
    slug: 'bayesian-updating',
    icon: '🔁',
    difficulty: 'advanced',
    order: 8,
    accent: 'brand',
    title: {
      en: 'Bayesian Updating',
      es: 'Actualización Bayesiana',
    },
    description: {
      en: 'Change your mind by degrees, not all at once. Start from a base rate, weigh the new evidence, and land on a calibrated new belief instead of overreacting to the latest headline.',
      es: 'Cambia de opinión por grados, no de golpe. Parte de una tasa base, pondera la nueva evidencia y llega a una creencia nueva y calibrada en vez de sobrerreaccionar al último titular.',
    },
    dependencies: ['thinking-in-probabilities'],
    tags: ['probability', 'decision-making'],
    buildNotes:
      'Bayesian updating — the advanced probability rung above Thinking in Probabilities. Sections: prior, likelihood, posterior in plain language; the base rate as your prior (links back to the base-rate fallacy); the canonical medical-test worked example (rare disease + imperfect test → surprisingly low posterior) done with real numbers and a natural-frequency tree; updating incrementally as evidence arrives; strength of evidence (likelihood ratios) vs. weight of the prior; why extraordinary claims need extraordinary evidence. Use KaTeX for Bayes’ theorem and at least one frequency table; build an interactive posterior-calculator / natural-frequency-grid island (sliders for base rate, true-positive, false-positive → live posterior). Connect to second-order thinking (a posterior is the input to the next decision) and calibration. Pitfall: ignoring the base rate; confusing P(evidence|hypothesis) with P(hypothesis|evidence). Recap Quiz + MindMap. en + es twin. Sets up fat tails and calibration on the expert tier.',
  },
];

/** Quick lookup by slug. */
export const upcomingBySlug = new Map<string, UpcomingCourse>(
  upcomingCourses.map((c) => [c.slug, c]),
);
