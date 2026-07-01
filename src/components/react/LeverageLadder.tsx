import { useId, useMemo, useState } from 'react';
import { cx } from '@/components/react/cx';

/** One rung of the leverage ladder — a place to intervene in a system. */
export interface LeverageRung {
  /** Short name of the rung (e.g. "Numbers", "Goals"). */
  label: string;
  /** One-line description of what you change at this rung. */
  hint: string;
  /** Difficulty-to-move badge (e.g. "Easy", "Hard", "Brutal"). */
  cost: string;
  /**
   * Relative leverage of this rung — how much system behaviour a unit of
   * effective push buys here. Higher = more powerful. Low rungs sit near ~0.15,
   * the summit near ~3.5. Drives the diminishing-returns response curve.
   */
  leverage: number;
}

/** Props for the {@link LeverageLadder} island. */
export interface LeverageLadderProps {
  /** Heading above the card. */
  title?: string;
  /** Eyebrow label. Defaults to `'Leverage points'`. */
  eyebrow?: string;
  /** Instruction line above the controls. */
  instructions?: string;
  /** Caption beneath the card. */
  caption?: string;
  /**
   * The rungs, weakest first. Rendered bottom-to-top (last item = the summit).
   * Defaults to the compressed Meadows ladder.
   */
  rungs?: LeverageRung[];
  /** Label over the effort slider. */
  effortLabel?: string;
  /** Caption on the low end of the effort slider. */
  effortLowLabel?: string;
  /** Caption on the high end of the effort slider. */
  effortHighLabel?: string;
  /** Label over the "effort you spent" bar. */
  effortBarLabel?: string;
  /** Label over the "system behaviour changed" bar. */
  movementBarLabel?: string;
  /** Label prefix for the rung chooser. */
  chooseLabel?: string;
  /** Badge word shown next to each rung's cost, e.g. "cost to move". */
  costLabel?: string;
  /** Verdict when the chosen rung is low-leverage (bottom third). */
  verdictWeak?: string;
  /** Verdict when the chosen rung is mid-leverage. */
  verdictMedium?: string;
  /** Verdict when the chosen rung is high-leverage (top third). */
  verdictStrong?: string;
  /**
   * Readout template. `{rung}`/`{effort}`/`{movement}`/`{verdict}` are replaced.
   */
  readout?: string;
  /** Starting effort (0–100). Defaults to `100` (pushing as hard as you can). */
  initialEffort?: number;
  /** Index of the rung selected at first render. Defaults to `0` (the weakest). */
  initialRung?: number;
  /** Extra classes merged onto the root element. */
  className?: string;
}

const DEFAULT_RUNGS: LeverageRung[] = [
  { label: 'Numbers', hint: 'Tune a parameter: a tax rate, a setpoint, a budget line', cost: 'Easy', leverage: 0.15 },
  { label: 'Buffers & stocks', hint: 'Resize a reserve, an inventory, a buffer', cost: 'Easy', leverage: 0.32 },
  { label: 'Loop structure', hint: 'Add, weaken, or speed up a feedback loop', cost: 'Hard', leverage: 0.9 },
  { label: 'Information flows', hint: 'Change who can see what, and how fast', cost: 'Medium', leverage: 1.35 },
  { label: 'Rules & incentives', hint: 'Change what the system rewards and punishes', cost: 'Hard', leverage: 2.1 },
  { label: 'Goal & paradigm', hint: 'Change the target the whole system optimises for', cost: 'Brutal', leverage: 3.6 },
];

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const round = (n: number) => Math.round(n);

/** Diminishing-returns response: system movement (0–100) from effort × leverage. */
const movementOf = (effort: number, leverage: number) =>
  round(100 * (1 - Math.exp(-leverage * (effort / 100) * 1.2)));

/**
 * Interactive **leverage points** island — Donella Meadows' ladder made
 * physical. The learner picks a *rung* (a place to intervene in a system, from
 * tweaking a number at the bottom to changing the system's goal at the top) and
 * sets how hard they push with the **effort** slider.
 *
 * Two bars tell the story. The **effort** bar is the same for every rung — you
 * pushed just as hard. The **system-behaviour-changed** bar is wildly different:
 * on a low rung, even 100% effort barely moves the system (a low-leverage
 * parameter saturates almost immediately); on a high rung, a modest push moves
 * it a lot. The whole point of the model — *same effort, wildly different result,
 * entirely because of **where** you pushed* — becomes something the learner
 * watches happen. Each rung also carries a *cost-to-move* badge, so the cruel
 * trade-off (the strongest levers are the hardest to move) stays visible.
 *
 * The rung chooser is a group of native buttons; effort is a keyboard-operable
 * range input with a visible label; the readout is announced via `aria-live`.
 * The only motion is a cosmetic width tween, disabled under
 * `prefers-reduced-motion`.
 */
