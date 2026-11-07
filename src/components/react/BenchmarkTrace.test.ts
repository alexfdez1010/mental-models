import { createElement } from "react";
import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { BenchmarkTrace, validateBenchmarkTrace } from '@/components/react/BenchmarkTrace';
const props = { aLabel: 'A', bLabel: 'B', unit: 'ms/job', observations: [{ label: 'Initial', a: 1000, b: 900 }, { label: 'Later', a: 650, b: 600 }] };
describe('BenchmarkTrace authored measurements', () => {
    test('same zero and maximum across checkpoints; initial controls and live result', () => {
        const html = renderToStaticMarkup(createElement(BenchmarkTrace, { ...props }));
        expect(html).toContain('scaleX(1)');
        expect(html).toContain('scaleX(0.9)');
        expect(html).toContain('+100 ms/job');
        expect(html).toContain('aria-live="polite"');
        expect(html).toContain('aria-atomic="true"');
        expect(html).toContain('disabled=""');
        expect(html).toContain('not-prose');
        expect(html).toContain('motion-reduce:transition-none');
        expect(html).not.toMatch(/undefined|NaN/);
    });
    test('Spanish chrome, decimal formatting and zero are valid', () => {
        const html = renderToStaticMarkup(createElement(BenchmarkTrace, { ...props, locale: "es", unit: "ms/trabajo", observations: [{ label: 'Inicial', a: 10000.5, b: 0 }, { label: 'Después', a: 0, b: 0 }] }));
        expect(html).toContain('10.000,5 ms/trabajo');
        expect(html).toContain('0 ms/trabajo');
        expect(html).toContain('Medición siguiente');
        expect(html).not.toContain('Next checkpoint');
    });
    test('zero and differences rounded to zero do not acquire a sign', () => {
        for (const [a, b] of [[-0, 0], [0, 0.001], [0.001, 0]]) {
            const html = renderToStaticMarkup(createElement(BenchmarkTrace, {
                ...props, observations: [{ label: 'Initial', a, b }, { label: 'Later', a: 0, b: 0 }],
            }));
            expect(html).not.toContain('-0 ms/job');
            expect(html).not.toContain('+0 ms/job');
            expect(html).toContain('0 ms/job');
        }
        const es = renderToStaticMarkup(createElement(BenchmarkTrace, {
            ...props, locale: 'es', observations: [{ label: 'Initial', a: 0.25, b: 0.5 }, { label: 'Later', a: 0, b: 0 }],
        }));
        expect(es).toContain('-0,25 ms/job');
    });
    test('validates every hidden row before hooks, including finite non-negative values', () => {
        for (const value of [NaN, Infinity, -1])
            expect(() => renderToStaticMarkup(createElement(BenchmarkTrace, { ...props, observations: [props.observations[0], { label: 'Hidden', a: value, b: 1 }] }))).toThrow('BenchmarkTrace: checkpoint 1');
        expect(() => validateBenchmarkTrace({ ...props, observations: [] })).toThrow('BenchmarkTrace: observations');
        expect(() => validateBenchmarkTrace({ ...props, aLabel: ' ' })).toThrow('BenchmarkTrace: aLabel');
        expect(() => validateBenchmarkTrace({ ...props, observations: [props.observations[0], { label: '', a: 0, b: 0 }] })).toThrow('BenchmarkTrace: checkpoint 1');
    });
});
