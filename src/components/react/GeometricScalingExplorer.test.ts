import { describe, expect, test } from 'bun:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { GeometricScalingExplorer, getCubeMetrics, type CubeComparison, type CubeGroup, type GeometricScalingExplorerProps } from '@/components/react/GeometricScalingExplorer';

const comparisons: CubeComparison[] = [
  { id: 'double', label: 'Double one edge', groups: [{ label: 'Small cube', count: 1, scaleTwice: 2 }, { label: 'Large cube', count: 1, scaleTwice: 4 }] },
  { id: 'eight', label: 'Equal total volume', groups: [{ label: 'Eight separate small cubes', count: 8, scaleTwice: 2 }, { label: 'One large cube', count: 1, scaleTwice: 4 }] },
];
const props: GeometricScalingExplorerProps = {
  title: 'Closed cubes', instructions: 'Compare separate closed cubes.', baseEdge: 10, unit: 'cm', comparisons,
  labels: { comparison: 'Comparison', group: 'Group', count: 'Number of cubes', edge: 'Edge of one cube', area: 'Total external area', volume: 'Total volume', ratio: 'Area / volume', table: 'Exact geometry and rounded decimals', chart: 'Cubes on one scale', representative: 'One representative cube per group.', chartDescription: '{firstCount} in {first}; {secondCount} in {second}; edges {firstEdge} and {secondEdge} {unit}.', status: '{comparison}: {firstArea} and {secondArea} square units; {firstVolume} and {secondVolume} cubic units.' },
};

describe('GeometricScalingExplorer exact geometry', () => {
  test('doubling an edge multiplies area by four and volume by eight', () => {
    expect(getCubeMetrics(10, comparisons[0].groups[0])).toEqual({ edge: { numerator: 10, denominator: 1 }, area: { numerator: 600, denominator: 1 }, volume: { numerator: 1000, denominator: 1 }, ratio: { numerator: 3, denominator: 5 } });
    expect(getCubeMetrics(10, comparisons[0].groups[1])).toEqual({ edge: { numerator: 20, denominator: 1 }, area: { numerator: 2400, denominator: 1 }, volume: { numerator: 8000, denominator: 1 }, ratio: { numerator: 3, denominator: 10 } });
  });

  test('eight separate small cubes preserve volume but expose twice the area', () => {
    const small = getCubeMetrics(10, comparisons[1].groups[0]), large = getCubeMetrics(10, comparisons[1].groups[1]);
    expect(small.volume).toEqual(large.volume);
    expect(small.area).toEqual({ numerator: 4800, denominator: 1 });
    expect(large.area).toEqual({ numerator: 2400, denominator: 1 });
    expect(small.ratio).toEqual({ numerator: 3, denominator: 5 });
  });

  test('half-unit inputs retain exact fractions at both allowed size boundaries', () => {
    expect(getCubeMetrics(1, { label: 'Half', count: 1, scaleTwice: 1 })).toEqual({ edge: { numerator: 1, denominator: 2 }, area: { numerator: 3, denominator: 2 }, volume: { numerator: 1, denominator: 8 }, ratio: { numerator: 12, denominator: 1 } });
    expect(getCubeMetrics(100, { label: 'Largest group', count: 8, scaleTwice: 4 })).toEqual({ edge: { numerator: 200, denominator: 1 }, area: { numerator: 1920000, denominator: 1 }, volume: { numerator: 64000000, denominator: 1 }, ratio: { numerator: 3, denominator: 100 } });
  });

  test('hidden groups, holes, non-finite values and duplicate selectors are rejected', () => {
    const badGroups: CubeGroup[] = [{ label: 'Bad', count: 0, scaleTwice: 2 }, { label: 'Bad', count: 9, scaleTwice: 2 }, { label: 'Bad', count: 1, scaleTwice: 0 }, { label: 'Bad', count: 1, scaleTwice: 2.5 }, { label: 'Bad', count: Infinity, scaleTwice: 2 }, { label: '', count: 1, scaleTwice: 2 }];
    for (const group of badGroups) expect(() => renderToStaticMarkup(createElement(GeometricScalingExplorer, { ...props, comparisons: [comparisons[0], { id: 'bad', label: 'Hidden', groups: [group, comparisons[0].groups[1]] }] }))).toThrow('GeometricScalingExplorer');
    expect(() => renderToStaticMarkup(createElement(GeometricScalingExplorer, { ...props, comparisons: [comparisons[0], { ...comparisons[1], groups: new Array(2) as unknown as CubeComparison['groups'] }] }))).toThrow();
    expect(() => renderToStaticMarkup(createElement(GeometricScalingExplorer, { ...props, comparisons: [comparisons[0], { ...comparisons[1], label: comparisons[0].label }] }))).toThrow();
    for (const baseEdge of [0, 101, 1.5, NaN]) expect(() => getCubeMetrics(baseEdge, comparisons[0].groups[0])).toThrow();
  });

  test('all presets share fixed physical and metric scales', () => {
    for (const rows of [comparisons, [...comparisons].reverse()]) {
      const html = renderToStaticMarkup(createElement(GeometricScalingExplorer, { ...props, comparisons: rows }));
      expect(html).toContain('data-global-edge="20"');
      expect(html).toContain('data-cube-metric="area" data-metric-maximum="4800"');
      expect(html).toContain('data-cube-metric="volume" data-metric-maximum="8000"');
      expect(html).toContain('stroke-width="2"');
    }
  });

  test('non-terminating display is explicitly approximate beside its exact fraction', () => {
    const html = renderToStaticMarkup(createElement(GeometricScalingExplorer, { ...props, locale: 'es', baseEdge: 64 }));
    expect(html).toContain('3/64 (≈0,0469)');
  });
});
