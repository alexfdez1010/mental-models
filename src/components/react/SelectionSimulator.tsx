import { useId, useMemo, useRef, useState } from 'react';
import { cx } from '@/components/react/cx';

/** Props for the {@link SelectionSimulator} island. */
export interface SelectionSimulatorProps {
  /**
   * Population size — drawn as a grid of dots. Keep it a multiple of
   * {@link columns} for a tidy grid. Defaults to 60.
   */
  count?: number;
  /** Dots per row. Defaults to 12. */
  columns?: number;
  /**
   * Starting selection pressure, from `-100` (favours the *light* trait) through
   * `0` (neutral — no selection) to `+100` (favours the *dark* trait). Defaults
   * to `60` so the very first "advance" already shows drift toward dark.
   */
  initialPressure?: number;
  /** Heading above the card. */
  title?: string;
  /** Eyebrow label. Defaults to `'Selection at work'`. */
  eyebrow?: string;
  /** Instruction line above the grid. */
  instructions?: string;
  /** Caption beneath the card. */
  caption?: string;
  /** Label for the selection-pressure slider. Defaults to `'Selection pressure'`. */
  pressureLabel?: string;
  /** Label for the light end of the pressure slider / legend. Defaults to `'Favours light'`. */
  lightLabel?: string;
  /** Label for the dark end of the pressure slider / legend. Defaults to `'Favours dark'`. */
  darkLabel?: string;
  /** Label for the neutral mid-point. Defaults to `'No selection'`. */
  neutralLabel?: string;
  /** Text on the advance-a-generation button. Defaults to `'Advance one generation ▸'`. */
  advanceLabel?: string;
  /** Text on the reset button. Defaults to `'Reset'`. */
  resetLabel?: string;
  /** Word for a generation, used in the readout. Defaults to `'Generation'`. */
  generationLabel?: string;
  /**
   * Live readout template. `{gen}` (generation number), `{mean}` (average trait
   * as a 0–100 number where 0 = lightest, 100 = darkest) and `{dir}` (the active
   * direction word) are replaced.
   */
  readoutTemplate?: string;
  /** Phrase used for `{dir}` when pressure favours dark. Defaults to `'darker'`. */
  towardDarkLabel?: string;
  /** Phrase used for `{dir}` when pressure favours light. Defaults to `'lighter'`. */
  towardLightLabel?: string;
  /** Phrase used for `{dir}` when pressure is neutral. Defaults to `'nowhere — drifting'`. */
  towardNeitherLabel?: string;
  /** Extra classes merged onto the root element. */
  className?: string;
}

/** A deterministic PRNG (mulberry32) so the server and client agree on the
 *  initial population — no hydration flicker. */
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

/** A small Gaussian sample (Box–Muller) for mutation, mean 0, given sd. */
function gaussian(rng: () => number, sd: number): number {
  const u = Math.max(rng(), 1e-9);
  const v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v) * sd;
}

const SEED = 0x5eed1234;

/** Nine design-token shades from lightest → darkest. Mapping the continuous
 *  trait onto real tokens keeps the island on-system (no hardcoded hex). */
const SHADES = [
  'bg-ink-100',
  'bg-ink-200',
  'bg-ink-300',
  'bg-ink-400',
  'bg-ink-500',
  'bg-ink-600',
  'bg-ink-700',
  'bg-ink-800',
  'bg-ink-900',
];

/** Build a fresh, deterministic starting population: traits spread across the
 *  whole [0,1] range so there is genuine *variation* to select on. */
function seedPopulation(count: number, rng: () => number): number[] {
  return Array.from({ length: count }, () => {
    // A broad, slightly central spread — average of two uniforms.
    const t = (rng() + rng()) / 2;
    return Math.min(1, Math.max(0, t));
  });
}

/** One round of selection + reproduction. Parents are sampled in proportion to
 *  their survival probability under the current pressure; each offspring inherits
 *  its parent's trait plus a small heritable mutation. Population size is held
 *  constant, so the *distribution* moves while the count does not. */
function nextGeneration(pop: number[], pressure: number, rng: () => number): number[] {
  const p = pressure / 100; // −1 … +1
  // Survival probability is linear in the trait, tilted by the pressure.
  // p > 0 rewards dark (high trait); p < 0 rewards light (low trait).
  const survival = pop.map((t) => Math.min(0.97, Math.max(0.03, 0.5 + p * (t - 0.5) * 1.6)));
  const totalFit = survival.reduce((s, w) => s + w, 0) || 1;

  return Array.from({ length: pop.length }, () => {
    // Fitness-proportional parent pick (roulette wheel).
    let r = rng() * totalFit;
    let parent = 0;
    for (let i = 0; i < pop.length; i += 1) {
      r -= survival[i];
      if (r <= 0) {
        parent = i;
        break;
      }
    }
    const child = pop[parent] + gaussian(rng, 0.045);
    return Math.min(1, Math.max(0, child));
  });
}

function mean(xs: number[]): number {
  return xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0;
}

/**
 * Interactive **natural-selection simulator** — variation → selection → heredity,
 * running in front of you.
 *
 * A population of beetles varies in colour (each dot's shade is its heritable
 * trait, from light to dark). Set a **selection pressure** — say, dark beetles
 * hide better on dark bark, so light ones get eaten — then press *Advance one
 * generation*: survivors reproduce in proportion to how well the pressure
 * favours them, offspring inherit their parent's shade with a little mutation,
 * and the whole population's average colour creeps toward whatever survives best.
 * Nobody redesigned a beetle; the algorithm did. Flip the pressure and the drift
 * reverses; zero it out and the colour just wanders (random drift) instead of
 * marching. The three ingredients are all on screen: *variation* (the spread of
 * shades), *selection* (the pressure slider) and *heredity* (offspring resemble
 * parents).
 *
 * The grid is decorative for screen readers — the meaning lives in the
 * `aria-live` readout (generation number + average trait + direction). Dot
 * shades transition gently, and instantly under `prefers-reduced-motion`. Fully
 * keyboard-operable (slider + buttons).
 */
