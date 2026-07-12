import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { cx } from '@/components/react/cx';

/** Props for the {@link EntropyBox} island. */
export interface EntropyBoxProps {
  /** Heading above the card. */
  title?: string;
  /** Eyebrow label. Defaults to `'Entropy lab'`. */
  eyebrow?: string;
  /** Instruction line above the animation. */
  instructions?: string;
  /** Caption beneath the card. */
  caption?: string;
  /** Starting particle count. Defaults to `60`. */
  initialCount?: number;
  /** Minimum particle count. Defaults to `8`. */
  minCount?: number;
  /** Maximum particle count. Defaults to `240`. */
  maxCount?: number;

  // ── Labels (all user-facing strings, for i18n) ────────────────────────────
  /** Label over the particle-count slider. */
  countLabel?: string;
  /** Text on the play button. Defaults to `'Play ▸'`. */
  playLabel?: string;
  /** Text on the pause button. Defaults to `'Pause'`. */
  pauseLabel?: string;
  /** Text on the rewind button. Defaults to `'Rewind ⏪'`. */
  rewindLabel?: string;
  /** Text on the reset button. Defaults to `'Reset'`. */
  resetLabel?: string;
  /** Heading over the entropy bar. */
  entropyLabel?: string;
  /** Label for the left/right split readout. */
  splitLabel?: string;
  /** Word for the left chamber. Defaults to `'left'`. */
  leftWord?: string;
  /** Word for the right chamber. Defaults to `'right'`. */
  rightWord?: string;
  /** Label for the "odds of returning to the start" stat. */
  oddsLabel?: string;
  /**
   * Live readout template. `{left}`, `{right}`, `{pct}` and `{odds}` are
   * replaced with the current split, the entropy percentage and the
   * return-to-start odds.
   */
  readoutTemplate?: string;
  /** Prefix shown before the odds figure, e.g. `'1 in '`. */
  oddsPrefix?: string;
  /**
   * Short note shown in place of the Play button when the visitor prefers
   * reduced motion (the box is drawn already mixed).
   */
  reducedMotionNote?: string;
  /** Extra classes merged onto the root element. */
  className?: string;
}

/** A deterministic PRNG (mulberry32) so SSR and the first client render agree. */
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

const SEED = 0x5eed0f17;

// ── Geometry (matches the SVG viewBox) ───────────────────────────────────────
const W = 220;
const H = 132;
const PAD = 6;
const R = 2.4; // particle radius
const MINX = PAD + R;
const MAXX = W - PAD - R;
const MIDX = W / 2;
const MINY = PAD + R;
const MAXY = H - PAD - R;
const SPEED = 0.9; // world units / step
const MAX_HISTORY = 360; // frames kept for the rewind buffer

const clampInt = (n: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, Math.round(n)));

