import { describe, test, expect } from 'bun:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { auditLocalUpdateTrace, localUpdateStatus, LocalUpdateTrace, type LocalUpdateTraceProps, type LocalUpdateProtocol, type LocalConfiguration, type LocalNode } from '@/components/react/LocalUpdateTrace';

const nodes: LocalNode[] = ['A','B','C','D'];
const bits = (s: string) => s.split('').map(Number) as LocalConfiguration;
const states = Array.from({ length: 16 }, (_, i) => i.toString(2).padStart(4,'0'));
function fixture(): LocalUpdateTraceProps {
  return { title:'Audit a ring',instructions:'Choose the start and protocol; inspect the complete declared trace.',cases:[{id:'alternating',label:'Alternating',initial:bits('0101')}],protocols:[{id:'parallel',label:'Parallel',description:'Read the preceding complete snapshot and commit together.',mode:'parallel',rounds:2},{id:'abcd',label:'ABCD',description:'Read the latest values, in ABCD order.',mode:'sequential',rounds:1,order:['A','B','C','D']},{id:'bcda',label:'BCDA',description:'Read the latest values, in BCDA order.',mode:'sequential',rounds:1,order:['B','C','D','A']}],nodeLabels:['Node A','Node B','Node C','Node D'],labels:{caseLabel:'Start',protocolLabel:'Protocol',previousLabel:'Back',nextLabel:'Next',resetLabel:'Reset',initialLabel:'Initial',stepTemplate:'Event {step} of {total}',graphLabel:'Ring',graphDescription:'The four connected nodes and their binary values.',tableLabel:'Read and write trace',eventLabel:'Event',beforeLabel:'Before',updatedLabel:'Updated',inputsLabel:'Inputs',proposalLabel:'Proposal',afterLabel:'After',noneLabel:'None',allLabel:'All nodes',pinnedLabel:'Pinned to zero',roundLabel:'one round per event',sweepLabel:'one node update per event',fixedLabel:'Fixed.',notFixedLabel:'Not fixed.',consensusLabel:'Consensus.',mixedLabel:'Mixed.',cycleLabel:'Cycle length {length}.',readRuleLabel:'Reads and writes',announcementTemplate:'{step}. {protocol}. {configuration}. {status}'} };
}
// The independent oracle encodes a binary integer and Boolean pairs, not the component's count rule.
function one(mask: number, i: number) {
  const values=[(i+3)%4,i,(i+1)%4].map(j => Boolean(mask & (1<<(3-j))));
  const v=Number(values[0]&&values[1] || values[0]&&values[2] || values[1]&&values[2]);
  return (mask & ~(1<<(3-i))) | v<<(3-i);
}
function simultaneous(mask: number,pin=false) { let out=0;for(let i=0;i<4;i++)if(!(pin&&i===0))out |= one(mask,i)&(1<<(3-i));return out; }
function permutations(a: LocalNode[]): LocalNode[][] { return a.length ? a.flatMap((n,i)=>permutations(a.filter((_,j)=>i!==j)).map(rest=>[n,...rest])) : [[]]; }
const encoded=(s: LocalConfiguration)=>s.join('');

