import { describe, expect, test } from 'bun:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ReferenceChoiceAudit, getReferenceChoiceResult } from '@/components/react/ReferenceChoiceAudit';
const cases = [{ label: 'First menu', safe: 100, low: 80, high: 130 }, { label: 'Transfer', safe: 100, low: 92, high: 116 }];
describe('a shared-reference linear choice audit', () => {
  test('scores the certain alternative after moving the reference, with exact ties', () => {
    const a = getReferenceChoiceResult(cases[0]!, 100, 8), b = getReferenceChoiceResult(cases[0]!, 90, 8);
    expect([a.safeScoreEighths,a.riskyScoreEighths,a.differenceEighths]).toEqual([0,-40,-40]);
    expect([b.safeScoreEighths,b.riskyScoreEighths,b.differenceEighths]).toEqual([80,80,0]);
    expect(getReferenceChoiceResult(cases[0]!,100,6).differenceEighths).toBe(0);
    expect(getReferenceChoiceResult(cases[1]!,100,8).differenceEighths).toBe(0);
    expect(getReferenceChoiceResult(cases[1]!,100,6).differenceEighths).toBe(16);
  });
  test('all forty states retain integer arithmetic and values inside the fixed chart bounds', () => {
    for(const item of cases) for(const r of [80,90,100,130]) for(const l of [4,6,8,9,12]) {
      const result = getReferenceChoiceResult(item,r,l);
      expect(Number.isSafeInteger(result.differenceEighths)).toBe(true);
      expect(result.rows.every(row=>row.change>=-50&&row.change<=50&&row.scoreQuarters>=-600&&row.scoreQuarters<=200)).toBe(true);
      expect(result.riskyScoreEighths).toBe(result.rows[1]!.contributionEighths+result.rows[2]!.contributionEighths);
    }
  });
  test('rejects bad hidden cases, unknown/inherited labels and values outside the menu', () => {
    expect(()=>getReferenceChoiceResult(cases[0]!,99,8)).toThrow('ReferenceChoiceAudit:');
    expect(()=>getReferenceChoiceResult(cases[0]!,100,7)).toThrow('ReferenceChoiceAudit:');
    expect(()=>renderToStaticMarkup(createElement(ReferenceChoiceAudit,{title:'Audit',cases:[cases[0]!,{...cases[1]!,low:NaN}]}))).toThrow('ReferenceChoiceAudit:');
    expect(()=>renderToStaticMarkup(createElement(ReferenceChoiceAudit,{title:'Audit',cases:Array(1)}))).toThrow('ReferenceChoiceAudit:');
    expect(()=>renderToStaticMarkup(createElement(ReferenceChoiceAudit,{title:'Audit',cases,labels:{toString:'Inherited'} as never}))).toThrow('label');
  });
  test('renders the certain score, separate units and Spanish hidden tie state', () => {
    const html=renderToStaticMarkup(createElement(ReferenceChoiceAudit,{title:'Auditoría',cases,locale:'es',initialReference:90,initialLambdaQuarter:8}));
    expect(html).toContain('alternativas empatan');
    expect(html).toContain('Créditos finales');
    expect(html).toContain('Puntuación ponderada');
    expect(html).not.toContain('Certain score');
    expect(html.match(/role="status"/g)?.length).toBe(1);
    expect(html.match(/<select/g)?.length).toBe(3);
  });
});
