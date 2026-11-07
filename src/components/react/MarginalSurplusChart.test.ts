import { describe, expect, test } from 'bun:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MarginalSurplusChart, auditMarginalSurplusChart, type MarginalSurplusChartProps } from '@/components/react/MarginalSurplusChart';

function fixture(): MarginalSurplusChartProps {
  return {
    title: 'Finite quantities', instructions: 'Compare all feasible integer quantities.', locale: 'en', unit: 'cr',
    marginalBenefits: [100, 90, 80, 70, 60, 50], marginalPrivateCosts: [20, 30, 40, 50, 60, 70],
    scenarios: [{ id: 'forty', label: 'Damage forty', externalPerUnit: 40 }, { id: 'twenty', label: 'Damage twenty', externalPerUnit: 20 }], initialQuantity: 5,
    labels: {
      scenario: 'Damage scenario', quantity: 'Quantity', marginalTitle: 'Marginal amounts', cumulativeTitle: 'Cumulative accounts', marginalUnit: 'Credits for the additional unit', quantityUnit: 'Integer quantities; vertical amounts in credits', benefit: 'Marginal benefit', privateCost: 'Marginal private cost', socialCost: 'Marginal social cost', totalBenefit: 'Total benefit', totalResources: 'Resources', totalHarm: 'Harm', privateCombined: 'Private combined surplus', socialNet: 'Complete surplus', loss: 'Avoidable loss', privateMaximizers: 'Private maxima', socialMaximizers: 'Complete maxima', fixedScale: 'Scales are fixed across all scenarios.', tableCaption: 'Complete exact catalogue in credits', notApplicable: 'Not applicable', resultTemplate: 'Quantity {quantity}: private {private}; complete {social}; loss {loss}. Private maxima {privateMaxima}; complete maxima {socialMaxima}.',
    },
  };
}

