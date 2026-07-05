import { useId, useMemo, useState } from 'react';
import { cx } from '@/components/react/cx';

/** Props for the {@link CommitmentGame} island. */
export interface CommitmentGameProps {
  /** Heading above the card. */
  title?: string;
  /** Eyebrow label. Defaults to `'Commitment game'`. */
  eyebrow?: string;
  /** Instruction line above the diagram. */
  instructions?: string;
  /** Caption beneath the card. */
  caption?: string;
  /** Label for the committing player (the learner). Defaults to `'You'`. */
  youLabel?: string;
  /** Label for the other player. Defaults to `'Rival'`. */
  rivalLabel?: string;
  /** Label for the commit toggle. Defaults to `'Burn your retreat — commit to fight'`. */
  commitLabel?: string;
  /** Small hint under the toggle when OFF. */
  commitHintOff?: string;
  /** Small hint under the toggle when ON. */
  commitHintOn?: string;
  /** Label for the "your fight payoff" slider. */
  yourFightLabel?: string;
  /** Label for the "rival fight payoff" slider. */
  rivalFightLabel?: string;
  /** Name of the "rival stays away" outcome. */
  stayAwayLabel?: string;
  /** Name of the "you yield / accommodate" outcome. */
  yieldLabel?: string;
  /** Name of the "you fight" outcome. */
  fightLabel?: string;
  /** Word for the rival's opening move (challenge). Defaults to `'Challenge'`. */
  challengeLabel?: string;
  /** Word for the rival's opening move (stay away). Defaults to `'Stay away'`. */
  stayLabel?: string;
  /** Heading of the outcomes row. Defaults to `'Where the game lands'`. */
  outcomesLabel?: string;
  /** Heading of the payoff panel. Defaults to `'Payoffs at the equilibrium'`. */
  payoffLabel?: string;
  /** Heading of the verdict panel. Defaults to `'What your commitment did'`. */
  verdictLabel?: string;
  /** Badge text on the equilibrium outcome card. Defaults to `'Equilibrium'`. */
  equilibriumLabel?: string;
  /**
   * Readout template. `{you}`/`{rival}`/`{outcome}` are replaced with the
   * equilibrium payoffs and the outcome name.
   */
  readout?: string;
  /** Verdict — commitment converts a challenge into a stay-away (payoff rises). */
  verdictDeters?: string;
  /** Verdict — you were already going to fight, so the threat was credible without committing. */
  verdictCredibleAnyway?: string;
  /** Verdict — committing changes nothing here (fighting was already your best reply). */
  verdictRedundant?: string;
  /** Verdict — the threat does not bite, so committing only traps you in a fight. */
  verdictTrap?: string;
  /** Verdict — no commitment, and the rival walks all over your soft option. */
  verdictExposed?: string;
  /** Starting fight payoff to you (lower than the yield payoff of 5 shows the paradox). Defaults to `2`. */
  initialYourFight?: number;
  /** Starting fight payoff to the rival (below the stay-away payoff of 4 makes the threat bite). Defaults to `1`. */
  initialRivalFight?: number;
  /** Extra classes merged onto the root element. */
  className?: string;
}

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

// Fixed payoffs that anchor the story; the two sliders move the fight branch.
const YOU_STAY = 10; // you keep the whole prize when the rival stays away
const YOU_YIELD = 5; // you accommodate — better than a costly fight, worse than being left alone
const RIVAL_STAY = 4; // the rival's safe outside option
const RIVAL_YIELD = 7; // the rival's prize when you accommodate

type Outcome = 'stay' | 'yield' | 'fight';

interface Solution {
  responseIsFight: boolean;
  challenges: boolean;
  outcome: Outcome;
  you: number;
  rival: number;
}

/**
 * Interactive **commitment / deterrence** island — the strategic paradox that
 * throwing away an option can make you stronger, made tangible on a two-move
 * game.
 *
 * The story: a **Rival** decides whether to *challenge* you (invade your market,
 * your turf, your position) or *stay away*. If challenged, **You** decide
 * whether to *fight* (costly for both) or *yield* (accommodate). By backward
 * induction the rival looks ahead to what you will actually do. Yielding usually
 * pays you more than a bruising fight, so a rational rival predicts you will fold
 * and challenges — and you lose ground you never wanted to lose.
 *
 * The lever is the **commit toggle**: burn your retreat and you *remove the yield
 * branch*, forcing yourself to fight if challenged. Now the rival looks ahead,
 * sees a fight they would lose, and stays away — so your payoff jumps and **you
 * never actually fight**. Fewer options, better outcome. The two sliders expose
 * the limits: raise your own fight payoff and the threat becomes credible without
 * committing at all; raise the rival's fight payoff above their stay-away option
 * and even a committed threat fails to bite — commitment just traps you in a
 * fight you cannot avoid.
 *
 * Three outcome cards show the whole tree, the equilibrium path is highlighted,
 * two payoff bars and an `aria-live` readout report where the game lands, and a
 * verdict panel names what the commitment did. Controls are native, keyboard-
 * operable inputs; motion is a cosmetic tween disabled under
 * `prefers-reduced-motion`.
 */
