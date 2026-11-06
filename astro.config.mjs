// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

// Canonical production origin. Override per-environment with PUBLIC_SITE_URL
// (Cloudflare Pages). Drives sitemap, canonical tags and OG URLs.
const SITE = process.env.PUBLIC_SITE_URL ?? 'https://mental-models.alejandrofernandezcamello.me';

// https://astro.build/config
export default defineConfig({
  site: SITE,
  output: 'static',
  // Render canonical URLs without trailing slashes; flatten output after rendering.
  trailingSlash: 'never',
  // HTTP redirects are generated into public/_redirects before the build.
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
