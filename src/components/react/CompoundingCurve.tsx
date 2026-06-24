import { useId, useMemo, useState } from 'react';
import { cx } from '@/components/react/cx';

/** Props for the {@link CompoundingCurve} island. */
export interface CompoundingCurveProps {
  /** Heading above the card. */
  title?: string;
  /** Eyebrow label. Defaults to `'Watch it curve'`. */
  eyebrow?: string;
  /** Instruction line above the chart. */
  instructions?: string;
  /** Caption beneath the card. */
  caption?: string;
  /** Slider label for the growth rate. Defaults to `'Growth rate per period'`. */
  rateLabel?: string;
  /** Slider label for the number of periods. Defaults to `'Periods'`. */
  yearsLabel?: string;
  /** Slider label for the one-off setback. Defaults to `'One-off setback'`. */
  setbackLabel?: string;
  /** Legend label for the linear line. Defaults to `'Simple (linear) growth'`. */
  linearLegendLabel?: string;
  /** Legend label for the compound line. Defaults to `'Compound growth'`. */
  compoundLegendLabel?: string;
  /** Legend label for the dashed no-setback reference line. Defaults to `'Without the setback'`. */
  setbackLegendLabel?: string;
  /** Currency symbol printed before a value (e.g. `'$'`). Defaults to `'$'`. */
  currencyPrefix?: string;
  /** Thousands separator for big numbers. Defaults to `','` (use `'.'` for es-ES). */
  groupSeparator?: string;
  /** Axis label for the horizontal time axis. Defaults to `'Periods'`. */
  yearsAxisLabel?: string;
  /** Axis label for the vertical value axis. Defaults to `'Value'`. */
  valueAxisLabel?: string;
  /**
   * Live readout for the no-setback case. Placeholders: `{rate}` rate %,
   * `{years}` periods, `{start}` starting value, `{compound}` compound final,
   * `{linear}` linear final, `{multiple}` compound multiple of the start.
   */
  readoutTemplate?: string;
  /**
   * Extra sentence appended when a setback is dialled in. Placeholders:
   * `{setback}` setback %, `{compound}` final with setback, `{cost}` amount lost
   * vs. no setback, `{yearsLost}` periods of growth erased.
   */
  setbackReadoutTemplate?: string;
  /** Extra classes merged onto the root element. */
  className?: string;
}

// ── Geometry ────────────────────────────────────────────────────────────────
const W = 460;
const H = 300;
const PAD_L = 52;
const PAD_R = 16;
const PAD_T = 16;
const PAD_B = 36;
const PLOT_W = W - PAD_L - PAD_R;
const PLOT_H = H - PAD_T - PAD_B;

const P0 = 1000; // starting value, fixed

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

/** Group the integer part of a number with a thousands separator. */
function groupInt(n: number, sep: string): string {
  return Math.round(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, sep);
}

/**
 * Interactive **compounding curve** — the "slowly, then suddenly" hockey stick
 * made visible, next to the straight line of simple (linear) growth.
 *
 * The learner sets a **growth rate**, a number of **periods**, and an optional
 * one-off **setback** (a single bad period that multiplies the balance down).
 * Three traces are drawn on a shared, auto-scaled axis: the straight **linear**
 * line `P·(1 + r·t)`, the curving **compound** line `P·(1 + r)^t`, and — when a
 * setback is dialled in — a dashed reference of where compounding *would* have
 * finished without it. The gap between the straight line and the curve is the
 * whole lesson; the gap between the solid and dashed curves is the second one:
 * a single big loss permanently scales the entire tail, erasing years of growth.
 *
 * All three controls are native, keyboard-operable range inputs with visible
 * labels; the readout is announced via `aria-live`; the SVG is static per
 * setting and the only motion is a cosmetic tween disabled under
 * `prefers-reduced-motion`.
 */
