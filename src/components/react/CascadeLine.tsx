import { useId, useMemo, useState } from 'react';
import { cx } from '@/components/react/cx';

/** Props for the {@link CascadeLine} island. */
export interface CascadeLineProps {
  /** Heading above the card. */
  title?: string;
  /** Eyebrow label. Defaults to `'Information cascades — the line of deciders'`. */
  eyebrow?: string;
  /** Instruction line above the row. */
  instructions?: string;
  /** Caption beneath the card. */
  caption?: string;
  /** How many deciders stand in the line. Clamped to 6–30. Defaults to `14`. */
  population?: number;
  /** Starting private-signal accuracy, `55`–`95` (%). Defaults to `70`. */
  initialAccuracy?: number;
  /** Which option is *actually* correct at the start: `'A'` or `'B'`. Defaults to `'A'`. */
  initialTruth?: 'A' | 'B';
  /** Whether a public signal (pointing at the truth) starts ON. Defaults to `false`. */
  initialPublicSignal?: boolean;
  /** Label for option A. Defaults to `'Blue'`. */
  optionALabel?: string;
  /** Label for option B. Defaults to `'Red'`. */
  optionBLabel?: string;
  /** Label for the accuracy slider. */
  accuracyLabel?: string;
  /** Label for the true-state toggle. Defaults to `'Which option is really correct'`. */
  truthLabel?: string;
  /** Label for the public-signal toggle. */
  publicSignalLabel?: string;
  /** Text on the public-signal toggle when ON. Defaults to `'Public signal ON'`. */
  publicOnText?: string;
  /** Text on the public-signal toggle when OFF. Defaults to `'No public signal'`. */
  publicOffText?: string;
  /** Reset button label. Defaults to `'Reset'`. */
  resetLabel?: string;
  /** Small caption above each decider's private signal. Defaults to `'signal'`. */
  signalCaption?: string;
  /** Small caption above each decider's public choice. Defaults to `'chose'`. */
  choiceCaption?: string;
  /** Legend text for a decider who used their own signal. Defaults to `'Used own signal'`. */
  usedOwnLabel?: string;
  /** Legend text for a decider swept up in the cascade. Defaults to `'Copied the herd'`. */
  herdedLabel?: string;
  /** Legend text for a decider who overrode their own signal to follow the herd. */
  againstSelfLabel?: string;
  /**
   * Readout template. Placeholders: `{used}` signals that actually informed the
   * line, `{n}` total deciders, `{herd}` how many overrode their own signal to
   * copy the herd, `{locked}` the position where the cascade locked (or the
   * `neverText`).
   */
  readoutTemplate?: string;
  /** Word/phrase substituted for `{locked}` when no cascade ever locks. Defaults to `'never'`. */
  neverText?: string;
  /** Verdict when the line locks onto the correct option. */
  correctVerdict?: string;
  /** Verdict when the line locks onto the wrong option. */
  wrongVerdict?: string;
  /** Verdict when no cascade forms (everyone keeps voting their own signal). */
  noCascadeVerdict?: string;
  /** Extra classes merged onto the root element. */
  className?: string;
}

/** A deterministic PRNG (mulberry32) so SSR and hydration agree — no flicker,
 *  no `Math.random()` / `Date.now()`. */
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

const SEED = 0xca5cade;

type Opt = 'A' | 'B';

interface Decider {
  signal: Opt;
  choice: Opt;
  /** Was |public tally| already ≥ 2 when this person acted? Then their action reveals nothing. */
  inCascade: boolean;
  /** Did they end up choosing what their own signal said? */
  followedOwn: boolean;
}

