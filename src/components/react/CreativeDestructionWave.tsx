import { useId, useMemo, useState } from 'react';
import { cx } from '@/components/react/cx';

/** Props for the {@link CreativeDestructionWave} island. */
export interface CreativeDestructionWaveProps {
  /** Heading above the card. */
  title?: string;
  /** Eyebrow label. Defaults to `'Two S-curves, one event'`. */
  eyebrow?: string;
  /** Instruction line above the chart. */
  instructions?: string;
  /** Caption beneath the card. */
  caption?: string;
  /** Axis label for the vertical (share of the market) axis. */
  shareAxisLabel?: string;
  /** Axis label for the horizontal (time) axis. */
  timeAxisLabel?: string;
  /** Label over the entrant improvement-rate slider. */
  rateLabel?: string;
  /** Label over the incumbent moat/inertia slider. */
  moatLabel?: string;
  /** Caption on the low end of the rate slider. */
  rateLowLabel?: string;
  /** Caption on the high end of the rate slider. */
  rateHighLabel?: string;
  /** Caption on the low end of the moat slider. */
  moatLowLabel?: string;
  /** Caption on the high end of the moat slider. */
  moatHighLabel?: string;
  /** Legend label for the challenger's rising adoption curve. */
  entrantLabel?: string;
  /** Legend label for the incumbent's collapsing installed base. */
  incumbentLabel?: string;
  /** Legend label for the next wave building on freed resources. */
  nextWaveLabel?: string;
  /** Symbol printed after the share numbers. Defaults to `'%'`. */
  valueSuffix?: string;
  /**
   * Starting improvement rate (1–10) — how fast the challenger technology gets
   * better and cheaper. Defaults to `5`.
   */
  initialRate?: number;
  /**
   * Starting incumbent moat (0–10) — switching costs, brand and scale that
   * delay the crossover. Defaults to `4`.
   */
  initialMoat?: number;
  /** Verdict shown when the entrant sweeps the incumbent away. */
  verdictDoomed?: string;
  /** Verdict shown when the incumbent bleeds share but survives the horizon. */
  verdictEroding?: string;
  /** Verdict shown when the moat holds the entrant off for now. */
  verdictSurvives?: string;
  /** Phrase used in the readout when the crossover falls inside the horizon. */
  crossoverAt?: string;
  /** Phrase used in the readout when the crossover never happens in the horizon. */
  crossoverNever?: string;
  /**
   * Readout template. `{rate}`/`{moat}`/`{crossover}`/`{peak}`/`{years}`/
   * `{verdict}` are replaced.
   */
  readout?: string;
  /** Extra classes merged onto the root element. */
  className?: string;
}

// ── Geometry ────────────────────────────────────────────────────────────────
const W = 440;
const H = 300;
const PAD_L = 40;
const PAD_R = 14;
const PAD_T = 16;
const PAD_B = 36;
const PLOT_W = W - PAD_L - PAD_R;
const PLOT_H = H - PAD_T - PAD_B;

const YEARS = 20; // horizon
const STEP = 0.5; // sampling resolution for the smooth curves

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const round = (n: number) => Math.round(n);

/** Map a year (0…YEARS) to an SVG x. */
const sx = (t: number) => PAD_L + (t / YEARS) * PLOT_W;
/** Map a share (0…100) to an SVG y (share grows upward). */
const sy = (s: number) => PAD_T + PLOT_H - (clamp(s, 0, 100) / 100) * PLOT_H;

/** Logistic S-curve, 0…100, midpoint `t0`, steepness `k`. */
const logistic = (t: number, t0: number, k: number) => 100 / (1 + Math.exp(-k * (t - t0)));

/**
 * Interactive **creative-destruction** island — progress and ruin as two faces
 * of one event, drawn as overlapping S-curves.
 *
 * A challenger technology's adoption climbs an S-curve while the incumbent's
 * installed base collapses along the mirror curve: the new share rises *only as*
 * the old share falls, because the same customers, capital and workers move from
 * one to the other. The learner sets two dials — the entrant's **improvement
 * rate** (how fast it gets better and cheaper, which steepens and pulls the wave
 * earlier) and the incumbent's **moat** (switching costs, brand, scale, which
 * delays the crossover). The island marks the **crossover year** where the
 * challenger passes 50% — the point past which the incumbent is effectively
 * doomed — and traces a dimmed **next wave** rising near the horizon, the freed
 * resources fuelling the innovation that will one day destroy the challenger in
 * turn.
 *
 * Both controls are native, keyboard-operable range inputs with visible labels;
 * the readout is announced via `aria-live`; the SVG is static at each setting and
 * the only motion is a cosmetic tween, disabled under `prefers-reduced-motion`.
 */
