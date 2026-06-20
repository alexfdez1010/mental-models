# TOPIC — the subject this site teaches

> **This file is the single source of truth for *what* this site teaches.**
> `CLAUDE.md`, the authoring skills, and the autonomous cron builder
> (`scripts/daily-lesson.sh`) all read this file to know the subject, the
> mission, and the scope. Edit it once when you adopt the template — the
> `bootstrap-topic` skill fills it in interactively and then deletes itself.
>
> Everything below the line is **placeholder content**. Replace it with your
> subject. Until you do, the site ships a tiny "Getting Started" example topic
> so it builds and you can see the components in action.

---

## 🎯 Subject

**`<SUBJECT>`** — e.g. *"Photography"*, *"Music theory"*, *"Organic chemistry"*,
*"Personal finance"*, *"Chess"*.

One sentence describing the field in plain language: what it is and who cares.

## 🚀 Mission — zero to expert

**This is a `<SUBJECT>` learning platform. Its single goal: take a learner with
no prior knowledge of `<SUBJECT>` and make them a complete expert.** Every
course, lesson, analogy, and exercise must serve that arc.

- **Assume zero background.** A `beginner`-tier lesson must not lean on any
  term it hasn't defined. Define jargon on first use; never assume the reader
  has seen the field before.
- **Build a ladder, not islands.** Order courses so each one only needs what
  came before it. Encode the path with each topic's `dependencies` array and
  label how far up the ladder a course sits with `difficulty`
  (`beginner` → `intermediate` → `advanced` → `expert`).
- **End at genuine expertise.** `expert`-tier content goes all the way — the
  rigorous, edge-case, real-practitioner depth. Don't stop at "intro".
- **New courses stay on-subject.** When scaffolding a topic, place it on the
  zero-to-expert ladder: pick its `difficulty`, wire its `dependencies`, and
  make sure its prerequisites are themselves taught on the platform.

## 🧭 Scope & boundaries

- **In scope:** the sub-fields, skills, and ideas that make up `<SUBJECT>`.
  List the major areas here so the autonomous builder stays on-topic.
- **Out of scope:** adjacent fields you deliberately do *not* cover. Name them
  so courses don't drift.

## 🧱 Difficulty ladder (what each tier means *for this subject*)

| Tier | Means here |
|---|---|
| `beginner` | Assumes **no prior knowledge** of `<SUBJECT>`. Defines every term. |
| `intermediate` | Builds on beginner courses; introduces the working vocabulary. |
| `advanced` | Real depth; assumes the intermediate ladder is complete. |
| `expert` | The deepest, most rigorous tier — practitioner-grade. |

## 🏷️ Tag taxonomy (learning paths / roadmaps)

The home page renders **roadmaps** — curated learning paths that are just the
catalog pre-filtered by a tag. Define the tags for `<SUBJECT>` in
`src/lib/roadmap-meta.ts`; every topic lists its tags in frontmatter. Examples
of what a tag is for this subject:

- `<tag-1>` — …
- `<tag-2>` — …

## 🗣️ Voice

How lessons should *sound* for this subject (see the `lesson-copy` skill). Keep
it accurate first, then engaging: clear, analogy-driven, lightly witty, never
dry. Note any domain-specific tone rules here (e.g. formality, units, notation).

## 🌍 Languages

Every lesson ships an **English** source and a **peninsular-Spanish (es-ES)**
twin in parity. If you want different/more locales, change `astro.config.mjs`
(`i18n.locales`), `src/i18n/ui.ts`, and the `translate-lesson` skill.
