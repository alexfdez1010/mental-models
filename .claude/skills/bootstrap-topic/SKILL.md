---
name: bootstrap-topic
description: One-time setup that adapts this template to a specific subject — sets TOPIC.md (subject, mission, scope, tags, voice), re-brands site.ts/README/config, re-themes the design system, seeds the build queue, removes the placeholder "Getting Started" example content, and then DELETES ITSELF. Use ONCE when adopting the template, or when the user says "bootstrap the template", "set the topic", "make this site about X", "initialize the template", "start with the template".
---

# Bootstrap this template for a subject

This skill is run **once**, when someone adopts the template. It turns the generic
"Lessons" template into a site about a concrete **subject** (e.g. *Photography*,
*Music theory*, *Organic chemistry*), then removes itself so it never runs again.

Work in parallel where you can (the file groups below are mostly independent), but
do the steps in order — later steps assume the subject is decided.

## 0. Decide the subject

If the user gave a subject, use it. Otherwise **ask** (use AskUserQuestion):

1. **Subject** — what the whole site teaches (one phrase).
2. **Audience & end-state** — confirm the zero-to-expert arc (who starts, what
   "expert" means here).
3. **Scope boundaries** — adjacent areas to deliberately exclude.
4. **Brand** — site name (default: the subject + " Lessons"), social handle,
   production domain.
5. **Design accent** — keep blue-forward, or re-theme to a palette that fits the
   subject (offer 2–3 concrete options).
6. **Languages** — keep en + es, or change.

Echo back a one-paragraph summary and proceed.

## 1. Write `TOPIC.md`

Replace every `<placeholder>` in `TOPIC.md` with real content for the subject:
the subject sentence, the zero-to-expert mission, **in-scope / out-of-scope**
lists, what each difficulty tier means *for this subject*, the **tag taxonomy**
(the learning paths), and any voice/notation rules. This file is the source of
truth the cron builder and every skill read — make it specific and complete.

## 2. Re-brand the site

- `src/lib/site.ts` — `name`, `titleTemplate`, `description`, `twitter`, `author`.
- `.env.example` and `astro.config.mjs` — the default `PUBLIC_SITE_URL` / `SITE`
  origin → the real domain.
- `package.json` — `name` and `author`.
- `README.md` — the title line, the one-line pitch, and the "What it teaches"
  section. Keep the template/how-to-author/cron sections.
- `public/favicon.svg` — swap the glyph if you have one (optional).

## 3. Re-theme the design system (if the user chose a new accent)

- `src/styles/global.css` — edit the `@theme` block: the `brand-*` and `accent-*`
  color ramps (and `themeColor` in `site.ts`) to the chosen palette. Keep the
  light-first, accessible, `prefers-reduced-motion` rules intact.
- `DESIGN.md` — update the color tables and the "Philosophy" line to match the new
  palette so the docs and tokens never drift.
- Leave the typography/radii/shadow tokens unless the user wants them changed.

## 4. Seed the learning paths and build queue

- `src/lib/roadmap-meta.ts` — replace the single `getting-started` example roadmap
  with the real tag taxonomy from `TOPIC.md` (each `tag`, bilingual title +
  description, icon, order).
- `src/lib/upcoming.ts` — replace the two example entries with a real starter
  queue: the first few courses on the zero-to-expert ladder, lowest `order` first,
  with honest `difficulty`, `dependencies`, `tags`, and a concrete `buildNotes`
  brief for each. The autonomous builder will work this queue top-down.

## 5. Remove the placeholder example content

Delete the "Getting Started" example topic and its lessons (both locales):

```bash
rm -rf src/content/topics/en/getting-started.mdx src/content/topics/es/getting-started.mdx
rm -rf src/content/lessons/en/getting-started src/content/lessons/es/getting-started
rm -f public/og/getting-started.png public/og/es-getting-started.png \
      public/og/getting-started-*.png public/og/es-getting-started-*.png 2>/dev/null || true
```

> Make sure at least one real course will exist (step 6) before committing, or the
> catalog will be empty. The build tolerates an empty catalog, but ship something.

## 6. Build the first real course (recommended)

Hand off to the normal authoring chain for the lowest-`order` queue entry so the
site launches with real content:

- `research-topic` → `new-lesson` (which chains `lesson-copy`,
  `lesson-animations`, `exercise-components`, `translate-lesson`).

Then remove that entry from `upcomingCourses` (it has graduated to a real topic).

## 7. Validate

```bash
bun install
bun run check
```

Fix anything red. (A full `bun run pre-commit` also regenerates OG images — run it
before the first commit.)

## 8. Delete this skill — REQUIRED

Bootstrapping is a one-time job. As the **final step**, remove this skill so it
can never run again (it lives under `.claude/skills`, which `.agents/skills`
symlinks to, so one delete covers both):

```bash
rm -rf .claude/skills/bootstrap-topic
```

Confirm to the user that the template is now adapted to **<subject>**, summarize
what changed, and point them at `new-lesson` for authoring more courses and
`scripts/install-cron.sh` to enable the autonomous builder.
