import { useEffect, useId, useRef, useState } from 'react';
import { cx } from '@/components/react/cx';

/** Props for the {@link HawkDoveLab} island. */
export interface HawkDoveLabProps {
  /** Heading above the card. */
  title?: string;
  /** Eyebrow label. Defaults to `'Hawk–Dove invasion lab'`. */
  eyebrow?: string;
  /** Instruction line above the chart. */
  instructions?: string;
  /** Caption beneath the card. */
  caption?: string;
  /** Label over the resource-value (V) slider. */
  valueLabel?: string;
  /** Label over the injury-cost (C) slider. */
  costLabel?: string;
  /** Label over the current-Hawk-fraction slider. */
  hawkFractionLabel?: string;
  /** Y-axis title on the chart. Defaults to `'Fitness (payoff per contest)'`. */
  axisLabel?: string;
  /** X-axis title on the chart. Defaults to `'Share of the population playing Hawk'`. */
  xAxisLabel?: string;
  /** Legend/label for the Hawk fitness line. Defaults to `'Hawk fitness'`. */
  hawkLineLabel?: string;
  /** Legend/label for the Dove fitness line. Defaults to `'Dove fitness'`. */
  doveLineLabel?: string;
  /** Label on the ESS marker. Defaults to `'ESS'`. */
  essLabel?: string;
  /** Text on the run-selection button. Defaults to `'Let selection run ▸'`. */
  runLabel?: string;
  /** Text on the pause button. Defaults to `'Pause'`. */
  pauseLabel?: string;
  /** Text on the reset button. Defaults to `'Reset the mix'`. */
  resetLabel?: string;
  /** Heading over the live stat readout. Defaults to `'Reading the population'`. */
  readoutLabel?: string;
  /** Label for the ESS-share stat. Defaults to `'Stable Hawk share'`. */
  essStatLabel?: string;
  /** Label for the Hawk-payoff stat. Defaults to `'Hawk payoff now'`. */
  hawkStatLabel?: string;
  /** Label for the Dove-payoff stat. Defaults to `'Dove payoff now'`. */
  doveStatLabel?: string;
  /** Label for the who-can-invade stat. Defaults to `'Can a rare mutant invade?'`. */
  invadeStatLabel?: string;
  /** Analysis note when the ESS is pure Hawk (V ≥ C). */
  pureHawkNote?: string;
  /** Analysis note when the ESS is a mixed/polymorphic equilibrium (C > V). */
  mixedNote?: string;
  /** Analysis note shown once selection has settled at the ESS. */
  settledNote?: string;
  /** Word shown when Hawks can invade the current mix. Defaults to `'Hawks invade ↑'`. */
  hawksInvadeWord?: string;
  /** Word shown when Doves can invade the current mix. Defaults to `'Doves invade ↓'`. */
  dovesInvadeWord?: string;
  /** Word shown when neither type can invade — the ESS. Defaults to `'Neither — stable'`. */
  stableWord?: string;
  /** Starting resource value V (2–20). Defaults to `4`. */
  initialValue?: number;
  /** Starting injury cost C (2–20). Defaults to `12`. */
  initialCost?: number;
  /** Starting Hawk fraction, % (0–100). Defaults to `85`. */
  initialHawkPct?: number;
  /** Extra classes merged onto the root element. */
  className?: string;
}

// ── Geometry ────────────────────────────────────────────────────────────────
const W = 460;
const H = 240;
const PAD_L = 42;
const PAD_R = 16;
const PAD_T = 20;
const PAD_B = 44;
const PLOT_W = W - PAD_L - PAD_R;
const PLOT_H = H - PAD_T - PAD_B;

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

