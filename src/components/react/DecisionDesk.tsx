import { useId, useMemo, useState } from 'react';
import { cx } from '@/components/react/cx';

/**
 * One mental-model *lens* the learner can train on the scenario. Each lens has
 * its own reading (a `note`) and a signed `pull`: which pole the model, on its
 * own, leans the decision toward, and how hard.
 */
export interface DecisionLens {
  /** The model's name, e.g. "Incentives" or "Base rates". */
  label: string;
  /** What this one model says about the scenario — its independent reading. */
  note: string;
  /**
   * Directional pull. **Positive → toward the right pole** (e.g. "Act"),
   * **negative → toward the left pole** (e.g. "Hold"). Magnitude 0…1 is how
   * hard this model leans. `0` means the model is relevant but neutral here.
   */
  pull: number;
}

/** A decision to read through several model-lenses at once. */
export interface DecisionScenario {
  /** Short name shown on the scenario selector chip. */
  name: string;
  /** One-line framing of the decision being weighed. */
  prompt: string;
  /** The model-lenses available for this scenario. */
  lenses: DecisionLens[];
  /** Optional per-scenario left-pole label (overrides the component default). */
  poleLeft?: string;
  /** Optional per-scenario right-pole label (overrides the component default). */
  poleRight?: string;
}

/** Props for the {@link DecisionDesk} island. */
export interface DecisionDeskProps {
  /** Heading above the card. */
  title?: string;
  /** Eyebrow label. Defaults to `'The decision desk'`. */
  eyebrow?: string;
  /** Instruction line above the controls. */
  instructions?: string;
  /** Caption beneath the card. */
  caption?: string;
  /** The scenarios the learner can switch between. */
  scenarios?: DecisionScenario[];
  /** Default left-pole label (used when a scenario doesn't override it). */
  poleLeft?: string;
  /** Default right-pole label (used when a scenario doesn't override it). */
  poleRight?: string;
  /** Label for the needle track. */
  leanLabel?: string;
  /** Legend title over the lens toggles. */
  lensesLabel?: string;
  /** Word for a lens whose reading points left, e.g. "leans". Used in chips as `{word} {pole}`. */
  towardWord?: string;
  /** Heading of the live verdict box. */
  verdictLabel?: string;
  /** Verdict when no lens is switched on yet. */
  verdictIdle?: string;
  /**
   * Verdict when every active lens points the SAME way (a stacked reading).
   * `{count}`/`{pole}` are replaced. This is the lollapalooza case.
   */
  verdictStacked?: string;
  /**
   * Verdict when 3+ active lenses all agree — an emphatic lollapalooza reading.
   * Falls back to `verdictStacked` if not given. `{count}`/`{pole}`.
   */
  verdictLollapalooza?: string;
  /**
   * Verdict when active lenses disagree — the flagged tension to investigate.
   * `{left}`/`{right}`/`{poleLeft}`/`{poleRight}` are replaced.
   */
  verdictSplit?: string;
  /**
   * Readout line summarising the tally. `{active}`/`{leanPole}`/`{leanPct}` are
   * replaced with live values.
   */
  readout?: string;
  /** Extra classes merged onto the root element. */
  className?: string;
}

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const round = (n: number) => Math.round(n);

