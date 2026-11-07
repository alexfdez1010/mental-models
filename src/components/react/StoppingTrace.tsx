import { useId, useState } from 'react';
import { cx } from '@/components/react/cx';

export interface StoppingExample {
  label: string;
  /** Completed analyst ranks, a permutation of one through the horizon; greatest is best. */
  order: number[];
}
export interface StoppingTraceProps {
  examples: StoppingExample[];
  initialCutoff?: number;
  title?: string;
  caption?: string;
  instructions?: string;
  exampleLabel?: string;
  cutoffLabel?: string;
  revealLabel?: string;
  restartLabel?: string;
  debriefLabel?: string;
  chooserLabel?: string;
  noObservationsLabel?: string;
  orderNote?: string;
  historyLabel?: string;
  positionLabel?: string;
  relativeRankLabel?: string;
  ofLabel?: string;
  actionLabel?: string;
  sampleLabel?: string;
  rejectLabel?: string;
  recordChoiceLabel?: string;
  finalChoiceLabel?: string;
  selectedLabel?: string;
  hiddenOutcomeLabel?: string;
  debriefHeading?: string;
  globalRankLabel?: string;
  winLabel?: string;
  lossLabel?: string;
  className?: string;
}

export function validateStoppingExamples(examples: StoppingExample[]): void {
  if (!Array.isArray(examples) || examples.length < 1 || examples.length > 12) {
    throw new Error('StoppingTrace requires one to twelve examples.');
  }
  const horizon = examples[0]?.order?.length;
  for (const example of examples) {
    if (typeof example?.label !== 'string' || !example.label.trim() || !Array.isArray(example.order) || example.order.length !== horizon || horizon < 2 || horizon > 8) {
      throw new Error('StoppingTrace examples require labels and the same horizon from two to eight.');
    }
    if (new Set(example.order).size !== horizon || example.order.some(rank => !Number.isInteger(rank) || rank < 1 || rank > horizon)) {
      throw new Error('StoppingTrace orders must be permutations of one through the horizon.');
    }
  }
}

/** Public view contains relative comparisons of revealed items, never their absolute ranks or future. */
export function stoppingView(order: number[], cutoff: number, requested: number) {
  validateStoppingExamples([{ label: 'validation', order }]);
  if (!Number.isInteger(cutoff) || cutoff < 0 || cutoff >= order.length || !Number.isInteger(requested) || requested < 0 || requested > order.length) {
    throw new Error('StoppingTrace cutoff or reveal count is outside the declared horizon.');
  }
  const observed: number[] = [];
  const actions: ('sample' | 'reject' | 'record' | 'final')[] = [];
  let selectedPosition: number | null = null;
  for (let i = 0; i < requested; i++) {
    const record = observed.every(rank => order[i]! > rank);
    observed.push(order[i]!);
    if (i < cutoff) actions.push('sample');
    else if (record) { actions.push('record'); selectedPosition = i + 1; }
    else if (i === order.length - 1) { actions.push('final'); selectedPosition = i + 1; }
    else actions.push('reject');
    if (selectedPosition !== null) break;
  }
  return {
    observedCount: observed.length,
    selectedPosition,
    rows: observed.map((rank, i) => ({
      position: i + 1,
      relativeRank: 1 + observed.filter(other => other > rank).length,
      action: actions[i]!,
    })),
  };
}