/**
 * Run the whole line deterministically.
 *
 * Model (Bikhchandani–Hirshleifer–Welch, simplified to the standard integer
 * form): two equally likely states A/B, one is the truth. Each decider draws a
 * private binary **signal** that points at the truth with probability
 * `accuracy`. They act *in order*, seeing only the earlier **choices** — never
 * anyone's signal. A rational Bayesian with a symmetric prior compares the
 * public tally `net = (#A − #B)` against their single signal:
 *
 *   score = net + (signal === 'A' ? +1 : −1)  →  choose A if >0, B if <0,
 *   and follow your own signal on a tie.
 *
 * The moment `|net| ≥ 2`, one private signal can never overturn the public
 * tally, so the decider **rationally ignores their own signal and copies the
 * herd** — an information cascade. Their action then reveals nothing, so the
 * tally is frozen and everyone after them is trapped in the same place. A
 * `public signal` adds a fixed, everyone-sees-it offset toward the truth that
 * can start (or, pointed the other way, break) the cascade.
 */
function runLine(
  n: number,
  accuracy: number,
  truth: Opt,
  publicSignal: boolean,
): Decider[] {
  const rng = mulberry32((SEED ^ (Math.round(accuracy * 100) * 2654435761) ^ (truth === 'A' ? 11 : 29)) >>> 0);
  // A public signal is a strong, shared observation of the truth: a persistent
  // +2 (toward A) or −2 (toward B) offset every decider can see.
  const offset = publicSignal ? (truth === 'A' ? 2 : -2) : 0;
  let net = offset;
  const out: Decider[] = [];
  for (let i = 0; i < n; i += 1) {
    const r = rng();
    const signal: Opt = r < accuracy ? truth : truth === 'A' ? 'B' : 'A';
    const inCascade = Math.abs(net) >= 2;
    const score = net + (signal === 'A' ? 1 : -1);
    const choice: Opt = score > 0 ? 'A' : score < 0 ? 'B' : signal;
    out.push({ signal, choice, inCascade, followedOwn: choice === signal });
    net += choice === 'A' ? 1 : -1;
  }
  return out;
}

/**
 * **Cascade line** — a queue of rational deciders that lets you *watch* an
 * information cascade form, lock, and (with a public signal) break.
 *
 * Every person has a private noisy **signal** about which of two options is
 * correct, and they decide one after another seeing only the earlier
 * **choices**. Turn the signal accuracy down and watch how a couple of unlucky
 * early picks can stampede everyone downstream into copying the herd *against
 * their own private evidence* — the cascade is informationally empty (almost no
 * private signals actually get used) yet self-perpetuating, and it can lock onto
 * the wrong option. Then drop in a **public signal** and watch a single shared
 * observation reroute — or, if it pointed the wrong way, doom — the entire line.
 *
 * Fully deterministic (seeded PRNG, no autoplay), so the server render is stable
 * and nothing fights `prefers-reduced-motion`. All meaning lives in the
 * `aria-live` readout; the row of deciders is decorative for screen readers.
 */