describe('LocalUpdateTrace finite model',()=>{
 test('all starts, input triples and twenty-four immediate-write orders match the independent bit oracle',()=>{
  let sweeps=0;
  for(const start of states){
   const c={id:start,label:start,initial:bits(start)}, parallel=fixture().protocols[0]!;
   const tr=auditLocalUpdateTrace([c],[parallel])[0]![0]!;
   let mask=parseInt(start,2);
   for(let step=1;step<=2;step++){mask=simultaneous(mask);expect(encoded(tr[step]!.after)).toBe(mask.toString(2).padStart(4,'0'));for(const r of tr[step]!.reads){expect(r.values).toEqual(r.sources.map(i=>tr[step]!.before[i]));expect(r.proposal).toBe((one(parseInt(encoded(tr[step]!.before),2),r.target)>>(3-r.target))&1);}}
   for(const order of permutations(nodes)){
    const p: LocalUpdateProtocol={id:'order',label:'Declared order',description:'Read the latest values and write immediately.',mode:'sequential',rounds:1,order:order as [LocalNode,LocalNode,LocalNode,LocalNode]};
    const tr=auditLocalUpdateTrace([c],[p])[0]![0]!;expect(tr.length).toBe(5);let k=parseInt(start,2);
    for(let j=0;j<4;j++){k=one(k,nodes.indexOf(order[j]!));expect(encoded(tr[j+1]!.after)).toBe(k.toString(2).padStart(4,'0'));expect(tr[j+1]!.phase).toBe((j+1)%4);expect(tr[j+1]!.round).toBe(j===3?1:0);expect(tr[j+1]!.reads.length).toBe(1);expect(tr[j+1]!.reads[0]!.values).toEqual(tr[j+1]!.reads[0]!.sources.map(i=>tr[j+1]!.before[i]));}
    expect(localUpdateStatus(tr,4).fixed).toBe(true);expect(simultaneous(k)).toBe(k);sweeps++;
   }
  }
  expect(sweeps).toBe(384);
 });
 test('unchanged intermediate updates neither close nor truncate a sweep; only the alternating completed-round repeat announces a cycle',()=>{
  const f=fixture(),[parallel,abcd,bcda]=auditLocalUpdateTrace(f.cases,f.protocols)[0]!;
  expect(parallel!.map(e=>encoded(e.after))).toEqual(['0101','1010','0101']);expect(localUpdateStatus(parallel!,1).cycleLength).toBeNull();expect(localUpdateStatus(parallel!,2).cycleLength).toBe(2);
  expect(abcd!.map(e=>encoded(e.after))).toEqual(['0101','1101','1101','1111','1111']);expect(localUpdateStatus(abcd!,2)).toEqual({fixed:false,consensus:false,cycleLength:null});expect(localUpdateStatus(abcd!,3).fixed).toBe(true);expect(abcd!.length).toBe(5);expect(localUpdateStatus(abcd!,4).cycleLength).toBeNull();
  expect(bcda!.map(e=>encoded(e.after))).toEqual(['0101','0001','0001','0000','0000']);
  const fixed=auditLocalUpdateTrace([{id:'fixed',label:'Fixed mixed',initial:bits('0011')}],[f.protocols[0]!])[0]![0]!;expect(localUpdateStatus(fixed,2)).toEqual({fixed:true,consensus:false,cycleLength:null});
 });
 test('persistent pin checks all eight legal starts, retains four fixed configurations and does not imply all-zero consensus',()=>{
  const starts=states.slice(0,8).map(s=>({id:s,label:s,initial:bits(s)})),traces=auditLocalUpdateTrace(starts,[fixture().protocols[0]!],0);let zeros=0;const finals=new Set<string>();
  for(let i=0;i<8;i++){const tr=traces[i]![0]!;let mask=i;for(let step=1;step<=2;step++){mask=simultaneous(mask,true);expect(encoded(tr[step]!.after)).toBe(mask.toString(2).padStart(4,'0'));expect(tr[step]!.after[0]).toBe(0);expect(tr[step]!.reads.map(r=>r.target)).toEqual([1,2,3]);}expect(localUpdateStatus(tr,2,0).fixed).toBe(true);finals.add(encoded(tr[2]!.after));if(mask===0)zeros++;}
  expect(zeros).toBe(5);expect([...finals].sort()).toEqual(['0000','0011','0110','0111']);expect(traces[5]![0]!.map(e=>encoded(e.after))).toEqual(['0101','0010','0000']);
 });
 test('invalid hidden cases, protocols and pin values fail rather than being filtered',()=>{
  const f=fixture();const invalid: Array<(x:any)=>void>=[x=>x.cases=[],x=>x.cases.push({...x.cases[0],id:'other',label:'Other',initial:[0,1,2,0]}),x=>delete x.cases[0].initial[2],x=>x.cases[0].initial=[0,1,0],x=>x.cases[0].label=' ',x=>x.cases.push({...x.cases[0]}),x=>x.cases[0].initial[1]=true,x=>x.protocols=[],x=>x.protocols[2].order=['A','A','C','D'],x=>delete x.protocols[2].order[2],x=>x.protocols[2].order=['A','B','C','E'],x=>x.protocols[2].rounds=2,x=>x.protocols[0].rounds=1.5,x=>x.protocols[0].order=['A','B','C','D'],x=>x.protocols[2].mode='random',x=>x.protocols[2].description='',x=>x.protocols[2].id=x.protocols[0].id,x=>x.pinnedA=1,x=>x.pinnedA='0',x=>{x.pinnedA=0;x.protocols=[x.protocols[0]];x.cases[0].initial[0]=1;},x=>x.pinnedA=0];
  for(const mutate of invalid){const x=structuredClone(f);mutate(x);expect(()=>auditLocalUpdateTrace(x.cases,x.protocols,x.pinnedA)).toThrow('LocalUpdateTrace:');expect(()=>renderToStaticMarkup(createElement(LocalUpdateTrace,x))).toThrow('LocalUpdateTrace:');}
 });
 test('missing interface labels and tokens fail in real SSR, including hidden protocol labels',()=>{
  const invalid:Array<(x:any)=>void>=[x=>x.title='',x=>x.instructions=' ',x=>x.locale='fr',x=>x.nodeLabels=['A','B','C'],x=>x.nodeLabels[3]=x.nodeLabels[0],x=>x.nodeLabels[3]=' '+x.nodeLabels[0]+' ',x=>delete x.nodeLabels[2],x=>x.labels.inputsLabel='',x=>x.labels.stepTemplate='{step}',x=>x.labels.cycleLabel='Repeated',x=>x.labels.announcementTemplate='{step}{protocol}{configuration}'];
  for(const mutate of invalid){const x=fixture();mutate(x);expect(()=>renderToStaticMarkup(createElement(LocalUpdateTrace,x))).toThrow('LocalUpdateTrace:');}
 });
 test('unmodified initial SSR is deterministic, preserves leading zeros and exposes one named live result and keyboard scrolling region',()=>{
  const p=fixture(),h=renderToStaticMarkup(createElement(LocalUpdateTrace,p));expect(renderToStaticMarkup(createElement(LocalUpdateTrace,p))).toBe(h);
  expect(h).toContain('style="display:table;overflow:visible;margin:0"');
  expect(h).toContain('0101');expect((h.match(/aria-live="polite"/g)??[]).length).toBe(1);expect(h).toContain('role="region" aria-label="Read and write trace" tabindex="0"');expect(h).toContain('data-fixed="false"');expect(h).toContain('data-cycle=""');expect((h.match(/data-node=/g)??[]).length).toBe(4);expect(h).not.toContain('NaN');expect(h).not.toContain('undefined');
 });
 test('announcement interpolation preserves replacement values literally instead of interpreting embedded tokens',()=>{
  const p=fixture();p.protocols[0]!.label='Protocol {configuration} {status}';p.labels.initialLabel='Initial {protocol}';p.labels.notFixedLabel='Not fixed {configuration}.';
  const h=renderToStaticMarkup(createElement(LocalUpdateTrace,p));
  const status=h.match(/<p role="status"[^>]*>(.*?)<\/p>/)![1]!;
  expect(status).toBe('Initial {protocol}. Protocol {configuration} {status}. 0101. Not fixed {configuration}. Mixed.');
 });
});
