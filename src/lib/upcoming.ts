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
 * `evolutionarily-stable-strategies`, …)
 * have graduated and been removed; their topic MDX is now the record. Lowest
 * `order` is built next. The remaining entries all sit in the **expert tier**,
 * deliberately kept tag-diverse so no single roadmap tag races ahead:
 * systems-thinking/psychology/economics (`goodharts-law`, 47),
 * probability/psychology (`information-cascades-and-herding`, 48) and
 * decision-making/probability (`the-value-of-information`, 49).
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
  // The earlier expert rungs — `externalities` (20) … `spontaneous-order-and-
  // the-knowledge-problem` (45) and `evolutionarily-stable-strategies` (46) —
  // have graduated and been removed; their topic MDX is now the record. The
  // lowest-order entry below (`goodharts-law`, order 47) is built next. The
  // remaining queue finishes the expert tier and keeps the breadth tag-diverse,
  // spanning systems-thinking/psychology/economics (`goodharts-law`),
  // probability/psychology (`information-cascades-and-herding`) and
  // decision-making/probability (`the-value-of-information`) so no single
  // roadmap tag races ahead.
  {
    slug: 'goodharts-law',
    icon: '🎯',
    difficulty: 'expert',
    order: 47,
    accent: 'brand',
    title: {
      en: "Goodhart's Law",
      es: 'La Ley de Goodhart',
    },
    description: {
      en: 'When a measure becomes a target, it stops being a good measure. Point an incentive at a proxy — test scores, clicks, arrests, hospital wait-times — and people optimise the proxy while the real goal it stood for quietly rots. Why every metric you reward eventually lies to you, and what to do about it.',
      es: 'Cuando una medida se convierte en objetivo, deja de ser una buena medida. Apunta un incentivo a un indicador — notas de examen, clics, detenciones, tiempos de espera hospitalarios — y la gente optimiza el indicador mientras el objetivo real que representaba se pudre en silencio. Por qué toda métrica que premias acaba mintiéndote, y qué hacer al respecto.',
    },
    dependencies: ['incentives', 'feedback-loops', 'principal-agent-problem'],
    tags: ['systems-thinking', 'psychology', 'economics'],
    buildNotes:
      "Goodhart's Law — the expert systems-thinking/psychology/economics rung: \"When a measure becomes a target, it ceases to be a good measure\" (Charles Goodhart 1975; sharpened by Marilyn Strathern). Assumes incentives (agents optimise what is rewarded), feedback-loops (proxy optimisation feeds back and corrupts the signal) and principal-agent-problem (the measured party knows things the measurer does not, and games the gap). Organising idea: a metric is only ever a PROXY for the thing you actually care about; the two are correlated in the wild, but the moment you apply optimisation pressure to the proxy, the correlation you relied on breaks (the proxy and the goal come apart) and you get the number without the substance. Sections, each with mechanism + worked example: proxy vs goal and why we ever use proxies (the real target is unmeasurable/slow; the proxy is cheap and correlated — teaching→test scores, health→wait times, safety→reported incidents); the mechanism of decoupling under pressure (Campbell's Law, the four types in the Manheim/Garrabrant taxonomy — regressional, extremal, causal, adversarial Goodhart — kept intuitive, not heavy); flagship worked cases (the Soviet nail factory: reward by weight → one giant useless nail, reward by number → millions of tiny useless tacks; the cobra effect / Hanoi rats bounty breeding the very pest; teaching to the test; sales quotas and sandbagging; clicks/engagement metrics and clickbait; hospital A&E four-hour targets; arrest/ticket quotas; citation counts and salami-slicing science; VaR and risk metrics gamed pre-2008); why it is a SPECIAL CASE of incentives + principal-agent (the agent optimises the letter of the reward, not its spirit) and how it forms a feedback loop that erodes the metric's own validity. Pitfalls & where the model lies: it is NOT an argument against measuring at all (flying blind is worse) — it is an argument against naive single-metric targets under high stakes; not every measure collapses (low-stakes or hard-to-game measures survive; the failure scales with optimisation pressure and gameability); over-quoting it becomes a lazy excuse to dodge accountability. Fixes: use baskets of metrics that are hard to game together, hold some targets loosely, keep humans in the loop / qualitative audit, reward outcomes not proxies where possible, keep the true goal explicit, and expect to rotate metrics as they decay. Build an interactive island (a \"Goodhart pressure dial\": a scatter/bar showing a true-quality variable and a measured PROXY that track together at low pressure; crank an \"optimisation pressure / stakes\" slider and watch agents pour effort into the gap — the proxy shoots up while true quality flatlines or falls, the correlation coefficient between them visibly decaying toward zero, with a readout of measured score vs real value vs the wasted gaming effort). Plus a Categorize (sort cases into measure-still-valid vs measure-corrupted, or the Goodhart types) and MatchConcepts (proxy, target, Campbell's Law, gaming, Goodhart's Law), Quiz + MindMap. en + es twin.",
  },
  {
    slug: 'information-cascades-and-herding',
    icon: '🐑',
    difficulty: 'expert',
    order: 48,
    accent: 'accent',
    title: {
      en: 'Information Cascades & Herding',
      es: 'Cascadas de Información y Comportamiento Gregario',
    },
    description: {
      en: 'Sometimes it is perfectly rational to ignore what you know and copy the crowd — and that is exactly how the crowd goes wrong together. Once a few early choices line up, each newcomer sensibly follows the herd instead of their own private signal, so no new information enters and a fragile consensus locks in on a whim. How rational individuals produce irrational, reversible mobs.',
      es: 'A veces es perfectamente racional ignorar lo que sabes y copiar a la multitud — y así es precisamente como la multitud se equivoca en bloque. En cuanto unas pocas elecciones tempranas coinciden, cada recién llegado sigue sensatamente al rebaño en vez de a su propia señal privada, así que no entra información nueva y un consenso frágil se fija por capricho. Cómo individuos racionales producen masas irracionales y reversibles.',
    },
    dependencies: ['bayesian-updating', 'common-knowledge-and-coordination', 'critical-mass'],
    tags: ['probability', 'psychology'],
    buildNotes:
      'Information cascades & herding — the expert probability/psychology rung (Bikhchandani, Hirshleifer & Welch 1992; Banerjee 1992) on how rational Bayesian agents, observing only each other\'s ACTIONS (not their private information), rationally abandon their own signal and copy predecessors — so information stops aggregating and the group locks onto a possibly-wrong choice. Assumes bayesian-updating (posterior from prior + evidence, weighing signal strength), common-knowledge-and-coordination (acting on beliefs about others) and critical-mass (a threshold of early movers that tips the rest). Organising idea: distinguish an INFORMATION cascade (I copy you because your action reveals information I trust more than my own weak private signal — informational herding) from mere conformity/social pressure; once the public tally of actions outweighs any one private signal, each newcomer optimally ignores their own data, so their action carries NO new information, and everyone after them is in the same trap — the cascade is informationally empty yet self-perpetuating. Sections, each with mechanism + worked example: the canonical urn experiment (two urns, majority-red vs majority-blue; you see a private draw AND everyone\'s prior guesses; after two same guesses your single contrary draw is rationally overruled — walk the Bayesian arithmetic with real numbers); why cascades are RATIONAL yet FRAGILE and information-poor (they aggregate almost no private knowledge, so a tiny new public signal or one credible contrarian can shatter and reverse them — fads, flips); real faces (restaurant queues and bestseller lists, viral products and app-store ranks, bank-run/coordination links, academic and medical consensus bandwagons, financial bubbles and fashion, citation herding, standing ovations); the difference from and relationship to COMMON KNOWLEDGE and critical mass (a public signal can start OR break a cascade; visible actions are the channel); reputational herding (Scharfstein–Stein: agents herd to not look wrong alone). Pitfalls & where the model lies: herding is not always irrational (following others can be Bayesian-optimal individually even as it is collectively bad — the paradox is the point); cascades are shallow and reversible, unlike genuine consensus built on independent evidence — do not mistake agreement for accuracy (tie to base rates / diversity of information); the cure is preserving INDEPENDENT private signals (aggregate votes/prices/prediction markets that reveal information, not just actions; encourage contrarians; sequence disclosures to avoid anchoring). Build an interactive island (a "cascade line": a sequence of agents each with a private noisy signal about which of two options is correct; they decide in order, seeing only the earlier CHOICES; a signal-strength / prior slider and a step/run control; watch a couple of early coincidences trigger everyone downstream to follow regardless of their private signal, with a readout of how many people followed their own signal vs the herd, whether the cascade landed on the correct option, and how little private information actually got used — plus a "drop a public signal" button that can shatter and flip it). Plus a Categorize (sort cases into information-cascade vs independent-judgement, or fragile-herd vs robust-consensus) and MatchConcepts (information cascade, private signal, herding, reputational herding, cascade fragility), Quiz + MindMap. en + es twin.',
  },
  {
    slug: 'the-value-of-information',
    icon: '🔍',
    difficulty: 'expert',
    order: 49,
    accent: 'brand',
    title: {
      en: 'The Value of Information',
      es: 'El Valor de la Información',
    },
    description: {
      en: 'Before you pay for one more test, study, or opinion, ask the question almost no one asks: could the answer actually change what you do? Information is only worth something if it might flip a decision — and its value is capped by the cost of being wrong. The mental model that tells you when to look before you leap, and when looking is just expensive procrastination.',
      es: 'Antes de pagar por una prueba, un estudio o una opinión más, hazte la pregunta que casi nadie hace: ¿podría la respuesta cambiar de verdad lo que vas a hacer? La información solo vale algo si podría hacerte cambiar de decisión — y su valor está acotado por el coste de equivocarte. El modelo mental que te dice cuándo mirar antes de saltar, y cuándo mirar es solo una procrastinación cara.',
    },
    dependencies: ['bayesian-updating', 'thinking-in-probabilities', 'asymmetry-and-optionality'],
    tags: ['decision-making', 'probability'],
    buildNotes:
      'The Value of Information (VOI) — the expert decision-making/probability rung from decision analysis (Howard 1966; the expected value of perfect and of sample/imperfect information). Assumes bayesian-updating (revising beliefs from a test result), thinking-in-probabilities (expected value over states) and asymmetry-and-optionality (the payoff to knowing is convex — you keep the good news and act on it, discard the bad). Organising idea — the single sharpest question in applied decision-making: information has value ONLY if it could change your decision; if you would do the same thing whatever the test says, the test is worth exactly zero no matter how accurate or interesting it is. Value comes from AVERTED MISTAKES, so VOI = (expected payoff of the best decision WITH the information) minus (expected payoff of the best decision WITHOUT it), and it is always >= 0 and always <= the cost of being wrong (the loss you could avoid). Sections, each mechanism + worked example: the core definition and the "would it change my action?" test (a doctor who will operate regardless gains nothing from the scan); Expected Value of PERFECT Information (EVPI) as the ceiling — what a clairvoyant is worth — worked with a real payoff table (e.g. drill-the-well / launch-the-product decision across two states, compute EV with clairvoyance minus EV of the best prior action); Expected Value of SAMPLE/IMPERFECT Information (EVSI) for a real, noisy test — fold in sensitivity/specificity via Bayes, compute the pre-posterior expected value, and note EVSI <= EVPI always; the net value = EVSI minus the cost/price of the test, and the decision to gather info is itself an expected-value decision; why VOI is highest when you are genuinely UNCERTAIN and the decision is CLOSE and the stakes are HIGH (a lopsided prior, a trivial decision, or an unactionable answer all drive VOI to zero); the tie to optionality (information is a real option — the value of learning before committing is the value of keeping your choice open). Pitfalls & where the model lies: gathering information is not free (money, time, and the cost of DELAY — sometimes acting now beats a better-informed action later); more data past the decision threshold is pure waste (analysis paralysis, the vanity metric, the study that cannot change the plan); ignoring the cost of the WRONG test (a very accurate test of the wrong question is worthless); base-rate and reliability errors make people wildly overvalue noisy tests; and VOI assumes you will actually ACT on the answer — information you will rationalise away is worth nothing. Build an interactive island (a "value-of-information lab": a two-action decision under two uncertain states with an editable payoff table and a prior-probability slider; a test with adjustable RELIABILITY and COST; show the expected value of acting on the prior alone, the EVPI ceiling (perfect clairvoyance), and the EVSI of the noisy test, with the net value = EVSI minus cost — and a readout that flips to "this test cannot change your decision → value 0" whenever the prior is lopsided enough or the decision one-sided, so the learner SEES value collapse to zero as the decision stops being close). Plus a Categorize (sort scenarios into worth-testing vs test-is-worthless, i.e. could-change-the-action vs could-not) and MatchConcepts (value of information, EVPI, EVSI, the change-my-action test, analysis paralysis), Quiz + MindMap. en + es twin.',
  },
];

/** Quick lookup by slug. */
export const upcomingBySlug = new Map<string, UpcomingCourse>(
  upcomingCourses.map((c) => [c.slug, c]),
);
