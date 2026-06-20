# TOPIC — the subject this site teaches

> **This file is the single source of truth for *what* this site teaches.**
> `CLAUDE.md`, the authoring skills, and the autonomous cron builder
> (`scripts/daily-lesson.sh`) all read this file to know the subject, the
> mission, and the scope.

---

## 🎯 Subject

**Mental Models** — the transferable thinking tools that great decision-makers,
scientists, and investors use to understand reality and choose well. A mental
model is a compressed representation of how some part of the world works
(*inversion*, *opportunity cost*, *feedback loops*, *base rates*, *supply &
demand*) that you can carry from one domain into another. This site teaches the
**latticework** of the most important models — where each comes from, what it
predicts, when it breaks — so the learner can reason across disciplines instead
of memorizing isolated facts.

## 🚀 Mission — zero to expert

**This is a Mental Models learning platform. Its single goal: take a learner
with no prior knowledge of how to think in models and make them a complete
expert who reasons with a broad, interconnected latticework.** Every course,
lesson, analogy, and exercise must serve that arc.

- **Assume zero background.** A `beginner`-tier lesson must not lean on any term
  it hasn't defined. Define every model and piece of jargon on first use — never
  assume the reader has met "second-order effects" or "base rate" before.
- **Build a ladder, not islands.** Order courses so each only needs what came
  before it. Foundational models (map vs. territory, first principles,
  inversion) come before models that compose them (second-order thinking,
  systems & feedback, game theory). Encode the path with each topic's
  `dependencies` array and label the rung with `difficulty`.
- **End at genuine expertise.** `expert`-tier content goes all the way: how
  models interact and conflict, where each fails, calibration and quantification,
  and combining several models into a single judgment. Don't stop at "here's a
  cool idea".
- **Teach transfer, not trivia.** A model is only learned when the reader can
  *apply it to a new situation*. Every model gets a definition, an origin
  discipline, at least one fully worked example, a misuse/limitation, and a
  "when to reach for it" note.
- **New courses stay on-subject.** When scaffolding a topic, place it on the
  zero-to-expert ladder: pick its `difficulty`, wire its `dependencies`, and make
  sure its prerequisites are themselves taught here.

## 🧭 Scope & boundaries

- **In scope:** what a mental model is and why a latticework beats isolated
  facts; **general thinking** (map vs. territory, first principles, thought
  experiments, Occam's & Hanlon's razors, circle of competence); **decision-making
  & judgment** (inversion, second-order thinking, opportunity cost, margin of
  safety, expected value, asymmetry); **probability & uncertainty** (base rates,
  Bayesian updating, regression to the mean, fat tails, sample size);
  **psychology & human nature** (the major cognitive biases, incentives,
  social proof, commitment & consistency); **systems thinking** (feedback loops,
  bottlenecks, stocks & flows, emergence, leverage points); **economics &
  markets** (supply & demand, opportunity cost, comparative advantage,
  externalities, tragedy of the commons); **physics, math & engineering models**
  (critical mass, leverage, equilibrium, margin of safety, compounding,
  algorithms); **biology & evolution** (natural selection, adaptation, ecosystems,
  the Red Queen effect); and **strategy & competition** (game theory, moats,
  comparative advantage). The driving canon is the broad, cross-disciplinary
  latticework popularized by Charlie Munger, Farnam Street, and the practitioners
  who use these tools.
- **Out of scope:** generic self-help / motivation, pop-psychology "life hacks"
  with no model behind them, productivity-app tutorials, partisan politics,
  individual stock tips or financial advice, clinical psychology / therapy, and
  pure academic philosophy for its own sake. Models are taught as *usable thinking
  tools*, not as branded productivity content or as a substitute for professional
  advice.

## 🧱 Difficulty ladder (what each tier means *for this subject*)

| Tier | Means here |
|---|---|
| `beginner` | Assumes **no prior knowledge**. Teaches what a mental model *is* and the handful of foundational models everything else builds on (map vs. territory, first principles, inversion). Defines every term. |
| `intermediate` | Assumes the foundations. Working single models applied to real decisions — second-order thinking, opportunity cost, base rates, key cognitive biases, incentives. |
| `advanced` | Assumes the intermediate ladder. Systems & feedback, probability done quantitatively (Bayesian updating, fat tails), game theory, models that interact across domains. |
| `expert` | The deepest tier. Combining many models into one judgment, where each model **fails**, calibration, decision-making under deep uncertainty, and the meta-skill of choosing which model fits a novel situation. |

## 🏷️ Tag taxonomy (learning paths / roadmaps)

The home page renders **roadmaps** — curated learning paths that are just the
catalog pre-filtered by a tag. These are the **principal categories of mental
models**. Defined in `src/lib/roadmap-meta.ts`; every topic lists its tags in
frontmatter.

- `foundations` — **Foundations** — what a mental model is, the latticework, and
  the base models everything composes from (map vs. territory, first principles).
- `decision-making` — **Decision-Making & Judgment** — choosing well: inversion,
  second-order thinking, opportunity cost, margin of safety, expected value.
- `probability` — **Probability & Uncertainty** — thinking in odds: base rates,
  Bayesian updating, regression to the mean, fat tails, sample size.
- `psychology` — **Human Nature & Bias** — how minds misfire: the major cognitive
  biases, incentives, social proof, commitment & consistency.
- `systems-thinking` — **Systems & Feedback** — wholes over parts: feedback
  loops, stocks & flows, bottlenecks, emergence, leverage points.
- `economics` — **Economics & Markets** — incentives at scale: supply & demand,
  comparative advantage, externalities, tragedy of the commons.
- `problem-solving` — **Problem-Solving** — cracking hard problems: first
  principles, inversion, thought experiments, Occam's & Hanlon's razors.
- `science-engineering` — **Science & Engineering** — borrowed from the hard
  sciences: critical mass, equilibrium, leverage, compounding, algorithms.
- `biology-evolution` — **Biology & Evolution** — models from life itself:
  natural selection, adaptation, ecosystems & niches, the Red Queen effect.
- `strategy` — **Strategy & Competition** — winning games: game theory, moats,
  comparative advantage, the Red Queen effect.

## 🗣️ Voice

Clear first, then engaging. Each model is a tool the reader will *use*, so teach
for transfer: lead with a vivid analogy, give the precise definition and its home
discipline, walk at least one concrete worked example, then name the failure mode
("where this model lies to you"). Lightly witty, never dry, never mystical —
no "unlock your potential" self-help register. Name-check the model explicitly
(bold on first use) so the reader builds a vocabulary. When a model is
quantitative (expected value, base rates, compounding), show the actual numbers.

## 🌍 Languages

Every lesson ships an **English** source and a **peninsular-Spanish (es-ES)**
twin in parity. Keep the model's canonical English name in parentheses on first
use in Spanish lessons (e.g. *"el coste de oportunidad (opportunity cost)"*) so
the reader can follow the wider literature. If you want different/more locales,
change `astro.config.mjs` (`i18n.locales`), `src/i18n/ui.ts`, and the
`translate-lesson` skill.
