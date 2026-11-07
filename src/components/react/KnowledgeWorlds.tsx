import { useId, useState } from 'react';
import { cx } from '@/components/react/cx';

/** A possible situation, not a delivery event, frequency or probability. */
export interface KnowledgeWorld {
  id: string;
  label: string;
  fact: boolean;
  /** Equal observation strings mean indistinguishable worlds for that agent. */
  observations: [string, string];
}

/** All visible and accessible copy is supplied together by the lesson. */
export interface KnowledgeWorldsLabels {
  actual: string;
  perspective: string;
  group: string;
  announcement: string;
  announcementHint: string;
  fact: string;
  true: string;
  false: string;
  observations: string;
  included: string;
  excluded: string;
  actualBadge: string;
  set: string;
  next: string;
  finish: string;
  restart: string;
  knows: string;
  doesNotKnow: string;
  common: string;
  notCommon: string;
  incomplete: string;
  closed: string;
}

export interface KnowledgeWorldsProps {
  title: string;
  instructions: string;
  caption: string;
  worlds: KnowledgeWorld[];
  agents: [string, string];
  labels: KnowledgeWorldsLabels;
  /** ID of the actual situation shown initially. */
  initialWorld: string;
  /** Individual possibilities, or iterated group reachability. */
  initialPerspective?: 'first' | 'second' | 'group';
  initialSteps?: number;
  /** Ideal truthful public announcement, restricting the model to fact=true. */
  initialAnnouncement?: boolean;
  className?: string;
}

/** Fail at authoring time rather than silently discarding malformed worlds. */
export function validateKnowledgeWorlds(worlds: KnowledgeWorld[], agents: [string, string]) {
  if (!Array.isArray(worlds) || worlds.length < 2) throw new Error('KnowledgeWorlds worlds needs at least two worlds');
  if (!Array.isArray(agents) || agents.length !== 2 || agents.some(a => typeof a !== 'string' || !a.trim())) throw new Error('KnowledgeWorlds agents needs two nonempty names');
  const ids = new Set<string>();
  for (const world of worlds) {
    if (!world || typeof world.id !== 'string' || !world.id.trim() || ids.has(world.id)) throw new Error('KnowledgeWorlds worlds needs unique nonempty ids');
    ids.add(world.id);
    if (typeof world.label !== 'string' || !world.label.trim() || typeof world.fact !== 'boolean') throw new Error('KnowledgeWorlds world label/fact is invalid');
    if (!Array.isArray(world.observations) || world.observations.length !== 2 || world.observations.some(o => typeof o !== 'string' || !o.trim())) throw new Error('KnowledgeWorlds observations needs two nonempty strings per world');
  }
}

/** Breadth-first union of both agents' equivalence relations, including self. */
export function reachableKnowledgeWorlds(worlds: KnowledgeWorld[], actualId: string, steps: number): KnowledgeWorld[] {
  if (!Number.isInteger(steps) || steps < 0) throw new Error('KnowledgeWorlds steps must be a nonnegative integer');
  if (!worlds.some(w => w.id === actualId)) throw new Error('KnowledgeWorlds actual world must exist in the active model');
  const ids = new Set([actualId]);
  for (let step = 0; step < Math.min(steps, worlds.length); step += 1) {
    const current = worlds.filter(w => ids.has(w.id));
    const added = worlds.filter(w => current.some(from => from.observations.some((observation, agent) => observation === w.observations[agent])));
    const before = ids.size;
    added.forEach(w => ids.add(w.id));
    if (before === ids.size) break;
  }
  return worlds.filter(w => ids.has(w.id));
}

