import { useId, useMemo, useState } from 'react';
import { cx } from '@/components/react/cx';

/** Props for the {@link DispersedKnowledgeMarket} island. */
export interface DispersedKnowledgeMarketProps {
  /** Heading above the card. */
  title?: string;
  /** Caption beneath the card. */
  caption?: string;
  /** Label for the planner mode toggle. Defaults to `'Central planner'`. */
  plannerLabel?: string;
  /** Label for the market mode toggle. Defaults to `'Price mechanism'`. */
  marketLabel?: string;
  /** Label for the shock button. Defaults to `'Trigger a local shock'`. */
  shockLabel?: string;
  /** Label for the reset button. Defaults to `'Reset'`. */
  resetLabel?: string;
  /** Label for the price readout. Defaults to `'Price'`. */
  priceLabel?: string;
  /** Label for the welfare readout. Defaults to `'Total welfare'`. */
  welfareLabel?: string;
  /** Label for the unmet-need readout. Defaults to `'Unmet high-value need'`. */
  unmetLabel?: string;
  /** Label for the knowledge readout. Defaults to `'Dispersed knowledge used'`. */
  knowledgeLabel?: string;
  /** Eyebrow line. Defaults to `'One economy, two operating systems'`. */
  eyebrow?: string;
  /** Instruction line above the simulation. */
  instructions?: string;
  /** Heading over the producer column. Defaults to `'Producers — private cost'`. */
  producersLabel?: string;
  /** Heading over the consumer column. Defaults to `'Consumers — private value'`. */
  consumersLabel?: string;
  /**
   * Gloss shown in planner mode. Placeholders: `{seen}`, `{total}`,
   * `{avgCost}`, `{avgValue}`, `{price}`.
   */
  plannerGloss?: string;
  /** Gloss shown in market mode. Placeholders: `{total}`, `{price}`. */
  marketGloss?: string;
  /** Legend label for an agent that trades. Defaults to `'Trades'`. */
  tradingLabel?: string;
  /** Legend label for an agent sitting out. Defaults to `'Sits out'`. */
  idleLabel?: string;
  /** Legend label for a shocked producer. Defaults to `'Shocked (cost up)'`. */
  shockedTagLabel?: string;
  /** Legend label for a high-value consumer left unserved. Defaults to `'High value, unserved'`. */
  unmetTagLabel?: string;
  /** Extra classes merged onto the root element. */
  className?: string;
}

/** A deterministic PRNG (mulberry32) so SSR and hydration agree — no flicker,
 *  no `Math.random()` at render scope. */
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

const SEED = 0x9e3d1a7;
/** Agents per side. 12 producers + 12 consumers → 24 private facts total. */
const N = 12;
/** The "tin district": the producers hit by the local shock. */
const SHOCK_IDS = [0, 1, 2, 3];
/** How much the shock raises each shocked producer's unit cost. */
const SHOCK_DELTA = 35;

interface World {
  /** Private unit cost per producer — nobody else ever sees these numbers. */
  costs: number[];
  /** Private unit value per consumer — equally invisible to everyone else. */
  values: number[];
  /** The planner's ration queue: a fixed, value-blind order of consumer ids. */
  queue: number[];
}

/**
 * Draw the economy once, deterministically. Costs spread ≈10–70 and values
 * ≈20–90 with seeded jitter, so supply and demand genuinely cross and the
 * world renders identically on server and client.
 */
function makeWorld(): World {
  const rng = mulberry32(SEED);
  const costs = Array.from({ length: N }, (_, i) =>
    Math.max(10, Math.min(70, Math.round(12 + (i / (N - 1)) * 56 + (rng() - 0.5) * 8))),
  );
  const values = Array.from({ length: N }, (_, i) =>
    Math.max(20, Math.min(90, Math.round(22 + (i / (N - 1)) * 66 + (rng() - 0.5) * 8))),
  );
  // Fisher–Yates shuffle → the bureaucratic queue, uncorrelated with value.
  const queue = Array.from({ length: N }, (_, i) => i);
  for (let i = N - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [queue[i], queue[j]] = [queue[j], queue[i]];
  }
  return { costs, values, queue };
}

interface Allocation {
  price: number;
  producerTrades: boolean[];
  consumerTrades: boolean[];
  welfare: number;
}

/**
 * The market outcome: sort asks ascending and bids descending, trade every
 * pair while value ≥ cost, and let the price settle in the gap between the
 * marginal traders. Every one of the 24 private numbers shapes where the
 * crossing lands — that is the "knowledge used" claim, computed for real.
 */
