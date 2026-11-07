import { expect, test } from 'bun:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { PayoffMatrix, type PayoffMatrixProps } from '@/components/react/PayoffMatrix';

const props: PayoffMatrixProps = {
  rowPlayer:'Ana', colPlayer:'Ben', rowStrategies:['Start','Wait'], colStrategies:['Start','Wait'],
  payoffs:[[{row:4,col:4},{row:-2,col:1}],[{row:1,col:-2},{row:1,col:1}]], editable:false,
};
const caption = (html: string) => html.match(/<caption class="sr-only">(.*?)<\/caption>/)?.[1];
test('default accessible caption preserves the English description', () => {
  expect(caption(renderToStaticMarkup(createElement(PayoffMatrix,props)))).toBe('Ana chooses a row; Ben chooses a column. Each cell lists the row payoff then the column payoff.');
});
test('Spanish accessible caption interpolates actual names without English fallback', () => {
  const html=renderToStaticMarkup(createElement(PayoffMatrix,{...props,tableCaptionTemplate:'{rowPlayer} elige fila; {colPlayer} elige columna. Cada celda muestra primero el pago de la fila y luego el de la columna.'}));
  expect(caption(html)).toBe('Ana elige fila; Ben elige columna. Cada celda muestra primero el pago de la fila y luego el de la columna.');
  expect(html).not.toContain('chooses a row');
});