export function SelectionSimulator({
  count = 60,
  columns = 12,
  initialPressure = 60,
  title,
  eyebrow = 'Selection at work',
  instructions = 'Each dot is a beetle; its shade is a heritable trait. Set who survives better, then advance generations and watch the population redesign itself — variation, selection, heredity, repeat.',
  caption,
  pressureLabel = 'Selection pressure',
  lightLabel = 'Favours light',
  darkLabel = 'Favours dark',
  neutralLabel = 'No selection',
  advanceLabel = 'Advance one generation ▸',
  resetLabel = 'Reset',
  generationLabel = 'Generation',
  readoutTemplate = '{generation} {gen}: average shade is {mean}/100, trending {dir}.',
  towardDarkLabel = 'darker',
  towardLightLabel = 'lighter',
  towardNeitherLabel = 'nowhere — just drifting',
  className,
}: SelectionSimulatorProps) {
  if (!Number.isFinite(count) || count < 4) {
    throw new Error('SelectionSimulator: `count` must be at least 4.');
  }

  const reactId = useId();
  const clampP = (n: number) => Math.max(-100, Math.min(100, n));

  // A deterministic starting population (seeded) keeps SSR and hydration in sync.
  const initialPop = useMemo(() => seedPopulation(count, mulberry32(SEED)), [count]);
  const [pop, setPop] = useState<number[]>(initialPop);
  const [gen, setGen] = useState(0);
  const [pressure, setPressure] = useState(() => clampP(initialPressure));

  // A live RNG for the stochastic steps — fresh per mount, reseeded on reset.
  const rng = useRef<() => number>(mulberry32(SEED ^ 0x9e3779b9));

  const advance = () => {
    setPop((prev) => nextGeneration(prev, pressure, rng.current));
    setGen((g) => g + 1);
  };
  const reset = () => {
    rng.current = mulberry32(SEED ^ 0x9e3779b9);
    setPop(seedPopulation(count, mulberry32(SEED)));
    setGen(0);
  };

  const avg = mean(pop);
  const meanPct = Math.round(avg * 100);
  const dir =
    pressure > 4 ? towardDarkLabel : pressure < -4 ? towardLightLabel : towardNeitherLabel;
  const readout = readoutTemplate
    .replace('{generation}', generationLabel)
    .replace('{gen}', String(gen))
    .replace('{mean}', String(meanPct))
    .replace('{dir}', dir);

  return (
    <figure className={cx('brutal my-6 bg-surface p-5 sm:p-6', className)}>
      <p className="font-display text-xs font-semibold uppercase tracking-wide text-accent-600">
        {eyebrow}
      </p>
      {title ? (
        <p className="mt-1 font-display text-lg font-semibold text-ink-900">{title}</p>
      ) : null}

      <p className="mt-2 text-sm font-medium text-ink-700">{instructions}</p>

      {/* The population. Decorative — meaning lives in the live readout. */}
      <div
        aria-hidden
        className="mt-4 grid gap-1.5"
        style={{
          gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
          maxWidth: `${columns * 1.85}rem`,
        }}
      >
        {pop.map((t, i) => (
          <span
            key={`${reactId}-dot-${i}`}
            className={cx(
              'aspect-square rounded-full ring-1 ring-inset ring-ink-900/10 transition-colors duration-500 ease-out motion-reduce:transition-none',
              SHADES[Math.min(SHADES.length - 1, Math.floor(t * SHADES.length))],
            )}
          />
        ))}
      </div>

      {/* Distribution bar: light → dark gradient with a marker at the mean. */}
      <div className="mt-4">
        <div className="relative h-3 w-full max-w-sm rounded-pill bg-gradient-to-r from-ink-100 to-ink-900 ring-1 ring-inset ring-ink-200">
          <span
            className="absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface bg-accent-500 shadow-sm transition-[left] duration-500 ease-out motion-reduce:transition-none"
            style={{ left: `${meanPct}%` }}
            aria-hidden
          />
        </div>
        <div className="mt-1 flex max-w-sm justify-between text-[0.65rem] font-semibold uppercase tracking-wide text-ink-500">
          <span>{lightLabel}</span>
          <span>{darkLabel}</span>
        </div>
      </div>

      {/* Live readout */}
      <p aria-live="polite" className="mt-4 font-display text-base font-semibold text-ink-900">
        {readout}
      </p>

      {/* Selection-pressure slider */}
      <div className="mt-3">
        <div className="flex items-center justify-between text-[0.65rem] font-bold uppercase tracking-wide text-ink-500">
          <span>{lightLabel}</span>
          <label htmlFor={`${reactId}-pressure`}>{pressureLabel}</label>
          <span>{darkLabel}</span>
        </div>
        <input
          id={`${reactId}-pressure`}
          type="range"
          min={-100}
          max={100}
          step={1}
          value={pressure}
          onChange={(e) => setPressure(clampP(Number(e.target.value)))}
          aria-valuetext={
            pressure > 4 ? darkLabel : pressure < -4 ? lightLabel : neutralLabel
          }
          className="mt-1 h-1.5 w-full cursor-pointer accent-accent-500"
        />
      </div>

      {/* Controls */}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={advance}
          className="brutal-btn bg-accent-500 px-4 py-2 font-display text-sm text-white"
        >
          {advanceLabel}
        </button>
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

export default SelectionSimulator;
