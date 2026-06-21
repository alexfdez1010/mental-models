# Mental Models — Design System

The visual language for the site: **quiet latticework** — refined, editorial,
light-first minimalism. Warm paper surfaces, a characterful Fraunces serif for
display, a single restrained amber accent, hairline edges and soft diffused
shadows. Everything below maps to tokens defined once in
[`src/styles/global.css`](src/styles/global.css) (the Tailwind v4 `@theme`
block). Reference them with Tailwind utilities — never hard-code hex values.

> **This palette is re-themeable.** The warm-amber minimalist theme below is what
> the site ships with; it can be re-themed by editing the `@theme` block in
> [`src/styles/global.css`](src/styles/global.css) (the `brand-*` / `accent-*`
> ramps, the shadow/radius tokens, and `themeColor` in `src/lib/site.ts`). The
> structure, tokens, accessibility rules and component contracts below are
> subject-agnostic and stay the same whatever accent you choose — keep this file
> in sync with the tokens if you re-theme.

---

## Philosophy

- **Restraint is the brand.** A muted amber carries identity, action and focus,
  used *sparingly* against paper and ink. Color is quiet on purpose — most of the
  page is calm warm neutral, with the accent reserved for the few marks that
  matter. Mental clarity, not visual noise.
- **Soft, not brutalist.** Edges are hairline (`1px`, low-contrast warm grey),
  elevation is a **soft diffused shadow**, and corners are gently rounded.
  Surfaces float quietly off the paper rather than slamming onto it.
- **Light first, warm paper.** Surfaces are near-white with a faint warm tint;
  ink is a warm stone neutral that bottoms out at a warm near-black for headings.
- **Motion that breathes.** Fade/float/drift animations are slow and gentle,
  always respecting `prefers-reduced-motion`. The hero carries a full-bleed
  *latticework* — a drifting knowledge graph of connected ideas (Munger's
  "latticework of mental models"), spanning the whole viewport width.
- **Readable above all.** A serif display for headings, a humanist sans for body,
  measured line length for long-form lessons.

---

## Tokens

### Color

Generated as `bg-*`, `text-*`, `border-*`, `ring-*`, `from-*`/`to-*`, etc.

**Brand (muted amber) — primary action & identity (use sparingly)**

| Token | Hex | Typical use |
| --- | --- | --- |
| `brand-50` | `#fdf8f3` | tints, subtle fills |
| `brand-100` | `#faf0e6` | selection bg, chips |
| `brand-200` | `#f3dcc4` | hover tints, gradient stops |
| `brand-300` | `#e9c19b` | gradient stops, glows |
| `brand-400` | `#dca06a` | gradient stops, lattice strokes |
| `brand-500` | `#cf8443` | **primary**, focus ring |
| `brand-600` | `#b96c2c` | **primary-strong**, default buttons, links |
| `brand-700` | `#985623` | link hover, active nav |
| `brand-800` | `#79451f` | deep gradient stops |
| `brand-900` | `#623a1d` | strongest amber |
| `brand-950` | `#361d0e` | rare, max contrast |

**Accent (soft sun) — highlights & gradients**

| Token | Hex |
| --- | --- |
| `accent-300` | `#f4d9a8` |
| `accent-400` | `#ecc178` |
| `accent-500` | `#e0a44c` |
| `accent-600` | `#c5852f` |

**Ink — text & warm neutrals**

| Token | Hex | Use |
| --- | --- | --- |
| `ink-50` | `#faf9f7` | — |
| `ink-100` | `#f4f2ee` | dark-surface text |
| `ink-200` | `#e8e4dd` | borders, dividers |
| `ink-300` | `#d4cec4` | disabled borders, lattice dots |
| `ink-400` | `#a8a097` | placeholder |
| `ink-500` | `#786f66` | muted labels |
| `ink-600` | `#564f48` | secondary text |
| `ink-700` | `#3d3833` | **body text** |
| `ink-800` | `#262220` | headings |
| `ink-900` | `#1a1714` | **strong headings — warm near-black** |

**Surfaces (light-first, warm paper)**

| Token | Hex | Use |
| --- | --- | --- |
| `surface` | `#ffffff` | cards |
| `surface-muted` | `#faf7f2` | page background (warm paper) |
| `surface-sunken` | `#f4efe7` | wells, inline code, hover wells |

Use as `bg-surface`, `bg-surface-muted`, `bg-surface-sunken`.

**Semantic states**: `success` `#2f7d4f`, `warning` `#b07a2a`,
`danger` `#c0413a` (e.g. `text-success`, `bg-danger`).

