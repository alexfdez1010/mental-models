/**
 * generate-og.ts — Open Graph image generator (run with `bun`).
 *
 * Pipeline:
 *   1. Boot `astro preview` on a fixed port as a child process and wait until
 *      the port answers (the npm script runs `astro build` first).
 *   2. Walk the built `dist/` tree to enumerate the real page routes.
 *   3. Drive a pool of Playwright/chromium pages (OG_CONCURRENCY, default 8) that
 *      pull routes off a shared queue in parallel, open the *actual page* in a
 *      1200×630 viewport, let animations settle, and screenshot it into
 *      public/og/<slug>.png.
 *   4. Tear down preview and report a summary.
 *
 * The OG image is a screenshot of the corresponding page itself (matching the
 * `me` repo's approach) — not a separate branded card route. The slug mapping
 * below MUST stay identical to src/lib/og.ts — it's replicated here (rather
 * than imported) because this script lives outside src/ and the `@` alias /
 * astro:content imports are unavailable to plain bun.
 */
import { spawn, execFileSync, type ChildProcess } from 'node:child_process';
import { chromium } from 'playwright';
import { readdirSync, statSync, mkdirSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const DIST = join(ROOT, 'dist');
const OUT_DIR = join(ROOT, 'public', 'og');
const PORT = 4321;
const HOST = '127.0.0.1';
const BASE = `http://${HOST}:${PORT}`;
const WIDTH = 1200;
const HEIGHT = 630;

/** Wait time (ms) after load to let island animations settle before capture. */
const SETTLE_DELAY = 1000;

/** Max pages capturing screenshots simultaneously. Override with OG_CONCURRENCY. */
const CONCURRENCY = Number(process.env.OG_CONCURRENCY ?? 8);

/* ---- og.ts mirror — KEEP IN SYNC WITH src/lib/og.ts --------------------- */

/** '/'->'default', '/catalog'->'catalog', '/es/a/b'->'es-a-b'. */
function ogSlug(pathname: string): string {
  const clean = pathname.replace(/^\/+|\/+$/g, '');
  if (clean === '') return 'default';
  return clean.replace(/\//g, '-').toLowerCase();
}

/* ---- incremental selection ----------------------------------------------
 *
 * Usage:
 *   bun run scripts/generate-og.ts                     # full regen (all routes)
 *   bun run scripts/generate-og.ts --changed           # only routes touched per git status
 *   bun run scripts/generate-og.ts /catalog /es/defi   # explicit routes
 *   bun run scripts/generate-og.ts src/content/lessons/en/defi/amms.mdx  # file paths OK too
 *
 * `--changed` maps every dirty/untracked file (staged or not) to the routes it
 * affects. Routes whose PNG is missing are always added. If a render-affecting
 * file outside the mappable set changed (layouts, components, styles, lib,
 * i18n, astro.config), it falls back to a FULL regen — correctness over speed.
 */

/** Map a repo-relative source file to the route(s) whose screenshot it affects.
 *  Returns null when the file cannot affect any page render. */
function routesForFile(file: string): string[] | 'all' | null {
  const f = file.split('\\').join('/');

  // Lesson MDX → its page + the topic landing (lesson list) + catalog/home (stats).
  let m = f.match(/^src\/content\/lessons\/(en|es)\/([^/]+)\/([^/]+)\.mdx$/);
  if (m) {
    const prefix = m[1] === 'es' ? '/es' : '';
    return [`${prefix}/${m[2]}/${m[3]}`, `${prefix}/${m[2]}`, `${prefix}/catalog`, prefix || '/'];
  }

  // Topic MDX → its landing + catalog graph + home stats.
  m = f.match(/^src\/content\/topics\/(en|es)\/([^/]+)\.mdx$/);
  if (m) {
    const prefix = m[1] === 'es' ? '/es' : '';
    return [`${prefix}/${m[2]}`, `${prefix}/catalog`, prefix || '/'];
  }

  // Static page files → their route. OG card routes are never screenshot.
  m = f.match(/^src\/pages\/(.+)\.(astro|mdx|md)$/);
  if (m) {
    if (m[1] === 'og' || m[1].startsWith('og/')) return null;
    // Dynamic routes ([topic].astro …) affect an unknown set of pages → full.
    if (m[1].includes('[')) return 'all';
    const route = `/${m[1]}`.replace(/\/index$/, '') || '/';
    return [route];
  }

  // Test files never affect any page render.
  if (/\.(test|spec)\.[tj]sx?$/.test(f)) return null;

  // Catalog/roadmap data + the catalog graph only re-skin the catalog page and
  // the home page (which lists roadmap summaries + difficulty labels). KEEP IN
  // SYNC with the importers of these modules: src/pages/{,es/}index.astro,
  // src/pages/{,es/}catalog.astro, src/components/react/CourseGraph.tsx.
  const CATALOG_SCOPED = new Set([
    'src/lib/roadmaps.ts',
    'src/lib/roadmap-meta.ts',
    'src/lib/catalog.ts',
    'src/lib/catalog-filter.ts',
    'src/components/react/CourseGraph.tsx',
  ]);
  if (CATALOG_SCOPED.has(f)) return ['/catalog', '/es/catalog', '/', '/es'];

  // LENIENT POLICY: edits to shared chrome (layouts, global.css, Seo, header/
  // footer, generic islands, lib helpers, astro.config) can in theory re-skin
  // every OG card — but full regen of all ~726 routes costs minutes of build +
  // screenshot on every such commit. We deliberately DON'T force that here:
  // unmapped files map to NO routes, so `og:changed` only ever recaptures the
  // lesson/topic/page routes whose own content changed. OG cards for global
  // restyles may drift until a manual full refresh: `bun run og:build`
  // (or `bun run og:generate` against an existing build).
  return null;
}

/** Repo-relative paths of all changed files (staged + unstaged + untracked). */
function gitChangedFiles(): string[] {
  const out = execFileSync('git', ['status', '--porcelain'], { cwd: ROOT, encoding: 'utf8' });
  const files: string[] = [];
  for (const line of out.split('\n')) {
    if (!line.trim()) continue;
    let path = line.slice(3);
    const arrow = path.indexOf(' -> '); // rename: keep the new path
    if (arrow !== -1) path = path.slice(arrow + 4);
    files.push(path.replace(/^"|"$/g, ''));
  }
  return files;
}

/** Normalize a CLI arg (route or file path) to routes. */
function routesForArg(arg: string): string[] | 'all' {
  if (arg.startsWith('/')) return [arg.replace(/\/+$/, '') || '/'];
  const mapped = routesForFile(arg);
  if (mapped === null) {
    console.warn(`⚠ ${arg} maps to no route; ignoring.`);
    return [];
  }
  return mapped;
}

/**
 * Decide which of the built routes to capture.
 * Returns the full list, or the subset selected by --changed / explicit args
 * (always topped up with routes whose PNG is missing on disk).
 */
function selectRoutes(allRoutes: string[], argv: string[]): string[] {
  const changedMode = argv.includes('--changed');
  const explicit = argv.filter((a) => a !== '--changed');

  if (!changedMode && explicit.length === 0) return allRoutes; // full regen

  const wanted = new Set<string>();
  const sources = changedMode ? gitChangedFiles().map(routesForFile) : [];
  for (const arg of explicit) sources.push(routesForArg(arg));

  for (const routes of sources) {
    if (routes === null) continue;
    if (routes === 'all') {
      console.log('▸ A render-affecting shared file changed → full OG regen.');
      return allRoutes;
    }
    for (const r of routes) wanted.add(r);
  }

  // Safety net: any built route missing its PNG gets (re)captured.
  for (const route of allRoutes) {
    if (!existsSync(join(OUT_DIR, `${ogSlug(route)}.png`))) wanted.add(route);
  }

  const selected = allRoutes.filter((r) => wanted.has(r));
  const stale = [...wanted].filter((r) => !allRoutes.includes(r));
  for (const r of stale) console.warn(`⚠ ${r} is not a built route; skipping.`);
  console.log(`▸ Incremental mode: ${selected.length}/${allRoutes.length} route(s) selected.`);
  return selected;
}

/* ---- helpers ------------------------------------------------------------ */

/** Recursively collect every directory containing an index.html under dist. */
function collectRoutes(dir: string): string[] {
  const routes: string[] = [];
  const walk = (current: string) => {
    let entries: string[];
    try {
      entries = readdirSync(current);
    } catch {
      return;
    }
    if (entries.includes('index.html')) {
      const rel = relative(DIST, current).split('\\').join('/');
      routes.push(rel === '' ? '/' : `/${rel}`);
    }
    for (const name of entries) {
      const full = join(current, name);
      if (statSync(full).isDirectory()) walk(full);
    }
  };
  walk(dir);
  return routes;
}

/** Wait until the preview server answers on the port (or time out). */
async function waitForServer(url: string, timeoutMs = 30_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url, { method: 'HEAD' });
      if (res.ok || res.status === 404) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`Preview server did not become ready at ${url} within ${timeoutMs}ms`);
}

