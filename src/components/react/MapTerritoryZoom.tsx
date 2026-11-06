import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { cx } from '@/components/react/cx';

/** A single zoom/detail step in a {@link MapTerritoryZoom}. */
export interface MapTerritoryStep {
  /** Short label for this level of detail (e.g. "Subway map"). */
  label: string;
  /**
   * How many points the simplified coastline keeps at this step. More points
   * can retain smaller features of the reference outline. The component samples the full coastline down
   * to this many vertices, so each step visibly drops detail.
   */
  detail: number;
  /** One-line note explaining what this level of simplification is good (or bad) for. */
  note: string;
}

/** Props for the {@link MapTerritoryZoom} component. */
export interface MapTerritoryZoomProps {
  /**
   * The detail steps, ordered from most simplified (fewest points) to most
   * faithful (most points). At least two are required. The slider walks them.
   */
  steps?: MapTerritoryStep[];
  /** Language for built-in steps, number formatting, and accessible text. */
  locale?: 'en' | 'es';
  /** Heading above the figure. */
  title?: string;
  /** Eyebrow label. Defaults to `'Map vs territory'`. */
  eyebrow?: string;
  /** Caption beneath the figure. */
  caption?: string;
  /** Label for the simplified ("map") layer in the legend. Defaults to `'The map'`. */
  mapLabel?: string;
  /** Label for the full-detail ("territory") layer in the legend. Defaults to `'The territory reference'`. */
  territoryLabel?: string;
  /** Prefix for the detail readout. Defaults to `'Points retained'`. */
  detailLabel?: string;
  /** Accessible label for the step slider. Defaults to `'Level of detail'`. */
  sliderLabel?: string;
  /** Extra classes merged onto the root element. */
  className?: string;
}

const DEFAULT_STEPS: Record<'en' | 'es', MapTerritoryStep[]> = {
  en: [
    { label: 'Coarse outline', detail: 5, note: 'The main shape is visible. Small bays disappear, so this outline cannot locate a landing spot.' },
    { label: 'Main bends', detail: 11, note: 'More bends appear. Compare the coloured line with the grey reference to find what is still missing.' },
    { label: 'Bays and headlands', detail: 24, note: 'Smaller features become visible. Whether they are enough depends on the journey you need to plan.' },
    { label: 'Fine shoreline', detail: 60, note: 'The outline follows more of the reference, while details between the sampled points can still be lost.' },
    { label: 'Reference outline', detail: 240, note: 'Both drawings now match at this scale. The reference is still a drawing: it leaves out tides, rocks and changes over time.' },
  ],
  es: [
    { label: 'Contorno básico', detail: 5, note: 'Se reconoce la forma general. Las calas pequeñas desaparecen, así que este contorno no permite elegir dónde desembarcar.' },
    { label: 'Curvas principales', detail: 11, note: 'Aparecen más curvas. Compara la línea de color con la referencia gris para encontrar lo que aún falta.' },
    { label: 'Calas y cabos', detail: 24, note: 'Se distinguen accidentes más pequeños. Que basten depende de la ruta que necesites planificar.' },
    { label: 'Orilla detallada', detail: 60, note: 'El contorno sigue mejor la referencia, aunque aún puede perder detalles entre los puntos de la muestra.' },
    { label: 'Contorno de referencia', detail: 240, note: 'Los dos dibujos coinciden a esta escala. La referencia sigue siendo un dibujo: omite mareas, rocas y cambios con el tiempo.' },
  ],
};

/**
 * A smooth, wiggly reference "coastline" sampled across the full width. We
 * generate it once from a sum of sines so it has detail at several scales (big
 * bays + small inlets), then each step keeps only `detail` evenly-spaced
 * samples of it — visibly dropping detail as you simplify. Deterministic, so SSR
 * and client markup match (no hydration mismatch).
 */
function coastlineY(t: number): number {
  // t in [0,1] → a y offset around a baseline. Several frequencies = multi-scale
  // detail, exactly the thing a coarse map throws away first.
  return (
    18 * Math.sin(t * Math.PI * 2 * 1.0 + 0.6) +
    9 * Math.sin(t * Math.PI * 2 * 2.7 + 1.3) +
    5 * Math.sin(t * Math.PI * 2 * 6.1 + 0.2) +
    2.5 * Math.sin(t * Math.PI * 2 * 13.0 + 2.1)
  );
}

