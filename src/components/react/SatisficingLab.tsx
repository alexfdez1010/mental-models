import { useId, useMemo, useState } from 'react';
import { cx } from '@/components/react/cx';

/** Props for the {@link SatisficingLab} island. */
export interface SatisficingLabProps {
  /** Heading above the card. */
  title?: string;
  /** Eyebrow label. Defaults to `'Satisficing lab'`. */
  eyebrow?: string;
  /** Instruction line above the chart. */
  instructions?: string;
  /** Caption beneath the card. */
  caption?: string;
  /** Number of options in the field. Defaults to `25`. */
  initialN?: number;
  /** Starting aspiration level, 0–100. Defaults to `70`. */
  initialAspiration?: number;
  /** Starting search cost per look, in quality points. Defaults to `2`. */
  initialCost?: number;

  // ── Labels (all user-facing strings, for i18n) ────────────────────────────
  /** Label over the aspiration-level slider. */
  aspirationLabel?: string;
  /** Label over the search-cost slider. */
  costLabel?: string;
  /** Label over the option-count slider. */
  countLabel?: string;
  /** x-axis title. */
  axisAspirationLabel?: string;
  /** y-axis title. */
  axisValueLabel?: string;
  /** Stat label for the satisficer's average accepted quality. */
  qualityStatLabel?: string;
  /** Stat label for the satisficer's average number of looks. */
  looksStatLabel?: string;
  /** Stat label for the satisficer's average regret. */
  regretStatLabel?: string;
  /** Stat label for the satisficer's average net value. */
  netStatLabel?: string;
  /** Label for the best aspiration marker. */
  optimalStatLabel?: string;
  /** Row label for the satisficer summary. */
  satisficerLabel?: string;
  /** Row label for the maximiser summary. */
  maximiserLabel?: string;
  /** Column header: quality. */
  colQualityLabel?: string;
  /** Column header: looks. */
  colLooksLabel?: string;
  /** Column header: net value. */
  colNetLabel?: string;
  /** Button that deals a fresh sequence for the single-run demo. */
  dealLabel?: string;
  /** Heading over the single-run demo strip. */
  demoLabel?: string;
  /** Chip caption for options rejected as below aspiration. */
  rejectedLabel?: string;
  /** Chip caption for the accepted option. */
  acceptedLabel?: string;
  /** Chip caption noting where the true best sat. `{pos}` is replaced. */
  bestWasLabel?: string;
  /**
   * Readout template. `{n}`, `{aspiration}`, `{quality}`, `{looks}`,
   * `{net}`, `{optimal}`, `{maxnet}` are replaced with live values.
   */
  readoutTemplate?: string;
  /** Extra classes merged onto the root element. */
  className?: string;
}

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

// ── Deterministic PRNG (mulberry32) ─────────────────────────────────────────
// Seeded so the Monte-Carlo curves are IDENTICAL on the server and the client —
// no hydration mismatch, and the chart is reproducible.
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A field of `n` option qualities in 1..100 drawn from a seeded PRNG. */
function dealField(n: number, rnd: () => number): number[] {
  return Array.from({ length: n }, () => 1 + Math.floor(rnd() * 100));
}

/**
 * Run the satisficer on one field: accept the FIRST option whose quality is at
 * or above the aspiration level; if none clears it, you are forced onto the very
 * last option.
 * @returns index accepted and the quality taken.
 */
function runSatisficer(field: number[], aspiration: number): { idx: number; quality: number } {
  for (let i = 0; i < field.length; i++) {
    if (field[i] >= aspiration) return { idx: i, quality: field[i] };
  }
  const last = field.length - 1;
  return { idx: last, quality: field[last] };
}

interface AspStats {
  quality: number; // avg accepted quality
  looks: number; // avg number of options inspected
  regret: number; // avg (best − accepted)
}

/** Chart geometry. */
const CW = 320;
const CH = 200;
const PAD_L = 30;
const PAD_R = 12;
const PAD_T = 14;
const PAD_B = 26;
const PLOT_W = CW - PAD_L - PAD_R;
const PLOT_H = CH - PAD_T - PAD_B;

