import { useId, useMemo, useState } from 'react';
import { cx } from '@/components/react/cx';

/** A single irreducible part the learner adds back when rebuilding from scratch. */
export interface FirstPrinciplesPart {
  /** Short name of the part (e.g. "Lithium"). */
  label: string;
  /** Its contribution to the rebuilt total, in the same units as `analogyValue`. */
  value: number;
  /** One-line note explaining what this part is / why it costs what it costs. */
  note?: string;
}

/** Props for the {@link FirstPrinciplesBuilder} island. */
export interface FirstPrinciplesBuilderProps {
  /** Language used for number formatting and built-in labels. */
  locale?: 'en' | 'es';
  /** Heading above the figure. */
  title?: string;
  /** Eyebrow label. Defaults to `'Decompose, then rebuild'`. */
  eyebrow?: string;
  /** Caption beneath the figure. */
  caption?: string;
  /**
   * The "by analogy" number — the figure everyone assumes because that's what
   * the thing has always cost. Drawn as the reference everything is compared to.
   */
  analogyValue: number;
  /** Label for the analogy number. Defaults to `'The "by analogy" price'`. */
  analogyLabel?: string;
  /** One-line note on where the analogy number comes from. */
  analogyNote?: string;
  /** The irreducible parts. Adding them all up gives the first-principles total. */
  parts: FirstPrinciplesPart[];
  /** Label for the running sum of selected parts. */
  rebuiltLabel?: string;
  /** Instruction line explaining how to add and remove parts. */
  instructions?: string;
  /** Text prefix on every number (e.g. a currency sign). Defaults to `'$'`. */
  valuePrefix?: string;
  /** Text suffix on every number (e.g. a unit). Defaults to `''`. */
  valueSuffix?: string;
  /** Label of the "add every part" button. Defaults to `'Add all parts'`. */
  revealAllLabel?: string;
  /** Label of the reset button. Defaults to `'Start over'`. */
  resetLabel?: string;
  /**
   * Verdict shown once every part is added. Use `{ratio}` and `{total}` as
   * placeholders. Distinguish the parts subtotal from a finished-product price.
   */
  verdictTemplate?: string;
  /** Extra classes merged onto the root element. */
  className?: string;
}

/** Format a number with optional prefix/suffix, trimming trailing `.0`. */
function fmt(n: number, prefix: string, suffix: string, locale: string): string {
  const body = n.toLocaleString(locale, { maximumFractionDigits: 2 });
  return `${prefix}${body}${suffix}`;
}

/**
 * Compare an assumed price with a learner-built subtotal on one shared scale.
 * Adding and removing parts changes the total immediately; the bar follows with
 * a brief transform transition. A parts subtotal need not include every cost of
 * the finished product. Labels and verdicts can make that scope explicit.
 */
