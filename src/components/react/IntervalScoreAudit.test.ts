import { describe, expect, test } from 'bun:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { IntervalScoreAudit, auditIntervalScore, type IntervalScoreAuditProps } from '@/components/react/IntervalScoreAudit';
const labels = { scenario:'Collection', rule:'Rule', record:'Record', bounds:'Bounds', outcome:'Outcome', width:'Width', outside:'Outside distance', penalty:'Penalty', score:'Score', total:'Total', mean:'Exact mean', hits:'Hits', nominal:'Nominal central level', fixedScale:'Fixed axis zero to twenty-four', intervalLegend:'Thick segment: issued interval', outcomeLegend:'Dot: resolved outcome', tableCaption:'Complete paired records', lowest:'Lowest observed total', allTied:'All observed totals tie', reset:'Restore first view', summaryTemplate:'{rule}: total {total}; mean {mean}; hits {hits}/{count}.' };
const fixture=():IntervalScoreAuditProps=>({title:'Issued intervals',instructions:'Inspect the frozen complete collection.',locale:'en',unit:'h',labels:{...labels},scenarios:[{id:'main',label:'Main',nominalPercent:80,records:[4,5,6,7,9,11].map((value,i)=>({id:'c'+i,label:'Case '+i,value})),rules:[{id:'N',label:'N',intervals:Array.from({length:6},()=>[4,8])},{id:'M',label:'M',intervals:Array.from({length:6},()=>[3,10])},{id:'W',label:'W',intervals:Array.from({length:6},()=>[2,12])}]}]});
const html=(p:IntervalScoreAuditProps)=>renderToStaticMarkup(createElement(IntervalScoreAudit,p));
const clone=(x:IntervalScoreAuditProps)=>structuredClone(x);
describe('IntervalScoreAudit',()=>{
 test('complete paired totals, hits and exact ties use all records',()=>{
  const a=auditIntervalScore(fixture())[0]!;
  expect(a.factor).toBe(10);expect(a.rules.map(x=>x.total)).toEqual([64,52,60]);expect(a.rules.map(x=>x.hits)).toEqual([4,5,6]);expect(a.minima).toEqual([1]);
  expect(a.rules[0]!.rows.map(x=>x.score)).toEqual([4,4,4,4,14,34]);
  const named=fixture();named.scenarios[0]!.rules[0]!.label='{count}';expect(html(named)).toContain('{count}: total 64; mean 32/3; hits 4/6.');
  const p=fixture();p.scenarios[0]!.rules[1]!.intervals=p.scenarios[0]!.rules[0]!.intervals;p.scenarios[0]!.rules[2]!.intervals=p.scenarios[0]!.rules[0]!.intervals;
  expect(auditIntervalScore(p)[0]!.minima).toEqual([0,1,2]);expect(html(p)).toContain(labels.allTied);
 });
 test('independent quantile-loss oracle covers tails, endpoints, zero width and every penalty factor',()=>{
  const pinNumerator=(percent:number,residual:number)=>residual>=0?percent*residual:(percent-100)*residual;
  for(const nominalPercent of [50,80,90] as const)for(const lower of [0,4,8,12,24])for(const upper of [0,4,8,12,24])if(lower<=upper)for(const value of [0,4,8,12,24]){
   const p=fixture();p.scenarios[0]!.nominalPercent=nominalPercent;p.scenarios[0]!.records=[{id:'one',label:'One',value}];p.scenarios[0]!.rules=p.scenarios[0]!.rules.slice(0,2).map(r=>({...r,intervals:[[lower,upper]]}));
   const r=auditIntervalScore(p)[0]!,row=r.rules[0]!.rows[0]!,tailPercent=(100-nominalPercent)/2;
   const numerator=2*(pinNumerator(tailPercent,value-lower)+pinNumerator(100-tailPercent,value-upper));
   expect(row.score*(100-nominalPercent)).toBe(numerator);
   expect(row.hit).toBe(lower<=value&&value<=upper);expect(Number.isSafeInteger(row.score)).toBe(true);
  }
 });
 test('valid maximal author data, boundary zeros and fractional means render without signed zero or fake rounded results',()=>{
  const p=fixture();p.scenarios[0]!.records=[{id:'a',label:'A',value:-0},{id:'b',label:'B',value:1},{id:'c',label:'C',value:4}];p.scenarios[0]!.rules=p.scenarios[0]!.rules.slice(0,2).map(r=>({...r,intervals:[[-0,-0],[0,1],[0,1]]}));
  const h=html(p);expect(h).not.toMatch(/−0|>-0<|NaN|undefined/);expect(h).toContain('mean 32/3');
  const ordinary=html(fixture());expect(ordinary).toContain('mean 32/3');expect(ordinary).toContain('data-axis-min="0" data-axis-max="24"');
  const big=fixture();big.scenarios=Array.from({length:3},(_,s)=>({id:'s'+s,label:'S'+s,nominalPercent:90,records:Array.from({length:12},(_,i)=>({id:'r'+i,label:'R'+i,value:24})),rules:Array.from({length:4},(_,j)=>({id:'q'+j,label:'Q'+j,intervals:Array.from({length:12},()=>[0,0])}))}));
  expect(auditIntervalScore(big).every(s=>s.rules.every(r=>r.total===5760))).toBe(true);
 });
 test('invalid authored data including hidden scenarios fail before rendering',()=>{
  const mutations:Array<(p:IntervalScoreAuditProps)=>void>=[
   p=>{p.scenarios=[];},p=>{p.scenarios.length=4;},p=>{delete p.scenarios[0];},p=>{p.locale='fr' as never;},p=>{p.title=' ';},p=>{p.labels.score='';},p=>{p.labels.summaryTemplate='{rule} {rule}';},
   p=>{p.scenarios[0]!.records=[];},p=>{delete p.scenarios[0]!.records[0];},p=>{p.scenarios[0]!.records[0]!.value=1.5;},p=>{p.scenarios[0]!.records[0]!.value=25;},p=>{p.scenarios[0]!.records[0]!.value=NaN;},p=>{p.scenarios[0]!.records[0]!.id=p.scenarios[0]!.records[1]!.id;},
   p=>{p.scenarios[0]!.rules.length=1;},p=>{p.scenarios[0]!.rules[0]!.intervals.pop();},p=>{delete p.scenarios[0]!.rules[0]!.intervals[1];},p=>{p.scenarios[0]!.rules[0]!.intervals[0]=[8,4];},p=>{p.scenarios[0]!.rules[0]!.intervals[0]=[0,Infinity];},p=>{p.scenarios[0]!.rules[0]!.intervals[0]=[0,-1];},p=>{p.scenarios[0]!.nominalPercent=100 as never;},
   p=>{p.scenarios.push({...clone(p).scenarios[0]!,id:'hidden',label:'Hidden'});p.scenarios[1]!.rules[0]!.intervals[2]=[0,25];}
  ];
  for(const mutate of mutations){const p=fixture();mutate(p);expect(()=>html(p)).toThrow('IntervalScoreAudit:');}
 });
 test('every main rule/case is reachable as a truthful SSR selection in both locales',()=>{
  const es={scenario:'Conjunto',rule:'Regla',record:'Registro',bounds:'Límites',outcome:'Resultado',width:'Anchura',outside:'Distancia exterior',penalty:'Penalización',score:'Puntuación',total:'Total',mean:'Media exacta',hits:'Aciertos',nominal:'Nivel central nominal',fixedScale:'Eje fijo de cero a veinticuatro',intervalLegend:'Segmento grueso: intervalo emitido',outcomeLegend:'Punto: resultado resuelto',tableCaption:'Registros emparejados completos',lowest:'Menor total observado',allTied:'Todos los totales observados empatan',reset:'Volver a la vista inicial',summaryTemplate:'{rule}: total {total}; media {mean}; aciertos {hits}/{count}.'};
  for(const locale of ['en','es'] as const)for(let rule=0;rule<3;rule++)for(let record=0;record<6;record++){
   const p=fixture(),s=p.scenarios[0]!;p.locale=locale;if(locale==='es')p.labels=es;
   const order=[record,...s.records.map((_,i)=>i).filter(i=>i!==record)];s.records=order.map(i=>s.records[i]!);s.rules=s.rules.map(r=>({...r,intervals:order.map(i=>r.intervals[i]!)}));s.rules=[s.rules[rule]!,...s.rules.filter((_,i)=>i!==rule)];
   const h=html(p);expect(h).toContain(`data-outcome="${[4,5,6,7,9,11][record]}"`);expect(h).toContain('tabindex="0" role="region"');expect(h).toContain('display:table;overflow:visible;margin:0');expect(h).toContain('aria-live="polite"');expect(h).toContain(locale==='es'?'aciertos':'hits');
  }
 });
 test('selected table row overrides contextual prose stripes using the design token',()=>{
  const rows=[...html(fixture()).matchAll(/<tr\b[^>]*data-rule-id[^>]*>/g)].map(m=>m[0]);
  expect(rows).toHaveLength(18);
  expect(rows.filter(r=>r.includes('style="background-color:var(--color-brand-50)"'))).toHaveLength(1);
  expect(rows.find(r=>r.includes('class="bg-brand-50"'))).toContain('style="background-color:var(--color-brand-50)"');
 });
});
