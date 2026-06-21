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
  /** Label for the rebuilt running total. Defaults to `'Rebuilt from first principles'`. */
  rebuiltLabel?: string;
  /** Instruction line above the parts. Defaults to `'Add each irreducible part to rebuild the real cost:'`. */
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
   * placeholders, e.g. "Built from scratch it costs {total} — about {ratio} of
   * the assumed price." Defaults to a generic English sentence.
   */
  verdictTemplate?: string;
  /** Extra classes merged onto the root element. */
  className?: string;
}

/** Format a number with optional prefix/suffix, trimming trailing `.0`. */
function fmt(n: number, prefix: string, suffix: string): string {
  const rounded = Math.round(n * 100) / 100;
  const body = Number.isInteger(rounded)
    ? rounded.toLocaleString('en-US')
    : rounded.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  return `${prefix}${body}${suffix}`;
}

/**
 * Interactive **decompose-then-rebuild** island — the engine of first-principles
 * thinking made tangible.
 *
 * One big number sits at the top: the price everyone *assumes* a thing costs,
 * because that's what it has always cost ("reasoning by analogy"). Below it, the
 * learner clicks the thing's irreducible parts one at a time. Each click adds
 * that part's real cost to a running total and grows a bar — so the rebuilt,
 * from-scratch figure assembles in front of them and the gap against the assumed
 * price becomes visible. When every part is in, a verdict spells out the ratio.
 *
 * Every part is a real `<button>` with `aria-pressed`, the running total is in an
 * `aria-live` region, and nothing depends on motion — the bar simply snaps wider
 * for `prefers-reduced-motion` users. Fully keyboard-operable.
 */
export function FirstPrinciplesBuilder({
  title,
  eyebrow = 'Decompose, then rebuild',
  caption,
  analogyValue,
  analogyLabel = 'The "by analogy" price',
  analogyNote,
  parts,
  rebuiltLabel = 'Rebuilt from first principles',
  instructions = 'Add each irreducible part to rebuild the real cost:',
  valuePrefix = '$',
  valueSuffix = '',
  revealAllLabel = 'Add all parts',
  resetLabel = 'Start over',
  verdictTemplate = 'From scratch it comes to {total} — about {ratio} of the price everyone assumed. That gap is what reasoning from first principles uncovers.',
  className,
}: FirstPrinciplesBuilderProps) {
  // Fail the build on a mis-authored figure rather than shipping a broken island.
  if (!Array.isArray(parts) || parts.length < 2) {
    throw new Error('FirstPrinciplesBuilder: needs at least two `parts`.');
  }
  if (!(analogyValue > 0)) {
    throw new Error('FirstPrinciplesBuilder: `analogyValue` must be a positive number.');
  }
  const badPart = parts.find((p) => !p?.label?.trim() || !(p.value >= 0));
  if (badPart) {
    throw new Error(
      `FirstPrinciplesBuilder: every part needs a non-empty \`label\` and a non-negative ` +
        `\`value\`. Offending part: "${badPart?.label ?? '(missing label)'}".`,
    );
  }

  const reactId = useId();
  const [added, setAdded] = useState<boolean[]>(() => parts.map(() => false));

  const rebuilt = useMemo(
    () => parts.reduce((sum, p, i) => (added[i] ? sum + p.value : sum), 0),
    [parts, added],
  );
  const allIn = added.every(Boolean);
  const fullTotal = useMemo(() => parts.reduce((s, p) => s + p.value, 0), [parts]);

  // The bar is scaled so the analogy price spans the full track; the rebuilt
  // total is drawn as a proportion of it (capped at 100% in the rare case the
  // parts exceed the assumption).
  const pct = Math.min(100, (rebuilt / analogyValue) * 100);
  const ratioText = `${(fullTotal / analogyValue).toFixed(2)}×`;

  const toggle = (i: number) =>
    setAdded((prev) => prev.map((v, j) => (j === i ? !v : v)));

  const verdict = verdictTemplate
    .replace('{total}', fmt(fullTotal, valuePrefix, valueSuffix))
    .replace('{ratio}', ratioText);

  return (
    <figure className={cx('brutal my-6 bg-surface p-5 sm:p-6', className)}>
      <p className="font-display text-xs font-semibold uppercase tracking-wide text-accent-600">
        {eyebrow}
      </p>
      {title ? (
        <p className="mt-1 font-display text-lg font-semibold text-ink-900">{title}</p>
      ) : null}

      {/* The assumption everyone starts from. */}
      <div className="mt-4 rounded-card border border-ink-200 bg-surface-sunken p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">
          {analogyLabel}
        </p>
        <p className="mt-0.5 font-display text-3xl font-bold text-ink-400 line-through decoration-ink-300 decoration-2">
          {fmt(analogyValue, valuePrefix, valueSuffix)}
        </p>
        {analogyNote ? (
          <p className="mt-1 text-sm leading-relaxed text-ink-500">{analogyNote}</p>
        ) : null}
      </div>

      {/* The rebuilt figure, assembled live. */}
      <div className="mt-4">
        <div className="mb-1.5 flex items-baseline justify-between gap-3">
          <span className="text-sm font-semibold text-ink-800">{rebuiltLabel}</span>
          <span className="font-display text-2xl font-bold text-accent-600">
            {fmt(rebuilt, valuePrefix, valueSuffix)}
          </span>
        </div>
        <div
          className="relative h-4 w-full overflow-hidden rounded-pill border border-ink-200 bg-surface-sunken"
          role="img"
          aria-label={`Rebuilt total is ${fmt(rebuilt, valuePrefix, valueSuffix)} of an assumed ${fmt(analogyValue, valuePrefix, valueSuffix)}.`}
        >
          <div
            className="h-full rounded-pill bg-accent-500 transition-[width] duration-500 ease-out motion-reduce:transition-none"
            style={{ width: `${pct}%` }}
          />
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
                    on ? 'text-accent-600' : 'text-ink-400',
                  )}
                >
                  {fmt(p.value, valuePrefix, valueSuffix)}
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
          className="brutal-btn bg-accent-500 px-4 py-2 text-sm text-ink-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-600"
        >
          {revealAllLabel}
        </button>
        <button
          type="button"
          onClick={() => setAdded(parts.map(() => false))}
          className="brutal-btn bg-surface px-4 py-2 text-sm text-ink-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-600"
        >
          {resetLabel}
        </button>
      </div>

      {/* Live verdict, announced when the rebuild is complete. */}
      <p aria-live="polite" className="mt-4 min-h-[1.25rem]">
        {allIn ? (
          <span className="block rounded-card border border-accent-400 bg-accent-300/20 p-3 text-sm leading-relaxed text-ink-700">
            <span className="font-semibold text-accent-600">{verdict}</span>
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
