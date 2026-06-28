import { useId, useMemo, useState } from 'react';
import { cx } from '@/components/react/cx';

/** Props for the {@link PipelineThroughput} island. */
export interface PipelineThroughputProps {
  /** Heading above the card. */
  title?: string;
  /** Eyebrow label. Defaults to `'Find the bottleneck'`. */
  eyebrow?: string;
  /** Instruction line above the chart. */
  instructions?: string;
  /** Caption beneath the card. */
  caption?: string;
  /**
   * One label per stage, in flow order. The number of labels sets the number of
   * stages. Defaults to a five-stage assembly line.
   */
  stageLabels?: string[];
  /** Starting capacity of each stage (same length as `stageLabels`). */
  initialCapacities?: number[];
  /** Unit shown after every rate. Defaults to `'units/hr'`. */
  unitLabel?: string;
  /** Slider min/max for every stage. */
  min?: number;
  max?: number;
  /** Badge text marking the constraining stage. Defaults to `'Bottleneck'`. */
  bottleneckLabel?: string;
  /** Label for the system-throughput line + figure. Defaults to `'Line throughput'`. */
  throughputLabel?: string;
  /** Label for the per-stage capacity row. Defaults to `'Stage capacity'`. */
  capacityLabel?: string;
  /** Label for the piled-up work-in-progress annotation. Defaults to `'Work piling up'`. */
  pileupLabel?: string;
  /** Label for the starved (idle) annotation. Defaults to `'Starved / idle'`. */
  starvedLabel?: string;
  /**
   * Live readout sentence. Placeholders: `{stage}` the bottleneck's label,
   * `{rate}` the throughput, `{unit}` the unit label, `{slack}` the wasted
   * capacity summed across the non-bottleneck stages.
   */
  readout?: string;
  /** Extra classes merged onto the root element. */
  className?: string;
}

// ── Geometry ────────────────────────────────────────────────────────────────
const W = 480;
const H = 260;
const PAD_L = 40;
const PAD_R = 16;
const PAD_T = 18;
const PAD_B = 56;
const PLOT_W = W - PAD_L - PAD_R;
const PLOT_H = H - PAD_T - PAD_B;

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

/**
 * Interactive **pipeline-throughput** island — the visual heart of the Theory of
 * Constraints. The learner drags the capacity of each stage on a flow line and
 * watches the single most important fact appear: the whole line runs at the speed
 * of its **slowest** stage — the **bottleneck** — and *nothing else*.
 *
 * Raise any taller (non-bottleneck) bar and the throughput line does not move:
 * that stage just wastes the extra capacity (its slack is shown), while work
 * piles up in front of the bottleneck and the stages after it sit starved. Raise
 * the bottleneck and throughput climbs — until a *different* stage becomes the new
 * slowest one and the constraint jumps. That "the constraint moves" moment is the
 * lesson made tangible.
 *
 * Throughput is `min(capacities)`; everything else (slack, pile-up, starvation)
 * is derived from it. All controls are native, keyboard-operable range inputs
 * with visible labels; the readout is announced via `aria-live`; the SVG is
 * static per setting and carries no motion, so it is inert under
 * `prefers-reduced-motion` by construction.
 */
