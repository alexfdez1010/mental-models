import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { cx } from '@/components/react/cx';

/** Props for the {@link PreferenceCascade} island. */
export interface PreferenceCascadeProps {
  /**
   * Side length of the square population grid. The crowd holds `size × size`
   * people (e.g. `20` → 400). Defaults to `20`.
   */
  size?: number;
  /**
   * Percentage of the population that *privately* opposes the status quo
   * (`0`–`100`). These are the people who, if speaking were free, would dissent.
   * The rest genuinely support it. Defaults to `72`.
   */
  privateDissentPct?: number;
  /**
   * Starting dissent cost (`0`–`100`): how socially, professionally or politically
   * expensive it is to be seen dissenting. Higher cost raises the crowd everyone
   * needs to see *already* dissenting before they will risk it themselves, so a
   * high cost freezes a false consensus in place. Defaults to `62`.
   */
  initialCost?: number;
  /**
   * Percentage of the private dissenters who are *zealots* — brave souls who
   * speak out no matter the cost (threshold zero). They are the permanent seed a
   * cascade can grow from. Defaults to `3`.
   */
  zealotPct?: number;
  /**
   * How many extra brave speakers the "small shock" button injects each press,
   * as a percentage of the whole population. A nudge near the tipping point can
   * topple a stable-looking consensus. Defaults to `4`.
   */
  shockPct?: number;
  /** Heading above the card. */
  title?: string;
  /** Eyebrow label. */
  eyebrow?: string;
  /** Instruction line above the grid. */
  instructions?: string;
  /** Caption beneath the card. */
  caption?: string;
  /** Label for the dissent-cost slider. */
  costLabel?: string;
  /** Text on the "let it settle / play" button. */
  settleLabel?: string;
  /** Text on the small-shock button. */
  shockLabel?: string;
  /** Text on the reset button. */
  resetLabel?: string;
  /** Text on the reveal-private-preferences toggle. */
  revealLabel?: string;
  /** Text on the hide-private-preferences toggle. */
  hideLabel?: string;
  /**
   * Live readout template. `{private}` (percent who privately dissent),
   * `{public}` (percent publicly dissenting) and `{gap}` (the hidden gap between
   * them, in points) are replaced.
   */
  readoutTemplate?: string;
  /** Verdict when public dissent is stuck far below private dissent. */
  falseConsensusVerdict?: string;
  /** Verdict when the cascade has swept and private dissent is now public. */
  unravelledVerdict?: string;
  /** Verdict for an in-between, partly-revealed state. */
  partialVerdict?: string;
  /** Verdict while a settling animation is still running. */
  settlingVerdict?: string;
  /** Legend label for people who privately + publicly support the status quo. */
  loyalLabel?: string;
  /** Legend label for private dissenters who stay publicly silent (falsifiers). */
  silentLabel?: string;
  /** Legend label for people openly dissenting. */
  dissentLabel?: string;
  /** Legend label used in the public view for anyone publicly conforming. */
  conformLabel?: string;
  /** Extra classes merged onto the root element. */
  className?: string;
}

