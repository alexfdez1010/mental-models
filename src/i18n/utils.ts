import { ui, defaultLang, languages, type Lang, type UIKey } from '@/i18n/ui';

export { languages, defaultLang, type Lang };

/** All supported locales, in display order. */
export const locales = Object.keys(languages) as Lang[];

/**
 * Extract the active locale from a URL pathname.
 * `/es/...` -> 'es'; everything else -> default ('en'), since English is
 * served unprefixed (prefixDefaultLocale: false).
 */
export function getLangFromUrl(url: URL): Lang {
  const [, seg] = url.pathname.split('/');
  if (seg in languages) return seg as Lang;
  return defaultLang;
}

/**
 * Translator bound to a locale. Falls back to English, then to the key.
 *   const t = useTranslations(lang); t('nav.catalog')
 */
export function useTranslations(lang: Lang) {
  return function t(key: UIKey): string {
    return ui[lang]?.[key] ?? ui[defaultLang][key] ?? key;
  };
}

/**
 * Build a locale-aware path. English (default) is unprefixed; other locales
 * get a `/<lang>` prefix.
 *   localizePath('/catalog', 'es') -> '/es/catalog'
 *   localizePath('/catalog', 'en') -> '/catalog'
 * Pass a bare path WITHOUT any locale prefix.
 */
export function localizePath(path: string, lang: Lang): string {
  const clean = '/' + path.replace(/^\/+/, '');
  if (lang === defaultLang) return clean === '/' ? '/' : clean.replace(/\/$/, '');
  return `/${lang}${clean === '/' ? '' : clean}`.replace(/\/$/, '') || `/${lang}`;
}

/**
 * Strip any leading locale segment from a pathname, returning the bare path.
 *   stripLocale('/es/catalog') -> '/catalog'
 *   stripLocale('/catalog')    -> '/catalog'
 */
export function stripLocale(pathname: string): string {
  const [, seg, ...rest] = pathname.split('/');
  if (seg in languages) return '/' + rest.join('/');
  return pathname;
}

/**
 * Given the current URL, produce the equivalent path in every locale.
 * Used to render the language switcher and hreflang alternates.
 * Returns [{ lang, path }] where path is locale-prefixed and trailing-slash-free.
 */
export function alternates(url: URL): { lang: Lang; path: string }[] {
  const bare = stripLocale(url.pathname);
  return locales.map((lang) => ({ lang, path: localizePath(bare, lang) }));
}

/**
 * Split a content collection id of the form "<lang>/<topic>[/<lesson>]".
 * Topics: "en/transformers" -> { lang:'en', topic:'transformers' }.
 * Lessons: "es/transformers/attention" -> { lang, topic, lesson }.
 */
export function parseId(id: string): { lang: Lang; topic: string; lesson?: string } {
  const [lang, topic, ...rest] = id.split('/');
  return {
    lang: (lang in languages ? lang : defaultLang) as Lang,
    topic,
    lesson: rest.length ? rest.join('/') : undefined,
  };
}
