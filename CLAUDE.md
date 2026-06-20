# Lessons Template — project guide

Interactive, animated, **bilingual (en/es)** educational webpages. Each *topic* is taught
across multiple slug-based pages, with reusable interactive exercises (quizzes, matchers,
reveals) and a strong SEO + Open Graph pipeline. Built to deploy on Vercel as a static site.

This is a **topic-agnostic template**: the same machine that powered a finance site can teach
*any* subject. What it teaches is configured in one place — **`TOPIC.md`** — not hard-coded.

## 🚀 First: read `TOPIC.md` (the subject)

**[`TOPIC.md`](TOPIC.md) is the single source of truth for *what* this site teaches** — the
subject, the zero-to-expert mission, the scope, the tag taxonomy and the voice. Read it before
doing anything else; every authoring decision serves the arc it describes. If `TOPIC.md` still
contains placeholder text, the site has not been adopted yet — run the **`bootstrap-topic`**
skill (it interactively sets the subject, design accent, starter build queue, and example
content, then deletes itself).

The mission, generically, is always the same shape:

- **Assume zero background.** A `beginner`-tier lesson must not lean on any term it hasn't
  defined. Define jargon on first use.
- **Build a ladder, not islands.** Order courses so each only needs what came before it. Use
  the topic `dependencies` array to encode the path and `difficulty`
  (`beginner` → `intermediate` → `advanced` → `expert`) to label how far up a course sits.
- **End at genuine expertise.** `expert`-tier content goes all the way — rigorous,
  edge-case, practitioner-grade. Don't stop at "intro".
- **New courses stay on-subject.** Place each new topic on the ladder: pick its `difficulty`,
  wire its `dependencies`, ensure its prerequisites are themselves taught here. The exact
  scope lives in `TOPIC.md`.

## ⚡ Work in parallel — prioritize multiple agents

This codebase has lots of independent, parallelizable work (a lesson + its `es`
twin, multiple lessons in a topic, research + components + copy). **Prefer
fanning the work out across several subagents** instead of doing it all
sequentially — it's much faster.

- Spawn parallel `Agent`s (or a `Workflow` when the user opts in) for independent
  units: e.g. one agent per lesson, en/es twins in parallel, research vs.
  component-building vs. copywriting concurrently.
- Send independent agent calls in a **single message** so they run at once.
- Reserve sequential work for genuinely dependent steps (research → write →
  translate). Translation depends on the finished source; everything upstream of it
  can parallelize.
- Each Spanish twin is **es-ES (Spain / Castilian)** — see `translate-lesson`.

## 📚 Go exhaustive — depth is the default for lessons

When asked to build, expand, or "go more exhaustive/extensive/in depth" on a
lesson, **bias hard toward thoroughness, not brevity**. A lesson is a teaching
artifact, not a summary — err on the side of *too much* over *too little*.

- **Cover every sub-idea.** Each concept gets its **own `##` section** with: an
  intuitive analogy, the precise definition/formula, **at least one fully worked
  example**, a common misconception/pitfall, and a `### When to use it` or
  trade-off note.
- **Graphs and visuals everywhere.** Every quantitative relationship, process, or
  transformation gets a **chart/animation island** beside its explanation. Don't
  ship a lesson with only one visual; build new reusable SVG/Canvas islands when
  none fit (design tokens, `prefers-reduced-motion`, locale-agnostic string props).
- **Worked examples + tables.** Use Markdown tables to compare options
  side-by-side and step through real numbers. Multiple examples per concept.
- **Interaction density still applies** (pretest → explain → check, rotate
  types, spaced recall, MindMap + Quiz recap) — exhaustiveness *adds* to it,
  never replaces it.
- **Vary the questions, not just the components.** Across a question set, mix the
  *type of ask* (numeric, scenario, which-is-true, spot-the-trap, definition,
  comparison, cause→effect), the *stem wording*, and the difficulty. If two
  questions feel interchangeable, rewrite one. See `exercise-components`.
- **Final exams use the `FinalExam` island, presented directly.** A course's
  `final-exam` lesson is a graded, **irreversible** run on a 20–30 MCQ pool: one
  question at a time, submitting locks the answer for good (no Back, no retry, no
  Restart), and the pass/fail score shows only at the end. See `new-lesson` /
  `exercise-components`.
- **Parallelize the depth**: fan one agent per chart component, per section
  draft, and per locale so going deep doesn't mean going slow.

## ⚡ Work in parallel — prioritize multiple agents (use them aggressively)

Going exhaustive multiplies the independent work — so **fan it out across many
subagents by default**, in a single message, rather than sequentially.

- One agent per **new chart/animation component**, run concurrently — but each
  agent only **creates its own file**; never let parallel agents edit the shared
  barrel `src/components/react/index.ts` (race). Wire the barrel centrally afterward.
- One agent per **section draft**, per **lesson**, per **locale twin**.
- Send all independent agent calls in **one message** so they run at once.
- Reserve sequential work for genuinely dependent steps (research → write →
  translate; build components → then author the MDX that imports them).