/** Deterministic PRNG (mulberry32) so SSR and hydration agree — no flicker.
 *  NO `Math.random()` / `Date.now()`. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SEED = 0x5eed1234;

/** Standard-normal draw via Box–Muller, fed by the deterministic PRNG. */
function normal(rng: () => number): number {
  const u1 = Math.max(rng(), 1e-9);
  const u2 = rng();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

/** Private preference + revealed-preference threshold for one person. */
interface Person {
  /** True if this person privately opposes the status quo. */
  dissenter: boolean;
  /**
   * Base threshold: the percent of the whole crowd this person must see openly
   * dissenting before they will speak up, at neutral cost. Zealots are `0`,
   * loyalists are `Infinity` (they never dissent). The live threshold adds the
   * cost offset on top of this.
   */
  base: number;
}

/**
 * Build a fixed, deterministic population. A `privateDissentPct` share privately
 * dissent; of those, a `zealotPct` share are zealots (base threshold 0) and the
 * rest get a bell-shaped base threshold (so the recruitment curve is S-shaped and
 * the system can have two equilibria — a frozen false consensus and a full
 * unravelling). Loyalists never dissent.
 */
function buildPeople(
  size: number,
  privateDissentFraction: number,
  zealotFraction: number,
  rng: () => number,
): Person[] {
  const total = size * size;
  const people: Person[] = new Array(total);
  for (let i = 0; i < total; i += 1) {
    const dissenter = rng() < privateDissentFraction;
    if (!dissenter) {
      people[i] = { dissenter: false, base: Number.POSITIVE_INFINITY };
      continue;
    }
    if (rng() < zealotFraction) {
      people[i] = { dissenter: true, base: 0 };
      continue;
    }
    // Bell-shaped base thresholds, centred at 35 points with a wide spread,
    // clamped to a sensible range. The shape gives the S-curve that makes a
    // small shock able to tip a stuck consensus into a full cascade.
    const b = 35 + normal(rng) * 20;
    people[i] = { dissenter: true, base: Math.max(2, Math.min(96, b)) };
  }
  return people;
}

/**
 * Settle the crowd to the public-dissent fixed point implied by `cost`, starting
 * from `seedPublic` (a boolean array of who is already forced to speak). Applies
 * the threshold rule to a fixed point: a private dissenter speaks once the share
 * of the whole crowd visibly dissenting reaches their live threshold
 * (`base + costOffset`). Monotonic, so it converges. Returns the final public
 * mask. Used both to compute the resting state and, one round at a time, to
 * animate the unravelling.
 */
function settle(people: Person[], cost: number, seedPublic: boolean[]): boolean[] {
  const total = people.length;
  const costOffset = cost * 0.5; // cost 0..100 shifts thresholds by 0..50 points.
  const pub = seedPublic.slice();
  for (let guard = 0; guard < total + 4; guard += 1) {
    let count = 0;
    for (let i = 0; i < total; i += 1) if (pub[i]) count += 1;
    const sharePct = (count / total) * 100;
    let changed = false;
    for (let i = 0; i < total; i += 1) {
      if (pub[i]) continue;
      const p = people[i];
      if (!p.dissenter) continue;
      if (p.base + costOffset <= sharePct) {
        pub[i] = true;
        changed = true;
      }
    }
    if (!changed) break;
  }
  return pub;
}

/** One synchronous round of the threshold rule (for step-by-step animation). */
function stepRound(people: Person[], cost: number, pub: boolean[]): { next: boolean[]; changed: boolean } {
  const total = people.length;
  const costOffset = cost * 0.5;
  let count = 0;
  for (let i = 0; i < total; i += 1) if (pub[i]) count += 1;
  const sharePct = (count / total) * 100;
  const next = pub.slice();
  let changed = false;
  for (let i = 0; i < total; i += 1) {
    if (pub[i]) continue;
    const p = people[i];
    if (!p.dissenter) continue;
    if (p.base + costOffset <= sharePct) {
      next[i] = true;
      changed = true;
    }
  }
  return { next, changed };
}

/** The permanent zealot seed at a given cost: everyone whose live threshold is 0. */
function zealotSeed(people: Person[], cost: number): boolean[] {
  const costOffset = cost * 0.5;
  return people.map((p) => p.dissenter && p.base + costOffset <= 0);
}

/**
 * Interactive **preference-falsification cascade** — a crowd where most people
 * privately disagree with the status quo but publicly conform because dissent is
 * costly, so the visible consensus is a facade almost nobody believes. Each
 * person has a hidden threshold: the amount of *visible* dissent they must see
 * before they will risk speaking. Raise the **dissent-cost** slider and every
 * threshold climbs, freezing a false consensus in place; lower it, or inject a
 * few brave speakers with the **shock** button, and past a tipping point the
 * whole edifice unravels in a rush. A **reveal** toggle exposes the private
 * distribution hiding behind the public face.
 *
 * The grid is decorative for screen readers — all meaning lives in the
 * `aria-live` readout (private %, public %, hidden gap, verdict). Cells
 * transition gently and instantly under `prefers-reduced-motion`. Fully
 * keyboard-operable. Never auto-runs on mount.
 */
export function PreferenceCascade({
  size = 20,
  privateDissentPct = 72,
  initialCost = 62,
  zealotPct = 3,
  shockPct = 4,
  title,
  eyebrow = 'The consensus nobody privately believes',
  instructions = 'Most of this crowd privately disagrees with the status quo — but each person only speaks up once enough others already have. Raise the cost of dissent to freeze a false consensus; lower it, or inject a few brave speakers, to watch the dam break. Reveal the private preferences to see the majority hiding in plain sight.',
  caption,
  costLabel = 'Cost of dissent (how expensive it is to speak up)',
  settleLabel = 'Let it settle ▸',
  shockLabel = 'Small shock (+ brave speakers)',
  resetLabel = 'Reset',
  revealLabel = 'Reveal private preferences',
  hideLabel = 'Show only the public face',
  readoutTemplate = 'Privately against: {private}%. Publicly dissenting: {public}%. Hidden gap: {gap} points.',
  falseConsensusVerdict = 'A false consensus — the vast majority privately disagree, yet almost nobody will say so.',
  unravelledVerdict = 'The dam broke — private opposition has become public, fast.',
  partialVerdict = 'A brave minority now speaks, but the silent majority still holds.',
  settlingVerdict = 'The cascade is spreading…',
  loyalLabel = 'Truly supports',
  silentLabel = 'Privately against, publicly silent',
  dissentLabel = 'Openly dissenting',
  conformLabel = 'Publicly conforming',
  className,
}: PreferenceCascadeProps) {
  if (!Number.isFinite(size) || size < 4) {
    throw new Error('PreferenceCascade: `size` must be at least 4.');
  }

  const reactId = useId();
  const clampPct = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

  const [cost, setCost] = useState(() => clampPct(initialCost));
  const [reveal, setReveal] = useState(false);
  const [running, setRunning] = useState(false);

  // The fixed population — private preferences + thresholds — never changes.
  const people = useMemo(
    () =>
      buildPeople(
        size,
        clampPct(privateDissentPct) / 100,
        Math.max(0, Math.min(100, zealotPct)) / 100,
        mulberry32(SEED),
      ),
    [size, privateDissentPct, zealotPct],
  );

  const total = size * size;
  const privatePct = useMemo(
    () => Math.round((people.filter((p) => p.dissenter).length / total) * 100),
    [people, total],
  );

  // Extra forced speakers the learner has injected via the shock button, kept as
  // a persistent mask so shocks accumulate until reset.
  const [forced, setForced] = useState<boolean[]>(() => new Array(total).fill(false));

  // The current public state, initialised to the resting equilibrium at the
  // starting cost (only the zealots visible).
  const [pub, setPub] = useState<boolean[]>(() =>
    settle(people, clampPct(initialCost), zealotSeed(people, clampPct(initialCost))),
  );

  // Refs so the run-loop reads the latest values without re-subscribing.
  const pubRef = useRef(pub);
  pubRef.current = pub;
  const costRef = useRef(cost);
  costRef.current = cost;

  /** Recompute the resting equilibrium for a cost, honouring forced speakers. */
  const restAt = (nextCost: number, nextForced = forced) => {
    const seed = zealotSeed(people, nextCost).map((z, i) => z || nextForced[i]);
    return settle(people, nextCost, seed);
  };

  const onCostChange = (raw: number) => {
    const next = clampPct(raw);
    setCost(next);
    setRunning(false);
    setPub(restAt(next));
  };

  // Inject brave speakers: force a batch of currently-silent private dissenters
  // to speak, then let the animation carry the consequences.
  const shock = () => {
    const budget = Math.max(1, Math.round((shockPct / 100) * total));
    const nextForced = forced.slice();
    let added = 0;
    for (let i = 0; i < total && added < budget; i += 1) {
      const p = people[i];
      if (p.dissenter && !pub[i] && !nextForced[i]) {
        nextForced[i] = true;
        added += 1;
      }
    }
    setForced(nextForced);
    setPub((prev) => {
      const seeded = prev.slice();
      for (let i = 0; i < total; i += 1) if (nextForced[i]) seeded[i] = true;
      return seeded;
    });
    setRunning(true);
  };

  const reset = () => {
    setRunning(false);
    const cleared = new Array(total).fill(false);
    setForced(cleared);
    setPub(settle(people, cost, zealotSeed(people, cost)));
  };

  // Settling animation: one round of the threshold rule per tick while running,
  // stopping once nothing new joins. Pure setters keep it StrictMode-safe.
  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      const { next, changed } = stepRound(people, costRef.current, pubRef.current);
      if (!changed) {
        setRunning(false);
        return;
      }
      setPub(next);
    }, 260);
    return () => window.clearInterval(id);
  }, [running, people]);

  const publicCount = pub.reduce((n, v) => n + (v ? 1 : 0), 0);
  const publicPct = Math.round((publicCount / total) * 100);
  const gap = Math.max(0, privatePct - publicPct);

  // Verdict: while animating it's spreading; once settled, classify by how much
  // of the private opposition has surfaced.
  let verdict = settlingVerdict;
  if (!running) {
    const surfaced = privatePct > 0 ? publicPct / privatePct : 0;
    if (surfaced >= 0.75) verdict = unravelledVerdict;
    else if (surfaced <= 0.2) verdict = falseConsensusVerdict;
    else verdict = partialVerdict;
  }

  const readout = readoutTemplate
    .replace('{private}', String(privatePct))
    .replace('{public}', String(publicPct))
    .replace('{gap}', String(gap));

  return (
    <figure className={cx('brutal my-6 bg-surface p-5 sm:p-6', className)}>
      <p className="font-display text-xs font-semibold uppercase tracking-wide text-brand-600">
        {eyebrow}
      </p>
      {title ? (
        <p className="mt-1 font-display text-lg font-semibold text-ink-900">{title}</p>
      ) : null}

      <p className="mt-2 text-sm font-medium text-ink-700">{instructions}</p>

      {/* The crowd. Decorative — meaning lives in the live readout. In the public
          view, silent dissenters and loyalists look identical (both conforming);
          revealing recolours the hidden dissenters. */}
      <div
        aria-hidden
        className="mt-4 grid gap-0.5"
        style={{
          gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))`,
          maxWidth: `${size * 1.2}rem`,
        }}
      >
        {people.map((p, i) => {
          const openlyDissenting = pub[i];
          const hiddenDissenter = p.dissenter && !openlyDissenting;
          return (
            <span
              key={`${reactId}-cell-${i}`}
              className={cx(
                'aspect-square rounded-[2px] transition-colors duration-200 motion-reduce:transition-none',
                openlyDissenting && 'bg-accent-500',
                !openlyDissenting &&
                  hiddenDissenter &&
                  (reveal
                    ? 'bg-accent-500/25 ring-1 ring-inset ring-accent-500/40'
                    : 'bg-surface-sunken ring-1 ring-inset ring-ink-900/5'),
                !openlyDissenting &&
                  !hiddenDissenter &&
                  'bg-brand-500/70',
              )}
            />
          );
        })}
      </div>

      {/* Legend — swaps between the public face and the revealed private truth. */}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[0.7rem] font-semibold text-ink-600">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="size-3 rounded-[2px] bg-accent-500" />
          {dissentLabel}
        </span>
        {reveal ? (
          <>
            <span className="inline-flex items-center gap-1.5">
              <span
                aria-hidden
                className="size-3 rounded-[2px] bg-accent-500/25 ring-1 ring-inset ring-accent-500/40"
              />
              {silentLabel}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span aria-hidden className="size-3 rounded-[2px] bg-brand-500/70" />
              {loyalLabel}
            </span>
          </>
        ) : (
          <span className="inline-flex items-center gap-1.5">
            <span
              aria-hidden
              className="size-3 rounded-[2px] bg-surface-sunken ring-1 ring-inset ring-ink-900/10"
            />
            {conformLabel}
          </span>
        )}
      </div>

      {/* Live readout + verdict */}
      <p aria-live="polite" className="mt-4 font-display text-base font-semibold text-ink-900">
        {readout}{' '}
        <span
          className={cx(
            verdict === unravelledVerdict && 'text-accent-600',
            verdict === falseConsensusVerdict && 'text-brand-600',
          )}
        >
          {verdict}
        </span>
      </p>

      {/* Dissent-cost slider */}
      <div className="mt-3">
        <div className="flex items-center justify-between text-[0.65rem] font-bold uppercase tracking-wide text-ink-500">
          <label htmlFor={`${reactId}-cost`}>{costLabel}</label>
          <span>{cost}%</span>
        </div>
        <input
          id={`${reactId}-cost`}
          type="range"
          min={0}
          max={100}
          step={1}
          value={cost}
          onChange={(e) => onCostChange(Number(e.target.value))}
          aria-valuetext={`Dissent cost ${cost} percent`}
          className="mt-1 h-1.5 w-full cursor-pointer accent-brand-500"
        />
      </div>

      {/* Controls */}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => setRunning((r) => !r)}
          className="brutal-btn bg-accent-500 px-4 py-2 font-display text-sm text-white"
        >
          {settleLabel}
        </button>
        <button
          type="button"
          onClick={shock}
          className="brutal-btn bg-brand-500 px-4 py-2 font-display text-sm text-white"
        >
          {shockLabel}
        </button>
        <button
          type="button"
          onClick={() => setReveal((r) => !r)}
          aria-pressed={reveal}
          className="inline-flex items-center rounded-pill px-3 py-2 font-display text-sm font-semibold text-ink-700 ring-1 ring-inset ring-ink-300 transition-colors hover:bg-surface-sunken motion-reduce:transition-none"
        >
          {reveal ? hideLabel : revealLabel}
        </button>
        <button
          type="button"
          onClick={reset}
          className="inline-flex items-center rounded-pill px-3 py-2 font-display text-sm font-semibold text-ink-600 ring-1 ring-inset ring-ink-300 transition-colors hover:bg-surface-sunken motion-reduce:transition-none"
        >
          {resetLabel}
        </button>
      </div>

      {caption ? (
        <figcaption className="mt-3 text-sm text-ink-500">{caption}</figcaption>
      ) : null}
    </figure>
  );
}

export default PreferenceCascade;
