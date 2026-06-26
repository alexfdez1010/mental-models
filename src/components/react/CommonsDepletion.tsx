import { useId, useMemo, useState } from 'react';
import { cx } from '@/components/react/cx';

/** Props for the {@link CommonsDepletion} island. */
export interface CommonsDepletionProps {
  /** Heading above the card. */
  title?: string;
  /** Eyebrow label. Defaults to `'Watch the commons'`. */
  eyebrow?: string;
  /** Instruction line above the simulation. */
  instructions?: string;
  /** Caption beneath the card. */
  caption?: string;
  /** What the shared resource is, e.g. `'Fish left in the lake'`. */
  resourceLabel: string;
  /** What each added user is, e.g. `'boats fishing the lake'`. */
  userLabel: string;
  /** Emoji shown for each user. Defaults to `'🚤'`. */
  userIcon?: string;
  /** Most users the slider allows. Defaults to 12. */
  usersMax?: number;
  /** Users the slider starts at. Defaults to 3. */
  initialUsers?: number;
  /** Slider label. Defaults to `'Users sharing the resource'`. */
  sliderLabel?: string;
  /** How many seasons/rounds to simulate. Defaults to 12. */
  rounds?: number;
  /** Carrying capacity (100 = a full, healthy resource). Defaults to 100. */
  capacity?: number;
  /** Regrowth rate per season (logistic). Defaults to 0.5. */
  regenRate?: number;
  /** How much each user harvests per season. Defaults to 5. */
  harvestPerUser?: number;
  /** Word for one time-step on the trajectory axis. Defaults to `'season'`. */
  seasonLabel?: string;
  /** Label on the governance toggle. Defaults to `'Govern the commons (take only what regrows)'`. */
  governLabel?: string;
  /** One-line gloss explaining the governance rule. */
  governHint?: string;
  /**
   * Live readout while the resource is ungoverned. `{users}`, `{final}`,
   * `{rounds}` are replaced.
   */
  collapseReadout?: string;
  /**
   * Live readout while the resource survives (governed or lightly used).
   * `{users}`, `{final}`, `{rounds}` are replaced.
   */
  healthyReadout?: string;
  /** Extra classes merged onto the root element. */
  className?: string;
}

/** Clamp a number into `[lo, hi]`. */
function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

/**
 * Interactive **tragedy of the commons** simulator — a shared, renewable
 * resource collapsing under individually rational use, and surviving once it is
 * governed.
 *
 * The resource regrows logistically each season (fast when healthy, slowly when
 * depleted). Every user takes their private, rational share; the *gain* is theirs
 * alone but the *depletion* is split across everyone. Drag the number of users up
 * and the total harvest outruns what regrows — the stock spirals to collapse,
 * even though no single user did anything irrational. That gap between private
 * benefit and socialized cost is the whole model, made visible.
 *
 * Flip the **governance toggle** and total take is capped at what the resource
 * can regrow that season ("harvest only the interest, never the principal").
 * Now the same crowd of users can share the commons indefinitely — the trap was
 * never the people, it was the unmanaged structure.
 *
 * The slider is a native `range` input with a visible label, the verdict is
 * announced via `aria-live`, the trajectory bars are decorative for screen
 * readers (the readout carries the meaning), and bar heights transition gently —
 * instantly under `prefers-reduced-motion`. Fully keyboard-operable.
 */
