/**
 * Unit tests for the catalog filter model. Run with `bun test`.
 * Pure functions — no DOM needed beyond the WHATWG `URL` built-in.
 */
import { describe, expect, test } from 'bun:test';
import {
  applyFiltersToUrl,
  DIFFICULTY_VALUES,
  matchesFilters,
  parseLevels,
  parseTags,
  toggleValue,
  type Difficulty,
  type FilterableNode,
} from './catalog-filter';

const TAGS = ['basics', 'core', 'tools', 'advanced-topics'] as const;

describe('parseLevels', () => {
  test('null / empty / junk → no filter', () => {
    expect(parseLevels(null)).toEqual([]);
    expect(parseLevels('')).toEqual([]);
    expect(parseLevels('wizard,banana')).toEqual([]);
  });

  test('single valid tier', () => {
    expect(parseLevels('beginner')).toEqual(['beginner']);
  });

  test('comma-separated multi-select, unknowns dropped', () => {
    expect(parseLevels('expert,beginner,wizard')).toEqual(['beginner', 'expert']);
  });

  test('normalizes to canonical easiest-first order and dedupes', () => {
    expect(parseLevels('expert,beginner,expert,advanced')).toEqual([
      'beginner',
      'advanced',
      'expert',
    ]);
  });

  test('tolerates whitespace around values', () => {
    expect(parseLevels(' beginner , advanced ')).toEqual(['beginner', 'advanced']);
  });

  test('all four tiers collapse to "no filter"', () => {
    expect(parseLevels(DIFFICULTY_VALUES.join(','))).toEqual([]);
  });
});

describe('parseTags', () => {
  test('null / empty / unknown → no filter', () => {
    expect(parseTags(null, TAGS)).toEqual([]);
    expect(parseTags('', TAGS)).toEqual([]);
    expect(parseTags('nope,nada', TAGS)).toEqual([]);
  });

  test('keeps only known tags, in registry order, deduped', () => {
    expect(parseTags('tools,core,tools,bogus', TAGS)).toEqual(['core', 'tools']);
  });

  test('every tag selected collapses to "no filter"', () => {
    expect(parseTags(TAGS.join(','), TAGS)).toEqual([]);
  });

  test('empty registry never collapses (guards divide-by-empty)', () => {
    expect(parseTags('anything', [])).toEqual([]);
  });
});

describe('toggleValue', () => {
  test('adds a missing value', () => {
    expect(toggleValue(['a'], 'b')).toEqual(['a', 'b']);
  });

  test('removes a present value', () => {
    expect(toggleValue(['a', 'b'], 'a')).toEqual(['b']);
  });

  test('does not mutate the input', () => {
    const input = ['a'];
    toggleValue(input, 'b');
    expect(input).toEqual(['a']);
  });
});

describe('applyFiltersToUrl', () => {
  test('writes comma-joined params for active filters', () => {
    const url = applyFiltersToUrl(
      new URL('https://x.test/catalog'),
      ['beginner', 'expert'],
      ['tools'],
    );
    expect(url.searchParams.get('level')).toBe('beginner,expert');
    expect(url.searchParams.get('tag')).toBe('tools');
  });

  test('empty selections delete their params (canonical bare URL)', () => {
    const url = applyFiltersToUrl(
      new URL('https://x.test/catalog?level=beginner&tag=tools'),
      [],
      [],
    );
    expect(url.searchParams.has('level')).toBe(false);
    expect(url.searchParams.has('tag')).toBe(false);
    expect(url.href).toBe('https://x.test/catalog');
  });

  test('preserves unrelated params', () => {
    const url = applyFiltersToUrl(new URL('https://x.test/catalog?utm_source=a'), ['advanced'], []);
    expect(url.searchParams.get('utm_source')).toBe('a');
    expect(url.searchParams.get('level')).toBe('advanced');
  });

  test('round-trips through the parsers', () => {
    const levels: Difficulty[] = ['intermediate', 'expert'];
    const tags = ['core', 'advanced-topics'];
    const url = applyFiltersToUrl(new URL('https://x.test/catalog'), levels, tags);
    expect(parseLevels(url.searchParams.get('level'))).toEqual(levels);
    expect(parseTags(url.searchParams.get('tag'), TAGS)).toEqual(tags);
  });
});

describe('matchesFilters', () => {
  const node = (difficulty?: Difficulty, tags?: string[]): FilterableNode => ({
    difficulty,
    tags,
  });

  test('no filters → everything passes', () => {
    expect(matchesFilters(node(), [], [])).toBe(true);
    expect(matchesFilters(node('expert', ['tools']), [], [])).toBe(true);
  });

  test('level filter ORs within itself', () => {
    expect(matchesFilters(node('beginner'), ['beginner', 'expert'], [])).toBe(true);
    expect(matchesFilters(node('advanced'), ['beginner', 'expert'], [])).toBe(false);
  });

  test('node without difficulty fails an active level filter', () => {
    expect(matchesFilters(node(undefined, ['tools']), ['beginner'], [])).toBe(false);
  });

  test('tag filter matches on any shared tag', () => {
    expect(matchesFilters(node('beginner', ['tools', 'core']), [], ['core'])).toBe(true);
    expect(matchesFilters(node('beginner', ['tools']), [], ['core'])).toBe(false);
  });

  test('node without tags fails an active tag filter', () => {
    expect(matchesFilters(node('beginner'), [], ['tools'])).toBe(false);
    expect(matchesFilters(node('beginner', []), [], ['tools'])).toBe(false);
  });

  test('level and tag filters AND together', () => {
    const n = node('expert', ['advanced-topics']);
    expect(matchesFilters(n, ['expert'], ['advanced-topics'])).toBe(true);
    expect(matchesFilters(n, ['beginner'], ['advanced-topics'])).toBe(false);
    expect(matchesFilters(n, ['expert'], ['tools'])).toBe(false);
  });
});
