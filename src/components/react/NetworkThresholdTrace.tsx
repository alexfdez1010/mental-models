import { useId, useState } from 'react';
import { cx } from '@/components/react/cx';

export interface ThresholdTeam { id: string; label: string; threshold: number }
export interface NetworkThresholdTraceProps {
  /** Five declared teams; their order fixes the diagram layout, not the update order. */
  teams: ThresholdTeam[];
  /** Directed source-to-target contacts; each contributes one exposure. */
  arcs: [string, string][];
  initialSeeds?: string[];
  /** The only threshold control: choose one or two contacts for this team. */
  adjustableTeam: string;
  title?: string;
  caption?: string;
  seedsLabel?: string;
  thresholdLabel?: string;
  stepLabel?: string;
  finishLabel?: string;
  resetLabel?: string;
  graphLabel?: string;
  graphDescription?: string;
  tableLabel?: string;
  teamLabel?: string;
  contactsLabel?: string;
  requiredLabel?: string;
  exposureLabel?: string;
  statusLabel?: string;
  seedLabel?: string;
  newLabel?: string;
  activeLabel?: string;
  nextLabel?: string;
  inactiveLabel?: string;
  noneLabel?: string;
  progressTemplate?: string;
  closedLabel?: string;
  openLabel?: string;
  className?: string;
}

export function validateThresholdNetwork(teams: ThresholdTeam[], arcs: [string, string][], seeds: string[], adjustableTeam: string): void {
  if (!Array.isArray(teams) || teams.length !== 5 || Array.from(teams).some(t => !t || typeof t.id !== 'string' || !t.id.trim() || typeof t.label !== 'string' || !t.label.trim() || !Number.isInteger(t.threshold) || t.threshold < 1)) {
    throw new Error('NetworkThresholdTrace requires five labeled teams with positive integer thresholds.');
  }
  const ids = new Set(teams.map(t => t.id));
  if (ids.size !== 5 || !ids.has(adjustableTeam) || ![1, 2].includes(teams.find(t => t.id === adjustableTeam)!.threshold)) throw new Error('NetworkThresholdTrace team IDs or adjustable threshold are invalid.');
  if (!Array.isArray(arcs) || Array.from(arcs).some(a => !Array.isArray(a) || a.length !== 2 || !ids.has(a[0]) || !ids.has(a[1]) || a[0] === a[1]) || new Set(arcs.map(a => JSON.stringify(a))).size !== arcs.length) throw new Error('NetworkThresholdTrace contacts must be distinct directed pairs of different declared teams.');
  if (!Array.isArray(seeds) || new Set(seeds).size !== seeds.length || Array.from(seeds).some(id => !ids.has(id))) throw new Error('NetworkThresholdTrace seeds must be distinct declared teams.');
}

/** Evaluate against a single immutable snapshot; newly eligible teams never contribute within this step. */
export function thresholdNext(teams: ThresholdTeam[], arcs: [string, string][], active: readonly string[]): string[] {
  const current = new Set(active);
  return teams.filter(team => !current.has(team.id) && arcs.filter(([source, target]) => target === team.id && current.has(source)).length >= team.threshold).map(team => team.id);
}

/** Include round zero and each nonempty activation round; closure is a state, not an extra empty round. */
export function thresholdHistory(teams: ThresholdTeam[], arcs: [string, string][], seeds: string[]): { active: string[]; newly: string[] }[] {
  const active = new Set(seeds);
  const history = [{ active: teams.filter(t => active.has(t.id)).map(t => t.id), newly: teams.filter(t => active.has(t.id)).map(t => t.id) }];
  while (true) {
    const newly = thresholdNext(teams, arcs, [...active]);
    if (!newly.length) break;
    newly.forEach(id => active.add(id));
    history.push({ active: teams.filter(t => active.has(t.id)).map(t => t.id), newly });
  }
  return history;
}

const positions = [[65, 55], [65, 220], [235, 220], [320, 55], [465, 55]] as const;
const control = 'rounded-pill px-4 py-2 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 disabled:cursor-not-allowed disabled:opacity-40';

