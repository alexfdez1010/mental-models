# Lessons Template — Design System

The visual language for the template: a calm, **blue-forward, light-first**
learning surface. Everything below maps to tokens defined once in
[`src/styles/global.css`](src/styles/global.css) (the Tailwind v4 `@theme`
block). Reference them with Tailwind utilities — never hard-code hex values.

> **This palette is the default, not a constraint.** The blue-forward theme
> below is what the template ships with; it is fully **re-themeable per subject**
> by editing the `@theme` block in [`src/styles/global.css`](src/styles/global.css)
> (the `brand-*` / `accent-*` ramps and `themeColor` in `src/lib/site.ts`). The
> `bootstrap-topic` skill can do this for you when you adopt the template. The
> structure, tokens, accessibility rules and component contracts below are
> subject-agnostic and stay the same whatever accent you choose — keep this file
> in sync with the tokens if you re-theme.

---

## Philosophy

- **Blue is the brand.** Blue carries identity, action and focus; sky-blue
  accents add lift in gradients and highlights. Color is used purposefully,
  not decoratively.
- **Light first.** Surfaces are near-white with a faint blue tint; ink is a
  cool, slightly blue-tinted neutral. High contrast for body text, generous
  whitespace, soft blue-tinted shadows instead of hard borders.
- **Quiet motion.** Subtle fade/float animations that always respect
  `prefers-reduced-motion`.
- **Readable above all.** Display type for headings, a humanist sans for body,
  measured line length for long-form lessons.

---

## Tokens

### Color

Generated as `bg-*`, `text-*`, `border-*`, `ring-*`, `from-*`/`to-*`, etc.

**Brand (blue) — primary action & identity**

| Token | Hex | Typical use |
| --- | --- | --- |
| `brand-50` | `#eff6ff` | tints, subtle fills |
| `brand-100` | `#dbeafe` | selection bg, chips |
| `brand-200` | `#bfdbfe` | hover tints |
| `brand-300` | `#93c5fd` | gradient stops |
| `brand-400` | `#60a5fa` | gradient stops, glows |
| `brand-500` | `#3b82f6` | **primary**, focus ring |
| `brand-600` | `#2563eb` | **primary-strong**, default buttons, links |
| `brand-700` | `#1d4ed8` | link hover, active nav |
| `brand-800` | `#1e40af` | deep gradient stops |
| `brand-900` | `#1e3a8a` | strongest blue |
| `brand-950` | `#172554` | rare, max contrast |

**Accent (sky) — highlights & gradients**

| Token | Hex |
| --- | --- |
| `accent-300` | `#7dd3fc` |
| `accent-400` | `#38bdf8` |
| `accent-500` | `#0ea5e9` |
| `accent-600` | `#0284c7` |

**Ink — text & cool neutrals**

| Token | Hex | Use |
| --- | --- | --- |
| `ink-50` | `#f8fafc` | — |
| `ink-100` | `#f1f5f9` | dark-surface text |
| `ink-200` | `#e2e8f0` | borders, dividers |
| `ink-300` | `#cbd5e1` | disabled borders |
| `ink-400` | `#94a3b8` | placeholder |
| `ink-500` | `#64748b` | muted labels |
| `ink-600` | `#475569` | secondary text |
| `ink-700` | `#334155` | **body text** |
| `ink-800` | `#1e293b` | headings |
| `ink-900` | `#0f172a` | **strong headings** |

**Surfaces (light-first)**

| Token | Hex | Use |
| --- | --- | --- |
| `surface` | `#ffffff` | cards |
| `surface-muted` | `#f6f9ff` | page background (blue-tinted white) |
| `surface-sunken` | `#eef4ff` | wells, inline code, hover wells |

Use as `bg-surface`, `bg-surface-muted`, `bg-surface-sunken`.

**Semantic states**: `success` `#16a34a`, `warning` `#d97706`,
`danger` `#dc2626` (e.g. `text-success`, `bg-danger`).

### Typography

| Token | Stack | Use |
| --- | --- | --- |
| `font-sans` | Inter Variable → system | body, UI |
| `font-display` | Lexend Variable → Inter | headings, wordmark, hero |
| `font-mono` | SF Mono / JetBrains Mono | code, the domain on OG cards |

Headings (`h1`–`h4`) automatically use `font-display`, `ink-900`,
`-0.02em` tracking and `text-wrap: balance` via the base layer. Body inherits
`font-sans` + `ink-700`. Fonts are self-hosted via `@fontsource-variable`.

### Radii

| Token | Value | Utility |
| --- | --- | --- |
| `rounded-card` | `1rem` | cards, panels, code blocks |
| `rounded-pill` | `999px` | nav links, chips, buttons, toggles |

### Shadows (soft, blue-tinted)

| Token | Use |
| --- | --- |
| `shadow-soft` | resting cards, chips |
| `shadow-lift` | hover/elevated state |

### Animations

| Token | Effect |
| --- | --- |
| `animate-fade-up` | one-shot fade + 16px rise (`fade-up`, 0.6s ease-out) |
| `animate-float` | gentle 6s vertical bob (decorative only) |

Both are gated globally by `prefers-reduced-motion: reduce` (see Accessibility).

---

## Long-form lesson prose

Wrap an MDX lesson body in `<div class="prose-lesson">`. The
`.prose-lesson` component class (in `global.css`) sets a `68ch` measure,
`1.75` line-height, vertical rhythm, and styles headings, links, inline
`code`, `pre` blocks (dark, `rounded-card`), lists and blockquotes
(blue left-border). Prefer this single class over per-element utilities for
authored content.

