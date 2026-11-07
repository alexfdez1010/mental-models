import { describe, expect, test } from 'bun:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { OptimalStoppingLab } from '@/components/react/OptimalStoppingLab';

const render = (props: Parameters<typeof OptimalStoppingLab>[0]) => renderToStaticMarkup(createElement(OptimalStoppingLab, props));
const geometries = (html: string) => [...html.matchAll(/<(?:svg|path|line|circle|rect)[^>]*>/g)].map(m => m[0].replace(/ aria-label="[^"]*"/g, ''));
const es = { locale: 'es' as const, trueBestTitle: 'mejor global', sampleTitle: 'muestra', candidateTitle: 'opción', percentileUnitLabel: 'percentil' };

describe('OptimalStoppingLab narrow locale props', () => {
  test('explicit English keeps defaults and markup unchanged across sizes, cutoffs and objectives', () => {
    for (const initialN of [5, 6, 30, 60]) for (const initialLookPercent of [0, 37, 95]) for (const initialObjective of ['best', 'value'] as const) {
      const p = { initialN, initialLookPercent, initialObjective };
      expect(render(p)).toBe(render({ ...p, locale: 'en' }));
    }
  });

  test('Spanish changes only authorized tooltip/unit strings and decimal punctuation; geometry is identical', () => {
    const observed = new Set<string>();
    for (const initialN of [5, 6, 30, 60]) for (const initialLookPercent of [0, 37, 95]) for (const initialObjective of ['best', 'value'] as const) {
      const p = { initialN, initialLookPercent, initialObjective }, english = render(p), spanish = render({ ...p, ...es });
      expect(spanish).toContain('0,368');
      expect(spanish).not.toContain('0.368');
      expect(geometries(spanish)).toEqual(geometries(english));
      const normalized = spanish.replaceAll('0,368', '0.368').replaceAll('title="mejor global"', 'title="true best"').replaceAll('title="muestra"', 'title="sample"').replaceAll('title="opción"', 'title="candidate"').replaceAll('percentil', 'pctl');
      expect(normalized).toBe(english);
      for (const label of ['mejor global', 'muestra', 'opción']) if (spanish.includes('title="' + label + '"')) observed.add(label);
      if (initialObjective === 'value') { expect(spanish).toContain('percentil'); expect(spanish).not.toContain('pctl'); }
    }
    expect([...observed].sort()).toEqual(['mejor global', 'muestra', 'opción'].sort());
  });
});
