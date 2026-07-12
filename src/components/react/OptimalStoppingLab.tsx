import { useId, useMemo, useState } from 'react';
import { cx } from '@/components/react/cx';

/** What the stopping rule is trying to optimise. */
export type StoppingObjective = 'best' | 'value';

/** Props for the {@link OptimalStoppingLab} island. */
export interface OptimalStoppingLabProps {
  /** Heading above the card. */
  title?: string;
  /** Eyebrow label. Defaults to `'Optimal-stopping lab'`. */
  eyebrow?: string;
  /** Instruction line above the chart. */
  instructions?: string;
  /** Caption beneath the card. */
  caption?: string;
  /** Number of candidates in the stream. Defaults to `30`. */
  initialN?: number;
  /** Starting look fraction, as a percentage 0–100. Defaults to `37`. */
  initialLookPercent?: number;
  /** Which objective to show first. Defaults to `'best'`. */
  initialObjective?: StoppingObjective;

  // ── Labels (all user-facing strings, for i18n) ────────────────────────────
  /** Label for the objective toggle group. */
  objectiveLabel?: string;
  /** Toggle text for the "pick the single best" objective. */
  bestObjectiveLabel?: string;
  /** Toggle text for the "maximise expected value" objective. */
  valueObjectiveLabel?: string;
  /** Label over the look-fraction slider. */
  lookLabel?: string;
  /** Label over the candidate-count slider. */
  countLabel?: string;
  /** x-axis title. */
  axisLookLabel?: string;
  /** y-axis title for the "best" objective. */
  axisBestLabel?: string;
  /** y-axis title for the "value" objective. */
  axisValueLabel?: string;
  /** Stat label for the optimal look fraction. */
  optimalStatLabel?: string;
  /** Stat label for the score at the current look fraction. */
  scoreStatLabel?: string;
  /** Stat label for the 1/e reference. */
  referenceStatLabel?: string;
  /** Button that deals a fresh sequence for the single-run demo. */
  dealLabel?: string;
  /** Heading over the single-run demo strip. */
  demoLabel?: string;
  /** Chip caption for the look/sampling phase. */
  samplingLabel?: string;
  /** Chip caption for the leap/commit phase. */
  commitLabel?: string;
  /** Badge shown on the chosen candidate when it was the true best. */
  hitLabel?: string;
  /** Badge shown on the chosen candidate when it was NOT the true best. */
  missLabel?: string;
  /** Text noting where the true best actually was. `{pos}` is replaced. */
  bestWasLabel?: string;
  /**
   * Readout template. `{n}`, `{cutoff}`, `{optimal}`, `{score}`,
   * `{objective}`, `{reference}` are replaced with live values.
   */
  readoutTemplate?: string;
  /** Extra classes merged onto the root element. */
  className?: string;
}

const clampN = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

// ── Deterministic PRNG (mulberry32) ────────────────────────────────────────
// Seeded so the Monte-Carlo value curve is IDENTICAL on the server and the
// client — no hydration mismatch, and the chart is reproducible.
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fisher–Yates shuffle of ranks 1..N (N = best) using a seeded PRNG. */
function shuffledRanks(n: number, rnd: () => number): number[] {
  const a = Array.from({ length: n }, (_, i) => i + 1);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    const tmp = a[i];
    a[i] = a[j];
    a[j] = tmp;
  }
  return a;
}

/**
 * Run the look-then-leap rule on one sequence.
 * Sample the first `cutoff` positions, remember their best, then accept the
 * first later candidate that beats it; if none appears, you are forced onto the
 * very last candidate.
 * @returns the absolute rank of the chosen candidate (n = the true best).
 */
function runSequence(ranks: number[], cutoff: number): number {
  const n = ranks.length;
  let sampleMax = 0;
  for (let i = 0; i < cutoff; i++) sampleMax = Math.max(sampleMax, ranks[i]);
  for (let i = cutoff; i < n; i++) {
    if (ranks[i] > sampleMax) return ranks[i];
  }
  return ranks[n - 1];
}

/**
 * Exact probability of picking the single best when you sample the first
 * `r` of `n` candidates, then take the first one better than that sample.
 * P(r) = (r/n) · Σ_{i=r+1}^{n} 1/(i−1); P(0) = 1/n.
 */