export function CommitmentGame({
  title,
  eyebrow = 'Commitment game',
  instructions = 'The rival chooses whether to challenge you; if they do, you choose fight or yield. The rival looks ahead to what you will actually do. Flip the switch to burn your retreat — throwing away the option to yield — and watch the equilibrium move.',
  caption,
  youLabel = 'You',
  rivalLabel = 'Rival',
  commitLabel = 'Burn your retreat — commit to fight',
  commitHintOff = 'You keep the option to yield if challenged.',
  commitHintOn = 'The yield option is gone — if challenged, you must fight.',
  yourFightLabel = 'Your payoff if it comes to a fight',
  rivalFightLabel = "Rival's payoff if it comes to a fight",
  stayAwayLabel = 'Rival stays away',
  yieldLabel = 'You yield',
  fightLabel = 'You fight',
  challengeLabel = 'Challenge',
  stayLabel = 'Stay away',
  outcomesLabel = 'Where the game lands',
  payoffLabel = 'Payoffs at the equilibrium',
  verdictLabel = 'What your commitment did',
  equilibriumLabel = 'Equilibrium',
  readout = 'Equilibrium: {outcome}. You get {you}, the rival gets {rival}.',
  verdictDeters = 'Commitment pays. By throwing away your retreat you made fighting unavoidable — so the rival looks ahead, sees a fight they would lose, and stays away. Your payoff jumped, and notice: you never actually had to fight. The credible threat did all the work.',
  verdictCredibleAnyway = 'You do not even need to commit here. Fighting already pays you more than yielding, so your threat is credible on its own — the rival stays away either way. Commitment is for when your best reply would otherwise be to fold.',
  verdictRedundant = 'Committing changed nothing this time: fighting was already your best reply, so tying your hands added no new credibility. Save the burnt bridge for when you would otherwise be tempted to yield.',
  verdictTrap = 'A commitment trap. The fight hurts the rival less than walking away costs them, so your threat does not bite — they challenge anyway. Uncommitted you could have yielded and cut your losses; committed, you are locked into a fight you cannot avoid. A threat only deters if carrying it out genuinely hurts the other side.',
  verdictExposed = 'Exposed. With your retreat intact, a costly fight is worse for you than folding, so the rival correctly predicts you will yield — and challenges. You keep the option to yield, and that soft option is exactly what invites the challenge. Burn your retreat and see what happens.',
  initialYourFight = 2,
  initialRivalFight = 1,
  className,
}: CommitmentGameProps) {
  const reactId = useId();
  const [committed, setCommitted] = useState(false);
  const [yourFight, setYourFight] = useState(clamp(Math.round(initialYourFight), -2, 8));
  const [rivalFight, setRivalFight] = useState(clamp(Math.round(initialRivalFight), -2, 8));

  const solve = (commit: boolean): Solution => {
    // Your best reply if challenged: forced to fight when committed; otherwise
    // fight only if a fight strictly beats folding.
    const responseIsFight = commit ? true : yourFight > YOU_YIELD;
    // The rival looks ahead to that reply and its payoff to them.
    const rivalIfChallenge = responseIsFight ? rivalFight : RIVAL_YIELD;
    // The rival challenges only if doing so beats their safe outside option.
    const challenges = rivalIfChallenge > RIVAL_STAY;
    if (!challenges) {
      return { responseIsFight, challenges: false, outcome: 'stay', you: YOU_STAY, rival: RIVAL_STAY };
    }
    if (responseIsFight) {
      return { responseIsFight, challenges: true, outcome: 'fight', you: yourFight, rival: rivalFight };
    }
    return { responseIsFight, challenges: true, outcome: 'yield', you: YOU_YIELD, rival: RIVAL_YIELD };
  };

  const model = useMemo(() => {
    const current = solve(committed);
    const other = solve(!committed);
    // Classify the verdict by comparing this world with its counterfactual.
    let verdictKey: 'deters' | 'credibleAnyway' | 'redundant' | 'trap' | 'exposed';
    if (committed) {
      if (current.outcome === 'stay' && other.outcome !== 'stay') {
        verdictKey = 'deters'; // committing turned a challenge into a stay-away
      } else if (current.outcome === 'stay' && other.outcome === 'stay') {
        verdictKey = 'redundant'; // rival stays away with or without the commitment
      } else {
        verdictKey = 'trap'; // still challenged, and now locked into fighting
      }
    } else {
      verdictKey = current.outcome === 'stay' ? 'credibleAnyway' : 'exposed';
    }
    return { current, verdictKey };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [committed, yourFight, rivalFight]);

  const { current, verdictKey } = model;

  const verdictText = {
    deters: verdictDeters,
    credibleAnyway: verdictCredibleAnyway,
    redundant: verdictRedundant,
    trap: verdictTrap,
    exposed: verdictExposed,
  }[verdictKey];

  const good = verdictKey === 'deters' || verdictKey === 'credibleAnyway' || verdictKey === 'redundant';

  const readoutText = readout
    .replace('{you}', String(current.you))
    .replace('{rival}', String(current.rival))
    .replace(
      '{outcome}',
      current.outcome === 'stay' ? stayAwayLabel : current.outcome === 'yield' ? yieldLabel : fightLabel,
    );

  const tween = 'transition-all duration-300 ease-out motion-reduce:transition-none';
  const youColor = 'var(--color-brand-500)';
  const rivalColor = 'var(--color-accent-500)';

  // The three terminal outcomes of the tree, in reading order.
  const outcomes: { key: Outcome; name: string; you: number; rival: number; note: string }[] = [
    { key: 'stay', name: stayAwayLabel, you: YOU_STAY, rival: RIVAL_STAY, note: `${rivalLabel}: ${stayLabel}` },
    { key: 'yield', name: yieldLabel, you: YOU_YIELD, rival: RIVAL_YIELD, note: `${challengeLabel} → ${yieldLabel}` },
    { key: 'fight', name: fightLabel, you: yourFight, rival: rivalFight, note: `${challengeLabel} → ${fightLabel}` },
  ];

  // A yielded branch that is walled off by the commitment is shown struck-through.
  const yieldRemoved = committed;

  return (
    <figure className={cx('brutal my-6 bg-surface p-5 sm:p-6', className)}>
      <p className="font-display text-xs font-semibold uppercase tracking-wide text-brand-600">
        {eyebrow}
      </p>
      {title ? (
        <p className="mt-1 font-display text-lg font-semibold text-ink-900">{title}</p>
      ) : null}

      <p className="mt-2 text-sm font-medium text-ink-700">{instructions}</p>

      {/* Player legend */}
      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs font-medium text-ink-600">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="inline-block h-3 w-3 rounded-sm" style={{ background: youColor }} />
          {youLabel}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="inline-block h-3 w-3 rounded-sm" style={{ background: rivalColor }} />
          {rivalLabel}
        </span>
      </div>

      {/* Outcome cards — the three leaves of the tree */}
      <p className="mt-4 text-[0.65rem] font-bold uppercase tracking-wide text-ink-600">{outcomesLabel}</p>
      <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
        {outcomes.map((o) => {
          const isEq = o.key === current.outcome;
          const walled = o.key === 'yield' && yieldRemoved;
          return (
            <div
              key={o.key}
              className={cx(
                'relative rounded-card border p-3',
                tween,
                isEq
                  ? 'border-brand-500 bg-brand-50/80 shadow-soft'
                  : walled
                    ? 'border-ink-200 border-dashed bg-surface-sunken opacity-55'
                    : 'border-ink-200 bg-surface-sunken',
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span
                  className={cx(
                    'font-display text-sm font-semibold',
                    walled ? 'text-ink-400 line-through' : 'text-ink-800',
                  )}
                >
                  {o.name}
                </span>
                {isEq ? (
                  <span className="rounded-pill bg-brand-500 px-1.5 py-0.5 text-[0.55rem] font-bold uppercase tracking-wide text-white">
                    {equilibriumLabel}
                  </span>
                ) : null}
              </div>
              <p className="mt-0.5 text-[0.6rem] font-medium uppercase tracking-wide text-ink-400">{o.note}</p>
              <div className="mt-2 flex gap-3 text-xs font-semibold tabular-nums">
                <span style={{ color: youColor }}>
                  {youLabel} {o.you}
                </span>
                <span style={{ color: rivalColor }}>
                  {rivalLabel} {o.rival}
                </span>
              </div>
              {walled ? (
                <p className="mt-1 text-[0.6rem] font-semibold uppercase tracking-wide text-danger">
                  {commitHintOn}
                </p>
              ) : null}
            </div>
          );
        })}
      </div>

      {/* Payoff bars at the equilibrium */}
      <div className="mt-4">
        <p className="text-[0.65rem] font-bold uppercase tracking-wide text-ink-600">{payoffLabel}</p>
        <div className="mt-2 space-y-2">
          <div className="flex items-center gap-2">
            <span className="w-16 shrink-0 text-xs font-medium text-ink-600">{youLabel}</span>
            <div className="relative h-4 flex-1 overflow-hidden rounded-pill bg-surface-sunken">
              <div
                className={cx('h-full rounded-pill', tween)}
                style={{ width: `${clamp((current.you / 10) * 100, 0, 100)}%`, background: youColor }}
              />
            </div>
            <span className="w-8 shrink-0 text-right text-xs font-semibold tabular-nums text-ink-700">
              {current.you}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-16 shrink-0 text-xs font-medium text-ink-600">{rivalLabel}</span>
            <div className="relative h-4 flex-1 overflow-hidden rounded-pill bg-surface-sunken">
              <div
                className={cx('h-full rounded-pill', tween)}
                style={{ width: `${clamp((current.rival / 10) * 100, 0, 100)}%`, background: rivalColor }}
              />
            </div>
            <span className="w-8 shrink-0 text-right text-xs font-semibold tabular-nums text-ink-700">
              {current.rival}
            </span>
          </div>
        </div>
      </div>

      {/* Live readout */}
      <p
        aria-live="polite"
        className="mt-4 rounded-card border border-brand-200 bg-brand-50/70 p-3 text-sm leading-relaxed text-ink-700"
      >
        {readoutText}
      </p>

      {/* Commit toggle */}
      <div className="mt-4 rounded-card border border-ink-200 bg-surface-sunken p-3">
        <label htmlFor={`${reactId}-commit`} className="flex cursor-pointer items-center gap-3">
          <input
            id={`${reactId}-commit`}
            type="checkbox"
            checked={committed}
            onChange={(e) => setCommitted(e.target.checked)}
            className="h-4 w-4 shrink-0 cursor-pointer accent-brand-500"
          />
          <span className="text-sm font-semibold text-ink-800">{commitLabel}</span>
        </label>
        <p className="mt-1 pl-7 text-xs font-medium text-ink-500">
          {committed ? commitHintOn : commitHintOff}
        </p>
      </div>

      {/* Sliders */}
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label
            htmlFor={`${reactId}-you`}
            className="text-[0.65rem] font-bold uppercase tracking-wide text-ink-600"
          >
            {yourFightLabel}
          </label>
          <input
            id={`${reactId}-you`}
            type="range"
            min={-2}
            max={8}
            step={1}
            value={yourFight}
            onChange={(e) => setYourFight(clamp(Number(e.target.value), -2, 8))}
            aria-valuetext={`your fight payoff ${yourFight}`}
            className="mt-1 h-1.5 w-full cursor-pointer accent-brand-500"
          />
          <p className="text-[0.6rem] font-medium text-ink-400">
            {youLabel}: {yourFight} &nbsp;·&nbsp; {yieldLabel}: {YOU_YIELD}
          </p>
        </div>
        <div>
          <label
            htmlFor={`${reactId}-rival`}
            className="text-[0.65rem] font-bold uppercase tracking-wide text-ink-600"
          >
            {rivalFightLabel}
          </label>
          <input
            id={`${reactId}-rival`}
            type="range"
            min={-2}
            max={8}
            step={1}
            value={rivalFight}
            onChange={(e) => setRivalFight(clamp(Number(e.target.value), -2, 8))}
            aria-valuetext={`rival fight payoff ${rivalFight}`}
            className="mt-1 h-1.5 w-full cursor-pointer accent-accent-500"
          />
          <p className="text-[0.6rem] font-medium text-ink-400">
            {rivalLabel}: {rivalFight} &nbsp;·&nbsp; {stayAwayLabel}: {RIVAL_STAY}
          </p>
        </div>
      </div>

      {/* Verdict panel */}
      <div className="mt-4 rounded-card border border-ink-200 bg-surface-sunken p-3">
        <p className="text-[0.65rem] font-bold uppercase tracking-wide text-ink-600">{verdictLabel}</p>
        <p
          className={cx('mt-1 text-sm font-medium leading-relaxed', good ? 'text-success' : 'text-danger')}
        >
          {verdictText}
        </p>
      </div>

      {caption ? <figcaption className="mt-3 text-sm text-ink-500">{caption}</figcaption> : null}
    </figure>
  );
}

export default CommitmentGame;
