import { useId, useMemo, useState } from 'react';
import { cx } from '@/components/react/cx';

/** Props for the {@link TailExplorer} island. */
export interface TailExplorerProps {
  /** Heading above the card. */
  title?: string;
  /** Eyebrow label. Defaults to `'Sample the tail'`. */
  eyebrow?: string;
  /** Instruction line above the chart. */
  instructions?: string;
  /** Caption beneath the card. */
  caption?: string;
  /** Label for the tail-thickness slider. Defaults to `'Tail thickness'`. */
  thicknessLabel?: string;
  /** Caption under the slider's left (mild) end. Defaults to `'Mild (thin-tailed)'`. */
  thinLabel?: string;
  /** Caption under the slider's right (wild) end. Defaults to `'Wild (fat-tailed)'`. */
  fatLabel?: string;
  /** Label for the draw button. Defaults to `'Draw 25 samples'`. */
  drawLabel?: string;
  /** Label for the reset button. Defaults to `'Reset'`. */
  resetLabel?: string;
  /** Stat label for the number of draws. Defaults to `'Samples'`. */
  drawsLabel?: string;
  /** Stat label for the running average. Defaults to `'Running average'`. */
  meanLabel?: string;
  /** Stat label for the single largest draw. Defaults to `'Biggest single draw'`. */
  maxLabel?: string;
  /** Stat label for the biggest draw's share of the total. Defaults to `'Biggest ÷ everything'`. */
  shareLabel?: string;
  /** Thousands separator for big numbers. Defaults to `','` (use `'.'` for es-ES). */
  groupSeparator?: string;
  /** Prompt shown before any samples are drawn. */
  emptyHint?: string;
  /**
   * Live readout template. Placeholders: `{n}` sample count, `{mean}` running
   * average, `{max}` biggest single draw, `{share}` the biggest draw's % of the
   * running total, `{world}` the world name (mild/wild) from {@link thinLabel}/
   * {@link fatLabel}.
   */
  readoutTemplate?: string;
  /** Extra classes merged onto the root element. */
  className?: string;
}

// ── Geometry ────────────────────────────────────────────────────────────────
const W = 460;
const H = 240;
const PAD_L = 44;
const PAD_R = 12;
const PAD_T = 14;
const PAD_B = 24;
const PLOT_W = W - PAD_L - PAD_R;
const PLOT_H = H - PAD_T - PAD_B;
const VISIBLE = 28; // how many recent bars to show

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

/** Group the integer part of a number with a thousands separator. */
function groupInt(n: number, sep: string): string {
  return Math.round(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, sep);
}

/**
 * Map the 0–100 thickness slider to a Pareto tail exponent α. A high α (≈3.4)
 * gives a *mild*, thin-ish tail where the mean is well-behaved; a low α (≈1.06)
 * gives a *wild* tail whose theoretical mean is barely finite (and, below 1,
 * infinite) so the running average never settles and one draw can swamp the sum.
 */
function alphaFor(thickness: number): number {
  return 3.4 - (clamp(thickness, 0, 100) / 100) * 2.34;
}

/**
 * Draw one Pareto(α, xmin=1) sample by inverse transform: x = U^(-1/α), with U
 * uniform on (0,1]. Larger draws get exponentially rarer as α grows, so the same
 * machine produces a tame bell-ish pile at high α and monstrous outliers at low α.
 */
function paretoDraw(alpha: number): number {
  const u = 1 - Math.random(); // (0,1]
  return Math.pow(u, -1 / alpha);
}

/**
 * Interactive **fat-tails sampler** — the difference between *Mediocristan* and
 * *Extremistan* made tactile. The learner sets a **tail thickness** and repeatedly
 * **draws samples** from the same machine. Three numbers update live: the
 * **running average**, the **biggest single draw**, and — the real fat-tail
 * signature — what **share of the entire total** that one biggest draw accounts for.
 *
 * In the mild (thin-tailed) regime the average quickly settles, the biggest draw
 * is a modest multiple of typical, and its share of the total stays tiny. Crank
 * the thickness up and the same button starts coughing up monsters: the running
 * average lurches every time a new record lands, and a single draw can be most of
 * everything you've ever sampled. That is the whole lesson — in Extremistan the
 * extreme dominates the average, so planning for the *typical* misses the point.
 *
 * Each new bar is a draw, scaled against the current maximum (so the record bar
 * towers over the rest); the running-average line is drawn across. Bars only
 * appear on interaction, so the server render is empty and deterministic. The
 * controls are native, keyboard-operable inputs; the readout is announced via
 * `aria-live`. There is no autoplaying motion, so nothing here fights
 * `prefers-reduced-motion`.
 */