export function CreativeDestructionWave({
  title,
  eyebrow = 'Two S-curves, one event',
  instructions = 'A challenger technology climbs as the incumbent collapses — the same customers, capital and workers crossing over. Set how fast the challenger improves and how strong the incumbent’s moat is, and watch the crossover where the old order is doomed.',
  caption,
  shareAxisLabel = 'Share of market',
  timeAxisLabel = 'Years',
  rateLabel = 'Challenger improvement rate (better, cheaper, faster)',
  moatLabel = 'Incumbent moat (switching costs, brand, scale)',
  rateLowLabel = 'crawling',
  rateHighLabel = 'explosive',
  moatLowLabel = 'none',
  moatHighLabel = 'fortress',
  entrantLabel = 'Challenger adoption',
  incumbentLabel = 'Incumbent installed base',
  nextWaveLabel = 'The next wave (freed resources)',
  valueSuffix = '%',
  initialRate = 5,
  initialMoat = 4,
  verdictDoomed = 'the incumbent is doomed — the challenger sweeps the market and the old curve collapses',
  verdictEroding = 'a wave in progress — the incumbent is bleeding share and will be overtaken if nothing changes',
  verdictSurvives = 'the moat holds for now — the challenger never crosses 50% inside the horizon, but standing still only buys time',
  crossoverAt = 'year {t}',
  crossoverNever = 'never within the horizon',
  readout = 'Improvement rate {rate}/10 against a moat of {moat}/10: the challenger crosses half the market at {crossover} and reaches {peak} by year {years} — {verdict}.',
  className,
}: CreativeDestructionWaveProps) {
  const reactId = useId();
  const [rate, setRate] = useState(clamp(initialRate, 1, 10));
  const [moat, setMoat] = useState(clamp(initialMoat, 0, 10));

  const model = useMemo(() => {
    // A faster-improving challenger steepens the curve and pulls the whole wave
    // earlier; a stronger moat pushes the midpoint (the 50% crossover) later.
    const k = 0.25 + rate * 0.07;
    const t0 = clamp(15 - rate * 0.9 + moat * 0.7, 2, 30);

    // Sample both curves. Incumbent installed base is the mirror of the
    // challenger's adoption — the market moves from one to the other.
    const entrant: number[] = [];
    const incumbent: number[] = [];
    const times: number[] = [];
    for (let t = 0; t <= YEARS + 1e-9; t += STEP) {
      const e = logistic(t, t0, k);
      times.push(t);
      entrant.push(e);
      incumbent.push(100 - e);
    }

    // The next wave: freed capital and labour fund the innovation that will one
    // day destroy the challenger in turn. It starts rising ~7 years after this
    // crossover, dimmed, only partway up by the horizon.
    const tN = t0 + 7;
    const next: number[] = times.map((t) => logistic(t, tN, k));

    const peak = entrant[entrant.length - 1];
    const crossoverYear = t0; // logistic hits 50% exactly at the midpoint
    const crossesInHorizon = crossoverYear <= YEARS;

    let verdict: 'doomed' | 'eroding' | 'survives';
    if (crossesInHorizon && peak >= 66) verdict = 'doomed';
    else if (!crossesInHorizon || peak < 40) verdict = 'survives';
    else verdict = 'eroding';

    return { entrant, incumbent, next, times, peak, crossoverYear, crossesInHorizon, verdict };
  }, [rate, moat]);

  const { entrant, incumbent, next, times, peak, crossoverYear, crossesInHorizon, verdict } = model;

  const fmt = (n: number) => `${round(n)}${valueSuffix}`;

  const toPts = (series: number[]) =>
    series.map((v, i) => `${round(sx(times[i]))},${round(sy(v))}`).join(' ');

  const entrantPts = toPts(entrant);
  const incumbentPts = toPts(incumbent);
  const nextPts = toPts(next);

  // Shade the incumbent's remaining installed base (the value being destroyed).
  const incumbentArea = `${sx(0)},${sy(0)} ${incumbentPts} ${sx(YEARS)},${sy(0)}`;

  const entrantColor = 'var(--color-success)';
  const incumbentColor = 'var(--color-danger)';
  const nextColor = 'var(--color-accent-500)';

  const verdictWord =
    verdict === 'doomed' ? verdictDoomed : verdict === 'survives' ? verdictSurvives : verdictEroding;

  const crossoverText = crossesInHorizon
    ? crossoverAt.replace('{t}', String(round(crossoverYear)))
    : crossoverNever;

  const readoutText = readout
    .replace('{rate}', String(rate))
    .replace('{moat}', String(moat))
    .replace('{crossover}', crossoverText)
    .replace('{peak}', fmt(peak))
    .replace('{years}', String(YEARS))
    .replace('{verdict}', verdictWord);

  const tween = 'transition-all duration-500 ease-out motion-reduce:transition-none';

  return (
    <figure className={cx('brutal my-6 bg-surface p-5 sm:p-6', className)}>
      <p className="font-display text-xs font-semibold uppercase tracking-wide text-brand-600">
        {eyebrow}
      </p>
      {title ? (
        <p className="mt-1 font-display text-lg font-semibold text-ink-900">{title}</p>
      ) : null}

      <p className="mt-2 text-sm font-medium text-ink-700">{instructions}</p>

      {/* The chart */}
      <div className="mt-4 overflow-hidden rounded-card border border-ink-100 bg-surface-sunken">
        <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={readoutText}>
          <rect x="0" y="0" width={W} height={H} fill="var(--color-surface-sunken)" />

          {/* Axes */}
          <line x1={PAD_L} y1={PAD_T} x2={PAD_L} y2={PAD_T + PLOT_H} stroke="var(--color-ink-400)" strokeWidth="1.5" />
          <line x1={PAD_L} y1={PAD_T + PLOT_H} x2={PAD_L + PLOT_W} y2={PAD_T + PLOT_H} stroke="var(--color-ink-400)" strokeWidth="1.5" />
          <text x={PAD_L - 6} y={PAD_T + 4} textAnchor="end" fontSize="11" fill="var(--color-ink-500)">
            {shareAxisLabel}
          </text>
          <text x={PAD_L + PLOT_W} y={H - 8} textAnchor="end" fontSize="11" fill="var(--color-ink-500)">
            {timeAxisLabel}
          </text>

          {/* 50% guide line */}
          <line
            x1={sx(0)}
            y1={sy(50)}
            x2={sx(YEARS)}
            y2={sy(50)}
            stroke="var(--color-ink-300)"
            strokeWidth="1"
            strokeDasharray="2 5"
          />

          {/* Incumbent installed base being destroyed */}
          <polygon
            points={incumbentArea}
            fill={`color-mix(in oklab, ${incumbentColor} 12%, transparent)`}
            className={tween}
          />

          {/* Next-wave curve (dimmed) */}
          <polyline
            points={nextPts}
            fill="none"
            stroke={nextColor}
            strokeWidth="2"
            strokeDasharray="5 4"
            strokeLinecap="round"
            opacity={0.55}
            className={tween}
          />

          {/* Incumbent curve */}
          <polyline
            points={incumbentPts}
            fill="none"
            stroke={incumbentColor}
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={tween}
          />

          {/* Challenger curve */}
          <polyline
            points={entrantPts}
            fill="none"
            stroke={entrantColor}
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={tween}
          />

          {/* Crossover marker (only when inside the horizon) */}
          {crossesInHorizon ? (
            <>
              <line
                x1={sx(crossoverYear)}
                y1={sy(0)}
                x2={sx(crossoverYear)}
                y2={sy(100)}
                stroke="var(--color-ink-400)"
                strokeWidth="1.25"
                strokeDasharray="3 3"
                className={tween}
              />
              <circle
                cx={sx(crossoverYear)}
                cy={sy(50)}
                r="5"
                fill="var(--color-ink-900)"
                stroke="var(--color-surface)"
                strokeWidth="2"
                className={tween}
              />
            </>
          ) : null}
        </svg>
      </div>

      {/* Legend */}
      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs font-medium text-ink-600">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="inline-block h-0 w-5 border-t-[3px]" style={{ borderColor: entrantColor }} />
          {entrantLabel}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="inline-block h-0 w-5 border-t-[3px]" style={{ borderColor: incumbentColor }} />
          {incumbentLabel}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="inline-block h-0 w-5 border-t-[3px] border-dashed" style={{ borderColor: nextColor }} />
          {nextWaveLabel}
        </span>
      </div>

      {/* Live readout */}
      <p
        aria-live="polite"
        className="mt-4 rounded-card border border-brand-200 bg-brand-50/70 p-3 text-sm leading-relaxed text-ink-700"
      >
        {readoutText}
      </p>

      {/* Improvement-rate slider */}
      <div className="mt-4">
        <label
          htmlFor={`${reactId}-rate`}
          className="text-[0.65rem] font-bold uppercase tracking-wide text-ink-600"
        >
          {rateLabel}
        </label>
        <input
          id={`${reactId}-rate`}
          type="range"
          min={1}
          max={10}
          step={1}
          value={rate}
          onChange={(e) => setRate(Number(e.target.value))}
          aria-valuetext={`${rate} of 10`}
          className="mt-1 h-1.5 w-full cursor-pointer accent-success"
        />
        <div className="flex justify-between text-[0.6rem] font-medium uppercase tracking-wide text-ink-400">
          <span>{rateLowLabel}</span>
          <span>{rateHighLabel}</span>
        </div>
      </div>

      {/* Incumbent-moat slider */}
      <div className="mt-3">
        <label
          htmlFor={`${reactId}-moat`}
          className="text-[0.65rem] font-bold uppercase tracking-wide text-ink-600"
        >
          {moatLabel}
        </label>
        <input
          id={`${reactId}-moat`}
          type="range"
          min={0}
          max={10}
          step={1}
          value={moat}
          onChange={(e) => setMoat(Number(e.target.value))}
          aria-valuetext={`${moat} of 10`}
          className="mt-1 h-1.5 w-full cursor-pointer accent-danger"
        />
        <div className="flex justify-between text-[0.6rem] font-medium uppercase tracking-wide text-ink-400">
          <span>{moatLowLabel}</span>
          <span>{moatHighLabel}</span>
        </div>
      </div>

      {caption ? <figcaption className="mt-3 text-sm text-ink-500">{caption}</figcaption> : null}
    </figure>
  );
}

export default CreativeDestructionWave;
