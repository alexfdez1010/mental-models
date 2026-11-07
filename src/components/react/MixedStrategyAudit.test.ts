import { describe, expect, test } from 'bun:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MixedStrategyAudit, auditMixedStrategy, mixedAuditFraction, MIXED_AUDIT_PERCENTAGES, type MixedStrategyAuditProps, type MixedAuditMatrix } from '@/components/react/MixedStrategyAudit';

const props: MixedStrategyAuditProps = {
  title: 'Independent mixtures', rowPlayer: 'Row', colPlayer: 'Column',
  rowStrategies: ['H', 'T'], colStrategies: ['H', 'T'], rowPayoffs: [[1,-1],[-1,1]],
};
const render = (overrides: Partial<MixedStrategyAuditProps> = {}) => renderToStaticMarkup(createElement(MixedStrategyAudit, { ...props, ...overrides }));

describe('exact independent mixed-strategy audit', () => {
  test('biased profile has two different profitable deviation gains', () => {
    const result = auditMixedStrategy(props.rowPayoffs, 25, 75);
    expect(result.jointNumerators).toEqual([1875,625,5625,1875]);
    expect(result.rowContributionNumerators).toEqual([1875,-625,-5625,1875]);
    expect([result.rowMeanNumerator,result.columnMeanNumerator]).toEqual([-2500,2500]);
    expect(result.rowPureNumerators).toEqual([5000,-5000]);
    expect(result.columnPureNumerators).toEqual([5000,-5000]);
    expect([result.rowGainNumerator,result.columnGainNumerator]).toEqual([7500,2500]);
  });
  test('both mixtures and the nonuniform transfer are checked exactly', () => {
    const main = auditMixedStrategy(props.rowPayoffs,50,50);
    expect(main.bestRowIndices).toEqual([0,1]);
    expect(main.bestColumnIndices).toEqual([0,1]);
    expect([main.rowGainNumerator,main.columnGainNumerator]).toEqual([0,0]);
    const transfer: MixedAuditMatrix = [[2,-1],[-1,1]];
    const mixed = auditMixedStrategy(transfer,40,40);
    expect(mixed.jointNumerators).toEqual([1600,2400,2400,3600]);
    expect([mixed.rowMeanNumerator,mixed.columnMeanNumerator]).toEqual([2000,-2000]);
    expect([mixed.rowGainNumerator,mixed.columnGainNumerator]).toEqual([0,0]);
    const half = auditMixedStrategy(transfer,50,50);
    expect([half.rowMeanNumerator,half.columnMeanNumerator,half.rowGainNumerator,half.columnGainNumerator]).toEqual([2500,-2500,2500,2500]);
  });
  test('all 72 profiles agree with an independent enumeration of equal seed tickets', () => {
    let states = 0;
    for (const matrix of [props.rowPayoffs, [[2,-1],[-1,1]] as MixedAuditMatrix]) {
      for (const p of MIXED_AUDIT_PERCENTAGES) for (const q of MIXED_AUDIT_PERCENTAGES) {
        const result = auditMixedStrategy(matrix,p,q);
        // Independent 100×100 equally weighted tickets, no product-probability formula.
        const counts = [0,0,0,0];
        let sum = 0;
        const rowPure = [0,0];
        const colPure = [0,0];
        for (let rowTicket=0; rowTicket<100; rowTicket++) for (let colTicket=0; colTicket<100; colTicket++) {
          const r = rowTicket < p ? 0 : 1;
          const c = colTicket < q ? 0 : 1;
          counts[2*r+c]!++;
          sum += matrix[r]![c]!;
          for (let action=0; action<2; action++) {
            rowPure[action]! += matrix[action]![c]!;
            colPure[action]! -= matrix[r]![action]!;
          }
        }
        expect(result.jointNumerators).toEqual(counts);
        expect(result.rowMeanNumerator).toBe(sum);
        expect(result.columnMeanNumerator).toBe(sum === 0 ? 0 : -sum);
        expect(result.rowPureNumerators).toEqual(rowPure);
        expect(result.columnPureNumerators).toEqual(colPure);
        expect(result.rowGainNumerator).toBe(Math.max(...rowPure)-sum);
        expect(result.columnGainNumerator).toBe(Math.max(...colPure)+sum);
        expect(result.rowGainNumerator).toBeGreaterThanOrEqual(0);
        expect(result.columnGainNumerator).toBeGreaterThanOrEqual(0);
        states++;
      }
    }
    expect(states).toBe(72);
  });
  test('zero mass, negative values and exact fractions are retained', () => {
    expect(auditMixedStrategy(props.rowPayoffs,0,100).jointNumerators).toEqual([0,0,10000,0]);
    expect(mixedAuditFraction(-2500)).toBe('-1/4');
    expect(mixedAuditFraction(2000)).toBe('1/5');
    expect(mixedAuditFraction(0)).toBe('0');
    expect(mixedAuditFraction(10000)).toBe('1');
    expect(() => mixedAuditFraction(1,0)).toThrow('MixedStrategyAudit');
  });
  test('both signs of the maximum bound keep every result an exact safe integer', () => {
    const bounded: MixedAuditMatrix = [[1000,-1000],[-1000,1000]];
    for (const p of MIXED_AUDIT_PERCENTAGES) for (const q of MIXED_AUDIT_PERCENTAGES) {
      const result = auditMixedStrategy(bounded,p,q);
      expect(Object.values(result).flat().filter((value) => typeof value==='number').every(Number.isSafeInteger)).toBe(true);
    }
  });
});

