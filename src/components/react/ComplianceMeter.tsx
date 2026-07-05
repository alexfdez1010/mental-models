import { useId, useMemo, useState } from 'react';
import { cx } from '@/components/react/cx';

/** One principle of influence the learner can switch on in the scenario. */
export interface ComplianceLever {
  /** Display name of the lever (e.g. "Reciprocity"). */
  label: string;
  /** One-line gloss of how this lever pushes toward "yes" in the scenario. */
  blurb?: string;
  /**
   * The lever's *own* pull in isolation, as a fraction 0…1 of the meter. Modest
   * on its own — a single tactic rarely closes a deal. The teaching point is
   * that a few aligned levers add up to a genuine "yes", while piling on too
   * many transparent tactics makes the target feel *handled* and backfires.
   */
  weight: number;
}

/** Props for the {@link ComplianceMeter} island. */
export interface ComplianceMeterProps {
  /** Heading above the card. */
  title?: string;
  /** Eyebrow label. Defaults to `'Influence & persuasion'`. */
  eyebrow?: string;
  /** Instruction line above the controls. */
  instructions?: string;
  /** Caption beneath the card. */
  caption?: string;
  /** Name of the scenario whose "yes" likelihood is being measured. */
  scenarioLabel?: string;
  /** The levers of influence the learner can toggle on. */
  levers?: ComplianceLever[];
  /** Label over the main (real, reactance-adjusted) meter. */
  meterLabel?: string;
  /** Label for the ghost marker showing the naive "more tactics = more yes" line. */
  naiveLabel?: string;
  /** Label for the threshold line the pull must cross to earn a "yes". */
  thresholdLabel?: string;
  /** Fraction 0…100 at which the target says "yes". Default 40. */
  threshold?: number;
  /**
   * How many levers can stack before the target starts to feel *handled* and
   * reactance sets in. Beyond this count each extra transparent tactic subtracts
   * from the real chance of a yes. Default 4.
   */
  reactanceOnset?: number;
  /** Verdict when the pull is too weak to earn a yes. */
  verdictCold?: string;
  /** Verdict when a few aligned levers land in the persuasive sweet spot. */
  verdictPersuaded?: string;
  /** Verdict when too many transparent tactics trigger reactance and backfire. */
  verdictBackfire?: string;
  /**
   * Readout template. `{n}`/`{naive}`/`{yes}`/`{reactance}`/`{verdict}` are
   * replaced with the live values.
   */
  readout?: string;
  /** Extra classes merged onto the root element. */
  className?: string;
}

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const round = (n: number) => Math.round(n);

/**
 * How much each *extra* lever past the reactance onset eats into the real chance
 * of a yes. Piling on transparent tactics makes the target notice the machinery
 * ("this is obviously a sales trick"), and the resulting reactance drags the
 * modelled yes-likelihood back down — the visual heart of the ethics lesson:
 * persuasion is not monotone in tactics.
 */
const REACTANCE_STEP = 0.2;

const DEFAULT_LEVERS: ComplianceLever[] = [
  { label: 'Reciprocity', blurb: 'a free sample or small favour first — you feel a pull to repay it', weight: 0.16 },
  { label: 'Commitment & consistency', blurb: 'a tiny yes you already gave that this next yes must match', weight: 0.15 },
  { label: 'Social proof', blurb: '"best-seller", a visible crowd of others already buying', weight: 0.15 },
  { label: 'Authority', blurb: 'a credible expert, a title, a white coat vouching for it', weight: 0.14 },
  { label: 'Liking', blurb: 'a warm, similar, complimentary salesperson you enjoy dealing with', weight: 0.13 },
  { label: 'Scarcity', blurb: '"only 3 left", a deadline — you could lose the chance', weight: 0.15 },
  { label: 'Unity', blurb: '"one of us" — a shared identity, team or family', weight: 0.13 },
];

/**
 * Interactive **influence & persuasion** island — a "compliance meter". The
 * learner is shown a scenario (by default a sales close) and a row of toggles,
 * one per principle of influence (reciprocity, commitment, social proof,
 * authority, liking, scarcity, unity). Switching levers on drives a meter
 * estimating how likely the target is to say **yes**.
 *
 * The teaching trick is that persuasion is **not monotone in tactics**. A faint
 * **naive** marker shows what the chance of a yes would be if more levers always
 * meant more yes — the sum of their pulls. The solid meter shows the **real**
 * chance once *reactance* is modelled: past a handful of levers the target starts
 * to feel *handled*, notices the machinery, and pushes back. Flip on three or
 * four aligned levers and the meter climbs past the **threshold** into a genuine
 * yes; keep stacking transparent tactics and the solid bar peels away *below* the
 * naive marker and slides into the red — obvious manipulation that backfires.
 * The gap between "if more always helped" and "what it actually reaches" is the
 * ethics of persuasion made visible: the honest sweet spot sits well short of
 * "pull every lever at once".
 *
 * All controls are native checkboxes with visible labels; the readout is
 * announced via `aria-live`; the only motion is a cosmetic width tween, disabled
 * under `prefers-reduced-motion`.
 */
