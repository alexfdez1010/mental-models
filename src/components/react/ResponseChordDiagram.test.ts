import { describe, expect, test } from 'bun:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ResponseChordDiagram, auditResponseChordDiagram, calculateResponseChordProfile, type ResponseChordDiagramProps, type ResponseChordProfile } from '@/components/react/ResponseChordDiagram';

type PlainProfile = Exclude<ResponseChordProfile, { family: 'hinge' }>;
type HingeProfile = Extract<ResponseChordProfile, { family: 'hinge' }>;
function profiles(): [PlainProfile, HingeProfile, HingeProfile, PlainProfile, PlainProfile, HingeProfile] {
  const base = { caption: 'A stipulated response, not a fitted curve.', inputUnit: 'u', responseUnit: 'pt' };
  return [
    { ...base, id: 'square', label: 'Square', family: 'square', lower: -10, upper: 10, upperWeightQuarters: 2, scale: 1, offset: 0 },
    { ...base, id: 'hinge', label: 'Hinge across threshold', family: 'hinge', lower: 0, upper: 2, upperWeightQuarters: 2, scale: 20, offset: 0, hingeThresholdQuarters: 2 },
    { ...base, id: 'piece', label: 'Hinge on one affine piece', family: 'hinge', lower: 1, upper: 2, upperWeightQuarters: 2, scale: 20, offset: 0, hingeThresholdQuarters: 2 },
    { ...base, id: 'affine', label: 'Affine', family: 'affine', lower: 0, upper: 2, upperWeightQuarters: 2, scale: 10, offset: 0 },
    { ...base, id: 'sqrt', label: 'Square root', family: 'sqrt', lower: 0, upper: 4, upperWeightQuarters: 1, scale: 10, offset: 0 },
    { ...base, id: 'transfer', label: 'Transfer balance', family: 'hinge', lower: 0, upper: 2, upperWeightQuarters: 2, scale: 6, offset: 48, hingeThresholdQuarters: 4, responseUnit: 'cr' },
  ];
}
function fixture(): ResponseChordDiagramProps {
  return { title: 'A function and its two averages', instructions: 'Compare the declared profiles.', locale: 'en', profiles: profiles(), labels: {
    profileLabel: 'Profile', inputAxisLabel: 'Input axis', responseAxisLabel: 'Response axis', curveLabel: 'Response curve', chordLabel: 'Endpoint chord', meanInputLabel: 'Mean input', atMeanLabel: 'Response at mean input', meanResponseLabel: 'Mean response', gapLabel: 'Mean response minus response at mean input', tableCaption: 'Exact endpoint accounts', endpointLabel: 'Endpoint', lowerLabel: 'Lower input', upperLabel: 'Upper input', inputLabel: 'Input', weightLabel: 'Probability', responseLabel: 'Response', fixedScaleNote: 'Scales are fixed within each declared profile.', resultTemplate: 'Mean input {meanInput}; response at mean {responseAtMean}; mean response {meanResponse}; difference {gap}.',
  } };
}
const value = (x: { numerator: number; denominator: number }) => x.numerator / x.denominator;

