import { useId, useMemo, useState } from 'react';
import { cx } from '@/components/react/cx';

/**
 * One decision *strategy* the learner can test across many possible worlds.
 *
 * Every strategy is a transparent, piecewise-linear response to a world's
 * **extremity** `e ∈ [−1, +1]` — how far that world lands from "normal":
 * `−1` is the worst catastrophe, `0` is business-as-usual, `+1` is the biggest
 * boom. The outcome in a world is
 *
 *   outcome(e) = clamp( calm + (e ≥ 0 ? upSlope : downSlope) · e , floor , cap )
 *
 * so the four archetypes fall straight out of the numbers: an **optimiser** has
 * a huge upside slope and a huge *un-floored* downside slope (great on average,
 * ruined in the bad tail); a **robust** choice has tiny slopes and a floor above
 * ruin (boring, but it survives every world).
 */
export interface WorldStrategy {
  /** Stable key used for selection state. */
  key: string;
  /** Button label, e.g. `'Optimise'`. */
  label: string;
  /** One-line description shown when the strategy is active. */
  blurb: string;
  /** Outcome in a neutral, business-as-usual world (extremity `e = 0`). */
  calm: number;
  /** Outcome added per unit of *positive* extremity (the boom slope, `e ≥ 0`). */
  upSlope: number;
  /** Outcome added per unit of *negative* extremity (the bust slope, `e < 0`). */
  downSlope: number;
  /** Hard floor on the outcome — the downside cap. Set very low for "uncapped". */
  floor: number;
  /** Optional hard cap on the upside (a strategy that clips its own good tail). */
  cap?: number | null;
}

/** Props for the {@link ManyWorldsExplorer} island. */
export interface ManyWorldsExplorerProps {
  /** Heading above the card. */
  title?: string;
  /** Eyebrow label. Defaults to `'The many-worlds desk'`. */
  eyebrow?: string;
  /** Instruction line above the controls. */
  instructions?: string;
  /** Caption beneath the card. */
  caption?: string;
  /** The strategies to compare (English defaults provided). */
  strategies?: WorldStrategy[];
  /** Label for the turbulence slider. Defaults to `'How turbulent is the future?'`. */
  turbulenceLabel?: string;
  /** Low end of the turbulence slider. Defaults to `'Calm'`. */
  calmEndLabel?: string;
  /** High end of the turbulence slider. Defaults to `'Deep uncertainty'`. */
  wildEndLabel?: string;
  /** Left (catastrophe) axis caption. Defaults to `'Catastrophe worlds'`. */
  bustAxisLabel?: string;
  /** Right (boom) axis caption. Defaults to `'Boom worlds'`. */
  boomAxisLabel?: string;
  /** Ruin-line caption. Defaults to `'Ruin — you are out of the game'`. */
  ruinLabel?: string;
  /** Stat label: mean outcome. Defaults to `'Average outcome'`. */
  meanLabel?: string;
  /** Stat label: worst world. Defaults to `'Worst world'`. */
  worstLabel?: string;
  /** Stat label: worlds survived. Defaults to `'Worlds survived'`. */
  survivedLabel?: string;
  /** Column header for the comparison table's strategy column. Defaults to `'Strategy'`. */
  strategyColLabel?: string;
  /** Outcome value below which a world counts as ruin. Defaults to `-10`. */
  ruinThreshold?: number;
  /**
   * Live readout template. Placeholders: `{strategy}` active label, `{mean}`
   * average outcome, `{worst}` worst-world outcome, `{survived}` count that
   * clear the ruin line, `{total}` world count, `{turbulence}` slider %.
   */
  readoutTemplate?: string;
  /** Extra classes merged onto the root element. */
  className?: string;
}

// ── Geometry ────────────────────────────────────────────────────────────────
const W = 470;
const H = 250;
const PAD_L = 40;
const PAD_R = 14;
const PAD_T = 20;
const PAD_B = 26;
const PLOT_W = W - PAD_L - PAD_R;
const PLOT_H = H - PAD_T - PAD_B;

const N_WORLDS = 21; // odd → one perfectly "normal" world in the middle

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

