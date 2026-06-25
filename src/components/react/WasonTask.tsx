import { useId, useMemo, useState } from 'react';
import { cx } from '@/components/react/cx';

/** One option in the "guess the rule" multiple choice. */
export interface WasonGuess {
  /** The candidate rule, in the learner's words. */
  text: string;
  /** Whether this is the actual hidden rule. Exactly one should be `true`. */
  correct?: boolean;
}

/** Props for the {@link WasonTask} island. */
export interface WasonTaskProps {
  /**
   * The seed triple the learner is told already fits the hidden rule. Defaults
   * to the classic `[2, 4, 6]`. The hidden rule is always "the three numbers are
   * in strictly increasing order" (a < b < c) — the canonical Wason task.
   */
  seed?: [number, number, number];
  /** Heading above the card. */
  title?: string;
  /** Eyebrow label. Defaults to `'Discover the rule'`. */
  eyebrow?: string;
  /** Instruction line above the tester. */
  instructions?: string;
  /** Label for the three number inputs (e.g. `'First'`, `'Second'`, `'Third'`). */
  inputLabels?: [string, string, string];
  /** Label on the "test this triple" button. */
  testLabel?: string;
  /** Shown for a triple that fits the rule. Defaults to `'fits ✓'`. */
  fitsLabel?: string;
  /** Shown for a triple that does not fit. Defaults to `'does not fit ✗'`. */
  failsLabel?: string;
  /** Heading on the running tally. */
  tallyLabel?: string;
  /** Template for the tally readout. `{total}`, `{yes}`, `{no}` are replaced. */
  tallyTemplate?: string;
  /** Heading above the "what is the rule?" guess block. */
  guessHeading?: string;
  /** The candidate rules the learner picks between (one is correct). */
  guesses: WasonGuess[];
  /** Label on the reveal button. Defaults to `'Reveal the rule'`. */
  revealLabel?: string;
  /** Hint shown before any guess is selected. */
  selectHint?: string;
  /** The true rule, spelled out on reveal. */
  ruleReveal: string;
  /**
   * Verdict shown when the learner ran **zero** disconfirming tests (every test
   * came back "fits"). This is the confirmation-bias trap. `{total}` is replaced.
   */
  trapVerdict?: string;
  /**
   * Verdict shown when the learner **did** run at least one disconfirming test
   * (got at least one "does not fit"). `{no}`, `{total}` are replaced.
   */
  goodVerdict?: string;
  /** Prefix shown before the correct/incorrect mark on their guess. */
  correctLabel?: string;
  /** Shown when their selected guess was wrong. */
  incorrectLabel?: string;
  /** Caption beneath the card. */
  caption?: string;
  /** Extra classes merged onto the root element. */
  className?: string;
}

const isStrictlyAscending = (a: number, b: number, c: number) => a < b && b < c;

/**
 * Interactive **Wason 2-4-6 task** — confirmation bias caught in the act.
 *
 * The learner is told `2, 4, 6` fits a hidden rule and must discover the rule by
 * proposing their own triples and seeing whether each fits. The hidden rule is
 * deliberately broad — *any* three numbers in increasing order — but almost
 * everyone leaps to a narrow guess ("even numbers going up by two") and then only
 * tests triples that *confirm* it (8-10-12, 20-22-24…), all of which come back
 * "fits", falsely cementing the wrong rule. The only way to find the real rule is
 * to run a **disconfirming** test: a triple you expect to *fail* (like 1-2-3 or
 * 5-4-3). That negative test is exactly the move confirmation bias suppresses.
 *
 * On reveal the island scores the learner not on whether they got the rule, but
 * on whether they ever sought a "does not fit" — turning the abstract idea
 * ("seek the disconfirming case") into something they either did or didn't do.
 *
 * Inputs are native, labelled number fields; the result of each test and the
 * final verdict are announced via `aria-live`; transitions collapse under
 * `prefers-reduced-motion`. Fully keyboard-operable.
 */
