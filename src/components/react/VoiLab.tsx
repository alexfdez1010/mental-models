import { useId, useMemo, useState } from 'react';
import { cx } from '@/components/react/cx';

/** Props for the {@link VoiLab} island. */
export interface VoiLabProps {
  /** Heading above the card. */
  title?: string;
  /** Eyebrow label. Defaults to `'Value-of-information lab'`. */
  eyebrow?: string;
  /** Instruction line above the exercise. */
  instructions?: string;
  /** Caption beneath the card. */
  caption?: string;

  /** Currency prefix used on every money figure. Defaults to `'$'`. */
  currencyPrefix?: string;

  /** Starting prior probability the world is in the good state, percent 0–100. Defaults to `40`. */
  initialPrior?: number;
  /** Starting test reliability, percent 50–100. Defaults to `75`. */
  initialReliability?: number;
  /** Starting price of the test, in currency units. Defaults to `15`. */
  initialCost?: number;
  /** Starting payoff of acting in the good state. Defaults to `100`. */
  initialGain?: number;
  /** Starting loss of acting in the bad state (a positive number). Defaults to `80`. */
  initialLoss?: number;
  /** Highest price the cost slider allows. Defaults to `60`. */
  maxCost?: number;
  /** Highest payoff the gain/loss sliders allow. Defaults to `200`. */
  maxPayoff?: number;

  /** Name of the act-now action. Defaults to `'Act'`. */
  actionLabel?: string;
  /** Name of the wait/walk-away action. Defaults to `'Walk away'`. */
  inactionLabel?: string;
  /** Name of the good state of the world. Defaults to `'Good'`. */
  goodStateLabel?: string;
  /** Name of the bad state of the world. Defaults to `'Bad'`. */
  badStateLabel?: string;

  /** Prior slider label. Defaults to `'Prior: chance the world is good'`. */
  priorLabel?: string;
  /** Reliability slider label. Defaults to `'Test reliability'`. */
  reliabilityLabel?: string;
  /** Cost slider label. Defaults to `'Price of the test'`. */
  costLabel?: string;
  /** Gain slider label. Defaults to `'Payoff if you act and it is good'`. */
  gainLabel?: string;
  /** Loss slider label. Defaults to `'Loss if you act and it is bad'`. */
  lossLabel?: string;

  /** Bar label for the best action on the prior alone. Defaults to `'Act now'`. */
  actNowBarLabel?: string;
  /** Bar label for acting after buying the test. Defaults to `'Buy the test'`. */
  testBarLabel?: string;
  /** Bar label for the perfect-information ceiling. Defaults to `'Crystal ball'`. */
  perfectBarLabel?: string;
  /** Label for the ceiling line. Defaults to `'Perfect-info ceiling (EVPI)'`. */
  ceilingLabel?: string;
  /** Label tagged on the info-gain portion of a bar. Defaults to `'value of info'`. */
  infoGainLabel?: string;
  /** Label tagged on the price the test eats. Defaults to `'price'`. */
  priceTagLabel?: string;

  /** Stat tile: expected value of perfect information. Defaults to `'EVPI (ceiling)'`. */
  evpiLabel?: string;
  /** Stat tile: expected value of this sample/imperfect test. Defaults to `'EVSI (this test)'`. */
  evsiLabel?: string;
  /** Stat tile: net value after the test's price. Defaults to `'Net of price'`. */
  netLabel?: string;

  /**
   * Decision readout template. Placeholders: `{prior}` best prior action,
   * `{pos}` action after a positive result, `{neg}` action after a negative
   * result. Defaults to a sentence describing the three.
   */
  decisionTemplate?: string;
  /** Word inserted for a positive test result. Defaults to `'a green light'`. */
  positiveResultLabel?: string;
  /** Word inserted for a negative test result. Defaults to `'a red flag'`. */
  negativeResultLabel?: string;

  /**
   * Verdict when the test can never flip your decision. Placeholder `{prior}`.
   * Defaults to the "value 0" message.
   */
  worthlessVerdict?: string;
  /**
   * Verdict when the test is informative and worth its price. Placeholders
   * `{net}`, `{evsi}`, `{cost}`.
   */
  worthItVerdict?: string;
  /**
   * Verdict when the test is informative but costs more than it is worth.
   * Placeholders `{net}`, `{evsi}`, `{cost}`.
   */
  overpricedVerdict?: string;

