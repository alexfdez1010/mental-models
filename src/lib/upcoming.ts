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
 * `entropy-and-the-second-law`, `hormesis-and-the-dose-response`, …)
 * have graduated and been removed; their topic MDX is now the record
 * (`optimal-stopping-and-the-secretary-problem`, order 56, graduated most
 * recently). Lowest `order` is built next. The remaining entries all sit in the
 * **expert tier**, deliberately kept tag-diverse so no single roadmap tag races
 * ahead: economics/strategy (`adverse-selection-and-the-lemons-problem`, 57),
 * probability/decision-making/economics (`the-kelly-criterion`, 58) and
 * psychology/decision-making (`bounded-rationality-and-satisficing`, 59).
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
  // The optimal-stopping-and-the-secretary-problem rung (order 56) has graduated
  // and been removed; its topic MDX under src/content/topics/ (en + es) is now the
  // record. The lowest-order entry below (`adverse-selection-and-the-lemons-problem`,
  // order 57) is built next. The queue is kept tag-diverse across the expert tier
  // -- economics/strategy (`adverse-selection-and-the-lemons-problem`),
  // probability/decision-making/economics (`the-kelly-criterion`) and
  // psychology/decision-making (`bounded-rationality-and-satisficing`) -- so no
  // single roadmap tag races ahead.
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
  {
    slug: 'bounded-rationality-and-satisficing',
    icon: '🧩',
    difficulty: 'expert',
    order: 59,
    accent: 'accent',
    title: {
      en: 'Bounded Rationality & Satisficing',
      es: 'La Racionalidad Limitada y el Satisficing',
    },
    description: {
      en: "Real minds don't optimise — they can't. With limited time, information and computing power, we don't find the best option; we search until something is GOOD ENOUGH, then stop. Herbert Simon's bounded rationality reframes 'irrational' behaviour as a smart adaptation to a hard world.",
      es: 'Las mentes reales no optimizan — no pueden. Con tiempo, información y capacidad de cálculo limitados, no encontramos la mejor opción; buscamos hasta que algo es SUFICIENTEMENTE BUENO y paramos. La racionalidad limitada (bounded rationality) de Herbert Simon reformula el comportamiento «irracional» como una adaptación inteligente a un mundo difícil.',
    },
    dependencies: ['optimal-stopping-and-the-secretary-problem', 'the-value-of-information', 'circle-of-competence'],
    tags: ['psychology', 'decision-making'],
    buildNotes:
      "Bounded rationality & satisficing — the expert psychology/decision-making rung (Herbert Simon, Nobel 1978; extended by Gigerenzer's ecological rationality). Core claim: the classical 'rational optimiser' who weighs every option and maximises expected utility is a fiction — real agents have BOUNDED time, information, attention and computing power, so they cannot optimise even in principle. Instead they SATISFICE (satisfy + suffice): set an aspiration level, search until an option clears it, then STOP and take it — accepting 'good enough' rather than hunting for the unknowable best. Reframes much apparent irrationality as an intelligent adaptation to a hard world (the mind as 'scissors' whose two blades are the cognitive limits AND the structure of the environment). Assumes optimal-stopping (satisficing IS a reservation-value stopping rule — the aspiration level is the bar, and 'stop at the first good-enough option' is explore-then-commit with a fixed threshold), the-value-of-information (search has a cost, so gathering more is only worth it while it pays — satisficing is where marginal info-value drops below its cost) and circle-of-competence (bounded knowledge is exactly why you can't optimise outside what you understand). Organising idea: optimising is often IMPOSSIBLE or not worth it, so 'good enough, fast and frugal' can beat 'optimal in theory' once you count the cost of deciding — and the smart move is to set the RIGHT aspiration level and know when to stop. Sections, each mechanism + worked example: (1) why optimisation fails — combinatorial explosion (chess, the travelling salesman, choosing a career), unknown/unlistable option sets, and the cost of computation itself; (2) satisficing defined — aspiration level, search-till-good-enough, and how it maps onto a reservation-value stopping rule (tie back hard to optimal stopping); (3) maximisers vs satisficers — the psychology (Schwartz's 'paradox of choice': maximisers get marginally better outcomes but are less happy, drown in regret and counterfactuals; satisficers decide faster and are more content); (4) fast-and-frugal heuristics & ecological rationality (Gigerenzer) — simple rules (take-the-best, recognition heuristic, 1/N) that exploit environment structure and often MATCH or beat complex optimisation out of sample, because they don't overfit; less-is-more effects; (5) transfer & setting aspiration levels — hiring, buying a house/laptop, choosing where to eat, product design, org decision-making; how to pick and adjust the aspiration level (raise it when options are plentiful and search is cheap, lower it as time/cost mounts — the descending threshold again). Pitfalls & where the model lies: satisficing is NOT laziness or an excuse for sloppy thinking — it is optimal SUBJECT TO real constraints, and the aspiration level still has to be well-chosen (set too low you settle for junk, too high you never stop); it does not say optimisation is always wrong — for small, well-defined, high-stakes, repeatable problems you SHOULD optimise; 'good enough' can entrench mediocrity and mask when a problem deserves the full search; and heuristics that are ecologically rational in one environment misfire badly when the environment shifts (a fast-and-frugal rule is only as good as its fit to the world). Fixes/uses: decide FIRST whether a decision is optimise-worthy or satisfice-worthy (stakes x repeatability x tractability); set an explicit aspiration level and commit to stopping when it's met; prefer robust simple heuristics under uncertainty; be a satisficer on reversible low-stakes choices and reserve deep optimisation for the few that merit it. Build an interactive island (a satisficing-vs-maximising search simulator: a field of options with hidden values arrives; a slider sets the ASPIRATION LEVEL and the learner watches search time, the quality of the accepted option, and a 'regret/decision-cost' meter; compare a satisficer who stops at the first over-aspiration option against a maximiser who searches on for the true best — showing the maximiser wins slightly on value but pays far more in search cost and regret, and that a well-set aspiration captures most of the value for a fraction of the effort; a knob for how costly each look is, so higher search costs make satisficing dominate). Plus a Categorize (decisions to SATISFICE — low-stakes, reversible, huge option set, costly search — vs decisions to OPTIMISE — high-stakes, repeatable, small well-defined set) and MatchConcepts (bounded rationality, satisficing, aspiration level, maximiser vs satisficer, fast-and-frugal heuristics, ecological rationality, the paradox of choice), Quiz + MindMap. en + es twin.",
  },
];

/** Quick lookup by slug. */
export const upcomingBySlug = new Map<string, UpcomingCourse>(
  upcomingCourses.map((c) => [c.slug, c]),
);
