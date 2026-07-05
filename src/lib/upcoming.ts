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
 * beginner→intermediate breadth pass and the earlier advanced rungs
 * (`what-are-mental-models`, `natural-selection`, `supply-and-demand`,
 * `tragedy-of-the-commons`, `externalities`, `moats`, `ecosystems-and-niches`,
 * `leverage-points`, `lollapalooza-effect`, `regression-to-the-mean`,
 * `critical-mass`, `nash-equilibrium`, `influence-and-persuasion`,
 * `evolution-of-cooperation`, …) have graduated and been removed. Lowest `order`
 * is built next. The remaining entries sit in the **expert tier**, deliberately
 * kept tag-diverse so no single roadmap tag races ahead: strategy
 * (`credible-commitment-and-deterrence`), systems-thinking/economics
 * (`path-dependence-and-lock-in`) and economics/psychology
 * (`principal-agent-problem`).
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
  // ── Advanced → expert tier — kept tag-diverse ──────────────────────────────
  // `externalities` (20), `moats` (21), `ecosystems-and-niches` (22),
  // `leverage-points` (23), `lollapalooza-effect` (24), `regression-to-the-mean`
  // (25), `critical-mass` (26), `nash-equilibrium` (27), `asymmetry-and-optionality`
  // (28), `fitness-landscapes` (29), `mechanism-design` (30),
  // `combining-models-latticework` (31), `deciding-under-deep-uncertainty` (32),
  // `influence-and-persuasion` (33) and `evolution-of-cooperation` (the advanced
  // biology-evolution/strategy rung, order 34) have graduated and been removed;
  // their topic MDX is now the record. The lowest-order entry below
  // (`credible-commitment-and-deterrence`, order 35) is built next. The remaining
  // queue finishes the expert tier and keeps the breadth tag-diverse, spanning
  // strategy (`credible-commitment-and-deterrence`), systems-thinking/economics
  // (`path-dependence-and-lock-in`) and economics/psychology
  // (`principal-agent-problem`) so no single roadmap tag races ahead of the others.
  {
    slug: 'credible-commitment-and-deterrence',
    icon: '🔒',
    difficulty: 'expert',
    order: 35,
    accent: 'brand',
    title: {
      en: 'Credible Commitment & Deterrence',
      es: 'Compromiso Creíble y Disuasión',
    },
    description: {
      en: 'The strategic paradox that less freedom can mean more power: by visibly burning your own options — a binding contract, a burned bridge, a doomsday device — you change what rivals expect and bend the game your way. The logic of credible threats, promises, and deterrence.',
      es: 'La paradoja estratégica de que menos libertad puede significar más poder: al quemar visiblemente tus propias opciones —un contrato vinculante, un puente quemado, un dispositivo apocalíptico— cambias lo que esperan los rivales y doblas el juego a tu favor. La lógica de las amenazas y promesas creíbles y la disuasión.',
    },
    dependencies: ['nash-equilibrium', 'mechanism-design'],
    tags: ['strategy'],
    buildNotes:
      'Credible commitment & deterrence — the expert strategy rung built on Schelling’s "strategy of conflict": a first-mover can change the equilibrium not by having more options but by visibly destroying their own. Assumes nash-equilibrium (equilibria, best responses, changing the game) and mechanism-design (commitment as a designed rule). Sections: the core paradox — tying your hands can strengthen your position, because it changes rivals’ best responses (the general who burns the bridges behind his army so retreat is impossible, and the enemy, knowing it, does not attack); credibility is everything — a threat or promise only works if the other side believes you will actually carry it out, so the skill is making commitments believable (contracts with penalties, public promises, delegating to an agent who *must* follow through, automaticity/"doomsday machines"); credible threats vs credible promises (deterrence stops an action, compellence/promise induces one); brinkmanship — deliberately raising shared risk to force a blink (Cuban missile crisis, labour strikes), and why the "threat that leaves something to chance" can be more credible than a precise one; deterrence and MAD (mutually assured destruction), second-strike capability, why vulnerability can be destabilising; commitment devices in ordinary life (Ulysses and the mast, Christmas savings clubs, staking your reputation). Tie to mechanism-design (a commitment is a self-imposed rule that moves the equilibrium) and incentives. Pitfalls: bluffs that aren’t credible get called; commitment traps (you can lock yourself into a disaster you can no longer exit — sunk-cost escalation, doomsday devices that fire by accident); the difficulty of un-committing when the world changes; and commitments that are read as bluffs because the cost of following through is obviously too high. Build an interactive island (a commitment game: the learner toggles whether they can pre-commit / remove their own fallback option and watches the equilibrium and their payoff shift, showing how throwing away a choice improves the outcome), plus a Categorize (credible vs empty commitments) and MatchConcepts, Quiz + MindMap. en + es twin.',
  },
  {
    slug: 'path-dependence-and-lock-in',
    icon: '🛤️',
    difficulty: 'expert',
    order: 36,
    accent: 'accent',
    title: {
      en: 'Path Dependence & Lock-In',
      es: 'Dependencia del Camino y Bloqueo',
    },
    description: {
      en: 'Why history refuses to be optimised away: small, half-random early choices get amplified by positive feedback until they harden into standards nobody can escape — the QWERTY keyboard, the QWERTY-bad technologies that won, the institutions we are stuck with. How increasing returns lock a system onto one path, why the "best" option often loses, and when a locked-in system can still be broken open.',
      es: 'Por qué la historia se niega a optimizarse: pequeñas decisiones tempranas medio azarosas se amplifican por realimentación positiva hasta endurecerse en estándares de los que nadie escapa — el teclado QWERTY, las tecnologías peores que ganaron, las instituciones que arrastramos. Cómo los rendimientos crecientes fijan un sistema en un camino, por qué la opción "mejor" suele perder, y cuándo un sistema bloqueado aún puede reventarse.',
    },
    dependencies: ['feedback-loops', 'critical-mass'],
    tags: ['systems-thinking', 'economics'],
    buildNotes:
      'Path dependence & lock-in — the expert systems/economics rung that explains why systems get trapped on a route set by their own history rather than settling on the best available option. Assumes feedback-loops (reinforcing loops) and critical-mass (tipping points). The organising idea is increasing returns / positive feedback (Brian Arthur, Paul David): once an option gets a small early lead, adoption makes it more attractive, which brings more adoption, which locks it in. Sections, each with mechanism + a fully worked example: what path dependence is (the outcome depends on the sequence of past states, not just present conditions — "history matters", small events have large permanent consequences); the QWERTY story and the honest debate around it (the canonical example of a possibly-suboptimal standard that stuck; present the standard narrative AND the David-vs-Liebowitz/Margolis critique so the learner sees the model’s limits); the four sources of increasing returns (large set-up/fixed costs, learning effects, coordination/network effects, adaptive expectations); lock-in and switching costs (why a whole system stays on a worse standard because no individual can afford to move first — tie to nash-equilibrium/coordination and tragedy-of-the-commons); the difference between "first-mover advantage", "the best wins", and "an early accident wins" (contingency vs efficiency); network effects and standards wars (VHS vs Betamax, keyboards, driving side, gauge widths, programming ecosystems, metric vs imperial); institutional and career path dependence (why organisations, laws and even your own résumé calcify); and how lock-in breaks (external shocks, a discontinuous better technology that overcomes switching costs, coordinated switching, sponsorship). Pitfalls & where the model lies: the just-so-story trap (declaring any winner "just a historical accident" without evidence it was actually inferior — the Liebowitz/Margolis point that markets often DO correct); confusing path dependence with mere causation ("the past influenced the present" is trivial; the claim is that a small early difference gets amplified into a large, persistent, hard-to-reverse one); and assuming lock-in is permanent. Build an interactive island (a "lock-in explorer": competing standards/technologies with an adjustable increasing-returns strength and a small random early lead; the learner watches market share tip and lock onto one option, sees that raising the feedback strength makes the outcome more contingent and less efficiency-driven, and can fire an external shock to try to break the lock), plus a Categorize (increasing-returns source: set-up cost / learning / coordination / expectations) and MatchConcepts, Quiz + MindMap. en + es twin.',
  },
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
];

/** Quick lookup by slug. */
export const upcomingBySlug = new Map<string, UpcomingCourse>(
  upcomingCourses.map((c) => [c.slug, c]),
);
