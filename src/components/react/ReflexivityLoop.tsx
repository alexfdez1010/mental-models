import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { cx } from '@/components/react/cx';

/** Props for the {@link ReflexivityLoop} island. */
export interface ReflexivityLoopProps {
  /** Heading above the card. */
  title?: string;
  /** Eyebrow label. Defaults to `'Reflexivity loop'`. */
  eyebrow?: string;
  /** Instruction line above the simulation. */
  instructions?: string;
  /** Caption beneath the card. */
  caption?: string;
  /** Legend label for the BELIEF line. Defaults to `'Belief'`. */
  beliefLabel?: string;
  /** Legend label for the REALITY line. Defaults to `'Reality'`. */
  realityLabel?: string;
  /** Legend label for the FUNDAMENTAL reference line. Defaults to `'Fundamental'`. */
  fundamentalLabel?: string;
  /** Label above the coupling slider. */
  couplingLabel?: string;
  /** Caption on the low end of the coupling slider (belief barely feeds back). */
  couplingLowLabel?: string;
  /** Caption on the high end of the coupling slider (belief drives reality). */
  couplingHighLabel?: string;
  /** Label above the shock (rumour) slider. */
  shockLabel?: string;
  /** Caption on the negative end of the shock slider (a panic / bad rumour). */
  shockLowLabel?: string;
  /** Caption on the positive end of the shock slider (an optimistic rumour). */
  shockHighLabel?: string;
  /** Text on the single-step button. Defaults to `'Step ▸'`. */
  stepButtonLabel?: string;
  /** Text on the auto-run button. Defaults to `'Run ▸'`. */
  runLabel?: string;
  /** Text on the button that pauses an in-progress run. Defaults to `'Pause'`. */
  pauseLabel?: string;
  /** Text on the button that fires the rumour / initial shock. Defaults to `'Spread the rumour ⚡'`. */
  shockButtonLabel?: string;
  /** Text on the reset button. Defaults to `'Reset ↻'`. */
  resetLabel?: string;
  /** Verdict while nothing has been shocked yet (belief sits on the fundamental). */
  verdictCalm?: string;
  /** Verdict while a shock is decaying back toward the fundamental (below threshold). */
  verdictDefeated?: string;
  /** Verdict while a positive shock is running away upward (self-fulfilling boom). */
  verdictBoom?: string;
  /** Verdict while a negative shock is running away downward (self-fulfilling collapse / run). */
  verdictCollapse?: string;
  /**
   * Live readout template. `{belief}`, `{reality}`, `{gap}` (belief − reality, signed),
   * `{coupling}` (e.g. `1.4`), `{step}` and `{verdict}` are replaced.
   */
  readout?: string;
  /**
   * Starting coupling strength, as an integer percent (so `140` means a coupling of
   * 1.4). Below 100 the loop is self-correcting; above 100 it is self-fulfilling.
   * Defaults to `140`.
   */
  initialCoupling?: number;
  /**
   * Starting rumour size, as a signed integer in value points away from the
   * fundamental. Negative = a panic (a run), positive = an optimistic boom.
   * Defaults to `-12`.
   */
  initialShock?: number;
  /** Extra classes merged onto the root element. */
  className?: string;
}

// ── Model constants ──────────────────────────────────────────────────────────
const FUNDAMENTAL = 50; // the "true" solvent / neutral level both lines anchor to
const BELIEF_SPEED = 0.5; // β — how fast belief chases the reality it observes
const V_MIN = 0; // reality/belief floor (a total collapse — the bank fails)
const V_MAX = 100; // reality/belief ceiling (a maxed-out bubble)
const MAX_STEPS = 40; // stop the auto-run after this many ticks
const SETTLE_EPS = 0.4; // |belief − fundamental| below this counts as "settled back"
const RUNAWAY_EPS = 1.2; // |belief − fundamental| above this and growing counts as runaway

// ── Chart geometry ───────────────────────────────────────────────────────────
const W = 460;
const H = 170;
const PAD_L = 8;
const PAD_R = 8;
const PAD_T = 10;
const PAD_B = 10;
const PLOT_W = W - PAD_L - PAD_R;
const PLOT_H = H - PAD_T - PAD_B;
const HISTORY_CAP = MAX_STEPS + 4;

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const round = (n: number) => Math.round(n);

