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
 * `information-cascades-and-herding`, `the-value-of-information`,
 * `creative-destruction`, `punctuated-equilibrium`,
 * `preference-falsification`, …)
 * have graduated and been removed; their topic MDX is now the record. Lowest
 * `order` is built next. The remaining entries all sit in the **expert tier**,
 * deliberately kept tag-diverse so no single roadmap tag races ahead:
 * decision-making/economics/probability (`winners-curse`, 53),
 * science-engineering/systems-thinking (`entropy-and-the-second-law`, 54) and
 * biology-evolution/science-engineering (`hormesis-and-the-dose-response`, 55).
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
  // The preference-falsification rung (order 52) has graduated and been removed; its
  // topic MDX under src/content/topics/ is now the record. The lowest-order entry
  // below (`winners-curse`, order 53) is built next. The queue is kept
  // tag-diverse across the expert tier -- decision-making/economics/probability
  // (`winners-curse`), science-engineering/systems-thinking
  // (`entropy-and-the-second-law`) and biology-evolution/science-engineering
  // (`hormesis-and-the-dose-response`) -- so no single roadmap tag races ahead.
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
  {
    slug: 'entropy-and-the-second-law',
    icon: '🔥',
    difficulty: 'expert',
    order: 54,
    accent: 'accent',
    title: {
      en: 'Entropy & the Second Law',
      es: 'La Entropía y la Segunda Ley',
    },
    description: {
      en: 'Left alone, everything runs down: heat spreads, order dissolves, batteries drain, and the tidy room turns messy — never the reverse. The second law of thermodynamics is the deepest arrow in nature, and it quietly governs why maintenance is forever, why perpetual motion is a scam, and why life must burn energy just to stay ordered.',
      es: 'Si lo dejas a su aire, todo se degrada: el calor se dispersa, el orden se disuelve, las pilas se agotan y la habitación ordenada se vuelve un caos — nunca al revés. La segunda ley de la termodinámica es la flecha más profunda de la naturaleza, y gobierna en silencio por qué el mantenimiento es eterno, por qué el movimiento perpetuo es un timo y por qué la vida debe quemar energía solo para mantenerse ordenada.',
    },
    dependencies: ['emergence', 'feedback-loops', 'compounding'],
    tags: ['science-engineering', 'systems-thinking'],
    buildNotes:
      'Entropy & the second law of thermodynamics — the expert science-engineering/systems-thinking rung, one of the most transferable models in the whole latticework. Core claim: in an isolated system, entropy (a measure of the number of microscopic arrangements consistent with the macroscopic state — loosely, disorder or "spread-out-ness" of energy) never decreases; the second law gives time its ARROW. Assumes emergence (macroscopic order/temperature as a statistical property of many particles), feedback-loops (systems relax toward equilibrium) and compounding (many independent microstates multiply, so the overwhelmingly probable macrostates dominate). Organising idea: there are vastly more disordered arrangements than ordered ones, so "running down" is not a force but a counting fact — disorder wins because it is overwhelmingly more probable. Sections, each mechanism + worked example: (1) the statistical definition — microstates vs macrostates, why a shuffled deck / a spread gas / a cooled coffee is just the astronomically-more-likely configuration (Boltzmann S = k ln W, kept intuitive; show the counting with a tiny toy system); (2) the arrow of time — why you can tell a film is running backwards (smoke un-mixing, a shattered cup reassembling) and why the past is lower-entropy; (3) energy quality, not quantity — the first law conserves energy, the second degrades its USEFULNESS (free energy → waste heat), so you can never break even; heat engines, Carnot limit, why 100%-efficient engines and perpetual motion are impossible; (4) local order costs global disorder — a fridge, a body, a company, or a living cell can build LOCAL order only by dumping MORE entropy into the surroundings (Schrödinger\'s "life feeds on negative entropy / free energy"); maintenance is forever because order decays on its own; (5) entropy as missing information — the Shannon bridge, why erasing information has a thermodynamic cost (Landauer), gentle. Transfer far beyond physics: why every machine/house/relationship/codebase needs constant energy input or it degrades (bit rot, technical debt, rust, forgetting); why "reversing" a mess always costs more work than making it; why concentrated resources (talent, capital, attention) dissipate unless actively contained; the heat-death end-state as a thinking tool for run-down systems. Pitfalls & where the model lies: entropy is NOT simply "disorder" (a crystallising system can look more ordered while total entropy rises; oil-water separation increases entropy) — it is about the number of accessible microstates and energy dispersal, so avoid the sloppy tidy-room-only metaphor without the counting; the law applies to ISOLATED/closed systems — Earth is OPEN (sunlight in, infrared out), so local complexity and life do NOT violate it, a favourite creationist misreading to debunk; "entropy always increases" is statistical, not absolute — tiny fluctuations can dip locally; do not stretch it into pop-philosophy about society being "doomed to decay" (that is metaphor, not thermodynamics). Fixes/uses: budget for maintenance as a law, not a failure; to keep order somewhere, arrange to export disorder somewhere else; treat any "free energy" or perpetual-motion pitch as a red flag; design for graceful degradation. Build an interactive island (an entropy/mixing sim: a box of particles or a two-colour gas starting neatly separated on one side, with a Play that lets them diffuse, a slider for particle count showing how irreversibility SHARPENS with N, a live entropy/микростate-count readout and an "arrow of time" toggle that tries — and visibly fails at large N — to run the film backwards; plus a simple heat-engine efficiency gauge bounded by the Carnot limit). Plus a Categorize (spontaneous entropy-increasing processes vs those that require work / would violate the 2nd law, or isolated vs open systems) and MatchConcepts (entropy, microstate/macrostate, the arrow of time, free/usable energy, Carnot limit, local-order-at-global-cost), Quiz + MindMap. en + es twin.',
  },
  {
    slug: 'hormesis-and-the-dose-response',
    icon: '💊',
    difficulty: 'expert',
    order: 55,
    accent: 'brand',
    title: {
      en: 'Hormesis & the Dose-Response Curve',
      es: 'La Hormesis y la Curva Dosis-Respuesta',
    },
    description: {
      en: 'A small dose of a stressor strengthens; a large dose of the same thing harms or kills. Exercise, fasting, vaccines, sunlight, even certain poisons follow a curve where "the dose makes the poison" — and the biggest mistake is assuming that if a lot is bad, a little must be too (or that if a little is good, more is better).',
      es: 'Una dosis pequeña de un factor de estrés fortalece; una dosis grande de lo mismo daña o mata. El ejercicio, el ayuno, las vacunas, la luz solar e incluso ciertos venenos siguen una curva en la que «la dosis hace el veneno» — y el mayor error es suponer que si mucho es malo, un poco también debe serlo (o que si un poco es bueno, más es mejor).',
    },
    dependencies: ['antifragility-and-via-negativa', 'natural-selection', 'asymmetry-and-optionality'],
    tags: ['biology-evolution', 'science-engineering'],
    buildNotes:
      'Hormesis & the dose-response curve — the expert biology-evolution/science-engineering rung. Core claim: the biological response to a dose of a stressor is often NON-MONOTONIC and biphasic — low doses stimulate or strengthen (an overcompensating adaptive response) while high doses inhibit or harm, producing a J-shaped or inverted-U curve rather than a straight line. Paracelsus\' "sola dosis facit venenum" (the dose makes the poison) is the 500-year-old headline; Southam & Ehrlich (1943) coined "hormesis." Assumes antifragility-and-via-negativa (systems that GAIN from the right amount of stressor/volatility, and the power of removal), natural-selection (why overcompensation to intermittent stress is adaptive — organisms evolved in variable environments) and nonlinearity-and-convexity (the response is a curved, not linear, function of dose, so averages mislead and Jensen\'s inequality bites). Organising idea: the effect of X is a FUNCTION of dose, and that function is usually curved with an optimum in the middle, so "good vs bad" is the wrong question — "how much, how often, with what recovery?" is the right one. Sections, each mechanism + worked example: (1) the shape itself — linear-no-threshold vs threshold vs hormetic (inverted-U / J) dose-response curves, and how to read an optimum; (2) the biological mechanism — mild stress triggers repair, autophagy, heat-shock proteins, mitochondrial and immune upregulation that OVERSHOOT baseline, leaving the system stronger (the adaptive overcompensation); recovery/rest is part of the dose (stress + recovery, not stress alone); (3) worked cases across domains — exercise (mechanical/metabolic stress → strength; overtraining → injury), fasting/caloric restriction, vaccines and immune training (a controlled small dose), sunlight/UV (vitamin D vs burns/cancer), alcohol\'s contested J-curve (and why confounding makes it a cautionary tale), radiation hormesis (real scientific controversy — flag it honestly), toxins/xenohormesis (polyphenols), psychological stress and post-traumatic GROWTH; (4) the dosing variables — magnitude, frequency, duration, and RECOVERY; acute intermittent stress with recovery builds, chronic unremitting stress destroys (tie to allostatic load); (5) the transfer as a thinking tool — teams, markets, muscles, immune systems, forests (fire suppression removes the small stressors and breeds fragility — tie antifragility), children and overprotection, debugging by fuzzing. Pitfalls & where the model lies: hormesis is NOT a licence to self-poison — the optimal dose is often small and the therapeutic window narrow, and for many genuine toxins there is no safe beneficial dose (do not generalise the curve to everything); "the dose makes the poison" cuts BOTH ways (a little of a good thing can still be optimal while more is worse — water, oxygen, sleep, and even exercise can be overdosed); publication bias and confounding plague the evidence (the alcohol J-curve, some radiation claims) so treat specific hormetic claims skeptically even though the general principle is sound; and beware the naturalistic "what doesn\'t kill me makes me stronger" slogan — some stressors just maim. Fixes/uses: ask "what is the dose-response SHAPE?" before deciding good/bad; seek the intermittent-stress-plus-recovery pattern; distinguish acute-recoverable from chronic-relentless load; do not linearly extrapolate from high-dose harm to low-dose harm (or vice versa). Build an interactive island (a dose-response explorer: a curve that morphs between linear, threshold, and hormetic/inverted-U shapes, with a DOSE slider and a readout of the response — sweep the dose to find the optimum, watch benefit turn to harm past the peak; a second control for FREQUENCY/RECOVERY showing how the same total dose builds when spaced with recovery but harms when chronic; overlay a "linear extrapolation" ghost line to show the classic error of assuming a straight line). Plus a Categorize (hormetic stressor-with-an-optimum vs monotonic pure-poison, or acute-recoverable vs chronic-relentless dosing) and MatchConcepts (hormesis, the dose makes the poison, adaptive overcompensation, inverted-U/J-curve, therapeutic window, allostatic load), Quiz + MindMap. en + es twin.',
  },
];

/** Quick lookup by slug. */
export const upcomingBySlug = new Map<string, UpcomingCourse>(
  upcomingCourses.map((c) => [c.slug, c]),
);