describe('MarginalSurplusChart', () => {
  test('keeps all private and complete ties, including the zero marginal units', () => {
    const audit = auditMarginalSurplusChart(fixture());
    expect(audit.benefits).toEqual([0, 100, 190, 270, 340, 400, 450]);
    expect(audit.resources).toEqual([0, 20, 50, 90, 140, 200, 270]);
    expect(audit.privateCombined).toEqual([0, 80, 140, 180, 200, 200, 180]);
    expect(audit.privateMaxima).toEqual([4, 5]);
    expect(audit.cases[0]!.socialNet).toEqual([0, 40, 60, 60, 40, 0, -60]);
    expect(audit.cases[0]!.socialMaxima).toEqual([2, 3]);
    expect(audit.cases[0]!.loss).toEqual([60, 20, 0, 0, 20, 60, 120]);
    expect(audit.cases[1]!.socialNet).toEqual([0, 60, 100, 120, 120, 100, 60]);
    expect(audit.cases[1]!.socialMaxima).toEqual([3, 4]);
    expect(audit.cases[1]!.loss[4]).toBe(0);
    expect([audit.marginalScale, audit.cumulativeMin, audit.cumulativeMax]).toEqual([110, -60, 200]);
  });

  test('transfer has a unique optimum and a five-credit gap rather than forty-five', () => {
    const p = fixture();
    p.marginalBenefits = [90, 70, 50, 30]; p.marginalPrivateCosts = [10, 30, 40, 60];
    p.scenarios = [{ id: 'transfer', label: 'Transfer damage', externalPerUnit: 15 }]; p.initialQuantity = 3;
    const a = auditMarginalSurplusChart(p);
    expect(a.privateMaxima).toEqual([3]);
    expect(a.cases[0]!.socialNet).toEqual([0, 65, 90, 85, 40]);
    expect(a.cases[0]!.socialMaxima).toEqual([2]);
    expect([a.cases[0]!.loss[3], a.cases[0]!.harm[3]]).toEqual([5, 45]);
  });

  test('enumerates nonmonotone prefixes instead of applying a local stopping rule', () => {
    // An independent double loop compares every prefix to every other prefix.
    for (let seed = 0; seed < 32; seed++) {
      const p = fixture();
      p.marginalBenefits = [seed % 7, (seed * 3) % 11, (seed * 5) % 13];
      p.marginalPrivateCosts = [(seed * 7) % 9, (seed * 2) % 8, seed % 5];
      p.scenarios = [0, 3, 10].map((value, i) => ({ id: `case-${i}`, label: `Case ${i}`, externalPerUnit: value })); p.initialQuantity = 0;
      const a = auditMarginalSurplusChart(p);
      for (let si = 0; si < p.scenarios.length; si++) {
        const scores: number[] = [];
        for (let q = 0; q <= 3; q++) {
          let total = 0;
          for (let i = 0; i < q; i++) total += p.marginalBenefits[i]! - p.marginalPrivateCosts[i]! - p.scenarios[si]!.externalPerUnit;
          scores.push(total);
        }
        const winners: number[] = [];
        for (let q = 0; q <= 3; q++) if (scores.every(other => scores[q]! >= other)) winners.push(q);
        expect(a.cases[si]!.socialNet).toEqual(scores);
        expect(a.cases[si]!.socialMaxima).toEqual(winners);
        for (let q = 0; q <= 3; q++) expect(a.cases[si]!.loss[q]).toBe(Math.max(...scores.map(other => other - scores[q]!)));
      }
    }
  });

  test('all-zero catalogue includes every quantity and has a nonzero display range', () => {
    const p = fixture(); p.marginalBenefits = Array(8).fill(0); p.marginalPrivateCosts = Array(8).fill(0); p.scenarios = [{ id: 'zero', label: 'Zero', externalPerUnit: -0 }]; p.initialQuantity = 8;
    const a = auditMarginalSurplusChart(p);
    expect(a.privateMaxima).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
    expect(a.cases[0]!.socialMaxima).toEqual(a.privateMaxima);
    expect(a.cases[0]!.harm.every(value => !Object.is(value, -0))).toBe(true);
    expect([a.marginalScale, a.cumulativeMin, a.cumulativeMax]).toEqual([1, 0, 1]);
    const html = renderToStaticMarkup(createElement(MarginalSurplusChart, p));
    expect(html).not.toContain('NaN'); expect(html).not.toContain('Infinity'); expect(html).not.toContain('-0 cr');
    expect((html.match(/data-social-maximum=/g) ?? []).length).toBe(9);
  });

  test('safe bounds cover the lowest full account and complete ties with positive benefit', () => {
    const p = fixture(); p.marginalBenefits = Array(8).fill(0); p.marginalPrivateCosts = Array(8).fill(1000); p.scenarios = [{ id: 'max', label: 'Maximum harm', externalPerUnit: 1000 }]; p.initialQuantity = 8;
    let a = auditMarginalSurplusChart(p);
    expect(a.cases[0]!.socialNet[8]).toBe(-16000); expect(a.cases[0]!.loss[8]).toBe(16000); expect(a.cases[0]!.socialMaxima).toEqual([0]); expect(a.marginalScale).toBe(2000);
    p.marginalBenefits = Array(8).fill(1000); p.marginalPrivateCosts = Array(8).fill(0); a = auditMarginalSurplusChart(p);
    expect(a.privateCombined[8]).toBe(8000); expect(a.privateMaxima).toEqual([8]); expect(a.cases[0]!.socialMaxima).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
  });

  test('SSR names controls and scroll regions and exposes one complete live result', () => {
    const p = fixture(); const html = renderToStaticMarkup(createElement(MarginalSurplusChart, p));
    expect((html.match(/<select /g) ?? []).length).toBe(2);
    expect((html.match(/role="region"/g) ?? []).length).toBe(3);
    expect((html.match(/tabindex="0"/g) ?? []).length).toBe(3);
    expect((html.match(/role="status"/g) ?? []).length).toBe(1);
    expect((html.match(/aria-live="polite"/g) ?? []).length).toBe(1);
    expect((html.match(/<svg /g) ?? []).length).toBe(2);
    expect((html.match(/data-surplus-row=/g) ?? []).length).toBe(7);
    expect(html).toContain('Quantity 5: private 200 cr; complete 0 cr; loss 60 cr. Private maxima 4 and 5; complete maxima 2 and 3.');
    expect(html).toContain('data-cumulative-min="-60" data-cumulative-max="200"');
    expect((html.match(/data-private-maximum=/g) ?? []).length).toBe(2);
    expect((html.match(/data-social-maximum=/g) ?? []).length).toBe(2);
    expect(html).toContain('data-surplus-column="8">120 cr</td>');
  });

  test('locale controls exact amounts and conjunctions, with no unit duplication', () => {
    const p = fixture(); p.locale = 'es';
    p.labels.resultTemplate = 'Cantidad {quantity}: privada {private}; completa {social}; pérdida {loss}. Máximos privados {privateMaxima}; completos {socialMaxima}.';
    const html = renderToStaticMarkup(createElement(MarginalSurplusChart, p));
    expect(html).toContain('Cantidad 5: privada 200 cr; completa 0 cr; pérdida 60 cr. Máximos privados 4 y 5; completos 2 y 3.');
    expect(html).not.toContain('cr cr');
    p.marginalBenefits = Array(8).fill(0); p.marginalPrivateCosts = Array(8).fill(1000); p.scenarios = [{ id: 'max', label: 'Daño máximo', externalPerUnit: 1000 }]; p.initialQuantity = 8;
    expect(renderToStaticMarkup(createElement(MarginalSurplusChart, p))).toContain('-16.000 cr');
    p.locale = 'en'; expect(renderToStaticMarkup(createElement(MarginalSurplusChart, p))).toContain('-16,000 cr');
  });

  test('all invalid inputs, including hidden scenarios, reject before the first hook', () => {
    const invalid: Array<(p: MarginalSurplusChartProps) => void> = [
      p => { p.marginalBenefits = [1]; }, p => { p.marginalBenefits = Array(9).fill(1); }, p => { p.marginalBenefits = [1, 2]; },
      p => { delete p.marginalBenefits[2]; }, p => { p.marginalBenefits[0] = 0.5; }, p => { p.marginalBenefits[0] = -1; }, p => { p.marginalBenefits[0] = 1001; }, p => { p.marginalPrivateCosts[0] = NaN; },
      p => { p.scenarios = []; }, p => { p.scenarios = Array(4).fill(p.scenarios[0]!); }, p => { delete p.scenarios[1]; },
      p => { p.scenarios[1]!.externalPerUnit = 1.5; }, p => { p.scenarios[1]!.externalPerUnit = -1; }, p => { p.scenarios[1]!.externalPerUnit = 1001; },
      p => { p.scenarios[1]!.id = p.scenarios[0]!.id; }, p => { p.scenarios[1]!.label = p.scenarios[0]!.label; },
      p => { p.scenarios[1] = Object.create(p.scenarios[1]); }, p => { p.labels = Object.create(p.labels); },
      p => { p.title = ' '; }, p => { p.unit = ' cr'; }, p => { p.labels.quantity = 'Quantity '; },
      p => { p.initialQuantity = -1; }, p => { p.initialQuantity = 7; }, p => { p.initialQuantity = 1.5; },
      p => { p.labels.resultTemplate = p.labels.resultTemplate.replace('{loss}', 'loss'); }, p => { p.labels.resultTemplate += ' {loss}'; }, p => { p.labels.resultTemplate += ' {mystery}'; },
      p => { Object.assign(p, { locale: 'fr' }); },
    ];
    for (const change of invalid) { const p = fixture(); change(p); expect(() => MarginalSurplusChart(p)).toThrow('MarginalSurplusChart:'); }
  });
});

