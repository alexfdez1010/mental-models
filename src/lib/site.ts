/**
 * Global site metadata. Single source of truth for SEO defaults, branding
 * and social handles. Imported by the SEO component, layouts and OG tooling.
 *
 * ── TEMPLATE NOTE ──────────────────────────────────────────────────────────
 * These values describe *your* learning site. Edit them once when you adopt the
 * template (the `bootstrap-topic` skill does this for you): set the brand
 * `name`, the social handle, and the tagline so they reflect the subject you
 * are teaching. The canonical domain itself lives in `PUBLIC_SITE_URL`
 * (`.env` / Vercel) and `astro.config.mjs`, not here.
 */
export const SITE = {
  name: 'Mental Models',
  /** Used in <title> templates: "Page Title — Mental Models". */
  titleTemplate: (page?: string) =>
    page ? `${page} — Mental Models` : 'Mental Models — Think better, from zero to expert',
  description:
    'Free, interactive, animated lessons on mental models — the thinking tools great decision-makers use. Build a latticework from zero to expert: read, visualize, and test yourself with built-in exercises. In English and Spanish.',
  /** Fallback locale for og:locale / html lang. */
  locale: 'en_US',
  lang: 'en',
  /** Default share image when a page has none. Generated into /public/og. */
  defaultOgImage: '/og/default.png',
  twitter: '@mentalmodels',
  author: 'Mental Models',
  themeColor: '#ea580c',
} as const;

/**
 * Resolve a canonical absolute URL for a path against Astro's configured
 * `site`. Always returns a trailing-slash-normalized absolute URL.
 */
export function canonical(path: string, origin: string | URL): string {
  const base = new URL(origin);
  const url = new URL(path, base);
  return url.href;
}
