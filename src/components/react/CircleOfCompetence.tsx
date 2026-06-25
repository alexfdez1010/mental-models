import { useId, useMemo, useState } from 'react';
import { cx } from '@/components/react/cx';

/** One decision the learner could face inside a {@link CircleDomain}. */
export interface CircleDecision {
  /** What the decision is ("Buy shares in a chip startup"). */
  label: string;
  /**
   * How far the decision sits from dead-centre of the domain, on a 0..1 scale:
   * `0` is trivially within anyone's reach, `1` is far beyond a deep expert.
   * The island compares this to the learner's honest competence radius to place
   * the decision *inside*, in the *danger band* at the edge, or safely *outside*.
   */
  difficulty: number;
  /** One-line gloss ("You can read the 10-K and value it"). */
  detail?: string;
}

/** A field the learner sizes their own circle of competence within. */
export interface CircleDomain {
  /** The domain's name ("Investing", "Hiring", "Medicine"). */
  name: string;
  /** Starting radius of the honest circle, 0..1. Defaults to `0.45`. */
  defaultRadius?: number;
  /** The decisions plotted against the circle. At least one. */
  decisions: CircleDecision[];
}

/** Props for the {@link CircleOfCompetence} island. */
export interface CircleOfCompetenceProps {
  /** The domains to work through. Renders a tab per domain. */
  domains: CircleDomain[];
  /** Heading above the card. */
  title?: string;
  /** Eyebrow label. Defaults to `'Know your edge'`. */
  eyebrow?: string;
  /** Instruction line. */
  instructions?: string;
  /** Caption beneath the card. */
  caption?: string;
  /** Label on the competence slider. Defaults to `'How wide is your honest circle here?'`. */
  sliderLabel?: string;
  /** Small text at the narrow end of the slider. Defaults to `'Narrow'`. */
  narrowLabel?: string;
  /** Small text at the wide end of the slider. Defaults to `'Wide'`. */
  wideLabel?: string;
  /** Zone heading for decisions inside the circle. Defaults to `'Inside — act'`. */
  insideLabel?: string;
  /** Zone heading for decisions in the edge band. Defaults to `'The danger band — confidence outruns skill'`. */
  edgeLabel?: string;
  /** Zone heading for decisions clearly outside. Defaults to `'Outside — pass cleanly'`. */
  outsideLabel?: string;
  /** Live-count template; `{in}`/`{edge}`/`{out}` are replaced. */
  countLabel?: string;
  /** Verdict shown beneath the counts. `{edge}` is replaced with the edge count. */
  verdict?: string;
  /** Extra classes merged onto the root element. */
  className?: string;
}

type Zone = 'inside' | 'edge' | 'outside';

/** Width of the danger band, as a fraction of the 0..1 radius scale. */
const BAND = 0.16;
/** Geometry of the SVG diagram. */
const VIEW = 280;
const C = VIEW / 2;
const MAX_R = 118;

/** Classify a decision relative to the honest radius. */
function zoneOf(difficulty: number, radius: number): Zone {
  if (difficulty <= radius) return 'inside';
  if (difficulty <= radius + BAND) return 'edge';
  return 'outside';
}

const ZONE_DOT: Record<Zone, string> = {
  inside: 'var(--color-success)',
  edge: 'var(--color-warning)',
  outside: 'var(--color-ink-300)',
};

/**
 * Interactive **circle of competence** — "the size of the circle matters less
 * than knowing where its boundary is."
 *
 * The learner drags a slider to claim how wide their honest circle is in a
 * domain. A filled disc grows to that radius; a glowing band sits just outside
 * it. Each real decision is plotted by difficulty, then sorted into one of three
 * zones: safely *inside* (act), the *danger band* at the very edge where things
 * still feel familiar but your maps have quietly stopped being reliable, or
 * clearly *outside* (easy to pass). The point the island makes by construction:
 * claiming a wider circle doesn't make you more capable — it just drags more
 * decisions into the blind-spot band where overconfidence does its damage. The
 * far-outside decisions were never the threat; the ones at your edge are.
 *
 * The diagram is decorative (`aria-hidden`); the same information is announced
 * as text via an `aria-live` region and listed per zone, so it is fully usable
 * without sight of the SVG. The boundary glow only pulses under
 * `motion-safe`; reduced-motion users get a static ring. Keyboard-operable.
 */