export function CompoundingCurve({
  title,
  eyebrow = 'Watch it curve',
  instructions = 'Set a growth rate and a number of periods, then add a one-off setback. The straight line is simple growth; the curve is compounding. Watch the gap between them — and how one bad period drags the whole tail down.',
  caption,
  rateLabel = 'Growth rate per period',
  yearsLabel = 'Periods',
  setbackLabel = 'One-off setback',
  linearLegendLabel = 'Simple (linear) growth',
  compoundLegendLabel = 'Compound growth',
  setbackLegendLabel = 'Without the setback',
  currencyPrefix = '$',
  groupSeparator = ',',
  yearsAxisLabel = 'Periods',
  valueAxisLabel = 'Value',
  readoutTemplate = 'At {rate}%/period over {years} periods, {start} compounds to {compound} — that’s {multiple}× your money. Plain linear growth at the same rate would reach only {linear}.',
  setbackReadoutTemplate = 'A single {setback}% setback drags the finish down to {compound} — {cost} below where you’d have landed without it, the equivalent of erasing about {yearsLost} periods of growth.',
  className,
}: CompoundingCurveProps) {
  const reactId = useId();
  const [ratePct, setRatePct] = useState(8);
  const [years, setYears] = useState(30);
  const [setbackPct, setSetbackPct] = useState(0);

  const r = ratePct / 100;
  const s = setbackPct / 100;
  const setbackYear = Math.round(years * 0.6);

  const model = useMemo(() => {
    const compoundNo = (t: number) => P0 * Math.pow(1 + r, t);
    const compound = (t: number) => compoundNo(t) * (t >= setbackYear ? 1 - s : 1);
    const linear = (t: number) => P0 * (1 + r * t);

    // Auto-scale to the tallest trace (the no-setback compound finish).
    const maxV = Math.max(compoundNo(years), linear(years), P0 * 1.05);

    const sx = (t: number) => PAD_L + (t / years) * PLOT_W;
    const sy = (v: number) => PAD_T + PLOT_H - (clamp(v, 0, maxV) / maxV) * PLOT_H;

    const pathFor = (fn: (t: number) => number) => {
      const pts: string[] = [];
      for (let t = 0; t <= years; t++) pts.push(`${sx(t).toFixed(1)},${sy(fn(t)).toFixed(1)}`);
      return `M ${pts.join(' L ')}`;
    };

    const compoundFinal = compound(years);
    const compoundNoFinal = compoundNo(years);
    const linearFinal = linear(years);
    const cost = compoundNoFinal - compoundFinal;
    // A one-off ×(1−s) hit takes ln(1/(1−s))/ln(1+r) periods to grow back.
    const yearsLost = s > 0 && r > 0 ? Math.log(1 / (1 - s)) / Math.log(1 + r) : 0;

    return {
      sx,
      sy,
      maxV,
      linearPath: pathFor(linear),
      compoundPath: pathFor(compound),
      compoundNoPath: pathFor(compoundNo),
      compoundFinal,
      compoundNoFinal,
      linearFinal,
      cost,
      yearsLost,
    };
  }, [r, s, years, setbackYear]);

  const fmt = (n: number) => `${currencyPrefix}${groupInt(n, groupSeparator)}`;
  const multiple = (model.compoundFinal / P0).toFixed(1);

  let readout = readoutTemplate
    .replace('{rate}', String(ratePct))
    .replace('{years}', String(years))
    .replace('{start}', fmt(P0))
    .replace('{compound}', fmt(model.compoundFinal))
    .replace('{linear}', fmt(model.linearFinal))
    .replace('{multiple}', multiple);

  if (setbackPct > 0) {
    readout +=
      ' ' +
      setbackReadoutTemplate
        .replace('{setback}', String(setbackPct))
        .replace('{compound}', fmt(model.compoundFinal))
        .replace('{cost}', fmt(model.cost))
        .replace('{yearsLost}', model.yearsLost.toFixed(1));
  }

  const lineTween = 'transition-all duration-300 ease-out motion-reduce:transition-none';

  // A few horizontal gridlines for value reference.
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

          {/* Gridlines + value ticks */}
          {gridLines.map((v, i) => (
            <g key={i}>
              <line
                x1={PAD_L}
                y1={model.sy(v)}
                x2={PAD_L + PLOT_W}
                y2={model.sy(v)}
                stroke="var(--color-ink-200)"
                strokeWidth="1"
                strokeDasharray="2 4"
              />
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

          {/* Linear line */}
          <path d={model.linearPath} fill="none" stroke="var(--color-ink-400)" strokeWidth="2.5" strokeLinecap="round" className={lineTween} />

          {/* No-setback reference (dashed) — only when a setback is set */}
          {setbackPct > 0 ? (
            <path d={model.compoundNoPath} fill="none" stroke="var(--color-brand-300)" strokeWidth="2" strokeDasharray="5 4" strokeLinecap="round" className={lineTween} />
          ) : null}

          {/* Compound line */}
          <path d={model.compoundPath} fill="none" stroke="var(--color-brand-600)" strokeWidth="3" strokeLinecap="round" className={lineTween} />

          {/* Setback marker */}
          {setbackPct > 0 ? (
            <line
              x1={model.sx(setbackYear)}
              y1={PAD_T}
              x2={model.sx(setbackYear)}
              y2={PAD_T + PLOT_H}
              stroke="var(--color-danger, #dc2626)"
              strokeWidth="1.5"
              strokeDasharray="3 3"
              className={lineTween}
            />
          ) : null}

          {/* End dots */}
          <circle cx={model.sx(years)} cy={model.sy(model.compoundFinal)} r="5" fill="var(--color-brand-600)" stroke="var(--color-surface)" strokeWidth="2" className={lineTween} />
          <circle cx={model.sx(years)} cy={model.sy(model.linearFinal)} r="4" fill="var(--color-ink-400)" stroke="var(--color-surface)" strokeWidth="2" className={lineTween} />
        </svg>
      </div>

      {/* Legend */}
      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs font-medium text-ink-600">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="inline-block h-0 w-5 border-t-[3px] border-brand-600" />
          {compoundLegendLabel}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="inline-block h-0 w-5 border-t-[3px] border-ink-400" />
          {linearLegendLabel}
        </span>
        {setbackPct > 0 ? (
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden className="inline-block h-0 w-5 border-t-2 border-dashed border-brand-300" />
            {setbackLegendLabel}
          </span>
        ) : null}
      </div>

      {/* Live readout */}
      <p aria-live="polite" className="mt-4 rounded-card border border-brand-200 bg-brand-50/70 p-3 text-sm leading-relaxed text-ink-700">
        {readout}
      </p>

      {/* Controls */}
      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <div>
          <label htmlFor={`${reactId}-r`} className="text-[0.65rem] font-bold uppercase tracking-wide text-ink-500">
            {rateLabel}
          </label>
          <div className="mt-1 flex items-center gap-2">
            <input
              id={`${reactId}-r`}
              type="range"
              min={1}
              max={20}
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
          <label htmlFor={`${reactId}-y`} className="text-[0.65rem] font-bold uppercase tracking-wide text-ink-500">
            {yearsLabel}
          </label>
          <div className="mt-1 flex items-center gap-2">
            <input
              id={`${reactId}-y`}
              type="range"
              min={5}
              max={40}
              step={1}
              value={years}
              onChange={(e) => setYears(Number(e.target.value))}
              aria-valuetext={`${years}`}
              className="h-1.5 w-full cursor-pointer accent-brand-600"
            />
            <span className="w-10 shrink-0 text-right font-mono text-xs font-semibold text-ink-700">{years}</span>
          </div>
        </div>
        <div>
          <label htmlFor={`${reactId}-s`} className="text-[0.65rem] font-bold uppercase tracking-wide text-ink-500">
            {setbackLabel}
          </label>
          <div className="mt-1 flex items-center gap-2">
            <input
              id={`${reactId}-s`}
              type="range"
              min={0}
              max={60}
              step={5}
              value={setbackPct}
              onChange={(e) => setSetbackPct(Number(e.target.value))}
              aria-valuetext={`${setbackPct}%`}
              className="h-1.5 w-full cursor-pointer accent-accent-500"
            />
            <span className="w-10 shrink-0 text-right font-mono text-xs font-semibold text-ink-700">{setbackPct}%</span>
          </div>
        </div>
      </div>

      {caption ? <figcaption className="mt-3 text-sm text-ink-500">{caption}</figcaption> : null}
    </figure>
  );
}

export default CompoundingCurve;
