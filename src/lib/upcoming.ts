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
 * beginner→intermediate breadth pass and the earlier advanced rungs
 * (`what-are-mental-models`, `natural-selection`, `supply-and-demand`,
 * `tragedy-of-the-commons`, `externalities`, `moats`, `ecosystems-and-niches`,
 * `leverage-points`, `lollapalooza-effect`, …) have graduated and been removed.
 * Lowest `order` is built next. The remaining entries are the **advanced tier**,
 * deliberately kept tag-diverse so no single roadmap tag races ahead:
 * probability (`regression-to-the-mean`), science-engineering / systems
 * (`critical-mass`), strategy (`nash-equilibrium`), decision-making
 * (`asymmetry-and-optionality`) and biology-evolution (`fitness-landscapes`).
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
  // ── Advanced tier — kept tag-diverse ───────────────────────────────────────
  // `externalities` (20), `moats` (21), `ecosystems-and-niches` (22),
  // `leverage-points` (23) and `lollapalooza-effect` (the advanced psychology
  // rung, order 24) have graduated and been removed; their topic MDX is now the
  // record. The lowest-order entry below (`regression-to-the-mean`, order 25) is
  // built next. The queue spans probability (`regression-to-the-mean`),
  // science-engineering / systems (`critical-mass`), strategy (`nash-equilibrium`),
  // decision-making (`asymmetry-and-optionality`) and biology-evolution
  // (`fitness-landscapes`) so no single roadmap tag races ahead of the others.
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
  // ── Breadth appends (queue would otherwise fall below 3) ─────────────────────
  // With `lollapalooza-effect` graduated, only `regression-to-the-mean`
  // (probability) and `critical-mass` (science-engineering/systems) remained.
  // Add the strategy, decision-making and biology-evolution advanced rungs so
  // the queue stays ≥3 and no roadmap tag runs empty. Each sits a notch further
  // up the ladder and stays strictly within TOPIC.md scope.
  {
    slug: 'nash-equilibrium',
    icon: '♟️',
    difficulty: 'advanced',
    order: 27,
    accent: 'accent',
    title: {
      en: 'Nash Equilibrium',
      es: 'El Equilibrio de Nash',
    },
    description: {
      en: 'A situation where no player can do better by changing strategy alone — so everyone stays put, even when everyone would be better off somewhere else. The still point of a strategic game, and why stable outcomes are so often the bad ones.',
      es: 'Una situación en la que ningún jugador puede mejorar cambiando de estrategia por su cuenta — así que nadie se mueve, aunque a todos les fuera mejor en otro sitio. El punto de reposo de un juego estratégico, y por qué los resultados estables son con tanta frecuencia los malos.',
    },
    dependencies: ['game-theory-basics'],
    tags: ['strategy'],
    buildNotes:
      'Nash equilibrium — the advanced strategy rung that puts a precise fixed point under game-theory-basics: a set of strategies, one per player, where no single player can improve their own payoff by unilaterally changing (holding everyone else fixed). Assumes game-theory-basics (payoff matrices, dominant strategies, the prisoner’s dilemma). Sections: the core definition — a "no-regret-given-what-others-did" resting point; the intuition that an equilibrium is where best-responses meet (each player is already best-responding to the others); why a game can have one, several, or no *pure*-strategy equilibria, and the reassurance of John Nash’s theorem that a *mixed*-strategy equilibrium always exists in finite games; worked examples — the prisoner’s dilemma (mutual defection is the unique Nash equilibrium and it is Pareto-inferior: the deep lesson that stable ≠ good), coordination games with multiple equilibria (driving on the left vs right, the stag hunt, focal points / Schelling points), and a simple mixed-strategy game (matching pennies / penalty kicks, where you must randomize to be unexploitable); best-response reasoning as the solution method; the connection to systems and incentives (an equilibrium is what a system of self-interested agents settles into, so if you dislike the outcome you must change the payoffs, not scold the players — tie to incentives and leverage-points). Pitfalls: assuming an equilibrium is efficient or fair (it need not be — see the dilemma); assuming players actually reach it (equilibrium selection, bounded rationality); confusing a Nash equilibrium with a dominant-strategy outcome. Build an interactive island (or reuse/extend the payoff-matrix island): a 2×2 game where the learner toggles each player’s strategy and the island highlights each player’s best response and flags the cell(s) that are Nash equilibria, with presets for the dilemma, a coordination game and matching pennies; a mixed-strategy slider showing how randomizing removes the opponent’s ability to exploit you. Recap Quiz + MindMap. en + es twin.',
  },
  {
    slug: 'asymmetry-and-optionality',
    icon: '🎢',
    difficulty: 'advanced',
    order: 28,
    accent: 'brand',
    title: {
      en: 'Asymmetry & Optionality',
      es: 'Asimetría y Opcionalidad',
    },
    description: {
      en: 'Some bets lose you a little and win you a lot; others do the reverse. When the downside is capped and the upside is open, you can be wrong most of the time and still come out far ahead. The model behind options, experiments, and antifragile decisions.',
      es: 'Algunas apuestas te hacen perder poco y ganar mucho; otras, al revés. Cuando la pérdida está acotada y la ganancia es abierta, puedes equivocarte casi siempre y aun así salir muy por delante. El modelo tras las opciones, los experimentos y las decisiones antifrágiles.',
    },
    dependencies: ['margin-of-safety', 'fat-tails'],
    tags: ['decision-making'],
    buildNotes:
      'Asymmetry & optionality — the advanced decision-making rung: shifting attention from "how likely?" to "how lopsided are the payoffs?". Builds on expected value, margin-of-safety and fat-tails. Sections: the core idea — a decision’s value is probability *times magnitude*, and when magnitudes are wildly asymmetric the magnitude dominates; a convex ("smile") payoff has limited downside and open-ended upside, a concave ("frown") payoff the reverse; worked examples — a capped-loss / uncapped-gain bet where you lose small on 80% of tries and win big on 20% and still profit hugely (show the arithmetic), versus the mirror trap of "picking up pennies in front of a steamroller" (small steady gains, rare catastrophic loss — tie to fat-tails and the tail-risk lesson); optionality — paying a small, known cost for the *right but not the obligation* to a large upside (financial options, but also a cheap experiment, an option to renew, keeping several paths open); why optionality thrives on volatility and uncertainty (more variance = more valuable the capped-downside upside — the antifragile idea, Taleb) and why fragility is hidden negative optionality; the barbell strategy (combine very safe with very risky, avoid the fragile middle); Jensen’s inequality stated in words (for a convex payoff, the average outcome beats the outcome of the average) without heavy math; the decision heuristic — "cut the downside, keep the upside open," seek convex bets, run many small reversible experiments and let the winners run. Pitfalls: ignoring the *cost* of optionality (options aren’t free; over-paying for lottery tickets); mistaking a capped-downside story for one whose downside is actually unbounded; confusing high variance with good asymmetry. Build an interactive island: a payoff-shape explorer where the learner sets downside cap, upside slope and win-probability and watches the expected value and the full outcome distribution, with a toggle between a convex bet, a concave bet and a barbell — and a "run 100 trials" button that shows the convex bet winning despite a low hit-rate. Recap Quiz + MindMap. en + es twin.',
  },
  {
    slug: 'fitness-landscapes',
    icon: '🏔️',
    difficulty: 'advanced',
    order: 29,
    accent: 'accent',
    title: {
      en: 'Fitness Landscapes',
      es: 'Paisajes Adaptativos',
    },
    description: {
      en: 'Picture every possible design as a point on a terrain, with height = how well it works. Evolution — and any trial-and-error search — climbs uphill, which means it can get marooned on a low peak with a taller summit hidden across an unclimbable valley. The map of why "good enough" gets stuck.',
      es: 'Imagina cada diseño posible como un punto de un terreno, con la altura = lo bien que funciona. La evolución — y cualquier búsqueda por ensayo y error — sube cuesta arriba, lo que significa que puede quedar varada en un pico bajo con una cima más alta oculta al otro lado de un valle infranqueable. El mapa de por qué lo "suficientemente bueno" se atasca.',
    },
    dependencies: ['natural-selection', 'red-queen-effect'],
    tags: ['biology-evolution'],
    buildNotes:
      'Fitness landscapes — the advanced biology-evolution rung that turns natural-selection into a search-over-a-terrain model (Sewall Wright, 1932) and generalizes far beyond biology. Assumes natural-selection (variation, selection, heredity) and pairs well with red-queen-effect. Sections: the core picture — arrange all possible genotypes/designs on a plane so that similar designs are neighbours, and plot "fitness" (reproductive success, or any performance measure) as height, giving a landscape of peaks, valleys and ridges; hill-climbing — selection only ever moves uphill (small heritable improvements accumulate), so evolution is a *local* search with no foresight; the central consequence — **local optima**: a population can climb to the top of a modest hill and be trapped there, because every single step toward the far taller mountain must first go *downhill* (less fit) across a valley selection won’t cross (why "good enough" beats "best", why the eye’s blind spot and the recurrent laryngeal nerve persist); ruggedness — smooth single-peak landscapes are easy, rugged many-peaked ones trap searchers; what crosses valleys — mutation/drift in small populations, recombination, and a *changing* landscape (the peak moves — tie hard to red-queen: co-evolution means the terrain deforms under you, so there is no final summit); transfer of the model — the same map explains local optima in engineering/design, machine-learning training, business strategy (a firm stuck on a local peak disrupted by someone on a different one), skill acquisition, and the explore-vs-exploit trade-off (exploit = climb the current hill; explore = jump to look for a higher one). Pitfalls: treating evolution as goal-directed "progress toward perfection" (it’s myopic hill-climbing, no goal); assuming the global optimum is reachable or even fixed; over-literal single-peak thinking when real landscapes are high-dimensional and shifting. Build an interactive island: a 1-D or 2-D fitness landscape where the learner drops a population and watches it hill-climb to the nearest peak, with a ruggedness slider (smooth → many-peaked) and a "mutate/jump" control that occasionally lets it cross a valley to a higher summit — plus a toggle that slowly reshapes the terrain (red-queen) so a conquered peak sinks. Recap Quiz + MindMap. en + es twin.',
  },
];

/** Quick lookup by slug. */
export const upcomingBySlug = new Map<string, UpcomingCourse>(
  upcomingCourses.map((c) => [c.slug, c]),
);