// ── The Hawk–Dove model (Maynard Smith & Price, 1973) ────────────────────────
// Two animals contest a resource worth V. A Hawk escalates; a Dove displays and
// yields. Payoffs in a single random contest:
//   Hawk vs Hawk : (V − C)/2   (they fight; the loser pays the injury cost C)
//   Hawk vs Dove : V           (the Dove flees, the Hawk takes it all)
//   Dove vs Hawk : 0           (yields, gets nothing)
//   Dove vs Dove : V/2         (they share)
// Against a population that is a fraction p Hawks, each type's expected fitness is
//   W_H(p) = p·(V − C)/2 + (1 − p)·V
//   W_D(p) = p·0        + (1 − p)·V/2
// Both fall as p rises, but the Hawk line falls faster once C > V. They cross at
//   p* = V/C   (the interior ESS) — a MIXED / polymorphic equilibrium.
// When V ≥ C fighting is cheap, W_H ≥ W_D everywhere, and the ESS is pure Hawk
// (p* = 1). The equilibrium is reached BY SELECTION, not by anyone choosing it:
// wherever W_H > W_D Hawks breed faster and p climbs; where W_D > W_H it falls.
function fitnessHawk(p: number, V: number, C: number) {
  return p * ((V - C) / 2) + (1 - p) * V;
}
function fitnessDove(p: number, V: number, _C: number) {
  return (1 - p) * (V / 2);
}

/**
 * Interactive **Hawk–Dove invasion lab** — the flagship demonstration of an
 * evolutionarily stable strategy. The learner sets the resource value **V** and
 * the injury cost **C** of a lost fight, then drags the current **Hawk share**
 * of the population. The chart plots each type's expected fitness as a function
 * of how common Hawks are: both lines slope down (the more Hawks around, the
 * worse it is to meet one), and where they cross is the ESS — the mix at which
 * Hawk and Dove earn exactly the same, so neither can spread. When fighting is
 * cheap (V ≥ C) the crossing sits at or beyond p = 1 and pure Hawk is the ESS;
 * when injury is costly (C > V) the ESS is the **mixed** proportion **V/C**.
 *
 * The "let selection run" button applies the replicator equation
 * `dp/dt ∝ p(1 − p)·(W_H − W_D)` in small steps, driving *any* starting mix to
 * the stable proportion — the equilibrium biology finds without anyone choosing
 * it. A readout reports the stable Hawk share, each type's current payoff, and
 * whether a rare mutant of either type could still invade (the invasion test in
 * action).
 *
 * Everything is derived deterministically (no `Date.now()`, no `Math.random()`),
 * so SSR and hydration agree and nothing moves until the learner acts. The
 * readout is announced via `aria-live`; the marker tween is disabled under
 * `prefers-reduced-motion`.
 */
