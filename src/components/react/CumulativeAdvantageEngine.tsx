import { useId, useMemo, useState } from 'react';
import { cx } from '@/components/react/cx';

/** Props for the {@link CumulativeAdvantageEngine} island. */
export interface CumulativeAdvantageEngineProps {
  /** Heading above the card. */
  title?: string;
  /** Eyebrow label. Defaults to `'Cumulative-advantage engine'`. */
  eyebrow?: string;
  /** Instruction line above the chart. */
  instructions?: string;
  /** Caption beneath the card. */
  caption?: string;
  /** Label for the attachment-strength slider. Defaults to `'Attachment strength'`. */
  strengthLabel?: string;
  /** Caption under the slider's left (fair) end. Defaults to `'Fair (pure luck)'`. */
  fairLabel?: string;
  /** Caption under the slider's right (rich-get-richer) end. Defaults to `'Rich get richer'`. */
  richLabel?: string;
  /** Label for the drop button. Defaults to `'Drop 300 tokens'`. */
  dropLabel?: string;
  /** Label for the new-run button. Defaults to `'New run'`. */
  newRunLabel?: string;
  /** Label for the reset button. Defaults to `'Reset'`. */
  resetLabel?: string;
  /** Label for the toggle to the piles view. Defaults to `'Piles'`. */
  pilesViewLabel?: string;
  /** Label for the toggle to the log–log rank–size view. Defaults to `'Rank–size (log–log)'`. */
  loglogViewLabel?: string;
  /** Stat label for the tokens dropped so far. Defaults to `'Tokens dropped'`. */
  tokensLabel?: string;
  /** Stat label for the biggest single pile. Defaults to `'Biggest pile'`. */
  biggestLabel?: string;
  /** Stat label for the top pile's share of the total. Defaults to `'Top pile’s share'`. */
  topShareLabel?: string;
  /** Stat label for the inequality (Gini) readout. Defaults to `'Inequality (Gini)'`. */
  giniLabel?: string;
  /** Thousands separator for big numbers. Defaults to `','` (use `'.'` for es-ES). */
  groupSeparator?: string;
  /** Prompt shown before any tokens are dropped. */
  emptyHint?: string;
  /** Small note under the log–log view explaining a straight line. */
  loglogNote?: string;
  /**
   * Live readout template. Placeholders: `{n}` tokens dropped, `{piles}` number
   * of piles, `{top}` the top pile's % share of the total, `{max}` the biggest
   * single pile, `{gini}` the Gini coefficient (0–1, 2 decimals), `{world}` the
   * regime name (fair/rich) from {@link fairLabel}/{@link richLabel}.
   */
  readoutTemplate?: string;
  /** Extra classes merged onto the root element. */
  className?: string;
}

// ── Model ─────────────────────────────────────────────────────────────────
const NPILES = 14;
const BATCH = 300;

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

/** Group the integer part of a number with a thousands separator. */
function groupInt(n: number, sep: string): string {
  return Math.round(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, sep);
}

/**
 * Map the 0–100 strength slider to a preferential-attachment exponent β. At
 * β≈0 every pile is equally likely to win a token regardless of its size, so
 * luck alone rules and the piles stay roughly even. At β=1 a pile's pull is
 * proportional to how big it already is — classic linear preferential
 * attachment, the generator of a power law. Past β=1 the pull is super-linear
 * and a single runaway winner swallows almost everything.
 */
function betaFor(strength: number): number {
  return (clamp(strength, 0, 100) / 100) * 1.7;
}

/** Gini coefficient of a list of non-negative sizes (0 = equal, →1 = one winner). */
function gini(sizes: number[]): number {
  const n = sizes.length;
  let total = 0;
  for (const s of sizes) total += s;
  if (n === 0 || total === 0) return 0;
  let absDiff = 0;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) absDiff += Math.abs(sizes[i] - sizes[j]);
  }
  return absDiff / (2 * n * total);
}

/** Every pile starts life with a single token — a deterministic, even world. */
function evenStart(): number[] {
  return Array.from({ length: NPILES }, () => 1);
}

