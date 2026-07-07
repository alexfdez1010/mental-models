import { useMemo, useState } from 'react';
import { cx } from '@/components/react/cx';

/**
 * A family of debiasing fix. **`awareness`** = merely knowing about the bias;
 * **`thinker`** = a mental discipline you run in your own head; **`structural`**
 * = a fix built into the environment/process so it does not rely on willpower.
 * The three families have very different average power (that is the lesson).
 */
export type FixKind = 'awareness' | 'thinker' | 'structural';

/** One debiasing tool the learner can apply to a scenario. */
export interface DebiasingTool {
  /** Stable key referenced by a scenario's `fitTools`. */
  key: string;
  /** Display name, e.g. "Pre-mortem" or "Checklist". */
  label: string;
  /** Which family of fix this is — drives its base power. */
  kind: FixKind;
  /** One-line description of what the tool actually does. */
  blurb: string;
}

/** A realistic judgment scenario carrying a lurking bias. */
export interface DebiasingScenario {
  /** Short name for the selector chip. */
  name: string;
  /** The situation being judged. */
  situation: string;
  /** The bias lurking in the snap judgment, e.g. "Planning fallacy". */
  bias: string;
  /** The snap, inside-view call the learner would make by reflex. */
  snapCall: string;
  /**
   * Baseline judgment error of the snap call, 0–100 (higher = more wrong).
   * The meter starts here; a fix pulls it down.
   */
  snapError: number;
  /**
   * Keys of the tools that TARGET this particular bias. A matching tool earns
   * the fit bonus on top of its family power, so some tools fit some biases
   * better than others.
   */
  fitTools?: string[];
}

/** Props for the {@link DebiasingBench} island. */
export interface DebiasingBenchProps {
  /** Heading above the card. */
  title?: string;
  /** Eyebrow label. Defaults to `'Debiasing bench'`. */
  eyebrow?: string;
  /** Instruction line above the controls. */
  instructions?: string;
  /** Caption beneath the card. */
  caption?: string;
  /** The judgment scenarios to work through. */
  scenarios?: DebiasingScenario[];
  /** The debiasing tools on offer. */
  tools?: DebiasingTool[];
  /** Label over the bias badge. Defaults to `'Lurking bias'`. */
  biasLabel?: string;
  /** Label over the snap-call box. Defaults to `'Your snap, inside-view call'`. */
  snapLabel?: string;
  /** Title over the error meter. Defaults to `'Judgment error'`. */
  meterLabel?: string;
  /** Text pinned at the low end of the meter. Defaults to `'accurate'`. */
  meterLowLabel?: string;
  /** Text pinned at the high end of the meter. Defaults to `'way off'`. */
  meterHighLabel?: string;
  /** Legend over the tool grid. Defaults to `'Apply a debiasing tool'`. */
  toolsLabel?: string;
  /** Badge text for `awareness` tools. Defaults to `'just aware'`. */
  awarenessBadge?: string;
  /** Badge text for `thinker` tools. Defaults to `'change the thinker'`. */
  thinkerBadge?: string;
  /** Badge text for `structural` tools. Defaults to `'change the environment'`. */
  structuralBadge?: string;
  /** Prompt shown before any tool is applied. `{snap}` = baseline error. */
  idleReadout?: string;
  /**
   * Readout after a tool is applied. Placeholders: `{tool}`, `{kind}` (badge
   * text), `{snap}` baseline error, `{residual}` remaining error, `{drop}`
   * points removed.
   */
  readoutTemplate?: string;
  /** Appended when the applied tool targets this bias. */
  fitNote?: string;
  /** Appended for a `structural` tool. */
  structuralNote?: string;
  /** Appended for an `awareness` tool. */
  awarenessNote?: string;
  /** Label for the "best you found" line. `{residual}`/{tool} replaced. */
  bestTemplate?: string;
  /** Label for the reset button. Defaults to `'Reset scenario'`. */
  resetLabel?: string;
  /** Extra classes merged onto the root element. */
  className?: string;
}

// ── Family power: the fraction of the snap error a fix removes on average ─────
// This is the whole teaching point: mere awareness barely moves the needle,
// a mental discipline helps more, and a structural fix — one that does not lean
// on willpower — removes the most. A tool that *targets* the bias adds a bonus.
const KIND_POWER: Record<FixKind, number> = {
  awareness: 0.15,
  thinker: 0.42,
  structural: 0.66,
};
const FIT_BONUS = 0.2;
const MAX_POWER = 0.92;

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

