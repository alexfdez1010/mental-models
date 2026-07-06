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
 * `credible-commitment-and-deterrence`, `path-dependence-and-lock-in`, …) have
 * graduated and been removed; their topic MDX is now the record. Lowest `order`
 * is built next. The remaining entries all sit in the **expert tier**,
 * deliberately kept tag-diverse so no single roadmap tag races ahead:
 * economics/psychology (`principal-agent-problem`, 37),
 * probability/science-engineering (`cumulative-advantage-and-power-laws`, 38)
 * and psychology (`debiasing-and-the-bias-blind-spot`, 39).
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
  // `externalities` (20), `moats` (21), `ecosystems-and-niches` (22),
  // `leverage-points` (23), `lollapalooza-effect` (24), `regression-to-the-mean`
  // (25), `critical-mass` (26), `nash-equilibrium` (27), `asymmetry-and-optionality`
  // (28), `fitness-landscapes` (29), `mechanism-design` (30),
  // `combining-models-latticework` (31), `deciding-under-deep-uncertainty` (32),
  // `influence-and-persuasion` (33), `evolution-of-cooperation` (34),
  // `credible-commitment-and-deterrence` (35) and `path-dependence-and-lock-in`
  // (the expert systems/economics rung, order 36) have graduated and been
  // removed; their topic MDX is now the record. The lowest-order entry below
  // (`principal-agent-problem`, order 37) is built next. The remaining queue
  // finishes the expert tier and keeps the breadth tag-diverse, spanning
  // economics/psychology (`principal-agent-problem`), probability/science-engineering
  // (`cumulative-advantage-and-power-laws`) and psychology
  // (`debiasing-and-the-bias-blind-spot`) so no single roadmap tag races ahead.
  {
    slug: 'principal-agent-problem',
    icon: '🎭',
    difficulty: 'expert',
    order: 37,
    accent: 'brand',
    title: {
      en: 'The Principal–Agent Problem',
      es: 'El Problema del Principal y el Agente',
    },
    description: {
      en: 'You hire someone to act for you — an employee, a fund manager, a contractor, a politician — but they have their own interests and know things you don’t. Why "getting someone to do what you want" is one of the deepest problems in economics: hidden action, hidden information, and the incentives that (imperfectly) realign them.',
      es: 'Contratas a alguien para que actúe por ti —un empleado, un gestor de fondos, un contratista, un político— pero tiene sus propios intereses y sabe cosas que tú no. Por qué "conseguir que alguien haga lo que quieres" es uno de los problemas más profundos de la economía: acción oculta, información oculta y los incentivos que (imperfectamente) los realinean.',
    },
    dependencies: ['incentives', 'mechanism-design'],
    tags: ['economics', 'psychology'],
    buildNotes:
      'The principal–agent problem — the expert economics/psychology rung on the friction that appears the moment one party (the principal) delegates to another (the agent) whose interests diverge and whose actions or knowledge the principal cannot fully observe. Assumes incentives (people respond to the rewards they face) and mechanism-design (designing rules/contracts to get desired behaviour under private information). Sections, each with mechanism + worked example: the core setup (principal wants an outcome, hires an agent to produce it, but the agent has their own goals — shareholders vs CEO, patient vs doctor, voters vs politician, you vs your contractor/mechanic/financial adviser); the two informational asymmetries — HIDDEN ACTION / moral hazard (you can’t watch the agent’s effort, so they shirk or take risks you’d veto — the insured driver, the salaried worker, the bailed-out bank) and HIDDEN INFORMATION / adverse selection (the agent knows things you don’t before you even contract — the used-car "market for lemons", insurance, hiring); agency costs (the value bled away by misalignment plus what you spend monitoring and bonding against it); the incentive-alignment toolkit and its own failures — pay-for-performance and equity (and how it backfires: gaming metrics, teaching-to-the-test, Goodhart’s law, excessive risk-taking on stock options), monitoring and audits, screening and signalling (warranties, credentials, deductibles that make agents self-sort), reputation and repeated dealing (tie to evolution-of-cooperation), and efficiency wages; the impossibility of perfect contracts (incomplete contracts, unobservable effort, the trade-off between risk and incentives — loading all risk onto a risk-averse agent is costly). Pitfalls & where the model lies: assuming money is the only motive (intrinsic motivation, professional norms and crowding-out — sometimes paying MORE gets you LESS); strong incentives amplifying measurement error and inviting manipulation (multitasking problem — reward the measurable and the unmeasurable gets dropped); and treating monitoring as free. Build an interactive island (an "incentive-contract designer": the learner slides the mix between fixed salary and performance pay for an agent whose hidden effort and risk-taking respond to the contract; they watch effort, gaming/risk, agency cost and the principal’s net payoff move, discovering there’s an interior optimum — neither pure salary nor pure commission — and that pushing incentives too hard backfires), plus a Categorize (hidden action / moral hazard vs hidden information / adverse selection) and MatchConcepts, Quiz + MindMap. en + es twin.',
  },
  {
    slug: 'cumulative-advantage-and-power-laws',
    icon: '📈',
    difficulty: 'expert',
    order: 38,
    accent: 'accent',
    title: {
      en: 'Cumulative Advantage & Power Laws',
      es: 'Ventaja Acumulativa y Leyes de Potencia',
    },
    description: {
      en: 'Why a few winners take almost everything while a long tail gets scraps: when success breeds success — the rich get richer, the cited get cited — small early leads compound into staggeringly unequal, "scale-free" outcomes. The generative engine behind power laws, the 80/20 rule, and winner-take-all markets, and where the pattern misleads.',
      es: 'Por qué unos pocos ganadores se llevan casi todo mientras una larga cola recibe migajas: cuando el éxito engendra éxito —el rico se hace más rico, el citado más citado— pequeñas ventajas tempranas se componen en resultados asombrosamente desiguales y "sin escala". El motor generador tras las leyes de potencia, la regla 80/20 y los mercados de "el ganador se lo lleva todo", y dónde el patrón engaña.',
    },
    dependencies: ['fat-tails', 'feedback-loops'],
    tags: ['probability', 'science-engineering'],
    buildNotes:
      'Cumulative advantage & power laws — the expert probability/science-engineering rung on the GENERATIVE process that manufactures extreme inequality and fat-tailed distributions. Assumes fat-tails (distributions where the extremes dominate) and feedback-loops (reinforcing loops). The organising idea: preferential attachment / cumulative advantage / the Matthew effect ("to those who have, more shall be given") — a reinforcing loop where having more of something (wealth, citations, followers, links) makes you more likely to get even more, so small early differences compound into vast, self-perpetuating gaps. Sections, each with mechanism + worked example: what a power law IS (a distribution where P(x) ~ x^-α, scale-free — the same shape at every zoom level — contrasted with the bell curve, where extremes are impossibly rare; city sizes, word frequencies/Zipf, wealth/Pareto, earthquake magnitudes, book/song sales, web-link degree); the generative mechanism — preferential attachment (Yule–Simon, Barabási–Albert): new links attach preferentially to already-popular nodes, so popularity begets popularity; cumulative advantage in careers and science (Merton\'s Matthew effect — the famous get disproportionate credit); the 80/20 Pareto principle as the everyday face of a power law (a few causes drive most effects) and how to USE it (prioritise the vital few); winner-take-all / superstar markets (why the best violinist earns 100x the tenth-best, not 10% more — tiny quality edges plus scalability and network effects compound); the tyranny of the tail — in fat-tailed/power-law worlds the average is meaningless, a single outlier can outweigh the entire rest, and sample averages are unstable (tie back to fat-tails). Contrast luck vs skill: because early leads compound, outcomes are far more sensitive to small initial luck than a proportional-reward intuition suggests (path dependence rhymes here). Pitfalls & where the model lies: seeing power laws everywhere (many "power laws" are really log-normals or exponentials — the eyeball test on a log-log plot is not proof); confusing the compounding of advantage with pure merit (survivorship + Matthew effect inflate the winner\'s apparent skill); and assuming the tail is stable when the exponent is only estimated from scarce extreme data. Build an interactive island (a "cumulative-advantage engine": balls/tokens drop one at a time and attach to existing piles with probability proportional to pile size, a tunable preferential-attachment strength and a small random head-start; the learner watches a runaway winner emerge, sees the resulting rank-size curve go straight on a log-log axis, and can turn the attachment strength down to watch the distribution collapse back toward equality; readout of top-share / Gini-ish inequality / biggest pile). Plus a Categorize (bell-curve/thin-tailed quantity vs power-law/scale-free quantity) and MatchConcepts (preferential attachment, Matthew effect, Pareto 80/20, scale-free, winner-take-all), Quiz + MindMap. en + es twin.',
  },
  {
    slug: 'debiasing-and-the-bias-blind-spot',
    icon: '🪞',
    difficulty: 'expert',
    order: 39,
    accent: 'brand',
    title: {
      en: 'Debiasing & the Bias Blind Spot',
      es: 'Corrección de Sesgos y el Punto Ciego',
    },
    description: {
      en: 'You can ace every lesson on cognitive bias and still be just as biased — because you see everyone\'s distortions but your own. The meta-skill of catching your own thinking in the act: why knowing about biases barely helps, and the handful of things that actually do — the outside view, red teams, checklists, and pre-commitment.',
      es: 'Puedes dominar todas las lecciones sobre sesgos cognitivos y seguir igual de sesgado — porque ves las distorsiones de todos menos las tuyas. La meta-destreza de pillar tu propio pensamiento en el acto: por qué saber de sesgos apenas ayuda, y las pocas cosas que sí funcionan — la visión externa, los equipos rojos, las listas de comprobación y el compromiso previo.',
    },
    dependencies: ['confirmation-bias', 'calibration-and-confidence'],
    tags: ['psychology'],
    buildNotes:
      'Debiasing & the bias blind spot — the expert psychology rung and the meta-skill the whole psychology track builds toward: not naming biases but actually reducing their grip on your own judgment. Assumes the learner has met specific biases (confirmation-bias) and calibration-and-confidence (overconfidence, Brier scores). The uncomfortable organising fact: knowing about a bias does NOT immunise you against it, and worse, the "bias blind spot" (Pronin) means you readily spot bias in others while feeling objective yourself — introspection tells you nothing, because biases operate below awareness. Sections, each with mechanism + worked example: the bias blind spot itself (people rate themselves less biased than average — a bias about biases; why "I know about anchoring so it won\'t get me" is false); why education alone barely debiases (you can recite the sunk-cost fallacy and still escalate; awareness ≠ correction); the two families of fixes — CHANGE THE THINKER vs CHANGE THE ENVIRONMENT. Thinker-side (weaker but real): the outside view / reference-class forecasting (Kahneman & Lovallo — ask "how did similar cases go?" instead of reasoning from the inside of this one), consider-the-opposite / actively-open-minded thinking, pre-mortems (imagine the project has failed and explain why), and calibration training with feedback (tie to calibration course). Environment/structure-side (stronger, because it doesn\'t rely on willpower): checklists (Gawande — offload judgment to a list so you can\'t skip the step), red teams / devil\'s advocates and structured dissent (institutionalise the disagreement so it doesn\'t depend on a brave individual), decision hygiene and independent estimates before discussion (stop anchoring and cascades — tie to social proof), algorithms/simple rules over clinical judgment where data allows (Meehl), and pre-commitment / binding your future self (tie explicitly to credible-commitment-and-deterrence — a commitment device IS a debiasing tool aimed at your own future distortions). The debiasing hierarchy: structure > incentives > training > mere awareness. Pitfalls & where the model lies: debiasing-the-debiasing (using "you\'re just biased" as a rhetorical weapon while exempting yourself — the blind spot again); over-correction (fixing overconfidence by becoming uselessly wishy-washy, or treating every intuition as suspect when expert intuition in high-validity environments is real); the cost of hygiene (checklists and red teams add friction — worth it for high-stakes, irreversible calls, overkill for reversible ones); and the fact that no technique fully removes bias, it only reduces it. Build an interactive island (a "debiasing bench": a set of realistic judgment scenarios each carrying a lurking bias — the learner first makes a snap inside-view call, then applies a chosen debiasing tool (outside view / pre-mortem / red team / checklist / independent-estimate) and watches an accuracy-or-calibration meter update, discovering that structural tools move the needle more than "just be aware" and that some tools fit some biases better than others). Plus a Categorize (does this fix change the THINKER or the ENVIRONMENT? / weak-awareness vs strong-structural fix) and MatchConcepts (bias blind spot, outside view, pre-mortem, red team, decision hygiene), Quiz + MindMap. en + es twin.',
  },
];

/** Quick lookup by slug. */
export const upcomingBySlug = new Map<string, UpcomingCourse>(
  upcomingCourses.map((c) => [c.slug, c]),
);
