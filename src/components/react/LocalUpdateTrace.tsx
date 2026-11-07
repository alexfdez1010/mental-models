import { useId, useState } from 'react';
import { cx } from '@/components/react/cx';

export type LocalBit = 0 | 1;
export type LocalNode = 'A' | 'B' | 'C' | 'D';
export type LocalConfiguration = [LocalBit, LocalBit, LocalBit, LocalBit];
export interface LocalUpdateCase { id: string; label: string; initial: LocalConfiguration }
export interface LocalUpdateProtocol {
  id: string;
  label: string;
  description: string;
  mode: 'parallel' | 'sequential';
  /** Parallel: one or two rounds. Sequential: exactly one complete sweep. */
  rounds: 1 | 2;
  order?: [LocalNode, LocalNode, LocalNode, LocalNode];
}
export interface LocalUpdateLabels {
  caseLabel: string; protocolLabel: string; previousLabel: string; nextLabel: string;
  resetLabel: string; initialLabel: string;
  /** Requires {step} and {total}. The selected protocol supplies the event unit. */
  stepTemplate: string;
  graphLabel: string; graphDescription: string; tableLabel: string;
  eventLabel: string; beforeLabel: string; updatedLabel: string; inputsLabel: string;
  proposalLabel: string; afterLabel: string; noneLabel: string; allLabel: string;
  pinnedLabel: string; roundLabel: string; sweepLabel: string;
  fixedLabel: string; notFixedLabel: string; consensusLabel: string; mixedLabel: string;
  /** Requires {length}; only nontrivial, phase-matched completed-round cycles. */
  cycleLabel: string;
  readRuleLabel: string;
  /** Requires {step}, {protocol}, {configuration}, {status}. */
  announcementTemplate: string;
}
export interface LocalUpdateTraceProps {
  title: string;
  instructions: string;
  cases: LocalUpdateCase[];
  protocols: LocalUpdateProtocol[];
  nodeLabels: [string, string, string, string];
  labels: LocalUpdateLabels;
  /** Persistent pin; all supplied starts must already have A zero. */
  pinnedA?: 0;
  locale?: 'en' | 'es';
  className?: string;
}
export interface LocalRead { target: number; sources: [number, number, number]; values: [LocalBit, LocalBit, LocalBit]; proposal: LocalBit }
export interface LocalUpdateEvent {
  before: LocalConfiguration;
  after: LocalConfiguration;
  reads: LocalRead[];
  /** Zero at the initial configuration; sequential events also have a phase. */
  round: number;
  phase: number;
}
const nodes: LocalNode[] = ['A', 'B', 'C', 'D'];
const keys: (keyof LocalUpdateLabels)[] = ['caseLabel','protocolLabel','previousLabel','nextLabel','resetLabel','initialLabel','stepTemplate','graphLabel','graphDescription','tableLabel','eventLabel','beforeLabel','updatedLabel','inputsLabel','proposalLabel','afterLabel','noneLabel','allLabel','pinnedLabel','roundLabel','sweepLabel','fixedLabel','notFixedLabel','consensusLabel','mixedLabel','cycleLabel','readRuleLabel','announcementTemplate'];
const nonempty = (x: unknown): x is string => typeof x === 'string' && x.trim().length > 0;
const dense = (x: unknown, n?: number): x is unknown[] => Array.isArray(x) && (n === undefined || x.length === n) && Array.from({ length: x.length }, (_, i) => Object.hasOwn(x, i)).every(Boolean);
const copy = (s: LocalConfiguration): LocalConfiguration => [...s];
const encoded = (s: LocalConfiguration) => s.join('');
function read(s: LocalConfiguration, target: number): LocalRead {
  const sources: [number, number, number] = [(target + 3) % 4, target, (target + 1) % 4];
  const values = sources.map(i => s[i]!) as [LocalBit, LocalBit, LocalBit];
  return { target, sources, values, proposal: values[0] + values[1] + values[2] >= 2 ? 1 : 0 };
}
function nextParallel(s: LocalConfiguration, pinnedA?: 0): LocalConfiguration {
  return nodes.map((_, i) => i === 0 && pinnedA === 0 ? 0 : read(s, i).proposal) as LocalConfiguration;
}
/** Validate the full bounded catalogue before evaluating any currently visible selection. */
export function auditLocalUpdateTrace(cases: LocalUpdateCase[], protocols: LocalUpdateProtocol[], pinnedA?: 0): LocalUpdateEvent[][][] {
  if (!dense(cases) || cases.length < 1 || cases.length > 16 || !dense(protocols) || protocols.length < 1 || protocols.length > 3 || (pinnedA !== undefined && pinnedA !== 0)) throw new Error('LocalUpdateTrace: invalid case/protocol catalogue or pin.');
  for (const c of cases) {
    if (!c || !nonempty(c.id) || !nonempty(c.label) || !dense(c.initial, 4) || c.initial.some(v => v !== 0 && v !== 1) || (pinnedA === 0 && c.initial[0] !== 0)) throw new Error('LocalUpdateTrace: each case needs a named four-bit legal initial configuration.');
  }
  if (new Set(cases.map(c => c.id.trim())).size !== cases.length || new Set(cases.map(c => c.label.trim())).size !== cases.length || new Set(cases.map(c => encoded(c.initial))).size !== cases.length) throw new Error('LocalUpdateTrace: case identifiers, labels and configurations must be distinct.');
  for (const p of protocols) {
    if (!p || !nonempty(p.id) || !nonempty(p.label) || !nonempty(p.description) || !['parallel','sequential'].includes(p.mode)) throw new Error('LocalUpdateTrace: invalid named protocol.');
    if (p.mode === 'parallel' && (![1,2].includes(p.rounds) || p.order !== undefined)) throw new Error('LocalUpdateTrace: parallel protocols require one or two rounds and no order.');
    if (p.mode === 'sequential' && (pinnedA !== undefined || p.rounds !== 1 || !dense(p.order, 4) || p.order.some(n => !nodes.includes(n)) || new Set(p.order).size !== 4)) throw new Error('LocalUpdateTrace: sequential protocols require one unpinned complete permutation.');
  }
  if (new Set(protocols.map(p => p.id.trim())).size !== protocols.length || new Set(protocols.map(p => p.label.trim())).size !== protocols.length) throw new Error('LocalUpdateTrace: protocol identifiers and labels must be distinct.');
  return cases.map(c => protocols.map(p => {
    let s = copy(c.initial);
    const events: LocalUpdateEvent[] = [{ before: copy(s), after: copy(s), reads: [], round: 0, phase: 0 }];
    if (p.mode === 'parallel') {
      for (let round = 1; round <= p.rounds; round++) {
        const before = copy(s), reads = nodes.flatMap((_, i) => i === 0 && pinnedA === 0 ? [] : [read(before, i)]);
        s = nextParallel(before, pinnedA);
        events.push({ before, after: copy(s), reads, round, phase: 0 });
      }
    } else {
      for (let phase = 0; phase < 4; phase++) {
        const before = copy(s), r = read(before, nodes.indexOf(p.order![phase]!));
        s[r.target] = r.proposal;
        events.push({ before, after: copy(s), reads: [r], round: phase === 3 ? 1 : 0, phase: (phase + 1) % 4 });
      }
    }
    return events;
  }));
}
/** Current local-rule fixedness is distinct from timeline completion and from consensus. */
export function localUpdateStatus(events: LocalUpdateEvent[], index: number, pinnedA?: 0) {
  if (!Number.isInteger(index) || index < 0 || index >= events.length) throw new Error('LocalUpdateTrace: invalid displayed event.');
  const shown = events[index]!, state = shown.after;
  const fixed = encoded(nextParallel(state, pinnedA)) === encoded(state);
  let cycleLength: number | null = null;
  if (!fixed && shown.phase === 0 && shown.round > 0) {
    for (let i = index - 1; i >= 0; i--) {
      const previous = events[i]!;
      if (previous.phase === 0 && encoded(previous.after) === encoded(state) && shown.round - previous.round > 1) { cycleLength = shown.round - previous.round; break; }
    }
  }
  return { fixed, consensus: state.every(v => v === state[0]), cycleLength };
}
const button = 'min-h-11 rounded-pill px-4 py-2 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 disabled:cursor-not-allowed disabled:opacity-40';
/** A finite four-node majority-ring audit, with explicit snapshot versus immediate reads. */
export function LocalUpdateTrace({ title, instructions, cases, protocols, nodeLabels, labels, pinnedA, locale = 'en', className }: LocalUpdateTraceProps) {
  const catalogue = auditLocalUpdateTrace(cases, protocols, pinnedA);
  if (!nonempty(title) || !nonempty(instructions) || !dense(nodeLabels, 4) || nodeLabels.some(n => !nonempty(n)) || new Set(nodeLabels.map(n => n.trim())).size !== 4 || (locale !== 'en' && locale !== 'es') || !labels || keys.some(k => !nonempty(labels[k]))) throw new Error('LocalUpdateTrace: complete localized labels, title, instructions and node labels are required.');
  for (const [template, tokens] of [[labels.stepTemplate,['{step}','{total}']], [labels.cycleLabel,['{length}']], [labels.announcementTemplate,['{step}','{protocol}','{configuration}','{status}']]] as const) if (tokens.some(t => !template.includes(t))) throw new Error('LocalUpdateTrace: missing required template token.');
  const id = useId();
  const [caseIndex, setCaseIndex] = useState(0), [protocolIndex, setProtocolIndex] = useState(0), [step, setStep] = useState(0);
  const ci = Math.min(caseIndex, cases.length - 1), pi = Math.min(protocolIndex, protocols.length - 1);
  const protocol = protocols[pi]!, events = catalogue[ci]![pi]!, current = Math.min(step, events.length - 1), shown = events[current]!;
  const status = localUpdateStatus(events, current, pinnedA);
  const format = (n: number) => new Intl.NumberFormat(locale === 'es' ? 'es-ES' : 'en-US').format(n);
  const stepText = current === 0 ? labels.initialLabel : `${labels.stepTemplate.replaceAll('{step}', format(current)).replaceAll('{total}', format(events.length - 1))} — ${protocol.mode === 'parallel' ? labels.roundLabel : labels.sweepLabel}`;
  const stateText = [status.fixed ? labels.fixedLabel : labels.notFixedLabel, status.consensus ? labels.consensusLabel : labels.mixedLabel, ...(status.cycleLength === null ? [] : [labels.cycleLabel.replaceAll('{length}', format(status.cycleLength))])].join(' ');
  const announcementValues = { step: stepText, protocol: protocol.label, configuration: encoded(shown.after), status: stateText };
  const announcement = labels.announcementTemplate.replace(/\{(step|protocol|configuration|status)\}/g, (_, token: keyof typeof announcementValues) => announcementValues[token]);
  const positions = [[160,42],[270,120],[160,198],[50,120]] as const;
  return <section className={cx('not-prose my-8 min-w-0 rounded-card bg-surface p-4 shadow-soft sm:p-6', className)} aria-labelledby={`${id}-title`} data-local-update-trace="" data-case={cases[ci]!.id} data-protocol={protocol.id} data-step={current} data-fixed={status.fixed} data-consensus={status.consensus} data-cycle={status.cycleLength ?? ''}>
    <h3 id={`${id}-title`} className="mb-3 font-display text-xl font-bold text-ink-900">{title}</h3>
    <p className="mb-4 text-sm text-ink-700">{instructions}</p>
    <div className="grid min-w-0 gap-4 sm:grid-cols-2">
      <label className="flex min-w-0 flex-col gap-2 text-sm font-semibold text-ink-800">{labels.caseLabel}<select className="min-h-11 min-w-0 w-full rounded-lg border border-ink-300 bg-surface px-2 focus-visible:outline-2 focus-visible:outline-brand-600" value={ci} onChange={e => { setCaseIndex(Number(e.target.value)); setStep(0); }}>{cases.map((c,i) => <option key={c.id} value={i}>{c.label}</option>)}</select></label>
      <label className="flex min-w-0 flex-col gap-2 text-sm font-semibold text-ink-800">{labels.protocolLabel}<select className="min-h-11 min-w-0 w-full rounded-lg border border-ink-300 bg-surface px-2 focus-visible:outline-2 focus-visible:outline-brand-600" value={pi} onChange={e => { setProtocolIndex(Number(e.target.value)); setStep(0); }}>{protocols.map((p,i) => <option key={p.id} value={i}>{p.label}</option>)}</select></label>
    </div>
    <p className="mt-4 text-sm text-ink-700"><span className="font-semibold">{labels.readRuleLabel}: </span>{protocol.description}</p>
    {pinnedA === 0 && <p className="mt-2 text-sm text-ink-700">{nodeLabels[0]}: {labels.pinnedLabel}</p>}
    <svg viewBox="0 0 320 240" role="img" aria-labelledby={`${id}-graph-title ${id}-graph-desc`} className="mx-auto my-3 w-full max-w-md">
      <title id={`${id}-graph-title`}>{labels.graphLabel}</title><desc id={`${id}-graph-desc`}>{labels.graphDescription}</desc>
      {[0,1,2,3].map(i => <line key={i} x1={positions[i]![0]} y1={positions[i]![1]} x2={positions[(i+1)%4]![0]} y2={positions[(i+1)%4]![1]} stroke="currentColor" strokeWidth="2" className="text-ink-300" />)}
      {nodes.map((node,i) => <g key={node} data-node={node} data-bit={shown.after[i]} data-updated={shown.reads.some(r => r.target === i)} transform={`translate(${positions[i]![0]},${positions[i]![1]})`}>
        <circle r="33" fill={shown.after[i] === 1 ? 'var(--color-brand-100)' : 'var(--color-surface)'} stroke="currentColor" strokeWidth={shown.reads.some(r => r.target === i) ? 4 : 2} className="text-brand-600" />
        <text textAnchor="middle" y="-6" fontSize="19" className="fill-current text-ink-700">{node}</text><text textAnchor="middle" y="20" fontSize="26" fontWeight="700" className="fill-current text-ink-900">{shown.after[i]}</text>
      </g>)}
    </svg>
    <p role="status" aria-live="polite" aria-atomic="true" className="mb-4 break-words text-sm font-semibold text-ink-900">{announcement}</p>
    <div className="mb-5 flex flex-wrap gap-2"><button type="button" className={cx(button,'bg-brand-100 text-brand-800')} disabled={current === 0} onClick={() => setStep(current-1)}>{labels.previousLabel}</button><button type="button" className={cx(button,'bg-brand-600 text-white')} disabled={current === events.length-1} onClick={() => setStep(current+1)}>{labels.nextLabel}</button><button type="button" className={cx(button,'bg-surface text-ink-800')} disabled={current === 0} onClick={() => setStep(0)}>{labels.resetLabel}</button></div>
    <div role="region" aria-label={labels.tableLabel} tabIndex={0} className="max-w-full overflow-x-auto focus-visible:outline-2 focus-visible:outline-brand-600"><table style={{ display: 'table', overflow: 'visible', margin: 0 }} className="w-full min-w-[42rem] text-left text-sm text-ink-800"><caption className="mb-2 text-left text-sm text-ink-600">{labels.tableLabel}</caption><thead><tr>{[labels.eventLabel,labels.beforeLabel,labels.updatedLabel,labels.inputsLabel,labels.proposalLabel,labels.afterLabel].map((h,i) => <th key={i} scope="col" className="px-3 py-2 align-bottom font-semibold">{h}</th>)}</tr></thead><tbody>{events.slice(0,current+1).map((event,i) => <tr key={i} data-event={i} className="odd:bg-brand-50/40"><th scope="row" className="px-3 py-3 align-top font-medium">{i === 0 ? labels.initialLabel : format(i)}</th><td className="px-3 py-3 align-top font-mono">{encoded(event.before)}</td><td className="px-3 py-3 align-top">{event.reads.length === 4 ? labels.allLabel : event.reads.length ? event.reads.map(r => nodeLabels[r.target]).join(', ') : labels.noneLabel}</td><td className="px-3 py-3 align-top">{event.reads.length ? event.reads.map(r => <div key={r.target} className="whitespace-nowrap">{nodes[r.target]} ← {r.sources.map((s,j) => `${nodes[s]}:${r.values[j]}`).join(', ')}</div>) : labels.noneLabel}</td><td className="px-3 py-3 align-top">{event.reads.length ? event.reads.map(r => <div key={r.target} className="whitespace-nowrap">{nodes[r.target]}: {r.proposal}</div>) : labels.noneLabel}</td><td className="px-3 py-3 align-top font-mono">{encoded(event.after)}</td></tr>)}</tbody></table></div>
  </section>;
}