describe('author validation before rendering', () => {
  test('rejects wrong dimensions, holes, nonintegers, nonfinite values and excessive magnitude', () => {
    const matrices: unknown[] = [null, [], [[1,2]], [[1,2],[3]], [[1,2],[3,4,5]], [Array(2),[1,2]], Object.assign(Array(2),{0:[1,2]}), [[1,2],[3,NaN]], [[1,2],[3,Infinity]], [[1,2],[3,.5]], [[1,2],[3,1001]], [[1,2],[3,-1001]], [[1,2],{0:3,1:4,length:2}]];
    for (const matrix of matrices) expect(() => render({rowPayoffs:matrix as MixedAuditMatrix})).toThrow('MixedStrategyAudit');
  });
  test('rejects invalid probabilities, locales and labels including inherited keys', () => {
    for (const initialRowPercent of [NaN,Infinity,-1,101,39,.5,'25']) expect(() => render({initialRowPercent:initialRowPercent as never})).toThrow('MixedStrategyAudit');
    expect(() => render({initialColumnPercent:41 as never})).toThrow('MixedStrategyAudit');
    expect(() => render({locale:'fr' as never})).toThrow('MixedStrategyAudit');
    expect(() => render({rowStrategies:Array(2) as [string,string]})).toThrow('MixedStrategyAudit');
    expect(() => render({colStrategies:['H','H']})).toThrow('MixedStrategyAudit');
    expect(() => render({title:' '})).toThrow('MixedStrategyAudit');
    expect(() => render({labels:{toString:'bad'} as never})).toThrow('MixedStrategyAudit');
    expect(() => render({labels:Object.create({gain:'Inherited'})})).toThrow('MixedStrategyAudit');
    expect(() => render({labels:{gain:''}})).toThrow('MixedStrategyAudit');
    expect(() => render({labels:{[Symbol('gain')]:'bad'} as never})).toThrow('MixedStrategyAudit');
    expect(() => render({labels:{gain:undefined}})).toThrow('MixedStrategyAudit');
    expect(render({labels:Object.assign(Object.create(null),{gain:'Custom gain'})})).toContain('Custom gain');
  });
});

describe('semantic SSR and locale', () => {
  test('initial output exposes exact data, cells, native controls and one live result', () => {
    const html = render();
    expect(html).toContain('(-1, 1)');
    expect(html).toContain('3/16');
    expect(html).toContain('3/4');
    expect(html.match(/<select /g)?.length).toBe(2);
    expect(html.match(/role="region"/g)?.length).toBe(2);
    expect(html.match(/tabindex="0"/g)?.length).toBe(2);
    expect(html.match(/aria-live="polite"/g)?.length).toBe(1);
    expect(html.match(/display:table;overflow:visible/g)?.length).toBe(2);
    expect(html).toContain('not-prose');
    expect(html).toContain('motion-reduce:transition-none');
    expect(html).not.toContain('NaN');
  });
  test('Spanish formats percentages and every default is Spanish', () => {
    const html = render({locale:'es',rowPlayer:'Filas',colPlayer:'Columnas',rowStrategies:['Cara','Cruz'],colStrategies:['Cara','Cruz'],title:'Mezclas independientes'});
    expect(html).toContain('18,75');
    expect(html).toContain('Contribución a la utilidad de filas');
    expect(html).toContain('Mejora por desvío unilateral');
    expect(html).toContain('no supera la prueba de Nash');
    for (const english of ['Joint probabilities','Current expected','Player','Tie','Both gains','Probability','Cell utilities']) expect(html).not.toContain(english);
  });
  test('all 72 authored configurations render exact outcomes and both equilibrium verdicts in both locales', () => {
    for (const locale of ['en','es'] as const) for (const rowPayoffs of [props.rowPayoffs, [[2,-1],[-1,1]] as MixedAuditMatrix]) {
      let equilibria = 0;
      for (const initialRowPercent of MIXED_AUDIT_PERCENTAGES) for (const initialColumnPercent of MIXED_AUDIT_PERCENTAGES) {
        const html = render({locale,rowPayoffs,initialRowPercent,initialColumnPercent});
        expect(html).not.toMatch(/NaN|Infinity|undefined/);
        expect(html.match(/aria-live="polite"/g)?.length).toBe(1);
        if (html.includes(locale==='en'?'Both gains are zero':'Ambas mejoras son cero')) equilibria++;
      }
      expect(equilibria).toBe(1);
    }
  });
});
