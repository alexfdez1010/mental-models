import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { cx } from '@/components/react/cx';

/** The three responses to disorder the tester can model. */
export type FragilitySystem = 'fragile' | 'robust' | 'antifragile';

/** Props for the {@link FragilityTester} island. */
export interface FragilityTesterProps {
  /** Heading above the card. */
  title?: string;
  /** Eyebrow label. Defaults to `'Fragility tester'`. */
  eyebrow?: string;
  /** Instruction line above the simulation. */
  instructions?: string;
  /** Caption beneath the card. */
  caption?: string;
  /** Label above the system selector. */
  systemLabel?: string;
  /** Button label for the fragile (concave) system. */
  fragileLabel?: string;
  /** Button label for the robust (flat) system. */
  robustLabel?: string;
  /** Button label for the antifragile (convex) system. */
  antifragileLabel?: string;
  /** Label above the volatility slider. */
  volatilityLabel?: string;
  /** Caption on the calm end of the volatility slider. */
  volLowLabel?: string;
  /** Caption on the wild end of the volatility slider. */
  volHighLabel?: string;
  /** Label on the via-negativa toggle. */
  viaNegativaLabel?: string;
  /** Helper line under the via-negativa toggle. */
  viaNegativaHint?: string;
  /** Text on the button that fires a single shock. Defaults to `'Fire a shock ⚡'`. */
  fireLabel?: string;
  /** Text on the auto-run button. Defaults to `'Run ▸'`. */
  runLabel?: string;
  /** Text on the button that pauses an in-progress run. Defaults to `'Pause'`. */
  pauseLabel?: string;
  /** Text on the reset button. Defaults to `'Reset ↻'`. */
  resetLabel?: string;
  /** Legend title above the payoff curve. Defaults to `'Payoff vs stress'`. */
  payoffCurveLabel?: string;
  /** Legend title above the cumulative trace. Defaults to `'Cumulative outcome'`. */
  cumulativeLabel?: string;
  /** Curvature word for the fragile system (concave). */
  curvatureConcave?: string;
  /** Curvature word for the robust system (flat). */
  curvatureFlat?: string;
  /** Curvature word for the antifragile system (convex). */
  curvatureConvex?: string;
  /** Verdict for the robust system. */
  verdictRobust?: string;
  /** Verdict for the fragile system running exposed. */
  verdictFragile?: string;
  /** Verdict for the fragile system with via-negativa on. */
  verdictFragileCapped?: string;
  /** Verdict for the antifragile system compounding within its dose. */
  verdictAntifragile?: string;
  /** Verdict when a shock past the dose limit broke the antifragile system. */
  verdictAntifragileBroke?: string;
  /** Verdict for the antifragile system with via-negativa capping the overdose. */
  verdictAntifragileCapped?: string;
  /**
   * Live readout template. `{system}`, `{curvature}`, `{vol}`, `{n}` (shocks
   * fired), `{mean}` (mean outcome per shock), `{worst}` (worst single shock),
   * `{total}` (cumulative) and `{verdict}` are replaced.
   */
  readout?: string;
  /** Which system to start on. Defaults to `'fragile'`. */
  initialSystem?: FragilitySystem;
  /** Starting volatility, integer 0–100. Defaults to `60`. */
  initialVolatility?: number;
  /** Whether via-negativa starts on. Defaults to `false`. */
  initialViaNegativa?: boolean;
  /** Extra classes merged onto the root element. */
  className?: string;
}

// ── Model constants ──────────────────────────────────────────────────────────
const CURVE = 0.5; // curvature coefficient c in ±c·x²
const DOSE = 5; // dose limit — stress beyond this breaks even the antifragile
const OVERDOSE = 3; // how hard an overdose smashes the antifragile
const FLOOR = 2; // via-negativa cap on a single fragile loss
const STRESS_MAX = 8; // x-axis extent of the payoff curve
const HISTORY_CAP = 64; // cumulative trace length
const MAX_STEPS = 40; // auto-run stops after this many shocks

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const round1 = (n: number) => Math.round(n * 10) / 10;

