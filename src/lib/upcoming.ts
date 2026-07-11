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
 * `information-cascades-and-herding`,
 * `the-value-of-information`, …)
 * have graduated and been removed; their topic MDX is now the record. Lowest
 * `order` is built next. The remaining entries all sit in the **expert tier**,
 * deliberately kept tag-diverse so no single roadmap tag races ahead:
 * economics/systems-thinking/strategy (`creative-destruction`, 50),
 * biology-evolution/systems-thinking (`punctuated-equilibrium`, 51),
 * psychology/strategy (`preference-falsification`, 52) and
 * decision-making/economics/probability (`winners-curse`, 53).
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
  // -- Expert tier -- kept tag-diverse ----------------------------------------
  // The value-of-information rung (order 49) has graduated and been removed; its
  // topic MDX under src/content/topics/ is now the record. The lowest-order entry
  // below (`creative-destruction`, order 50) is built next. The queue is kept
  // tag-diverse across the expert tier -- economics/systems-thinking/strategy
  // (`creative-destruction`), biology-evolution/systems-thinking
  // (`punctuated-equilibrium`), psychology/strategy (`preference-falsification`)
  // and decision-making/economics/probability (`winners-curse`) -- so no single
  // roadmap tag races ahead.
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
  {
    slug: 'preference-falsification',
    icon: '🎭',
    difficulty: 'expert',
    order: 52,
    accent: 'brand',
    title: {
      en: 'Preference Falsification',
      es: 'Falsificación de Preferencias',
    },
    description: {
      en: "When speaking your mind is costly, people voice the opinion they think is safe, not the one they hold — so the public consensus can be a mirror almost nobody privately believes, and it can flip overnight.",
      es: "Cuando decir lo que piensas sale caro, la gente expresa la opinión que cree segura, no la que sostiene — así que el consenso público puede ser un espejo que casi nadie se cree en privado, y puede voltearse de la noche a la mañana.",
    },
    dependencies: ['incentives', 'information-cascades-and-herding', 'common-knowledge-and-coordination'],
    tags: ['psychology', 'strategy', 'systems-thinking'],
    buildNotes:
      "Preference falsification — the expert psychology/strategy rung from Timur Kuran (Private Truths, Public Lies, 1995): when expressing your true preference carries a social, professional or political cost, you publicly state the preference you think is rewarded and hide your private one. Assumes incentives (the social payoff/punishment that makes honesty costly), information-cascades-and-herding (people read others' stated views as evidence and copy them) and common-knowledge-and-coordination (why a shared but unspoken truth stays unspoken until it becomes common knowledge). Organising idea: a visible public consensus can be a facade almost nobody privately believes, held up only because each person underestimates how many others secretly agree with them. Because everyone is watching a falsified signal, the true distribution of opinion is invisible — until a small shock lets a few speak honestly, which lowers the cost for the next few, and the whole edifice can collapse with startling speed (preference cascades, the surprising suddenness of revolutions, the emperor's new clothes, the overnight unravelling of unpopular norms). Sections, each mechanism + worked example: the core definition and the private-vs-public split; why the cost of dissent drives it (and how repression raises MEASURED consensus while hollowing out real support); the hidden-distribution problem (pluralistic ignorance — everyone thinks they are the lonely dissenter); the cascade/tipping mechanism when the cost drops (tie to critical-mass and information cascades — a few brave defectors flip the common knowledge and the dam breaks); the persistence trap (falsification also freezes bad norms, censorship and unloved policies in place for years, then they evaporate at once); the distortion of knowledge itself (when honest debate is falsified, everyone — including rulers — ends up reasoning from fake information). Worked cases: the 1989 collapse of Eastern Bloc regimes, bank-run-style opinion reversals, corporate cultures where nobody voices the obvious problem, sudden shifts in social norms. Pitfalls & where the model lies: not every hidden preference cascades (some private views really are fringe; a loud minority can falsify in the other direction too); do not use it to claim any silent majority secretly agrees with you (unfalsifiable and self-serving); revealed shifts can overshoot; measured public opinion is noisy evidence, not proof, of private opinion. Fixes/uses: build institutions that lower the cost of honesty (secret ballots, anonymity, steel-manning dissent) to surface real preferences before they cascade; as a forecaster, treat lopsided public consensus under high dissent-cost as fragile. Build an interactive island (a preference-falsification cascade: a population grid where each person has a hidden private threshold and publicly conforms until the visible share of dissenters exceeds it, with a dissent-cost slider and a small-shock button — lower the cost or inject a few brave speakers and watch a stable false consensus unravel; a readout contrasting the true private distribution with the falsified public one). Plus a Categorize (likely-to-cascade vs stably-falsified, or genuine-consensus vs falsified-consensus) and MatchConcepts (preference falsification, pluralistic ignorance, preference cascade, common knowledge, dissent cost), Quiz + MindMap. en + es twin.",
  },
  {
    slug: 'winners-curse',
    icon: '🏆',
    difficulty: 'expert',
    order: 53,
    accent: 'accent',
    title: {
      en: "The Winner's Curse",
      es: 'La Maldición del Ganador',
    },
    description: {
      en: "In a competitive auction for something of uncertain value, winning is bad news: you won precisely because you were the most optimistic bidder, so the very act of winning means you probably overpaid.",
      es: "En una subasta competitiva por algo de valor incierto, ganar es una mala noticia: has ganado precisamente porque eras el pujador más optimista, así que el propio hecho de ganar significa que probablemente pagaste de más.",
    },
    dependencies: ['thinking-in-probabilities', 'regression-to-the-mean', 'mechanism-design'],
    tags: ['decision-making', 'economics', 'probability'],
    buildNotes:
      "The winner's curse — the expert decision-making/economics/probability rung from Capen, Clapp & Campbell (1971, oil-lease auctions): when many bidders estimate the uncertain COMMON value of a prize and the highest bid wins, the winner is systematically the one who most OVERestimated it, so winning itself is evidence you paid too much. Assumes thinking-in-probabilities (each bid is a noisy estimate drawn from a distribution around the true value), regression-to-the-mean (the maximum of many noisy estimates sits far above the average and above the truth, and will regress down) and mechanism-design (how the auction format shapes bidding and how to bid to avoid the curse). Organising idea: conditioning on winning changes the odds. Your estimate might be unbiased before the auction, but the event you-won selects for the highest, most optimistic draw, so E[value | you won] is below E[value]. The rational fix is to bid as if you have ALREADY won and been told your estimate was the highest — shade your bid DOWN to correct for the selection, and shade it more the more rivals there are and the more uncertain the value. Sections, each mechanism + worked example: common-value vs private-value auctions (the curse bites on COMMON value — an oil field, spectrum, a company, a free-agent athlete — not on private how-much-YOU-enjoy-it value); the selection mechanism worked numerically (N bidders, true value plus noise; show the expected winning estimate rising above the truth as N grows); the bid-shading correction (condition on being highest — the more bidders, the deeper you shade, the paradox that more competition means bidding LESS aggressively per signal); the regression-to-the-mean framing (the winner's optimistic estimate regresses ex post, the deal underperforms); real arenas — corporate M&A (acquirers overpay, the acquisition premium and post-merger underperformance), IPOs, spectrum and mineral-rights auctions, sports free agency, competitive hiring (you win the candidate everyone else passed on at that price), online ad auctions and hot-housing-market bidding wars. Pitfalls & where the model lies: the curse is about COMMON value and only bites if bidders fail to shade — sophisticated bidders in equilibrium already correct for it, so it is a warning for the naive, not an iron law; private-value auctions do not suffer it; second-price/Vickrey and well-designed mechanisms blunt it; and do not over-shade into never winning (the goal is the right bid, not zero bids). Fixes/uses: estimate value then subtract a selection correction that grows with the number of rivals and the uncertainty; as an acquirer, be most cautious exactly when you win easily; as a mechanism designer, pick formats that reduce the curse and reveal information. Build an interactive island (a winner's-curse auction sim: a hidden true common value, N simulated bidders each drawing a noisy estimate, sliders for number of bidders and estimate noise, and a your-bid control; run repeated auctions and chart the average gap between the winning bid and the true value — watch overpayment GROW with more bidders and more noise, and a bid-shading toggle pull the winner's expected profit back toward zero). Plus a Categorize (curse-prone common-value vs safe private-value, or shaded vs naive bidding) and MatchConcepts (winner's curse, common value, bid shading, regression to the mean, selection on winning), Quiz + MindMap. en + es twin.",
  },
];

/** Quick lookup by slug. */
export const upcomingBySlug = new Map<string, UpcomingCourse>(
  upcomingCourses.map((c) => [c.slug, c]),
);
