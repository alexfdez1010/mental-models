import { useId, useMemo, useRef, useState } from 'react';
import { cx } from '@/components/react/cx';

/**
 * One of the four regions of the bomber. Locale-agnostic keys; the label shown
 * to the reader comes from {@link SurvivorshipPlaneProps} label props.
 */
export type PlaneRegionKey = 'engines' | 'cockpit' | 'fuselage' | 'wings';

/** Props for the {@link SurvivorshipPlane} island. */
export interface SurvivorshipPlaneProps {
  /** Fleet size flown per mission. Bigger = smoother numbers. Defaults to 400. */
  fleetSize?: number;
  /** Heading above the card. */
  title?: string;
  /** Eyebrow label. Defaults to `"Abraham Wald's bombers"`. */
  eyebrow?: string;
  /** Instruction line under the title. */
  instructions?: string;
  /** Caption beneath the card. */
  caption?: string;
  /** Text on the run-a-mission button. */
  flyLabel?: string;
  /** Text on the reset button. Defaults to `'Reset'`. */
  resetLabel?: string;
  /** Toggle label for the survivors view. Defaults to `'Planes that came back'`. */
  survivorsLabel?: string;
  /** Toggle label for the losses view. Defaults to `'Planes that never returned'`. */
  lossesLabel?: string;
  /** Small caption under the diagram in the survivors view. */
  survivorsNote?: string;
  /** Small caption under the diagram in the losses view. */
  lossesNote?: string;
  /** Prompt above the armour buttons. Defaults to `'Bolt the armour onto:'`. */
  armorPrompt?: string;
  /** Label for the "no armour yet" baseline chip. Defaults to `'Nowhere'`. */
  noArmorLabel?: string;
  /** Region display names. */
  enginesLabel?: string;
  cockpitLabel?: string;
  fuselageLabel?: string;
  wingsLabel?: string;
  /** Legend text for the red hit dots in the survivors view. Defaults to `'Bullet holes'`. */
  holesLegend?: string;
  /** Legend text for the red dots in the losses view. Defaults to `'Fatal hits'`. */
  fatalLegend?: string;
  /**
   * Live readout template. Tokens replaced: `{sent}`, `{returned}`, `{lost}`,
   * `{rate}` (survival % with the current armour), `{armor}` (the armoured region
   * name or the no-armour label), `{base}` (survival % with no armour).
   */
  readoutTemplate?: string;
  /** Verdict shown when the chosen armour is a *lethal* region (the right call). */
  verdictLethal?: string;
  /** Verdict shown when the chosen armour is a *bullet-riddled survivor* region (the trap). */
  verdictHoles?: string;
  /** Verdict shown before any armour is chosen. */
  verdictNone?: string;
  /** Extra classes merged onto the root element. */
  className?: string;
}

/** A deterministic PRNG (mulberry32) so SSR and the first client render agree. */
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

const REGIONS: {
  key: PlaneRegionKey;
  /** Share of flak hits that land here (the four sum to 1). */
  hitRate: number;
  /** Chance a hit here downs the plane. Engines/cockpit are deadly. */
  lethality: number;
  /** Rectangles (viewBox units) used to scatter hole dots + draw armour. */
  rects: { x: number; y: number; w: number; h: number }[];
}[] = [
  {
    key: 'engines',
    hitRate: 0.18,
    lethality: 0.82,
    rects: [
      { x: 40, y: 100, w: 26, h: 18 },
      { x: 134, y: 100, w: 26, h: 18 },
    ],
  },
  { key: 'cockpit', hitRate: 0.1, lethality: 0.78, rects: [{ x: 86, y: 18, w: 28, h: 30 }] },
  { key: 'fuselage', hitRate: 0.4, lethality: 0.06, rects: [{ x: 88, y: 52, w: 24, h: 118 }] },
  {
    key: 'wings',
    hitRate: 0.32,
    lethality: 0.04,
    rects: [
      { x: 10, y: 98, w: 68, h: 20 },
      { x: 122, y: 98, w: 68, h: 20 },
      { x: 66, y: 176, w: 68, h: 14 },
    ],
  },
];

