import { describe, expect, test } from 'bun:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MM1QueueExplorer, computeMM1Measures, type MM1QueueLabels, type MM1Ratio } from '@/components/react/MM1QueueExplorer';

const en: MM1QueueLabels = {
  title: 'Stationary model, not a trace', assumptions: 'Poisson arrivals; independent exponential services; one work-conserving FCFS server, unlimited waiting, constant rates and a stationary regime.',
  arrival: 'Arrival rate λ', service: 'Service rate μ', reset: 'Reset rates', load: 'Offered load λ/μ',
  busyFraction: 'Stationary busy fraction', meanSystem: 'Mean in system (jobs)', meanWaiting: 'Mean in queue (jobs)',
  meanStay: 'Mean total stay (min)', meanWait: 'Mean waiting (min)', nonstationary: 'No stationary distribution for these rates.',
  curve: 'Mean stay against arrival rate', curveDescription: 'The red line is the selected arrival rate. The dashed boundary is λ=μ when it is visible; the curve remains on the stable side.',
  arrivalAxis: 'Arrival rate λ (jobs/h)', timeAxis: 'Mean total stay (min)', offscale: 'The arrow continues above60min; the boundary is not a finite result.',
  distribution: 'Stationary probabilities on a common0–1scale', probability: 'Probability', tail: 'N ≥5', rateUnit: 'jobs/h',
};
const es: MM1QueueLabels = {
  title: 'Modelo estacionario, no una cronología', assumptions: 'Llegadas Poisson; servicios exponenciales independientes; un servidor FCFS que trabaja cuando puede, espera ilimitada, tasas constantes y régimen estacionario.',
  arrival: 'Tasa de llegada λ', service: 'Tasa de servicio μ', reset: 'Restablecer tasas', load: 'Carga ofrecida λ/μ',
  busyFraction: 'Fracción ocupada estacionaria', meanSystem: 'Media en el sistema (trabajos)', meanWaiting: 'Media en cola (trabajos)',
  meanStay: 'Estancia total media (min)', meanWait: 'Espera media (min)', nonstationary: 'No existe distribución estacionaria para estas tasas.',
  curve: 'Estancia media frente a tasa de llegada', curveDescription: 'La línea roja marca la tasa de llegada elegida. El límite discontinuo es λ=μ cuando resulta visible; la curva permanece en el lado estable.',
  arrivalAxis: 'Tasa de llegada λ (trabajos/h)', timeAxis: 'Estancia total media (min)', offscale: 'La flecha continúa por encima de60min; el límite no es un resultado finito.',
  distribution: 'Probabilidades estacionarias en una escala común0–1', probability: 'Probabilidad', tail: 'N ≥5', rateUnit: 'trabajos/h',
};
function render(arrival: number, service: number, locale: 'en' | 'es' = 'en') {
  return renderToStaticMarkup(createElement(MM1QueueExplorer, { initialArrival: arrival, initialService: service, labels: locale === 'es' ? es : en, locale }));
}
const crossEqual = (a: MM1Ratio, b: MM1Ratio) => expect(BigInt(a.numerator) * BigInt(b.denominator)).toBe(BigInt(b.numerator) * BigInt(a.denominator));
function subtract(a: MM1Ratio, b: MM1Ratio): MM1Ratio {
  return { numerator: a.numerator * b.denominator - b.numerator * a.denominator, denominator: a.denominator * b.denominator };
}

