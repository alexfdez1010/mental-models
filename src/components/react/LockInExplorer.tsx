import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { cx } from '@/components/react/cx';

/** Props for the {@link LockInExplorer} island. */
export interface LockInExplorerProps {
  /** Heading above the card. */
  title?: string;
  /** Eyebrow label. Defaults to `'Increasing returns & lock-in'`. */
  eyebrow?: string;
  /** Instruction line above the simulation. */
  instructions?: string;
  /** Caption beneath the card. */
  caption?: string;
  /** Legend / bar label for the first competing standard. */
  labelA?: string;
  /** Legend / bar label for the second competing standard. */
  labelB?: string;
  /** Tag shown on whichever standard is intrinsically better. Defaults to `'slightly better'`. */
  betterTag?: string;
  /** Small caption explaining the intrinsic-quality readout. */
  qualityCaption?: string;
  /**
   * Intrinsic quality of standard A, in arbitrary percent units. Higher = a new
   * adopter, all else equal, prefers it. Defaults to `100`.
   */
  qualityA?: number;
  /**
   * Intrinsic quality of standard B. Default `115` makes B the genuinely *better*
   * option — so the learner can watch the worse one still win. Defaults to `115`.
   */
  qualityB?: number;
  /** Label above the increasing-returns slider. */
  strengthLabel?: string;
  /** Caption on the low end of the slider (no increasing returns). */
  strengthLowLabel?: string;
  /** Caption on the high end of the slider (strong increasing returns). */
  strengthHighLabel?: string;
  /** Heading over the market-share bars. Defaults to `'Market share'`. */
  shareLabel?: string;
  /** Small caption under the share-over-time chart. */
  historyCaption?: string;
  /** Text on the single-step button. Defaults to `'Add adopters ▸'`. */
  stepLabel?: string;
  /** Text on the auto-run button. Defaults to `'Run ▸'`. */
  runLabel?: string;
  /** Text on the button that pauses an in-progress run. Defaults to `'Pause'`. */
  pauseLabel?: string;
  /** Text on the button that fires an external shock at the trailing standard. Defaults to `'External shock ⚡'`. */
  shockLabel?: string;
  /** Text on the button that starts a fresh run with a new random early lead. Defaults to `'New run ↻'`. */
  resetLabel?: string;
  /** Verdict while the market is still contested (no standard has run away). */
  verdictContested?: string;
  /** Verdict once the market locks onto the intrinsically *better* standard. `{winner}` is replaced. */
  verdictLockedBetter?: string;
  /** Verdict once the market locks onto the intrinsically *worse* standard. `{winner}` is replaced. */
  verdictLockedWorse?: string;
  /**
   * Live readout template. `{shareA}`/`{shareB}` (percent), `{strength}` (the
   * increasing-returns multiplier, e.g. `1.5`), `{adopters}` (total so far) and
   * `{verdict}` are replaced.
   */
  readout?: string;
  /**
   * Starting increasing-returns strength, as an integer percent (so `150` means a
   * strength of 1.5). `0` = adoption tracks pure quality; high = tiny early leads
   * lock in. Defaults to `150`.
   */
  initialStrength?: number;
  /** Extra classes merged onto the root element. */
  className?: string;
}

/** A deterministic PRNG (mulberry32) so nothing depends on `Math.random()` /
 *  `Date.now()` and SSR stays stable. Reseeded per run. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const BASE_SEED = 0x51c0de5;
const ADOPTERS_PER_STEP = 4; // new adopters added per Step / per run tick
const MAX_ADOPTERS = 200; // stop the run once the market is this large
const SHOCK_SIZE = 40; // adopters a shock dumps onto the trailing standard
const LOCK_SHARE = 0.9; // share at which we call the market "locked in"
const HISTORY_CAP = MAX_ADOPTERS / ADOPTERS_PER_STEP + 4;

// ── Chart geometry ───────────────────────────────────────────────────────────
const W = 460;
const H = 150;
const PAD_L = 8;
const PAD_R = 8;
const PAD_T = 10;
const PAD_B = 10;
const PLOT_W = W - PAD_L - PAD_R;
const PLOT_H = H - PAD_T - PAD_B;

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const round = (n: number) => Math.round(n);

/**
 * Interactive **path-dependence / lock-in** sandbox — Brian Arthur's competing-
 * technologies model made tangible. Two rival standards, **A** and **B**, fight
 * for a market that fills up one adopter at a time. Each newcomer picks a
 * standard with probability proportional to its intrinsic **quality** *times* its
 * current market share raised to an **increasing-returns strength** the learner
 * controls. B is deliberately the *better* option.
 *
 * With the strength at **0**, adoption tracks pure quality: the better standard
 * (B) keeps a stable edge and nothing locks in — the market "gets it right".
 * Turn the strength up and the rich-get-richer loop takes over: whichever
 * standard grabs a small, *random* early lead sees that lead amplified until it
 * runs away to ~100% — and because the early lead is an accident, the *worse*
 * standard (A) wins a large fraction of runs. That is path dependence: the
 * outcome is decided by the sequence of early events, not by which option is
 * best.
 *
 * The learner can **step**, **run**, fire an **external shock** (a sponsor/
 * disruptor dumping a block of adopters onto the trailing standard to try to
 * dislodge the incumbent), and start a **new run** to re-roll the early lead and
 * watch a *different* winner emerge from the same settings.
 *
 * All meaning lives in the `aria-live` readout (shares, strength, verdict); the
 * share-over-time chart is decorative. The only motion is a cosmetic tween on the
 * bars, disabled under `prefers-reduced-motion`. Never auto-runs on mount.
 */
