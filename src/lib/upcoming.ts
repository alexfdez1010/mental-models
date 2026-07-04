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
 * `critical-mass`, `nash-equilibrium`, …) have graduated and been removed.
 * Lowest `order` is built next. The remaining entries sit in the **expert
 * tier**, deliberately kept tag-diverse so no single roadmap tag races ahead:
 * psychology (`influence-and-persuasion`), biology-evolution/strategy
 * (`evolution-of-cooperation`) and strategy (`credible-commitment-and-deterrence`).
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
  // (28), `fitness-landscapes` (29), `mechanism-design` (the advanced
  // strategy/economics rung, 30) and `combining-models-latticework` (the
  // foundations/decision-making capstone, 31) have graduated and been removed;
  // their topic MDX is now the record — and `deciding-under-deep-uncertainty`
  // (the expert decision-making/probability rung, order 32) has now graduated and
  // been removed too. The lowest-order entry below (`influence-and-persuasion`,
  // order 33) is built next. The remaining queue finishes the expert tier and
  // keeps the breadth tag-diverse, spanning psychology (`influence-and-persuasion`),
  // biology-evolution/strategy (`evolution-of-cooperation`) and strategy
  // (`credible-commitment-and-deterrence`) so no single roadmap tag races ahead of
  // the others.
  {
    slug: 'influence-and-persuasion',
    icon: '🎯',
    difficulty: 'advanced',
    order: 33,
    accent: 'brand',
    title: {
      en: 'Influence & Persuasion',
      es: 'Influencia y Persuasión',
    },
    description: {
      en: 'The handful of psychological levers that reliably move a "yes" — reciprocity, commitment, social proof, authority, liking, and scarcity. How compliance is engineered, why these shortcuts usually serve us, and how to spot when they are being turned against you.',
      es: 'El puñado de palancas psicológicas que arrancan un "sí" de forma fiable — reciprocidad, compromiso, prueba social, autoridad, simpatía y escasez. Cómo se fabrica el cumplimiento, por qué estos atajos suelen servirnos y cómo detectar cuándo se vuelven contra ti.',
    },
    dependencies: ['incentives', 'confirmation-bias'],
    tags: ['psychology', 'decision-making'],
    buildNotes:
      'Influence & persuasion — the advanced psychology rung that turns "cognitive biases" from a list of errors into a system of levers other people can pull. Assumes incentives and the bias courses (confirmation-bias). The organising canon is Robert Cialdini’s principles of influence, taught as mental models of how a mind is moved to comply. Sections, each with the mechanism (why the shortcut normally works), a fully worked real example, and a defence against misuse: reciprocity (the pull to repay a gift/concession — the free sample, the door-in-the-face); commitment & consistency (once we take a stand we defend it — foot-in-the-door, written pledges, why small yeses precede big ones); social proof (we copy the many, especially under uncertainty and similarity — canned laughter, "best-seller", queues); authority (we defer to credible expertise and its mere symbols — titles, uniforms, the Milgram shadow); liking (we say yes to those we like — similarity, compliments, cooperation, the halo effect); scarcity (we want what is rare or vanishing — deadlines, "only 3 left", loss-aversion tie-in); and unity (shared identity, the "we"). Frame each as incentives + a bias working together, and connect to lollapalooza-effect (several levers stacking multiplicatively). A full section on ethics: persuasion vs manipulation, and how to inoculate yourself (name the lever, ask "would I want this if the tactic were removed?"). Pitfalls: over-attributing outcomes to a single lever, assuming the tactics always work (they backfire when transparent or clumsy), and confusing influence with coercion. Build an interactive island (a "compliance meter" that lets the learner toggle the six/seven levers on a sales or campaign scenario and watch the modelled likelihood of a yes climb — and over-toggle into obvious manipulation), plus a Categorize (tactic → principle) and a MatchConcepts, Quiz + MindMap. en + es twin.',
  },
  {
    slug: 'evolution-of-cooperation',
    icon: '🤝',
    difficulty: 'advanced',
    order: 34,
    accent: 'accent',
    title: {
      en: 'The Evolution of Cooperation',
      es: 'La Evolución de la Cooperación',
    },
    description: {
      en: 'If nature is red in tooth and claw and every player is out for itself, why is the world so full of cooperation? How self-interested agents evolve to help each other — repeated games, tit-for-tat, reciprocity, and kinship — and the conditions that make being nice the winning strategy.',
      es: 'Si la naturaleza es despiadada y cada jugador va a lo suyo, ¿por qué está el mundo tan lleno de cooperación? Cómo agentes egoístas evolucionan para ayudarse — juegos repetidos, donde-las-dan-las-toman, reciprocidad y parentesco — y las condiciones que hacen de ser amable la estrategia ganadora.',
    },
    dependencies: ['natural-selection', 'nash-equilibrium'],
    tags: ['biology-evolution', 'strategy'],
    buildNotes:
      'The evolution of cooperation — the advanced rung that resolves the apparent paradox left by natural-selection and nash-equilibrium: the one-shot prisoner’s dilemma says defect, yet cooperation is everywhere in nature and society. Assumes natural-selection (fitness, selection) and nash-equilibrium (the dilemma, repeated play). Sections: the paradox stated (selfish genes, defect-dominant games, but real cooperation); the shadow of the future — repeating the dilemma changes the equilibrium, so a long enough future makes cooperating self-interested (tie back to nash "change the game"); Axelrod’s computer tournaments and why tit-for-tat won — be nice (never defect first), retaliatory (punish defection), forgiving (return to cooperation), and clear (simple to read); refinements — generous/contrite tit-for-tat surviving noise, win-stay-lose-shift; direct reciprocity ("I help you, you help me") vs indirect reciprocity and reputation ("I help you, someone helps me" — the role of gossip and status); kin selection and Hamilton’s rule rB > C in words (why we sacrifice most for close relatives); a brief, honest note on the group-selection debate; and the conditions that grow cooperation (repetition, reputation, relatedness, clustering of cooperators). Pitfalls: cooperation is fragile (defector invasions, one-shot vs repeated confusion), tit-for-tat’s vulnerability to noise/echo, and the naturalistic fallacy (what evolves is not what is moral). Reuse the IteratedDilemma island (repeated prisoner’s dilemma with selectable strategies) and add a tournament/populations visual if useful; Categorize (strategy traits: nice/retaliatory/forgiving), Quiz + MindMap. en + es twin.',
  },
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
];

/** Quick lookup by slug. */
export const upcomingBySlug = new Map<string, UpcomingCourse>(
  upcomingCourses.map((c) => [c.slug, c]),
);
