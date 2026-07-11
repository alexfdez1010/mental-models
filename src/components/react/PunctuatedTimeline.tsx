import { useId, useMemo, useState } from 'react';
import { cx } from '@/components/react/cx';

/** Props for the {@link PunctuatedTimeline} island. */
export interface PunctuatedTimelineProps {
  /** Heading above the card. */
  title?: string;
  /** Eyebrow label. Defaults to `'Stasis, then lurch'`. */
  eyebrow?: string;
  /** Instruction line above the chart. */
  instructions?: string;
  /** Caption beneath the card. */
  caption?: string;
  /** Axis label for the vertical (trait value) axis. */
  traitAxisLabel?: string;
  /** Axis label for the horizontal (time) axis. */
  timeAxisLabel?: string;
  /** Label over the shock-frequency slider. */
  shockLabel?: string;
  /** Caption on the low (stable) end of the shock slider. */
  shockLowLabel?: string;
  /** Caption on the high (turbulent) end of the shock slider. */
  shockHighLabel?: string;
  /** Label over the constraint / lock-in slider. */
  constraintLabel?: string;
  /** Caption on the low (loose) end of the constraint slider. */
  constraintLowLabel?: string;
  /** Caption on the high (locked-in) end of the constraint slider. */
  constraintHighLabel?: string;
  /** Legend label for the trait line. */
  traitLegendLabel?: string;
  /** Legend label for a punctuation marker. */
  punctuationLegendLabel?: string;
  /** Title above the fitness-landscape inset. */
  insetTitle?: string;
  /** Label floating over the population ball on the landscape inset. */
  ballLabel?: string;
  /** Label for the "old peak" the population sat on. */
  oldPeakLabel?: string;
  /** Label for the "new peak" a punctuation lets it reach. */
  newPeakLabel?: string;
  /**
   * Readout template. `{punctuations}`, `{stasisShare}`, `{longest}`,
   * `{biggest}` and `{verdict}` are replaced.
   */
  readout?: string;
  /** Verdict when long stasis dominates (few, rare punctuations). */
  verdictStasis?: string;
  /** Verdict when the record is a mix of stasis and lurches. */
  verdictPunctuated?: string;
  /** Verdict when shocks are so frequent the lineage barely rests (near-gradual churn). */
  verdictChurn?: string;
  /** Starting shock frequency (0–10). Defaults to 4. */
  initialShock?: number;
  /** Starting constraint strength (0–10). Defaults to 6. */
  initialConstraint?: number;
  /** Extra classes merged onto the root element. */
  className?: string;
}

// ── Geometry (main trait timeline) ───────────────────────────────────────────
const W = 460;
const H = 260;
const PAD_L = 40;
const PAD_R = 14;
const PAD_T = 16;
const PAD_B = 34;
const PLOT_W = W - PAD_L - PAD_R;
const PLOT_H = H - PAD_T - PAD_B;

const T = 40; // horizon, in "time units" (read as e.g. millions of years)
const CANDIDATES = 26; // candidate environmental shocks scanned across the horizon
const RAMP = 0.7; // duration of a punctuation (fast, but not instantaneous)

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const round = (n: number) => Math.round(n);

/** Map a time (0…T) to an SVG x. */
const sx = (t: number) => PAD_L + (t / T) * PLOT_W;
/** Map a trait value (0…100) to an SVG y (trait grows upward). */
const sy = (v: number) => PAD_T + PLOT_H - (clamp(v, 0, 100) / 100) * PLOT_H;

/** Deterministic hash → [0,1). Keeps the timeline stable for a given setting. */
const hash = (n: number) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

interface Punctuation {
  /** Time the lurch starts. */
  t: number;
  /** Trait value before the lurch. */
  from: number;
  /** Trait value after the lurch. */
  to: number;
}