const DEFAULT_TOOLS: DebiasingTool[] = [
  {
    key: 'aware',
    label: 'Just know about it',
    kind: 'awareness',
    blurb: 'Remind yourself the bias exists and resolve to watch out for it.',
  },
  {
    key: 'outside-view',
    label: 'Outside view',
    kind: 'thinker',
    blurb: 'Ask how similar cases actually turned out instead of reasoning from inside this one.',
  },
  {
    key: 'premortem',
    label: 'Pre-mortem',
    kind: 'thinker',
    blurb: 'Imagine it has already failed and write the story of why.',
  },
  {
    key: 'checklist',
    label: 'Checklist',
    kind: 'structural',
    blurb: 'Offload the judgment to a fixed list so no step can be skipped.',
  },
  {
    key: 'red-team',
    label: 'Red team',
    kind: 'structural',
    blurb: 'Assign someone to argue the opposite, on the record.',
  },
  {
    key: 'independent-estimate',
    label: 'Independent estimates',
    kind: 'structural',
    blurb: 'Everyone writes their number down before anyone speaks.',
  },
];

const DEFAULT_SCENARIOS: DebiasingScenario[] = [
  {
    name: 'The project plan',
    situation:
      'Your team estimates a new feature will take six weeks. Everyone is nodding; the plan feels solid and detailed.',
    bias: 'Planning fallacy',
    snapCall: '“Six weeks it is — this one’s well scoped.”',
    snapError: 72,
    fitTools: ['outside-view', 'premortem'],
  },
  {
    name: 'The hire everyone loves',
    situation:
      'A candidate dazzled the whole panel in back-to-back interviews. In the debrief the first person raves, and heads start nodding around the table.',
    bias: 'Groupthink / cascade',
    snapCall: '“Clear yes — let’s make the offer today.”',
    snapError: 66,
    fitTools: ['independent-estimate', 'red-team'],
  },
  {
    name: 'The failing bet',
    situation:
      'A project is two years and a fortune behind, with little to show. Pulling out means writing all of it off in front of the board.',
    bias: 'Sunk-cost fallacy',
    snapCall: '“We’ve come too far to quit now — push through.”',
    snapError: 70,
    fitTools: ['outside-view', 'checklist'],
  },
  {
    name: 'The confident diagnosis',
    situation:
      'A doctor spots a familiar pattern and lands on a diagnosis in seconds. The first clue fit so well the rest barely got a look.',
    bias: 'Anchoring / confirmation',
    snapCall: '“Textbook case — I’m sure of it.”',
    snapError: 64,
    fitTools: ['checklist', 'red-team'],
  },
];

/**
 * **DebiasingBench** — the tactile core of the debiasing course. The learner is
 * handed a realistic judgment, sees the *snap, inside-view call* they would make
 * by reflex, and reads off the lurking bias. A meter shows how far off that snap
 * call is. Then they apply a debiasing tool and watch the error move.
 *
 * The discovery the bench is built to force:
 *
 *   • **Mere awareness barely helps.** "Just know about it" shaves a sliver off
 *     the error — knowing about a bias does not immunise you against it.
 *   • **Mental disciplines help more.** The outside view and a pre-mortem — run
 *     inside your own head — cut deeper, especially on the bias they target.
 *   • **Structural fixes cut the most.** A checklist, a red team, or independent
 *     estimates move the needle furthest, precisely because they do not depend on
 *     you catching yourself in the act.
 *
 * The residual error is fully deterministic (family power + a fit bonus when the
 * tool targets the scenario's bias), so the server render matches the client and
 * there is no `Math.random`. Every tried tool keeps its result visible under its
 * button, so the learner assembles the comparison by exploring. Controls are
 * native buttons, the readout is announced via `aria-live`, and the only motion
 * is a width tween disabled under `prefers-reduced-motion`.
 */
