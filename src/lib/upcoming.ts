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
 * The zero-to-expert ladder of models still to build (see TOPIC.md). The
 * earliest courses (`what-are-mental-models`, `natural-selection`, …) have
 * graduated and been removed. Lowest `order` is built next. Orders 5–13 are the
 * remaining beginner→intermediate breadth pass that seeds every starved
 * discipline (compounding, the razors, circle of competence, comparative
 * advantage, …) BEFORE the four advanced/expert probability/systems courses
 * (orders 14–17). This deliberately front-loads foundational breadth so the
 * build stops over-indexing on the decision-making / probability tags.
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
  // ── Advanced / expert probability tier ────────────────────────────────────
  // The lowest-order entry, built next. The breadth-pass courses that re-seeded
  // the starved disciplines (e.g. `red-queen-effect`, `fat-tails`) have graduated
  // and been removed; their topic MDX is now the record.
  {
    slug: 'calibration-and-confidence',
    icon: '🎯',
    difficulty: 'expert',
    order: 17,
    accent: 'brand',
    title: {
      en: 'Calibration: Knowing What You Know',
      es: 'Calibración: saber lo que sabes',
    },
    description: {
      en: 'A calibrated thinker’s 70% guesses come true about 70% of the time. Measure your overconfidence, widen your honest error bars, and turn vague hunches into probabilities you can be scored on.',
      es: 'Las apuestas al 70% de quien está bien calibrado aciertan el 70% de las veces. Mide tu exceso de confianza, ensancha tus márgenes de error honestos y convierte corazonadas vagas en probabilidades que se pueden puntuar.',
    },
    dependencies: ['thinking-in-probabilities', 'bayesian-updating'],
    tags: ['probability', 'decision-making', 'psychology'],
    buildNotes:
      'Calibration — the expert capstone of the probability path: not just estimating odds but being *right about how right you are*. Sections: what calibration means (of all the times you say 70%, ~70% should happen) and the calibration curve; overconfidence and the overprecision bias (90% confidence intervals that catch the truth far less than 90% of the time); proper scoring rules — the Brier score and log score — that reward honesty and punish bluffing, with a worked numeric example; confidence intervals / error bars as honest ranges (ties back to thinking in ranges); how to get calibrated (track predictions, give ranges, do calibration training, post-mortem your scores), referencing forecasting research (superforecasters) without overclaiming; resolution vs. calibration (being calibrated AND decisive). Use KaTeX for the Brier score; build an interactive calibration island (the learner assigns confidences to several true/false claims, then sees their calibration plotted and Brier score scored). Connect to Bayesian updating (calibrated priors), overconfidence bias (psychology), and margin of safety. Pitfall: confident ≠ correct; precision masquerading as accuracy. Recap Quiz + MindMap. en + es twin.',
  },
  // ── Breadth re-seed (orders 18–20) ────────────────────────────────────────
  // Appended to keep the queue ≥3 and tag-diverse after `red-queen-effect`
  // graduated and the remaining tier was all-`probability`. One advanced rung
  // each into the starved psychology, systems-thinking, and economics tags.
  {
    slug: 'loss-aversion',
    icon: '⚖️',
    difficulty: 'advanced',
    order: 18,
    accent: 'brand',
    title: {
      en: 'Loss Aversion & Prospect Theory',
      es: 'Aversión a la Pérdida y Teoría Prospectiva',
    },
    description: {
      en: 'Losses hurt about twice as much as equivalent gains feel good — so the same choice flips depending on whether it’s framed as winning or losing. The asymmetry that bends nearly every decision you make.',
      es: 'Las pérdidas duelen aproximadamente el doble de lo que agrada una ganancia equivalente — así que la misma elección se invierte según se plantee como ganar o perder. La asimetría que tuerce casi todas tus decisiones.',
    },
    dependencies: ['thinking-in-probabilities', 'incentives'],
    tags: ['psychology', 'decision-making'],
    buildNotes:
      'Loss aversion & prospect theory — the advanced psychology rung on how real humans weigh risk, departing from the expected-value ideal. Sections: loss aversion (a loss looms ~2× a same-size gain — the ~2.25 coefficient) with the coin-flip-you-refuse example; the reference point — outcomes are judged as gains/losses from a baseline, not absolute wealth (Kahneman & Tversky); the value function (concave for gains, convex for losses, steeper on the loss side — diminishing sensitivity → risk-averse for gains, risk-seeking for losses to avoid a sure loss); framing effects (the Asian-disease problem: identical odds flip choices when worded as lives saved vs lives lost); the endowment effect & status-quo bias as loss aversion in disguise (the mug experiment); probability weighting in one line (we overweight tiny probabilities → lotteries and insurance coexist); practical debiasing (widen the frame, aggregate decisions, ask "what’s my reference point?"). Build an interactive framing/value-function island (a slider showing the kinked value curve, and a toggle that re-frames one scenario as gain vs loss and shows the preference flip). Connect to expected value, incentives, and margin of safety. Pitfall: treating framing as cosmetic; ignoring that the reference point is a choice. Recap Quiz + MindMap. en + es twin.',
  },
  {
    slug: 'stocks-and-flows',
    icon: '🛁',
    difficulty: 'advanced',
    order: 19,
    accent: 'accent',
    title: {
      en: 'Stocks & Flows',
      es: 'Stocks y Flujos',
    },
    description: {
      en: 'A bathtub fills when the tap outruns the drain — and most reasoning errors about debt, climate, hiring, and inventory come from confusing the level in the tub with the rate of the tap.',
      es: 'Una bañera se llena cuando el grifo supera al desagüe — y casi todos los errores de razonamiento sobre deuda, clima, contratación e inventario nacen de confundir el nivel de la bañera con el caudal del grifo.',
    },
    dependencies: ['feedback-loops'],
    tags: ['systems-thinking'],
    buildNotes:
      'Stocks & flows — the advanced systems rung underneath feedback loops: the grammar of accumulation. Sections: the bathtub model — a stock is a quantity that accumulates (water, money, CO₂, population, trust), a flow is the rate that fills or drains it (inflow/outflow); the core insight — a stock keeps rising as long as inflow > outflow, even if the inflow is falling (the "the deficit is shrinking so the debt is shrinking" fallacy; emissions slowing ≠ CO₂ falling); stocks change only through flows and they integrate (smooth, delay, give systems memory and inertia); bathtub dynamics & lags (why systems overshoot and respond slowly — ties to feedback loops and bottlenecks); worked examples with numbers (a reservoir, a bank balance, a hiring pipeline, a warehouse); the stock-flow distinction as a debugging tool for policy and personal finance. Build an interactive bathtub/stock-flow island (independent inflow & outflow sliders → watch the stock integrate, overshoot, and lag; show that inflow=outflow holds the stock steady at any level). Connect to feedback loops, compounding, and bottlenecks. Pitfall: confusing the level with the rate; assuming a falling inflow means a falling stock. Recap Quiz + MindMap. en + es twin.',
  },
  {
    slug: 'externalities',
    icon: '🏭',
    difficulty: 'advanced',
    order: 20,
    accent: 'brand',
    title: {
      en: 'Externalities',
      es: 'Externalidades',
    },
    description: {
      en: 'When the person who decides isn’t the person who pays, the price lies — and the market quietly over-produces pollution and under-produces vaccines. The gap between private and social cost.',
      es: 'Cuando quien decide no es quien paga, el precio miente — y el mercado produce de más la contaminación y de menos las vacunas. La brecha entre el coste privado y el coste social.',
    },
    dependencies: ['supply-and-demand', 'tragedy-of-the-commons'],
    tags: ['economics'],
    buildNotes:
      'Externalities — the advanced economics rung extending supply & demand and the tragedy of the commons: costs and benefits that spill onto third parties who never agreed to them. Sections: definition — a cost (negative) or benefit (positive) imposed on someone outside a transaction, so private cost ≠ social cost; negative externalities (pollution, noise, congestion, antibiotic resistance) → the market over-produces them because the decider doesn’t bear the full cost; positive externalities (vaccines, education, R&D, a restored façade) → the market under-produces them because the decider doesn’t capture the full benefit; the marginal private vs. social cost/benefit picture (the wedge and the deadweight loss) with a worked numeric example; remedies — Pigouvian taxes & subsidies (price the spillover), cap-and-trade, regulation, and the Coase theorem (clear property rights + low bargaining cost can internalize it privately) and its limits; relation to the commons (a shared sink is a negative externality at scale) and to incentives. Build an interactive supply–demand-with-externality island (a slider for the external cost/benefit that shifts the social curve away from the private one, shading the over/under-production gap and the welfare loss, with a tax/subsidy toggle that re-aligns them). Pitfall: assuming the market price reflects true cost; ignoring positive externalities; treating a tax as a penalty rather than a price correction. Recap Quiz + MindMap. en + es twin.',
  },
];

/** Quick lookup by slug. */
export const upcomingBySlug = new Map<string, UpcomingCourse>(
  upcomingCourses.map((c) => [c.slug, c]),
);
