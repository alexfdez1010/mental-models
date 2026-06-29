import { useId, useMemo, useState } from 'react';
import { cx } from '@/components/react/cx';

/** A single true/false claim the learner rates. */
export interface CalibrationClaim {
  /** The statement shown to the learner. */
  statement: string;
  /** Whether the statement is actually true. */
  isTrue: boolean;
}

/** Props for the {@link CalibrationLab} island. */
export interface CalibrationLabProps {
  /** Heading above the card. */
  title?: string;
  /** Eyebrow label. Defaults to `'Calibration lab'`. */
  eyebrow?: string;
  /** Instruction line above the exercise. */
  instructions?: string;
  /** Caption beneath the card. */
  caption?: string;
  /** The claims to rate. Each gets a true/false answer + a confidence. */
  claims: CalibrationClaim[];
  /**
   * Confidence levels (percent, 50–100) the learner can pick from. Defaults to
   * `[50, 60, 70, 80, 90, 99]`.
   */
  confidenceLevels?: number[];
  /** Prompt asking the learner to judge truth. Defaults to `'Is it true or false?'`. */
  truthPrompt?: string;
  /** Label for the "true" button. Defaults to `'True'`. */
  trueLabel?: string;
  /** Label for the "false" button. Defaults to `'False'`. */
  falseLabel?: string;
  /** Prompt asking for confidence. Defaults to `'How sure are you?'`. */
  confidencePrompt?: string;
  /**
   * Progress template above the claim. Placeholders `{n}` (current, 1-based) and
   * `{total}`. Defaults to `'Claim {n} of {total}'`.
   */
  progressTemplate?: string;
  /** Label for the reset/start-over button. Defaults to `'Start over'`. */
  resetLabel?: string;
  /** Header for the results panel. Defaults to `'Your calibration'`. */
  resultsTitle?: string;
  /** Stat label for the Brier score. Defaults to `'Brier score'`. */
  brierLabel?: string;
  /** Stat label for average stated confidence. Defaults to `'Avg. confidence'`. */
  avgConfidenceLabel?: string;
  /** Stat label for the share actually correct. Defaults to `'Actually correct'`. */
  accuracyLabel?: string;
  /** Stat label for the overconfidence gap. Defaults to `'Overconfidence gap'`. */
  gapLabel?: string;
  /** X-axis title on the reliability plot. Defaults to `'You said…'`. */
  xAxisLabel?: string;
  /** Y-axis title on the reliability plot. Defaults to `'…right this often'`. */
  yAxisLabel?: string;
  /** Label for the perfect-calibration diagonal. Defaults to `'Perfect calibration'`. */
  diagonalLabel?: string;
  /**
   * Verdict shown when stated confidence runs well above accuracy. Placeholder
   * `{gap}` (signed percentage points). Defaults to an overconfidence message.
   */
  overconfidentVerdict?: string;
  /** Verdict shown when accuracy runs well above stated confidence. */
  underconfidentVerdict?: string;
  /** Verdict shown when confidence and accuracy roughly match. */
  calibratedVerdict?: string;
  /**
   * Live readout template for the results announcement. Placeholders: `{conf}`
   * average confidence, `{acc}` accuracy, `{gap}` signed gap, `{brier}` Brier
   * score.
   */
  readoutTemplate?: string;
  /** Extra classes merged onto the root element. */
  className?: string;
}

// ── Plot geometry ───────────────────────────────────────────────────────────
const W = 460;
const H = 280;
const PAD_L = 46;
const PAD_R = 14;
const PAD_T = 16;
const PAD_B = 40;
const PLOT_W = W - PAD_L - PAD_R;
const PLOT_H = H - PAD_T - PAD_B;
// The reliability diagram runs 50→100% on x (you only answer at ≥50% sure) and
// the full 0→100% on y (you can do worse than a coin flip when overconfident).
const X_MIN = 50;
const X_MAX = 100;

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

const xScale = (conf: number) =>
  PAD_L + ((clamp(conf, X_MIN, X_MAX) - X_MIN) / (X_MAX - X_MIN)) * PLOT_W;
const yScale = (acc: number) => PAD_T + PLOT_H - (clamp(acc, 0, 100) / 100) * PLOT_H;

