import { expect, test } from 'bun:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { SupplyDemandChart, formatSupplyDemandNumber } from '@/components/react/SupplyDemandChart';

test('English keeps each original number representation, including gap subtraction', () => {
  for(const n of [5,5.3,2.5,7.5,Math.abs(4.3-1.2)]) {
    expect(formatSupplyDemandNumber(n)).toBe(String(n));
    expect(formatSupplyDemandNumber(n,'en')).toBe(String(n));
  }
});
test('Spanish localizes decimal marks without changing the already computed number', () => {
  expect(formatSupplyDemandNumber(5.3,'es')).toBe('5,3');
  expect(formatSupplyDemandNumber(2.5,'es')).toBe('2,5');
  expect(formatSupplyDemandNumber(5,'es')).toBe('5');
  const gap=Math.abs(4.3-1.2);
  expect(formatSupplyDemandNumber(gap,'es').replace(',','.')).toBe(String(gap));
});
test('omitting locale remains exactly equivalent to explicit English SSR', () => {
  expect(renderToStaticMarkup(createElement(SupplyDemandChart))).toBe(renderToStaticMarkup(createElement(SupplyDemandChart,{locale:'en'})));
});