async function main() {
  if (!existsSync(DIST)) {
    console.error('✗ dist/ not found. Run `astro build` first (use `bun run og:build`).');
    process.exit(1);
  }

  mkdirSync(OUT_DIR, { recursive: true });

  // Enumerate real page routes, dropping any leftover og routes and 404.
  const allRoutes = collectRoutes(DIST);
  const builtRoutes = allRoutes.filter(
    (r) => !r.startsWith('/og') && r !== '/404' && !r.endsWith('/404'),
  );
  const pageRoutes = selectRoutes(builtRoutes, process.argv.slice(2));

  if (pageRoutes.length === 0) {
    if (builtRoutes.length > 0) {
      console.log('▸ No routes affected by the selection. Nothing to screenshot.');
      return;
    }
    console.warn('⚠ No page routes found in dist/. Nothing to screenshot.');
    return;
  }

  console.log(`▸ Found ${pageRoutes.length} page route(s) needing OG images.`);

  // Boot astro preview.
  console.log(`▸ Starting astro preview on ${BASE} …`);
  const server: ChildProcess = spawn(
    'bunx',
    ['astro', 'preview', '--host', HOST, '--port', String(PORT)],
    { cwd: ROOT, stdio: 'ignore' },
  );

  let browser: Awaited<ReturnType<typeof chromium.launch>> | null = null;
  const ok: string[] = [];
  const failed: { route: string; error: string }[] = [];

  try {
    await waitForServer(`${BASE}/`);
    console.log('▸ Preview ready. Launching chromium …');

    browser = await chromium.launch();
    const context = await browser.newContext({
      viewport: { width: WIDTH, height: HEIGHT },
      // 1x output → PNG is exactly 1200×630, matching the og:image:width/height
      // meta tags. A 2x scale produced 2400×1260 files that mismatched the
      // declared size and were large enough (300–740KB) that some scrapers
      // (WhatsApp, etc.) dropped the preview.
      deviceScaleFactor: 1,
    });

    // Shared work queue; a pool of pages pulls from it concurrently so capture
    // time scales with CONCURRENCY instead of the route count.
    const queue = [...pageRoutes];
    const workerCount = Math.min(CONCURRENCY, queue.length);
    console.log(`▸ Capturing with ${workerCount} parallel page(s) …`);

    const capture = async (pathname: string, page: Awaited<ReturnType<typeof context.newPage>>) => {
      const slug = ogSlug(pathname);
      const outFile = join(OUT_DIR, `${slug}.png`);
      try {
        const res = await page.goto(`${BASE}${pathname}`, {
          waitUntil: 'networkidle',
          timeout: 20_000,
        });
        if (!res || !res.ok()) {
          throw new Error(`route ${pathname} returned ${res?.status() ?? 'no response'}`);
        }
        // Ensure web fonts are laid out, then let animations settle.
        await page.evaluate(() => (document as any).fonts?.ready);
        await page.waitForTimeout(SETTLE_DELAY);

        // Screenshot the visible 1200×630 viewport (top of the page).
        await page.screenshot({
          path: outFile,
          clip: { x: 0, y: 0, width: WIDTH, height: HEIGHT },
        });
        ok.push(slug);
        console.log(`  ✓ ${pathname}  →  public/og/${slug}.png`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        failed.push({ route: pathname, error: msg });
        console.warn(`  ✗ ${pathname}: ${msg}`);
      }
    };

    const worker = async () => {
      const page = await context.newPage();
      try {
        let pathname: string | undefined;
        while ((pathname = queue.shift()) !== undefined) {
          await capture(pathname, page);
        }
      } finally {
        await page.close();
      }
    };

    await Promise.all(Array.from({ length: workerCount }, () => worker()));
  } finally {
    if (browser) await browser.close();
    server.kill('SIGTERM');
  }

  console.log(`\n▸ OG generation complete: ${ok.length} ok, ${failed.length} failed.`);
  if (failed.length) {
    for (const f of failed) console.log(`   ✗ ${f.route} — ${f.error}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('✗ OG generation crashed:', err);
  process.exit(1);
});
