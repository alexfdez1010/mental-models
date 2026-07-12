import { useId, useMemo, useState } from 'react';
import { cx } from '@/components/react/cx';

/** One remedy the learner can switch on to fight the unravelling. */
export type LemonsRemedy = 'none' | 'signal' | 'mandate';

/** Props for the {@link LemonsMarket} island. */
export interface LemonsMarketProps {
  /** Heading above the card. */
  title?: string;
  /** Eyebrow label. Defaults to `'Lemons-market simulator'`. */
  eyebrow?: string;
  /** Instruction line above the simulation. */
  instructions?: string;
  /** Caption beneath the card. */
  caption?: string;
  /** Label over the hidden-information slider. */
  hiddenLabel?: string;
  /** One-line gloss under the hidden slider. */
  hiddenHint?: string;
  /** Label over the round scrubber. Defaults to `'Trading round'`. */
  roundLabel?: string;
  /** Heading over the population grid. Defaults to `'The cars on the lot'`. */
  lotLabel?: string;
  /** Small key note under the grid. */
  lotHint?: string;
  /** Heading over the average-quality trajectory. Defaults to `'Average quality still for sale'`. */
  trajectoryLabel?: string;
  /** Heading over the remedy switch. Defaults to `'Try a cure'`. */
  remedyLabel?: string;
  /** Button text for the no-remedy option. Defaults to `'No cure'`. */
  remedyNoneLabel?: string;
  /** Button text for the signalling remedy. Defaults to `'Warranty signal'`. */
  remedySignalLabel?: string;
  /** Button text for the mandate remedy. Defaults to `'Mandatory inspection'`. */
  remedyMandateLabel?: string;
  /** One-line gloss under the remedy switch (depends on the active remedy). */
  remedyNoneHint?: string;
  remedySignalHint?: string;
  remedyMandateHint?: string;
  /** Heading over the live stat readout. Defaults to `'What the market did'`. */
  readoutLabel?: string;
  /** Stat label: cars still trading. Defaults to `'Cars still trading'`. */
  tradingStatLabel?: string;
  /** Stat label: good cars driven out. Defaults to `'Good cars driven out'`. */
  drivenOutStatLabel?: string;
  /** Stat label: average quality on the lot. Defaults to `'Average quality'`. */
  avgStatLabel?: string;
  /** Verdict when the market has unravelled toward lemons. `{out}` is replaced. */
  unravelledReadout?: string;
  /** Verdict when the market survives largely intact. `{trading}` is replaced. */
  survivedReadout?: string;
  /** Word marking a withdrawn car for screen readers. Defaults to `'withdrawn'`. */
  withdrawnWord?: string;
  /** Starting hidden-information percentage (0–100). Defaults to `100`. */
  initialHidden?: number;
  /** Extra classes merged onto the root element. */
  className?: string;
}

// ── The lemons model (Akerlof, kept deliberately concrete) ────────────────────
// A fixed lot of N used cars, each with a true QUALITY q (0–100) known only to
// its seller. Every seller would happily part with their car for a bit less than
// it is worth to them — the gains from trade — so a seller lists (and sells) only
// while the buyer's offer clears their reservation, `KEEP·q`.
//
// Buyers cannot see q. They see only the pool that is still for sale, so they pay
// each car a blend of what they *can* verify and the pool's AVERAGE quality:
//   offer(q) = (1 − h)·q + h·avg      (h = fraction of quality that is hidden)
// With h = 1 every car is offered the pooled average; with h = 0 every car is
// offered its own true worth. A good-type seller withdraws the moment the pooled
// offer falls below `KEEP·q` — and each departure of a good car drags `avg` down,
// which lowers next round's offer, which drives out the next tier of good cars.
// That self-reinforcing exit is the unravelling; it halts at the pool of cars the
// sinking average can still support (the lemons).
//
// Remedies change the EFFECTIVE hidden fraction per car: a `signal` (a costly,
// credible warranty only worth buying on a good car) makes the top half's quality
// observable, so good types stay; a `mandate` (compulsory inspection/certification)
// makes every car's quality observable, so the whole market survives.
const N = 24;
const KEEP = 0.8; // sellers reserve 80% of true worth — real gains from trade exist
const MAX_ROUNDS = 8;
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

