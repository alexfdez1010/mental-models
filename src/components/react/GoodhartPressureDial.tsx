import { useId, useMemo, useState } from 'react';
import { cx } from '@/components/react/cx';

/** Props for the {@link GoodhartPressureDial} island. */
export interface GoodhartPressureDialProps {
  /** Heading above the card. */
  title?: string;
  /** Eyebrow label. Defaults to `"Goodhart's law"`. */
  eyebrow?: string;
  /** Instruction line above the chart. */
  instructions?: string;
  /** Caption beneath the card. */
  caption?: string;
  /** Label for the optimisation-pressure slider. */
  pressureLabel?: string;
  /** Caption under the slider's left (no-pressure) end. */
  lowEndLabel?: string;
  /** Caption under the slider's right (max-pressure) end. */
  highEndLabel?: string;
  /** Stat label for the measured proxy average. Defaults to `'Measured score'`. */
  measuredLabel?: string;
  /** Stat label for the true-quality average. Defaults to `'Real value'`. */
  realLabel?: string;
  /** Stat label for the proxy–quality correlation. Defaults to `'Proxy ↔ reality'`. */
  corrLabel?: string;
  /** Stat label for the average wasted gaming effort. Defaults to `'Gaming effort'`. */
  gamingLabel?: string;
  /** Label for the honest-measure diagonal. Defaults to `'Honest measure'`. */
  honestLineLabel?: string;
  /** X-axis caption (true quality). Defaults to `'True quality →'`. */
  trueAxisLabel?: string;
  /** Y-axis caption (measured proxy). Defaults to `'Measured proxy →'`. */
  proxyAxisLabel?: string;
  /**
   * Live readout template. Placeholders: `{p}` optimisation pressure %,
   * `{measured}` average proxy, `{real}` average true quality, `{corr}` the
   * proxy–quality correlation, `{gaming}` average gaming effort %.
   */
  readoutTemplate?: string;
  /** Extra classes merged onto the root element. */
  className?: string;
}

// ── Geometry ────────────────────────────────────────────────────────────────
const W = 460;
const H = 320;
const PAD_L = 46;
const PAD_R = 16;
const PAD_T = 22;
const PAD_B = 40;
const PLOT_W = W - PAD_L - PAD_R;
const PLOT_H = H - PAD_T - PAD_B;

const N = 26; // number of measured agents
const GAIN = 56; // how hard gaming inflates the proxy
const HARM = 30; // how hard gaming erodes real quality

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

interface Agent {
  /** Baseline genuine quality — what we actually care about. */
  q0: number;
  /** Gaming ability, 0–1, deliberately INDEPENDENT of real quality. */
  gameSkill: number;
  /** Fixed measurement noise so the proxy is never a perfect read of quality. */
  noise: number;
}

/**
 * Deterministic field of agents built once at module load with a fixed-seed LCG,
 * so the server render and the client hydration are byte-identical (no
 * `Math.random`, no hydration mismatch). Pressure is applied purely as a function
 * of the slider, so dragging is smooth and reproducible.
 */
const AGENTS: Agent[] = (() => {
  let s = 987654321;
  const rand = () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
  const out: Agent[] = [];
  for (let i = 0; i < N; i++) {
    const q0 = 28 + rand() * 44; // 28–72 baseline quality
    const gameSkill = rand(); // 0–1, uncorrelated with q0 by construction
    const noise = (rand() - 0.5) * 9;
    out.push({ q0, gameSkill, noise });
  }
  return out;
})();

const xToPx = (q: number) => PAD_L + (clamp(q, 0, 100) / 100) * PLOT_W;
const yToPx = (p: number) => PAD_T + PLOT_H - (clamp(p, 0, 100) / 100) * PLOT_H;

function pearson(xs: number[], ys: number[]): number {
  const n = xs.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let cov = 0;
  let vx = 0;
  let vy = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - mx;
    const dy = ys[i] - my;
    cov += dx * dy;
    vx += dx * dx;
    vy += dy * dy;
  }
  if (vx === 0 || vy === 0) return 0;
  return cov / Math.sqrt(vx * vy);
}