export function HawkDoveLab({
  title,
  eyebrow = 'Hawk–Dove invasion lab',
  instructions = 'Two animals fight over a resource worth V; the loser of a real fight pays an injury cost C. Set V and C, then drag the share of the population playing Hawk. Each line is a type’s fitness against the current mix — where they cross, Hawk and Dove earn the same, so neither can spread. That crossing is the evolutionarily stable strategy.',
  caption,
  valueLabel = 'Resource value V (what the fight is over)',
  costLabel = 'Injury cost C (price of losing a real fight)',
  hawkFractionLabel = 'Share of the population playing Hawk',
  axisLabel = 'Fitness (payoff per contest)',
  xAxisLabel = 'Share of the population playing Hawk',
  hawkLineLabel = 'Hawk fitness',
  doveLineLabel = 'Dove fitness',
  essLabel = 'ESS',
  runLabel = 'Let selection run ▸',
  pauseLabel = 'Pause',
  resetLabel = 'Reset the mix',
  readoutLabel = 'Reading the population',
  essStatLabel = 'Stable Hawk share',
  hawkStatLabel = 'Hawk payoff now',
  doveStatLabel = 'Dove payoff now',
  invadeStatLabel = 'Can a rare mutant invade?',
  pureHawkNote = 'Fighting is cheap here — the resource is worth as much as (or more than) the injury. A Hawk beats a Dove no matter how common Hawks get, so selection drives the population to ALL Hawk. Pure Hawk is the ESS: a lone Dove mutant only ever yields and starves out. Costly, wasteful fighting — and perfectly stable.',
  mixedNote = 'Now injury outweighs the prize (C > V), and the ESS is a MIX: no pure strategy is stable. In a world of Hawks, fights are ruinous, so a rare Dove that ducks every brawl does better and spreads; in a world of Doves, a rare Hawk grabs every resource unopposed and spreads. The two pressures balance at exactly V/C Hawks — a stable polymorphism nobody designed.',
  settledNote = 'Selection has settled. At this mix Hawk and Dove earn precisely the same payoff, so a rare mutant of either type does no better than the natives and cannot invade. That is the invasion test passing — the definition of an ESS, reached by breeding alone, with no one reasoning their way to it.',
  hawksInvadeWord = 'Hawks invade ↑',
  dovesInvadeWord = 'Doves invade ↓',
  stableWord = 'Neither — stable',
  initialValue = 4,
  initialCost = 12,
  initialHawkPct = 85,
  className,
}: HawkDoveLabProps) {
  const reactId = useId();

  const [V, setV] = useState(clamp(initialValue, 2, 20));
  const [C, setC] = useState(clamp(initialCost, 2, 20));
  const [hawkPct, setHawkPct] = useState(clamp(initialHawkPct, 0, 100));
  const [running, setRunning] = useState(false);

  const p = hawkPct / 100;

  // The ESS Hawk share: V/C, capped at 1 when fighting is cheap (V ≥ C → pure Hawk).
  const essP = V >= C ? 1 : V / C;
  const isPureHawk = V >= C;

  const wHawk = fitnessHawk(p, V, C);
  const wDove = fitnessDove(p, V, C);
  const diff = wHawk - wDove; // >0 → Hawks spread; <0 → Doves spread; ≈0 → ESS

  // Has the population effectively reached the ESS?
  const settled = Math.abs(p - essP) < 0.01 || (isPureHawk && p > 0.99);

  // ── One replicator step: dp ∝ p(1−p)(W_H − W_D). Deterministic, no randomness.
  const stepOnce = () => {
    setHawkPct((prev) => {
      const pp = prev / 100;
      const dH = fitnessHawk(pp, V, C);
      const dD = fitnessDove(pp, V, C);
      // Scale the step so motion is visible but stable across the V,C range.
      const rate = 0.9;
      const dp = rate * pp * (1 - pp) * (dH - dD);
      const nextP = clamp(pp + dp, 0, 1);
      return nextP * 100;
    });
  };
  const stepRef = useRef(stepOnce);
  stepRef.current = stepOnce;

  // Auto-run loop.
  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => stepRef.current(), 120);
    return () => window.clearInterval(id);
  }, [running]);

  // Stop the loop once selection has settled.
  useEffect(() => {
    if (running && settled) setRunning(false);
  }, [running, settled]);

  // Reset the working mix if the world (V or C) changes.
  useEffect(() => {
    setRunning(false);
  }, [V, C]);

  // ── SVG mappers ─────────────────────────────────────────────────────────────
  // y-axis spans a little below 0 (Hawk vs Hawk can be negative) up to V headroom.
  const yLo = Math.min(0, (V - C) / 2) * 1.1;
  const yHi = V * 1.12;
  const px = (frac: number) => PAD_L + clamp(frac, 0, 1) * PLOT_W;
  const py = (val: number) =>
    PAD_T + PLOT_H - ((clamp(val, yLo, yHi) - yLo) / (yHi - yLo)) * PLOT_H;

  const zeroY = py(0);
  // Each fitness line is linear in p, so two endpoints suffice.
  const hawkPath = `M${px(0).toFixed(1)},${py(fitnessHawk(0, V, C)).toFixed(1)} L${px(1).toFixed(1)},${py(fitnessHawk(1, V, C)).toFixed(1)}`;
  const dovePath = `M${px(0).toFixed(1)},${py(fitnessDove(0, V, C)).toFixed(1)} L${px(1).toFixed(1)},${py(fitnessDove(1, V, C)).toFixed(1)}`;

  const essX = px(essP);
  const essY = py(fitnessDove(essP, V, C));
  const curX = px(p);

  const tween = 'transition-all duration-200 ease-out motion-reduce:transition-none';

  const invadeWord = settled
    ? stableWord
    : diff > 0
      ? hawksInvadeWord
      : dovesInvadeWord;
  const invadeTone = settled ? 'text-success' : diff > 0 ? 'text-danger' : 'text-brand-600';

  const analysisNote = settled ? settledNote : isPureHawk ? pureHawkNote : mixedNote;

  const fmt = (n: number) => (Math.round(n * 10) / 10).toFixed(1);
  const essShareText = isPureHawk ? '100%' : `${Math.round(essP * 100)}%`;

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
      <p className={cx('mt-0.5 font-display text-base font-semibold tabular-nums', tone ?? 'text-ink-900')}>
        {value}
      </p>
    </div>
  );

  return (
    <figure className={cx('brutal my-6 bg-surface p-5 sm:p-6', className)}>
      <p className="font-display text-xs font-semibold uppercase tracking-wide text-accent-600">{eyebrow}</p>
      {title ? <p className="mt-1 font-display text-lg font-semibold text-ink-900">{title}</p> : null}

      <p className="mt-2 text-sm font-medium text-ink-700">{instructions}</p>

      {/* The fitness-vs-Hawk-fraction chart */}
      <div className="mt-4 overflow-hidden rounded-card border border-ink-100 bg-surface-sunken">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="h-auto w-full"
          role="img"
          aria-label={`${axisLabel} against ${xAxisLabel}. With resource value ${V} and injury cost ${C}, the stable Hawk share is ${essShareText}. The population is currently ${hawkPct}% Hawks.`}
        >
          <rect x="0" y="0" width={W} height={H} fill="var(--color-surface-sunken)" />

          {/* Zero-fitness reference line (Hawk vs Hawk can dip below it) */}
          {yLo < 0 ? (
            <line
              x1={PAD_L}
              y1={zeroY}
              x2={PAD_L + PLOT_W}
              y2={zeroY}
              stroke="var(--color-ink-300)"
              strokeWidth="1"
              strokeDasharray="2 3"
            />
          ) : null}

          {/* Axes */}
          <line x1={PAD_L} y1={PAD_T} x2={PAD_L} y2={PAD_T + PLOT_H} stroke="var(--color-ink-300)" strokeWidth="1.5" />
          <line x1={PAD_L} y1={PAD_T + PLOT_H} x2={PAD_L + PLOT_W} y2={PAD_T + PLOT_H} stroke="var(--color-ink-300)" strokeWidth="1.5" />

          {/* Current-mix marker line */}
          <line
            className={tween}
            x1={curX}
            y1={PAD_T}
            x2={curX}
            y2={PAD_T + PLOT_H}
            stroke="var(--color-ink-400)"
            strokeWidth="1.5"
            strokeDasharray="3 3"
            opacity={0.7}
          />

          {/* Fitness lines */}
          <path className={tween} d={dovePath} fill="none" stroke="var(--color-brand-500)" strokeWidth="2.5" strokeLinecap="round" />
          <path className={tween} d={hawkPath} fill="none" stroke="var(--color-danger)" strokeWidth="2.5" strokeLinecap="round" />

          {/* ESS crossing marker (only when interior) */}
          {!isPureHawk ? (
            <g className={tween}>
              <line x1={essX} y1={PAD_T} x2={essX} y2={PAD_T + PLOT_H} stroke="var(--color-success)" strokeWidth="1.5" strokeDasharray="2 3" opacity={0.85} />
              <circle cx={essX} cy={essY} r="5" fill="var(--color-success)" stroke="white" strokeWidth="1.5" />
              <text x={clamp(essX, PAD_L + 12, PAD_L + PLOT_W - 12)} y={PAD_T + 11} textAnchor="middle" fontSize="9" fontWeight="700" fill="var(--color-success)">
                {essLabel} · {essShareText}
              </text>
            </g>
          ) : (
            <g className={tween}>
              <circle cx={px(1)} cy={py(fitnessHawk(1, V, C))} r="5" fill="var(--color-success)" stroke="white" strokeWidth="1.5" />
              <text x={px(1)} y={PAD_T + 11} textAnchor="end" fontSize="9" fontWeight="700" fill="var(--color-success)">
                {essLabel} · {essShareText}
              </text>
            </g>
          )}

          {/* Current point on each line */}
          <circle className={tween} cx={curX} cy={py(wHawk)} r="4" fill="var(--color-danger)" stroke="white" strokeWidth="1.5" />
          <circle className={tween} cx={curX} cy={py(wDove)} r="4" fill="var(--color-brand-500)" stroke="white" strokeWidth="1.5" />

          {/* X ticks */}
          {[0, 0.5, 1].map((t) => (
            <text key={`xt-${t}`} x={px(t)} y={PAD_T + PLOT_H + 15} textAnchor="middle" fontSize="9" fill="var(--color-ink-500)">
              {t === 0 ? 'all Doves' : t === 1 ? 'all Hawks' : '50/50'}
            </text>
          ))}
          <text x={PAD_L + PLOT_W / 2} y={H - 6} textAnchor="middle" fontSize="10" fontWeight="600" fill="var(--color-ink-600)">
            {xAxisLabel}
          </text>
          <text x={PAD_L - 6} y={PAD_T - 8} textAnchor="start" fontSize="10" fontWeight="600" fill="var(--color-ink-600)">
            {axisLabel}
          </text>
        </svg>
      </div>

      {/* Legend */}
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[0.7rem] font-medium text-ink-600">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-4 rounded bg-danger" /> {hawkLineLabel}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-4 rounded bg-brand-500" /> {doveLineLabel}
        </span>
      </div>

      {/* Live stat readout */}
      <div aria-live="polite">
        <p className="mt-4 text-[0.65rem] font-bold uppercase tracking-wide text-ink-600">{readoutLabel}</p>
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label={essStatLabel} value={essShareText} tone="text-success" />
          <Stat label={hawkStatLabel} value={fmt(wHawk)} tone="text-danger" />
          <Stat label={doveStatLabel} value={fmt(wDove)} tone="text-brand-600" />
          <Stat label={invadeStatLabel} value={invadeWord} tone={invadeTone} />
        </div>
      </div>

      {/* Sliders */}
      <div className="mt-4 space-y-4">
        <div>
          <label
            htmlFor={`${reactId}-v`}
            className="flex items-baseline justify-between gap-2 text-[0.65rem] font-bold uppercase tracking-wide text-ink-600"
          >
            <span>{valueLabel}</span>
            <span className="text-sm font-semibold tabular-nums text-ink-800">{V}</span>
          </label>
          <input
            id={`${reactId}-v`}
            type="range"
            min={2}
            max={20}
            step={1}
            value={V}
            onChange={(e) => setV(clamp(Number(e.target.value), 2, 20))}
            aria-valuetext={`resource value ${V}`}
            className="mt-1 h-1.5 w-full cursor-pointer accent-accent-500"
          />
        </div>

        <div>
          <label
            htmlFor={`${reactId}-c`}
            className="flex items-baseline justify-between gap-2 text-[0.65rem] font-bold uppercase tracking-wide text-ink-600"
          >
            <span>{costLabel}</span>
            <span className="text-sm font-semibold tabular-nums text-danger">{C}</span>
          </label>
          <input
            id={`${reactId}-c`}
            type="range"
            min={2}
            max={20}
            step={1}
            value={C}
            onChange={(e) => setC(clamp(Number(e.target.value), 2, 20))}
            aria-valuetext={`injury cost ${C}`}
            className="mt-1 h-1.5 w-full cursor-pointer accent-danger"
          />
        </div>

        <div>
          <label
            htmlFor={`${reactId}-p`}
            className="flex items-baseline justify-between gap-2 text-[0.65rem] font-bold uppercase tracking-wide text-ink-600"
          >
            <span>{hawkFractionLabel}</span>
            <span className="text-sm font-semibold tabular-nums text-ink-800">{Math.round(hawkPct)}%</span>
          </label>
          <input
            id={`${reactId}-p`}
            type="range"
            min={0}
            max={100}
            step={1}
            value={Math.round(hawkPct)}
            onChange={(e) => {
              setRunning(false);
              setHawkPct(clamp(Number(e.target.value), 0, 100));
            }}
            aria-valuetext={`${Math.round(hawkPct)}% Hawks`}
            className="mt-1 h-1.5 w-full cursor-pointer accent-ink-500"
          />
        </div>
      </div>

      {/* Controls */}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => setRunning((r) => !r)}
          disabled={settled && !running}
          className="brutal-btn bg-brand-600 px-4 py-2 font-display text-sm text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {running ? pauseLabel : runLabel}
        </button>
        <button
          type="button"
          onClick={() => {
            setRunning(false);
            setHawkPct(clamp(initialHawkPct, 0, 100));
          }}
          className="inline-flex items-center rounded-pill px-3 py-2 font-display text-sm font-semibold text-ink-600 ring-1 ring-inset ring-ink-300 transition-colors hover:bg-surface-sunken motion-reduce:transition-none"
        >
          {resetLabel}
        </button>
      </div>

      {/* Analysis panel */}
      <div aria-live="polite" className="mt-4 rounded-card border border-ink-200 bg-surface p-3">
        <p className="mt-1 text-sm leading-relaxed text-ink-700">{analysisNote}</p>
      </div>

      {caption ? <figcaption className="mt-3 text-sm text-ink-500">{caption}</figcaption> : null}
    </figure>
  );
}

export default HawkDoveLab;