/** A single particle: position + velocity in world units. */
interface P {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

/**
 * Seed `n` particles bunched in the LEFT half of the box (the low-entropy start),
 * each with a random heading. Deterministic given the seed.
 */
function seedParticles(n: number, rng: () => number): P[] {
  return Array.from({ length: n }, () => {
    const angle = rng() * Math.PI * 2;
    return {
      x: MINX + rng() * (MIDX - MINX),
      y: MINY + rng() * (MAXY - MINY),
      vx: Math.cos(angle) * SPEED,
      vy: Math.sin(angle) * SPEED,
    };
  });
}

/** Advance one particle by a step, reflecting off the four walls (deterministic
 *  ballistic motion — so a recorded run replays exactly in reverse). */
function stepParticle(p: P): void {
  p.x += p.vx;
  p.y += p.vy;
  if (p.x < MINX) {
    p.x = MINX + (MINX - p.x);
    p.vx = -p.vx;
  } else if (p.x > MAXX) {
    p.x = MAXX - (p.x - MAXX);
    p.vx = -p.vx;
  }
  if (p.y < MINY) {
    p.y = MINY + (MINY - p.y);
    p.vy = -p.vy;
  } else if (p.y > MAXY) {
    p.y = MAXY - (p.y - MAXY);
    p.vy = -p.vy;
  }
}

/** Log-factorial table up to `n`, so ln C(n,k) never overflows. */
function logFactTable(n: number): Float64Array {
  const t = new Float64Array(n + 1);
  for (let i = 2; i <= n; i += 1) t[i] = t[i - 1] + Math.log(i);
  return t;
}

/**
 * Format the odds of the gas spontaneously returning to the all-on-the-left
 * start: probability 2^(−N), reported as "1 in 2^N". Small N gives a plain
 * integer; large N an order-of-magnitude ("10^36").
 */
function formatOdds(n: number): string {
  const exp10 = n * Math.log10(2);
  if (exp10 < 6) return String(Math.round(2 ** n));
  return `10^${Math.round(exp10)}`;
}

/**
 * **Entropy in a box** — a free-expansion / diffusion sandbox that makes the
 * second law a *counting* fact you can watch. Every particle starts bunched in
 * the left half (a tidy, low-entropy macrostate) and then drifts under plain
 * reversible motion. Almost immediately the gas fills the whole box: not because
 * anything pushes it, but because there are astronomically more arrangements
 * spread across both halves than crammed into one, so "spread out" is simply the
 * overwhelmingly probable state.
 *
 * The entropy bar tracks `S = ln W`, where `W = C(N, nLeft)` is the number of
 * microstates (ways to place the particles) consistent with the current
 * left/right split — maximal at a 50/50 split. The "return-to-start" stat shows
 * `2^(−N)`, the vanishing chance the gas re-bunches on the left by itself; push
 * the particle slider up and watch irreversibility *sharpen* as N grows.
 *
 * The **Rewind** button replays the recorded run backwards — the gas visibly
 * re-collects on the left and entropy falls. That backward film breaks no law of
 * motion, which is the whole puzzle of the arrow of time: it is allowed, yet you
 * never see it happen, because the odds are 1 in 2^N.
 *
 * For performance the particles live in a `useRef` and the rAF loop mutates each
 * SVG circle's position directly; React renders the circles once. Under
 * `prefers-reduced-motion` the loop never starts — the box is drawn already
 * mixed with the equilibrium readout.
 */
export function EntropyBox({
  title,
  eyebrow = 'Entropy lab',
  instructions = 'Every particle starts crammed into the left half, then just drifts. Watch it fill the whole box — not because anything pushes it, but because "spread out" is overwhelmingly the most likely arrangement. Push the particle count up to see how much harder it becomes to ever run backwards.',
  caption,
  initialCount = 60,
  minCount = 8,
  maxCount = 240,
  countLabel = 'Number of particles (N)',
  playLabel = 'Play ▸',
  pauseLabel = 'Pause',
  rewindLabel = 'Rewind ⏪',
  resetLabel = 'Reset',
  entropyLabel = 'Entropy  S = ln W',
  splitLabel = 'Split',
  leftWord = 'left',
  rightWord = 'right',
  oddsLabel = 'Odds of returning to the start (all on the left)',
  readoutTemplate = '{left} on the {leftWord}, {right} on the {rightWord}. Entropy is {pct}% of its maximum. Chance of spontaneously re-bunching on the left: 1 in {odds}.',
  oddsPrefix = '1 in ',
  reducedMotionNote = 'Motion is off, so the box is shown already mixed — the high-entropy state the gas spends essentially all its time in.',
  className,
}: EntropyBoxProps) {
  const reactId = useId();

  const [count, setCount] = useState(() => clampInt(initialCount, minCount, maxCount));
  const [playing, setPlaying] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  // Live macrostate mirrored into React only for the (rarely-updating) readout.
  const [nLeft, setNLeft] = useState(count);

  const particlesRef = useRef<P[]>([]);
  const circleRefs = useRef<Array<SVGCircleElement | null>>([]);
  const historyRef = useRef<Float32Array[]>([]);
  const rafRef = useRef<number | null>(null);
  // 'forward' plays the simulation; 'rewind' replays history backwards.
  const modeRef = useRef<'forward' | 'rewind'>('forward');
  // Throttle the React readout so we don't setState every single frame.
  const frameRef = useRef(0);

  const logFact = useMemo(() => logFactTable(maxCount), [maxCount]);

  /** ln C(N, k) via the log-factorial table. */
  const lnChoose = (nn: number, k: number) =>
    logFact[nn] - logFact[k] - logFact[nn - k];

  const sMax = useMemo(
    () => lnChoose(count, Math.floor(count / 2)) || 1,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [count],
  );

  const oddsText = useMemo(() => formatOdds(count), [count]);

  /** Count how many particles sit in the left half right now. */
  const countLeft = (ps: P[]) => {
    let c = 0;
    for (let i = 0; i < ps.length; i += 1) if (ps[i].x < MIDX) c += 1;
    return c;
  };

  /** Paint every circle from the current particle positions. */
  const paint = () => {
    const ps = particlesRef.current;
    for (let i = 0; i < ps.length; i += 1) {
      const el = circleRefs.current[i];
      if (el) {
        el.setAttribute('cx', ps[i].x.toFixed(2));
        el.setAttribute('cy', ps[i].y.toFixed(2));
      }
    }
  };

  /** Deterministic initial layout — identical on SSR and first client render. */
  const initialPositions = useMemo(() => {
    const ps = seedParticles(count, mulberry32(SEED));
    particlesRef.current = ps.map((p) => ({ ...p }));
    historyRef.current = [];
    return ps.map((p) => ({ x: p.x, y: p.y }));
  }, [count]);

  // Detect reduced motion; when set, snap to a mixed static frame.
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');

    const settleStatic = () => {
      const ps = seedParticles(count, mulberry32(SEED));
      for (let s = 0; s < 400; s += 1) for (let i = 0; i < ps.length; i += 1) stepParticle(ps[i]);
      particlesRef.current = ps;
      historyRef.current = [];
      paint();
      setNLeft(countLeft(ps));
    };

    const apply = (reduced: boolean) => {
      setReducedMotion(reduced);
      if (reduced) {
        if (rafRef.current !== null) {
          cancelAnimationFrame(rafRef.current);
          rafRef.current = null;
        }
        setPlaying(false);
        settleStatic();
      }
    };

    apply(mq.matches);
    const onChange = (e: MediaQueryListEvent) => apply(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count]);