export function PipelineThroughput({
  title,
  eyebrow = 'Find the bottleneck',
  instructions = 'Drag each stage’s capacity. The whole line can only run as fast as its slowest stage — the bottleneck (red). Speed up a faster stage and nothing happens; speed up the bottleneck and the line finally moves — until a different stage becomes the new slowest one.',
  caption,
  stageLabels = ['Cut', 'Weld', 'Paint', 'Assemble', 'Pack'],
  initialCapacities = [50, 30, 45, 35, 60],
  unitLabel = 'units/hr',
  min = 10,
  max = 80,
  bottleneckLabel = 'Bottleneck',
  throughputLabel = 'Line throughput',
  capacityLabel = 'Stage capacity',
  pileupLabel = 'Work piling up',
  starvedLabel = 'Starved / idle',
  readout = 'The line runs at {rate} {unit} — the capacity of “{stage}”, the slowest stage. Every other stage is faster, so {slack} {unit} of capacity sits idle. Speeding up anything but “{stage}” changes nothing.',
  className,
}: PipelineThroughputProps) {
  const reactId = useId();
  const n = stageLabels.length;
  const [caps, setCaps] = useState<number[]>(() =>
    stageLabels.map((_, i) => clamp(initialCapacities[i] ?? 40, min, max)),
  );

  const setCap = (i: number, v: number) =>
    setCaps((prev) => prev.map((c, j) => (j === i ? clamp(v, min, max) : c)));

  const model = useMemo(() => {
    const throughput = Math.min(...caps);
    // First (left-most) stage at the minimum is THE bottleneck for the readout.
    const bottleneckIdx = caps.findIndex((c) => c === throughput);
    const slack = caps.reduce((sum, c) => sum + (c - throughput), 0);

    // Scale bars to the slider's max so the y-axis is stable as you drag.
    const sy = (v: number) => PAD_T + PLOT_H - (v / max) * PLOT_H;
    const slotW = PLOT_W / n;
    const barW = Math.min(slotW * 0.62, 54);
    const cx0 = (i: number) => PAD_L + slotW * (i + 0.5);

    return { throughput, bottleneckIdx, slack, sy, slotW, barW, cx0 };
  }, [caps, max, n]);

  const text = readout
    .replaceAll('{stage}', stageLabels[model.bottleneckIdx])
    .replaceAll('{rate}', String(model.throughput))
    .replaceAll('{unit}', unitLabel)
    .replaceAll('{slack}', String(model.slack));

  const throughputY = model.sy(model.throughput);

  return (
    <figure className={cx('brutal my-6 bg-surface p-5 sm:p-6', className)}>
      <p className="font-display text-xs font-semibold uppercase tracking-wide text-brand-600">{eyebrow}</p>
      {title ? <p className="mt-1 font-display text-lg font-semibold text-ink-900">{title}</p> : null}

      <p className="mt-2 text-sm font-medium text-ink-700">{instructions}</p>

      {/* Big throughput readout */}
      <div className="mt-4 flex items-baseline gap-2">
        <span className="text-[0.65rem] font-bold uppercase tracking-wide text-ink-500">{throughputLabel}</span>
        <span className="font-display text-2xl font-bold tabular-nums text-accent-600">
          {model.throughput}
          <span className="ml-1 text-sm font-semibold text-ink-500">{unitLabel}</span>
        </span>
      </div>

      {/* Chart */}
      <div className="mt-3 overflow-hidden rounded-card border border-ink-100 bg-surface-sunken">
        <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={text}>
          <rect x="0" y="0" width={W} height={H} fill="var(--color-surface-sunken)" />

          {/* Baseline */}
          <line
            x1={PAD_L}
            y1={PAD_T + PLOT_H}
            x2={PAD_L + PLOT_W}
            y2={PAD_T + PLOT_H}
            stroke="var(--color-ink-300)"
            strokeWidth="1.5"
          />

          {/* Stage bars + flow arrows */}
          {caps.map((c, i) => {
            const isBottleneck = i === model.bottleneckIdx;
            const x = model.cx0(i) - model.barW / 2;
            const yTop = model.sy(c);
            const barH = PAD_T + PLOT_H - yTop;
            // Slack = capacity above the throughput line (wasted on non-bottlenecks).
            const slackH = throughputY - yTop;
            const beforeBottleneck = i < model.bottleneckIdx;
            const afterBottleneck = i > model.bottleneckIdx;

            return (
              <g key={i}>
                {/* Flow arrow into this stage */}
                {i > 0 ? (
                  <line
                    x1={model.cx0(i - 1) + model.barW / 2 + 2}
                    y1={PAD_T + PLOT_H + 14}
                    x2={model.cx0(i) - model.barW / 2 - 2}
                    y2={PAD_T + PLOT_H + 14}
                    stroke="var(--color-ink-300)"
                    strokeWidth="1.5"
                    markerEnd={`url(#${reactId}-arrow)`}
                  />
                ) : null}

                {/* Used (effective) part of the bar = throughput */}
                <rect
                  x={x}
                  y={throughputY}
                  width={model.barW}
                  height={Math.max(PAD_T + PLOT_H - throughputY, 0)}
                  rx="3"
                  fill={isBottleneck ? 'var(--color-accent-500)' : 'var(--color-brand-500)'}
                  opacity={isBottleneck ? 1 : 0.92}
                />

                {/* Wasted slack (hatched, above the throughput line) */}
                {slackH > 1 ? (
                  <rect
                    x={x}
                    y={yTop}
                    width={model.barW}
                    height={slackH}
                    rx="3"
                    fill="var(--color-ink-300)"
                    opacity="0.32"
                  />
                ) : null}

                {/* Bottleneck badge */}
                {isBottleneck ? (
                  <>
                    <rect
                      x={model.cx0(i) - 30}
                      y={yTop - 18}
                      width="60"
                      height="15"
                      rx="7.5"
                      fill="var(--color-accent-500)"
                    />
                    <text
                      x={model.cx0(i)}
                      y={yTop - 7}
                      textAnchor="middle"
                      fontSize="8.5"
                      fontWeight="700"
                      fill="#ffffff"
                    >
                      {bottleneckLabel}
                    </text>
                  </>
                ) : null}

                {/* Pile-up (before the bottleneck) / starved (after) marker */}
                {beforeBottleneck ? (
                  <text x={model.cx0(i)} y={PAD_T + PLOT_H - 6} textAnchor="middle" fontSize="13" aria-hidden>
                    ▓
                  </text>
                ) : null}
                {afterBottleneck ? (
                  <text
                    x={model.cx0(i)}
                    y={PAD_T + PLOT_H - 6}
                    textAnchor="middle"
                    fontSize="11"
                    fill="var(--color-ink-400)"
                    aria-hidden
                  >
                    ░
                  </text>
                ) : null}

                {/* Stage label + capacity value */}
                <text
                  x={model.cx0(i)}
                  y={H - 30}
                  textAnchor="middle"
                  fontSize="10.5"
                  fontWeight={isBottleneck ? 700 : 600}
                  fill={isBottleneck ? 'var(--color-accent-600)' : 'var(--color-ink-700)'}
                >
                  {stageLabels[i]}
                </text>
                <text
                  x={model.cx0(i)}
                  y={H - 18}
                  textAnchor="middle"
                  fontSize="9.5"
                  className="tabular-nums"
                  fill="var(--color-ink-500)"
                >
                  {c}
                </text>
              </g>
            );
          })}

          {/* Throughput line across the whole pipeline */}
          <line
            x1={PAD_L}
            y1={throughputY}
            x2={PAD_L + PLOT_W}
            y2={throughputY}
            stroke="var(--color-accent-600)"
            strokeWidth="1.75"
            strokeDasharray="5 4"
          />
          <text x={PAD_L + 2} y={throughputY - 4} fontSize="9" fontWeight="700" fill="var(--color-accent-600)">
            {model.throughput} {unitLabel}
          </text>

          <defs>
            <marker id={`${reactId}-arrow`} markerWidth="7" markerHeight="7" refX="5.5" refY="3" orient="auto">
              <path d="M0,0 L6,3 L0,6 Z" fill="var(--color-ink-300)" />
            </marker>
          </defs>
        </svg>
      </div>

      {/* Legend */}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs font-medium text-ink-600">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="inline-block h-3 w-3 rounded-sm bg-accent-500" />
          {bottleneckLabel}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="inline-block h-3 w-3 rounded-sm bg-brand-500" />
          {throughputLabel}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="inline-block h-3 w-3 rounded-sm bg-ink-300/40" />
          {capacityLabel}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden>▓</span>
          {pileupLabel}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="text-ink-400">
            ░
          </span>
          {starvedLabel}
        </span>
      </div>

      {/* Live readout */}
      <p
        aria-live="polite"
        className="mt-4 rounded-card border border-accent-200 bg-accent-50/70 p-3 text-sm leading-relaxed text-ink-700"
      >
        {text}
      </p>

      {/* Sliders */}
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {caps.map((c, i) => {
          const isBottleneck = i === model.bottleneckIdx;
          return (
            <div key={i}>
              <label
                htmlFor={`${reactId}-cap-${i}`}
                className="flex items-center justify-between text-[0.65rem] font-bold uppercase tracking-wide text-ink-500"
              >
                <span className={cx(isBottleneck && 'text-accent-600')}>
                  {stageLabels[i]}
                  {isBottleneck ? ` · ${bottleneckLabel}` : ''}
                </span>
                <span className="font-mono text-ink-700">
                  {c} {unitLabel}
                </span>
              </label>
              <input
                id={`${reactId}-cap-${i}`}
                type="range"
                min={min}
                max={max}
                step={1}
                value={c}
                onChange={(e) => setCap(i, Number(e.target.value))}
                aria-valuetext={`${stageLabels[i]}: ${c} ${unitLabel}`}
                className={cx('mt-1 h-1.5 w-full cursor-pointer', isBottleneck ? 'accent-accent-500' : 'accent-brand-500')}
              />
            </div>
          );
        })}
      </div>

      {caption ? <figcaption className="mt-3 text-sm text-ink-500">{caption}</figcaption> : null}
    </figure>
  );
}

export default PipelineThroughput;
