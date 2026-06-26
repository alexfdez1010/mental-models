import { useId, useMemo, useState } from 'react';
import { cx } from '@/components/react/cx';

/** A good being produced ("shirts", "code") plus an optional unit suffix. */
export interface CAGood {
  /** The good's name, lower-case ("websites", "loaves of bread"). */
  name: string;
  /** Optional short unit shown after a quantity (e.g. `' h'`). Rarely needed. */
  unit?: string;
}

/** One producer (a person, team, or country). */
export interface CAParty {
  /** Display name ("Maya", "Northland"). */
  name: string;
}

/** Props for the {@link ComparativeAdvantageExplorer} island. */
export interface ComparativeAdvantageExplorerProps {
  /** The first good on the table. */
  goodA: CAGood;
  /** The second good on the table. */
  goodB: CAGood;
  /** The first producer. */
  partyA: CAParty;
  /** The second producer. */
  partyB: CAParty;
  /** Party A's output of good A per hour (starting slider value). */
  initialAOnA?: number;
  /** Party A's output of good B per hour. */
  initialAOnB?: number;
  /** Party B's output of good A per hour. */
  initialBOnA?: number;
  /** Party B's output of good B per hour. */
  initialBOnB?: number;
  /** Slider minimum (defaults to 1). */
  min?: number;
  /** Slider maximum (defaults to 12). */
  max?: number;
  /** Slider step (defaults to 1). */
  step?: number;

  /** Heading above the card. */
  title?: string;
  /** Eyebrow label. Defaults to `'Who should specialize in what?'`. */
  eyebrow?: string;
  /** Instruction line. */
  instructions?: string;
  /** Caption beneath the card. */
  caption?: string;

  /** Column header for "output per hour". Defaults to `'Output per hour'`. */
  perHourLabel?: string;
  /** Heading of the productivity block. Defaults to `'Productivity'`. */
  productivityLabel?: string;
  /** Heading of the opportunity-cost block. Defaults to `'Opportunity cost'`. */
  oppCostLabel?: string;
  /** Producer column header. Defaults to `'Producer'`. */
  producerLabel?: string;
  /** Template `'1 {good} costs'`; `{good}` is replaced. Defaults to `'1 {good} costs'`. */
  costsLabel?: string;
  /** Absolute-advantage block heading. Defaults to `'Absolute advantage'`. */
  absoluteLabel?: string;
  /**
   * Sentence stating who is faster at both goods. `{party}` is replaced.
   * Defaults to `'{party} is faster at BOTH goods — but raw speed is a trap.'`.
   */
  absoluteBothTemplate?: string;
  /**
   * Sentence when each party is faster at one good. `{a}`,`{ga}`,`{b}`,`{gb}`
   * are replaced. Defaults to a per-good split.
   */
  absoluteSplitTemplate?: string;
  /** Verdict block heading. Defaults to `'The comparative-advantage verdict'`. */
  verdictLabel?: string;
  /**
   * Verdict sentence. `{a}`,`{ga}`,`{b}`,`{gb}` are replaced. Defaults to a
   * "should specialize in" sentence.
   */
  verdictTemplate?: string;
  /** Shown when both parties' opportunity costs are equal (no gains from trade). */
  noAdvantageText?: string;
  /** Terms-of-trade block heading. Defaults to `'The win-win trading window'`. */
  termsLabel?: string;
  /**
   * Terms-of-trade sentence. `{lo}`,`{hi}`,`{ga}`,`{gb}` are replaced.
   * Defaults to a "both gain when they swap at a rate between" sentence.
   */
  termsTemplate?: string;
  /** Small word for "per hour" used in the productivity cells. Defaults to `'/h'`. */
  perHourUnit?: string;
  /** Extra classes merged onto the root element. */
  className?: string;
}

/** Round to at most 2 decimals and drop trailing zeros. */
function tidy(n: number): string {
  if (!Number.isFinite(n)) return '∞';
  const r = Math.round(n * 100) / 100;
  return String(r);
}

