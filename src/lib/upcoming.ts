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
 * `preference-falsification`, `winners-curse`,
 * `entropy-and-the-second-law`, …)
 * have graduated and been removed; their topic MDX is now the record. Lowest
 * `order` is built next. The remaining entries all sit in the **expert tier**,
 * deliberately kept tag-diverse so no single roadmap tag races ahead:
 * biology-evolution/science-engineering (`hormesis-and-the-dose-response`, 55),
 * decision-making/probability (`optimal-stopping-and-the-secretary-problem`, 56),
 * economics/strategy (`adverse-selection-and-the-lemons-problem`, 57) and
 * probability/decision-making/economics (`the-kelly-criterion`, 58).
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
  // The entropy-and-the-second-law rung (order 54) has graduated and been
  // removed; its topic MDX under src/content/topics/ (en + es) is now the record.
  // The lowest-order entry below (`hormesis-and-the-dose-response`, order 55) is
  // built next. The queue is kept tag-diverse across the expert tier --
  // biology-evolution/science-engineering (`hormesis-and-the-dose-response`),
  // decision-making/probability (`optimal-stopping-and-the-secretary-problem`),
  // economics/strategy (`adverse-selection-and-the-lemons-problem`) and
  // probability/decision-making/economics (`the-kelly-criterion`) -- so no single
  // roadmap tag races ahead.
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
  {
    slug: 'optimal-stopping-and-the-secretary-problem',
    icon: '⏱️',
    difficulty: 'expert',
    order: 56,
    accent: 'brand',
    title: {
      en: 'Optimal Stopping & the Secretary Problem',
      es: 'La Parada Óptima y el Problema de la Secretaria',
    },
    description: {
      en: 'When options arrive one at a time and you must accept or reject each on the spot — no going back — how long should you keep looking before you commit? The math says: look at about the first 37%, remember the best you saw, then grab the first one that beats it.',
      es: 'Cuando las opciones llegan de una en una y debes aceptar o rechazar cada una en el acto — sin vuelta atrás — ¿cuánto deberías seguir buscando antes de comprometerte? Las matemáticas dicen: observa alrededor del primer 37%, recuerda la mejor que viste y quédate con la primera que la supere.',
    },
    dependencies: ['thinking-in-probabilities', 'the-value-of-information', 'deciding-under-deep-uncertainty'],
    tags: ['decision-making', 'probability'],
    buildNotes:
      "Optimal stopping & the secretary problem — the expert decision-making/probability rung. Core claim: a whole class of decisions has the shape 'options appear in sequence, each must be accepted or rejected irreversibly and on the spot, and you cannot recall a passed option' — and for these there is a mathematically optimal LOOK-THEN-LEAP rule, not just a vibe. The classic result: to maximise the chance of picking the single best of N sequentially-seen candidates, reject the first N/e (~37%), then accept the first one better than everyone in that sample; this wins the best about 1/e ~ 37% of the time. Assumes thinking-in-probabilities (reasoning about the chance the best-so-far is the true best), expected-value (when the payoff is the VALUE of your pick, not just win-or-lose, the threshold rule changes) and deciding-under-deep-uncertainty (you must act without seeing the whole option set). Organising idea: the core tension is the explore/exploit trade-off under irreversibility — gather information (keep looking) vs commit before the good ones are gone, and the optimal policy is a THRESHOLD set by how much looking remains. Sections, each mechanism + worked example: (1) the exact secretary problem — the 37% rule, why e shows up, worked with small N by hand; (2) explore-then-commit as the general shape — the sampling phase sets a bar, the commit phase takes the first over-bar option; (3) when you want the BEST EXPECTED value not just the single best (the threshold DROPS as options run out — be pickier early, less picky late; tie to expected-value); (4) variations that matter in real life — being able to recall past options (the rule relaxes), a known value distribution (use a reservation value / secretary-with-cardinal-payoffs), a cost to keep searching, uncertain N, the ability to make offers that can be rejected; (5) transfer — hiring ('don't hire from the first third, but calibrate your bar on them'), apartment/house hunting, dating and the '37% then commit' pop version (with the honest caveats), selling a house/handling offers, parking-space search, when to stop researching and DECIDE. Pitfalls & where the model lies: the pure 37% rule optimises the WRONG thing for most people (probability of the single best, with zero credit for second-best) — real life usually wants expected value, where the optimal look fraction is smaller and near-misses are fine; it assumes strict irreversibility and no recall, which is often false (you CAN sometimes go back), softening the rule; it assumes you can rank options but not know the distribution — if you DO know the distribution, use a reservation value instead; and don't fetishise the exact number (37% is a clean idealisation, not a life mandate). Fixes/uses: identify whether a decision truly has the no-recall irreversible-sequential shape; if so, deliberately split into a calibration phase and a commit phase; set a bar from early options and TAKE the first that clears it; lower your bar as the runway shortens; and when you know the value distribution, switch to a reservation-value threshold. Build an interactive island (an optimal-stopping simulator: a stream of candidates with hidden scores revealed one at a time, a slider for the 'look' fraction and a toggle between 'pick the single best' and 'maximise expected value'; the learner sets the sampling cutoff and runs many sequences to see the success rate peak near 37% for the best-only objective, and the optimal cutoff shift for the expected-value objective; show the current threshold falling as options run out). Plus a Categorize (genuinely irreversible-no-recall sequential decisions vs ones where you can wait/compare/go back) and MatchConcepts (optimal stopping, the 37% rule, explore/exploit, reservation value, look-then-leap, irreversibility), Quiz + MindMap. en + es twin.",
  },
  {
    slug: 'adverse-selection-and-the-lemons-problem',
    icon: '🍋',
    difficulty: 'expert',
    order: 57,
    accent: 'accent',
    title: {
      en: 'Adverse Selection & the Lemons Problem',
      es: 'La Selección Adversa y el Problema de los Cacharros',
    },
    description: {
      en: "When one side of a deal knows more than the other, the market can rot from the inside: sellers of bad used cars know they're bad, buyers can't tell, so buyers only offer an average price, which drives the good cars out — until only the lemons are left. Hidden information, not hidden intentions, unravels the market.",
      es: 'Cuando una parte de un trato sabe más que la otra, el mercado puede pudrirse por dentro: quien vende un coche malo sabe que lo es, el comprador no puede distinguirlo, así que solo ofrece un precio medio, lo que expulsa a los coches buenos — hasta que solo quedan los cacharros. Es la información oculta, no las malas intenciones, lo que desmorona el mercado.',
    },
    dependencies: ['incentives', 'signaling-and-costly-signals', 'principal-agent-problem'],
    tags: ['economics', 'strategy'],
    buildNotes:
      "Adverse selection & the lemons problem — the expert economics/strategy rung from Akerlof's 1970 'The Market for Lemons' (a Nobel-cited foundation of information economics). Core claim: when quality is HIDDEN and one side knows it (asymmetric information about a fixed type, BEFORE contracting), the informed bad types are disproportionately the ones who want to trade, so the pool that shows up is adversely selected — average quality falls, the price the uninformed side will pay falls with it, the good types withdraw, and the market can collapse to only the worst (a self-reinforcing unravelling). Distinguish clearly from MORAL HAZARD (hidden ACTIONS after contracting — the principal-agent rung) and connect to SIGNALLING (how the informed side can credibly reveal quality) and SCREENING (how the uninformed side can extract it). Assumes incentives (who wants to trade and why), signaling-and-costly-signals (costly, hard-to-fake signals restore trade) and principal-agent-problem (the sibling asymmetric-information failure of hidden action). Organising idea: hidden information about TYPE selects the pool of who trades, so the mere act of someone wanting to sell/insure/borrow at a given price is itself bad news about their quality — conditioning on 'they want the deal' shifts the odds (a cousin of the winner's curse's 'conditioning on winning'). Sections, each mechanism + worked example: (1) the used-car worked model — good cars worth X, lemons worth Y, buyers offer the average, good sellers exit, average drops, repeat → unravelling to lemons; (2) the general shape — the willing counterparty is adversely selected (a 'who volunteers?' filter); (3) the arenas — health/car insurance (the sickest most want cover → premiums rise → the healthy drop out → the death spiral), credit and lending (only the desperate borrow at high rates), labour markets (the workers keenest to leave/join at a wage), online marketplaces and dating, IPOs and securities (why disclosure exists); (4) the CURES — signalling (warranties, brands, credentials, certifications, education-as-signal, costly guarantees), screening (deductibles and menus, tiered contracts, tests), third-party institutions (inspections, ratings, CARFAX, reputation systems, regulation and mandatory disclosure, insurance mandates that force the good types back in); (5) transfer as a thinking tool — 'why would this be available to ME at this price?', hiring, fundraising, buying anything where the seller knows more. Pitfalls & where the model lies: adverse selection is about hidden TYPE not hidden ACTION (don't conflate with moral hazard); it needs the informed side to have real private info AND the uninformed side to be unable to cheaply verify — where inspection/verification is cheap, or reputation is strong, or signals are credible, the market does NOT unravel (most markets work fine); it is not a claim that all sellers are crooks (no bad intent required — honest good-type sellers are driven out by the pooling, not by fraud); and don't over-apply the death-spiral to markets with effective screening/signalling. Fixes/uses: when you're the uninformed side, ask what the willingness of the other party reveals, and demand a credible signal or screen; when you're the informed good type, invest in a costly hard-to-fake signal; as a designer, build verification, reputation, warranties, or mandates. Build an interactive island (a lemons-market simulator: a population of cars/policies of hidden quality, a price the buyer offers, and rounds showing good types exit as the average falls — watch the market unravel toward lemons; toggles to ADD a warranty/certification signal or a mandate and watch the good types stay and the market survive; a slider for how much private information the seller has). Plus a Categorize (adverse-selection hidden-type problems vs moral-hazard hidden-action problems, or markets that unravel vs markets saved by signalling/screening) and MatchConcepts (adverse selection, asymmetric information, the lemons problem, signalling, screening, the insurance death spiral, moral hazard as the contrast), Quiz + MindMap. en + es twin.",
  },
  {
    slug: 'the-kelly-criterion',
    icon: '🎲',
    difficulty: 'expert',
    order: 58,
    accent: 'brand',
    title: {
      en: 'The Kelly Criterion',
      es: 'El Criterio de Kelly',
    },
    description: {
      en: "Given a genuine edge, how much of your bankroll should you stake? Bet too little and you leave growth on the table; bet too much and you go broke even while winning on average. The Kelly criterion names the one bet size that maximises long-run growth — and shows why survival, not expected value, is the real game.",
      es: 'Dada una ventaja real, ¿qué fracción de tu capital deberías apostar? Apuesta muy poco y dejas crecimiento sobre la mesa; apuesta demasiado y te arruinas aun ganando de media. El criterio de Kelly (Kelly criterion) nombra el único tamaño de apuesta que maximiza el crecimiento a largo plazo — y muestra por qué el juego real es la supervivencia, no el valor esperado.',
    },
    dependencies: ['ergodicity-and-the-time-average', 'thinking-in-probabilities', 'compounding'],
    tags: ['probability', 'decision-making', 'economics'],
    buildNotes:
      "The Kelly criterion — the expert probability/decision-making/economics rung (Kelly 1956; championed by Ed Thorp, Shannon). Core claim: when you repeatedly stake a fraction of a growing bankroll on favourable bets, the bet size that maximises the LONG-RUN GEOMETRIC growth rate is f* = edge/odds (for even-ish bets, f* = p - q/b, where p is win prob, q=1-p, b the payoff odds; equivalently bet your edge divided by the odds). Assumes ergodicity-and-the-time-average (the crux — for MULTIPLICATIVE wealth the time-average growth of a single trajectory is NOT the ensemble expected value, so maximising E[wealth] can guarantee ruin while maximising E[log wealth] maximises what you actually experience), thinking-in-probabilities (you need real, calibrated edge and odds) and compounding (growth is multiplicative, so a wipeout is unrecoverable and drawdowns compound). Organising idea: because wealth compounds MULTIPLICATIVELY, the right objective is the growth rate of the log of wealth, not the expected wealth — and that single change of objective produces a unique optimal fraction, punishes over-betting brutally (bet double-Kelly and your long-run growth falls to ZERO; bet more and you go broke with probability 1 even with a positive edge), and explains why survival dominates. Sections, each mechanism + worked example: (1) the coin-flip that ruins the naive — a +EV bet on which betting everything eventually wipes you out (the ergodicity punchline: ensemble average up, time average down); (2) maximising E[log wealth] and deriving f* for a simple bet, worked numerically; (3) the growth-vs-fraction curve — a hump peaking at f*, zero growth at 2·f*, negative beyond; under-betting is safe-but-slow, over-betting is fast-then-fatal, and the asymmetry means erring LOW is far cheaper than erring high; (4) fractional Kelly (half-Kelly) as the practical default — most of the growth for far less volatility, robust to estimation error in your edge (which is always overstated); (5) transfer — position sizing in investing and trading, bankroll management, R&D and bet portfolios, career and business risk-taking, why 'never risk ruin' and margin-of-safety fall out of the same logic. Pitfalls & where the model lies: Kelly assumes you KNOW the true probabilities and odds — overestimate your edge (everyone does) and Kelly over-bets you toward ruin, which is why practitioners use FRACTIONAL Kelly; it optimises long-run growth and is indifferent to short-run volatility, which real humans and institutions are NOT (utility and drawdown tolerance matter), so full Kelly is usually too aggressive; it assumes repeated, independent, indefinitely-many bets and a divisible bankroll (one-shot or correlated bets break it); and it is NOT a licence to bet big — its deepest lesson is how easily a positive-edge player still goes broke. Fixes/uses: size bets as a fraction of current bankroll, scale to your estimated edge, cut the fraction (half-Kelly or less) to buy robustness against overconfidence, and treat avoiding ruin as the first objective because compounding cannot recover from zero. Build an interactive island (a Kelly bankroll simulator: set win probability, payoff odds and a bet-fraction slider; run many multiplicative rounds and plot the growth of wealth on a log axis for the chosen fraction vs f* vs over-betting — watch under-Kelly crawl, Kelly grow fastest, and over-Kelly spike then crash to ruin; a readout of the long-run growth-rate hump with its peak at f* and zero-crossing at 2f*; a 'median vs mean wealth' toggle to expose the ergodicity gap). Plus a Categorize (situations where Kelly-style fractional sizing applies — repeated multiplicative divisible bets with real edge — vs where it doesn't — one-shot, unknown edge, ruin-is-catastrophic) and MatchConcepts (Kelly criterion, geometric vs arithmetic growth, E[log wealth], fractional Kelly, risk of ruin, over-betting, ergodicity), Quiz + MindMap. en + es twin.",
  },
];

/** Quick lookup by slug. */
export const upcomingBySlug = new Map<string, UpcomingCourse>(
  upcomingCourses.map((c) => [c.slug, c]),
);