export function TailExplorer({
  title,
  eyebrow = 'Sample the tail',
  instructions = 'Set how fat the tail is, then keep drawing samples from the same machine. Watch the running average, the biggest single draw, and how much of the entire total that one biggest draw is. In a fat-tailed world, one sample can be most of everything.',
  caption,
  thicknessLabel = 'Tail thickness',
  thinLabel = 'Mild (thin-tailed)',
  fatLabel = 'Wild (fat-tailed)',
  drawLabel = 'Draw 25 samples',
  resetLabel = 'Reset',
  drawsLabel = 'Samples',
  meanLabel = 'Running average',
  maxLabel = 'Biggest single draw',
  shareLabel = 'Biggest ÷ everything',
  groupSeparator = ',',
  emptyHint = 'Press “Draw 25 samples” to start filling the world with draws.',
  readoutTemplate = 'After {n} samples in the {world} world, the average sits at {mean} — but the single biggest draw is {max}, all by itself {share}% of every sample added together.',
  className,
}: TailExplorerProps) {
  const reactId = useId();
  const [thickness, setThickness] = useState(72);
  const [draws, setDraws] = useState<number[]>([]);

  const alpha = alphaFor(thickness);
  const world = thickness >= 50 ? fatLabel : thinLabel;

  const stats = useMemo(() => {
    if (draws.length === 0) {
      return { n: 0, mean: 0, max: 0, total: 0, share: 0 };
    }
    let total = 0;
    let max = 0;
    for (const d of draws) {
      total += d;
      if (d > max) max = d;
    }
    return {
      n: draws.length,
      mean: total / draws.length,
      max,
      total,
      share: total > 0 ? (max / total) * 100 : 0,
    };
  }, [draws]);

  const drawMore = () => {
    setDraws((prev) => {
      const next = prev.slice();
      for (let i = 0; i < 25; i++) next.push(paretoDraw(alpha));
      // Keep the array bounded so very long sessions stay cheap; the stats above
      // already collapse it to running figures.
      return next.length > 4000 ? next.slice(next.length - 4000) : next;
    });
  };

  const fmt = (n: number) => groupInt(n, groupSeparator);

  const visible = draws.slice(Math.max(0, draws.length - VISIBLE));
  const visMax = visible.reduce((m, d) => Math.max(m, d), 1);
  const barGap = 3;
  const barW = visible.length > 0 ? (PLOT_W - barGap * (visible.length - 1)) / visible.length : 0;
  const meanY = PAD_T + PLOT_H - (clamp(stats.mean, 0, visMax) / visMax) * PLOT_H;

  const readout =
    draws.length === 0
      ? emptyHint
      : readoutTemplate
          .replace('{n}', fmt(stats.n))
          .replace('{world}', world.toLowerCase())
          .replace('{mean}', fmt(stats.mean))
          .replace('{max}', fmt(stats.max))
          .replace('{share}', stats.share.toFixed(stats.share >= 10 ? 0 : 1));

  return (
    <figure className={cx('brutal my-6 bg-surface p-5 sm:p-6', className)}>
      <p className="font-display text-xs font-semibold uppercase tracking-wide text-accent-600">
        {eyebrow}
      </p>
      {title ? (
        <p className="mt-1 font-display text-lg font-semibold text-ink-900">{title}</p>
      ) : null}

      <p className="mt-2 text-sm font-medium text-ink-700">{instructions}</p>

      {/* Chart */}
      <div className="mt-4 overflow-hidden rounded-card border border-ink-100 bg-surface-sunken">
        <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={readout}>
          <rect x="0" y="0" width={W} height={H} fill="var(--color-surface-sunken)" />

          {/* Baseline + value axis */}
          <line x1={PAD_L} y1={PAD_T} x2={PAD_L} y2={PAD_T + PLOT_H} stroke="var(--color-ink-300)" strokeWidth="1.5" />
          <line
            x1={PAD_L}
            y1={PAD_T + PLOT_H}
            x2={PAD_L + PLOT_W}
            y2={PAD_T + PLOT_H}
            stroke="var(--color-ink-300)"
            strokeWidth="1.5"
          />

          {visible.length === 0 ? (
            <text x={W / 2} y={H / 2} textAnchor="middle" fontSize="12" fill="var(--color-ink-400)">
              {emptyHint}
            </text>
          ) : null}

          {/* Bars — each a draw, scaled to the current visible max so the record towers */}
          {visible.map((d, i) => {
            const h = (d / visMax) * PLOT_H;
            const x = PAD_L + i * (barW + barGap);
            const y = PAD_T + PLOT_H - h;
            const isMax = d === visMax;
            return (
              <rect
                key={i}
                x={x}
                y={y}
                width={Math.max(1, barW)}
                height={Math.max(0.5, h)}
                rx={barW > 4 ? 1.5 : 0}
                fill={isMax ? 'var(--color-accent-500)' : 'var(--color-brand-300)'}
              />
            );
          })}

          {/* Running-average line */}
          {visible.length > 0 ? (
            <g>
              <line
                x1={PAD_L}
                y1={meanY}
                x2={PAD_L + PLOT_W}
                y2={meanY}
                stroke="var(--color-brand-700)"
                strokeWidth="2"
                strokeDasharray="5 4"
              />
              <text x={PAD_L + 4} y={clamp(meanY - 4, PAD_T + 8, PAD_T + PLOT_H)} fontSize="9" fill="var(--color-brand-700)">
                {meanLabel}
              </text>
            </g>
          ) : null}
        </svg>
      </div>

      {/* Live readout */}
      <p
        aria-live="polite"
        className="mt-4 rounded-card border border-accent-300 bg-accent-300/20 p-3 text-sm leading-relaxed text-ink-700"
      >
        {readout}
      </p>

      {/* Stats grid */}
      <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { k: drawsLabel, v: fmt(stats.n) },
          { k: meanLabel, v: draws.length ? fmt(stats.mean) : '—' },
          { k: maxLabel, v: draws.length ? fmt(stats.max) : '—' },
          { k: shareLabel, v: draws.length ? `${stats.share.toFixed(stats.share >= 10 ? 0 : 1)}%` : '—' },
        ].map((s, i) => (
          <div key={i} className="rounded-card border border-ink-100 bg-surface-sunken p-2.5 text-center">
            <dt className="text-[0.6rem] font-bold uppercase tracking-wide text-ink-500">{s.k}</dt>
            <dd className="mt-0.5 font-mono text-base font-semibold text-ink-900">{s.v}</dd>
          </div>
        ))}
      </dl>

      {/* Thickness slider */}
      <div className="mt-5">
        <label
          htmlFor={`${reactId}-t`}
          className="text-[0.65rem] font-bold uppercase tracking-wide text-ink-500"
        >
          {thicknessLabel}
        </label>
        <input
          id={`${reactId}-t`}
          type="range"
          min={0}
          max={100}
          step={1}
          value={thickness}
          onChange={(e) => {
            setThickness(Number(e.target.value));
            setDraws([]);
          }}
          aria-valuetext={`${thickness} — ${world}`}
          className="mt-1 h-1.5 w-full cursor-pointer accent-accent-500"
        />
        <div className="mt-1 flex justify-between text-[0.65rem] font-medium text-ink-500">
          <span>{thinLabel}</span>
          <span>{fatLabel}</span>
        </div>
      </div>

      {/* Buttons */}
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={drawMore}
          className="brutal-btn bg-brand-600 px-4 py-2 text-sm text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
        >
          {drawLabel}
        </button>
        <button
          type="button"
          onClick={() => setDraws([])}
          className="brutal-btn bg-surface px-4 py-2 text-sm text-ink-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
        >
          {resetLabel}
        </button>
      </div>

      {caption ? <figcaption className="mt-3 text-sm text-ink-500">{caption}</figcaption> : null}
    </figure>
  );
}

export default TailExplorer;
