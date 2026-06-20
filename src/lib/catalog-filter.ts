/**
 * Catalog filter model — pure helpers behind the CourseGraph filter bar.
 *
 * Both filters are multi-select and live in the URL so a filtered view is
 * shareable as a plain link:
 *
 *   /catalog?level=beginner,intermediate&tag=basics,advanced
 *
 * An empty selection means "no filter" and is kept OUT of the URL entirely.
 * Parsing is forgiving (unknown values dropped, duplicates collapsed, order
 * normalized) so hand-edited or stale links never break the page. Kept free
 * of DOM/React so it unit-tests under plain `bun test`.
 */

/** The four demand tiers on the zero-to-expert path. */
export type Difficulty = 'beginner' | 'intermediate' | 'advanced' | 'expert';

/** All tiers, easiest first — canonical order for parsing and display. */
export const DIFFICULTY_VALUES: readonly Difficulty[] = [
  'beginner',
  'intermediate',
  'advanced',
  'expert',
];

/** URL search-param keys. Comma-separated lists, e.g. `?level=beginner,expert`. */
export const LEVEL_PARAM = 'level';
export const TAG_PARAM = 'tag';

/**
 * Split a raw comma-separated param value into trimmed, non-empty entries.
 * `null`/empty input → empty list.
 */
function splitParam(raw: string | null): string[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map((v) => v.trim())
    .filter((v) => v.length > 0);
}

/**
 * Parse the `level` param into a validated, deduped tier list in canonical
 * (easiest-first) order. Unknown values are dropped; selecting *every* tier
 * collapses to "no filter" (empty list) since it filters nothing.
 */
export function parseLevels(raw: string | null): Difficulty[] {
  const wanted = new Set(splitParam(raw));
  const levels = DIFFICULTY_VALUES.filter((d) => wanted.has(d));
  return levels.length === DIFFICULTY_VALUES.length ? [] : levels;
}

/**
 * Parse the `tag` param against the set of known roadmap tags, preserving the
 * order of `validTags` and dropping unknowns/duplicates. Selecting every tag
 * collapses to "no filter" for the same reason as {@link parseLevels}.
 */
export function parseTags(raw: string | null, validTags: readonly string[]): string[] {
  const wanted = new Set(splitParam(raw));
  const tags = validTags.filter((t) => wanted.has(t));
  return tags.length === validTags.length && validTags.length > 0 ? [] : tags;
}

/** Toggle one value in a selection, returning a new array (immutable). */
export function toggleValue<T>(selection: readonly T[], value: T): T[] {
  return selection.includes(value)
    ? selection.filter((v) => v !== value)
    : [...selection, value];
}

/**
 * Write both selections onto a URL's search params (mutates and returns the
 * given URL). Empty selections delete their param so the unfiltered view is
 * the bare, canonical URL.
 */
export function applyFiltersToUrl(
  url: URL,
  levels: readonly Difficulty[],
  tags: readonly string[],
): URL {
  if (levels.length === 0) url.searchParams.delete(LEVEL_PARAM);
  else url.searchParams.set(LEVEL_PARAM, levels.join(','));
  if (tags.length === 0) url.searchParams.delete(TAG_PARAM);
  else url.searchParams.set(TAG_PARAM, tags.join(','));
  return url;
}

/** The slice of a course node the filter cares about. */
export interface FilterableNode {
  difficulty?: Difficulty;
  tags?: string[];
}

/**
 * Apply both filters: a node survives when it matches *some* selected level
 * AND *some* selected tag (each filter ANDs; values within a filter OR).
 * Empty selections pass everything. A node with no difficulty/tags only
 * survives the respective filter when that filter is off.
 */
export function matchesFilters(
  node: FilterableNode,
  levels: readonly Difficulty[],
  tags: readonly string[],
): boolean {
  if (levels.length > 0 && (!node.difficulty || !levels.includes(node.difficulty))) return false;
  if (tags.length > 0 && !(node.tags ?? []).some((t) => tags.includes(t))) return false;
  return true;
}
