---
name: categorize-quiz-prop-pitfalls
description: Two recurring MDX authoring bugs that break the build — Categorize uses buckets/bucket (not categories/category), and Quiz must use questions={[...]} not child <MCQ> elements.
metadata:
  type: feedback
---

Two build-breaking prop mistakes agents keep making when authoring lessons; sweep new
lessons for both.

1. **`Categorize` props are `buckets={[...]}` + items with `bucket: "..."`** — NOT
   `categories=` / `category:`. `buckets` is required; if it's absent (because the author
   wrote `categories`), the component throws at SSR/prerender → red build. Every item's
   `bucket` must exactly match a declared `buckets` entry.

2. **`Quiz` must receive its questions via the `questions={[...]}` expression prop**, NOT as
   child `<MCQ client:visible>` elements. Every existing lesson uses the prop form. Nested
   `<MCQ client:visible>` children under a hydrated `<Quiz client:visible>` become separate
   Astro islands, so the Quiz can't read their props → renders an empty/broken quiz. Put
   `checkLabel`/`retryLabel`/`correctLabel`/`incorrectLabel`/`correctAnswerLabel`/
   `explanationLabel` on the `<Quiz>` (it forwards them to each MCQ); the array items carry
   only `question`/`options`/`explanation`.

**Why:** both pass a casual eye but fail `bun run pre-commit`. **How to apply:** after any
lesson is authored (esp. by a subagent), grep for `categories={`/`category: ` and for
`<Quiz` without `questions=`. Related island-prop trap: [[no-katex-in-island-props]].
