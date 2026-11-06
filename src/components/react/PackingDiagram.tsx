import { useId, useState } from 'react';
import { cx } from '@/components/react/cx';

/** Interior dimensions on a whole-centimetre scale. */
export interface PackingBox {
  length: number;
  width: number;
  height: number;
}

/** A declared rectangular module, with its origin at its lowest coordinate. */
export interface PackingItem extends PackingBox {
  label: string;
  x: number;
  y: number;
  z: number;
}

/** An unchanged rigid part's end-to-end length, for a necessary diagonal check. */
export interface PackingSpan {
  label: string;
  length: number;
}

export type PackingView = 'top' | 'front';

/** A diagram of supplied placements, not a search for a packing solution. */
export interface PackingDiagramProps {
  container: PackingBox;
  items?: PackingItem[];
  span?: PackingSpan;
  locale?: 'en' | 'es';
  title?: string;
  caption?: string;
  instructions?: string;
  viewLabel?: string;
  topLabel?: string;
  frontLabel?: string;
  plotLabel?: string;
  containerLabel?: string;
  diagonalLabel?: string;
  itemLabel?: string;
  dimensionsLabel?: string;
  positionLabel?: string;
  outlineLabel?: string;
  lengthLabel?: string;
  widthLabel?: string;
  heightLabel?: string;
  unitLabel?: string;
  placementReadout?: string;
  spanTooLongReadout?: string;
  spanWithinReadout?: string;
  className?: string;
}

const DIMENSIONS = ['length', 'width', 'height'] as const;
const COORDINATES = ['x', 'y', 'z'] as const;

/** Reject invalid declarations rather than letting a projection hide a collision. */
export function validatePackingDiagram(
  container: PackingBox,
  items: PackingItem[] = [],
  span?: PackingSpan,
): void {
  if (!container || DIMENSIONS.some((key) => !Number.isSafeInteger(container[key]) || container[key] <= 0)) {
    throw new Error('PackingDiagram: container dimensions must be finite positive whole centimetres.');
  }
  if (!Array.isArray(items)) throw new Error('PackingDiagram: items must be an array.');
  if (span && (!span.label?.trim() || !Number.isSafeInteger(span.length) || span.length <= 0)) {
    throw new Error('PackingDiagram: span needs a label and a finite positive whole-centimetre length.');
  }
  if (items.length === 0 && !span) {
    throw new Error('PackingDiagram: supply a declared placement or a span to check.');
  }
  for (const [index, item] of items.entries()) {
    if (!item || !item.label?.trim() || DIMENSIONS.some((key) => !Number.isSafeInteger(item[key]) || item[key] <= 0)) {
      throw new Error(`PackingDiagram: item ${index} needs a label and finite positive whole-centimetre dimensions.`);
    }
    if (COORDINATES.some((key) => !Number.isSafeInteger(item[key]) || item[key] < 0)) {
      throw new Error(`PackingDiagram: item ${index} coordinates must be finite nonnegative whole centimetres.`);
    }
    if (item.x + item.length > container.length || item.y + item.width > container.width || item.z + item.height > container.height) {
      throw new Error(`PackingDiagram: item ${index} is outside the container.`);
    }
  }
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const a = items[i]!;
      const b = items[j]!;
      const overlaps = a.x < b.x + b.length && b.x < a.x + a.length
        && a.y < b.y + b.width && b.y < a.y + a.width
        && a.z < b.z + b.height && b.z < a.z + a.height;
      if (overlaps) throw new Error(`PackingDiagram: items ${i} and ${j} overlap in three dimensions.`);
    }
  }
}

/** Project supplied coordinates; overlap in one view is not a three-dimensional collision. */
export function packingProjection(item: PackingItem, view: PackingView) {
  return {
    x: item.x,
    y: view === 'top' ? item.y : item.z,
    width: item.length,
    height: view === 'top' ? item.width : item.height,
  };
}

const ITEM_STYLES = [
  'fill-brand-200 stroke-brand-700',
  'fill-accent-300 stroke-accent-600',
  'fill-ink-200 stroke-ink-600',
  'fill-brand-400 stroke-brand-800',
];