const DEFAULT_SCENARIOS: DecisionScenario[] = [
  {
    name: 'A bank rumour',
    prompt:
      'A rumour spreads that your bank is in trouble. A queue is forming outside. Do you rush to pull your savings out now, or hold?',
    poleLeft: 'Hold',
    poleRight: 'Join the run',
    lenses: [
      {
        label: 'Incentives',
        note: 'If enough others withdraw, the bank fails and late withdrawers lose — so each person is personally rewarded for pulling out first.',
        pull: 0.8,
      },
      {
        label: 'Social proof',
        note: 'A visible, growing queue signals "sensible people are getting out," and under uncertainty we copy the crowd.',
        pull: 0.7,
      },
      {
        label: 'Game theory',
        note: 'A bank run is a coordination trap: "everyone withdraws" is a self-fulfilling equilibrium — if you expect others to run, running is your best response.',
        pull: 0.75,
      },
      {
        label: 'Feedback loop',
        note: 'Each withdrawal weakens the bank and lengthens the queue, which triggers more withdrawals — a reinforcing loop that feeds on itself.',
        pull: 0.7,
      },
      {
        label: 'Base rates',
        note: 'Most bank rumours fizzle out and deposits are usually insured, so the base rate of a genuine collapse from a rumour is low.',
        pull: -0.55,
      },
      {
        label: 'Second-order thinking',
        note: 'If everyone reasons "just pull mine out to be safe," the run itself causes the collapse that no one wanted — the cure is the disease.',
        pull: -0.4,
      },
    ],
  },
  {
    name: 'A viral product',
    prompt:
      'A new app is exploding — everyone is talking about it and downloads are doubling weekly. Should your company bet big and build for its platform now?',
    poleLeft: 'Wait & see',
    poleRight: 'Bet big now',
    lenses: [
      {
        label: 'Critical mass',
        note: 'Once enough users join, network effects can lock the platform in — getting there first while it tips could be decisive.',
        pull: 0.7,
      },
      {
        label: 'Social proof',
        note: '"Everyone is on it" is exactly the signal that makes more people join — the buzz is self-reinforcing while it lasts.',
        pull: 0.6,
      },
      {
        label: 'Base rates',
        note: 'The base rate for a viral app still mattering in three years is low — most fads spike and vanish, and survivors are rare.',
        pull: -0.75,
      },
      {
        label: 'Regression to the mean',
        note: 'Doubling-every-week is an extreme streak; extreme growth tends to cool back toward ordinary rates rather than continue.',
        pull: -0.6,
      },
      {
        label: 'Asymmetry / optionality',
        note: 'A small, reversible pilot keeps the upside if it lasts while capping the loss if it dies — you don\'t need to bet the company to stay in the game.',
        pull: -0.4,
      },
      {
        label: 'Incentives',
        note: 'The people hyping the platform (its founders, influencers, your own FOMO) are rewarded for the hype whether or not it lasts.',
        pull: -0.3,
      },
    ],
  },
];

/**
 * **DecisionDesk** — the capstone island for *combining models into one
 * judgment*. The learner is handed a real decision and a panel of model-lenses.
 * Switching a lens on lays its independent *reading* on the desk and nudges a
 * needle toward one of two poles (e.g. "Hold" vs "Join the run").
 *
 * The teaching move is what the desk reveals once several lenses are on:
 *
 *   • When the active lenses all point the **same way**, their pulls *stack* —
 *     the needle pins hard to one pole and the desk flags a **lollapalooza
 *     reading**: many independent models agreeing is a strong signal (and, per
 *     the course, also a danger flag to slow down and check).
 *
 *   • When the active lenses **disagree**, the needle sits near the middle and
 *     the desk flags the **tension** — the disagreement between models is itself
 *     the signal, the thing to investigate before deciding.
 *
 * This is the latticework in miniature: one situation, several lenses, and a
 * single judgment assembled from where they agree and where they clash. All
 * controls are native checkboxes with visible labels; the verdict is announced
 * via `aria-live`; the only motion is a width/position tween, disabled under
 * `prefers-reduced-motion`.
 */
