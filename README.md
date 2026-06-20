# 🧠 Mental Models

> A **bilingual (English 🇬🇧 / Spanish 🇪🇸), zero-to-expert** interactive site that teaches
> **mental models** — the cross-disciplinary thinking tools great decision-makers use.
> Animated, exercise-rich lessons build a **latticework** from "what is a model?" all the
> way to combining many models into a single expert judgment.

🎨 **Design:** orange, brutalist, light-first — see **[DESIGN.md](DESIGN.md)**

📖 **What it teaches:** the subject, mission and scope live in **[`TOPIC.md`](TOPIC.md)**.

---

## ✨ Overview

**Mental Models** is a zero-to-expert education site about the cross-disciplinary thinking
tools — built on a reusable, topic-agnostic skeleton. The structure: a slug-based catalog
ordered into a learning path (the latticework), MDX content authored in two languages, a kit
of reusable interactive React islands, SEO/Open-Graph generation, and an autonomous cron
builder that keeps writing courses. The subject lives in one file — [`TOPIC.md`](TOPIC.md).

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

The catalog is seeded with a build queue of the most important models (see
`src/lib/upcoming.ts`) — they render as "Coming soon" nodes on the dependency graph until
the authoring chain (or the cron builder) writes them. Author the next one with the
`new-lesson` skill.

---

## 🚀 Quickstart

```sh
git clone <your-fork-url> mental-models && cd mental-models
bun install
bunx playwright install chromium   # one-time: needed for OG image generation
bun run dev                        # → http://localhost:4321
```

The subject is already set up (see [`TOPIC.md`](TOPIC.md)). To write the next course, run
the **`new-lesson`** skill in Claude Code — it chains research → copy → animations →
exercises → translation. See [Agents & skills](#-agents--skills).

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

### 🔐 Deployment secrets (GitHub Actions)

Production deploys run from **[`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)**:
GitHub builds the prebuilt output on a 16 GB runner (the hobby Vercel container
SIGKILLs on this large static build) and ships it with `vercel deploy --prebuilt`.
The workflow needs **three repository secrets**:

| Secret | What it is | Where to find it |
| --- | --- | --- |
| `VERCEL_TOKEN` | Vercel access token | [vercel.com/account/tokens](https://vercel.com/account/tokens) → **Create Token** |
| `VERCEL_ORG_ID` | Vercel org / team ID | Vercel **Project → Settings → General** (or run `vercel link`, then read `.vercel/project.json`) |
| `VERCEL_PROJECT_ID` | Vercel project ID | same place as `VERCEL_ORG_ID` |

**Add them via the GitHub UI** — Repo → **Settings → Secrets and variables → Actions**
→ **New repository secret** → add each name + value.

**Or via the `gh` CLI** (paste the value when prompted, never commit it):

```sh
gh secret set VERCEL_TOKEN
gh secret set VERCEL_ORG_ID
gh secret set VERCEL_PROJECT_ID

gh secret list   # verify all three are present
```

The fastest way to get the org/project IDs: run `vercel link` once locally, then read
them from the generated `.vercel/project.json` (`orgId` and `projectId`). After the
secrets are set, every push to `main` (or a manual **Run workflow**) deploys to production.

> ⚠️ Treat `VERCEL_TOKEN` as a password. Don't print it, commit it, or paste it into
> the workflow YAML — keep it only in GitHub secrets. Rotate it at
> [vercel.com/account/tokens](https://vercel.com/account/tokens) if it leaks.

Also disable Vercel's own git build so it doesn't try (and fail) to build on push:
set **Project → Settings → Git → Ignored Build Step** to `exit 0`.

---

## 📄 License

Released under the [MIT License](LICENSE).
