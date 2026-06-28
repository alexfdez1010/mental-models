import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { cx } from '@/components/react/cx';

/** Props for the {@link CoevolutionRace} island. */
export interface CoevolutionRaceProps {
  /** Starting capability for both racers (0–100 scale). Defaults to 50. */
  start?: number;
  /**
   * Per-generation innovation drive — how much each side improves on its own
   * before the catch-up term. Defaults to 4.
   */
  drive?: number;
  /**
   * Catch-up coefficient: how hard the laggard pushes to close the gap. Larger
   * values keep the two racers glued together. Defaults to 0.45.
   */
  catchUp?: number;
  /** Generations to run before the auto-runner stops. Defaults to 46. */
  maxGenerations?: number;
  /** Heading above the card. */
  title?: string;
  /** Eyebrow label. Defaults to `'Coevolution'`. */
  eyebrow?: string;
  /** Instruction line above the chart. */
  instructions?: string;
  /** Caption beneath the card. */
  caption?: string;
  /** Name of the learner's racer. Defaults to `'You'`. */
  youLabel?: string;
  /** Name of the rival racer. Defaults to `'Rival'`. */
  rivalLabel?: string;
  /** Y-axis label (the thing that climbs). Defaults to `'Capability'`. */
  capabilityLabel?: string;
  /** Label for the relative-advantage meter. Defaults to `'Your relative advantage'`. */
  relativeLabel?: string;
  /** Marker for the "even" mid-point of the meter. Defaults to `'Even'`. */
  evenLabel?: string;
  /** Text on the auto-run button. Defaults to `'Auto-run ▸'`. */
  playLabel?: string;
  /** Text on the pause button. Defaults to `'Pause'`. */
  pauseLabel?: string;
  /** Text on the advance-a-generation button. Defaults to `'Advance one generation ▸'`. */
  stepLabel?: string;
  /** Text on the opt-out toggle when running. Defaults to `'Stop running (opt out)'`. */
  optOutLabel?: string;
  /** Text on the opt-out toggle when already opted out. Defaults to `'Resume running'`. */
  resumeLabel?: string;
  /** Text on the reset button. Defaults to `'Reset'`. */
  resetLabel?: string;
  /** Word for a generation, used in the readout. Defaults to `'Generation'`. */
  generationLabel?: string;
  /**
   * Live readout template. `{gen}` (generation), `{you}` and `{rival}` (each
   * side's absolute capability) and `{rel}` (your signed lead) are replaced.
   */
  readoutTemplate?: string;
  /** Verdict shown while both keep adapting. */
  runningNote?: string;
  /** Verdict shown once the learner has opted out and is falling behind. */
  optedOutNote?: string;
  /** Extra classes merged onto the root element. */
  className?: string;
}

interface Point {
  you: number;
  rival: number;
}

/**
 * Interactive **coevolution race** — the Red Queen effect made visible.
 *
 * Two competitors ("you" and a rival) each have a `capability` that climbs over
 * generations. Crucially, the one that falls behind adapts *harder* (the
 * catch-up term), so as long as both keep running their two lines rise in near
 * lock-step: **absolute** capability soars while your **relative** advantage —
 * the gap that actually decides who wins — barely moves off zero. That is the
 * whole paradox: you sprint every generation just to *stay in the same place*.
 *
 * Press **Stop running (opt out)** and your line goes flat while the rival keeps
 * climbing: now the gap yawns open and your relative position collapses. Effort
 * bought you a standstill; stopping is fatal. The chart shows both absolute
 * lines; the meter below zooms into the relative gap that the chart hides.
 *
 * The chart is decorative for screen readers — the meaning lives in the
 * `aria-live` readout (generation + both capabilities + your signed lead) and
 * the verdict line. Auto-run is suppressed under `prefers-reduced-motion`; every
 * state is still reachable with the Step and opt-out buttons. Fully
 * keyboard-operable.
 */