---

## Component inventory (React islands)

All live in `src/components/react/` and are re-exported from
`@/components/react`. In MDX they hydrate as islands — pick a client directive
(`client:load` / `client:visible` / `client:idle`). Every component accepts a
`className` for token-based overrides.

### Callout

Colored info box. `variant`: `info` (default, brand) | `success` | `warning` |
`tip`; optional `title`.

```mdx
import { Callout } from '@/components/react';

<Callout variant="tip" title="Heads up" client:visible>
  Define every term on first use — a beginner lesson assumes no prior knowledge.
</Callout>
```

### MCQ

Single multiple-choice question. `question`, `options[]`
(`{ text, correct? }`), optional `explanation`, `allowMultiple`,
`checkLabel`/`retryLabel`. Check turns correct picks green, wrong picks red;
keyboard + `aria-live` accessible.

```mdx
import { MCQ } from '@/components/react';

<MCQ
  client:visible
  question="Which of these is the correct answer?"
  options={[
    { text: 'The correct option', correct: true },
    { text: 'A plausible distractor' },
    { text: 'Another distractor' },
  ]}
  explanation="Explain *why* the right answer is right — the explanation is the teaching."
/>
```

### Quiz

Sequential set of MCQs with a progress bar, Back/Next gating and a final
score screen. `title?`, `questions: MCQProps[]`, plus forwarded/label props
(`questionLabel`, `ofLabel`, `nextLabel`, `backLabel`, `scoreLabel`,
`restartLabel`, `checkLabel`, `retryLabel`).

```mdx
import { Quiz } from '@/components/react';

<Quiz
  client:visible
  title="Check your understanding"
  questions={[
    { question: 'Q1…', options: [{ text: 'A', correct: true }, { text: 'B' }] },
    { question: 'Q2…', options: [{ text: 'A' }, { text: 'B', correct: true }] },
  ]}
/>
```

### Reveal

Scroll-triggered fade/slide-in wrapper (`IntersectionObserver`, fires once).
`as?` (wrapper tag), `delay?` (ms). Shows content immediately under reduced
motion. Best with `client:visible`.

```mdx
import { Reveal } from '@/components/react';

<Reveal delay={120} client:visible>
  <img src="/diagrams/example.svg" alt="A diagram that supports the lesson" />
</Reveal>
```

### FillBlank

Pick-one-of-three cloze exercise. Mark blanks in `text` with
`{{correct|distractor|distractor}}` — pipe-separated choices where the first is
correct; options are shuffled with a stable, content-seeded order. Throws at
build time if a blank has fewer than two choices or `text` has no blanks. Grades
per blank on **Check**. i18n props: `checkLabel`, `retryLabel`,
`explanationLabel`, `instructions`.

```mdx
import { FillBlank } from '@/components/react';

<FillBlank
  client:visible
  question="Pick the right term for each blank."
  text="The {{correct|distractor|distractor}} term goes here, and the {{answer|distractor|distractor}} goes there."
  explanation="A one-line recap of the rule the blanks test."
/>
```

### MatchConcepts

Match a column of concepts to their definitions. `pairs: { concept, definition }[]`
(shuffled with a stable, content-seeded order); grades on **Check**, pairs colour
green/red. i18n props: `checkLabel`, `retryLabel`, `instructions`.

```mdx
import { MatchConcepts } from '@/components/react';

<MatchConcepts
  client:visible
  pairs={[
    { concept: 'Term A', definition: 'What term A means' },
    { concept: 'Term B', definition: 'What term B means' },
  ]}
/>
```

### The rest of the kit

The barrel `@/components/react` also exports — all **topic-agnostic** and
documented inline:

- **Assessment:** `FinalExam` (a graded, end-of-course exam).
- **Exercises:** `Categorize` (sort items into buckets), `FillBlank`,
  `MatchConcepts` (above).
- **Presentation:** `MindMap` (a branching concept map).
- **Structure / progress:** `CourseGraph` (the roadmap dependency graph),
  `LessonComplete`, `CourseComplete`, `ProgressTransfer`.

These are the generic building blocks every subject reuses. Author *subject-specific*
chart/animation islands as their own files and add them to the barrel — see the
`exercise-components` and `lesson-animations` skills.

---

## Accessibility & reduced motion

- **Reduced motion is global.** `@media (prefers-reduced-motion: reduce)`
  in the base layer near-zeros all animation/transition durations and disables
  smooth scrolling. Interactive islands (e.g. `Reveal`) also check
  `matchMedia` and render final state immediately.
- **Focus is always visible.** `:focus-visible` shows a 2px `brand-500`
  outline with offset; never remove it.
- **Selection** uses `brand-200` on `brand-900` for on-brand contrast.
- **Color is never the only signal.** Quiz/MCQ states pair color with
  icons, text and `aria-live` announcements; options are real `<input>`s so
  keyboard and screen-reader semantics are native.
- **Contrast.** Body text (`ink-700`) and headings (`ink-900`) on light
  surfaces meet WCAG AA. On the blue OG cards, text is white/`accent-300` on
  deep blue for strong contrast.
- **Meaningful structure.** Lead with semantic HTML; headings use
  `text-wrap: balance` for tidy wrapping.

---

## Open Graph cards

Social share images reuse these exact tokens — see the card template at
`src/pages/og/_OgCard.astro` (blue `brand→accent` gradient, `font-display`
title, `font-mono` domain, `shadow-lift` logo chip). The generation pipeline
is documented in the [README](README.md#-seo--open-graph).