export function FirstPrinciplesBuilder({
  title,
  locale = 'en',
  eyebrow,
  caption,
  analogyValue,
  analogyLabel,
  analogyNote,
  parts,
  rebuiltLabel,
  instructions,
  valuePrefix = '$',
  valueSuffix = '',
  revealAllLabel,
  resetLabel,
  verdictTemplate,
  className,
}: FirstPrinciplesBuilderProps) {
  const spanish = locale === 'es';
  const numberLocale = spanish ? 'es-ES' : 'en-US';
  eyebrow ??= spanish ? 'Descomponer y reconstruir' : 'Decompose, then rebuild';
  analogyLabel ??= spanish ? 'Precio de referencia' : 'Reference price';
  rebuiltLabel ??= spanish ? 'Suma de las partes seleccionadas' : 'Selected parts total';
  instructions ??= spanish ? 'Añade o retira partes para comprobar su contribución al total.' : 'Add or remove parts to check their contribution to the total.';
  revealAllLabel ??= spanish ? 'Añadir todas las partes' : 'Add all parts';
  resetLabel ??= spanish ? 'Empezar de nuevo' : 'Start over';
  verdictTemplate ??= spanish
    ? 'Las partes suman {total}, {ratio} del precio de referencia. Comprueba qué costes faltan antes de comparar el producto completo.'
    : 'The parts total {total}, {ratio} of the reference price. Check which costs are missing before comparing the finished product.';
  const format = (value: number) => fmt(value, valuePrefix, valueSuffix, numberLocale);
  // Fail the build on a mis-authored figure rather than shipping a broken island.
  if (!Array.isArray(parts) || parts.length < 2) {
    throw new Error('FirstPrinciplesBuilder: needs at least two `parts`.');
  }
  if (!Number.isFinite(analogyValue) || analogyValue <= 0) {
    throw new Error('FirstPrinciplesBuilder: `analogyValue` must be a finite positive number.');
  }
  const badIndex = parts.findIndex((part) => !part?.label?.trim() || !Number.isFinite(part.value) || part.value < 0);
  if (badIndex !== -1) {
    throw new Error(`FirstPrinciplesBuilder: every part needs a non-empty \`label\` and a finite non-negative \`value\`. Invalid part: ${badIndex}.`);
  }
  const fullTotal = parts.reduce((sum, part) => sum + part.value, 0);
  if (!Number.isFinite(fullTotal)) {
    throw new Error('FirstPrinciplesBuilder: the sum of `parts` must be finite.');
  }

  const reactId = useId();
  const [added, setAdded] = useState<boolean[]>(() => parts.map(() => false));

  const rebuilt = useMemo(
    () => parts.reduce((sum, p, i) => (added[i] ? sum + p.value : sum), 0),
    [parts, added],
  );
  const allIn = added.every(Boolean);

  // Both bars share one scale, even when the parts exceed the reference price.
  const scale = Math.max(analogyValue, fullTotal);
  const ratioText = `${(fullTotal / analogyValue).toLocaleString(numberLocale, { maximumFractionDigits: 2 })}×`;

  const toggle = (i: number) =>
    setAdded((prev) => prev.map((v, j) => (j === i ? !v : v)));

  const verdict = verdictTemplate
    .replace('{total}', format(fullTotal))
    .replace('{ratio}', ratioText);

  return (
    <figure className={cx('not-prose brutal my-6 bg-surface p-5 sm:p-6', className)}>
      <p className="font-display text-xs font-semibold uppercase tracking-wide text-brand-700">
        {eyebrow}
      </p>
      {title ? (
        <p className="mt-1 font-display text-lg font-semibold text-ink-900">{title}</p>
      ) : null}

      <div className="mt-4 space-y-4 rounded-card bg-surface-sunken p-4">
        <div>
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <span className="text-sm font-semibold text-ink-700">{analogyLabel}</span>
            <span className="font-display text-2xl font-semibold text-ink-700">{format(analogyValue)}</span>
          </div>
          <div className="mt-2 h-3 overflow-hidden rounded-pill bg-ink-200" aria-hidden="true">
            <div className="h-full origin-left rounded-pill bg-ink-500" style={{ width: `${analogyValue / scale * 100}%` }} />
          </div>
          {analogyNote ? <p className="mt-2 text-sm leading-relaxed text-ink-600">{analogyNote}</p> : null}
        </div>
        <div>
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1" aria-live="polite" aria-atomic="true">
            <span className="text-sm font-semibold text-ink-800">{rebuiltLabel}</span>
            <span className="font-display text-2xl font-semibold text-brand-700">{format(rebuilt)}</span>
          </div>
          <div className="mt-2 h-3 overflow-hidden rounded-pill bg-ink-200" aria-hidden="true">
            <div
              className="h-full origin-left rounded-pill bg-brand-600 transition-transform duration-300 ease-out motion-reduce:transition-none"
              style={{ transform: `scaleX(${rebuilt / scale})` }}
            />
          </div>
        </div>
      </div>

      {/* The parts to add back. */}
      <p className="mt-5 text-sm font-medium text-ink-700">{instructions}</p>
      <ul className="mt-2 grid gap-2 sm:grid-cols-2">
        {parts.map((p, i) => {
          const on = added[i];
          return (
            <li key={`${reactId}-${i}`}>
              <button
                type="button"
                onClick={() => toggle(i)}
                aria-pressed={on}
                className={cx(
                  'flex w-full items-start justify-between gap-3 rounded-card border-2 p-3 text-left transition-colors',
                  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-600',
                  on
                    ? 'border-accent-500 bg-accent-300/30'
                    : 'border-ink-200 bg-surface hover:border-accent-400 hover:bg-accent-300/15',
                )}
              >
                <span className="min-w-0">
                  <span className="flex items-center gap-1.5 font-semibold text-ink-900">
                    <span
                      aria-hidden
                      className={cx(
                        'inline-flex h-4 w-4 flex-none items-center justify-center rounded-pill border text-[0.6rem] font-bold',
                        on
                          ? 'border-accent-600 bg-accent-600 text-white'
                          : 'border-ink-300 text-transparent',
                      )}
                    >
                      ✓
                    </span>
                    {p.label}
                  </span>
                  {p.note ? (
                    <span className="mt-0.5 block text-xs leading-snug text-ink-500">
                      {p.note}
                    </span>
                  ) : null}
                </span>
                <span
                  className={cx(
                    'flex-none font-display text-sm font-bold',
                    on ? 'text-brand-700' : 'text-ink-400',
                  )}
                >
                  {format(p.value)}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {/* Controls */}
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setAdded(parts.map(() => true))}
          disabled={allIn}
          className="brutal-btn bg-accent-500 px-4 py-2 text-sm text-ink-900 disabled:cursor-default disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-600"
        >
          {revealAllLabel}
        </button>
        <button
          type="button"
          onClick={() => setAdded(parts.map(() => false))}
          disabled={!added.some(Boolean)}
          className="brutal-btn bg-surface px-4 py-2 text-sm text-ink-700 disabled:cursor-default disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-600"
        >
          {resetLabel}
        </button>
      </div>

      {/* Live verdict, announced when the rebuild is complete. */}
      <p aria-live="polite" aria-atomic="true" className="mt-4 min-h-[1.25rem]">
        {allIn ? (
          <span className="block rounded-card bg-accent-300/20 p-3 text-sm leading-relaxed text-ink-700">
            <span className="font-semibold text-brand-700">{verdict}</span>
          </span>
        ) : null}
      </p>

      {caption ? (
        <figcaption className="mt-3 text-sm text-ink-500">{caption}</figcaption>
      ) : null}
    </figure>
  );
}

export default FirstPrinciplesBuilder;
