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
 * `common-knowledge-and-coordination`,
 * `spontaneous-order-and-the-knowledge-problem`,
 * `evolutionarily-stable-strategies`, `goodharts-law`,
 * `information-cascades-and-herding`, …)
 * have graduated and been removed; their topic MDX is now the record. Lowest
 * `order` is built next. The remaining entries all sit in the **expert tier**,
 * deliberately kept tag-diverse so no single roadmap tag races ahead:
 * decision-making/probability (`the-value-of-information`, 49),
 * economics/systems-thinking/strategy (`creative-destruction`, 50) and
 * biology-evolution/systems-thinking (`punctuated-equilibrium`, 51).
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
  // The earlier expert rungs — `externalities` (20) … `goodharts-law` (47) and
  // `information-cascades-and-herding` (48) — have graduated and been removed;
  // their topic MDX is now the record. The lowest-order entry below
  // (`the-value-of-information`, order 49) is built next. The remaining
  // queue keeps the expert-tier breadth tag-diverse, spanning
  // decision-making/probability (`the-value-of-information`),
  // economics/systems-thinking/strategy (`creative-destruction`) and
  // biology-evolution/systems-thinking (`punctuated-equilibrium`) so no single
  // roadmap tag races ahead.
  {
    slug: 'the-value-of-information',
    icon: '🔍',
    difficulty: 'expert',
    order: 49,
    accent: 'brand',
    title: {
      en: 'The Value of Information',
      es: 'El Valor de la Información',
    },
    description: {
      en: 'Before you pay for one more test, study, or opinion, ask the question almost no one asks: could the answer actually change what you do? Information is only worth something if it might flip a decision — and its value is capped by the cost of being wrong. The mental model that tells you when to look before you leap, and when looking is just expensive procrastination.',
      es: 'Antes de pagar por una prueba, un estudio o una opinión más, hazte la pregunta que casi nadie hace: ¿podría la respuesta cambiar de verdad lo que vas a hacer? La información solo vale algo si podría hacerte cambiar de decisión — y su valor está acotado por el coste de equivocarte. El modelo mental que te dice cuándo mirar antes de saltar, y cuándo mirar es solo una procrastinación cara.',
    },
    dependencies: ['bayesian-updating', 'thinking-in-probabilities', 'asymmetry-and-optionality'],
    tags: ['decision-making', 'probability'],
    buildNotes:
      'The Value of Information (VOI) — the expert decision-making/probability rung from decision analysis (Howard 1966; the expected value of perfect and of sample/imperfect information). Assumes bayesian-updating (revising beliefs from a test result), thinking-in-probabilities (expected value over states) and asymmetry-and-optionality (the payoff to knowing is convex — you keep the good news and act on it, discard the bad). Organising idea — the single sharpest question in applied decision-making: information has value ONLY if it could change your decision; if you would do the same thing whatever the test says, the test is worth exactly zero no matter how accurate or interesting it is. Value comes from AVERTED MISTAKES, so VOI = (expected payoff of the best decision WITH the information) minus (expected payoff of the best decision WITHOUT it), and it is always >= 0 and always <= the cost of being wrong (the loss you could avoid). Sections, each mechanism + worked example: the core definition and the "would it change my action?" test (a doctor who will operate regardless gains nothing from the scan); Expected Value of PERFECT Information (EVPI) as the ceiling — what a clairvoyant is worth — worked with a real payoff table (e.g. drill-the-well / launch-the-product decision across two states, compute EV with clairvoyance minus EV of the best prior action); Expected Value of SAMPLE/IMPERFECT Information (EVSI) for a real, noisy test — fold in sensitivity/specificity via Bayes, compute the pre-posterior expected value, and note EVSI <= EVPI always; the net value = EVSI minus the cost/price of the test, and the decision to gather info is itself an expected-value decision; why VOI is highest when you are genuinely UNCERTAIN and the decision is CLOSE and the stakes are HIGH (a lopsided prior, a trivial decision, or an unactionable answer all drive VOI to zero); the tie to optionality (information is a real option — the value of learning before committing is the value of keeping your choice open). Pitfalls & where the model lies: gathering information is not free (money, time, and the cost of DELAY — sometimes acting now beats a better-informed action later); more data past the decision threshold is pure waste (analysis paralysis, the vanity metric, the study that cannot change the plan); ignoring the cost of the WRONG test (a very accurate test of the wrong question is worthless); base-rate and reliability errors make people wildly overvalue noisy tests; and VOI assumes you will actually ACT on the answer — information you will rationalise away is worth nothing. Build an interactive island (a "value-of-information lab": a two-action decision under two uncertain states with an editable payoff table and a prior-probability slider; a test with adjustable RELIABILITY and COST; show the expected value of acting on the prior alone, the EVPI ceiling (perfect clairvoyance), and the EVSI of the noisy test, with the net value = EVSI minus cost — and a readout that flips to "this test cannot change your decision → value 0" whenever the prior is lopsided enough or the decision one-sided, so the learner SEES value collapse to zero as the decision stops being close). Plus a Categorize (sort scenarios into worth-testing vs test-is-worthless, i.e. could-change-the-action vs could-not) and MatchConcepts (value of information, EVPI, EVSI, the change-my-action test, analysis paralysis), Quiz + MindMap. en + es twin.',
  },
  // ── Appended to keep the queue tag-diverse (economics, biology-evolution) ────
  // With `goodharts-law` graduated, the queue had dropped to two probability/
  // psychology/decision-making entries; these two add the missing economics and
  // biology-evolution breadth at the expert tier so no single tag races ahead.
  {
    slug: 'creative-destruction',
    icon: '🌪️',
    difficulty: 'expert',
    order: 50,
    accent: 'accent',
    title: {
      en: 'Creative Destruction',
      es: 'Destrucción Creativa',
    },
    description: {
      en: 'Growth does not add to the old order — it dismantles it. Every genuinely new product, method, or business model must destroy the incumbent it replaces, so progress and ruin are the same event seen from two sides. Why the healthiest economies are the ones most willing to let their winners die.',
      es: 'El crecimiento no se suma al orden viejo: lo desmantela. Todo producto, método o modelo de negocio de verdad nuevo tiene que destruir al titular que reemplaza, así que el progreso y la ruina son el mismo suceso visto por dos caras. Por qué las economías más sanas son las más dispuestas a dejar morir a sus ganadores.',
    },
    dependencies: ['supply-and-demand', 'feedback-loops', 'moats'],
    tags: ['economics', 'systems-thinking', 'strategy'],
    buildNotes:
      "Creative destruction — the expert economics/systems-thinking rung from Joseph Schumpeter (1942, borrowing from Marx and Sombart): the \"process of industrial mutation that incessantly revolutionises the economic structure from within, incessantly destroying the old one, incessantly creating a new one.\" Assumes supply-and-demand (new entrants undercut incumbents on price/quality and shift the whole curve), feedback-loops (innovation compounds and reinvests, and the destruction of incumbents frees capital/labour that fuels the next wave) and moats (what protects an incumbent, and why every moat is eventually breached). Organising idea: economic growth is NOT incremental accumulation on top of a stable base — it is a gale of innovation that must KILL the thing it replaces. The car destroyed the horse-and-carriage trade, streaming destroyed video rental, the transistor destroyed the vacuum-tube industry, digital photography destroyed Kodak (which invented it). Progress and ruin are two faces of one event. Sections, each mechanism + worked example: the core claim and why it is destruction, not addition (the new S-curve rises only as the old one collapses; jobs, firms, and skills are genuinely destroyed, not merely displaced upward); the entrepreneur and the innovation as the engine (new goods, new methods, new markets, new supply chains, new organisational forms — Schumpeter's five kinds of innovation); why incumbents lose despite every advantage (the incumbent's curse / disruption: existing moats, cash, and customers become anchors; the innovator's dilemma where serving today's best customers rationally blinds you to the low-end entrant); the wave/cycle structure (Kondratiev-style long waves; booms of building and busts of clearing are part of one process, not a malfunction); the tie to moats and Red Queen (no moat is permanent; standing still is falling behind). Worked cases: Kodak, Blockbuster vs Netflix, Nokia/BlackBerry vs smartphone, gas lamps → electric light, mainframe → PC → cloud, ICE cars → EVs. Pitfalls & where the model lies: it is NOT a cheer for destruction for its own sake (the human cost of displaced workers is real and is the core policy tension — creative destruction explains growth but does not by itself justify laissez-faire; safety nets and retraining are the honest counterweight); not all disruption is creative (some \"disruption\" is just value extraction, rent-seeking, or hype with no productivity gain); survivorship bias makes us over-celebrate the winners and forget the destroyed; and incumbents sometimes DO adapt (the model is a strong tendency, not an iron law — some firms cross the chasm). Fixes/uses: for a strategist, assume your current moat is a countdown clock and cannibalise yourself before someone else does; for a policymaker, cushion the people, not the failing firms; for an investor, distinguish durable disruption from fads. Build an interactive island (a \"creative-destruction wave\": overlapping S-curves where a rising entrant technology's adoption curve climbs as the incumbent's installed base and profits collapse, with a slider for the entrant's improvement rate and a readout of the crossover point where the incumbent is doomed — plus the freed resources flowing into the next curve). Plus a Categorize (sort changes into genuinely-creative-destruction vs mere-churn/rent-seeking, or disrupted-incumbent vs adapted-incumbent) and MatchConcepts (creative destruction, innovator's dilemma, incumbent's curse, Schumpeterian rent, long wave), Quiz + MindMap. en + es twin.",
  },
  {
    slug: 'punctuated-equilibrium',
    icon: '🌋',
    difficulty: 'expert',
    order: 51,
    accent: 'brand',
    title: {
      en: 'Punctuated Equilibrium',
      es: 'Equilibrio Puntuado',
    },
    description: {
      en: 'Change is not a steady drip — it is long stretches of almost nothing, snapped by sudden bursts of everything. Species, technologies, companies, and even your own habits mostly sit still, then lurch. Why "stable for ages, then all at once" is the real shape of history, and how to read the stillness before the lurch.',
      es: 'El cambio no es un goteo constante: son largos tramos de casi nada, rotos por estallidos súbitos de todo. Las especies, las tecnologías, las empresas y hasta tus propios hábitos permanecen sobre todo quietos, y luego pegan un tirón. Por qué «estable durante siglos, y luego de golpe» es la forma real de la historia, y cómo leer la quietud antes del tirón.',
    },
    dependencies: ['natural-selection', 'fitness-landscapes', 'path-dependence-and-lock-in'],
    tags: ['biology-evolution', 'systems-thinking'],
    buildNotes:
      'Punctuated equilibrium — the expert biology-evolution/systems-thinking rung from Niles Eldredge & Stephen Jay Gould (1972): most species show long periods of morphological STASIS interrupted by geologically rapid bursts of change, usually at speciation events — not the slow, uniform gradualism Darwin\'s successors assumed. Assumes natural-selection (the mechanism of adaptive change), fitness-landscapes (stasis = sitting on a local peak; a punctuation = a jump to a new peak when the landscape shifts or a barrier is crossed) and path-dependence-and-lock-in (why systems get stuck in stasis — established structure, developmental constraints, and network effects resist change until something forces it). Organising idea: change is lumpy, not smooth. Long equilibria (stability held in place by stabilising selection, canalisation, and interconnected constraints) are punctuated by fast transitions (triggered by environmental shocks, isolation, or a threshold being crossed), so the fossil record\'s "gaps" are data, not just missing pages. The pattern generalises far beyond biology — it is a systems model of how complex, locked-in systems actually change. Sections, each mechanism + worked example: stasis and why systems resist change (stabilising selection, developmental/organisational constraints, "if it ain\'t broke"); the punctuation and its triggers (a shock removes the constraint, a small isolated population can shift fast, a threshold tips — tie to critical-mass); why the record LOOKS gappy and why that is expected, not a failure (rapid transitions in small peripheral populations leave few fossils); the fitness-landscape reading (stuck on a local peak, then a valley-crossing to a higher one); the transfer to non-biological systems — technology (long incumbent plateaus then abrupt platform shifts), companies and institutions (Tushman & Romanelli\'s punctuated-equilibrium model of organisational change: long convergent periods broken by brief revolutionary reorientations), scientific paradigms (Kuhn: normal science punctuated by revolutions), personal habit change, and geopolitics. Worked cases: Cambrian explosion, the horseshoe crab\'s hundreds of millions of years of stasis, QWERTY/technology plateaus, corporate turnarounds, the abruptness of political revolutions. Pitfalls & where the model lies: it is NOT anti-Darwinian and NOT saltationism — the "sudden" bursts are still gradual by human timescales (thousands of years), just fast geologically; punctuated equilibrium and gradualism are not either/or, both occur and the debate is about relative frequency; do not over-apply it as an excuse to wait passively for a magic punctuation (in human systems you can sometimes ENGINEER the conditions for a jump); and beware hindsight — a "sudden" lurch often had a long invisible build-up of pressure (tie to the stillness hiding accumulating tension). Fixes/uses: read the stasis as stored, not absent, pressure; look for the constraint that must break for change to happen; in organisations, recognise that incremental tuning eventually needs a punctuated reorientation. Build an interactive island (a "stasis-and-lurch" timeline/trait-tracker: a lineage\'s trait value stays flat across long spans then jumps at punctuation events, with a slider for environmental-stability vs shock-frequency and a fitness-landscape inset showing the population pinned on a local peak until a shock lets it cross a valley to a new peak — readout contrasting the near-zero change during stasis with the burst rate during punctuations). Plus a Categorize (sort scenarios into stasis vs punctuation, or gradualist-change vs punctuated-change) and MatchConcepts (stasis, punctuation, stabilising selection, valley-crossing, peripheral isolate), Quiz + MindMap. en + es twin.',
  },
];

/** Quick lookup by slug. */
export const upcomingBySlug = new Map<string, UpcomingCourse>(
  upcomingCourses.map((c) => [c.slug, c]),
);
