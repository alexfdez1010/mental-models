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
 * `principal-agent-problem`, …) have graduated and been removed; their topic MDX
 * is now the record. Lowest `order` is built next. The remaining entries all sit
 * in the **expert tier**, deliberately kept tag-diverse so no single roadmap tag
 * races ahead: probability/science-engineering
 * (`cumulative-advantage-and-power-laws`, 38) and psychology
 * (`debiasing-and-the-bias-blind-spot`, 39).
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
  // `externalities` (20), `moats` (21), `ecosystems-and-niches` (22),
  // `leverage-points` (23), `lollapalooza-effect` (24), `regression-to-the-mean`
  // (25), `critical-mass` (26), `nash-equilibrium` (27), `asymmetry-and-optionality`
  // (28), `fitness-landscapes` (29), `mechanism-design` (30),
  // `combining-models-latticework` (31), `deciding-under-deep-uncertainty` (32),
  // `influence-and-persuasion` (33), `evolution-of-cooperation` (34),
  // `credible-commitment-and-deterrence` (35), `path-dependence-and-lock-in`
  // (the expert systems/economics rung, order 36) and `principal-agent-problem`
  // (the expert economics/psychology rung, order 37) have graduated and been
  // removed; their topic MDX is now the record. The lowest-order entry below
  // (`cumulative-advantage-and-power-laws`, order 38) is built next. The
  // remaining queue finishes the expert tier and keeps the breadth tag-diverse,
  // spanning probability/science-engineering
  // (`cumulative-advantage-and-power-laws`) and psychology
  // (`debiasing-and-the-bias-blind-spot`) so no single roadmap tag races ahead.
  {
    slug: 'debiasing-and-the-bias-blind-spot',
    icon: '🪞',
    difficulty: 'expert',
    order: 39,
    accent: 'brand',
    title: {
      en: 'Debiasing & the Bias Blind Spot',
      es: 'Corrección de Sesgos y el Punto Ciego',
    },
    description: {
      en: 'You can ace every lesson on cognitive bias and still be just as biased — because you see everyone\'s distortions but your own. The meta-skill of catching your own thinking in the act: why knowing about biases barely helps, and the handful of things that actually do — the outside view, red teams, checklists, and pre-commitment.',
      es: 'Puedes dominar todas las lecciones sobre sesgos cognitivos y seguir igual de sesgado — porque ves las distorsiones de todos menos las tuyas. La meta-destreza de pillar tu propio pensamiento en el acto: por qué saber de sesgos apenas ayuda, y las pocas cosas que sí funcionan — la visión externa, los equipos rojos, las listas de comprobación y el compromiso previo.',
    },
    dependencies: ['confirmation-bias', 'calibration-and-confidence'],
    tags: ['psychology'],
    buildNotes:
      'Debiasing & the bias blind spot — the expert psychology rung and the meta-skill the whole psychology track builds toward: not naming biases but actually reducing their grip on your own judgment. Assumes the learner has met specific biases (confirmation-bias) and calibration-and-confidence (overconfidence, Brier scores). The uncomfortable organising fact: knowing about a bias does NOT immunise you against it, and worse, the "bias blind spot" (Pronin) means you readily spot bias in others while feeling objective yourself — introspection tells you nothing, because biases operate below awareness. Sections, each with mechanism + worked example: the bias blind spot itself (people rate themselves less biased than average — a bias about biases; why "I know about anchoring so it won\'t get me" is false); why education alone barely debiases (you can recite the sunk-cost fallacy and still escalate; awareness ≠ correction); the two families of fixes — CHANGE THE THINKER vs CHANGE THE ENVIRONMENT. Thinker-side (weaker but real): the outside view / reference-class forecasting (Kahneman & Lovallo — ask "how did similar cases go?" instead of reasoning from the inside of this one), consider-the-opposite / actively-open-minded thinking, pre-mortems (imagine the project has failed and explain why), and calibration training with feedback (tie to calibration course). Environment/structure-side (stronger, because it doesn\'t rely on willpower): checklists (Gawande — offload judgment to a list so you can\'t skip the step), red teams / devil\'s advocates and structured dissent (institutionalise the disagreement so it doesn\'t depend on a brave individual), decision hygiene and independent estimates before discussion (stop anchoring and cascades — tie to social proof), algorithms/simple rules over clinical judgment where data allows (Meehl), and pre-commitment / binding your future self (tie explicitly to credible-commitment-and-deterrence — a commitment device IS a debiasing tool aimed at your own future distortions). The debiasing hierarchy: structure > incentives > training > mere awareness. Pitfalls & where the model lies: debiasing-the-debiasing (using "you\'re just biased" as a rhetorical weapon while exempting yourself — the blind spot again); over-correction (fixing overconfidence by becoming uselessly wishy-washy, or treating every intuition as suspect when expert intuition in high-validity environments is real); the cost of hygiene (checklists and red teams add friction — worth it for high-stakes, irreversible calls, overkill for reversible ones); and the fact that no technique fully removes bias, it only reduces it. Build an interactive island (a "debiasing bench": a set of realistic judgment scenarios each carrying a lurking bias — the learner first makes a snap inside-view call, then applies a chosen debiasing tool (outside view / pre-mortem / red team / checklist / independent-estimate) and watches an accuracy-or-calibration meter update, discovering that structural tools move the needle more than "just be aware" and that some tools fit some biases better than others). Plus a Categorize (does this fix change the THINKER or the ENVIRONMENT? / weak-awareness vs strong-structural fix) and MatchConcepts (bias blind spot, outside view, pre-mortem, red team, decision hygiene), Quiz + MindMap. en + es twin.',
  },
  {
    slug: 'signaling-and-costly-signals',
    icon: '🦚',
    difficulty: 'expert',
    order: 40,
    accent: 'accent',
    title: {
      en: 'Signalling & Costly Signals',
      es: 'Señalización y Señales Costosas',
    },
    description: {
      en: 'A peacock’s absurd tail, a diploma, a firm’s deep warranty, a nation’s show of force — all the same move: when you know something others can’t verify, you prove it by doing something that would be too expensive to fake. Why only costly signals are believed, and where the cost is pure waste.',
      es: 'La cola absurda de un pavo real, un diploma, la garantía generosa de una empresa, la exhibición de fuerza de una nación — todo el mismo movimiento: cuando sabes algo que otros no pueden verificar, lo demuestras haciendo algo demasiado caro de fingir. Por qué solo se creen las señales costosas, y dónde ese coste es puro despilfarro.',
    },
    dependencies: ['natural-selection', 'principal-agent-problem', 'credible-commitment-and-deterrence'],
    tags: ['biology-evolution', 'strategy'],
    buildNotes:
      'Signalling & costly signals — the expert biology-evolution/strategy rung on how hidden quality gets credibly revealed across biology, markets, and strategy, and why the credibility must be PAID FOR. Assumes natural-selection (traits shaped by differential fitness), principal-agent-problem (information asymmetry, adverse selection, and the screening-vs-signalling pair introduced there) and credible-commitment-and-deterrence (a threat/promise is only believed if backed by something costly and hard to reverse). Organising idea: when one party has private information about their quality/type and others cannot verify it, cheap talk is ignored (anyone can claim anything) — so the informed party proves it with a SIGNAL that is only worth sending for the genuine type. The separating condition (Spence): a signal credibly separates types when its cost is lower for high types than for low types, so the good type sends it and the bad type finds it not worth faking. Sections, each with mechanism + worked example: cheap talk vs costly signals (why "trust me" carries no information at a separating equilibrium); the HANDICAP PRINCIPLE (Zahavi) and honest signalling in biology — the peacock’s tail, the gazelle’s stotting, bright colours — costly precisely so they cannot be faked by the weak; Spence’s JOB-MARKET SIGNALLING (education as a signal that may certify pre-existing ability more than it adds skill — the sheepskin effect) and the wasteful side (credential inflation, arms races in signalling); market signals that resolve the lemons problem (warranties, brands, money-back guarantees, a founder’s own capital at risk — echo the principal-agent screening/signalling toolkit); strategic/deterrence signals (burning bridges, sunk-cost commitments, military displays, "tying hands" and "sinking costs" — tie to credible commitment); social signals (conspicuous consumption/Veblen goods, virtue signalling, costly initiation rites that bind groups). Separating vs pooling vs semi-separating equilibria in plain language; countersignalling (the very top skip the signal because they have nothing to prove). Pitfalls & where the model lies: signals can be dishonestly mimicked when the cost gap narrows (deceptive mimicry in biology, fake luxury, diploma mills) so honesty is only maintained while faking stays expensive; the deadweight WASTE of pure signalling arms races (everyone spends more to stand still — tie to the Red Queen and to positional/zero-sum competition); confusing correlation-with-quality for causation (does the degree build the skill or just reveal it?); and over-reading signals in noisy one-shot settings. Build an interactive island (a "signalling separator": a population of high- and low-quality senders choosing how much to spend on a signal, with sliders for the signal’s cost-to-high vs cost-to-low and the receiver’s prior; the learner watches the equilibrium flip between POOLING (no one separates, receivers can’t tell types apart) and SEPARATING (only high types signal and are believed), sees the honest-but-wasteful zone, and a readout of who-signals / receiver belief / total signalling cost burned). Plus a Categorize (honest costly signal vs cheap talk vs dishonest mimicry, or biology/market/strategy/social signal) and MatchConcepts (handicap principle, separating equilibrium, cheap talk, countersignalling, credential inflation), Quiz + MindMap. en + es twin.',
  },
];

/** Quick lookup by slug. */
export const upcomingBySlug = new Map<string, UpcomingCourse>(
  upcomingCourses.map((c) => [c.slug, c]),
);
