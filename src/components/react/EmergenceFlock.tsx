import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { cx } from '@/components/react/cx';

/** Props for the {@link EmergenceFlock} island. */
export interface EmergenceFlockProps {
  /** Number of boids in the flock. Defaults to `60`. */
  count?: number;
  /**
   * Starting **separation** weight (0–100): steer away from very close
   * neighbours so boids don't pile up. Defaults to `50`.
   */
  initialSeparation?: number;
  /**
   * Starting **alignment** weight (0–100): match the average heading of nearby
   * boids. Defaults to `50`.
   */
  initialAlignment?: number;
  /**
   * Starting **cohesion** weight (0–100): steer toward the local centre of mass.
   * Defaults to `40`.
   */
  initialCohesion?: number;
  /** Heading above the card. */
  title?: string;
  /** Eyebrow label. Defaults to `'Three rules, one flock'`. */
  eyebrow?: string;
  /** Instruction line above the animation. */
  instructions?: string;
  /** Caption beneath the card. */
  caption?: string;
  /** Label for the separation slider. Defaults to `'Separation'`. */
  separationLabel?: string;
  /** Label for the alignment slider. Defaults to `'Alignment'`. */
  alignmentLabel?: string;
  /** Label for the cohesion slider. Defaults to `'Cohesion'`. */
  cohesionLabel?: string;
  /** Text on the play button. Defaults to `'Play ▸'`. */
  playLabel?: string;
  /** Text on the pause button. Defaults to `'Pause'`. */
  pauseLabel?: string;
  /** Text on the reset button. Defaults to `'Reset'`. */
  resetLabel?: string;
  /**
   * Live readout template. `{sep}`, `{align}` and `{cohere}` are replaced with
   * the current slider values. Defaults to a sentence naming all three.
   */
  readoutTemplate?: string;
  /**
   * Short note shown in place of the Play button when the visitor prefers
   * reduced motion (the flock is rendered as a settled, static snapshot).
   */
  reducedMotionNote?: string;
  /** Extra classes merged onto the root element. */
  className?: string;
}

/** A deterministic PRNG (mulberry32) so the server and client agree on the
 *  initial flock — no hydration flicker. No `Math.random()` / `Date.now()`. */
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

const SEED = 0xb01d5eed;

/** The simulation runs in a 100×100 toroidal world (matches the SVG viewBox). */
const WORLD = 100;
/** A boid only "sees" neighbours within this radius (world units). */
const NEIGHBOR_RADIUS = 16;
/** Below this distance a boid actively pushes away from a neighbour. */
const SEPARATION_RADIUS = 6;
/** Speed cap so the flock cruises rather than teleports (world units / step). */
const MAX_SPEED = 0.9;
/** Minimum speed so boids never freeze mid-flight. */
const MIN_SPEED = 0.35;

