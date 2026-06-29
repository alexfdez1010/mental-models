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
  // ── Advanced psychology / systems / economics / strategy / biology tier ────
  // `loss-aversion` (the advanced psychology rung, order 18) has graduated and
  // been removed; its topic MDX is now the record. The lowest-order entry below
  // (`stocks-and-flows`, order 19) is built next.
  // ── Breadth re-seed (orders 19–22) ────────────────────────────────────────
  // Kept ≥3 and tag-diverse as courses graduate: systems-thinking, economics,
  // strategy, and biology-evolution each carry one advanced rung here.
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
  // ── Breadth re-seed (orders 21–22) ────────────────────────────────────────
  // Appended as `loss-aversion` (order 18) graduates, to keep the queue ≥3 and
  // tag-diverse: a strategy rung and a biology-evolution rung, the two tags the
  // remaining advanced tier (systems-thinking, economics) was missing.
  {
    slug: 'moats',
    icon: '🏰',
    difficulty: 'advanced',
    order: 21,
    accent: 'brand',
    title: {
      en: 'Moats & Durable Advantage',
      es: 'Fosos (Moats) y Ventaja Duradera',
    },
    description: {
      en: 'Any business earning fat profits invites attackers — a moat is whatever keeps them from crossing. Network effects, switching costs, scale, and brand: why a few advantages compound for decades while most evaporate in a quarter.',
      es: 'Todo negocio que gana beneficios jugosos atrae atacantes — un foso es aquello que les impide cruzar. Efectos de red, costes de cambio, escala y marca: por qué unas pocas ventajas se acumulan durante décadas mientras la mayoría se evaporan en un trimestre.',
    },
    dependencies: ['game-theory-basics', 'comparative-advantage'],
    tags: ['strategy', 'economics'],
    buildNotes:
      'Moats & durable advantage — the advanced strategy rung: why excess profit attracts competition and what makes an advantage *last*. Sections: the core idea — in a free market, high returns invite imitation that competes them away, so a durable advantage is whatever raises a wall against that imitation (Buffett’s "economic moat"); the main moat types, each with a worked example and how it can be breached — (1) network effects (the product gets better as more people use it; tie back to the systems/feedback course), (2) switching costs (it’s painful or risky to leave — data, habits, contracts), (3) economies of scale / cost advantage (a bigger player’s unit costs are structurally lower), (4) intangible assets (brand, patents, regulatory licenses), (5) efficient-scale niches (a market only big enough for one or two players); the difference between a real moat and a mirage (a hot product, first-mover hype, or a great team is not a moat); moat *erosion* and the Red Queen connection (you must keep running to maintain it; technology shifts fill moats in); measuring a moat by pricing power and return-on-capital persistence. Build an interactive moat-erosion / network-effects island (e.g. a slider for the strength of a network effect or switching cost vs. competitive pressure over time, showing margins either compounding or decaying to commodity levels). Pitfall: confusing a temporarily great product with a structural moat; assuming any moat is permanent. Connect to comparative advantage, game theory, incentives, and the Red Queen effect. Recap Quiz + MindMap. en + es twin.',
  },
  {
    slug: 'ecosystems-and-niches',
    icon: '🌳',
    difficulty: 'advanced',
    order: 22,
    accent: 'accent',
    title: {
      en: 'Ecosystems & Niches',
      es: 'Ecosistemas y Nichos',
    },
    description: {
      en: "No species wins everywhere — each survives by fitting a niche the others can't exploit. The model behind competitive exclusion, specialization, and why crowded markets push every player to differentiate or die.",
      es: 'Ninguna especie gana en todas partes — cada una sobrevive ocupando un nicho que las demás no pueden explotar. El modelo tras la exclusión competitiva, la especialización y por qué los mercados saturados empujan a cada jugador a diferenciarse o morir.',
    },
    dependencies: ['natural-selection', 'red-queen-effect'],
    tags: ['biology-evolution', 'strategy'],
    buildNotes:
      'Ecosystems & niches — the advanced biology-evolution rung built on natural selection: how many species coexist by dividing up the environment rather than all fighting for the same resource. Sections: the niche — the specific role/resource-space a species occupies (what it eats, where, when), not just its habitat; the competitive exclusion principle (Gause) — two species competing for the exact same limiting resource can’t coexist; one wins, so survivors differentiate; resource partitioning & specialization with worked examples (Darwin’s finches and beak size, warblers feeding in different parts of the same tree); generalist vs specialist trade-offs (broad-but-shallow vs narrow-but-efficient, and when each wins); keystone species, food webs, and how removing one node cascades (tie to systems-thinking/feedback and second-order effects); the powerful business/strategy transfer — markets are ecosystems, "find an unoccupied niche", differentiation as avoiding head-to-head competitive exclusion (tie to moats and comparative advantage); invasive species & disturbance as the failure modes. Build an interactive niche / competitive-exclusion island (e.g. two or more species on overlapping resource axes; a slider for niche overlap that shows coexistence when overlap is low and one competitor driven extinct when overlap is high). Pitfall: assuming "most competitive wins everything" (it wins its niche, not all niches); confusing habitat with niche. Recap Quiz + MindMap. en + es twin.',
  },
];

/** Quick lookup by slug. */
export const upcomingBySlug = new Map<string, UpcomingCourse>(
  upcomingCourses.map((c) => [c.slug, c]),
);
