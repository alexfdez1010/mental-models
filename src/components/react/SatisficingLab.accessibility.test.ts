import { describe, expect, test } from 'bun:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { SatisficingLab } from '@/components/react/SatisficingLab';

function trace(props: Parameters<typeof SatisficingLab>[0]) {
  const html = renderToStaticMarkup(createElement(SatisficingLab, props));
  const strip = html.match(/<div class="mt-3 flex flex-wrap gap-1" role="list" aria-label="([^"]*)">([\s\S]*?)<\/div>/);
  if (!strip) throw new Error('Accessible demonstration list is missing');
  const items = [...strip[2].matchAll(/<span role="listitem"([^>]*)>(\d+)<\/span>/g)].map(m => ({
    attrs: Object.fromEntries([...m[1].matchAll(/([\w-]+)="([^"]*)"/g)].map(x => [x[1], x[2]])),
    quality: Number(m[2]),
  }));
  return { html, name: strip[1], items };
}

describe('SatisficingLab demonstration accessibility', () => {
  test('names the complete ordered field and each option’s quality and inspection state', () => {
    const result = trace({ initialN: 30, initialAspiration: 72 });
    expect(result.name).toBe('Watch one search');
    expect(result.items).toHaveLength(30);
    const first = result.items.findIndex(x => x.quality >= 72);
    const chosen = first === -1 ? 29 : first;
    const best = Math.max(...result.items.map(x => x.quality));
    result.items.forEach((x, i) => {
      expect(x.attrs['aria-posinset']).toBe(String(i + 1));
      expect(x.attrs['aria-setsize']).toBe('30');
      expect(x.attrs['aria-label']).toContain(`${i + 1}: Quality ${x.quality}; `);
      expect(x.attrs['aria-label']).toContain(i === chosen ? 'accepted' : i < chosen ? 'rejected' : 'not seen');
    });
    expect(result.items.find(x => x.quality === best)?.attrs['aria-label']).toContain('true best');
    expect(result.html).not.toContain('role="list" aria-hidden="true"');
  });

  test('reuses Spanish props for all accessible state descriptions, including uninspected best', () => {
    const result = trace({ locale: 'es', initialN: 6, initialAspiration: 0,
      colQualityLabel: 'Calidad', demoLabel: 'Conjunto completo para auditar', acceptedLabel: 'seleccionada',
      bestOptionTitle: 'calidad más alta', rejectedOptionTitle: 'rechazada', unseenOptionTitle: 'no examinada' });
    expect(result.name).toBe('Conjunto completo para auditar');
    expect(result.items).toHaveLength(6);
    expect(result.items[0].attrs['aria-label']).toContain('seleccionada');
    expect(result.items.slice(1).every(x => x.attrs['aria-label'].includes('no examinada'))).toBe(true);
    expect(result.items.every(x => x.attrs['aria-label'].includes('Calidad'))).toBe(true);
    expect(result.items.some(x => x.attrs['aria-label'].includes('calidad más alta'))).toBe(true);
    expect(result.items.every(x => !/true best|not seen|accepted|rejected/.test(x.attrs['aria-label']))).toBe(true);
  });

  test('exposes the final-option fallback without hiding its earlier rejected options', () => {
    const result = trace({ initialN: 6, initialAspiration: 100 });
    expect(result.items.every(x => x.quality < 100)).toBe(true);
    expect(result.items.slice(0, 5).every(x => x.attrs['aria-label'].includes('rejected'))).toBe(true);
    expect(result.items[5].attrs['aria-label']).toContain('accepted');
    expect(result.html.match(/aria-live="polite"/g)).toHaveLength(1);
  });

  test('reports positions and set size for the actual clamped field', () => {
    for (const [initialN, count] of [[1, 6], [100, 50]]) {
      const result = trace({ initialN });
      expect(result.items).toHaveLength(count);
      expect(result.items.every(x => x.attrs['aria-setsize'] === String(count))).toBe(true);
      expect(result.items.at(-1)?.attrs['aria-posinset']).toBe(String(count));
    }
  });
});