export function DebiasingBench({
  title,
  eyebrow = 'Debiasing bench',
  instructions = 'Read the snap judgment and the bias hiding in it. Then apply a debiasing tool and watch the error meter. Try several on the same case — some fixes barely help, others cut deep.',
  caption,
  scenarios = DEFAULT_SCENARIOS,
  tools = DEFAULT_TOOLS,
  biasLabel = 'Lurking bias',
  snapLabel = 'Your snap, inside-view call',
  meterLabel = 'Judgment error',
  meterLowLabel = 'accurate',
  meterHighLabel = 'way off',
  toolsLabel = 'Apply a debiasing tool',
  awarenessBadge = 'just aware',
  thinkerBadge = 'change the thinker',
  structuralBadge = 'change the environment',
  idleReadout = 'This snap call is off by about {snap} points. Pick a tool and see how much of that error it removes.',
  readoutTemplate = '{tool} ({kind}) cut the error from {snap} to {residual} — it removed {drop} points.',
  fitNote = ' This tool targets exactly this bias, so it bites harder here.',
  structuralNote = ' Structural fixes work even when your willpower doesn’t — that’s why they cut the most.',
  awarenessNote = ' Just knowing about the bias barely moved the needle. Awareness is not correction.',
  bestTemplate = 'Best fix you’ve tried here: {tool}, down to {residual}.',
  resetLabel = 'Reset scenario',
  className,
}: DebiasingBenchProps) {
  const [scenarioIdx, setScenarioIdx] = useState(0);
  // Applied tool key per scenario (drives the meter).
  const [applied, setApplied] = useState<(string | null)[]>(() => scenarios.map(() => null));
  // Tool keys the learner has revealed per scenario (their residuals stay shown).
  const [tried, setTried] = useState<string[][]>(() => scenarios.map(() => []));

  const scenario = scenarios[scenarioIdx] ?? scenarios[0];
  const badgeFor = (k: FixKind) =>
    k === 'awareness' ? awarenessBadge : k === 'thinker' ? thinkerBadge : structuralBadge;

  const residualFor = (s: DebiasingScenario, tool: DebiasingTool) => {
    const fit = s.fitTools?.includes(tool.key) ? FIT_BONUS : 0;
    const power = Math.min(KIND_POWER[tool.kind] + fit, MAX_POWER);
    return Math.round(s.snapError * (1 - power));
  };

  const pickScenario = (i: number) => setScenarioIdx(i);

  const applyTool = (toolKey: string) => {
    setApplied((prev) => prev.map((v, i) => (i === scenarioIdx ? toolKey : v)));
    setTried((prev) =>
      prev.map((arr, i) =>
        i === scenarioIdx ? (arr.includes(toolKey) ? arr : [...arr, toolKey]) : arr,
      ),
    );
  };

  const resetScenario = () => {
    setApplied((prev) => prev.map((v, i) => (i === scenarioIdx ? null : v)));
    setTried((prev) => prev.map((arr, i) => (i === scenarioIdx ? [] : arr)));
  };

  const appliedKey = applied[scenarioIdx];
  const appliedTool = tools.find((t) => t.key === appliedKey) ?? null;
  const triedKeys = tried[scenarioIdx] ?? [];

  const residual = appliedTool ? residualFor(scenario, appliedTool) : scenario.snapError;
  const drop = scenario.snapError - residual;

  // Best (lowest-error) fix the learner has revealed on THIS scenario.
  const best = useMemo(() => {
    let bestTool: DebiasingTool | null = null;
    let bestResidual = Infinity;
    for (const key of triedKeys) {
      const t = tools.find((tt) => tt.key === key);
      if (!t) continue;
      const r = residualFor(scenario, t);
      if (r < bestResidual) {
        bestResidual = r;
        bestTool = t;
      }
    }
    return bestTool ? { tool: bestTool, residual: bestResidual } : null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [triedKeys, scenario, tools]);

  const readout = appliedTool
    ? readoutTemplate
        .replace('{tool}', appliedTool.label)
        .replace('{kind}', badgeFor(appliedTool.kind))
        .replace('{snap}', String(scenario.snapError))
        .replace('{residual}', String(residual))
        .replace('{drop}', String(drop)) +
      (scenario.fitTools?.includes(appliedTool.key) ? fitNote : '') +
      (appliedTool.kind === 'structural'
        ? structuralNote
        : appliedTool.kind === 'awareness'
          ? awarenessNote
          : '')
    : idleReadout.replace('{snap}', String(scenario.snapError));

  const tween = 'transition-all duration-500 ease-out motion-reduce:transition-none';

  const kindTint = (k: FixKind, on: boolean) =>
    on
      ? k === 'structural'
        ? 'border-brand-500 bg-brand-50/70'
        : k === 'thinker'
          ? 'border-accent-400 bg-accent-50/60'
          : 'border-ink-300 bg-surface-sunken'
      : 'border-ink-100 bg-surface-sunken hover:border-ink-300';

  const kindBadgeTint = (k: FixKind) =>
    k === 'structural'
      ? 'bg-brand-100 text-brand-700'
      : k === 'thinker'
        ? 'bg-accent-100 text-accent-700'
        : 'bg-ink-100 text-ink-500';

  // Meter fill colour tracks how much error remains.
  const meterColor =
    residual >= 55
      ? 'var(--color-danger)'
      : residual >= 30
        ? 'var(--color-accent-500)'
        : 'var(--color-brand-500)';

  return (
    <figure className={cx('brutal my-6 bg-surface p-5 sm:p-6', className)}>
      <p className="font-display text-xs font-semibold uppercase tracking-wide text-brand-600">
        {eyebrow}
      </p>
      {title ? (
        <p className="mt-1 font-display text-lg font-semibold text-ink-900">{title}</p>
      ) : null}

      <p className="mt-2 text-sm font-medium text-ink-700">{instructions}</p>

      {/* Scenario selector */}
      {scenarios.length > 1 ? (
        <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Choose a scenario">
          {scenarios.map((s, i) => {
            const on = i === scenarioIdx;
            return (
              <button
                key={s.name}
                type="button"
                onClick={() => pickScenario(i)}
                aria-pressed={on}
                className={cx(
                  'rounded-pill px-3 py-1 text-xs font-semibold',
                  tween,
                  on ? 'bg-brand-500 text-white' : 'bg-surface-sunken text-ink-600 hover:bg-ink-100',
                )}
              >
                {s.name}
              </button>
            );
          })}
        </div>
      ) : null}

      {/* The situation */}
      <p className="mt-4 rounded-card border border-ink-100 bg-surface-sunken p-3 text-sm font-medium leading-relaxed text-ink-700">
        {scenario.situation}
      </p>

      {/* Bias + snap call */}
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div className="rounded-card border border-danger/30 bg-danger/5 p-3">
          <span className="text-[0.6rem] font-bold uppercase tracking-wide text-ink-500">
            {biasLabel}
          </span>
          <p className="mt-0.5 font-display text-sm font-semibold text-ink-900">{scenario.bias}</p>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface p-3">
          <span className="text-[0.6rem] font-bold uppercase tracking-wide text-ink-500">
            {snapLabel}
          </span>
          <p className="mt-0.5 text-sm font-medium italic text-ink-700">{scenario.snapCall}</p>
        </div>
      </div>

      {/* Error meter */}
      <div className="mt-4">
        <div className="flex items-center justify-between">
          <span className="text-[0.65rem] font-bold uppercase tracking-wide text-ink-600">
            {meterLabel}
          </span>
          <span className="font-mono text-sm font-semibold text-ink-900">{residual}</span>
        </div>
        <div className="relative mt-1.5 h-6 w-full overflow-hidden rounded-pill bg-surface-sunken">
          {/* Ghost of the original snap error */}
          <div
            className="absolute inset-y-0 left-0 rounded-pill bg-ink-100"
            style={{ width: `${scenario.snapError}%` }}
            aria-hidden
          />
          {/* Current residual error */}
          <div
            className={cx('absolute inset-y-0 left-0 rounded-pill', tween)}
            style={{ width: `${residual}%`, background: meterColor }}
            aria-hidden
          />
        </div>
        <div className="mt-1 flex items-center justify-between text-[0.6rem] font-semibold uppercase tracking-wide text-ink-400">
          <span>{meterLowLabel}</span>
          <span>{meterHighLabel}</span>
        </div>
      </div>

      {/* Live readout */}
      <p
        aria-live="polite"
        className={cx(
          'mt-4 rounded-card border p-3 text-sm leading-relaxed',
          appliedTool ? 'border-brand-200 bg-brand-50/60 text-ink-700' : 'border-ink-100 bg-surface-sunken text-ink-600',
        )}
      >
        {readout}
        {best && best.tool.key !== appliedKey ? (
          <span className="mt-1 block text-xs font-medium text-ink-500">
            {bestTemplate.replace('{tool}', best.tool.label).replace('{residual}', String(best.residual))}
          </span>
        ) : null}
      </p>

      {/* Tool grid */}
      <fieldset className="mt-4">
        <legend className="text-[0.65rem] font-bold uppercase tracking-wide text-ink-600">
          {toolsLabel}
        </legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {tools.map((t) => {
            const on = t.key === appliedKey;
            const revealed = triedKeys.includes(t.key);
            const r = residualFor(scenario, t);
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => applyTool(t.key)}
                aria-pressed={on}
                className={cx(
                  'flex flex-col items-start gap-1 rounded-card border p-2.5 text-left',
                  tween,
                  kindTint(t.kind, on),
                )}
              >
                <span className="flex w-full items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-ink-800">{t.label}</span>
                  <span
                    className={cx(
                      'shrink-0 rounded-pill px-1.5 py-0.5 text-[0.55rem] font-bold uppercase tracking-wide',
                      kindBadgeTint(t.kind),
                    )}
                  >
                    {badgeFor(t.kind)}
                  </span>
                </span>
                <span className="text-xs leading-snug text-ink-500">{t.blurb}</span>
                {revealed ? (
                  <span className="mt-0.5 font-mono text-[0.7rem] font-semibold text-ink-600">
                    → {r}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </fieldset>

      {appliedTool ? (
        <div className="mt-4">
          <button
            type="button"
            onClick={resetScenario}
            className="brutal-btn bg-surface px-4 py-2 text-sm text-ink-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
          >
            {resetLabel}
          </button>
        </div>
      ) : null}

      {caption ? <figcaption className="mt-4 text-sm text-ink-500">{caption}</figcaption> : null}
    </figure>
  );
}

export default DebiasingBench;