const ARMOR_KEYS: PlaneRegionKey[] = ['engines', 'cockpit', 'fuselage', 'wings'];
const LETHAL = new Set<PlaneRegionKey>(['engines', 'cockpit']);
const SEED = 0x50f7a1;

type Counts = Record<PlaneRegionKey, number>;
const zero = (): Counts => ({ engines: 0, cockpit: 0, fuselage: 0, wings: 0 });

interface Dot {
  x: number;
  y: number;
}

interface Mission {
  sent: number;
  survivorHoles: Counts;
  deaths: Counts;
  survivorDots: Dot[];
  deathDots: Dot[];
  /** Survival rate (0..1) under each armour choice, plus the no-armour baseline. */
  rate: Record<PlaneRegionKey | 'none', number>;
}

/** Pick a hit region from the categorical hitRate distribution. */
function pickRegion(rng: () => number) {
  let r = rng();
  for (const region of REGIONS) {
    r -= region.hitRate;
    if (r <= 0) return region;
  }
  return REGIONS[REGIONS.length - 1];
}

/**
 * Fly one fleet and, for the no-armour scenario, record where the *returning*
 * planes were holed and where the *lost* planes were killed. Also compute the
 * survival rate you'd get by armouring each region. One shared RNG stream keeps
 * every armour choice facing the same flak, so the comparison is fair.
 */
function flyFleet(n: number, seed: number): Mission {
  const survivorHoles = zero();
  const deaths = zero();
  const survivorHoleList: { key: PlaneRegionKey }[] = [];
  const deathList: { key: PlaneRegionKey }[] = [];
  const survived: Record<PlaneRegionKey | 'none', number> = {
    none: 0,
    engines: 0,
    cockpit: 0,
    fuselage: 0,
    wings: 0,
  };
  const armorChoices: (PlaneRegionKey | 'none')[] = ['none', ...ARMOR_KEYS];
  const rng = mulberry32(seed);

  for (let p = 0; p < n; p += 1) {
    const nShots = 4 + Math.floor(rng() * 9); // 4..12 flak hits
    // Draw this plane's shots once (region + a lethality roll), then replay them
    // under every armour choice so all scenarios meet identical fire.
    const shots: { key: PlaneRegionKey; roll: number }[] = [];
    for (let s = 0; s < nShots; s += 1) {
      const region = pickRegion(rng);
      shots.push({ key: region.key, roll: rng() });
    }

    for (const armor of armorChoices) {
      let dead = false;
      let killedBy: PlaneRegionKey | null = null;
      for (const shot of shots) {
        const region = REGIONS.find((r) => r.key === shot.key)!;
        const lethality = region.lethality * (armor === shot.key ? 0.2 : 1);
        if (shot.roll < lethality) {
          dead = true;
          if (!killedBy) killedBy = shot.key;
        }
      }
      if (!dead) survived[armor] += 1;

      // The hole/death maps illustrate the *no-armour* reality the general saw.
      if (armor === 'none') {
        if (dead && killedBy) {
          deaths[killedBy] += 1;
          deathList.push({ key: killedBy });
        } else if (!dead) {
          for (const shot of shots) {
            survivorHoles[shot.key] += 1;
            survivorHoleList.push({ key: shot.key });
          }
        }
      }
    }
  }

  const dotRng = mulberry32(seed ^ 0x9e37);
  const scatter = (list: { key: PlaneRegionKey }[], cap: number): Dot[] => {
    const chosen = list.length > cap ? sample(list, cap, dotRng) : list;
    return chosen.map(({ key }) => {
      const rects = REGIONS.find((r) => r.key === key)!.rects;
      const rect = rects[Math.floor(dotRng() * rects.length)];
      return {
        x: rect.x + 2 + dotRng() * (rect.w - 4),
        y: rect.y + 2 + dotRng() * (rect.h - 4),
      };
    });
  };

  return {
    sent: n,
    survivorHoles,
    deaths,
    survivorDots: scatter(survivorHoleList, 90),
    deathDots: scatter(deathList, 90),
    rate: {
      none: survived.none / n,
      engines: survived.engines / n,
      cockpit: survived.cockpit / n,
      fuselage: survived.fuselage / n,
      wings: survived.wings / n,
    },
  };
}