function exactBestProb(r: number, n: number): number {
  if (r <= 0) return 1 / n;
  let sum = 0;
  for (let i = r + 1; i <= n; i++) sum += 1 / (i - 1);
  return (r / n) * sum;
}

/** Monte-Carlo expected percentile (rank/n) of the pick at cutoff `r`. */
function mcValue(r: number, n: number, trials: number, rnd: () => number): number {
  let total = 0;
  for (let t = 0; t < trials; t++) {
    total += runSequence(shuffledRanks(n, rnd), r) / n;
  }
  return total / trials;
}

// ── Chart geometry ──────────────────────────────────────────────────────────
const CW = 320;
const CH = 200;
const PAD_L = 30;
const PAD_R = 12;
const PAD_T = 14;
const PAD_B = 26;
const PLOT_W = CW - PAD_L - PAD_R;
const PLOT_H = CH - PAD_T - PAD_B;

/**
 * **Optimal stopping & the secretary problem.** Options arrive one at a time and
 * each must be accepted or rejected on the spot, with no going back. The optimal
 * policy is a *look-then-leap* rule: reject the first ~37% (that's 1/e), remember
 * the best you saw, then grab the first one that beats it.
 *
 * The chart plots how well the rule does as a function of the **look fraction**.
 * For the *pick-the-single-best* objective the success probability is computed
 * exactly and peaks near 37% (winning ≈ 37% of the time). Switch to *maximise
 * expected value* and the curve — the average quality of your pick — peaks at a
 * *smaller* look fraction: when near-misses count, you should be less picky.
 * A single-sequence demo lets you deal a fresh run and watch the rule fire.
 *
 * The value curve is a seeded Monte-Carlo (deterministic across server/client,
 * so no hydration mismatch); the "best" curve is exact. Safe under
 * `prefers-reduced-motion` — nothing animates on a loop.
 */