export function CascadeLine({
  title,
  eyebrow = 'Information cascades — the line of deciders',
  instructions = 'Each person in the line has a private signal about which option is right, and decides seeing only the earlier choices. Lower the signal accuracy and watch a couple of early picks stampede everyone into copying the herd — even against their own evidence. Then drop a public signal and watch it reroute the whole line.',
  caption,
  population = 14,
  initialAccuracy = 70,
  initialTruth = 'A',
  initialPublicSignal = false,
  optionALabel = 'Blue',
  optionBLabel = 'Red',
  accuracyLabel = 'Private-signal accuracy (how often each signal points at the truth)',
  truthLabel = 'Which option is really correct',
  publicSignalLabel = 'Public signal — a shared observation everyone can see',
  publicOnText = 'Public signal ON',
  publicOffText = 'No public signal',
  resetLabel = 'Reset',
  signalCaption = 'signal',
  choiceCaption = 'chose',
  usedOwnLabel = 'Used own signal',
  herdedLabel = 'Copied the herd',
  againstSelfLabel = 'Overrode own signal',
  readoutTemplate = 'Only {used} of {n} private signals actually informed the line — {herd} people overrode their own evidence to copy the herd. Cascade locked at position {locked}.',
  neverText = 'never',
  correctVerdict = 'The line landed on the CORRECT option — but almost by luck: it rode a handful of early signals, not the crowd’s combined knowledge.',
  wrongVerdict = 'The line stampeded onto the WRONG option. A rational herd, aggregating almost none of its own information, locked in a mistake.',
  noCascadeVerdict = 'No cascade formed — everyone kept voting their own signal, so the line actually pooled its private information.',
  className,
}: CascadeLineProps) {
  const reactId = useId();
  const n = Math.max(6, Math.min(30, Math.round(population)));

  const clampA = (x: number) => Math.max(55, Math.min(95, Math.round(x)));
  const [accuracyPct, setAccuracyPct] = useState(() => clampA(initialAccuracy));
  const [truth, setTruth] = useState<Opt>(() => (initialTruth === 'B' ? 'B' : 'A'));
  const [publicSignal, setPublicSignal] = useState(() => Boolean(initialPublicSignal));

  const line = useMemo(
    () => runLine(n, accuracyPct / 100, truth, publicSignal),
    [n, accuracyPct, truth, publicSignal],
  );

  const stats = useMemo(() => {
    const used = line.filter((d) => !d.inCascade).length;
    const herd = line.filter((d) => d.inCascade && !d.followedOwn).length;
    const lockedIdx = line.findIndex((d) => d.inCascade);
    const finalChoice = line[line.length - 1].choice;
    const landedCorrect = finalChoice === truth;
    const cascaded = lockedIdx !== -1;
    return { used, herd, lockedIdx, finalChoice, landedCorrect, cascaded };
  }, [line, truth]);

  const readout = readoutTemplate
    .replace('{used}', String(stats.used))
    .replace('{n}', String(n))
    .replace('{herd}', String(stats.herd))
    .replace('{locked}', stats.cascaded ? String(stats.lockedIdx + 1) : neverText);

  const verdict = !stats.cascaded
    ? noCascadeVerdict
    : stats.landedCorrect
      ? correctVerdict
      : wrongVerdict;

  const optClasses = (o: Opt, kind: 'signal' | 'choice') =>
    kind === 'signal'
      ? o === 'A'
        ? 'text-brand-600'
        : 'text-accent-600'
      : o === 'A'
        ? 'bg-brand-500 text-white'
        : 'bg-accent-500 text-white';

  const optLabel = (o: Opt) => (o === 'A' ? optionALabel : optionBLabel);

  const reset = () => {
    setAccuracyPct(clampA(initialAccuracy));
    setTruth(initialTruth === 'B' ? 'B' : 'A');
    setPublicSignal(Boolean(initialPublicSignal));
  };

  return (
    <figure className={cx('brutal my-6 bg-surface p-5 sm:p-6', className)}>
      <p className="font-display text-xs font-semibold uppercase tracking-wide text-accent-600">
        {eyebrow}
      </p>
      {title ? (
        <p className="mt-1 font-display text-lg font-semibold text-ink-900">{title}</p>
      ) : null}

      <p className="mt-2 text-sm font-medium text-ink-700">{instructions}</p>

      {/* The line of deciders. Decorative — meaning lives in the readout. */}
      <div aria-hidden className="mt-4 flex flex-wrap gap-1.5">
        {line.map((d, i) => {
          const against = d.inCascade && !d.followedOwn;
          return (
            <div
              key={`${reactId}-d-${i}`}
              className={cx(
                'flex flex-col items-center gap-0.5 rounded-card border p-1.5 transition-colors duration-200 motion-reduce:transition-none',
                against
                  ? 'border-ink-900/40 bg-surface-sunken'
                  : d.inCascade
                    ? 'border-ink-200 bg-surface-sunken'
                    : 'border-transparent bg-transparent',
              )}
              style={{ minWidth: '2.1rem' }}
            >
              <span className="text-[0.5rem] font-bold uppercase tracking-wide text-ink-400">
                {i + 1}
              </span>
              {/* private signal */}
              <span
                className={cx('text-[0.7rem] font-bold leading-none', optClasses(d.signal, 'signal'))}
                title={`${signalCaption}: ${optLabel(d.signal)}`}
              >
                {d.signal}
              </span>
              {/* public choice */}
              <span
                className={cx(
                  'flex size-6 items-center justify-center rounded-[4px] font-display text-sm font-bold leading-none',
                  optClasses(d.choice, 'choice'),
                )}
                title={`${choiceCaption}: ${optLabel(d.choice)}`}
              >
                {d.choice}
              </span>
              {against ? (
                <span aria-hidden className="text-[0.6rem] leading-none text-ink-900">
                  ⚠
                </span>
              ) : (
                <span aria-hidden className="text-[0.6rem] leading-none text-transparent">
                  ·
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[0.7rem] font-semibold text-ink-600">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="size-3 rounded-[2px] border border-transparent bg-surface-sunken ring-1 ring-inset ring-ink-900/10" />
          {herdedLabel}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="size-3 rounded-[2px] border border-ink-900/40 bg-surface-sunken" />
          {againstSelfLabel}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="text-[0.7rem] font-bold text-ink-400">A/B</span>
          {usedOwnLabel}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="size-3 rounded-[2px] bg-brand-500" />
          {optionALabel}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="size-3 rounded-[2px] bg-accent-500" />
          {optionBLabel}
        </span>
      </div>

      {/* Live readout + verdict */}
      <p aria-live="polite" className="mt-4 font-display text-base font-semibold text-ink-900">
        {readout}{' '}
        <span
          className={cx(
            stats.cascaded && stats.landedCorrect && 'text-brand-600',
            stats.cascaded && !stats.landedCorrect && 'text-accent-600',
          )}
        >
          {verdict}
        </span>
      </p>

      {/* Accuracy slider */}
      <div className="mt-4">
        <div className="flex items-center justify-between text-[0.65rem] font-bold uppercase tracking-wide text-ink-500">
          <label htmlFor={`${reactId}-a`}>{accuracyLabel}</label>
          <span>{accuracyPct}%</span>
        </div>
        <input
          id={`${reactId}-a`}
          type="range"
          min={55}
          max={95}
          step={1}
          value={accuracyPct}
          onChange={(e) => setAccuracyPct(clampA(Number(e.target.value)))}
          aria-valuetext={`${accuracyPct}%`}
          className="mt-1 h-1.5 w-full cursor-pointer accent-accent-500"
        />
      </div>

      {/* Truth toggle + public-signal toggle + reset */}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <span className="text-[0.65rem] font-bold uppercase tracking-wide text-ink-500">
          {truthLabel}
        </span>
        <div className="inline-flex overflow-hidden rounded-pill ring-1 ring-inset ring-ink-300">
          <button
            type="button"
            aria-pressed={truth === 'A'}
            onClick={() => setTruth('A')}
            className={cx(
              'px-3 py-1.5 font-display text-sm font-semibold transition-colors motion-reduce:transition-none',
              truth === 'A' ? 'bg-brand-500 text-white' : 'bg-surface text-ink-600 hover:bg-surface-sunken',
            )}
          >
            {optionALabel}
          </button>
          <button
            type="button"
            aria-pressed={truth === 'B'}
            onClick={() => setTruth('B')}
            className={cx(
              'px-3 py-1.5 font-display text-sm font-semibold transition-colors motion-reduce:transition-none',
              truth === 'B' ? 'bg-accent-500 text-white' : 'bg-surface text-ink-600 hover:bg-surface-sunken',
            )}
          >
            {optionBLabel}
          </button>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <span className="text-[0.65rem] font-bold uppercase tracking-wide text-ink-500">
          {publicSignalLabel}
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={publicSignal}
          onClick={() => setPublicSignal((s) => !s)}
          className={cx(
            'brutal-btn px-4 py-2 font-display text-sm text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600',
            publicSignal ? 'bg-accent-500' : 'bg-ink-400',
          )}
        >
          {publicSignal ? publicOnText : publicOffText}
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

export default CascadeLine;
