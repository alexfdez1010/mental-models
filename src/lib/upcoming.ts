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
 *   • Go in order: build the lowest-`order` upcoming entry first. Use that
 *     `order` as the authority on what is next — do NOT skip a beginner entry
 *     just because a harder course already exists. Breadth across the tag
 *     taxonomy (TOPIC.md) takes priority over a strictly monotone difficulty
 *     ramp: the foundational models of every discipline (psychology, economics,
 *     biology, systems, science, strategy) must be covered before climbing any
 *     single tag to advanced/expert.
 *   • Use the entry's `buildNotes` as the build brief, its `dependencies`/`tags`
 *     for catalog wiring, and keep the same `slug` for the topic MDX so it
 *     graduates cleanly.
 *   • After building, REMOVE its entry here (the topic MDX is now the record).
 *   • When fewer than 3 entries remain, APPEND the next topics. Keep the queue
 *     tag-diverse: do not let one roadmap tag (e.g. `probability`) accumulate
 *     several queued courses while another (`biology-evolution`, `psychology`,
 *     `economics`, `strategy`) has none. Fill the breadth, then deepen.
 *
 * ── Mental Models build queue ───────────────────────────────────────────────
 * The zero-to-expert ladder of models still to build (see TOPIC.md). The whole
 * beginner→intermediate breadth pass and the first advanced rungs
 * (`what-are-mental-models`, `natural-selection`, `supply-and-demand`,
 * `tragedy-of-the-commons`, `externalities`, …) have graduated and been removed.
 * Lowest `order` is built next. The remaining entries are the **advanced tier**,
 * deliberately kept tag-diverse so no single roadmap tag races ahead:
 * biology-evolution (`ecosystems-and-niches`), systems-thinking
 * (`leverage-points`), and psychology (`lollapalooza-effect`). The strategy rung
 * (`moats`) has graduated and been removed; its topic MDX is now the record.
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
  // ── Advanced systems / economics / strategy / biology / psychology tier ────
  // `externalities` (order 20), `moats` (order 21) and `ecosystems-and-niches`
  // (the advanced biology-evolution rung, order 22) have graduated and been
  // removed; their topic MDX is now the record. The lowest-order entry below
  // (`leverage-points`, order 23) is built next.
  // ── Breadth re-seed ────────────────────────────────────────────────────────
  // A systems-thinking rung and a psychology rung, plus (appended as
  // `ecosystems-and-niches` graduated) a probability rung and a
  // science-engineering rung — kept tag-diverse so no single roadmap tag races
  // ahead of the others.
  // Appended as `externalities` (order 20) graduates, to keep the queue ≥3 and
  // tag-diverse: a systems-thinking rung and a psychology rung — the two tags
  // the remaining advanced tier (strategy, economics, biology-evolution) was
  // missing.
  {
    slug: 'leverage-points',
    icon: '🎯',
    difficulty: 'advanced',
    order: 23,
    accent: 'accent',
    title: {
      en: 'Leverage Points',
      es: 'Puntos de Apalancamiento',
    },
    description: {
      en: 'In any system, some places to push are almost useless and a few are astonishingly powerful — and our intuition usually reaches for the weak ones. Donella Meadows’ ladder of where to intervene, from tweaking numbers to changing the goal of the whole system.',
      es: 'En cualquier sistema, algunos lugares donde empujar son casi inútiles y unos pocos son asombrosamente potentes — y nuestra intuición suele agarrar los débiles. La escalera de Donella Meadows sobre dónde intervenir, desde ajustar números hasta cambiar el objetivo de todo el sistema.',
    },
    dependencies: ['feedback-loops', 'stocks-and-flows'],
    tags: ['systems-thinking'],
    buildNotes:
      'Leverage points — the advanced systems-thinking rung built on feedback loops and stocks & flows: where to push a complex system to change its behaviour, and why the obvious places are usually the weak ones. Frame around Donella Meadows’ famous ordered list (places to intervene, in increasing order of power), but teach the *idea* not a memorised rank: low-leverage points (constants, parameters, numbers — tweaking a tax rate or a thermostat setpoint) vs. high-leverage points (the strength and structure of feedback loops, the rules of the system, the information flows, the goal of the system, and the paradigm/mindset out of which the system arises). Sections: the counterintuition — Meadows’ insight that people reliably push hardest on low-leverage parameters (numbers) while the powerful levers (loop structure, rules, goals, paradigms) sit ignored; a worked walk *up* the ladder on one concrete system (e.g. a city’s traffic, an overdrawn aquifer, or a company’s culture) showing how the same problem yields to a higher lever; negative vs positive feedback as levers (strengthening a balancing loop vs weakening a runaway reinforcing loop — tie back to the feedback-loops course); rules, information flows, and "the goal of the system" as progressively deeper levers (add a missing feedback of information — e.g. making people see their own energy use — as a classic mid-ladder win); paradigms as the highest leverage and the hardest to shift. Pitfalls: pushing a lever in the wrong direction (Meadows’ warning that high leverage points are "not intuitive, and when found, often pushed the wrong way"); mistaking activity at a low leverage point for progress. Build an interactive leverage-ladder island: a system with a few intervention sliders/levers at different ladder heights; the learner applies effort at a chosen level and sees how much the system’s output actually moves, making "same effort, wildly different result" visible. Ties to feedback-loops, stocks-and-flows, bottlenecks, second-order thinking. Recap Quiz + MindMap. en + es twin.',
  },
  {
    slug: 'lollapalooza-effect',
    icon: '🎰',
    difficulty: 'advanced',
    order: 24,
    accent: 'brand',
    title: {
      en: 'The Lollapalooza Effect',
      es: 'El Efecto Lollapalooza',
    },
    description: {
      en: 'Biases rarely strike one at a time. When several psychological tendencies point the same way at once, they don’t add — they multiply, tipping ordinary people into bubbles, cults, and manias. Munger’s name for the moment many models combine into one overwhelming force.',
      es: 'Los sesgos rara vez actúan de uno en uno. Cuando varias tendencias psicológicas apuntan a la vez en la misma dirección, no se suman: se multiplican, empujando a gente normal hacia burbujas, sectas y manías. El nombre que dio Munger al momento en que muchos modelos se combinan en una sola fuerza arrolladora.',
    },
    dependencies: ['confirmation-bias', 'incentives', 'loss-aversion'],
    tags: ['psychology'],
    buildNotes:
      'The Lollapalooza effect — the advanced psychology rung where the major cognitive biases stop acting in isolation and *combine*: Charlie Munger’s term for when several psychological tendencies all push in the same direction at once and produce an extreme, nonlinear outcome (the effects compound and reinforce rather than merely add). Assumes the intermediate bias courses (confirmation bias, availability, loss aversion, incentives, social proof). Sections: the core idea — most real-world disasters and manias aren’t one bias but a *confluence* (Munger: "you get lollapalooza effects when two, three or four forces are all operating in the same direction"); why combination is multiplicative not additive (each bias lowers resistance to the next; reinforcing feedback — tie to feedback-loops); worked case studies pulled apart bias-by-bias — e.g. an open-outcry auction or bidding war (social proof + commitment/consistency + deprivation-superreaction/loss aversion + reciprocation), a market bubble (social proof + incentive-caused bias + envy + over-optimism + confirmation), a cult or high-pressure sales close (authority + social proof + commitment + reciprocation + scarcity); the defensive use — building a mental "checklist" of biases to run against a decision precisely because no single one announces itself; the connection to the latticework thesis of the whole site (models combine — this is that idea turned on the psychology tag). Pitfalls: hindsight over-fitting (don’t just label everything "lollapalooza" after the fact — name the *specific* tendencies and show they pointed the same way); assuming biases always compound (sometimes they offset). Build an interactive island: a scenario (auction or bubble) with toggles for each contributing bias; as the learner switches biases on, a "pressure"/likelihood meter climbs nonlinearly, and turning several on at once spikes it — making the multiplicative stacking visible vs. the sum of the parts. Recap Quiz + MindMap. en + es twin.',
  },
  // Appended as `ecosystems-and-niches` (order 22) graduated, to keep the queue
  // ≥3 and tag-diverse: a probability rung and a science-engineering rung — the
  // two tags the remaining advanced tier (systems-thinking, psychology) was
  // missing.
  {
    slug: 'regression-to-the-mean',
    icon: '🎯',
    difficulty: 'advanced',
    order: 25,
    accent: 'brand',
    title: {
      en: 'Regression to the Mean',
      es: 'Regresión a la Media',
    },
    description: {
      en: 'Extremes don’t last. After a record-shattering result — a stellar quarter, a career-best game, a terrible test — the next one tends to drift back toward average, for no reason but chance. The model that explains why punishment "works", praise "backfires", and star performers fade.',
      es: 'Los extremos no duran. Tras un resultado excepcional — un trimestre estelar, el mejor partido de una carrera, un examen desastroso — el siguiente tiende a acercarse a la media, sin más causa que el azar. El modelo que explica por qué el castigo "funciona", el elogio "sale mal" y las estrellas se apagan.',
    },
    dependencies: ['thinking-in-probabilities', 'bayesian-updating'],
    tags: ['probability'],
    buildNotes:
      'Regression to the mean — the advanced probability rung: whenever an outcome mixes skill and luck, an extreme observation is usually extreme partly by luck, so the *next* observation from the same source drifts back toward the average — with no cause, intervention, or explanation required. Assumes thinking-in-probabilities and (helpfully) base rates / Bayesian updating. Sections: the core mechanic — any measured result = stable signal + transient noise; select on an extreme and you’ve selected for extreme noise, which won’t repeat (tie to sample size and fat tails); Galton’s original discovery (tall parents → shorter (on average) children, and vice versa — the "regression" that named the whole field of regression analysis); worked numeric example with a skill+luck model (e.g. exam or sales scores drawn as true-ability + random-luck; show the top decile’s average dropping on retest while the population mean holds); the enormous decision-making payoff — the "regression fallacy" of crediting a treatment for improvement that would have happened anyway (sports-team "curse" of the magazine cover, the speed-camera / worst-sites-first illusion, feeling better after seeing a doctor); the cruel training anecdote (Kahneman: praising a great landing is followed by a worse one, scolding a bad one by a better one — so instructors "learn" punishment works and praise fails, when it’s pure regression); why this fuels superstition, quack cures, and manager over-reaction; how to defend — control groups, larger samples, expecting reversion. Pitfalls: seeing a *cause* where there is only reversion; confusing regression with a real trend or with "the gambler’s fallacy" (distinguish them carefully). Build an interactive island: a scatter of performers each with a hidden true-skill + fresh random luck each round; the learner selects the top performers in round 1 and watches their round-2 average fall back toward the mean, with sliders for how much luck vs skill drives the outcome (more luck → more regression). Recap Quiz + MindMap. en + es twin.',
  },
  {
    slug: 'critical-mass',
    icon: '⚛️',
    difficulty: 'advanced',
    order: 26,
    accent: 'accent',
    title: {
      en: 'Critical Mass & Tipping Points',
      es: 'Masa Crítica y Puntos de Inflexión',
    },
    description: {
      en: 'Some things do nothing, nothing, nothing — then everything, all at once. Below a threshold a chain reaction fizzles; one atom past it, it runs away. The physics model behind tipping points, viral spread, network effects, and why change so often arrives suddenly after a long, quiet build-up.',
      es: 'Algunas cosas no hacen nada, nada, nada — y de pronto, todo a la vez. Bajo un umbral la reacción en cadena se apaga; un átomo más allá, se dispara. El modelo físico tras los puntos de inflexión, la difusión viral, los efectos de red y por qué el cambio suele llegar de golpe tras una larga acumulación silenciosa.',
    },
    dependencies: ['feedback-loops', 'emergence'],
    tags: ['science-engineering', 'systems-thinking'],
    buildNotes:
      'Critical mass & tipping points — the advanced science-engineering rung borrowed from nuclear physics and generalized: the idea of a *threshold* below which a self-amplifying process dies out and above which it runs away, because the amplification factor crosses 1. Assumes feedback-loops (reinforcing loops) and emergence. Sections: the origin — nuclear fission, where each split atom releases neutrons that split more; below the critical mass too many neutrons escape and the reaction fizzles, at/above it each split causes ≥1 more and the chain reaction explodes (the "k-factor" crossing 1); the general model — any system with a reinforcing loop has a threshold where per-step gain crosses 1, flipping "peters out" into "runs away" (tie hard to feedback-loops); worked examples across domains — a disease’s R0 (spread crossing 1 person infecting >1), viral content, the adoption S-curve and network effects (a phone network / social app worthless below a user threshold, unstoppable above it — tie to moats), a crowd/riot or a standing ovation, autocatalytic chemistry, even a meeting where nobody speaks until a threshold of willingness breaks; nonlinearity and suddenness — why thresholds make change feel abrupt ("nothing then everything") and why the long quiet phase fools people into thinking nothing is happening; hysteresis / lock-in briefly (once over the top it’s hard to reverse). Pitfalls: assuming linear extrapolation near a threshold (small push → giant or zero effect, unpredictably), confusing "slow = failing" with "sub-critical build-up", and the reverse error of expecting every trend to tip (many never reach critical mass and just die). Build an interactive island: a grid/pool of "nodes" with a contagion or neutron-style spread and a slider for the amplification factor (k) or the seed density; below threshold the activation fizzles out, above it a chain reaction sweeps the whole grid — the learner hunts for the tipping point and sees the sharp phase change. Recap Quiz + MindMap. en + es twin.',
  },
];

/** Quick lookup by slug. */
export const upcomingBySlug = new Map<string, UpcomingCourse>(
  upcomingCourses.map((c) => [c.slug, c]),
);