function clearMarket(costs: number[], values: number[]): Allocation {
  const sellers = costs.map((c, id) => ({ c, id })).sort((a, b) => a.c - b.c || a.id - b.id);
  const buyers = values.map((v, id) => ({ v, id })).sort((a, b) => b.v - a.v || a.id - b.id);
  let k = 0;
  while (k < N && buyers[k].v >= sellers[k].c) k += 1;

  let price: number;
  if (k === 0) {
    price = (sellers[0].c + buyers[0].v) / 2; // no gains from trade exist
  } else {
    // Any price here keeps the k traders in and everyone else out.
    const lo = Math.max(sellers[k - 1].c, k < N ? buyers[k].v : 0);
    const hi = Math.min(buyers[k - 1].v, k < N ? sellers[k].c : 100);
    price = (lo + hi) / 2;
  }
  price = Math.round(price * 2) / 2;

  const producerTrades = costs.map(() => false);
  const consumerTrades = values.map(() => false);
  let welfare = 0;
  for (let i = 0; i < k; i += 1) {
    producerTrades[sellers[i].id] = true;
    consumerTrades[buyers[i].id] = true;
    welfare += buyers[i].v - sellers[i].c;
  }
  return { price, producerTrades, consumerTrades, welfare };
}

/**
 * The planner's outcome. The decree price came from two stale aggregates;
 * plants whose (private, invisible) cost exceeds the decreed price simply
 * miss quota, and whatever gets produced is handed down a value-blind ration
 * queue — first in line eats, however little they wanted it.
 */
function plannerAllocate(
  costs: number[],
  values: number[],
  queue: number[],
  decreedPrice: number,
): Allocation {
  const producerTrades = costs.map((c) => c <= decreedPrice);
  const supply = producerTrades.filter(Boolean).length;
  const consumerTrades = values.map(() => false);
  for (let i = 0; i < supply && i < N; i += 1) consumerTrades[queue[i]] = true;
  const made = costs.reduce((s, c, i) => s + (producerTrades[i] ? c : 0), 0);
  const enjoyed = values.reduce((s, v, i) => s + (consumerTrades[i] ? v : 0), 0);
  return { price: decreedPrice, producerTrades, consumerTrades, welfare: enjoyed - made };
}

/** Fill `{placeholder}` slots in a template string. */
function fill(tpl: string, vars: Record<string, string | number>): string {
  return Object.entries(vars).reduce(
    (out, [key, val]) => out.replaceAll(`{${key}}`, String(val)),
    tpl,
  );
}

/**
 * **Dispersed-knowledge market** — Hayek's knowledge problem you can poke.
 *
 * A tiny economy of 12 producers (each with a private unit cost) and 12
 * consumers (each with a private unit value): 24 facts no single mind holds.
 * In **planner** mode, the center sees only two aggregates — average cost and
 * average value — decrees one price from them, and allocates by quota and
 * ration queue, blind to who actually values or can cheaply make the good.
 * In **market** mode the very same private numbers meet as bids and asks; the
 * clearing price emerges, trades happen exactly where value ≥ price ≥ cost,
 * and welfare is maximal — all 24 facts got used without anyone revealing them.
 *
 * Then hit the **shock**: a "tin shortage" raises costs in one producer
 * district. The market's price climbs and the allocation quietly re-sorts
 * itself; the planner's decree — pegged to aggregates that barely moved and
 * arrive late — stays put, deliveries collapse, and high-value need goes
 * unmet. The shock persists across mode toggles so you can compare directly.
 *
 * Fully deterministic (seeded PRNG), all meaning lives in the `aria-live`
 * readout (the tile grids are decorative for screen readers), and transitions
 * respect `prefers-reduced-motion`.
 */
