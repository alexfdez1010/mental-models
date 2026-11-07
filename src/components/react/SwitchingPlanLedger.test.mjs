import { describe, expect, test } from 'bun:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { SwitchingPlanLedger, switchingPlans } from '@/components/react/SwitchingPlanLedger';

const props = {
  title: 'Continuation plans', instructions: 'Inspect the entire plan.', caption: 'Known future benefits; repeated fee.',
  benefitsA: [6, 6, 6], benefitsB: [9, 9, 9], fees: [0, 6, 7, 9], initialFee: 7,
  unit: 'cr', labels: { installed: 'Installed', horizon: 'Horizon', fee: 'Fee per change', periodsTemplate: '{count} periods', tableCaption: 'All plans', trace: 'Installed and choices', gross: 'Gross', changes: 'Changes', totalCost: 'Cost', net: 'Net', best: 'Best', axis: 'Common axis', zero: 'Zero', bestTemplate: 'Best plans: {plans}; net {net}' },
};
const html = (p = {}) => renderToStaticMarkup(createElement(SwitchingPlanLedger, { ...props, ...p }));
describe('SwitchingPlanLedger finite continuation accounting', () => {
  test('counts initial and return transitions, rather than distinct platform names', () => {
    expect(switchingPlans([6,6], [9,9], 'A', 2, 7).map(r => [r.plan.join(''), r.changes, r.net])).toEqual([['AA',0,12],['AB',1,8],['BA',2,1],['BB',1,11]]);
    expect(switchingPlans([6,6], [9,9], 'B', 2, 7).map(r => r.net)).toEqual([5,1,8,18]);
  });
  test('enumerates every three-period path including repeated returns', () => {
    const rows = switchingPlans([6,6,6], [9,9,9], 'A', 3, 7);
    expect(rows.map(r => r.plan.join(''))).toEqual(['AAA','AAB','ABA','ABB','BAA','BAB','BBA','BBB']);
    expect(rows.map(r => r.net)).toEqual([18,14,7,17,7,3,10,20]);
    expect(rows.find(r => r.plan.join('') === 'BAB')?.changes).toBe(3);
  });
  test('changes the payoff path without multiplying the first-period gap', () => {
    expect(switchingPlans([6,6,6], [9,9,3], 'A', 3, 7).map(r => r.net)).toEqual([18,8,7,11,7,-3,10,14]);
  });
  test('marks both highest exact ties and has one visible net per plan', () => {
    const s=html({initialFee:6});
    expect((s.match(/>Best<\/span>/g) ?? []).length).toBe(2);
    expect(s).toContain('Best plans: A → A; B → B');
    expect((s.match(/<tbody>/g) ?? []).length).toBe(1);
    expect((s.match(/<td class="min-w-40/g) ?? []).length).toBe(4);
    expect((s.match(/aria-live="polite"/g) ?? []).length).toBe(1);
    expect(s).toContain('sr-only');
  });
  test('keeps a fixed signed axis through the controls', () => {
    const a=html(), b=html({initialInstalled:'B',initialHorizon:3,initialFee:9});
    expect(a).toContain('-6 cr — Zero: 0 cr — 27 cr');
    expect(b).toContain('-6 cr — Zero: 0 cr — 27 cr');
    expect(html({benefitsB:[9,9,3],initialHorizon:3})).toContain('>-3</span>');
    expect(a).toContain('left:18.181818181818183%');
  });
  test('keeps bar coordinates finite for valid very large benefits and a zero-only axis', () => {
    const large = html({benefitsA:[3e307,3e307],benefitsB:[4e307,4e307],fees:[0],initialFee:0});
    const coordinates = [...large.matchAll(/(?:left|width):([^;%]+)%/g)].map(m => Number(m[1]));
    expect(coordinates.length).toBeGreaterThan(0);
    expect(coordinates.every(x => Number.isFinite(x) && x >= 0 && x <= 100)).toBe(true);
    const zero = html({benefitsA:[0,0],benefitsB:[0,0],fees:[0],initialFee:0});
    expect(zero).toContain('left:50%;width:0%');
  });
  test('is deterministic, localized by props and natively keyboard operable', () => {
    const es={...props.labels,installed:'Instalada',horizon:'Horizonte',fee:'Coste',periodsTemplate:'{count} periodos',tableCaption:'Planes completos',bestTemplate:'Mejores planes: {plans}; neto {net}',best:'Mejor',zero:'Cero'};
    const a=html({locale:'es',labels:es});
    expect(a).toBe(html({locale:'es',labels:es}));
    expect(a).toContain('2 periodos');expect(a).toContain('Mejores planes: A → A');
    expect((a.match(/<select/g) ?? []).length).toBe(3);
    expect(a).toContain('role="region" tabindex="0"');
    expect(a).toContain('not-prose');expect(a).toContain('scope="row"');
    expect(html({fees:[0,6.5,7],initialFee:6.5,locale:'es'})).toContain('6,5 cr');
    expect(html({fees:[0,6.5,7],initialFee:6.5})).toContain('6.5 cr');
  });
  test('fails on mis-authored data and does not round a genuine loss to zero', () => {
    for(const p of [{benefitsA:[6]}, {benefitsB:[9,NaN,9]}, {fees:[7,6]}, {initialFee:2}, {initialHorizon:4}, {initialInstalled:'C'}, {labels:{...props.labels,bestTemplate:'missing token'}}, {platformB:'A'}]) expect(() => html(p)).toThrow();
    expect(() => switchingPlans([6,6],[9,9],'A',3,7)).toThrow();
    expect(() => switchingPlans([Number.MAX_VALUE,Number.MAX_VALUE],[9,9],'A',2,7)).toThrow();
    const negative = switchingPlans([0,0],[0,0],'A',2,0.000001).find(r => r.plan.join('')==='AB');
    expect(negative?.net).toBe(-0.000001);
    expect(html({benefitsA:[0,0],benefitsB:[0,0],fees:[0,0.000001],initialFee:0.000001})).toContain('-0.000001');
  });
});