/**
 * **Bounded rationality & satisficing.** Real minds cannot inspect every option
 * and maximise — they set an *aspiration level* and take the first option that
 * clears it, then stop. This lab pits a **satisficer** (stop at the first
 * good-enough option) against a **maximiser** (search everything for the true
 * best), and shows the trade-off once *search itself is costly*.
 *
 * The curve plots the satisficer's average **net value** (accepted quality minus
 * the cost of every look) as a function of the aspiration level: too low and you
 * grab junk early; too high and you search forever (and often get forced onto a
 * poor last option), paying huge search costs. The peak is the best aspiration.
 * A dashed line marks the maximiser's net value — crank the **search cost** and
 * watch the maximiser fall below the satisficer's peak: when looking is
 * expensive, "good enough, fast" beats "the best, eventually".
 *
 * Both curves are seeded Monte-Carlo (deterministic across server/client, so no
 * hydration mismatch). The looks/quality curves are computed once per field
 * size; changing the cost is a cheap transform. Safe under
 * `prefers-reduced-motion` — nothing animates on a loop.
 */
export function SatisficingLab({
  title,
  eyebrow = 'Satisficing lab',
  instructions = 'Options arrive one at a time with a hidden quality (1–100). A satisficer sets an aspiration level and grabs the first option that clears it; a maximiser inspects everything to find the true best. Drag the aspiration, then raise the cost of each look and watch which strategy wins.',
  caption,
  initialN = 25,
  initialAspiration = 70,
  initialCost = 2,
  aspirationLabel = 'Aspiration level (accept the first option this good)',
  costLabel = 'Cost per look (points)',
  countLabel = 'How many options',
  axisAspirationLabel = 'Aspiration level →',
  axisValueLabel = 'Net value',
  qualityStatLabel = 'Accepted quality',
  looksStatLabel = 'Looks used',
  regretStatLabel = 'Regret',
  netStatLabel = 'Net value',
  optimalStatLabel = 'Best aspiration',
  satisficerLabel = 'Satisficer',
  maximiserLabel = 'Maximiser',
  colQualityLabel = 'Quality',
  colLooksLabel = 'Looks',
  colNetLabel = 'Net value',
  dealLabel = 'Deal a new field',
  demoLabel = 'Watch one search',
  rejectedLabel = 'rejected (below bar)',
  acceptedLabel = 'accepted',
  bestWasLabel = 'the true best was #{pos}',
  readoutTemplate = 'With {n} options and an aspiration of {aspiration}, the satisficer accepts quality {quality} after just {looks} looks for a net value of {net}. The best aspiration here is about {optimal}. The maximiser finds the true best but pays for every look — its net value is only {maxnet}.',
  className,
}: SatisficingLabProps) {
  const reactId = useId();

  const [n, setN] = useState(() => clamp(Math.round(initialN), 6, 50));
  const [aspiration, setAspiration] = useState(() => clamp(Math.round(initialAspiration), 0, 100));
  const [cost, setCost] = useState(() => clamp(Math.round(initialCost), 0, 6));

  // Deal a demo field deterministically at first, then via user clicks.
  const [demoField, setDemoField] = useState<number[]>(() =>
    dealField(clamp(Math.round(initialN), 6, 50), mulberry32(11)),
  );

  // Monte-Carlo the looks / quality / regret for EVERY aspiration 0..100, plus
  // the maximiser's average best quality. Depends only on n (and the seed), so
  // changing the cost is a cheap post-hoc transform.
  const { stats, maxQuality } = useMemo(() => {
    const trials = n <= 15 ? 1400 : n <= 30 ? 800 : 500;
    const rnd = mulberry32(0x5a71 + n);
    const asp: AspStats[] = Array.from({ length: 101 }, () => ({ quality: 0, looks: 0, regret: 0 }));
    let maxTotal = 0;

    for (let t = 0; t < trials; t++) {
      const field = dealField(n, rnd);
      const best = Math.max(...field);
      maxTotal += best;
      for (let a = 0; a <= 100; a++) {
        const { idx, quality } = runSatisficer(field, a);
        asp[a].quality += quality;
        asp[a].looks += idx + 1;
        asp[a].regret += best - quality;
      }
    }
    for (let a = 0; a <= 100; a++) {
      asp[a].quality /= trials;
      asp[a].looks /= trials;
      asp[a].regret /= trials;
    }
    return { stats: asp, maxQuality: maxTotal / trials };
  }, [n]);

  // Net value = quality − cost·looks, cheaply derived for the whole curve.
  const netCurve = useMemo(() => stats.map((s) => s.quality - cost * s.looks), [stats, cost]);

  const maxNet = maxQuality - cost * n; // maximiser inspects all n options
  const here = stats[aspiration];
  const netHere = netCurve[aspiration];

  const optimalAsp = netCurve.reduce((best, y, i) => (y > netCurve[best] ? i : best), 0);

  // y-range spans both the satisficer curve and the maximiser reference line.
  const lo = Math.min(...netCurve, maxNet);
  const hi = Math.max(...netCurve, maxNet);
  const pad = (hi - lo) * 0.12 || 2;
  const yLo = lo - pad;
  const yHi = hi + pad;

  const px = (a: number) => PAD_L + (a / 100) * PLOT_W;
  const py = (y: number) => PAD_T + (1 - (y - yLo) / (yHi - yLo || 1)) * PLOT_H;

  const linePath = `M ${netCurve.map((y, a) => `${px(a).toFixed(1)},${py(y).toFixed(1)}`).join(' L ')}`;

  // Single-run demo at the current aspiration.
  const demo = useMemo(() => {
    const best = Math.max(...demoField);
    const bestIdx = demoField.indexOf(best);
    const { idx } = runSatisficer(demoField, aspiration);
    return { bestIdx, chosenIdx: idx, hit: idx === bestIdx };
  }, [demoField, aspiration]);

  const readout = readoutTemplate
    .replace('{n}', String(n))
    .replace('{aspiration}', String(aspiration))
    .replace('{quality}', here.quality.toFixed(0))
    .replace('{looks}', here.looks.toFixed(1))
    .replace('{net}', netHere.toFixed(0))
    .replace('{optimal}', String(optimalAsp))
    .replace('{maxnet}', maxNet.toFixed(0));

  return (
    <figure className={cx('brutal my-6 bg-surface p-5 sm:p-6', className)}>
      <p className="font-display text-xs font-semibold uppercase tracking-wide text-accent-600">
        {eyebrow}
      </p>
      {title ? (
        <p className="mt-1 font-display text-lg font-semibold text-ink-900">{title}</p>
      ) : null}

      <p className="mt-2 text-sm font-medium text-ink-700">{instructions}</p>

      <div className="mt-4 grid gap-5 sm:grid-cols-[auto_1fr] sm:items-start">
        {/* The chart */}
        <div className="mx-auto overflow-hidden rounded-card ring-1 ring-inset ring-ink-200 bg-surface-sunken">
          <svg
            viewBox={`0 0 ${CW} ${CH}`}
            className="block h-auto w-[320px] max-w-full"
            role="img"
            aria-label={readout}
          >
            <rect x="0" y="0" width={CW} height={CH} fill="var(--color-surface-sunken)" />

            {/* axes */}
            <line x1={PAD_L} y1={PAD_T + PLOT_H} x2={PAD_L + PLOT_W} y2={PAD_T + PLOT_H} stroke="var(--color-ink-300)" strokeWidth="1" />
            <line x1={PAD_L} y1={PAD_T} x2={PAD_L} y2={PAD_T + PLOT_H} stroke="var(--color-ink-300)" strokeWidth="1" />

            {/* maximiser reference line */}
            <line
              x1={PAD_L}
              y1={py(maxNet)}
              x2={PAD_L + PLOT_W}
              y2={py(maxNet)}
              stroke="var(--color-accent-600)"
              strokeWidth="1.5"
              strokeDasharray="3 3"
              opacity="0.85"
            />
            <text x={PAD_L + PLOT_W} y={py(maxNet) - 3} textAnchor="end" fontSize="7.5" fill="var(--color-accent-600)">
              {maximiserLabel}
            </text>

            {/* optimal aspiration marker */}
            <line
              x1={px(optimalAsp)}
              y1={PAD_T}
              x2={px(optimalAsp)}
              y2={PAD_T + PLOT_H}
              stroke="var(--color-ink-400)"
              strokeWidth="1"
              strokeDasharray="2 3"
              opacity="0.7"
            />

            {/* the satisficer net-value curve */}
            <path d={linePath} fill="none" stroke="var(--color-brand-600)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />

            {/* current-aspiration marker */}
            <line
              x1={px(aspiration)}
              y1={PAD_T}
              x2={px(aspiration)}
              y2={PAD_T + PLOT_H}
              stroke="var(--color-ink-400)"
              strokeWidth="1"
              opacity="0.5"
            />
            <circle
              cx={px(aspiration)}
              cy={py(netHere)}
              r="5"
              fill="var(--color-brand-500)"
              stroke="var(--color-surface)"
              strokeWidth="1.5"
            />

            {/* axis labels */}
            <text x={PAD_L - 4} y={PAD_T + 6} textAnchor="end" fontSize="7.5" fill="var(--color-ink-500)">
              {axisValueLabel}
            </text>
            <text x={PAD_L + PLOT_W} y={CH - 8} textAnchor="end" fontSize="8.5" fontWeight="700" fill="var(--color-ink-500)">
              {axisAspirationLabel}
            </text>
            <text x={PAD_L} y={CH - 8} textAnchor="start" fontSize="7.5" fill="var(--color-ink-400)">
              0
            </text>
          </svg>
        </div>

        {/* Stats + readout */}
        <div>
          <dl className="grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
            <div className="rounded-card border border-brand-200 bg-brand-50/60 p-2">
              <dt className="text-[0.6rem] uppercase tracking-wide text-ink-500">{qualityStatLabel}</dt>
              <dd className="mt-0.5 font-display text-lg font-semibold tabular-nums text-brand-700">
                {here.quality.toFixed(0)}
              </dd>
            </div>
            <div className="rounded-card border border-ink-200 bg-surface p-2">
              <dt className="text-[0.6rem] uppercase tracking-wide text-ink-500">{looksStatLabel}</dt>
              <dd className="mt-0.5 font-display text-lg font-semibold tabular-nums text-ink-700">
                {here.looks.toFixed(1)}
              </dd>
            </div>
            <div className="rounded-card border border-ink-200 bg-surface p-2">
              <dt className="text-[0.6rem] uppercase tracking-wide text-ink-500">{regretStatLabel}</dt>
              <dd className="mt-0.5 font-display text-lg font-semibold tabular-nums text-ink-700">
                {here.regret.toFixed(0)}
              </dd>
            </div>
            <div className="rounded-card border border-accent-300 bg-accent-300/15 p-2">
              <dt className="text-[0.6rem] uppercase tracking-wide text-ink-500">{netStatLabel}</dt>
              <dd className="mt-0.5 font-display text-lg font-semibold tabular-nums text-accent-600">
                {netHere.toFixed(0)}
              </dd>
            </div>
          </dl>

          {/* Satisficer vs maximiser comparison */}
          <table className="mt-3 w-full border-collapse text-center text-xs">
            <thead>
              <tr className="text-[0.6rem] uppercase tracking-wide text-ink-500">
                <th className="p-1 text-left font-semibold"> </th>
                <th className="p-1 font-semibold">{colQualityLabel}</th>
                <th className="p-1 font-semibold">{colLooksLabel}</th>
                <th className="p-1 font-semibold">{colNetLabel}</th>
              </tr>
            </thead>
            <tbody className="tabular-nums text-ink-700">
              <tr className="border-t border-ink-200">
                <td className="p-1 text-left font-semibold text-brand-700">{satisficerLabel}</td>
                <td className="p-1">{here.quality.toFixed(0)}</td>
                <td className="p-1">{here.looks.toFixed(1)}</td>
                <td className="p-1 font-semibold text-brand-700">{netHere.toFixed(0)}</td>
              </tr>
              <tr className="border-t border-ink-200">
                <td className="p-1 text-left font-semibold text-accent-600">{maximiserLabel}</td>
                <td className="p-1">{maxQuality.toFixed(0)}</td>
                <td className="p-1">{n}</td>
                <td className="p-1 font-semibold text-accent-600">{maxNet.toFixed(0)}</td>
              </tr>
            </tbody>
          </table>

          <p
            aria-live="polite"
            className="mt-3 rounded-card border border-accent-300 bg-accent-300/20 p-3 text-sm leading-relaxed text-ink-700"
          >
            {readout}
          </p>
        </div>
      </div>

      {/* Aspiration slider */}
      <div className="mt-5">
        <label
          htmlFor={`${reactId}-asp`}
          className="flex items-baseline justify-between gap-2 text-[0.65rem] font-bold uppercase tracking-wide text-ink-600"
        >
          <span>{aspirationLabel}</span>
          <span className="text-sm font-semibold tabular-nums text-accent-600">{aspiration}</span>
        </label>
        <input
          id={`${reactId}-asp`}
          type="range"
          min={0}
          max={100}
          step={1}
          value={aspiration}
          onChange={(e) => setAspiration(clamp(Number(e.target.value), 0, 100))}
          className="mt-1 h-1.5 w-full cursor-pointer accent-brand-500"
        />
      </div>

      {/* Search-cost slider */}
      <div className="mt-4">
        <label
          htmlFor={`${reactId}-cost`}
          className="flex items-baseline justify-between gap-2 text-[0.65rem] font-bold uppercase tracking-wide text-ink-600"
        >
          <span>{costLabel}</span>
          <span className="text-sm font-semibold tabular-nums text-accent-600">{cost}</span>
        </label>
        <input
          id={`${reactId}-cost`}
          type="range"
          min={0}
          max={6}
          step={1}
          value={cost}
          onChange={(e) => setCost(clamp(Number(e.target.value), 0, 6))}
          className="mt-1 h-1.5 w-full cursor-pointer accent-brand-500"
        />
      </div>

      {/* Option-count slider */}
      <div className="mt-4">
        <label
          htmlFor={`${reactId}-count`}
          className="flex items-baseline justify-between gap-2 text-[0.65rem] font-bold uppercase tracking-wide text-ink-600"
        >
          <span>{countLabel}</span>
          <span className="text-sm font-semibold tabular-nums text-accent-600">{n}</span>
        </label>
        <input
          id={`${reactId}-count`}
          type="range"
          min={6}
          max={50}
          step={1}
          value={n}
          onChange={(e) => {
            const nn = clamp(Number(e.target.value), 6, 50);
            setN(nn);
            setDemoField(dealField(nn, mulberry32(11 + nn)));
          }}
          className="mt-1 h-1.5 w-full cursor-pointer accent-brand-500"
        />
      </div>

      {/* Single-run demo */}
      <div className="mt-5 rounded-card border border-ink-200 bg-surface-sunken p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[0.65rem] font-bold uppercase tracking-wide text-ink-600">{demoLabel}</p>
          <button
            type="button"
            onClick={() => setDemoField(dealField(n, mulberry32((Math.random() * 2 ** 31) | 0)))}
            className="rounded-pill border border-brand-500 bg-brand-500 px-3 py-1 text-xs font-semibold text-white transition-colors hover:bg-brand-600 motion-reduce:transition-none"
          >
            {dealLabel}
          </button>
        </div>

        <div className="mt-3 flex flex-wrap gap-1" aria-hidden="true">
          {demoField.map((q, i) => {
            const beforeStop = i < demo.chosenIdx;
            const isChosen = i === demo.chosenIdx;
            const isBest = i === demo.bestIdx;
            return (
              <span
                key={i}
                className={cx(
                  'flex h-6 w-6 items-center justify-center rounded text-[0.55rem] font-semibold tabular-nums ring-1 ring-inset',
                  isChosen
                    ? demo.hit
                      ? 'bg-brand-500 text-white ring-brand-600'
                      : 'bg-accent-500 text-white ring-accent-600'
                    : beforeStop
                      ? 'bg-ink-100 text-ink-500 ring-ink-200'
                      : 'bg-surface text-ink-400 ring-ink-200',
                  isBest && !isChosen ? 'ring-2 ring-accent-600' : '',
                )}
                title={isBest ? 'true best' : beforeStop ? 'rejected' : 'not seen'}
              >
                {q}
              </span>
            );
          })}
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[0.65rem] text-ink-500">
          <span className="inline-flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded-sm bg-ink-100 ring-1 ring-inset ring-ink-200" />
            {rejectedLabel}
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded-sm bg-brand-500" />
            {acceptedLabel}
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded-sm ring-2 ring-accent-600" />
            {bestWasLabel.replace('{pos}', String(demo.bestIdx + 1))}
          </span>
        </div>
      </div>

      {caption ? <figcaption className="mt-3 text-sm text-ink-500">{caption}</figcaption> : null}
    </figure>
  );
}

export default SatisficingLab;