export function WasonTask({
  seed = [2, 4, 6],
  title,
  eyebrow = 'Discover the rule',
  instructions = 'The triple 2, 4, 6 fits a rule I have in mind. Propose your own triples to discover the rule — you will be told whether each one fits. Test as many as you like, then guess.',
  inputLabels = ['First', 'Second', 'Third'],
  testLabel = 'Test this triple',
  fitsLabel = 'fits ✓',
  failsLabel = 'does not fit ✗',
  tallyLabel = 'Your tests so far',
  tallyTemplate = '{total} tested · {yes} fit · {no} did not fit',
  guessHeading = 'What do you think the rule is?',
  guesses,
  revealLabel = 'Reveal the rule',
  selectHint = 'Pick the rule you think is hiding, then reveal it.',
  ruleReveal,
  trapVerdict =
    'Every one of your {total} tests came back “fits”. That feels like proof — but it is the confirmation-bias trap: you only tried triples you expected to pass, and a “fits” can never rule a guess out. You never once tried to break your own theory.',
  goodVerdict =
    'You ran {no} test(s) that came back “does not fit” out of {total}. That is the whole skill: a triple you expect to FAIL is the only kind that can actually teach you the rule.',
  correctLabel = 'Your guess was right:',
  incorrectLabel = 'Your guess missed it:',
  caption,
  className,
}: WasonTaskProps) {
  if (!Array.isArray(guesses) || guesses.length < 2) {
    throw new Error('WasonTask: provide at least two `guesses`.');
  }

  const reactId = useId();
  const [a, setA] = useState('');
  const [b, setB] = useState('');
  const [c, setC] = useState('');
  const [tests, setTests] = useState<Array<{ triple: [number, number, number]; fits: boolean }>>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);

  const parsed = useMemo(() => {
    const na = Number(a);
    const nb = Number(b);
    const nc = Number(c);
    const ok = a.trim() !== '' && b.trim() !== '' && c.trim() !== '' &&
      Number.isFinite(na) && Number.isFinite(nb) && Number.isFinite(nc);
    return { na, nb, nc, ok };
  }, [a, b, c]);

  const yes = tests.filter((t) => t.fits).length;
  const no = tests.length - yes;

  const runTest = () => {
    if (!parsed.ok || revealed) return;
    const triple: [number, number, number] = [parsed.na, parsed.nb, parsed.nc];
    setTests((prev) => [...prev, { triple, fits: isStrictlyAscending(parsed.na, parsed.nb, parsed.nc) }]);
    setA('');
    setB('');
    setC('');
  };

  const tally = tallyTemplate
    .replace('{total}', String(tests.length))
    .replace('{yes}', String(yes))
    .replace('{no}', String(no));

  const guessRight = selected !== null && guesses[selected]?.correct === true;
  const verdict = (no === 0
    ? trapVerdict
    : goodVerdict
  ).replace('{total}', String(tests.length)).replace('{no}', String(no));

  return (
    <figure className={cx('brutal my-6 bg-surface p-5 sm:p-6', className)}>
      <p className="font-display text-xs font-semibold uppercase tracking-wide text-accent-600">
        {eyebrow}
      </p>
      {title ? (
        <p className="mt-1 font-display text-lg font-semibold text-ink-900">{title}</p>
      ) : null}

      <p className="mt-2 text-sm font-medium text-ink-700">{instructions}</p>

      {/* The seed triple, given as a known YES. */}
      <p className="mt-4 inline-flex items-center gap-2 rounded-card bg-brand-50 px-3 py-1.5 text-sm font-semibold text-brand-700 ring-1 ring-inset ring-brand-200">
        <span className="font-mono">{seed.join(', ')}</span>
        <span className="text-success">{fitsLabel}</span>
      </p>

      {/* The tester: three number inputs + a button. */}
      <div className="mt-4 flex flex-wrap items-end gap-3">
        {[0, 1, 2].map((i) => {
          const value = i === 0 ? a : i === 1 ? b : c;
          const setter = i === 0 ? setA : i === 1 ? setB : setC;
          return (
            <div key={`${reactId}-in-${i}`} className="flex flex-col gap-1">
              <label
                htmlFor={`${reactId}-in-${i}`}
                className="text-[0.65rem] font-bold uppercase tracking-wide text-ink-500"
              >
                {inputLabels[i]}
              </label>
              <input
                id={`${reactId}-in-${i}`}
                type="number"
                inputMode="numeric"
                value={value}
                disabled={revealed}
                onChange={(e) => setter(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') runTest();
                }}
                className="w-20 rounded-card border-2 border-ink-200 bg-surface px-2 py-1.5 text-center font-mono text-sm text-ink-900 focus:border-brand-500 focus:outline-none disabled:opacity-50"
              />
            </div>
          );
        })}
        <button
          type="button"
          onClick={runTest}
          disabled={!parsed.ok || revealed}
          className="brutal-btn bg-brand-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {testLabel}
        </button>
      </div>

      {/* Tally + the log of tested triples. */}
      {tests.length > 0 ? (
        <div className="mt-4">
          <p className="text-[0.65rem] font-bold uppercase tracking-wide text-ink-500">
            {tallyLabel}
          </p>
          <p aria-live="polite" className="mt-1 font-display text-sm font-semibold text-ink-900">
            {tally}
          </p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {tests.map((t, i) => (
              <li
                key={`${reactId}-t-${i}`}
                className={cx(
                  'inline-flex items-center gap-1.5 rounded-card px-2.5 py-1 text-xs font-medium ring-1 ring-inset transition-colors duration-300 motion-reduce:transition-none',
                  t.fits
                    ? 'bg-success/10 text-success ring-success/30'
                    : 'bg-warning/10 text-warning ring-warning/30',
                )}
              >
                <span className="font-mono text-ink-700">{t.triple.join(', ')}</span>
                <span>{t.fits ? fitsLabel : failsLabel}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* Guess the rule. */}
      <div className="mt-5 border-t-2 border-ink-100 pt-4">
        <p className="font-display text-sm font-semibold text-ink-900">{guessHeading}</p>
        <fieldset className="mt-2 space-y-2" disabled={revealed}>
          {guesses.map((g, i) => {
            const chosen = selected === i;
            const showCorrect = revealed && g.correct;
            const showWrongChoice = revealed && chosen && !g.correct;
            return (
              <label
                key={`${reactId}-g-${i}`}
                className={cx(
                  'flex cursor-pointer items-start gap-3 rounded-card border-2 p-3 text-sm transition-colors duration-200 motion-reduce:transition-none',
                  showCorrect
                    ? 'border-success bg-success/10'
                    : showWrongChoice
                      ? 'border-danger bg-danger/10'
                      : chosen
                        ? 'border-brand-500 bg-brand-50'
                        : 'border-ink-200 bg-surface hover:border-ink-300',
                )}
              >
                <input
                  type="radio"
                  name={`${reactId}-guess`}
                  checked={chosen}
                  onChange={() => setSelected(i)}
                  className="mt-0.5 size-4 shrink-0 cursor-pointer accent-brand-600"
                />
                <span className="text-ink-800">{g.text}</span>
              </label>
            );
          })}
        </fieldset>

        {!revealed ? (
          <div className="mt-3 flex items-center gap-3">
            <button
              type="button"
              onClick={() => setRevealed(true)}
              disabled={selected === null}
              className="brutal-btn bg-accent-500 px-4 py-2 text-sm font-semibold text-ink-900 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {revealLabel}
            </button>
            {selected === null ? (
              <span className="text-xs text-ink-500">{selectHint}</span>
            ) : null}
          </div>
        ) : (
          <div aria-live="polite" className="mt-4 space-y-3">
            <p className="text-sm font-semibold text-ink-900">
              <span className={guessRight ? 'text-success' : 'text-danger'}>
                {guessRight ? correctLabel : incorrectLabel}
              </span>{' '}
              {ruleReveal}
            </p>
            <p
              className={cx(
                'rounded-card p-3 text-sm ring-1 ring-inset',
                no === 0
                  ? 'bg-warning/10 text-ink-800 ring-warning/30'
                  : 'bg-success/10 text-ink-800 ring-success/30',
              )}
            >
              {verdict}
            </p>
          </div>
        )}
      </div>

      {caption ? (
        <figcaption className="mt-3 text-sm text-ink-500">{caption}</figcaption>
      ) : null}
    </figure>
  );
}

export default WasonTask;
