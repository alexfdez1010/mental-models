import { useId, useMemo, useState } from 'react';
import { cx } from '@/components/react/cx';

/** One psychological tendency the learner can switch on in the scenario. */
export interface BiasStackItem {
  /** Display name of the bias (e.g. "Social proof"). */
  label: string;
  /** One-line gloss of how this bias pushes in the scenario. */
  blurb?: string;
  /**
   * The bias's *own* force in isolation, as a fraction 0…1 of the meter. Small
   * on its own — the point of the island is that several small forces combine
   * into something far larger than their sum.
   */
  weight: number;
}

/** Props for the {@link BiasStack} island. */
export interface BiasStackProps {
  /** Heading above the card. */
  title?: string;
  /** Eyebrow label. Defaults to `'Lollapalooza effect'`. */
  eyebrow?: string;
  /** Instruction line above the controls. */
  instructions?: string;
  /** Caption beneath the card. */
  caption?: string;
  /** Name of the scenario whose pressure is being measured. */
  scenarioLabel?: string;
  /** The biases the learner can toggle on. */
  biases?: BiasStackItem[];
  /** Label over the main (multiplicative) meter. */
  meterLabel?: string;
  /** Label for the ghost marker showing the merely-additive prediction. */
  additiveLabel?: string;
  /** Label for the threshold line the combined force must cross to "tip". */
  thresholdLabel?: string;
  /** Fraction 0…100 at which the scenario tips into runaway behaviour. */
  threshold?: number;
  /** Verdict when combined force is well below the threshold. */
  verdictCalm?: string;
  /** Verdict when combined force is climbing but still below the threshold. */
  verdictBuilding?: string;
  /** Verdict once combined force crosses the threshold. */
  verdictTipped?: string;
  /**
   * Readout template. `{n}`/`{additive}`/`{combined}`/`{gap}`/`{verdict}` are
   * replaced with the live values.
   */
  readout?: string;
  /** Extra classes merged onto the root element. */
  className?: string;
}

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const round = (n: number) => Math.round(n);

/**
 * How strongly each *extra* active bias amplifies the whole stack. With one
 * bias active the combined force just equals its own weight; each additional
 * bias switched on multiplies the running sum by (1 + SYNERGY) more, so the
 * combined force pulls away from the plain additive sum — the visual heart of
 * the lesson: biases don't add, they multiply.
 */
const SYNERGY = 0.5;

const DEFAULT_BIASES: BiasStackItem[] = [
  { label: 'Social proof', blurb: 'everyone around you is bidding, so it must be sensible', weight: 0.16 },
  { label: 'Commitment & consistency', blurb: 'you already bid once — backing out now feels like a defeat', weight: 0.15 },
  { label: 'Loss aversion', blurb: 'letting the prize slip hurts more than overpaying', weight: 0.17 },
  { label: 'Reciprocation', blurb: 'the seller was warm and generous — you feel you owe a bid', weight: 0.12 },
  { label: 'Scarcity', blurb: '"going once, going twice" — the clock says act NOW', weight: 0.15 },
];

/**
 * Interactive **Lollapalooza-effect** island — the point where several
 * cognitive biases stop acting in isolation and *combine*. The learner is shown
 * a scenario (by default a bidding war at an auction) and a row of toggles, one
 * per psychological tendency in play. Switching biases on drives a **pressure
 * meter**.
 *
 * The teaching trick is the contrast between two numbers. The faint **additive**
 * marker shows what the pressure would be if the biases simply *added up* — the
 * sum of their individual weights. The solid meter shows the **combined** force
 * under a multiplicative model, where each extra bias amplifies the whole stack.
 * With one toggle on the two coincide; flip several on at once and the combined
 * force pulls sharply ahead of the additive sum and vaults over the **threshold**
 * where the scenario tips into runaway, irrational behaviour — a bidding frenzy,
 * a mania, a stampede. That gap, widening as more biases stack, is the
 * Lollapalooza effect made visible: the forces don't add, they multiply.
 *
 * All controls are native checkboxes with visible labels; the readout is
 * announced via `aria-live`; the only motion is a cosmetic width tween, disabled
 * under `prefers-reduced-motion`.
 */