function benefitFixture(): MarginalSurplusChartProps {
  const cost = fixture() as Extract<MarginalSurplusChartProps, { externalEffect?: 'cost' }>;
  const { socialCost: _socialCost, totalHarm: _totalHarm, ...common } = cost.labels;
  return { ...cost, externalEffect: 'benefit',
    marginalBenefits: [90, 80, 70, 50, 40], marginalPrivateCosts: [40, 50, 60, 70, 80], initialQuantity: 3,
    scenarios: [{ id: 'thirty', label: 'Benefit thirty', externalPerUnit: 30 }, { id: 'twenty', label: 'Benefit twenty', externalPerUnit: 20 }, { id: 'fifty', label: 'Benefit fifty', externalPerUnit: 50 }],
    labels: { ...common, socialBenefit: 'Marginal social benefit', totalExternalBenefit: 'Outside benefit' },
  };
}

describe('MarginalSurplusChart explicit benefit mode', () => {
  test('adds outside benefit without relabelling it as harm, retaining global ties and capacity', () => {
    const a = auditMarginalSurplusChart(benefitFixture());
    expect(a.benefits).toEqual([0, 90, 170, 240, 290, 330]);
    expect(a.resources).toEqual([0, 40, 90, 150, 220, 300]);
    expect(a.privateCombined).toEqual([0, 50, 80, 90, 70, 30]);
    expect(a.privateMaxima).toEqual([3]);
    expect(a.cases[0]!.externalBenefit).toEqual([0, 30, 60, 90, 120, 150]);
    expect(a.cases[0]!.harm).toEqual([0, 0, 0, 0, 0, 0]);
    expect(a.cases[0]!.socialNet).toEqual([0, 80, 140, 180, 190, 180]);
    expect(a.cases[0]!.socialMaxima).toEqual([4]);
    expect(a.cases[0]!.loss[3]).toBe(10);
    expect(a.cases[1]!.socialNet).toEqual([0, 70, 120, 150, 150, 130]);
    expect(a.cases[1]!.socialMaxima).toEqual([3, 4]);
    expect(a.cases[1]!.loss[3]).toBe(0);
    expect(a.cases[2]!.socialMaxima).toEqual([5]);
    expect(a.cases[2]!.loss[3]).toBe(40);
    expect([a.marginalScale, a.cumulativeMin, a.cumulativeMax]).toEqual([140, 0, 280]);
    const p = benefitFixture(); p.scenarios = [{ id: 'forty', label: 'Benefit forty', externalPerUnit: 40 }];
    expect(auditMarginalSurplusChart(p).cases[0]!.socialMaxima).toEqual([4, 5]);
  });

  test('transfer enumerates the full feasible catalogue and a fifteen-credit gap', () => {
    const p = benefitFixture(); p.marginalBenefits = [100, 70, 45, 20]; p.marginalPrivateCosts = [20, 40, 60, 90];
    p.scenarios = [{ id: 'new', label: 'New catalogue', externalPerUnit: 30 }]; p.initialQuantity = 2;
    const a = auditMarginalSurplusChart(p);
    expect(a.privateMaxima).toEqual([2]);
    expect(a.cases[0]!.socialNet).toEqual([0, 110, 170, 185, 145]);
    expect(a.cases[0]!.socialMaxima).toEqual([3]);
    expect(a.cases[0]!.loss[2]).toBe(15);
    expect([a.marginalScale, a.cumulativeMin, a.cumulativeMax]).toEqual([130, 0, 185]);
  });

  test('a separate pairwise oracle checks nonmonotone benefit catalogues', () => {
    for (let seed = 0; seed < 32; seed++) {
      const p = benefitFixture(); p.marginalBenefits = [seed % 7, seed * 3 % 11, seed * 5 % 13];
      p.marginalPrivateCosts = [seed * 7 % 9, seed * 2 % 8, seed % 5]; p.initialQuantity = 0;
      const a = auditMarginalSurplusChart(p);
      for (let si = 0; si < p.scenarios.length; si++) {
        const scores: number[] = [];
        for (let q = 0; q <= 3; q++) { let score = 0; for (let i = 0; i < q; i++) score += p.marginalBenefits[i]! - p.marginalPrivateCosts[i]! + p.scenarios[si]!.externalPerUnit; scores.push(score); }
        const winners = scores.flatMap((score, q) => scores.every(other => score >= other) ? [q] : []);
        expect(a.cases[si]!.socialNet).toEqual(scores); expect(a.cases[si]!.socialMaxima).toEqual(winners);
        for (let q = 0; q <= 3; q++) expect(a.cases[si]!.loss[q]).toBe(Math.max(...scores.map(other => other - scores[q]!)));
      }
    }
  });

  test('bounded integers, negative totals, zero and every maximum remain exact', () => {
    const p = benefitFixture(); p.marginalBenefits = Array(8).fill(1000); p.marginalPrivateCosts = Array(8).fill(0); p.initialQuantity = 8;
    p.scenarios = [{ id: 'max', label: 'Maximum benefit', externalPerUnit: 1000 }];
    let a = auditMarginalSurplusChart(p); expect(a.cases[0]!.socialNet[8]).toBe(16000); expect(a.cases[0]!.loss[0]).toBe(16000); expect(a.marginalScale).toBe(2000);
    p.marginalBenefits = Array(8).fill(0); p.marginalPrivateCosts = Array(8).fill(1000); p.scenarios[0]!.externalPerUnit = 0;
    a = auditMarginalSurplusChart(p); expect(a.cases[0]!.socialNet[8]).toBe(-8000); expect(a.cases[0]!.loss[8]).toBe(8000); expect(a.marginalScale).toBe(1000);
    p.scenarios[0]!.externalPerUnit = 1000; a = auditMarginalSurplusChart(p); expect(a.cases[0]!.socialMaxima).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
    p.marginalPrivateCosts = Array(8).fill(0); p.scenarios[0]!.externalPerUnit = -0; a = auditMarginalSurplusChart(p);
    expect(a.cases[0]!.socialNet.every(v => v === 0 && !Object.is(v, -0))).toBe(true); expect([a.cumulativeMin, a.cumulativeMax]).toEqual([0, 1]);
  });

  test('SSR uses social BENEFIT in the third series and one localized result, without harm labels', () => {
    const p = benefitFixture(); let h = renderToStaticMarkup(createElement(MarginalSurplusChart, p));
    expect(h).toContain('data-marginal-unit="4" data-marginal-series="2" data-amount="80"');
    expect(h).toContain('Quantity 3: private 90 cr; complete 180 cr; loss 10 cr. Private maxima 3; complete maxima 4.');
    expect(h).not.toContain('Marginal social cost'); expect(h).not.toContain('>Harm<'); expect((h.match(/role="status"/g) ?? []).length).toBe(1);
    p.locale = 'es'; p.labels.resultTemplate = 'Cantidad {quantity}: privada {private}; completa {social}; pérdida {loss}. Máximos privados {privateMaxima}; completos {socialMaxima}.';
    h = renderToStaticMarkup(createElement(MarginalSurplusChart, p)); expect(h).toContain('Cantidad 3: privada 90 cr; completa 180 cr; pérdida 10 cr. Máximos privados 3; completos 4.'); expect(h).not.toContain('cr cr');
    p.marginalBenefits = Array(8).fill(1000); p.marginalPrivateCosts = Array(8).fill(0); p.initialQuantity = 8; p.scenarios = [{ id: 'max', label: 'Máximo', externalPerUnit: 1000 }];
    expect(renderToStaticMarkup(createElement(MarginalSurplusChart, p))).toContain('16.000 cr'); p.locale = 'en'; expect(renderToStaticMarkup(createElement(MarginalSurplusChart, p))).toContain('16,000 cr');
  });

  test('the active variant and all hidden cases reject invalid data before hooks', () => {
    const changes: Array<(p: MarginalSurplusChartProps) => void> = [
      p => { Object.assign(p, { externalEffect: 'other' }); },
      p => { Object.assign(p.labels, { socialBenefit: ' ' }); },
      p => { Object.assign(p.labels, { totalExternalBenefit: ' Benefit' }); },
      p => { p.scenarios[2]!.externalPerUnit = -1; }, p => { p.scenarios[2]!.externalPerUnit = Infinity; },
      p => { p.marginalPrivateCosts[0] = -1; }, p => { delete p.scenarios[1]; },
      p => { Object.setPrototypeOf(p, { externalEffect: 'benefit' }); delete (p as { externalEffect?: string }).externalEffect; },
    ];
    for (const change of changes) { const p = benefitFixture(); change(p); expect(() => MarginalSurplusChart(p)).toThrow('MarginalSurplusChart:'); }
    const p = fixture(); Object.assign(p, { externalEffect: 'benefit' }); expect(() => MarginalSurplusChart(p)).toThrow('socialBenefit');
  });
});