export function LeverageLadder({
  title,
  eyebrow = 'Leverage points',
  instructions = 'Pick a place to intervene, then push. The effort bar is the same wherever you push — but watch how differently the system actually moves. Low rungs barely budge it however hard you shove; a light touch up high moves it a lot.',
  caption,
  rungs = DEFAULT_RUNGS,
  effortLabel = 'How hard you push',
  effortLowLabel = 'a nudge',
  effortHighLabel = 'shove with everything',
  effortBarLabel = 'Effort you spent',
  movementBarLabel = 'System behaviour changed',
  chooseLabel = 'Where you push',
  costLabel = 'cost to move',
  verdictWeak = 'a low-leverage point — easy to push, but the loops, information, and goal are untouched, so the system just absorbs the nudge',
  verdictMedium = 'a mid-leverage point — now you are rewiring how the system self-corrects, not just retuning its dials',
  verdictStrong = 'a high-leverage point — a small push here re-points the whole system, which is exactly why it is so hard to move and cuts both ways',
  readout = 'You spent {effort}% effort at "{rung}" → the system moved {movement}%: {verdict}.',
  initialEffort = 100,
  initialRung = 0,
  className,
}: LeverageLadderProps) {
  const reactId = useId();
  const [effort, setEffort] = useState(clamp(initialEffort, 0, 100));
  const [sel, setSel] = useState(clamp(initialRung, 0, rungs.length - 1));

  const n = rungs.length;
  const chosen = rungs[sel];
  const movement = useMemo(() => movementOf(effort, chosen.leverage), [effort, chosen.leverage]);

  // Band the rung into weak / medium / strong by its position on the ladder.
  const band = sel < n / 3 ? 'weak' : sel < (2 * n) / 3 ? 'medium' : 'strong';
  const verdictWord = band === 'strong' ? verdictStrong : band === 'medium' ? verdictMedium : verdictWeak;
  const bandColor =
    band === 'strong'
      ? 'var(--color-success)'
      : band === 'medium'
        ? 'var(--color-accent-500)'
        : 'var(--color-ink-400)';

  const readoutText = readout
    .replace('{effort}', String(effort))
    .replace('{rung}', chosen.label)
    .replace('{movement}', String(movement))
    .replace('{verdict}', verdictWord);

  const tween = 'transition-all duration-500 ease-out motion-reduce:transition-none';

  return (
    <figure className={cx('brutal my-6 bg-surface p-5 sm:p-6', className)}>
      <p className="font-display text-xs font-semibold uppercase tracking-wide text-brand-600">{eyebrow}</p>
      {title ? <p className="mt-1 font-display text-lg font-semibold text-ink-900">{title}</p> : null}

      <p className="mt-2 text-sm font-medium text-ink-700">{instructions}</p>

      {/* Rung chooser — the ladder, strongest at the top */}
      <div className="mt-4">
        <p className="text-[0.65rem] font-bold uppercase tracking-wide text-ink-600">{chooseLabel}</p>
        <div className="mt-2 flex flex-col gap-1.5" role="group" aria-label={chooseLabel}>
          {rungs
            .map((r, i) => ({ r, i }))
            .reverse()
            .map(({ r, i }) => {
              const active = i === sel;
              const rungBand = i < n / 3 ? 'weak' : i < (2 * n) / 3 ? 'medium' : 'strong';
              const dotColor =
                rungBand === 'strong'
                  ? 'var(--color-success)'
                  : rungBand === 'medium'
                    ? 'var(--color-accent-500)'
                    : 'var(--color-ink-400)';
              return (
                <button
                  key={r.label}
                  type="button"
                  onClick={() => setSel(i)}
                  aria-pressed={active}
                  className={cx(
                    'flex items-center gap-3 rounded-card border px-3 py-2 text-left transition-colors',
                    active
                      ? 'border-brand-400 bg-brand-50/80 ring-1 ring-brand-300'
                      : 'border-ink-100 bg-surface-sunken hover:border-ink-300',
                  )}
                >
                  <span
                    aria-hidden
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ background: dotColor }}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-ink-900">{r.label}</span>
                    <span className="block text-xs text-ink-500">{r.hint}</span>
                  </span>
                  <span className="shrink-0 rounded-pill bg-surface px-2 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wide text-ink-500">
                    {r.cost} · {costLabel}
                  </span>
                </button>
              );
            })}
        </div>
      </div>

      {/* Bars: effort spent (constant) vs system behaviour changed (leverage-scaled) */}
      <div className="mt-5 space-y-3">
        <div>
          <div className="flex items-center justify-between text-[0.65rem] font-bold uppercase tracking-wide text-ink-600">
            <span>{effortBarLabel}</span>
            <span className="tabular-nums">{effort}%</span>
          </div>
          <div className="mt-1 h-4 w-full overflow-hidden rounded-pill bg-surface-sunken">
            <div
              className={cx('h-full rounded-pill', tween)}
              style={{ width: `${effort}%`, background: 'var(--color-ink-400)' }}
            />
          </div>
        </div>
        <div>
          <div className="flex items-center justify-between text-[0.65rem] font-bold uppercase tracking-wide text-ink-600">
            <span>{movementBarLabel}</span>
            <span className="tabular-nums" style={{ color: bandColor }}>
              {movement}%
            </span>
          </div>
          <div className="mt-1 h-4 w-full overflow-hidden rounded-pill bg-surface-sunken">
            <div className={cx('h-full rounded-pill', tween)} style={{ width: `${movement}%`, background: bandColor }} />
          </div>
        </div>
      </div>

      {/* Live readout */}
      <p
        aria-live="polite"
        className="mt-4 rounded-card border border-brand-200 bg-brand-50/70 p-3 text-sm leading-relaxed text-ink-700"
      >
        {readoutText}
      </p>

      {/* Effort slider */}
      <div className="mt-4">
        <label htmlFor={`${reactId}-effort`} className="text-[0.65rem] font-bold uppercase tracking-wide text-ink-600">
          {effortLabel}
        </label>
        <input
          id={`${reactId}-effort`}
          type="range"
          min={0}
          max={100}
          step={1}
          value={effort}
          onChange={(e) => setEffort(Number(e.target.value))}
          aria-valuetext={`${effort} percent effort`}
          className="mt-1 h-1.5 w-full cursor-pointer accent-brand-500"
        />
        <div className="flex justify-between text-[0.6rem] font-medium uppercase tracking-wide text-ink-400">
          <span>{effortLowLabel}</span>
          <span>{effortHighLabel}</span>
        </div>
      </div>

      {caption ? <figcaption className="mt-3 text-sm text-ink-500">{caption}</figcaption> : null}
    </figure>
  );
}

export default LeverageLadder;