/** Draw one stress magnitude (≥ 0). Volatility scales the spread and the tail. */
function drawStress(volPct: number): number {
  const vol = volPct / 100;
  if (vol <= 0) return 0;
  // Half-normal core via Box–Muller.
  const u1 = Math.random();
  const u2 = Math.random();
  const g = Math.abs(Math.sqrt(-2 * Math.log(u1 + 1e-9)) * Math.cos(2 * Math.PI * u2));
  let x = g;
  // A fat tail: one shock in eight lands far out — the rare extreme fat tails guarantee.
  if (Math.random() < 0.13) x *= 2.4;
  return x * vol * 3;
}

/**
 * The payoff of a single stress of magnitude `x` for a given system. This is the
 * curvature that defines the triad: fragile = concave (harm accelerates),
 * robust = flat, antifragile = convex (gain accelerates) up to a dose limit.
 * Via-negativa caps the catastrophic exposure on either end.
 */
function payoff(system: FragilitySystem, x: number, viaNegativa: boolean): number {
  if (system === 'robust') return 0;
  if (system === 'fragile') {
    const p = -CURVE * x * x; // concave: big shocks hurt disproportionately
    return viaNegativa ? Math.max(p, -FLOOR) : p; // subtract the ruinous downside
  }
  // antifragile — convex gains up to the dose, then it breaks
  if (x <= DOSE) return CURVE * x * x;
  const capped = CURVE * DOSE * DOSE;
  if (viaNegativa) return capped; // remove the overdose exposure — keep the gains, cap the risk
  return capped - OVERDOSE * (x - DOSE) * (x - DOSE); // enough stress kills even the antifragile
}

/**
 * Interactive **antifragility / via-negativa** sandbox. The learner picks a
 * system whose payoff-vs-stress curve is **concave** (fragile), **flat**
 * (robust) or **convex** (antifragile), sets a **volatility** level, and fires
 * random shocks. The same disorder bleeds the fragile system from its tails
 * while the antifragile one compounds gains from it — Jensen's inequality made
 * physical — until a shock past the **dose limit** breaks even the antifragile.
 * A **via-negativa** toggle removes the fragilising exposure (caps the
 * catastrophic downside) and re-runs, showing that subtraction robustifies.
 *
 * All meaning lives in the `aria-live` readout (system, curvature, mean, worst
 * tail, cumulative, verdict); the payoff curve and cumulative trace are
 * decorative. The only motion is a cosmetic tween. Never auto-runs on mount.
 */