/**
 * Interactive **comparative-advantage explorer** — the most counter-intuitive
 * result in economics, made tangible: even the producer who is faster at
 * *everything* should still specialize and trade.
 *
 * Two producers, two goods, and a slider for each of the four output-per-hour
 * numbers. From those alone the island derives the whole model:
 *
 *   • **Absolute advantage** — who is simply faster at each good (raw speed).
 *   • **Opportunity cost** — what each producer gives up of the *other* good to
 *     make one unit of this one. This is the engine of the model, so the lower
 *     cost in each column is highlighted.
 *   • **Comparative advantage** — the producer with the *lower opportunity cost*
 *     in a good should specialize in it, even if the other is faster at both.
 *   • **The trading window** — the range of exchange rates at which a swap makes
 *     *both* parties better off, proving the gains from trade are real.
 *
 * The teaching payload is the gap between absolute and comparative advantage:
 * dragging one producer far ahead on *both* goods never erases their partner's
 * comparative advantage in the good they sacrifice least to make. The tables are
 * real `<table>`s, the verdict is announced via `aria-live`, and nothing depends
 * on motion, so it is fully usable under `prefers-reduced-motion`.
 */
export function ComparativeAdvantageExplorer({
  goodA,
  goodB,
  partyA,
  partyB,
  initialAOnA = 6,
  initialAOnB = 4,
  initialBOnA = 1,
  initialBOnB = 2,
  min = 1,
  max = 12,
  step = 1,
  title,
  eyebrow = 'Who should specialize in what?',
  instructions = 'Drag the sliders to set how much each producer makes per hour. Watch who has the lower opportunity cost — that, not raw speed, decides who should specialize.',
  caption,
  perHourLabel = 'Output per hour',
  productivityLabel = 'Productivity',
  oppCostLabel = 'Opportunity cost',
  producerLabel = 'Producer',
  costsLabel = '1 {good} costs',
  absoluteLabel = 'Absolute advantage',
  absoluteBothTemplate = '{party} is faster at BOTH goods — but raw speed is a trap. Comparative advantage is about cost, not speed.',
  absoluteSplitTemplate = '{a} is faster at {ga}; {b} is faster at {gb}. Each has an absolute advantage in one good.',
  verdictLabel = 'The comparative-advantage verdict',
  verdictTemplate = '{a} should specialize in {ga}; {b} should specialize in {gb} — then trade. Each does what they give up the least to do.',
  noAdvantageText = 'Both producers have identical opportunity costs, so neither has a comparative advantage — and there are no gains from trade. Nudge a slider to break the tie.',
  termsLabel = 'The win-win trading window',
  termsTemplate = 'Both gain whenever they swap 1 {ga} for between {lo} and {hi} {gb}. Inside that window, each ends up with more than they could make alone.',
  perHourUnit = '/h',
  className,
}: ComparativeAdvantageExplorerProps) {
  const reactId = useId();
  const [aOnA, setAOnA] = useState(initialAOnA);
  const [aOnB, setAOnB] = useState(initialAOnB);
  const [bOnA, setBOnA] = useState(initialBOnA);
  const [bOnB, setBOnB] = useState(initialBOnB);

  const analysis = useMemo(() => {
    // Opportunity cost of 1 unit of good A, measured in good B forgone:
    // (good B you could have made) / (good A you make), per hour.
    const aCostOfA = aOnB / aOnA; // party A: cost of 1 A in B
    const bCostOfA = bOnB / bOnA; // party B: cost of 1 A in B
    const aCostOfB = aOnA / aOnB; // party A: cost of 1 B in A
    const bCostOfB = bOnA / bOnB; // party B: cost of 1 B in A

    // Comparative advantage in A → the lower opportunity cost of A.
    const tie = Math.abs(aCostOfA - bCostOfA) < 1e-9;
    const aHasCompA = aCostOfA < bCostOfA;

    // Absolute advantage (raw speed).
    const aFasterA = aOnA > bOnA;
    const aFasterB = aOnB > bOnB;
    const aFasterBoth = aFasterA && aFasterB;
    const bFasterBoth = !aFasterA && !aFasterB;

    return {
      aCostOfA,
      bCostOfA,
      aCostOfB,
      bCostOfB,
      tie,
      // The party that should make good A (and the other makes good B).
      compAParty: aHasCompA ? partyA : partyB,
      compBParty: aHasCompA ? partyB : partyA,
      aFasterA,
      aFasterB,
      aFasterBoth,
      bFasterBoth,
      // Trading window for 1 good A priced in good B: between the two costs.
      tradeLo: Math.min(aCostOfA, bCostOfA),
      tradeHi: Math.max(aCostOfA, bCostOfA),
    };
  }, [aOnA, aOnB, bOnA, bOnB, partyA, partyB]);

  const fmtGood = (n: number, g: CAGood) => `${tidy(n)}${g.unit ?? ''}`;

  // The "1 A costs … B" column: lower opportunity cost is the comparative-
  // advantage holder for good A. Likewise for the "1 B costs … A" column.
  const aWinsCostA = !analysis.tie && analysis.aCostOfA < analysis.bCostOfA;
  const aWinsCostB = !analysis.tie && analysis.aCostOfB < analysis.bCostOfB;

  const absoluteText = analysis.aFasterBoth
    ? absoluteBothTemplate.replace('{party}', partyA.name)
    : analysis.bFasterBoth
      ? absoluteBothTemplate.replace('{party}', partyB.name)
      : absoluteSplitTemplate
          .replace('{a}', analysis.aFasterA ? partyA.name : partyB.name)
          .replace('{ga}', goodA.name)
          .replace('{b}', analysis.aFasterB ? partyA.name : partyB.name)
          .replace('{gb}', goodB.name);

  const verdictText = analysis.tie
    ? noAdvantageText
    : verdictTemplate
        .replace('{a}', analysis.compAParty.name)
        .replace('{ga}', goodA.name)
        .replace('{b}', analysis.compBParty.name)
        .replace('{gb}', goodB.name);

  const termsText = termsTemplate
    .replace('{ga}', goodA.name)
    .replace('{gb}', goodB.name)
    .replace('{lo}', tidy(analysis.tradeLo))
    .replace('{hi}', tidy(analysis.tradeHi));

  const sliders: Array<{ label: string; value: number; set: (n: number) => void }> = [
    { label: `${partyA.name} → ${goodA.name}`, value: aOnA, set: setAOnA },
    { label: `${partyA.name} → ${goodB.name}`, value: aOnB, set: setAOnB },
    { label: `${partyB.name} → ${goodA.name}`, value: bOnA, set: setBOnA },
    { label: `${partyB.name} → ${goodB.name}`, value: bOnB, set: setBOnB },
  ];

  return (
    <figure className={cx('brutal my-6 bg-surface p-5 sm:p-6', className)}>
      <p className="font-display text-xs font-semibold uppercase tracking-wide text-accent-600">
        {eyebrow}
      </p>
      {title ? (
        <p className="mt-1 font-display text-lg font-semibold text-ink-900">{title}</p>
      ) : null}
      <p className="mt-3 text-sm font-medium text-ink-700">{instructions}</p>

      {/* Sliders — the four output-per-hour numbers. */}
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {sliders.map((s, i) => (
          <label key={`${reactId}-slider-${i}`} className="block">
            <span className="flex items-baseline justify-between gap-2">
              <span className="text-sm font-medium text-ink-700">{s.label}</span>
              <span className="font-mono text-xs font-semibold text-ink-900">
                {s.value}
                {perHourUnit}
              </span>
            </span>
            <input
              type="range"
              min={min}
              max={max}
              step={step}
              value={s.value}
              onChange={(e) => s.set(Number(e.target.value))}
              className="mt-1 w-full accent-accent-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-600"
            />
          </label>
        ))}
      </div>

      {/* Productivity — raw output per hour (absolute advantage lives here). */}
      <div className="mt-5 overflow-x-auto">
        <p className="text-[0.65rem] font-bold uppercase tracking-wide text-ink-500">
          {productivityLabel} — {perHourLabel}
        </p>
        <table className="mt-2 w-full border-collapse text-sm">
          <thead>
            <tr className="text-left text-ink-500">
              <th className="border-b-2 border-ink-200 px-2 py-1 font-semibold">{producerLabel}</th>
              <th className="border-b-2 border-ink-200 px-2 py-1 text-right font-semibold">{goodA.name}</th>
              <th className="border-b-2 border-ink-200 px-2 py-1 text-right font-semibold">{goodB.name}</th>
            </tr>
          </thead>
          <tbody className="font-mono">
            <tr>
              <td className="border-b border-ink-100 px-2 py-1 font-sans font-medium text-ink-900">{partyA.name}</td>
              <td className={cx('border-b border-ink-100 px-2 py-1 text-right', analysis.aFasterA ? 'font-semibold text-ink-900' : 'text-ink-500')}>{fmtGood(aOnA, goodA)}</td>
              <td className={cx('border-b border-ink-100 px-2 py-1 text-right', analysis.aFasterB ? 'font-semibold text-ink-900' : 'text-ink-500')}>{fmtGood(aOnB, goodB)}</td>
            </tr>
            <tr>
              <td className="px-2 py-1 font-sans font-medium text-ink-900">{partyB.name}</td>
              <td className={cx('px-2 py-1 text-right', !analysis.aFasterA ? 'font-semibold text-ink-900' : 'text-ink-500')}>{fmtGood(bOnA, goodA)}</td>
              <td className={cx('px-2 py-1 text-right', !analysis.aFasterB ? 'font-semibold text-ink-900' : 'text-ink-500')}>{fmtGood(bOnB, goodB)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Opportunity cost — the real engine; lower cost per column is the
          comparative-advantage holder and is highlighted. */}
      <div className="mt-5 overflow-x-auto">
        <p className="text-[0.65rem] font-bold uppercase tracking-wide text-ink-500">{oppCostLabel}</p>
        <table className="mt-2 w-full border-collapse text-sm">
          <thead>
            <tr className="text-left text-ink-500">
              <th className="border-b-2 border-ink-200 px-2 py-1 font-semibold">{producerLabel}</th>
              <th className="border-b-2 border-ink-200 px-2 py-1 text-right font-semibold">
                {costsLabel.replace('{good}', goodA.name)}
              </th>
              <th className="border-b-2 border-ink-200 px-2 py-1 text-right font-semibold">
                {costsLabel.replace('{good}', goodB.name)}
              </th>
            </tr>
          </thead>
          <tbody className="font-mono">
            <tr>
              <td className="border-b border-ink-100 px-2 py-1 font-sans font-medium text-ink-900">{partyA.name}</td>
              <td className={cx('border-b border-ink-100 px-2 py-1 text-right', aWinsCostA ? 'bg-accent-50 font-semibold text-accent-700' : 'text-ink-500')}>{tidy(analysis.aCostOfA)} {goodB.name}</td>
              <td className={cx('border-b border-ink-100 px-2 py-1 text-right', aWinsCostB ? 'bg-accent-50 font-semibold text-accent-700' : 'text-ink-500')}>{tidy(analysis.aCostOfB)} {goodA.name}</td>
            </tr>
            <tr>
              <td className="px-2 py-1 font-sans font-medium text-ink-900">{partyB.name}</td>
              <td className={cx('px-2 py-1 text-right', !analysis.tie && !aWinsCostA ? 'bg-accent-50 font-semibold text-accent-700' : 'text-ink-500')}>{tidy(analysis.bCostOfA)} {goodB.name}</td>
              <td className={cx('px-2 py-1 text-right', !analysis.tie && !aWinsCostB ? 'bg-accent-50 font-semibold text-accent-700' : 'text-ink-500')}>{tidy(analysis.bCostOfB)} {goodA.name}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Absolute advantage — the speed framing the model overturns. */}
      <p className="mt-4 rounded-card border-l-4 border-ink-300 bg-surface-sunken p-3 text-sm text-ink-700">
        <span className="font-semibold text-ink-900">{absoluteLabel}:</span> {absoluteText}
      </p>

      {/* The verdict + trading window, announced for screen readers. */}
      <div aria-live="polite">
        <div className="mt-3 rounded-card border-2 border-accent-200 bg-accent-50 p-4 motion-safe:animate-fade-up">
          <p className="text-sm text-ink-800">
            <span className="font-semibold text-accent-700">{verdictLabel}:</span> {verdictText}
          </p>
          {!analysis.tie ? (
            <p className="mt-3 border-t border-accent-200 pt-3 text-sm text-ink-700">
              <span className="font-semibold text-ink-900">{termsLabel}:</span> {termsText}
            </p>
          ) : null}
        </div>
      </div>

      {caption ? (
        <figcaption className="mt-3 text-sm text-ink-500">{caption}</figcaption>
      ) : null}
    </figure>
  );
}

export default ComparativeAdvantageExplorer;