describe('MM1QueueExplorer stationary boundary', () => {
  test('satisfies independent balance, normalization, Little and service identities on the full integer catalogue', () => {
    let stable = 0, outside = 0;
    for (let arrival = 1; arrival <= 12; arrival++) for (let service = 2; service <= 16; service++) {
      const model = computeMM1Measures(arrival, service);
      if (arrival >= service) {
        expect(model.stable).toBe(false);
        expect(Object.keys(model).sort()).toEqual(['load', 'stable']);
        outside++; continue;
      }
      expect(model.stable).toBe(true);
      if (!model.stable) throw new Error('Unexpected nonstationary result');
      stable++;
      const ns = model.probabilityNumerators, d = model.probabilityDenominator;
      expect(ns.reduce((a, b) => a + b, 0)).toBe(d);
      for (let n = 0; n < 4; n++) expect(arrival * ns[n]!).toBe(service * ns[n + 1]!);
      // Independently recover E[N] from finite probabilities and the geometric tail.
      const prefix = ns.slice(0, 5).reduce((sum, numerator, n) => sum + n * numerator, 0);
      const gap = service - arrival;
      expect(prefix * gap + ns[5]! * (5 * gap + arrival)).toBe(d * arrival);
      crossEqual(subtract(model.meanSystem, model.meanWaiting), model.load);
      crossEqual(subtract(model.meanStay, model.meanWait), { numerator: 60, denominator: service });
      crossEqual(model.meanSystem, { numerator: arrival * model.meanStay.numerator, denominator: 60 * model.meanStay.denominator });
      crossEqual(model.meanWaiting, { numerator: arrival * model.meanWait.numerator, denominator: 60 * model.meanWait.denominator });
    }
    expect(stable).toBe(114); expect(outside).toBe(66);
  });

  test('keeps every selected stable point and curve on its correct scale in both locales', () => {
    for (const locale of ['en', 'es'] as const) for (let arrival = 1; arrival <= 12; arrival++) for (let service = 2; service <= 16; service++) {
      const html = render(arrival, service, locale);
      expect(html).toContain('data-stable="' + (arrival < service) + '"');
      expect(html).not.toMatch(/NaN|Infinity|>-0</);
      expect((html.match(/aria-live="polite"/g) ?? []).length).toBe(1);
      expect((html.match(/type="range"/g) ?? []).length).toBe(2);
      if (arrival === 1) {
      const points = html.match(/<polyline points="([^"]+)"/)![1]!.split(' ').map((pair) => pair.split(',').map(Number));
      for (const [x, y] of points) {
        expect(x! >= 94 && x! <= 600).toBe(true);
        expect(y! >= 40 && y! <= 250).toBe(true);
      }
      }
      expect(html.includes('data-mm1-boundary=')).toBe(service <= 12);
      expect(html.includes('data-mm1-offscale=')).toBe(service <= 12);
      if (arrival < service) {
        const actual = html.match(/<circle cx="([^"]+)" cy="([^"]+)"[^>]*data-mm1-selected-minutes="([^"]+)"/)!;
        expect(Number(actual[1])).toBe(48 + 46 * arrival);
        expect(Number(actual[2])).toBe(250 - 210 / (service - arrival));
        expect(Number(actual[3])).toBe(60 / (service - arrival));
        expect((html.match(/data-mm1-probability=/g) ?? []).length).toBe(6);
      } else {
        expect(html).not.toContain('data-mm1-selected-minutes');
        expect(html).not.toContain('data-mm1-probability');
        expect(html).not.toContain('data-mm1-metric="busy-fraction"');
        expect(html).not.toContain('data-mm1-metric="mean-stay"');
      }
      if (locale === 'es') {
        expect(html).toContain('Tasa de llegada λ');
        expect(html).toContain('aria-valuetext="Tasa de servicio μ (trabajos/h):');
        expect(html).not.toMatch(/Reset rates|Mean total stay|Stationary probabilities/);
      }
    }
  });

  test('retains tiny positive probabilities and counts with exact fractions and nonzero approximations', () => {
    const html = render(1, 16);
    expect(html).toContain('1/1048576 ≈ 0.000000954');
    expect(html).toContain('1/240 ≈ 0.00417');
    expect(html).not.toContain('1/1048576 ≈ 0<');
  });

  test('does not equate offered load with a busy fraction outside the model domain', () => {
    const html = render(12, 2);
    expect(html).toContain('data-mm1-metric="load" data-numerator="12" data-denominator="2">6</dd>');
    expect(html).toContain(en.nonstationary);
    expect(html).not.toContain('data-mm1-metric="busy-fraction"');
    expect(html).not.toContain('data-mm1-metric="mean-waiting"');
  });

  test('retains clock scale when the same utilization has different absolute rates', () => {
    const a = computeMM1Measures(4, 5), b = computeMM1Measures(8, 10);
    if (!a.stable || !b.stable) throw new Error('Expected stable examples');
    crossEqual(a.load, b.load);
    crossEqual(a.meanSystem, b.meanSystem);
    crossEqual(a.meanStay, { numerator: 60, denominator: 1 });
    crossEqual(b.meanStay, { numerator: 30, denominator: 1 });
  });

  test('rejects out-of-contract rates and labels instead of clamping the model', () => {
    for (const arrival of [-0, 0, -1, 1.5, NaN, Infinity, 13]) expect(() => render(arrival, 10)).toThrow('MM1QueueExplorer:');
    for (const service of [0, 1, -1, 2.5, NaN, Infinity, 17]) expect(() => render(6, service)).toThrow('MM1QueueExplorer:');
    expect(() => renderToStaticMarkup(createElement(MM1QueueExplorer, { labels: {} as MM1QueueLabels }))).toThrow('MM1QueueExplorer:');
  });
});