/** Inspect compatible observations, then expand a common-knowledge proof. */
export function KnowledgeWorlds({ title, instructions, caption, worlds, agents, labels, initialWorld, initialPerspective = 'first', initialSteps = 0, initialAnnouncement = false, className }: KnowledgeWorldsProps) {
  validateKnowledgeWorlds(worlds, agents);
  if (!worlds.some(w => w.id === initialWorld)) throw new Error('KnowledgeWorlds initialWorld must name a world');
  if (!['first', 'second', 'group'].includes(initialPerspective)) throw new Error('KnowledgeWorlds initialPerspective is invalid');
  if (!Number.isInteger(initialSteps) || initialSteps < 0) throw new Error('KnowledgeWorlds initialSteps must be a nonnegative integer');
  if (initialAnnouncement && !worlds.find(w => w.id === initialWorld)!.fact) throw new Error('KnowledgeWorlds truthful announcement cannot start in a false world');
  const labelKeys: (keyof KnowledgeWorldsLabels)[] = ['actual','perspective','group','announcement','announcementHint','fact','true','false','observations','included','excluded','actualBadge','set','next','finish','restart','knows','doesNotKnow','common','notCommon','incomplete','closed'];
  if (!labels || labelKeys.some(k => typeof labels[k] !== 'string' || !labels[k].trim())) throw new Error('KnowledgeWorlds labels must supply all nonempty UI strings');
  const id = useId();
  const [actualId, setActualId] = useState(initialWorld);
  const [perspective, setPerspective] = useState(initialPerspective);
  const [steps, setSteps] = useState(initialSteps);
  const [announcement, setAnnouncement] = useState(initialAnnouncement);
  const active = announcement ? worlds.filter(w => w.fact) : worlds;
  const actual = active.find(w => w.id === actualId)!;
  const agentIndex = perspective === 'second' ? 1 : 0;
  const personal = active.filter(w => w.observations[agentIndex] === actual.observations[agentIndex]);
  const reached = reachableKnowledgeWorlds(active, actualId, steps);
  const next = reachableKnowledgeWorlds(active, actualId, steps + 1);
  const closed = reached.length === next.length;
  const shown = perspective === 'group' ? reached : personal;
  const allTrue = shown.every(w => w.fact);
  const verdict = perspective === 'group'
    ? !allTrue ? labels.notCommon : closed ? labels.common : labels.incomplete
    : (allTrue ? labels.knows : labels.doesNotKnow).replaceAll('{agent}', agents[agentIndex]);
  const changeAnnouncement = (checked: boolean) => {
    // A true announcement cannot be applied at a false actual world.
    if (checked && !actual.fact) return;
    setAnnouncement(checked); setSteps(0);
  };
  const control = 'min-h-11 min-w-0 w-full rounded-card border border-ink-300 bg-surface px-3 py-2 text-sm text-ink-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600';
  return (
    <figure className={cx('not-prose brutal my-6 bg-surface p-5 sm:p-6', className)} aria-labelledby={`${id}-title`}>
      <p id={`${id}-title`} className="font-display text-lg font-semibold text-ink-900">{title}</p>
      <p className="mt-2 text-sm text-ink-700">{instructions}</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="grid min-w-0 gap-1 text-sm font-semibold text-ink-700">{labels.actual}
          <select className={control} value={actualId} onChange={e => { setActualId(e.target.value); setSteps(0); }}>
            {active.map(w => <option key={w.id} value={w.id}>{w.label}</option>)}
          </select>
        </label>
        <label className="grid min-w-0 gap-1 text-sm font-semibold text-ink-700">{labels.perspective}
          <select className={control} value={perspective} onChange={e => { setPerspective(e.target.value as typeof perspective); setSteps(0); }}>
            <option value="first">{agents[0]}</option><option value="second">{agents[1]}</option><option value="group">{labels.group}</option>
          </select>
        </label>
      </div>
      <label className="mt-3 flex min-h-11 items-center gap-3 text-sm font-semibold text-ink-800">
        <input type="checkbox" checked={announcement} disabled={!actual.fact} onChange={e => changeAnnouncement(e.target.checked)} aria-describedby={`${id}-announcement`} className="size-5 shrink-0 accent-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600" />
        {labels.announcement}
      </label>
      <p id={`${id}-announcement`} className="text-xs text-ink-600">{labels.announcementHint}</p>
      <ul className="mt-4 grid list-none gap-3 p-0 sm:grid-cols-2">
        {active.map(w => {
          const included = shown.some(s => s.id === w.id);
          return <li key={w.id} className={cx('rounded-card border p-3 transition-colors motion-reduce:transition-none', included ? 'border-brand-600 bg-brand-50' : 'border-ink-200 bg-surface-sunken')}>
            <p className="font-display font-semibold text-ink-900">{w.label}</p>
            <p className="mt-1 text-sm font-semibold text-ink-800">{included ? labels.included : labels.excluded}{w.id === actualId ? ` — ${labels.actualBadge}` : ''}</p>
            <p className="mt-2 text-sm text-ink-700">{labels.fact}: {w.fact ? labels.true : labels.false}</p>
            <p className="mt-1 text-xs text-ink-600">{labels.observations}: {agents[0]} — {w.observations[0]}; {agents[1]} — {w.observations[1]}</p>
          </li>;
        })}
      </ul>
      {perspective === 'group' ? <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" disabled={closed} onClick={() => setSteps(s => s + 1)} className="brutal-btn min-h-11 bg-brand-600 px-4 py-2 text-sm text-white disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600">{labels.next}</button>
        <button type="button" disabled={closed} onClick={() => setSteps(active.length)} className="min-h-11 rounded-pill px-4 py-2 text-sm font-semibold text-brand-700 ring-1 ring-brand-300 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600">{labels.finish}</button>
        <button type="button" onClick={() => setSteps(0)} className="min-h-11 rounded-pill px-4 py-2 text-sm font-semibold text-ink-700 ring-1 ring-ink-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600">{labels.restart}</button>
      </div> : null}
      <div aria-live="polite" aria-atomic="true" className="mt-4 text-sm text-ink-800">
        <p><strong>{labels.set}:</strong> {shown.map(w => w.label).join('; ')}</p>
        <p className="mt-2 font-semibold">{verdict}</p>
        {perspective === 'group' && closed ? <p className="mt-1">{labels.closed}</p> : null}
      </div>
      <figcaption className="mt-3 text-sm text-ink-600">{caption}</figcaption>
    </figure>
  );
}

export default KnowledgeWorlds;