export function BiasStack({
  title,
  eyebrow = 'Lollapalooza effect',
  instructions = 'Each switch adds one more psychological tendency pushing the same way. Flip them on one at a time and watch the meter — then notice how far the combined force pulls ahead of what the biases would reach if they merely added up.',
  caption,
  scenarioLabel = 'Pressure to overbid at a heated auction',
  biases = DEFAULT_BIASES,
  meterLabel = 'Combined force pushing you to act',
  additiveLabel = 'if the biases only added up',
  thresholdLabel = 'tips into a bidding frenzy',
  threshold = 70,
  verdictCalm = 'you can still think — no single tendency is strong enough to override your judgement',
  verdictBuilding = 'the pressure is climbing fast; each bias you add makes the others bite harder',
  verdictTipped = 'the stack has tipped you over — judgement is swamped and you act against your own interest',
  readout = '{n} biases active → they would sum to {additive}%, but combined they reach {combined}% — a {gap}-point Lollapalooza gap. {verdict}.',
  className,
}: BiasStackProps) {
  const reactId = useId();
  const [active, setActive] = useState<boolean[]>(() => biases.map(() => false));

  const toggle = (i: number) =>
    setActive((prev) => prev.map((v, j) => (j === i ? !v : v)));

  const model = useMemo(() => {
    const activeWeights = biases.filter((_, i) => active[i]).map((b) => b.weight);
    const n = activeWeights.length;
    const sum = activeWeights.reduce((acc, w) => acc + w, 0);
    // Additive prediction: the biases merely added.
    const additive = clamp(sum * 100, 0, 100);
    // Multiplicative reality: each *extra* active bias amplifies the whole sum.
    const synergyFactor = 1 + SYNERGY * Math.max(0, n - 1);
    const combined = clamp(sum * synergyFactor * 100, 0, 100);
    const gap = round(combined) - round(additive);
    const tipped = combined >= threshold;
    const building = !tipped && combined >= threshold * 0.45;
    return { n, additive: round(additive), combined: round(combined), gap, tipped, building };
  }, [active, biases, threshold]);

  const { n, additive, combined, gap, tipped, building } = model;

  const verdictWord = tipped ? verdictTipped : building ? verdictBuilding : verdictCalm;
  const meterColor = tipped
    ? 'var(--color-danger)'
    : building
      ? 'var(--color-accent-500)'
      : 'var(--color-brand-500)';

  const readoutText = readout
    .replace('{n}', String(n))
    .replace('{additive}', String(additive))
    .replace('{combined}', String(combined))
    .replace('{gap}', String(gap))
    .replace('{verdict}', verdictWord);

  const tween = 'transition-all duration-500 ease-out motion-reduce:transition-none';

  return (
    <figure className={cx('brutal my-6 bg-surface p-5 sm:p-6', className)}>
      <p className="font-display text-xs font-semibold uppercase tracking-wide text-brand-600">
        {eyebrow}
      </p>
      {title ? (
        <p className="mt-1 font-display text-lg font-semibold text-ink-900">{title}</p>
      ) : null}

      <p className="mt-2 text-sm font-medium text-ink-700">{instructions}</p>

      {/* Scenario chip */}
      <p className="mt-4 inline-flex rounded-pill bg-surface-sunken px-3 py-1 text-xs font-semibold text-ink-600">
        {scenarioLabel}
      </p>

      {/* The meter */}
      <div className="mt-3">
        <div className="flex items-baseline justify-between">
          <span className="text-[0.65rem] font-bold uppercase tracking-wide text-ink-600">
            {meterLabel}
          </span>
          <span className="text-sm font-semibold tabular-nums text-ink-800">{combined}%</span>
        </div>
        <div className="relative mt-2 h-7 w-full overflow-hidden rounded-pill bg-surface-sunken">
          {/* Combined (multiplicative) fill */}
          <div
            className={cx('h-full rounded-pill', tween)}
            style={{ width: `${combined}%`, background: meterColor }}
          />
          {/* Additive-prediction ghost marker */}
          <div
            className={cx('absolute inset-y-0 w-0.5 bg-ink-700/70', tween)}
            style={{ left: `${additive}%` }}
            aria-hidden
          />
          {/* Threshold line */}
          <div
            className="absolute inset-y-0 w-0.5 border-l-2 border-dashed border-ink-800"
            style={{ left: `${threshold}%` }}
            aria-hidden
          />
        </div>
        {/* Legend under the meter */}
        <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[0.65rem] font-medium text-ink-500">
          <span className="inline-flex items-center gap-1">
            <span aria-hidden className="inline-block h-2.5 w-0.5 bg-ink-700/70" />
            {additiveLabel} ({additive}%)
          </span>
          <span className="inline-flex items-center gap-1">
            <span aria-hidden className="inline-block h-2.5 w-0.5 border-l-2 border-dashed border-ink-800" />
            {thresholdLabel} ({threshold}%)
          </span>
        </div>
      </div>

      {/* Live readout */}
      <p
        aria-live="polite"
        className={cx(
          'mt-4 rounded-card border p-3 text-sm leading-relaxed',
          tipped
            ? 'border-danger/30 bg-danger/5 text-ink-800'
            : 'border-brand-200 bg-brand-50/70 text-ink-700',
        )}
      >
        {readoutText}
      </p>

      {/* Bias toggles */}
      <fieldset className="mt-4">
        <legend className="text-[0.65rem] font-bold uppercase tracking-wide text-ink-600">
          Tendencies in play — switch each one on
        </legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {biases.map((b, i) => {
            const on = active[i];
            return (
              <label
                key={b.label}
                htmlFor={`${reactId}-b${i}`}
                className={cx(
                  'flex cursor-pointer items-start gap-2.5 rounded-card border p-2.5 text-left',
                  tween,
                  on
                    ? 'border-brand-500 bg-brand-50/60'
                    : 'border-ink-100 bg-surface-sunken hover:border-ink-300',
                )}
              >
                <input
                  id={`${reactId}-b${i}`}
                  type="checkbox"
                  checked={on}
                  onChange={() => toggle(i)}
                  className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-brand-500"
                />
                <span>
                  <span className="block text-sm font-semibold text-ink-800">{b.label}</span>
                  {b.blurb ? (
                    <span className="mt-0.5 block text-xs leading-snug text-ink-500">{b.blurb}</span>
                  ) : null}
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      {caption ? <figcaption className="mt-4 text-sm text-ink-500">{caption}</figcaption> : null}
    </figure>
  );
}

export default BiasStack;
