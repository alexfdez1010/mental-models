# 📚 Lessons Template

> A **topic-agnostic, bilingual (English 🇬🇧 / Spanish 🇪🇸), zero-to-expert** interactive
> lessons template. Pick any subject, run one setup skill, and you have an animated,
> exercise-rich learning site that takes a reader from **zero knowledge to complete expert**.

🎨 **Design:** light-first, re-themeable per subject — see **[DESIGN.md](DESIGN.md)**

🤝 **Status:** ✅ **Ready to fork** — clone it, bootstrap your topic, start teaching.

---

## ✨ Overview

**Lessons Template** is the reusable skeleton behind a zero-to-expert education site —
without any subject baked in. You bring the subject; the template brings the structure:
a slug-based catalog ordered into a learning path, MDX content authored in two languages,
a kit of reusable interactive React islands, SEO/Open-Graph generation, and an autonomous
cron builder that keeps writing courses for you.

What you get out of the box:

- 🎯 **Zero-to-expert path** — courses carry a `difficulty` tier (`beginner` → `expert`)
  and `dependencies`, plotted on the catalog as a roadmap.sh-style graph so the learning
  order is obvious. Beginner tiers assume **no background in the subject at all**.
- 🧠 **Teach-first content** — clear copy, worked examples, and animations that explain.
- 🌍 **Fully bilingual** — every lesson ships an English source and a peninsular-Spanish (es-ES) twin in parity.
- 🧩 **Reusable islands** — interactive React components you drop into MDX with one directive.
- 🔍 **SEO + Open Graph baked in** — canonical URLs, `hreflang`, JSON-LD, and auto-generated share images.
- 🤖 **Autonomous builder** — an optional cron job that researches, writes, validates and commits the next course.
- ⚡ **Static & fast** — Astro static output deployed on Vercel.

The template ships a tiny placeholder example topic — **"Getting Started"** (2 lessons,
en + es) — so it builds and renders out of the box. The `bootstrap-topic` skill removes it
when you adopt the template.

---

## 🚀 Quickstart

The **first** thing you do is bootstrap the template to your subject. Everything — the
catalog, the cron builder, every authoring skill — reads the subject from a single source
of truth, so this one step adapts the whole site.

```sh
git clone <your-fork-url> my-lessons && cd my-lessons
bun install
bunx playwright install chromium   # one-time: needed for OG image generation
```

Then, **in Claude Code, run the `bootstrap-topic` skill**:

```text
/bootstrap-topic        # or: "bootstrap the template for <subject>"
```