export function OptimalStoppingLab({
  title,
  eyebrow = 'Optimal-stopping lab',
  instructions = 'Options arrive one at a time; accept or reject each on the spot, no going back. The rule: look at a fraction without committing, remember the best, then leap at the first that beats it. Drag the look fraction and watch how often the rule wins.',
  caption,
  initialN = 30,
  initialLookPercent = 37,
  initialObjective = 'best',
  objectiveLabel = 'Objective',
  bestObjectiveLabel = 'Pick the single best',
  valueObjectiveLabel = 'Maximise expected value',
  lookLabel = 'Look fraction (sample, then leap)',
  countLabel = 'How many candidates',
  axisLookLabel = 'Look fraction →',
  axisBestLabel = 'P(get the best)',
  axisValueLabel = 'Avg. quality of pick',
  optimalStatLabel = 'Optimal look',
  scoreStatLabel = 'Score here',
  referenceStatLabel = '1/e ≈ 37%',
  dealLabel = 'Deal a new sequence',
  demoLabel = 'Watch one sequence',
  samplingLabel = 'look',
  commitLabel = 'leap',
  hitLabel = '✓ got the best',
  missLabel = '✗ missed the best',
  bestWasLabel = 'the true best was #{pos}',
  readoutTemplate = 'With {n} candidates and the "{objective}" goal, looking at the first {cutoff}% then leaping scores {score}. The optimal look is about {optimal}% — close to the theoretical {reference}.',
  className,
}: OptimalStoppingLabProps) {
  const reactId = useId();

  const [n, setN] = useState(() => clampN(Math.round(initialN), 5, 60));
  const [objective, setObjective] = useState<StoppingObjective>(initialObjective);
  const [lookPercent, setLookPercent] = useState(() => clampN(Math.round(initialLookPercent), 0, 95));

  // Deal a demo sequence deterministically at first, then via user clicks.
  const [deal, setDeal] = useState<number[]>(() => shuffledRanks(clampN(Math.round(initialN), 5, 60), mulberry32(7)));

  const cutoff = Math.round((lookPercent / 100) * n);

  // Curve over every possible cutoff 0..n-1 for the active objective.
  const curve = useMemo(() => {
    const ys: number[] = [];
    if (objective === 'best') {
      for (let r = 0; r < n; r++) ys.push(exactBestProb(r, n));
    } else {
      // Seeded MC: identical on server + client. More trials for small n.
      const trials = n <= 20 ? 1200 : n <= 40 ? 700 : 450;
      const rnd = mulberry32(0x5eed + n);
      for (let r = 0; r < n; r++) ys.push(mcValue(r, n, trials, rnd));
    }
    return ys;
  }, [n, objective]);

  const yMin = Math.min(...curve);
  const yMax = Math.max(...curve);
  const yPad = (yMax - yMin) * 0.12 || 0.02;
  const lo = objective === 'best' ? 0 : Math.max(0, yMin - yPad);
  const hi = yMax + yPad;

  const optimalCutoff = curve.reduce((best, y, i) => (y > curve[best] ? i : best), 0);
  const optimalPercent = Math.round((optimalCutoff / n) * 100);

  const scoreHere = curve[Math.min(cutoff, n - 1)];
  const scoreText =
    objective === 'best'
      ? `${Math.round(scoreHere * 100)}%`
      : `${Math.round(scoreHere * 100)}${' '}pctl`;

  // Geometry helpers.
  const px = (r: number) => PAD_L + (n <= 1 ? 0 : (r / (n - 1)) * PLOT_W);
  const py = (y: number) => PAD_T + (1 - (y - lo) / (hi - lo || 1)) * PLOT_H;

  const linePath = `M ${curve.map((y, r) => `${px(r).toFixed(1)},${py(y).toFixed(1)}`).join(' L ')}`;

  // Single-sequence demo: apply the current cutoff to the dealt sequence.
  const demo = useMemo(() => {
    const sample = deal.slice(0, cutoff);
    const sampleMax = sample.reduce((m, v) => Math.max(m, v), 0);
    let chosenIdx = deal.length - 1; // forced onto the last if none beats the sample
    for (let i = cutoff; i < deal.length; i++) {
      if (deal[i] > sampleMax) {
        chosenIdx = i;
        break;
      }
    }
    const bestIdx = deal.indexOf(Math.max(...deal));
    return { sampleMax, chosenIdx, bestIdx, hit: chosenIdx === bestIdx };
  }, [deal, cutoff]);

  const readout = readoutTemplate
    .replace('{n}', String(n))
    .replace('{objective}', objective === 'best' ? bestObjectiveLabel : valueObjectiveLabel)
    .replace('{cutoff}', String(lookPercent))
    .replace('{score}', scoreText)
    .replace('{optimal}', String(optimalPercent))
    .replace('{reference}', referenceStatLabel);

  const axisY = objective === 'best' ? axisBestLabel : axisValueLabel;

  return (
    <figure className={cx('brutal my-6 bg-surface p-5 sm:p-6', className)}>
      <p className="font-display text-xs font-semibold uppercase tracking-wide text-accent-600">
        {eyebrow}
      </p>
      {title ? (
        <p className="mt-1 font-display text-lg font-semibold text-ink-900">{title}</p>
      ) : null}

      <p className="mt-2 text-sm font-medium text-ink-700">{instructions}</p>

      {/* Objective picker */}
      <div className="mt-4" role="group" aria-label={objectiveLabel}>
        <p className="text-[0.65rem] font-bold uppercase tracking-wide text-ink-600">{objectiveLabel}</p>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {(
            [
              { key: 'best' as const, label: bestObjectiveLabel },
              { key: 'value' as const, label: valueObjectiveLabel },
            ]
          ).map((o) => (
            <button
              key={o.key}
              type="button"
              aria-pressed={objective === o.key}
              onClick={() => setObjective(o.key)}
              className={cx(
                'rounded-pill border px-3 py-1 text-xs font-semibold transition-colors motion-reduce:transition-none',
                objective === o.key
                  ? 'border-accent-600 bg-accent-300/30 text-accent-600'
                  : 'border-ink-200 bg-surface text-ink-600 hover:border-ink-300',
              )}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 grid gap-5 sm:grid-cols-[auto_1fr] sm:items-start">
        {/* The chart */}
        <div className="mx-auto overflow-hidden rounded-card ring-1 ring-inset ring-ink-200 bg-surface-sunken">
          <svg
            viewBox={`0 0 ${CW} ${CH}`}
            className="block h-auto w-[320px] max-w-full"
            role="img"
            aria-label={readout}
          >
            <rect x="0" y="0" width={CW} height={CH} fill="var(--color-surface-sunken)" />

            {/* axes */}
            <line x1={PAD_L} y1={PAD_T + PLOT_H} x2={PAD_L + PLOT_W} y2={PAD_T + PLOT_H} stroke="var(--color-ink-300)" strokeWidth="1" />
            <line x1={PAD_L} y1={PAD_T} x2={PAD_L} y2={PAD_T + PLOT_H} stroke="var(--color-ink-300)" strokeWidth="1" />

            {/* 37% reference line */}
            <line
              x1={px(0.37 * (n - 1))}
              y1={PAD_T}
              x2={px(0.37 * (n - 1))}
              y2={PAD_T + PLOT_H}
              stroke="var(--color-ink-400)"
              strokeWidth="1"
              strokeDasharray="2 3"
              opacity="0.7"
            />
            <text x={px(0.37 * (n - 1)) + 3} y={PAD_T + 8} fontSize="7.5" fill="var(--color-ink-500)">
              37%
            </text>

            {/* optimal cutoff marker */}
            <line
              x1={px(optimalCutoff)}
              y1={PAD_T}
              x2={px(optimalCutoff)}
              y2={PAD_T + PLOT_H}
              stroke="var(--color-accent-600)"
              strokeWidth="1"
              strokeDasharray="3 3"
              opacity="0.75"
            />

            {/* the curve */}
            <path d={linePath} fill="none" stroke="var(--color-brand-600)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />

            {/* current-cutoff marker */}
            <line
              x1={px(Math.min(cutoff, n - 1))}
              y1={PAD_T}
              x2={px(Math.min(cutoff, n - 1))}
              y2={PAD_T + PLOT_H}
              stroke="var(--color-ink-400)"
              strokeWidth="1"
              opacity="0.5"
            />
            <circle
              cx={px(Math.min(cutoff, n - 1))}
              cy={py(scoreHere)}
              r="5"
              fill="var(--color-brand-500)"
              stroke="var(--color-surface)"
              strokeWidth="1.5"
            />

            {/* axis labels */}
            <text x={PAD_L - 4} y={PAD_T + 6} textAnchor="end" fontSize="7.5" fill="var(--color-ink-500)">
              {axisY}
            </text>
            <text x={PAD_L + PLOT_W} y={CH - 8} textAnchor="end" fontSize="8.5" fontWeight="700" fill="var(--color-ink-500)">
              {axisLookLabel}
            </text>
            <text x={PAD_L} y={CH - 8} textAnchor="start" fontSize="7.5" fill="var(--color-ink-400)">
              0%
            </text>
          </svg>
        </div>

        {/* Stats + readout */}
        <div>
          <dl className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-card border border-accent-300 bg-accent-300/15 p-2">
              <dt className="text-[0.6rem] uppercase tracking-wide text-ink-500">{optimalStatLabel}</dt>
              <dd className="mt-0.5 font-display text-lg font-semibold tabular-nums text-accent-600">
                {optimalPercent}%
              </dd>
            </div>
            <div className="rounded-card border border-brand-200 bg-brand-50/60 p-2">
              <dt className="text-[0.6rem] uppercase tracking-wide text-ink-500">{scoreStatLabel}</dt>
              <dd className="mt-0.5 font-display text-lg font-semibold tabular-nums text-brand-700">
                {scoreText}
              </dd>
            </div>
            <div className="rounded-card border border-ink-200 bg-surface p-2">
              <dt className="text-[0.6rem] uppercase tracking-wide text-ink-500">{referenceStatLabel}</dt>
              <dd className="mt-0.5 font-display text-[0.9rem] font-semibold leading-tight text-ink-700">
                0.368
              </dd>
            </div>
          </dl>

          <p
            aria-live="polite"
            className="mt-3 rounded-card border border-accent-300 bg-accent-300/20 p-3 text-sm leading-relaxed text-ink-700"
          >
            {readout}
          </p>
        </div>
      </div>

      {/* Look-fraction slider */}
      <div className="mt-5">
        <label
          htmlFor={`${reactId}-look`}
          className="flex items-baseline justify-between gap-2 text-[0.65rem] font-bold uppercase tracking-wide text-ink-600"
        >
          <span>{lookLabel}</span>
          <span className="text-sm font-semibold tabular-nums text-accent-600">
            {lookPercent}% ({cutoff}/{n})
          </span>
        </label>
        <input
          id={`${reactId}-look`}
          type="range"
          min={0}
          max={95}
          step={1}
          value={lookPercent}
          onChange={(e) => setLookPercent(clampN(Number(e.target.value), 0, 95))}
          className="mt-1 h-1.5 w-full cursor-pointer accent-brand-500"
        />
      </div>

      {/* Candidate-count slider */}
      <div className="mt-4">
        <label
          htmlFor={`${reactId}-count`}
          className="flex items-baseline justify-between gap-2 text-[0.65rem] font-bold uppercase tracking-wide text-ink-600"
        >
          <span>{countLabel}</span>
          <span className="text-sm font-semibold tabular-nums text-accent-600">{n}</span>
        </label>
        <input
          id={`${reactId}-count`}
          type="range"
          min={5}
          max={60}
          step={1}
          value={n}
          onChange={(e) => {
            const nn = clampN(Number(e.target.value), 5, 60);
            setN(nn);
            setDeal(shuffledRanks(nn, mulberry32(7 + nn)));
          }}
          className="mt-1 h-1.5 w-full cursor-pointer accent-brand-500"
        />
      </div>

      {/* Single-sequence demo */}
      <div className="mt-5 rounded-card border border-ink-200 bg-surface-sunken p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[0.65rem] font-bold uppercase tracking-wide text-ink-600">{demoLabel}</p>
          <button
            type="button"
            onClick={() => setDeal(shuffledRanks(n, mulberry32((Math.random() * 2 ** 31) | 0)))}
            className="rounded-pill border border-brand-500 bg-brand-500 px-3 py-1 text-xs font-semibold text-white transition-colors hover:bg-brand-600 motion-reduce:transition-none"
          >
            {dealLabel}
          </button>
        </div>

        <div className="mt-3 flex flex-wrap gap-1" aria-hidden="true">
          {deal.map((rank, i) => {
            const inSample = i < cutoff;
            const isChosen = i === demo.chosenIdx;
            const isBest = i === demo.bestIdx;
            return (
              <span
                key={i}
                className={cx(
                  'flex h-6 w-6 items-center justify-center rounded text-[0.6rem] font-semibold tabular-nums ring-1 ring-inset',
                  isChosen
                    ? demo.hit
                      ? 'bg-brand-500 text-white ring-brand-600'
                      : 'bg-danger text-white ring-danger'
                    : inSample
                      ? 'bg-ink-100 text-ink-500 ring-ink-200'
                      : 'bg-surface text-ink-600 ring-ink-200',
                  isBest && !isChosen ? 'ring-2 ring-accent-600' : '',
                )}
                title={isBest ? 'true best' : inSample ? 'sample' : 'candidate'}
              >
                {rank}
              </span>
            );
          })}
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[0.65rem] text-ink-500">
          <span className="inline-flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded-sm bg-ink-100 ring-1 ring-inset ring-ink-200" />
            {samplingLabel}
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded-sm bg-surface ring-1 ring-inset ring-ink-200" />
            {commitLabel}
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded-sm ring-2 ring-accent-600" />
            {bestWasLabel.replace('{pos}', String(demo.bestIdx + 1))}
          </span>
        </div>

        <p
          aria-live="polite"
          className={cx(
            'mt-2 text-sm font-semibold',
            demo.hit ? 'text-brand-700' : 'text-danger',
          )}
        >
          {demo.hit ? hitLabel : missLabel}
          {' — '}
          {bestWasLabel.replace('{pos}', String(demo.bestIdx + 1))}
        </p>
      </div>

      {caption ? <figcaption className="mt-3 text-sm text-ink-500">{caption}</figcaption> : null}
    </figure>
  );
}

export default OptimalStoppingLab;