export function CircleOfCompetence({
  domains,
  title,
  eyebrow = 'Know your edge',
  instructions = 'Be honest about how much of this field your maps actually cover. Then watch where each decision lands — and notice that overclaiming just feeds the danger band.',
  caption,
  sliderLabel = 'How wide is your honest circle here?',
  narrowLabel = 'Narrow',
  wideLabel = 'Wide',
  insideLabel = 'Inside — act',
  edgeLabel = 'The danger band — confidence outruns skill',
  outsideLabel = 'Outside — pass cleanly',
  countLabel = '{in} inside · {edge} in the danger band · {out} safely outside',
  verdict = 'The decisions clear of your circle are easy to pass — you know you don’t know them. The real risk is the {edge} sitting in the band at your edge: they still feel familiar, so confidence outruns skill. Drag the circle wider and more decisions fall into that blind spot, not fewer.',
  className,
}: CircleOfCompetenceProps) {
  if (!Array.isArray(domains) || domains.length === 0) {
    throw new Error('CircleOfCompetence: needs at least one domain.');
  }
  const bad = domains.find((d) => !d?.name?.trim() || (d?.decisions?.length ?? 0) < 1);
  if (bad) {
    throw new Error(
      `CircleOfCompetence: every domain needs a name and at least one decision. ` +
        `Offending domain: "${bad?.name ?? '(missing name)'}".`,
    );
  }

  const reactId = useId();
  const [tab, setTab] = useState(0);
  // One radius slot per domain so switching tabs keeps each setting.
  const [radii, setRadii] = useState<number[]>(() =>
    domains.map((d) => (typeof d.defaultRadius === 'number' ? d.defaultRadius : 0.45)),
  );

  const domain = domains[tab];
  const radius = radii[tab];

  const plotted = useMemo(() => {
    const n = domain.decisions.length;
    return domain.decisions.map((dec, i) => {
      // Spread the dots around the circle so none overlap; tilt so the first
      // sits up-and-right rather than due east.
      const angle = (i / n) * Math.PI * 2 - Math.PI / 2.4;
      const rPx = dec.difficulty * MAX_R;
      return {
        dec,
        zone: zoneOf(dec.difficulty, radius),
        x: C + Math.cos(angle) * rPx,
        y: C + Math.sin(angle) * rPx,
      };
    });
  }, [domain, radius]);

  const counts = useMemo(() => {
    const c = { inside: 0, edge: 0, outside: 0 };
    for (const p of plotted) c[p.zone] += 1;
    return c;
  }, [plotted]);

  const rPx = radius * MAX_R;
  const bandPx = Math.min(radius + BAND, 1) * MAX_R;

  const setRadius = (v: number) =>
    setRadii((prev) => prev.map((r, j) => (j === tab ? v : r)));

  const countText = countLabel
    .replace('{in}', String(counts.inside))
    .replace('{edge}', String(counts.edge))
    .replace('{out}', String(counts.outside));
  const verdictText = verdict.replace('{edge}', String(counts.edge));

  const zoneMeta: Array<{ zone: Zone; label: string; tint: string }> = [
    { zone: 'inside', label: insideLabel, tint: 'border-success bg-success/10' },
    { zone: 'edge', label: edgeLabel, tint: 'border-warning bg-warning/10' },
    { zone: 'outside', label: outsideLabel, tint: 'border-ink-200 bg-surface-sunken' },
  ];

  return (
    <figure className={cx('brutal my-6 bg-surface p-5 sm:p-6', className)}>
      <p className="font-display text-xs font-semibold uppercase tracking-wide text-brand-600">
        {eyebrow}
      </p>
      {title ? (
        <p className="mt-1 font-display text-lg font-semibold text-ink-900">{title}</p>
      ) : null}

      <p className="mt-3 text-sm font-medium text-ink-700">{instructions}</p>

      {/* Domain tabs. */}
      {domains.length > 1 ? (
        <div role="tablist" aria-label="Domain" className="mt-4 flex flex-wrap gap-2">
          {domains.map((d, i) => (
            <button
              key={`${reactId}-tab-${i}`}
              type="button"
              role="tab"
              aria-selected={tab === i}
              onClick={() => setTab(i)}
              className={cx(
                'brutal-chip px-3 py-1 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600',
                tab === i ? 'bg-brand-600 text-white' : 'bg-surface text-ink-700',
              )}
            >
              {d.name}
            </button>
          ))}
        </div>
      ) : null}

      <div className="mt-4 grid gap-5 sm:grid-cols-[minmax(0,260px)_1fr] sm:items-start">
        {/* The diagram — decorative; the lists below carry the same meaning. */}
        <svg
          viewBox={`0 0 ${VIEW} ${VIEW}`}
          className="mx-auto w-full max-w-[260px]"
          role="img"
          aria-hidden="true"
        >
          {/* The unknown beyond. */}
          <circle cx={C} cy={C} r={MAX_R} fill="var(--color-surface-sunken)" />
          {/* Danger band — the glow just outside the honest edge. */}
          <circle
            cx={C}
            cy={C}
            r={bandPx}
            fill="color-mix(in oklab, var(--color-warning) 16%, transparent)"
            className="motion-safe:animate-pulse"
          />
          {/* The honest circle of competence. */}
          <circle
            cx={C}
            cy={C}
            r={rPx}
            fill="color-mix(in oklab, var(--color-success) 16%, transparent)"
          />
          <circle
            cx={C}
            cy={C}
            r={rPx}
            fill="none"
            stroke="var(--color-success)"
            strokeWidth={2.5}
          />
          {/* Edge ring marking where the band starts. */}
          <circle
            cx={C}
            cy={C}
            r={bandPx}
            fill="none"
            stroke="var(--color-warning)"
            strokeWidth={1.5}
            strokeDasharray="4 4"
          />
          {/* Decisions. */}
          {plotted.map((p, i) => (
            <g key={`${reactId}-dot-${i}`}>
              <circle
                cx={p.x}
                cy={p.y}
                r={7}
                fill={ZONE_DOT[p.zone]}
                stroke="var(--color-surface)"
                strokeWidth={2}
              />
              <text
                x={p.x}
                y={p.y + 3.5}
                textAnchor="middle"
                fill="var(--color-surface)"
                className="font-mono text-[9px] font-bold"
              >
                {i + 1}
              </text>
            </g>
          ))}
        </svg>

        <div>
          {/* The competence slider. */}
          <label className="block">
            <span className="text-sm font-semibold text-ink-800">{sliderLabel}</span>
            <input
              type="range"
              min={0.1}
              max={0.92}
              step={0.01}
              value={radius}
              onChange={(e) => setRadius(Number(e.target.value))}
              className="mt-2 w-full accent-brand-600"
              aria-label={`${sliderLabel} (${domain.name})`}
            />
            <span className="mt-1 flex justify-between text-[0.65rem] font-semibold uppercase tracking-wide text-ink-400">
              <span>{narrowLabel}</span>
              <span>{wideLabel}</span>
            </span>
          </label>

          {/* Live counts + verdict. */}
          <div aria-live="polite" className="mt-3">
            <p className="font-display text-sm font-semibold text-ink-900">{countText}</p>
            <p className="mt-2 rounded-card border-l-4 border-warning bg-warning/10 p-3 text-sm font-medium text-ink-800">
              {verdictText}
            </p>
          </div>
        </div>
      </div>

      {/* Per-zone decision lists — the accessible source of truth. */}
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {zoneMeta.map(({ zone, label, tint }) => {
          const items = plotted
            .map((p, i) => ({ ...p, n: i + 1 }))
            .filter((p) => p.zone === zone);
          return (
            <div key={`${reactId}-zone-${zone}`} className={cx('rounded-card border-2 p-3', tint)}>
              <p className="text-[0.7rem] font-bold uppercase leading-tight tracking-wide text-ink-700">
                {label}
              </p>
              <ul className="mt-2 space-y-1.5">
                {items.length === 0 ? (
                  <li className="text-sm text-ink-400">—</li>
                ) : (
                  items.map((p) => (
                    <li key={`${reactId}-${zone}-${p.n}`} className="text-sm text-ink-700">
                      <span className="font-mono text-xs font-semibold text-ink-500">{p.n}.</span>{' '}
                      {p.dec.label}
                      {p.dec.detail ? (
                        <span className="block text-xs leading-snug text-ink-500">{p.dec.detail}</span>
                      ) : null}
                    </li>
                  ))
                )}
              </ul>
            </div>
          );
        })}
      </div>

      {caption ? (
        <figcaption className="mt-3 text-sm text-ink-500">{caption}</figcaption>
      ) : null}
    </figure>
  );
}

export default CircleOfCompetence;