export function ComplianceMeter({
  title,
  eyebrow = 'Influence & persuasion',
  instructions = 'Each switch adds one principle of influence pushing toward "yes". Flip a few on and watch the meter climb — then keep stacking and watch the target start to feel handled, so the real chance of a yes peels away below the naive line and backfires.',
  caption,
  scenarioLabel = 'Chance the prospect says "yes" to the close',
  levers = DEFAULT_LEVERS,
  meterLabel = 'Real chance of a "yes"',
  naiveLabel = 'if more tactics only ever helped',
  thresholdLabel = 'enough to earn a "yes"',
  threshold = 40,
  reactanceOnset = 4,
  verdictCold = 'not enough pull yet — the prospect has no real reason to say yes',
  verdictPersuaded = 'a few aligned levers, honestly used — genuinely persuasive, and the prospect barely notices the nudges',
  verdictBackfire = 'too many transparent tactics — the prospect feels handled, reactance kicks in, and the yes slips away',
  readout = '{n} levers active → a naive count says {naive}% likely to say yes, but modelled reactance brings the real chance to {yes}% ({reactance}% lost to feeling handled). {verdict}.',
  className,
}: ComplianceMeterProps) {
  const reactId = useId();
  const [active, setActive] = useState<boolean[]>(() => levers.map(() => false));

  const toggle = (i: number) =>
    setActive((prev) => prev.map((v, j) => (j === i ? !v : v)));

  const model = useMemo(() => {
    const activeWeights = levers.filter((_, i) => active[i]).map((l) => l.weight);
    const n = activeWeights.length;
    const sum = activeWeights.reduce((acc, w) => acc + w, 0);
    // Naive prediction: more levers always help; just add the pulls.
    const naive = clamp(sum * 100, 0, 100);
    // Reactance: every lever past the onset makes the target feel handled and
    // pushes back, eating a growing fraction of the naive pull.
    const overload = Math.max(0, n - reactanceOnset);
    const reactanceFrac = clamp(overload * REACTANCE_STEP, 0, 0.85);
    const yes = clamp(naive * (1 - reactanceFrac), 0, 100);
    const reactanceLost = round(naive) - round(yes);
    const backfire = overload > 0;
    const persuaded = !backfire && yes >= threshold;
    return {
      n,
      naive: round(naive),
      yes: round(yes),
      reactance: round(reactanceFrac * 100),
      reactanceLost,
      backfire,
      persuaded,
    };
  }, [active, levers, threshold, reactanceOnset]);

  const { n, naive, yes, reactance, reactanceLost, backfire, persuaded } = model;

  const verdictWord = backfire ? verdictBackfire : persuaded ? verdictPersuaded : verdictCold;
  const meterColor = backfire
    ? 'var(--color-danger)'
    : persuaded
      ? 'var(--color-brand-500)'
      : 'var(--color-accent-500)';

  const readoutText = readout
    .replace('{n}', String(n))
    .replace('{naive}', String(naive))
    .replace('{yes}', String(yes))
    .replace('{reactance}', String(reactanceLost))
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
          <span className="text-sm font-semibold tabular-nums text-ink-800">{yes}%</span>
        </div>
        <div className="relative mt-2 h-7 w-full overflow-hidden rounded-pill bg-surface-sunken">
          {/* Real (reactance-adjusted) fill */}
          <div
            className={cx('h-full rounded-pill', tween)}
            style={{ width: `${yes}%`, background: meterColor }}
          />
          {/* Naive-prediction ghost marker */}
          <div
            className={cx('absolute inset-y-0 w-0.5 bg-ink-700/70', tween)}
            style={{ left: `${naive}%` }}
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
            {naiveLabel} ({naive}%)
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
          backfire
            ? 'border-danger/30 bg-danger/5 text-ink-800'
            : persuaded
              ? 'border-brand-200 bg-brand-50/70 text-ink-700'
              : 'border-ink-100 bg-surface-sunken text-ink-700',
        )}
      >
        {readoutText}
      </p>

      {/* Lever toggles */}
      <fieldset className="mt-4">
        <legend className="text-[0.65rem] font-bold uppercase tracking-wide text-ink-600">
          Levers of influence — switch each one on
        </legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {levers.map((l, i) => {
            const on = active[i];
            return (
              <label
                key={l.label}
                htmlFor={`${reactId}-l${i}`}
                className={cx(
                  'flex cursor-pointer items-start gap-2.5 rounded-card border p-2.5 text-left',
                  tween,
                  on
                    ? 'border-brand-500 bg-brand-50/60'
                    : 'border-ink-100 bg-surface-sunken hover:border-ink-300',
                )}
              >
                <input
                  id={`${reactId}-l${i}`}
                  type="checkbox"
                  checked={on}
                  onChange={() => toggle(i)}
                  className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-brand-500"
                />
                <span>
                  <span className="block text-sm font-semibold text-ink-800">{l.label}</span>
                  {l.blurb ? (
                    <span className="mt-0.5 block text-xs leading-snug text-ink-500">{l.blurb}</span>
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

export default ComplianceMeter;