const W = 480;
const H = 200;
const BASELINE = 96; // y of the mean coast line
const LEFT = 12;
const RIGHT = W - 12;

/** A fixed number of vertices lets the outline morph without changing its topology. */
function sampleOutline(detail: number, samples: number): number[] {
  return Array.from({ length: samples }, (_, i) => {
    const t = i / (samples - 1);
    const position = t * (detail - 1);
    const left = Math.floor(position);
    const right = Math.min(detail - 1, left + 1);
    const fraction = position - left;
    return BASELINE + coastlineY(left / (detail - 1)) * (1 - fraction) + coastlineY(right / (detail - 1)) * fraction;
  });
}

function buildPath(outline: number[]): string {
  const top = outline.map((y, i) => `${(LEFT + i / (outline.length - 1) * (RIGHT - LEFT)).toFixed(2)},${y.toFixed(2)}`).join(' L ');
  return `M ${LEFT},${H - 8} L ${top} L ${RIGHT},${H - 8} Z`;
}

/**
 * Scrub a simplified coastline against a stable reference. A short, interruptible
 * morph makes the loss of bays visible. The selected step and its explanation
 * remain available immediately; reduced motion snaps directly to the same result.
 */
export function MapTerritoryZoom({
  steps: authoredSteps,
  locale = 'en',
  title,
  eyebrow,
  caption,
  mapLabel,
  territoryLabel,
  detailLabel,
  sliderLabel,
  className,
}: MapTerritoryZoomProps) {
  const spanish = locale === 'es';
  const steps = authoredSteps ?? DEFAULT_STEPS[locale];
  eyebrow ??= spanish ? 'Mapa frente a territorio' : 'Map vs territory';
  mapLabel ??= spanish ? 'El mapa' : 'The map';
  territoryLabel ??= spanish ? 'La referencia del territorio' : 'The territory reference';
  detailLabel ??= spanish ? 'Puntos conservados' : 'Points retained';
  sliderLabel ??= spanish ? 'Nivel de detalle' : 'Level of detail';
  // Fail the build on a mis-authored figure rather than shipping a broken slider.
  // Runs during SSR/prerender → red build.
  if (!Array.isArray(steps) || steps.length < 2) {
    throw new Error('MapTerritoryZoom: needs at least two `steps`.');
  }
  const badIndex = steps.findIndex((s) => !s?.label?.trim() || !s?.note?.trim() || !Number.isSafeInteger(s.detail) || s.detail < 2);
  if (badIndex !== -1) {
    throw new Error(`MapTerritoryZoom: every step needs a non-empty \`label\`, a \`note\`, and a finite integer \`detail\` of at least 2. Invalid step: ${badIndex}.`);
  }

  const reactId = useId();
  const sliderId = `${reactId}-detail`;
  const [index, setIndex] = useState(0);
  const step = steps[index];

  const territoryDetail = useMemo(() => Math.max(...steps.map((s) => s.detail)), [steps]);
  const samples = Math.max(240, territoryDetail);
  const territoryPath = useMemo(() => buildPath(sampleOutline(territoryDetail, samples)), [territoryDetail, samples]);
  const targetOutline = useMemo(() => sampleOutline(step.detail, samples), [step.detail, samples]);
  const displayedOutline = useRef(targetOutline);
  const initialPath = useRef(buildPath(targetOutline));
  const mapPathRef = useRef<SVGPathElement>(null);

  useEffect(() => {
    const element = mapPathRef.current;
    if (!element) return;
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    let frame = 0;
    const finish = () => {
      cancelAnimationFrame(frame);
      displayedOutline.current = targetOutline;
      element.setAttribute('d', buildPath(targetOutline));
    };
    const onPreferenceChange = () => { if (preference.matches) finish(); };
    if (preference.matches || displayedOutline.current.length !== targetOutline.length) {
      finish();
      return;
    }
    const from = displayedOutline.current;
    if (from.every((value, i) => value === targetOutline[i])) return;
    const started = performance.now();
    const tick = (now: number) => {
      const progress = Math.min(1, (now - started) / 280);
      const eased = 1 - (1 - progress) ** 3;
      const next = targetOutline.map((y, i) => from[i] + (y - from[i]) * eased);
      displayedOutline.current = next;
      element.setAttribute('d', buildPath(next));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    preference.addEventListener('change', onPreferenceChange);
    return () => {
      cancelAnimationFrame(frame);
      preference.removeEventListener('change', onPreferenceChange);
    };
  }, [targetOutline]);

  const pointsText = step.detail.toLocaleString(spanish ? 'es-ES' : 'en-US');

  return (
    <figure
      className={cx(
        'brutal my-6 bg-surface p-5 sm:p-6',
        className,
      )}
    >
      <p className="font-display text-xs font-semibold uppercase tracking-wide text-brand-600">
        {eyebrow}
      </p>
      {title ? (
        <p className="mt-1 font-display text-lg font-semibold text-ink-900">{title}</p>
      ) : null}

      <div className="mt-4 overflow-hidden rounded-card bg-surface-sunken">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="h-auto w-full"
          role="img"
          aria-label={`${step.label}. ${detailLabel}: ${pointsText}. ${step.note}`}
        >
          {/* Stable reference: still a drawing, rather than the territory itself. */}
          <path
            d={territoryPath}
            fill="var(--color-ink-200)"
            stroke="var(--color-ink-500)"
            strokeWidth="1.5"
            strokeDasharray="3 3"
          />
          {/* Map: the bold simplified coastline the learner controls. */}
          <path
            ref={mapPathRef}
            d={initialPath.current}
            fill="color-mix(in oklab, var(--color-brand-400) 32%, transparent)"
            stroke="var(--color-brand-600)"
            strokeWidth="2.5"
            strokeLinejoin="round"
          />
          {/* Vertex dots on the map so dropped detail is unmistakable. */}
          {Array.from({ length: step.detail }).map((_, i) => {
            const t = i / (step.detail - 1);
            const x = LEFT + t * (RIGHT - LEFT);
            const y = BASELINE + coastlineY(t);
            return (
              <circle
                key={i}
                cx={x}
                cy={y}
                r={step.detail > 60 ? 1 : 2.6}
                fill="var(--color-brand-700)"
              />
            );
          })}
        </svg>
      </div>

      {/* Legend */}
      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs font-medium text-ink-600">
        <span className="inline-flex items-center gap-1.5">
          <span
            aria-hidden
            className="inline-block h-2.5 w-4 rounded-pill border-2 border-brand-600 bg-brand-400/30"
          />
          {mapLabel}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span
            aria-hidden
            className="inline-block h-2.5 w-4 rounded-pill border border-ink-300 bg-ink-200"
          />
          {territoryLabel}
        </span>
      </div>

      {/* Control */}
      <div className="mt-4">
        <div className="mb-1.5 flex items-baseline justify-between gap-3">
          <label htmlFor={sliderId} className="text-sm font-semibold text-ink-800">
            {sliderLabel}
          </label>
          <span className="font-display text-sm font-semibold text-brand-700">
            {step.label}
          </span>
        </div>
        <input
          id={sliderId}
          type="range"
          min={0}
          max={steps.length - 1}
          step={1}
          value={index}
          onChange={(e) => setIndex(Number(e.target.value))}
          aria-valuetext={step.label}
          aria-describedby={`${reactId}-readout`}
          className="h-6 w-full cursor-pointer accent-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-600"
        />
        <div className="mt-1 flex justify-between text-[0.65rem] font-medium uppercase tracking-wide text-ink-400">
          <span>{steps[0].label}</span>
          <span>{steps[steps.length - 1].label}</span>
        </div>
      </div>

      {/* Live readout */}
      <p
        id={`${reactId}-readout`}
        aria-live="polite"
        aria-atomic="true"
        className="mt-3 rounded-card bg-brand-50/70 p-3 text-sm leading-relaxed text-ink-700"
      >
        <span className="font-semibold text-brand-700">
          {detailLabel}: {pointsText}.
        </span>{' '}
        {step.note}
      </p>

      {caption ? (
        <figcaption className="mt-3 text-sm text-ink-500">{caption}</figcaption>
      ) : null}
    </figure>
  );
}

export default MapTerritoryZoom;