It interactively sets your **subject, mission, scope, tag taxonomy and voice**, re-brands
`site.ts`/README/config, optionally **re-themes the design accent**, seeds the build queue,
**removes the placeholder "Getting Started" example**, and then **deletes itself** (it is a
one-time setup). See [Agents & skills](#-agents--skills).

Finally, run the dev server:

```sh
bun run dev                        # → http://localhost:4321
```

---

## 🎓 What it teaches — `TOPIC.md`

The subject lives in **one file**: [`TOPIC.md`](TOPIC.md). It is the single source of truth
for *what* this site teaches — the subject, the zero-to-expert mission, the in-scope /
out-of-scope boundaries, what each difficulty tier means *for this subject*, the tag
taxonomy (learning paths), and the voice rules. `CLAUDE.md`, the authoring skills, and the
autonomous cron builder all read it.

You don't edit it by hand on day one — the `bootstrap-topic` skill fills it in interactively.
After that, `TOPIC.md` is what you tweak when you want to widen scope or adjust the ladder.

---

## 🛠️ Tech stack

| Layer | Choice |
| --- | --- |
| 🚀 Framework | **[Astro 6](https://astro.build)** — static output (`output: 'static'`) |
| 📦 Runtime / package manager | **[Bun](https://bun.sh)** — runtime, installer, script runner |
| ⚛️ Interactivity | **React 19** islands (`@astrojs/react`), hydrated `client:visible` |
| 🎨 Styling | **Tailwind CSS v4** (`@tailwindcss/vite`) — tokens in `src/styles/global.css` |
| 📝 Content | **MDX** content collections (`@astrojs/mdx`) |
| 🌐 i18n | Astro i18n (en default, es prefixed) + `@astrojs/sitemap` |
| 🖼️ OG images | **Playwright** (chromium) screenshots of branded card routes |
| ▲ Hosting | **[Vercel](https://vercel.com)** (`@astrojs/vercel`) |

---

## 📋 Commands

| Command | Action |
| --- | --- |
| `bun run dev` | 🔥 Dev server with HMR at `localhost:4321` (drafts visible) |
| `bun run build` | 🏗️ Production build to `./dist/` |
| `bun run preview` | 👀 Preview the built site locally |
| `bun run check` | ✅ `astro check` + `tsc --noEmit` type checks |
| `bun run og:generate` | 🖼️ Screenshot OG cards from an existing `dist/` build |
| `bun run og:build` | 🏗️🖼️ `build` then `og:generate` |
| `bun run pre-commit` | 🧹 `audit:fix` + `check` + `build` + `og:generate` — run manually before committing |
| `bun run astro ...` | 🧰 Astro CLI (`astro add`, etc.) |

---

## 🧭 Project conventions

### The `@` import alias

Everything under `src/` imports siblings with the `@` alias (`@` = `src/`):

```ts
import { SITE } from '@/lib/site';
import { MCQ, Quiz } from '@/components/react';
```

Use it for **all** intra-`src` imports. Scripts under `scripts/` live outside
`src/` and use normal relative / node imports.

### ✍️ Content authoring

Content is two `astro:content` collections, validated in `src/content.config.ts`.
Collection ids are locale-prefixed: `<lang>/<topic>` for topics and
`<lang>/<topic>/<lesson>` for lessons.

```text
src/content/
├── topics/
│   ├── en/getting-started.mdx          # /getting-started
│   └── es/getting-started.mdx          # /es/getting-started
└── lessons/
    ├── en/getting-started/welcome.mdx     # /getting-started/welcome
    └── es/getting-started/welcome.mdx     # /es/getting-started/welcome
```

- **Topic frontmatter:** `title`, `description` (required); optional `tagline`,
  `icon` (emoji, default `📘`), `order`, `accent` (`brand` | `accent`), `draft`, `seo`.
- **Lesson frontmatter:** `title`, `description`, `topic` (owning topic's id)
  (required); optional `order`, `minutes`, `updated`, `draft`, `seo`.

Author bodies in MDX and import the React islands from `@/components/react`
(`Callout`, `MCQ`, `Quiz`, `Reveal`, `FillBlank`, `MatchConcepts`, …) with a client
directive. See **[DESIGN.md](DESIGN.md)** for the full component inventory.

### 🌐 i18n (en / es)

- English is the **default**, served unprefixed (`/catalog`).
- Spanish is prefixed (`/es/catalog`) — always **peninsular** Spanish (es-ES, Castilian).
- UI strings live in `src/i18n/ui.ts`; helpers in `src/i18n/utils.ts`.
- `hreflang` alternates and a localized sitemap are emitted automatically.

### 🖼️ SEO & Open Graph

Every page carries SEO meta via `src/components/seo/Seo.astro`. Each page's share
image path is resolved through `ogImagePath(pathname)` in **`src/lib/og.ts`** — the
single source of truth for the slug convention. `bun run pre-commit` screenshots a
branded **1200×630** card per page into `public/og/<slug>.png`, which are committed
so production references resolve to real static assets.

---

## 🤖 Agents & skills

This repo is **agent-friendly**. The same authoring know-how is available to every
assistant:

- 🟣 `CLAUDE.md` — project guide for Claude Code (also exposed as `Agents.md`, a symlink).
- 🧠 `.claude/skills/` — Claude Code skills:
  - `bootstrap-topic` — **one-time** setup that adapts the template to your subject, then
    deletes itself (run this first — see [Quickstart](#-quickstart)).
  - `research-topic` → `new-lesson` → (`lesson-copy`, `lesson-animations`,
    `exercise-components`, `translate-lesson`) — the end-to-end authoring chain.
- 💎 `.agents/skills/` — the same skills exposed for agent-agnostic tooling
  (a symlink to `.claude/skills`, so the two never drift).

The authoring skills chain end-to-end: **research → copy → animations → exercises →
translate**, orchestrated by `new-lesson`.

---

## 🤖 Autonomous cron builder

The template can build itself. Two native cron jobs (run as your local user, no CI, no git
hooks) keep the catalog growing and the build system improving:

- **Builder** — `scripts/daily-lesson.sh` builds the next course (the lowest-`order` entry
  in `src/lib/upcoming.ts`, within the scope in `TOPIC.md`), en + es, then validates,
  commits and pushes.
- **Improver** — `scripts/improve-daily-lesson.sh` weekly reviews recent builder runs and
  applies one small, evidence-based improvement to the execution system itself.

Install (or update / remove) both jobs with **one idempotent command** that derives the
repo path and flock lock name automatically — no hand-edited paths:

```sh
scripts/install-cron.sh            # install / update both jobs (idempotent)
scripts/install-cron.sh --list     # show the lines this repo would manage
scripts/install-cron.sh --builder  # only the builder
scripts/install-cron.sh --remove   # remove this repo's jobs
```

Tune via `CRON_TZ`, `BUILDER_SCHEDULE`, `IMPROVER_SCHEDULE`. Full operations guide:
**[docs/daily-lesson-automation.md](docs/daily-lesson-automation.md)**.

---

## ▲ Deployment

Deployed to **Vercel** with the `@astrojs/vercel` adapter (static output).
`vercel.json` sets the framework, `bun install` as the install command, long-cache
(`immutable`) headers for `/og/*` and hashed `/_astro/*` assets, plus baseline
security headers.

Set **`PUBLIC_SITE_URL`** in the environment to drive canonical URLs, the sitemap
and absolute OG URLs (see `.env.example`). It defaults to the placeholder
`https://lessons.example.com` — point it at your real domain.

---

## 📄 License

Released under the [MIT License](LICENSE).
