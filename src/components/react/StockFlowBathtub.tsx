import { useId, useMemo, useState } from 'react';
import { cx } from '@/components/react/cx';

/** Props for the {@link StockFlowBathtub} island. */
export interface StockFlowBathtubProps {
  /** Heading above the card. */
  title?: string;
  /** Eyebrow label. Defaults to `'Fill the tub'`. */
  eyebrow?: string;
  /** Instruction line above the chart. */
  instructions?: string;
  /** Caption beneath the card. */
  caption?: string;
  /** Slider label for the inflow (faucet). Defaults to `'Inflow (faucet)'`. */
  inflowLabel?: string;
  /** Slider label for the outflow (drain). Defaults to `'Outflow (drain)'`. */
  outflowLabel?: string;
  /** Slider label for the time scrubber. Defaults to `'Time'`. */
  timeLabel?: string;
  /** Unit shown after a flow rate. Defaults to `'L/min'`. */
  rateUnitLabel?: string;
  /** Unit shown after a stock level. Defaults to `'L'`. */
  levelUnitLabel?: string;
  /** Unit shown after a time value. Defaults to `'min'`. */
  timeUnitLabel?: string;
  /** Axis label for the vertical level axis. Defaults to `'Level'`. */
  levelAxisLabel?: string;
  /** Axis label for the horizontal time axis. Defaults to `'Time →'`. */
  timeAxisLabel?: string;
  /** Legend label for the stock trajectory. Defaults to `'Stock (the level)'`. */
  stockLegendLabel?: string;
  /** Legend label for the inflow marker. Defaults to `'Inflow'`. */
  inflowLegendLabel?: string;
  /** Legend label for the outflow marker. Defaults to `'Outflow'`. */
  outflowLegendLabel?: string;
  /** Small heading above the two flow bars. Defaults to `'The flows (constant)'`. */
  flowsHeading?: string;
  /** "Full" overflow tag on the tub. Defaults to `'OVERFLOW'`. */
  overflowTag?: string;
  /** "Empty" tag on the tub. Defaults to `'EMPTY'`. */
  emptyTag?: string;
  /**
   * Readout when inflow equals outflow. Placeholders: `{in}`/`{out}` the flow
   * rates, `{unit}` the rate unit, `{start}` the starting level, `{levelUnit}`.
   */
  steadyReadout?: string;
  /**
   * Readout when the stock is rising. Placeholders: `{in}`, `{out}`, `{net}` the
   * net inflow, `{unit}`, `{time}` the scrub minute, `{level}` the level then,
   * `{levelUnit}`.
   */
  risingReadout?: string;
  /**
   * Readout when the stock is falling. Placeholders: `{in}`, `{out}`, `{net}` the
   * net OUTflow (a positive magnitude), `{unit}`, `{time}`, `{level}`,
   * `{levelUnit}`, `{start}`.
   */
  fallingReadout?: string;
  /** Extra classes merged onto the root element. */
  className?: string;
}

// ── Model constants ───────────────────────────────────────────────────────────
const S0 = 50; // starting level, fixed
const CAP = 140; // tub capacity (overflow ceiling)
const T_MAX = 24; // minutes on the scrubber / chart
const FLOW_MIN = 0;
const FLOW_MAX = 10;

// ── Chart geometry ────────────────────────────────────────────────────────────
const W = 320;
const H = 220;
const PAD_L = 34;
const PAD_R = 12;
const PAD_T = 14;
const PAD_B = 28;
const PLOT_W = W - PAD_L - PAD_R;
const PLOT_H = H - PAD_T - PAD_B;

// ── Bathtub geometry ──────────────────────────────────────────────────────────
const TUB_W = 150;
const TUB_H = 200;

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const round = (n: number) => Math.round(n);

/** Level of the stock at minute `t`, clamped to the tub `[0, CAP]`. */
function levelAt(inflow: number, outflow: number, t: number): number {
  return clamp(S0 + (inflow - outflow) * t, 0, CAP);
}