export function DecisionDesk({
  title,
  eyebrow = 'The decision desk',
  instructions = 'Switch on one model-lens at a time. Each lays its own reading on the desk and nudges the needle. Watch what happens when several agree — and what happens when they pull against each other.',
  caption,
  scenarios = DEFAULT_SCENARIOS,
  poleLeft = 'Hold',
  poleRight = 'Act',
  leanLabel = 'Where the models, together, lean',
  lensesLabel = 'Model-lenses — switch each one on',
  towardWord = 'leans',
  verdictLabel = 'The desk reads',
  verdictIdle = 'No lens is on yet. Turn one on to see what a single model says — then add more and watch them agree or clash.',
  verdictStacked =
    'All {count} active lenses point the SAME way — toward "{pole}". Independent models stacking like this is a lollapalooza reading: a strong signal, and a cue to slow down and check you are not being carried off.',
  verdictLollapalooza =
    '{count} independent lenses ALL point toward "{pole}" — a full lollapalooza. When this many different models converge, the case is strong; treat the very strength as a reason to run the checklist before you commit.',
  verdictSplit =
    'The lenses DISAGREE — {left} lean toward "{poleLeft}" and {right} toward "{poleRight}". That clash is the signal: the disagreement is exactly what to investigate before deciding, not something to average away.',
  readout = '{active} lenses on. Net lean: {leanPct}% toward "{leanPole}".',
  className,
}: DecisionDeskProps) {
  const reactId = useId();
  const [scenarioIdx, setScenarioIdx] = useState(0);
  const scenario = scenarios[scenarioIdx] ?? scenarios[0];
  const [active, setActive] = useState<boolean[]>(() => scenario.lenses.map(() => false));

  const leftPole = scenario.poleLeft ?? poleLeft;
  const rightPole = scenario.poleRight ?? poleRight;

  const pickScenario = (i: number) => {
    setScenarioIdx(i);
    setActive(scenarios[i].lenses.map(() => false));
  };
  const toggle = (i: number) =>
    setActive((prev) => prev.map((v, j) => (j === i ? !v : v)));

  const model = useMemo(() => {
    const activeLenses = scenario.lenses.filter((_, i) => active[i]);
    const n = activeLenses.length;
    const rightCount = activeLenses.filter((l) => l.pull > 0).length;
    const leftCount = activeLenses.filter((l) => l.pull < 0).length;
    const posSum = activeLenses.filter((l) => l.pull > 0).reduce((a, l) => a + l.pull, 0);
    const negSum = activeLenses.filter((l) => l.pull < 0).reduce((a, l) => a - l.pull, 0);
    const net = posSum - negSum; // >0 → right pole, <0 → left pole
    const totalMag = activeLenses.reduce((a, l) => a + Math.abs(l.pull), 0);
    // Needle position 0 (left pole) … 100 (right pole); 50 is balanced.
    const needle = totalMag === 0 ? 50 : clamp(50 + (net / totalMag) * 50, 0, 100);
    const leanRight = net >= 0;
    const leanPct = round(Math.abs(needle - 50) * 2); // 0…100 magnitude of the lean
    const split = leftCount > 0 && rightCount > 0;
    return { n, leftCount, rightCount, needle, leanRight, leanPct, split };
  }, [active, scenario]);

  const { n, leftCount, rightCount, needle, leanRight, leanPct, split } = model;

  const leanPole = leanRight ? rightPole : leftPole;

  let state: 'idle' | 'stacked' | 'lollapalooza' | 'split';
  if (n === 0) state = 'idle';
  else if (split) state = 'split';
  else if (n >= 3) state = 'lollapalooza';
  else state = 'stacked';

  const stackPole = rightCount > 0 ? rightPole : leftPole;
  const verdictText = (() => {
    switch (state) {
      case 'idle':
        return verdictIdle;
      case 'split':
        return verdictSplit
          .replace('{left}', String(leftCount))
          .replace('{right}', String(rightCount))
          .replace('{poleLeft}', leftPole)
          .replace('{poleRight}', rightPole);
      case 'lollapalooza':
        return (verdictLollapalooza || verdictStacked)
          .replace('{count}', String(n))
          .replace('{pole}', stackPole);
      case 'stacked':
      default:
        return verdictStacked.replace('{count}', String(n)).replace('{pole}', stackPole);
    }
  })();

  const readoutText = readout
    .replace('{active}', String(n))
    .replace('{leanPole}', leanPole)
    .replace('{leanPct}', String(leanPct));

  const tween = 'transition-all duration-500 ease-out motion-reduce:transition-none';

  const verdictTone =
    state === 'split'
      ? 'border-accent-300 bg-accent-50/70 text-ink-800'
      : state === 'lollapalooza'
        ? 'border-danger/30 bg-danger/5 text-ink-800'
        : state === 'stacked'
          ? 'border-brand-200 bg-brand-50/70 text-ink-700'
          : 'border-ink-100 bg-surface-sunken text-ink-600';

  return (
    <figure className={cx('brutal my-6 bg-surface p-5 sm:p-6', className)}>
      <p className="font-display text-xs font-semibold uppercase tracking-wide text-brand-600">
        {eyebrow}
      </p>
      {title ? (
        <p className="mt-1 font-display text-lg font-semibold text-ink-900">{title}</p>
      ) : null}

      <p className="mt-2 text-sm font-medium text-ink-700">{instructions}</p>

      {/* Scenario selector */}
      {scenarios.length > 1 ? (
        <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Choose a scenario">
          {scenarios.map((s, i) => {
            const on = i === scenarioIdx;
            return (
              <button
                key={s.name}
                type="button"
                onClick={() => pickScenario(i)}
                aria-pressed={on}
                className={cx(
                  'rounded-pill px-3 py-1 text-xs font-semibold',
                  tween,
                  on
                    ? 'bg-brand-500 text-white'
                    : 'bg-surface-sunken text-ink-600 hover:bg-ink-100',
                )}
              >
                {s.name}
              </button>
            );
          })}
        </div>
      ) : null}

      {/* The decision being weighed */}
      <p className="mt-4 rounded-card border border-ink-100 bg-surface-sunken p-3 text-sm font-medium leading-relaxed text-ink-700">
        {scenario.prompt}
      </p>

      {/* The needle track */}
      <div className="mt-4">
        <span className="text-[0.65rem] font-bold uppercase tracking-wide text-ink-600">
          {leanLabel}
        </span>
        <div className="mt-2 flex items-center justify-between text-xs font-semibold text-ink-500">
          <span>{leftPole}</span>
          <span>{rightPole}</span>
        </div>
        <div className="relative mt-1 h-7 w-full overflow-hidden rounded-pill bg-gradient-to-r from-brand-100 via-surface-sunken to-accent-100">
          {/* Centre mark */}
          <div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-ink-300" aria-hidden />
          {/* Needle */}
          <div
            className={cx('absolute inset-y-1 w-1.5 -translate-x-1/2 rounded-pill', tween)}
            style={{
              left: `${needle}%`,
              background:
                state === 'split'
                  ? 'var(--color-accent-500)'
                  : state === 'lollapalooza'
                    ? 'var(--color-danger)'
                    : 'var(--color-brand-600)',
            }}
            aria-hidden
          />
        </div>
      </div>

      {/* Live verdict */}
      <p
        aria-live="polite"
        className={cx('mt-4 rounded-card border p-3 text-sm leading-relaxed', verdictTone)}
      >
        <span className="mb-0.5 block text-[0.65rem] font-bold uppercase tracking-wide text-ink-500">
          {verdictLabel}
        </span>
        {verdictText}
        {n > 0 ? (
          <span className="mt-1 block text-xs font-medium text-ink-500">{readoutText}</span>
        ) : null}
      </p>

      {/* Lens toggles */}
      <fieldset className="mt-4">
        <legend className="text-[0.65rem] font-bold uppercase tracking-wide text-ink-600">
          {lensesLabel}
        </legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {scenario.lenses.map((l, i) => {
            const on = active[i];
            const right = l.pull > 0;
            const dirPole = right ? rightPole : leftPole;
            const dirArrow = l.pull === 0 ? '•' : right ? '→' : '←';
            return (
              <label
                key={l.label}
                htmlFor={`${reactId}-l${i}`}
                className={cx(
                  'flex cursor-pointer items-start gap-2.5 rounded-card border p-2.5 text-left',
                  tween,
                  on
                    ? right
                      ? 'border-accent-400 bg-accent-50/50'
                      : 'border-brand-400 bg-brand-50/50'
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
                <span className="min-w-0">
                  <span className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-ink-800">{l.label}</span>
                    {on ? (
                      <span
                        className={cx(
                          'rounded-pill px-1.5 py-0.5 text-[0.6rem] font-bold uppercase tracking-wide',
                          right ? 'bg-accent-100 text-accent-700' : 'bg-brand-100 text-brand-700',
                        )}
                      >
                        {dirArrow} {towardWord} {dirPole}
                      </span>
                    ) : null}
                  </span>
                  <span className="mt-0.5 block text-xs leading-snug text-ink-500">{l.note}</span>
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

export default DecisionDesk;