  // The animation loop. Restarts only when `playing` flips.
  useEffect(() => {
    if (!playing || reducedMotion) return;

    const tick = () => {
      const ps = particlesRef.current;
      if (modeRef.current === 'rewind') {
        const hist = historyRef.current;
        hist.pop(); // discard the frame we're currently showing
        const frame = hist[hist.length - 1];
        if (!frame) {
          // Back at the tidy start — stop.
          setPlaying(false);
          rafRef.current = null;
          return;
        }
        for (let i = 0; i < ps.length; i += 1) {
          ps[i].x = frame[i * 2];
          ps[i].y = frame[i * 2 + 1];
        }
      } else {
        for (let i = 0; i < ps.length; i += 1) stepParticle(ps[i]);
        // Record this frame for the rewind buffer (bounded).
        const snap = new Float32Array(ps.length * 2);
        for (let i = 0; i < ps.length; i += 1) {
          snap[i * 2] = ps[i].x;
          snap[i * 2 + 1] = ps[i].y;
        }
        const hist = historyRef.current;
        hist.push(snap);
        if (hist.length > MAX_HISTORY) hist.shift();
      }

      paint();

      // Update the React readout a few times a second, not every frame.
      frameRef.current += 1;
      if (frameRef.current % 6 === 0) setNLeft(countLeft(ps));

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [playing, reducedMotion]);

  const play = () => {
    modeRef.current = 'forward';
    setPlaying(true);
  };
  const pause = () => setPlaying(false);
  const rewind = () => {
    if (historyRef.current.length < 2) return;
    modeRef.current = 'rewind';
    setPlaying(true);
  };
  const reset = () => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    setPlaying(false);
    modeRef.current = 'forward';
    const ps = seedParticles(count, mulberry32(SEED));
    particlesRef.current = ps;
    historyRef.current = [];
    if (reducedMotion) {
      for (let s = 0; s < 400; s += 1) for (let i = 0; i < ps.length; i += 1) stepParticle(ps[i]);
    }
    paint();
    setNLeft(countLeft(ps));
  };

  const nRight = count - nLeft;
  const sNow = lnChoose(count, Math.min(Math.max(nLeft, 0), count));
  const pct = Math.max(0, Math.min(100, Math.round((sNow / sMax) * 100)));

  const readout = readoutTemplate
    .replace('{left}', String(nLeft))
    .replace('{right}', String(nRight))
    .replace('{leftWord}', leftWord)
    .replace('{rightWord}', rightWord)
    .replace('{pct}', String(pct))
    .replace('{odds}', oddsText);

  // Build the circles ONCE; the rAF loop moves them via setAttribute.
  const circles = useMemo(
    () =>
      initialPositions.map((p, i) => (
        <circle
          key={`${reactId}-p-${i}`}
          cx={p.x}
          cy={p.y}
          r={R}
          fill="var(--color-accent-500)"
          ref={(el) => {
            circleRefs.current[i] = el;
          }}
        />
      )),
    [initialPositions, reactId],
  );

  const canRewind = !reducedMotion && historyRef.current.length >= 2;

  return (
    <figure className={cx('brutal my-6 bg-surface p-5 sm:p-6', className)}>
      <p className="font-display text-xs font-semibold uppercase tracking-wide text-accent-600">
        {eyebrow}
      </p>
      {title ? (
        <p className="mt-1 font-display text-lg font-semibold text-ink-900">{title}</p>
      ) : null}

      <p className="mt-2 text-sm font-medium text-ink-700">{instructions}</p>

      {/* The box. Decorative — the meaning lives in the live readout below. */}
      <div className="mt-4 overflow-hidden rounded-card ring-1 ring-inset ring-ink-200 bg-surface-sunken">
        <svg
          aria-hidden
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="xMidYMid meet"
          className="block w-full"
        >
          <rect x="0" y="0" width={W} height={H} fill="var(--color-surface-sunken)" />
          {/* Faint tint on the left half — the starting chamber. */}
          <rect
            x={PAD}
            y={PAD}
            width={MIDX - PAD}
            height={H - 2 * PAD}
            fill="var(--color-accent-500)"
            opacity="0.06"
          />
          {/* The dividing line down the middle. */}
          <line
            x1={MIDX}
            y1={PAD}
            x2={MIDX}
            y2={H - PAD}
            stroke="var(--color-ink-300)"
            strokeWidth="1"
            strokeDasharray="3 3"
          />
          {/* Box frame. */}
          <rect
            x={PAD}
            y={PAD}
            width={W - 2 * PAD}
            height={H - 2 * PAD}
            fill="none"
            stroke="var(--color-ink-300)"
            strokeWidth="1.5"
          />
          {circles}
        </svg>
      </div>

      {/* Entropy bar */}
      <div className="mt-4">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-[0.65rem] font-bold uppercase tracking-wide text-ink-600">
            {entropyLabel}
          </p>
          <p className="text-sm font-semibold tabular-nums text-accent-600">{pct}%</p>
        </div>
        <div className="mt-1 h-2.5 w-full overflow-hidden rounded-pill bg-ink-100">
          <div
            className="h-full rounded-pill bg-accent-500 transition-[width] duration-200 ease-out motion-reduce:transition-none"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Split + odds stats */}
      <dl className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-card border border-ink-200 bg-surface p-3">
          <dt className="text-xs text-ink-500">{splitLabel}</dt>
          <dd className="mt-0.5 font-semibold tabular-nums text-ink-800">
            {nLeft} {leftWord} · {nRight} {rightWord}
          </dd>
        </div>
        <div className="rounded-card border border-accent-300 bg-accent-300/20 p-3">
          <dt className="text-xs text-ink-500">{oddsLabel}</dt>
          <dd className="mt-0.5 font-semibold tabular-nums text-accent-600">
            {oddsPrefix}
            {oddsText}
          </dd>
        </div>
      </dl>

      {/* Live readout */}
      <p aria-live="polite" className="mt-3 text-sm leading-relaxed text-ink-700">
        {readout}
      </p>

      {/* Controls */}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        {reducedMotion ? (
          <p className="text-sm font-medium text-ink-600">{reducedMotionNote}</p>
        ) : (
          <>
            <button
              type="button"
              onClick={() => (playing && modeRef.current === 'forward' ? pause() : play())}
              aria-pressed={playing && modeRef.current === 'forward'}
              className="brutal-btn bg-accent-500 px-4 py-2 font-display text-sm text-white"
            >
              {playing && modeRef.current === 'forward' ? pauseLabel : playLabel}
            </button>
            <button
              type="button"
              onClick={rewind}
              disabled={!canRewind}
              className={cx(
                'inline-flex items-center rounded-pill px-3 py-2 font-display text-sm font-semibold ring-1 ring-inset transition-colors motion-reduce:transition-none',
                canRewind
                  ? 'text-ink-700 ring-ink-300 hover:bg-surface-sunken'
                  : 'cursor-not-allowed text-ink-300 ring-ink-100',
              )}
            >
              {rewindLabel}
            </button>
          </>
        )}
        <button
          type="button"
          onClick={reset}
          className="inline-flex items-center rounded-pill px-3 py-2 font-display text-sm font-semibold text-ink-600 ring-1 ring-inset ring-ink-300 transition-colors hover:bg-surface-sunken motion-reduce:transition-none"
        >
          {resetLabel}
        </button>
      </div>

      {/* Particle-count slider */}
      <div className="mt-4">
        <label
          htmlFor={`${reactId}-count`}
          className="flex items-baseline justify-between gap-2 text-[0.65rem] font-bold uppercase tracking-wide text-ink-600"
        >
          <span>{countLabel}</span>
          <span className="text-sm font-semibold tabular-nums text-ink-800">{count}</span>
        </label>
        <input
          id={`${reactId}-count`}
          type="range"
          min={minCount}
          max={maxCount}
          step={1}
          value={count}
          onChange={(e) => {
            const next = clampInt(Number(e.target.value), minCount, maxCount);
            setCount(next);
            setNLeft(next);
            setPlaying(false);
            modeRef.current = 'forward';
          }}
          aria-valuetext={String(count)}
          className="mt-1 h-1.5 w-full cursor-pointer accent-accent-500"
        />
      </div>

      {caption ? <figcaption className="mt-3 text-sm text-ink-500">{caption}</figcaption> : null}
    </figure>
  );
}

export default EntropyBox;
