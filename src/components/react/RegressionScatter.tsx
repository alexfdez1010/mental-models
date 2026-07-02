import { useId, useMemo, useState } from 'react';
import { cx } from '@/components/react/cx';

/** Props for the {@link RegressionScatter} island. */
export interface RegressionScatterProps {
  /** Heading above the card. */
  title?: string;
  /** Eyebrow label. Defaults to `'Regression to the mean'`. */
  eyebrow?: string;
  /** Instruction line above the chart. */
  instructions?: string;
  /** Caption beneath the card. */
  caption?: string;
  /** Label for the luck-vs-skill slider. Defaults to `'How much luck vs. skill?'`. */
  luckLabel?: string;
  /** Caption under the slider's left (all-skill) end. Defaults to `'All skill'`. */
  skillEndLabel?: string;
  /** Caption under the slider's right (all-luck) end. Defaults to `'All luck'`. */
  luckEndLabel?: string;
  /** Label for the "deal a fresh field" button. Defaults to `'Deal a new season'`. */
  dealLabel?: string;
  /** Label for the "reveal round 2" button. Defaults to `'Play round 2 →'`. */
  playLabel?: string;
  /** Column header for the first round. Defaults to `'Round 1'`. */
  round1Label?: string;
  /** Column header for the second round. Defaults to `'Round 2'`. */
  round2Label?: string;
  /** Label for the dashed population-average line. Defaults to `'Field average'`. */
  meanLineLabel?: string;
  /** Stat label for the selected group's round-1 average. Defaults to `'Stars’ round 1'`. */
  r1Label?: string;
  /** Stat label for the selected group's round-2 average. Defaults to `'Stars’ round 2'`. */
  r2Label?: string;
  /** Stat label for the field average. Defaults to `'Field average'`. */
  meanLabel?: string;
  /** Stat label for the share of the edge that regressed. Defaults to `'Edge lost'`. */
  shrinkLabel?: string;
  /** Prompt shown before any season has been dealt. */
  emptyHint?: string;
  /** Prompt shown after dealing, before round 2 is revealed. */
  round1Hint?: string;
  /**
   * Live readout template shown once round 2 is revealed. Placeholders:
   * `{k}` how many top performers were picked, `{n}` field size, `{r1}` the
   * stars' round-1 average, `{r2}` their round-2 average, `{mean}` the field
   * average, `{shrink}` the % of their round-1 edge that evaporated.
   */
  readoutTemplate?: string;
  /** Extra classes merged onto the root element. */
  className?: string;
}

// ── Geometry ────────────────────────────────────────────────────────────────
const W = 460;
const H = 300;
const PAD_T = 30;
const PAD_B = 26;
const PLOT_H = H - PAD_T - PAD_B;
const COL1_X = 150; // x of the round-1 dot column
const COL2_X = 340; // x of the round-2 dot column
const AXIS_X = 70;

const N = 44; // field size
const TOP_FRAC = 0.25; // fraction crowned "stars" after round 1
const FIELD_MEAN = 50; // the population average every score orbits
const BASE_SD = 16; // total spread of an observed score
const SCORE_LO = 5;
const SCORE_HI = 95;

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

