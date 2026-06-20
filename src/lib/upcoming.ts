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
    slug: 'first-principles-thinking',
    icon: '🔬',
    difficulty: 'beginner',
    order: 2,
    accent: 'accent',
    title: {
      en: 'First-Principles Thinking',
      es: 'Pensar desde Primeros Principios',
    },
    description: {
      en: 'Reason up from what you know is true instead of by analogy. Boil a problem down to its irreducible facts, then rebuild — the engine behind every breakthrough.',
      es: 'Razona desde lo que sabes que es cierto en lugar de por analogía. Reduce un problema a sus hechos irreducibles y reconstruye: el motor de todo avance.',
    },
    dependencies: ['what-are-mental-models'],
    tags: ['problem-solving', 'foundations'],
    buildNotes:
      'Reasoning from first principles vs. reasoning by analogy. Sections: the Socratic "why" ladder; separating assumptions from facts; rebuilding a solution from the irreducible parts. Worked example: the cost of a battery pack broken into raw-material cost (the classic first-principles deconstruction). Contrast a by-analogy answer with a first-principles answer side-by-side in a table. Pitfall: it is slow — when analogy is good enough. Build an interactive "decompose then rebuild" island. Recap Quiz. en + es twin.',
  },
  {
    slug: 'inversion',
    icon: '🔃',
    difficulty: 'beginner',
    order: 3,
    accent: 'brand',
    title: {
      en: 'Inversion: Think Backwards',
      es: 'Inversión: Pensar al Revés',
    },
    description: {
      en: '“Invert, always invert.” Instead of asking how to succeed, ask how to fail — then avoid that. One of the most powerful and underused thinking tools.',
      es: '«Invierte, siempre invierte.» En vez de preguntar cómo triunfar, pregunta cómo fracasar, y evítalo. Una de las herramientas de pensamiento más potentes e infrautilizadas.',
    },
    dependencies: ['what-are-mental-models'],
    tags: ['decision-making', 'problem-solving'],
    buildNotes:
      'Inversion (Jacobi’s "invert, always invert", via Munger). Sections: solving forward vs. backward; the "how would I guarantee failure?" pre-mortem; avoiding stupidity beats seeking brilliance. Worked examples: planning a project by listing every way it could fail; "how to make a team miserable" inverted into management advice. Pitfall: inversion finds what to avoid, not always what to do. Build a "forward goal ↔ inverted anti-goal" flip island. Recap Quiz. en + es twin.',
  },
  {
    slug: 'second-order-thinking',
    icon: '🌊',
    difficulty: 'intermediate',
    order: 4,
    accent: 'accent',
    title: {
      en: 'Second-Order Thinking',
      es: 'Pensamiento de Segundo Orden',
    },
    description: {
      en: '“And then what?” Trace the consequences of the consequences. First-order answers are easy and usually wrong; the edge is in the ripple effects.',
      es: '«¿Y luego qué?» Sigue las consecuencias de las consecuencias. Las respuestas de primer orden son fáciles y casi siempre erróneas; la ventaja está en los efectos en cascada.',
    },
    dependencies: ['inversion', 'first-principles-thinking'],
    tags: ['decision-making', 'systems-thinking'],
    buildNotes:
      'Second- and higher-order effects. Sections: first-order vs. second-order consequences; the "and then what?" chain; how incentives and feedback create non-obvious downstream effects. Worked examples: price caps → shortages; a sugar tax → reformulation/substitution; a hire that fixes today but blocks promotion paths. Connect to opportunity cost and feedback loops. Build an interactive consequence-tree island (expand effects N levels deep). Pitfall: paralysis from over-forecasting. Recap Quiz + MindMap. en + es twin.',
  },
  {
    slug: 'opportunity-cost',
    icon: '⚖️',
    difficulty: 'intermediate',
    order: 5,
    accent: 'brand',
    title: {
      en: 'Opportunity Cost & Trade-offs',
      es: 'Coste de Oportunidad y Disyuntivas',
    },
    description: {
      en: 'The real cost of anything is the best thing you gave up to get it. The single idea that turns every choice into a comparison.',
      es: 'El coste real de algo es lo mejor que renunciaste a cambio. La idea que convierte cada elección en una comparación.',
    },
    dependencies: ['what-are-mental-models'],
    tags: ['decision-making', 'economics'],
    buildNotes:
      'Opportunity cost and trade-offs. Sections: cost = the next-best forgone alternative (not the sticker price); time/attention/capital are scarce; "compared to what?" as a default question; trade-offs vs. false either/ors. Worked examples with real numbers: a job offer vs. its alternative; holding cash vs. investing; one feature vs. another on a roadmap. Use a comparison table throughout. Build an interactive "choose A vs. B → what you forgo" island. Pitfall: ignoring non-monetary costs. Recap Quiz. en + es twin.',
  },
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
];

/** Quick lookup by slug. */
export const upcomingBySlug = new Map<string, UpcomingCourse>(
  upcomingCourses.map((c) => [c.slug, c]),
);
