import { useId, useMemo, useState } from 'react';
import { cx } from '@/components/react/cx';

/** Props for the {@link EarlyVsLate} island. */
export interface EarlyVsLateProps {
  /** Heading above the card. */
  title?: string;
  /** Eyebrow label. Defaults to `'Time vs. money'`. */
  eyebrow?: string;
  /** Instruction line above the chart. */
  instructions?: string;
  /** Caption beneath the card. */
  caption?: string;
  /** Slider label for the growth rate. Defaults to `'Growth rate per period'`. */
  rateLabel?: string;
  /** Slider label for the switch period. Defaults to `'Early bird stops / late starter begins at period'`. */
  splitLabel?: string;
  /** Legend label for the early saver. Defaults to `'Early bird'`. */
  earlyLegendLabel?: string;
  /** Legend label for the late saver. Defaults to `'Late starter'`. */
  lateLegendLabel?: string;
  /** Currency symbol printed before a value. Defaults to `'$'`. */
  currencyPrefix?: string;
  /** Thousands separator for big numbers. Defaults to `','` (use `'.'` for es-ES). */
  groupSeparator?: string;
  /** Axis label for the horizontal time axis. Defaults to `'Periods'`. */
  yearsAxisLabel?: string;
  /** Axis label for the vertical value axis. Defaults to `'Value'`. */
  valueAxisLabel?: string;
  /** Label for the "put in" row in the summary. Defaults to `'Total put in'`. */
  contributedLabel?: string;
  /** Label for the "ends with" row in the summary. Defaults to `'Ends with'`. */
  finalLabel?: string;
  /**
   * Live readout. Placeholders: `{rate}`, `{earlyYears}`, `{lateYears}`,
   * `{earlyContributed}`, `{lateContributed}`, `{earlyFinal}`, `{lateFinal}`,
   * `{verdict}`.
   */
  readoutTemplate?: string;
  /** Verdict sentence when the early saver wins. */
  earlyWinsLabel?: string;
  /** Verdict sentence when the late saver wins. */
  lateWinsLabel?: string;
  /** Extra classes merged onto the root element. */
  className?: string;
}

// ── Geometry ────────────────────────────────────────────────────────────────
const W = 460;
const H = 290;
const PAD_L = 52;
const PAD_R = 16;
const PAD_T = 16;
const PAD_B = 36;
const PLOT_W = W - PAD_L - PAD_R;
const PLOT_H = H - PAD_T - PAD_B;

const TOTAL = 40; // total periods on the timeline
const CONTRIB = 1000; // contributed per active period, fixed

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

function groupInt(n: number, sep: string): string {
  return Math.round(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, sep);
}

/**
 * Interactive **early-vs-late race** — the single most counter-intuitive
 * consequence of compounding: *when* you start usually beats *how much* you put
 * in. Two savers add the same amount each period. The **early bird** contributes
 * only up to the split period, then stops and never adds another cent. The
 * **late starter** does nothing until the split, then contributes for all the
 * remaining periods — often putting in far more money in total. The learner sets
 * the **rate** and the **split period** and watches the two value curves race to
 * the finish; at realistic rates the early bird wins despite contributing less,
 * because their early money has the most periods to compound.
 *
 * Both controls are native, keyboard-operable range inputs; the readout is
 * announced via `aria-live`; the SVG is static per setting with only a cosmetic
 * tween, disabled under `prefers-reduced-motion`.
 */
