/**
 * Tiny className joiner. Filters out falsy values so you can write
 * conditional classes inline without pulling in `clsx`.
 *
 * @example cx('p-4', isActive && 'bg-brand-500', undefined) // "p-4 bg-brand-500"
 */
export function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ');
}

export default cx;
