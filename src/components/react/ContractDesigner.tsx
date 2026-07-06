import { useId, useMemo, useState } from 'react';
import { cx } from '@/components/react/cx';

/** Props for the {@link ContractDesigner} island. */
export interface ContractDesignerProps {
  /** Heading above the card. */
  title?: string;
  /** Eyebrow label. Defaults to `'Incentive-contract designer'`. */
  eyebrow?: string;
  /** Instruction line above the chart. */
  instructions?: string;
  /** Caption beneath the card. */
  caption?: string;
  /** Label over the performance-pay slider. */
  weightLabel?: string;
  /** Label over the risk-aversion slider. */
  riskLabel?: string;
  /** Small note under the risk-aversion slider. */
  riskHint?: string;
  /** Y-axis title on the chart. Defaults to `"Principal's net payoff"`. */
  axisLabel?: string;
  /** X-axis title on the chart. Defaults to `'Share of pay tied to output'`. */
  xAxisLabel?: string;
  /** Heading over the live stat readout. Defaults to `'Where the contract lands'`. */
  readoutLabel?: string;
  /** Label for the agent-effort stat. Defaults to `'Agent effort'`. */
  effortStatLabel?: string;
  /** Label for the gaming / risk-taking stat. Defaults to `'Gaming & risk-taking'`. */
  gamingStatLabel?: string;
  /** Label for the agency-cost (risk premium) stat. Defaults to `'Agency cost'`. */
  agencyStatLabel?: string;
  /** Label for the principal's net-payoff stat. Defaults to `'Net payoff'`. */
  netStatLabel?: string;
  /** Marker label for the optimum point. Defaults to `'Sweet spot'`. */
  optimumLabel?: string;
  /** Heading over the analysis panel. Defaults to `'Reading the contract'`. */
  analysisLabel?: string;
  /** Analysis note shown when the mix is far below the optimum (too flat). */
  tooLowNote?: string;
  /** Analysis note shown when the mix is near the optimum. */
  nearOptimumNote?: string;
  /** Analysis note shown when the mix is far above the optimum (too high-powered). */
  tooHighNote?: string;
  /** Word for a pure-salary contract (weight = 0), used in notes. */
  pureSalaryWord?: string;
  /** Word for a pure-commission contract (weight = 100), used in notes. */
  pureCommissionWord?: string;
  /** Starting performance-pay share (0–100). Defaults to `10`. */
  initialWeight?: number;
  /** Starting risk aversion (0–100). Defaults to `50`. */
  initialRisk?: number;
  /** Currency/unit symbol for payoff figures. Defaults to `''`. */
  unit?: string;
  /** Whether the unit sits before or after the number. Defaults to `'suffix'`. */
  unitPosition?: 'prefix' | 'suffix';
  /** Extra classes merged onto the root element. */
  className?: string;
}

// ── Geometry ────────────────────────────────────────────────────────────────
const W = 460;
const H = 220;
const PAD_L = 44;
const PAD_R = 18;
const PAD_T = 20;
const PAD_B = 40;
const PLOT_W = W - PAD_L - PAD_R;
const PLOT_H = H - PAD_T - PAD_B;

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

/**
 * The economic model, kept deliberately simple but with the right *shape*.
 *
 * `x` is the share of pay tied to measured output (0 = pure salary,
 * 1 = pure commission). `ra` is the agent's risk aversion (0–1).
 *
 * - **Output** rises *concavely* with incentive intensity — a stronger stake in
 *   the result buys more effort, but with diminishing returns.
 * - **Gaming & risk-taking losses** rise *convexly* — high-powered pay tempts the
 *   agent to game the metric and take risks the principal would veto, and that
 *   damage accelerates.
 * - **Agency cost** is the risk premium a *risk-averse* agent demands for bearing
 *   pay that swings with luck; it too rises convexly and is larger the more
 *   risk-averse the agent is.
 *
 * Net payoff = output − gaming − agency cost. The concave-minus-convex shape
 * guarantees an **interior optimum**: neither pure salary nor pure commission,
 * and pushing incentives past the peak *backfires*. More risk aversion pushes the
 * optimum toward a flatter (lower-powered) contract — the risk/incentive
 * trade-off, made visible.
 */
