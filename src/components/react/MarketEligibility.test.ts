import { describe, expect, test } from 'bun:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MarketEligibility, marketEligibilityAtPrice, type MarketBuyer, type MarketSeller, type MarketEligibilityLabels } from '@/components/react/MarketEligibility';

const buyers: MarketBuyer[] = [14,12,10,8,6].map((value,i)=>({id:'ABCDE'[i],label:'ABCDE'[i],value}));
const sellers: MarketSeller[] = [3,5,7,9,11].map((cost,i)=>({id:'UVWXY'[i],label:'UVWXY'[i],cost}));
const labels: MarketEligibilityLabels = {price:'Precio',buyers:'Compradores',sellers:'Vendedores',buyerThreshold:'Máximo',sellerThreshold:'Mínimo',willing:'Dispuesto',unwilling:'Fuera del rango',buyerCount:'Compradores dispuestos',sellerCount:'Vendedores dispuestos',maximum:'Máximo factible',boundHint:'No es un registro de ventas.',priceMarker:'Precio elegido',reservationBar:'Valor de reserva'};

describe('finite posted-price eligibility', () => {
  test('a clearing willingness count is not a selected allocation', () => {
    expect(marketEligibilityAtPrice(buyers,sellers,8.5)).toEqual({buyerIds:['A','B','C'],sellerIds:['U','V','W'],maximum:3});
    expect(marketEligibilityAtPrice(buyers,sellers,6.5)).toEqual({buyerIds:['A','B','C','D'],sellerIds:['U','V'],maximum:2});
    expect(marketEligibilityAtPrice(buyers,sellers,9.5)).toEqual({buyerIds:['A','B','C'],sellerIds:['U','V','W','X'],maximum:3});
  });
  test('one changed value changes demand at the unchanged price', () => {
    const changed=buyers.map(b=>b.id==='E'?{...b,value:13}:b);
    expect(marketEligibilityAtPrice(changed,sellers,8.5)).toEqual({buyerIds:['A','B','C','E'],sellerIds:['U','V','W'],maximum:3});
    expect(marketEligibilityAtPrice(changed,sellers,9.5)).toEqual({buyerIds:['A','B','C','E'],sellerIds:['U','V','W','X'],maximum:4});
  });
  test('checks every comparison price and both empty-side bounds', () => {
    const prices=Array.from({length:15},(_,i)=>i+0.5);
    expect(prices.map(p=>marketEligibilityAtPrice(buyers,sellers,p).maximum)).toEqual([0,0,0,1,1,2,2,3,3,3,2,2,1,1,0]);
    expect(marketEligibilityAtPrice(buyers,sellers,0.5).sellerIds).toEqual([]);
    expect(marketEligibilityAtPrice(buyers,sellers,14.5).buyerIds).toEqual([]);
  });
  test('does not round a real strict inequality into indifference', () => {
    const tiny=[{id:'buyer',label:'Buyer',value:8.500000000000002}];
    expect(marketEligibilityAtPrice(tiny,sellers,8.5).buyerIds).toEqual(['buyer']);
  });
  test('rejects malformed participants and indifferent comparison prices', () => {
    expect(()=>marketEligibilityAtPrice([],sellers,8.5)).toThrow('buyers');
    expect(()=>marketEligibilityAtPrice(buyers,[],8.5)).toThrow('sellers');
    expect(()=>marketEligibilityAtPrice([buyers[0],buyers[0]],sellers,8.5)).toThrow('unique');
    expect(()=>marketEligibilityAtPrice([{...buyers[0],value:NaN}],sellers,8.5)).toThrow('finite');
    expect(()=>marketEligibilityAtPrice(buyers,[{...sellers[0],cost:-1}],8.5)).toThrow('nonnegative');
    expect(()=>marketEligibilityAtPrice(buyers,sellers,Infinity)).toThrow('finite');
    expect(()=>marketEligibilityAtPrice(buyers,sellers,8)).toThrow('indifference');
    expect(()=>marketEligibilityAtPrice(buyers,sellers,7)).toThrow('indifference');
  });
  test('renders localized numbers and an explicit non-sales bound', () => {
    const html=renderToStaticMarkup(createElement(MarketEligibility,{title:'Mercado',instructions:'Compara los precios.',caption:'Una sesión.',buyers,sellers,prices:[6.5,8.5,9.5],initialPrice:8.5,valueUnit:'cr',locale:'es',labels}));
    expect(html).toContain('8,5 cr');
    expect(html).toContain('No es un registro de ventas.');
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain('not-prose');
    expect(html).not.toContain('8.5 cr');
  });
  test('rejects invalid price menus during rendering', () => {
    const props={title:'Market',instructions:'Compare.',caption:'One session.',buyers,sellers,prices:[6.5,8.5],initialPrice:8.5,valueUnit:'cr',labels};
    expect(()=>renderToStaticMarkup(createElement(MarketEligibility,{...props,prices:[8.5,6.5]}))).toThrow('strictly increasing');
    expect(()=>renderToStaticMarkup(createElement(MarketEligibility,{...props,initialPrice:9.5}))).toThrow('initialPrice');
    expect(()=>renderToStaticMarkup(createElement(MarketEligibility,{...props,prices:[7,8.5]}))).toThrow('indifference');
    expect(()=>renderToStaticMarkup(createElement(MarketEligibility,{...props,title:''}))).toThrow('nonempty');
  });
});