## Stack

- **Astro 6** (static output, `@astrojs/vercel` adapter) — fast, SEO-friendly rendering.
- **React 19** islands for all interactivity/animation (hydrated with `client:visible`).
- **Tailwind CSS v4** (via `@tailwindcss/vite`) — design tokens in `src/styles/global.css`.
- **MDX** content collections for lessons/topics.
- **Bun** is the runtime + package manager. Use `bun` / `bunx`, never npm/pnpm/yarn.
- **Playwright** generates OG share images from rendered pages.
- **KaTeX** renders `$…$`/`$$…$$` math in MDX (handy for any quantitative subject;
  harmless if yours has no math).

## ⚠️ Import alias — ALWAYS use `@`

Every import of a file under `src/` MUST use the `@` alias (`@` = `src/`). Never use
relative `../` paths. Configured in `tsconfig.json` (`paths: { "@/*": ["src/*"] }`).

```ts
import BaseLayout from '@/layouts/BaseLayout.astro';
import { MCQ, Quiz } from '@/components/react';
import { useTranslations, localizePath } from '@/i18n/utils';
```

Exceptions: `astro.config.mjs` and files under `scripts/` live outside `src/` and use
relative/node imports.

## Directory map

```
TOPIC.md          # WHAT this site teaches — subject, mission, scope (read first)
src/
  components/
    react/        # Reusable interactive islands. Generic kit: MCQ, Quiz, FinalExam,
                  # Callout, Reveal, FillBlank, MatchConcepts, Categorize, MindMap,
                  # CourseGraph, LessonComplete, CourseComplete. Barrel: index.ts.
                  # Add subject-specific chart/animation islands here.
    seo/Seo.astro # All <head> meta: title, OG, Twitter, hreflang, JSON-LD
    ui/           # Header, Footer, Breadcrumbs (Astro chrome)
  content/
    topics/<lang>/<topic>.mdx           # id: "<lang>/<topic>"
    lessons/<lang>/<topic>/<lesson>.mdx # id: "<lang>/<topic>/<lesson>"
  content.config.ts                     # Collection schemas (topics, lessons)
  i18n/ui.ts, i18n/utils.ts             # Dictionaries + helpers
  layouts/BaseLayout.astro, LessonLayout.astro
  lib/site.ts                           # Brand name, social handle, SEO defaults
  lib/content.ts, lib/og.ts, lib/catalog.ts, lib/progress.ts
  lib/upcoming.ts                       # Build queue (planned, unbuilt courses)
  lib/roadmap-meta.ts                   # Tag taxonomy (learning paths)
  pages/                                # Routes (en at root, es under /es/)
  styles/global.css                     # Design tokens (@theme) — single source of truth
scripts/daily-lesson.sh                 # Autonomous cron builder (see docs/)
scripts/improve-daily-lesson.sh         # Weekly self-improvement cron job
scripts/install-cron.sh                 # One-command idempotent cron installer
scripts/generate-og.ts                  # Playwright OG screenshotter
public/og/                              # Generated OG PNGs (committed)
```

## Routing & i18n

English is the default locale served at the root (`/catalog`); Spanish is prefixed
(`/es/catalog`). Configured via Astro `i18n` (`prefixDefaultLocale: false`).

- URL scheme: `/<topic>` (topic landing) and `/<topic>/<lesson>` (lesson); `/es/...` for Spanish.
- Page chrome strings live in `src/i18n/ui.ts` — add a key to **both** locales.
- In `.astro` files: `const lang = getLangFromUrl(Astro.url); const t = useTranslations(lang);`
- Build links with `localizePath('/catalog', lang)` — pass **bare** paths (no locale prefix).
- Every page passes `lang` + `alternates` to the layout so `hreflang` and the header
  language switcher work. Use `src/lib/content.ts` helpers for content-page alternates.

## Build queue — planned courses (`src/lib/upcoming.ts`)

"What gets built next" is **data**, not a markdown checklist. The queue of
planned-but-unbuilt courses lives in **`src/lib/upcoming.ts`** as the
`upcomingCourses` array (pure data — no `astro:content` imports, safe to import
anywhere). The site renders it for free:

- **Catalog graph** — appended as dimmed, non-clickable **"Coming soon"** nodes,
  wired into the ladder by their `dependencies` just like built courses.
- **`/upcoming` page** (en + `/es/upcoming`) — a dedicated card list in build order.

Two operations are meant to be one-liners:

- **Add a planned course** → append an `UpcomingCourse` (slug, icon, difficulty,
  order, bilingual `title`/`description`, `dependencies`, `tags`, free-text
  `buildNotes`). It shows up everywhere immediately.
- **Graduate it to a created course** → once its topic MDX exists under
  `src/content/topics/`, **delete its entry from `upcomingCourses`**. Keep the
  planned `slug` = the eventual topic slug so graduation is clean.