export function LockInExplorer({
  title,
  eyebrow = 'Increasing returns & lock-in',
  instructions = 'Two standards, A and B, compete for a market that fills one adopter at a time. Each newcomer prefers a standard for its quality AND for how many others already use it. Standard B is genuinely better — yet with strong increasing returns, an accidental early lead can lock the market onto the worse one. Run it, then hit “New run” to watch a different winner emerge from the same knob.',
  caption,
  labelA = 'Standard A',
  labelB = 'Standard B',
  betterTag = 'slightly better',
  qualityCaption = 'Intrinsic quality (fixed): B is the better standard on the merits.',
  qualityA = 100,
  qualityB = 115,
  strengthLabel = 'Increasing-returns strength (how much each existing adopter tilts the next one)',
  strengthLowLabel = 'none — best standard wins',
  strengthHighLabel = 'strong — early lead locks in',
  shareLabel = 'Market share',
  historyCaption = "Standard A's share over time. Watch a smooth build-up tip and then flatten into lock-in.",
  stepLabel = 'Add adopters ▸',
  runLabel = 'Run ▸',
  pauseLabel = 'Pause',
  shockLabel = 'External shock ⚡',
  resetLabel = 'New run ↻',
  verdictContested = 'still contested — no standard has run away yet',
  verdictLockedBetter = 'locked in on {winner} — increasing returns and quality agreed this time',
  verdictLockedWorse = 'locked in on {winner}, the WORSE standard — an early accident, amplified, beat the better option',
  readout = 'Increasing-returns strength {strength}× · {adopters} adopters · A holds {shareA}% and B holds {shareB}%: {verdict}.',
  initialStrength = 150,
  className,
}: LockInExplorerProps) {
  const reactId = useId();
  const clampStrength = (n: number) => Math.max(0, Math.min(300, Math.round(n)));

  const [strength, setStrength] = useState(() => clampStrength(initialStrength));
  // Adopter counts. Start with one each so shares are defined and the first few
  // (random) picks provide the "small early lead" without any special-casing.
  const [nA, setNA] = useState(1);
  const [nB, setNB] = useState(1);
  const [history, setHistory] = useState<number[]>([0.5]);
  const [running, setRunning] = useState(false);

  // The intrinsically better standard (ties → B).
  const betterKey: 'A' | 'B' = qualityA > qualityB ? 'A' : 'B';

  // A fresh RNG per run; the run counter reseeds it so "New run" re-rolls the
  // early accident deterministically (no Math.random / Date.now).
  const runId = useRef(0);
  const rng = useRef<() => number>(mulberry32(BASE_SEED));

  // Latest values read inside the interval without re-subscribing.
  const strengthRef = useRef(strength);
  strengthRef.current = strength;
  const countsRef = useRef({ nA, nB });
  countsRef.current = { nA, nB };

  /** Add `count` adopters, each choosing A or B by quality × share^strength. */
  const addAdopters = (count: number) => {
    const s = strengthRef.current / 100;
    let { nA: a, nB: b } = countsRef.current;
    const snaps: number[] = [];
    for (let i = 0; i < count; i += 1) {
      const total = a + b;
      const shareA = a / total;
      const shareB = b / total;
      // Preferential attachment: weight = quality × share^strength. At strength 0
      // this is pure quality; as strength grows, current share dominates.
      const wA = qualityA * Math.pow(shareA, s);
      const wB = qualityB * Math.pow(shareB, s);
      if (rng.current() < wB / (wA + wB)) b += 1;
      else a += 1;
      snaps.push(a / (a + b));
    }
    countsRef.current = { nA: a, nB: b };
    setNA(a);
    setNB(b);
    setHistory((h) => {
      const next = h.concat(snaps.length ? snaps[snaps.length - 1] : []);
      return next.length > HISTORY_CAP ? next.slice(next.length - HISTORY_CAP) : next;
    });
  };

  const doStep = () => addAdopters(ADOPTERS_PER_STEP);

  const newRun = () => {
    setRunning(false);
    runId.current += 1;
    rng.current = mulberry32(BASE_SEED ^ (runId.current * 0x9e3779b9));
    countsRef.current = { nA: 1, nB: 1 };
    setNA(1);
    setNB(1);
    setHistory([0.5]);
  };

  /** External shock: a sponsor/disruptor dumps a block of adopters onto whichever
   *  standard is currently BEHIND, to try to dislodge the incumbent. */
  const fireShock = () => {
    const { nA: a, nB: b } = countsRef.current;
    const trailingIsA = a <= b;
    const na = trailingIsA ? a + SHOCK_SIZE : a;
    const nb = trailingIsA ? b : b + SHOCK_SIZE;
    countsRef.current = { nA: na, nB: nb };
    setNA(na);
    setNB(nb);
    setHistory((h) => {
      const next = h.concat(na / (na + nb));
      return next.length > HISTORY_CAP ? next.slice(next.length - HISTORY_CAP) : next;
    });
  };

  const onStrengthChange = (raw: number) => {
    // Changing the knob starts a clean experiment so the slider is a genuine
    // "new world" control, not a mid-run edit.
    setStrength(clampStrength(raw));
    newRun();
  };

  // Auto-run loop: adds a batch on an interval until the market fills up. The
  // stop decision is made from refs so the setters stay pure and StrictMode-safe.
  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      const { nA: a, nB: b } = countsRef.current;
      if (a + b >= MAX_ADOPTERS) {
        setRunning(false);
        return;
      }
      addAdopters(ADOPTERS_PER_STEP);
    }, 160);
    return () => window.clearInterval(id);
    // addAdopters closes over refs only; safe to omit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  const total = nA + nB;
  const shareA = nA / total;
  const shareB = nB / total;
  const sharePctA = round(shareA * 100);
  const sharePctB = 100 - sharePctA;

  const leaderKey: 'A' | 'B' = shareA >= shareB ? 'A' : 'B';
  const leaderShare = Math.max(shareA, shareB);
  const locked = leaderShare >= LOCK_SHARE && total > ADOPTERS_PER_STEP * 3;
  const winnerLabel = leaderKey === 'A' ? labelA : labelB;

  let verdict: string;
  if (!locked) {
    verdict = verdictContested;
  } else if (leaderKey === betterKey) {
    verdict = verdictLockedBetter.replace('{winner}', winnerLabel);
  } else {
    verdict = verdictLockedWorse.replace('{winner}', winnerLabel);
  }

  const strengthDisplay = (strength / 100).toFixed(1);
  const readoutText = readout
    .replace('{strength}', strengthDisplay)
    .replace('{adopters}', String(total))
    .replace('{shareA}', String(sharePctA))
    .replace('{shareB}', String(sharePctB))
    .replace('{verdict}', verdict);

  const colorA = 'var(--color-brand-500)';
  const colorB = 'var(--color-accent-500)';
  const tween = 'transition-all duration-300 ease-out motion-reduce:transition-none';

  // Share-over-time polyline for A (0 at bottom, 1 at top). x spreads the history
  // across the plot; a flat line near 0 or 1 = lock-in.
  const chartPath = useMemo(() => {
    if (history.length < 2) return '';
    const n = history.length;
    return history
      .map((v, i) => {
        const x = PAD_L + (i / (n - 1)) * PLOT_W;
        const y = PAD_T + (1 - clamp(v, 0, 1)) * PLOT_H;
        return `${round(x * 10) / 10},${round(y * 10) / 10}`;
      })
      .join(' ');
  }, [history]);

  const midY = PAD_T + 0.5 * PLOT_H;
  const canAct = total < MAX_ADOPTERS;

  return (
    <figure className={cx('brutal my-6 bg-surface p-5 sm:p-6', className)}>
      <p className="font-display text-xs font-semibold uppercase tracking-wide text-accent-600">
        {eyebrow}
      </p>
      {title ? (
        <p className="mt-1 font-display text-lg font-semibold text-ink-900">{title}</p>
      ) : null}

      <p className="mt-2 text-sm font-medium text-ink-700">{instructions}</p>

      {/* Intrinsic-quality readout — B is the better standard on the merits */}
      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs font-medium text-ink-600">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="inline-block h-3 w-3 rounded-sm" style={{ background: colorA }} />
          {labelA}
          {betterKey === 'A' ? <span className="font-semibold text-brand-600"> · ★ {betterTag}</span> : null}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="inline-block h-3 w-3 rounded-sm" style={{ background: colorB }} />
          {labelB}
          {betterKey === 'B' ? <span className="font-semibold text-accent-600"> · ★ {betterTag}</span> : null}
        </span>
      </div>
      <p className="mt-1 text-[0.7rem] text-ink-500">{qualityCaption}</p>

      {/* Market-share bars */}
      <div className="mt-4">
        <p className="text-[0.65rem] font-bold uppercase tracking-wide text-ink-600">{shareLabel}</p>
        <div className="mt-2 space-y-2">
          <div className="flex items-center gap-2">
            <span className="w-28 shrink-0 text-xs font-medium text-ink-600">{labelA}</span>
            <div className="relative h-4 flex-1 overflow-hidden rounded-pill bg-surface-sunken">
              <div className={cx('h-full rounded-pill', tween)} style={{ width: `${sharePctA}%`, background: colorA }} />
            </div>
            <span className="w-10 shrink-0 text-right text-xs font-semibold tabular-nums text-ink-700">{sharePctA}%</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-28 shrink-0 text-xs font-medium text-ink-600">{labelB}</span>
            <div className="relative h-4 flex-1 overflow-hidden rounded-pill bg-surface-sunken">
              <div className={cx('h-full rounded-pill', tween)} style={{ width: `${sharePctB}%`, background: colorB }} />
            </div>
            <span className="w-10 shrink-0 text-right text-xs font-semibold tabular-nums text-ink-700">{sharePctB}%</span>
          </div>
        </div>
      </div>

      {/* Share-over-time chart (decorative — meaning is in the readout) */}
      <div className="mt-4 overflow-hidden rounded-card border border-ink-100 bg-surface-sunken">
        <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={readoutText}>
          <rect x="0" y="0" width={W} height={H} fill="var(--color-surface-sunken)" />
          {/* 50% reference line */}
          <line
            x1={PAD_L}
            y1={midY}
            x2={W - PAD_R}
            y2={midY}
            stroke="var(--color-ink-300)"
            strokeWidth="1"
            strokeDasharray="4 4"
          />
          {chartPath ? (
            <polyline
              points={chartPath}
              fill="none"
              stroke={colorA}
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ) : null}
        </svg>
      </div>
      <p className="mt-1.5 text-[0.7rem] text-ink-500">{historyCaption}</p>

      {/* Live readout + verdict */}
      <p
        aria-live="polite"
        className="mt-4 rounded-card border border-accent-200 bg-accent-50/70 p-3 text-sm leading-relaxed text-ink-700"
      >
        {readoutText}
      </p>

      {/* Increasing-returns slider */}
      <div className="mt-4">
        <div className="flex items-center justify-between text-[0.65rem] font-bold uppercase tracking-wide text-ink-500">
          <label htmlFor={`${reactId}-strength`}>{strengthLabel}</label>
          <span>{strengthDisplay}×</span>
        </div>
        <input
          id={`${reactId}-strength`}
          type="range"
          min={0}
          max={300}
          step={10}
          value={strength}
          onChange={(e) => onStrengthChange(Number(e.target.value))}
          aria-valuetext={`increasing-returns strength ${strengthDisplay}`}
          className="mt-1 h-1.5 w-full cursor-pointer accent-accent-500"
        />
        <div className="flex justify-between text-[0.6rem] font-medium uppercase tracking-wide text-ink-400">
          <span>{strengthLowLabel}</span>
          <span>{strengthHighLabel}</span>
        </div>
      </div>

      {/* Controls */}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={doStep}
          disabled={running || !canAct}
          className="brutal-btn bg-accent-500 px-4 py-2 font-display text-sm text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {stepLabel}
        </button>
        <button
          type="button"
          onClick={() => setRunning((r) => !r)}
          disabled={!running && !canAct}
          className="brutal-btn bg-brand-500 px-4 py-2 font-display text-sm text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {running ? pauseLabel : runLabel}
        </button>
        <button
          type="button"
          onClick={fireShock}
          disabled={running || !canAct}
          className="inline-flex items-center rounded-pill px-3 py-2 font-display text-sm font-semibold text-ink-600 ring-1 ring-inset ring-ink-300 transition-colors hover:bg-surface-sunken disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none"
        >
          {shockLabel}
        </button>
        <button
          type="button"
          onClick={newRun}
          className="inline-flex items-center rounded-pill px-3 py-2 font-display text-sm font-semibold text-ink-600 ring-1 ring-inset ring-ink-300 transition-colors hover:bg-surface-sunken motion-reduce:transition-none"
        >
          {resetLabel}
        </button>
      </div>

      {caption ? <figcaption className="mt-3 text-sm text-ink-500">{caption}</figcaption> : null}
    </figure>
  );
}

export default LockInExplorer;
