# Mental Models — Design System

The visual language for the site: a bold, **orange, brutalist, light-first**
learning surface — hard black offset shadows, sharp edges, warm neutrals and
high-contrast type. Everything below maps to tokens defined once in
[`src/styles/global.css`](src/styles/global.css) (the Tailwind v4 `@theme`
block). Reference them with Tailwind utilities — never hard-code hex values.

> **This palette is re-themeable.** The orange brutalist theme below is what the
> site ships with; it can be re-themed by editing the `@theme` block in
> [`src/styles/global.css`](src/styles/global.css) (the `brand-*` / `accent-*`
> ramps, the shadow/radius tokens, and `themeColor` in `src/lib/site.ts`). The
> structure, tokens, accessibility rules and component contracts below are
> subject-agnostic and stay the same whatever accent you choose — keep this file
> in sync with the tokens if you re-theme.

---

## Philosophy

- **Orange is the brand.** A hot orange carries identity, action and focus; an
  amber accent adds energy in gradients and highlights. Color is loud on
  purpose — this is a confident, dynamic surface, not a calm one.
- **Brutalist, not soft.** Edges are sharp (small radii), elevation is a **hard
  black offset shadow** with no blur, and contrast is high. Structure reads as
  solid blocks rather than floating cards.
- **Light first, warm.** Surfaces are near-white with a faint warm tint; ink is
  a warm stone neutral that bottoms out at a near-black for headings.
- **Motion with snap.** Fade/float animations stay, always respecting
  `prefers-reduced-motion`, but the resting look is bold and grounded.
- **Readable above all.** Display type for headings, a humanist sans for body,
  measured line length for long-form lessons.

---

## Tokens

### Color

Generated as `bg-*`, `text-*`, `border-*`, `ring-*`, `from-*`/`to-*`, etc.

**Brand (orange) — primary action & identity**

| Token | Hex | Typical use |
| --- | --- | --- |
| `brand-50` | `#fff7ed` | tints, subtle fills |
| `brand-100` | `#ffedd5` | selection bg, chips |
| `brand-200` | `#fed7aa` | hover tints |
| `brand-300` | `#fdba74` | gradient stops |
| `brand-400` | `#fb923c` | gradient stops, glows |
| `brand-500` | `#f97316` | **primary**, focus ring |
| `brand-600` | `#ea580c` | **primary-strong**, default buttons, links |
| `brand-700` | `#c2410c` | link hover, active nav |
| `brand-800` | `#9a3412` | deep gradient stops |
| `brand-900` | `#7c2d12` | strongest orange |
| `brand-950` | `#431407` | rare, max contrast |

**Accent (amber) — highlights & gradients**

| Token | Hex |
| --- | --- |
| `accent-300` | `#fcd34d` |
| `accent-400` | `#fbbf24` |
| `accent-500` | `#f59e0b` |
| `accent-600` | `#d97706` |

**Ink — text & warm neutrals**

| Token | Hex | Use |
| --- | --- | --- |
| `ink-50` | `#fafaf9` | — |
| `ink-100` | `#f5f5f4` | dark-surface text |
| `ink-200` | `#e7e5e4` | borders, dividers |
| `ink-300` | `#d6d3d1` | disabled borders |
| `ink-400` | `#a8a29e` | placeholder |
| `ink-500` | `#78716c` | muted labels |
| `ink-600` | `#57534e` | secondary text |
| `ink-700` | `#44403c` | **body text** |
| `ink-800` | `#292524` | headings |
| `ink-900` | `#1c1917` | **strong headings — brutalist near-black** |

**Surfaces (light-first, warm)**

| Token | Hex | Use |
| --- | --- | --- |
| `surface` | `#ffffff` | cards |
| `surface-muted` | `#fffaf4` | page background (warm white) |
| `surface-sunken` | `#fff1e0` | wells, inline code, hover wells |

Use as `bg-surface`, `bg-surface-muted`, `bg-surface-sunken`.

**Semantic states**: `success` `#15803d`, `warning` `#b45309`,
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
| `rounded-card` | `0.25rem` | cards, panels, code blocks (sharp, brutalist) |
| `rounded-pill` | `999px` | nav links, chips, buttons, toggles |

### Shadows (brutalist — hard black offset, no blur)

| Token | Value | Use |
| --- | --- | --- |
| `shadow-soft` | `3px 3px 0 0 #1c1917` | resting cards, chips |
| `shadow-lift` | `6px 6px 0 0 #1c1917` | hover/elevated state |

The offset grows on hover (`soft` → `lift`) for a tactile "lift off the page"
brutalist feel. The shadow is solid near-black — no blur, no tint.

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
  surfaces meet WCAG AA. On the orange OG cards, text is white/`accent-300` on
  deep orange (`brand-800`/`brand-900`) for strong contrast.
- **Meaningful structure.** Lead with semantic HTML; headings use
  `text-wrap: balance` for tidy wrapping.

---

## Open Graph cards

Social share images reuse these exact tokens — see the card template at
`src/pages/og/_OgCard.astro` (orange `brand→accent` gradient, `font-display`
title, `font-mono` domain, `shadow-lift` logo chip). The generation pipeline
is documented in the [README](README.md#-seo--open-graph).