/** One standard-normal sample via Box–Muller. */
function gauss(): number {
  const u = 1 - Math.random();
  const v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

interface Performer {
  /** Stable underlying ability — the signal that persists across rounds. */
  skill: number;
  /** Observed score in round 1 (skill + fresh luck). */
  s1: number;
  /** Observed score in round 2 (skill + *new* fresh luck). */
  s2: number;
}

/**
 * Deal a fresh field. `luckFrac` (0–1) splits the observed variance between
 * transient luck and stable skill while keeping the total spread fixed, so the
 * chart's shape stays comparable as the learner drags the slider. With more
 * luck, the reliability (skill share) drops and the stars regress harder.
 */
function dealField(luckFrac: number): Performer[] {
  const luckSd = BASE_SD * Math.sqrt(luckFrac);
  const skillSd = BASE_SD * Math.sqrt(1 - luckFrac);
  const out: Performer[] = [];
  for (let i = 0; i < N; i++) {
    const skill = FIELD_MEAN + gauss() * skillSd;
    const s1 = clamp(skill + gauss() * luckSd, SCORE_LO, SCORE_HI);
    const s2 = clamp(skill + gauss() * luckSd, SCORE_LO, SCORE_HI);
    out.push({ skill, s1, s2 });
  }
  return out;
}

const scoreToY = (score: number) =>
  PAD_T + PLOT_H - ((clamp(score, SCORE_LO, SCORE_HI) - SCORE_LO) / (SCORE_HI - SCORE_LO)) * PLOT_H;

const MEAN_Y = scoreToY(FIELD_MEAN);

/**
 * Interactive **regression-to-the-mean** demonstrator. Every performer carries a
 * hidden, stable **skill** plus a **fresh dose of luck each round**, so the score
 * you actually observe is `skill + luck`. The learner deals a season, the island
 * crowns the **top quarter** of round 1 as "stars", then — on the same fixed
 * skills but *new* luck — reveals round 2.
 *
 * The punchline is visual and unavoidable: the stars, selected on an extreme, were
 * extreme partly because their luck spiked that round. Give them fresh luck and
 * their average slides back down toward the field average, connectors sloping
 * downhill — with no injury, no complacency, no cause at all beyond chance. The
 * **luck-vs-skill slider** controls exactly how far they fall: crank it toward
 * *all skill* and the stars stay high (a real, repeatable signal); crank it toward
 * *all luck* and almost the entire edge evaporates. That knob *is* the model:
 * regression is large precisely to the degree the result was luck.
 *
 * Data is generated only on interaction (empty, deterministic server render); the
 * readout is announced via `aria-live`, controls are native and keyboard-operable,
 * and there is no autoplaying motion to fight `prefers-reduced-motion`.
 */
export function RegressionScatter({
  title,
  eyebrow = 'Regression to the mean',
  instructions = 'Every performer has a hidden, stable skill plus fresh luck each round. Deal a season, crown the top quarter of round 1 as “stars”, then give everyone new luck and play round 2. Watch the stars slide back toward the field average — and drag the slider to control how much of their edge was luck all along.',
  caption,
  luckLabel = 'How much luck vs. skill?',
  skillEndLabel = 'All skill',
  luckEndLabel = 'All luck',
  dealLabel = 'Deal a new season',
  playLabel = 'Play round 2 →',
  round1Label = 'Round 1',
  round2Label = 'Round 2',
  meanLineLabel = 'Field average',
  r1Label = 'Stars’ round 1',
  r2Label = 'Stars’ round 2',
  meanLabel = 'Field average',
  shrinkLabel = 'Edge lost',
  emptyHint = 'Press “Deal a new season” to scatter a fresh field of performers.',
  round1Hint = 'The gold dots are the top quarter of round 1 — your “stars”. Now press “Play round 2” and give everyone fresh luck.',
  readoutTemplate = 'You crowned the top {k} of {n} performers as stars — their round-1 average was {r1}, towering over the field’s {mean}. Deal them fresh luck and their round-2 average falls to {r2}: {shrink}% of their edge evaporated, pure regression to the mean — no cause required.',
  className,
}: RegressionScatterProps) {
  const reactId = useId();
  const [luckPct, setLuckPct] = useState(60);
  const [field, setField] = useState<Performer[]>([]);
  const [revealed, setRevealed] = useState(false);

  const luckFrac = luckPct / 100;

  // Indices of the "stars" — the top quarter by round-1 score.
  const starSet = useMemo(() => {
    if (field.length === 0) return new Set<number>();
    const order = field
      .map((p, i) => ({ i, s: p.s1 }))
      .sort((a, b) => b.s - a.s);
    const k = Math.max(1, Math.round(field.length * TOP_FRAC));
    return new Set(order.slice(0, k).map((o) => o.i));
  }, [field]);

  const stats = useMemo(() => {
    if (field.length === 0 || starSet.size === 0) {
      return { k: 0, n: field.length, r1: 0, r2: 0, mean: FIELD_MEAN, shrink: 0 };
    }
    let sum1 = 0;
    let sum2 = 0;
    starSet.forEach((i) => {
      sum1 += field[i].s1;
      sum2 += field[i].s2;
    });
    const k = starSet.size;
    const r1 = sum1 / k;
    const r2 = sum2 / k;
    const edge = r1 - FIELD_MEAN;
    const shrink = edge > 0 ? clamp(((r1 - r2) / edge) * 100, 0, 100) : 0;
    return { k, n: field.length, r1, r2, mean: FIELD_MEAN, shrink };
  }, [field, starSet]);

  const deal = () => {
    setField(dealField(luckFrac));
    setRevealed(false);
  };

  const round = (n: number) => Math.round(n).toString();

  const readout =
    field.length === 0
      ? emptyHint
      : !revealed
        ? round1Hint
        : readoutTemplate
            .replace('{k}', round(stats.k))
            .replace('{n}', round(stats.n))
            .replace('{r1}', round(stats.r1))
            .replace('{r2}', round(stats.r2))
            .replace('{mean}', round(stats.mean))
            .replace('{shrink}', round(stats.shrink));

  return (
    <figure className={cx('brutal my-6 bg-surface p-5 sm:p-6', className)}>
      <p className="font-display text-xs font-semibold uppercase tracking-wide text-accent-600">
        {eyebrow}
      </p>
      {title ? (
        <p className="mt-1 font-display text-lg font-semibold text-ink-900">{title}</p>
      ) : null}

      <p className="mt-2 text-sm font-medium text-ink-700">{instructions}</p>

      {/* Chart */}
      <div className="mt-4 overflow-hidden rounded-card border border-ink-100 bg-surface-sunken">
        <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={readout}>
          <rect x="0" y="0" width={W} height={H} fill="var(--color-surface-sunken)" />

          {/* Score axis */}
          <line x1={AXIS_X} y1={PAD_T} x2={AXIS_X} y2={PAD_T + PLOT_H} stroke="var(--color-ink-300)" strokeWidth="1.5" />
          {[SCORE_LO, FIELD_MEAN, SCORE_HI].map((v) => (
            <text key={v} x={AXIS_X - 6} y={scoreToY(v) + 3} textAnchor="end" fontSize="9" fill="var(--color-ink-400)">
              {v}
            </text>
          ))}

          {/* Field-average reference line */}
          <line
            x1={AXIS_X}
            y1={MEAN_Y}
            x2={W - 10}
            y2={MEAN_Y}
            stroke="var(--color-brand-700)"
            strokeWidth="1.5"
            strokeDasharray="5 4"
          />
          <text x={W - 12} y={MEAN_Y - 5} textAnchor="end" fontSize="9" fill="var(--color-brand-700)">
            {meanLineLabel}
          </text>

          {/* Column headers */}
          <text x={COL1_X} y={PAD_T - 12} textAnchor="middle" fontSize="11" fontWeight="600" fill="var(--color-ink-600)">
            {round1Label}
          </text>
          <text
            x={COL2_X}
            y={PAD_T - 12}
            textAnchor="middle"
            fontSize="11"
            fontWeight="600"
            fill={revealed ? 'var(--color-ink-600)' : 'var(--color-ink-300)'}
          >
            {round2Label}
          </text>

          {field.length === 0 ? (
            <text x={(AXIS_X + W) / 2} y={H / 2} textAnchor="middle" fontSize="12" fill="var(--color-ink-400)">
              {emptyHint}
            </text>
          ) : null}

          {/* Connectors from each star's round-1 dot to its round-2 dot */}
          {revealed
            ? field.map((p, i) =>
                starSet.has(i) ? (
                  <line
                    key={`c${i}`}
                    x1={COL1_X}
                    y1={scoreToY(p.s1)}
                    x2={COL2_X}
                    y2={scoreToY(p.s2)}
                    stroke="var(--color-accent-500)"
                    strokeWidth="1.25"
                    strokeOpacity="0.5"
                  />
                ) : null,
              )
            : null}

          {/* Round-1 dots */}
          {field.map((p, i) => {
            const star = starSet.has(i);
            return (
              <circle
                key={`a${i}`}
                cx={COL1_X}
                cy={scoreToY(p.s1)}
                r={star ? 5 : 3.5}
                fill={star ? 'var(--color-accent-500)' : 'var(--color-brand-300)'}
                fillOpacity={star ? 1 : 0.6}
              />
            );
          })}

          {/* Round-2 dots (only the stars, once revealed) */}
          {revealed
            ? field.map((p, i) =>
                starSet.has(i) ? (
                  <circle
                    key={`b${i}`}
                    cx={COL2_X}
                    cy={scoreToY(p.s2)}
                    r={5}
                    fill="var(--color-accent-600)"
                  />
                ) : null,
              )
            : null}

          {/* Average markers for the star group */}
          {field.length > 0 ? (
            <g>
              <line
                x1={COL1_X - 14}
                y1={scoreToY(stats.r1)}
                x2={COL1_X + 14}
                y2={scoreToY(stats.r1)}
                stroke="var(--color-ink-900)"
                strokeWidth="2.5"
              />
              {revealed ? (
                <line
                  x1={COL2_X - 14}
                  y1={scoreToY(stats.r2)}
                  x2={COL2_X + 14}
                  y2={scoreToY(stats.r2)}
                  stroke="var(--color-ink-900)"
                  strokeWidth="2.5"
                />
              ) : null}
            </g>
          ) : null}
        </svg>
      </div>

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
          { k: r1Label, v: field.length ? round(stats.r1) : '—' },
          { k: r2Label, v: revealed ? round(stats.r2) : '—' },
          { k: meanLabel, v: round(FIELD_MEAN) },
          { k: shrinkLabel, v: revealed ? `${round(stats.shrink)}%` : '—' },
        ].map((s, i) => (
          <div key={i} className="rounded-card border border-ink-100 bg-surface-sunken p-2.5 text-center">
            <dt className="text-[0.6rem] font-bold uppercase tracking-wide text-ink-500">{s.k}</dt>
            <dd className="mt-0.5 font-mono text-base font-semibold text-ink-900">{s.v}</dd>
          </div>
        ))}
      </dl>

      {/* Luck slider */}
      <div className="mt-5">
        <label htmlFor={`${reactId}-l`} className="text-[0.65rem] font-bold uppercase tracking-wide text-ink-500">
          {luckLabel}
        </label>
        <input
          id={`${reactId}-l`}
          type="range"
          min={0}
          max={100}
          step={1}
          value={luckPct}
          onChange={(e) => {
            setLuckPct(Number(e.target.value));
            setField([]);
            setRevealed(false);
          }}
          aria-valuetext={`${luckPct}% luck`}
          className="mt-1 h-1.5 w-full cursor-pointer accent-accent-500"
        />
        <div className="mt-1 flex justify-between text-[0.65rem] font-medium text-ink-500">
          <span>{skillEndLabel}</span>
          <span>{luckEndLabel}</span>
        </div>
      </div>

      {/* Buttons */}
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={deal}
          className="brutal-btn bg-surface px-4 py-2 text-sm text-ink-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
        >
          {dealLabel}
        </button>
        <button
          type="button"
          onClick={() => setRevealed(true)}
          disabled={field.length === 0 || revealed}
          className="brutal-btn bg-brand-600 px-4 py-2 text-sm text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {playLabel}
        </button>
      </div>

      {caption ? <figcaption className="mt-3 text-sm text-ink-500">{caption}</figcaption> : null}
    </figure>
  );
}

export default RegressionScatter;