export function FragilityTester({
  title,
  eyebrow = 'Fragility tester',
  instructions = 'Pick a system by the SHAPE of its payoff-vs-stress curve: FRAGILE (concave — big shocks hurt disproportionately), ROBUST (flat — indifferent) or ANTIFRAGILE (convex — it gains from disorder, up to a dose limit). Set the volatility, then fire shocks and watch the cumulative outcome. The same storm bleeds the fragile and feeds the antifragile. Flip on via negativa to REMOVE the ruinous exposure and re-run.',
  caption,
  systemLabel = 'The system — the shape of its response to disorder',
  fragileLabel = 'Fragile · concave',
  robustLabel = 'Robust · flat',
  antifragileLabel = 'Antifragile · convex',
  volatilityLabel = 'Volatility — how wild the disorder is',
  volLowLabel = 'calm',
  volHighLabel = 'wild (fat tails)',
  viaNegativaLabel = 'Via negativa — remove the fragilising exposure',
  viaNegativaHint = 'Caps the catastrophic downside (the fragile stops bleeding; the antifragile can no longer overdose). Subtraction, not addition.',
  fireLabel = 'Fire a shock ⚡',
  runLabel = 'Run ▸',
  pauseLabel = 'Pause',
  resetLabel = 'Reset ↻',
  payoffCurveLabel = 'Payoff vs stress (the curvature)',
  cumulativeLabel = 'Cumulative outcome over shocks',
  curvatureConcave = 'concave — harm accelerates',
  curvatureFlat = 'flat — indifferent',
  curvatureConvex = 'convex — gain accelerates',
  verdictRobust = 'robust — volatility barely moves it; it neither bleeds nor gains, it just endures',
  verdictFragile = 'fragile — the same disorder bleeds it, and one bad tail does most of the damage; its payoff is concave, so big shocks hurt out of all proportion',
  verdictFragileCapped = 'via negativa — capping the catastrophic downside turned a bleeder into something that shrugs off the storm; you added nothing, you removed the ruin',
  verdictAntifragile = 'antifragile — it compounds gains from the very disorder that bleeds the fragile; its payoff is convex, so it benefits from the volatility fat tails guarantee',
  verdictAntifragileBroke = 'antifragile, but past its dose — a shock beyond the limit broke even the antifragile; convexity holds only over a range, and enough stress kills anything',
  verdictAntifragileCapped = 'via negativa — capping the ruinous overdose lets it keep the convex gains and survive any storm; bounded downside, open upside',
  readout = '{system} · {curvature} · volatility {vol} · {n} shocks fired · mean per shock {mean} · worst single {worst} · cumulative {total}. {verdict}.',
  initialSystem = 'fragile',
  initialVolatility = 60,
  initialViaNegativa = false,
  className,
}: FragilityTesterProps) {
  const reactId = useId();
  const clampVol = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

  const [system, setSystem] = useState<FragilitySystem>(initialSystem);
  const [volatility, setVolatility] = useState(() => clampVol(initialVolatility));
  const [viaNegativa, setViaNegativa] = useState(Boolean(initialViaNegativa));
  const [total, setTotal] = useState(0);
  const [worst, setWorst] = useState(0);
  const [n, setN] = useState(0);
  const [broke, setBroke] = useState(false);
  const [hist, setHist] = useState<number[]>([0]);
  const [running, setRunning] = useState(false);

  // Latest values read inside the auto-run interval without re-subscribing.
  const stateRef = useRef({ system, volatility, viaNegativa, total, worst, n });
  stateRef.current = { system, volatility, viaNegativa, total, worst, n };

  /** Fire one shock and fold its payoff into the running totals. */
  const fire = () => {
    const { system: sys, volatility: vol, viaNegativa: vn, total: t, worst: w, n: count } =
      stateRef.current;
    const x = drawStress(vol);
    const p = payoff(sys, x, vn);
    const overdosed = sys === 'antifragile' && !vn && x > DOSE;
    const nextTotal = t + p;
    const nextWorst = count === 0 ? p : Math.min(w, p);
    setTotal(nextTotal);
    setWorst(nextWorst);
    setN(count + 1);
    if (overdosed) setBroke(true);
    setHist((h) => {
      const next = h.concat(nextTotal);
      return next.length > HISTORY_CAP ? next.slice(next.length - HISTORY_CAP) : next;
    });
  };

  const reset = () => {
    setRunning(false);
    setTotal(0);
    setWorst(0);
    setN(0);
    setBroke(false);
    setHist([0]);
  };

  const onSystem = (s: FragilitySystem) => {
    setSystem(s);
    reset();
  };
  const onVolatility = (raw: number) => {
    setVolatility(clampVol(raw));
    reset();
  };
  const onViaNegativa = (v: boolean) => {
    setViaNegativa(v);
    reset();
  };

  // Auto-run: fire a shock on an interval until it maxes out.
  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      if (stateRef.current.n >= MAX_STEPS) {
        setRunning(false);
        return;
      }
      fire();
    }, 200);
    return () => window.clearInterval(id);
    // fire closes over refs/state setters only; safe to omit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  const curvature =
    system === 'fragile' ? curvatureConcave : system === 'robust' ? curvatureFlat : curvatureConvex;

  let verdict: string;
  if (system === 'robust') verdict = verdictRobust;
  else if (system === 'fragile') verdict = viaNegativa ? verdictFragileCapped : verdictFragile;
  else if (viaNegativa) verdict = verdictAntifragileCapped;
  else if (broke) verdict = verdictAntifragileBroke;
  else verdict = verdictAntifragile;

  const mean = n > 0 ? total / n : 0;
  const fmt = (v: number) => (v >= 0 ? '+' : '') + round1(v).toFixed(1);
  const systemName =
    system === 'fragile' ? fragileLabel : system === 'robust' ? robustLabel : antifragileLabel;

  const readoutText = readout
    .replace('{system}', systemName)
    .replace('{curvature}', curvature)
    .replace('{vol}', String(volatility))
    .replace('{n}', String(n))
    .replace('{mean}', n > 0 ? fmt(mean) : '—')
    .replace('{worst}', n > 0 ? fmt(worst) : '—')
    .replace('{total}', fmt(total))
    .replace('{verdict}', verdict);

  // ── Payoff-curve geometry ──────────────────────────────────────────────────
  const CW = 230;
  const CH = 170;
  const CPAD = 22;
  const curveColor =
    system === 'fragile'
      ? 'var(--color-brand-600)'
      : system === 'antifragile'
        ? 'var(--color-accent-600)'
        : 'var(--color-ink-400)';

  const yExtent = 20; // payoff range shown: [-yExtent, +yExtent]
  const curvePath = useMemo(() => {
    const pts: string[] = [];
    const steps = 60;
    for (let i = 0; i <= steps; i++) {
      const x = (i / steps) * STRESS_MAX;
      const p = clamp(payoff(system, x, viaNegativa), -yExtent, yExtent);
      const px = CPAD + (x / STRESS_MAX) * (CW - 2 * CPAD);
      const py = CPAD + (1 - (p + yExtent) / (2 * yExtent)) * (CH - 2 * CPAD);
      pts.push(`${round1(px)},${round1(py)}`);
    }
    return pts.join(' ');
  }, [system, viaNegativa]);

  const zeroY = CPAD + (1 - (0 + yExtent) / (2 * yExtent)) * (CH - 2 * CPAD);
  const doseX = CPAD + (DOSE / STRESS_MAX) * (CW - 2 * CPAD);

  // ── Cumulative-trace geometry ──────────────────────────────────────────────
  const TW = 230;
  const TH = 170;
  const TPAD = 10;
  const tracePath = useMemo(() => {
    if (hist.length < 2) return '';
    const lo = Math.min(0, ...hist);
    const hi = Math.max(0, ...hist);
    const span = hi - lo || 1;
    const len = hist.length;
    return hist
      .map((v, i) => {
        const x = TPAD + (i / (len - 1)) * (TW - 2 * TPAD);
        const y = TPAD + (1 - (v - lo) / span) * (TH - 2 * TPAD);
        return `${round1(x)},${round1(y)}`;
      })
      .join(' ');
  }, [hist]);
  const traceZeroY = useMemo(() => {
    const lo = Math.min(0, ...hist);
    const hi = Math.max(0, ...hist);
    const span = hi - lo || 1;
    return TPAD + (1 - (0 - lo) / span) * (TH - 2 * TPAD);
  }, [hist]);
  const traceColor = total >= 0 ? 'var(--color-accent-600)' : 'var(--color-brand-600)';

  const canRun = n < MAX_STEPS;
  const segBtn = (active: boolean) =>
    cx(
      'flex-1 rounded-pill px-3 py-2 font-display text-xs font-semibold transition-colors motion-reduce:transition-none sm:text-sm',
      active
        ? 'bg-ink-900 text-white'
        : 'text-ink-600 ring-1 ring-inset ring-ink-300 hover:bg-surface-sunken',
    );

  return (
    <figure className={cx('brutal my-6 bg-surface p-5 sm:p-6', className)}>
      <p className="font-display text-xs font-semibold uppercase tracking-wide text-accent-600">
        {eyebrow}
      </p>
      {title ? (
        <p className="mt-1 font-display text-lg font-semibold text-ink-900">{title}</p>
      ) : null}

      <p className="mt-2 text-sm font-medium text-ink-700">{instructions}</p>

      {/* System selector */}
      <div className="mt-4">
        <p className="text-[0.65rem] font-bold uppercase tracking-wide text-ink-500">{systemLabel}</p>
        <div className="mt-1.5 flex flex-wrap gap-2">
          <button type="button" onClick={() => onSystem('fragile')} className={segBtn(system === 'fragile')}>
            {fragileLabel}
          </button>
          <button type="button" onClick={() => onSystem('robust')} className={segBtn(system === 'robust')}>
            {robustLabel}
          </button>
          <button
            type="button"
            onClick={() => onSystem('antifragile')}
            className={segBtn(system === 'antifragile')}
          >
            {antifragileLabel}
          </button>
        </div>
      </div>

      {/* Charts */}
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="overflow-hidden rounded-card border border-ink-100 bg-surface-sunken">
          <p className="px-3 pt-2 text-[0.6rem] font-bold uppercase tracking-wide text-ink-500">
            {payoffCurveLabel}
          </p>
          <svg viewBox={`0 0 ${CW} ${CH}`} className="h-auto w-full" role="img" aria-label={readoutText}>
            {/* zero line */}
            <line x1={CPAD} y1={zeroY} x2={CW - CPAD} y2={zeroY} stroke="var(--color-ink-300)" strokeWidth="1" strokeDasharray="4 4" />
            {/* dose limit marker for the antifragile */}
            {system === 'antifragile' ? (
              <line x1={doseX} y1={CPAD} x2={doseX} y2={CH - CPAD} stroke="var(--color-ink-300)" strokeWidth="1" strokeDasharray="2 4" />
            ) : null}
            <polyline points={curvePath} fill="none" stroke={curveColor} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>

        <div className="overflow-hidden rounded-card border border-ink-100 bg-surface-sunken">
          <p className="px-3 pt-2 text-[0.6rem] font-bold uppercase tracking-wide text-ink-500">
            {cumulativeLabel}
          </p>
          <svg viewBox={`0 0 ${TW} ${TH}`} className="h-auto w-full" role="img" aria-label={readoutText}>
            <line x1={TPAD} y1={traceZeroY} x2={TW - TPAD} y2={traceZeroY} stroke="var(--color-ink-300)" strokeWidth="1" strokeDasharray="4 4" />
            {tracePath ? (
              <polyline points={tracePath} fill="none" stroke={traceColor} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            ) : null}
          </svg>
        </div>
      </div>

      {/* Live readout + verdict */}
      <p
        aria-live="polite"
        className="mt-4 rounded-card border border-accent-200 bg-accent-50/70 p-3 text-sm leading-relaxed text-ink-700"
      >
        {readoutText}
      </p>

      {/* Volatility slider */}
      <div className="mt-4">
        <div className="flex items-center justify-between text-[0.65rem] font-bold uppercase tracking-wide text-ink-500">
          <label htmlFor={`${reactId}-vol`}>{volatilityLabel}</label>
          <span>{volatility}</span>
        </div>
        <input
          id={`${reactId}-vol`}
          type="range"
          min={0}
          max={100}
          step={5}
          value={volatility}
          onChange={(e) => onVolatility(Number(e.target.value))}
          aria-valuetext={`volatility ${volatility}`}
          className="mt-1 h-1.5 w-full cursor-pointer accent-brand-500"
        />
        <div className="flex justify-between text-[0.6rem] font-medium uppercase tracking-wide text-ink-400">
          <span>{volLowLabel}</span>
          <span>{volHighLabel}</span>
        </div>
      </div>

      {/* Via-negativa toggle */}
      <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-card border border-ink-100 bg-surface-sunken p-3">
        <input
          type="checkbox"
          checked={viaNegativa}
          onChange={(e) => onViaNegativa(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-accent-500"
        />
        <span className="text-sm">
          <span className="font-display font-semibold text-ink-800">{viaNegativaLabel}</span>
          <span className="mt-0.5 block text-xs text-ink-500">{viaNegativaHint}</span>
        </span>
      </label>

      {/* Controls */}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={fire}
          disabled={running || !canRun}
          className="brutal-btn bg-brand-500 px-4 py-2 font-display text-sm text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {fireLabel}
        </button>
        <button
          type="button"
          onClick={() => setRunning((r) => !r)}
          disabled={!running && !canRun}
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

export default FragilityTester;
