/**
 * Deterministic, content-seeded shuffling for exercise islands.
 *
 * Answer options are authored "correct first" for readability, which leaks the
 * answer through position. Shuffling fixes that — but it must be **seeded** so
 * the order is identical during SSR/prerender and client hydration. A random
 * order on each render would reorder the DOM after hydration (visible flash +
 * React hydration-mismatch warning). Seeding from the option contents gives one
 * stable order per build with no mismatch.
 */

/** Deterministic 32-bit hash of a string (FNV-1a). */
export function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Seeded Fisher–Yates (mulberry32 PRNG) so order is identical on server and client. */
export function seededShuffle<T>(items: T[], seed: number): T[] {
  const out = items.slice();
  let state = seed || 1;
  for (let i = out.length - 1; i > 0; i--) {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    const r = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    const j = Math.floor(r * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