  /**
   * Live readout template. Placeholders: `{evpi}`, `{evsi}`, `{net}`, `{prior}`
   * (as a percent), `{decision}` (best prior action), `{cost}`.
   */
  readoutTemplate?: string;

  /** Extra classes merged onto the root element. */
  className?: string;
}

// ── Chart geometry ──────────────────────────────────────────────────────────
const W = 460;
const H = 260;
const PAD_L = 44;
const PAD_R = 16;
const PAD_T = 24;
const PAD_B = 44;
const PLOT_W = W - PAD_L - PAD_R;
const PLOT_H = H - PAD_T - PAD_B;

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

/**
 * Interactive **value-of-information lab** — the single sharpest question in
 * applied decision-making made tactile: *could the answer actually change what I
 * do?* The learner faces a two-action decision (act vs. walk away) under two
 * uncertain states (good vs. bad), with an editable payoff table and a prior
 * slider. A noisy test with adjustable **reliability** and **price** can be
 * bought before deciding.
 *
 * The chart shows three heights on one scale: the best you can do acting on the
 * **prior alone**, the expected value **with the noisy test** (its information
 * gain tinted on top, its price deducted), and the **perfect-information
 * ceiling** a clairvoyant would reach. Read straight off it: EVSI ≤ EVPI always,
 * and the moment the prior grows lopsided enough — or the decision one-sided —
 * the test stops being able to flip the action and its value collapses to **zero**,
 * no matter how accurate or how cheap it is.
 *
 * All maths is pure and deterministic (no `Math.random`), so the server render
 * matches the client. Controls are native range inputs; the verdict is announced
 * via `aria-live`. Nothing autoplays, so there is no motion to fight
 * `prefers-reduced-motion`.
 */