export function CoevolutionRace({
  start = 50,
  drive = 4,
  catchUp = 0.45,
  maxGenerations = 46,
  title,
  eyebrow = 'Coevolution',
  instructions = 'Two rivals improve generation after generation — and whoever falls behind pushes harder to catch up. Advance the race (or let it auto-run) and watch both lines climb while the gap between them barely moves. Then opt out and see what standing still costs.',
  caption,
  youLabel = 'You',
  rivalLabel = 'Rival',
  capabilityLabel = 'Capability',
  relativeLabel = 'Your relative advantage',
  evenLabel = 'Even',
  playLabel = 'Auto-run ▸',
  pauseLabel = 'Pause',
  stepLabel = 'Advance one generation ▸',
  optOutLabel = 'Stop running (opt out)',
  resumeLabel = 'Resume running',
  resetLabel = 'Reset',
  generationLabel = 'Generation',
  readoutTemplate = '{generation} {gen}: your capability {you}, rival {rival} — relative lead {rel}.',
  runningNote = 'Both keep improving, yet your lead barely changes — you’re running flat out just to stay in the same place.',
  optedOutNote = 'You stopped adapting. The rival keeps climbing, so your relative position is collapsing — standing still here means falling behind.',
  className,
}: CoevolutionRaceProps) {
  if (!Number.isFinite(start) || start < 0) {
    throw new Error('CoevolutionRace: `start` must be a non-negative number.');
  }

  const reactId = useId();
  const seed: Point = { you: start, rival: start };

  const [history, setHistory] = useState<Point[]>([seed]);
  const [optedOut, setOptedOut] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [reduced, setReduced] = useState(false);

  // Respect prefers-reduced-motion (client-only; defaults to false for SSR).
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const apply = () => setReduced(mq.matches);
    apply();
    mq.addEventListener?.('change', apply);
    return () => mq.removeEventListener?.('change', apply);
  }, []);

  const gen = history.length - 1;
  const atEnd = gen >= maxGenerations;

  const step = useCallback(() => {
    setHistory((prev) => {
      if (prev.length - 1 >= maxGenerations) return prev;
      const last = prev[prev.length - 1];
      // The laggard pushes harder (catch-up), so the two lines chase each other.
      const youGain = optedOut ? 0 : drive + catchUp * Math.max(0, last.rival - last.you);
      const rivalGain = drive + catchUp * Math.max(0, last.you - last.rival);
      return [...prev, { you: last.you + youGain, rival: last.rival + rivalGain }];
    });
  }, [optedOut, drive, catchUp, maxGenerations]);

  // Auto-runner. Disabled entirely under reduced-motion.
  useEffect(() => {
    if (!playing || reduced) return;
    if (atEnd) {
      setPlaying(false);
      return;
    }
    const t = setInterval(step, 680);
    return () => clearInterval(t);
  }, [playing, reduced, atEnd, step]);

  const reset = () => {
    setHistory([seed]);
    setOptedOut(false);
    setPlaying(false);
  };

  const last = history[history.length - 1];
  const lead = last.you - last.rival;
  const fmt = (n: number) => Math.round(n);
  const signed = (n: number) => (n > 0 ? `+${fmt(n)}` : String(fmt(n)));

  const readout = readoutTemplate
    .replace('{generation}', generationLabel)
    .replace('{gen}', String(gen))
    .replace('{you}', String(fmt(last.you)))
    .replace('{rival}', String(fmt(last.rival)))
    .replace('{rel}', signed(lead));

  // ── Chart geometry ───────────────────────────────────────────────────────
  const W = 320;
  const H = 168;
  const padL = 8;
  const padR = 8;
  const padT = 10;
  const padB = 10;
  const maxY = Math.max(
    100,
    ...history.map((p) => Math.max(p.you, p.rival)),
  ) * 1.05;
  const xAt = (i: number) =>
    padL + (history.length <= 1 ? 0 : (i / (history.length - 1)) * (W - padL - padR));
  const yAt = (v: number) => padT + (1 - v / maxY) * (H - padT - padB);

  const pathFor = (key: 'you' | 'rival') =>
    history.map((p, i) => `${i === 0 ? 'M' : 'L'} ${xAt(i).toFixed(1)} ${yAt(p[key]).toFixed(1)}`).join(' ');

  // ── Relative-advantage meter (zooms into the gap the chart hides) ─────────
  const meterRange = 40; // clamp the signed lead to ±40 for the meter
  const meterPct = 50 + (Math.max(-meterRange, Math.min(meterRange, lead)) / meterRange) * 50;

  return (
    <figure className={cx('brutal my-6 bg-surface p-5 sm:p-6', className)}>
      <p className="font-display text-xs font-semibold uppercase tracking-wide text-accent-600">
        {eyebrow}
      </p>
      {title ? (
        <p className="mt-1 font-display text-lg font-semibold text-ink-900">{title}</p>
      ) : null}

      <p className="mt-2 text-sm font-medium text-ink-700">{instructions}</p>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap items-center gap-4 text-xs font-semibold text-ink-600">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-4 rounded-pill bg-accent-500" aria-hidden />
          {youLabel}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-4 rounded-pill bg-ink-400" aria-hidden />
          {rivalLabel}
        </span>
        <span className="ml-auto text-[0.65rem] uppercase tracking-wide text-ink-500">
          {capabilityLabel} →
        </span>
      </div>

      {/* Absolute-capability chart. Decorative — meaning lives in the readout. */}
      <div className="mt-2 rounded-card bg-surface-sunken p-2 ring-1 ring-inset ring-ink-200">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="h-44 w-full"
          role="img"
          aria-hidden
          preserveAspectRatio="none"
        >
          <path
            d={pathFor('rival')}
            fill="none"
            className="stroke-ink-400"
            strokeWidth={2.5}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          <path
            d={pathFor('you')}
            fill="none"
            className="stroke-accent-500"
            strokeWidth={2.5}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          {/* Endpoint dots */}
          <circle cx={xAt(gen)} cy={yAt(last.rival)} r={3.5} className="fill-ink-400" />
          <circle cx={xAt(gen)} cy={yAt(last.you)} r={3.5} className="fill-accent-500" />
        </svg>
      </div>

      {/* Live readout */}
      <p aria-live="polite" className="mt-4 font-display text-base font-semibold text-ink-900">
        {readout}
      </p>
      <p className="mt-1 text-sm text-ink-600">{optedOut ? optedOutNote : runningNote}</p>

      {/* Relative-advantage meter */}
      <div className="mt-4">
        <div className="flex items-center justify-between text-[0.65rem] font-bold uppercase tracking-wide text-ink-500">
          <span>{rivalLabel} ahead</span>
          <span>{relativeLabel}</span>
          <span>{youLabel} ahead</span>
        </div>
        <div className="relative mt-1 h-3 w-full rounded-pill bg-gradient-to-r from-ink-300 via-surface-sunken to-accent-300 ring-1 ring-inset ring-ink-200">
          {/* Even mid-line */}
          <span className="absolute top-1/2 left-1/2 h-4 w-px -translate-x-1/2 -translate-y-1/2 bg-ink-400" aria-hidden />
          <span
            className={cx(
              'absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface shadow-sm',
              'transition-[left] duration-500 ease-out motion-reduce:transition-none',
              lead < -2 ? 'bg-ink-600' : 'bg-accent-500',
            )}
            style={{ left: `${meterPct}%` }}
            aria-hidden
          />
        </div>
        <p className="mt-1 text-center text-[0.65rem] font-semibold uppercase tracking-wide text-ink-400">
          {evenLabel}
        </p>
      </div>

      {/* Controls */}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        {!reduced ? (
          <button
            type="button"
            onClick={() => setPlaying((p) => !p)}
            disabled={atEnd && !playing}
            className="brutal-btn bg-accent-500 px-4 py-2 font-display text-sm text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {playing ? pauseLabel : playLabel}
          </button>
        ) : null}
        <button
          type="button"
          onClick={step}
          disabled={atEnd}
          className={cx(
            'inline-flex items-center rounded-pill px-3 py-2 font-display text-sm font-semibold text-ink-600 ring-1 ring-inset ring-ink-300 transition-colors hover:bg-surface-sunken motion-reduce:transition-none disabled:cursor-not-allowed disabled:opacity-50',
            reduced ? 'brutal-btn bg-accent-500 text-white ring-0 hover:bg-accent-600' : '',
          )}
        >
          {stepLabel}
        </button>
        <button
          type="button"
          onClick={() => setOptedOut((o) => !o)}
          aria-pressed={optedOut}
          className={cx(
            'inline-flex items-center rounded-pill px-3 py-2 font-display text-sm font-semibold ring-1 ring-inset transition-colors motion-reduce:transition-none',
            optedOut
              ? 'bg-accent-300 text-ink-900 ring-accent-400 hover:bg-accent-400'
              : 'text-ink-600 ring-ink-300 hover:bg-surface-sunken',
          )}
        >
          {optedOut ? resumeLabel : optOutLabel}
        </button>
        <button
          type="button"
          onClick={reset}
          className="inline-flex items-center rounded-pill px-3 py-2 font-display text-sm font-semibold text-ink-500 ring-1 ring-inset ring-ink-200 transition-colors hover:bg-surface-sunken motion-reduce:transition-none"
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

export default CoevolutionRace;