/** Step a declared cutoff policy; opening the completed record is a separate after-decision action. */
export function StoppingTrace({
  examples,
  initialCutoff = 1,
  title,
  caption,
  instructions = 'Choose the run and opening rejection count before revealing an option. Each step executes the declared rule.',
  exampleLabel = 'Teaching run',
  cutoffLabel = 'Opening options to reject',
  revealLabel = 'Reveal next option',
  restartLabel = 'Restart the trace',
  debriefLabel = 'Open the completed record',
  chooserLabel = 'Chooser view',
  noObservationsLabel = 'No options revealed yet.',
  orderNote = 'Order among revealed options only; first rank is best. Bar heights encode order, not quality gaps.',
  historyLabel = 'Observed comparisons and policy actions',
  positionLabel = 'Arrival position',
  relativeRankLabel = 'Rank among options revealed now',
  ofLabel = 'of',
  actionLabel = 'Action at arrival',
  sampleLabel = 'Reject during the opening sample',
  rejectLabel = 'Reject: not a new record',
  recordChoiceLabel = 'Select: first eligible record',
  finalChoiceLabel = 'Select: final-option fallback',
  selectedLabel = 'Selected arrival position',
  hiddenOutcomeLabel = 'The overall outcome stays hidden until the completed-record debrief.',
  debriefHeading = 'Completed record after the decision',
  globalRankLabel = 'Global rank; greatest is best',
  winLabel = 'Selected the unique greatest',
  lossLabel = 'Did not select the unique greatest',
  className,
}: StoppingTraceProps) {
  validateStoppingExamples(examples);
  const horizon = examples[0]!.order.length;
  if (!Number.isInteger(initialCutoff) || initialCutoff < 0 || initialCutoff >= horizon) throw new Error('StoppingTrace initialCutoff is outside the horizon.');
  const id = useId();
  const [exampleIndex, setExampleIndex] = useState(0);
  const [cutoff, setCutoff] = useState(initialCutoff);
  const [revealed, setRevealed] = useState(0);
  const [debrief, setDebrief] = useState(false);
  const example = examples[exampleIndex]!;
  const view = stoppingView(example.order, cutoff, revealed);
  const selected = view.selectedPosition;
  const actions = { sample: sampleLabel, reject: rejectLabel, record: recordChoiceLabel, final: finalChoiceLabel };
  const reset = () => { setRevealed(0); setDebrief(false); };

  return (
    <figure className={cx('not-prose my-8 min-w-0', className)} aria-labelledby={title ? `${id}-title` : undefined}>
      {title ? <figcaption id={`${id}-title`} className="font-display text-lg font-semibold text-ink-900">{title}</figcaption> : null}
      <p className="mt-2 text-sm text-ink-700">{instructions}</p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor={`${id}-example`} className="block text-sm font-semibold text-ink-700">{exampleLabel}</label>
          <select id={`${id}-example`} value={exampleIndex} disabled={view.observedCount > 0} onChange={e => { setExampleIndex(Number(e.currentTarget.value)); reset(); }} className="mt-2 min-h-11 w-full rounded-card border border-ink-300 bg-surface px-3 py-2 text-sm text-ink-900 disabled:opacity-60">
            {examples.map((item, i) => <option key={i} value={i}>{item.label}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor={`${id}-cutoff`} className="block text-sm font-semibold text-ink-700">{cutoffLabel}</label>
          <select id={`${id}-cutoff`} value={cutoff} disabled={view.observedCount > 0} onChange={e => setCutoff(Number(e.currentTarget.value))} className="mt-2 min-h-11 w-full rounded-card border border-ink-300 bg-surface px-3 py-2 text-sm text-ink-900 disabled:opacity-60">
            {Array.from({ length: horizon }, (_, k) => <option key={k} value={k}>{k}</option>)}
          </select>
        </div>
      </div>
      <p className="mt-5 font-semibold text-ink-900">{chooserLabel}</p>
      <p className="mt-1 text-sm text-ink-600">{orderNote}</p>
      {view.rows.length ? (
        <>
          <div aria-hidden="true" className="mt-4 flex h-32 items-end gap-3">
            {view.rows.map(row => <div key={row.position} className="flex h-full min-w-0 flex-1 flex-col justify-end text-center">
              <div className={cx('mx-auto w-full max-w-12 bg-brand-700 transition-[height] duration-200 motion-reduce:transition-none', row.position === selected && 'bg-accent-600')} style={{ height: `${((view.observedCount - row.relativeRank + 1) / view.observedCount) * 80}%` }} />
              <span className="mt-1 font-mono text-xs text-ink-700">{row.position}</span>
            </div>)}
          </div>
          <div className="mt-4 max-w-full overflow-x-auto">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">{historyLabel}</caption>
              <thead><tr><th scope="col" className="p-2">{positionLabel}</th><th scope="col" className="p-2">{relativeRankLabel}</th><th scope="col" className="p-2">{actionLabel}</th></tr></thead>
              <tbody>{view.rows.map(row => <tr key={row.position} className="odd:bg-surface-sunken"><th scope="row" className="p-2 font-mono">{row.position}</th><td className="p-2 font-mono">{row.relativeRank} {ofLabel} {view.observedCount}</td><td className="p-2">{actions[row.action]}</td></tr>)}</tbody>
            </table>
          </div>
        </>
      ) : <p className="mt-4 text-sm text-ink-600">{noObservationsLabel}</p>}
      <div className="mt-4 flex flex-wrap gap-3">
        <button type="button" disabled={selected !== null} onClick={() => setRevealed(n => Math.min(n + 1, horizon))} className="min-h-11 rounded-pill bg-brand-700 px-4 py-2 text-sm font-semibold text-surface disabled:opacity-50">{revealLabel}</button>
        <button type="button" disabled={selected === null || debrief} onClick={() => setDebrief(true)} className="min-h-11 rounded-pill border border-brand-700 px-4 py-2 text-sm font-semibold text-brand-700 disabled:opacity-50">{debriefLabel}</button>
        <button type="button" onClick={reset} className="min-h-11 rounded-pill border border-ink-300 px-4 py-2 text-sm text-ink-700">{restartLabel}</button>
      </div>
      <p className="mt-3 text-sm text-ink-700" aria-live="polite" aria-atomic="true">{selected !== null ? `${selectedLabel}: ${selected}. ${debrief ? (example.order[selected - 1] === horizon ? winLabel : lossLabel) : hiddenOutcomeLabel}` : view.rows.length ? `${positionLabel}: ${view.observedCount}. ${actions[view.rows.at(-1)!.action]}` : noObservationsLabel}</p>
      {debrief && selected !== null ? <section aria-label={debriefHeading} className="mt-5 bg-surface-sunken p-4">
        <h3 className="font-display font-semibold text-ink-900">{debriefHeading}</h3>
        <div className="mt-3 max-w-full overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr><th scope="col" className="p-2">{positionLabel}</th><th scope="col" className="p-2">{globalRankLabel}</th></tr></thead><tbody>{example.order.map((rank, i) => <tr key={i} className="odd:bg-surface"><th scope="row" className="p-2">{i + 1}</th><td className="p-2 font-mono">{rank}{i + 1 === selected ? ` (${selectedLabel})` : ''}</td></tr>)}</tbody></table></div>
      </section> : null}
      {caption ? <p className="mt-3 text-sm text-ink-600">{caption}</p> : null}
    </figure>
  );
}