export function CommonsDepletion({
  title,
  eyebrow = 'Watch the commons',
  instructions = 'Each user takes their rational share — the gain is private, the cost is shared. Add users and watch the shared resource over the seasons.',
  caption,
  resourceLabel,
  userLabel,
  userIcon = '🚤',
  usersMax = 12,
  initialUsers = 3,
  sliderLabel = 'Users sharing the resource',
  rounds = 12,
  capacity = 100,
  regenRate = 0.5,
  harvestPerUser = 5,
  seasonLabel = 'season',
  governLabel = 'Govern the commons (take only what regrows)',
  governHint = 'Cap the total catch at what the resource regrows each season — harvest the interest, never the principal.',
  collapseReadout = 'With {users} users taking their private share, the resource crashes to {final}% by {rounds} {seasonLabelPlural} — collapse. Each gain was private; the ruin was shared.',
  healthyReadout = 'With {users} users, the resource holds at {final}% after {rounds} {seasonLabelPlural} — the commons survives.',
  className,
}: CommonsDepletionProps) {
  if (!resourceLabel?.trim() || !userLabel?.trim()) {
    throw new Error('CommonsDepletion: `resourceLabel` and `userLabel` are required.');
  }

  const reactId = useId();
  const [users, setUsers] = useState(() => clamp(initialUsers, 1, usersMax));
  const [governed, setGoverned] = useState(false);

  // Simulate the stock season by season. The resource regrows logistically
  // (fast when healthy, vanishing when nearly gone). Users each take a fixed
  // rational share; under governance the *total* take is capped at the season's
  // regrowth, so the stock never falls below where it started.
  const history = useMemo(() => {
    const out: number[] = [capacity];
    let stock = capacity;
    for (let r = 0; r < rounds; r++) {
      const regen = regenRate * stock * (1 - stock / capacity);
      const desired = users * harvestPerUser;
      const harvest = governed ? Math.min(desired, regen) : desired;
      stock = clamp(stock + regen - harvest, 0, capacity);
      out.push(stock);
    }
    return out;
  }, [users, governed, rounds, capacity, regenRate, harvestPerUser]);

  const finalStock = Math.round(history[history.length - 1]);
  const collapsed = finalStock < 15;
  const seasonPlural = `${seasonLabel}s`;

  const fill = (tpl: string) =>
    tpl
      .replace('{users}', String(users))
      .replace('{final}', String(finalStock))
      .replace('{rounds}', String(rounds))
      .replace('{seasonLabelPlural}', seasonPlural);

  const readout = collapsed && !governed ? fill(collapseReadout) : fill(healthyReadout);

  // Bar tint by health: green when plentiful, amber mid, red when nearly bare.
  const barClass = (v: number) => {
    const p = v / capacity;
    if (p >= 0.5) return 'bg-success';
    if (p >= 0.2) return 'bg-warning';
    return 'bg-danger';
  };

  return (
    <figure className={cx('brutal my-6 bg-surface p-5 sm:p-6', className)}>
      <p className="font-display text-xs font-semibold uppercase tracking-wide text-brand-600">
        {eyebrow}
      </p>
      {title ? (
        <p className="mt-1 font-display text-lg font-semibold text-ink-900">{title}</p>
      ) : null}

      <p className="mt-2 text-sm font-medium text-ink-700">{instructions}</p>

      {/* The users sharing the commons. Decorative — meaning lives in the readout. */}
      <p className="mt-4 text-[0.65rem] font-bold uppercase tracking-wide text-ink-500">
        {userLabel}
      </p>
      <div aria-hidden className="mt-2 flex flex-wrap gap-1 text-lg leading-none">
        {Array.from({ length: users }, (_, i) => (
          <span key={`${reactId}-user-${i}`}>{userIcon}</span>
        ))}
      </div>

      {/* Trajectory of the resource across the seasons. */}
      <p className="mt-5 text-[0.65rem] font-bold uppercase tracking-wide text-ink-500">
        {resourceLabel}
      </p>
      <div
        aria-hidden
        className="mt-2 flex h-32 items-end gap-1 rounded-card bg-surface-sunken p-2"
      >
        {history.map((v, i) => (
          <span
            key={`${reactId}-bar-${i}`}
            className="flex flex-1 flex-col justify-end self-stretch"
            title={`${seasonLabel} ${i}: ${Math.round(v)}%`}
          >
            <span
              className={cx(
                'w-full rounded-t-sm transition-[height] duration-300 ease-out motion-reduce:transition-none',
                barClass(v),
              )}
              style={{ height: `${Math.max(2, (v / capacity) * 100)}%` }}
            />
          </span>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[0.65rem] text-ink-400">
        <span>{seasonLabel} 0</span>
        <span>
          {seasonLabel} {rounds}
        </span>
      </div>

      {/* Live verdict. */}
      <p aria-live="polite" className="mt-4 font-display text-base font-semibold text-ink-900">
        {readout}
      </p>

      {/* Users slider. */}
      <div className="mt-3 flex items-center gap-3">
        <label
          htmlFor={`${reactId}-range`}
          className="text-[0.65rem] font-bold uppercase tracking-wide text-ink-500"
        >
          {sliderLabel}
        </label>
        <input
          id={`${reactId}-range`}
          type="range"
          min={1}
          max={usersMax}
          step={1}
          value={users}
          onChange={(e) => setUsers(clamp(Number(e.target.value), 1, usersMax))}
          aria-valuetext={`${users} ${userLabel}`}
          className="h-1.5 w-full max-w-sm cursor-pointer accent-brand-500"
        />
        <span className="w-10 shrink-0 text-right font-mono text-xs font-semibold text-ink-700">
          {users}
        </span>
      </div>

      {/* Governance toggle — the fix. */}
      <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-card border-2 border-ink-200 bg-surface-sunken p-3">
        <input
          type="checkbox"
          checked={governed}
          onChange={(e) => setGoverned(e.target.checked)}
          className="mt-0.5 size-4 shrink-0 cursor-pointer accent-success"
        />
        <span className="text-sm">
          <span className="font-semibold text-ink-900">{governLabel}</span>
          <span className="mt-0.5 block text-ink-600">{governHint}</span>
        </span>
      </label>

      {caption ? (
        <figcaption className="mt-3 text-sm text-ink-500">{caption}</figcaption>
      ) : null}
    </figure>
  );
}

export default CommonsDepletion;
