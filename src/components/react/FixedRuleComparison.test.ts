import { describe, expect, test } from 'bun:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { FixedRuleComparison, auditFixedRuleComparison, calculateFixedRuleRecord, type FixedRuleComparisonProps, type FixedRule, type FixedRuleRecord } from '@/components/react/FixedRuleComparison';

function fixture(): FixedRuleComparisonProps {
  return {
    title: 'Check fixed rules against stipulated records', instructions: 'Change the rule or the selected record.', locale: 'en', inputUnit: 'cards', outputUnit: 'min',
    rules: [{ id: 'A', label: 'A: preparation plus work', intercept: 10, perUnit: 3 }, { id: 'B', label: 'B: work only', intercept: 0, perUnit: 5 }],
    records: [{ id: 'given', label: 'Initial record', input: 5, observed: 25 }, { id: 'eight', label: 'Eight-card check', input: 8, observed: 34 }, { id: 'twelve', label: 'Twelve-card check', input: 12, observed: 46 }],
    labels: { ruleLabel: 'Rule', recordLabel: 'Record', inputAxisLabel: 'Count', outputAxisLabel: 'Duration', predictionLabel: 'Rule prediction', observedLabel: 'Recorded duration', residualLabel: 'Observed minus predicted', tableCaption: 'All records and selected-rule predictions', inputLabel: 'Count', resultTemplate: 'For n={input}, predicted {predicted}; observed {observed}; observed minus predicted {residual}.', fixedScaleNote: 'Scales stay fixed while either selection changes. These are constructed records.' },
  };
}
const attrs = (tag: string) => Object.fromEntries([...tag.matchAll(/([\w-]+)="([^"]*)"/g)].map(match => [match[1]!, match[2]!]));

describe('FixedRuleComparison bounded integer model', () => {
  test('the three approved datasets keep predictions and signed residuals distinct', () => {
    const main = fixture();
    expect(auditFixedRuleComparison(main).rows.map(rows => rows.map(r => [r.predicted, r.residual]))).toEqual([[[25, 0], [34, 0], [46, 0]], [[25, 0], [40, -6], [60, -14]]]);
    const changed = fixture(); changed.rules = [{ id: 'C', label: 'C: proposed preparation', intercept: 20, perUnit: 3 }]; changed.records = [{ id: 'proposal', label: 'Used to propose C', input: 8, observed: 44 }, { id: 'later', label: 'Later check', input: 12, observed: 56 }];
    expect(auditFixedRuleComparison(changed).rows.map(rows => rows.map(r => [r.predicted, r.residual]))).toEqual([[[44, 0], [56, 0]]]);
    const transfer = fixture(); transfer.rules = [{ id: 'D', label: 'D', intercept: 6, perUnit: 4 }, { id: 'E', label: 'E', intercept: 6, perUnit: 3 }]; transfer.records = [{ id: 'three', label: 'Three cards', input: 3, observed: 18 }, { id: 'seven', label: 'Seven cards', input: 7, observed: 37 }];
    expect(auditFixedRuleComparison(transfer).rows.map(rows => rows.map(r => [r.predicted, r.residual]))).toEqual([[[18, 0], [34, 3]], [[15, 3], [27, 10]]]);
    expect([main, changed, transfer].map(p => auditFixedRuleComparison(p).outputMax)).toEqual([70, 70, 70]);
  });

  test('an independent BigInt oracle covers every allowed parameter and input combination', () => {
    for (let intercept = 0; intercept <= 60; intercept++) for (let perUnit = 0; perUnit <= 12; perUnit++) for (let input = 0; input <= 12; input++) {
      const observed = (17 * intercept + 11 * perUnit + 5 * input) % 241;
      const rule: FixedRule = { id: 'r', label: 'Declared rule', intercept, perUnit }, record: FixedRuleRecord = { id: 's', label: 'Stipulated record', input, observed };
      const actual = calculateFixedRuleRecord(rule, record), predicted = BigInt(intercept) + BigInt(perUnit) * BigInt(input), residual = BigInt(observed) - predicted;
      expect(actual).toEqual({ input, observed, predicted: Number(predicted), residual: Number(residual) });
      expect(actual.predicted + actual.residual).toBe(observed);
      expect(Number.isSafeInteger(actual.predicted) && Number.isSafeInteger(actual.residual)).toBe(true);
    }
  });

  test('all extrema set fixed scales from the full collection and normalize zero', () => {
    const p = fixture(); p.rules = [{ id: 'max', label: 'Largest rule', intercept: 60, perUnit: 12 }, { id: 'zero', label: 'Zero rule', intercept: -0, perUnit: -0 }]; p.records = [{ id: 'zero', label: 'Zero observation', input: 12, observed: -0 }, { id: 'max', label: 'Largest observation', input: 12, observed: 240 }];
    const a = auditFixedRuleComparison(p); expect([a.inputMin, a.inputMax, a.outputMin, a.outputMax]).toEqual([0, 12, 0, 250]); expect(a.rows[0]![0]).toEqual({ input: 12, observed: 0, predicted: 204, residual: -204 }); expect(a.rows[1]![1]!.residual).toBe(240);
    const zero = calculateFixedRuleRecord(p.rules[1]!, { id: 'zero', label: 'Zero input', input: -0, observed: -0 }); for (const value of Object.values(zero)) expect(Object.is(value, -0)).toBe(false);
    p.rules = [p.rules[1]!]; p.records = [{ id: 'zero', label: 'Zero input', input: 0, observed: 0 }]; expect(auditFixedRuleComparison(p).outputMax).toBe(20);
    // Reordering changes the selected pair, never the global range for the same collection.
    const main = fixture(), expected = auditFixedRuleComparison(main).outputMax;
    for (const rule of main.rules) for (const record of main.records) expect(auditFixedRuleComparison({ ...main, rules: [rule, ...main.rules.filter(x => x !== rule)], records: [record, ...main.records.filter(x => x !== record)] }).outputMax).toBe(expected);
  });

  test('SSR exposes labels, independent native controls, a complete table and one live result', () => {
    const p = fixture(), html = renderToStaticMarkup(createElement(FixedRuleComparison, p));
    expect((html.match(/<select /g) ?? []).length).toBe(2); expect((html.match(/<label /g) ?? []).length).toBe(2); expect((html.match(/role="region"/g) ?? []).length).toBe(2); expect((html.match(/tabindex="0"/g) ?? []).length).toBe(2); expect((html.match(/role="status"/g) ?? []).length).toBe(1); expect((html.match(/aria-live="polite"/g) ?? []).length).toBe(1);
    expect(html).toContain('data-rule-id="A" data-record-id="given"'); expect(html).toContain('data-output-min="0" data-output-max="70"'); expect((html.match(/data-fixed-rule-row=/g) ?? []).length).toBe(3); expect((html.match(/data-fixed-rule-record=/g) ?? []).length).toBe(3);
    expect(html).toContain('data-selected-row="true" aria-current="true" style="background-color:var(--color-brand-100)"'); expect(html).toContain('Count (cards)'); expect(html).toContain('Observed minus predicted (min)'); expect(html).toContain('data-fixed-rule-column="4">0</td>');
    const result = 'For n=5, predicted 25 min; observed 25 min; observed minus predicted 0 min.'; expect(html.split(result).length - 1).toBe(1); expect(html).not.toMatch(/<button|NaN|Infinity|[+-]0 min|1 cards/);
    const circle = attrs(html.match(/<circle[^>]*data-selected-observed[^>]*>/)![0]), rect = attrs(html.match(/<rect[^>]*data-selected-prediction[^>]*>/)![0]); expect(Number(rect.x) + 4).toBe(Number(circle.cx)); expect(Number(rect.y) + 4).toBe(Number(circle.cy));
    // A single rule still names that rule in the legend, and keeps the record control.
    p.rules = [p.rules[0]!]; const single = renderToStaticMarkup(createElement(FixedRuleComparison, p)); expect((single.match(/<select /g) ?? []).length).toBe(1); expect(single).toContain('Rule prediction: A: preparation plus work');
  });

  test('positive, negative and zero differences compose naturally in both locales', () => {
    const p = fixture(); p.rules = [p.rules[1]!]; p.records = [p.records[1]!]; let html = renderToStaticMarkup(createElement(FixedRuleComparison, p)); expect(html).toContain('predicted 40 min; observed 34 min; observed minus predicted -6 min.');
    p.rules = [{ id: 'E', label: 'E: seis más tres por tarjeta', intercept: 6, perUnit: 3 }]; p.records = [{ id: 'seven', label: 'Registro de siete tarjetas', input: 7, observed: 37 }]; p.locale = 'es'; p.inputUnit = 'tarjetas'; p.title = 'Comparar una regla con registros'; p.instructions = 'Elige un registro.';
    p.labels = { ruleLabel: 'Regla', recordLabel: 'Registro', inputAxisLabel: 'Cantidad', outputAxisLabel: 'Duración', predictionLabel: 'Predicción de la regla', observedLabel: 'Duración registrada', residualLabel: 'Observado menos predicho', tableCaption: 'Registros y predicciones de la regla', inputLabel: 'Cantidad', resultTemplate: 'Para n={input}, predicción {predicted}; registro {observed}; observado menos predicho {residual}.', fixedScaleNote: 'Ejes fijos en este modelo.' };
    html = renderToStaticMarkup(createElement(FixedRuleComparison, p)); expect((html.match(/<select /g) ?? []).length).toBe(1); expect(html).toContain('Para n=7, predicción 27 min; registro 37 min; observado menos predicho +10 min.'); expect(html).toContain('data-fixed-rule-column="4">+10</td>'); expect(html).not.toMatch(/Rule prediction|Recorded duration|For n=|min min/);
  });

  test('tokens in admitted unit text stay literal rather than being processed again', () => {
    for (const locale of ['en', 'es'] as const) {
      const p = fixture(); p.locale = locale; p.outputUnit = 'min {observed}';
      const html = renderToStaticMarkup(createElement(FixedRuleComparison, p));
      const expected = 'For n=5, predicted 25 min {observed}; observed 25 min {observed}; observed minus predicted 0 min {observed}.';
      expect(html.split(expected).length - 1).toBe(1);
      expect(html).not.toContain('predicted 25 min 25 min');
    }
  });

  test('invalid hidden data, inherited fields, sparse arrays and templates reject before hooks', () => {
    const invalid: Array<(p: FixedRuleComparisonProps) => void> = [
      p => { p.rules = []; }, p => { p.rules.push({ ...p.rules[1]!, id: 'extra', label: 'Extra' }); }, p => { delete p.rules[1]; }, p => { p.records = []; }, p => { p.records = Array.from({ length: 7 }, (_, i) => ({ id: String(i), label: String(i), input: 0, observed: 0 })); }, p => { delete p.records[2]; },
      p => { p.rules[1]!.intercept = -1; }, p => { p.rules[1]!.intercept = 61; }, p => { p.rules[1]!.perUnit = 13; }, p => { p.rules[1]!.perUnit = 1.5; }, p => { p.rules[1]!.intercept = NaN; }, p => { p.rules[1]!.perUnit = Infinity; }, p => { p.records[2]!.input = 13; }, p => { p.records[2]!.input = -1; }, p => { p.records[2]!.observed = 241; }, p => { p.records[2]!.observed = -1; }, p => { p.records[2]!.observed = 1.1; }, p => { p.records[2]!.observed = NaN; },
      p => { p.rules[1]!.id = p.rules[0]!.id; }, p => { p.rules[1]!.label = p.rules[0]!.label; }, p => { p.records[2]!.id = p.records[0]!.id; }, p => { p.records[2]!.label = p.records[0]!.label; }, p => { p.rules[1]!.label = ' '; }, p => { p.records[2]!.label = ' not trimmed'; }, p => { p.rules[1] = Object.create(p.rules[1]); }, p => { p.records[2] = Object.create(p.records[2]); },
      p => { Object.setPrototypeOf(p, { locale: p.locale }); delete (p as Partial<FixedRuleComparisonProps>).locale; }, p => { p.labels = Object.create(p.labels); }, p => { p.rules[1] = Object.assign(Object.create({ intercept: 0 }), { id: 'B', label: 'Rule B', perUnit: 5 }); }, p => { p.records[2] = Object.assign(Object.create({ observed: 46 }), { id: 'twelve', label: 'Twelve-card record', input: 12 }); }, p => { p.labels.residualLabel = ''; }, p => { p.inputUnit = ''; }, p => { p.outputUnit = ' min'; }, p => { Object.assign(p, { locale: 'fr' }); }, p => { p.labels.resultTemplate += ' {input}'; }, p => { p.labels.resultTemplate = p.labels.resultTemplate.replace('{observed}', 'observed'); }, p => { p.labels.resultTemplate += ' {winner}'; },
    ];
    for (const change of invalid) { const p = fixture(); change(p); expect(() => FixedRuleComparison(p)).toThrow('FixedRuleComparison:'); }
  });
});