// ── Geometry ──────────────────────────────────────────────────────────────
const W = 460;
const H = 250;
const PAD_L = 34;
const PAD_R = 12;
const PAD_T = 14;
const PAD_B = 26;
const PLOT_W = W - PAD_L - PAD_R;
const PLOT_H = H - PAD_T - PAD_B;

/**
 * Interactive **cumulative-advantage engine** — the generative machine behind
 * power laws made tactile. A handful of equal piles compete for tokens dropped
 * one at a time. The learner sets the **attachment strength**: how strongly a
 * pile's *current* size boosts its odds of grabbing the next token.
 *
 * At low strength the tokens scatter by luck and the piles stay roughly even.
 * Turn the strength up and the loop bites — "to those who have, more shall be
 * given": a pile that gets a little ahead becomes more likely to get further
 * ahead, so a tiny early lead snowballs into a runaway winner. Two live views
 * make the signature visible: the **piles** (a sorted bar chart where one bar
 * towers over a long tail of scraps) and the **rank–size plot on log–log axes**,
 * which straightens into the tell-tale diagonal of a power law.
 *
 * The readout tracks the **top pile's share** of everything and the **Gini**
 * inequality, so the learner watches concentration climb as attachment
 * strengthens. Bars only appear on interaction, so the server render is a set
 * of equal piles and deterministic. Controls are native, keyboard-operable
 * inputs; the readout is announced via `aria-live`; there is no autoplaying
 * motion, so nothing fights `prefers-reduced-motion`.
 */