/** Deterministic, evenly spread quality ladder (no RNG → SSR-stable). */
const QUALITIES = Array.from({ length: N }, (_, i) => Math.round(12 + (94 - 12) * (i / (N - 1))));
const MEDIAN_Q = QUALITIES[Math.floor(N / 2)];
/** A car counts as "good" if it sits in the top half of the quality ladder. */
const GOOD = QUALITIES.map((q) => q >= MEDIAN_Q);

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

/** The per-round history of who is still listed and the pool average. */
function simulate(hidden: number, remedy: LemonsRemedy) {
  const h = hidden / 100;
  const effHidden = (i: number) => {
    if (remedy === 'mandate') return 0; // every car is inspected → quality observable
    if (remedy === 'signal' && GOOD[i]) return 0; // good types certify → observable
    return h;
  };

  const history: { listed: boolean[]; avg: number }[] = [];
  let listed = QUALITIES.map(() => true);
  history.push({ listed: [...listed], avg: mean(QUALITIES) });

  for (let r = 0; r < MAX_ROUNDS; r++) {
    const cur = history[history.length - 1];
    const next = cur.listed.map((isListed, i) => {
      if (!isListed) return false;
      const offer = (1 - effHidden(i)) * QUALITIES[i] + effHidden(i) * cur.avg;
      return offer >= KEEP * QUALITIES[i]; // seller stays only if the offer clears reservation
    });
    if (next.every((v, i) => v === cur.listed[i])) break; // stable
    const stillQ = QUALITIES.filter((_, i) => next[i]);
    history.push({ listed: next, avg: mean(stillQ) });
  }
  return history;
}

/** Quality → design-token tint (green good → amber → red lemon). */
function tone(q: number): { bg: string; text: string } {
  if (q >= 66) return { bg: 'bg-success', text: 'text-white' };
  if (q >= 38) return { bg: 'bg-warning', text: 'text-ink-900' };
  return { bg: 'bg-danger', text: 'text-white' };
}

/**
 * Interactive **lemons-market simulator** — Akerlof's used-car market unravelling
 * under asymmetric information, and surviving once a credible signal or a mandate
 * makes quality observable.
 *
 * A fixed lot of cars carries hidden qualities. Buyers, unable to tell a peach
 * from a lemon, offer a blend of each car's verifiable worth and the pool's
 * *average* quality. Drag the **hidden-information** slider up and the good-type
 * sellers — offered the pooled average, far below what their car is worth — pull
 * out; their exit drags the average down, which drives out the next tier, round
 * after round, until only the lemons are left. Scrub the **round** slider to watch
 * the collapse happen one step at a time.
 *
 * The **remedy** switch shows the cures: a costly **warranty signal** only worth
 * buying on a good car makes the top half's quality credible, so the good types
 * stay; a **mandatory inspection** makes every car's quality observable, so the
 * whole market survives. The trap was never dishonest sellers — it was hidden
 * information about *type*.
 *
 * All state is derived (`useMemo`); the only motion is a gentle tween on the tiles
 * and the trajectory bars, disabled under `prefers-reduced-motion`. The verdict is
 * announced via `aria-live`; the grid is keyboard-independent and its meaning
 * lives in the readout.
 */
