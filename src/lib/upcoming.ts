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
 * `ergodicity-and-the-time-average`, `no-free-lunch-theorem`,
 * `common-knowledge-and-coordination`, …)
 * have graduated and been removed; their topic MDX is now the record. Lowest
 * `order` is built next. The remaining entries all sit in the **expert tier**,
 * deliberately kept tag-diverse so no single roadmap tag races ahead:
 * economics/systems-thinking (`spontaneous-order-and-the-knowledge-problem`, 45),
 * biology-evolution/strategy (`evolutionarily-stable-strategies`, 46),
 * systems-thinking/psychology/economics (`goodharts-law`, 47) and
 * probability/psychology (`information-cascades-and-herding`, 48).
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
  // The earlier expert rungs — `externalities` (20) … `ergodicity-and-the-time-
  // average` (43) and `common-knowledge-and-coordination` (44) — have graduated
  // and been removed; their topic MDX is now the record. The lowest-order entry
  // below (`spontaneous-order-and-the-knowledge-problem`, order 45) is built
  // next. The remaining queue finishes the expert tier and keeps the breadth
  // tag-diverse, spanning economics/systems-thinking
  // (`spontaneous-order-and-the-knowledge-problem`), biology-evolution/strategy
  // (`evolutionarily-stable-strategies`), systems-thinking/psychology/economics
  // (`goodharts-law`) and probability/psychology
  // (`information-cascades-and-herding`) so no single roadmap tag races ahead.
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
  {
    slug: 'goodharts-law',
    icon: '🎯',
    difficulty: 'expert',
    order: 47,
    accent: 'brand',
    title: {
      en: "Goodhart's Law",
      es: 'La Ley de Goodhart',
    },
    description: {
      en: 'When a measure becomes a target, it stops being a good measure. Point an incentive at a proxy — test scores, clicks, arrests, hospital wait-times — and people optimise the proxy while the real goal it stood for quietly rots. Why every metric you reward eventually lies to you, and what to do about it.',
      es: 'Cuando una medida se convierte en objetivo, deja de ser una buena medida. Apunta un incentivo a un indicador — notas de examen, clics, detenciones, tiempos de espera hospitalarios — y la gente optimiza el indicador mientras el objetivo real que representaba se pudre en silencio. Por qué toda métrica que premias acaba mintiéndote, y qué hacer al respecto.',
    },
    dependencies: ['incentives', 'feedback-loops', 'principal-agent-problem'],
    tags: ['systems-thinking', 'psychology', 'economics'],
    buildNotes:
      "Goodhart's Law — the expert systems-thinking/psychology/economics rung: \"When a measure becomes a target, it ceases to be a good measure\" (Charles Goodhart 1975; sharpened by Marilyn Strathern). Assumes incentives (agents optimise what is rewarded), feedback-loops (proxy optimisation feeds back and corrupts the signal) and principal-agent-problem (the measured party knows things the measurer does not, and games the gap). Organising idea: a metric is only ever a PROXY for the thing you actually care about; the two are correlated in the wild, but the moment you apply optimisation pressure to the proxy, the correlation you relied on breaks (the proxy and the goal come apart) and you get the number without the substance. Sections, each with mechanism + worked example: proxy vs goal and why we ever use proxies (the real target is unmeasurable/slow; the proxy is cheap and correlated — teaching→test scores, health→wait times, safety→reported incidents); the mechanism of decoupling under pressure (Campbell's Law, the four types in the Manheim/Garrabrant taxonomy — regressional, extremal, causal, adversarial Goodhart — kept intuitive, not heavy); flagship worked cases (the Soviet nail factory: reward by weight → one giant useless nail, reward by number → millions of tiny useless tacks; the cobra effect / Hanoi rats bounty breeding the very pest; teaching to the test; sales quotas and sandbagging; clicks/engagement metrics and clickbait; hospital A&E four-hour targets; arrest/ticket quotas; citation counts and salami-slicing science; VaR and risk metrics gamed pre-2008); why it is a SPECIAL CASE of incentives + principal-agent (the agent optimises the letter of the reward, not its spirit) and how it forms a feedback loop that erodes the metric's own validity. Pitfalls & where the model lies: it is NOT an argument against measuring at all (flying blind is worse) — it is an argument against naive single-metric targets under high stakes; not every measure collapses (low-stakes or hard-to-game measures survive; the failure scales with optimisation pressure and gameability); over-quoting it becomes a lazy excuse to dodge accountability. Fixes: use baskets of metrics that are hard to game together, hold some targets loosely, keep humans in the loop / qualitative audit, reward outcomes not proxies where possible, keep the true goal explicit, and expect to rotate metrics as they decay. Build an interactive island (a \"Goodhart pressure dial\": a scatter/bar showing a true-quality variable and a measured PROXY that track together at low pressure; crank an \"optimisation pressure / stakes\" slider and watch agents pour effort into the gap — the proxy shoots up while true quality flatlines or falls, the correlation coefficient between them visibly decaying toward zero, with a readout of measured score vs real value vs the wasted gaming effort). Plus a Categorize (sort cases into measure-still-valid vs measure-corrupted, or the Goodhart types) and MatchConcepts (proxy, target, Campbell's Law, gaming, Goodhart's Law), Quiz + MindMap. en + es twin.",
  },
  {
    slug: 'information-cascades-and-herding',
    icon: '🐑',
    difficulty: 'expert',
    order: 48,
    accent: 'accent',
    title: {
      en: 'Information Cascades & Herding',
      es: 'Cascadas de Información y Comportamiento Gregario',
    },
    description: {
      en: 'Sometimes it is perfectly rational to ignore what you know and copy the crowd — and that is exactly how the crowd goes wrong together. Once a few early choices line up, each newcomer sensibly follows the herd instead of their own private signal, so no new information enters and a fragile consensus locks in on a whim. How rational individuals produce irrational, reversible mobs.',
      es: 'A veces es perfectamente racional ignorar lo que sabes y copiar a la multitud — y así es precisamente como la multitud se equivoca en bloque. En cuanto unas pocas elecciones tempranas coinciden, cada recién llegado sigue sensatamente al rebaño en vez de a su propia señal privada, así que no entra información nueva y un consenso frágil se fija por capricho. Cómo individuos racionales producen masas irracionales y reversibles.',
    },
    dependencies: ['bayesian-updating', 'common-knowledge-and-coordination', 'critical-mass'],
    tags: ['probability', 'psychology'],
    buildNotes:
      'Information cascades & herding — the expert probability/psychology rung (Bikhchandani, Hirshleifer & Welch 1992; Banerjee 1992) on how rational Bayesian agents, observing only each other\'s ACTIONS (not their private information), rationally abandon their own signal and copy predecessors — so information stops aggregating and the group locks onto a possibly-wrong choice. Assumes bayesian-updating (posterior from prior + evidence, weighing signal strength), common-knowledge-and-coordination (acting on beliefs about others) and critical-mass (a threshold of early movers that tips the rest). Organising idea: distinguish an INFORMATION cascade (I copy you because your action reveals information I trust more than my own weak private signal — informational herding) from mere conformity/social pressure; once the public tally of actions outweighs any one private signal, each newcomer optimally ignores their own data, so their action carries NO new information, and everyone after them is in the same trap — the cascade is informationally empty yet self-perpetuating. Sections, each with mechanism + worked example: the canonical urn experiment (two urns, majority-red vs majority-blue; you see a private draw AND everyone\'s prior guesses; after two same guesses your single contrary draw is rationally overruled — walk the Bayesian arithmetic with real numbers); why cascades are RATIONAL yet FRAGILE and information-poor (they aggregate almost no private knowledge, so a tiny new public signal or one credible contrarian can shatter and reverse them — fads, flips); real faces (restaurant queues and bestseller lists, viral products and app-store ranks, bank-run/coordination links, academic and medical consensus bandwagons, financial bubbles and fashion, citation herding, standing ovations); the difference from and relationship to COMMON KNOWLEDGE and critical mass (a public signal can start OR break a cascade; visible actions are the channel); reputational herding (Scharfstein–Stein: agents herd to not look wrong alone). Pitfalls & where the model lies: herding is not always irrational (following others can be Bayesian-optimal individually even as it is collectively bad — the paradox is the point); cascades are shallow and reversible, unlike genuine consensus built on independent evidence — do not mistake agreement for accuracy (tie to base rates / diversity of information); the cure is preserving INDEPENDENT private signals (aggregate votes/prices/prediction markets that reveal information, not just actions; encourage contrarians; sequence disclosures to avoid anchoring). Build an interactive island (a "cascade line": a sequence of agents each with a private noisy signal about which of two options is correct; they decide in order, seeing only the earlier CHOICES; a signal-strength / prior slider and a step/run control; watch a couple of early coincidences trigger everyone downstream to follow regardless of their private signal, with a readout of how many people followed their own signal vs the herd, whether the cascade landed on the correct option, and how little private information actually got used — plus a "drop a public signal" button that can shatter and flip it). Plus a Categorize (sort cases into information-cascade vs independent-judgement, or fragile-herd vs robust-consensus) and MatchConcepts (information cascade, private signal, herding, reputational herding, cascade fragility), Quiz + MindMap. en + es twin.',
  },
];

/** Quick lookup by slug. */
export const upcomingBySlug = new Map<string, UpcomingCourse>(
  upcomingCourses.map((c) => [c.slug, c]),
);
