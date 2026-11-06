/** Keep Astro's directory-mode rendering, then publish flat HTML for Pages URLs. */
import { existsSync, readdirSync, renameSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

function flattenHtml(dir: string): number {
  const moves: { source: string; destination: string }[] = [];
  const walk = (current: string) => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const full = join(current, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (current !== dir && entry.isFile() && entry.name === 'index.html') {
        moves.push({ source: full, destination: `${current}.html` });
      }
    }
  };
  walk(dir);

  // Check every destination first so a naming collision cannot overwrite a page.
  for (const { destination } of moves) {
    if (existsSync(destination)) throw new Error(`Cannot flatten HTML: ${destination} already exists.`);
  }
  for (const { source, destination } of moves) renameSync(source, destination);
  return moves.length;
}

const count = flattenHtml(fileURLToPath(new URL('../dist', import.meta.url)));
console.log(`Flattened ${count} HTML pages for Cloudflare Pages.`);
