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
 * `leverage-points`, `lollapalooza-effect`, `regression-to-the-mean`,
 * `critical-mass`, `nash-equilibrium`, …) have graduated and been removed.
 * Lowest `order` is built next. The remaining entries finish the **advanced
 * tier** and open the **expert tier**, deliberately kept tag-diverse so no
 * single roadmap tag races ahead: decision-making (`asymmetry-and-optionality`,
 * `deciding-under-deep-uncertainty`), biology-evolution (`fitness-landscapes`),
 * strategy (`mechanism-design`) and foundations (`combining-models-latticework`).
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
  // ── Advanced → expert tier — kept tag-diverse ──────────────────────────────
  // `externalities` (20), `moats` (21), `ecosystems-and-niches` (22),
  // `leverage-points` (23), `lollapalooza-effect` (24), `regression-to-the-mean`
  // (25), `critical-mass` (26) and `nash-equilibrium` (the advanced strategy
  // rung, 27) have graduated and been removed; their topic MDX is now the
  // record. The lowest-order entry below (`asymmetry-and-optionality`, order 28)
  // is built next. The remaining queue finishes the advanced tier and opens the
  // expert tier, spanning decision-making (`asymmetry-and-optionality`,
  // `deciding-under-deep-uncertainty`), biology-evolution (`fitness-landscapes`),
  // strategy (`mechanism-design`) and foundations (`combining-models-latticework`)
  // so no single roadmap tag races ahead of the others.
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
  {
    slug: 'mechanism-design',
    icon: '🛠️',
    difficulty: 'advanced',
    order: 30,
    accent: 'accent',
    title: {
      en: 'Mechanism Design',
      es: 'Diseño de Mecanismos',
    },
    description: {
      en: 'Game theory in reverse: instead of predicting how players will act inside a fixed game, you design the rules so that self-interest produces the outcome you actually want. The engineering discipline behind good auctions, fair splits, and honest incentives.',
      es: 'Teoría de juegos al revés: en lugar de predecir cómo actuarán los jugadores dentro de un juego fijo, diseñas las reglas para que el interés propio produzca el resultado que de verdad quieres. La disciplina de ingeniería tras las buenas subastas, los repartos justos y los incentivos honestos.',
    },
    dependencies: ['nash-equilibrium', 'incentives'],
    tags: ['strategy', 'economics'],
    buildNotes:
      'Mechanism design — the "inverse game theory" rung that follows directly from nash-equilibrium: if an equilibrium is what self-interested players settle into, then changing the rules changes the equilibrium, so you can *engineer* the game to make the outcome you want be the one everyone reaches on their own. Assumes nash-equilibrium (equilibria, best responses) and incentives. Sections: the core flip — analysis predicts play inside fixed rules; design chooses the rules to steer the equilibrium (Hurwicz/Maskin/Myerson, Nobel 2007); incentive-compatibility — a mechanism is incentive-compatible when honest/desired behaviour is itself a best response, so no one gains by gaming it (truthful bidding, truth-telling); worked examples — "I cut, you choose" as the canonical fair-division mechanism (the cutter’s self-interest is redirected to produce fairness); the second-price / Vickrey auction where bidding your true value is a dominant strategy (contrast the first-price auction where it is not, and tie to why eBay-style proxy bidding works); the revelation principle in words (if any mechanism gets a good outcome, a truthful one can too); the connection to leverage-points and externalities (a Pigouvian tax is a mechanism; so are deposit-refunds, cap-and-trade, and matching markets like kidney exchange and school choice). Pitfalls: assuming you can design away all bad incentives (impossibility results — you cannot always have efficiency, honesty and budget-balance at once); mechanisms that are gameable in practice (Goodhart, unraveling); ignoring participation/individual-rationality constraints; over-trusting that people play the intended equilibrium. Build an interactive island (or reuse/extend the payoff-matrix island): an auction sandbox where the learner sets their true value and a rule (first-price vs second-price) and sees why truthful bidding is or isn’t a best response, plus a "cut-and-choose" splitter showing self-interest producing a fair division. Recap Quiz + MindMap. en + es twin.',
  },
  {
    slug: 'combining-models-latticework',
    icon: '🕸️',
    difficulty: 'expert',
    order: 31,
    accent: 'brand',
    title: {
      en: 'Combining Models: The Latticework',
      es: 'Combinar Modelos: El Entramado',
    },
    description: {
      en: 'The capstone skill: holding several models at once and letting them check, complete, and correct one another into a single judgment. When forces stack the same way you get a lollapalooza; when models disagree, the disagreement is the signal. How a latticework actually thinks.',
      es: 'La habilidad cumbre: sostener varios modelos a la vez y dejar que se comprueben, completen y corrijan entre sí hasta formar un único juicio. Cuando las fuerzas se apilan en el mismo sentido surge un lollapalooza; cuando los modelos discrepan, la discrepancia es la señal. Cómo piensa de verdad un entramado.',
    },
    dependencies: ['lollapalooza-effect', 'second-order-thinking', 'circle-of-competence'],
    tags: ['foundations', 'decision-making'],
    buildNotes:
      'Combining models: the latticework — the expert-tier capstone that TOPIC.md names as the whole point of the site: taking a real situation and reasoning with *several* models at once instead of one. Assumes a broad base (lollapalooza-effect, second-order-thinking, circle-of-competence) and should cross-reference many built courses. Sections: why one model is never enough (the man-with-a-hammer tendency — if all you have is one model you force every problem into it); the latticework idea (Munger) — models from different disciplines as an interlocking mesh you hang experience on; three ways models combine — (1) they *stack* the same direction into a lollapalooza (link to lollapalooza-effect: incentives + social proof + commitment all pushing one way), (2) they *check* each other (base rates vs a vivid story; incentives vs stated reasons; second-order effects vs first-order appeal), and (3) they *complete* each other (supply/demand explains the price, game theory explains the players, feedback loops explain the dynamics — one situation, several lenses); a fully worked multi-model case study (e.g. a bank run or a viral product read simultaneously through incentives, critical-mass/tipping, game theory and social proof); the meta-skill of *choosing* which models fit a novel situation and knowing your circle of competence; making a mental checklist/pre-mortem that runs several models over a decision. Pitfalls: forcing a model where it does not apply, double-counting the same effect wearing two names, confirmation-shopping for the model that flatters the answer you already want, and paralysis-by-lattice (more models ≠ better past the point of decision). Build an interactive island: a "decision desk" where the learner is given a scenario and toggles a panel of model-lenses (incentives, base rate, second-order, game theory, feedback loop, social proof), each contributing a note and a directional pull, and the island shows where lenses agree (a stacked lollapalooza reading) versus where they conflict (the flagged tension to investigate). Recap Quiz + MindMap. en + es twin.',
  },
  {
    slug: 'deciding-under-deep-uncertainty',
    icon: '🌫️',
    difficulty: 'expert',
    order: 32,
    accent: 'accent',
    title: {
      en: 'Deciding Under Deep Uncertainty',
      es: 'Decidir Bajo Incertidumbre Profunda',
    },
    description: {
      en: 'Expected value assumes you know the odds. Deep uncertainty is when you do not — the probabilities themselves are unknown or unknowable. The expert model for choosing well when you cannot compute: seek robustness over optimality, buy margin of safety, and prefer decisions that survive being wrong.',
      es: 'El valor esperado da por hecho que conoces las probabilidades. La incertidumbre profunda es cuando no las conoces — las probabilidades mismas son desconocidas o incognoscibles. El modelo experto para elegir bien cuando no puedes calcular: busca robustez antes que optimalidad, compra margen de seguridad y prefiere decisiones que sobrevivan a estar equivocado.',
    },
    dependencies: ['fat-tails', 'margin-of-safety', 'asymmetry-and-optionality'],
    tags: ['decision-making', 'probability'],
    buildNotes:
      'Deciding under deep uncertainty — the expert decision-making rung: what to do when the clean machinery of expected value breaks because you do not (and cannot) know the probabilities. Assumes fat-tails, margin-of-safety and asymmetry-and-optionality; the honest sequel to expected value. Sections: risk vs uncertainty (Knight) — risk is a known distribution (a dice roll), uncertainty is an unknown one (next decade’s technology); why point-estimate expected value quietly assumes you know the odds and misleads under fat tails and unknown unknowns; the shift from *optimising* to *satisficing* and *robustness* — pick actions that do acceptably across many possible worlds rather than best in your single guessed one (robust decision-making, minimax-regret, the precautionary/ruin-avoidance principle: never risk what you cannot afford to lose, because ergodicity fails and one ruin ends the game); reversibility and option value (keep choices reversible, pay for margin of safety, run small experiments — tie to asymmetry-and-optionality and the barbell); scenario thinking and pre-mortems instead of single forecasts; the role of redundancy, slack and antifragility; calibration humility (you know less than your confidence suggests). Pitfalls: false precision (a detailed spreadsheet is not knowledge; garbage-in dressed as rigour); treating deep uncertainty as if it were mere risk; over-hedging into paralysis or paying so much for safety you never win; confusing robustness with mere pessimism. Build an interactive island: a "many-worlds" decision explorer where the learner picks among strategies (optimise / hedge / barbell / robust) and the island draws each strategy’s outcome across a spread of possible worlds — including rare ruinous ones — showing how the expected-value winner can be the strategy most likely to blow up, while the robust choice trades a little average for surviving every world. Recap Quiz + MindMap. en + es twin.',
  },
];

/** Quick lookup by slug. */
export const upcomingBySlug = new Map<string, UpcomingCourse>(
  upcomingCourses.map((c) => [c.slug, c]),
);
