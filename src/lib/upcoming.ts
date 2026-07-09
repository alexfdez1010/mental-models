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
 * `reflexivity-and-self-fulfilling-dynamics`, `antifragility-and-via-negativa`,
 * `ergodicity-and-the-time-average`, …)
 * have graduated and been removed; their topic MDX is now the record. Lowest
 * `order` is built next. The remaining entries all sit in the **expert tier**,
 * deliberately kept tag-diverse so no single roadmap tag races ahead:
 * strategy/psychology (`common-knowledge-and-coordination`, 44),
 * economics/systems-thinking (`spontaneous-order-and-the-knowledge-problem`, 45) and
 * biology-evolution/strategy (`evolutionarily-stable-strategies`, 46).
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
  // ── Beginner tier ──────────────────────────────────────────────────────────
  {
    slug: 'no-free-lunch-theorem',
    icon: '🍽️',
    difficulty: 'beginner',
    order: 1,
    accent: 'brand',
    title: {
      en: 'The No Free Lunch Theorem',
      es: 'El Teorema de que No Hay Almuerzo Gratis',
    },
    description: {
      en: 'There is no single method, model, or strategy that beats all the others on every problem. Any approach that does better on one kind of task pays for it by doing worse on another — averaged over every possible problem, they all tie. Why "what is the best algorithm / tool / rule?" is the wrong question, and "best for which problem?" is the right one.',
      es: 'No existe un único método, modelo o estrategia que gane a todos los demás en todos los problemas. Cualquier enfoque que va mejor en un tipo de tarea lo paga yendo peor en otro — promediado sobre todos los problemas posibles, todos empatan. Por qué «¿cuál es el mejor algoritmo / herramienta / regla?» es la pregunta equivocada, y «¿el mejor para qué problema?» es la correcta.',
    },
    dependencies: ['what-are-mental-models'],
    tags: ['problem-solving', 'decision-making'],
    buildNotes:
      'The No Free Lunch theorem (Wolpert & Macready, 1997, for optimization; earlier for supervised learning) as a BEGINNER mental model — assume zero background, define every term (optimizer, algorithm, search, prior, generalization) on first use. Organising idea: if you AVERAGE performance across ALL possible problems (all possible objective functions / all possible worlds), every search or learning method performs exactly the same — the clever ones and the random ones tie. So no method is universally best; superior performance on one class of problems is mathematically PAID FOR by inferior performance on the rest. The practical punchline: performance comes from MATCHING a method to the structure of the specific problem (its prior / assumptions), not from finding a magic universal method. Sections, each with an intuitive analogy + a plain worked example + a pitfall: (1) the claim in plain words — "no shortcut that works everywhere for free" (the free-lunch metaphor); (2) WHY it is true, gently — if an algorithm is tuned to exploit one kind of pattern, an adversarial problem with the opposite pattern punishes it exactly as much (a worked toy example over a tiny space of problems where you can literally tabulate that two strategies tie on the average); (3) it does NOT mean "all methods are equally good in practice" — real-world problems are NOT drawn uniformly from all possible problems; they have STRUCTURE (smoothness, regularity), and the whole game is picking a method whose built-in assumptions match that structure (this is the crucial, most-misunderstood point — spell out the misconception); (4) faces of the idea beyond CS — no single investment strategy, diet, management style, study technique, or decision rule dominates every situation; "it depends" has a theorem behind it; tie to circle-of-competence (know which problems your tool fits) and combining-models-latticework (why you carry many models, not one); (5) the free-lunch you CAN get — exploiting known structure and priors is legitimate and powerful; NFL forbids only the FREE (assumption-less, works-on-everything) lunch. Pitfalls: over-reading it as nihilism ("nothing works / all methods equal" — false in the structured real world); under-reading it ("my favourite method is just best" — beware the universal-hammer). Build an interactive island (a "no-free-lunch board": a small set of toy problems and a few strategies; let the learner run each strategy on each problem and watch one strategy win here and lose there, with a running AVERAGE bar that visibly converges so all strategies tie across the full problem set — making the theorem tangible). Plus a Categorize (sort claims into "matches NFL" vs "myth of a universal best method") and MatchConcepts (no free lunch, prior/assumption, problem structure, generalization, universal-hammer bias), Quiz + MindMap. Keep it beginner-tier: no formal proof, no heavy math — build intuition. en + es twin.',
  },
  // ── Expert tier — kept tag-diverse ─────────────────────────────────────────
  // The earlier expert rungs — `externalities` (20) … `antifragility-and-via-
  // negativa` (42) and `ergodicity-and-the-time-average` (43) — have graduated
  // and been removed; their topic MDX is now the record. The lowest-order entry
  // below (`common-knowledge-and-coordination`, order 44) is built next. The
  // remaining queue finishes the expert tier and keeps the breadth tag-diverse,
  // spanning strategy/psychology (`common-knowledge-and-coordination`),
  // economics/systems-thinking (`spontaneous-order-and-the-knowledge-problem`)
  // and biology-evolution/strategy (`evolutionarily-stable-strategies`) so no
  // single roadmap tag races ahead.
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
  {
    slug: 'evolutionarily-stable-strategies',
    icon: '🦂',
    difficulty: 'expert',
    order: 46,
    accent: 'accent',
    title: {
      en: 'Evolutionarily Stable Strategies',
      es: 'Estrategias Evolutivamente Estables',
    },
    description: {
      en: 'Why does a population settle on the mix of behaviours it does — so much fighting, so much bluffing, so much cooperation — and hold there? An evolutionarily stable strategy is one that, once common, cannot be invaded by any rival: the equilibrium biology finds without anyone choosing it. Where game theory and natural selection fuse into a single lens.',
      es: 'Por qué una población se asienta en la mezcla de conductas que exhibe — tanto pelear, tanto farolear, tanto cooperar — y se mantiene ahí. Una estrategia evolutivamente estable es la que, una vez común, no puede ser invadida por ninguna rival: el equilibrio que la biología encuentra sin que nadie lo elija. Donde la teoría de juegos y la selección natural se funden en una sola lente.',
    },
    dependencies: ['game-theory-basics', 'natural-selection', 'evolution-of-cooperation'],
    tags: ['biology-evolution', 'strategy'],
    buildNotes:
      'Evolutionarily stable strategies (ESS) — the expert biology-evolution/strategy rung (John Maynard Smith & George Price, 1973) fusing game theory with natural selection: an ESS is a strategy such that, if (almost) all members of a population adopt it, no rare mutant strategy can invade by doing better. Assumes game-theory-basics (payoffs, best responses, Nash equilibrium), natural-selection (differential reproduction, fitness) and evolution-of-cooperation (repeated interaction, replicator dynamics). Organising idea: replace the rational chooser of classic game theory with a population where fitter strategies simply reproduce more — the equilibrium is REACHED BY SELECTION, not by reasoning, and an ESS is a refinement of Nash equilibrium that must also be uninvadable by mutants at the margin. Sections, each with mechanism + worked example: the ESS definition and the invasion test (E(S,S) > E(T,S), or ties broken by E(S,T) > E(T,T)); the flagship HAWK–DOVE game (fighting vs displaying over a resource V with injury cost C: pure Hawk is invadable when C>V, so the ESS is a MIXED/polymorphic equilibrium at proportion V/C hawks — worked with real numbers); why an ESS is a Nash equilibrium but not every Nash equilibrium is an ESS (stability against drift/mutation is the extra bar); mixed strategies as either an individual randomising OR a stable polymorphism of the population; frequency-dependent selection (a strategy’s payoff depends on how common it is — rare-type advantage, e.g. the 1:1 SEX RATIO as Fisher’s ESS, left-right scale-eating fish, side-blotched-lizard rock–paper–scissors morphs); the tie to cooperation (Tit-for-Tat as (nearly) an ESS in the iterated Prisoner’s Dilemma, and why AllD is also stable — bistability); replicator dynamics as the engine that carries a population toward an ESS. Pitfalls & where the model lies: an ESS is about stability against invasion, NOT global optimality (populations get stuck at ESSs that are collectively worse — the Hawk–Dove waste of fighting is an ESS); not every game HAS a pure ESS (some have only mixed, some none); real populations have finite size, kin structure and shifting environments the static ESS ignores; and "evolutionarily stable" is easy to narrate loosely — insist on the actual invasion inequality. Build an interactive island (a "Hawk–Dove invasion lab": sliders for resource value V and injury cost C and a Hawk-fraction slider; show each type’s fitness as a function of the current Hawk fraction, mark the ESS where the lines cross, and a "let selection run" button that drives any starting mix toward the stable proportion, with a readout of the ESS Hawk share, each type’s payoff, and whether a rare mutant of the other type could invade). Plus a Categorize (sort outcomes into ESS / invadable, or pure-ESS / mixed-ESS / no-ESS) and MatchConcepts (evolutionarily stable strategy, invasion, frequency-dependent selection, Hawk–Dove, replicator dynamics), Quiz + MindMap. en + es twin.',
  },
];

/** Quick lookup by slug. */
export const upcomingBySlug = new Map<string, UpcomingCourse>(
  upcomingCourses.map((c) => [c.slug, c]),
);
