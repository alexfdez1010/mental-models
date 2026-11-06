import { describe, expect, test } from 'bun:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { RateComparison, type RateComparisonScenario } from '@/components/react/RateComparison';

const firstWeek: RateComparisonScenario = {
  label: 'First follow-up week',
  groups: [
    { label: 'Checklist', events: 96, total: 600 },
    { label: 'Usual practice', events: 114, total: 600 },
  ],
};

const wholeWindow: RateComparisonScenario = {
  label: 'Whole planned window',
  groups: [
    { label: 'Checklist', events: 288, total: 1800 },
    { label: 'Usual practice', events: 324, total: 1800 },
  ],
};

function render(scenarios: RateComparisonScenario[], locale: 'en' | 'es' = 'en'): string {
  return renderToStaticMarkup(createElement(RateComparison, { scenarios, locale }));
}

describe('RateComparison', () => {
  test('shows authored first-week rates and a signed first-minus-second contrast', () => {
    const html = render([firstWeek]);
    expect(html).toContain('96 / 600');
    expect(html).toContain('114 / 600');
    expect(html).toContain('16%');
    expect(html).toContain('19%');
    expect(html).toContain('Checklist − Usual practice');
    expect(html).toContain('-3 percentage points');
    expect(html).toContain('scaleX(0.16)');
    expect(html).toContain('scaleX(0.19)');
    expect(html).not.toContain('<select');
  });

  test('uses the planned window denominators rather than averaging event counts', () => {
    const html = render([wholeWindow]);
    expect(html).toContain('288 / 1,800');
    expect(html).toContain('324 / 1,800');
    expect(html).toContain('16%');
    expect(html).toContain('18%');
    expect(html).toContain('-2 percentage points');
  });

  test('reverses the contrast when the group order reverses', () => {
    const html = render([{ ...firstWeek, groups: [...firstWeek.groups].reverse() }]);
    expect(html).toContain('Usual practice − Checklist');
    expect(html).toContain('+3 percentage points');
  });

  test('retains the first-two contrast when additional groups are displayed', () => {
    const html = render([{
      ...firstWeek,
      groups: [...firstWeek.groups, { label: 'Routine queues', events: 66, total: 600 }],
    }]);
    expect(html).toContain('Routine queues');
    expect(html).toContain('11%');
    expect(html).toContain('-3 percentage points');
  });

  test('localizes rates, counts, units and selector chrome', () => {
    const spanish: RateComparisonScenario = {
      label: 'Periodo completo',
      groups: [
        { label: 'Con lista', events: 18000, total: 54000 },
        { label: 'Práctica habitual', events: 27000, total: 54000 },
      ],
    };
    const html = render([spanish, { ...spanish, label: 'Otro periodo' }], 'es');
    expect(html).toContain('Escenario');
    expect(html).toContain('Casos del total');
    expect(html).toContain('18.000 / 54.000');
    expect(html).toContain('33,33');
    expect(html).toContain('Diferencia: Con lista − Práctica habitual');
    expect(html).toContain('-16,67 puntos porcentuales');
    expect(html).not.toContain('percentage points');
    expect(html).toContain('<select');
    expect(html).toContain('aria-live="polite"');
  });

  test('keeps zero and full rates on the same scale and handles singular units', () => {
    const html = render([{
      label: 'Limits',
      groups: [{ label: 'None', events: 0, total: 100 }, { label: 'All', events: 100, total: 100 }],
    }]);
    expect(html).toContain('scaleX(0)');
    expect(html).toContain('scaleX(1)');
    expect(html).toContain('-100 percentage points');
    const singular = render([{
      label: 'One point',
      groups: [{ label: 'First', events: 2, total: 100 }, { label: 'Second', events: 1, total: 100 }],
    }]);
    expect(singular).toContain('+1 percentage point<');
  });

  test('rejects invalid scenarios and groups, including initially unselected data', () => {
    const invalid: unknown[] = [
      [], null, [null], new Array(1), [{ label: ' ', groups: firstWeek.groups }],
      [{ label: 'One group', groups: [firstWeek.groups[0]] }],
      [{ label: 'No groups', groups: null }],
      [{ label: 'Sparse groups', groups: new Array(2) }],
      [firstWeek, { label: 'Invalid later scenario', groups: [null, firstWeek.groups[0]] }],
      [{ label: 'Blank group', groups: [{ label: '', events: 1, total: 2 }, firstWeek.groups[1]] }],
    ];
    for (const scenarios of invalid) {
      expect(() => render(scenarios as RateComparisonScenario[])).toThrow('RateComparison:');
    }
  });

  test('rejects invalid numerators and denominators before rendering', () => {
    for (const total of [0, -1, 2.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
      expect(() => render([{
        label: 'Invalid count',
        groups: [{ label: 'First', events: 0, total }, firstWeek.groups[1]!],
      }])).toThrow('RateComparison:');
    }
    for (const events of [-1, 1.5, NaN, Infinity, 101, Number.MAX_SAFE_INTEGER + 1]) {
      expect(() => render([{
        label: 'Invalid count',
        groups: [{ label: 'First', events, total: 100 }, firstWeek.groups[1]!],
      }])).toThrow('RateComparison:');
    }
  });

  test('rejects empty control and unit labels rather than losing their meaning', () => {
    for (const labels of [{ scenarioLabel: ' ' }, { countsLabel: '' }, { differenceLabel: '' }, { pointLabel: '' }, { pointsLabel: '' }]) {
      expect(() => renderToStaticMarkup(createElement(RateComparison, {
        scenarios: [firstWeek, wholeWindow], ...labels,
      }))).toThrow('RateComparison:');
    }
  });
});