const DEFAULT_STRATEGIES: WorldStrategy[] = [
  {
    key: 'optimise',
    label: 'Optimise',
    blurb:
      'Bet everything on the single most likely world. Best average by far — and unbounded ruin the moment reality lands in the bad tail.',
    calm: 7,
    upSlope: 13,
    downSlope: 32,
    floor: -40,
    cap: null,
  },
  {
    key: 'hedge',
    label: 'Hedge',
    blurb:
      'Trim both tails: give up some upside to soften the downside. Milder swings, but a severe enough world can still hurt.',
    calm: 4,
    upSlope: 7,
    downSlope: 11,
    floor: -13,
    cap: null,
  },
  {
    key: 'barbell',
    label: 'Barbell',
    blurb:
      'A very safe core plus a small convex bet: a modest, floored downside — and an open upside that *gains* from a wild world.',
    calm: 1,
    upSlope: 11,
    downSlope: 4,
    floor: -3,
    cap: null,
  },
  {
    key: 'robust',
    label: 'Robust',
    blurb:
      'Aim to do acceptably in every world rather than best in one. Never spectacular, never ruined — it always comes home alive.',
    calm: 3,
    upSlope: 2,
    downSlope: 2,
    floor: 0,
    cap: 5,
  },
];

/** Format a signed number, keeping a leading + for gains. */
function signed(n: number, dp = 1): string {
  const r = n.toFixed(dp);
  return n > 0 ? `+${r}` : r;
}

/** Outcome of a strategy in a world of a given extremity `e ∈ [−1,1]`. */
function outcomeOf(s: WorldStrategy, e: number): number {
  const raw = s.calm + (e >= 0 ? s.upSlope : s.downSlope) * e;
  const capped = s.cap == null ? raw : Math.min(raw, s.cap);
  return Math.max(capped, s.floor);
}

/**
 * The spread of possible worlds, ordered catastrophe → boom. `turbulence`
 * 0…100 controls how much probability mass sits in the tails: at 0 every world
 * is compressed toward "normal" (extremity near 0), at 100 the worlds are flung
 * out toward ±1 — the fat-tailed, deep-uncertainty future. Deterministic (no
 * randomness), so the server render and every client render agree.
 */
function buildWorlds(turbulence: number): number[] {
  const t = turbulence / 100;
  // Two dials move with turbulence. `p` shrinks from ~2.4 (calm, mass bunched in
  // the middle) to ~0.6 (wild, mass flung into the tails). `amp` scales how far
  // even the most extreme world can reach: at calm the whole spread is
  // compressed toward "normal" (so no world is ruinous), at deep uncertainty it
  // opens all the way to ±1 (catastrophes and booms become reachable).
  const p = 2.4 - t * 1.8;
  const amp = 0.4 + t * 0.6;
  const worlds: number[] = [];
  for (let i = 0; i < N_WORLDS; i++) {
    const b = (i / (N_WORLDS - 1)) * 2 - 1; // evenly spaced −1…+1
    const e = Math.sign(b) * Math.pow(Math.abs(b), p) * amp;
    worlds.push(e);
  }
  return worlds;
}

interface StratStats {
  mean: number;
  worst: number;
  survived: number;
}

function statsOf(s: WorldStrategy, worlds: number[], ruin: number): StratStats {
  let sum = 0;
  let worst = Infinity;
  let survived = 0;
  for (const e of worlds) {
    const o = outcomeOf(s, e);
    sum += o;
    if (o < worst) worst = o;
    if (o > ruin) survived += 1;
  }
  return { mean: sum / worlds.length, worst, survived };
}

/**
 * **Many-Worlds Explorer** — the expert model for *deciding under deep
 * uncertainty* made tactile. Expected value quietly assumes you know the odds;
 * deep uncertainty is when you do not. So instead of collapsing the future into
 * one probability-weighted number, this island lays out a whole *spread of
 * possible worlds* — most ordinary, a few rare and ruinous — and asks how each
 * strategy fares across all of them.
 *
 * The learner picks a strategy (**optimise / hedge / barbell / robust**) and
 * drags a **turbulence** slider that fattens the tails of the world-spread. The
 * chart draws the chosen strategy's outcome in every world as a bar above or
 * below the zero line, with a dashed **ruin line** and a ✕ on any world where
 * the strategy blows up. The comparison table underneath is the punchline: in a
 * calm future the **optimiser** wins on average, but crank the turbulence and it
 * is the one strategy that gets wiped out, while the **robust** choice trades a
 * little average return for surviving *every* world — and the **barbell**
 * actually gains from the disorder. Robustness over optimality, in a picture.
 *
 * All motion is user-driven (a slider and buttons), so the server render is
 * deterministic and there is nothing autoplaying to fight `prefers-reduced-motion`.
 */