/**
 * Interactive **reflexivity / self-fulfilling-dynamics** sandbox. Two quantities
 * move over time: **reality** (the actual state of the bank / asset / situation)
 * and **belief** (what the crowd thinks that state is). Both are anchored to a
 * fixed **fundamental** at 50.
 *
 * The single knob is the **coupling** `k` — how strongly belief feeds back into
 * reality. Reality is dragged toward belief: `R = F + k·(B − F)`. Belief chases
 * the reality it observes: `B ← B + β·(R − B)`. Substituting, the deviation
 * `B − F` evolves by the multiplier `1 + β·(k − 1)`:
 *
 *   • **k < 1** — the multiplier is below 1, so any rumour **decays** and both
 *     lines settle back onto the fundamental. The prophecy **defeats itself**:
 *     reality was never really moved, so belief corrects.
 *   • **k > 1** — the multiplier exceeds 1, so a rumour **grows**: a negative
 *     shock runs away into a self-fulfilling **collapse** (a bank run — a solvent
 *     bank fails purely because depositors expect it to), a positive shock into a
 *     self-fulfilling **boom** (a bubble). The prophecy **fulfils itself**.
 *   • **k = 1** — the knife-edge: belief and reality drift together with no pull
 *     home and no runaway.
 *
 * The learner sets the coupling, sets a rumour (negative panic or positive
 * optimism), fires it, and steps or runs the loop to watch belief and reality
 * either re-converge on the fundamental or spiral away from it together. All
 * meaning lives in the `aria-live` readout (belief, reality, gap, verdict); the
 * two-line chart is decorative. The only motion is a cosmetic tween on the bars,
 * disabled under `prefers-reduced-motion`. Never auto-runs on mount.
 */
