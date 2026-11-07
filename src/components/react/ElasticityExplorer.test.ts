import { describe, expect, test } from 'bun:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { calculateElasticityModel, ElasticityExplorer } from '@/components/react/ElasticityExplorer';

describe('the admitted constant-local-elasticity model', () => {
  test('has the declared reference and unrounded quantities', () => {
    expect(calculateElasticityModel(5, .5)).toEqual({ quantity: 5, revenue: 25, classification: 'inelastic' });
    const high = calculateElasticityModel(10, .5);
    expect(high.quantity).toBeCloseTo(5 / Math.sqrt(2), 12);
    expect(high.revenue).toBeCloseTo(50 / Math.sqrt(2), 12);
    expect(high.revenue).not.toBe(10 * 3.5);
  });
  test('unit elasticity is exactly one, including its immediate floating neighbors', () => {
    for (const [e, expected] of [[.9, 'inelastic'], [1 - Number.EPSILON, 'inelastic'], [1, 'unit'], [1 + Number.EPSILON, 'elastic'], [1.1, 'elastic']] as const) expect(calculateElasticityModel(10, e).classification).toBe(expected);
    expect(calculateElasticityModel(10, .9).revenue).toBeGreaterThan(25);
    expect(calculateElasticityModel(10, 1.1).revenue).toBeLessThan(25);
  });
  test('all 264 native numeric combinations fit the fixed axes and have the proper direction', () => {
    let count = 0;
    for (let tick = 2; tick <= 25; tick++) {
      let previousRevenue = 25;
      for (let half = 10; half <= 20; half++) {
        const price = half / 2, e = tick / 10, result = calculateElasticityModel(price, e);
        expect(result.quantity > 0 && result.quantity <= 5 && Number.isFinite(result.revenue)).toBe(true);
        expect(result.quantity).toBeCloseTo(5 * (5 / price) ** e, 12);
        expect(result.classification).toBe(tick < 10 ? 'inelastic' : tick === 10 ? 'unit' : 'elastic');
        if (tick === 10) expect(result.revenue).toBeCloseTo(25, 12);
        else if (half > 10) expect(tick < 10 ? result.revenue > previousRevenue : result.revenue < previousRevenue).toBe(true);
        previousRevenue = result.revenue; count++;
      }
    }
    expect(count).toBe(264);
  });
  test('rejects the old capped price branch and all nonfinite/out-of-domain numeric inputs', () => {
    for (const price of [0, 1, 4.99, 10.01, NaN, Infinity, -Infinity]) expect(() => calculateElasticityModel(price, 1)).toThrow('ElasticityExplorer');
    for (const elasticity of [0, .19, 2.51, NaN, Infinity, -Infinity]) expect(() => calculateElasticityModel(5, elasticity)).toThrow('ElasticityExplorer');
  });
  test('initial SVG has the declared axes, rectangle, curve domain and native controls', () => {
    const html = renderToStaticMarkup(createElement(ElasticityExplorer));
    expect(html).toContain('viewBox="0 0 440 300"');
    expect(html).toContain('x="40" y="139" width="382" height="123"');
    expect(html).toContain('cx="422" cy="139"');
    expect(html).toContain('d="M 422.0,139.0');
    expect(html).toContain('min="5" max="10" step="0.5"');
    expect(html).toContain('min="0.2" max="2.5" step="0.1"');
    expect(html).toContain('aria-valuetext="0.5 — inelastic"');
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain('motion-reduce:transition-none');
    expect(html).not.toMatch(/NaN|Infinity|undefined/);
  });
  test('locale changes only human number text, leaving SVG coordinates intact', () => {
    const en = renderToStaticMarkup(createElement(ElasticityExplorer));
    const es = renderToStaticMarkup(createElement(ElasticityExplorer, { locale: 'es' }));
    expect(es).toContain('aria-valuetext="0,5 — inelastic"');
    expect(en.match(/<path[^>]+d="([^"]+)"/)?.[1]).toBe(es.match(/<path[^>]+d="([^"]+)"/)?.[1]);
    expect(en.match(/<circle[^>]+>/)?.[0]).toBe(es.match(/<circle[^>]+>/)?.[0]);
    expect(() => renderToStaticMarkup(createElement(ElasticityExplorer, { locale: 'fr' as 'en' }))).toThrow('locale');
  });
});