/** Reservoir-style down-sample so dense fleets don't drown the diagram. */
function sample<T>(list: T[], k: number, rng: () => number): T[] {
  const out = list.slice(0, k);
  for (let i = k; i < list.length; i += 1) {
    const j = Math.floor(rng() * (i + 1));
    if (j < k) out[j] = list[i];
  }
  return out;
}

const pct = (x: number) => Math.round(x * 100);

/**
 * **Survivorship bias, flown live — Abraham Wald's bombers.**
 *
 * In WWII the US military studied the bombers that came back from raids, mapped
 * the bullet holes, and proposed armouring the areas with the *most* holes. The
 * statistician Abraham Wald spotted the fatal flaw: the holes were on the planes
 * that *survived*. The places with no holes — the engines, the cockpit — were
 * exactly where a hit was fatal, which is why no plane came home showing damage
 * there. Armour the gaps, not the holes.
 *
 * This island flies a fleet through flak. Toggle between the planes that
 * **came back** (holes cluster on the wings and fuselage — the survivable spots)
 * and the planes that **never returned** (the fatal hits cluster on the engines
 * and cockpit — the silent gaps in the survivor map). Then choose where to bolt
 * the armour and watch the survival rate: plating the bullet-riddled fuselage
 * barely helps, while plating the hole-free engines saves the most planes.
 *
 * The SVG is decorative for assistive tech; the meaning lives in the `aria-live`
 * readout (sent / returned / lost / survival rate) and the survival-by-choice
 * bars. Fully keyboard-operable; dot transitions are neutralised under
 * `prefers-reduced-motion`.
 */