export function ManyWorldsExplorer({
  title,
  eyebrow = 'The many-worlds desk',
  instructions = 'You do not know which world you will get — so judge a strategy by how it does across all of them, not just the likely one. Pick a strategy, then drag the future from calm to deeply uncertain and watch the average, the worst case, and how many worlds it survives.',
  caption,
  strategies = DEFAULT_STRATEGIES,
  turbulenceLabel = 'How turbulent is the future?',
  calmEndLabel = 'Calm',
  wildEndLabel = 'Deep uncertainty',
  bustAxisLabel = 'Catastrophe worlds',
  boomAxisLabel = 'Boom worlds',
  ruinLabel = 'Ruin — you are out of the game',
  meanLabel = 'Average outcome',
  worstLabel = 'Worst world',
  survivedLabel = 'Worlds survived',
  strategyColLabel = 'Strategy',
  ruinThreshold = -10,
  readoutTemplate = 'Across {total} possible worlds, the {strategy} strategy averages {mean}, but its worst world is {worst} and it survives {survived} of {total}. At {turbulence}% turbulence, the highest average is not the same as staying in the game.',
  className,
}: ManyWorldsExplorerProps) {
  const reactId = useId();
  const [activeKey, setActiveKey] = useState(strategies[0]?.key ?? '');
  const [turbulence, setTurbulence] = useState(70);

  const worlds = useMemo(() => buildWorlds(turbulence), [turbulence]);
  const active = strategies.find((s) => s.key === activeKey) ?? strategies[0];

  const allStats = useMemo(
    () => strategies.map((s) => ({ s, st: statsOf(s, worlds, ruinThreshold) })),
    [strategies, worlds, ruinThreshold],
  );
  const activeStats = statsOf(active, worlds, ruinThreshold);

  // Vertical scale: fixed so strategies are comparable as the slider moves.
  // The most extreme reachable magnitude across the default archetypes is ~25.
  const MAG = 26;
  const midY = PAD_T + PLOT_H / 2;
  const scale = (PLOT_H / 2) * 0.9 / MAG;
  const yOf = (v: number) => midY - clamp(v, -MAG, MAG) * scale;
  const ruinY = yOf(ruinThreshold);

  const barW = (PLOT_W / N_WORLDS) * 0.66;

  const readout = readoutTemplate
    .replace('{strategy}', active.label.toLowerCase())
    .replace('{mean}', signed(activeStats.mean))
    .replace('{worst}', signed(activeStats.worst))
    .replace('{survived}', String(activeStats.survived))
    .replace('{total}', String(N_WORLDS))
    .replace('{turbulence}', String(turbulence));

  return (
    <figure className={cx('brutal my-6 bg-surface p-5 sm:p-6', className)}>
      <p className="font-display text-xs font-semibold uppercase tracking-wide text-accent-600">
        {eyebrow}
      </p>
      {title ? (
        <p className="mt-1 font-display text-lg font-semibold text-ink-900">{title}</p>
      ) : null}

      <p className="mt-2 text-sm font-medium text-ink-700">{instructions}</p>

      {/* Strategy presets */}
      <div className="mt-4 flex flex-wrap gap-2">
        {strategies.map((s) => {
          const on = s.key === active.key;
          return (
            <button
              key={s.key}
              type="button"
              aria-pressed={on}
              onClick={() => setActiveKey(s.key)}
              className={cx(
                'brutal-btn px-3 py-1.5 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600',
                on ? 'bg-brand-600 text-white' : 'bg-surface text-ink-700',
              )}
            >
              {s.label}
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-sm italic text-ink-500">{active.blurb}</p>

      {/* Many-worlds chart */}
      <div className="mt-4 overflow-hidden rounded-card border border-ink-100 bg-surface-sunken">
        <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={readout}>
          <rect x="0" y="0" width={W} height={H} fill="var(--color-surface-sunken)" />

          {/* Zero line */}
          <line x1={PAD_L} y1={midY} x2={PAD_L + PLOT_W} y2={midY} stroke="var(--color-ink-400)" strokeWidth="1.5" />
          <text x={PAD_L - 6} y={midY + 3} textAnchor="end" fontSize="10" fill="var(--color-ink-500)">0</text>

          {/* Axis captions */}
          <text x={PAD_L + 2} y={H - 8} fontSize="10" fill="var(--color-accent-700)">{bustAxisLabel}</text>
          <text x={PAD_L + PLOT_W - 2} y={H - 8} textAnchor="end" fontSize="10" fill="var(--color-brand-700)">{boomAxisLabel}</text>

          {/* Ruin line */}
          <line x1={PAD_L} y1={ruinY} x2={PAD_L + PLOT_W} y2={ruinY} stroke="var(--color-accent-600)" strokeWidth="1.5" strokeDasharray="5 3" />
          <text x={PAD_L + PLOT_W - 2} y={ruinY - 4} textAnchor="end" fontSize="9.5" fontWeight="600" fill="var(--color-accent-700)">{ruinLabel}</text>

          {/* World bars for the active strategy */}
          {worlds.map((e, i) => {
            const o = outcomeOf(active, e);
            const x = PAD_L + (i + 0.5) * (PLOT_W / N_WORLDS) - barW / 2;
            const y = yOf(o);
            const h = Math.max(1, Math.abs(y - midY));
            const gain = o >= 0;
            const ruined = o <= ruinThreshold;
            const fill = ruined
              ? 'var(--color-accent-600)'
              : gain
                ? 'var(--color-brand-400)'
                : 'var(--color-accent-400)';
            return (
              <g key={i}>
                <rect x={x} y={gain ? y : midY} width={barW} height={h} rx="1.5" fill={fill} />
                {ruined ? (
                  <text x={x + barW / 2} y={ruinY + 12} textAnchor="middle" fontSize="10" fontWeight="700" fill="var(--color-accent-700)">✕</text>
                ) : null}
              </g>
            );
          })}
        </svg>
      </div>

      {/* Live readout */}
      <p
        aria-live="polite"
        className="mt-4 rounded-card border border-accent-300 bg-accent-300/20 p-3 text-sm leading-relaxed text-ink-700"
      >
        {readout}
      </p>

      {/* Active-strategy stat grid */}
      <dl className="mt-4 grid grid-cols-3 gap-3">
        {[
          { k: meanLabel, v: signed(activeStats.mean) },
          { k: worstLabel, v: signed(activeStats.worst) },
          { k: survivedLabel, v: `${activeStats.survived}/${N_WORLDS}` },
        ].map((s, i) => (
          <div key={i} className="rounded-card border border-ink-100 bg-surface-sunken p-2.5 text-center">
            <dt className="text-[0.6rem] font-bold uppercase tracking-wide text-ink-500">{s.k}</dt>
            <dd className="mt-0.5 font-mono text-base font-semibold text-ink-900">{s.v}</dd>
          </div>
        ))}
      </dl>

      {/* Turbulence slider */}
      <div className="mt-5">
        <label htmlFor={`${reactId}-turb`} className="text-[0.65rem] font-bold uppercase tracking-wide text-ink-500">
          {turbulenceLabel}: {turbulence}%
        </label>
        <input
          id={`${reactId}-turb`}
          type="range"
          min={0}
          max={100}
          step={1}
          value={turbulence}
          onChange={(e) => setTurbulence(Number(e.target.value))}
          className="mt-1 h-1.5 w-full cursor-pointer accent-brand-600"
        />
        <div className="mt-1 flex justify-between text-[0.6rem] font-semibold uppercase tracking-wide text-ink-400">
          <span>{calmEndLabel}</span>
          <span>{wildEndLabel}</span>
        </div>
      </div>

      {/* All-strategies comparison table */}
      <div className="mt-5 overflow-hidden rounded-card border border-ink-100">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-surface-sunken text-[0.6rem] uppercase tracking-wide text-ink-500">
              <th className="px-3 py-2 text-left font-bold">{strategyColLabel}</th>
              <th className="px-3 py-2 text-right font-bold">{meanLabel}</th>
              <th className="px-3 py-2 text-right font-bold">{worstLabel}</th>
              <th className="px-3 py-2 text-right font-bold">{survivedLabel}</th>
            </tr>
          </thead>
          <tbody>
            {allStats.map(({ s, st }) => {
              const on = s.key === active.key;
              const ruinedAny = st.survived < N_WORLDS;
              return (
                <tr
                  key={s.key}
                  className={cx('border-t border-ink-100', on ? 'bg-brand-400/10' : 'bg-surface')}
                >
                  <td className="px-3 py-2 font-semibold text-ink-800">{s.label}</td>
                  <td className="px-3 py-2 text-right font-mono text-ink-700">{signed(st.mean)}</td>
                  <td className="px-3 py-2 text-right font-mono text-ink-700">{signed(st.worst)}</td>
                  <td
                    className={cx(
                      'px-3 py-2 text-right font-mono font-semibold',
                      ruinedAny ? 'text-accent-700' : 'text-brand-700',
                    )}
                  >
                    {st.survived}/{N_WORLDS}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {caption ? <figcaption className="mt-3 text-sm text-ink-500">{caption}</figcaption> : null}
    </figure>
  );
}

export default ManyWorldsExplorer;