export function ReflexivityLoop({
  title,
  eyebrow = 'Reflexivity loop',
  instructions = 'Two lines move over time: REALITY (how the bank / asset actually stands) and BELIEF (what the crowd thinks). Both anchor to the fundamental at 50. Set the coupling — how strongly belief bends reality — then spread a rumour and watch. Below coupling 1.0 the rumour fades and both settle home: the prophecy defeats itself. Above 1.0 it runs away, and belief drags reality into the very collapse (or boom) it imagined.',
  caption,
  beliefLabel = 'Belief',
  realityLabel = 'Reality',
  fundamentalLabel = 'Fundamental (true value)',
  couplingLabel = 'Coupling — how strongly belief feeds back into reality',
  couplingLowLabel = 'weak — self-correcting',
  couplingHighLabel = 'strong — self-fulfilling',
  shockLabel = 'The rumour — an initial shock to belief',
  shockLowLabel = 'panic (a run)',
  shockHighLabel = 'euphoria (a boom)',
  stepButtonLabel = 'Step ▸',
  runLabel = 'Run ▸',
  pauseLabel = 'Pause',
  shockButtonLabel = 'Spread the rumour ⚡',
  resetLabel = 'Reset ↻',
  verdictCalm = 'calm — belief sits on the fundamental; spread a rumour to disturb it',
  verdictDefeated = 'the rumour is fading — below coupling 1.0 the loop is self-correcting, so belief drifts back to the truth and the prophecy defeats itself',
  verdictBoom = 'a self-fulfilling BOOM — above coupling 1.0 optimism feeds on itself, dragging reality up into the bubble everyone believed in',
  verdictCollapse = 'a self-fulfilling COLLAPSE — above coupling 1.0 the panic feeds on itself, and belief drags a sound bank down into the very failure it feared',
  readout = 'Step {step} · coupling {coupling}× · belief {belief}, reality {reality} (gap {gap}): {verdict}.',
  initialCoupling = 140,
  initialShock = -12,
  className,
}: ReflexivityLoopProps) {
  const reactId = useId();
  const clampCoupling = (n: number) => Math.max(0, Math.min(200, Math.round(n)));
  const clampShock = (n: number) => Math.max(-25, Math.min(25, Math.round(n)));

  const [coupling, setCoupling] = useState(() => clampCoupling(initialCoupling));
  const [shock, setShock] = useState(() => clampShock(initialShock));
  const [belief, setBelief] = useState(FUNDAMENTAL);
  const [reality, setReality] = useState(FUNDAMENTAL);
  const [step, setStep] = useState(0);
  const [shocked, setShocked] = useState(false);
  const [beliefHist, setBeliefHist] = useState<number[]>([FUNDAMENTAL]);
  const [realityHist, setRealityHist] = useState<number[]>([FUNDAMENTAL]);
  const [running, setRunning] = useState(false);
  // Direction the deviation is moving, to distinguish decay from runaway.
  const prevDevRef = useRef(0);
  const [growing, setGrowing] = useState(false);

  // Latest values read inside the interval without re-subscribing.
  const stateRef = useRef({ belief, reality, step, shocked, coupling });
  stateRef.current = { belief, reality, step, shocked, coupling };

  /** Advance the reflexive loop one tick. */
  const advance = () => {
    const { belief: b, reality: r, step: s, shocked: sh, coupling: cRaw } = stateRef.current;
    if (!sh) return; // nothing to evolve until a rumour is spread
    const k = cRaw / 100;
    // Reality is dragged toward belief by the coupling; the rest stays at fundamental.
    const nextReality = clamp(FUNDAMENTAL + k * (b - FUNDAMENTAL), V_MIN, V_MAX);
    // Belief chases the reality it now observes.
    const nextBelief = clamp(b + BELIEF_SPEED * (nextReality - b), V_MIN, V_MAX);

    const dev = Math.abs(nextBelief - FUNDAMENTAL);
    setGrowing(dev > Math.abs(prevDevRef.current) + 0.001);
    prevDevRef.current = nextBelief - FUNDAMENTAL;

    setReality(nextReality);
    setBelief(nextBelief);
    setStep(s + 1);
    setBeliefHist((h) => {
      const next = h.concat(nextBelief);
      return next.length > HISTORY_CAP ? next.slice(next.length - HISTORY_CAP) : next;
    });
    setRealityHist((h) => {
      const next = h.concat(nextReality);
      return next.length > HISTORY_CAP ? next.slice(next.length - HISTORY_CAP) : next;
    });
  };

  /** Fire the rumour: jolt belief away from the fundamental by the shock size. */
  const fireShock = () => {
    setRunning(false);
    const b0 = clamp(FUNDAMENTAL + shock, V_MIN, V_MAX);
    prevDevRef.current = b0 - FUNDAMENTAL;
    setBelief(b0);
    setReality(FUNDAMENTAL);
    setStep(0);
    setShocked(true);
    setGrowing(false);
    setBeliefHist([FUNDAMENTAL, b0]);
    setRealityHist([FUNDAMENTAL, FUNDAMENTAL]);
    stateRef.current = { belief: b0, reality: FUNDAMENTAL, step: 0, shocked: true, coupling };
  };

  const reset = () => {
    setRunning(false);
    setBelief(FUNDAMENTAL);
    setReality(FUNDAMENTAL);
    setStep(0);
    setShocked(false);
    setGrowing(false);
    prevDevRef.current = 0;
    setBeliefHist([FUNDAMENTAL]);
    setRealityHist([FUNDAMENTAL]);
  };

  const onCouplingChange = (raw: number) => {
    setCoupling(clampCoupling(raw));
    reset();
  };
  const onShockChange = (raw: number) => {
    setShock(clampShock(raw));
    reset();
  };

  // Auto-run loop: advances a tick on an interval until it settles or maxes out.
  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      const { belief: b, step: s, shocked: sh } = stateRef.current;
      const dev = Math.abs(b - FUNDAMENTAL);
      const done =
        s >= MAX_STEPS ||
        b <= V_MIN + 0.05 ||
        b >= V_MAX - 0.05 ||
        (dev < SETTLE_EPS && s > 2);
      if (!sh || done) {
        setRunning(false);
        return;
      }
      advance();
    }, 220);
    return () => window.clearInterval(id);
    // advance closes over refs/state setters only; safe to omit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  const gap = belief - reality;
  const dev = belief - FUNDAMENTAL;
  const absDev = Math.abs(dev);

  let verdict: string;
  if (!shocked) {
    verdict = verdictCalm;
  } else if (absDev < RUNAWAY_EPS && !growing) {
    verdict = verdictDefeated;
  } else if (dev >= 0) {
    verdict = verdictBoom;
  } else {
    verdict = verdictCollapse;
  }

  const couplingDisplay = (coupling / 100).toFixed(1);
  const readoutText = readout
    .replace('{step}', String(step))
    .replace('{coupling}', couplingDisplay)
    .replace('{belief}', belief.toFixed(1))
    .replace('{reality}', reality.toFixed(1))
    .replace('{gap}', (gap >= 0 ? '+' : '') + gap.toFixed(1))
    .replace('{verdict}', verdict);

  const colorBelief = 'var(--color-accent-500)';
  const colorReality = 'var(--color-brand-500)';
  const tween = 'transition-all duration-300 ease-out motion-reduce:transition-none';

  // Two polylines (belief, reality) plotted 0 (bottom) → 100 (top).
  const toPath = (hist: number[]) => {
    if (hist.length < 2) return '';
    const n = hist.length;
    return hist
      .map((v, i) => {
        const x = PAD_L + (i / (n - 1)) * PLOT_W;
        const y = PAD_T + (1 - clamp(v, 0, 100) / 100) * PLOT_H;
        return `${round(x * 10) / 10},${round(y * 10) / 10}`;
      })
      .join(' ');
  };
  const beliefPath = useMemo(() => toPath(beliefHist), [beliefHist]);
  const realityPath = useMemo(() => toPath(realityHist), [realityHist]);

  const fundY = PAD_T + (1 - FUNDAMENTAL / 100) * PLOT_H;
  const canStep = shocked && step < MAX_STEPS && belief > V_MIN + 0.05 && belief < V_MAX - 0.05;

  const beliefPct = round(belief);
  const realityPct = round(reality);

  return (
    <figure className={cx('brutal my-6 bg-surface p-5 sm:p-6', className)}>
      <p className="font-display text-xs font-semibold uppercase tracking-wide text-accent-600">
        {eyebrow}
      </p>
      {title ? (
        <p className="mt-1 font-display text-lg font-semibold text-ink-900">{title}</p>
      ) : null}

      <p className="mt-2 text-sm font-medium text-ink-700">{instructions}</p>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs font-medium text-ink-600">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="inline-block h-3 w-3 rounded-sm" style={{ background: colorReality }} />
          {realityLabel}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="inline-block h-3 w-3 rounded-sm" style={{ background: colorBelief }} />
          {beliefLabel}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="inline-block h-3 w-0.5 rounded-sm bg-ink-300" style={{ height: '0.75rem' }} />
          {fundamentalLabel}
        </span>
      </div>

      {/* Belief vs reality bars */}
      <div className="mt-4 space-y-2">
        <div className="flex items-center gap-2">
          <span className="w-20 shrink-0 text-xs font-medium text-ink-600">{realityLabel}</span>
          <div className="relative h-4 flex-1 overflow-hidden rounded-pill bg-surface-sunken">
            <div className={cx('h-full rounded-pill', tween)} style={{ width: `${realityPct}%`, background: colorReality }} />
          </div>
          <span className="w-10 shrink-0 text-right text-xs font-semibold tabular-nums text-ink-700">{realityPct}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-20 shrink-0 text-xs font-medium text-ink-600">{beliefLabel}</span>
          <div className="relative h-4 flex-1 overflow-hidden rounded-pill bg-surface-sunken">
            <div className={cx('h-full rounded-pill', tween)} style={{ width: `${beliefPct}%`, background: colorBelief }} />
          </div>
          <span className="w-10 shrink-0 text-right text-xs font-semibold tabular-nums text-ink-700">{beliefPct}</span>
        </div>
      </div>

      {/* Belief & reality over time (decorative — meaning is in the readout) */}
      <div className="mt-4 overflow-hidden rounded-card border border-ink-100 bg-surface-sunken">
        <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={readoutText}>
          <rect x="0" y="0" width={W} height={H} fill="var(--color-surface-sunken)" />
          {/* fundamental reference line */}
          <line
            x1={PAD_L}
            y1={fundY}
            x2={W - PAD_R}
            y2={fundY}
            stroke="var(--color-ink-300)"
            strokeWidth="1"
            strokeDasharray="4 4"
          />
          {realityPath ? (
            <polyline
              points={realityPath}
              fill="none"
              stroke={colorReality}
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ) : null}
          {beliefPath ? (
            <polyline
              points={beliefPath}
              fill="none"
              stroke={colorBelief}
              strokeWidth="2.5"
              strokeDasharray="1 5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ) : null}
        </svg>
      </div>

      {/* Live readout + verdict */}
      <p
        aria-live="polite"
        className="mt-4 rounded-card border border-accent-200 bg-accent-50/70 p-3 text-sm leading-relaxed text-ink-700"
      >
        {readoutText}
      </p>

      {/* Coupling slider */}
      <div className="mt-4">
        <div className="flex items-center justify-between text-[0.65rem] font-bold uppercase tracking-wide text-ink-500">
          <label htmlFor={`${reactId}-coupling`}>{couplingLabel}</label>
          <span>{couplingDisplay}×</span>
        </div>
        <input
          id={`${reactId}-coupling`}
          type="range"
          min={0}
          max={200}
          step={5}
          value={coupling}
          onChange={(e) => onCouplingChange(Number(e.target.value))}
          aria-valuetext={`coupling ${couplingDisplay}`}
          className="mt-1 h-1.5 w-full cursor-pointer accent-accent-500"
        />
        <div className="flex justify-between text-[0.6rem] font-medium uppercase tracking-wide text-ink-400">
          <span>{couplingLowLabel}</span>
          <span>{couplingHighLabel}</span>
        </div>
      </div>

      {/* Shock slider */}
      <div className="mt-4">
        <div className="flex items-center justify-between text-[0.65rem] font-bold uppercase tracking-wide text-ink-500">
          <label htmlFor={`${reactId}-shock`}>{shockLabel}</label>
          <span>{shock > 0 ? `+${shock}` : shock}</span>
        </div>
        <input
          id={`${reactId}-shock`}
          type="range"
          min={-25}
          max={25}
          step={1}
          value={shock}
          onChange={(e) => onShockChange(Number(e.target.value))}
          aria-valuetext={`rumour ${shock}`}
          className="mt-1 h-1.5 w-full cursor-pointer accent-brand-500"
        />
        <div className="flex justify-between text-[0.6rem] font-medium uppercase tracking-wide text-ink-400">
          <span>{shockLowLabel}</span>
          <span>{shockHighLabel}</span>
        </div>
      </div>

      {/* Controls */}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={fireShock}
          disabled={running}
          className="brutal-btn bg-brand-500 px-4 py-2 font-display text-sm text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {shockButtonLabel}
        </button>
        <button
          type="button"
          onClick={advance}
          disabled={running || !canStep}
          className="brutal-btn bg-accent-500 px-4 py-2 font-display text-sm text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {stepButtonLabel}
        </button>
        <button
          type="button"
          onClick={() => setRunning((r) => !r)}
          disabled={!running && !canStep}
          className="inline-flex items-center rounded-pill px-3 py-2 font-display text-sm font-semibold text-ink-600 ring-1 ring-inset ring-ink-300 transition-colors hover:bg-surface-sunken disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none"
        >
          {running ? pauseLabel : runLabel}
        </button>
        <button
          type="button"
          onClick={reset}
          className="inline-flex items-center rounded-pill px-3 py-2 font-display text-sm font-semibold text-ink-600 ring-1 ring-inset ring-ink-300 transition-colors hover:bg-surface-sunken motion-reduce:transition-none"
        >
          {resetLabel}
        </button>
      </div>

      {caption ? <figcaption className="mt-3 text-sm text-ink-500">{caption}</figcaption> : null}
    </figure>
  );
}

export default ReflexivityLoop;
