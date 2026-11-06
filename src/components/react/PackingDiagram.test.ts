import { describe, expect, test } from 'bun:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { PackingDiagram, packingProjection, validatePackingDiagram } from '@/components/react/PackingDiagram';
import type { PackingBox, PackingItem } from '@/components/react/PackingDiagram';

const box: PackingBox = { length: 63, width: 28, height: 10 };
const placement: PackingItem[] = [
  { label: 'Rail', x: 0, y: 0, z: 0, length: 60, width: 2, height: 2 },
  { label: 'Panels', x: 0, y: 3, z: 0, length: 25, width: 20, height: 6 },
  { label: 'Token box', x: 27, y: 3, z: 0, length: 10, width: 8, height: 5 },
  { label: 'Instructions', x: 0, y: 3, z: 6, length: 25, width: 18, height: 1 },
];

describe('PackingDiagram declarations', () => {
  test('accepts the constructive placement, including touching stacked faces', () => {
    expect(() => validatePackingDiagram(box, placement)).not.toThrow();
  });

  test('rejects overlap in all three dimensions even when the dimensions fit the box', () => {
    const collision = { ...placement[3]!, z: 5 };
    expect(() => validatePackingDiagram(box, [placement[1]!, collision])).toThrow('overlap in three dimensions');
  });

  test('rejects an out-of-bounds placement', () => {
    expect(() => validatePackingDiagram(box, [{ ...placement[0]!, x: 4 }])).toThrow('outside the container');
  });

  test('accepts projected overlap when the actual modules occupy separate heights', () => {
    expect(packingProjection(placement[1]!, 'top').x).toBe(packingProjection(placement[3]!, 'top').x);
    expect(() => validatePackingDiagram(box, [placement[1]!, placement[3]!])).not.toThrow();
  });

  test('keeps plan depth and front height distinct', () => {
    expect(packingProjection(placement[3]!, 'top')).toEqual({ x: 0, y: 3, width: 25, height: 18 });
    expect(packingProjection(placement[3]!, 'front')).toEqual({ x: 0, y: 6, width: 25, height: 1 });
  });

  test('rejects nonfinite, zero, negative and non-whole dimensions', () => {
    for (const length of [NaN, Infinity, 0, -1, 2.5]) {
      expect(() => validatePackingDiagram({ ...box, length }, placement)).toThrow('container dimensions');
      expect(() => validatePackingDiagram(box, [{ ...placement[0]!, length }])).toThrow('item 0');
    }
  });

  test('rejects invalid coordinates and empty declarations', () => {
    for (const x of [NaN, Infinity, -1, 0.5]) {
      expect(() => validatePackingDiagram(box, [{ ...placement[0]!, x }])).toThrow('coordinates');
    }
    expect(() => validatePackingDiagram(box)).toThrow('supply a declared placement');
    expect(() => validatePackingDiagram(box, [], { label: 'Rail', length: Infinity })).toThrow('span');
  });

  test('rejects a rigid span by the full interior diagonal, not one axis', () => {
    const html = renderToStaticMarkup(createElement(PackingDiagram, {
      container: { length: 40, width: 30, height: 10 }, span: { label: 'Rail', length: 60 },
    }));
    expect(html).toContain('50.99 cm');
    expect(html).toContain('cannot fit in any orientation');
  });

  test('does not turn a necessary diagonal pass into a constructive fit', () => {
    const html = renderToStaticMarkup(createElement(PackingDiagram, {
      container: { length: 40, width: 30, height: 10 }, span: { label: 'Rail', length: 45 },
    }));
    expect(html).toContain('does not violate this necessary bound');
    expect(html).toContain('a complete placement has not been established');
    expect(html).not.toContain('This establishes a geometric placement');
  });

  test('rejects a span just above the exact bound even when the displayed diagonal rounds up', () => {
    const container = { length: 100000000, width: 10000, height: 10000 };
    const length = 100000001;
    // The squared span exceeds the squared diagonal by one, although both
    // floating-point lengths round to the same value.
    expect(BigInt(length) ** 2n - (BigInt(container.length) ** 2n + BigInt(container.width) ** 2n + BigInt(container.height) ** 2n)).toBe(1n);
    const html = renderToStaticMarkup(createElement(PackingDiagram, {
      container, span: { label: 'Boundary span', length },
    }));
    expect(html).toContain('cannot fit in any orientation');
    expect(html).not.toContain('does not violate this necessary bound');
  });

  test('allows equality with the exact diagonal without declaring a complete fit', () => {
    const html = renderToStaticMarkup(createElement(PackingDiagram, {
      container: { length: 3, width: 4, height: 12 }, span: { label: 'Span', length: 13 },
    }));
    expect(html).toContain('does not violate this necessary bound');
    expect(html).not.toContain('cannot fit in any orientation');
  });

  test('formats the computed bound in the selected locale and exposes native view choices', () => {
    const html = renderToStaticMarkup(createElement(PackingDiagram, {
      container: { length: 40, width: 30, height: 10 }, span: { label: 'Regleta', length: 60 }, locale: 'es',
      viewLabel: 'Proyección', topLabel: 'Vista superior', frontLabel: 'Vista frontal',
      spanTooLongReadout: '{item}: {span}; diagonal interior máxima: {diagonal}. No cabe en ninguna orientación.',
    }));
    expect(html).toContain('50,99 cm');
    expect(html).toContain('<select');
    expect(html).toContain('Vista superior');
    expect(html).toContain('Vista frontal');
    expect(html).not.toContain('cm cm');
  });
});
