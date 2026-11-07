import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ogImagePath } from '@/lib/og';

/** Build-time only: changed PNG bytes get a fresh URL in browsers and the CDN. */
export function versionedOgImagePath(pathname: string, publicDirectory = resolve('public')): string {
  const image = ogImagePath(pathname);
  try {
    const bytes = readFileSync(resolve(publicDirectory, image.slice(1)));
    const version = createHash('sha256').update(bytes).digest('hex').slice(0, 16);
    return `${image}?v=${version}`;
  } catch (error) {
    // The first local build precedes OG generation for a newly authored route.
    // Deployment builds use the generated PNGs committed by pre-commit.
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return image;
    throw error;
  }
}