export function SurvivorshipPlane({
  fleetSize = 400,
  title,
  eyebrow = "Abraham Wald's bombers",
  instructions = 'Fly a fleet through enemy flak. First look at the planes that came back and note where the bullet holes are. Then look at the planes that never returned — and see where the fatal hits really landed. Finally, choose where to bolt the armour.',
  caption,
  flyLabel = 'Fly a mission ▸',
  resetLabel = 'Reset',
  survivorsLabel = 'Planes that came back',
  lossesLabel = 'Planes that never returned',
  survivorsNote = 'Every red dot is a bullet hole on a plane that made it home. Notice the engines and cockpit look almost untouched.',
  lossesNote = 'Now the planes you never saw. The fatal hits cluster exactly where the survivors had no holes — the engines and cockpit.',
  armorPrompt = 'Bolt the armour onto:',
  noArmorLabel = 'Nowhere',
  enginesLabel = 'Engines',
  cockpitLabel = 'Cockpit',
  fuselageLabel = 'Fuselage',
  wingsLabel = 'Wings & tail',
  holesLegend = 'Bullet holes on survivors',
  fatalLegend = 'Fatal hits on the lost',
  readoutTemplate = 'Of {sent} bombers sent, {returned} came home and {lost} were lost. Armour on the {armor}: {rate}% survive (no armour: {base}%).',
  verdictLethal = 'Wald would approve. You armoured a spot with almost no holes on the survivors — precisely because a hit there was fatal. That is the gap the bullet-hole map could never show you.',
  verdictHoles = "That is the trap. You armoured where the survivors were riddled — but those planes flew home anyway. The holes mark the survivable hits, not the deadly ones. Survival barely moves.",
  verdictNone = 'Pick a spot to armour. The bullet-hole map on the survivors is tempting — but ask which hits you never got to see.',
  className,
}: SurvivorshipPlaneProps) {
  if (!Number.isFinite(fleetSize) || fleetSize < 40) {
    throw new Error('SurvivorshipPlane: `fleetSize` must be at least 40.');
  }

  const reactId = useId();
  const runSeed = useRef(SEED);
  const initial = useMemo(() => flyFleet(fleetSize, SEED), [fleetSize]);
  const [mission, setMission] = useState<Mission>(initial);
  const [view, setView] = useState<'survivors' | 'losses'>('survivors');
  const [armor, setArmor] = useState<PlaneRegionKey | 'none'>('none');

  const labels: Record<PlaneRegionKey, string> = {
    engines: enginesLabel,
    cockpit: cockpitLabel,
    fuselage: fuselageLabel,
    wings: wingsLabel,
  };

  const fly = () => {
    runSeed.current = (runSeed.current * 1664525 + 1013904223) >>> 0;
    setMission(flyFleet(fleetSize, runSeed.current));
  };
  const reset = () => {
    runSeed.current = SEED;
    setMission(flyFleet(fleetSize, SEED));
    setView('survivors');
    setArmor('none');
  };

  const rate = mission.rate[armor];
  const base = mission.rate.none;
  const returned = Math.round(base * mission.sent);
  const lost = mission.sent - returned;
  const armorName = armor === 'none' ? noArmorLabel : labels[armor];
  const readout = readoutTemplate
    .replace('{sent}', String(mission.sent))
    .replace('{returned}', String(returned))
    .replace('{lost}', String(lost))
    .replace('{rate}', String(pct(rate)))
    .replace('{base}', String(pct(base)))
    .replace('{armor}', armorName);
  const verdict =
    armor === 'none' ? verdictNone : LETHAL.has(armor) ? verdictLethal : verdictHoles;

  const dots = view === 'survivors' ? mission.survivorDots : mission.deathDots;
  const armoredRects = armor === 'none' ? [] : REGIONS.find((r) => r.key === armor)!.rects;

  return (
    <figure className={cx('brutal my-6 bg-surface p-5 sm:p-6', className)}>
      <p className="font-display text-xs font-semibold uppercase tracking-wide text-accent-600">
        {eyebrow}
      </p>
      {title ? (
        <p className="mt-1 font-display text-lg font-semibold text-ink-900">{title}</p>
      ) : null}
      <p className="mt-2 text-sm font-medium text-ink-700">{instructions}</p>

      {/* View toggle */}
      <div
        className="mt-4 inline-flex rounded-pill bg-surface-sunken p-1 text-sm font-semibold"
        role="group"
        aria-label={survivorsLabel + ' / ' + lossesLabel}
      >
        {(
          [
            ['survivors', survivorsLabel],
            ['losses', lossesLabel],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setView(key)}
            aria-pressed={view === key}
            className={cx(
              'rounded-pill px-3 py-1.5 transition-colors motion-reduce:transition-none',
              view === key ? 'bg-surface text-ink-900 shadow-soft' : 'text-ink-500 hover:text-ink-800',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mt-4 grid gap-5 sm:grid-cols-[minmax(0,1fr)_16rem]">
        {/* The bomber, seen from above */}
        <div>
          <svg
            viewBox="0 0 200 200"
            className="w-full rounded-card bg-surface-sunken"
            role="img"
            aria-label={view === 'survivors' ? survivorsLabel : lossesLabel}
          >
            {/* Airframe silhouette (top-down bomber) */}
            <g style={{ fill: 'var(--color-ink-200)', stroke: 'var(--color-ink-300)' }} strokeWidth={1}>
              {/* wings */}
              <polygon points="8,118 78,100 122,100 192,118 192,124 122,116 78,116 8,124" />
              {/* tailplane */}
              <polygon points="60,190 92,178 108,178 140,190 140,194 108,186 92,186 60,194" />
              {/* fuselage */}
              <rect x="84" y="14" width="32" height="176" rx="16" />
            </g>
            {/* engine nacelles */}
            <g style={{ fill: 'var(--color-ink-300)' }}>
              <rect x="44" y="102" width="20" height="14" rx="4" />
              <rect x="136" y="102" width="20" height="14" rx="4" />
            </g>
            {/* cockpit canopy */}
            <ellipse cx="100" cy="34" rx="11" ry="15" style={{ fill: 'var(--color-ink-300)' }} />

            {/* Armour plating overlay on the chosen region */}
            {armoredRects.map((r, i) => (
              <rect
                key={`${reactId}-armor-${i}`}
                x={r.x}
                y={r.y}
                width={r.w}
                height={r.h}
                rx={4}
                style={{ fill: 'var(--color-success)', opacity: 0.22, stroke: 'var(--color-success)' }}
                strokeWidth={1.5}
              />
            ))}

            {/* Hit dots */}
            <g style={{ fill: 'var(--color-danger)' }}>
              {dots.map((d, i) => (
                <circle
                  key={`${reactId}-dot-${i}`}
                  cx={d.x}
                  cy={d.y}
                  r={1.9}
                  className="transition-opacity duration-500 motion-reduce:transition-none"
                  style={{ opacity: 0.85 }}
                />
              ))}
            </g>
          </svg>
          <p className="mt-2 text-xs font-medium text-ink-500">
            <span
              className="mr-1 inline-block size-2 rounded-full align-middle"
              style={{ backgroundColor: 'var(--color-danger)' }}
              aria-hidden
            />
            {view === 'survivors' ? holesLegend : fatalLegend}
          </p>
          <p className="mt-1 text-sm text-ink-600">
            {view === 'survivors' ? survivorsNote : lossesNote}
          </p>
        </div>

        {/* Armour choice + survival bars */}
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-ink-500">{armorPrompt}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {(['none', ...ARMOR_KEYS] as const).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setArmor(key)}
                aria-pressed={armor === key}
                className={cx(
                  'rounded-pill px-2.5 py-1 text-xs font-semibold ring-1 ring-inset transition-colors motion-reduce:transition-none',
                  armor === key
                    ? 'bg-ink-900 text-surface ring-ink-900'
                    : 'text-ink-600 ring-ink-300 hover:bg-surface-sunken',
                )}
              >
                {key === 'none' ? noArmorLabel : labels[key]}
              </button>
            ))}
          </div>

          {/* Survival-by-choice bars */}
          <div className="mt-4 space-y-2">
            {(['none', ...ARMOR_KEYS] as const).map((key) => {
              const value = mission.rate[key];
              const isLethal = key !== 'none' && LETHAL.has(key);
              return (
                <div key={key}>
                  <div className="flex justify-between text-[0.7rem] font-semibold text-ink-600">
                    <span>{key === 'none' ? noArmorLabel : labels[key]}</span>
                    <span>{pct(value)}%</span>
                  </div>
                  <div className="mt-0.5 h-2.5 w-full overflow-hidden rounded-pill bg-surface-sunken">
                    <div
                      className="h-full rounded-pill transition-[width] duration-500 ease-out motion-reduce:transition-none"
                      style={{
                        width: `${pct(value)}%`,
                        backgroundColor:
                          key === armor
                            ? isLethal
                              ? 'var(--color-success)'
                              : 'var(--color-danger)'
                            : 'var(--color-ink-400)',
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Live readout */}
      <p aria-live="polite" className="mt-4 font-display text-base font-semibold text-ink-900">
        {readout}
      </p>
      <p className="mt-1 text-sm text-ink-600">{verdict}</p>

      {/* Controls */}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={fly}
          className="brutal-btn bg-brand-600 px-4 py-2 font-display text-sm text-white"
        >
          {flyLabel}
        </button>
        <button
          type="button"
          onClick={reset}
          className="inline-flex items-center rounded-pill px-3 py-2 font-display text-sm font-semibold text-ink-600 ring-1 ring-inset ring-ink-300 transition-colors hover:bg-surface-sunken motion-reduce:transition-none"
        >
          {resetLabel}
        </button>
      </div>

      {caption ? <figcaption className="mt-3 text-sm text-ink-500">{caption}</figcaption> : null}
    </figure>
  );
}

export default SurvivorshipPlane;