function evaluate(x: number, ra: number) {
  const xc = clamp(x, 0, 1);
  const rac = clamp(ra, 0, 1);
  // Baseline salaried output plus a concave gain from stronger incentives.
  const output = 40 + 70 * Math.sqrt(xc);
  // Convex losses from gaming / excessive risk-taking.
  const gaming = 45 * xc * xc;
  // Convex risk premium, scaled by risk aversion.
  const riskScale = 35 * (0.4 + 1.2 * rac);
  const agency = riskScale * xc * xc;
  const net = output - gaming - agency;
  // Effort shown as a 0–100 index (concave in the stake).
  const effort = 20 + 80 * Math.sqrt(xc);
  return { output, gaming, agency, net, effort };
}

/**
 * Interactive **principal–agent contract designer**. The learner mixes an
 * agent's pay between a flat **salary** and **performance pay** (and can dial the
 * agent's **risk aversion**), then watches the agent's effort, the gaming and
 * risk-taking the contract provokes, the risk premium (agency cost) it costs, and
 * the principal's **net payoff** move together.
 *
 * The lesson the island teaches *by construction*: there is an **interior
 * optimum**. Pure salary leaves effort on the table; pure commission floods the
 * agent with risk and invites gaming, so net payoff collapses — often below flat
 * salary. The best contract sits in between, and the sweet spot slides toward a
 * *flatter* contract as the agent grows more risk-averse.
 *
 * A net-payoff curve is drawn across every possible mix, with a marker on the
 * current contract and a flag on the optimum. All state is derived; the only
 * motion is a cosmetic tween of the markers, disabled under
 * `prefers-reduced-motion`, and nothing animates on mount.
 */