### Typography

| Token | Stack | Use |
| --- | --- | --- |
| `font-sans` | Inter Variable → system | body, UI |
| `font-display` | Fraunces Variable → serif | headings, wordmark, hero (editorial serif) |
| `font-mono` | SF Mono / JetBrains Mono | code, the domain on OG cards |

Headings (`h1`–`h4`) automatically use `font-display`, `ink-900`,
`-0.011em` tracking, optical sizing (`opsz`/`SOFT` axes) and `text-wrap: balance`
via the base layer. Body inherits `font-sans` + `ink-700`. Fonts are self-hosted
via `@fontsource-variable`.

### Border (the hairline edge)

| Token | Value | Use |
| --- | --- | --- |
| `edge` | `#e8e4dd` | the quiet hairline on every block: `border-edge`, `bg-edge`, `text-edge` |
| `edge-strong` | `#d4cec4` | slightly firmer divider / hover border |

Every solid block wears a **1px `edge` hairline**; on hover, interactive blocks
firm up to `edge-strong`. Soft, low-contrast — the surface is defined by light,
not a hard outline.

### Radii

| Token | Value | Utility |
| --- | --- | --- |
| `rounded-card` | `0.875rem` | cards, panels, code blocks (gently rounded) |
| `rounded-pill` | `999px` | nav links, chips, buttons, toggles |

### Shadows (soft, diffused, warm)

A four-step ladder; the surface lifts further off the paper as it rises.

| Token | Value | Use |
| --- | --- | --- |
| `shadow-xs` | `0 1px 2px rgba(26,23,20,.05)` | chips, pills, inputs, inline badges |
| `shadow-soft` | `0 1px 2px /.04 + 0 6px 18px -10px /.16` | resting cards, buttons |
| `shadow-lift` | `0 2px 6px /.05 + 0 16px 34px -14px /.22` | hover / elevated state |
| `shadow-pop` | `0 4px 12px /.06 + 0 30px 60px -24px /.28` | hero card, CTA, focal blocks |

Shadows are soft and warm-tinted (warm near-black at low opacity) — diffuse, no
hard edges.

### Building-block classes

Prefer these over re-typing the border + shadow recipe. Compose with Tailwind
utilities for color/padding/layout (see `@layer components` in `global.css`).
The class names keep the legacy `.brutal*` prefix so every call site re-skins
centrally, but the look is now soft minimalism, not brutalism.

| Class | What it is |
| --- | --- |
| `.brutal` | 1px `edge` hairline + `rounded-card` + `shadow-soft` — the default card/panel/well |
| `.brutal-lg` | same hairline, `shadow-pop` — hero / focal / CTA blocks |
| `.brutal-interactive` | add to a **clickable** `.brutal`/`.brutal-lg`: hover rises gently (`translateY`, shadow blooms, edge firms), active settles back. Don't pair with `hover:-translate-*`/`hover:shadow-*`. |
| `.brutal-btn` | pill button — clean fill, no hard edge, `shadow-soft` that blooms on hover. Pair with `bg-* text-*` (e.g. `brutal-btn bg-brand-600 text-white px-7 py-3`). |
| `.brutal-chip` | small pill/tag/filter — hairline + `shadow-xs`, gentle hover lift. Pair with `bg-*`/`text-*`. |

All transforms are transitions only (never reflow) and are neutralised by the
global `prefers-reduced-motion` rule.

### Animations

| Token | Effect |
| --- | --- |
| `animate-fade-up` | one-shot fade + 16px rise (`fade-up`, 0.6s ease-out) |
| `animate-float` | gentle 6s vertical bob (decorative only) |
| `animate-drift` | slow 24s parallax drift + faint scale — the hero latticework field |

The hero latticework also uses a `.lattice-node` pulse (staggered opacity breathe).
All are gated globally by `prefers-reduced-motion: reduce` (see Accessibility).

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
  surfaces meet WCAG AA. On the amber OG cards, text is white/`accent-300` on
  deep amber (`brand-800`/`brand-900`) for strong contrast.
- **Meaningful structure.** Lead with semantic HTML; headings use
  `text-wrap: balance` for tidy wrapping.

---

## Open Graph cards

Social share images reuse these exact tokens — see the card template at
`src/pages/og/_OgCard.astro` (amber `brand→accent` gradient, `font-display`
title, `font-mono` domain, `shadow-lift` logo chip). The generation pipeline
is documented in the [README](README.md#-seo--open-graph).