export function CumulativeAdvantageEngine({
  title,
  eyebrow = 'Cumulative-advantage engine',
  instructions = 'Fourteen equal piles compete for tokens dropped one at a time. Set how strongly a pile’s current size boosts its odds of grabbing the next token, then keep dropping. At low strength luck keeps the piles even; crank it up and a tiny early lead snowballs into a runaway winner.',
  caption,
  strengthLabel = 'Attachment strength',
  fairLabel = 'Fair (pure luck)',
  richLabel = 'Rich get richer',
  dropLabel = 'Drop 300 tokens',
  newRunLabel = 'New run',
  resetLabel = 'Reset',
  pilesViewLabel = 'Piles',
  loglogViewLabel = 'Rank–size (log–log)',
  tokensLabel = 'Tokens dropped',
  biggestLabel = 'Biggest pile',
  topShareLabel = 'Top pile’s share',
  giniLabel = 'Inequality (Gini)',
  groupSeparator = ',',
  emptyHint = 'Press “Drop 300 tokens” to start feeding the piles.',
  loglogNote = 'A straight, downward line on log–log axes is the signature of a power law: the same lopsided shape at every zoom level.',
  readoutTemplate = 'After {n} tokens across {piles} piles in the {world} regime, the single biggest pile holds {max} — that is {top}% of everything, and the inequality (Gini) sits at {gini}.',
  className,
}: CumulativeAdvantageEngineProps) {
  const reactId = useId();
  const [strength, setStrength] = useState(78);
  const [piles, setPiles] = useState<number[]>(evenStart);
  const [tokens, setTokens] = useState(0);
  const [view, setView] = useState<'piles' | 'loglog'>('piles');

  const beta = betaFor(strength);
  const world = strength >= 40 ? richLabel : fairLabel;
  const started = tokens > 0;

  const stats = useMemo(() => {
    let total = 0;
    let max = 0;
    for (const p of piles) {
      total += p;
      if (p > max) max = p;
    }
    return {
      total,
      max,
      topShare: total > 0 ? (max / total) * 100 : 0,
      gini: gini(piles),
    };
  }, [piles]);

  /** Drop one batch of tokens, each attaching with probability ∝ size^β. */
  const drop = () => {
    setPiles((prev) => {
      const next = prev.slice();
      const w = new Array(next.length);
      for (let t = 0; t < BATCH; t++) {
        // Rebuild the (size^β) weights each token so growth compounds.
        let sum = 0;
        for (let i = 0; i < next.length; i++) {
          w[i] = Math.pow(next[i], beta);
          sum += w[i];
        }
        let r = Math.random() * sum;
        let idx = next.length - 1;
        for (let i = 0; i < next.length; i++) {
          r -= w[i];
          if (r <= 0) {
            idx = i;
            break;
          }
        }
        next[idx] += 1;
      }
      return next;
    });
    setTokens((n) => n + BATCH);
  };

  /** Reset to even piles but with a tiny random head-start, then let it run. */
  const newRun = () => {
    const fresh = evenStart();
    // A single lucky token to one random pile — the "small early difference"
    // that cumulative advantage magnifies. Everything downstream flows from it.
    fresh[Math.floor(Math.random() * fresh.length)] += 1;
    setPiles(fresh);
    setTokens(0);
  };

  const reset = () => {
    setPiles(evenStart());
    setTokens(0);
  };

  const fmt = (n: number) => groupInt(n, groupSeparator);

  const readout = !started
    ? emptyHint
    : readoutTemplate
        .replace('{n}', fmt(tokens))
        .replace('{piles}', String(NPILES))
        .replace('{world}', world.toLowerCase())
        .replace('{max}', fmt(stats.max))
        .replace('{top}', stats.topShare.toFixed(stats.topShare >= 10 ? 0 : 1))
        .replace('{gini}', stats.gini.toFixed(2));

  const sorted = useMemo(() => piles.slice().sort((a, b) => b - a), [piles]);

  // Piles view geometry
  const visMax = sorted.reduce((m, d) => Math.max(m, d), 1);
  const barGap = 4;
  const barW = (PLOT_W - barGap * (sorted.length - 1)) / sorted.length;

  // Log–log rank–size geometry
  const logMaxX = Math.log10(sorted.length); // rank 1..n
  const logMaxY = Math.max(0.3, Math.log10(visMax));
  const logPts = sorted.map((size, i) => {
    const rank = i + 1;
    const lx = Math.log10(rank) / logMaxX; // 0..1
    const ly = Math.log10(Math.max(1, size)) / logMaxY; // 0..1
    return {
      x: PAD_L + lx * PLOT_W,
      y: PAD_T + PLOT_H - ly * PLOT_H,
    };
  });

  return (
    <figure className={cx('brutal my-6 bg-surface p-5 sm:p-6', className)}>
      <p className="font-display text-xs font-semibold uppercase tracking-wide text-accent-600">
        {eyebrow}
      </p>
      {title ? (
        <p className="mt-1 font-display text-lg font-semibold text-ink-900">{title}</p>
      ) : null}

      <p className="mt-2 text-sm font-medium text-ink-700">{instructions}</p>

      {/* View toggle */}
      <div className="mt-4 inline-flex rounded-pill border border-ink-200 bg-surface-sunken p-0.5 text-xs font-semibold">
        {(
          [
            ['piles', pilesViewLabel],
            ['loglog', loglogViewLabel],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setView(key)}
            aria-pressed={view === key}
            className={cx(
              'rounded-pill px-3 py-1 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600',
              view === key ? 'bg-brand-600 text-white' : 'text-ink-600',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Chart */}
      <div className="mt-3 overflow-hidden rounded-card border border-ink-100 bg-surface-sunken">
        <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={readout}>
          <rect x="0" y="0" width={W} height={H} fill="var(--color-surface-sunken)" />

          {/* Axes */}
          <line x1={PAD_L} y1={PAD_T} x2={PAD_L} y2={PAD_T + PLOT_H} stroke="var(--color-ink-300)" strokeWidth="1.5" />
          <line
            x1={PAD_L}
            y1={PAD_T + PLOT_H}
            x2={PAD_L + PLOT_W}
            y2={PAD_T + PLOT_H}
            stroke="var(--color-ink-300)"
            strokeWidth="1.5"
          />

          {view === 'piles' ? (
            <>
              {/* Sorted piles — the biggest towers over the long tail */}
              {sorted.map((d, i) => {
                const h = (d / visMax) * PLOT_H;
                const x = PAD_L + i * (barW + barGap);
                const y = PAD_T + PLOT_H - h;
                const isMax = i === 0;
                return (
                  <rect
                    key={i}
                    x={x}
                    y={y}
                    width={Math.max(1, barW)}
                    height={Math.max(0.5, h)}
                    rx={barW > 4 ? 1.5 : 0}
                    fill={isMax ? 'var(--color-accent-500)' : 'var(--color-brand-300)'}
                  />
                );
              })}
            </>
          ) : (
            <>
              {/* Rank–size on log–log axes: a straight fall ⇒ a power law */}
              {logPts.length > 1 ? (
                <polyline
                  points={logPts.map((p) => `${p.x},${p.y}`).join(' ')}
                  fill="none"
                  stroke="var(--color-brand-400)"
                  strokeWidth="1.5"
                  strokeLinejoin="round"
                />
              ) : null}
              {logPts.map((p, i) => (
                <circle
                  key={i}
                  cx={p.x}
                  cy={p.y}
                  r={i === 0 ? 4 : 3}
                  fill={i === 0 ? 'var(--color-accent-500)' : 'var(--color-brand-600)'}
                />
              ))}
              <text
                x={PAD_L + 4}
                y={PAD_T + 10}
                fontSize="9"
                fill="var(--color-ink-400)"
              >
                log(size)
              </text>
              <text
                x={PAD_L + PLOT_W}
                y={PAD_T + PLOT_H + 16}
                fontSize="9"
                textAnchor="end"
                fill="var(--color-ink-400)"
              >
                log(rank) →
              </text>
            </>
          )}

          {!started ? (
            <text x={W / 2} y={H / 2} textAnchor="middle" fontSize="12" fill="var(--color-ink-400)">
              {emptyHint}
            </text>
          ) : null}
        </svg>
      </div>

      {view === 'loglog' ? (
        <p className="mt-2 text-xs leading-relaxed text-ink-500">{loglogNote}</p>
      ) : null}

      {/* Live readout */}
      <p
        aria-live="polite"
        className="mt-4 rounded-card border border-accent-300 bg-accent-300/20 p-3 text-sm leading-relaxed text-ink-700"
      >
        {readout}
      </p>

      {/* Stats grid */}
      <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { k: tokensLabel, v: fmt(tokens) },
          { k: biggestLabel, v: started ? fmt(stats.max) : '—' },
          { k: topShareLabel, v: started ? `${stats.topShare.toFixed(stats.topShare >= 10 ? 0 : 1)}%` : '—' },
          { k: giniLabel, v: started ? stats.gini.toFixed(2) : '—' },
        ].map((s, i) => (
          <div key={i} className="rounded-card border border-ink-100 bg-surface-sunken p-2.5 text-center">
            <dt className="text-[0.6rem] font-bold uppercase tracking-wide text-ink-500">{s.k}</dt>
            <dd className="mt-0.5 font-mono text-base font-semibold text-ink-900">{s.v}</dd>
          </div>
        ))}
      </dl>

      {/* Strength slider */}
      <div className="mt-5">
        <label
          htmlFor={`${reactId}-s`}
          className="text-[0.65rem] font-bold uppercase tracking-wide text-ink-500"
        >
          {strengthLabel}
        </label>
        <input
          id={`${reactId}-s`}
          type="range"
          min={0}
          max={100}
          step={1}
          value={strength}
          onChange={(e) => {
            setStrength(Number(e.target.value));
            reset();
          }}
          aria-valuetext={`${strength} — ${world}`}
          className="mt-1 h-1.5 w-full cursor-pointer accent-accent-500"
        />
        <div className="mt-1 flex justify-between text-[0.65rem] font-medium text-ink-500">
          <span>{fairLabel}</span>
          <span>{richLabel}</span>
        </div>
      </div>

      {/* Buttons */}
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={drop}
          className="brutal-btn bg-brand-600 px-4 py-2 text-sm text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
        >
          {dropLabel}
        </button>
        <button
          type="button"
          onClick={newRun}
          className="brutal-btn bg-surface px-4 py-2 text-sm text-ink-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
        >
          {newRunLabel}
        </button>
        <button
          type="button"
          onClick={reset}
          className="brutal-btn bg-surface px-4 py-2 text-sm text-ink-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
        >
          {resetLabel}
        </button>
      </div>

      {caption ? <figcaption className="mt-3 text-sm text-ink-500">{caption}</figcaption> : null}
    </figure>
  );
}

export default CumulativeAdvantageEngine;