/** Step a fully stipulated progressive local-threshold model; this diagram does not estimate behavior. */
export function NetworkThresholdTrace({
  teams, arcs, initialSeeds = [], adjustableTeam, title, caption,
  seedsLabel = 'Initially committed teams',
  thresholdLabel = 'Required incoming contacts for {team}',
  stepLabel = 'Advance one round', finishLabel = 'Run to closure', resetLabel = 'Reset to round zero',
  graphLabel = 'Directed contact network',
  graphDescription = 'An arrow runs from the contributing team to the receiving team. The table gives the same contacts and current states.',
  tableLabel = 'Contacts and states at the displayed round',
  teamLabel = 'Team', contactsLabel = 'Incoming from', requiredLabel = 'Required contacts', exposureLabel = 'Active incoming now', statusLabel = 'Status',
  seedLabel = 'Committed seed', newLabel = 'Activated this round', activeLabel = 'Active', nextLabel = 'Eligible next round', inactiveLabel = 'Inactive', noneLabel = 'None',
  progressTemplate = 'Round {round}: {active} of {total} teams active. {state}',
  closedLabel = 'Closed: no further activation under these rules.', openLabel = 'Further activation is possible.', className,
}: NetworkThresholdTraceProps) {
  validateThresholdNetwork(teams, arcs, initialSeeds, adjustableTeam);
  const id = useId();
  const [seeds, setSeeds] = useState(initialSeeds);
  const [threshold, setThreshold] = useState(teams.find(t => t.id === adjustableTeam)!.threshold);
  const [round, setRound] = useState(0);
  const configured = teams.map(t => t.id === adjustableTeam ? { ...t, threshold } : t);
  const history = thresholdHistory(configured, arcs, seeds);
  const shown = history[Math.min(round, history.length - 1)]!;
  const active = new Set(shown.active), newly = new Set(shown.newly);
  const next = new Set(thresholdNext(configured, arcs, shown.active));
  const closed = next.size === 0;
  const label = (teamId: string) => teams.find(t => t.id === teamId)!.label;
  const progress = progressTemplate.replace('{round}', String(round)).replace('{active}', String(active.size)).replace('{total}', String(teams.length)).replace('{state}', closed ? closedLabel : openLabel);
  const status = (teamId: string) => seeds.includes(teamId) ? seedLabel : active.has(teamId) ? (newly.has(teamId) ? newLabel : activeLabel) : next.has(teamId) ? nextLabel : inactiveLabel;
  const stroke = (teamId: string) => active.has(teamId) ? 'text-brand-600' : next.has(teamId) ? 'text-accent-600' : 'text-ink-400';
  return (
    <section className={cx('not-prose my-8 rounded-card bg-surface p-4 sm:p-6 shadow-soft', className)} aria-labelledby={`${id}-title`}>
      <h3 id={`${id}-title`} className="mb-4 font-display text-xl font-bold text-ink-900">{title ?? graphLabel}</h3>
      <div className="flex flex-wrap items-end gap-5">
        <fieldset className="min-w-0">
          <legend className="mb-2 text-sm font-semibold text-ink-800">{seedsLabel}</legend>
          <div className="flex flex-wrap gap-3">{teams.map(team => <label key={team.id} className="flex min-h-11 items-center gap-2 text-sm text-ink-800"><input type="checkbox" checked={seeds.includes(team.id)} onChange={event => { setSeeds(event.target.checked ? [...seeds, team.id] : seeds.filter(s => s !== team.id)); setRound(0); }} className="h-4 w-4 accent-brand-600 focus-visible:outline-2 focus-visible:outline-brand-600" />{team.label}</label>)}</div>
        </fieldset>
        <label className="flex flex-col gap-2 text-sm font-semibold text-ink-800">{thresholdLabel.replace('{team}', label(adjustableTeam))}<select value={threshold} onChange={event => { setThreshold(Number(event.target.value)); setRound(0); }} className="min-h-11 rounded-lg border border-ink-300 bg-surface px-3 focus-visible:outline-2 focus-visible:outline-brand-600"><option value={1}>1</option><option value={2}>2</option></select></label>
      </div>
      <svg viewBox="0 0 530 280" role="img" aria-labelledby={`${id}-graph-title ${id}-graph-desc`} className="mt-3 w-full">
        <title id={`${id}-graph-title`}>{graphLabel}</title><desc id={`${id}-graph-desc`}>{graphDescription}</desc>
        <defs><marker id={`${id}-arrow`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" /></marker></defs>
        {arcs.map(([source, target]) => {
          const [sx, sy] = positions[teams.findIndex(t => t.id === source)]!, [tx, ty] = positions[teams.findIndex(t => t.id === target)]!;
          const length = Math.hypot(tx - sx, ty - sy), dx = (tx - sx) / length, dy = (ty - sy) / length;
          return <line key={`${source}-${target}`} x1={sx + dx * 31} y1={sy + dy * 31} x2={tx - dx * 35} y2={ty - dy * 35} stroke="currentColor" strokeWidth="2.5" markerEnd={`url(#${id}-arrow)`} className="text-ink-400" />;
        })}
        {teams.map((team, index) => <g key={team.id} transform={`translate(${positions[index]![0]},${positions[index]![1]})`}><circle r="29" fill={active.has(team.id) ? 'var(--color-brand-100)' : 'var(--color-surface)'} /><circle r="29" fill="none" stroke="currentColor" strokeWidth={next.has(team.id) ? 4 : 2.5} strokeDasharray={next.has(team.id) ? '5 4' : undefined} className={stroke(team.id)} /><text textAnchor="middle" dy="8" fontSize="24" fontWeight="700" className="fill-current text-ink-900">{team.id}</text></g>)}
      </svg>
      <p className="mb-4 text-sm font-semibold text-ink-900" role="status" aria-live="polite" aria-atomic="true">{progress}</p>
      <div className="mb-5 flex flex-wrap gap-2"><button type="button" className={cx(control, 'bg-brand-600 text-white')} disabled={closed} onClick={() => setRound(round + 1)}>{stepLabel}</button><button type="button" className={cx(control, 'bg-brand-100 text-brand-800')} disabled={closed} onClick={() => setRound(history.length - 1)}>{finishLabel}</button><button type="button" className={cx(control, 'bg-surface text-ink-800')} disabled={round === 0} onClick={() => setRound(0)}>{resetLabel}</button></div>
      <div className="overflow-x-auto focus-visible:outline-2 focus-visible:outline-brand-600" role="region" aria-label={tableLabel} tabIndex={0}><table className="w-full text-left text-sm text-ink-800"><caption className="mb-2 text-left text-sm text-ink-600">{tableLabel}</caption><thead><tr>{[teamLabel, contactsLabel, requiredLabel, exposureLabel, statusLabel].map((heading, index) => <th key={heading} scope="col" className={cx('px-2 py-2 align-bottom font-semibold', index === 0 && 'sticky left-0 z-20 bg-surface')}>{heading}</th>)}</tr></thead><tbody>{configured.map(team => <tr key={team.id} className="odd:bg-surface"><th scope="row" className="sticky left-0 z-10 bg-surface px-2 py-2 align-top font-semibold">{team.label}</th><td className="px-2 py-2 align-top">{arcs.filter(([, target]) => target === team.id).map(([source]) => label(source)).join(', ') || noneLabel}</td><td className="px-2 py-2 align-top tabular-nums">{team.threshold}</td><td className="px-2 py-2 align-top tabular-nums">{arcs.filter(([source, target]) => target === team.id && active.has(source)).length}</td><td className="px-2 py-2 align-top">{status(team.id)}</td></tr>)}</tbody></table></div>
      {caption && <p className="mt-4 text-sm text-ink-600">{caption}</p>}
    </section>
  );
}
