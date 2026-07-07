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
 * `debiasing-and-the-bias-blind-spot`, …) have graduated and been removed; their
 * topic MDX is now the record. Lowest `order` is built next. The remaining entries
 * all sit in the **expert tier**, deliberately kept tag-diverse so no single
 * roadmap tag races ahead: biology-evolution/strategy
 * (`signaling-and-costly-signals`, 40), economics/systems-thinking
 * (`reflexivity-and-self-fulfilling-dynamics`, 41) and
 * decision-making/systems-thinking (`antifragility-and-via-negativa`, 42).
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
  // The earlier expert rungs — `externalities` (20) … `principal-agent-problem`
  // (37), `cumulative-advantage-and-power-laws` (38) and
  // `debiasing-and-the-bias-blind-spot` (39) — have graduated and been removed;
  // their topic MDX is now the record. The lowest-order entry below
  // (`signaling-and-costly-signals`, order 40) is built next. The remaining queue
  // finishes the expert tier and keeps the breadth tag-diverse, spanning
  // biology-evolution/strategy (`signaling-and-costly-signals`),
  // economics/systems-thinking (`reflexivity-and-self-fulfilling-dynamics`) and
  // decision-making/systems-thinking (`antifragility-and-via-negativa`) so no
  // single roadmap tag races ahead.
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
  {
    slug: 'reflexivity-and-self-fulfilling-dynamics',
    icon: '🔁',
    difficulty: 'expert',
    order: 41,
    accent: 'brand',
    title: {
      en: 'Reflexivity & Self-Fulfilling Dynamics',
      es: 'Reflexividad y Dinámicas Autocumplidas',
    },
    description: {
      en: 'Sometimes believing a thing makes it true. A bank is fine until enough people fear it isn’t; a stock is “worth” whatever the crowd will pay for the story. When beliefs bend the very reality they’re about, the usual arrow from facts to opinions runs both ways — and feedback, not fundamentals, takes the wheel.',
      es: 'A veces creer algo lo vuelve cierto. Un banco está bien hasta que suficiente gente teme que no lo esté; una acción “vale” lo que la multitud pague por la historia. Cuando las creencias doblan la propia realidad de la que hablan, la flecha habitual de los hechos a las opiniones va en ambos sentidos — y toma el mando la retroalimentación, no los fundamentos.',
    },
    dependencies: ['feedback-loops', 'supply-and-demand', 'critical-mass'],
    tags: ['economics', 'systems-thinking'],
    buildNotes:
      'Reflexivity & self-fulfilling dynamics — the expert economics/systems-thinking rung on the two-way street between beliefs and reality: when what people believe about a situation changes the situation itself, so cause and effect loop. Assumes feedback-loops (reinforcing vs balancing loops), supply-and-demand (price as information), and critical-mass (tipping thresholds). Organising idea: in most of nature, facts drive beliefs one way; in social systems, beliefs also drive the facts, closing a loop (George Soros’s REFLEXIVITY; Robert Merton’s SELF-FULFILLING PROPHECY; the Thomas theorem — "if people define situations as real, they are real in their consequences"). Sections, each with mechanism + worked example: self-fulfilling prophecy (the bank run — a solvent bank fails purely because depositors expect it to; tie to game-theory coordination and to critical-mass thresholds); self-defeating/suicidal prophecy (a confident forecast that a road will be jammed empties it; a "safe" reputation breeds the complacency that ends it); reflexivity in markets (Soros — prices are shaped by biased perceptions that then feed back into the fundamentals they price, so bubbles and busts are not anomalies but the loop running hot; boom/bust as reinforcing feedback breaking equilibrium); reflexivity in the social world (stereotype threat, the Pygmalion/Rosenthal effect where expectations change performance, placebo, credit ratings and self-fulfilling confidence/panic); the difference from ordinary feedback — here the loop passes through BELIEFS and EXPECTATIONS, so information and narrative are causal forces. Pitfalls & where the model lies: not everything is reflexive (gravity doesn’t care what you believe — reflexivity needs an agent whose beliefs act back on the system, so don’t over-apply it to purely physical/exogenous facts); reflexive processes are inherently hard to predict and can reverse violently (unfalsifiable "it’s reflexive" storytelling is a trap); confusing a genuine self-fulfilling loop with mere correlation; and the moral hazard of engineering self-fulfilling confidence (talking up a bubble). Build an interactive island (a "reflexivity loop": a slider for how strongly BELIEF feeds back into the underlying FUNDAMENTAL, plus an initial shock/rumour; below a coupling threshold beliefs and reality settle to fundamentals, above it the learner watches a self-fulfilling boom or a bank-run collapse run away, with a readout of belief vs reality vs the gap and whether the prophecy fulfilled or defeated itself). Plus a Categorize (self-fulfilling vs self-defeating vs non-reflexive/exogenous) and MatchConcepts (reflexivity, self-fulfilling prophecy, Thomas theorem, Pygmalion effect, boom-bust loop), Quiz + MindMap. en + es twin.',
  },
  {
    slug: 'antifragility-and-via-negativa',
    icon: '🌱',
    difficulty: 'expert',
    order: 42,
    accent: 'accent',
    title: {
      en: 'Antifragility & Via Negativa',
      es: 'Antifragilidad y Vía Negativa',
    },
    description: {
      en: 'Some things break under stress, some just endure it — and a rare few actually get stronger from it. Muscles, immune systems, and good businesses feed on a little disorder; the fragile ones are quietly wrecked by it. How to tell which is which, and why the surest way to improve most things is to remove, not add.',
      es: 'Unas cosas se rompen con el estrés, otras solo lo aguantan — y unas pocas y raras se vuelven más fuertes con él. Los músculos, el sistema inmune y los buenos negocios se alimentan de algo de desorden; los frágiles quedan destrozados por él en silencio. Cómo distinguir cuál es cuál, y por qué la vía más segura para mejorar casi todo es quitar, no añadir.',
    },
    dependencies: ['asymmetry-and-optionality', 'fat-tails', 'margin-of-safety'],
    tags: ['decision-making', 'systems-thinking'],
    buildNotes:
      'Antifragility & via negativa — the expert decision-making/systems-thinking rung (Nassim Taleb) on how systems respond to volatility, stress, and disorder, and the asymmetric-payoff logic of getting stronger from shocks. Assumes asymmetry-and-optionality (convex vs concave payoffs, capped-downside/open-upside), fat-tails (rare large deviations dominate), and margin-of-safety (buffers/redundancy). Organising idea: the triad — FRAGILE (harmed by volatility, concave payoff to disorder, likes calm — the teacup, the over-optimised supply chain), ROBUST/RESILIENT (unchanged by volatility — the rock, the phoenix), ANTIFRAGILE (improves with volatility up to a point, convex payoff to disorder — muscles under load, the immune system, evolution, a barbell portfolio, a business that gains from chaos). Antifragility = convexity to a stressor; it is asymmetry-and-optionality applied to disorder itself. Sections, each with mechanism + worked example: the triad with a payoff-curvature picture (fragile = concave/negative convexity, antifragile = convex — small stressors help, and it benefits from the disorder that fat tails guarantee); HORMESIS and overcompensation (a little poison/stress triggers a stronger rebuild — exercise, fasting, vaccines, post-traumatic growth); the role of stressors, redundancy, and why depriving an antifragile system of volatility (over-smoothing, suppressing all fire/all fever/all failure) makes it fragile — the "touch of chaos" and the Lucretius/turkey problems; VIA NEGATIVA (robustify by SUBTRACTION — remove the fragilising agent, debt, single points of failure, the smoker’s cigarette — because removing a known harm is more robust than adding a speculative good; the barbell as playing it safe on one end and taking bounded risks on the other; skin in the game as forcing antifragility by aligning downside); how to spot fragility in advance (it’s more predictable than forecasting the shock — anything with hidden concavity, over-optimisation, no slack, or that hates variance). Pitfalls & where the model lies: antifragility has LIMITS (dose matters — enough stress kills even the antifragile; convexity holds only over a range); don’t romanticise chaos or manufacture harmful stress ("what doesn’t kill me" is survivorship bias); not everything fragile should be exposed to volatility (some things you just protect); and the risk of using "antifragile" as a buzzword for any resilience. Build an interactive island (a "fragility tester": pick a system with a payoff-vs-stress curve — fragile (concave), robust (flat), or antifragile (convex) — then crank a VOLATILITY slider and/or fire random shocks and watch cumulative outcome diverge: the fragile one bleeds from the tails while the antifragile one compounds gains from the same disorder, up to the dose limit where it too breaks; readout of curvature, mean outcome, worst tail, and a via-negativa toggle that removes a fragilising element and re-runs). Plus a Categorize (sort real cases into fragile / robust / antifragile, or add-a-good vs remove-a-harm) and MatchConcepts (antifragility, hormesis, via negativa, barbell, convexity), Quiz + MindMap. en + es twin.',
  },
];

/** Quick lookup by slug. */
export const upcomingBySlug = new Map<string, UpcomingCourse>(
  upcomingCourses.map((c) => [c.slug, c]),
);