export function DispersedKnowledgeMarket({
  title,
  caption,
  plannerLabel = 'Central planner',
  marketLabel = 'Price mechanism',
  shockLabel = 'Trigger a local shock',
  resetLabel = 'Reset',
  priceLabel = 'Price',
  welfareLabel = 'Total welfare',
  unmetLabel = 'Unmet high-value need',
  knowledgeLabel = 'Dispersed knowledge used',
  eyebrow = 'One economy, two operating systems',
  instructions = 'Twelve producers each know only their own cost; twelve consumers each know only their own value — 24 private facts, held by 24 different heads. Run the same economy under a central plan, then under a price. Then shock it and watch which one adapts.',
  producersLabel = 'Producers — private cost',
  consumersLabel = 'Consumers — private value',
  plannerGloss = 'The planner sees {seen} of {total} facts — average cost {avgCost}, average value {avgValue} — decrees a price of {price}, and hands output down a ration queue that ignores who values it most.',
  marketGloss = 'Nobody decreed {price}. Every bid and ask smuggled one private fact into the price — all {total} of them — and trades landed exactly where value ≥ price ≥ cost.',
  tradingLabel = 'Trades',
  idleLabel = 'Sits out',
  shockedTagLabel = 'Shocked (cost up)',
  unmetTagLabel = 'High value, unserved',
  className,
}: DispersedKnowledgeMarketProps) {
  const reactId = useId();
  const [mode, setMode] = useState<'planner' | 'market'>('planner');
  const [shocked, setShocked] = useState(false);
  const [visited, setVisited] = useState({ planner: true, market: false });

  const world = useMemo(makeWorld, []);

  // Current costs: the shock raises the tin district's costs; values persist.
  const costs = useMemo(
    () =>
      shocked
        ? world.costs.map((c, i) => (SHOCK_IDS.includes(i) ? c + SHOCK_DELTA : c))
        : world.costs,
    [world, shocked],
  );

  // The planner's two facts are STALE baseline aggregates — a local shock
  // barely moves a 12-plant average, and the report lands late anyway. The
  // decree therefore does not budge when the world does. That's the lesson.
  const decreedPrice = useMemo(() => {
    const avgCost = world.costs.reduce((s, c) => s + c, 0) / N;
    const avgValue = world.values.reduce((s, v) => s + v, 0) / N;
    return Math.round((avgCost + avgValue) / 2);
  }, [world]);
  const avgCost = Math.round(world.costs.reduce((s, c) => s + c, 0) / N);
  const avgValue = Math.round(world.values.reduce((s, v) => s + v, 0) / N);

  // Both allocations are pure functions of the (possibly shocked) world, so we
  // can always compare planner vs market welfare side by side once visited.
  const market = useMemo(() => clearMarket(costs, world.values), [costs, world]);
  const planner = useMemo(
    () => plannerAllocate(costs, world.values, world.queue, decreedPrice),
    [costs, world, decreedPrice],
  );

  const current = mode === 'market' ? market : planner;

  // Unmet high-value need: consumers whose private value clears the TRUE
  // market price yet got no unit. Zero by construction under the market.
  const unmet = world.values.filter((v, i) => v >= market.price && !current.consumerTrades[i]).length;
  const knowledgeUsed = mode === 'market' ? N * 2 : 2;

  const pickMode = (next: 'planner' | 'market') => {
    setMode(next);
    setVisited((v) => ({ ...v, [next]: true }));
  };
  const reset = () => {
    setShocked(false);
    setMode('planner');
    setVisited({ planner: true, market: false });
  };

  const gloss =
    mode === 'planner'
      ? fill(plannerGloss, {
          seen: 2,
          total: N * 2,
          avgCost,
          avgValue,
          price: decreedPrice,
        })
      : fill(marketGloss, { total: N * 2, price: market.price });

  const tileBase =
    'relative flex aspect-square flex-col items-center justify-center rounded-[4px] font-mono text-xs font-semibold leading-none transition-colors duration-300 motion-reduce:transition-none';

  return (
    <figure className={cx('brutal my-6 bg-surface p-5 sm:p-6', className)}>
      <p className="font-display text-xs font-semibold uppercase tracking-wide text-brand-600">
        {eyebrow}
      </p>
      {title ? (
        <p className="mt-1 font-display text-lg font-semibold text-ink-900">{title}</p>
      ) : null}
      <p className="mt-2 text-sm font-medium text-ink-700">{instructions}</p>

      {/* Mode toggle + shock + reset */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <div
          role="group"
          aria-label={`${plannerLabel} / ${marketLabel}`}
          className="inline-flex overflow-hidden rounded-pill ring-1 ring-inset ring-ink-300"
        >
          {(
            [
              { key: 'planner', label: plannerLabel },
              { key: 'market', label: marketLabel },
            ] as const
          ).map(({ key, label }) => (
            <button
              key={key}
              type="button"
              aria-pressed={mode === key}
              onClick={() => pickMode(key)}
              className={cx(
                'px-4 py-2 font-display text-sm font-semibold transition-colors motion-reduce:transition-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600',
                mode === key ? 'bg-brand-600 text-white' : 'bg-surface text-ink-600 hover:bg-surface-sunken',
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setShocked(true)}
          disabled={shocked}
          aria-pressed={shocked}
          className={cx(
            'brutal-btn px-4 py-2 font-display text-sm text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600',
            shocked ? 'cursor-not-allowed bg-ink-300' : 'bg-danger',
          )}
        >
          {shockLabel}
        </button>
        <button
          type="button"
          onClick={reset}
          className="inline-flex items-center rounded-pill px-3 py-2 font-display text-sm font-semibold text-ink-600 ring-1 ring-inset ring-ink-300 transition-colors hover:bg-surface-sunken motion-reduce:transition-none"
        >
          {resetLabel}
        </button>
      </div>
      <p className="mt-2 text-xs italic text-ink-500">{gloss}</p>

      {/* The two sides of the economy. Decorative — meaning lives in the readout. */}
      <div aria-hidden className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <p className="text-[0.65rem] font-bold uppercase tracking-wide text-ink-500">
            {producersLabel}
          </p>
          <div className="mt-2 grid grid-cols-6 gap-1">
            {costs.map((c, i) => {
              const trades = current.producerTrades[i];
              const isShocked = shocked && SHOCK_IDS.includes(i);
              return (
                <span
                  key={`${reactId}-p-${i}`}
                  title={`cost ${c}`}
                  className={cx(
                    tileBase,
                    trades
                      ? 'bg-brand-600 text-white'
                      : 'bg-surface-sunken text-ink-400 ring-1 ring-inset ring-ink-900/5',
                    isShocked && 'ring-2 ring-inset ring-danger',
                  )}
                >
                  {isShocked ? <span className="text-[0.55rem] text-danger">▲</span> : null}
                  {c}
                </span>
              );
            })}
          </div>
        </div>
        <div>
          <p className="text-[0.65rem] font-bold uppercase tracking-wide text-ink-500">
            {consumersLabel}
          </p>
          <div className="mt-2 grid grid-cols-6 gap-1">
            {world.values.map((v, i) => {
              const served = current.consumerTrades[i];
              const starving = !served && v >= market.price; // high value, no unit
              return (
                <span
                  key={`${reactId}-c-${i}`}
                  title={`value ${v}`}
                  className={cx(
                    tileBase,
                    served && 'bg-accent-500 text-white',
                    !served && starving && 'bg-danger/10 text-danger ring-1 ring-inset ring-danger/50',
                    !served && !starving && 'bg-surface-sunken text-ink-400 ring-1 ring-inset ring-ink-900/5',
                  )}
                >
                  {starving ? <span className="text-[0.55rem]">!</span> : null}
                  {v}
                </span>
              );
            })}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[0.7rem] font-semibold text-ink-600">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="size-3 rounded-[2px] bg-brand-600" />
          <span aria-hidden className="size-3 rounded-[2px] bg-accent-500" />
          {tradingLabel}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span
            aria-hidden
            className="size-3 rounded-[2px] bg-surface-sunken ring-1 ring-inset ring-ink-900/10"
          />
          {idleLabel}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="text-danger">▲</span>
          {shockedTagLabel}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span
            aria-hidden
            className="size-3 rounded-[2px] bg-danger/10 ring-1 ring-inset ring-danger/50"
          />
          {unmetTagLabel}
        </span>
      </div>

      {/* Price dial: one shared 0–100 scale, marker slides to the live price. */}
      <div aria-hidden className="mt-5">
        <div className="relative h-2 rounded-pill bg-surface-sunken ring-1 ring-inset ring-ink-900/5">
          <span
            className="absolute top-1/2 h-5 w-1 -translate-x-1/2 -translate-y-1/2 rounded-pill bg-ink-900 transition-[left] duration-300 ease-out motion-reduce:transition-none"
            style={{ left: `${Math.min(100, Math.max(0, current.price))}%` }}
          />
        </div>
        <div className="mt-1 flex justify-between text-[0.65rem] text-ink-400">
          <span>0</span>
          <span className="font-mono font-semibold text-ink-700">
            {priceLabel}: {current.price}
          </span>
          <span>100</span>
        </div>
      </div>

      {/* Live readouts — the meaning of the whole card lives here. */}
      <dl
        aria-live="polite"
        className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4"
      >
        {[
          { label: priceLabel, value: String(current.price) },
          { label: welfareLabel, value: String(current.welfare) },
          { label: unmetLabel, value: String(unmet) },
          { label: knowledgeLabel, value: `${knowledgeUsed} / ${N * 2}` },
        ].map(({ label, value }) => (
          <div
            key={label}
            className="rounded-card border border-ink-100 bg-surface-sunken p-2.5"
          >
            <dt className="text-[0.6rem] font-bold uppercase tracking-wide text-ink-500">
              {label}
            </dt>
            <dd className="mt-0.5 font-display text-lg font-semibold text-ink-900">{value}</dd>
          </div>
        ))}
      </dl>

      {/* Once both regimes have been visited, put their welfare side by side. */}
      {visited.planner && visited.market ? (
        <p aria-live="polite" className="mt-3 text-sm font-semibold text-ink-700">
          <span className="text-[0.65rem] font-bold uppercase tracking-wide text-ink-500">
            {welfareLabel} —{' '}
          </span>
          <span className={cx(mode === 'planner' && 'text-brand-700')}>
            {plannerLabel}: {planner.welfare}
          </span>
          <span className="text-ink-400"> · </span>
          <span className={cx(mode === 'market' && 'text-brand-700')}>
            {marketLabel}: {market.welfare}
          </span>
        </p>
      ) : null}

      {caption ? (
        <figcaption className="mt-3 text-sm text-ink-500">{caption}</figcaption>
      ) : null}
    </figure>
  );
}

export default DispersedKnowledgeMarket;
