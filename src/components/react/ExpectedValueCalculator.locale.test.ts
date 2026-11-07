import { createElement } from "react";
import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { ExpectedValueCalculator } from '@/components/react/ExpectedValueCalculator';
const scenario = { prompt: 'Compare net differences', outcomes: [{ label: 'No match', payoff: 8, prob: 70 }, { label: 'Match', payoff: -2, prob: 30 }], unit: ' credits', unitPosition: 'suffix' };
test('locale changes number presentation while retaining the same incremental result and controls', () => {
    const en = renderToStaticMarkup(createElement(ExpectedValueCalculator, { scenario: scenario }));
    const es = renderToStaticMarkup(createElement(ExpectedValueCalculator, { scenario: scenario, locale: "es" }));
    expect(en).toContain('5.6 credits');
    expect(es).toContain('5,6 credits');
    expect(en).toContain('-0.6 credits');
    expect(es).toContain('-0,6 credits');
    for (const html of [en, es]) {
        expect(html).toContain('>5 credits<');
        expect(html.match(/type="range"/g)?.length).toBe(2);
        expect(html).not.toContain('Cost to play');
        expect(html).not.toContain('coin-flip');
    }
});
test('zero, prefix, cost and negative net formatting use the requested locale', () => {
    const html = renderToStaticMarkup(createElement(ExpectedValueCalculator, { locale: "es", scenario: { prompt: 'Cost', outcomes: [{ label: 'Zero', payoff: 0, prob: 50 }, { label: 'Loss', payoff: -2.5, prob: 50 }], unit: '€', cost: 1.5 } }));
    expect(html).toContain('€0');
    expect(html).toContain('-€2,5');
    expect(html).toContain('-€1,25');
    expect(html).toContain('-€2,75');
});
