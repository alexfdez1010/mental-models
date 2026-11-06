import { describe, expect, test } from 'bun:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { FirstPrinciplesBuilder, type FirstPrinciplesPart } from '@/components/react/FirstPrinciplesBuilder';
import { InversionFlip, type InversionPair } from '@/components/react/InversionFlip';
import { MapTerritoryZoom, type MapTerritoryStep } from '@/components/react/MapTerritoryZoom';

const parts: FirstPrinciplesPart[] = [{ label: 'Material', value: 90 }, { label: 'Assembly', value: 60 }];
const pairs: InversionPair[] = [
  { forward: 'Meet the deadline', inverted: 'Leave review until the last day', safeguard: 'Reserve review time' },
  { forward: 'Preserve the file', inverted: 'Keep the only copy on one drive', safeguard: 'Check a separate backup' },
];

describe('FirstPrinciplesBuilder', () => {
  test('keeps totals above the reference on one comparable scale', () => {
    const html = renderToStaticMarkup(createElement(FirstPrinciplesBuilder, { analogyValue: 100, parts }));
    const width = html.match(/style="width:([\d.]+)%"/);
    expect(width).not.toBeNull();
    expect(Number(width![1])).toBeCloseTo(100 / 150 * 100);
    expect(html).toContain('Selected parts total');
    expect(html).toContain('$0');
  });

  test('localizes built-in instructions and controls', () => {
    const html = renderToStaticMarkup(createElement(FirstPrinciplesBuilder, { analogyValue: 100, parts, locale: 'es' }));
    expect(html).toContain('Añadir todas las partes');
    expect(html).toContain('Suma de las partes seleccionadas');
    expect(html).not.toContain('Add all parts');
  });

  for (const value of [NaN, Infinity, -1, 0]) {
    test(`rejects invalid reference ${value}`, () => {
      expect(() => renderToStaticMarkup(createElement(FirstPrinciplesBuilder, { analogyValue: value, parts }))).toThrow('FirstPrinciplesBuilder:');
    });
  }

  test('rejects null parts, nonfinite amounts, and overflowing totals', () => {
    for (const invalidParts of [
      [null, parts[0]],
      [{ label: 'Material', value: Infinity }, parts[1]],
      [{ label: 'Material', value: Number.MAX_VALUE }, { label: 'Assembly', value: Number.MAX_VALUE }],
    ]) {
      expect(() => renderToStaticMarkup(createElement(FirstPrinciplesBuilder, { analogyValue: 100, parts: invalidParts as FirstPrinciplesPart[] }))).toThrow('FirstPrinciplesBuilder:');
    }
  });
});

describe('MapTerritoryZoom', () => {
  test('provides Spanish step descriptions without authored overrides', () => {
    const html = renderToStaticMarkup(createElement(MapTerritoryZoom, { locale: 'es' }));
    expect(html).toContain('Contorno básico');
    expect(html).toContain('Nivel de detalle');
    expect(html).not.toContain('Coarse outline');
  });

  for (const detail of [Infinity, NaN, 1, 2.5]) {
    test(`rejects invalid point count ${detail}`, () => {
      const steps: MapTerritoryStep[] = [{ label: 'A', note: 'A', detail }, { label: 'B', note: 'B', detail: 10 }];
      expect(() => renderToStaticMarkup(createElement(MapTerritoryZoom, { steps }))).toThrow('MapTerritoryZoom:');
    });
  }

  test('rejects null authored steps', () => {
    expect(() => renderToStaticMarkup(createElement(MapTerritoryZoom, { steps: [null, { label: 'B', note: 'B', detail: 10 }] as MapTerritoryStep[] }))).toThrow('MapTerritoryZoom:');
  });
});

describe('InversionFlip', () => {
  test('keeps goals visible while withholding anti-goals and safeguards until requested', () => {
    const html = renderToStaticMarkup(createElement(InversionFlip, { pairs }));
    expect(html).toContain('Meet the deadline');
    expect(html).toContain('aria-expanded="false"');
    expect(html).not.toContain('Leave review until the last day');
    expect(html).not.toContain('Reserve review time');
  });

  test('rejects null and incomplete pairs', () => {
    for (const invalidPairs of [[null, pairs[0]], [{ forward: 'Goal', inverted: '' }, pairs[1]]]) {
      expect(() => renderToStaticMarkup(createElement(InversionFlip, { pairs: invalidPairs as InversionPair[] }))).toThrow('InversionFlip:');
    }
  });
});
