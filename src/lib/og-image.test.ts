import { afterAll, describe, expect, test } from 'bun:test';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { versionedOgImagePath } from '@/lib/og-image';

const directory = mkdtempSync(join(tmpdir(), 'mental-models-og-cache-'));
mkdirSync(join(directory, 'og'));
afterAll(() => rmSync(directory, { recursive: true, force: true }));

describe('content-versioned OG images', () => {
  test('unchanged image bytes keep their URL, changed bytes get a fresh cache key', () => {
    const target = join(directory, 'og', 'course-lesson.png');
    writeFileSync(target, 'first PNG fixture');
    const first = versionedOgImagePath('/course/lesson/', directory);
    expect(first).toMatch(/^\/og\/course-lesson\.png\?v=[a-f0-9]{16}$/);
    expect(first).toBe('/og/course-lesson.png?v=93d7bdda511cad51');
    expect(versionedOgImagePath('/course/lesson', directory)).toBe(first);
    writeFileSync(target, 'second PNG fixture');
    expect(versionedOgImagePath('/course/lesson', directory)).not.toBe(first);
    expect(readFileSync(target, 'utf8')).toBe('second PNG fixture');
  });

  test('localized and home routes retain the established image path', () => {
    for (const [route, asset] of [['/', 'default'], ['/es', 'es'], ['/es/course/lesson', 'es-course-lesson']]) {
      writeFileSync(join(directory, 'og', `${asset}.png`), 'same fixture');
      expect(versionedOgImagePath(route!, directory)).toMatch(new RegExp(`^/og/${asset}\\.png\\?v=[a-f0-9]{16}$`));
    }
  });

  test('a new page can build before its first OG image has been generated', () => {
    expect(versionedOgImagePath('/new-course/new-lesson', directory)).toBe('/og/new-course-new-lesson.png');
  });

  test('an existing unreadable asset is not silently treated as a missing image', () => {
    mkdirSync(join(directory, 'og', 'directory.png'));
    expect(() => versionedOgImagePath('/directory', directory)).toThrow();
  });
});