describe('ResponseChordDiagram exact model', () => {
  test('six lesson profiles keep strict gaps, affine-piece equality and concave reversal distinct', () => {
    const a = auditResponseChordDiagram(fixture());
    expect(a.map(r => [value(r.meanInput), value(r.responseAtMean), value(r.meanResponse), value(r.gap)])).toEqual([[0, 0, 100, 100], [1, 10, 15, 5], [1.5, 20, 20, 0], [1, 10, 10, 0], [1, 10, 5, -5], [1, 48, 51, 3]]);
    expect(a[1]!.meanResponse).toEqual({ numerator: 15, denominator: 1 });
    // This two-point profile is not the budget law with a central atom, whose mean return is 12.5.
    expect(value(a[1]!.meanResponse)).not.toBe(12.5);
  });

  test('an independent square identity and direct hinge account cover exact quarter weights', () => {
    for (const family of ['square', 'affine', 'hinge'] as const) for (let lower = -4; lower < 4; lower++) for (let upper = lower + 1; upper <= 4; upper++) for (let q = 0; q <= 4; q++) {
      const p: ResponseChordProfile = family === 'hinge' ? { ...profiles()[1]!, family, lower, upper, upperWeightQuarters: q, hingeThresholdQuarters: 3 } : { ...profiles()[0]!, family, lower, upper, upperWeightQuarters: q, scale: 3, offset: -7 };
      const a = calculateResponseChordProfile(p), w = q / 4, mean = (1 - w) * lower + w * upper;
      const f = (x: number) => p.offset + p.scale * (family === 'square' ? x * x : family === 'affine' ? x : Math.max(0, x - 0.75));
      expect(value(a.meanInput)).toBe(mean);
      expect(value(a.meanResponse)).toBe((1 - w) * f(lower) + w * f(upper));
      expect(value(a.responseAtMean)).toBe(f(mean));
      const expectedGap = family === 'square' ? p.scale * q * (4 - q) * (upper - lower) ** 2 / 16 : family === 'affine' ? 0 : (1 - w) * f(lower) + w * f(upper) - f(mean);
      expect(value(a.gap)).toBe(expectedGap);
      if (family !== 'affine') expect(value(a.gap)).toBeGreaterThanOrEqual(0);
    }
  });

  test('negative fractions are reduced, zero normalized and degenerate weights give equality', () => {
    const p: ResponseChordProfile = { ...profiles()[0]!, family: 'affine', lower: -2, upper: 0, upperWeightQuarters: 1, scale: 1, offset: 0 };
    let a = calculateResponseChordProfile(p);
    expect(a.meanInput).toEqual({ numerator: -3, denominator: 2 }); expect(a.meanResponse).toEqual(a.meanInput); expect(a.gap).toEqual({ numerator: 0, denominator: 1 });
    for (const q of [0, 4]) { p.upperWeightQuarters = q; a = calculateResponseChordProfile(p); expect(a.gap).toEqual({ numerator: 0, denominator: 1 }); }
    p.offset = -0; a = calculateResponseChordProfile(p); expect(Object.is(a.gap.numerator, -0)).toBe(false);
  });

  test('global square vertex, negative offsets and flat hinges receive valid fixed ranges', () => {
    const p: ResponseChordProfile = { ...profiles()[0]!, lower: -20, upper: 20, scale: 20, offset: 100 };
    let a = calculateResponseChordProfile(p); expect(value(a.responseMin)).toBe(100); expect(value(a.responseMax)).toBe(8100); expect(value(a.meanResponse)).toBe(8100); expect(value(a.gap)).toBe(8000); expect([value(a.axisMin), value(a.axisMax)]).toEqual([-700, 8900]);
    const flat: ResponseChordProfile = { ...profiles()[1]!, lower: 0, upper: 1, hingeThresholdQuarters: 80, offset: -100 };
    a = calculateResponseChordProfile(flat); expect(value(a.gap)).toBe(0); expect([value(a.axisMin), value(a.axisMax)]).toEqual([-101, -99]);
    const sq: ResponseChordProfile = { ...profiles()[4]!, lower: 0, upper: 16, scale: 20, offset: -100 };
    a = calculateResponseChordProfile(sq); expect(value(a.meanResponse)).toBe(-80); expect(value(a.responseAtMean)).toBe(-60); expect(value(a.gap)).toBe(-20);
  });

  test('SSR has native labels, two scroll regions, honest coincident markers and one live result', () => {
    const p = fixture(); p.profiles = [profiles()[2]!]; const html = renderToStaticMarkup(createElement(ResponseChordDiagram, p));
    expect((html.match(/<select /g) ?? []).length).toBe(1); expect((html.match(/role="region"/g) ?? []).length).toBe(2); expect((html.match(/tabindex="0"/g) ?? []).length).toBe(2); expect((html.match(/role="status"/g) ?? []).length).toBe(1); expect((html.match(/aria-live="polite"/g) ?? []).length).toBe(1);
    expect(html).toContain('Mean input 1.5 u; response at mean 20 pt; mean response 20 pt; difference 0 pt.');
    const circle = html.match(/<circle[^>]*data-response-at-mean="20"[^>]*>/)?.[0], rect = html.match(/<rect[^>]*data-mean-response="20"[^>]*>/)?.[0]; expect(circle).toBeDefined(); expect(rect).toBeDefined();
    const cy = Number(circle!.match(/cy="([^"]+)"/)![1]), ry = Number(rect!.match(/y="([^"]+)"/)![1]); expect(ry + 4).toBe(cy);
    expect(html).not.toMatch(/NaN|Infinity|-0 pt/);
  });

  test('Spanish numbers and authored strings compose without duplicate units', () => {
    const p = fixture(); p.locale = 'es'; p.profiles = [profiles()[2]!]; p.labels.resultTemplate = 'Entrada media {meanInput}; respuesta en la media {responseAtMean}; respuesta media {meanResponse}; diferencia {gap}.';
    const html = renderToStaticMarkup(createElement(ResponseChordDiagram, p)); expect(html).toContain('Entrada media 1,5 u; respuesta en la media 20 pt; respuesta media 20 pt; diferencia 0 pt.'); expect(html).not.toContain('pt pt');
  });

  test('hidden invalid profiles, inherited fields, roots and labels reject before hooks', () => {
    const invalid: Array<(p: ResponseChordDiagramProps) => void> = [
      p => { p.profiles = []; }, p => { p.profiles = Array(7).fill(p.profiles[0]!); }, p => { delete p.profiles[2]; }, p => { p.profiles[5]!.upper = 21; }, p => { p.profiles[5]!.scale = 0; }, p => { p.profiles[5]!.offset = -101; }, p => { p.profiles[5]!.upperWeightQuarters = 1.5; }, p => { p.profiles[5]!.lower = p.profiles[5]!.upper; }, p => { p.profiles[5]!.id = p.profiles[0]!.id; }, p => { p.profiles[5]!.label = p.profiles[0]!.label; }, p => { p.profiles[5] = Object.create(p.profiles[5]); },
      p => { Object.assign(p.profiles[5]!, { family: 'unknown' }); }, p => { Object.assign(p.profiles[1]!, { hingeThresholdQuarters: 81 }); }, p => { Object.assign(p.profiles[0]!, { hingeThresholdQuarters: 0 }); }, p => { p.profiles[4]!.lower = -1; }, p => { p.profiles[4]!.upperWeightQuarters = 3; }, p => { p.profiles[4]!.upper = 3; },
      p => { p.labels = Object.create(p.labels); }, p => { p.labels.curveLabel = ' '; }, p => { p.labels.resultTemplate += ' {gap}'; }, p => { p.labels.resultTemplate = p.labels.resultTemplate.replace('{meanInput}', 'input'); }, p => { p.labels.resultTemplate += ' {unknown}'; }, p => { Object.assign(p, { locale: 'fr' }); },
    ];
    for (const change of invalid) { const p = fixture(); change(p); expect(() => ResponseChordDiagram(p)).toThrow('ResponseChordDiagram:'); }
  });
});