export function PackingDiagram({
  container,
  items = [],
  span,
  locale = 'en',
  title,
  caption,
  instructions = 'Switch projections and compare the coordinates. Projected shapes can overlap even when the modules are separated in height or depth.',
  viewLabel = 'Projection',
  topLabel = 'Top view',
  frontLabel = 'Front view',
  plotLabel = 'Projection of the declared container and modules',
  containerLabel = 'Interior container dimensions',
  diagonalLabel = 'Projection of the space diagonal',
  itemLabel = 'Module',
  dimensionsLabel = 'Length × width × height',
  positionLabel = 'Origin (x, y, z)',
  outlineLabel = 'Dimensions and declared positions',
  lengthLabel = 'Length',
  widthLabel = 'Width',
  heightLabel = 'Height',
  unitLabel = 'cm',
  placementReadout = 'The declared modules are contained and do not overlap in three dimensions. This establishes a geometric placement under the given dimensions; mass and setup still need their own checks.',
  spanTooLongReadout = '{item}: {span}; maximum interior diagonal ≈ {diagonal}. This unchanged rigid part cannot fit in any orientation.',
  spanWithinReadout = '{item}: {span}; maximum interior diagonal ≈ {diagonal}. The length does not violate this necessary bound; a complete placement has not been established by that comparison.',
  className,
}: PackingDiagramProps) {
  validatePackingDiagram(container, items, span);
  const id = useId();
  const [view, setView] = useState<PackingView>('top');
  const numberLocale = locale === 'es' ? 'es-ES' : 'en-US';
  const format = (n: number) => n.toLocaleString(numberLocale, { maximumFractionDigits: 2 });
  const withUnit = (n: number) => `${format(n)} ${unitLabel}`;
  const dimensions = (box: PackingBox) => `${format(box.length)} × ${format(box.width)} × ${format(box.height)} ${unitLabel}`;
  const diagonal = Math.hypot(container.length, container.width, container.height);
  // Whole-centimetre inputs permit an exact comparison. A rounded square root
  // can otherwise admit a span just outside the bound at large valid dimensions.
  const exceedsDiagonal = span
    ? BigInt(span.length) ** 2n > DIMENSIONS.reduce((sum, key) => sum + BigInt(container[key]) ** 2n, 0n)
    : false;
  const spanMessage = span
    ? (exceedsDiagonal ? spanTooLongReadout : spanWithinReadout)
      .replaceAll('{item}', span.label)
      .replaceAll('{span}', withUnit(span.length))
      .replaceAll('{diagonal}', withUnit(diagonal))
    : undefined;

  // Both projections use the same physical scale. Vertical centring keeps a
  // shallow front elevation legible without stretching its proportions.
  const scale = Math.min(500 / container.length, 230 / Math.max(container.width, container.height));
  const projectedHeight = view === 'top' ? container.width : container.height;
  const left = (600 - container.length * scale) / 2;
  const bottom = (320 + projectedHeight * scale) / 2;
  const upper = bottom - projectedHeight * scale;
  const sx = (x: number) => left + x * scale;
  const sy = (y: number) => bottom - y * scale;
  const viewName = view === 'top' ? topLabel : frontLabel;

  return (
    <figure className={cx('not-prose my-8', className)} aria-labelledby={title ? `${id}-title` : undefined}>
      {title ? <figcaption id={`${id}-title`} className="font-display text-lg font-semibold text-ink-900">{title}</figcaption> : null}
      <p className="mt-2 text-sm leading-relaxed text-ink-700">{instructions}</p>
      <div className="mt-4">
        <label htmlFor={`${id}-view`} className="block text-sm font-semibold text-ink-700">{viewLabel}</label>
        <select
          id={`${id}-view`}
          value={view}
          onChange={(event) => setView(event.currentTarget.value as PackingView)}
          className="mt-2 min-h-11 w-full rounded-card border border-ink-300 bg-surface px-3 py-2 text-sm text-ink-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700 sm:w-auto"
        >
          <option value="top">{topLabel}</option>
          <option value="front">{frontLabel}</option>
        </select>
      </div>
      <svg viewBox="0 0 600 320" className="mt-4 block w-full" role="img" aria-label={`${plotLabel}: ${viewName}`}>
        <rect x={left} y={upper} width={container.length * scale} height={projectedHeight * scale} className="fill-surface-sunken stroke-ink-500" strokeWidth={1.5} />
        {items.map((item, index) => {
          const p = packingProjection(item, view);
          return <rect key={`${item.label}-${index}`} x={sx(p.x)} y={sy(p.y + p.height)} width={p.width * scale} height={p.height * scale} className={ITEM_STYLES[index % ITEM_STYLES.length]} fillOpacity={0.6} strokeWidth={2}><title>{item.label}</title></rect>;
        })}
        {span ? <line x1={left} y1={bottom} x2={sx(container.length)} y2={upper} className="stroke-brand-600" strokeDasharray="7 5" strokeWidth={2}><title>{diagonalLabel}</title></line> : null}
        <text x={300} y={bottom + 24} textAnchor="middle" className="fill-ink-700" fontSize={22}>{lengthLabel}: {withUnit(container.length)}</text>
        <text x={left - 12} y={160} textAnchor="middle" transform={`rotate(-90 ${left - 12} 160)`} className="fill-ink-700" fontSize={22}>{view === 'top' ? widthLabel : heightLabel}: {withUnit(projectedHeight)}</text>
      </svg>
      {spanMessage ? <p className="mt-2 text-sm leading-relaxed text-ink-800">{spanMessage}</p> : null}
      {items.length ? <p className="mt-2 text-sm leading-relaxed text-ink-800">{placementReadout}</p> : null}
      <details className="mt-4" open>
        <summary className="min-h-6 cursor-pointer text-sm font-semibold text-ink-700 focus-visible:rounded-card focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-600">{outlineLabel}</summary>
        <p className="mt-3 text-sm text-ink-700">{containerLabel}: {dimensions(container)}</p>
        {items.length ? <div className="mt-3 max-w-full overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead><tr><th className="p-2 font-semibold">{itemLabel}</th><th className="p-2 font-semibold">{dimensionsLabel}</th><th className="p-2 font-semibold">{positionLabel}</th></tr></thead>
            <tbody>{items.map((item, index) => <tr key={`${item.label}-${index}`}>
              <th scope="row" className="p-2 font-medium"><svg aria-hidden="true" viewBox="0 0 12 12" className="mr-2 inline-block h-3 w-3 align-middle"><rect x={1} y={1} width={10} height={10} className={ITEM_STYLES[index % ITEM_STYLES.length]} /></svg>{item.label}</th>
              <td className="whitespace-nowrap p-2">{dimensions(item)}</td>
              <td className="whitespace-nowrap p-2">({format(item.x)}, {format(item.y)}, {format(item.z)}) {unitLabel}</td>
            </tr>)}</tbody>
          </table>
        </div> : null}
      </details>
      {caption ? <p className="mt-3 text-sm leading-relaxed text-ink-600">{caption}</p> : null}
    </figure>
  );
}

export default PackingDiagram;
