// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import vercel from '@astrojs/vercel';
import tailwindcss from '@tailwindcss/vite';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { roadmapTags } from './src/lib/roadmap-meta';

// Canonical production origin. Override per-environment with PUBLIC_SITE_URL
// (Vercel deploys, previews). Drives sitemap, canonical tags and OG URLs.
const SITE = process.env.PUBLIC_SITE_URL ?? 'https://lessons.alejandrofernandezcamello.me';

// https://astro.build/config
export default defineConfig({
  site: SITE,
  output: 'static',
  // The /roadmap/<tag> pages were retired — a learning path is now just the
  // catalog pre-filtered by tag, so each old URL 301s to /catalog?tag=<tag>.
  redirects: Object.fromEntries(
    roadmapTags.flatMap((tag) => [
      [`/roadmap/${tag}`, { status: 301, destination: `/catalog?tag=${tag}` }],
      [`/es/roadmap/${tag}`, { status: 301, destination: `/es/catalog?tag=${tag}` }],
    ]),
  ),
  // Bilingual. English is the default and served at the root (/about),
  // Spanish is prefixed (/es/about). hreflang alternates are emitted by Seo.astro
  // and the sitemap integration below.
  i18n: {
    locales: ['en', 'es'],
    defaultLocale: 'en',
    routing: {
      prefixDefaultLocale: false,
      redirectToDefaultLocale: false,
    },
  },
  // LaTeX math in MDX: `$inline$` and `$$block$$` are parsed by remark-math and
  // rendered to HTML by rehype-katex. MDX inherits these via extendMarkdownConfig.
  // KaTeX stylesheet is imported globally in src/styles/global.css.
  markdown: {
    remarkPlugins: [remarkMath],
    rehypePlugins: [rehypeKatex],
  },
  adapter: vercel({
    webAnalytics: { enabled: true },
  }),
  integrations: [
    react(),
    mdx(),
    sitemap({
      i18n: {
        defaultLocale: 'en',
        locales: { en: 'en-US', es: 'es-ES' },
      },
    }),
  ],
  vite: {
    plugins: [tailwindcss()],
  },
});