export function ContractDesigner({
  title,
  eyebrow = 'Incentive-contract designer',
  instructions = 'Mix the agent’s pay between a flat salary and performance pay, and set how risk-averse the agent is. Watch effort, gaming, the agency cost, and your net payoff move — and find the mix that pays you most.',
  caption,
  weightLabel = 'Performance pay (share of pay tied to measured output)',
  riskLabel = 'Agent’s risk aversion',
  riskHint = 'A more risk-averse agent demands a bigger premium to accept pay that swings with luck.',
  axisLabel = 'Principal’s net payoff',
  xAxisLabel = 'Share of pay tied to output',
  readoutLabel = 'Where the contract lands',
  effortStatLabel = 'Agent effort',
  gamingStatLabel = 'Gaming & risk-taking',
  agencyStatLabel = 'Agency cost',
  netStatLabel = 'Net payoff',
  optimumLabel = 'Sweet spot',
  analysisLabel = 'Reading the contract',
  tooLowNote = 'Almost all salary. The agent is comfortable but coasting — you’re leaving effort (and payoff) on the table. Add some performance pay and your net payoff climbs.',
  nearOptimumNote = 'You’re near the sweet spot: enough stake to pull real effort, not so much that gaming and the risk premium eat the gains. Notice it is neither pure salary nor pure commission.',
  tooHighNote = 'Incentives are now too high-powered. The agent games the metric and takes risks you’d veto, and — being risk-averse — charges a fat premium to bear all that swing. Net payoff falls, often below a flat salary. More is not better.',
  pureSalaryWord = 'pure salary',
  pureCommissionWord = 'pure commission',
  initialWeight = 10,
  initialRisk = 50,
  unit = '',
  unitPosition = 'suffix',
  className,
}: ContractDesignerProps) {
  const reactId = useId();

  const [weight, setWeight] = useState(clamp(initialWeight, 0, 100));
  const [risk, setRisk] = useState(clamp(initialRisk, 0, 100));

  const ra = risk / 100;

  /** Format a payoff amount with the configured unit and position. */
  const fmt = (n: number) => {
    const body = Math.round(n).toString();
    return unitPosition === 'prefix' ? `${unit}${body}` : `${body}${unit}`;
  };

  // The whole net-payoff curve across every mix, plus the optimum, at the
  // current risk aversion. Recomputed only when risk aversion changes.
  const { curve, optX, yMin, yMax } = useMemo(() => {
    const pts: { x: number; net: number }[] = [];
    let best = { x: 0, net: -Infinity };
    let lo = Infinity;
    let hi = -Infinity;
    for (let i = 0; i <= 100; i++) {
      const x = i / 100;
      const { net } = evaluate(x, ra);
      pts.push({ x, net });
      if (net > best.net) best = { x, net };
      if (net < lo) lo = net;
      if (net > hi) hi = net;
    }
    // Pad the y-range a touch so the curve doesn't kiss the frame.
    const span = hi - lo || 1;
    return {
      curve: pts,
      optX: best.x,
      yMin: lo - span * 0.08,
      yMax: hi + span * 0.08,
    };
  }, [ra]);

  const current = useMemo(() => evaluate(weight / 100, ra), [weight, ra]);

  // ── SVG mappers ───────────────────────────────────────────────────────────
  const px = (x: number) => PAD_L + x * PLOT_W;
  const py = (net: number) =>
    PAD_T + PLOT_H - ((net - yMin) / (yMax - yMin || 1)) * PLOT_H;

  const curvePath = useMemo(
    () => curve.map((p, i) => `${i === 0 ? 'M' : 'L'}${px(p.x).toFixed(1)},${py(p.net).toFixed(1)}`).join(' '),
    [curve, yMin, yMax],
  );

  const curX = weight / 100;
  const curPointX = px(curX);
  const curPointY = py(current.net);
  const optPointX = px(optX);
  const optPointY = py(evaluate(optX, ra).net);

  const tween = 'transition-all duration-300 ease-out motion-reduce:transition-none';

  // Which analysis note applies — measured against the optimum for the current
  // risk aversion, in slider units (0–100).
  const optWeight = Math.round(optX * 100);
  const analysisNote =
    weight <= Math.max(4, optWeight - 22)
      ? tooLowNote
      : weight >= optWeight + 22
        ? tooHighNote
        : nearOptimumNote;

  const netTone =
    current.net > evaluate(0, ra).net
      ? 'text-success'
      : current.net < evaluate(0, ra).net - 0.001
        ? 'text-danger'
        : 'text-ink-700';

  // Contract descriptor for the readout.
  const mixWord =
    weight <= 2 ? pureSalaryWord : weight >= 98 ? pureCommissionWord : `${weight}%`;

  const Stat = ({
    label,
    value,
    tone,
  }: {
    label: string;
    value: string;
    tone?: string;
  }) => (
    <div className="rounded-card border border-ink-100 bg-surface-sunken px-3 py-2">
      <p className="text-[0.6rem] font-bold uppercase tracking-wide text-ink-500">{label}</p>
      <p className={cx('mt-0.5 font-display text-lg font-semibold tabular-nums', tone ?? 'text-ink-900')}>
        {value}
      </p>
    </div>
  );

  return (
    <figure className={cx('brutal my-6 bg-surface p-5 sm:p-6', className)}>
      <p className="font-display text-xs font-semibold uppercase tracking-wide text-brand-600">
        {eyebrow}
      </p>
      {title ? (
        <p className="mt-1 font-display text-lg font-semibold text-ink-900">{title}</p>
      ) : null}

      <p className="mt-2 text-sm font-medium text-ink-700">{instructions}</p>

      {/* The net-payoff curve */}
      <div className="mt-4 overflow-hidden rounded-card border border-ink-100 bg-surface-sunken">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="h-auto w-full"
          role="img"
          aria-label={`${axisLabel} against ${xAxisLabel}. Current contract: ${mixWord} of pay tied to output, net payoff ${fmt(current.net)}. The best mix is about ${optWeight}%.`}
        >
          <rect x="0" y="0" width={W} height={H} fill="var(--color-surface-sunken)" />

          {/* Axes */}
          <line x1={PAD_L} y1={PAD_T} x2={PAD_L} y2={PAD_T + PLOT_H} stroke="var(--color-ink-300)" strokeWidth="1.5" />
          <line x1={PAD_L} y1={PAD_T + PLOT_H} x2={PAD_L + PLOT_W} y2={PAD_T + PLOT_H} stroke="var(--color-ink-300)" strokeWidth="1.5" />

          {/* X ticks: 0%, 50%, 100% */}
          {[0, 0.5, 1].map((t) => (
            <g key={`xt-${t}`}>
              <line x1={px(t)} y1={PAD_T + PLOT_H} x2={px(t)} y2={PAD_T + PLOT_H + 5} stroke="var(--color-ink-300)" strokeWidth="1.5" />
              <text x={px(t)} y={PAD_T + PLOT_H + 17} textAnchor="middle" fontSize="10" fill="var(--color-ink-500)">
                {Math.round(t * 100)}%
              </text>
            </g>
          ))}
          <text x={PAD_L + PLOT_W / 2} y={H - 6} textAnchor="middle" fontSize="10" fontWeight="600" fill="var(--color-ink-600)">
            {xAxisLabel}
          </text>
          <text x={PAD_L - 4} y={PAD_T - 8} textAnchor="start" fontSize="10" fontWeight="600" fill="var(--color-ink-600)">
            {axisLabel}
          </text>

          {/* The curve */}
          <path d={curvePath} fill="none" stroke="var(--color-brand-500)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />

          {/* Optimum flag */}
          <g className={tween}>
            <line x1={optPointX} y1={PAD_T + PLOT_H} x2={optPointX} y2={optPointY} stroke="var(--color-success)" strokeWidth="1.5" strokeDasharray="3 3" opacity={0.7} />
            <circle cx={optPointX} cy={optPointY} r="4.5" fill="var(--color-success)" />
            <text x={optPointX} y={optPointY - 9} textAnchor="middle" fontSize="10" fontWeight="700" fill="var(--color-success)">
              {optimumLabel}
            </text>
          </g>

          {/* Current contract marker */}
          <g className={tween}>
            <line x1={curPointX} y1={PAD_T} x2={curPointX} y2={PAD_T + PLOT_H} stroke="var(--color-ink-400)" strokeWidth="1.5" strokeDasharray="2 3" opacity={0.5} />
            <circle cx={curPointX} cy={curPointY} r="6" fill="var(--color-brand-600)" stroke="white" strokeWidth="2" />
          </g>
        </svg>
      </div>

      {/* Live stat readout */}
      <div aria-live="polite">
        <p className="mt-4 text-[0.65rem] font-bold uppercase tracking-wide text-ink-600">{readoutLabel}</p>
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label={effortStatLabel} value={`${Math.round(current.effort)}`} />
          <Stat label={gamingStatLabel} value={`−${fmt(current.gaming)}`} tone={current.gaming > 12 ? 'text-danger' : 'text-ink-700'} />
          <Stat label={agencyStatLabel} value={`−${fmt(current.agency)}`} tone={current.agency > 12 ? 'text-danger' : 'text-ink-700'} />
          <Stat label={netStatLabel} value={fmt(current.net)} tone={netTone} />
        </div>
      </div>

      {/* Sliders */}
      <div className="mt-4 space-y-4">
        {/* Performance-pay share */}
        <div>
          <label
            htmlFor={`${reactId}-weight`}
            className="flex items-baseline justify-between gap-2 text-[0.65rem] font-bold uppercase tracking-wide text-ink-600"
          >
            <span>{weightLabel}</span>
            <span className="text-sm font-semibold tabular-nums text-brand-600">{weight}%</span>
          </label>
          <input
            id={`${reactId}-weight`}
            type="range"
            min={0}
            max={100}
            step={1}
            value={weight}
            onChange={(e) => setWeight(clamp(Number(e.target.value), 0, 100))}
            aria-valuetext={`${weight}% performance pay`}
            className="mt-1 h-1.5 w-full cursor-pointer accent-brand-500"
          />
        </div>

        {/* Risk aversion */}
        <div>
          <label
            htmlFor={`${reactId}-risk`}
            className="flex items-baseline justify-between gap-2 text-[0.65rem] font-bold uppercase tracking-wide text-ink-600"
          >
            <span>{riskLabel}</span>
            <span className="text-sm font-semibold tabular-nums text-accent-600">{risk}%</span>
          </label>
          <input
            id={`${reactId}-risk`}
            type="range"
            min={0}
            max={100}
            step={1}
            value={risk}
            onChange={(e) => setRisk(clamp(Number(e.target.value), 0, 100))}
            aria-valuetext={`${risk}% risk aversion`}
            className="mt-1 h-1.5 w-full cursor-pointer accent-accent-500"
          />
          <p className="mt-1 text-xs text-ink-500">{riskHint}</p>
        </div>
      </div>

      {/* Analysis panel */}
      <div aria-live="polite" className="mt-4 rounded-card border border-ink-200 bg-surface p-3">
        <p className="text-[0.65rem] font-bold uppercase tracking-wide text-ink-600">{analysisLabel}</p>
        <p className="mt-1 text-sm leading-relaxed text-ink-700">{analysisNote}</p>
      </div>

      {caption ? <figcaption className="mt-3 text-sm text-ink-500">{caption}</figcaption> : null}
    </figure>
  );
}

export default ContractDesigner;