export function EarlyVsLate({
  title,
  eyebrow = 'Time vs. money',
  instructions = 'Both savers add the same amount each period. The early bird stops at the split; the late starter only begins there and keeps going to the end. Set the rate and the split — and see who finishes ahead.',
  caption,
  rateLabel = 'Growth rate per period',
  splitLabel = 'Early bird stops / late starter begins at period',
  earlyLegendLabel = 'Early bird (starts now, stops at the split)',
  lateLegendLabel = 'Late starter (waits, then never stops)',
  currencyPrefix = '$',
  groupSeparator = ',',
  yearsAxisLabel = 'Periods',
  valueAxisLabel = 'Value',
  contributedLabel = 'Total put in',
  finalLabel = 'Ends with',
  readoutTemplate = 'At {rate}%/period, the early bird invests for {earlyYears} periods then stops — {earlyContributed} in all — yet finishes with {earlyFinal}. The late starter invests for {lateYears} periods — {lateContributed} — and finishes with {lateFinal}. {verdict}',
  earlyWinsLabel = 'Starting early wins, even though the early bird put in less money. Time, not the size of the cheque, did the heavy lifting.',
  lateWinsLabel = 'Here the later, larger contributions edge ahead — but slide the rate up, and watch starting early pull in front.',
  className,
}: EarlyVsLateProps) {
  const reactId = useId();
  const [ratePct, setRatePct] = useState(8);
  const [split, setSplit] = useState(10);

  const r = ratePct / 100;

  const model = useMemo(() => {
    // Value at period t for contributions made during [from, to).
    const trajectory = (from: number, to: number) => {
      const out: number[] = [];
      let bal = 0;
      for (let t = 0; t <= TOTAL; t++) {
        // grow the existing balance one period, then add this period's contribution
        if (t > 0) bal *= 1 + r;
        if (t >= from && t < to) bal += CONTRIB;
        out.push(bal);
      }
      return out;
    };

    const early = trajectory(0, split);
    const late = trajectory(split, TOTAL);

    const earlyContributed = CONTRIB * split;
    const lateContributed = CONTRIB * (TOTAL - split);

    const earlyFinal = early[TOTAL];
    const lateFinal = late[TOTAL];

    const maxV = Math.max(earlyFinal, lateFinal, 1);

    const sx = (t: number) => PAD_L + (t / TOTAL) * PLOT_W;
    const sy = (v: number) => PAD_T + PLOT_H - (clamp(v, 0, maxV) / maxV) * PLOT_H;

    const pathFor = (arr: number[]) => {
      const pts: string[] = [];
      for (let t = 0; t <= TOTAL; t++) pts.push(`${sx(t).toFixed(1)},${sy(arr[t]).toFixed(1)}`);
      return `M ${pts.join(' L ')}`;
    };

    return {
      sx,
      sy,
      maxV,
      earlyPath: pathFor(early),
      latePath: pathFor(late),
      earlyContributed,
      lateContributed,
      earlyFinal,
      lateFinal,
    };
  }, [r, split]);

  const fmt = (n: number) => `${currencyPrefix}${groupInt(n, groupSeparator)}`;
  const earlyWins = model.earlyFinal >= model.lateFinal;

  const readout = readoutTemplate
    .replace('{rate}', String(ratePct))
    .replace('{earlyYears}', String(split))
    .replace('{lateYears}', String(TOTAL - split))
    .replace('{earlyContributed}', fmt(model.earlyContributed))
    .replace('{lateContributed}', fmt(model.lateContributed))
    .replace('{earlyFinal}', fmt(model.earlyFinal))
    .replace('{lateFinal}', fmt(model.lateFinal))
    .replace('{verdict}', earlyWins ? earlyWinsLabel : lateWinsLabel);

  const lineTween = 'transition-all duration-300 ease-out motion-reduce:transition-none';
  const gridLines = [0.25, 0.5, 0.75, 1].map((f) => f * model.maxV);

  return (
    <figure className={cx('brutal my-6 bg-surface p-5 sm:p-6', className)}>
      <p className="font-display text-xs font-semibold uppercase tracking-wide text-brand-600">
        {eyebrow}
      </p>
      {title ? (
        <p className="mt-1 font-display text-lg font-semibold text-ink-900">{title}</p>
      ) : null}

      <p className="mt-2 text-sm font-medium text-ink-700">{instructions}</p>

      <div className="mt-4 overflow-hidden rounded-card border border-ink-100 bg-surface-sunken">
        <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={readout}>
          <rect x="0" y="0" width={W} height={H} fill="var(--color-surface-sunken)" />

          {gridLines.map((v, i) => (
            <g key={i}>
              <line x1={PAD_L} y1={model.sy(v)} x2={PAD_L + PLOT_W} y2={model.sy(v)} stroke="var(--color-ink-200)" strokeWidth="1" strokeDasharray="2 4" />
              <text x={PAD_L - 6} y={model.sy(v) + 3} textAnchor="end" fontSize="9" fill="var(--color-ink-400)">
                {fmt(v)}
              </text>
            </g>
          ))}

          {/* Axes */}
          <line x1={PAD_L} y1={PAD_T} x2={PAD_L} y2={PAD_T + PLOT_H} stroke="var(--color-ink-400)" strokeWidth="1.5" />
          <line x1={PAD_L} y1={PAD_T + PLOT_H} x2={PAD_L + PLOT_W} y2={PAD_T + PLOT_H} stroke="var(--color-ink-400)" strokeWidth="1.5" />
          <text x={PAD_L - 6} y={PAD_T + 4} textAnchor="end" fontSize="10" fill="var(--color-ink-500)">
            {valueAxisLabel}
          </text>
          <text x={PAD_L + PLOT_W} y={H - 8} textAnchor="end" fontSize="10" fill="var(--color-ink-500)">
            {yearsAxisLabel}
          </text>

          {/* Split marker */}
          <line x1={model.sx(split)} y1={PAD_T} x2={model.sx(split)} y2={PAD_T + PLOT_H} stroke="var(--color-ink-300)" strokeWidth="1.5" strokeDasharray="3 3" className={lineTween} />

          {/* Late starter (accent) */}
          <path d={model.latePath} fill="none" stroke="var(--color-accent-500)" strokeWidth="3" strokeLinecap="round" className={lineTween} />
          {/* Early bird (brand) */}
          <path d={model.earlyPath} fill="none" stroke="var(--color-brand-600)" strokeWidth="3" strokeLinecap="round" className={lineTween} />

          <circle cx={model.sx(TOTAL)} cy={model.sy(model.earlyFinal)} r="5" fill="var(--color-brand-600)" stroke="var(--color-surface)" strokeWidth="2" className={lineTween} />
          <circle cx={model.sx(TOTAL)} cy={model.sy(model.lateFinal)} r="5" fill="var(--color-accent-500)" stroke="var(--color-surface)" strokeWidth="2" className={lineTween} />
        </svg>
      </div>

      {/* Legend */}
      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs font-medium text-ink-600">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="inline-block h-0 w-5 border-t-[3px] border-brand-600" />
          {earlyLegendLabel}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="inline-block h-0 w-5 border-t-[3px] border-accent-500" />
          {lateLegendLabel}
        </span>
      </div>

      {/* Summary table */}
      <div className="mt-4 grid grid-cols-3 gap-px overflow-hidden rounded-card border border-ink-100 bg-ink-100 text-sm">
        <div className="bg-surface p-2.5 font-semibold text-ink-500" />
        <div className="bg-surface p-2.5 text-center font-semibold text-brand-700">{earlyLegendLabel.split(' (')[0]}</div>
        <div className="bg-surface p-2.5 text-center font-semibold text-accent-600">{lateLegendLabel.split(' (')[0]}</div>

        <div className="bg-surface p-2.5 font-medium text-ink-600">{contributedLabel}</div>
        <div className="bg-surface p-2.5 text-center font-mono text-ink-800">{fmt(model.earlyContributed)}</div>
        <div className="bg-surface p-2.5 text-center font-mono text-ink-800">{fmt(model.lateContributed)}</div>

        <div className="bg-surface p-2.5 font-medium text-ink-600">{finalLabel}</div>
        <div className={cx('bg-surface p-2.5 text-center font-mono font-bold', earlyWins ? 'text-brand-700' : 'text-ink-800')}>{fmt(model.earlyFinal)}</div>
        <div className={cx('bg-surface p-2.5 text-center font-mono font-bold', !earlyWins ? 'text-accent-600' : 'text-ink-800')}>{fmt(model.lateFinal)}</div>
      </div>

      {/* Live readout */}
      <p aria-live="polite" className="mt-4 rounded-card border border-brand-200 bg-brand-50/70 p-3 text-sm leading-relaxed text-ink-700">
        {readout}
      </p>

      {/* Controls */}
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor={`${reactId}-r`} className="text-[0.65rem] font-bold uppercase tracking-wide text-ink-500">
            {rateLabel}
          </label>
          <div className="mt-1 flex items-center gap-2">
            <input
              id={`${reactId}-r`}
              type="range"
              min={2}
              max={14}
              step={1}
              value={ratePct}
              onChange={(e) => setRatePct(Number(e.target.value))}
              aria-valuetext={`${ratePct}%`}
              className="h-1.5 w-full cursor-pointer accent-brand-600"
            />
            <span className="w-10 shrink-0 text-right font-mono text-xs font-semibold text-ink-700">{ratePct}%</span>
          </div>
        </div>
        <div>
          <label htmlFor={`${reactId}-k`} className="text-[0.65rem] font-bold uppercase tracking-wide text-ink-500">
            {splitLabel}
          </label>
          <div className="mt-1 flex items-center gap-2">
            <input
              id={`${reactId}-k`}
              type="range"
              min={4}
              max={20}
              step={1}
              value={split}
              onChange={(e) => setSplit(Number(e.target.value))}
              aria-valuetext={`${split}`}
              className="h-1.5 w-full cursor-pointer accent-accent-500"
            />
            <span className="w-10 shrink-0 text-right font-mono text-xs font-semibold text-ink-700">{split}</span>
          </div>
        </div>
      </div>

      {caption ? <figcaption className="mt-3 text-sm text-ink-500">{caption}</figcaption> : null}
    </figure>
  );
}

export default EarlyVsLate;