/**
 * Interactive **stock-and-flow bathtub** — the grammar of accumulation made
 * visible. The faucet (inflow) and the drain (outflow) are two *independent*
 * rates; the water in the tub is the *stock*. Drag the two flow sliders, then
 * scrub time forward and watch the level integrate the net flow minute by minute.
 *
 * Three lessons live in one tub. (1) **Integration:** the flows are flat, yet the
 * level marches — a straight ramp whose slope is `inflow − outflow`. (2) **Equal
 * flows, flat stock:** set the two sliders equal and the level freezes at *any*
 * value while water still roars through each way (dynamic equilibrium). (3)
 * **Inertia / lag:** a stock cannot jump — drop the inflow below the outflow and
 * the tub still takes minutes to drain, because the level is the memory of every
 * litre that ever went in.
 *
 * Throughput is purely derived: `level(t) = clamp(S0 + (inflow − outflow)·t)`.
 * All controls are native, keyboard-operable range inputs with visible labels;
 * the readout is announced via `aria-live`; the SVG is static per setting and
 * carries no animation, so it is inert under `prefers-reduced-motion`.
 */
export function StockFlowBathtub({
  title,
  eyebrow = 'Fill the tub',
  instructions = 'Set the faucet and the drain — two independent rates — then drag the time slider. Watch the level integrate the net flow: it ramps up when the faucet wins, drains when the drain wins, and holds perfectly steady when they match (at any level).',
  caption,
  inflowLabel = 'Inflow (faucet)',
  outflowLabel = 'Outflow (drain)',
  timeLabel = 'Time',
  rateUnitLabel = 'L/min',
  levelUnitLabel = 'L',
  timeUnitLabel = 'min',
  levelAxisLabel = 'Level',
  timeAxisLabel = 'Time →',
  stockLegendLabel = 'Stock (the level)',
  inflowLegendLabel = 'Inflow',
  outflowLegendLabel = 'Outflow',
  flowsHeading = 'The flows (constant)',
  overflowTag = 'OVERFLOW',
  emptyTag = 'EMPTY',
  steadyReadout = 'Inflow {in} and outflow {out} {unit} are equal, so the net flow is zero. The level holds perfectly steady at {start} {levelUnit} — and it would hold steady at ANY level — even though {in} {unit} is roaring through each way. Equal flows, flat stock: that is dynamic equilibrium.',
  risingReadout = 'Inflow {in} beats outflow {out} {unit}: a net of +{net} {unit}. The stock climbs by {net} {levelUnit} every single minute — a straight ramp — even though neither flow ever changes. By minute {time} the level has reached {level} {levelUnit}. The level is the running total of the net flow, not the flow itself.',
  fallingReadout = 'Outflow {out} beats inflow {in} {unit}: a net of −{net} {unit}. The tub drains by {net} {levelUnit} a minute — but notice it does not empty instantly. Starting from {start} {levelUnit}, by minute {time} it is only down to {level} {levelUnit}. A stock has inertia: it can change only as fast as its flows allow.',
  className,
}: StockFlowBathtubProps) {
  const reactId = useId();
  const [inflow, setInflow] = useState(6);
  const [outflow, setOutflow] = useState(4);
  const [t, setT] = useState(12);

  const net = inflow - outflow;

  const model = useMemo(() => {
    // Full trajectory, one sample per minute, clamped to the tub.
    const levels = Array.from({ length: T_MAX + 1 }, (_, m) => levelAt(inflow, outflow, m));

    const sx = (m: number) => PAD_L + (m / T_MAX) * PLOT_W;
    const sy = (v: number) => PAD_T + PLOT_H - (v / CAP) * PLOT_H;

    const path = `M ${levels.map((v, m) => `${sx(m).toFixed(1)},${sy(v).toFixed(1)}`).join(' L ')}`;

    const levelNow = levels[t];
    const fillFrac = clamp(levelNow / CAP, 0, 1);

    return { levels, sx, sy, path, levelNow, fillFrac };
  }, [inflow, outflow, t]);

  const readout = useMemo(() => {
    const level = round(model.levelNow);
    if (net === 0) {
      return steadyReadout
        .replaceAll('{in}', String(inflow))
        .replaceAll('{out}', String(outflow))
        .replaceAll('{unit}', rateUnitLabel)
        .replaceAll('{start}', String(S0))
        .replaceAll('{levelUnit}', levelUnitLabel);
    }
    if (net > 0) {
      return risingReadout
        .replaceAll('{in}', String(inflow))
        .replaceAll('{out}', String(outflow))
        .replaceAll('{net}', String(net))
        .replaceAll('{unit}', rateUnitLabel)
        .replaceAll('{time}', String(t))
        .replaceAll('{level}', String(level))
        .replaceAll('{levelUnit}', levelUnitLabel);
    }
    return fallingReadout
      .replaceAll('{in}', String(inflow))
      .replaceAll('{out}', String(outflow))
      .replaceAll('{net}', String(Math.abs(net)))
      .replaceAll('{unit}', rateUnitLabel)
      .replaceAll('{time}', String(t))
      .replaceAll('{level}', String(level))
      .replaceAll('{start}', String(S0))
      .replaceAll('{levelUnit}', levelUnitLabel);
  }, [model.levelNow, net, inflow, outflow, t, rateUnitLabel, levelUnitLabel, steadyReadout, risingReadout, fallingReadout]);

  const isFull = model.levelNow >= CAP - 0.5;
  const isEmpty = model.levelNow <= 0.5;

  // Water surface position inside the tub interior.
  const tubInnerX = 16;
  const tubInnerY = 28;
  const tubInnerW = TUB_W - 32;
  const tubInnerH = TUB_H - 56;
  const waterH = model.fillFrac * tubInnerH;
  const waterY = tubInnerY + (tubInnerH - waterH);

  const accentNet = net > 0 ? 'var(--color-accent-500)' : net < 0 ? 'var(--color-brand-600)' : 'var(--color-ink-500)';
  const flowBar = (v: number) => (v / FLOW_MAX) * 100;

  return (
    <figure className={cx('brutal my-6 bg-surface p-5 sm:p-6', className)}>
      <p className="font-display text-xs font-semibold uppercase tracking-wide text-brand-600">{eyebrow}</p>
      {title ? <p className="mt-1 font-display text-lg font-semibold text-ink-900">{title}</p> : null}

      <p className="mt-2 text-sm font-medium text-ink-700">{instructions}</p>

      <div className="mt-4 grid gap-4 sm:grid-cols-[auto_1fr] sm:items-stretch">
        {/* Bathtub */}
        <div className="flex items-center justify-center rounded-card border border-ink-100 bg-surface-sunken p-2">
          <svg
            viewBox={`0 0 ${TUB_W} ${TUB_H}`}
            className="h-56 w-auto"
            role="img"
            aria-label={`The tub holds ${round(model.levelNow)} ${levelUnitLabel} at minute ${t}.`}
          >
            {/* Faucet stream (inflow) */}
            {inflow > 0 ? (
              <g aria-hidden>
                <rect x={TUB_W - 40} y={2} width="8" height="6" rx="1" fill="var(--color-ink-400)" />
                {Array.from({ length: Math.min(inflow, 6) }).map((_, i) => (
                  <circle
                    key={i}
                    cx={TUB_W - 36}
                    cy={10 + i * ((tubInnerY + 2 - 10) / Math.min(inflow, 6))}
                    r="1.7"
                    fill="var(--color-accent-400)"
                  />
                ))}
              </g>
            ) : null}

            {/* Tub interior (background) */}
            <rect
              x={tubInnerX}
              y={tubInnerY}
              width={tubInnerW}
              height={tubInnerH}
              rx="6"
              fill="var(--color-surface)"
              stroke="var(--color-ink-200)"
              strokeWidth="1"
            />

            {/* Water */}
            {waterH > 0.5 ? (
              <rect
                x={tubInnerX}
                y={waterY}
                width={tubInnerW}
                height={waterH}
                rx="3"
                fill={net >= 0 ? 'var(--color-accent-400)' : 'var(--color-brand-400)'}
                opacity="0.85"
              />
            ) : null}

            {/* Water surface line */}
            {waterH > 0.5 ? (
              <line
                x1={tubInnerX}
                y1={waterY}
                x2={tubInnerX + tubInnerW}
                y2={waterY}
                stroke={net >= 0 ? 'var(--color-accent-600)' : 'var(--color-brand-600)'}
                strokeWidth="2"
              />
            ) : null}

            {/* Tub outline */}
            <rect
              x={tubInnerX - 4}
              y={tubInnerY - 4}
              width={tubInnerW + 8}
              height={tubInnerH + 8}
              rx="8"
              fill="none"
              stroke="var(--color-ink-400)"
              strokeWidth="2.5"
            />

            {/* Drain stream (outflow) */}
            {outflow > 0 ? (
              <g aria-hidden>
                {Array.from({ length: Math.min(outflow, 6) }).map((_, i) => (
                  <circle
                    key={i}
                    cx={TUB_W / 2}
                    cy={tubInnerY + tubInnerH + 4 + i * 3}
                    r="1.7"
                    fill="var(--color-brand-400)"
                  />
                ))}
              </g>
            ) : null}

            {/* Level label */}
            <text
              x={TUB_W / 2}
              y={tubInnerY + tubInnerH + 22}
              textAnchor="middle"
              fontSize="13"
              fontWeight="700"
              className="tabular-nums"
              fill={accentNet}
            >
              {round(model.levelNow)} {levelUnitLabel}
            </text>

            {/* Full / empty tags */}
            {isFull && net > 0 ? (
              <text x={TUB_W / 2} y={tubInnerY + 12} textAnchor="middle" fontSize="9" fontWeight="700" fill="var(--color-accent-600)">
                {overflowTag}
              </text>
            ) : null}
            {isEmpty && net < 0 ? (
              <text x={TUB_W / 2} y={tubInnerY + tubInnerH / 2} textAnchor="middle" fontSize="9" fontWeight="700" fill="var(--color-brand-600)">
                {emptyTag}
              </text>
            ) : null}
          </svg>
        </div>

        {/* Time-series chart */}
        <div className="overflow-hidden rounded-card border border-ink-100 bg-surface-sunken">
          <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={readout}>
            <rect x="0" y="0" width={W} height={H} fill="var(--color-surface-sunken)" />

            {/* Gridlines at quarters of the tub */}
            {[0.25, 0.5, 0.75, 1].map((f, i) => (
              <line
                key={i}
                x1={PAD_L}
                y1={model.sy(f * CAP)}
                x2={PAD_L + PLOT_W}
                y2={model.sy(f * CAP)}
                stroke="var(--color-ink-200)"
                strokeWidth="1"
                strokeDasharray="2 4"
              />
            ))}

            {/* Axes */}
            <line x1={PAD_L} y1={PAD_T} x2={PAD_L} y2={PAD_T + PLOT_H} stroke="var(--color-ink-400)" strokeWidth="1.5" />
            <line x1={PAD_L} y1={PAD_T + PLOT_H} x2={PAD_L + PLOT_W} y2={PAD_T + PLOT_H} stroke="var(--color-ink-400)" strokeWidth="1.5" />
            <text x={PAD_L - 6} y={PAD_T + 4} textAnchor="end" fontSize="9" fill="var(--color-ink-500)">
              {levelAxisLabel}
            </text>
            <text x={PAD_L + PLOT_W} y={H - 6} textAnchor="end" fontSize="9" fill="var(--color-ink-500)">
              {timeAxisLabel}
            </text>

            {/* Starting-level reference */}
            <line
              x1={PAD_L}
              y1={model.sy(S0)}
              x2={PAD_L + PLOT_W}
              y2={model.sy(S0)}
              stroke="var(--color-ink-300)"
              strokeWidth="1"
              strokeDasharray="1 3"
            />

            {/* Scrub-time marker */}
            <line
              x1={model.sx(t)}
              y1={PAD_T}
              x2={model.sx(t)}
              y2={PAD_T + PLOT_H}
              stroke="var(--color-ink-300)"
              strokeWidth="1"
            />

            {/* Stock trajectory */}
            <path
              key={`${inflow}-${outflow}`}
              d={model.path}
              fill="none"
              stroke={accentNet}
              strokeWidth="2.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Current-level dot */}
            <circle
              cx={model.sx(t)}
              cy={model.sy(model.levelNow)}
              r="4.5"
              fill={accentNet}
              stroke="var(--color-surface)"
              strokeWidth="2"
            />
          </svg>
        </div>
      </div>

      {/* Flow bars: make "the flows are constant" tangible */}
      <div className="mt-4">
        <span className="text-[0.65rem] font-bold uppercase tracking-wide text-ink-500">{flowsHeading}</span>
        <div className="mt-1.5 grid gap-1.5">
          <div className="flex items-center gap-2">
            <span className="w-28 shrink-0 text-xs font-semibold text-accent-600">{inflowLegendLabel}</span>
            <div className="h-3 flex-1 overflow-hidden rounded-pill bg-surface-sunken">
              <div className="h-full rounded-pill bg-accent-400" style={{ width: `${flowBar(inflow)}%` }} />
            </div>
            <span className="w-16 shrink-0 text-right font-mono text-xs font-semibold text-ink-700">
              {inflow} {rateUnitLabel}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-28 shrink-0 text-xs font-semibold text-brand-600">{outflowLegendLabel}</span>
            <div className="h-3 flex-1 overflow-hidden rounded-pill bg-surface-sunken">
              <div className="h-full rounded-pill bg-brand-400" style={{ width: `${flowBar(outflow)}%` }} />
            </div>
            <span className="w-16 shrink-0 text-right font-mono text-xs font-semibold text-ink-700">
              {outflow} {rateUnitLabel}
            </span>
          </div>
        </div>
      </div>

      {/* Live readout */}
      <p
        aria-live="polite"
        className="mt-4 rounded-card border border-brand-200 bg-brand-50/70 p-3 text-sm leading-relaxed text-ink-700"
      >
        {readout}
      </p>

      {/* Controls */}
      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <div>
          <label htmlFor={`${reactId}-in`} className="text-[0.65rem] font-bold uppercase tracking-wide text-ink-500">
            {inflowLabel}
          </label>
          <div className="mt-1 flex items-center gap-2">
            <input
              id={`${reactId}-in`}
              type="range"
              min={FLOW_MIN}
              max={FLOW_MAX}
              step={1}
              value={inflow}
              onChange={(e) => setInflow(Number(e.target.value))}
              aria-valuetext={`${inflow} ${rateUnitLabel}`}
              className="h-1.5 w-full cursor-pointer accent-accent-500"
            />
            <span className="w-14 shrink-0 text-right font-mono text-xs font-semibold text-ink-700">{inflow}</span>
          </div>
        </div>
        <div>
          <label htmlFor={`${reactId}-out`} className="text-[0.65rem] font-bold uppercase tracking-wide text-ink-500">
            {outflowLabel}
          </label>
          <div className="mt-1 flex items-center gap-2">
            <input
              id={`${reactId}-out`}
              type="range"
              min={FLOW_MIN}
              max={FLOW_MAX}
              step={1}
              value={outflow}
              onChange={(e) => setOutflow(Number(e.target.value))}
              aria-valuetext={`${outflow} ${rateUnitLabel}`}
              className="h-1.5 w-full cursor-pointer accent-brand-600"
            />
            <span className="w-14 shrink-0 text-right font-mono text-xs font-semibold text-ink-700">{outflow}</span>
          </div>
        </div>
        <div>
          <label htmlFor={`${reactId}-t`} className="text-[0.65rem] font-bold uppercase tracking-wide text-ink-500">
            {timeLabel}
          </label>
          <div className="mt-1 flex items-center gap-2">
            <input
              id={`${reactId}-t`}
              type="range"
              min={0}
              max={T_MAX}
              step={1}
              value={t}
              onChange={(e) => setT(Number(e.target.value))}
              aria-valuetext={`${t} ${timeUnitLabel}`}
              className="h-1.5 w-full cursor-pointer accent-ink-500"
            />
            <span className="w-14 shrink-0 text-right font-mono text-xs font-semibold text-ink-700">
              {t} {timeUnitLabel}
            </span>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs font-medium text-ink-600">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="inline-block h-0 w-5 border-t-[3px] border-ink-500" />
          {stockLegendLabel}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="inline-block h-3 w-3 rounded-sm bg-accent-400" />
          {inflowLegendLabel}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="inline-block h-3 w-3 rounded-sm bg-brand-400" />
          {outflowLegendLabel}
        </span>
      </div>

      {caption ? <figcaption className="mt-3 text-sm text-ink-500">{caption}</figcaption> : null}
    </figure>
  );
}

export default StockFlowBathtub;