interface Answer {
  /** What the learner said: true or false. */
  said: boolean;
  /** Confidence level chosen (percent, 50–100). */
  confidence: number;
}

/**
 * Interactive **calibration trainer** — the capstone skill of the probability
 * path made tactile. The learner judges a series of true/false claims and, for
 * each, states how sure they are. Calibration is the match between those two
 * numbers: of all the times you say "80% sure", a well-calibrated thinker is
 * right about 80% of the time.
 *
 * After every claim is rated, the island plots a **reliability diagram** — stated
 * confidence on the x-axis, the share actually correct on the y-axis — against the
 * 45° line of perfect calibration. Points that sit **below** the line are
 * overconfidence (you claimed more certainty than you earned); points **above** it
 * are underconfidence. It also scores a **Brier score** (mean squared error of the
 * probabilities — lower is better, 0 is perfect) and the **overconfidence gap**
 * (average confidence minus accuracy), the single number most people are shocked by.
 *
 * Nothing renders until the learner interacts, so the server render is the first
 * claim with empty results — deterministic, no `Math.random`. Controls are native
 * buttons; the results are announced via `aria-live`. There is no autoplaying
 * motion, so nothing here fights `prefers-reduced-motion`.
 */
export function CalibrationLab({
  title,
  eyebrow = 'Calibration lab',
  instructions = 'Judge each claim true or false, then say how sure you are. Calibration is the match between the two: of all the times you say “80%”, you should be right about 80% of the time. Rate them all to see your reliability curve and Brier score.',
  caption,
  claims,
  confidenceLevels = [50, 60, 70, 80, 90, 99],
  truthPrompt = 'Is it true or false?',
  trueLabel = 'True',
  falseLabel = 'False',
  confidencePrompt = 'How sure are you?',
  progressTemplate = 'Claim {n} of {total}',
  resetLabel = 'Start over',
  resultsTitle = 'Your calibration',
  brierLabel = 'Brier score',
  avgConfidenceLabel = 'Avg. confidence',
  accuracyLabel = 'Actually correct',
  gapLabel = 'Overconfidence gap',
  xAxisLabel = 'You said…',
  yAxisLabel = '…right this often',
  diagonalLabel = 'Perfect calibration',
  overconfidentVerdict = 'You are overconfident by {gap} points: your confidence runs well ahead of how often you are right. The fix is to widen your honest error bars and ease off your high-confidence answers.',
  underconfidentVerdict = 'You are underconfident by {gap} points: you are right more often than you claim. You can safely speak with a bit more conviction.',
  calibratedVerdict = 'Nicely calibrated — your confidence and your accuracy are within {gap} points of each other. That is exactly what a calibrated thinker looks like.',
  readoutTemplate = 'You averaged {conf}% confidence but were right {acc}% of the time — an overconfidence gap of {gap} points. Your Brier score is {brier} (0 is perfect).',
  className,
}: CalibrationLabProps) {
  const reactId = useId();
  const [index, setIndex] = useState(0);
  const [pending, setPending] = useState<boolean | null>(null);
  const [answers, setAnswers] = useState<(Answer | null)[]>(() => claims.map(() => null));

  const answeredCount = answers.filter((a): a is Answer => a !== null).length;
  const done = answeredCount === claims.length && claims.length > 0;

  const commit = (confidence: number) => {
    if (pending === null) return;
    const said = pending;
    setAnswers((prev) => {
      const next = prev.slice();
      next[index] = { said, confidence };
      return next;
    });
    setPending(null);
    // Advance to the next unanswered claim (or stay; the results panel takes over).
    setIndex((i) => Math.min(i + 1, claims.length - 1));
  };

  const reset = () => {
    setIndex(0);
    setPending(null);
    setAnswers(claims.map(() => null));
  };

  const stats = useMemo(() => {
    const real = answers
      .map((a, i) => (a ? { ...a, isTrue: claims[i].isTrue } : null))
      .filter((a): a is Answer & { isTrue: boolean } => a !== null);
    if (real.length === 0) {
      return { n: 0, avgConf: 0, accuracy: 0, gap: 0, brier: 0, buckets: [] as { conf: number; acc: number; n: number }[] };
    }
    let confSum = 0;
    let correct = 0;
    let brierSum = 0;
    const byLevel = new Map<number, { right: number; total: number }>();
    for (const a of real) {
      confSum += a.confidence;
      const isRight = a.said === a.isTrue;
      if (isRight) correct += 1;
      // Probability the learner assigned to the TRUE outcome, then Brier = (p − o)².
      const pTrue = a.said ? a.confidence / 100 : 1 - a.confidence / 100;
      const outcome = a.isTrue ? 1 : 0;
      brierSum += (pTrue - outcome) ** 2;
      const slot = byLevel.get(a.confidence) ?? { right: 0, total: 0 };
      slot.total += 1;
      if (isRight) slot.right += 1;
      byLevel.set(a.confidence, slot);
    }
    const buckets = [...byLevel.entries()]
      .map(([conf, v]) => ({ conf, acc: (v.right / v.total) * 100, n: v.total }))
      .sort((a, b) => a.conf - b.conf);
    return {
      n: real.length,
      avgConf: confSum / real.length,
      accuracy: (correct / real.length) * 100,
      gap: confSum / real.length - (correct / real.length) * 100,
      brier: brierSum / real.length,
      buckets,
    };
  }, [answers, claims]);

  const verdict = useMemo(() => {
    const gapAbs = Math.abs(stats.gap).toFixed(0);
    if (stats.gap > 8) return overconfidentVerdict.replace('{gap}', gapAbs);
    if (stats.gap < -8) return underconfidentVerdict.replace('{gap}', gapAbs);
    return calibratedVerdict.replace('{gap}', gapAbs);
  }, [stats.gap, overconfidentVerdict, underconfidentVerdict, calibratedVerdict]);

  const readout = readoutTemplate
    .replace('{conf}', stats.avgConf.toFixed(0))
    .replace('{acc}', stats.accuracy.toFixed(0))
    .replace('{gap}', (stats.gap >= 0 ? '+' : '−') + Math.abs(stats.gap).toFixed(0))
    .replace('{brier}', stats.brier.toFixed(3));

  const current = claims[index];
  const progress = progressTemplate
    .replace('{n}', String(Math.min(answeredCount + 1, claims.length)))
    .replace('{total}', String(claims.length));

  return (
    <figure className={cx('brutal my-6 bg-surface p-5 sm:p-6', className)}>
      <p className="font-display text-xs font-semibold uppercase tracking-wide text-accent-600">
        {eyebrow}
      </p>
      {title ? (
        <p className="mt-1 font-display text-lg font-semibold text-ink-900">{title}</p>
      ) : null}

      <p className="mt-2 text-sm font-medium text-ink-700">{instructions}</p>

      {!done ? (
        // ── Question flow ──────────────────────────────────────────────────
        <div className="mt-4 rounded-card border border-ink-100 bg-surface-sunken p-4 sm:p-5">
          <p className="text-[0.65rem] font-bold uppercase tracking-wide text-ink-500">{progress}</p>
          <p className="mt-2 text-base font-semibold leading-snug text-ink-900">{current?.statement}</p>

          {pending === null ? (
            <>
              <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-ink-500">
                {truthPrompt}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setPending(true)}
                  className="brutal-btn bg-brand-600 px-5 py-2 text-sm text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
                >
                  {trueLabel}
                </button>
                <button
                  type="button"
                  onClick={() => setPending(false)}
                  className="brutal-btn bg-surface px-5 py-2 text-sm text-ink-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
                >
                  {falseLabel}
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-ink-500">
                {confidencePrompt}{' '}
                <span className="text-accent-600">
                  ({pending ? trueLabel : falseLabel})
                </span>
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {confidenceLevels.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => commit(c)}
                    className="brutal-btn bg-accent-500 px-4 py-2 text-sm font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
                  >
                    {c}%
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      ) : (
        // ── Results ────────────────────────────────────────────────────────
        <div className="mt-4">
          <p className="font-display text-base font-semibold text-ink-900">{resultsTitle}</p>

          {/* Reliability diagram */}
          <div className="mt-3 overflow-hidden rounded-card border border-ink-100 bg-surface-sunken">
            <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={readout}>
              <rect x="0" y="0" width={W} height={H} fill="var(--color-surface-sunken)" />

              {/* Axes */}
              <line x1={PAD_L} y1={PAD_T} x2={PAD_L} y2={PAD_T + PLOT_H} stroke="var(--color-ink-300)" strokeWidth="1.5" />
              <line x1={PAD_L} y1={PAD_T + PLOT_H} x2={PAD_L + PLOT_W} y2={PAD_T + PLOT_H} stroke="var(--color-ink-300)" strokeWidth="1.5" />

              {/* Gridlines + y ticks at 0/50/100 */}
              {[0, 50, 100].map((t) => (
                <g key={t}>
                  <line x1={PAD_L} y1={yScale(t)} x2={PAD_L + PLOT_W} y2={yScale(t)} stroke="var(--color-ink-100)" strokeWidth="1" />
                  <text x={PAD_L - 6} y={yScale(t) + 3} textAnchor="end" fontSize="9" fill="var(--color-ink-400)">
                    {t}%
                  </text>
                </g>
              ))}
              {/* x ticks at 50/75/100 */}
              {[50, 75, 100].map((t) => (
                <text key={t} x={xScale(t)} y={PAD_T + PLOT_H + 14} textAnchor="middle" fontSize="9" fill="var(--color-ink-400)">
                  {t}%
                </text>
              ))}

              {/* Perfect-calibration diagonal (50,50)→(100,100) */}
              <line
                x1={xScale(50)}
                y1={yScale(50)}
                x2={xScale(100)}
                y2={yScale(100)}
                stroke="var(--color-brand-400)"
                strokeWidth="2"
                strokeDasharray="5 4"
              />
              <text x={xScale(100) - 4} y={yScale(100) + 12} textAnchor="end" fontSize="9" fill="var(--color-brand-600)">
                {diagonalLabel}
              </text>

              {/* Learner's reliability curve */}
              <polyline
                points={stats.buckets.map((b) => `${xScale(b.conf)},${yScale(b.acc)}`).join(' ')}
                fill="none"
                stroke="var(--color-accent-500)"
                strokeWidth="2"
              />
              {stats.buckets.map((b, i) => (
                <circle
                  key={i}
                  cx={xScale(b.conf)}
                  cy={yScale(b.acc)}
                  r={clamp(3 + b.n, 4, 9)}
                  fill="var(--color-accent-500)"
                  stroke="var(--color-surface)"
                  strokeWidth="1.5"
                />
              ))}

              {/* Axis titles */}
              <text x={PAD_L + PLOT_W / 2} y={H - 4} textAnchor="middle" fontSize="10" fill="var(--color-ink-500)">
                {xAxisLabel}
              </text>
              <text x={14} y={PAD_T + PLOT_H / 2} textAnchor="middle" fontSize="10" fill="var(--color-ink-500)" transform={`rotate(-90 14 ${PAD_T + PLOT_H / 2})`}>
                {yAxisLabel}
              </text>
            </svg>
          </div>

          {/* Live readout */}
          <p
            aria-live="polite"
            className="mt-4 rounded-card border border-accent-300 bg-accent-300/20 p-3 text-sm leading-relaxed text-ink-700"
          >
            {verdict}
          </p>

          {/* Stats grid */}
          <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { k: avgConfidenceLabel, v: `${stats.avgConf.toFixed(0)}%` },
              { k: accuracyLabel, v: `${stats.accuracy.toFixed(0)}%` },
              { k: gapLabel, v: `${stats.gap >= 0 ? '+' : '−'}${Math.abs(stats.gap).toFixed(0)}` },
              { k: brierLabel, v: stats.brier.toFixed(3) },
            ].map((s, i) => (
              <div key={i} className="rounded-card border border-ink-100 bg-surface-sunken p-2.5 text-center">
                <dt className="text-[0.6rem] font-bold uppercase tracking-wide text-ink-500">{s.k}</dt>
                <dd className="mt-0.5 font-mono text-base font-semibold text-ink-900">{s.v}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      {/* Reset (always available once at least one claim is answered) */}
      {answeredCount > 0 ? (
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={reset}
            className="brutal-btn bg-surface px-4 py-2 text-sm text-ink-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
          >
            {resetLabel}
          </button>
        </div>
      ) : null}

      <p className="sr-only" aria-live="polite">
        {done ? readout : ''}
      </p>

      {caption ? <figcaption className="mt-3 text-sm text-ink-500">{caption}</figcaption> : null}
    </figure>
  );
}

export default CalibrationLab;