The daily autonomous agent builds the **lowest-`order`** entry, then removes it;
the full agent contract lives in the header comment of `src/lib/upcoming.ts`.

## Authoring content

A topic = a subject with many lessons. To add content, create MDX under the locale folder
and set frontmatter (see schema in `src/content.config.ts`):

- Topic: `src/content/topics/en/<topic>.mdx` → `title, description, tagline?, icon, order, accent('brand'|'accent'), difficulty, dependencies[], tags[]`.
  - `difficulty` is **required by the mission**: `beginner` (assumes **no prior knowledge
    of the subject**) | `intermediate` | `advanced` | `expert` (deepest tier). It renders as
    a badge on the catalog graph. Set the **same value in the en and es twins**.
- Lesson: `src/content/lessons/en/<topic>/<lesson>.mdx` → `title, description, topic: "en/<topic>", order, minutes?, updated?`.
- Add the Spanish twins under `.../es/...` with `topic: "es/<topic>"`.
- Use `##`/`###` headings (they feed the lesson Table of Contents).
- Import interactive components from `@/components/react` and add `client:visible`
  (except `<Callout>`, which is presentational). In Spanish lessons pass the Spanish label
  props (e.g. `checkLabel`, `scoreLabel`).

The **`/new-lesson` skill** scaffolds a topic or lesson end-to-end — prefer it.
It chains the project skill suite:

- **`research-topic`** — research + sourced outline **before** writing (run first).
- **`lesson-copy`** — fun, witty, analogy-driven voice without losing accuracy.
- **`lesson-animations`** — at least one animation that *teaches* the core idea.
- **`exercise-components`** — build/reuse interactive exercises (multi-answer
  `MCQ`, `Quiz`, `MatchConcepts`, `Categorize`) as proper components.
- **`translate-lesson`** — keep the en/es twins in parity.

And, once, to adopt the template:

- **`bootstrap-topic`** — set the subject, mission, design accent, starter build
  queue, and clear the example content; then it deletes itself.

## Design system

All tokens (colors `brand-*`/`accent-*`/`ink-*`/`surface*`, fonts `font-display/sans/mono`,
`rounded-card/pill`, `shadow-soft/lift`, `animate-fade-up/float`, `.prose-lesson`) are defined
in `src/styles/global.css`'s `@theme` block and documented in **DESIGN.md**. Use Tailwind
utilities; do not hardcode hex values. The default palette is blue-forward, light-first —
re-theme it for your subject by editing the `@theme` tokens (the `bootstrap-topic` skill can
do this).

## SEO + OG image pipeline

- `Seo.astro` emits canonical, robots, Open Graph, Twitter card, `hreflang` alternates and
  JSON-LD. `BaseLayout` auto-derives each page's OG image path via `src/lib/og.ts`.
- OG images are screenshots of the rendered pages, captured by Playwright into
  `public/og/<slug>.png`. The slug convention lives in `src/lib/og.ts`.
- Regenerate with `bun run og:generate` (needs a build first) or `bun run og:build`.

## Commands

| Command | Purpose |
|---|---|
| `bun install` + `bunx playwright install chromium` | First-time setup |
| `bun run dev` | Dev server |
| `bun run build` | Static build → `dist/` (+ `.vercel/output`) |
| `bun run preview` | Preview the build |
| `bun run check` | `check:latex` + `check:island-latex` + `astro check` + `tsc --noEmit` |
| `bun run og:generate` / `og:build` | Generate OG images |
| `bun run og:changed` | OG images only for routes affected by git-changed files |
| `bun run audit` / `audit:fix` | Vuln report / `bun update` + report |
| `bun run pre-commit` | `check` + build + regenerate changed OG |

## Workflow order — implement → pre-commit → commit → push → verify deploy (AUTOMATIC)

Every change follows this order, **automatically and without being asked**. After
you finish implementing a change, run the full sequence yourself — do **not** stop
to ask "want me to commit?".

1. **Implement** the change in full.
2. Run **`bun run pre-commit`** (then `git add public/og`).
3. **Commit**.
4. **Push**.

The only time you pause is if `bun run pre-commit` fails (fix it, re-run) or the user
explicitly said not to commit. Never commit or push before the change is finished and
`bun run pre-commit` is green.

## Pre-commit (manual — no git hooks)

There are **no git hooks**. **ALWAYS run `bun run pre-commit` before every `git commit`
and `git push`** — no exceptions. After it finishes, `git add public/og` so regenerated
OG cards are included.

```bash
bun run pre-commit && git add public/og
git commit -m "…"
git push
```

It type-checks, builds, and regenerates the OG cards so committed images never drift from
the content. If it fails, fix the failure and re-run — never commit on a red pre-commit.

## Conventions

- TypeScript strict everywhere. Prefer `interface Props` in `.astro` frontmatter.
- Keep components reusable and locale-agnostic (pass user-facing strings as props).
- Accessibility is required: semantic landmarks, `aria-live` for dynamic results,
  keyboard operability, and `prefers-reduced-motion` is respected globally.