export function VoiLab({
  title,
  eyebrow = 'Value-of-information lab',
  instructions = 'You can act or walk away, and the world is either good or bad. Move the prior, the payoffs, and a noisy test’s reliability and price. Watch what the test is worth — and watch its value crash to zero the moment it can no longer change your decision.',
  caption,
  currencyPrefix = '$',
  initialPrior = 40,
  initialReliability = 75,
  initialCost = 15,
  initialGain = 100,
  initialLoss = 80,
  maxCost = 60,
  maxPayoff = 200,
  actionLabel = 'Act',
  inactionLabel = 'Walk away',
  goodStateLabel = 'Good',
  badStateLabel = 'Bad',
  priorLabel = 'Prior: chance the world is good',
  reliabilityLabel = 'Test reliability',
  costLabel = 'Price of the test',
  gainLabel = 'Payoff if you act and it is good',
  lossLabel = 'Loss if you act and it is bad',
  actNowBarLabel = 'Act now',
  testBarLabel = 'Buy the test',
  perfectBarLabel = 'Crystal ball',
  ceilingLabel = 'Perfect-info ceiling (EVPI)',
  infoGainLabel = 'value of info',
  priceTagLabel = 'price',
  evpiLabel = 'EVPI (ceiling)',
  evsiLabel = 'EVSI (this test)',
  netLabel = 'Net of price',
  decisionTemplate = 'On the prior alone you would {prior}. After {pos} you would {posAction}; after {neg} you would {negAction}.',
  positiveResultLabel = 'a green light',
  negativeResultLabel = 'a red flag',
  worthlessVerdict = 'This test cannot change your decision → its value is 0. Whatever it says, you would {prior} anyway, so a green light and a red flag lead to the same move. No accuracy and no discount can rescue a test that never flips the action.',
  worthItVerdict = 'Worth buying: the test is worth {evsi} in averted mistakes and costs {cost}, so it nets you {net}. It can flip your decision, and the flip is worth more than the price.',
  overpricedVerdict = 'Informative but overpriced: the test is worth only {evsi} yet costs {cost}, so buying it nets {net}. The answer could change your mind — but not by enough to pay for it. Act on your prior instead.',
  readoutTemplate = 'Acting on your prior ({prior} good) you would {decision}. A crystal ball would be worth {evpi} (the ceiling); this noisy test is worth {evsi} and costs {cost}, for a net of {net}.',
  className,
}: VoiLabProps) {
  const reactId = useId();
  const [prior, setPrior] = useState(initialPrior);
  const [reliability, setReliability] = useState(initialReliability);
  const [cost, setCost] = useState(initialCost);
  const [gain, setGain] = useState(initialGain);
  const [loss, setLoss] = useState(initialLoss);

  const money = (n: number) =>
    `${n < 0 ? '−' : ''}${currencyPrefix}${Math.abs(n).toFixed(0)}`;

  const m = useMemo(() => {
    const p = clamp(prior, 0, 100) / 100;
    const r = clamp(reliability, 50, 100) / 100;
    const g = gain;
    const l = loss;

    // Best action on the prior alone. Acting pays g in the good state and −l in
    // the bad one; walking away pays 0. So the value of acting is p·g − (1−p)·l.
    const evAct = p * g - (1 - p) * l;
    const v0 = Math.max(evAct, 0); // walking away is always available at 0
    const priorActs = evAct > 0;

    // Perfect information: a clairvoyant acts only in the good state.
    const evPerfect = p * Math.max(g, 0);
    const evpi = Math.max(evPerfect - v0, 0);

    // A noisy test. P(positive | good) = P(negative | bad) = r (symmetric).
    const pPos = p * r + (1 - p) * (1 - r);
    const pNeg = p * (1 - r) + (1 - p) * r;
    const postPos = pPos > 0 ? (p * r) / pPos : p; // P(good | positive)
    const postNeg = pNeg > 0 ? (p * (1 - r)) / pNeg : p; // P(good | negative)

    const evActPos = postPos * g - (1 - postPos) * l;
    const evActNeg = postNeg * g - (1 - postNeg) * l;
    const actPos = evActPos > 0;
    const actNeg = evActNeg > 0;

    const evTest = pPos * Math.max(evActPos, 0) + pNeg * Math.max(evActNeg, 0);
    const evsi = Math.max(evTest - v0, 0);
    const net = evsi - cost;

    // The test only has value if the two possible results lead to different
    // actions. If they don't, EVSI is 0 and no price makes it worth buying.
    const canFlip = actPos !== actNeg;

    return {
      p,
      v0,
      priorActs,
      evPerfect,
      evpi,
      evTest,
      evsi,
      net,
      actPos,
      actNeg,
      canFlip,
    };
  }, [prior, reliability, cost, gain, loss]);

  // Shared y-scale across the three bars: top of the plot is the ceiling.
  const yMax = Math.max(m.evPerfect, m.v0, 1) * 1.12;
  const yScale = (v: number) => PAD_T + PLOT_H - (clamp(v, 0, yMax) / yMax) * PLOT_H;
  const barH = (v: number) => (clamp(v, 0, yMax) / yMax) * PLOT_H;

  const bars = [
    { key: 'now', label: actNowBarLabel, total: m.v0, base: m.v0, gain: 0 },
    { key: 'test', label: testBarLabel, total: m.evTest, base: m.v0, gain: m.evsi },
    { key: 'perfect', label: perfectBarLabel, total: m.evPerfect, base: m.v0, gain: m.evpi },
  ];
  const bandW = PLOT_W / bars.length;
  const barW = Math.min(bandW * 0.5, 64);

  const priorWord = m.priorActs ? actionLabel : inactionLabel;
  const posWord = m.actPos ? actionLabel : inactionLabel;
  const negWord = m.actNeg ? actionLabel : inactionLabel;

  const fill = (t: string) =>
    t
      .replace('{prior}', priorWord.toLowerCase())
      .replace('{decision}', priorWord.toLowerCase())
      .replace('{pos}', positiveResultLabel)
      .replace('{neg}', negativeResultLabel)
      .replace('{posAction}', posWord.toLowerCase())
      .replace('{negAction}', negWord.toLowerCase())
      .replace('{evpi}', money(m.evpi))
      .replace('{evsi}', money(m.evsi))
      .replace('{net}', money(m.net))
      .replace('{cost}', money(cost));

  const verdict = !m.canFlip
    ? fill(worthlessVerdict)
    : m.net >= 0
      ? fill(worthItVerdict)
      : fill(overpricedVerdict);

  const readout = fill(readoutTemplate);
  const decision = fill(decisionTemplate);

  return (
    <figure className={cx('brutal my-6 bg-surface p-5 sm:p-6', className)}>
      <p className="font-display text-xs font-semibold uppercase tracking-wide text-accent-600">
        {eyebrow}
      </p>
      {title ? (
        <p className="mt-1 font-display text-lg font-semibold text-ink-900">{title}</p>
      ) : null}

      <p className="mt-2 text-sm font-medium text-ink-700">{instructions}</p>

      {/* Bar chart */}
      <div className="mt-4 overflow-hidden rounded-card border border-ink-100 bg-surface-sunken">
        <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={readout}>
          <rect x="0" y="0" width={W} height={H} fill="var(--color-surface-sunken)" />

          {/* Y axis */}
          <line x1={PAD_L} y1={PAD_T} x2={PAD_L} y2={PAD_T + PLOT_H} stroke="var(--color-ink-300)" strokeWidth="1.5" />
          <line x1={PAD_L} y1={PAD_T + PLOT_H} x2={PAD_L + PLOT_W} y2={PAD_T + PLOT_H} stroke="var(--color-ink-300)" strokeWidth="1.5" />

          {/* Y ticks at 0, half, ceiling */}
          {[0, yMax / 2, yMax].map((t, i) => (
            <g key={i}>
              <line x1={PAD_L} y1={yScale(t)} x2={PAD_L + PLOT_W} y2={yScale(t)} stroke="var(--color-ink-100)" strokeWidth="1" />
              <text x={PAD_L - 6} y={yScale(t) + 3} textAnchor="end" fontSize="9" fill="var(--color-ink-400)">
                {money(t)}
              </text>
            </g>
          ))}

          {/* Perfect-info ceiling line */}
          <line
            x1={PAD_L}
            y1={yScale(m.evPerfect)}
            x2={PAD_L + PLOT_W}
            y2={yScale(m.evPerfect)}
            stroke="var(--color-brand-400)"
            strokeWidth="2"
            strokeDasharray="5 4"
          />
          <text x={PAD_L + PLOT_W} y={yScale(m.evPerfect) - 5} textAnchor="end" fontSize="9" fill="var(--color-brand-600)">
            {ceilingLabel}
          </text>

          {bars.map((b, i) => {
            const cx0 = PAD_L + bandW * i + bandW / 2;
            const x = cx0 - barW / 2;
            const baseY = yScale(b.base);
            const topY = yScale(b.total);
            const bottomY = PAD_T + PLOT_H;
            const isTest = b.key === 'test';
            const netNeg = isTest && m.net < 0;
            return (
              <g key={b.key}>
                {/* base (value you already have without info) */}
                <rect
                  x={x}
                  y={baseY}
                  width={barW}
                  height={bottomY - baseY}
                  fill="var(--color-ink-200)"
                  stroke="var(--color-ink-300)"
                  strokeWidth="1"
                />
                {/* info-gain increment on top */}
                {b.gain > 0.5 ? (
                  <rect
                    x={x}
                    y={topY}
                    width={barW}
                    height={baseY - topY}
                    fill={isTest ? 'var(--color-accent-500)' : 'var(--color-brand-400)'}
                    stroke="var(--color-surface)"
                    strokeWidth="1"
                  />
                ) : null}
                {/* the price the test eats, hatched down from its top */}
                {isTest && cost > 0 ? (
                  <rect
                    x={x}
                    y={topY}
                    width={barW}
                    height={clamp(barH(m.v0 + m.evsi) - barH(m.v0 + m.evsi - cost), 0, baseY - topY + 40)}
                    fill="color-mix(in oklab, var(--color-danger) 30%, transparent)"
                  />
                ) : null}
                {/* net line on the test bar */}
                {isTest ? (
                  <line
                    x1={x - 3}
                    x2={x + barW + 3}
                    y1={yScale(Math.max(m.v0 + m.net, 0))}
                    y2={yScale(Math.max(m.v0 + m.net, 0))}
                    stroke={netNeg ? 'var(--color-danger)' : 'var(--color-ink-900)'}
                    strokeWidth="2"
                  />
                ) : null}
                {/* total value on top */}
                <text x={cx0} y={topY - 6} textAnchor="middle" fontSize="10" fontWeight="600" fill="var(--color-ink-700)">
                  {money(b.total)}
                </text>
                {/* bar label */}
                <text x={cx0} y={bottomY + 14} textAnchor="middle" fontSize="10" fill="var(--color-ink-600)">
                  {b.label}
                </text>
                {/* info-gain tag */}
                {b.gain > yMax * 0.06 ? (
                  <text
                    x={cx0}
                    y={(topY + baseY) / 2 + 3}
                    textAnchor="middle"
                    fontSize="8"
                    fill="var(--color-surface)"
                    fontWeight="600"
                  >
                    {i === 1 ? infoGainLabel : ''}
                  </text>
                ) : null}
              </g>
            );
          })}
        </svg>
      </div>

      {/* Decision line */}
      <p className="mt-3 rounded-card border border-ink-100 bg-surface-sunken p-3 text-xs font-medium leading-relaxed text-ink-600">
        {decision}
      </p>

      {/* Live verdict */}
      <p
        aria-live="polite"
        className={cx(
          'mt-3 rounded-card border p-3 text-sm leading-relaxed',
          !m.canFlip
            ? 'border-danger/40 bg-danger/10 text-ink-800'
            : m.net >= 0
              ? 'border-brand-300 bg-brand-50/70 text-ink-700'
              : 'border-accent-300 bg-accent-300/20 text-ink-700',
        )}
      >
        {verdict}
      </p>

      {/* Stat tiles */}
      <dl className="mt-4 grid grid-cols-3 gap-3">
        {[
          { k: evpiLabel, v: money(m.evpi) },
          { k: evsiLabel, v: money(m.evsi) },
          { k: netLabel, v: money(m.net) },
        ].map((s, i) => (
          <div key={i} className="rounded-card border border-ink-100 bg-surface-sunken p-2.5 text-center">
            <dt className="text-[0.6rem] font-bold uppercase tracking-wide text-ink-500">{s.k}</dt>
            <dd className="mt-0.5 font-mono text-base font-semibold text-ink-900">{s.v}</dd>
          </div>
        ))}
      </dl>

      {/* Sliders */}
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <Slider
          id={`${reactId}-prior`}
          label={priorLabel}
          value={prior}
          min={0}
          max={100}
          step={1}
          onChange={setPrior}
          display={`${prior}% ${goodStateLabel.toLowerCase()}`}
        />
        <Slider
          id={`${reactId}-rel`}
          label={reliabilityLabel}
          value={reliability}
          min={50}
          max={100}
          step={1}
          onChange={setReliability}
          display={`${reliability}%`}
        />
        <Slider
          id={`${reactId}-cost`}
          label={costLabel}
          value={cost}
          min={0}
          max={maxCost}
          step={1}
          onChange={setCost}
          display={money(cost)}
        />
        <Slider
          id={`${reactId}-gain`}
          label={gainLabel}
          value={gain}
          min={10}
          max={maxPayoff}
          step={5}
          onChange={setGain}
          display={money(gain)}
        />
        <Slider
          id={`${reactId}-loss`}
          label={lossLabel}
          value={loss}
          min={10}
          max={maxPayoff}
          step={5}
          onChange={setLoss}
          display={`−${money(loss)}`}
        />
      </div>

      {caption ? <figcaption className="mt-4 text-xs text-ink-500">{caption}</figcaption> : null}
    </figure>
  );
}

interface SliderProps {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (n: number) => void;
  display: string;
}

function Slider({ id, label, value, min, max, step, onChange, display }: SliderProps) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="text-[0.65rem] font-bold uppercase tracking-wide text-ink-600">
          {label}
        </label>
        <span className="font-mono text-xs font-semibold text-ink-900">{display}</span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-valuetext={display}
        className="mt-1 h-1.5 w-full cursor-pointer accent-brand-600"
      />
    </div>
  );
}

export default VoiLab;