/**
 * Interactive **punctuated-equilibrium** island — change as long stasis snapped
 * by sudden lurches, not a steady drip.
 *
 * The main panel tracks a lineage's **trait value** across a long horizon. Most
 * of the time the line is *flat* — stasis, held in place by stabilising selection
 * and lock-in. Every so often an environmental shock big enough to break the
 * constraint triggers a **punctuation**: the trait ramps fast to a new level,
 * then freezes again. Two dials drive it: **shock frequency** (a stable vs a
 * turbulent environment) and **constraint strength** (how locked-in the lineage
 * is — a higher constraint absorbs bigger shocks, so it needs a rarer, harder hit
 * to move, producing longer stasis and fewer, larger lurches).
 *
 * A **fitness-landscape inset** shows the same story in space: the population sits
 * pinned on a local peak through the stasis, and a punctuation is the moment a
 * shock lets it cross the valley to a higher peak. The readout contrasts the
 * near-zero change during stasis with the burst of change at each punctuation.
 *
 * Both controls are native, keyboard-operable range inputs with visible labels;
 * the readout is announced via `aria-live`; the SVG is static at each setting and
 * the only motion is a cosmetic tween, disabled under `prefers-reduced-motion`.
 */
export function PunctuatedTimeline({
  title,
  eyebrow = 'Stasis, then lurch',
  instructions = 'A lineage’s trait sits almost perfectly still for long stretches, then jumps in a sudden burst when a shock finally breaks its constraints. Set how often the environment shocks it and how locked-in it is, and watch the flat lines punctuated by lurches.',
  caption,
  traitAxisLabel = 'Trait',
  timeAxisLabel = 'Time →',
  shockLabel = 'Shock frequency (stable ↔ turbulent environment)',
  shockLowLabel = 'stable',
  shockHighLabel = 'turbulent',
  constraintLabel = 'Constraint strength (how locked-in the lineage is)',
  constraintLowLabel = 'loose',
  constraintHighLabel = 'locked-in',
  traitLegendLabel = 'Trait value over time',
  punctuationLegendLabel = 'Punctuation (rapid lurch)',
  insetTitle = 'Where it sits: pinned on a peak until a shock lets it cross the valley',
  ballLabel = 'population',
  oldPeakLabel = 'old peak',
  newPeakLabel = 'new peak',
  readout = 'With shocks at {shocks}/10 against a constraint of {constraint}/10: {punctuations} punctuations across the horizon, the trait sits in stasis {stasisShare}% of the time (longest still spell {longest} units), and the biggest single lurch is {biggest} points — {verdict}.',
  verdictStasis = 'almost all stillness, snapped by a rare lurch — the classic punctuated pattern, mostly “nothing happens”',
  verdictPunctuated = 'long equilibria punctuated by fast bursts — stable for ages, then all at once',
  verdictChurn = 'shocks so frequent the lineage barely rests — stasis is breaking down toward near-continuous churn',
  initialShock = 4,
  initialConstraint = 6,
  className,
}: PunctuatedTimelineProps) {
  const reactId = useId();
  const [shock, setShock] = useState(clamp(initialShock, 0, 10));
  const [constraint, setConstraint] = useState(clamp(initialConstraint, 0, 10));

  const model = useMemo(() => {
    // A shock triggers a punctuation only if it is (a) an actual environmental
    // shock (more likely the higher the shock-frequency dial) AND (b) large
    // enough to overcome the lineage's constraint. A stronger constraint raises
    // the bar, so it absorbs more shocks → longer stasis, fewer & bigger lurches.
    const shockGate = shock / 10; // fraction of candidates that are real shocks
    const threshold = 0.12 + constraint * 0.072; // magnitude needed to break stasis

    const puncts: Punctuation[] = [];
    let level = 34 + hash(constraint * 5.5 + 1) * 10; // starting trait value

    for (let i = 1; i < CANDIDATES; i++) {
      const isShock = hash(i * 3.1 + 2) < shockGate;
      if (!isShock) continue;
      const mag = hash(i * 7.3 + 1); // 0…1 shock magnitude
      if (mag <= threshold) continue; // constraint absorbs it — still stasis

      const t = (i / CANDIDATES) * T + (hash(i * 1.7) - 0.5) * (T / CANDIDATES) * 0.6;
      if (t <= 1 || t >= T - 1) continue;

      // The lurch overshoots more when it breaks a bigger constraint. Direction
      // is mostly "up the landscape" (toward a higher peak) but not always.
      const span = (mag - threshold) / (1 - threshold); // 0…1 how far past the bar
      const dir = hash(i * 2.9 + 4) < 0.72 ? 1 : -1;
      const jump = dir * (8 + span * 34);
      const to = clamp(level + jump, 8, 96);
      puncts.push({ t, from: level, to });
      level = to;
    }

    // Build the step-with-fast-ramp trait series.
    const pts: Array<[number, number]> = [[0, puncts.length ? puncts[0].from : level]];
    let cur = puncts.length ? puncts[0].from : level;
    for (const p of puncts) {
      pts.push([p.t, p.from]); // hold flat through stasis up to the lurch
      pts.push([Math.min(p.t + RAMP, T), p.to]); // rapid ramp to new level
      cur = p.to;
    }
    pts.push([T, cur]);

    // Stats. "Stasis" = time not inside a ramp.
    const rampTime = puncts.length * RAMP;
    const stasisShare = clamp(((T - rampTime) / T) * 100, 0, 100);

    // Longest still spell = biggest gap between consecutive lurch starts (and the
    // gaps at the two ends of the horizon).
    const starts = puncts.map((p) => p.t);
    const marks = [0, ...starts, T];
    let longest = 0;
    for (let i = 1; i < marks.length; i++) longest = Math.max(longest, marks[i] - marks[i - 1]);

    const biggest = puncts.reduce((m, p) => Math.max(m, Math.abs(p.to - p.from)), 0);

    let verdict: 'stasis' | 'punctuated' | 'churn';
    if (puncts.length >= 6) verdict = 'churn';
    else if (puncts.length <= 2) verdict = 'stasis';
    else verdict = 'punctuated';

    // Fitness-landscape inset reads off the biggest lurch: old peak height =
    // its `from`, new peak height = its `to`; if none, sit still on one peak.
    const showcase = puncts.length
      ? puncts.reduce((a, b) => (Math.abs(b.to - b.from) > Math.abs(a.to - a.from) ? b : a))
      : { t: T / 2, from: level, to: level };

    return { puncts, pts, stasisShare, longest, biggest, verdict, showcase };
  }, [shock, constraint]);

  const { puncts, pts, stasisShare, longest, biggest, verdict, showcase } = model;

  const traitColor = 'var(--color-brand-500)';
  const punctColor = 'var(--color-accent-500)';

  const linePts = pts.map(([t, v]) => `${round(sx(t))},${round(sy(v))}`).join(' ');

  const verdictWord =
    verdict === 'stasis' ? verdictStasis : verdict === 'churn' ? verdictChurn : verdictPunctuated;

  const readoutText = readout
    .replace('{shocks}', String(shock))
    .replace('{constraint}', String(constraint))
    .replace('{punctuations}', String(puncts.length))
    .replace('{stasisShare}', String(round(stasisShare)))
    .replace('{longest}', String(round(longest)))
    .replace('{biggest}', String(round(biggest)))
    .replace('{verdict}', verdictWord);

  const tween = 'transition-all duration-500 ease-out motion-reduce:transition-none';

  // ── Fitness-landscape inset geometry ──────────────────────────────────────
  const IW = 260;
  const IH = 120;
  const IPAD = 10;
  const IPLOT_W = IW - IPAD * 2;
  const IPLOT_H = IH - IPAD * 2;
  // Two peaks: left "old" peak at height `from`, right "new" peak at height `to`,
  // a valley between them. Normalise heights to the inset.
  const nOld = clamp(showcase.from, 8, 96) / 100;
  const nTo = clamp(showcase.to, 8, 96) / 100;
  const valley = Math.max(0.08, Math.min(nOld, nTo) - 0.28);
  // Sample a smooth two-peak curve: y = max of two gaussians + a floor.
  const peakA = 0.24; // x of old peak
  const peakB = 0.78; // x of new peak
  const g = (x: number, c: number, w: number) => Math.exp(-((x - c) ** 2) / (2 * w * w));
  const heightAt = (x: number) =>
    valley + (nOld - valley) * g(x, peakA, 0.13) + (nTo - valley) * g(x, peakB, 0.13);
  const ipx = (x: number) => IPAD + x * IPLOT_W;
  const ipy = (h: number) => IPAD + IPLOT_H - clamp(h, 0, 1) * IPLOT_H;
  const landPts: string[] = [];
  for (let i = 0; i <= 60; i++) {
    const x = i / 60;
    landPts.push(`${round(ipx(x))},${round(ipy(heightAt(x)))}`);
  }
  const landArea = `${round(ipx(0))},${round(ipy(0) + IPLOT_H)} ${landPts.join(' ')} ${round(
    ipx(1),
  )},${round(ipy(0) + IPLOT_H)}`;
  const moved = Math.abs(showcase.to - showcase.from) > 0.5;
  // Ball sits on the old peak; if a lurch happened, an arrow crosses to the new one.
  const ballX = peakA;
  const ballY = heightAt(peakA);
  const destX = peakB;
  const destY = heightAt(peakB);

  return (
    <figure className={cx('brutal my-6 bg-surface p-5 sm:p-6', className)}>
      <p className="font-display text-xs font-semibold uppercase tracking-wide text-brand-600">
        {eyebrow}
      </p>
      {title ? (
        <p className="mt-1 font-display text-lg font-semibold text-ink-900">{title}</p>
      ) : null}

      <p className="mt-2 text-sm font-medium text-ink-700">{instructions}</p>

      {/* The main trait timeline */}
      <div className="mt-4 overflow-hidden rounded-card border border-ink-100 bg-surface-sunken">
        <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={readoutText}>
          <rect x="0" y="0" width={W} height={H} fill="var(--color-surface-sunken)" />

          {/* Axes */}
          <line x1={PAD_L} y1={PAD_T} x2={PAD_L} y2={PAD_T + PLOT_H} stroke="var(--color-ink-400)" strokeWidth="1.5" />
          <line x1={PAD_L} y1={PAD_T + PLOT_H} x2={PAD_L + PLOT_W} y2={PAD_T + PLOT_H} stroke="var(--color-ink-400)" strokeWidth="1.5" />
          <text x={PAD_L - 6} y={PAD_T + 4} textAnchor="end" fontSize="11" fill="var(--color-ink-500)">
            {traitAxisLabel}
          </text>
          <text x={PAD_L + PLOT_W} y={H - 8} textAnchor="end" fontSize="11" fill="var(--color-ink-500)">
            {timeAxisLabel}
          </text>

          {/* Punctuation markers: a faint vertical band at each lurch */}
          {puncts.map((p, i) => (
            <line
              key={`p-${i}`}
              x1={sx(p.t + RAMP / 2)}
              y1={sy(0)}
              x2={sx(p.t + RAMP / 2)}
              y2={sy(100)}
              stroke={punctColor}
              strokeWidth="1"
              strokeDasharray="3 3"
              opacity={0.5}
              className={tween}
            />
          ))}

          {/* Trait line: flat stasis, steep lurches */}
          <polyline
            points={linePts}
            fill="none"
            stroke={traitColor}
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={tween}
          />

          {/* Punctuation dots at the top of each lurch */}
          {puncts.map((p, i) => (
            <circle
              key={`d-${i}`}
              cx={sx(Math.min(p.t + RAMP, T))}
              cy={sy(p.to)}
              r="4"
              fill={punctColor}
              stroke="var(--color-surface)"
              strokeWidth="1.5"
              className={tween}
            />
          ))}
        </svg>
      </div>

      {/* Legend */}
      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs font-medium text-ink-600">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="inline-block h-0 w-5 border-t-[3px]" style={{ borderColor: traitColor }} />
          {traitLegendLabel}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="inline-block h-0 w-5 border-t-[3px] border-dashed" style={{ borderColor: punctColor }} />
          {punctuationLegendLabel}
        </span>
      </div>

      {/* Fitness-landscape inset */}
      <div className="mt-4">
        <p className="text-[0.7rem] font-semibold text-ink-600">{insetTitle}</p>
        <div className="mt-1.5 overflow-hidden rounded-card border border-ink-100 bg-surface-sunken">
          <svg viewBox={`0 0 ${IW} ${IH}`} className="h-auto w-full" role="img" aria-label={insetTitle}>
            <rect x="0" y="0" width={IW} height={IH} fill="var(--color-surface-sunken)" />
            {/* Landscape terrain */}
            <polygon points={landArea} fill="color-mix(in oklab, var(--color-brand-500) 12%, transparent)" className={tween} />
            <polyline points={landPts.join(' ')} fill="none" stroke="var(--color-brand-500)" strokeWidth="2.5" strokeLinejoin="round" className={tween} />

            {/* Valley-crossing arrow (only when a lurch actually happened) */}
            {moved ? (
              <path
                d={`M ${round(ipx(ballX))} ${round(ipy(ballY) - 10)} Q ${round(ipx(0.5))} ${round(
                  ipy(Math.max(nOld, nTo)) - 34,
                )} ${round(ipx(destX))} ${round(ipy(destY) - 10)}`}
                fill="none"
                stroke={punctColor}
                strokeWidth="2"
                strokeDasharray="4 3"
                markerEnd={`url(#${reactId}-arrow)`}
                className={tween}
              />
            ) : null}
            <defs>
              <marker id={`${reactId}-arrow`} markerWidth="7" markerHeight="7" refX="5" refY="3" orient="auto">
                <path d="M0,0 L6,3 L0,6 Z" fill={punctColor} />
              </marker>
            </defs>

            {/* Population ball on the old peak */}
            <circle cx={ipx(ballX)} cy={ipy(ballY) - 6} r="5" fill="var(--color-ink-900)" stroke="var(--color-surface)" strokeWidth="1.5" className={tween} />
            <text x={ipx(ballX)} y={ipy(ballY) - 15} textAnchor="middle" fontSize="9" fill="var(--color-ink-600)">
              {ballLabel}
            </text>
            {/* Peak labels */}
            <text x={ipx(peakA)} y={IH - 4} textAnchor="middle" fontSize="9" fill="var(--color-ink-500)">
              {oldPeakLabel}
            </text>
            {moved ? (
              <text x={ipx(peakB)} y={IH - 4} textAnchor="middle" fontSize="9" fill="var(--color-accent-600)">
                {newPeakLabel}
              </text>
            ) : null}
          </svg>
        </div>
      </div>

      {/* Live readout */}
      <p
        aria-live="polite"
        className="mt-4 rounded-card border border-brand-200 bg-brand-50/70 p-3 text-sm leading-relaxed text-ink-700"
      >
        {readoutText}
      </p>

      {/* Shock-frequency slider */}
      <div className="mt-4">
        <label htmlFor={`${reactId}-shock`} className="text-[0.65rem] font-bold uppercase tracking-wide text-ink-600">
          {shockLabel}
        </label>
        <input
          id={`${reactId}-shock`}
          type="range"
          min={0}
          max={10}
          step={1}
          value={shock}
          onChange={(e) => setShock(Number(e.target.value))}
          aria-valuetext={`${shock} of 10`}
          className="mt-1 h-1.5 w-full cursor-pointer accent-accent"
        />
        <div className="flex justify-between text-[0.6rem] font-medium uppercase tracking-wide text-ink-400">
          <span>{shockLowLabel}</span>
          <span>{shockHighLabel}</span>
        </div>
      </div>

      {/* Constraint-strength slider */}
      <div className="mt-3">
        <label htmlFor={`${reactId}-constraint`} className="text-[0.65rem] font-bold uppercase tracking-wide text-ink-600">
          {constraintLabel}
        </label>
        <input
          id={`${reactId}-constraint`}
          type="range"
          min={0}
          max={10}
          step={1}
          value={constraint}
          onChange={(e) => setConstraint(Number(e.target.value))}
          aria-valuetext={`${constraint} of 10`}
          className="mt-1 h-1.5 w-full cursor-pointer accent-brand"
        />
        <div className="flex justify-between text-[0.6rem] font-medium uppercase tracking-wide text-ink-400">
          <span>{constraintLowLabel}</span>
          <span>{constraintHighLabel}</span>
        </div>
      </div>

      {caption ? <figcaption className="mt-3 text-sm text-ink-500">{caption}</figcaption> : null}
    </figure>
  );
}

export default PunctuatedTimeline;