export function LemonsMarket({
  title,
  eyebrow = 'Lemons-market simulator',
  instructions = 'Buyers cannot tell a peach from a lemon, so they only offer the average. Raise how much quality is hidden and watch the good cars pull out — then scrub the rounds to see the market unravel toward lemons.',
  caption,
  hiddenLabel = 'How much quality is hidden from buyers',
  hiddenHint = 'At 100% buyers see only the pool average; at 0% they can verify every car and the unravelling never starts.',
  roundLabel = 'Trading round',
  lotLabel = 'The cars on the lot',
  lotHint = 'Green = a peach (high quality), red = a lemon (low quality). A dimmed tile is a seller who has withdrawn — a good car the market priced away.',
  trajectoryLabel = 'Average quality still for sale',
  remedyLabel = 'Try a cure',
  remedyNoneLabel = 'No cure',
  remedySignalLabel = 'Warranty signal',
  remedyMandateLabel = 'Mandatory inspection',
  remedyNoneHint = 'Nothing separates a good car from a bad one — the pool prices them all the same, so the good ones leave.',
  remedySignalHint = 'Good-type sellers post a costly warranty a lemon owner would never buy — it credibly reveals quality, so the peaches stay and sell for what they are worth.',
  remedyMandateHint = 'A compulsory inspection makes every car’s quality observable, so buyers pay each car its true worth and no one is driven out.',
  readoutLabel = 'What the market did',
  tradingStatLabel = 'Cars still trading',
  drivenOutStatLabel = 'Good cars driven out',
  avgStatLabel = 'Average quality',
  unravelledReadout = 'The pool average collapsed and {out} good cars were priced out of the market — hidden information, not bad intentions, drove the peaches away and left the lemons.',
  survivedReadout = 'The market holds: {trading} of the cars are still trading and the good types stayed, because quality is now observable enough to price each car fairly.',
  withdrawnWord = 'withdrawn',
  initialHidden = 100,
  className,
}: LemonsMarketProps) {
  const reactId = useId();
  const [hidden, setHidden] = useState(() => clamp(initialHidden, 0, 100));
  const [remedy, setRemedy] = useState<LemonsRemedy>('none');
  const [round, setRound] = useState(MAX_ROUNDS);

  const history = useMemo(() => simulate(hidden, remedy), [hidden, remedy]);
  const lastRound = history.length - 1;
  const view = Math.min(round, lastRound);
  const frame = history[view];

  const trading = frame.listed.filter(Boolean).length;
  const goodDrivenOut = GOOD.reduce(
    (acc, isGood, i) => acc + (isGood && !frame.listed[i] ? 1 : 0),
    0,
  );
  const unravelled = goodDrivenOut >= 3;
  const readout = unravelled
    ? unravelledReadout.replace('{out}', String(goodDrivenOut))
    : survivedReadout.replace('{trading}', String(trading));

  const maxAvg = mean(QUALITIES); // round-0 average is the ceiling for the bars
  const tween = 'transition-all duration-300 ease-out motion-reduce:transition-none';

  const remedies: { key: LemonsRemedy; label: string }[] = [
    { key: 'none', label: remedyNoneLabel },
    { key: 'signal', label: remedySignalLabel },
    { key: 'mandate', label: remedyMandateLabel },
  ];
  const remedyHint =
    remedy === 'signal' ? remedySignalHint : remedy === 'mandate' ? remedyMandateHint : remedyNoneHint;

  const Stat = ({ label, value, toneClass }: { label: string; value: string; toneClass?: string }) => (
    <div className="rounded-card border border-ink-100 bg-surface-sunken px-3 py-2">
      <p className="text-[0.6rem] font-bold uppercase tracking-wide text-ink-500">{label}</p>
      <p className={cx('mt-0.5 font-display text-base font-semibold tabular-nums', toneClass ?? 'text-ink-900')}>
        {value}
      </p>
    </div>
  );

  return (
    <figure className={cx('brutal my-6 bg-surface p-5 sm:p-6', className)}>
      <p className="font-display text-xs font-semibold uppercase tracking-wide text-accent-600">{eyebrow}</p>
      {title ? <p className="mt-1 font-display text-lg font-semibold text-ink-900">{title}</p> : null}

      <p className="mt-2 text-sm font-medium text-ink-700">{instructions}</p>

      {/* The lot of cars at the scrubbed round. Decorative — meaning is in the readout. */}
      <p className="mt-4 text-[0.65rem] font-bold uppercase tracking-wide text-ink-500">{lotLabel}</p>
      <div aria-hidden className="mt-2 grid grid-cols-8 gap-1.5 sm:grid-cols-12">
        {QUALITIES.map((q, i) => {
          const on = frame.listed[i];
          const t = tone(q);
          return (
            <span
              key={`${reactId}-car-${i}`}
              title={`${GOOD[i] ? 'peach' : 'lemon'} · quality ${q}${on ? '' : ` · ${withdrawnWord}`}`}
              className={cx(
                'flex aspect-square items-center justify-center rounded-md text-[0.6rem] font-bold tabular-nums',
                tween,
                on ? cx(t.bg, t.text) : 'border border-dashed border-ink-300 bg-surface-sunken text-ink-300 opacity-60',
              )}
            >
              {on ? q : '—'}
            </span>
          );
        })}
      </div>
      <p className="mt-1.5 text-xs text-ink-500">{lotHint}</p>

      {/* Average-quality trajectory across the rounds. */}
      <p className="mt-5 text-[0.65rem] font-bold uppercase tracking-wide text-ink-500">{trajectoryLabel}</p>
      <div aria-hidden className="mt-2 flex h-24 items-end gap-1 rounded-card bg-surface-sunken p-2">
        {history.map((f, i) => {
          const active = i === view;
          const dim = i > view;
          return (
            <span
              key={`${reactId}-bar-${i}`}
              className="flex flex-1 flex-col justify-end self-stretch"
              title={`round ${i}: avg ${Math.round(f.avg)}`}
            >
              <span
                className={cx(
                  'w-full rounded-t-sm',
                  tween,
                  dim ? 'bg-ink-200' : active ? 'bg-accent-500' : 'bg-accent-300',
                )}
                style={{ height: `${Math.max(3, (f.avg / maxAvg) * 100)}%` }}
              />
            </span>
          );
        })}
      </div>
      <div className="mt-1 flex justify-between text-[0.65rem] text-ink-400">
        <span>round 0</span>
        <span>
          {roundLabel.toLowerCase()} {lastRound}
        </span>
      </div>

      {/* Live verdict. */}
      <div aria-live="polite">
        <p className="mt-4 text-[0.65rem] font-bold uppercase tracking-wide text-ink-600">{readoutLabel}</p>
        <div className="mt-2 grid grid-cols-3 gap-2">
          <Stat label={tradingStatLabel} value={`${trading}/${N}`} />
          <Stat
            label={drivenOutStatLabel}
            value={String(goodDrivenOut)}
            toneClass={goodDrivenOut > 0 ? 'text-danger' : 'text-ink-900'}
          />
          <Stat label={avgStatLabel} value={String(Math.round(frame.avg))} />
        </div>
        <p className="mt-2 font-display text-base font-semibold text-ink-900">{readout}</p>
      </div>

      {/* Round scrubber. */}
      <div className="mt-4">
        <label
          htmlFor={`${reactId}-round`}
          className="flex items-baseline justify-between gap-2 text-[0.65rem] font-bold uppercase tracking-wide text-ink-600"
        >
          <span>{roundLabel}</span>
          <span className="text-sm font-semibold tabular-nums text-accent-600">
            {view} / {lastRound}
          </span>
        </label>
        <input
          id={`${reactId}-round`}
          type="range"
          min={0}
          max={lastRound}
          step={1}
          value={view}
          onChange={(e) => setRound(clamp(Number(e.target.value), 0, lastRound))}
          aria-valuetext={`round ${view} of ${lastRound}`}
          className="mt-1 h-1.5 w-full cursor-pointer accent-accent-500"
        />
      </div>

      {/* Hidden-information slider. */}
      <div className="mt-4">
        <label
          htmlFor={`${reactId}-hidden`}
          className="flex items-baseline justify-between gap-2 text-[0.65rem] font-bold uppercase tracking-wide text-ink-600"
        >
          <span>{hiddenLabel}</span>
          <span className="text-sm font-semibold tabular-nums text-ink-700">{hidden}%</span>
        </label>
        <input
          id={`${reactId}-hidden`}
          type="range"
          min={0}
          max={100}
          step={5}
          value={hidden}
          onChange={(e) => {
            setHidden(clamp(Number(e.target.value), 0, 100));
            setRound(MAX_ROUNDS);
          }}
          aria-valuetext={`${hidden}% of quality hidden`}
          className="mt-1 h-1.5 w-full cursor-pointer accent-ink-400"
        />
        <p className="mt-1 text-xs text-ink-500">{hiddenHint}</p>
      </div>

      {/* Remedy switch — the cures. */}
      <p className="mt-5 text-[0.65rem] font-bold uppercase tracking-wide text-ink-600">{remedyLabel}</p>
      <div role="group" aria-label={remedyLabel} className="mt-2 flex flex-wrap gap-2">
        {remedies.map((r) => {
          const on = remedy === r.key;
          return (
            <button
              key={r.key}
              type="button"
              aria-pressed={on}
              onClick={() => {
                setRemedy(r.key);
                setRound(MAX_ROUNDS);
              }}
              className={cx(
                'rounded-pill border-2 px-3 py-1.5 text-xs font-semibold transition-colors motion-reduce:transition-none',
                on
                  ? 'border-accent-500 bg-accent-500 text-white'
                  : 'border-ink-200 bg-surface text-ink-600 hover:border-accent-300',
              )}
            >
              {r.label}
            </button>
          );
        })}
      </div>
      <p aria-live="polite" className="mt-2 text-xs text-ink-500">
        {remedyHint}
      </p>

      {caption ? <figcaption className="mt-3 text-sm text-ink-500">{caption}</figcaption> : null}
    </figure>
  );
}

export default LemonsMarket;
