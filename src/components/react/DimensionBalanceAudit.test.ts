import { describe, expect, test } from 'bun:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { DimensionBalanceAudit, getDimensionBalance, type DimensionCase, type DimensionBalanceAuditProps } from '@/components/react/DimensionBalanceAudit';

const motion: DimensionCase = {
  id: 'motion', label: 'Length from speed and time', target: [0, 1, 0],
  quantities: [{ id: 'v', symbol: 'v', dimension: [0, 1, -1] }, { id: 't', symbol: 't', dimension: [0, 0, 1] }],
  candidates: [
    { id: 'vt', label: 'vt', powersTwice: [2, 2] },
    { id: 'wrong', label: 'vt²', powersTwice: [2, 4] },
    { id: 'coefficient', label: '2vt', powersTwice: [2, 2] },
  ],
};

const props: DimensionBalanceAuditProps = {
  title: 'Audit a monomial', instructions: 'Compare its dimension with length.', cases: [motion],
  labels: {
    case: 'Case', candidate: 'Candidate', quantity: 'Quantity', dimension: 'Dimension (M; L; T)', power: 'Power',
    mass: 'Mass contribution', length: 'Length contribution', time: 'Time contribution', sum: 'Sum', target: 'Target',
    compatible: 'Dimensions match', incompatible: 'Dimensions differ', table: 'Exponent calculation',
    legendSum: 'Filled marker: sum', legendTarget: 'Ring: target', chart: 'Exponent positions',
    status: '{candidate}: {sum}; target {target}. {verdict}',
  },
};

describe('DimensionBalanceAudit declared arithmetic', () => {
  test('units filter a wrong power, while leaving a coefficient undetermined', () => {
    expect(getDimensionBalance(motion, 0)).toEqual({ contributionsTwice: [[0, 2, -2], [0, 0, 2]], sumTwice: [0, 2, 0], targetTwice: [0, 2, 0], compatible: true });
    expect(getDimensionBalance(motion, 1).sumTwice).toEqual([0, 2, 2]);
    expect(getDimensionBalance(motion, 1).compatible).toBe(false);
    expect(getDimensionBalance(motion, 2).compatible).toBe(true);
  });

  test('the period example cancels half-integer length powers exactly', () => {
    const period: DimensionCase = {
      id: 'period', label: 'Period', target: [0, 0, 1],
      quantities: [{ id: 'l', symbol: 'ℓ', dimension: [0, 1, 0] }, { id: 'g', symbol: 'g', dimension: [0, 1, -2] }],
      candidates: [{ id: 'root', label: 'C√(ℓ/g)', powersTwice: [1, -1] }, { id: 'ratio', label: 'Cℓ/g', powersTwice: [2, -2] }],
    };
    expect(getDimensionBalance(period, 0).contributionsTwice).toEqual([[0, 1, 0], [-0, -1, 2]]);
    expect(getDimensionBalance(period, 0).sumTwice).toEqual([0, 0, 2]);
    expect(getDimensionBalance(period, 0).compatible).toBe(true);
    expect(getDimensionBalance(period, 1).sumTwice).toEqual([0, 0, 4]);
    expect(getDimensionBalance(period, 1).compatible).toBe(false);
  });

  test('both independent fluid groups balance without asserting a physical law', () => {
    const fluid: DimensionCase = {
      id: 'fluid', label: 'Fluid groups', target: [0, 0, 0],
      quantities: [
        { id: 'f', symbol: 'F', dimension: [1, 1, -2] }, { id: 'rho', symbol: 'ρ', dimension: [1, -3, 0] },
        { id: 'v', symbol: 'v', dimension: [0, 1, -1] }, { id: 'd', symbol: 'd', dimension: [0, 1, 0] },
        { id: 'mu', symbol: 'μ', dimension: [1, -1, -1] },
      ],
      candidates: [{ id: 'force', label: 'F/(ρv²d²)', powersTwice: [2, -2, -4, -4, 0] }, { id: 're', label: 'ρvd/μ', powersTwice: [0, 2, 2, 2, -2] }],
    };
    for (const index of [0, 1]) expect(getDimensionBalance(fluid, index).sumTwice).toEqual([0, 0, 0]);
  });

  test('the bounded worst case is finite and the graph uses the whole catalogue', () => {
    const large: DimensionCase = { id: 'bound', label: 'Bound', target: [4, 4, 4], quantities: Array.from({ length: 6 }, (_, i) => ({ id: String(i), symbol: String(i), dimension: [4, 4, 4] as const })), candidates: [{ id: 'max', label: 'Maximum allowed exponents', powersTwice: [8, 8, 8, 8, 8, 8] }] };
    expect(getDimensionBalance(large, 0).sumTwice).toEqual([192, 192, 192]);
    const html = renderToStaticMarkup(createElement(DimensionBalanceAudit, { ...props, cases: [motion, large] }));
    expect(html).toContain('data-exponent-limit="96"');
  });

  test('invalid hidden cases, holes, duplicate names and malformed powers fail before rendering', () => {
    const invalid: DimensionCase[] = [
      { ...motion, id: 'hidden', label: 'Hidden', target: [0, NaN, 0] },
      { ...motion, id: 'hidden', label: 'Hidden', quantities: new Array(2) },
      { ...motion, id: 'hidden', label: 'Hidden', candidates: [{ id: 'x', label: 'x', powersTwice: [1] }] },
      { ...motion, id: 'hidden', label: 'Hidden', candidates: [{ id: 'x', label: 'x', powersTwice: [9, 0] }] },
      { ...motion, id: 'hidden', label: 'Hidden', candidates: [{ id: 'x', label: 'x', powersTwice: [1.5, 0] }] },
      { ...motion, id: 'hidden', label: 'Hidden', candidates: [{ id: 'x', label: 'x', powersTwice: new Array(2) }] },
      { ...motion, id: 'hidden', label: motion.label },
    ];
    for (const item of invalid) expect(() => renderToStaticMarkup(createElement(DimensionBalanceAudit, { ...props, cases: [motion, item] }))).toThrow('DimensionBalanceAudit');
    expect(() => getDimensionBalance(motion, -1)).toThrow();
    expect(() => getDimensionBalance(motion, 0.5)).toThrow();
    expect(() => getDimensionBalance(motion, 3)).toThrow();
  });

  test('number locale and single-pass label interpolation preserve the declared text', () => {
    const halfCase: DimensionCase = { id: 'half', label: 'Half', target: [0, 1, 0], quantities: [{ id: 'l', symbol: 'ℓ', dimension: [0, 1, 0] }], candidates: [{ id: 'root', label: '√ℓ', powersTwice: [1] }] };
    const html = renderToStaticMarkup(createElement(DimensionBalanceAudit, { ...props, locale: 'es', cases: [halfCase], labels: { ...props.labels, incompatible: 'Conservar {candidate}' } }));
    expect(html).toContain('(0; 0,5; 0)');
    expect(html).toContain('Conservar {candidate}');
    expect(html).not.toContain('Conservar √ℓ');
  });
});
