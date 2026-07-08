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
 * beginner→intermediate breadth pass and the earlier advanced/expert rungs
 * (`what-are-mental-models`, `natural-selection`, `supply-and-demand`,
 * `tragedy-of-the-commons`, `externalities`, `moats`, `ecosystems-and-niches`,
 * `leverage-points`, `lollapalooza-effect`, `regression-to-the-mean`,
 * `critical-mass`, `nash-equilibrium`, `mechanism-design`,
 * `influence-and-persuasion`, `evolution-of-cooperation`,
 * `credible-commitment-and-deterrence`, `path-dependence-and-lock-in`,
 * `principal-agent-problem`, `cumulative-advantage-and-power-laws`,
 * `debiasing-and-the-bias-blind-spot`, `signaling-and-costly-signals`,
 * `reflexivity-and-self-fulfilling-dynamics`, `antifragility-and-via-negativa`, …)
 * have graduated and been removed; their topic MDX is now the record. Lowest
 * `order` is built next. The remaining entries all sit in the **expert tier**,
 * deliberately kept tag-diverse so no single roadmap tag races ahead:
 * probability/decision-making (`ergodicity-and-the-time-average`, 43),
 * strategy/psychology (`common-knowledge-and-coordination`, 44) and
 * economics/systems-thinking (`spontaneous-order-and-the-knowledge-problem`, 45).
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
  // ── Expert tier — kept tag-diverse ─────────────────────────────────────────
  // The earlier expert rungs — `externalities` (20) … `reflexivity-and-self-
  // fulfilling-dynamics` (41) and `antifragility-and-via-negativa` (42) — have
  // graduated and been removed; their topic MDX is now the record. The lowest-
  // order entry below (`ergodicity-and-the-time-average`, order 43) is built next.
  // The remaining queue finishes the expert tier and keeps the breadth tag-
  // diverse, spanning probability/decision-making (`ergodicity-and-the-time-
  // average`), strategy/psychology (`common-knowledge-and-coordination`) and
  // economics/systems-thinking (`spontaneous-order-and-the-knowledge-problem`)
  // so no single roadmap tag races ahead.
  {
    slug: 'ergodicity-and-the-time-average',
    icon: '⏳',
    difficulty: 'expert',
    order: 43,
    accent: 'brand',
    title: {
      en: 'Ergodicity & the Time Average',
      es: 'Ergodicidad y el Promedio Temporal',
    },
    description: {
      en: 'A game with a positive average can still ruin every single player who keeps playing it. The trick is that the average across many parallel bettors (the ensemble) and the average of one bettor across time need not agree — and when they don’t, expected value quietly lies. Why the path you actually live, not the crowd you average over, is what survives.',
      es: 'Un juego con una media positiva puede aun así arruinar a cada jugador que lo repita. El truco es que la media entre muchos apostadores en paralelo (el conjunto) y la media de un solo apostador a lo largo del tiempo no tienen por qué coincidir — y cuando no lo hacen, el valor esperado miente en voz baja. Por qué lo que sobrevive es el camino que de verdad recorres, no la multitud sobre la que promedias.',
    },
    dependencies: ['fat-tails', 'compounding', 'asymmetry-and-optionality'],
    tags: ['probability', 'decision-making'],
    buildNotes:
      'Ergodicity & the time average — the expert probability/decision-making rung on the deepest crack in naive expected-value thinking: when a process is NON-ERGODIC, the ensemble average (average over many parallel copies at one instant) and the time average (average of one copy over time) diverge, and decisions made on the ensemble average quietly court ruin. Assumes fat-tails (rare large deviations dominate outcomes), compounding (multiplicative growth, where order and path matter), and asymmetry-and-optionality (convex/concave payoffs, capped-downside logic). Organising idea (Ole Peters, echoing Kelly): expected value averages over PARALLEL WORLDS you will never inhabit; you live ONE trajectory THROUGH TIME, and for multiplicative dynamics the time-average growth rate is systematically below the naive expected value — because a single wipeout is absorbing and ends the path. Sections, each with mechanism + worked example: define ERGODIC vs NON-ERGODIC plainly (a process is ergodic when the time average = the ensemble average; most wealth/growth processes are NOT); the flagship coin-flip (heads +50%, tails −40%: ensemble expectation is +5% per round and looks great, but the time-average growth is NEGATIVE — sqrt(1.5·0.6) < 1 — so almost every individual player goes broke while the mean is dragged up by a vanishing fraction of astronomically lucky paths); the additive-vs-multiplicative distinction (why averaging works for a bounded, repeatable side-bet but not for your whole bankroll); the KELLY/geometric-mean fix (optimise the time-average growth rate = expected log-return, which automatically respects ruin and bet-sizes to survive); RUIN and absorbing barriers (why "it has positive EV" is not enough if a loss is irreversible — tie to margin-of-safety and to the asymmetry model); why ensemble reasoning misleads across fat tails (the mean is dominated by unrepeatable outliers); real-world faces — position sizing, insurance as buying back ergodicity, why a strategy must survive to compound, gambler’s ruin, and why "on average it works out" is cold comfort to the one path that busted. Pitfalls & where the model lies: not everything is non-ergodic (genuinely additive, bounded, repeatable bets CAN be judged on the ensemble mean — don’t over-apply); ergodicity is about the DYNAMICS, not a mood of pessimism; and don’t confuse it with mere risk-aversion (it is a statement about which average is decision-relevant, not about preferences). Build an interactive island (an "ergodicity engine": set a multiplicative gamble (up-factor, down-factor, win probability); show side by side the ENSEMBLE average of N parallel players versus a single player’s TIME path, with a rounds slider; watch the ensemble mean climb while the median/individual path decays to ruin, a readout of ensemble mean vs time-average growth rate vs share of players wiped out, and a Kelly-fraction slider that shrinks the bet until the time-average growth turns positive). Plus a Categorize (sort scenarios into ergodic / non-ergodic, or judge-on-ensemble-mean vs judge-on-time-average) and MatchConcepts (ergodicity, ensemble average, time average, non-ergodic ruin, geometric/Kelly growth), Quiz + MindMap. en + es twin.',
  },
  {
    slug: 'common-knowledge-and-coordination',
    icon: '👁️',
    difficulty: 'expert',
    order: 44,
    accent: 'accent',
    title: {
      en: 'Common Knowledge & Coordination',
      es: 'Conocimiento Común y Coordinación',
    },
    description: {
      en: 'There is a world of difference between everyone knowing a thing and everyone knowing that everyone knows it. That second, recursive kind of knowledge — common knowledge — is what lets a crowd move as one: topple a regime, run on a bank, laugh at the emperor’s clothes. Why the public signal that makes knowledge common, not the private truth, is what actually moves people.',
      es: 'Hay un mundo de diferencia entre que todos sepan algo y que todos sepan que todos lo saben. Ese segundo tipo de conocimiento, recursivo — el conocimiento común — es lo que permite a una multitud moverse como una sola: derribar un régimen, provocar un pánico bancario, reírse del rey desnudo. Por qué lo que de verdad mueve a la gente es la señal pública que vuelve común el conocimiento, no la verdad privada.',
    },
    dependencies: ['nash-equilibrium', 'critical-mass', 'game-theory-basics'],
    tags: ['strategy', 'psychology'],
    buildNotes:
      'Common knowledge & coordination — the expert strategy/psychology rung on the recursive knowledge that lets groups act in concert, and why coordination hinges on what is PUBLICLY shared rather than privately true. Assumes game-theory-basics and nash-equilibrium (coordination games, multiple equilibria, best responses) and critical-mass (tipping thresholds, the fraction that must move before it is safe to move). Organising idea: distinguish (1) private knowledge (I know X), (2) mutual/shared knowledge (we each know X but not that the others know), and (3) COMMON KNOWLEDGE (everyone knows X, everyone knows that everyone knows, ad infinitum). Coordination on a risky joint action requires level 3, not level 1 — you only move against the regime / withdraw from the bank / point at the emperor when you know that enough others know that enough others will too. Sections, each with mechanism + worked example: the ladder of knowledge with the recursion made concrete (the "everyone knows that everyone knows" regress); the emperor’s-new-clothes / the child who says it out loud (the fact was mutual knowledge; the shout made it COMMON, and that is what changed behaviour) — public announcements, focal points (Schelling), and why a PUBLIC signal coordinates where a pile of private signals cannot; coordination games with a safe and a risky equilibrium, and why beliefs about others’ beliefs select which one you land on (tie to nash-equilibrium and critical-mass thresholds); real faces — bank runs and self-fulfilling panics, revolutions and preference falsification (Kuran: private opposition that stays hidden until a public spark makes it common and the dam breaks), protests and the role of visible crowds/media, advertising during major broadcasts as manufactured common knowledge (everyone sees that everyone sees the ad), the Keynesian beauty contest (guess what others guess others will do), traffic conventions and standards; why authoritarian regimes fear PUBLIC gatherings and open dissent far more than private grumbling (they attack the common-knowledge-generating channel). Pitfalls & where the model lies: common knowledge is an idealisation (true infinite recursion is rarely met — approximate/"almost common" knowledge and the electronic-mail / coordinated-attack problem show how fragile it is when confirmation can fail); a visible signal can manufacture FALSE common knowledge (rumour cascades, manufactured consensus); and not every coordination needs full common knowledge — sometimes a focal point or a little critical mass suffices. Build an interactive island (a "common-knowledge coordinator": a population in a coordination game each with a private willingness to act and a threshold "I’ll move only if I believe at least k% of others will"; toggle a PUBLIC SIGNAL (a shared announcement everyone sees everyone see) on or off and watch the same private dispositions either stay frozen (mutual knowledge, everyone waits) or cascade into collective action (common knowledge crosses the critical mass), with a readout of who-knows-what level, the believed participation, and whether the coordinated move succeeds or fizzles). Plus a Categorize (sort cases into private / mutual / common knowledge, or public-signal vs private-signal) and MatchConcepts (common knowledge, mutual knowledge, focal point, preference falsification, coordination equilibrium), Quiz + MindMap. en + es twin.',
  },
  {
    slug: 'spontaneous-order-and-the-knowledge-problem',
    icon: '🐜',
    difficulty: 'expert',
    order: 45,
    accent: 'brand',
    title: {
      en: 'Spontaneous Order & the Knowledge Problem',
      es: 'Orden Espontáneo y el Problema del Conocimiento',
    },
    description: {
      en: 'No one designs a language, a city’s food supply, or the price of copper — and yet each works, coordinating millions of strangers who never meet. Order can emerge from the bottom up, without a planner, precisely because the knowledge needed to run the whole is scattered in fragments no single mind can gather. Why the market, the anthill, and the footpath across the lawn all solve a problem no committee could.',
      es: 'Nadie diseña un idioma, el suministro de comida de una ciudad o el precio del cobre — y sin embargo cada uno funciona, coordinando a millones de desconocidos que jamás se encuentran. El orden puede emerger de abajo arriba, sin planificador, precisamente porque el conocimiento necesario para gobernar el todo está disperso en fragmentos que ninguna mente puede reunir. Por qué el mercado, el hormiguero y el sendero pisado en el césped resuelven un problema que ningún comité podría.',
    },
    dependencies: ['supply-and-demand', 'emergence', 'incentives'],
    tags: ['economics', 'systems-thinking'],
    buildNotes:
      'Spontaneous order & the knowledge problem — the expert economics/systems-thinking rung (Hayek, Adam Smith’s invisible hand, Michael Polanyi, Leonard Read’s "I, Pencil") on how coherent, adaptive order arises WITHOUT central design, and why it must, because the relevant knowledge is irreducibly dispersed. Assumes supply-and-demand (prices clear markets), emergence (macro-order from local rules with no controller) and incentives (agents act on local payoffs). Organising idea: THE KNOWLEDGE PROBLEM (Hayek, "The Use of Knowledge in Society", 1945) — the data a planner would need (every person’s tacit, local, time-and-place-specific circumstances, preferences and know-how) is never given to a single mind; it exists only in scattered fragments, much of it tacit (Polanyi: "we know more than we can tell"). So the economic problem is not allocating known resources but MOBILISING knowledge no one possesses in full. SPONTANEOUS ORDER (Scottish Enlightenment: "the result of human action but not of human design") is the answer: institutions and patterns — prices, language, common law, money, manners, footpaths, science — that are grown, not built. Sections, each with mechanism + worked example: the knowledge problem stated (the tin-shortage example — a price rise transmits "use less tin" to millions who never learn why, each responding to a single number that summarises the whole world’s change); PRICES AS SIGNALS/telecommunication system (a market as a giant distributed computer aggregating dispersed knowledge into one sufficient statistic, the price; contrast with the socialist-calculation debate — why the planner is blind without prices); "I, PENCIL" and the invisible hand (no one knows how to make a pencil; the order coordinates strangers via self-interest, Smith); ORDER WITHOUT A DESIGNER across domains — language and its grammar, common law, the desire-path/footpath, science as a spontaneous order, ant colonies/stigmergy and the market’s kinship to emergence; the RULES that let it work (property, contract, stable expectations — Hayek’s cosmos vs taxis, grown "nomos" vs made order) and why good institutions are often evolved, not engineered. Pitfalls & where the model lies: spontaneous ≠ optimal or just (path-dependence, lock-in, externalities and tragedies of the commons are ALSO spontaneous orders — bottom-up does not mean benign; tie to externalities/tragedy-of-the-commons); it is not an argument that ALL design is bad (rules themselves are often deliberately set; the claim is about limits on central knowledge, not a blanket anti-planning slogan); the FATAL CONCEIT / planner’s hubris cuts both ways — markets can fail, and "let it emerge" can be its own lazy dogma; and emergence can encode and amplify bad local incentives. Build an interactive island (a "dispersed-knowledge market": a grid/population of agents each holding only PRIVATE local info (a cost, a need) and following a simple local rule; toggle between a CENTRAL PLANNER who must set one quantity/price from aggregate data it cannot see in full versus a PRICE mechanism that lets the number emerge from local trades; introduce a shock (a shortage somewhere) and watch the price-coordinated system re-allocate and clear while the blind-planner system mis-allocates and leaves shortages/gluts; readout of total welfare, unmet need, and how much dispersed knowledge each regime actually used). Plus a Categorize (sort orders into designed/made vs spontaneous/grown, or knowledge-centralisable vs irreducibly-dispersed) and MatchConcepts (spontaneous order, the knowledge problem, tacit knowledge, price signal, invisible hand), Quiz + MindMap. en + es twin.',
  },
];

/** Quick lookup by slug. */
export const upcomingBySlug = new Map<string, UpcomingCourse>(
  upcomingCourses.map((c) => [c.slug, c]),
);
