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
 * beginner→intermediate breadth pass and the first advanced rungs
 * (`what-are-mental-models`, `natural-selection`, `supply-and-demand`,
 * `tragedy-of-the-commons`, `externalities`, …) have graduated and been removed.
 * Lowest `order` is built next. The remaining entries are the **advanced tier**,
 * deliberately kept tag-diverse so no single roadmap tag races ahead: strategy
 * (`moats`), biology-evolution (`ecosystems-and-niches`), systems-thinking
 * (`leverage-points`), and psychology (`lollapalooza-effect`).
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
  // ── Advanced systems / economics / strategy / biology / psychology tier ────
  // `externalities` (the advanced economics rung, order 20) has graduated and
  // been removed; its topic MDX is now the record. The lowest-order entry below
  // (`moats`, order 21) is built next.
  // ── Breadth re-seed (orders 21–24) ────────────────────────────────────────
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
  // Appended as `externalities` (order 20) graduates, to keep the queue ≥3 and
  // tag-diverse: a systems-thinking rung and a psychology rung — the two tags
  // the remaining advanced tier (strategy, economics, biology-evolution) was
  // missing.
  {
    slug: 'leverage-points',
    icon: '🎯',
    difficulty: 'advanced',
    order: 23,
    accent: 'accent',
    title: {
      en: 'Leverage Points',
      es: 'Puntos de Apalancamiento',
    },
    description: {
      en: 'In any system, some places to push are almost useless and a few are astonishingly powerful — and our intuition usually reaches for the weak ones. Donella Meadows’ ladder of where to intervene, from tweaking numbers to changing the goal of the whole system.',
      es: 'En cualquier sistema, algunos lugares donde empujar son casi inútiles y unos pocos son asombrosamente potentes — y nuestra intuición suele agarrar los débiles. La escalera de Donella Meadows sobre dónde intervenir, desde ajustar números hasta cambiar el objetivo de todo el sistema.',
    },
    dependencies: ['feedback-loops', 'stocks-and-flows'],
    tags: ['systems-thinking'],
    buildNotes:
      'Leverage points — the advanced systems-thinking rung built on feedback loops and stocks & flows: where to push a complex system to change its behaviour, and why the obvious places are usually the weak ones. Frame around Donella Meadows’ famous ordered list (places to intervene, in increasing order of power), but teach the *idea* not a memorised rank: low-leverage points (constants, parameters, numbers — tweaking a tax rate or a thermostat setpoint) vs. high-leverage points (the strength and structure of feedback loops, the rules of the system, the information flows, the goal of the system, and the paradigm/mindset out of which the system arises). Sections: the counterintuition — Meadows’ insight that people reliably push hardest on low-leverage parameters (numbers) while the powerful levers (loop structure, rules, goals, paradigms) sit ignored; a worked walk *up* the ladder on one concrete system (e.g. a city’s traffic, an overdrawn aquifer, or a company’s culture) showing how the same problem yields to a higher lever; negative vs positive feedback as levers (strengthening a balancing loop vs weakening a runaway reinforcing loop — tie back to the feedback-loops course); rules, information flows, and "the goal of the system" as progressively deeper levers (add a missing feedback of information — e.g. making people see their own energy use — as a classic mid-ladder win); paradigms as the highest leverage and the hardest to shift. Pitfalls: pushing a lever in the wrong direction (Meadows’ warning that high leverage points are "not intuitive, and when found, often pushed the wrong way"); mistaking activity at a low leverage point for progress. Build an interactive leverage-ladder island: a system with a few intervention sliders/levers at different ladder heights; the learner applies effort at a chosen level and sees how much the system’s output actually moves, making "same effort, wildly different result" visible. Ties to feedback-loops, stocks-and-flows, bottlenecks, second-order thinking. Recap Quiz + MindMap. en + es twin.',
  },
  {
    slug: 'lollapalooza-effect',
    icon: '🎰',
    difficulty: 'advanced',
    order: 24,
    accent: 'brand',
    title: {
      en: 'The Lollapalooza Effect',
      es: 'El Efecto Lollapalooza',
    },
    description: {
      en: 'Biases rarely strike one at a time. When several psychological tendencies point the same way at once, they don’t add — they multiply, tipping ordinary people into bubbles, cults, and manias. Munger’s name for the moment many models combine into one overwhelming force.',
      es: 'Los sesgos rara vez actúan de uno en uno. Cuando varias tendencias psicológicas apuntan a la vez en la misma dirección, no se suman: se multiplican, empujando a gente normal hacia burbujas, sectas y manías. El nombre que dio Munger al momento en que muchos modelos se combinan en una sola fuerza arrolladora.',
    },
    dependencies: ['confirmation-bias', 'incentives', 'loss-aversion'],
    tags: ['psychology'],
    buildNotes:
      'The Lollapalooza effect — the advanced psychology rung where the major cognitive biases stop acting in isolation and *combine*: Charlie Munger’s term for when several psychological tendencies all push in the same direction at once and produce an extreme, nonlinear outcome (the effects compound and reinforce rather than merely add). Assumes the intermediate bias courses (confirmation bias, availability, loss aversion, incentives, social proof). Sections: the core idea — most real-world disasters and manias aren’t one bias but a *confluence* (Munger: "you get lollapalooza effects when two, three or four forces are all operating in the same direction"); why combination is multiplicative not additive (each bias lowers resistance to the next; reinforcing feedback — tie to feedback-loops); worked case studies pulled apart bias-by-bias — e.g. an open-outcry auction or bidding war (social proof + commitment/consistency + deprivation-superreaction/loss aversion + reciprocation), a market bubble (social proof + incentive-caused bias + envy + over-optimism + confirmation), a cult or high-pressure sales close (authority + social proof + commitment + reciprocation + scarcity); the defensive use — building a mental "checklist" of biases to run against a decision precisely because no single one announces itself; the connection to the latticework thesis of the whole site (models combine — this is that idea turned on the psychology tag). Pitfalls: hindsight over-fitting (don’t just label everything "lollapalooza" after the fact — name the *specific* tendencies and show they pointed the same way); assuming biases always compound (sometimes they offset). Build an interactive island: a scenario (auction or bubble) with toggles for each contributing bias; as the learner switches biases on, a "pressure"/likelihood meter climbs nonlinearly, and turning several on at once spikes it — making the multiplicative stacking visible vs. the sum of the parts. Recap Quiz + MindMap. en + es twin.',
  },
];

/** Quick lookup by slug. */
export const upcomingBySlug = new Map<string, UpcomingCourse>(
  upcomingCourses.map((c) => [c.slug, c]),
);