/**
 * Interactive **Goodhart's law** demonstrator. A crowd of agents each has a
 * hidden **real quality** and a separate, independent **gaming ability**. When you
 * measure quality with a **proxy**, the two start out tightly linked: at zero
 * optimisation pressure every dot sits on the honest-measure diagonal, so the
 * measured score and the real value agree.
 *
 * Then crank the **optimisation-pressure** slider — the stakes you attach to the
 * number. Agents pour effort into the proxy instead of the real goal: the proxy
 * (vertical axis) shoots up while real quality (horizontal axis) flatlines and
 * falls, so the dots peel up and to the left off the diagonal. The correlation
 * between measure and reality visibly decays toward zero — and can flip negative,
 * because the top scorers are now the best *gamers*, not the best performers. The
 * readout tracks the widening gap between the flattering measured score, the
 * sinking real value, and the effort wasted on gaming. That gap *is* the law:
 * *when a measure becomes a target, it stops being a good measure.*
 *
 * The field is generated deterministically (fixed seed, no `Math.random`), the
 * readout is announced via `aria-live`, the control is a native keyboard-operable
 * slider, and nothing autoplays — so `prefers-reduced-motion` has nothing to fight.
 */
export function GoodhartPressureDial({
  title,
  eyebrow = "Goodhart's law",
  instructions = 'Each dot is a person being measured. Their real quality (horizontal) and the proxy we score them on (vertical) start out in step — every dot on the honest diagonal. Now raise the optimisation pressure and watch them game the number: the proxy climbs, real quality sinks, and the link between them dissolves.',
  caption,
  pressureLabel = 'Optimisation pressure (stakes on the metric)',
  lowEndLabel = 'No stakes',
  highEndLabel = 'Career-defining',
  measuredLabel = 'Measured score',
  realLabel = 'Real value',
  corrLabel = 'Proxy ↔ reality',
  gamingLabel = 'Gaming effort',
  honestLineLabel = 'Honest measure',
  trueAxisLabel = 'True quality →',
  proxyAxisLabel = 'Measured proxy →',
  readoutTemplate = 'At {p}% pressure the average measured score is {measured} while real value is only {real}. The correlation between the proxy and the thing it was meant to track is {corr} — and {gaming}% of everyone’s effort now goes into gaming the number, not doing the work. The measure has stopped measuring.',
  className,
}: GoodhartPressureDialProps) {
  const reactId = useId();
  const [pressurePct, setPressurePct] = useState(0);
  const P = pressurePct / 100;

  const { dots, measured, real, corr, gaming } = useMemo(() => {
    const proxies: number[] = [];
    const trues: number[] = [];
    const efforts: number[] = [];
    const pts = AGENTS.map((a) => {
      const effort = P * a.gameSkill; // 0–1
      const proxy = clamp(a.q0 + a.noise + GAIN * effort, 0, 100);
      const trueQ = clamp(a.q0 - HARM * effort, 0, 100);
      proxies.push(proxy);
      trues.push(trueQ);
      efforts.push(effort);
      return { proxy, trueQ, effort };
    });
    const avg = (xs: number[]) => xs.reduce((s, v) => s + v, 0) / xs.length;
    return {
      dots: pts,
      measured: avg(proxies),
      real: avg(trues),
      corr: pearson(proxies, trues),
      gaming: avg(efforts) * 100,
    };
  }, [P]);

  const r0 = (n: number) => Math.round(n).toString();
  const r2 = (n: number) => (n >= 0 ? '+' : '') + n.toFixed(2);

  const readout = readoutTemplate
    .replace('{p}', r0(pressurePct))
    .replace('{measured}', r0(measured))
    .replace('{real}', r0(real))
    .replace('{corr}', r2(corr))
    .replace('{gaming}', r0(gaming));

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

          {/* Axes */}
          <line x1={PAD_L} y1={PAD_T} x2={PAD_L} y2={PAD_T + PLOT_H} stroke="var(--color-ink-300)" strokeWidth="1.5" />
          <line x1={PAD_L} y1={PAD_T + PLOT_H} x2={W - PAD_R} y2={PAD_T + PLOT_H} stroke="var(--color-ink-300)" strokeWidth="1.5" />

          {/* Axis ticks */}
          {[0, 50, 100].map((v) => (
            <text key={`x${v}`} x={xToPx(v)} y={PAD_T + PLOT_H + 14} textAnchor="middle" fontSize="9" fill="var(--color-ink-400)">
              {v}
            </text>
          ))}
          {[0, 50, 100].map((v) => (
            <text key={`y${v}`} x={PAD_L - 6} y={yToPx(v) + 3} textAnchor="end" fontSize="9" fill="var(--color-ink-400)">
              {v}
            </text>
          ))}

          {/* Axis captions */}
          <text x={PAD_L + PLOT_W / 2} y={H - 6} textAnchor="middle" fontSize="10" fontWeight="600" fill="var(--color-ink-600)">
            {trueAxisLabel}
          </text>
          <text
            transform={`translate(13 ${PAD_T + PLOT_H / 2}) rotate(-90)`}
            textAnchor="middle"
            fontSize="10"
            fontWeight="600"
            fill="var(--color-ink-600)"
          >
            {proxyAxisLabel}
          </text>

          {/* Honest-measure diagonal (proxy = reality) */}
          <line
            x1={xToPx(0)}
            y1={yToPx(0)}
            x2={xToPx(100)}
            y2={yToPx(100)}
            stroke="var(--color-brand-700)"
            strokeWidth="1.5"
            strokeDasharray="5 4"
          />
          <text x={xToPx(100) - 4} y={yToPx(100) + 12} textAnchor="end" fontSize="9" fill="var(--color-brand-700)">
            {honestLineLabel}
          </text>

          {/* Agent dots */}
          {dots.map((d, i) => (
            <circle
              key={i}
              cx={xToPx(d.trueQ)}
              cy={yToPx(d.proxy)}
              r={4}
              fill={d.effort > 0.28 ? 'var(--color-accent-600)' : 'var(--color-brand-500)'}
              fillOpacity={0.85}
            />
          ))}

          {/* Average crosshair */}
          <line x1={xToPx(real)} y1={PAD_T} x2={xToPx(real)} y2={PAD_T + PLOT_H} stroke="var(--color-ink-400)" strokeWidth="1" strokeDasharray="2 3" />
          <line x1={PAD_L} y1={yToPx(measured)} x2={W - PAD_R} y2={yToPx(measured)} stroke="var(--color-ink-400)" strokeWidth="1" strokeDasharray="2 3" />
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
          { k: measuredLabel, v: r0(measured) },
          { k: realLabel, v: r0(real) },
          { k: corrLabel, v: r2(corr) },
          { k: gamingLabel, v: `${r0(gaming)}%` },
        ].map((stat, i) => (
          <div key={i} className="rounded-card border border-ink-100 bg-surface-sunken p-2.5 text-center">
            <dt className="text-[0.6rem] font-bold uppercase tracking-wide text-ink-500">{stat.k}</dt>
            <dd className="mt-0.5 font-mono text-base font-semibold text-ink-900">{stat.v}</dd>
          </div>
        ))}
      </dl>

      {/* Pressure slider */}
      <div className="mt-5">
        <label htmlFor={`${reactId}-p`} className="text-[0.65rem] font-bold uppercase tracking-wide text-ink-500">
          {pressureLabel}
        </label>
        <input
          id={`${reactId}-p`}
          type="range"
          min={0}
          max={100}
          step={1}
          value={pressurePct}
          onChange={(e) => setPressurePct(Number(e.target.value))}
          aria-valuetext={`${pressurePct}% optimisation pressure`}
          className="mt-1 h-1.5 w-full cursor-pointer accent-accent-500"
        />
        <div className="mt-1 flex justify-between text-[0.65rem] font-medium text-ink-500">
          <span>{lowEndLabel}</span>
          <span>{highEndLabel}</span>
        </div>
      </div>

      {caption ? <figcaption className="mt-3 text-sm text-ink-500">{caption}</figcaption> : null}
    </figure>
  );
}

export default GoodhartPressureDial;