/** A single boid: position and velocity in world units. */
interface Boid {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

/** Build a fresh, deterministic flock: scattered positions, random headings. */
function seedFlock(count: number, rng: () => number): Boid[] {
  return Array.from({ length: count }, () => {
    const angle = rng() * Math.PI * 2;
    const speed = MIN_SPEED + rng() * (MAX_SPEED - MIN_SPEED);
    return {
      x: rng() * WORLD,
      y: rng() * WORLD,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
    };
  });
}

/** Wrap a coordinate into [0, WORLD) — the world is a torus, so edges connect. */
function wrap(v: number): number {
  if (v < 0) return v + WORLD;
  if (v >= WORLD) return v - WORLD;
  return v;
}

/**
 * Advance the flock by one step, **mutating in place**. Each boid applies the
 * three classic Reynolds rules within its neighbour radius, weighted by the
 * slider values (0–100, scaled to gentle internal coefficients), then its speed
 * is clamped and its position wrapped around the torus.
 */
function step(boids: Boid[], sep: number, align: number, cohere: number): void {
  // Scale the 0–100 sliders to small per-step steering coefficients.
  const wSep = (sep / 100) * 0.06;
  const wAlign = (align / 100) * 0.08;
  const wCohere = (cohere / 100) * 0.006;

  const n = boids.length;
  for (let i = 0; i < n; i += 1) {
    const b = boids[i];

    // Accumulators for the three rules.
    let sepX = 0;
    let sepY = 0; // separation: away from too-close neighbours
    let avgVX = 0;
    let avgVY = 0; // alignment: average neighbour velocity
    let cX = 0;
    let cY = 0; // cohesion: average neighbour position
    let neighbors = 0;

    for (let j = 0; j < n; j += 1) {
      if (j === i) continue;
      const o = boids[j];

      // Shortest separation on a torus: consider the wrapped delta too.
      let dx = o.x - b.x;
      let dy = o.y - b.y;
      if (dx > WORLD / 2) dx -= WORLD;
      else if (dx < -WORLD / 2) dx += WORLD;
      if (dy > WORLD / 2) dy -= WORLD;
      else if (dy < -WORLD / 2) dy += WORLD;

      const distSq = dx * dx + dy * dy;
      if (distSq > NEIGHBOR_RADIUS * NEIGHBOR_RADIUS) continue;

      neighbors += 1;
      avgVX += o.vx;
      avgVY += o.vy;
      cX += dx;
      cY += dy;

      if (distSq < SEPARATION_RADIUS * SEPARATION_RADIUS && distSq > 1e-6) {
        // Push away, weighted by closeness (stronger the nearer they are).
        const dist = Math.sqrt(distSq);
        sepX -= dx / dist / dist;
        sepY -= dy / dist / dist;
      }
    }

    if (neighbors > 0) {
      // Alignment: nudge velocity toward the neighbours' average heading.
      avgVX /= neighbors;
      avgVY /= neighbors;
      b.vx += (avgVX - b.vx) * wAlign;
      b.vy += (avgVY - b.vy) * wAlign;

      // Cohesion: steer toward the local centre of mass (relative offset).
      cX /= neighbors;
      cY /= neighbors;
      b.vx += cX * wCohere;
      b.vy += cY * wCohere;
    }

    // Separation: apply the accumulated "get out of my space" push.
    b.vx += sepX * wSep;
    b.vy += sepY * wSep;

    // Clamp speed into [MIN_SPEED, MAX_SPEED] so the flock cruises steadily.
    const speed = Math.hypot(b.vx, b.vy);
    if (speed > MAX_SPEED) {
      b.vx = (b.vx / speed) * MAX_SPEED;
      b.vy = (b.vy / speed) * MAX_SPEED;
    } else if (speed < MIN_SPEED && speed > 1e-6) {
      b.vx = (b.vx / speed) * MIN_SPEED;
      b.vy = (b.vy / speed) * MIN_SPEED;
    }

    // Integrate position and wrap around the torus.
    b.x = wrap(b.x + b.vx);
    b.y = wrap(b.y + b.vy);
  }
}

/** The SVG transform that poses one boid triangle at its position + heading. */
function poseFor(b: Boid): string {
  const deg = (Math.atan2(b.vy, b.vx) * 180) / Math.PI;
  return `translate(${b.x.toFixed(2)} ${b.y.toFixed(2)}) rotate(${deg.toFixed(1)})`;
}

const clamp100 = (n: number) => Math.max(0, Math.min(100, n));

/**
 * **Boids-style flocking** — the classic proof that three simple *local* rules,
 * each boid obeying only its near neighbours, add up to a coordinated flock that
 * *no boid is steering*.
 *
 * Every boid follows the same three rules within a small neighbour radius:
 * **separation** (don't crowd the boid next to you), **alignment** (head the way
 * your neighbours are heading) and **cohesion** (drift toward the middle of your
 * little cluster). Tune each rule with its slider and watch the macro-pattern
 * change: crank separation and the flock loosens into a spray; crank cohesion and
 * it clumps; balance all three and you get those rolling, leaderless murmurations.
 * There is no flock-leader variable anywhere in the code — the coordination is
 * *emergent*, a macro-pattern produced entirely by repeated micro-rules.
 *
 * For performance the flock lives in a `useRef` and the rAF loop mutates each
 * SVG triangle's `transform` directly — React renders the triangles **once**, the
 * loop just moves them, so there's no per-frame React state churn.
 *
 * The `<svg>` is decorative (`aria-hidden`); the meaning lives in the
 * `aria-live` readout naming the active rule weights. Under
 * `prefers-reduced-motion` the loop never starts: the flock is pre-settled with a
 * burst of synchronous steps and drawn as a single static, already-flocked frame,
 * with a short note in place of the Play button. Fully keyboard-operable.
 */
export function EmergenceFlock({
  count = 60,
  initialSeparation = 50,
  initialAlignment = 50,
  initialCohesion = 40,
  title,
  eyebrow = 'Three rules, one flock',
  instructions = "Every dot obeys the same three local rules — and nobody's in charge. Tune separation, alignment and cohesion, then watch a coordinated flock fall out of the rules with no leader anywhere.",
  caption,
  separationLabel = 'Separation',
  alignmentLabel = 'Alignment',
  cohesionLabel = 'Cohesion',
  playLabel = 'Play ▸',
  pauseLabel = 'Pause',
  resetLabel = 'Reset',
  readoutTemplate = 'Separation {sep}, alignment {align}, cohesion {cohere} — three local rules, one flock with no leader.',
  reducedMotionNote = 'Motion is off, so the flock is shown already settled. Use the sliders to read how the three rules combine.',
  className,
}: EmergenceFlockProps) {
  if (!Number.isFinite(count) || count < 4) {
    throw new Error('EmergenceFlock: `count` must be at least 4.');
  }

  const reactId = useId();

  // Slider state (these *do* live in React — they change rarely, not per frame).
  const [separation, setSeparation] = useState(() => clamp100(initialSeparation));
  const [alignment, setAlignment] = useState(() => clamp100(initialAlignment));
  const [cohesion, setCohesion] = useState(() => clamp100(initialCohesion));
  const [playing, setPlaying] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  // The live flock — never stored in React state (would re-render every frame).
  const boidsRef = useRef<Boid[]>([]);
  // The SVG <polygon> elements, collected by index for direct mutation.
  const shapeRefs = useRef<Array<SVGPolygonElement | null>>([]);
  // The animation handle, so we can cancel cleanly on unmount / pause.
  const rafRef = useRef<number | null>(null);
  // Latest slider values, mirrored into a ref so the rAF loop reads fresh
  // numbers without being torn down and recreated on every slider change.
  const weightsRef = useRef({ separation, alignment, cohesion });
  weightsRef.current = { separation, alignment, cohesion };

  /**
   * The deterministic initial flock, plus its static "first frame" transforms.
   * Computed in `useMemo` so SSR and the first client render produce identical
   * DOM (the boids are seeded from a constant seed) — no hydration mismatch.
   */
  const initialPoses = useMemo(() => {
    const flock = seedFlock(count, mulberry32(SEED));
    boidsRef.current = flock.map((b) => ({ ...b }));
    return flock.map(poseFor);
  }, [count]);

  // Detect prefers-reduced-motion on the client (never during SSR). When set,
  // pre-settle the flock with a burst of synchronous steps and draw that one
  // static frame; the loop is never started.
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');

    const settleStatic = () => {
      const flock = seedFlock(count, mulberry32(SEED));
      const w = weightsRef.current;
      for (let s = 0; s < 200; s += 1) {
        step(flock, w.separation, w.alignment, w.cohesion);
      }
      boidsRef.current = flock;
      for (let i = 0; i < flock.length; i += 1) {
        shapeRefs.current[i]?.setAttribute('transform', poseFor(flock[i]));
      }
    };

    const apply = (reduced: boolean) => {
      setReducedMotion(reduced);
      if (reduced) {
        // Stop any running loop and snap to a settled static flock.
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
    // `count` reseeds the static snapshot; weights are read via the ref.
  }, [count]);

  // Drive the animation. The effect (re)starts only when `playing` flips —
  // slider tweaks flow through `weightsRef`, so the loop is never recreated for
  // them. The loop mutates SVG transforms directly; no React state per frame.
  useEffect(() => {
    if (!playing || reducedMotion) return;

    const tick = () => {
      const w = weightsRef.current;
      const flock = boidsRef.current;
      step(flock, w.separation, w.alignment, w.cohesion);
      for (let i = 0; i < flock.length; i += 1) {
        shapeRefs.current[i]?.setAttribute('transform', poseFor(flock[i]));
      }
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

  const reset = () => {
    const flock = seedFlock(count, mulberry32(SEED));
    boidsRef.current = flock;
    if (reducedMotion) {
      // Resettle into a static flock immediately.
      const w = weightsRef.current;
      for (let s = 0; s < 200; s += 1) {
        step(flock, w.separation, w.alignment, w.cohesion);
      }
    }
    for (let i = 0; i < flock.length; i += 1) {
      shapeRefs.current[i]?.setAttribute('transform', poseFor(flock[i]));
    }
  };

  const readout = readoutTemplate
    .replace('{sep}', String(separation))
    .replace('{align}', String(alignment))
    .replace('{cohere}', String(cohesion));

  // Build the boid elements ONCE. The rAF loop moves them via setAttribute.
  const boidElements = useMemo(
    () =>
      initialPoses.map((pose, i) => (
        <polygon
          key={`${reactId}-boid-${i}`}
          // A small forward-pointing triangle centred near its origin so the
          // rotate() in the transform spins it about its body.
          points="1.6,0 -1.1,1 -1.1,-1"
          fill="currentColor"
          transform={pose}
          ref={(el) => {
            shapeRefs.current[i] = el;
          }}
        />
      )),
    [initialPoses, reactId],
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

      {/* The flock. Decorative — the meaning lives in the live readout. */}
      <div className="mt-4 overflow-hidden rounded-card ring-1 ring-inset ring-ink-200 bg-surface-sunken">
        <svg
          aria-hidden
          viewBox="0 0 100 100"
          preserveAspectRatio="xMidYMid meet"
          className="block aspect-[4/3] w-full text-accent-500"
        >
          {boidElements}
        </svg>
      </div>

      {/* Live readout */}
      <p aria-live="polite" className="mt-4 font-display text-base font-semibold text-ink-900">
        {readout}
      </p>

      {/* The three rule sliders */}
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <div>
          <label
            htmlFor={`${reactId}-sep`}
            className="text-[0.65rem] font-bold uppercase tracking-wide text-ink-500"
          >
            {separationLabel}
          </label>
          <input
            id={`${reactId}-sep`}
            type="range"
            min={0}
            max={100}
            step={1}
            value={separation}
            onChange={(e) => setSeparation(clamp100(Number(e.target.value)))}
            className="mt-1 h-1.5 w-full cursor-pointer accent-accent-500"
          />
        </div>
        <div>
          <label
            htmlFor={`${reactId}-align`}
            className="text-[0.65rem] font-bold uppercase tracking-wide text-ink-500"
          >
            {alignmentLabel}
          </label>
          <input
            id={`${reactId}-align`}
            type="range"
            min={0}
            max={100}
            step={1}
            value={alignment}
            onChange={(e) => setAlignment(clamp100(Number(e.target.value)))}
            className="mt-1 h-1.5 w-full cursor-pointer accent-accent-500"
          />
        </div>
        <div>
          <label
            htmlFor={`${reactId}-cohere`}
            className="text-[0.65rem] font-bold uppercase tracking-wide text-ink-500"
          >
            {cohesionLabel}
          </label>
          <input
            id={`${reactId}-cohere`}
            type="range"
            min={0}
            max={100}
            step={1}
            value={cohesion}
            onChange={(e) => setCohesion(clamp100(Number(e.target.value)))}
            className="mt-1 h-1.5 w-full cursor-pointer accent-accent-500"
          />
        </div>
      </div>

      {/* Controls */}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        {reducedMotion ? (
          <p className="text-sm font-medium text-ink-600">{reducedMotionNote}</p>
        ) : (
          <button
            type="button"
            onClick={() => setPlaying((p) => !p)}
            aria-pressed={playing}
            className="brutal-btn bg-accent-500 px-4 py-2 font-display text-sm text-white"
          >
            {playing ? pauseLabel : playLabel}
          </button>
        )}
        <button
          type="button"
          onClick={reset}
          className="inline-flex items-center rounded-pill px-3 py-2 font-display text-sm font-semibold text-ink-600 ring-1 ring-inset ring-ink-300 transition-colors hover:bg-surface-sunken motion-reduce:transition-none"
        >
          {resetLabel}
        </button>
      </div>

      {caption ? (
        <figcaption className="mt-3 text-sm text-ink-500">{caption}</figcaption>
      ) : null}
    </figure>
  );
}

export default EmergenceFlock;
